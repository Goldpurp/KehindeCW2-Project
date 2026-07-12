import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  itemName: string;
  isDeleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function DeleteConfirmModal({
  isOpen,
  itemName,
  isDeleting = false,
  onCancel,
  onConfirm
}: DeleteConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeleting) onCancel();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDeleting, isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="safe-top safe-bottom fixed inset-0 z-[100] flex items-center justify-center px-4 text-white">
          <motion.button
            type="button"
            aria-label="Cancel deletion"
            className="absolute inset-0 cursor-default bg-black/80 backdrop-blur-sm"
            onClick={() => !isDeleting && onCancel()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            aria-describedby="delete-confirm-description"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 280, damping: 25 }}
            className="relative w-full max-w-[400px] overflow-hidden rounded-lg border border-[#7f1d1d] bg-[#111318] shadow-2xl"
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:opacity-40"
              aria-label="Close delete confirmation"
            >
              <X size={20} />
            </button>

            <div className="px-6 pb-5 pt-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#7f1d1d]/35 text-[#f87171]">
                <AlertTriangle size={23} />
              </span>
              <h2 id="delete-confirm-title" className="mt-4 text-lg font-black">Delete video?</h2>
              <p id="delete-confirm-description" className="mt-2 text-sm leading-relaxed text-zinc-400">
                <span className="font-bold text-zinc-200">{itemName}</span> will be permanently removed. This cannot be undone.
              </p>
            </div>

            <div className="grid grid-cols-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={onCancel}
                disabled={isDeleting}
                className="min-h-12 border-r border-zinc-800 px-4 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onConfirm()}
                disabled={isDeleting}
                className="flex min-h-12 items-center justify-center gap-2 bg-[#dc2626] px-4 text-sm font-black text-white transition hover:bg-[#b91c1c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fca5a5] focus-visible:ring-inset disabled:cursor-wait disabled:bg-[#7f1d1d]"
              >
                <Trash2 size={16} />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
