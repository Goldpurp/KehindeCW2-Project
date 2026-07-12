import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
  Smile,
  Trash2,
  X
} from 'lucide-react';
import {
  arrayRemove,
  arrayUnion,
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  handleAzureError,
  onSnapshot,
  OperationType,
  orderBy,
  query,
  setDoc,
  updateDoc
} from '../lib/azure';
import { Comment, Video } from '../types';
import VideoGestureLayer from './VideoGestureLayer';
import VideoSeekControls from './VideoSeekControls';
import DeleteConfirmModal from './DeleteConfirmModal';

interface CommentsDrawerProps {
  isOpen: boolean;
  video: Video;
  onClose: () => void;
  onCommentCountUpdate?: () => void;
  profilePhotoByUserId?: Record<string, string>;
}

const formatCount = (value = 0) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(value);
};

const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

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

export default function CommentsDrawer({
  isOpen,
  video,
  onClose,
  onCommentCountUpdate,
  profilePhotoByUserId = {}
}: CommentsDrawerProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [isPostLiked, setIsPostLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setIsPostLiked(Boolean(auth.currentUser?.uid && video.likes?.includes(auth.currentUser.uid)));
  }, [video.likes, isOpen]);

  useEffect(() => {
    if (!video.id || !isOpen) return;

    setLoading(true);
    const commentsRef = collection(db, 'videos', video.id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Comment[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Comment);
      });
      setComments(list);
      setLoading(false);
      onCommentCountUpdate?.();
    }, (error) => {
      console.error("Comments subscription failed:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [video.id, isOpen]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;

    if (!isOpen) {
      node.pause();
      return;
    }

    try {
      node.currentTime = 0;
    } catch {
      // Some remote streams do not allow seeking before metadata is ready.
    }

    const timer = window.setTimeout(() => {
      node.play().catch(() => {});
    }, 100);

    return () => {
      window.clearTimeout(timer);
      node.pause();
    };
  }, [isOpen, video.id, video.videoUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleAddComment = async (event: React.FormEvent) => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user || !newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const commentId = `comment_${Math.random().toString(36).substring(2, 11)}`;
      await setDoc(doc(db, 'videos', video.id, 'comments', commentId), {
        id: commentId,
        videoId: video.id,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userPhotoURL: user.photoURL || profilePhotoByUserId[user.uid] || '',
        text: newComment.trim(),
        createdAt: new Date()
      });
      setNewComment('');
      onCommentCountUpdate?.();
    } catch (err) {
      console.error(err);
      handleAzureError(err, OperationType.CREATE, `videos/${video.id}/comments`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, 'videos', video.id, 'comments', commentId));
      onCommentCountUpdate?.();
    } catch (err) {
      console.error(err);
      handleAzureError(err, OperationType.DELETE, `videos/${video.id}/comments/${commentId}`);
    }
  };

  const handleLikeComment = async (comment: Comment) => {
    const user = auth.currentUser;
    if (!user) return;

    const hasLiked = comment.likes?.includes(user.uid);
    try {
      await updateDoc(doc(db, 'videos', video.id, 'comments', comment.id), {
        likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (err) {
      console.error("Error liking comment:", err);
    }
  };

  const handleLikePost = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await updateDoc(doc(db, 'videos', video.id), {
        likes: isPostLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
      setIsPostLiked(!isPostLiked);
      onCommentCountUpdate?.();
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
      onCommentCountUpdate?.();
    } catch (err) {
      console.error("Error sharing video:", err);
    }
  };

  const focusCommentInput = (prefix = '') => {
    if (prefix && !newComment.startsWith(prefix)) {
      setNewComment(prefix);
    }
    window.setTimeout(() => {
      commentInputRef.current?.focus();
    }, 50);
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2600);
  };

  const isUserAllowedToDelete = (comment: Comment) => {
    const currentUserId = auth.currentUser?.uid;
    return Boolean(currentUserId && (currentUserId === comment.userId || currentUserId === video.creatorId));
  };

  const visibleComments = [...comments].reverse();
  const canDeletePost = Boolean(auth.currentUser?.uid && auth.currentUser.uid === video.creatorId);
  const likeCount = video.likes?.length || 0;
  const creatorPhotoURL = video.creatorPhotoURL || profilePhotoByUserId[video.creatorId] || '';

  const renderAvatar = (
    name: string,
    photoURL?: string,
    sizeClass = 'h-10 w-10',
    textClass = 'text-[10px]'
  ) => (
    <span className={`${sizeClass} shrink-0 overflow-hidden rounded-full bg-gradient-to-tr from-white via-zinc-300 to-zinc-500 p-[1px]`}>
      <span className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-black bg-zinc-950 font-black uppercase text-white ${textClass}`}>
        {photoURL ? (
          <img src={photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          getInitials(name || 'User')
        )}
      </span>
    </span>
  );

  const togglePlay = () => {
    const node = videoRef.current;
    if (!node) return;

    if (node.paused) {
      node.play().catch(() => undefined);
      return;
    }

    node.pause();
  };

  const handleDeletePost = async () => {
    if (!canDeletePost || isDeletingPost) return;

    setIsDeletingPost(true);
    try {
      await deleteDoc(doc(db, 'videos', video.id));
      setIsDeleteConfirmOpen(false);
      onCommentCountUpdate?.();
      onClose();
    } catch (err) {
      console.error("Error deleting video:", err);
      handleAzureError(err, OperationType.DELETE, `videos/${video.id}`);
      showNotice('Could not delete video.');
    } finally {
      setIsDeletingPost(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#050505]/95 p-0 text-white md:p-4">
          {notice && (
            <div className="absolute left-1/2 top-5 z-30 -translate-x-1/2 rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-bold text-white shadow-2xl">
              {notice}
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute right-3 top-[calc(0.5rem+env(safe-area-inset-top))] z-30 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-200 transition hover:bg-zinc-800 hover:text-white md:right-5 md:top-5 md:border md:border-zinc-700"
            aria-label="Close comments"
          >
            <X size={28} />
          </button>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            className="grid h-dvh max-h-dvh w-full max-w-[1180px] overflow-hidden bg-[#202126] shadow-2xl md:h-[88dvh] md:max-h-[88dvh] md:grid-cols-[minmax(0,1fr)_minmax(340px,430px)] md:rounded-[4px] md:border md:border-zinc-800"
            id="comments-drawer-panel"
          >
            <div className="relative hidden items-center justify-center bg-black md:flex">
              <video
                ref={videoRef}
                src={video.videoUrl}
                poster={video.thumbnailUrl}
                autoPlay
                preload="auto"
                muted={muted}
                loop
                playsInline
                className="h-full w-full object-contain"
                referrerPolicy="no-referrer"
              />
              <VideoGestureLayer
                videoRef={videoRef}
                onTogglePlay={togglePlay}
                className="z-10"
              />
              <VideoSeekControls
                videoRef={videoRef}
                muted={muted}
                onToggleMuted={() => setMuted(!muted)}
                className="absolute bottom-4 right-4"
              />
            </div>

            <section className="flex min-h-0 min-w-0 flex-col bg-[#202126] pt-[env(safe-area-inset-top)] md:pt-0">
              <header className="relative flex min-h-16 items-center justify-between border-b border-zinc-800 py-3 pl-4 pr-16 md:px-4 md:py-4">
                <div className="flex min-w-0 items-center gap-3 text-left">
                  {renderAvatar(video.creatorName, creatorPhotoURL, 'h-11 w-11', 'text-[11px]')}
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-extrabold text-white">
                      {video.creatorName}
                      <span className="text-xs text-sky-400">●</span>
                    </span>
                    <span className="block truncate text-xs font-semibold text-zinc-300">
                      {video.producer || video.publisher || 'Original audio'}
                    </span>
                  </span>
                </div>
                <button
                  onClick={() => setIsOptionsOpen((current) => !current)}
                  className="rounded-full p-1.5 text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                  aria-label="Post options"
                >
                  <MoreHorizontal size={20} />
                </button>
                <AnimatePresence>
                  {isOptionsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      className="absolute right-4 top-16 z-20 w-44 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-sm font-semibold text-white shadow-2xl"
                    >
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
                        onClick={() => {
                          setIsOptionsOpen(false);
                          focusCommentInput(`@${video.creatorName} `);
                        }}
                        className="block w-full px-4 py-3 text-left transition hover:bg-zinc-900"
                      >
                        Mention creator
                      </button>
                      <button
                        onClick={() => {
                          setIsOptionsOpen(false);
                          showNotice('Thanks. This post has been flagged for review.');
                        }}
                        className="block w-full px-4 py-3 text-left text-red-400 transition hover:bg-zinc-900"
                      >
                        Report
                      </button>
                      {canDeletePost && (
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
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
                <div className="mb-7 flex gap-3">
                  {renderAvatar(video.creatorName, creatorPhotoURL)}
                  <div className="min-w-0 flex-1 text-sm leading-relaxed">
                    <p>
                      <span className="mr-1 font-extrabold text-white">{video.creatorName}</span>
                      <span className="text-zinc-100">{video.title}</span>
                    </p>
                    <p className="mt-3 text-sky-500">#{video.genre.replace(/\s+/g, '').toLowerCase()} #kehindecw2</p>
                    <p className="mt-2 text-xs font-semibold text-zinc-500">{getRelativeTime(video.createdAt)}</p>
                  </div>
                </div>

                {loading ? (
                  <div className="flex h-40 items-center justify-center text-sm font-semibold text-zinc-500">
                    Loading comments...
                  </div>
                ) : visibleComments.length === 0 ? (
                  <div className="flex h-44 flex-col items-center justify-center text-center">
                    <MessageCircle size={28} className="mb-2 text-zinc-600" />
                    <p className="text-sm font-bold text-white">No comments yet</p>
                    <p className="text-xs text-zinc-500">Start the conversation.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {visibleComments.map((comment) => {
                      const hasLiked = Boolean(auth.currentUser?.uid && comment.likes?.includes(auth.currentUser.uid));
                      const commentPhotoURL = comment.userPhotoURL || profilePhotoByUserId[comment.userId] || '';
                      return (
                        <div key={comment.id} className="group flex gap-3">
                          {renderAvatar(comment.userName, commentPhotoURL, 'h-10 w-10', 'text-[10px]')}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-snug text-zinc-100">
                              <span className="mr-1 font-extrabold text-white">{comment.userName}</span>
                              {comment.text}
                            </p>
                            <div className="mt-2 flex items-center gap-4 text-xs font-bold text-zinc-500">
                              <span>{getRelativeTime(comment.createdAt)}</span>
                              <span>{formatCount(comment.likes?.length || 0)} likes</span>
                              <button
                                onClick={() => focusCommentInput(`@${comment.userName} `)}
                                className="transition hover:text-white"
                              >
                                Reply
                              </button>
                              {isUserAllowedToDelete(comment) && (
                                <button
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="rounded p-1 text-[#f87171] opacity-70 transition hover:bg-[#dc2626] hover:text-white group-hover:opacity-100"
                                  title="Delete comment"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleLikeComment(comment)}
                            disabled={!auth.currentUser}
                            className={`mt-1 shrink-0 transition hover:text-white ${hasLiked ? 'text-red-500' : 'text-zinc-400'}`}
                            aria-label="Like comment"
                          >
                            <Heart size={14} className={hasLiked ? 'fill-current' : ''} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <footer className="shrink-0 border-t border-zinc-800 bg-[#202126] pb-[env(safe-area-inset-bottom)]">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleLikePost}
                      disabled={!auth.currentUser}
                      className={`transition hover:text-zinc-300 ${isPostLiked ? 'text-red-500' : 'text-white'}`}
                      aria-label="Like video"
                    >
                      <Heart size={28} className={isPostLiked ? 'fill-current' : ''} />
                    </button>
                    <button
                      onClick={() => focusCommentInput()}
                      className="text-white transition hover:text-zinc-300"
                      aria-label="Focus comment input"
                    >
                      <MessageCircle size={28} />
                    </button>
                    <button
                      onClick={handleShare}
                      className="text-white transition hover:text-zinc-300"
                      aria-label="Share video"
                    >
                      <Send size={27} />
                    </button>
                  </div>
                  <button
                    onClick={() => setIsBookmarked(!isBookmarked)}
                    className="text-white transition hover:text-zinc-300"
                    aria-label="Save video"
                  >
                    <Bookmark size={28} className={isBookmarked ? 'fill-current' : ''} />
                  </button>
                </div>

                <div className="px-4 pb-3 text-sm">
                  <p className="font-semibold text-white">
                    {likeCount > 0 ? `${formatCount(likeCount)} like${likeCount === 1 ? '' : 's'}` : 'No likes yet'}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{getRelativeTime(video.createdAt)}</p>
                </div>

                <form onSubmit={handleAddComment} className="flex min-h-14 items-center gap-2 border-t border-zinc-800 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
                  <Smile size={24} className="shrink-0 text-zinc-200" />
                  <input
                    ref={commentInputRef}
                    type="text"
                    placeholder={auth.currentUser ? 'Add a comment...' : 'Sign in to add a comment...'}
                    disabled={!auth.currentUser}
                    value={newComment}
                    onChange={(event) => setNewComment(event.target.value)}
                    maxLength={1000}
                    className="min-w-0 flex-1 bg-transparent text-base md:text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed"
                    id="input-comment-text"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !newComment.trim() || !auth.currentUser}
                    className="min-h-11 shrink-0 px-1 text-sm font-bold text-sky-500 transition hover:text-sky-300 disabled:opacity-40"
                    id="btn-send-comment"
                  >
                    Post
                  </button>
                </form>
              </footer>
            </section>
          </motion.div>

          <DeleteConfirmModal
            isOpen={isDeleteConfirmOpen}
            itemName={video.title}
            isDeleting={isDeletingPost}
            onCancel={() => !isDeletingPost && setIsDeleteConfirmOpen(false)}
            onConfirm={handleDeletePost}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
