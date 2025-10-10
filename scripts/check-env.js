#!/usr/bin/env node

/**
 * Environment Variables Check Script
 * Verifies that environment variables are being loaded correctly
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Checking Environment Variables...\n');

// Check if dotenv is working
console.log('1️⃣ Environment file loading:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`   Current working directory: ${process.cwd()}`);

// Check Spotify credentials
console.log('\n2️⃣ Spotify Credentials:');
if (process.env.SPOTIFY_CLIENT_ID) {
  console.log(`   ✅ SPOTIFY_CLIENT_ID: ${process.env.SPOTIFY_CLIENT_ID.substring(0, 8)}...`);
} else {
  console.log('   ❌ SPOTIFY_CLIENT_ID: Not found');
}

if (process.env.SPOTIFY_CLIENT_SECRET) {
  console.log(`   ✅ SPOTIFY_CLIENT_SECRET: ${process.env.SPOTIFY_CLIENT_SECRET.substring(0, 8)}...`);
} else {
  console.log('   ❌ SPOTIFY_CLIENT_SECRET: Not found');
}

// Check database URL
console.log('\n3️⃣ Database Configuration:');
if (process.env.DATABASE_URL) {
  console.log(`   ✅ DATABASE_URL: ${process.env.DATABASE_URL.substring(0, 20)}...`);
} else {
  console.log('   ❌ DATABASE_URL: Not found');
}

// Check all environment variables
console.log('\n4️⃣ All Environment Variables:');
const envVars = Object.keys(process.env).filter(key => 
  key.includes('SPOTIFY') || 
  key.includes('DATABASE') || 
  key.includes('NEXTAUTH')
);

if (envVars.length > 0) {
  envVars.forEach(key => {
    const value = process.env[key];
    const displayValue = value.length > 20 ? value.substring(0, 20) + '...' : value;
    console.log(`   ${key}: ${displayValue}`);
  });
} else {
  console.log('   No relevant environment variables found');
}

// Check if .env.local file exists
console.log('\n5️⃣ File Check:');
const fs = require('fs');
const path = require('path');

const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  console.log('   ✅ .env.local file exists');
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  const hasSpotifyId = envContent.includes('SPOTIFY_CLIENT_ID');
  const hasSpotifySecret = envContent.includes('SPOTIFY_CLIENT_SECRET');
  console.log(`   SPOTIFY_CLIENT_ID in file: ${hasSpotifyId ? '✅' : '❌'}`);
  console.log(`   SPOTIFY_CLIENT_SECRET in file: ${hasSpotifySecret ? '✅' : '❌'}`);
} else {
  console.log('   ❌ .env.local file does not exist');
}

if (fs.existsSync(envPath)) {
  console.log('   ✅ .env file exists');
} else {
  console.log('   ❌ .env file does not exist');
}

console.log('\n💡 Troubleshooting:');
if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  console.log('   If credentials are missing:');
  console.log('   1. Make sure .env.local exists in your project root');
  console.log('   2. Add SPOTIFY_CLIENT_ID=your_client_id');
  console.log('   3. Add SPOTIFY_CLIENT_SECRET=your_client_secret');
  console.log('   4. Restart your terminal');
} else {
  console.log('   ✅ Environment variables are loaded correctly!');
  console.log('   You can now run the Spotify sync scripts.');
}
