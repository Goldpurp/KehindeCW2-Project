import {
  useState,
  useRef,
  useEffect,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent
} from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Copy,
  Heart, 
  Lock,
  MessageCircle,
  MessageSquare, 
  Play, 
  RefreshCw,
  FolderOpen,
  Send,
  Share2,
  Users,
  X,
  Eye
} from 'lucide-react';
import { db, auth, doc, updateDoc, arrayUnion, arrayRemove, collection, query, onSnapshot } from '../lib/azure';
import { Video } from '../types';
import CommentsDrawer from './CommentsDrawer';
import RatingStars from './RatingStars';
import VideoGestureLayer from './VideoGestureLayer';
import VideoSeekControls from './VideoSeekControls';

interface FeedProps {
  videos: Video[];
  initialIndex?: number;
  onRefresh: () => void;
  onBackToDashboard?: () => void;
  onSelectCreator?: (creatorName: string) => void;
  onShowToast?: (message: string) => void;
  profilePhotoByUserId?: Record<string, string>;
}

interface FloatingReaction {
  id: string;
  type: 'heart' | 'fire' | 'laugh';
  x: number;
}

const PULL_REFRESH_TRIGGER = 74;
const PULL_REFRESH_MAX = 104;
const PULL_REFRESH_SETTLE_MS = 450;

// Separate component for each individual feed post item to isolate play/pause and animations
function FeedPostCard({
  video,
  muted,
  setMuted,
  onRefresh,
  onSelectCreator,
  onShowToast,
  isCurrentlyVisible,
  profilePhotoByUserId = {}
}: {
  key?: string;
  video: Video;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  onRefresh: () => void;
  onSelectCreator?: (creatorName: string) => void;
  onShowToast?: (message: string) => void;
  isCurrentlyVisible: boolean;
  profilePhotoByUserId?: Record<string, string>;
}) {
  const [playing, setPlaying] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const currentUserId = auth.currentUser?.uid;
  const isLiked = currentUserId && video.likes?.includes(currentUserId);
  const creatorPhotoURL = video.creatorPhotoURL || profilePhotoByUserId[video.creatorId] || '';

  // Real-time comments count listener
  useEffect(() => {
    if (!video.id) return;
    const commentsRef = collection(db, 'videos', video.id, 'comments');
    const unsubscribe = onSnapshot(query(commentsRef), (snapshot) => {
      setCommentCount(snapshot.size);
    }, (err) => {
      console.error("Error loading comment count:", err);
    });
    return () => unsubscribe();
  }, [video.id]);

  // Sync playing state based on visibility
  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;

    const playVisibleVideo = () => {
      node.play().then(() => {
        setPlaying(true);
      }).catch(() => {
        setPlaying(false);
      });
    };

    const pauseHiddenVideo = () => {
      node.pause();
      setPlaying(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseHiddenVideo();
      } else if (isCurrentlyVisible) {
        playVisibleVideo();
      }
    };

    if (isCurrentlyVisible && !document.hidden) {
      playVisibleVideo();
    } else {
      pauseHiddenVideo();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      pauseHiddenVideo();
    };
  }, [isCurrentlyVisible, video.id]);

  // Handle views count (1.5s active watch time)
  useEffect(() => {
    if (!isCurrentlyVisible) return;
    const timer = setTimeout(async () => {
      try {
        const videoRefDoc = doc(db, 'videos', video.id);
        const currentViews = video.viewCount || 0;
        await updateDoc(videoRefDoc, {
          viewCount: currentViews + 1
        });
      } catch (error) {
        console.error("Error auto-incrementing views:", error);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [isCurrentlyVisible, video.id]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
        setPlaying(false);
      } else {
        videoRef.current.play().then(() => {
          setPlaying(true);
        }).catch(() => {});
      }
    }
  };

  const toggleLike = async () => {
    if (!currentUserId) return;
    try {
      const videoRefDoc = doc(db, 'videos', video.id);
      if (isLiked) {
        await updateDoc(videoRefDoc, {
          likes: arrayRemove(currentUserId)
        });
      } else {
        await updateDoc(videoRefDoc, {
          likes: arrayUnion(currentUserId)
        });
      }
      onRefresh();
    } catch (error) {
      console.error("Error liking video:", error);
    }
  };

  const handleShare = () => {
    setIsShareOpen(true);
  };

  const handleShareOption = async (optionType: 'whatsapp' | 'twitter' | 'telegram' | 'followers' | 'none' | 'copy') => {
    const shareUrl = `${window.location.origin}/?video=${video.id}`;
    let success = true;

    if (optionType === 'copy') {
      try {
        await navigator.clipboard.writeText(shareUrl);
        onShowToast?.("Copied video stream link to clipboard!");
      } catch (e) {
        success = false;
        onShowToast?.("Failed to copy link.");
      }
    } else if (optionType === 'whatsapp') {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent("Check out this video stream on KehindeCW2 Project! " + shareUrl)}`;
      window.open(waUrl, '_blank');
      onShowToast?.("Opening WhatsApp to share!");
    } else if (optionType === 'twitter') {
      const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent("Check out this stream on KehindeCW2 Project! " + shareUrl)}`;
      window.open(twUrl, '_blank');
      onShowToast?.("Opening Twitter / X to share!");
    } else if (optionType === 'telegram') {
      const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent("Check out this stream on KehindeCW2 Project!")}`;
      window.open(tgUrl, '_blank');
      onShowToast?.("Opening Telegram to share!");
    } else if (optionType === 'followers') {
      onShowToast?.("Broadcasted stream to your followers.");
    } else if (optionType === 'none') {
      onShowToast?.("Stream kept private / shared to none.");
    }

    if (success) {
      try {
        const videoRefDoc = doc(db, 'videos', video.id);
        await updateDoc(videoRefDoc, {
          shareCount: (video.shareCount || 0) + 1
        });
        onRefresh();
      } catch (err) {
        console.error("Error updating share count:", err);
      }
    }
    setIsShareOpen(false);
  };

  const triggerReaction = (type: 'heart' | 'fire' | 'laugh') => {
    const id = Math.random().toString(36).substring(2, 9);
    const newReaction: FloatingReaction = {
      id,
      type,
      x: (Math.random() - 0.5) * 80,
    };
    setFloatingReactions(prev => [...prev, newReaction]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 1500);
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <motion.div 
      data-video-id={video.id}
      className="snap-start w-full h-full shrink-0 flex flex-col justify-between overflow-hidden bg-[#050505] p-4 border-b border-zinc-900/60"
      id={`feed-post-${video.id}`}
      initial={{ opacity: 0.85, y: 30, scale: 0.98 }}
      animate={isCurrentlyVisible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0.5, y: -20, scale: 0.96 }}
      transition={{ 
        type: 'spring', 
        stiffness: 110, 
        damping: 18, 
        mass: 0.8 
      }}
    >
      {/* 1. Header with Creator Info */}
      <div className="h-12 flex items-center justify-between shrink-0 pb-2">
        <div className="flex items-center gap-3">
          {/* Creator Avatar with Olive Green border */}
          <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-[#3f3f46] to-[#d4d4d8]">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-black bg-zinc-950 text-[10px] font-black tracking-tighter text-[#f4f4f5]">
              {creatorPhotoURL ? (
                <img src={creatorPhotoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                getInitials(video.creatorName)
              )}
            </div>
          </div>
          <div>
            <span 
              onClick={() => onSelectCreator?.(video.creatorName)}
              className="text-xs font-bold text-[#f4f4f5] hover:underline cursor-pointer transition active:text-white"
            >
              @{video.creatorName}
            </span>
            <p className="text-[9px] text-zinc-500 font-mono tracking-widest uppercase">
              {video.genre}
            </p>
          </div>
        </div>

        {/* Suitable Age Rating Badge */}
        <span className="text-[9px] font-bold px-2 py-0.5 bg-zinc-900/80 text-zinc-400 border border-zinc-800 rounded">
          {video.ageRating}
        </span>
      </div>

      {/* 2. Responsive Video Container */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden rounded-2xl border border-zinc-900/50 group">
        <video
          ref={videoRef}
          src={video.videoUrl}
          autoPlay
          preload="metadata"
          loop
          muted={muted}
          playsInline
          className="w-full h-full object-cover cursor-pointer select-none"
          poster={video.thumbnailUrl}
          referrerPolicy="no-referrer"
        />

        <VideoGestureLayer
          videoRef={videoRef}
          onTogglePlay={togglePlay}
          className="z-10"
        />

        {/* Big centered pause/play flash overlay */}
        <AnimatePresence>
          {!playing && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              onClick={togglePlay}
              className="absolute pointer-events-none w-14 h-14 bg-black/60 backdrop-blur-md border border-zinc-800 rounded-full flex items-center justify-center text-white z-10 shadow-lg"
            >
              <Play size={22} className="ml-0.5 fill-white" />
            </motion.div>
          )}
        </AnimatePresence>

        <VideoSeekControls
          videoRef={videoRef}
          muted={muted}
          onToggleMuted={() => setMuted(!muted)}
          className="absolute bottom-3 right-3 z-30"
        />

        {/* Rising Floating Reactions Layer */}
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
          <AnimatePresence>
            {floatingReactions.map(reaction => {
              let emoji = '❤️';
              if (reaction.type === 'fire') emoji = '🔥';
              if (reaction.type === 'laugh') emoji = '😂';
              return (
                <motion.div
                  key={reaction.id}
                  initial={{ y: '80%', opacity: 1, scale: 0.8, x: reaction.x }}
                  animate={{ y: '-10%', opacity: 0, scale: 2.2, rotate: reaction.x * 0.4 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.4, ease: "easeOut" }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none text-4xl drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]"
                >
                  {emoji}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* 3. Action Toolbar & Reactions BELOW Video (Just like Instagram) */}
      <div className="mt-3 shrink-0 space-y-2.5">
        
        {/* Engagement row */}
        <div className="flex items-center justify-between border-b border-zinc-900/40 pb-2.5">
          {/* Left Side: Standard post action icons */}
          <div className="flex items-center gap-4 text-zinc-300">
            {/* Like */}
            <button
              onClick={toggleLike}
              disabled={!currentUserId}
              className={`flex items-center gap-1.5 transition transform active:scale-130 ${
                isLiked ? 'text-[#f4f4f5] scale-105' : 'hover:text-white'
              }`}
              title="Like stream"
            >
              <Heart size={20} className={isLiked ? 'fill-[#f4f4f5]' : ''} />
              <span className="text-[11px] font-bold font-mono text-zinc-400">
                {video.likes?.length || 0}
              </span>
            </button>

            {/* Comment Drawer button */}
            <button
              onClick={() => setIsCommentsOpen(true)}
              className="flex items-center gap-1.5 hover:text-white transition active:scale-95"
              title="View comments"
            >
              <MessageSquare size={20} />
              <span className="text-[11px] font-bold font-mono text-zinc-400">
                {commentCount}
              </span>
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 hover:text-white transition active:scale-95"
              title="Copy stream link"
            >
              <Share2 size={20} />
              <span className="text-[11px] font-bold font-mono text-zinc-400">
                {video.shareCount || 0}
              </span>
            </button>
          </div>

          <RatingStars video={video} onRatingUpdate={onRefresh} />
        </div>

        {/* 4. Captions, Metrics & Reactions */}
        <div className="space-y-1.5 text-left">
          {/* Quick Reactions bar in place of views section */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 px-2 py-1 bg-[#111111] border border-[#3f3f46]/30 rounded-full shadow-inner w-max">
              <span className="text-[9px] font-mono font-bold text-[#f4f4f5]/60 px-1 uppercase">React:</span>
              <button
                onClick={() => triggerReaction('heart')}
                className="text-sm hover:scale-130 active:scale-150 transition-transform duration-100 px-1"
                title="Love"
              >
                ❤️
              </button>
              <button
                onClick={() => triggerReaction('fire')}
                className="text-sm hover:scale-130 active:scale-150 transition-transform duration-100 px-1"
                title="Fire"
              >
                🔥
              </button>
              <button
                onClick={() => triggerReaction('laugh')}
                className="text-sm hover:scale-130 active:scale-150 transition-transform duration-100 px-1"
                title="Laugh"
              >
                😂
              </button>
            </div>

            {/* Views counter on the far right of post reactions */}
            <div className="flex items-center gap-1 text-zinc-400 font-mono text-[10px] bg-zinc-900/60 border border-zinc-800/40 rounded-full px-2 py-0.5 shadow-sm">
              <Eye size={11} className="text-[#f4f4f5]" />
              <span className="font-bold">{video.viewCount || 0}</span>
            </div>
          </div>

          {/* Caption */}
          <div className="text-xs leading-relaxed pt-1">
            <span className="font-extrabold text-[#f4f4f5] mr-2">@{video.creatorName}</span>
            <span className="text-zinc-300 font-medium select-text">{video.title}</span>
          </div>
        </div>

      </div>

      {/* Share Options Dialog Overlay */}
      <AnimatePresence>
        {isShareOpen && (
          <div className="absolute inset-0 bg-black/85 z-40 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs bg-zinc-950 border border-zinc-900 p-5 rounded-3xl shadow-2xl space-y-4 text-center"
            >
              <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#f4f4f5] font-mono">Share Stream</span>
                <button onClick={() => setIsShareOpen(false)} className="text-zinc-500 hover:text-white transition p-1 rounded-lg">
                  <X size={14} />
                </button>
              </div>

              {/* External Media */}
              <div className="space-y-1.5 text-left">
                <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-mono font-bold block">External Media</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleShareOption('whatsapp')}
                    className="p-2 bg-zinc-900 hover:bg-zinc-850 rounded-xl text-[9px] font-black text-white border border-zinc-850 flex flex-col items-center gap-1.5 transition"
                  >
                    <MessageCircle size={17} />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    onClick={() => handleShareOption('twitter')}
                    className="p-2 bg-zinc-900 hover:bg-zinc-850 rounded-xl text-[9px] font-black text-white border border-zinc-850 flex flex-col items-center gap-1.5 transition"
                  >
                    <X size={17} />
                    <span>Twitter (X)</span>
                  </button>
                  <button
                    onClick={() => handleShareOption('telegram')}
                    className="p-2 bg-zinc-900 hover:bg-zinc-850 rounded-xl text-[9px] font-black text-white border border-zinc-850 flex flex-col items-center gap-1.5 transition"
                  >
                    <Send size={17} />
                    <span>Telegram</span>
                  </button>
                </div>
              </div>

              {/* KehindeCW2 Project Audience */}
              <div className="space-y-1.5 text-left">
                <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-mono font-bold block">KehindeCW2 Audience</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleShareOption('followers')}
                    className="p-2 bg-zinc-900 hover:bg-zinc-850 rounded-xl text-[9px] font-black text-white border border-zinc-850 flex flex-col items-center gap-1.5 transition"
                  >
                    <Users size={17} />
                    <span>Followers</span>
                  </button>
                  <button
                    onClick={() => handleShareOption('none')}
                    className="p-2 bg-zinc-900 hover:bg-zinc-850 rounded-xl text-[9px] font-black text-white border border-zinc-850 flex flex-col items-center gap-1.5 transition"
                  >
                    <Lock size={17} />
                    <span>None</span>
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pt-2 border-t border-zinc-900">
                <button
                  onClick={() => handleShareOption('copy')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3f3f46] py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-lg transition hover:bg-[#52525b]"
                >
                  <Copy size={14} />
                  Copy Link URL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Render embedded comments tray */}
      <CommentsDrawer
        isOpen={isCommentsOpen}
        video={video}
        profilePhotoByUserId={profilePhotoByUserId}
        onClose={() => setIsCommentsOpen(false)}
        onCommentCountUpdate={onRefresh}
      />
    </motion.div>
  );
}

export default function Feed({ 
  videos, 
  initialIndex = 0, 
  onRefresh, 
  onBackToDashboard, 
  onSelectCreator,
  onShowToast,
  profilePhotoByUserId = {}
}: FeedProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pullStartYRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const isPullGestureRef = useRef(false);
  const suppressNextClickRef = useRef(false);

  // Set up intersection observer to auto-track visible items on vertical scroll snap
  useEffect(() => {
    if (videos.length === 0) return;

    // Set first video active initially
    if (!activeId && videos[initialIndex]) {
      setActiveId(videos[initialIndex].id);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const videoId = entry.target.getAttribute('data-video-id');
            if (videoId) {
              setActiveId(videoId);
            }
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.6 // Element is 60% visible inside the scrolling track
      }
    );

    // Give browser brief time to compile elements to DOM
    const timer = setTimeout(() => {
      const childElements = containerRef.current?.querySelectorAll('[data-video-id]');
      childElements?.forEach((el) => observer.observe(el));
    }, 150);

    return () => {
      clearTimeout(timer);
      const childElements = containerRef.current?.querySelectorAll('[data-video-id]');
      childElements?.forEach((el) => observer.unobserve(el));
    };
  }, [videos, initialIndex]);

  // Initial scroll positioning
  useEffect(() => {
    if (initialIndex > 0 && containerRef.current) {
      const targetElement = containerRef.current.querySelector(`[data-video-id="${videos[initialIndex]?.id}"]`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'auto' });
      }
    }
  }, [videos, initialIndex]);

  const setTrackedPullDistance = (value: number) => {
    const nextValue = Math.max(0, value);
    pullDistanceRef.current = nextValue;
    setPullDistance(nextValue);
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
      onShowToast?.('Latest streams loaded.');
    } catch (error) {
      console.error("Error refreshing feed:", error);
      onShowToast?.('Could not refresh streams.');
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
    if (isRefreshing) return;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;

    const scrollTrack = containerRef.current;
    if (!scrollTrack || scrollTrack.scrollTop > 0) return;

    pullStartYRef.current = event.clientY;
    activePointerIdRef.current = event.pointerId;
    isPullGestureRef.current = false;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return;
    if (
      isRefreshing ||
      activePointerIdRef.current !== event.pointerId ||
      pullStartYRef.current === null
    ) {
      return;
    }
    if (event.pointerType === 'mouse' && event.buttons !== 1) return;

    const scrollTrack = containerRef.current;
    if (!scrollTrack) return;

    const dragDistance = event.clientY - pullStartYRef.current;
    if (dragDistance <= 0 || scrollTrack.scrollTop > 0) {
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
    if (event.pointerType !== 'mouse') return;
    if (activePointerIdRef.current !== event.pointerId) return;

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
    if (event.pointerType !== 'mouse') return;
    if (activePointerIdRef.current !== event.pointerId) return;
    resetPullGesture();
    setTrackedPullDistance(0);
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (isRefreshing || event.touches.length !== 1) return;

    const scrollTrack = containerRef.current;
    if (!scrollTrack || scrollTrack.scrollTop > 0) return;

    pullStartYRef.current = event.touches[0].clientY;
    activePointerIdRef.current = null;
    isPullGestureRef.current = false;
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (isRefreshing || pullStartYRef.current === null || activePointerIdRef.current !== null) return;

    const scrollTrack = containerRef.current;
    const touch = event.touches[0];
    if (!scrollTrack || !touch) return;

    const dragDistance = touch.clientY - pullStartYRef.current;
    if (dragDistance <= 0 || scrollTrack.scrollTop > 0) {
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
    ? 'Refreshing latest'
    : pullProgress >= 1
      ? 'Release for latest'
      : 'Latest streams';

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-[#050505] text-zinc-500 p-6 text-center rounded-3xl border border-zinc-900" id="feed-empty-state">
        <FolderOpen size={44} className="text-zinc-800 mb-3 animate-pulse" />
        <h3 className="text-sm font-bold text-white mb-1">No video streams found</h3>
        <p className="text-xs text-zinc-500 max-w-xs mb-6">
          Be the first creator to upload a video on KehindeCW2 Project.
        </p>
        <button
          onClick={onRefresh}
          className="px-5 py-2.5 text-xs bg-[#3f3f46] hover:bg-[#52525b] text-white font-black uppercase tracking-wider rounded-xl transition flex items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.25)]"
          id="btn-feed-refresh"
        >
          <RefreshCw size={13} />
          Reload Feed
        </button>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full h-[80vh] md:h-[82vh] max-h-[82vh] max-w-full md:max-w-lg mx-auto bg-black rounded-none md:rounded-3xl overflow-hidden shadow-none md:shadow-[0_0_50px_rgba(0,0,0,0.9)] border-0 md:border md:border-zinc-900/60 flex" 
      id="feed-root-container"
    >
      {/* Back to Dashboard Button */}
      {onBackToDashboard && (
        <button
          onClick={onBackToDashboard}
          className="absolute top-4 left-4 z-30 px-3 py-1.5 bg-black/60 backdrop-blur border border-zinc-800 hover:bg-black/95 text-[10px] text-zinc-300 hover:text-white rounded-xl font-bold transition flex items-center gap-1 shadow"
          id="btn-feed-back"
        >
          ← Back
        </button>
      )}

      {/* Snap Scroll Vertical container */}
      <div 
        ref={containerRef}
        className="flex-1 w-full h-full overflow-y-scroll overscroll-y-contain touch-pan-y snap-y snap-mandatory scroll-smooth scrollbar-none flex flex-col bg-black"
        id="snap-scroll-track"
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
          animate={{ height: isRefreshing ? 64 : pullDistance }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="shrink-0 flex items-center justify-center overflow-hidden bg-black"
          aria-hidden={!isRefreshing && pullDistance === 0}
        >
          <div className="flex items-center gap-2 rounded-full border border-[#3f3f46]/40 bg-[#111111]/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#f4f4f5] shadow-[0_0_18px_rgba(255,255,255,0.28)]">
            <RefreshCw
              size={13}
              className={isRefreshing ? 'animate-spin' : ''}
              style={isRefreshing ? undefined : { transform: `rotate(${pullProgress * 180}deg)` }}
            />
            <span>{pullStatus}</span>
          </div>
        </motion.div>
        {videos.map((video) => (
          <FeedPostCard
            key={video.id}
            video={video}
            muted={muted}
            setMuted={setMuted}
            onRefresh={onRefresh}
            onSelectCreator={onSelectCreator}
            onShowToast={onShowToast}
            profilePhotoByUserId={profilePhotoByUserId}
            isCurrentlyVisible={activeId === video.id}
          />
        ))}
      </div>
    </div>
  );
}
