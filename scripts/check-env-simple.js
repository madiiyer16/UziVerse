#!/usr/bin/env node

/**
 * Simple Environment Variables Check Script
 * Checks environment variables without requiring dotenv package
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Environment Variables (Simple Version)...\n');

// Check if .env.local file exists
console.log('1️⃣ File Check:');
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  console.log('   ✅ .env.local file exists');
  
  // Read and parse .env.local
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  const lines = envContent.split('\n');
  
  console.log('\n2️⃣ Contents of .env.local:');
  let hasSpotifyId = false;
  let hasSpotifySecret = false;
  
  lines.forEach((line, index) => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=');
      
      if (key && value) {
        if (key === 'SPOTIFY_CLIENT_ID') {
          hasSpotifyId = true;
          console.log(`   ✅ ${key}: ${value.substring(0, 8)}...`);
        } else if (key === 'SPOTIFY_CLIENT_SECRET') {
          hasSpotifySecret = true;
          console.log(`   ✅ ${key}: ${value.substring(0, 8)}...`);
        } else {
          console.log(`   📝 ${key}: ${value.substring(0, 20)}${value.length > 20 ? '...' : ''}`);
        }
      }
    }
  });
  
  console.log('\n3️⃣ Spotify Credentials Check:');
  console.log(`   SPOTIFY_CLIENT_ID: ${hasSpotifyId ? '✅ Found' : '❌ Missing'}`);
  console.log(`   SPOTIFY_CLIENT_SECRET: ${hasSpotifySecret ? '✅ Found' : '❌ Missing'}`);
  
  if (hasSpotifyId && hasSpotifySecret) {
    console.log('\n✅ Your .env.local file looks good!');
    console.log('💡 The issue might be that the scripts need to load the environment variables.');
    console.log('   Try running: node scripts/check-spotify-app.js');
  } else {
    console.log('\n❌ Missing Spotify credentials in .env.local');
    console.log('   Make sure you have:');
    console.log('   SPOTIFY_CLIENT_ID=your_client_id');
    console.log('   SPOTIFY_CLIENT_SECRET=your_client_secret');
  }
  
} else {
  console.log('   ❌ .env.local file does not exist');
  console.log('\n💡 Create a .env.local file in your project root with:');
  console.log('   SPOTIFY_CLIENT_ID=your_client_id');
  console.log('   SPOTIFY_CLIENT_SECRET=your_client_secret');
}

if (fs.existsSync(envPath)) {
  console.log('\n   ✅ .env file also exists');
} else {
  console.log('\n   ❌ .env file does not exist');
}

console.log('\n📋 Next Steps:');
console.log('1. Make sure your .env.local file has the correct Spotify credentials');
console.log('2. Run: node scripts/check-spotify-app.js');
console.log('3. If that works, run: node scripts/test-with-known-tracks.js');
