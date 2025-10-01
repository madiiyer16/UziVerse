import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit')) || 20;
    const offset = parseInt(searchParams.get('offset')) || 0;

    // Get total count for pagination
    const totalSongs = await prisma.song.count({
      where: {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { album: { contains: search, mode: 'insensitive' } }
        ]
      }
    });

    const songs = await prisma.song.findMany({
      where: {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { album: { contains: search, mode: 'insensitive' } }
        ]
      },
      include: {
        genres: { include: { genre: true } },
        moods: { include: { mood: true } },
        reviews: { include: { user: true } },
        ratings: true
      },
      skip: offset,
      take: limit,
      orderBy: { avgRating: 'desc' }
    });

    // Transform the data to match frontend expectations
    const transformedSongs = songs.map(song => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      year: song.year,
      spotifyUrl: song.spotifyId ? `https://open.spotify.com/track/${song.spotifyId}` : null,
      youtubeUrl: song.youtubeId ? `https://www.youtube.com/watch?v=${song.youtubeId}` : null,
      soundcloudUrl: song.soundcloudId ? `https://soundcloud.com/track/${song.soundcloudId}` : null,
      avgRating: song.avgRating,
      totalRatings: song.totalRatings,
      genre: song.genres.map(g => g.genre.name),
      mood: song.moods.map(m => m.mood.name),
      audioFeatures: {
        energy: song.energy,
        danceability: song.danceability,
        valence: song.valence,
        tempo: song.tempo,
        acousticness: song.acousticness,
        instrumentalness: song.instrumentalness,
        liveness: song.liveness,
        speechiness: song.speechiness
      },
      reviews: song.reviews.map(review => ({
        id: review.id,
        username: review.user.username,
        rating: song.ratings.find(r => r.userId === review.userId)?.rating || 0,
        review: review.reviewText,
        date: review.createdAt.toISOString().split('T')[0]
      }))
    }));

    return NextResponse.json({
      success: true,
      songs: transformedSongs,
      pagination: {
        total: totalSongs,
        limit,
        offset,
        hasMore: offset + limit < totalSongs
      }
    });

  } catch (error) {
    console.error('Songs API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch songs' },
      { status: 500 }
    );
  }
}
