'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Play, Clock, Star, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function AlbumDetailPage() {
  const params = useParams();
  const albumSlug = params.slug;
  
  const [album, setAlbum] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const totalDuration = songs.reduce((total, song) => total + (song.duration || 0), 0);

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
        {/* Navigation */}
        <Link href="/albums" className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Albums
        </Link>

        {/* Album Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Album Artwork */}
            <div className="flex-shrink-0">
              {album?.imageUrl ? (
                <img
                  src={album.imageUrl}
                  alt={album.name}
                  className="w-48 h-48 rounded-xl object-cover shadow-lg"
                />
              ) : (
                <div className="w-48 h-48 bg-gradient-to-br from-purple-400 to-pink-400 rounded-xl flex items-center justify-center">
                  <Play className="w-16 h-16 text-white" />
                </div>
              )}
            </div>

            {/* Album Info */}
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

              {/* External Links */}
              <div className="flex gap-3">
                {songs[0]?.spotifyUrl && (
                  <a
                    href={songs[0].spotifyUrl.replace('/track/', '/album/')} // Link to album instead of track
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Play on Spotify
                  </a>
                )}
                <Link
                  href="/"
                  className="flex items-center gap-2 px-4 py-2 border border-purple-500 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Get Recommendations
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Track List */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Track List</h2>
          </div>
          
          <div className="divide-y divide-gray-100">
            {songs.map((song, index) => (
              <div key={song.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-8 text-center text-gray-500 font-medium">
                    {index + 1}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{song.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {song.genre.length > 0 && (
                        <span>{song.genre.join(', ')}</span>
                      )}
                      {song.mood.length > 0 && (
                        <span>• {song.mood.join(', ')}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Rating */}
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">
                        {song.avgRating ? song.avgRating.toFixed(1) : 'N/A'}
                      </span>
                    </div>
                    
                    {/* Duration */}
                    <div className="flex items-center gap-1 text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">{formatDuration(song.duration)}</span>
                    </div>
                    
                    {/* External Links */}
                    <div className="flex items-center gap-2">
                      {song.spotifyUrl && (
                        <a
                          href={song.spotifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <Play className="w-4 h-4" />
                        </a>
                      )}
                      {song.youtubeUrl && (
                        <a
                          href={song.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Play className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
