import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Eye,
  Film,
  Heart,
  MessageCircle,
  Plus,
  Star,
  Trash2,
  UploadCloud,
  UserPlus
} from 'lucide-react';
import { Video } from '../types';

interface ProfileScreenProps {
  username: string;
  displayName: string;
  email?: string;
  role?: 'creator' | 'consumer';
  photoURL?: string;
  videos: Video[];
  followingCount: number;
  followersLabel: string;
  isOwnProfile?: boolean;
  isUploadingProfilePhoto?: boolean;
  isFollowing?: boolean;
  isEditingName?: boolean;
  editDisplayName?: string;
  onEditDisplayNameChange?: (value: string) => void;
  onSaveDisplayName?: () => void;
  onCancelEdit?: () => void;
  onStartEdit?: () => void;
  onBack?: () => void;
  onFollow?: () => void;
  onUploadProfilePhoto?: () => void;
  onOpenUpload?: () => void;
  onDeleteVideo?: (video: Video) => void;
  onSelectVideo: (video: Video) => void;
}

export default function ProfileScreen({
  username,
  displayName,
  email,
  role = 'consumer',
  photoURL,
  videos,
  followingCount,
  followersLabel,
  isOwnProfile = false,
  isUploadingProfilePhoto = false,
  isFollowing = false,
  isEditingName = false,
  editDisplayName = '',
  onEditDisplayNameChange,
  onSaveDisplayName,
  onCancelEdit,
  onStartEdit,
  onBack,
  onFollow,
  onUploadProfilePhoto,
  onOpenUpload,
  onDeleteVideo,
  onSelectVideo
}: ProfileScreenProps) {
  const cleanUsername = username || 'kehindecw2_user';
  const initials = cleanUsername.slice(0, 2).toUpperCase();
  const isCreator = role === 'creator';
  const profileImageUrl = photoURL || videos.find((video) => video.creatorPhotoURL)?.creatorPhotoURL || '';
  const totalViews = videos.reduce((sum, video) => sum + (video.viewCount || 0), 0);
  const totalLikes = videos.reduce((sum, video) => sum + (video.likes?.length || 0), 0);
  const totalComments = videos.reduce((sum, video) => sum + (video.commentCount || 0), 0);
  const totalRatings = videos.reduce((sum, video) => sum + Object.keys(video.ratings || {}).length, 0);
  const ratedVideos = videos.filter((video) => video.averageRating > 0);
  const averageScore = ratedVideos.length
    ? (ratedVideos.reduce((sum, video) => sum + video.averageRating, 0) / ratedVideos.length).toFixed(1)
    : '0.0';
  const ageListings = Array.from(new Set(videos.map((video) => video.ageRating))).filter(Boolean);

  const stats = [
    { label: 'posts', value: videos.length.toString() },
    { label: 'followers', value: followersLabel },
    { label: 'following', value: followingCount.toLocaleString() }
  ];

  const engagementStats = [
    { label: 'Likes', value: totalLikes.toLocaleString(), icon: Heart },
    { label: 'Comments', value: totalComments.toLocaleString(), icon: MessageCircle },
    { label: 'Rating', value: `${averageScore} (${totalRatings})`, icon: Star }
  ];

  const actionLabel = isOwnProfile ? 'Edit profile' : isFollowing ? 'Following' : 'Follow';

  if (isOwnProfile && isCreator) {
    return (
      <section className="mx-auto min-w-0 w-full max-w-6xl text-white" id="my-profile-container">
        <div className="border-b border-zinc-900 pb-6 md:pt-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-950">
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt={cleanUsername}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xl font-black text-white">
                    {initials}
                  </span>
                )}
                {isOwnProfile && onUploadProfilePhoto && (
                  <button
                    type="button"
                    onClick={onUploadProfilePhoto}
                    disabled={isUploadingProfilePhoto}
                    className="absolute inset-x-0 bottom-0 flex h-7 items-center justify-center bg-black/75 text-white backdrop-blur-sm transition hover:bg-zinc-900 disabled:opacity-60"
                    title="Upload profile picture"
                    aria-label="Upload profile picture"
                  >
                    <Camera size={14} />
                  </button>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-semibold tracking-tight">{cleanUsername}</h1>
                  {isCreator && <BadgeCheck size={21} className="text-zinc-100" />}
                  <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[10px] font-bold uppercase text-zinc-400">
                    Creator
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-zinc-300">{displayName}</p>
                {email && <p className="mt-1 text-xs text-zinc-500">{email}</p>}
              </div>
            </div>

            <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
              {isEditingName ? (
                <>
                  <input
                    value={editDisplayName}
                    onChange={(event) => onEditDisplayNameChange?.(event.target.value)}
                    className="w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-base font-semibold text-white outline-none focus:border-white sm:w-auto sm:min-w-56 sm:text-sm"
                    autoFocus
                  />
                  <button
                    onClick={onSaveDisplayName}
                    className="min-h-11 flex-1 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-bold text-black transition hover:bg-white sm:flex-none"
                  >
                    Save
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="min-h-11 flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-100 transition hover:bg-zinc-800 sm:flex-none"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onStartEdit}
                    className="min-h-11 flex-1 rounded-lg bg-[#262a2f] px-4 py-2 text-sm font-bold text-zinc-100 transition hover:bg-[#30343a] sm:flex-none"
                  >
                    Edit profile
                  </button>
                  <button
                    onClick={onOpenUpload}
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-zinc-200 sm:flex-none"
                  >
                    <UploadCloud size={16} />
                    Upload video
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Uploaded videos', value: videos.length.toString(), icon: Film },
              { label: 'Total views', value: totalViews.toLocaleString(), icon: Eye },
              { label: 'Avg rating', value: averageScore, icon: Star },
              { label: 'Age listings', value: ageListings.length.toString(), icon: BadgeCheck }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="min-w-0 rounded-xl border border-zinc-900 bg-[#080a0d] p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between text-zinc-500">
                    <span className="min-w-0 text-[10px] font-bold uppercase sm:text-xs">{item.label}</span>
                    <Icon size={16} />
                  </div>
                  <p className="break-words text-xl font-black sm:text-2xl">{item.value}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="py-6">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-black">Uploaded videos</h2>
              <p className="text-sm text-zinc-500">Creator library with Netflix-style content metadata.</p>
            </div>
            {ageListings.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {ageListings.map((age) => (
                  <span key={age} className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-bold text-zinc-400">
                    {age}
                  </span>
                ))}
              </div>
            )}
          </div>

          {videos.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 text-center">
              <Camera size={34} className="mb-3 text-zinc-600" />
              <h3 className="text-lg font-black">No uploads yet</h3>
              <p className="mt-1 text-sm text-zinc-500">Uploaded videos will appear here.</p>
              <button
                onClick={onOpenUpload}
                className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-zinc-200"
              >
                Upload video
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <button
                onClick={onOpenUpload}
                className="flex min-h-[330px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-[#080a0d] text-zinc-400 transition hover:border-zinc-600 hover:text-white"
              >
                <Plus size={34} />
                <span className="mt-3 text-sm font-bold">Upload new video</span>
              </button>

              {videos.map((video) => (
                <article
                  key={video.id}
                  className="group overflow-hidden rounded-xl border border-zinc-900 bg-[#080a0d] text-left transition hover:border-zinc-700"
                >
                  <button
                    type="button"
                    onClick={() => onSelectVideo(video)}
                    className="block w-full text-left"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-zinc-950">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-4">
                        <span className="mb-2 inline-flex rounded bg-white px-2 py-0.5 text-[10px] font-black text-black">
                          {video.ageRating}
                        </span>
                        <h3 className="line-clamp-2 text-base font-black text-white">{video.title}</h3>
                      </div>
                    </div>

                    <div className="space-y-3 p-4">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-zinc-500">Genre</p>
                          <p className="mt-1 truncate font-bold text-zinc-100">{video.genre}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Producer</p>
                          <p className="mt-1 truncate font-bold text-zinc-100">{video.producer}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Publisher</p>
                          <p className="mt-1 truncate font-bold text-zinc-100">{video.publisher}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Rating</p>
                          <p className="mt-1 font-bold text-zinc-100">
                            {video.averageRating ? video.averageRating.toFixed(1) : '0.0'}
                            <span className="ml-1 text-zinc-500">({Object.keys(video.ratings || {}).length})</span>
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 border-t border-zinc-900 pt-3 text-xs font-bold text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Heart size={13} />
                          {video.likes?.length || 0}
                        </span>
                        <span className="flex items-center justify-center gap-1">
                          <MessageCircle size={13} />
                          {video.commentCount || 0}
                        </span>
                        <span className="flex items-center justify-end gap-1">
                          <Star size={13} />
                          {video.averageRating ? video.averageRating.toFixed(1) : '0.0'}
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className="border-t border-zinc-900 p-3">
                    <button
                      type="button"
                      onClick={() => onDeleteVideo?.(video)}
                      className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#7f1d1d]/35 px-3 py-2 text-xs font-black text-[#f87171] transition hover:bg-[#dc2626] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fca5a5]"
                    >
                      <Trash2 size={14} />
                      Delete video
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto min-w-0 w-full max-w-[935px] text-white" id={isOwnProfile ? 'my-profile-container' : 'creator-profile-container'}>
      {onBack && (
        <button
          onClick={onBack}
          className="mb-4 hidden md:flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      )}

      <div className="px-1 md:px-0">
        <div className="md:grid md:grid-cols-[220px_1fr] md:gap-8 md:pt-8 md:pb-10">
          <div className="flex items-center justify-between md:block">
            <div className="relative h-[72px] w-[72px] shrink-0 rounded-full border border-zinc-700 bg-zinc-950 sm:h-20 sm:w-20 md:h-[150px] md:w-[150px]">
              <div className="w-full h-full rounded-full bg-[#09090b] border-4 border-black overflow-hidden flex items-center justify-center">
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt={cleanUsername}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-2xl md:text-5xl font-black text-white">{initials}</span>
                )}
              </div>
              {isOwnProfile && onUploadProfilePhoto && (
                <button
                  type="button"
                  onClick={onUploadProfilePhoto}
                  disabled={isUploadingProfilePhoto}
                  className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-white text-black shadow-2xl transition hover:bg-zinc-200 disabled:opacity-60 md:h-11 md:w-11"
                  title="Upload profile picture"
                  aria-label="Upload profile picture"
                >
                  <Camera size={17} />
                </button>
              )}
            </div>

            <div className="ml-3 flex min-w-0 flex-1 justify-around gap-1 md:hidden sm:ml-5">
              {stats.map((stat) => (
                <div key={stat.label} className="min-w-0 flex-1 text-center">
                  <p className="text-base font-bold leading-none">{stat.value}</p>
                  <p className="mt-1 truncate text-[10px] text-zinc-300 sm:text-[11px]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 md:pt-0 min-w-0">
            <div className="hidden md:flex items-center gap-4">
              <h1 className="text-2xl font-semibold tracking-tight">{cleanUsername}</h1>
              {isCreator && <BadgeCheck size={22} className="text-zinc-200" />}
            </div>

            <div className="hidden md:flex items-center gap-10 mt-6">
              {stats.map((stat) => (
                <p key={stat.label} className="text-base text-zinc-200">
                  <span className="font-bold text-white">{stat.value}</span> {stat.label}
                </p>
              ))}
            </div>

            <div className="mt-3 md:mt-6 space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold">{displayName}</p>
                <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-400">
                  {role}
                </span>
              </div>
              {email && <p className="text-xs text-zinc-500">{email}</p>}
              <p className="text-sm text-zinc-300">
                {isCreator ? 'Creator account' : 'Consumer account'}
              </p>
            </div>

            <div className="mt-4 md:mt-7 grid grid-cols-2 gap-2 md:flex md:max-w-2xl">
              {isEditingName ? (
                <>
                  <input
                    value={editDisplayName}
                    onChange={(event) => onEditDisplayNameChange?.(event.target.value)}
                    className="col-span-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-base font-semibold text-white outline-none focus:border-white md:w-64 md:text-sm"
                    autoFocus
                  />
                  <button
                    onClick={onSaveDisplayName}
                    className="min-h-11 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-bold text-black transition hover:bg-white md:min-w-40"
                  >
                    Save
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="min-h-11 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-100 transition hover:bg-zinc-800 md:min-w-40"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={isOwnProfile ? onStartEdit : onFollow}
                    className={`min-h-11 rounded-lg px-4 py-2 text-sm font-bold transition md:min-w-48 ${
                      !isOwnProfile && !isFollowing
                        ? 'bg-white text-black hover:bg-zinc-200'
                        : 'bg-[#262a2f] text-zinc-100 hover:bg-[#30343a]'
                    }`}
                  >
                    {actionLabel}
                  </button>
                  {!isOwnProfile && (
                    <button
                      onClick={onFollow}
                      className="hidden md:flex rounded-lg bg-[#262a2f] px-3 py-2 text-zinc-100 transition hover:bg-[#30343a]"
                      title="Follow"
                    >
                      <UserPlus size={18} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {isCreator && isOwnProfile && (
          <div className="py-5 md:py-7">
            <button
              onClick={onOpenUpload}
              className="flex flex-col items-center gap-2"
            >
              <span className="w-[72px] h-[72px] md:w-[88px] md:h-[88px] rounded-full border-2 border-zinc-800 bg-zinc-950 flex items-center justify-center text-zinc-500">
                <Plus size={34} />
              </span>
              <span className="text-xs font-bold text-zinc-200">New</span>
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-900">
        <div className="grid grid-cols-3 text-zinc-400">
          {engagementStats.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="-mt-px flex h-14 min-w-0 items-center justify-center gap-1 border-t border-transparent px-1 text-[11px] font-bold text-zinc-300 sm:gap-2 sm:text-xs md:text-sm">
                <Icon size={17} className="text-white" />
                <span className="font-black text-white">{item.value}</span>
                <span className="hidden text-zinc-500 sm:inline">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="min-h-[300px] flex flex-col items-center justify-center text-center px-6">
          <div className="w-[72px] h-[72px] rounded-full border-2 border-zinc-200 flex items-center justify-center mb-6">
            <Camera size={34} />
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight">No posts yet</h2>
          <p className="mt-2 text-sm text-zinc-500">
            {isCreator ? 'Videos will appear here.' : 'Saved activity will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 md:gap-1.5">
          {videos.map((video) => (
            <button
              key={video.id}
              onClick={() => onSelectVideo(video)}
              className="group relative aspect-square overflow-hidden bg-zinc-950"
            >
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                className="w-full h-full object-cover transition duration-500 group-hover:scale-105 group-hover:opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 hidden items-center justify-center gap-2 bg-black/35 text-white group-hover:flex">
                <span className="flex items-center gap-1 text-xs font-bold">
                  <Heart size={16} />
                  {video.likes?.length || 0}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold">
                  <MessageCircle size={16} />
                  {video.commentCount || 0}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold">
                  <Star size={16} />
                  {video.averageRating ? video.averageRating.toFixed(1) : '0.0'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
