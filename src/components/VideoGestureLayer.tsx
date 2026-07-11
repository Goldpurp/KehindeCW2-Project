import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';

interface VideoGestureLayerProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  onTogglePlay: () => void;
  className?: string;
}

type GestureSide = 'left' | 'right';
type GestureFeedback = {
  text: string;
  side: GestureSide;
};

const DOUBLE_TAP_MS = 280;
const HOLD_TO_SPEED_MS = 360;
const SKIP_SECONDS = 5;
const HOLD_RATE = 2;

export default function VideoGestureLayer({
  videoRef,
  onTogglePlay,
  className = ''
}: VideoGestureLayerProps) {
  const [feedback, setFeedback] = useState<GestureFeedback | null>(null);
  const lastTapRef = useRef<{ time: number; side: GestureSide } | null>(null);
  const singleTapTimerRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const isSpeedHoldingRef = useRef(false);
  const activePointerRef = useRef<{ id: number; side: GestureSide } | null>(null);

  const clearSingleTapTimer = () => {
    if (singleTapTimerRef.current !== null) {
      window.clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
  };

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const showFeedback = (nextFeedback: GestureFeedback, persist = false) => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }

    setFeedback(nextFeedback);
    if (!persist) {
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
        feedbackTimerRef.current = null;
      }, 560);
    }
  };

  const resetPlaybackRate = () => {
    const node = videoRef.current;
    if (node) {
      node.playbackRate = 1;
    }
    isSpeedHoldingRef.current = false;
    setFeedback(null);
  };

  const seekBy = (seconds: number) => {
    const node = videoRef.current;
    if (!node) return;

    const duration = Number.isFinite(node.duration) && node.duration > 0 ? node.duration : null;
    const maxTime = duration ? Math.max(0, duration - 0.05) : Number.POSITIVE_INFINITY;
    const nextTime = Math.min(maxTime, Math.max(0, node.currentTime + seconds));

    try {
      node.currentTime = nextTime;
    } catch {
      // Some streams cannot seek until their metadata is available.
    }
  };

  const sideFromPointer = (event: PointerEvent<HTMLDivElement>): GestureSide => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientX - rect.left >= rect.width / 2 ? 'right' : 'left';
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.stopPropagation();
    clearSingleTapTimer();
    const side = sideFromPointer(event);
    activePointerRef.current = { id: event.pointerId, side };
    event.currentTarget.setPointerCapture?.(event.pointerId);

    if (side === 'right') {
      clearHoldTimer();
      holdTimerRef.current = window.setTimeout(() => {
        const node = videoRef.current;
        if (!node) return;

        isSpeedHoldingRef.current = true;
        node.playbackRate = HOLD_RATE;
        node.play().catch(() => undefined);
        showFeedback({ text: `${HOLD_RATE}x`, side: 'right' }, true);
      }, HOLD_TO_SPEED_MS);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const activePointer = activePointerRef.current;
    if (!activePointer || activePointer.id !== event.pointerId) return;

    event.stopPropagation();
    clearHoldTimer();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    activePointerRef.current = null;

    if (isSpeedHoldingRef.current) {
      resetPlaybackRate();
      return;
    }

    const now = Date.now();
    const side = activePointer.side;
    const previousTap = lastTapRef.current;
    const isDoubleTap = Boolean(previousTap && previousTap.side === side && now - previousTap.time <= DOUBLE_TAP_MS);

    if (isDoubleTap) {
      clearSingleTapTimer();
      lastTapRef.current = null;
      const seconds = side === 'right' ? SKIP_SECONDS : -SKIP_SECONDS;
      seekBy(seconds);
      showFeedback({ text: side === 'right' ? `+${SKIP_SECONDS}s` : `-${SKIP_SECONDS}s`, side });
      return;
    }

    lastTapRef.current = { time: now, side };
    clearSingleTapTimer();
    singleTapTimerRef.current = window.setTimeout(() => {
      onTogglePlay();
      lastTapRef.current = null;
      singleTapTimerRef.current = null;
    }, DOUBLE_TAP_MS);
  };

  const handlePointerCancel = () => {
    clearHoldTimer();
    activePointerRef.current = null;
    if (isSpeedHoldingRef.current) {
      resetPlaybackRate();
    }
  };

  useEffect(() => {
    const resetOnPointerEnd = () => {
      clearHoldTimer();
      activePointerRef.current = null;
      if (isSpeedHoldingRef.current) {
        resetPlaybackRate();
      }
    };

    window.addEventListener('pointerup', resetOnPointerEnd);
    window.addEventListener('pointercancel', resetOnPointerEnd);
    window.addEventListener('blur', resetOnPointerEnd);
    window.addEventListener('pagehide', resetOnPointerEnd);

    return () => {
      window.removeEventListener('pointerup', resetOnPointerEnd);
      window.removeEventListener('pointercancel', resetOnPointerEnd);
      window.removeEventListener('blur', resetOnPointerEnd);
      window.removeEventListener('pagehide', resetOnPointerEnd);
      clearSingleTapTimer();
      clearHoldTimer();
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      resetPlaybackRate();
    };
  }, []);

  return (
    <div
      className={`absolute inset-0 touch-manipulation ${className}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={(event) => {
        if (activePointerRef.current?.id === event.pointerId && event.pointerType === 'mouse') {
          handlePointerCancel();
        }
      }}
      aria-label="Video gesture controls"
    >
      {feedback && (
        <div
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-black/70 px-4 py-2 text-sm font-black text-white shadow-2xl backdrop-blur-md ${
            feedback.side === 'right' ? 'right-[18%]' : 'left-[18%]'
          }`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
}
