// app/api/for-you/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's liked songs with their genres, moods, and audio features
    const likedSongs = await prisma.userSongLike.findMany({
      where: { userId: session.user.id },
      include: {
        song: {
          include: {
            genres: {
              include: {
                genre: true
              }
            },
            moods: {
              include: {
                mood: true
              }
            }
          }
        }
      }
    });

    if (likedSongs.length === 0) {
      return NextResponse.json({
        success: true,
        recommendations: [],
        message: 'No liked songs found. Start liking songs to get recommendations!'
      });
    }

    // Extract all genres and moods from liked songs
    const likedGenres = new Set();
    const likedMoods = new Set();
    const audioFeatures = {
      energy: [],
      danceability: [],
      valence: [],
      tempo: []
    };

    likedSongs.forEach(like => {
      const song = like.song;
      
      // Collect genres
      song.genres.forEach(sg => likedGenres.add(sg.genre.name));
      
      // Collect moods
      song.moods.forEach(sm => likedMoods.add(sm.mood.name));
      
      // Collect audio features
      if (song.energy) audioFeatures.energy.push(song.energy);
      if (song.danceability) audioFeatures.danceability.push(song.danceability);
      if (song.valence) audioFeatures.valence.push(song.valence);
      if (song.tempo) audioFeatures.tempo.push(song.tempo);
    });

    // Calculate average audio features
    const avgFeatures = {
      energy: audioFeatures.energy.length > 0 
        ? audioFeatures.energy.reduce((a, b) => a + b, 0) / audioFeatures.energy.length 
        : null,
      danceability: audioFeatures.danceability.length > 0 
        ? audioFeatures.danceability.reduce((a, b) => a + b, 0) / audioFeatures.danceability.length 
        : null,
      valence: audioFeatures.valence.length > 0 
        ? audioFeatures.valence.reduce((a, b) => a + b, 0) / audioFeatures.valence.length 
        : null,
      tempo: audioFeatures.tempo.length > 0 
        ? audioFeatures.tempo.reduce((a, b) => a + b, 0) / audioFeatures.tempo.length 
        : null
    };

    // Get all songs that are NOT liked by the user
    const likedSongIds = likedSongs.map(like => like.song.id);
    
    const candidateSongs = await prisma.song.findMany({
      where: {
        id: { notIn: likedSongIds },
        // Ensure songs have some audio features
        OR: [
          { energy: { not: null, gt: 0 } },
          { danceability: { not: null, gt: 0 } }
        ]
      },
      include: {
        genres: {
          include: {
            genre: true
          }
        },
        moods: {
          include: {
            mood: true
          }
        },
        likes: {
          where: {
            userId: session.user.id
          }
        },
        reviews: {
          include: {
            user: {
              select: {
                username: true
              }
            }
          }
        },
        ratings: true
      }
    });

    // Score each candidate song
    const scoredSongs = candidateSongs.map(song => {
      let score = 0;
      
      // Get song's genres and moods
      const songGenres = song.genres.map(sg => sg.genre.name);
      const songMoods = song.moods.map(sm => sm.mood.name);
      
      // Genre matching (40% weight)
      const genreMatches = songGenres.filter(g => likedGenres.has(g)).length;
      if (songGenres.length > 0) {
        score += (genreMatches / songGenres.length) * 0.4;
      }
      
      // Mood matching (30% weight)
      const moodMatches = songMoods.filter(m => likedMoods.has(m)).length;
      if (songMoods.length > 0) {
        score += (moodMatches / songMoods.length) * 0.3;
      }
      
      // Audio feature similarity (30% weight)
      let featureScore = 0;
      let featureCount = 0;
      
      if (avgFeatures.energy && song.energy) {
        featureScore += 1 - Math.abs(avgFeatures.energy - song.energy);
        featureCount++;
      }
      if (avgFeatures.danceability && song.danceability) {
        featureScore += 1 - Math.abs(avgFeatures.danceability - song.danceability);
        featureCount++;
      }
      if (avgFeatures.valence && song.valence) {
        featureScore += 1 - Math.abs(avgFeatures.valence - song.valence);
        featureCount++;
      }
      if (avgFeatures.tempo && song.tempo) {
        // Normalize tempo difference (typical range 60-180 BPM)
        const tempoDiff = Math.abs(avgFeatures.tempo - song.tempo) / 120;
        featureScore += Math.max(0, 1 - tempoDiff);
        featureCount++;
      }
      
      if (featureCount > 0) {
        score += (featureScore / featureCount) * 0.3;
      }

      return {
        song,
        score,
        genreMatches,
        moodMatches
      };
    });

    // Sort by score and take top 20
    scoredSongs.sort((a, b) => b.score - a.score);
    const topRecommendations = scoredSongs.slice(0, 20);

    // Transform to match frontend format (same as /api/songs)
    const recommendations = topRecommendations.map(({ song, score, genreMatches, moodMatches }) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      year: song.year,
      imageUrl: song.imageUrl,
      spotifyUrl: song.spotifyId ? `https://open.spotify.com/track/${song.spotifyId}` : null,
      youtubeUrl: song.youtubeId ? `https://www.youtube.com/watch?v=${song.youtubeId}` : null,
      soundcloudUrl: song.soundcloudId ? `https://soundcloud.com/track/${song.soundcloudId}` : null,
      
      genre: song.genres.map(sg => sg.genre.name),
      mood: song.moods.map(sm => sm.mood.name),
      
      audioFeatures: {
        energy: song.energy,
        danceability: song.danceability,
        valence: song.valence,
        tempo: song.tempo,
        loudness: song.loudness,
        speechiness: song.speechiness,
        acousticness: song.acousticness,
        instrumentalness: song.instrumentalness,
        liveness: song.liveness
      },
      
      avgRating: song.avgRating || 0,
      totalRatings: song.totalRatings || 0,
      isLiked: false, // Already filtered out liked songs
      
      reviews: song.reviews.map(review => ({
        id: review.id,
        username: review.user.username,
        rating: song.ratings?.find(r => r.userId === review.userId)?.rating || 0,
        review: review.reviewText,
        date: review.createdAt.toISOString().split('T')[0]
      })),
      
      // Recommendation metadata
      recommendationScore: score,
      matchReason: `${genreMatches} genre matches, ${moodMatches} mood matches`
    }));

    return NextResponse.json({
      success: true,
      recommendations,
      userPreferences: {
        genres: Array.from(likedGenres),
        moods: Array.from(likedMoods),
        avgAudioFeatures: avgFeatures,
        totalLikedSongs: likedSongs.length
      }
    });

  } catch (error) {
    console.error('Error generating recommendations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
