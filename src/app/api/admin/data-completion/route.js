import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { dataCompletionEngine } from '@/lib/data-completion';

/**
 * Admin API for data completion management
 * POST /api/admin/data-completion
 */
export async function POST(request) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin (you might want to add role checking here)
    // For now, we'll allow any authenticated user to run data completion

    const body = await request.json();
    const { 
      action = 'complete',
      dryRun = false,
      batchSize = 50,
      maxSongs = null,
      songId = null
    } = body;

    console.log(`🔧 Admin data completion action: ${action}`);

    let result;

    switch (action) {
      case 'complete':
        if (songId) {
          // Complete data for specific song
          result = await dataCompletionEngine.completeSongData(songId, { dryRun });
        } else {
          // Complete data for all songs
          result = await dataCompletionEngine.completeAllSongsData({ 
            dryRun, 
            batchSize, 
            maxSongs 
          });
        }
        break;

      case 'validate':
        // Validate and clean existing data
        result = await dataCompletionEngine.validateAndCleanData();
        break;

      case 'stats':
        // Get completion statistics
        result = await dataCompletionEngine.getCompletionStats();
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      dryRun,
      result
    });

  } catch (error) {
    console.error('Error in admin data completion:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get data completion statistics
 * GET /api/admin/data-completion
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

    const stats = await dataCompletionEngine.getCompletionStats();

    return NextResponse.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting data completion stats:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
