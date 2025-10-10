import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { aiEnhancedEngine } from '@/lib/ai-prediction';
import { prisma } from '@/lib/prisma';

/**
 * Get AI-enhanced recommendations for authenticated user
 * GET /api/recommendations/ai-enhanced
 */
export async function GET(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 20;
    const includePredictions = searchParams.get('includePredictions') === 'true';

    console.log(`🤖 Getting AI-enhanced recommendations for user ${session.user.id}`);

    // Get AI-enhanced recommendations
    const recommendations = await aiEnhancedEngine.getEnhancedRecommendations(
      session.user.id, 
      { limit }
    );

    // Enhance recommendations with additional data
    const enhancedRecommendations = recommendations.map(rec => ({
      id: rec.id,
      title: rec.title,
      artist: rec.artist,
      album: rec.album,
      year: rec.year,
      imageUrl: rec.imageUrl,
      spotifyUrl: rec.spotifyUrl,
      youtubeUrl: rec.youtubeUrl,
      soundcloudId: rec.soundcloudId,
      recommendationScore: rec.similarity,
      basedOn: rec.basedOn,
      
      // Audio features (with AI predictions if missing)
      audioFeatures: {
        energy: rec.audioFeatures?.energy || rec.energy || 0,
        danceability: rec.audioFeatures?.danceability || rec.danceability || 0,
        valence: rec.audioFeatures?.valence || rec.valence || 0,
        tempo: rec.audioFeatures?.tempo || rec.tempo || 0,
        acousticness: rec.audioFeatures?.acousticness || rec.acousticness || 0,
        instrumentalness: rec.audioFeatures?.instrumentalness || rec.instrumentalness || 0,
        liveness: rec.audioFeatures?.liveness || rec.liveness || 0,
        speechiness: rec.audioFeatures?.speechiness || rec.speechiness || 0
      },

      // Genres (with AI predictions if missing)
      genres: rec.genres?.map(g => g.name) || rec.predictedGenres || ['Unknown'],
      
      // Moods (with AI predictions if missing)
      moods: rec.moods?.map(m => m.name) || rec.predictedMoods || ['Neutral'],

      // Additional metadata
      popularity: rec.popularity || 0,
      avgRating: rec.avgRating || 0,
      totalRatings: rec.totalRatings || 0,
      totalLikes: rec.totalLikes || 0,
      totalPlays: rec.totalPlays || 0,

      // AI prediction indicators
      hasPredictedFeatures: includePredictions ? this.hasPredictedFeatures(rec) : false,
      hasPredictedGenres: includePredictions ? this.hasPredictedGenres(rec) : false,
      hasPredictedMoods: includePredictions ? this.hasPredictedMoods(rec) : false
    }));

    // Get user's liked songs count for context
    const likedCount = await prisma.userSongLike.count({
      where: { userId: session.user.id }
    });

    // Get top genres from user's liked songs
    const topGenres = await this.getUserTopGenres(session.user.id);

    return NextResponse.json({
      success: true,
      recommendations: enhancedRecommendations,
      basedOn: {
        likedCount,
        topGenres,
        algorithm: 'ai-enhanced',
        description: 'AI-powered recommendations with intelligent data completion'
      },
      metadata: {
        totalRecommendations: enhancedRecommendations.length,
        aiPredictionsUsed: enhancedRecommendations.filter(r => r.hasPredictedFeatures || r.hasPredictedGenres || r.hasPredictedMoods).length,
        averageConfidence: this.calculateAverageConfidence(enhancedRecommendations)
      }
    });

  } catch (error) {
    console.error('Error getting AI-enhanced recommendations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}

/**
 * Check if song has predicted features
 */
function hasPredictedFeatures(song) {
  return song.audioFeatures && (
    song.audioFeatures.energy === 0 || 
    song.audioFeatures.danceability === 0 || 
    song.audioFeatures.valence === 0
  );
}

/**
 * Check if song has predicted genres
 */
function hasPredictedGenres(song) {
  return song.predictedGenres && song.predictedGenres.length > 0;
}

/**
 * Check if song has predicted moods
 */
function hasPredictedMoods(song) {
  return song.predictedMoods && song.predictedMoods.length > 0;
}

/**
 * Get user's top genres from liked songs
 */
async function getUserTopGenres(userId) {
  try {
    const likedSongs = await prisma.userSongLike.findMany({
      where: { userId },
      include: {
        song: {
          include: {
            genres: true
          }
        }
      }
    });

    const genreCounts = {};
    for (const like of likedSongs) {
      const genres = like.song.genres || [];
      for (const genre of genres) {
        genreCounts[genre.name] = (genreCounts[genre.name] || 0) + 1;
      }
    }

    return Object.entries(genreCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([genre]) => genre);
  } catch (error) {
    console.error('Error getting user top genres:', error);
    return [];
  }
}

/**
 * Calculate average confidence of recommendations
 */
function calculateAverageConfidence(recommendations) {
  if (recommendations.length === 0) return 0;
  
  const totalConfidence = recommendations.reduce((sum, rec) => {
    return sum + (rec.recommendationScore || 0);
  }, 0);
  
  return Math.round((totalConfidence / recommendations.length) * 100);
}
