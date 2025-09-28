#!/usr/bin/env node

/**
 * Spotify Sync Script
 * Run this script to sync Lil Uzi Vert's discography from Spotify
 */

const https = require('https');
const http = require('http');

const API_URL = 'http://127.0.0.1:3000/api/sync/spotify';

console.log('🎵 Starting Spotify sync...');
console.log(`📍 Target URL: ${API_URL}`);

// Create request options
const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

// Make the request
const req = http.request(API_URL, options, (res) => {
  console.log(`✅ Response status: ${res.statusCode}`);
  console.log(`📊 Response headers:`, res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('🎉 Sync completed successfully!');
      console.log('📈 Results:', JSON.stringify(response, null, 2));
    } catch (error) {
      console.log('📄 Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  console.log('\n🔧 Troubleshooting tips:');
  console.log('1. Make sure your Next.js server is running: npm run dev');
  console.log('2. Check if the server is running on port 3000');
  console.log('3. Verify your Spotify API credentials in env.local');
  console.log('4. Try accessing http://127.0.0.1:3000 in your browser');
});

// Send the request body to actually sync data
req.write(JSON.stringify({ dryRun: false }));
req.end();
