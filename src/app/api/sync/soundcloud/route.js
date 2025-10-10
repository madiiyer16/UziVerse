import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { soundcloudClient } from '@/lib/soundcloud';

/**
 * Sync SoundCloud tracks with database
 * POST /api/sync/soundcloud
 */
export async function POST(request) {
  try {
    // Check authentication (admin only for sync operations)
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // For now, allow any authenticated user to sync
    // In production, you might want to restrict this to admin users
    // if (session.user.role !== 'ADMIN') {
    //   return NextResponse.json(
    //     { success: false, error: 'Admin access required' },
    //     { status: 403 }
    //   );
    // }

    const body = await request.json();
    const { limit = 50, offset = 0, forceUpdate = false } = body;

    console.log(`🎧 Starting SoundCloud sync (limit: ${limit}, offset: ${offset})`);

    // Fetch tracks from SoundCloud
    const soundcloudData = await soundcloudClient.getOfficialTracks(limit, offset);
    
    if (!soundcloudData.tracks || soundcloudData.tracks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new SoundCloud tracks found',
        data: {
          tracksProcessed: 0,
          tracksCreated: 0,
          tracksUpdated: 0,
          tracksSkipped: 0,
          hasMore: false
        }
      });
    }

    // Sync with database
    const syncResult = await soundcloudClient.syncWithDatabase(soundcloudData.tracks);

    return NextResponse.json({
      success: true,
      message: 'SoundCloud sync completed successfully',
      data: {
        tracksProcessed: soundcloudData.tracks.length,
        tracksCreated: syncResult.created,
        tracksUpdated: syncResult.updated,
        tracksSkipped: syncResult.skipped,
        hasMore: soundcloudData.hasMore,
        nextOffset: soundcloudData.offset
      }
    });

  } catch (error) {
    console.error('Error syncing SoundCloud tracks:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to sync SoundCloud tracks',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Get SoundCloud sync status
 * GET /api/sync/soundcloud
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

    // Get count of SoundCloud tracks in database
    const { prisma } = await import('@/lib/prisma');
    
    const soundcloudTrackCount = await prisma.song.count({
      where: {
        soundcloudId: { not: null },
        isOfficial: true
      }
    });

    const totalTrackCount = await prisma.song.count();

    return NextResponse.json({
      success: true,
      data: {
        soundcloudTracks: soundcloudTrackCount,
        totalTracks: totalTrackCount,
        percentage: totalTrackCount > 0 ? Math.round((soundcloudTrackCount / totalTrackCount) * 100) : 0
      }
    });

  } catch (error) {
    console.error('Error getting SoundCloud sync status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get SoundCloud sync status',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

