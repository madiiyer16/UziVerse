#!/usr/bin/env node

/**
 * Test Spotify Update Script
 * Test updating a single song with Spotify audio features
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🧪 Testing Spotify audio features update...\n');

    // Check Spotify credentials
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      console.error('❌ Missing Spotify credentials. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.');
      process.exit(1);
    }

    // Get a song with Spotify ID but missing audio features
    const song = await prisma.song.findFirst({
      where: {
        AND: [
          { spotifyId: { not: null } },
          {
            OR: [
              { energy: null },
              { energy: 0 },
              { danceability: null },
              { danceability: 0 }
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
      }
    });

    if (!song) {
      console.log('❌ No songs found with missing audio features');
      return;
    }

    console.log(`🎵 Testing with song: ${song.title} - ${song.album}`);
    console.log(`   Spotify ID: ${song.spotifyId}`);
    console.log(`   Current Energy: ${song.energy}`);
    console.log(`   Current Danceability: ${song.danceability}`);
    console.log(`   Current Valence: ${song.valence}`);
    console.log(`   Current Tempo: ${song.tempo}`);

    // Get audio features from Spotify
    console.log('\n🔑 Getting access token...');
    const token = await getSpotifyToken();
    console.log('✅ Access token obtained');

    console.log('\n🎵 Fetching audio features from Spotify...');
    const features = await getSpotifyAudioFeatures(song.spotifyId, token);
    
    if (!features) {
      console.log('❌ No audio features found for this song');
      return;
    }

    console.log('✅ Audio features retrieved:');
    console.log(`   Energy: ${features.energy}`);
    console.log(`   Danceability: ${features.danceability}`);
    console.log(`   Valence: ${features.valence}`);
    console.log(`   Tempo: ${features.tempo}`);
    console.log(`   Acousticness: ${features.acousticness}`);
    console.log(`   Instrumentalness: ${features.instrumentalness}`);
    console.log(`   Liveness: ${features.liveness}`);
    console.log(`   Speechiness: ${features.speechiness}`);
    console.log(`   Loudness: ${features.loudness}`);
    console.log(`   Mode: ${features.mode}`);
    console.log(`   Key: ${features.key}`);
    console.log(`   Time Signature: ${features.time_signature}`);

    // Update the song
    console.log('\n💾 Updating song in database...');
    const updatedSong = await prisma.song.update({
      where: { id: song.id },
      data: {
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
      }
    });

    console.log('✅ Song updated successfully!');
    console.log('\n📊 Updated values:');
    console.log(`   Energy: ${updatedSong.energy}`);
    console.log(`   Danceability: ${updatedSong.danceability}`);
    console.log(`   Valence: ${updatedSong.valence}`);
    console.log(`   Tempo: ${updatedSong.tempo}`);

    console.log('\n🎉 Test completed successfully!');
    console.log('💡 You can now run the full sync script: node scripts/direct-spotify-sync.js');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

async function getSpotifyToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function getSpotifyAudioFeatures(trackId, token) {
  const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

main();
