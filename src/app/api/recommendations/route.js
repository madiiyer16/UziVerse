import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Enhanced AI recommendation algorithm
function calculateSimilarity(song1, song2) {
  // Audio features similarity (using cosine similarity approach)
  const features1 = [
    song1.energy || 0,
    song1.danceability || 0,
    song1.valence || 0,
    song1.tempo || 120,
    song1.acousticness || 0,
    song1.speechiness || 0
  ];
  
  const features2 = [
    song2.energy || 0,
    song2.danceability || 0,
    song2.valence || 0,
    song2.tempo || 120,
    song2.acousticness || 0,
    song2.speechiness || 0
  ];

  // Normalize tempo (0-1 scale)
  features1[3] = features1[3] / 200;
  features2[3] = features2[3] / 200;

  // Calculate cosine similarity
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < features1.length; i++) {
    dotProduct += features1[i] * features2[i];
    norm1 += features1[i] * features1[i];
    norm2 += features2[i] * features2[i];
  }

  const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  return isNaN(similarity) ? 0 : similarity;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const songId = searchParams.get('songId');
    const limit = parseInt(searchParams.get('limit')) || 3;

    if (!songId) {
      return NextResponse.json(
        { success: false, error: 'songId is required' },
        { status: 400 }
      );
    }

    // Get the target song
    const targetSong = await prisma.song.findUnique({
      where: { id: songId },
      include: {
        genres: { include: { genre: true } },
        moods: { include: { mood: true } }
      }
    });

    if (!targetSong) {
      return NextResponse.json(
        { success: false, error: 'Song not found' },
        { status: 404 }
      );
    }

    // Get all other songs
    const allSongs = await prisma.song.findMany({
      where: {
        NOT: { id: songId }
      },
      include: {
        genres: { include: { genre: true } },
        moods: { include: { mood: true } }
      }
    });

    // Calculate recommendations
    const recommendations = allSongs.map(song => {
      let score = 0;

      // Audio features similarity (60% weight)
      const audioSimilarity = calculateSimilarity(targetSong, song);
      score += audioSimilarity * 0.6;

      // Genre similarity (25% weight)
      const targetGenres = targetSong.genres.map(g => g.genre.name);
      const songGenres = song.genres.map(g => g.genre.name);
      const genreOverlap = targetGenres.filter(g => songGenres.includes(g)).length;
      const genreSimilarity = targetGenres.length > 0 ? genreOverlap / targetGenres.length : 0;
      score += genreSimilarity * 0.25;

      // Mood similarity (10% weight)
      const targetMoods = targetSong.moods.map(m => m.mood.name);
      const songMoods = song.moods.map(m => m.mood.name);
      const moodOverlap = targetMoods.filter(m => songMoods.includes(m)).length;
      const moodSimilarity = targetMoods.length > 0 ? moodOverlap / targetMoods.length : 0;
      score += moodSimilarity * 0.1;

      // Popularity boost (5% weight)
      const popularityScore = song.avgRating / 5;
      score += popularityScore * 0.05;

      return {
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        year: song.year,
        spotifyUrl: song.spotifyUrl,
        youtubeUrl: song.youtubeUrl,
        avgRating: song.avgRating,
        totalRatings: song.totalRatings,
        genre: songGenres,
        mood: songMoods,
        recommendationScore: Math.max(0, Math.min(1, score)),
        audioFeatures: {
          energy: song.energy,
          danceability: song.danceability,
          valence: song.valence,
          tempo: song.tempo
        }
      };
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, limit);

    return NextResponse.json({
      success: true,
      recommendations,
      basedOn: {
        id: targetSong.id,
        title: targetSong.title,
        album: targetSong.album
      }
    });

  } catch (error) {
    console.error('Recommendations API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}
