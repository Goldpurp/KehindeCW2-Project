import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Film,
  ImagePlus,
  Play,
  X
} from 'lucide-react';
import { auth, db, doc, handleAzureError, OperationType, setDoc } from '../lib/azure';
import { AGE_RATINGS, GENRES, AgeRating } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
  prefilledVideoUrl?: string;
  prefilledFileName?: string;
  prefilledFile?: File | null;
}

type UploadStep = 'select' | 'crop' | 'details';
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

const captureVideoThumbnail = (file: File, fallback: string) => new Promise<string>((resolve) => {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  let settled = false;
  const finish = (value: string) => {
    if (settled) return;
    settled = true;
    URL.revokeObjectURL(objectUrl);
    resolve(value);
  };

  const capture = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 900;
      const context = canvas.getContext('2d');
      if (!context) {
        finish(fallback);
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      finish(canvas.toDataURL('image/jpeg', 0.78));
    } catch {
      finish(fallback);
    }
  };

  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;
  video.onloadeddata = () => {
    if (Number.isFinite(video.duration) && video.duration > 0.4) {
      video.currentTime = 0.35;
      return;
    }
    capture();
  };
  video.onseeked = capture;
  video.onerror = () => finish(fallback);
  window.setTimeout(() => finish(fallback), 2200);
});

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export default function UploadModal({
  isOpen,
  onClose,
  onUploadSuccess,
  prefilledVideoUrl = '',
  prefilledFileName = '',
  prefilledFile = null
}: UploadModalProps) {
  const user = auth.currentUser;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<UploadStep>('select');
  const [caption, setCaption] = useState('');
  const [genre, setGenre] = useState('Entertainment');
  const [ageRating, setAgeRating] = useState<AgeRating>('All Ages');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const creatorName = user?.displayName?.trim() || user?.email?.split('@')[0] || '';
  const creatorPhotoURL = user?.photoURL || '';
  const producer = creatorName;
  const publisher = creatorName;

  useEffect(() => {
    if (!isOpen) return;

    setCaption('');
    setGenre('Entertainment');
    setAgeRating('All Ages');
    setVideoUrl(prefilledVideoUrl);
    setThumbnailUrl('');
    setFileName(prefilledFileName || '');
    setSelectedFile(prefilledFile);
    setStep(prefilledVideoUrl ? 'crop' : 'select');
    setError('');
    setSuccessMsg('');
    setIsDragging(false);

    if (prefilledFile) {
      captureVideoThumbnail(prefilledFile, '').then((thumbnail) => {
        setThumbnailUrl(thumbnail);
      });
    }
  }, [isOpen, prefilledVideoUrl, prefilledFileName, prefilledFile, creatorName]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const applyFile = (file: File) => {
    const url = URL.createObjectURL(file);

    setCaption('');
    setGenre('Entertainment');
    setAgeRating('All Ages');
    setVideoUrl(url);
    setThumbnailUrl('');
    setFileName(file.name);
    setSelectedFile(file);
    setError('');
    setStep('crop');

    captureVideoThumbnail(file, '').then((thumbnail) => {
      setThumbnailUrl(thumbnail);
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) applyFile(file);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) applyFile(file);
  };

  const handlePublish = async () => {
    setError('');
    setSuccessMsg('');

    if (!user) {
      setError('Sign in first.');
      return;
    }

    if (!creatorName) {
      setError('Your profile is still loading.');
      return;
    }

    if (!caption.trim() || !videoUrl.trim()) {
      setError('Fill the required fields.');
      return;
    }

    if (!selectedFile && videoUrl.startsWith('blob:')) {
      setError('Choose the video again.');
      return;
    }

    if (selectedFile && selectedFile.size > MAX_UPLOAD_BYTES) {
      setError('Choose a video under 30 MB.');
      return;
    }

    const isValidSource = Boolean(selectedFile) ||
      videoUrl.startsWith('http://') ||
      videoUrl.startsWith('https://') ||
      videoUrl.startsWith('data:video/');

    if (!isValidSource) {
      setError('Choose a video again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const videoId = 'vid_' + Math.random().toString(36).substring(2, 11);
      const videoDataUrl = selectedFile ? await fileToDataUrl(selectedFile) : undefined;
      const thumbnailDataUrl = thumbnailUrl.startsWith('data:image/') ? thumbnailUrl : undefined;
      const storedVideoUrl = videoDataUrl || videoUrl.trim();

      await setDoc(doc(db, 'videos', videoId), {
        id: videoId,
        title: caption.trim(),
        publisher,
        producer,
        genre,
        ageRating,
        videoUrl: storedVideoUrl,
        videoDataUrl,
        thumbnailUrl: thumbnailDataUrl || thumbnailUrl,
        thumbnailDataUrl,
        fileName,
        creatorId: user.uid,
        creatorName,
        createdAt: new Date(),
        likes: [],
        ratings: {},
        averageRating: 0,
        viewCount: 0,
        shareCount: 0
      });

      setSuccessMsg('Shared.');
      onUploadSuccess();
      window.setTimeout(() => {
        onClose();
      }, 550);
    } catch (error) {
      console.error(error);
      handleAzureError(error, OperationType.CREATE, 'videos');
      setError('Upload failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPreview = (large = false) => (
    <div className={`relative mx-auto aspect-[4/5] overflow-hidden bg-black ${large ? 'w-[min(100%,580px)] max-h-[calc(100dvh-132px)]' : 'w-full max-w-[520px]'}`}>
      {videoUrl ? (
        <video
          src={videoUrl}
          poster={thumbnailUrl}
          className="h-full w-full object-cover"
          muted
          loop
          playsInline
          controls={false}
        />
      ) : thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <div className="h-full w-full bg-black" />
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/85 text-black shadow-2xl">
          <Play size={30} className="ml-1 fill-current" />
        </span>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-0 text-white backdrop-blur-md sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            onClick={handleClose}
          />

          <motion.section
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className={`relative z-10 flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-[#111318] shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-[4px] sm:border sm:border-zinc-800 ${
              step === 'details' ? 'sm:h-[calc(100dvh-2rem)] sm:max-w-[1120px]' : 'sm:max-w-[840px]'
            }`}
          >
            <header className="safe-top flex min-h-14 shrink-0 items-center justify-between border-b border-zinc-800 px-3 sm:px-5">
              <button
                type="button"
                onClick={() => {
                  if (step === 'details') setStep('crop');
                  else if (step === 'crop') setStep('select');
                  else handleClose();
                }}
                className="rounded-full p-1.5 text-zinc-200 transition hover:bg-zinc-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffffff]"
                aria-label={step === 'select' ? 'Close upload' : 'Go back'}
              >
                {step === 'select' ? <X size={22} /> : <ArrowLeft size={24} />}
              </button>

              <h2 className="text-base font-extrabold">
                {step === 'select' && 'Create new post'}
                {step === 'crop' && 'Crop'}
                {step === 'details' && 'New post'}
              </h2>

              {step === 'crop' ? (
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  disabled={!videoUrl}
                  className="rounded px-1 text-sm font-extrabold text-[#ffffff] transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffffff] disabled:opacity-40"
                >
                  Next
                </button>
              ) : step === 'details' ? (
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isSubmitting}
                  className="rounded px-1 text-sm font-extrabold text-[#ffffff] transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffffff] disabled:opacity-40"
                >
                  {isSubmitting ? 'Sharing...' : 'Share'}
                </button>
              ) : (
                <span className="w-10" />
              )}
            </header>

            {(error || successMsg) && (
              <div
                className={`mx-5 mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
                  error
                    ? 'border-red-900/50 bg-red-950/20 text-red-300'
                    : 'border-[#3f3f46]/60 bg-[#18181b] text-[#f4f4f5]'
                }`}
              >
                {error ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                <span>{error || successMsg}</span>
              </div>
            )}

            {step === 'select' && (
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-8 text-center transition sm:min-h-[520px] sm:px-6 ${
                  isDragging ? 'bg-zinc-800/70' : 'bg-[#24262b]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="mb-6 flex items-center text-zinc-100">
                  <ImagePlus size={52} strokeWidth={1.6} />
                  <Film size={58} strokeWidth={1.6} className="-ml-4" />
                </div>
                <p className="text-xl font-semibold">Drag videos here</p>
                <div className="mt-6 flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-11 rounded-lg bg-white px-5 py-2 text-sm font-bold text-black transition hover:bg-zinc-200"
                  >
                    Select from computer
                  </button>
                </div>
              </div>
            )}

            {step === 'crop' && (
              <div className="min-h-0 flex-1 overflow-y-auto bg-black">
                <div className="flex min-h-full items-center justify-center px-3 py-4 sm:min-h-[520px] sm:px-4 sm:py-6">
                  {renderPreview()}
                </div>
              </div>
            )}

            {step === 'details' && (
              <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_360px] md:overflow-hidden">
                <div className="flex h-[48dvh] min-h-[260px] items-center justify-center overflow-hidden bg-black p-3 sm:min-h-[340px] sm:p-4 md:h-auto md:min-h-[380px]">
                  {renderPreview(true)}
                </div>

                <aside className="flex min-h-0 flex-col overflow-visible bg-[#202126] md:overflow-hidden">
                  <div className="shrink-0 flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
                    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-zinc-900 text-xs font-black uppercase text-white">
                      {creatorPhotoURL ? (
                        <img src={creatorPhotoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        creatorName.slice(0, 2)
                      )}
                    </span>
                    <span className="text-sm font-extrabold">{creatorName}</span>
                  </div>

                  <div className="min-h-0 flex-1 overflow-visible overscroll-contain px-4 py-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-5 md:overflow-y-auto md:pb-8">
                    <label className="block rounded-2xl border border-zinc-800 bg-[#17191f] p-4">
                      <span className="mb-2 block text-xs font-extrabold text-zinc-300">Caption</span>
                      <textarea
                        required
                        value={caption}
                        onChange={(event) => setCaption(event.target.value)}
                        maxLength={2200}
                        className="h-24 min-h-24 w-full resize-none border-0 bg-transparent text-base leading-relaxed text-white outline-none placeholder:text-zinc-600 md:text-sm"
                        placeholder="Write a caption..."
                      />
                      <span className="block text-right text-xs font-semibold text-zinc-500">{caption.length}/2,200</span>
                    </label>

                    <div className="mt-4 space-y-3 rounded-2xl border border-zinc-800 bg-[#17191f] p-4">
                      <p className="text-sm font-extrabold text-white">Video details</p>
                      <label className="block">
                        <span className="mb-1 block text-xs font-bold text-zinc-400">Age rating</span>
                        <select
                          value={ageRating}
                          onChange={(event) => setAgeRating(event.target.value as AgeRating)}
                          className="w-full rounded-xl border border-zinc-700 bg-[#1d1f24] px-3 py-3 text-base outline-none transition focus:border-[#ffffff] md:py-2.5 md:text-sm"
                        >
                          {AGE_RATINGS.map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-bold text-zinc-400">Genre</span>
                        <select
                          value={genre}
                          onChange={(event) => setGenre(event.target.value)}
                          className="w-full rounded-xl border border-zinc-700 bg-[#1d1f24] px-3 py-3 text-base outline-none transition focus:border-[#ffffff] md:py-2.5 md:text-sm"
                        >
                          {GENRES.map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                      </label>

                      <div className="grid gap-3 rounded-xl border border-zinc-800 bg-[#1d1f24] p-3">
                        {[
                          ['Producer', producer],
                          ['Publisher', publisher]
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between gap-4">
                            <span className="text-xs font-bold text-zinc-500">{label}</span>
                            <span className="min-w-0 truncate text-sm font-extrabold text-zinc-100">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-zinc-800 bg-[#17191f] p-4">
                      <p className="mb-3 text-sm font-extrabold">Listing preview</p>
                      <div className="space-y-3 text-sm">
                        {[
                          ['Age', ageRating],
                          ['Caption', caption || 'No caption yet'],
                          ['Producer', producer || 'Producer'],
                          ['Genre', genre],
                          ['Publisher', publisher || 'Publisher']
                        ].map(([label, value]) => (
                          <div key={label} className="flex min-w-0 items-start justify-between gap-4 border-b border-zinc-800/70 pb-2 last:border-0 last:pb-0">
                            <span className="shrink-0 text-zinc-500">{label}</span>
                            <span className="min-w-0 max-w-[190px] truncate text-right font-bold text-zinc-100">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="mt-4 text-xs font-semibold leading-relaxed text-zinc-500">
                      This video will appear in the feed and on your creator profile after it uploads.
                    </p>
                  </div>
                </aside>
              </div>
            )}
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
