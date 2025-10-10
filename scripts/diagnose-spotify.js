#!/usr/bin/env node

/**
 * Spotify API Diagnostic Script
 * Helps diagnose 403 Forbidden errors and other Spotify API issues
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

async function main() {
  try {
    console.log('🔍 Diagnosing Spotify API issues...\n');

    // Check environment variables
    console.log('1️⃣ Checking environment variables...');
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      console.error('❌ Missing Spotify credentials in environment variables');
      console.log('   Make sure you have SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local');
      return;
    }
    console.log('✅ Environment variables found');
    console.log(`   Client ID: ${process.env.SPOTIFY_CLIENT_ID.substring(0, 8)}...`);
    console.log(`   Client Secret: ${process.env.SPOTIFY_CLIENT_SECRET.substring(0, 8)}...`);

    // Test authentication
    console.log('\n2️⃣ Testing Spotify authentication...');
    const token = await getSpotifyToken();
    console.log('✅ Authentication successful');
    console.log(`   Token: ${token.substring(0, 20)}...`);

    // Test basic API access
    console.log('\n3️⃣ Testing basic API access...');
    await testBasicAPI(token);

    // Test audio features access
    console.log('\n4️⃣ Testing audio features access...');
    await testAudioFeaturesAccess(token);

    // Test with different tracks
    console.log('\n5️⃣ Testing with different tracks...');
    await testDifferentTracks(token);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
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
    const errorText = await response.text();
    throw new Error(`Spotify auth failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function testBasicAPI(token) {
  try {
    // Test with a well-known track
    const response = await fetch('https://api.spotify.com/v1/tracks/4iV5W9uYEdYUVa79Axb7Rh', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Basic API access working');
      console.log(`   Test track: ${data.name} by ${data.artists[0].name}`);
    } else {
      console.error(`❌ Basic API access failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`   Error details: ${errorText}`);
    }
  } catch (error) {
    console.error('❌ Basic API test failed:', error.message);
  }
}

async function testAudioFeaturesAccess(token) {
  try {
    // Test with a well-known track that should have audio features
    const response = await fetch('https://api.spotify.com/v1/audio-features/4iV5W9uYEdYUVa79Axb7Rh', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Audio features access working');
      console.log(`   Energy: ${data.energy}`);
      console.log(`   Danceability: ${data.danceability}`);
      console.log(`   Valence: ${data.valence}`);
      console.log(`   Tempo: ${data.tempo}`);
    } else {
      console.error(`❌ Audio features access failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`   Error details: ${errorText}`);
      
      if (response.status === 403) {
        console.log('\n🔧 403 Forbidden - Possible causes:');
        console.log('   1. Your Spotify app might not have the right permissions');
        console.log('   2. The track might not be available in your region');
        console.log('   3. The track might be restricted or unavailable');
        console.log('   4. Your Spotify app might be in development mode');
      }
    }
  } catch (error) {
    console.error('❌ Audio features test failed:', error.message);
  }
}

async function testDifferentTracks(token) {
  const testTracks = [
    { id: '4iV5W9uYEdYUVa79Axb7Rh', name: 'Never Gonna Give You Up' }, // Rick Astley - should be available
    { id: '6hu1bJBNMeXIepHr1joKW4', name: 'Meteor Man - Eternal Atake 2' }, // Your original track
    { id: '0VjIjW4X0XgVjJ4Q1Q2Q3Q', name: 'Test Track (Invalid ID)' } // Invalid ID for testing
  ];

  for (const track of testTracks) {
    try {
      console.log(`\n   Testing track: ${track.name} (${track.id})`);
      
      const response = await fetch(`https://api.spotify.com/v1/audio-features/${track.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Success - Energy: ${data.energy}, Danceability: ${data.danceability}`);
      } else {
        console.log(`   ❌ Failed - ${response.status} ${response.statusText}`);
        if (response.status === 403) {
          console.log('      This track is not accessible (403 Forbidden)');
        } else if (response.status === 404) {
          console.log('      Track not found (404 Not Found)');
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🔍 Spotify API Diagnostic Script

This script helps diagnose Spotify API issues, especially 403 Forbidden errors.

Usage: node scripts/diagnose-spotify.js

What it tests:
1. Environment variables
2. Authentication
3. Basic API access
4. Audio features access
5. Different tracks

Environment Variables Required:
  SPOTIFY_CLIENT_ID      Your Spotify app client ID
  SPOTIFY_CLIENT_SECRET  Your Spotify app client secret
`);
  process.exit(0);
}

main();
