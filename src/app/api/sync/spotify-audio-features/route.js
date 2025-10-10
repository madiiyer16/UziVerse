import { NextResponse } from 'next/server';
import { spotifyClient } from '@/lib/spotify';
import { prisma } from '@/lib/prisma';

/**
 * Fill missing audio features for existing songs using Spotify API
 * POST /api/sync/spotify-audio-features
 */
export async function POST(request) {
  try {
    const { 
      batchSize = 50, 
      maxSongs = null, 
      dryRun = false,
      force = false 
    } = await request.json();

    console.log('🎵 Starting Spotify audio features sync...', { batchSize, maxSongs, dryRun, force });

    // Get songs with missing audio features
    const songsWithMissingFeatures = await getSongsWithMissingAudioFeatures(maxSongs);
    
    if (songsWithMissingFeatures.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No songs with missing audio features found',
        data: { processed: 0, updated: 0, errors: 0 }
      });
    }

    console.log(`📊 Found ${songsWithMissingFeatures.length} songs with missing audio features`);

    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: []
    };

    // Process in batches
    for (let i = 0; i < songsWithMissingFeatures.length; i += batchSize) {
      const batch = songsWithMissingFeatures.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(songsWithMissingFeatures.length / batchSize)}`);

      const batchResults = await processBatch(batch, dryRun, force);
      results.processed += batchResults.processed;
      results.updated += batchResults.updated;
      results.skipped += batchResults.skipped;
      results.errors += batchResults.errors;
      results.errorDetails.push(...batchResults.errorDetails);
    }

    console.log('🎉 Spotify audio features sync completed!', results);

    return NextResponse.json({
      success: true,
      message: 'Spotify audio features sync completed',
      data: results
    });

  } catch (error) {
    console.error('❌ Spotify audio features sync failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Spotify audio features sync failed', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Get songs with missing audio features
 */
async function getSongsWithMissingAudioFeatures(maxSongs = null) {
  const whereClause = {
    AND: [
      { spotifyId: { not: null } }, // Only songs with Spotify ID
      {
        OR: [
          { energy: null },
          { energy: 0 },
          { danceability: null },
          { danceability: 0 },
          { valence: null },
          { valence: 0 },
          { tempo: null },
          { tempo: 0 },
          { acousticness: null },
          { instrumentalness: null },
          { liveness: null },
          { speechiness: null },
          { loudness: null },
          { mode: null },
          { key: null },
          { timeSignature: null }
        ]
      }
    ]
  };

  const songs = await prisma.song.findMany({
    where: whereClause,
    select: {
      id: true,
      title: true,
      artist: true,
      album: true,
      spotifyId: true,
      energy: true,
      danceability: true,
      valence: true,
      tempo: true,
      acousticness: true,
      instrumentalness: true,
      liveness: true,
      speechiness: true,
      loudness: true,
      mode: true,
      key: true,
      timeSignature: true
    },
    take: maxSongs,
    orderBy: { createdAt: 'desc' }
  });

  return songs;
}

/**
 * Process a batch of songs
 */
async function processBatch(songs, dryRun = false, force = false) {
  const results = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: []
  };

  // Get Spotify IDs for this batch
  const spotifyIds = songs.map(song => song.spotifyId).filter(id => id);
  
  if (spotifyIds.length === 0) {
    results.skipped = songs.length;
    return results;
  }

  try {
    // Fetch audio features from Spotify
    console.log(`🎵 Fetching audio features for ${spotifyIds.length} tracks...`);
    const audioFeatures = await spotifyClient.getAudioFeatures(spotifyIds);
    
    // Create a map of Spotify ID to audio features
    const featuresMap = new Map();
    audioFeatures.forEach(features => {
      if (features && features.id) {
        featuresMap.set(features.id, features);
      }
    });

    // Update each song with its audio features
    for (const song of songs) {
      try {
        results.processed++;
        
        const features = featuresMap.get(song.spotifyId);
        
        if (!features) {
          console.log(`⚠️ No audio features found for ${song.title} (${song.spotifyId})`);
          results.skipped++;
          continue;
        }

        // Check if song needs updating
        const needsUpdate = shouldUpdateSong(song, features, force);
        
        if (!needsUpdate) {
          results.skipped++;
          continue;
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would update ${song.title} with audio features:`, {
            energy: features.energy,
            danceability: features.danceability,
            valence: features.valence,
            tempo: features.tempo
          });
          results.updated++;
          continue;
        }

        // Update song with audio features
        const updateData = {
          energy: features.energy,
          danceability: features.danceability,
          valence: features.valence,
          tempo: features.tempo,
          acousticness: features.acousticness,
          instrumentalness: features.instrumentalness,
          liveness: features.liveness,
          speechiness: features.speechiness,
          loudness: features.loudness,
          mode: features.mode,
          key: features.key,
          timeSignature: features.time_signature
        };

        await prisma.song.update({
          where: { id: song.id },
          data: updateData
        });

        console.log(`✅ Updated ${song.title} with audio features`);
        results.updated++;

      } catch (error) {
        console.error(`❌ Error processing song ${song.title}:`, error);
        results.errors++;
        results.errorDetails.push({
          songId: song.id,
          title: song.title,
          error: error.message
        });
      }
    }

  } catch (error) {
    console.error('Error fetching audio features from Spotify:', error);
    results.errors = songs.length;
    results.errorDetails.push({
      error: 'Failed to fetch audio features from Spotify',
      details: error.message
    });
  }

  return results;
}

/**
 * Check if song needs updating
 */
function shouldUpdateSong(song, features, force = false) {
  if (force) return true;

  // Check if any key audio features are missing or zero
  const keyFeatures = ['energy', 'danceability', 'valence', 'tempo'];
  
  for (const feature of keyFeatures) {
    const currentValue = song[feature];
    const newValue = features[feature];
    
    if (currentValue === null || currentValue === undefined || currentValue === 0) {
      if (newValue !== null && newValue !== undefined && newValue > 0) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get statistics about missing audio features
 * GET /api/sync/spotify-audio-features
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('includeDetails') === 'true';

    // Get statistics
    const totalSongs = await prisma.song.count();
    const songsWithSpotifyId = await prisma.song.count({
      where: { spotifyId: { not: null } }
    });

    const songsWithCompleteAudioFeatures = await prisma.song.count({
      where: {
        AND: [
          { energy: { not: null, gt: 0 } },
          { danceability: { not: null, gt: 0 } },
          { valence: { not: null, gt: 0 } },
          { tempo: { not: null, gt: 0 } }
        ]
      }
    });

    const songsWithMissingAudioFeatures = await prisma.song.count({
      where: {
        AND: [
          { spotifyId: { not: null } },
          {
            OR: [
              { energy: null },
              { energy: 0 },
              { danceability: null },
              { danceability: 0 },
              { valence: null },
              { valence: 0 },
              { tempo: null },
              { tempo: 0 }
            ]
          }
        ]
      }
    });

    const stats = {
      totalSongs,
      songsWithSpotifyId,
      songsWithCompleteAudioFeatures,
      songsWithMissingAudioFeatures,
      completionRate: totalSongs > 0 ? Math.round((songsWithCompleteAudioFeatures / totalSongs) * 100) : 0,
      spotifyCompletionRate: songsWithSpotifyId > 0 ? Math.round((songsWithCompleteAudioFeatures / songsWithSpotifyId) * 100) : 0
    };

    let details = null;
    if (includeDetails) {
      // Get sample songs with missing features
      const sampleSongs = await prisma.song.findMany({
        where: {
          AND: [
            { spotifyId: { not: null } },
            {
              OR: [
                { energy: null },
                { energy: 0 },
                { danceability: null },
                { danceability: 0 },
                { valence: null },
                { valence: 0 },
                { tempo: null },
                { tempo: 0 }
              ]
            }
          ]
        },
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          spotifyId: true,
          energy: true,
          danceability: true,
          valence: true,
          tempo: true
        },
        take: 10,
        orderBy: { createdAt: 'desc' }
      });

      details = {
        sampleSongsWithMissingFeatures: sampleSongs
      };
    }

    return NextResponse.json({
      success: true,
      stats,
      ...(details && { details })
    });

  } catch (error) {
    console.error('Error getting audio features statistics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get audio features statistics', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
