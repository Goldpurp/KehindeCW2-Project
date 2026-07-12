import React, {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bookmark,
  FolderOpen,
  Heart,
  MessageSquare,
  MoreHorizontal,
  Play,
  RefreshCw,
  Send
} from 'lucide-react';
import {
  arrayRemove,
  arrayUnion,
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc
} from '../lib/azure';
import { Comment, Video } from '../types';
import CommentsDrawer from './CommentsDrawer';
import RatingStars from './RatingStars';
import VideoGestureLayer from './VideoGestureLayer';
import VideoSeekControls from './VideoSeekControls';
import DeleteConfirmModal from './DeleteConfirmModal';

interface InstagramFeedListProps {
  videos: Video[];
  onRefresh: () => void;
  onSelectReel?: (video: Video, index: number) => void;
  onSelectCreator?: (creatorName: string) => void;
  onShowToast?: (message: string) => void;
  profilePhotoByUserId?: Record<string, string>;
}

const PULL_REFRESH_TRIGGER = 72;
const PULL_REFRESH_MAX = 104;
const PULL_REFRESH_SETTLE_MS = 420;
const countedViewSessions = new Set<string>();

const formatCount = (value = 0) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(value);
};

const getInitials = (name: string) => {
  return name.substring(0, 2).toUpperCase();
};

const getRelativeTime = (createdAt: any) => {
  const rawDate = createdAt?.toDate?.() || createdAt;
  const date = rawDate instanceof Date ? rawDate : rawDate ? new Date(rawDate) : null;
  if (!date || Number.isNaN(date.getTime())) return 'unknown';

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return `${Math.max(1, Math.floor(days / 7))}w`;
};

function InstagramPostCard({
  video,
  index,
  onRefresh,
  onSelectReel,
  onSelectCreator,
  onShowToast,
  profilePhotoByUserId = {}
}: {
  key?: string;
  video: Video;
  index: number;
  onRefresh: () => void;
  onSelectReel?: (video: Video, index: number) => void;
  onSelectCreator?: (creatorName: string) => void;
  onShowToast?: (message: string) => void;
  profilePhotoByUserId?: Record<string, string>;
}) {
  const currentUserId = auth.currentUser?.uid;
  const isLiked = Boolean(currentUserId && video.likes?.includes(currentUserId));
  const canDeleteVideo = Boolean(currentUserId && currentUserId === video.creatorId);
  const viewSessionKey = currentUserId ? `${currentUserId}:${video.id}` : '';
  const creatorPhotoURL = video.creatorPhotoURL || profilePhotoByUserId[video.creatorId] || '';

  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [inlineComments, setInlineComments] = useState<Comment[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  const playCurrentVideo = () => {
    const node = videoRef.current;
    if (!node) return;

    node.play().then(() => {
      setPlaying(true);
    }).catch(() => {
      setPlaying(false);
    });
  };

  const pauseCurrentVideo = () => {
    const node = videoRef.current;
    if (!node) return;

    node.pause();
    setPlaying(false);
  };

  useEffect(() => {
    if (!video.id) return;

    const commentsRef = collection(db, 'videos', video.id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Comment[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Comment);
      });
      setInlineComments(list);
    });

    return () => unsubscribe();
  }, [video.id]);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseCurrentVideo();
      }
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.62 && !document.hidden) {
          playCurrentVideo();
        } else {
          pauseCurrentVideo();
        }
      });
    }, { threshold: [0, 0.35, 0.62, 0.9] });

    observer.observe(target);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      observer.unobserve(target);
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      pauseCurrentVideo();
    };
  }, [video.id]);

  useEffect(() => {
    if (!playing || !currentUserId || currentUserId === video.creatorId || countedViewSessions.has(viewSessionKey)) return;

    const timer = window.setTimeout(async () => {
      countedViewSessions.add(viewSessionKey);
      try {
        const docRef = doc(db, 'videos', video.id);
        await updateDoc(docRef, { viewCount: 1 });
      } catch (err) {
        countedViewSessions.delete(viewSessionKey);
        console.error("Failed to auto-increment view count:", err);
      }
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [currentUserId, playing, video.creatorId, video.id, viewSessionKey]);

  const togglePlay = () => {
    if (!videoRef.current) return;

    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
      return;
    }

    videoRef.current.play().then(() => {
      setPlaying(true);
    }).catch(() => {});
  };

  const toggleLike = async () => {
    if (!currentUserId) return;

    try {
      const docRef = doc(db, 'videos', video.id);
      await updateDoc(docRef, {
        likes: isLiked ? arrayRemove(currentUserId) : arrayUnion(currentUserId)
      });
      onRefresh();
    } catch (err) {
      console.error("Error liking video:", err);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?video=${video.id}`);
      await updateDoc(doc(db, 'videos', video.id), {
        shareCount: (video.shareCount || 0) + 1
      });
      onRefresh();
      onShowToast?.('Link copied.');
    } catch (err) {
      console.error("Error sharing video:", err);
      onShowToast?.('Could not copy link.');
    }
  };

  const handleReport = () => {
    setIsOptionsOpen(false);
    onShowToast?.('Thanks. This post has been flagged for review.');
  };

  const handleDeletePost = async () => {
    if (!canDeleteVideo || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'videos', video.id));
      setIsOptionsOpen(false);
      setIsDeleteConfirmOpen(false);
      onRefresh();
      onShowToast?.('Video deleted.');
    } catch (err) {
      console.error("Error deleting video:", err);
      onShowToast?.('Could not delete video.');
    } finally {
      setIsDeleting(false);
    }
  };

  const captionPreview = video.title.length > 78 && !isCaptionExpanded
    ? `${video.title.slice(0, 78).trim()}...`
    : video.title;

  return (
    <article
      ref={containerRef}
      className="mx-auto w-full max-w-[560px] pb-8 text-white sm:pb-11"
      id={`instagram-post-${video.id}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-[4px] border border-zinc-800 bg-black">
        <video
          ref={videoRef}
          src={video.videoUrl}
          autoPlay
          preload="metadata"
          loop
          muted={muted}
          playsInline
          poster={video.thumbnailUrl}
          className="h-full w-full cursor-pointer select-none object-cover"
        />

        <VideoGestureLayer
          videoRef={videoRef}
          onTogglePlay={togglePlay}
          className="z-[8]"
        />

        <div className="absolute left-0 right-0 top-0 z-10 flex items-start justify-between gap-2 bg-gradient-to-b from-black/75 via-black/25 to-transparent p-2.5 sm:p-3">
          <button
            onClick={() => onSelectCreator?.(video.creatorName)}
            className="flex min-w-0 max-w-[calc(100%-2.5rem)] items-center gap-2 text-left"
          >
            <span className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-tr from-yellow-400 via-fuchsia-500 to-purple-600 p-[2px]">
              <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-black bg-zinc-950 text-[10px] font-black text-white">
                {creatorPhotoURL ? (
                  <img src={creatorPhotoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  getInitials(video.creatorName)
                )}
              </span>
            </span>
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-1 text-sm font-extrabold leading-none text-white">
                <span className="min-w-0 truncate">{video.creatorName}</span>
                <span className="text-xs text-sky-400">●</span>
                <span className="text-xs font-semibold text-zinc-300">· {getRelativeTime(video.createdAt)}</span>
              </span>
              <span className="mt-1 block truncate text-xs font-medium text-zinc-200">
                {video.producer || video.publisher || 'Original audio'}
              </span>
            </span>
          </button>

          <button
            onClick={() => setIsOptionsOpen((current) => !current)}
            className="rounded-full p-1 text-white/90 transition hover:bg-white/10"
            aria-label="Post options"
          >
            <MoreHorizontal size={22} />
          </button>

          <AnimatePresence>
            {isOptionsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                className="absolute right-3 top-12 z-30 w-44 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-sm font-semibold text-white shadow-2xl"
              >
                <button
                  onClick={() => {
                    setIsOptionsOpen(false);
                    onSelectCreator?.(video.creatorName);
                  }}
                  className="block w-full px-4 py-3 text-left transition hover:bg-zinc-900"
                >
                  View creator
                </button>
                <button
                  onClick={() => {
                    setIsOptionsOpen(false);
                    void handleShare();
                  }}
                  className="block w-full px-4 py-3 text-left transition hover:bg-zinc-900"
                >
                  Copy link
                </button>
                <button
                  onClick={handleReport}
                  className="block w-full px-4 py-3 text-left text-red-400 transition hover:bg-zinc-900"
                >
                  Report
                </button>
                {canDeleteVideo && (
                  <button
                    onClick={() => {
                      setIsOptionsOpen(false);
                      setIsDeleteConfirmOpen(true);
                    }}
                    className="block w-full px-4 py-3 text-left font-bold text-[#f87171] transition hover:bg-[#7f1d1d]/45 hover:text-white"
                  >
                    Delete video
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {!playing && (
            <motion.div
              initial={{ scale: 0.76, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.76, opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/5"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-white shadow-2xl backdrop-blur-md">
                <Play size={26} className="ml-1 fill-current" />
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <VideoSeekControls
          videoRef={videoRef}
          muted={muted}
          onToggleMuted={() => setMuted(!muted)}
          className="absolute bottom-3 right-3 z-20"
        />
      </div>

      <div className="px-1 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-white">
            <button
              onClick={toggleLike}
              disabled={!currentUserId}
            className={`flex h-11 w-11 items-center justify-start transition active:scale-90 ${isLiked ? 'text-red-500' : 'hover:text-zinc-300'}`}
              aria-label="Like video"
            >
              <Heart size={29} className={isLiked ? 'fill-current' : ''} strokeWidth={2} />
            </button>

            <button
              onClick={() => setIsCommentsOpen(true)}
              className="flex h-11 w-11 items-center justify-center transition hover:text-zinc-300 active:scale-90"
              aria-label="Open comments"
            >
              <MessageSquare size={28} strokeWidth={2} />
            </button>

            <button
              onClick={handleShare}
              className="flex h-11 w-11 items-center justify-center transition hover:text-zinc-300 active:scale-90"
              aria-label="Share video"
            >
              <Send size={27} strokeWidth={2} />
            </button>
          </div>

          <button
            onClick={() => setIsBookmarked(!isBookmarked)}
            className={`flex h-11 w-11 items-center justify-end transition hover:text-zinc-300 active:scale-90 ${isBookmarked ? 'text-white' : 'text-white'}`}
            aria-label="Save video"
          >
            <Bookmark size={28} className={isBookmarked ? 'fill-current' : ''} strokeWidth={2} />
          </button>
        </div>

        <div className="pt-2 text-sm font-semibold text-white">
          {formatCount(video.likes?.length || 0)} likes
        </div>

        <div className="pt-1 text-sm leading-snug text-zinc-200">
          <button
            onClick={() => onSelectCreator?.(video.creatorName)}
            className="mr-1 font-extrabold text-white hover:text-zinc-300"
          >
            {video.creatorName}
          </button>
          <span>{captionPreview}</span>
          {video.title.length > 78 && (
            <button
              onClick={() => setIsCaptionExpanded((current) => !current)}
              className="ml-1 text-zinc-500 transition hover:text-zinc-300"
            >
              {isCaptionExpanded ? 'less' : 'more'}
            </button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2.5">
          <button
            onClick={() => setIsCommentsOpen(true)}
            className="text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            View all {inlineComments.length} comments
          </button>
          <RatingStars video={video} onRatingUpdate={onRefresh} />
        </div>
      </div>

      <CommentsDrawer
        isOpen={isCommentsOpen}
        video={video}
        profilePhotoByUserId={profilePhotoByUserId}
        onClose={() => setIsCommentsOpen(false)}
        onCommentCountUpdate={onRefresh}
      />

      <DeleteConfirmModal
        isOpen={isDeleteConfirmOpen}
        itemName={video.title}
        isDeleting={isDeleting}
        onCancel={() => !isDeleting && setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeletePost}
      />
    </article>
  );
}

export default function InstagramFeedList({
  videos,
  onRefresh,
  onSelectReel,
  onSelectCreator,
  onShowToast,
  profilePhotoByUserId = {}
}: InstagramFeedListProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartYRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const isPullGestureRef = useRef(false);
  const suppressNextClickRef = useRef(false);

  const setTrackedPullDistance = (value: number) => {
    const nextValue = Math.max(0, value);
    pullDistanceRef.current = nextValue;
    setPullDistance(nextValue);
  };

  const pageScrollTop = () => {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  };

  const runPullRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setTrackedPullDistance(PULL_REFRESH_TRIGGER);

    try {
      await Promise.all([
        Promise.resolve(onRefresh()),
        new Promise<void>((resolve) => window.setTimeout(resolve, PULL_REFRESH_SETTLE_MS))
      ]);
      onShowToast?.('Latest videos loaded.');
    } catch (err) {
      console.error("Error refreshing feed:", err);
      onShowToast?.('Could not refresh videos.');
    } finally {
      setIsRefreshing(false);
      setTrackedPullDistance(0);
    }
  };

  const resetPullGesture = () => {
    pullStartYRef.current = null;
    activePointerIdRef.current = null;
    isPullGestureRef.current = false;
  };

  const suppressClickAfterPull = () => {
    suppressNextClickRef.current = true;
    window.setTimeout(() => {
      suppressNextClickRef.current = false;
    }, 350);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isRefreshing || event.pointerType !== 'mouse' || event.button !== 0 || pageScrollTop() > 0) return;

    pullStartYRef.current = event.clientY;
    activePointerIdRef.current = event.pointerId;
    isPullGestureRef.current = false;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      event.pointerType !== 'mouse' ||
      event.buttons !== 1 ||
      isRefreshing ||
      activePointerIdRef.current !== event.pointerId ||
      pullStartYRef.current === null
    ) {
      return;
    }

    const dragDistance = event.clientY - pullStartYRef.current;
    if (dragDistance <= 0 || pageScrollTop() > 0) {
      setTrackedPullDistance(0);
      return;
    }

    if (dragDistance > 6) {
      isPullGestureRef.current = true;
      event.preventDefault();
      setTrackedPullDistance(Math.min(PULL_REFRESH_MAX, dragDistance * 0.55));
    }
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || activePointerIdRef.current !== event.pointerId) return;

    const shouldRefresh = pullDistanceRef.current >= PULL_REFRESH_TRIGGER;
    const wasPullGesture = isPullGestureRef.current;
    resetPullGesture();

    if (wasPullGesture) {
      suppressClickAfterPull();
      event.preventDefault();
      event.stopPropagation();
    }

    if (shouldRefresh) {
      void runPullRefresh();
    } else {
      setTrackedPullDistance(0);
    }
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || activePointerIdRef.current !== event.pointerId) return;
    resetPullGesture();
    setTrackedPullDistance(0);
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (isRefreshing || event.touches.length !== 1 || pageScrollTop() > 0) return;

    pullStartYRef.current = event.touches[0].clientY;
    activePointerIdRef.current = null;
    isPullGestureRef.current = false;
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (isRefreshing || pullStartYRef.current === null || activePointerIdRef.current !== null) return;

    const touch = event.touches[0];
    if (!touch) return;

    const dragDistance = touch.clientY - pullStartYRef.current;
    if (dragDistance <= 0 || pageScrollTop() > 0) {
      setTrackedPullDistance(0);
      return;
    }

    if (dragDistance > 6) {
      isPullGestureRef.current = true;
      event.preventDefault();
      setTrackedPullDistance(Math.min(PULL_REFRESH_MAX, dragDistance * 0.55));
    }
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (pullStartYRef.current === null || activePointerIdRef.current !== null) return;

    const shouldRefresh = pullDistanceRef.current >= PULL_REFRESH_TRIGGER;
    const wasPullGesture = isPullGestureRef.current;
    resetPullGesture();

    if (wasPullGesture) {
      suppressClickAfterPull();
      event.preventDefault();
      event.stopPropagation();
    }

    if (shouldRefresh) {
      void runPullRefresh();
    } else {
      setTrackedPullDistance(0);
    }
  };

  const handleTouchCancel = () => {
    if (pullStartYRef.current === null || activePointerIdRef.current !== null) return;
    resetPullGesture();
    setTrackedPullDistance(0);
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressNextClickRef.current) return;

    suppressNextClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const pullProgress = Math.min(pullDistance / PULL_REFRESH_TRIGGER, 1);
  const pullStatus = isRefreshing
    ? 'Refreshing'
    : pullProgress >= 1
      ? 'Release'
      : 'Pull';

  if (videos.length === 0) {
    return (
      <div className="mx-auto flex min-h-[46dvh] w-full max-w-[560px] flex-col items-center justify-center rounded-[4px] border border-zinc-900 bg-black p-5 text-center text-zinc-500 sm:p-8">
        <FolderOpen size={42} className="mb-3 text-zinc-800" />
        <h3 className="mb-1 text-sm font-bold text-white">No posts yet</h3>
        <p className="mb-5 max-w-xs text-xs text-zinc-500">Latest uploaded videos will appear here.</p>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-bold text-black transition hover:bg-zinc-200"
        >
          <RefreshCw size={13} />
          Reload
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative w-full"
      id="instagram-feed-list-viewport"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerCancel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onClickCapture={handleClickCapture}
    >
      <motion.div
        initial={false}
        animate={{ height: isRefreshing ? 58 : pullDistance }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="flex items-center justify-center overflow-hidden"
        aria-hidden={!isRefreshing && pullDistance === 0}
      >
        <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-300 shadow-xl">
          <RefreshCw
            size={13}
            className={isRefreshing ? 'animate-spin' : ''}
            style={isRefreshing ? undefined : { transform: `rotate(${pullProgress * 180}deg)` }}
          />
          <span>{pullStatus}</span>
        </div>
      </motion.div>

      {videos.map((video, index) => (
        <InstagramPostCard
          key={video.id}
          video={video}
          index={index}
          onRefresh={onRefresh}
          onSelectReel={onSelectReel}
          onSelectCreator={onSelectCreator}
          onShowToast={onShowToast}
          profilePhotoByUserId={profilePhotoByUserId}
        />
      ))}
    </div>
  );
}
