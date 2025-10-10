import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Must be logged in' },
        { status: 401 }
      );
    }

    const likedSongs = await prisma.userSongLike.findMany({
      where: { userId: session.user.id },
      include: {
        song: {
          include: {
            genres: { include: { genre: true } },
            moods: { include: { mood: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const songs = likedSongs.map(({ song }) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      year: song.year,
      imageUrl: song.imageUrl,
      spotifyUrl: song.spotifyId ? `https://open.spotify.com/track/${song.spotifyId}` : null,
      youtubeUrl: song.youtubeId ? `https://www.youtube.com/watch?v=${song.youtubeId}` : null,
      avgRating: song.avgRating,
      genre: song.genres.map(g => g.genre.name),
      mood: song.moods.map(m => m.mood.name)
    }));

    return NextResponse.json({
      success: true,
      songs
    });

  } catch (error) {
    console.error('Liked songs error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch liked songs' },
      { status: 500 }
    );
  }
}
