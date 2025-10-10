#!/usr/bin/env node

/**
 * Script to fill missing audio features using Spotify API
 * Usage: node scripts/fill-spotify-audio-features.js [options]
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 50,
    maxSongs: parseInt(args.find(arg => arg.startsWith('--max-songs='))?.split('=')[1]) || null,
    force: args.includes('--force')
  };

  console.log('🎵 Spotify Audio Features Filler');
  console.log('Options:', options);

  try {
    // Check if we have Spotify credentials
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      console.error('❌ Missing Spotify credentials. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.');
      process.exit(1);
    }

    // Get statistics
    console.log('\n📊 Getting database statistics...');
    const stats = await getStats();
    console.log('Current stats:', stats);

    if (stats.songsWithMissingAudioFeatures === 0) {
      console.log('✅ No songs with missing audio features found!');
      return;
    }

    // Run the sync
    console.log(`\n🚀 Starting sync for ${options.maxSongs || 'all'} songs...`);
    
    const response = await fetch('http://localhost:3000/api/sync/spotify-audio-features', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('\n🎉 Sync completed successfully!');
      console.log('Results:', result.data);
    } else {
      console.error('❌ Sync failed:', result.error);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function getStats() {
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

  return {
    totalSongs,
    songsWithSpotifyId,
    songsWithCompleteAudioFeatures,
    songsWithMissingAudioFeatures,
    completionRate: totalSongs > 0 ? Math.round((songsWithCompleteAudioFeatures / totalSongs) * 100) : 0
  };
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🎵 Spotify Audio Features Filler

Usage: node scripts/fill-spotify-audio-features.js [options]

Options:
  --dry-run              Test the sync without making changes
  --batch-size=N         Process N songs at a time (default: 50)
  --max-songs=N          Limit to N songs (default: all)
  --force                Force update even if features exist
  --help, -h             Show this help message

Examples:
  node scripts/fill-spotify-audio-features.js --dry-run --max-songs=10
  node scripts/fill-spotify-audio-features.js --batch-size=25 --max-songs=100
  node scripts/fill-spotify-audio-features.js --force

Environment Variables Required:
  SPOTIFY_CLIENT_ID      Your Spotify app client ID
  SPOTIFY_CLIENT_SECRET  Your Spotify app client secret
`);
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
