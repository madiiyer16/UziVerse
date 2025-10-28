// app/api/albums/[slug]/route.js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const albumSlug = params.slug;

    // Decode the album name from URL
    const albumName = decodeURIComponent(albumSlug);

    // Get album info with songs
    const songs = await prisma.song.findMany({
      where: {
        album: albumName
      },
      include: {
        genres: { include: { genre: true } },
        moods: { include: { mood: true } },
        reviews: { include: { user: true } },
        ratings: true
      },
      orderBy: [
        { title: 'asc' }  // Alphabetical for now - change to trackNumber if you have it
      ]
    });

    if (songs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Album not found' },
        { status: 404 }
      );
    }

    // Get user's liked songs if logged in
    let likedSongIds = [];
    if (session?.user) {
      const likes = await prisma.userSongLike.findMany({
        where: { userId: session.user.id },
        select: { songId: true }
      });
      likedSongIds = likes.map(l => l.songId);
    }

    // Get album info from first song
    const firstSong = songs[0];
    const album = {
      name: albumName,
      year: firstSong.year,
      releaseType: firstSong.releaseType,
      imageUrl: firstSong.imageUrl,
      spotifyId: firstSong.spotifyId ? firstSong.spotifyId.split(':').pop() : null, // Extract album ID if available
      trackCount: songs.length,
      avgRating: songs.reduce((sum, s) => sum + (s.avgRating || 0), 0) / songs.length
    };

    // Transform songs to match frontend format
    const transformedSongs = songs.map(song => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      imageUrl: song.imageUrl,
      isLiked: likedSongIds.includes(song.id),
      year: song.year,
      duration: song.duration,
      spotifyUrl: song.spotifyId ? `https://open.spotify.com/track/${song.spotifyId}` : null,
      youtubeUrl: song.youtubeId 
        ? `https://www.youtube.com/watch?v=${song.youtubeId}` 
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(`Lil Uzi Vert ${song.title} Official Audio`)}`,
      soundcloudUrl: song.soundcloudId ? `https://soundcloud.com/track/${song.soundcloudId}` : null,
      soundcloudId: song.soundcloudId,
      avgRating: song.avgRating || 0,
      totalRatings: song.totalRatings || 0,
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
      album,
      songs: transformedSongs
    });

  } catch (error) {
    console.error('Album Detail API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch album details' },
      { status: 500 }
    );
  }
}
