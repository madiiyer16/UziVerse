#!/usr/bin/env node

/**
 * Check Spotify App Settings
 * Helps verify your Spotify app configuration
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

async function main() {
  console.log('🔍 Checking Spotify App Configuration...\n');

  // Check environment variables
  console.log('1️⃣ Environment Variables:');
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error('❌ Missing Spotify credentials');
    console.log('   Please add to your .env.local file:');
    console.log('   SPOTIFY_CLIENT_ID=your_client_id');
    console.log('   SPOTIFY_CLIENT_SECRET=your_client_secret');
    return;
  }
  console.log('✅ Environment variables found');
  console.log(`   Client ID: ${process.env.SPOTIFY_CLIENT_ID.substring(0, 8)}...`);
  console.log(`   Client Secret: ${process.env.SPOTIFY_CLIENT_SECRET.substring(0, 8)}...`);

  // Test authentication
  console.log('\n2️⃣ Testing Authentication:');
  try {
    const token = await getSpotifyToken();
    console.log('✅ Authentication successful');
    console.log(`   Token: ${token.substring(0, 20)}...`);
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    console.log('\n🔧 Possible solutions:');
    console.log('   1. Check your Client ID and Secret are correct');
    console.log('   2. Make sure your Spotify app is active');
    console.log('   3. Verify your app is not in development mode (if applicable)');
    return;
  }

  // Test basic API access
  console.log('\n3️⃣ Testing Basic API Access:');
  try {
    const token = await getSpotifyToken();
    const response = await fetch('https://api.spotify.com/v1/tracks/4iV5W9uYEdYUVa79Axb7Rh', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      console.log('✅ Basic API access working');
    } else {
      console.error(`❌ Basic API access failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('❌ Basic API test failed:', error.message);
  }

  // Test audio features access
  console.log('\n4️⃣ Testing Audio Features Access:');
  try {
    const token = await getSpotifyToken();
    const response = await fetch('https://api.spotify.com/v1/audio-features/4iV5W9uYEdYUVa79Axb7Rh', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      console.log('✅ Audio features access working');
      const data = await response.json();
      console.log(`   Sample data: Energy=${data.energy}, Danceability=${data.danceability}`);
    } else {
      console.error(`❌ Audio features access failed: ${response.status} ${response.statusText}`);
      
      if (response.status === 403) {
        console.log('\n🔧 403 Forbidden - Check your Spotify app settings:');
        console.log('   1. Go to https://developer.spotify.com/dashboard');
        console.log('   2. Click on your app');
        console.log('   3. Check "App Status" - should be "Active"');
        console.log('   4. Check "App Type" - should be "Web API"');
        console.log('   5. Make sure you have the right permissions');
      }
    }
  } catch (error) {
    console.error('❌ Audio features test failed:', error.message);
  }

  // Test with the specific track that failed
  console.log('\n5️⃣ Testing Your Specific Track:');
  try {
    const token = await getSpotifyToken();
    const response = await fetch('https://api.spotify.com/v1/audio-features/6hu1bJBNMeXIepHr1joKW4', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      console.log('✅ Your specific track is accessible!');
      const data = await response.json();
      console.log(`   Energy: ${data.energy}`);
      console.log(`   Danceability: ${data.danceability}`);
      console.log(`   Valence: ${data.valence}`);
      console.log(`   Tempo: ${data.tempo}`);
    } else {
      console.error(`❌ Your specific track failed: ${response.status} ${response.statusText}`);
      
      if (response.status === 403) {
        console.log('\n🔧 This specific track is not accessible. Possible reasons:');
        console.log('   1. Track might be region-restricted');
        console.log('   2. Track might be unavailable in your country');
        console.log('   3. Track might be from a restricted album');
        console.log('   4. Track might be a leaked/unreleased version');
        
        console.log('\n💡 Try using a different track or search for accessible Lil Uzi Vert tracks');
      }
    }
  } catch (error) {
    console.error('❌ Specific track test failed:', error.message);
  }

  console.log('\n📋 Next Steps:');
  console.log('1. If authentication works but specific track fails, try a different track');
  console.log('2. Run: node scripts/test-with-known-tracks.js');
  console.log('3. Check your Spotify app settings at https://developer.spotify.com/dashboard');
  console.log('4. Make sure your app is active and has the right permissions');
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

main();
