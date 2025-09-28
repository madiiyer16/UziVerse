import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request, { params }) {
  try {
    const albumName = decodeURIComponent(params.slug);

    const songs = await prisma.song.findMany({
      where: {
        album: albumName
      },
      include: {
        genres: { include: { genre: true } },
        moods: { include: { mood: true } },
        ratings: true
      },
      orderBy: [
        { year: 'desc' },
        { title: 'asc' }
      ]
    });

    if (songs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Album not found' },
        { status: 404 }
      );
    }

    // Transform the data
    const transformedSongs = songs.map(song => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      year: song.year,
      spotifyUrl: song.spotifyId ? `https://open.spotify.com/track/${song.spotifyId}` : null,
      youtubeUrl: song.youtubeId ? `https://www.youtube.com/watch?v=${song.youtubeId}` : null,
      imageUrl: song.imageUrl,
      duration: song.duration,
      avgRating: song.avgRating,
      totalRatings: song.totalRatings,
      genre: song.genres.map(g => g.genre.name),
      mood: song.moods.map(m => m.mood.name),
      audioFeatures: {
        energy: song.energy,
        danceability: song.danceability,
        valence: song.valence,
        tempo: song.tempo
      }
    }));

    const albumInfo = {
      name: albumName,
      year: songs[0].year,
      releaseType: songs[0].releaseType,
      trackCount: songs.length,
      imageUrl: songs[0].imageUrl,
      avgRating: songs.reduce((sum, song) => sum + song.avgRating, 0) / songs.length
    };

    return NextResponse.json({
      success: true,
      album: albumInfo,
      songs: transformedSongs
    });

  } catch (error) {
    console.error('Album songs API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch album songs' },
      { status: 500 }
    );
  }
}

