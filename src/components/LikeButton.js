'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useSession } from 'next-auth/react';

export default function LikeButton({ songId, initialLiked = false, size = 'md' }) {
  const { data: session } = useSession();
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [loading, setLoading] = useState(false);

  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const handleLike = async (e) => {
    e.stopPropagation();
    
    if (!session) {
      alert('Please sign in to like songs');
      return;
    }

    setLoading(true);
    
    try {
      const method = isLiked ? 'DELETE' : 'POST';
      const response = await fetch(`/api/songs/${songId}/like`, { method });
      const data = await response.json();
      
      if (data.success || response.ok) {
        setIsLiked(!isLiked);
      }
    } catch (error) {
      console.error('Like error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLike}
      disabled={loading}
      className={`transition-all ${loading ? 'opacity-50' : 'hover:scale-110'}`}
      title={isLiked ? 'Unlike' : 'Like'}
    >
      <Heart
        className={`${sizes[size]} transition-colors ${
          isLiked 
            ? 'fill-red-500 text-red-500' 
            : 'text-gray-400 hover:text-red-500'
        }`}
      />
    </button>
  );
}
