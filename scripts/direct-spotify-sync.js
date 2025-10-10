#!/usr/bin/env node

/**
 * Direct Spotify Audio Features Sync Script
 * This script directly updates the database without going through the API
 * Use this if the API endpoints aren't working
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Spotify API client (simplified version)
class SpotifyClient {
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.baseURL = 'https://api.spotify.com/v1';
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials'
      });

      if (!response.ok) {
        throw new Error(`Spotify auth failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000;

      return this.accessToken;
    } catch (error) {
      console.error('Error getting Spotify access token:', error);
      throw error;
    }
  }

  async makeRequest(endpoint, options = {}) {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getAudioFeatures(trackIds) {
    if (trackIds.length === 0) return [];

    try {
      const chunks = [];
      for (let i = 0; i < trackIds.length; i += 100) {
        chunks.push(trackIds.slice(i, i + 100));
      }

      const allFeatures = [];
      for (const chunk of chunks) {
        const data = await this.makeRequest(`/audio-features?ids=${chunk.join(',')}`);
        allFeatures.push(...data.audio_features.filter(f => f !== null));
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return allFeatures;
    } catch (error) {
      console.error('Error fetching audio features:', error);
      return [];
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 50,
    maxSongs: parseInt(args.find(arg => arg.startsWith('--max-songs='))?.split('=')[1]) || null,
    force: args.includes('--force')
  };

  console.log('🎵 Direct Spotify Audio Features Sync');
  console.log('Options:', options);

  try {
    // Check Spotify credentials
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      console.error('❌ Missing Spotify credentials. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.');
      process.exit(1);
    }

    // Get songs with missing audio features
    console.log('\n📊 Getting songs with missing audio features...');
    const songsWithMissingFeatures = await getSongsWithMissingAudioFeatures(options.maxSongs);
    
    if (songsWithMissingFeatures.length === 0) {
      console.log('✅ No songs with missing audio features found!');
      return;
    }

    console.log(`📊 Found ${songsWithMissingFeatures.length} songs with missing audio features`);

    // Initialize Spotify client
    const spotifyClient = new SpotifyClient();
    console.log('🔑 Authenticating with Spotify...');
    await spotifyClient.getAccessToken();
    console.log('✅ Spotify authentication successful');

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
      console.log(`   Songs: ${batch.map(s => s.title).join(', ')}`);

      const batchResults = await processBatch(batch, spotifyClient, options);
      results.processed += batchResults.processed;
      results.updated += batchResults.updated;
      results.skipped += batchResults.skipped;
      results.errors += batchResults.errors;
      results.errorDetails.push(...batchResults.errorDetails);
    }

    console.log('\n🎉 Direct sync completed!');
    console.log('Results:', results);

    // Show final statistics
    const finalStats = await getStats();
    console.log('\n📊 Final Statistics:');
    console.log(`Total songs: ${finalStats.totalSongs}`);
    console.log(`Songs with complete audio features: ${finalStats.songsWithCompleteAudioFeatures}`);
    console.log(`Completion rate: ${finalStats.completionRate}%`);

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

async function processBatch(songs, spotifyClient, options) {
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

    console.log(`✅ Retrieved ${audioFeatures.length} audio features from Spotify`);

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
        const needsUpdate = shouldUpdateSong(song, features, options.force);
        
        if (!needsUpdate) {
          console.log(`⏭️ Skipping ${song.title} - no update needed`);
          results.skipped++;
          continue;
        }

        if (options.dryRun) {
          console.log(`[DRY RUN] Would update ${song.title} with:`, {
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

        console.log(`✅ Updated ${song.title} - Energy: ${features.energy}, Dance: ${features.danceability}, Valence: ${features.valence}, Tempo: ${features.tempo}`);
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
🎵 Direct Spotify Audio Features Sync

This script directly updates your database without going through the API.

Usage: node scripts/direct-spotify-sync.js [options]

Options:
  --dry-run              Test the sync without making changes
  --batch-size=N         Process N songs at a time (default: 50)
  --max-songs=N          Limit to N songs (default: all)
  --force                Force update even if features exist
  --help, -h             Show this help message

Examples:
  node scripts/direct-spotify-sync.js --dry-run --max-songs=5
  node scripts/direct-spotify-sync.js --batch-size=25 --max-songs=100
  node scripts/direct-spotify-sync.js --force

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
