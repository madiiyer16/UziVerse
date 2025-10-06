import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hybridEngine } from '@/lib/recommendation-engine';
import { aiEnhancedEngine } from '@/lib/ai-prediction';

/**
 * Get personalized recommendations for authenticated user
 * GET /api/recommendations/personalized
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
    const algorithm = searchParams.get('algorithm') || 'hybrid';
    const coldStart = searchParams.get('coldStart') === 'true';

    console.log(`🎯 Getting personalized recommendations for user ${session.user.id}`);

    let recommendations = [];

    if (coldStart) {
      // Handle cold start for new users
      recommendations = await hybridEngine.getColdStartRecommendations(
        session.user.id, 
        limit
      );
    } else {
      // Get hybrid recommendations
      recommendations = await hybridEngine.getRecommendations(
        session.user.id, 
        { 
          limit,
          collaborativeWeight: algorithm === 'collaborative' ? 0.8 : 0.4,
          contentBasedWeight: algorithm === 'content' ? 0.8 : 0.4,
          popularityWeight: algorithm === 'popularity' ? 0.8 : 0.2
        }
      );
    }

    // Enhance recommendations with additional data
    const enhancedRecommendations = recommendations.map(rec => ({
      id: rec.id,
      title: rec.title,
      artist: rec.artist,
      album: rec.album,
      year: rec.year,
      imageUrl: rec.imageUrl,
      previewUrl: rec.previewUrl,
      duration: rec.duration,
      explicit: rec.explicit,
      popularity: rec.popularity,
      avgRating: rec.avgRating,
      totalRatings: rec.totalRatings,
      genres: rec.genres?.map(g => g.name) || [],
      moods: rec.moods?.map(m => m.name) || [],
      audioFeatures: rec.audioFeatures ? {
        energy: rec.audioFeatures.energy,
        danceability: rec.audioFeatures.danceability,
        valence: rec.audioFeatures.valence,
        tempo: rec.audioFeatures.tempo
      } : null,
      recommendationScore: rec.recommendationScore,
      rank: rec.rank,
      sources: rec.sources,
      reason: rec.details?.reason || 'Personalized recommendation'
    }));

    return NextResponse.json({
      success: true,
      data: {
        recommendations: enhancedRecommendations,
        total: enhancedRecommendations.length,
        algorithm,
        userId: session.user.id,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting personalized recommendations:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get personalized recommendations',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Update user preferences based on feedback
 * POST /api/recommendations/personalized
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      songId, 
      action, 
      rating, 
      timeSpent, 
      skipTime 
    } = body;

    if (!songId || !action) {
      return NextResponse.json(
        { success: false, error: 'songId and action are required' },
        { status: 400 }
      );
    }

    console.log(`📊 Recording user feedback: ${action} for song ${songId}`);

    const userId = session.user.id;

    // Handle different types of user feedback
    switch (action) {
      case 'play':
        await recordPlay(userId, songId, timeSpent);
        break;
        
      case 'like':
        await recordLike(userId, songId);
        break;
        
      case 'dislike':
        await recordDislike(userId, songId);
        break;
        
      case 'rate':
        if (!rating || rating < 1 || rating > 5) {
          return NextResponse.json(
            { success: false, error: 'Rating must be between 1 and 5' },
            { status: 400 }
          );
        }
        await recordRating(userId, songId, rating);
        break;
        
      case 'skip':
        await recordSkip(userId, songId, skipTime);
        break;
        
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: 'User feedback recorded successfully',
      data: { userId, songId, action, timestamp: new Date().toISOString() }
    });

  } catch (error) {
    console.error('Error recording user feedback:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to record user feedback',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Record song play interaction
 */
async function recordPlay(userId, songId, timeSpent = 0) {
  const { prisma } = await import('@/lib/prisma');
  
  const interaction = await prisma.userSongInteraction.upsert({
    where: { userId_songId: { userId, songId } },
    update: {
      playCount: { increment: 1 },
      lastPlayed: new Date(),
      totalTime: { increment: Math.round(timeSpent || 0) }
    },
    create: {
      userId,
      songId,
      playCount: 1,
      lastPlayed: new Date(),
      totalTime: Math.round(timeSpent || 0)
    }
  });

  // Update song's total play count
  await prisma.song.update({
    where: { id: songId },
    data: { totalPlays: { increment: 1 } }
  });

  return interaction;
}

/**
 * Record song like
 */
async function recordLike(userId, songId) {
  const { prisma } = await import('@/lib/prisma');
  
  const like = await prisma.userSongLike.upsert({
    where: { userId_songId: { userId, songId } },
    update: {},
    create: { userId, songId }
  });

  // Update song's total likes
  await prisma.song.update({
    where: { id: songId },
    data: { totalLikes: { increment: 1 } }
  });

  return like;
}

/**
 * Record song dislike (negative feedback)
 */
async function recordDislike(userId, songId) {
  // For now, we'll just remove any existing likes
  // In a more sophisticated system, you might have a separate dislikes table
  const { prisma } = await import('@/lib/prisma');
  
  const deletedLike = await prisma.userSongLike.deleteMany({
    where: { userId, songId }
  });

  // Update song's total likes
  if (deletedLike.count > 0) {
    await prisma.song.update({
      where: { id: songId },
      data: { totalLikes: { decrement: deletedLike.count } }
    });
  }

  return deletedLike;
}

/**
 * Record song rating
 */
async function recordRating(userId, songId, rating) {
  const { prisma } = await import('@/lib/prisma');
  
  // Get existing rating to update song averages
  const existingRating = await prisma.rating.findUnique({
    where: { userId_songId: { userId, songId } }
  });

  const newRating = await prisma.rating.upsert({
    where: { userId_songId: { userId, songId } },
    update: { rating },
    create: { userId, songId, rating }
  });

  // Update song's average rating and total ratings
  const allRatings = await prisma.rating.findMany({
    where: { songId },
    select: { rating: true }
  });

  const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
  const totalRatings = allRatings.length;

  await prisma.song.update({
    where: { id: songId },
    data: { avgRating, totalRatings }
  });

  return newRating;
}

/**
 * Record song skip
 */
async function recordSkip(userId, songId, skipTime = 0) {
  // Record as a play but with low time spent (indicating skip)
  return recordPlay(userId, songId, Math.min(skipTime || 5, 30)); // Max 30 seconds for skip
}
