'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Heart, ArrowLeft, Loader, Music2 } from 'lucide-react';
import Link from 'next/link';
import LikeButton from '@/components/LikeButton';

export default function LikedSongsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchLikedSongs();
    }
  }, [status, router]);

  const fetchLikedSongs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/liked-songs');
      const data = await response.json();
      
      if (data.success) {
        setSongs(data.songs);
      }
    } catch (error) {
      console.error('Error fetching liked songs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlike = (songId) => {
    setSongs(songs.filter(s => s.id !== songId));
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-8 h-8 text-red-500 fill-red-500" />
            <h1 className="text-4xl font-bold text-gray-900">My Liked Songs</h1>
          </div>
          <p className="text-gray-600 text-lg">{songs.length} songs you've favorited</p>
        </div>

        {songs.length === 0 ? (
          <div className="text-center py-12">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-700 mb-2">No liked songs yet</h2>
            <p className="text-gray-500 mb-6">Start liking songs to build your collection!</p>
            <Link href="/" className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              Discover Music
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {songs.map(song => (
              <div key={song.id} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                {song.imageUrl ? (
                  <img src={song.imageUrl} alt={song.album} className="w-full h-48 object-cover" />
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                    <Music2 className="w-16 h-16 text-white" />
                  </div>
                )}
                
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-gray-900">{song.title}</h3>
                    <LikeButton 
                      songId={song.id} 
                      initialLiked={true}
                      onUnlike={() => handleUnlike(song.id)}
                    />
                  </div>
                  <p className="text-purple-600 font-medium">{song.album} ({song.year})</p>
                  
                  <div className="flex gap-2 mt-4">
                    {song.spotifyUrl && (
                      <a href={song.spotifyUrl} target="_blank" rel="noopener noreferrer" className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-center transition-colors">
                        Spotify
                      </a>
                    )}
                    {song.youtubeUrl && (
                      <a href={song.youtubeUrl} target="_blank" rel="noopener noreferrer" className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-center transition-colors">
                        YouTube
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
