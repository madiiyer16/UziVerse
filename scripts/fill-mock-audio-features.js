#!/usr/bin/env node

/**
 * Fill Mock Audio Features Script
 * This script fills missing audio features with intelligent mock data
 * Use this when Spotify API access is restricted in development mode
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Mock audio features based on song characteristics
const MOCK_AUDIO_FEATURES = {
  // High energy trap/rap songs
  'trap': {
    energy: 0.85,
    danceability: 0.75,
    valence: 0.45,
    tempo: 140,
    acousticness: 0.05,
    instrumentalness: 0.1,
    liveness: 0.15,
    speechiness: 0.7,
    loudness: -5,
    mode: 0,
    key: 0,
    timeSignature: 4
  },
  
  // Medium energy hip-hop
  'hip-hop': {
    energy: 0.65,
    danceability: 0.65,
    valence: 0.5,
    tempo: 120,
    acousticness: 0.1,
    instrumentalness: 0.05,
    liveness: 0.2,
    speechiness: 0.8,
    loudness: -7,
    mode: 0,
    key: 0,
    timeSignature: 4
  },
  
  // High energy pop
  'pop': {
    energy: 0.8,
    danceability: 0.85,
    valence: 0.75,
    tempo: 130,
    acousticness: 0.1,
    instrumentalness: 0.05,
    liveness: 0.15,
    speechiness: 0.3,
    loudness: -4,
    mode: 1,
    key: 0,
    timeSignature: 4
  },
  
  // Chill R&B
  'r&b': {
    energy: 0.5,
    danceability: 0.7,
    valence: 0.6,
    tempo: 100,
    acousticness: 0.3,
    instrumentalness: 0.1,
    liveness: 0.1,
    speechiness: 0.4,
    loudness: -8,
    mode: 1,
    key: 0,
    timeSignature: 4
  },
  
  // Default for unknown
  'default': {
    energy: 0.6,
    danceability: 0.6,
    valence: 0.5,
    tempo: 120,
    acousticness: 0.2,
    instrumentalness: 0.1,
    liveness: 0.15,
    speechiness: 0.5,
    loudness: -6,
    mode: 1,
    key: 0,
    timeSignature: 4
  }
};

async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 50,
    maxSongs: parseInt(args.find(arg => arg.startsWith('--max-songs='))?.split('=')[1]) || null,
    force: args.includes('--force')
  };

  console.log('🎵 Filling Mock Audio Features...');
  console.log('Options:', options);

  try {
    // Get songs with missing audio features
    console.log('\n📊 Getting songs with missing audio features...');
    const songsWithMissingFeatures = await getSongsWithMissingAudioFeatures(options.maxSongs);
    
    if (songsWithMissingFeatures.length === 0) {
      console.log('✅ No songs with missing audio features found!');
      return;
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
    for (let i = 0; i < songsWithMissingFeatures.length; i += options.batchSize) {
      const batch = songsWithMissingFeatures.slice(i, i + options.batchSize);
      console.log(`\n🔄 Processing batch ${Math.floor(i / options.batchSize) + 1}/${Math.ceil(songsWithMissingFeatures.length / options.batchSize)}`);

      const batchResults = await processBatch(batch, options);
      results.processed += batchResults.processed;
      results.updated += batchResults.updated;
      results.skipped += batchResults.skipped;
      results.errors += batchResults.errors;
      results.errorDetails.push(...batchResults.errorDetails);
    }

    console.log('\n🎉 Mock audio features sync completed!');
    console.log('Results:', results);

    // Show final statistics
    const finalStats = await getStats();
    console.log('\n📊 Final Statistics:');
    console.log(`Total songs: ${finalStats.totalSongs}`);
    console.log(`Songs with complete audio features: ${finalStats.songsWithCompleteAudioFeatures}`);
    console.log(`Completion rate: ${finalStats.completionRate}%`);

    console.log('\n💡 Next steps:');
    console.log('1. Check your For You page - AI recommendations should now work!');
    console.log('2. The AI will use these mock features to provide recommendations');
    console.log('3. When you get Spotify API access, you can replace with real data');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function getSongsWithMissingAudioFeatures(maxSongs = null) {
  const whereClause = {
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
  };

  const queryOptions = {
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
    orderBy: { createdAt: 'desc' }
  };

  // Only add take if maxSongs is specified
  if (maxSongs && maxSongs > 0) {
    queryOptions.take = maxSongs;
  }

  const songs = await prisma.song.findMany(queryOptions);

  return songs;
}

async function processBatch(songs, options) {
  const results = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: []
  };

  for (const song of songs) {
    try {
      results.processed++;
      
      // Check if song needs updating
      const needsUpdate = shouldUpdateSong(song, options.force);
      
      if (!needsUpdate) {
        console.log(`⏭️ Skipping ${song.title} - no update needed`);
        results.skipped++;
        continue;
      }

      // Generate mock audio features based on song characteristics
      const mockFeatures = generateMockAudioFeatures(song);
      
      if (options.dryRun) {
        console.log(`[DRY RUN] Would update ${song.title} with mock features:`, {
          energy: mockFeatures.energy,
          danceability: mockFeatures.danceability,
          valence: mockFeatures.valence,
          tempo: mockFeatures.tempo
        });
        results.updated++;
        continue;
      }

      // Update song with mock audio features
      await prisma.song.update({
        where: { id: song.id },
        data: mockFeatures
      });

      console.log(`✅ Updated ${song.title} with mock features - Energy: ${mockFeatures.energy}, Dance: ${mockFeatures.danceability}, Valence: ${mockFeatures.valence}, Tempo: ${mockFeatures.tempo}`);
      results.updated++;

    } catch (error) {
      console.error(`❌ Error processing song ${song.title}:`, error.message);
      results.errors++;
      results.errorDetails.push({
        songId: song.id,
        title: song.title,
        error: error.message
      });
    }
  }

  return results;
}

function shouldUpdateSong(song, force = false) {
  if (force) return true;

  // Check if any key audio features are missing or zero
  const keyFeatures = ['energy', 'danceability', 'valence', 'tempo'];
  
  for (const feature of keyFeatures) {
    const currentValue = song[feature];
    
    if (currentValue === null || currentValue === undefined || currentValue === 0) {
      return true;
    }
  }

  return false;
}

function generateMockAudioFeatures(song) {
  // Determine genre based on song characteristics
  const genre = determineGenre(song);
  
  // Get base features for the genre
  const baseFeatures = MOCK_AUDIO_FEATURES[genre] || MOCK_AUDIO_FEATURES.default;
  
  // Add some variation to make it more realistic
  const features = { ...baseFeatures };
  
  // Add random variation (±10%)
  const variation = 0.1;
  features.energy = Math.max(0, Math.min(1, features.energy + (Math.random() - 0.5) * variation));
  features.danceability = Math.max(0, Math.min(1, features.danceability + (Math.random() - 0.5) * variation));
  features.valence = Math.max(0, Math.min(1, features.valence + (Math.random() - 0.5) * variation));
  features.tempo = Math.max(60, Math.min(200, features.tempo + (Math.random() - 0.5) * 20));
  features.acousticness = Math.max(0, Math.min(1, features.acousticness + (Math.random() - 0.5) * variation));
  features.instrumentalness = Math.max(0, Math.min(1, features.instrumentalness + (Math.random() - 0.5) * variation));
  features.liveness = Math.max(0, Math.min(1, features.liveness + (Math.random() - 0.5) * variation));
  features.speechiness = Math.max(0, Math.min(1, features.speechiness + (Math.random() - 0.5) * variation));
  features.loudness = Math.max(-20, Math.min(0, features.loudness + (Math.random() - 0.5) * 4));
  
  // Random key (0-11)
  features.key = Math.floor(Math.random() * 12);
  
  return features;
}

function determineGenre(song) {
  const title = song.title.toLowerCase();
  const artist = song.artist.toLowerCase();
  const album = song.album?.toLowerCase() || '';
  
  // Check for trap indicators
  if (title.includes('trap') || title.includes('drill') || 
      artist.includes('uzi') || artist.includes('vert') ||
      album.includes('eternal') || album.includes('luv is rage')) {
    return 'trap';
  }
  
  // Check for hip-hop indicators
  if (title.includes('rap') || title.includes('hip') ||
      artist.includes('uzi') || artist.includes('vert')) {
    return 'hip-hop';
  }
  
  // Check for pop indicators
  if (title.includes('pop') || title.includes('dance') ||
      album.includes('pop')) {
    return 'pop';
  }
  
  // Check for R&B indicators
  if (title.includes('r&b') || title.includes('soul') ||
      album.includes('r&b')) {
    return 'r&b';
  }
  
  // Default to hip-hop for Lil Uzi Vert
  if (artist.includes('uzi') || artist.includes('vert')) {
    return 'hip-hop';
  }
  
  return 'default';
}

async function getStats() {
  const totalSongs = await prisma.song.count();
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

  return {
    totalSongs,
    songsWithCompleteAudioFeatures,
    completionRate: totalSongs > 0 ? Math.round((songsWithCompleteAudioFeatures / totalSongs) * 100) : 0
  };
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🎵 Mock Audio Features Filler

This script fills missing audio features with intelligent mock data when Spotify API access is restricted.

Usage: node scripts/fill-mock-audio-features.js [options]

Options:
  --dry-run              Test the sync without making changes
  --batch-size=N         Process N songs at a time (default: 50)
  --max-songs=N          Limit to N songs (default: all)
  --force                Force update even if features exist
  --help, -h             Show this help message

Examples:
  node scripts/fill-mock-audio-features.js --dry-run --max-songs=10
  node scripts/fill-mock-audio-features.js --batch-size=25 --max-songs=100
  node scripts/fill-mock-audio-features.js --force

Features:
- Generates realistic audio features based on song characteristics
- Uses genre-specific templates (trap, hip-hop, pop, R&B)
- Adds random variation to make features unique
- Works without Spotify API access
`);
  process.exit(0);
}

main();
