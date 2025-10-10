#!/usr/bin/env node

/**
 * Test Spotify API with Development Mode Compatible Tracks
 * These tracks should work even in development mode
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Tracks that should work in development mode (official releases, popular tracks)
const DEV_MODE_TRACKS = [
  { id: '4iV5W9uYEdYUVa79Axb7Rh', name: 'Never Gonna Give You Up', artist: 'Rick Astley' },
  { id: '3n3Ppam7vgaVa1iaRUpq9s', name: 'Blinding Lights', artist: 'The Weeknd' },
  { id: '1mea3bSkSGXuIRvnydlB5b', name: 'Watermelon Sugar', artist: 'Harry Styles' },
  { id: '0VjIjW4X0XgVjJ4Q1Q2Q3Q', name: 'Test Track (Invalid)', artist: 'Test Artist' }, // This should fail
  { id: '4uLU6hMCjMI75M1A2tKUQC', name: 'Levitating', artist: 'Dua Lipa' },
  { id: '1rqqCSm0Qe4I9rUvWncaom', name: 'Good 4 U', artist: 'Olivia Rodrigo' }
];

async function main() {
  try {
    console.log('🧪 Testing Spotify API with Development Mode Compatible Tracks...\n');

    // Check Spotify credentials
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      console.error('❌ Missing Spotify credentials. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.');
      process.exit(1);
    }

    // Get access token
    console.log('🔑 Getting access token...');
    const token = await getSpotifyToken();
    console.log('✅ Access token obtained');

    // Test with development mode compatible tracks
    console.log('\n🎵 Testing with Development Mode Compatible Tracks...');
    let workingTracks = [];
    
    for (const track of DEV_MODE_TRACKS) {
      const result = await testTrack(track, token);
      if (result.works) {
        workingTracks.push(result);
      }
    }

    console.log(`\n📊 Results: ${workingTracks.length}/${DEV_MODE_TRACKS.length} tracks worked`);

    if (workingTracks.length > 0) {
      console.log('\n✅ Development Mode Compatible Tracks:');
      workingTracks.forEach((track, index) => {
        console.log(`   ${index + 1}. ${track.name} by ${track.artist}`);
        console.log(`      Energy: ${track.audioData.energy}, Danceability: ${track.audioData.danceability}`);
      });

      // Test database update with first working track
      console.log('\n💾 Testing database update...');
      await testDatabaseUpdate(workingTracks[0]);
    } else {
      console.log('\n❌ No tracks worked. This might indicate:');
      console.log('   1. Your Spotify app has very strict development mode restrictions');
      console.log('   2. There might be an issue with your app configuration');
      console.log('   3. You might need to request app review from Spotify');
    }

    // Search for accessible Lil Uzi Vert tracks
    console.log('\n🎵 Searching for accessible Lil Uzi Vert tracks...');
    await searchAccessibleUziTracks(token);

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
      
      return {
        works: true,
        track: track,
        audioData: data
      };
    } else {
      console.log(`   ❌ Failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`      Error: ${errorText}`);
      
      return { works: false, track: track, error: response.status };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { works: false, track: track, error: error.message };
  }
}

async function searchAccessibleUziTracks(token) {
  try {
    // Search for Lil Uzi Vert tracks
    const response = await fetch('https://api.spotify.com/v1/search?q=Lil%20Uzi%20Vert&type=track&limit=20', {
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
    let accessibleTracks = [];
    for (let i = 0; i < Math.min(5, tracks.length); i++) {
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
        
        accessibleTracks.push({
          track: track,
          audioData: audioData
        });
      } else {
        console.log(`   ❌ Audio features not available: ${audioResponse.status} ${audioResponse.statusText}`);
      }
    }

    if (accessibleTracks.length > 0) {
      console.log(`\n🎉 Found ${accessibleTracks.length} accessible Lil Uzi Vert tracks!`);
      console.log('💡 You can use these tracks to test your database updates.');
      
      // Test updating a song in database with first accessible track
      console.log('\n💾 Testing database update with accessible track...');
      await testDatabaseUpdate(accessibleTracks[0]);
    } else {
      console.log('\n❌ No accessible Lil Uzi Vert tracks found in development mode.');
      console.log('💡 Consider requesting app review from Spotify to access more tracks.');
    }
  } catch (error) {
    console.log(`❌ Search error: ${error.message}`);
  }
}

async function testDatabaseUpdate(trackData) {
  try {
    const track = trackData.track || trackData;
    const audioData = trackData.audioData;
    
    console.log(`\n💾 Testing database update with: ${track.name}`);
    
    // Find or create a test song
    let testSong = await prisma.song.findFirst({
      where: { spotifyId: track.id }
    });

    if (!testSong) {
      // Create a test song
      testSong = await prisma.song.create({
        data: {
          title: track.name,
          artist: 'Lil Uzi Vert',
          album: track.album?.name || 'Test Album',
          year: track.album?.release_date ? new Date(track.album.release_date).getFullYear() : 2023,
          spotifyId: track.id,
          imageUrl: track.album?.images?.[0]?.url,
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
    console.log('💡 Your Spotify API is working in development mode.');
    console.log('💡 You can now run the sync scripts with accessible tracks.');

  } catch (error) {
    console.log(`❌ Database update failed: ${error.message}`);
  }
}

main();
