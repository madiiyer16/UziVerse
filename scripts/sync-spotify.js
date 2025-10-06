#!/usr/bin/env node

/**
 * Spotify Sync Script
 * Run this script to sync Lil Uzi Vert's discography from Spotify
 */

const https = require('https');
const http = require('http');

const SPOTIFY_SYNC_URL = 'http://127.0.0.1:3000/api/sync/spotify';
const AUDIO_FEATURES_URL = 'http://127.0.0.1:3000/api/sync/spotify-audio-features';

async function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(url, options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: response });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    skipAudioFeatures: args.includes('--skip-audio-features'),
    audioFeaturesOnly: args.includes('--audio-features-only'),
    maxSongs: parseInt(args.find(arg => arg.startsWith('--max-songs='))?.split('=')[1]) || null
  };

  console.log('🎵 Spotify Sync Script');
  console.log('Options:', options);

  try {
    // Step 1: Sync basic discography (unless audio features only)
    if (!options.audioFeaturesOnly) {
      console.log('\n📀 Step 1: Syncing Lil Uzi Vert discography...');
      const syncResult = await makeRequest(SPOTIFY_SYNC_URL, { 
        dryRun: options.dryRun 
      });
      
      if (syncResult.status === 200 && syncResult.data.success) {
        console.log('✅ Discography sync completed!');
        console.log('Results:', syncResult.data.data.results);
      } else {
        console.error('❌ Discography sync failed:', syncResult.data.error);
        return;
      }
    }

    // Step 2: Fill missing audio features (unless skipped)
    if (!options.skipAudioFeatures) {
      console.log('\n🎵 Step 2: Filling missing audio features...');
      const audioFeaturesResult = await makeRequest(AUDIO_FEATURES_URL, {
        dryRun: options.dryRun,
        maxSongs: options.maxSongs,
        batchSize: 50
      });
      
      if (audioFeaturesResult.status === 200 && audioFeaturesResult.data.success) {
        console.log('✅ Audio features sync completed!');
        console.log('Results:', audioFeaturesResult.data.data);
      } else {
        console.error('❌ Audio features sync failed:', audioFeaturesResult.data.error);
        return;
      }
    }

    console.log('\n🎉 All sync operations completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('1. Check your database to see the updated songs');
    console.log('2. Visit /for-you to see AI-enhanced recommendations');
    console.log('3. Run the sync again anytime to update with new releases');

  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Make sure your Next.js server is running: npm run dev');
    console.log('2. Check if the server is running on port 3000');
    console.log('3. Verify your Spotify API credentials in .env.local');
    console.log('4. Try accessing http://127.0.0.1:3000 in your browser');
  }
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🎵 Spotify Sync Script

Usage: node scripts/sync-spotify.js [options]

Options:
  --dry-run              Test the sync without making changes
  --skip-audio-features  Skip filling missing audio features
  --audio-features-only  Only fill missing audio features (skip discography sync)
  --max-songs=N          Limit audio features sync to N songs
  --help, -h             Show this help message

Examples:
  node scripts/sync-spotify.js --dry-run
  node scripts/sync-spotify.js --audio-features-only --max-songs=50
  node scripts/sync-spotify.js --skip-audio-features

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
