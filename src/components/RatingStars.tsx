import { useState } from 'react';
import { Star } from 'lucide-react';
import { db, auth, handleAzureError, OperationType, doc, updateDoc } from '../lib/azure';
import { Video } from '../types';

interface RatingStarsProps {
  video: Video;
  onRatingUpdate: () => void;
}

export default function RatingStars({ video, onRatingUpdate }: RatingStarsProps) {
  const currentUserId = auth.currentUser?.uid;
  const currentUserRole = auth.currentUser?.role;
  const userRating = currentUserId && video.ratings ? video.ratings[currentUserId] || 0 : 0;
  const ratingCount = Object.keys(video.ratings || {}).length;
  const isUploader = Boolean(currentUserId && currentUserId === video.creatorId);
  const isConsumer = currentUserRole === 'consumer';
  const canRate = Boolean(currentUserId && isConsumer && !isUploader);
  
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRate = async (score: number) => {
    if (!canRate || !currentUserId) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const updatedRatings = { ...(video.ratings || {}) };
      updatedRatings[currentUserId] = score;

      // Calculate new average
      const ratingValues = Object.values(updatedRatings) as number[];
      const total = ratingValues.reduce((sum, val) => sum + val, 0);
      const average = ratingValues.length > 0 ? Number((total / ratingValues.length).toFixed(1)) : 0;

      const videoRef = doc(db, 'videos', video.id);
      await updateDoc(videoRef, {
        ratings: updatedRatings,
        averageRating: average
      });

      onRatingUpdate();
    } catch (error) {
      console.error("Error rating video:", error);
      handleAzureError(error, OperationType.UPDATE, `videos/${video.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex max-w-full items-center gap-1.5 rounded-full border border-zinc-800/70 bg-black/35 px-2 py-1 backdrop-blur-md sm:gap-2 sm:px-2.5" id="rating-stars-container">
      <span className="text-[11px] font-black text-amber-300 font-mono">
        {video.averageRating ? video.averageRating.toFixed(1) : '0.0'}
      </span>

      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isGold = hoverRating !== null ? star <= hoverRating : star <= (userRating || video.averageRating || 0);
          return (
            <button
              key={star}
              disabled={!canRate || isSubmitting}
              onMouseEnter={() => canRate && setHoverRating(star)}
              onMouseLeave={() => canRate && setHoverRating(null)}
              onClick={() => handleRate(star)}
              className={`flex h-7 w-5 items-center justify-center transition-transform hover:scale-110 focus:outline-none ${
                !canRate ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              }`}
              title={
                !currentUserId
                  ? 'Sign in to rate'
                  : !isConsumer
                    ? 'Only consumer accounts can rate videos'
                    : isUploader
                      ? 'Uploaders cannot rate their own video'
                      : `Rate ${star} Stars`
              }
            >
              <Star
                size={13}
                className={isGold ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'}
              />
            </button>
          );
        })}
      </div>

      <span className="whitespace-nowrap text-[10px] font-bold text-zinc-400">
        {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
      </span>
    </div>
  );
}
