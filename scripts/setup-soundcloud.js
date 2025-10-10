#!/usr/bin/env node

/**
 * SoundCloud Setup Script
 * Helps configure SoundCloud API integration
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupSoundCloud() {
  console.log('🎧 SoundCloud API Setup');
  console.log('========================\n');

  console.log('To integrate SoundCloud, you need to:');
  console.log('1. Go to https://developers.soundcloud.com/');
  console.log('2. Sign in with your SoundCloud account');
  console.log('3. Create a new app');
  console.log('4. Get your Client ID\n');

  const clientId = await question('Enter your SoundCloud Client ID: ');

  if (!clientId || clientId.trim() === '') {
    console.log('❌ Client ID is required');
    rl.close();
    return;
  }

  console.log('\n📝 Add this to your .env.local file:');
  console.log(`SOUNDCLOUD_CLIENT_ID=${clientId.trim()}\n`);

  console.log('✅ Setup complete!');
  console.log('\nNext steps:');
  console.log('1. Add the environment variable to your .env.local file');
  console.log('2. Restart your development server');
  console.log('3. Visit /admin/sync to test the SoundCloud integration');
  console.log('4. Run the sync to import official Lil Uzi Vert tracks\n');

  console.log('🔒 Legal Notice:');
  console.log('This integration only accesses official, publicly available content');
  console.log('from Lil Uzi Vert\'s verified SoundCloud account. No unreleased');
  console.log('or unauthorized content will be imported.\n');

  rl.close();
}

setupSoundCloud().catch(console.error);

