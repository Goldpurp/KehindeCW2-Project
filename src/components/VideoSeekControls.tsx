import type { RefObject } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface VideoSeekControlsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  muted: boolean;
  onToggleMuted: () => void;
  className?: string;
}

export default function VideoSeekControls({
  muted,
  onToggleMuted,
  className = ''
}: VideoSeekControlsProps) {
  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={onToggleMuted}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-md transition hover:bg-black/90 active:scale-95"
        aria-label={muted ? 'Unmute video' : 'Mute video'}
        title={muted ? 'Unmute video' : 'Mute video'}
      >
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
    </div>
  );
}
