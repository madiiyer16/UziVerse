import { NextResponse } from 'next/server';
import { spotifyClient } from '@/lib/spotify';
import { prisma } from '@/lib/prisma';

/**
 * Background sync job for periodic catalog updates
 * This endpoint should be called by a cron job or scheduler
 * POST /api/sync/cron
 */
export async function POST(request) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;
    
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔄 Starting scheduled catalog sync...');
    const startTime = Date.now();

    // Get sync options from request body
    const { 
      syncSpotify = true, 
      syncSoundCloud = false,
      forceUpdate = false,
      maxAge = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    } = await request.json();

    const results = {
      spotify: null,
      soundcloud: null,
      errors: [],
      summary: {
        totalTime: 0,
        songsProcessed: 0,
        songsCreated: 0,
        songsUpdated: 0,
        songsSkipped: 0
      }
    };

    // Sync Spotify catalog
    if (syncSpotify) {
      try {
        console.log('🎵 Syncing Spotify catalog...');
        const spotifyResult = await syncSpotifyCatalog(forceUpdate, maxAge);
        results.spotify = spotifyResult;
        results.summary.songsProcessed += spotifyResult.songsProcessed;
        results.summary.songsCreated += spotifyResult.songsCreated;
        results.summary.songsUpdated += spotifyResult.songsUpdated;
        results.summary.songsSkipped += spotifyResult.songsSkipped;
      } catch (error) {
        console.error('❌ Spotify sync failed:', error);
        results.errors.push({ service: 'spotify', error: error.message });
      }
    }

    // Sync SoundCloud catalog
    if (syncSoundCloud) {
      try {
        console.log('🎧 Syncing SoundCloud catalog...');
        const soundcloudResult = await syncSoundCloudCatalog(forceUpdate, maxAge);
        results.soundcloud = soundcloudResult;
        results.summary.songsProcessed += soundcloudResult.songsProcessed;
        results.summary.songsCreated += soundcloudResult.songsCreated;
        results.summary.songsUpdated += soundcloudResult.songsUpdated;
        results.summary.songsSkipped += soundcloudResult.songsSkipped;
      } catch (error) {
        console.error('❌ SoundCloud sync failed:', error);
        results.errors.push({ service: 'soundcloud', error: error.message });
      }
    }

    // Clean up old data
    await cleanupOldData();

    // Update sync statistics
    await updateSyncStats(results);

    results.summary.totalTime = Date.now() - startTime;
    
    console.log('✅ Scheduled sync completed:', results.summary);

    return NextResponse.json({
      success: true,
      message: 'Scheduled sync completed successfully',
      data: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Scheduled sync failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Scheduled sync failed',
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Sync Spotify catalog with incremental updates
 */
async function syncSpotifyCatalog(forceUpdate = false, maxAge = 24 * 60 * 60 * 1000) {
  const result = {
    songsProcessed: 0,
    songsCreated: 0,
    songsUpdated: 0,
    songsSkipped: 0,
    errors: []
  };

  try {
    // Get Lil Uzi Vert's latest discography
    const discography = await spotifyClient.getCompleteDiscography();
    
    // Get existing songs to check for updates
    const existingSongs = await prisma.song.findMany({
      where: { spotifyId: { not: null } },
      select: { id: true, spotifyId: true, updatedAt: true }
    });

    const existingSongsMap = new Map(
      existingSongs.map(song => [song.spotifyId, song])
    );

    // Process each track
    for (const track of discography.tracks) {
      try {
        result.songsProcessed++;

        // Validate official release
        if (!spotifyClient.isOfficialRelease(track, discography.artist)) {
          result.songsSkipped++;
          continue;
        }

        const existingSong = existingSongsMap.get(track.id);
        const now = new Date();
        const songAge = existingSong ? now - existingSong.updatedAt : Infinity;

        // Skip if song is recent and not forcing update
        if (!forceUpdate && existingSong && songAge < maxAge) {
          result.songsSkipped++;
          continue;
        }

        const trackData = {
          title: track.name,
          artist: 'Lil Uzi Vert',
          album: track.album.name,
          year: new Date(track.album.release_date).getFullYear(),
          spotifyId: track.id,
          
          // Media
          imageUrl: track.album.images?.[0]?.url,
          previewUrl: track.preview_url,
          duration: Math.round(track.duration_ms / 1000),
          
          // Platform data
          popularity: track.popularity,
          explicit: track.explicit,
          isOfficial: true,
          releaseType: mapReleaseType(track.album.album_type),
          
          // Audio features
          energy: track.audioFeatures?.energy,
          danceability: track.audioFeatures?.danceability,
          valence: track.audioFeatures?.valence,
          tempo: track.audioFeatures?.tempo,
          acousticness: track.audioFeatures?.acousticness,
          instrumentalness: track.audioFeatures?.instrumentalness,
          liveness: track.audioFeatures?.liveness,
          speechiness: track.audioFeatures?.speechiness,
          loudness: track.audioFeatures?.loudness,
          mode: track.audioFeatures?.mode,
          key: track.audioFeatures?.key,
          timeSignature: track.audioFeatures?.time_signature,
        };

        if (existingSong) {
          // Update existing song
          await prisma.song.update({
            where: { spotifyId: track.id },
            data: trackData
          });
          result.songsUpdated++;
        } else {
          // Create new song
          await prisma.song.create({
            data: trackData
          });
          result.songsCreated++;
        }

        console.log(`✅ Processed: ${track.name} - ${track.album.name}`);

      } catch (error) {
        console.error(`❌ Error processing track ${track.name}:`, error);
        result.errors.push({
          track: track.name,
          error: error.message
        });
      }
    }

    // Update genres and moods
    await updateGenresAndMoods(discography.tracks);

  } catch (error) {
    console.error('Error in Spotify catalog sync:', error);
    result.errors.push({ error: error.message });
  }

  return result;
}

/**
 * Sync SoundCloud catalog (placeholder for future implementation)
 */
async function syncSoundCloudCatalog(forceUpdate = false, maxAge = 24 * 60 * 60 * 1000) {
  // This is a placeholder for SoundCloud integration
  // Will be implemented when SoundCloud API is added
  
  console.log('🎧 SoundCloud sync not yet implemented');
  
  return {
    songsProcessed: 0,
    songsCreated: 0,
    songsUpdated: 0,
    songsSkipped: 0,
    errors: [{ error: 'SoundCloud sync not yet implemented' }]
  };
}

/**
 * Clean up old or invalid data
 */
async function cleanupOldData() {
  try {
    console.log('🧹 Cleaning up old data...');

    // Remove songs without any platform IDs (orphaned data)
    const orphanedSongs = await prisma.song.deleteMany({
      where: {
        AND: [
          { spotifyId: null },
          { soundcloudId: null },
          { youtubeId: null }
        ]
      }
    });

    // Remove interactions for deleted songs
    const deletedInteractions = await prisma.userSongInteraction.deleteMany({
      where: {
        song: null
      }
    });

    // Remove likes for deleted songs
    const deletedLikes = await prisma.userSongLike.deleteMany({
      where: {
        song: null
      }
    });

    console.log(`✅ Cleanup completed: ${orphanedSongs.count} orphaned songs, ${deletedInteractions.count} interactions, ${deletedLikes.count} likes removed`);

  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

/**
 * Update sync statistics
 */
async function updateSyncStats(results) {
  try {
    // This could be stored in a separate sync_logs table
    // For now, we'll just log the results
    console.log('📊 Sync Statistics:', {
      timestamp: new Date().toISOString(),
      totalTime: results.summary.totalTime,
      songsProcessed: results.summary.songsProcessed,
      songsCreated: results.summary.songsCreated,
      songsUpdated: results.summary.songsUpdated,
      songsSkipped: results.summary.songsSkipped,
      errors: results.errors.length
    });

    // In a production system, you might want to store this in a database
    // or send it to a monitoring service

  } catch (error) {
    console.error('Error updating sync stats:', error);
  }
}

/**
 * Map Spotify album type to our ReleaseType enum
 */
function mapReleaseType(spotifyAlbumType) {
  const mapping = {
    'album': 'ALBUM',
    'single': 'SINGLE',
    'compilation': 'COMPILATION'
  };
  return mapping[spotifyAlbumType] || 'ALBUM';
}

/**
 * Update genres and moods based on audio features
 */
async function updateGenresAndMoods(tracks) {
  try {
    console.log('🎭 Updating genres and moods...');

    // Define genre/mood mapping based on audio features
    const genreRules = [
      { name: 'Trap', condition: (f) => f.tempo >= 140 && f.tempo <= 180 && f.energy >= 0.6 },
      { name: 'Hip-Hop', condition: (f) => f.speechiness >= 0.33 && f.tempo >= 60 && f.tempo <= 140 },
      { name: 'Rap', condition: (f) => f.speechiness >= 0.66 && f.energy >= 0.5 },
      { name: 'R&B', condition: (f) => f.valence >= 0.4 && f.valence <= 0.8 && f.danceability >= 0.6 },
      { name: 'Pop', condition: (f) => f.popularity >= 70 && f.valence >= 0.5 && f.danceability >= 0.5 },
    ];

    const moodRules = [
      { name: 'Energetic', condition: (f) => f.energy >= 0.7 },
      { name: 'Chill', condition: (f) => f.energy <= 0.4 && f.valence >= 0.4 },
      { name: 'Sad', condition: (f) => f.valence <= 0.3 },
      { name: 'Happy', condition: (f) => f.valence >= 0.7 },
      { name: 'Danceable', condition: (f) => f.danceability >= 0.7 },
      { name: 'Aggressive', condition: (f) => f.energy >= 0.8 && f.valence <= 0.4 },
    ];

    for (const track of tracks) {
      if (!track.audioFeatures) continue;

      const features = track.audioFeatures;
      const assignedGenres = [];
      const assignedMoods = [];

      // Apply genre rules
      for (const rule of genreRules) {
        if (rule.condition(features)) {
          assignedGenres.push(rule.name);
        }
      }

      // Apply mood rules
      for (const rule of moodRules) {
        if (rule.condition(features)) {
          assignedMoods.push(rule.name);
        }
      }

      // Update database
      if (assignedGenres.length > 0 || assignedMoods.length > 0) {
        try {
          const song = await prisma.song.findUnique({
            where: { spotifyId: track.id },
            include: { genres: true, moods: true }
          });

          if (song) {
            // Update genres
            for (const genreName of assignedGenres) {
              let genre = await prisma.genre.findUnique({ where: { name: genreName } });
              if (!genre) {
                genre = await prisma.genre.create({
                  data: { 
                    name: genreName, 
                    slug: genreName.toLowerCase().replace(/\s+/g, '-')
                  }
                });
              }

              await prisma.songGenre.upsert({
                where: { songId_genreId: { songId: song.id, genreId: genre.id } },
                update: {},
                create: { songId: song.id, genreId: genre.id }
              });
            }

            // Update moods
            for (const moodName of assignedMoods) {
              let mood = await prisma.mood.findUnique({ where: { name: moodName } });
              if (!mood) {
                mood = await prisma.mood.create({
                  data: { 
                    name: moodName, 
                    slug: moodName.toLowerCase().replace(/\s+/g, '-')
                  }
                });
              }

              await prisma.songMood.upsert({
                where: { songId_moodId: { songId: song.id, moodId: mood.id } },
                update: {},
                create: { songId: song.id, moodId: mood.id }
              });
            }
          }
        } catch (error) {
          console.error(`Error updating genres/moods for track ${track.name}:`, error);
        }
      }
    }

    console.log('✅ Genres and moods updated');
  } catch (error) {
    console.error('Error updating genres and moods:', error);
  }
}
