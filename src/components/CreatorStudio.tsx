import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Film, 
  Eye, 
  Heart, 
  MessageSquare, 
  Star, 
  Edit3, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Save, 
  HelpCircle,
  TrendingUp,
  Folder,
  Shield,
  Activity
} from 'lucide-react';
import { db, auth, handleAzureError, OperationType, collection, doc, deleteDoc, updateDoc, getDocs } from '../lib/azure';
import { Video, GENRES, AGE_RATINGS, AgeRating } from '../types';

interface CreatorStudioProps {
  videos: Video[];
  onRefresh: () => void;
}

// Child component to fetch and display the comment count of a video asynchronously,
// while communicating the count back to the parent to update aggregate studio stats.
function CommentCount({ 
  videoId, 
  onCountLoaded 
}: { 
  videoId: string; 
  onCountLoaded: (count: number) => void; 
}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchCommentCount = async () => {
      try {
        const commentsRef = collection(db, 'videos', videoId, 'comments');
        const snap = await getDocs(commentsRef);
        if (isMounted) {
          const size = snap.size;
          setCount(size);
          onCountLoaded(size);
        }
      } catch (err) {
        console.error(`Error loading comment count for video ${videoId}:`, err);
        if (isMounted) {
          setCount(0);
          onCountLoaded(0);
        }
      }
    };
    fetchCommentCount();
    return () => {
      isMounted = false;
    };
  }, [videoId]);

  if (count === null) {
    return (
      <div className="w-4 h-4 border border-zinc-700 border-t-cyan-400 rounded-full animate-spin" />
    );
  }

  return <span className="font-mono text-xs font-bold text-zinc-100">{count}</span>;
}

export default function CreatorStudio({ videos, onRefresh }: CreatorStudioProps) {
  const user = auth.currentUser;
  
  // Filter only videos created by this current user
  const creatorVideos = videos.filter(v => v.creatorId === user?.uid);

  // Stats aggregation
  const [commentCounts, setCommentCounts] = useState<{ [videoId: string]: number }>({});
  const totalVideos = creatorVideos.length;
  const totalViews = creatorVideos.reduce((acc, v) => acc + (v.viewCount || 0), 0);
  const totalLikes = creatorVideos.reduce((acc, v) => acc + (v.likes?.length || 0), 0);
  const totalComments = Object.keys(commentCounts).reduce((acc, videoId) => acc + (commentCounts[videoId] || 0), 0);

  // Selected video for editing metadata
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPublisher, setEditPublisher] = useState('');
  const [editProducer, setEditProducer] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editAgeRating, setEditAgeRating] = useState<AgeRating>('PG');
  const [editThumbnail, setEditThumbnail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Handle comment count callback from child items
  const handleCommentCountLoaded = (videoId: string, count: number) => {
    setCommentCounts(prev => {
      if (prev[videoId] === count) return prev;
      return { ...prev, [videoId]: count };
    });
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Open Edit Metadata modal
  const handleOpenEdit = (video: Video) => {
    setEditingVideo(video);
    setEditTitle(video.title);
    setEditPublisher(video.publisher);
    setEditProducer(video.producer);
    setEditGenre(video.genre);
    setEditAgeRating(video.ageRating);
    setEditThumbnail(video.thumbnailUrl || '');
    setEditError('');
  };

  // Submit metadata updates
  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideo) return;
    setEditError('');
    setIsSaving(true);

    if (!editTitle.trim() || !editPublisher.trim() || !editProducer.trim()) {
      setEditError('Caption, Publisher, and Producer fields cannot be empty.');
      setIsSaving(false);
      return;
    }

    try {
      const videoRef = doc(db, 'videos', editingVideo.id);
      const updatedData = {
        title: editTitle.trim(),
        publisher: editPublisher.trim(),
        producer: editProducer.trim(),
        genre: editGenre,
        ageRating: editAgeRating,
        thumbnailUrl: editThumbnail.trim() || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=60'
      };

      await updateDoc(videoRef, updatedData);
      showToast("Video metadata saved successfully!");
      setEditingVideo(null);
      onRefresh();
    } catch (err) {
      console.error("Error editing video metadata:", err);
      try {
        handleAzureError(err, OperationType.UPDATE, `videos/${editingVideo.id}`);
      } catch (formattedErr: any) {
        setEditError(formattedErr.message || "Failed to update video metadata.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Delete a video
  const handleDeleteVideo = async (videoId: string, title: string) => {
    const confirmed = window.confirm(`Are you absolutely sure you want to permanently delete "${title}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'videos', videoId));
      showToast("Video deleted permanently.");
      
      // Clear local state comment count for deleted video
      setCommentCounts(prev => {
        const copy = { ...prev };
        delete copy[videoId];
        return copy;
      });
      onRefresh();
    } catch (err) {
      console.error("Error deleting video:", err);
      try {
        handleAzureError(err, OperationType.DELETE, `videos/${videoId}`);
      } catch (formattedErr: any) {
        alert(formattedErr.message || "Failed to delete video. Permission denied.");
      }
    }
  };

  return (
    <div className="space-y-6" id="creator-studio-container">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-full shadow-[0_0_25px_rgba(255,255,255,0.3)] flex items-center gap-2 text-xs font-bold"
            id="toast-studio-notification"
          >
            <CheckCircle2 size={16} className="text-emerald-200" />
            {successToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metrics Panel Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Videos */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-center gap-4 hover:border-zinc-700 transition">
          <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            <Film size={20} />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">Total Uploads</p>
            <p className="text-2xl font-black font-mono text-zinc-100">{totalVideos}</p>
          </div>
        </div>

        {/* Total Views */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-center gap-4 hover:border-zinc-700 transition">
          <div className="p-3 rounded-xl bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            <Eye size={20} />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">Total Views</p>
            <p className="text-2xl font-black font-mono text-zinc-100">{totalViews}</p>
          </div>
        </div>

        {/* Total Likes */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-center gap-4 hover:border-zinc-700 transition">
          <div className="p-3 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            <Heart size={20} />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">Total Likes</p>
            <p className="text-2xl font-black font-mono text-zinc-100">{totalLikes}</p>
          </div>
        </div>

        {/* Total Comments */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-center gap-4 hover:border-zinc-700 transition">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            <MessageSquare size={20} />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">Total Comments</p>
            <p className="text-2xl font-black font-mono text-zinc-100">{totalComments}</p>
          </div>
        </div>
      </div>

      {/* Videos List and Management */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <div className="p-6 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-cyan-400" />
            <h3 className="text-base font-black uppercase tracking-wider text-zinc-100">My Video Portfolio</h3>
          </div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-500 bg-zinc-950 px-3 py-1 rounded-xl border border-zinc-850">
            Creator Studio
          </span>
        </div>

        {creatorVideos.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-850 flex items-center justify-center mx-auto text-zinc-500">
              <Folder size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-zinc-300">No videos published yet</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">Use the create button to upload your first video.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-850 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500 bg-zinc-950/40">
                  <th className="py-4 px-6">Video / Caption</th>
                  <th className="py-4 px-3">Genre</th>
                  <th className="py-4 px-3">Age Rating</th>
                  <th className="py-4 px-3 text-center">Views</th>
                  <th className="py-4 px-3 text-center">Likes</th>
                  <th className="py-4 px-3 text-center">Comments</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/50">
                {creatorVideos.map((video) => {
                  return (
                    <tr key={video.id} className="hover:bg-zinc-950/30 transition group">
                      {/* Video caption and thumbnail */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-4">
                          <img 
                            src={video.thumbnailUrl || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=120&auto=format&fit=crop&q=60'} 
                            alt={video.title}
                            className="w-14 h-10 object-cover rounded-lg border border-zinc-800 shadow"
                            referrerPolicy="no-referrer"
                          />
                          <div className="max-w-[200px] sm:max-w-[300px]">
                            <p className="text-xs font-black text-zinc-100 group-hover:text-cyan-400 transition truncate">{video.title}</p>
                            <p className="text-[10px] text-zinc-500 truncate mt-0.5">ID: {video.id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Genre */}
                      <td className="py-4 px-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-mono bg-zinc-950 px-2 py-1 rounded border border-zinc-850">
                          {video.genre}
                        </span>
                      </td>

                      {/* Age Rating */}
                      <td className="py-4 px-3">
                        <span className="text-[10px] font-black font-mono text-fuchsia-400 bg-fuchsia-950/10 border border-fuchsia-500/20 px-2 py-1 rounded">
                          {video.ageRating}
                        </span>
                      </td>

                      {/* Views */}
                      <td className="py-4 px-3 text-center font-mono text-xs font-bold text-zinc-300">
                        {video.viewCount || 0}
                      </td>

                      {/* Likes */}
                      <td className="py-4 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Heart size={12} className="text-pink-500 fill-pink-500/10" />
                          <span className="font-mono text-xs font-bold text-zinc-300">{video.likes?.length || 0}</span>
                        </div>
                      </td>

                      {/* Comments count with async client component */}
                      <td className="py-4 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <MessageSquare size={12} className="text-amber-500" />
                          <CommentCount 
                            videoId={video.id} 
                            onCountLoaded={(count) => handleCommentCountLoaded(video.id, count)} 
                          />
                        </div>
                      </td>

                      {/* Action edit & delete buttons */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => handleOpenEdit(video)}
                            className="p-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-850 hover:border-cyan-500/30 text-zinc-400 hover:text-cyan-400 rounded-xl transition"
                            title="Edit Video Metadata"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteVideo(video.id, video.title)}
                            className="p-2 bg-zinc-950 hover:bg-red-950/40 border border-zinc-850 hover:border-red-500/30 text-zinc-400 hover:text-red-400 rounded-xl transition"
                            title="Delete Video"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Metadata Modal */}
      <AnimatePresence>
        {editingVideo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black"
              onClick={() => setEditingVideo(null)}
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.85)] z-10 text-white overflow-hidden"
            >
              {/* Header */}
              <div className="sticky top-0 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 p-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Edit3 size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm uppercase tracking-wider">Edit Video Metadata</h3>
                    <p className="text-[10px] text-zinc-400 font-mono">Editing ID: {editingVideo.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingVideo(null)}
                  className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveMetadata} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {editError && (
                  <div className="p-3 bg-red-950/20 border border-red-800/30 text-red-400 text-xs font-semibold rounded-xl flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{editError}</span>
                  </div>
                )}

                {/* Caption */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Video Caption</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-cyan-500 focus:outline-none text-xs text-white"
                  />
                </div>

                {/* Genre Selector */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Genre Category</label>
                  <select
                    value={editGenre}
                    onChange={(e) => setEditGenre(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-cyan-500 focus:outline-none text-xs text-white"
                  >
                    {GENRES.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                {/* Producer and Publisher */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Producer</label>
                    <input
                      type="text"
                      required
                      value={editProducer}
                      onChange={(e) => setEditProducer(e.target.value)}
                      className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-cyan-500 focus:outline-none text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Publisher</label>
                    <input
                      type="text"
                      required
                      value={editPublisher}
                      onChange={(e) => setEditPublisher(e.target.value)}
                      className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-cyan-500 focus:outline-none text-xs text-white"
                    />
                  </div>
                </div>

                {/* Thumbnail Cover URL */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Thumbnail Cover URL</label>
                  <input
                    type="url"
                    value={editThumbnail}
                    onChange={(e) => setEditThumbnail(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-cyan-500 focus:outline-none text-xs text-white"
                  />
                </div>

                {/* Age Rating selector */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Age Rating Recommendation</label>
                  <div className="grid grid-cols-5 gap-2">
                    {AGE_RATINGS.map(rating => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setEditAgeRating(rating)}
                        className={`py-2 border rounded-xl text-xs font-black uppercase tracking-wider transition ${
                          editAgeRating === rating
                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(255,255,255,0.25)]'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-zinc-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingVideo(null)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-xl transition text-xs font-black uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-400 hover:to-fuchsia-500 text-white rounded-xl transition text-xs font-black uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                  >
                    {isSaving ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save size={14} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
