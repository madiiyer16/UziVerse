#!/usr/bin/env node

/**
 * Test Spotify API with known available tracks
 * This script tests with tracks that should definitely be accessible
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Known tracks that should be available on Spotify
const KNOWN_TRACKS = [
  { id: '4iV5W9uYEdYUVa79Axb7Rh', name: 'Never Gonna Give You Up', artist: 'Rick Astley' },
  { id: '0VjIjW4X0XgVjJ4Q1Q2Q3Q', name: 'Test Track (Invalid)', artist: 'Test Artist' }, // This should fail
  { id: '3n3Ppam7vgaVa1iaRUpq9s', name: 'Blinding Lights', artist: 'The Weeknd' },
  { id: '1mea3bSkSGXuIRvnydlB5b', name: 'Watermelon Sugar', artist: 'Harry Styles' }
];

async function main() {
  try {
    console.log('🧪 Testing Spotify API with known tracks...\n');

    // Check Spotify credentials
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      console.error('❌ Missing Spotify credentials. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.');
      process.exit(1);
    }

    // Get access token
    console.log('🔑 Getting access token...');
    const token = await getSpotifyToken();
    console.log('✅ Access token obtained');

    // Test with known tracks
    console.log('\n🎵 Testing with known tracks...');
    for (const track of KNOWN_TRACKS) {
      await testTrack(track, token);
    }

    // Try to find a working Lil Uzi Vert track
    console.log('\n🎵 Searching for accessible Lil Uzi Vert tracks...');
    await findWorkingUziTrack(token);

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
    const errorText = await response.text();
    throw new Error(`Spotify auth failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function testTrack(track, token) {
  try {
    console.log(`\n   Testing: ${track.name} by ${track.artist}`);
    console.log(`   Track ID: ${track.id}`);

    const response = await fetch(`https://api.spotify.com/v1/audio-features/${track.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Success!`);
      console.log(`      Energy: ${data.energy}`);
      console.log(`      Danceability: ${data.danceability}`);
      console.log(`      Valence: ${data.valence}`);
      console.log(`      Tempo: ${data.tempo}`);
      console.log(`      Acousticness: ${data.acousticness}`);
      console.log(`      Instrumentalness: ${data.instrumentalness}`);
      console.log(`      Liveness: ${data.liveness}`);
      console.log(`      Speechiness: ${data.speechiness}`);
      console.log(`      Loudness: ${data.loudness}`);
      console.log(`      Mode: ${data.mode}`);
      console.log(`      Key: ${data.key}`);
      console.log(`      Time Signature: ${data.time_signature}`);
    } else {
      console.log(`   ❌ Failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`      Error: ${errorText}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

async function findWorkingUziTrack(token) {
  try {
    // Search for Lil Uzi Vert tracks
    const response = await fetch('https://api.spotify.com/v1/search?q=Lil%20Uzi%20Vert&type=track&limit=10', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.log(`❌ Search failed: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();
    const tracks = data.tracks.items;

    console.log(`✅ Found ${tracks.length} Lil Uzi Vert tracks`);

    // Test first few tracks
    for (let i = 0; i < Math.min(3, tracks.length); i++) {
      const track = tracks[i];
      console.log(`\n   Testing: ${track.name} - ${track.album.name}`);
      console.log(`   Track ID: ${track.id}`);

      const audioResponse = await fetch(`https://api.spotify.com/v1/audio-features/${track.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (audioResponse.ok) {
        const audioData = await audioResponse.json();
        console.log(`   ✅ Audio features available!`);
        console.log(`      Energy: ${audioData.energy}`);
        console.log(`      Danceability: ${audioData.danceability}`);
        console.log(`      Valence: ${audioData.valence}`);
        console.log(`      Tempo: ${audioData.tempo}`);
        
        // Test updating a song in database with this track
        await testDatabaseUpdate(track, audioData);
        break; // Stop after first successful track
      } else {
        console.log(`   ❌ Audio features not available: ${audioResponse.status} ${audioResponse.statusText}`);
      }
    }
  } catch (error) {
    console.log(`❌ Search error: ${error.message}`);
  }
}

async function testDatabaseUpdate(track, audioData) {
  try {
    console.log('\n💾 Testing database update...');
    
    // Find a song in your database to update (or create a test one)
    let testSong = await prisma.song.findFirst({
      where: { spotifyId: track.id }
    });

    if (!testSong) {
      // Create a test song
      testSong = await prisma.song.create({
        data: {
          title: track.name,
          artist: 'Lil Uzi Vert',
          album: track.album.name,
          year: new Date(track.album.release_date).getFullYear(),
          spotifyId: track.id,
          imageUrl: track.album.images?.[0]?.url,
          duration: Math.round(track.duration_ms / 1000),
          popularity: track.popularity,
          explicit: track.explicit,
          isOfficial: true
        }
      });
      console.log(`   Created test song: ${testSong.title}`);
    } else {
      console.log(`   Found existing song: ${testSong.title}`);
    }

    // Update with audio features
    const updatedSong = await prisma.song.update({
      where: { id: testSong.id },
      data: {
        energy: audioData.energy,
        danceability: audioData.danceability,
        valence: audioData.valence,
        tempo: audioData.tempo,
        acousticness: audioData.acousticness,
        instrumentalness: audioData.instrumentalness,
        liveness: audioData.liveness,
        speechiness: audioData.speechiness,
        loudness: audioData.loudness,
        mode: audioData.mode,
        key: audioData.key,
        timeSignature: audioData.time_signature
      }
    });

    console.log(`   ✅ Database update successful!`);
    console.log(`   Updated song: ${updatedSong.title}`);
    console.log(`   Energy: ${updatedSong.energy}`);
    console.log(`   Danceability: ${updatedSong.danceability}`);
    console.log(`   Valence: ${updatedSong.valence}`);
    console.log(`   Tempo: ${updatedSong.tempo}`);

    console.log('\n🎉 Test completed successfully!');
    console.log('💡 Your Spotify API is working. The issue might be with specific tracks.');

  } catch (error) {
    console.log(`❌ Database update failed: ${error.message}`);
  }
}

main();
