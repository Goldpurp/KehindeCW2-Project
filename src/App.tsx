import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  User, 
  Crown, 
  ArrowLeft, 
  CheckCircle2,
  AlertCircle,
  Home,
  Heart,
  LogOut,
  PlayCircle,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { 
  auth, 
  db, 
  handleAzureError, 
  OperationType,
  onAuthStateChanged, 
  signOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  doc, 
  getDoc, 
  getDocs,
  deleteDoc,
  updateDoc,
  onSnapshot, 
  collection, 
  query, 
  orderBy
} from './lib/azure';
import { GENRES, UserProfile, Video } from './types';
import Feed from './components/Feed';
import UploadModal from './components/UploadModal';
import InstagramFeedList from './components/InstagramFeedList';
import ProfileScreen from './components/ProfileScreen';
import CommentsDrawer from './components/CommentsDrawer';

interface Sug {
  userId: string;
  username: string;
  text: string;
  initial: string;
  photoURL?: string;
  uploadCount: number;
}

type ActivityFilter = 'all' | 'following' | 'comments' | 'likes' | 'ratings' | 'uploads' | 'follows';
type ActivityEventType = 'upload' | 'comment' | 'like' | 'rating' | 'follow' | 'delete';

interface ActivityEvent {
  id: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  videoId?: string;
  commentId?: string;
  type: ActivityEventType;
  text: string;
  thumbnailUrl?: string;
  createdAt: any;
  read: boolean;
}

const PROFILE_PHOTO_SIZE = 512;

const fileToProfilePhotoDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  if (!file.type.startsWith('image/')) {
    reject(new Error('Choose an image file.'));
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read that image.'));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('Could not load that image.'));
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = PROFILE_PHOTO_SIZE;
      canvas.height = PROFILE_PHOTO_SIZE;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Could not prepare that image.'));
        return;
      }

      const sourceSize = Math.min(image.width, image.height);
      const sourceX = Math.max(0, (image.width - sourceSize) / 2);
      const sourceY = Math.max(0, (image.height - sourceSize) / 2);

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        PROFILE_PHOTO_SIZE,
        PROFILE_PHOTO_SIZE
      );

      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    image.src = String(reader.result || '');
  };
  reader.readAsDataURL(file);
});

export default function App() {
  // Auth states
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authRole, setAuthRole] = useState<'consumer' | 'creator'>('consumer');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // App navigation
  // 'home' = infinite feed, 'creator_profile' = selected creator, 'profile' = current user, 'creator_feed' = creator's filtered video uploads feed
  const [viewMode, setViewMode] = useState<'home' | 'creator_profile' | 'profile' | 'creator_feed'>('home');
  const [feedTab, setFeedTab] = useState<'latest' | 'for_you' | 'following'>('for_you');
  const [selectedCreatorName, setSelectedCreatorName] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchGenre, setSearchGenre] = useState('All');
  
  // Data states
  const [videos, setVideos] = useState<Video[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, UserProfile>>({});
  const [commentCountsByVideoId, setCommentCountsByVideoId] = useState<Record<string, number>>({});
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [selectedPostVideo, setSelectedPostVideo] = useState<Video | null>(null);

  // Profile Edit states
  const [editDisplayName, setEditDisplayName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isProfilePhotoUploading, setIsProfilePhotoUploading] = useState(false);
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Modals / Toast
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [prefilledVideoUrl, setPrefilledVideoUrl] = useState('');
  const [prefilledVideoName, setPrefilledVideoName] = useState('');
  const [prefilledVideoFile, setPrefilledVideoFile] = useState<File | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [activeDesktopNav, setActiveDesktopNav] = useState<'home' | 'search' | 'notifications' | 'create' | 'profile'>('home');

  const profileRole = (profile?.role || 'consumer') as 'creator' | 'consumer';
  const isCreator = profileRole === 'creator';
  const currentUsername = profile?.displayName?.toLowerCase().replace(/\s/g, '_') || user?.displayName?.toLowerCase().replace(/\s/g, '_') || 'user';
  const profilePhotoByUserId = React.useMemo<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    const profileList = Object.values(profilesById) as UserProfile[];
    profileList.forEach((item) => {
      if (item.uid && item.photoURL) {
        next[item.uid] = item.photoURL;
      }
    });

    const currentPhotoURL = profile?.photoURL || user?.photoURL || '';
    if (user?.uid && currentPhotoURL) {
      next[user.uid] = currentPhotoURL;
    }

    return next;
  }, [profilesById, profile?.photoURL, user?.photoURL, user?.uid]);

  const profileByName = React.useMemo<Record<string, UserProfile>>(() => {
    const next: Record<string, UserProfile> = {};
    const profileList = Object.values(profilesById) as UserProfile[];
    profileList.forEach((item) => {
      if (!item.displayName) return;
      next[item.displayName] = item;
      next[item.displayName.toLowerCase().replace(/\s/g, '_')] = item;
    });
    return next;
  }, [profilesById]);

  const videosWithProfilePhotos = React.useMemo(() => videos.map((video) => ({
    ...video,
    creatorPhotoURL: profilePhotoByUserId[video.creatorId] || video.creatorPhotoURL || '',
    commentCount: commentCountsByVideoId[video.id] ?? video.commentCount ?? 0
  })), [commentCountsByVideoId, profilePhotoByUserId, videos]);

  const selectedCreatorProfile = profileByName[selectedCreatorName] || null;
  const selectedCreatorId = selectedCreatorProfile?.uid
    || videosWithProfilePhotos.find((video) => video.creatorName === selectedCreatorName)?.creatorId
    || '';
  const selectedCreatorPhotoURL = selectedCreatorProfile?.photoURL
    || videosWithProfilePhotos.find((video) => video.creatorName === selectedCreatorName)?.creatorPhotoURL
    || '';

  const currentFollowingIds = React.useMemo(() => {
    const liveProfile = user?.uid ? profilesById[user.uid] : null;
    return Array.isArray(liveProfile?.followingIds)
      ? liveProfile.followingIds
      : Array.isArray(profile?.followingIds)
        ? profile.followingIds
        : [];
  }, [profile?.followingIds, profilesById, user?.uid]);

  const followingSet = React.useMemo(() => new Set(currentFollowingIds), [currentFollowingIds]);
  const followerCountByUserId = React.useMemo(() => {
    const counts: Record<string, number> = {};
    (Object.values(profilesById) as UserProfile[]).forEach((item) => {
      (item.followingIds || []).forEach((followedId) => {
        counts[followedId] = (counts[followedId] || 0) + 1;
      });
    });
    return counts;
  }, [profilesById]);

  const uploadCountByCreatorId = React.useMemo(() => {
    const counts: Record<string, number> = {};
    videosWithProfilePhotos.forEach((video) => {
      counts[video.creatorId] = (counts[video.creatorId] || 0) + 1;
    });
    return counts;
  }, [videosWithProfilePhotos]);

  const creatorSuggestions: Sug[] = Array.from(
    new Map<string, Sug>(
      (Object.values(profilesById) as UserProfile[])
        .filter((item) => item.role === 'creator' && item.uid !== user?.uid)
        .map((item): [string, Sug] => {
          const uploadCount = uploadCountByCreatorId[item.uid] || 0;
          return [item.uid, {
            userId: item.uid,
            username: item.displayName,
            text: `${uploadCount} upload${uploadCount === 1 ? '' : 's'}`,
            initial: item.displayName.substring(0, 2).toUpperCase(),
            photoURL: item.photoURL || '',
            uploadCount
          }];
        })
    ).values()
  ).sort((a, b) => b.uploadCount - a.uploadCount || a.username.localeCompare(b.username)).slice(0, 5);
  const unreadActivityCount = activityEvents.filter((event) => !event.read).length;
  const hasUnreadActivity = unreadActivityCount > 0;

  useEffect(() => {
    if (!profile) return;
    if (!isCreator && activeDesktopNav === 'create') {
      setActiveDesktopNav('home');
    }
  }, [activeDesktopNav, isCreator, profile]);

  // Toast notifier
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handlePostFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isCreator) {
      showToast("Only creator accounts can upload videos.");
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPrefilledVideoUrl(url);
      setPrefilledVideoName(file.name);
      setPrefilledVideoFile(file);
      setIsUploadOpen(true);
      showToast("Video selected.");
    }
    e.target.value = '';
  };

  const handleProfilePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !auth.currentUser) return;

    setIsProfilePhotoUploading(true);
    try {
      const photoURL = await fileToProfilePhotoDataUrl(file);
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, { photoURL });
      setProfile((prev: any) => ({ ...prev, photoURL }));
      showToast('Profile picture updated.');
    } catch (error: any) {
      console.error('Error updating profile picture:', error);
      showToast(error.message || 'Could not update profile picture.');
    } finally {
      setIsProfilePhotoUploading(false);
    }
  };

  const openCreatorGallery = () => {
    if (!isCreator) {
      showToast("Only creator accounts can upload videos.");
      return;
    }
    setPrefilledVideoUrl('');
    setPrefilledVideoName('');
    setPrefilledVideoFile(null);
    setIsUploadOpen(true);
  };

  // 1. Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setEditDisplayName(currentUser.displayName || '');
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setProfile(userSnap.data());
          } else {
            await signOut(auth);
            setProfile(null);
            setAuthError('Please create an account before signing in.');
          }
        } catch (error) {
          console.error("Error setting user profile document:", error);
          await signOut(auth);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Active Video Feed & Stories from local db
  useEffect(() => {
    const vQuery = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    const unsubscribeVideos = onSnapshot(vQuery, (snapshot) => {
      const fetched: Video[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...docSnap.data() } as Video);
      });
      setVideos(fetched);
      setVideosLoading(false);
    }, (error) => {
      console.error("Error fetching videos snap:", error);
      setVideosLoading(false);
    });

    return () => {
      unsubscribeVideos();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfilesById({});
      return;
    }

    const usersQuery = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const next: Record<string, UserProfile> = {};
      snapshot.forEach((docSnap: any) => {
        const data = docSnap.data() as UserProfile;
        if (data?.uid) {
          next[data.uid] = data;
        }
      });
      setProfilesById(next);
    }, (error) => {
      console.error("Error fetching user profiles:", error);
    });

    return () => unsubscribeUsers();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const liveProfile = profilesById[user.uid];
    if (!liveProfile) return;

    setProfile((current: any) => {
      const currentString = JSON.stringify(current || {});
      const nextString = JSON.stringify(liveProfile);
      return currentString === nextString ? current : liveProfile;
    });
  }, [profilesById, user?.uid]);

  const videoIdsKey = videos.map((video) => video.id).join('|');

  useEffect(() => {
    if (!user || videos.length === 0) {
      setCommentCountsByVideoId({});
      return;
    }

    const unsubscribers = videos.map((video) => {
      const commentsRef = collection(db, 'videos', video.id, 'comments');
      return onSnapshot(query(commentsRef), (snapshot) => {
        setCommentCountsByVideoId((current) => (
          current[video.id] === snapshot.size
            ? current
            : { ...current, [video.id]: snapshot.size }
        ));
      }, (error) => {
        console.error("Error fetching comment count:", error);
      });
    });

    setCommentCountsByVideoId((current) => {
      const videoIds = new Set(videos.map((video) => video.id));
      const next = Object.fromEntries(Object.entries(current).filter(([id]) => videoIds.has(id)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user?.uid, videoIdsKey]);

  useEffect(() => {
    if (!user) {
      setActivityEvents([]);
      return;
    }

    const activityQuery = query(collection(db, 'activities'), orderBy('createdAt', 'desc'));
    const unsubscribeActivities = onSnapshot(activityQuery, (snapshot) => {
      const list: ActivityEvent[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ActivityEvent);
      });
      list.sort((a, b) => getCreatedAtTime(b.createdAt) - getCreatedAtTime(a.createdAt));
      setActivityEvents((current) => {
        const hasSameData = current.length === list.length && current.every((event, index) => {
          const next = list[index];
          return event.id === next.id &&
            event.type === next.type &&
            event.text === next.text &&
            event.actorName === next.actorName &&
            event.videoId === next.videoId &&
            event.commentId === next.commentId &&
            event.thumbnailUrl === next.thumbnailUrl &&
            Boolean(event.read) === Boolean(next.read) &&
            getCreatedAtTime(event.createdAt) === getCreatedAtTime(next.createdAt);
        });

        return hasSameData ? current : list;
      });
    }, (error) => {
      console.error("Error fetching activities:", error);
      setActivityEvents([]);
    });

    return () => unsubscribeActivities();
  }, [user?.uid]);

  const getCreatedAtTime = (createdAt: any) => {
    if (typeof createdAt?.toMillis === 'function') return createdAt.toMillis();
    if (typeof createdAt?.seconds === 'number') return createdAt.seconds * 1000;
    if (createdAt instanceof Date) return createdAt.getTime();
    if (typeof createdAt === 'string') return Date.parse(createdAt) || 0;
    return 0;
  };

  const refreshVideoFeed = async () => {
    try {
      const vQuery = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(vQuery);
      const fetched: Video[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...docSnap.data() } as Video);
      });
      fetched.sort((a, b) => getCreatedAtTime(b.createdAt) - getCreatedAtTime(a.createdAt));
      setVideos(fetched);
      setVideosLoading(false);
    } catch (error) {
      console.error("Error refreshing videos:", error);
      setVideosLoading(false);
      throw error;
    }
  };

  const markUnreadActivitiesRead = async () => {
    const unreadActivities = activityEvents.filter((event) => !event.read);
    if (unreadActivities.length === 0) return;

    const unreadIds = new Set(unreadActivities.map((event) => event.id));
    setActivityEvents((current) => current.map((event) => (
      unreadIds.has(event.id) ? { ...event, read: true } : event
    )));

    await Promise.all(unreadActivities.map(async (event) => {
      try {
        await updateDoc(doc(db, 'activities', event.id), { read: true });
      } catch (error) {
        console.error("Error marking activity read:", error);
      }
    }));
  };

  const openActivityPanel = () => {
    setIsActivityOpen(true);
    setActiveDesktopNav('notifications');
    void markUnreadActivitiesRead();
  };

  // Sign out / authentication processes
  const handleSignOut = () => {
    setIsLogoutConfirmOpen(true);
  };

  const confirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut(auth);
      setIsLogoutConfirmOpen(false);
      showToast("Logged out successfully");
    } catch (err) {
      console.error(err);
      showToast("Could not log out. Try again.");
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
      showToast("Welcome back to KehindeCW2 Project!");
    } catch (err: any) {
      setAuthError(err.message || 'Incorrect security password or user email.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    try {
      const formattedName = authName.trim() || 'KehindeCW2 User';
      const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword, {
        displayName: formattedName,
        role: authRole
      });
      const newProfile = {
        uid: userCredential.user.uid,
        displayName: formattedName,
        email: authEmail,
        role: authRole,
        photoURL: '',
        bio: authRole === 'creator' ? 'Creator account' : 'Consumer account'
      };
      setProfile(newProfile);
      showToast(authRole === 'creator' ? "Creator profile ready." : "Consumer profile ready.");
    } catch (err: any) {
      setAuthError(err.message || 'Failed to create profile. Email might be taken.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleUpdateDisplayName = async () => {
    if (!editDisplayName.trim()) return;
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: editDisplayName.trim() });
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          displayName: editDisplayName.trim()
        });
        setProfile((prev: any) => ({ ...prev, displayName: editDisplayName.trim() }));
        setIsEditingName(false);
        showToast("Profile name updated successfully!");
      }
    } catch (error) {
      console.error("Error updating display name:", error);
      showToast("Failed to update profile name.");
    }
  };

  // Shuffled "For You" feeds
  const getForYouVideos = () => {
    return [...videosWithProfilePhotos].sort((a, b) => {
      // Deterministic pseudo-random sorting based on id characters to keep lists stable per watch session
      const codeA = a.id.charCodeAt(0) || 0;
      const codeB = b.id.charCodeAt(0) || 0;
      return (codeA % 7) - (codeB % 7);
    });
  };

  const getLatestVideos = () => {
    return [...videosWithProfilePhotos].sort((a, b) => getCreatedAtTime(b.createdAt) - getCreatedAtTime(a.createdAt));
  };

  const getSearchVideos = () => {
    const queryText = searchTerm.trim().toLowerCase();
    return getLatestVideos().filter((video) => {
      const matchesGenre = searchGenre === 'All' || video.genre === searchGenre;
      if (!matchesGenre) return false;
      if (!queryText) return true;

      return [
        video.title,
        video.creatorName,
        video.genre,
        video.publisher,
        video.producer,
        video.ageRating
      ].some((field) => field?.toLowerCase().includes(queryText));
    });
  };

  const openVideoPost = (video: Video) => {
    const freshVideo = videosWithProfilePhotos.find((item) => item.id === video.id) || video;
    setSelectedPostVideo(freshVideo);
  };

  const handleDeleteVideo = async (video: Video) => {
    if (!isCreator || video.creatorId !== user?.uid) {
      showToast("You can only delete your own uploads.");
      return;
    }

    const shouldDelete = window.confirm(`Delete "${video.title}"?`);
    if (!shouldDelete) return;

    try {
      await deleteDoc(doc(db, 'videos', video.id));
      if (selectedPostVideo?.id === video.id) {
        setSelectedPostVideo(null);
      }
      showToast("Video deleted.");
    } catch (error) {
      console.error("Error deleting video:", error);
      handleAzureError(error, OperationType.DELETE, `videos/${video.id}`);
      showToast("Could not delete video.");
    }
  };

  // Filtered "Following" feeds
  const getFollowingVideos = () => {
    return videosWithProfilePhotos.filter(v => followingSet.has(v.creatorId));
  };

  const getFilteredVideos = () => {
    if (feedTab === 'following') {
      return getFollowingVideos();
    }
    if (feedTab === 'latest') {
      const queryText = searchTerm.trim().toLowerCase();
      const latest = getLatestVideos();
      if (!queryText) return latest;
      return latest.filter((video) => [
        video.title,
        video.creatorName,
        video.genre,
        video.publisher,
        video.producer,
        video.ageRating
      ].some((field) => field?.toLowerCase().includes(queryText)));
    }
    return getForYouVideos();
  };

  // Follow/Unfollow creator handler
  const toggleFollowCreator = async (creatorId: string, creatorName: string) => {
    if (!user?.uid || !creatorId) {
      showToast('Creator account not found.');
      return;
    }
    if (creatorId === user.uid) {
      showToast('This is your account.');
      return;
    }

    const nextFollowingIds = followingSet.has(creatorId)
      ? currentFollowingIds.filter((id) => id !== creatorId)
      : [...currentFollowingIds, creatorId];

    setProfile((current: any) => ({ ...current, followingIds: nextFollowingIds }));
    try {
      await updateDoc(doc(db, 'users', user.uid), { followingIds: nextFollowingIds });
      showToast(followingSet.has(creatorId) ? `Unfollowed @${creatorName}` : `Now following @${creatorName}`);
    } catch (error) {
      console.error("Error updating follow state:", error);
      setProfile((current: any) => ({ ...current, followingIds: currentFollowingIds }));
      showToast('Could not update follow state.');
    }
  };

  // Profile Suggestion Item component inside App scope to trigger profiles
  interface ProfileSuggestionItemProps {
    sug: Sug;
    key?: any;
  }

  function ProfileSuggestionItem({ sug }: ProfileSuggestionItemProps) {
    const isFollowing = followingSet.has(sug.userId);
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 text-xs">
        <button
          type="button"
          onClick={() => {
            setSelectedCreatorName(sug.username);
            setViewMode('creator_profile');
          }}
          className="flex min-w-0 items-center gap-3 text-left transition hover:opacity-90"
        >
          <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-tr from-yellow-400 via-fuchsia-500 to-purple-600 p-[2px]">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-black bg-zinc-950 text-[10px] font-black text-white">
              {sug.photoURL ? (
                <img src={sug.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                sug.initial
              )}
            </div>
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight text-white transition hover:text-zinc-300">{sug.username}</p>
            <p className="text-[10px] text-zinc-500">{sug.text}</p>
          </div>
        </button>
        <button 
          onClick={() => toggleFollowCreator(sug.userId, sug.username)}
          className={`shrink-0 text-xs font-bold transition ${
            isFollowing 
              ? 'text-zinc-500 hover:text-white' 
              : 'text-sky-500 hover:text-sky-300'
          }`}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      </div>
    );
  }

  function SearchPage() {
    const searchResults = getSearchVideos();
    const genreOptions = ['All', ...GENRES];

    return (
      <section className="w-full max-w-[920px] text-white" id="search-page">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Search</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">Uploaded videos</h2>
        </div>

        <div className="sticky top-0 z-20 -mx-1 mb-5 bg-black/90 px-1 py-3 backdrop-blur-md md:top-0">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
            <Search size={18} className="shrink-0 text-zinc-500" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by caption, creator, genre, producer, publisher..."
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-zinc-600"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="rounded-full p-1 text-zinc-500 transition hover:bg-zinc-900 hover:text-white"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {genreOptions.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => setSearchGenre(genre)}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${
                  searchGenre === genre
                    ? 'border-white bg-white text-black'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600 hover:text-white'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between text-xs font-bold text-zinc-500">
          <span>{searchResults.length} result{searchResults.length === 1 ? '' : 's'}</span>
          <span>{searchGenre === 'All' ? 'All genres' : searchGenre}</span>
        </div>

        {searchResults.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 text-center">
            <Search size={28} className="mb-3 text-zinc-600" />
            <h3 className="text-lg font-black">No videos found</h3>
            <p className="mt-1 text-sm text-zinc-500">Try another caption, creator, genre, producer, or age rating.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {searchResults.map((video) => {
              const isOwnUpload = isCreator && video.creatorId === user?.uid;
              return (
                <article key={video.id} className="overflow-hidden rounded-xl border border-zinc-900 bg-[#080a0d] transition hover:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => openVideoPost(video)}
                    className="group block w-full text-left"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-zinc-950">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105 group-hover:opacity-80"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition group-hover:opacity-100">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-2xl">
                          <PlayCircle size={26} />
                        </span>
                      </div>
                      <span className="absolute left-3 top-3 rounded bg-white px-2 py-0.5 text-[10px] font-black text-black">
                        {video.ageRating}
                      </span>
                    </div>

                    <div className="space-y-3 p-4">
                      <div>
                        <h3 className="line-clamp-2 text-sm font-black text-white">{video.title}</h3>
                        <p className="mt-1 truncate text-xs font-bold text-zinc-500">@{video.creatorName}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-zinc-500">Genre</p>
                          <p className="mt-1 truncate font-bold text-zinc-100">{video.genre}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Producer</p>
                          <p className="mt-1 truncate font-bold text-zinc-100">{video.producer}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-zinc-900 pt-3 text-xs font-bold text-zinc-500">
                        <span>{(video.viewCount || 0).toLocaleString()} views</span>
                        <span>
                          {video.averageRating ? video.averageRating.toFixed(1) : '0.0'} rating
                          {' '}({Object.keys(video.ratings || {}).length})
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 border-t border-zinc-900 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCreatorName(video.creatorName);
                        setViewMode('creator_profile');
                      }}
                      className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-black text-zinc-100 transition hover:bg-zinc-800"
                    >
                      Creator
                    </button>
                    {isOwnUpload && (
                      <button
                        type="button"
                        onClick={() => handleDeleteVideo(video)}
                        className="rounded-lg bg-red-950/40 px-3 py-2 text-red-300 transition hover:bg-red-950"
                        aria-label={`Delete ${video.title}`}
                        title="Delete video"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  function renderActivityPanel() {
    type ActivityRowType = Exclude<ActivityFilter, 'all' | 'following'>;
    type ActivityRow = {
      id: string;
      type: ActivityRowType;
      user: string;
      text: string;
      date: string;
      avatar: string;
      thumb?: string;
      video?: Video;
      timestamp: number;
      isFollowing?: boolean;
      photoURL?: string;
    };
    const filterOptions: Array<{ key: ActivityFilter; label: string }> = [
      { key: 'all', label: 'All' },
      { key: 'following', label: 'People you follow' },
      { key: 'comments', label: 'Comments' },
      { key: 'likes', label: 'Likes' },
      { key: 'ratings', label: 'Ratings' },
      { key: 'uploads', label: 'Uploads' },
      { key: 'follows', label: 'Follows' }
    ];

    const formatActivityDate = (createdAt: any) => {
      const timestamp = getCreatedAtTime(createdAt) || Date.now();
      const diffMs = Date.now() - timestamp;
      const minutes = Math.max(1, Math.floor(diffMs / 60000));
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d`;
      return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const activityTypeMap: Record<ActivityEventType, ActivityRowType | null> = {
      upload: 'uploads',
      comment: 'comments',
      like: 'likes',
      rating: 'ratings',
      follow: 'follows',
      delete: null
    };

    const activityRows: ActivityRow[] = activityEvents.flatMap((event) => {
      const rowType = activityTypeMap[event.type];
      if (!rowType) return [];

      const video = event.videoId ? videosWithProfilePhotos.find((item) => item.id === event.videoId) : undefined;
      const actorProfile = profilesById[event.actorId];
      const actorName = event.actorName || actorProfile?.displayName || 'Unknown user';
      return [{
        id: event.id,
        type: rowType,
        user: actorName,
        text: event.text,
        date: formatActivityDate(event.createdAt),
        avatar: actorName.substring(0, 2).toUpperCase(),
        photoURL: profilePhotoByUserId[event.actorId] || '',
        thumb: event.thumbnailUrl || video?.thumbnailUrl,
        video,
        timestamp: getCreatedAtTime(event.createdAt),
        isFollowing: followingSet.has(event.actorId)
      }];
    }).sort((a, b) => b.timestamp - a.timestamp);

    const filteredRows = activityFilter === 'all'
      ? activityRows
      : activityFilter === 'following'
        ? activityRows.filter((row) => row.isFollowing)
        : activityRows.filter((row) => row.type === activityFilter);

    const rowsThisMonth = filteredRows.slice(0, 12);
    const rowsEarlier = filteredRows.slice(12);

    const renderRow = (row: ActivityRow) => (
      <div key={row.id} className="flex items-center gap-3 py-3">
        <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-tr from-yellow-400 via-fuchsia-500 to-purple-600 p-[2px]">
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-zinc-950 text-[10px] font-black text-white">
            {row.photoURL ? (
              <img src={row.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              row.avatar
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1 text-sm leading-snug">
          <span className="font-extrabold text-white">{row.user}</span>{' '}
          <span className="font-semibold text-zinc-200">{row.text}</span>{' '}
          <span className="font-semibold text-zinc-500">{row.date}</span>
        </div>
        {row.thumb && (
          <button type="button" onClick={() => row.video && openVideoPost(row.video)} className="shrink-0">
            <img
              src={row.thumb}
              alt=""
              className="h-12 w-12 rounded-lg object-cover"
              referrerPolicy="no-referrer"
            />
          </button>
        )}
      </div>
    );

    return (
      <AnimatePresence>
        {isActivityOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsActivityOpen(false)}
              className="fixed inset-0 z-[55] bg-black/35 lg:hidden"
            />
            <motion.aside
              initial={{ x: -28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -28, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="fixed bottom-0 left-0 top-0 z-[60] flex w-full max-w-[500px] flex-col border-r border-zinc-900 bg-[#050505] px-8 py-8 text-white shadow-2xl md:left-[244px]"
            >
              <div className="mb-7 flex items-center justify-between">
                <h2 className="text-3xl font-black tracking-tight">Notifications</h2>
                <button
                  onClick={() => setIsActivityOpen(false)}
                  className="rounded-lg p-1 text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
                  aria-label="Close notifications"
                >
                  <X size={26} />
                </button>
              </div>

              <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {filterOptions.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setActivityFilter(option.key)}
                    className={`shrink-0 rounded-full border px-5 py-2 text-sm font-extrabold transition ${
                      activityFilter === option.key
                        ? 'border-zinc-800 bg-zinc-800 text-white'
                        : 'border-zinc-700 bg-transparent text-zinc-200 hover:border-zinc-500'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mb-5 border-b border-zinc-900 pb-5">
                <p className="text-base font-extrabold text-white">Live activity</p>
                <p className="mt-1 text-sm font-semibold text-zinc-500">
                  {activityRows.length} updates from uploads, comments, likes, ratings, and follows.
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <h3 className="mb-3 text-lg font-black">This month</h3>
                <div className="space-y-1">
                  {rowsThisMonth.length > 0 ? rowsThisMonth.map(renderRow) : (
                    <div className="py-10 text-center text-sm font-semibold text-zinc-500">No activity here yet.</div>
                  )}
                </div>

                {rowsEarlier.length > 0 && (
                  <>
                    <div className="my-4 border-t border-zinc-900" />
                    <h3 className="mb-3 text-lg font-black">Earlier</h3>
                    <div className="space-y-1">
                      {rowsEarlier.map(renderRow)}
                    </div>
                  </>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    );
  }

  const sidebarAvatarUrl = profile?.photoURL || user?.photoURL || '';

  const closeSidePanels = () => {
    setIsActivityOpen(false);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-150 flex flex-col font-sans" id="app-root">

      {/* Toast Notice */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-[#18181b] text-[#f4f4f5] border border-[#3f3f46] text-xs font-bold rounded-2xl shadow-2xl flex items-center gap-2.5 max-w-sm"
          >
            <CheckCircle2 size={16} className="text-[#d4d4d8]" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================== */}
      {/* 1. UNAUTHENTICATED: EMAIL AND PASSWORD LOGIN */}
      {/* ========================================== */}
      {!user && (
        <div className="flex-1 flex flex-col md:flex-row items-center justify-center min-h-screen bg-black relative p-6">
          {/* Ambient olive visual decorations */}
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[#3f3f46]/10 blur-3xl rounded-full" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#d4d4d8]/5 blur-3xl rounded-full" />

          <div className="relative w-full max-w-md bg-[#09090b] border border-[#27272a] p-8 md:p-10 rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.9)] text-center space-y-6">
            
            {/* Logo area */}
            <div className="flex flex-col items-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#3f3f46] to-[#d4d4d8] flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                <Crown size={28} className="text-[#f4f4f5]" />
              </div>
              <h2 className="font-display font-black text-3xl tracking-tight text-white uppercase mt-2">
                KehindeCW2 Project
              </h2>
            </div>

            {authError && (
              <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-400 text-[11px] font-semibold rounded-xl flex items-start gap-2 text-left">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <motion.div
              key={authMode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 text-left"
            >
              <form onSubmit={authMode === 'signin' ? handleSignIn : handleSignUp} className="space-y-3.5">
                {authMode === 'signup' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#f4f4f5] uppercase tracking-wider font-mono">Display Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Your handle"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-black border border-[#3f3f46] rounded-xl focus:border-[#d4d4d8] focus:outline-none text-xs text-white placeholder-zinc-700 transition"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-[#f4f4f5] uppercase tracking-wider font-mono">Account Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'consumer' as const, label: 'Consumer', note: 'Watch only', icon: User },
                          { value: 'creator' as const, label: 'Creator', note: 'Upload videos', icon: Crown }
                        ].map((option) => {
                          const Icon = option.icon;
                          const active = authRole === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setAuthRole(option.value)}
                              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                                active
                                  ? 'border-[#f4f4f5] bg-[#18181b] text-white'
                                  : 'border-[#3f3f46] bg-black text-zinc-400 hover:text-white'
                              }`}
                            >
                              <Icon size={16} strokeWidth={1.8} />
                              <span className="min-w-0">
                                <span className="block text-xs font-black">{option.label}</span>
                                <span className="block truncate text-[10px] font-semibold text-zinc-500">{option.note}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#f4f4f5] uppercase tracking-wider font-mono">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black border border-[#3f3f46] rounded-xl focus:border-[#d4d4d8] focus:outline-none text-xs text-white placeholder-zinc-700 transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#f4f4f5] uppercase tracking-wider font-mono">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black border border-[#3f3f46] rounded-xl focus:border-[#d4d4d8] focus:outline-none text-xs text-white placeholder-zinc-700 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full py-3 bg-[#3f3f46] hover:bg-[#52525b] text-white font-black uppercase tracking-wider rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                  id="btn-auth-submit"
                >
                  {isAuthLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={14} className="text-white" />
                      {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                    </>
                  )}
                </button>
              </form>
            </motion.div>

            {/* Footer Switching modes */}
            <div className="border-t border-[#27272a] pt-4 mt-4 text-center text-xs text-zinc-400">
              {authMode === 'signin' ? (
                <>
                  New to KehindeCW2 Project?{' '}
                  <button 
                    onClick={() => {
                      setAuthMode('signup');
                      setAuthError('');
                    }} 
                    className="text-[#f4f4f5] hover:underline font-bold"
                  >
                    Create profile
                  </button>
                </>
              ) : (
                <>
                  Already registered?{' '}
                  <button 
                    onClick={() => {
                      setAuthMode('signin');
                      setAuthError('');
                    }} 
                    className="text-[#f4f4f5] hover:underline font-bold"
                  >
                    Log in
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. AUTHENTICATED CORE LAYOUT */}
      {/* ========================================== */}
      {user && (
        <div className="flex-1 flex flex-col md:flex-row min-h-screen bg-black">
          {renderActivityPanel()}
          
          {/* ========================================== */}
          {/* DESKTOP SIDEBAR (LEFT) */}
          {/* ========================================== */}
          <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-zinc-900 bg-[#080a0d] px-5 py-7 md:flex">
            <nav className="mt-24 space-y-2" aria-label="Primary">
              {[
                {
                  key: 'home',
                  label: 'Home',
                  icon: Home,
                  active: viewMode === 'home' && activeDesktopNav === 'home' && !isActivityOpen,
                  onClick: () => {
                    closeSidePanels();
                    setActiveDesktopNav('home');
                    setViewMode('home');
                    setFeedTab('for_you');
                  }
                },
                {
                  key: 'search',
                  label: 'Search',
                  icon: Search,
                  active: viewMode === 'home' && activeDesktopNav === 'search' && !isActivityOpen,
                  onClick: () => {
                    closeSidePanels();
                    setActiveDesktopNav('search');
                    setViewMode('home');
                    setFeedTab('latest');
                  }
                },
                {
                  key: 'notifications',
                  label: 'Notifications',
                  icon: Heart,
                  dot: hasUnreadActivity,
                  active: isActivityOpen,
                  onClick: openActivityPanel
                },
                ...(isCreator ? [{
                  key: 'create',
                  label: 'Create',
                  icon: Plus,
                  active: activeDesktopNav === 'create' && !isActivityOpen,
                  onClick: () => {
                    closeSidePanels();
                    setActiveDesktopNav('create');
                    openCreatorGallery();
                  }
                }] : []),
                {
                  key: 'profile',
                  label: 'Profile',
                  icon: User,
                  active: viewMode === 'profile' && !isActivityOpen,
                  onClick: () => {
                    closeSidePanels();
                    setActiveDesktopNav('profile');
                    setViewMode('profile');
                  },
                  avatar: true
                }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.onClick}
                    className={`group flex h-14 w-full items-center gap-4 rounded-xl px-4 text-left text-white transition ${
                      item.active ? 'bg-[#22262b]' : 'hover:bg-[#13161a]'
                    }`}
                    aria-label={item.label}
                    title={item.label}
                  >
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                      {item.avatar ? (
                        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-950 text-[10px] font-black text-white">
                          {sidebarAvatarUrl ? (
                            <img src={sidebarAvatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            profile?.displayName?.charAt(0).toUpperCase() || 'U'
                          )}
                        </span>
                      ) : (
                        <Icon
                          size={item.key === 'create' ? 34 : 29}
                          strokeWidth={item.active ? 2.3 : 1.95}
                          className={item.key === 'home' && item.active ? 'fill-current' : ''}
                        />
                      )}
                      {item.dot && (
                        <span className="absolute right-0 top-1 h-3.5 w-3.5 rounded-full bg-white ring-2 ring-[#080b0f]" />
                      )}
                    </span>
                    <span className={`text-[20px] leading-none tracking-normal ${item.active ? 'font-bold' : 'font-semibold'}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={handleSignOut}
              className="mt-auto flex h-12 w-full items-center gap-4 rounded-xl px-4 text-left text-zinc-400 transition hover:bg-[#13161a] hover:text-white"
              title="Log out"
            >
              <span className="flex h-10 w-10 items-center justify-center">
                <LogOut size={24} strokeWidth={1.9} />
              </span>
              <span className="text-[18px] font-semibold leading-none">Logout</span>
            </button>
          </aside>

          {/* ========================================== */}
          {/* MOBILE HEADER (TOP) */}
          {/* ========================================== */}
          <header className="md:hidden sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-zinc-900 px-4 py-3 flex items-center justify-between">
            {viewMode === 'profile' || viewMode === 'creator_profile' ? (
              <div className="flex items-center gap-2 min-w-0">
                {viewMode === 'creator_profile' && (
                  <button onClick={() => setViewMode('home')} className="text-zinc-200">
                    <ArrowLeft size={20} />
                  </button>
                )}
                <h1 className="truncate text-lg font-bold text-white">
                  {viewMode === 'creator_profile' ? selectedCreatorName : currentUsername}
                </h1>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#3f3f46] flex items-center justify-center">
                  <Crown size={14} className="text-[#f4f4f5]" />
                </div>
                <h1 className="font-display font-black text-lg tracking-tighter uppercase text-white">
                  KehindeCW2
                </h1>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={openActivityPanel}
                className="relative rounded-full p-1.5 text-zinc-300 transition hover:text-white"
                title="Notifications"
                aria-label={hasUnreadActivity ? `${unreadActivityCount} unread notifications` : 'Notifications'}
              >
                <Heart size={19} />
                {hasUnreadActivity && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-white ring-2 ring-black" />
                )}
              </button>
              <button 
                onClick={() => setViewMode('profile')}
                className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-zinc-800 bg-zinc-900 text-[10px] font-black text-white"
              >
                {sidebarAvatarUrl ? (
                  <img src={sidebarAvatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  profile?.displayName?.charAt(0).toUpperCase() || 'U'
                )}
              </button>
              <button
                onClick={handleSignOut}
                className="rounded-full p-1.5 text-zinc-400 transition hover:text-white"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </header>

          {/* ========================================== */}
          {/* MAIN CONTAINER */}
          {/* ========================================== */}
          <main className="flex-1 flex flex-col overflow-x-hidden pb-16 md:flex-row md:pb-0">

            {/* LEFT / CENTER CORE WORKSPACE */}
            <div className="flex w-full flex-1 flex-col px-4 py-5 md:px-10 lg:items-end lg:pr-12">
              
              {/* ========================================== */}
              {/* VIEW: HOME FEED (STORIES & VIDEO STREAMS) */}
              {/* ========================================== */}
              {viewMode === 'home' && (
                <div className={`flex w-full flex-col gap-6 ${feedTab === 'latest' ? 'max-w-[920px]' : 'max-w-[660px]'}`} id="home-view-container">

                  {feedTab === 'latest' ? (
                    <SearchPage />
                  ) : (
                    <div className="min-h-[55vh] w-full">
                      {videosLoading ? (
                      <div className="flex min-h-[46vh] flex-col items-center justify-center space-y-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-white" />
                        <span className="text-xs font-semibold text-zinc-500">Loading posts...</span>
                      </div>
                      ) : (
                        <InstagramFeedList
                          videos={getFilteredVideos()}
                          onRefresh={refreshVideoFeed}
                          profilePhotoByUserId={profilePhotoByUserId}
                          onSelectCreator={(creatorName) => {
                            setSelectedCreatorName(creatorName);
                            setSelectedVideoIndex(0);
                            setViewMode('creator_profile');
                          }}
                          onSelectReel={(video) => {
                            const targetIdx = getFilteredVideos().findIndex((item) => item.id === video.id);
                            if (targetIdx !== -1) setSelectedVideoIndex(targetIdx);
                          }}
                          onShowToast={showToast}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ========================================== */}
              {/* VIEW: CREATOR ONLY VIDEOS FEED (HIDDEN VIEW) */}
              {/* ========================================== */}
              {viewMode === 'creator_feed' && (
                <div className="space-y-6 flex flex-col h-full" id="creator-feed-container">
                  {/* Header with Back button and Follow toggle */}
                  <div className="flex items-center justify-between bg-zinc-950/60 border border-zinc-900/60 p-4 rounded-3xl">
                    <button
                      onClick={() => {
                        setViewMode('home');
                        setSelectedVideoIndex(0);
                      }}
                      className="flex items-center gap-1.5 text-xs text-[#f4f4f5] hover:text-white transition font-black uppercase font-mono"
                    >
                      ← Back to Explore
                    </button>
                    
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setViewMode('creator_profile')}
                        className="text-[10px] text-zinc-400 hover:text-white font-black uppercase tracking-wider bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800 transition"
                      >
                        View Profile
	                      </button>
	                      <button
	                        onClick={() => toggleFollowCreator(selectedCreatorId, selectedCreatorName)}
	                        className={`text-[10px] px-3 py-1.5 rounded-xl font-black uppercase tracking-wider transition ${
	                          selectedCreatorId && followingSet.has(selectedCreatorId)
	                            ? 'bg-zinc-900 border border-zinc-800 text-zinc-500'
	                            : 'bg-[#3f3f46] text-[#f4f4f5] border border-[#3f3f46]'
	                        }`}
	                      >
	                        {selectedCreatorId && followingSet.has(selectedCreatorId) ? 'Following' : 'Follow'}
	                      </button>
                    </div>
                  </div>

                  {/* Filtered vertical scrolling feed */}
                  <div className="flex-1 flex items-center justify-center min-h-[55vh]">
                    <Feed
                      videos={videosWithProfilePhotos.filter(v => v.creatorName === selectedCreatorName)}
                      initialIndex={0}
                      onRefresh={refreshVideoFeed}
                      profilePhotoByUserId={profilePhotoByUserId}
                      onSelectCreator={(creator) => {
                        setSelectedCreatorName(creator);
                        setSelectedVideoIndex(0);
                      }}
                      onShowToast={showToast}
                    />
                  </div>
                </div>
              )}

              {viewMode === 'creator_profile' && (
                <ProfileScreen
                  username={selectedCreatorName}
                  displayName={selectedCreatorName}
	                  role="creator"
	                  photoURL={selectedCreatorPhotoURL}
	                  videos={videosWithProfilePhotos.filter(v => v.creatorName === selectedCreatorName)}
	                  followingCount={selectedCreatorProfile?.followingIds?.length || 0}
	                  followersLabel={(selectedCreatorId ? followerCountByUserId[selectedCreatorId] || 0 : 0).toLocaleString()}
	                  isFollowing={Boolean(selectedCreatorId && followingSet.has(selectedCreatorId))}
	                  onBack={() => setViewMode('home')}
	                  onFollow={() => toggleFollowCreator(selectedCreatorId, selectedCreatorName)}
                  onSelectVideo={(video) => {
                    const filteredIndex = getForYouVideos().findIndex(v => v.id === video.id);
                    if (filteredIndex !== -1) setSelectedVideoIndex(filteredIndex);
                    setFeedTab('for_you');
                    setViewMode('home');
                  }}
                />
              )}

              {viewMode === 'profile' && (
                <ProfileScreen
                  username={currentUsername}
                  displayName={profile?.displayName || user?.displayName || 'KehindeCW2 User'}
                  email={profile?.email || user?.email}
                  role={profileRole}
                  photoURL={profile?.photoURL || user?.photoURL || ''}
                  videos={isCreator ? videosWithProfilePhotos.filter((video) => (
                    video.creatorId === user?.uid ||
                    video.creatorName === currentUsername ||
                    video.creatorName === profile?.displayName
                  )) : []}
	                  followingCount={currentFollowingIds.length}
	                  followersLabel={(user?.uid ? followerCountByUserId[user.uid] || 0 : 0).toLocaleString()}
                  isOwnProfile
                  isUploadingProfilePhoto={isProfilePhotoUploading}
                  isEditingName={isEditingName}
                  editDisplayName={editDisplayName}
                  onEditDisplayNameChange={setEditDisplayName}
                  onSaveDisplayName={handleUpdateDisplayName}
                  onCancelEdit={() => setIsEditingName(false)}
                  onStartEdit={() => setIsEditingName(true)}
                  onUploadProfilePhoto={() => profilePhotoInputRef.current?.click()}
                  onOpenUpload={openCreatorGallery}
                  onDeleteVideo={handleDeleteVideo}
                  onSelectVideo={(video) => {
                    const targetIdx = getForYouVideos().findIndex(v => v.id === video.id);
                    if (targetIdx !== -1) setSelectedVideoIndex(targetIdx);
                    setFeedTab('for_you');
                    setViewMode('home');
                  }}
                />
              )}

            </div>

            {/* ========================================== */}
            {/* DESKTOP SUGGESTIONS COLUMN (RIGHT) */}
            {/* ========================================== */}
            {viewMode === 'home' && (
              <>
                <aside className="fixed bottom-0 right-0 top-0 z-20 hidden w-[360px] bg-black px-8 py-14 lg:block">
                  <div className="mb-9 flex items-center justify-between">
                    <button
                      onClick={() => setViewMode('profile')}
                      className="flex min-w-0 items-center gap-3 text-left"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-xs font-black text-white">
                        {sidebarAvatarUrl ? (
                          <img src={sidebarAvatarUrl} alt="" className="h-full w-full rounded-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          profile?.displayName?.charAt(0).toUpperCase() || 'U'
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-white">{currentUsername}</span>
                        <span className="block truncate text-xs text-zinc-500">{profile?.displayName || user?.email}</span>
                      </span>
                    </button>
                    <span className="text-xs font-bold text-zinc-600">
                      {isCreator ? 'Creator' : 'Consumer'}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-zinc-300">Suggested for you</span>
                      <button
                        onClick={() => showToast('Showing your best creator suggestions.')}
                        className="text-xs font-bold text-white transition hover:text-zinc-300"
                      >
                        See all
                      </button>
                    </div>

                    <div className="space-y-3">
                      {creatorSuggestions.length > 0 ? creatorSuggestions.map((sug, i) => (
                        <ProfileSuggestionItem key={i} sug={sug} />
                      )) : (
                        <p className="py-3 text-sm font-semibold text-zinc-600">
                          Uploads from other creators will appear here.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-10 text-[11px] font-semibold leading-relaxed text-zinc-600">
                    <div className="flex flex-wrap gap-x-1.5 gap-y-1">
                      {['About', 'Help', 'Press', 'API', 'Jobs', 'Privacy', 'Terms', 'Locations', 'Language', 'Meta Verified'].map(link => (
                        <button
                          key={link}
                          onClick={() => showToast(`${link} page is not available in this local build.`)}
                          className="hover:underline"
                        >
                          {link}
                        </button>
                      ))}
                    </div>
                    <p className="mt-7 text-[11px] font-bold uppercase tracking-wide text-zinc-600">
                      © 2026 KEHINDECW2 PROJECT
                    </p>
                  </div>
                </aside>
                <div
                  aria-hidden="true"
                  className="hidden w-[360px] shrink-0 lg:block"
                />
              </>
            )}

          </main>

          {/* ========================================== */}
          {/* MOBILE BOTTOM NAVIGATION BAR */}
          {/* ========================================== */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-md border-t border-zinc-900 px-5 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] flex items-center justify-between">
            <button
              onClick={() => {
                setViewMode('home');
                setFeedTab('for_you');
                setIsActivityOpen(false);
              }}
              className={`flex flex-col items-center gap-1 transition ${
                viewMode === 'home' && feedTab === 'for_you' && !isActivityOpen ? 'text-white' : 'text-zinc-500'
              }`}
            >
              <Home size={18} />
              <span className="text-[9px] font-bold">Home</span>
            </button>

            <button
              onClick={() => {
                setViewMode('home');
                setFeedTab('latest');
                setIsActivityOpen(false);
              }}
              className={`flex flex-col items-center gap-1 transition ${
                viewMode === 'home' && feedTab === 'latest' && !isActivityOpen ? 'text-white' : 'text-zinc-500'
              }`}
            >
              <Search size={18} />
              <span className="text-[9px] font-bold">Search</span>
            </button>

            <button
              onClick={openActivityPanel}
              className={`flex flex-col items-center gap-1 transition ${
                isActivityOpen ? 'text-white' : 'text-zinc-500'
              }`}
              aria-label={hasUnreadActivity ? `${unreadActivityCount} unread notifications` : 'Activity'}
            >
              <span className="relative">
                <Heart size={18} />
                {hasUnreadActivity && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-white ring-2 ring-black" />
                )}
              </span>
              <span className="text-[9px] font-bold">Activity</span>
            </button>

            {isCreator && (
              <button
                onClick={() => {
                  setIsActivityOpen(false);
                  openCreatorGallery();
                }}
                className="flex flex-col items-center gap-1 text-zinc-500 transition hover:text-white"
              >
                <Plus size={20} />
                <span className="text-[9px] font-bold">Create</span>
              </button>
            )}

            <button
              onClick={() => {
                setIsActivityOpen(false);
                setViewMode('profile');
              }}
              className={`flex flex-col items-center gap-1 transition ${
                viewMode === 'profile' && !isActivityOpen ? 'text-white' : 'text-zinc-500'
              }`}
            >
              {sidebarAvatarUrl ? (
                <span className="h-[18px] w-[18px] overflow-hidden rounded-full border border-zinc-700">
                  <img src={sidebarAvatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                </span>
              ) : (
                <User size={18} />
              )}
              <span className="text-[9px] font-bold">Profile</span>
            </button>
          </nav>

          {isCreator && (
            <button
              onClick={openCreatorGallery}
              className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-5 md:bottom-7 md:right-7 z-40 h-14 w-14 rounded-full bg-white text-black shadow-[0_0_32px_rgba(176,196,158,0.35)] flex items-center justify-center transition hover:scale-105 active:scale-95"
              title="New video"
            >
              <Plus size={30} strokeWidth={2.4} />
            </button>
          )}

        </div>
      )}

      {/* Hidden Gallery File Inputs */}
      <input 
        type="file" 
        id="post-file-input" 
        accept="video/*" 
        className="hidden" 
        onChange={handlePostFileChange} 
      />

      <input
        ref={profilePhotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleProfilePhotoChange}
      />

      {/* Upload Stream Video Dialog */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setPrefilledVideoUrl('');
          setPrefilledVideoName('');
          setPrefilledVideoFile(null);
        }}
        onUploadSuccess={() => {
          showToast("Video posted.");
        }}
        prefilledVideoUrl={prefilledVideoUrl}
        prefilledFileName={prefilledVideoName}
        prefilledFile={prefilledVideoFile}
      />

      {selectedPostVideo && (
        <CommentsDrawer
          isOpen={Boolean(selectedPostVideo)}
          video={videosWithProfilePhotos.find((video) => video.id === selectedPostVideo.id) || selectedPostVideo}
          profilePhotoByUserId={profilePhotoByUserId}
          onClose={() => setSelectedPostVideo(null)}
          onCommentCountUpdate={refreshVideoFeed}
        />
      )}

      <AnimatePresence>
        {isLogoutConfirmOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 text-white backdrop-blur-sm">
            <motion.button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Cancel logout"
              onClick={() => setIsLogoutConfirmOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="logout-confirm-title"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="relative w-full max-w-[360px] overflow-hidden rounded-[4px] border border-zinc-800 bg-[#111318] shadow-2xl"
            >
              <div className="border-b border-zinc-800 px-5 py-4 text-center">
                <h2 id="logout-confirm-title" className="text-base font-extrabold">Log out?</h2>
                <p className="mt-1 text-sm font-medium text-zinc-400">You can sign back in anytime.</p>
              </div>

              <div className="grid grid-cols-2">
                <button
                  type="button"
                  onClick={() => setIsLogoutConfirmOpen(false)}
                  disabled={isSigningOut}
                  className="h-12 border-r border-zinc-800 text-sm font-bold text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-50"
                >
                  Stay
                </button>
                <button
                  type="button"
                  onClick={confirmSignOut}
                  disabled={isSigningOut}
                  className="h-12 text-sm font-extrabold text-red-400 transition hover:bg-red-950/30 disabled:opacity-50"
                >
                  {isSigningOut ? 'Logging out...' : 'Logout'}
                </button>
              </div>
            </motion.section>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
