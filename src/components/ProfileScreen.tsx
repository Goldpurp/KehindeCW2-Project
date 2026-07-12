import { useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Eye,
  Film,
  Heart,
  MessageCircle,
  Plus,
  Settings,
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
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
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

  const showProfileNotice = (message: string) => {
    setProfileNotice(message);
    window.setTimeout(() => setProfileNotice(null), 2600);
  };

  if (isOwnProfile && isCreator) {
    return (
      <section className="w-full max-w-6xl mx-auto text-white" id="my-profile-container">
        {profileNotice && (
          <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-bold text-zinc-100 shadow-2xl">
            {profileNotice}
          </div>
        )}

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

            <div className="flex flex-wrap gap-2">
              {isEditingName ? (
                <>
                  <input
                    value={editDisplayName}
                    onChange={(event) => onEditDisplayNameChange?.(event.target.value)}
                    className="min-w-56 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-white"
                    autoFocus
                  />
                  <button
                    onClick={onSaveDisplayName}
                    className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-bold text-black transition hover:bg-white"
                  >
                    Save
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-100 transition hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onStartEdit}
                    className="rounded-lg bg-[#262a2f] px-4 py-2 text-sm font-bold text-zinc-100 transition hover:bg-[#30343a]"
                  >
                    Edit profile
                  </button>
                  <button
                    onClick={onOpenUpload}
                    className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-zinc-200"
                  >
                    <UploadCloud size={16} />
                    Upload video
                  </button>
                  <button
                    onClick={() => showProfileNotice('Profile settings are already synced.')}
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-zinc-200 transition hover:bg-zinc-800"
                    title="Settings"
                  >
                    <Settings size={18} />
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
                <div key={item.label} className="rounded-xl border border-zinc-900 bg-[#080a0d] p-4">
                  <div className="mb-3 flex items-center justify-between text-zinc-500">
                    <span className="text-xs font-bold uppercase">{item.label}</span>
                    <Icon size={16} />
                  </div>
                  <p className="text-2xl font-black">{item.value}</p>
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
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-950/35 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-950"
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
    <section className="w-full max-w-[935px] mx-auto text-white" id={isOwnProfile ? 'my-profile-container' : 'creator-profile-container'}>
      {profileNotice && (
        <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-bold text-zinc-100 shadow-2xl">
          {profileNotice}
        </div>
      )}
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
          <div className="flex md:block items-center justify-between">
            <div className="relative h-20 w-20 rounded-full border border-zinc-700 bg-zinc-950 md:h-[150px] md:w-[150px]">
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

            <div className="flex flex-1 justify-around md:hidden ml-5">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center min-w-14">
                  <p className="text-base font-bold leading-none">{stat.value}</p>
                  <p className="text-[11px] text-zinc-300 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 md:pt-0 min-w-0">
            <div className="hidden md:flex items-center gap-4">
              <h1 className="text-2xl font-semibold tracking-tight">{cleanUsername}</h1>
              {isCreator && <BadgeCheck size={22} className="text-zinc-200" />}
              <button
                onClick={() => showProfileNotice('Use Edit profile to update your profile settings.')}
                className="p-1 text-zinc-300 hover:text-white transition"
                title="Settings"
              >
                <Settings size={22} />
              </button>
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
                    className="col-span-2 md:w-64 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-white"
                    autoFocus
                  />
                  <button
                    onClick={onSaveDisplayName}
                    className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-bold text-black transition hover:bg-white md:min-w-40"
                  >
                    Save
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-100 transition hover:bg-zinc-800 md:min-w-40"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={isOwnProfile ? onStartEdit : onFollow}
                    className={`rounded-lg px-4 py-2 text-sm font-bold transition md:min-w-48 ${
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
              <div key={item.label} className="-mt-px flex h-14 items-center justify-center gap-2 border-t border-transparent text-xs font-bold text-zinc-300 md:text-sm">
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
