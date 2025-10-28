'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Play, Clock, Star, ExternalLink, Music2, User } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import LikeButton from '@/components/LikeButton';

export default function AlbumDetailPage() {
  const params = useParams();
  const albumSlug = params.slug;
  const { data: session } = useSession();

  const [album, setAlbum] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    if (albumSlug) {
      fetchAlbumData();
    }
  }, [albumSlug]);

  const fetchAlbumData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/albums/${encodeURIComponent(albumSlug)}`);
      const data = await response.json();

      if (data.success) {
        setAlbum(data.album);
        setSongs(data.songs);
      } else {
        setError(data.error || 'Failed to load album');
      }
    } catch (error) {
      console.error('Error fetching album:', error);
      setError('Failed to load album');
    } finally {
      setLoading(false);
    }
  };

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

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const totalDuration = songs.reduce((total, song) => total + (song.duration || 0), 0);

  const SongRow = ({ song, index }) => (
    <div className="group hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-4 p-4">
        <div className="w-8 text-center text-gray-500 font-medium flex-shrink-0">
          {index + 1}
        </div>

        <div className="flex-shrink-0">
          {song.imageUrl ? (
            <img src={song.imageUrl} alt={song.title} className="w-12 h-12 rounded object-cover" />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded flex items-center justify-center">
              <Music2 className="w-6 h-6 text-white" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 mb-1 truncate">{song.title}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {song.genre?.slice(0, 2).map(g => (
              <span key={g} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">{g}</span>
            ))}
            {song.mood?.slice(0, 2).map(mood => (
              <span key={mood} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">{mood}</span>
            ))}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1 flex-shrink-0">
          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          <span className="text-sm font-medium text-gray-700">
            {song.avgRating ? song.avgRating.toFixed(1) : 'N/A'}
          </span>
          <span className="text-xs text-gray-500">({song.totalRatings})</span>
        </div>

        <div className="hidden sm:block text-sm text-gray-500 flex-shrink-0">
          <Clock className="w-4 h-4 inline mr-1" />
          {formatDuration(song.duration)}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <LikeButton songId={song.id} initialLiked={song.isLiked} />

          {song.spotifyUrl && (
            <a href={song.spotifyUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Play on Spotify">
              <Play className="w-4 h-4" />
            </a>
          )}
          {song.youtubeUrl && (
            <a href={song.youtubeUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Play on YouTube">
              <Play className="w-4 h-4" />
            </a>
          )}
          {song.soundcloudId && (
            <a href={`https://soundcloud.com/liluzivert/${song.title?.toLowerCase().replace(/\s+/g, '-')}`} target="_blank" rel="noopener noreferrer" className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Play on SoundCloud">
              <Play className="w-4 h-4" />
            </a>
          )}

          <button onClick={() => handleSongSelect(song)} className="px-3 py-1.5 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors">
            Details
          </button>
        </div>
      </div>
    </div>
  );

  const SongDetailModal = ({ song, onClose }) => {
    if (!song) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{song.title}</h2>
                <p className="text-purple-600 text-lg">{song.album} ({song.year})</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
          </div>

          <div className="p-6 grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-semibold mb-4">Song Details</h3>
              <div className="space-y-3">
                <div><span className="font-medium text-gray-700">Genres: </span><span className="text-gray-600">{song.genre?.join(", ") || "N/A"}</span></div>
                <div><span className="font-medium text-gray-700">Mood: </span><span className="text-gray-600">{song.mood?.join(", ") || "N/A"}</span></div>
                {song.audioFeatures && (
                  <>
                    <div><span className="font-medium text-gray-700">Energy: </span><span className="text-gray-600">{Math.round((song.audioFeatures.energy || 0) * 100)}%</span></div>
                    <div><span className="font-medium text-gray-700">Danceability: </span><span className="text-gray-600">{Math.round((song.audioFeatures.danceability || 0) * 100)}%</span></div>
                    <div><span className="font-medium text-gray-700">Tempo: </span><span className="text-gray-600">{Math.round(song.audioFeatures.tempo || 0)} BPM</span></div>
                  </>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">AI Recommendations</h3>
              <div className="space-y-3">
                {recommendations.length > 0 ? recommendations.map(rec => (
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
                    <button onClick={() => handleSongSelect(rec)} className="text-purple-600 hover:text-purple-800 text-sm">
                      View Details →
                    </button>
                  </div>
                )) : (
                  <p className="text-gray-500 text-sm">Loading recommendations...</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200">
            <h3 className="text-xl font-semibold mb-4">Reviews ({song.reviews?.length || 0})</h3>
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {song.reviews?.length > 0 ? song.reviews.map(review => (
                <div key={review.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{review.username}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < (review.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                        ))}
                      </div>
                      <span className="text-sm text-gray-500">{review.date}</span>
                    </div>
                  </div>
                  <p className="text-gray-700">{review.review}</p>
                </div>
              )) : (
                <p className="text-gray-500 text-center py-4">No reviews yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-32 mb-8"></div>
            <div className="flex gap-8 mb-8">
              <div className="w-48 h-48 bg-gray-200 rounded-xl"></div>
              <div className="flex-1">
                <div className="h-10 bg-gray-200 rounded mb-4"></div>
                <div className="h-6 bg-gray-200 rounded mb-2 w-1/3"></div>
                <div className="h-6 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="container mx-auto px-4 py-8">
          <Link href="/albums" className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back to Albums
          </Link>
          <div className="text-center py-12">
            <p className="text-red-600 text-lg">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        <Link href="/albums" className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Albums
        </Link>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-shrink-0">
              {album?.imageUrl ? (
                <img src={album.imageUrl} alt={album.name} className="w-48 h-48 rounded-xl object-cover shadow-lg" />
              ) : (
                <div className="w-48 h-48 bg-gradient-to-br from-purple-400 to-pink-400 rounded-xl flex items-center justify-center">
                  <Play className="w-16 h-16 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="mb-4">
                <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium mb-2">
                  {album?.releaseType}
                </span>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{album?.name}</h1>
                <p className="text-xl text-gray-600">Lil Uzi Vert • {album?.year}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Tracks</p>
                  <p className="text-lg font-semibold">{album?.trackCount}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="text-lg font-semibold">{formatDuration(totalDuration)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Rating</p>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-lg font-semibold">
                      {album?.avgRating ? album.avgRating.toFixed(1) : 'N/A'}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Year</p>
                  <p className="text-lg font-semibold">{album?.year}</p>
                </div>
              </div>

              <div className="flex gap-3">
                {album?.spotifyId && (
                  <a href={`https://open.spotify.com/album/${album.spotifyId}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">
                    <Play className="w-4 h-4" />
                    Play on Spotify
                  </a>
                )}
                <Link href="/" className="flex items-center gap-2 px-4 py-2 border border-purple-500 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                  <ExternalLink className="w-4 h-4" />
                  Get Recommendations
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Track List</h2>
            <p className="text-gray-600 text-sm mt-1">{songs.length} tracks</p>
          </div>

          <div className="divide-y divide-gray-100">
            {songs.map((song, index) => (
              <SongRow key={song.id} song={song} index={index} />
            ))}
          </div>
        </div>

        {selectedSong && <SongDetailModal song={selectedSong} onClose={() => setSelectedSong(null)} />}
      </div>
    </div>
  );
}
