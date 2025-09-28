'use client';

import { useState, useEffect } from 'react';
import { Play, Calendar, Music, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AlbumsPage() {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    fetchAlbums();
  }, [activeFilter]);

  const fetchAlbums = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/albums?type=${activeFilter}`);
      const data = await response.json();
      
      if (data.success) {
        setAlbums(data.albums);
      }
    } catch (error) {
      console.error('Error fetching albums:', error);
    } finally {
      setLoading(false);
    }
  };

  const getReleaseTypeColor = (type) => {
    const colors = {
      'ALBUM': 'bg-purple-100 text-purple-800',
      'SINGLE': 'bg-blue-100 text-blue-800',
      'EP': 'bg-green-100 text-green-800',
      'MIXTAPE': 'bg-orange-100 text-orange-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const AlbumCard = ({ album }) => (
    <Link href={`/albums/${encodeURIComponent(album.name)}`}>
      <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 cursor-pointer group">
        <div className="flex gap-4">
          {album.imageUrl ? (
            <img
              src={album.imageUrl}
              alt={album.name}
              className="w-20 h-20 rounded-lg object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg flex items-center justify-center">
              <Music className="w-8 h-8 text-white" />
            </div>
          )}
          
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold text-lg text-gray-900 group-hover:text-purple-600 transition-colors">
                {album.name}
              </h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getReleaseTypeColor(album.releaseType)}`}>
                {album.releaseType}
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {album.year}
              </div>
              <div className="flex items-center gap-1">
                <Music className="w-4 h-4" />
                {album.trackCount} tracks
              </div>
            </div>
            
            <div className="mt-3 flex items-center gap-2">
              <button className="text-purple-600 hover:text-purple-800 font-medium text-sm">
                View Tracks →
              </button>
              {album.spotifyId && (
                <a
                  href={`https://open.spotify.com/album/${album.spotifyId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-green-600 hover:text-green-700 text-sm"
                >
                  <Play className="w-3 h-3" />
                  Spotify
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Lil Uzi Vert Discography
          </h1>
          <p className="text-gray-600 text-lg">
            Browse albums, singles, and mixtapes
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-8">
          <div className="flex justify-center">
            <div className="bg-white rounded-lg p-1 shadow-md">
              {[
                { key: 'all', label: 'All Releases' },
                { key: 'albums', label: 'Albums' },
                { key: 'singles', label: 'Singles' }
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className={`px-6 py-2 rounded-md transition-colors ${
                    activeFilter === filter.key
                      ? "bg-purple-500 text-white"
                      : "text-gray-600 hover:text-purple-600"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Albums Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-200 rounded-lg animate-pulse"></div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse mb-2 w-2/3"></div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : albums.length === 0 ? (
          <div className="text-center py-12">
            <Music className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No {activeFilter === 'all' ? 'releases' : activeFilter} found.</p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {albums.map((album, index) => (
                <AlbumCard key={`${album.name}-${index}`} album={album} />
              ))}
            </div>
            
            <div className="text-center text-gray-600">
              <p>Showing {albums.length} {activeFilter === 'all' ? 'releases' : activeFilter}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
