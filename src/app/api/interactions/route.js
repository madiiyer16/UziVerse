import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Track user interactions with songs
 * POST /api/interactions
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
      interactionType, 
      metadata = {} 
    } = body;

    if (!songId || !interactionType) {
      return NextResponse.json(
        { success: false, error: 'songId and interactionType are required' },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    console.log(`📊 Recording interaction: ${interactionType} for song ${songId}`);

    // Validate song exists
    const song = await prisma.song.findUnique({
      where: { id: songId }
    });

    if (!song) {
      return NextResponse.json(
        { success: false, error: 'Song not found' },
        { status: 404 }
      );
    }

    // Handle different interaction types
    let result;
    switch (interactionType) {
      case 'view':
        result = await recordView(userId, songId, metadata);
        break;
        
      case 'play':
        result = await recordPlay(userId, songId, metadata);
        break;
        
      case 'pause':
        result = await recordPause(userId, songId, metadata);
        break;
        
      case 'complete':
        result = await recordComplete(userId, songId, metadata);
        break;
        
      case 'skip':
        result = await recordSkip(userId, songId, metadata);
        break;
        
      case 'like':
        result = await recordLike(userId, songId);
        break;
        
      case 'unlike':
        result = await recordUnlike(userId, songId);
        break;
        
      case 'share':
        result = await recordShare(userId, songId, metadata);
        break;
        
      case 'add_to_playlist':
        result = await recordPlaylistAdd(userId, songId, metadata);
        break;
        
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid interaction type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: 'Interaction recorded successfully',
      data: {
        userId,
        songId,
        interactionType,
        timestamp: new Date().toISOString(),
        result
      }
    });

  } catch (error) {
    console.error('Error recording interaction:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to record interaction',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Get user's interaction history
 * GET /api/interactions
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = parseInt(searchParams.get('offset')) || 0;
    const type = searchParams.get('type');

    const userId = session.user.id;

    // Build where clause
    const whereClause = { userId };
    if (type) {
      whereClause.interactionType = type;
    }

    // Get interactions with song details
    const interactions = await prisma.userSongInteraction.findMany({
      where: whereClause,
      include: {
        song: {
          include: {
            genres: true,
            moods: true
          }
        }
      },
      orderBy: { lastPlayed: 'desc' },
      take: limit,
      skip: offset
    });

    // Get likes
    const likes = await prisma.userSongLike.findMany({
      where: { userId },
      include: {
        song: {
          include: {
            genres: true,
            moods: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    // Get ratings
    const ratings = await prisma.rating.findMany({
      where: { userId },
      include: {
        song: {
          include: {
            genres: true,
            moods: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    return NextResponse.json({
      success: true,
      data: {
        interactions: interactions.map(i => ({
          id: i.id,
          song: i.song,
          playCount: i.playCount,
          totalTime: i.totalTime,
          lastPlayed: i.lastPlayed,
          createdAt: i.createdAt
        })),
        likes: likes.map(l => ({
          id: l.id,
          song: l.song,
          likedAt: l.createdAt
        })),
        ratings: ratings.map(r => ({
          id: r.id,
          song: r.song,
          rating: r.rating,
          ratedAt: r.createdAt
        })),
        total: {
          interactions: interactions.length,
          likes: likes.length,
          ratings: ratings.length
        }
      }
    });

  } catch (error) {
    console.error('Error getting user interactions:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get user interactions',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Record song view
 */
async function recordView(userId, songId, metadata) {
  // For now, we'll record a minimal play interaction
  // In a more sophisticated system, you might have a separate views table
  return recordPlay(userId, songId, { ...metadata, isView: true });
}

/**
 * Record song play
 */
async function recordPlay(userId, songId, metadata = {}) {
  const { timeSpent = 0, position = 0, source = 'unknown' } = metadata;
  
  const interaction = await prisma.userSongInteraction.upsert({
    where: { userId_songId: { userId, songId } },
    update: {
      playCount: { increment: 1 },
      lastPlayed: new Date(),
      totalTime: { increment: Math.round(timeSpent) }
    },
    create: {
      userId,
      songId,
      playCount: 1,
      lastPlayed: new Date(),
      totalTime: Math.round(timeSpent)
    }
  });

  // Update song's total play count
  await prisma.song.update({
    where: { id: songId },
    data: { totalPlays: { increment: 1 } }
  });

  return { interaction, action: 'play', timeSpent, position, source };
}

/**
 * Record song pause
 */
async function recordPause(userId, songId, metadata = {}) {
  const { timeSpent = 0, position = 0 } = metadata;
  
  // Update existing interaction with time spent
  await prisma.userSongInteraction.updateMany({
    where: { userId, songId },
    data: { totalTime: { increment: Math.round(timeSpent) } }
  });

  return { action: 'pause', timeSpent, position };
}

/**
 * Record song completion
 */
async function recordComplete(userId, songId, metadata = {}) {
  const { duration = 0, source = 'unknown' } = metadata;
  
  // Record as a play with full duration
  const interaction = await recordPlay(userId, songId, { 
    timeSpent: duration, 
    source,
    completed: true 
  });

  return { ...interaction, action: 'complete', duration };
}

/**
 * Record song skip
 */
async function recordSkip(userId, songId, metadata = {}) {
  const { timeSpent = 5, position = 0, reason = 'user_skip' } = metadata;
  
  // Record minimal play time indicating skip
  const interaction = await recordPlay(userId, songId, { 
    timeSpent: Math.min(timeSpent, 30), // Max 30 seconds for skip
    position,
    reason,
    skipped: true 
  });

  return { ...interaction, action: 'skip', timeSpent, reason };
}

/**
 * Record song like
 */
async function recordLike(userId, songId) {
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

  return { like, action: 'like' };
}

/**
 * Record song unlike
 */
async function recordUnlike(userId, songId) {
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

  return { action: 'unlike', removed: deletedLike.count };
}

/**
 * Record song share
 */
async function recordShare(userId, songId, metadata = {}) {
  const { platform = 'unknown', method = 'unknown' } = metadata;
  
  // For now, we'll just log this
  // In a more sophisticated system, you might have a shares table
  console.log(`User ${userId} shared song ${songId} via ${platform} using ${method}`);
  
  return { action: 'share', platform, method };
}

/**
 * Record adding song to playlist
 */
async function recordPlaylistAdd(userId, songId, metadata = {}) {
  const { playlistId, playlistName } = metadata;
  
  // For now, we'll just log this
  // The actual playlist addition should be handled by the playlist API
  console.log(`User ${userId} added song ${songId} to playlist ${playlistName || playlistId}`);
  
  return { action: 'add_to_playlist', playlistId, playlistName };
}
