'use client';

import React, { useState, useEffect } from 'react';
import { Star, Play, User, Search, Filter, TrendingUp, Loader, LogIn, LogOut, UserCircle, Music2, ChevronRight } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

const UziRecommender = () => {
  const { data: session, status } = useSession();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSong, setSelectedSong] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("discover");
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch songs from database with pagination
  useEffect(() => {
    fetchSongs(true); // Reset pagination for new search/tab
  }, [searchTerm, activeTab]);

  const fetchSongs = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setCurrentPage(0);
      } else {
        setLoadingMore(true);
      }

      const offset = reset ? 0 : (currentPage + 1) * 20;
      const limit = activeTab === "discover" ? 6 : 20;
      
      const response = await fetch(`/api/songs?search=${encodeURIComponent(searchTerm)}&limit=${limit}&offset=${offset}`);
      const data = await response.json();
      
      if (data.success) {
        if (reset) {
          setSongs(data.songs);
          setCurrentPage(0);
        } else {
          setSongs(prev => [...prev, ...data.songs]);
          setCurrentPage(prev => prev + 1);
        }
        setHasMore(data.pagination?.hasMore || false);
      } else {
        console.error('Failed to fetch songs:', data.error);
      }
    } catch (error) {
      console.error('Error fetching songs:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (hasMore && !loadingMore) {
      fetchSongs(false);
    }
  };

  // Fetch recommendations for a song
  const fetchRecommendations = async (songId) => {
    try {
      const response = await fetch(`/api/recommendations?songId=${songId}&limit=3`);
      const data = await response.json();
      
      if (data.success) {
        setRecommendations(data.recommendations);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  };

  const handleSongSelect = (song) => {
    setSelectedSong(song);
    fetchRecommendations(song.id);
  };

  // User menu component
  const UserMenu = () => {
    if (status === "loading") {
      return <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>;
    }

    if (!session) {
      return (
        <div className="flex items-center gap-3">
          <Link
            href="/auth/signin"
            className="flex items-center gap-2 px-4 py-2 text-purple-600 hover:text-purple-700 font-medium"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <span className="text-gray-700">Welcome, {session.user.username}!</span>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    );
  };

  const SongCard = ({ song, showRecommendationScore = false }) => (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="font-bold text-xl text-gray-900 mb-1">{song.title}</h3>
          <p className="text-purple-600 font-medium">{song.album} ({song.year})</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {song.genre?.map(g => (
              <span key={g} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                {g}
              </span>
            ))}
          </div>
        </div>
        {showRecommendationScore && (
          <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
            {Math.round(song.recommendationScore * 100)}% match
          </div>
        )}
      </div>
      
      <div className="flex items-center mb-4">
        <div className="flex items-center">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${i < Math.round(song.avgRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
            />
          ))}
          <span className="ml-2 text-gray-600 text-sm">
            {song.avgRating} ({song.totalRatings} reviews)
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {song.mood?.map(mood => (
          <span key={mood} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
            {mood}
          </span>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {song.spotifyUrl && (
          <a
            href={song.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Play className="w-4 h-4" />
            Spotify
          </a>
        )}
        {song.youtubeUrl && (
          <a
            href={song.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Play className="w-4 h-4" />
            YouTube
          </a>
        )}
      </div>

      <button
        onClick={() => handleSongSelect(song)}
        className="w-full bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors"
      >
        View Details & Reviews
      </button>
    </div>
  );

  const SongDetailModal = ({ song, onClose }) => {
    if (!song) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{song.title}</h2>
                <p className="text-purple-600 text-lg">{song.album} ({song.year})</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
          </div>

          <div className="p-6 grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-semibold mb-4">Song Details</h3>
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-700">Genres: </span>
                  <span className="text-gray-600">{song.genre?.join(", ") || "N/A"}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Mood: </span>
                  <span className="text-gray-600">{song.mood?.join(", ") || "N/A"}</span>
                </div>
                {song.audioFeatures && (
                  <>
                    <div>
                      <span className="font-medium text-gray-700">Energy: </span>
                      <span className="text-gray-600">{Math.round((song.audioFeatures.energy || 0) * 100)}%</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Danceability: </span>
                      <span className="text-gray-600">{Math.round((song.audioFeatures.danceability || 0) * 100)}%</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Tempo: </span>
                      <span className="text-gray-600">{Math.round(song.audioFeatures.tempo || 0)} BPM</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">AI Recommendations</h3>
              <div className="space-y-3">
                {recommendations.map(rec => (
                  <div key={rec.id} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h5 className="font-medium">{rec.title}</h5>
                        <p className="text-sm text-gray-600">{rec.album}</p>
                      </div>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        {Math.round(rec.recommendationScore * 100)}% match
                      </span>
                    </div>
                    <button
                      onClick={() => handleSongSelect(rec)}
                      className="text-purple-600 hover:text-purple-800 text-sm"
                    >
                      View Details →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200">
            <h3 className="text-xl font-semibold mb-4">Reviews ({song.reviews?.length || 0})</h3>
            
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {song.reviews?.map(review => (
                <div key={review.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{review.username}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < (review.rating || 0)
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-500">{review.date}</span>
                    </div>
                  </div>
                  <p className="text-gray-700">{review.review}</p>
                </div>
              )) || (
                <p className="text-gray-500 text-center py-4">No reviews yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header with user menu */}
        <div className="flex justify-between items-center mb-8">
          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              🎵 Uzi<span className="text-purple-600">Verse</span>
            </h1>
            <p className="text-gray-600 text-lg">
              Your AI-powered Lil Uzi Vert song recommender & review platform
            </p>
          </div>
          <UserMenu />
        </div>

        {/* Navigation Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Link href="/albums" className="group">
            <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-xl flex items-center justify-center">
                  <Music2 className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                    Browse Albums & Singles
                  </h3>
                  <p className="text-gray-600">Explore Lil Uzi Vert's complete discography</p>
                </div>
                <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-purple-600 transition-colors" />
              </div>
            </div>
          </Link>
          
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-400 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900">AI Recommendations</h3>
                <p className="text-gray-600">Get personalized song suggestions</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-white rounded-lg p-1 shadow-md">
              <button
                onClick={() => setActiveTab("discover")}
                className={`px-6 py-2 rounded-md transition-colors ${
                  activeTab === "discover"
                    ? "bg-purple-500 text-white"
                    : "text-gray-600 hover:text-purple-600"
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Discover
              </button>
              <button
                onClick={() => setActiveTab("all")}
                className={`px-6 py-2 rounded-md transition-colors ${
                  activeTab === "all"
                    ? "bg-purple-500 text-white"
                    : "text-gray-600 hover:text-purple-600"
                }`}
              >
                <Filter className="w-4 h-4 inline mr-2" />
                All Songs
              </button>
            </div>
          </div>

          <div className="max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search songs or albums..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader className="w-8 h-8 animate-spin text-purple-600" />
            <span className="ml-2 text-gray-600">Loading songs...</span>
          </div>
        ) : songs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No songs found matching your search.</p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {songs.map(song => (
                <SongCard key={song.id} song={song} />
              ))}
            </div>
            
            {/* Load More Button */}
            {hasMore && activeTab === "all" && (
              <div className="text-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <div className="flex items-center gap-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      Loading more...
                    </div>
                  ) : (
                    `Load More Songs`
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {selectedSong && (
          <SongDetailModal
            song={selectedSong}
            onClose={() => setSelectedSong(null)}
          />
        )}
      </div>
    </div>
  );
};

export default UziRecommender;
