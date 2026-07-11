import React, { useState } from 'react';
import { Search, SlidersHorizontal, Heart, Star, Sparkles, Film, HelpCircle, Flame, FilterX } from 'lucide-react';
import { Video, GENRES, AGE_RATINGS, AgeRating } from '../types';

interface DashboardGridProps {
  videos: Video[];
  onSelectVideo: (video: Video, index: number) => void;
}

export default function DashboardGrid({ videos, onSelectVideo }: DashboardGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedAgeRating, setSelectedAgeRating] = useState<AgeRating | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter video streams
  const filteredVideos = videos.filter((video) => {
    const matchesSearch =
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.creatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.producer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.publisher.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGenre = selectedGenre ? video.genre === selectedGenre : true;
    const matchesAge = selectedAgeRating ? video.ageRating === selectedAgeRating : true;

    return matchesSearch && matchesGenre && matchesAge;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedGenre(null);
    setSelectedAgeRating(null);
  };

  return (
    <div className="space-y-6" id="dashboard-container">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#f4f4f5]">Dashboard</p>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">Latest videos</h1>
      </div>

      {/* Search and Filters Header bar */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col gap-4 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              placeholder="Search by caption, creator, producer, or publisher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(255,255,255,0.2)] focus:outline-none text-sm transition placeholder-zinc-500 text-white"
              id="dashboard-search-input"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition flex items-center gap-2 ${
              showFilters || selectedGenre || selectedAgeRating
                ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            id="btn-toggle-filters"
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>
        </div>

        {/* Collapsible filters tray */}
        {(showFilters || selectedGenre || selectedAgeRating) && (
          <div className="pt-4 border-t border-zinc-800/60 space-y-4">
            {/* Genre Filter */}
            <div>
              <span className="text-xs font-bold text-zinc-500 block mb-2 uppercase tracking-widest font-mono">Filter by Genre</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedGenre(null)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition uppercase tracking-wider ${
                    selectedGenre === null
                      ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-[0_0_10px_rgba(255,255,255,0.25)]'
                      : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  All Genres
                </button>
                {GENRES.map((g) => (
                  <button
                    key={g}
                    onClick={() => setSelectedGenre(g)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition uppercase tracking-wider ${
                      selectedGenre === g
                        ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-[0_0_10px_rgba(255,255,255,0.25)]'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Age Rating filter & Clear */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div>
                <span className="text-xs font-bold text-zinc-500 block mb-2 uppercase tracking-widest font-mono">Age Suitability</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setSelectedAgeRating(null)}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition uppercase tracking-wider ${
                      selectedAgeRating === null
                        ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-[0_0_10px_rgba(255,255,255,0.25)]'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    All Ratings
                  </button>
                  {AGE_RATINGS.map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setSelectedAgeRating(rating)}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition uppercase tracking-wider ${
                        selectedAgeRating === rating
                          ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-[0_0_10px_rgba(255,255,255,0.25)]'
                          : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                      }`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>

              {(selectedGenre || selectedAgeRating || searchQuery) && (
                <button
                  onClick={clearFilters}
                  className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition self-end"
                >
                  <FilterX size={14} />
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Grid of Videos */}
      {filteredVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-zinc-800 rounded-3xl text-zinc-500 bg-zinc-900/10 text-center space-y-2">
          <HelpCircle size={36} className="opacity-40 animate-bounce text-cyan-400" />
          <p className="font-semibold text-sm text-zinc-300">No matching videos</p>
          <p className="text-xs text-zinc-500">Try adjusting your filters or typing different search terms.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" id="dashboard-videos-grid">
          {filteredVideos.map((video, index) => {
            // Find absolute index in the original array
            const originalIndex = videos.findIndex(v => v.id === video.id);
            return (
              <div
                key={video.id}
                onClick={() => onSelectVideo(video, originalIndex !== -1 ? originalIndex : index)}
                className="group bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden cursor-pointer hover:border-cyan-500 hover:shadow-[0_0_25px_rgba(255,255,255,0.15)] transition duration-300 flex flex-col text-white"
              >
                {/* Visual Thumbnail Frame */}
                <div className="relative aspect-video bg-zinc-950 overflow-hidden shrink-0">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Immersive Play Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center">
                    <span className="px-5 py-2.5 bg-gradient-to-tr from-cyan-400 to-fuchsia-600 text-white rounded-full font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,255,255,0.5)] flex items-center gap-1.5 scale-90 group-hover:scale-100 transition duration-300">
                      <Sparkles size={13} className="animate-spin text-cyan-300" />
                      Play Stream
                    </span>
                  </div>

                  {/* Genre Tag */}
                  <span className="absolute bottom-2 left-2 px-2.5 py-1 bg-zinc-950/80 backdrop-blur-md text-[9px] font-mono font-bold text-cyan-300 rounded tracking-widest uppercase border border-cyan-500/10">
                    {video.genre}
                  </span>

                  {/* Age Suitability Badge */}
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-zinc-950/80 backdrop-blur-md text-[9px] font-bold text-zinc-350 rounded border border-zinc-800">
                    {video.ageRating}
                  </span>
                </div>

                {/* Info Metadata */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm leading-tight text-white group-hover:text-cyan-400 transition truncate">
                      {video.title}
                    </h4>
                    <p className="text-xs text-zinc-400">@{video.creatorName}</p>
                    
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono pt-1">
                      <span>Prod: {video.producer}</span>
                      <span>•</span>
                      <span>Pub: {video.publisher}</span>
                    </div>
                  </div>

                  {/* Likes and rating summary indicators */}
                  <div className="flex items-center justify-between border-t border-zinc-800/60 pt-3 mt-4">
                    <div className="flex items-center gap-1 text-xs text-zinc-400">
                      <Heart size={14} className="text-fuchsia-500 fill-fuchsia-500/20" />
                      <span className="font-mono font-bold text-zinc-300">{video.likes?.length || 0}</span>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-zinc-400">
                      <Star size={14} className="text-amber-400 fill-amber-400/20" />
                      <span className="font-mono font-bold text-zinc-300">
                        {video.averageRating ? video.averageRating.toFixed(1) : '0.0'}
                        <span className="ml-1 text-zinc-500">({Object.keys(video.ratings || {}).length})</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
