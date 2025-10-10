#!/usr/bin/env node

/**
 * Setup Mock Data Script
 * This script sets up complete mock data for testing when Spotify API is restricted
 * It fills audio features, genres, and moods to make AI recommendations work
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 50,
    maxSongs: parseInt(args.find(arg => arg.startsWith('--max-songs='))?.split('=')[1]) || null,
    force: args.includes('--force'),
    skipAudioFeatures: args.includes('--skip-audio-features'),
    skipGenresMoods: args.includes('--skip-genres-moods')
  };

  console.log('🚀 Setting up Mock Data for AI Recommendations...');
  console.log('Options:', options);

  try {
    // Step 1: Check current state
    console.log('\n📊 Checking current database state...');
    const initialState = await getStats();
    console.log('Initial state:', initialState);

    if (initialState.totalSongs === 0) {
      console.log('❌ No songs found in database. Please add some songs first.');
      return;
    }

    // Step 2: Fill audio features
    if (!options.skipAudioFeatures) {
      console.log('\n🎵 Step 1: Filling mock audio features...');
      await runScript('scripts/fill-mock-audio-features.js', {
        dryRun: options.dryRun,
        batchSize: options.batchSize,
        maxSongs: options.maxSongs,
        force: options.force
      });
    } else {
      console.log('\n⏭️ Skipping audio features (--skip-audio-features)');
    }

    // Step 3: Generate genres and moods
    if (!options.skipGenresMoods) {
      console.log('\n🎭 Step 2: Generating mock genres and moods...');
      await runScript('scripts/generate-mock-genres-moods.js', {
        dryRun: options.dryRun,
        batchSize: options.batchSize,
        maxSongs: options.maxSongs,
        force: options.force
      });
    } else {
      console.log('\n⏭️ Skipping genres and moods (--skip-genres-moods)');
    }

    // Step 4: Final statistics
    console.log('\n📊 Final database state...');
    const finalState = await getStats();
    console.log('Final state:', finalState);

    // Step 5: Show improvement
    const improvement = {
      audioFeaturesCompletion: finalState.audioFeaturesCompletion - initialState.audioFeaturesCompletion,
      genresCompletion: finalState.genresCompletion - initialState.genresCompletion,
      moodsCompletion: finalState.moodsCompletion - initialState.moodsCompletion
    };

    console.log('\n🎉 Mock data setup completed!');
    console.log('Improvements:');
    console.log(`  Audio features completion: +${improvement.audioFeaturesCompletion}%`);
    console.log(`  Genres completion: +${improvement.genresCompletion}%`);
    console.log(`  Moods completion: +${improvement.moodsCompletion}%`);

    console.log('\n💡 Next steps:');
    console.log('1. Check your For You page - AI recommendations should now work!');
    console.log('2. The AI will use these mock features to provide recommendations');
    console.log('3. When you get Spotify API access, you can replace with real data');
    console.log('4. Test the recommendation system with different songs');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function runScript(scriptPath, options) {
  const args = [];
  
  if (options.dryRun) args.push('--dry-run');
  if (options.batchSize) args.push(`--batch-size=${options.batchSize}`);
  if (options.maxSongs) args.push(`--max-songs=${options.maxSongs}`);
  if (options.force) args.push('--force');

  const command = `node ${scriptPath} ${args.join(' ')}`;
  console.log(`Running: ${command}`);
  
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`❌ Error running ${scriptPath}:`, error.message);
    throw error;
  }
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

  const songsWithGenres = await prisma.song.count({
    where: { genres: { some: {} } }
  });

  const songsWithMoods = await prisma.song.count({
    where: { moods: { some: {} } }
  });

  const totalGenres = await prisma.genre.count();
  const totalMoods = await prisma.mood.count();

  return {
    totalSongs,
    songsWithCompleteAudioFeatures,
    songsWithGenres,
    songsWithMoods,
    totalGenres,
    totalMoods,
    audioFeaturesCompletion: totalSongs > 0 ? Math.round((songsWithCompleteAudioFeatures / totalSongs) * 100) : 0,
    genresCompletion: totalSongs > 0 ? Math.round((songsWithGenres / totalSongs) * 100) : 0,
    moodsCompletion: totalSongs > 0 ? Math.round((songsWithMoods / totalSongs) * 100) : 0
  };
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🚀 Mock Data Setup Script

This script sets up complete mock data for testing when Spotify API is restricted.
It fills audio features, genres, and moods to make AI recommendations work.

Usage: node scripts/setup-mock-data.js [options]

Options:
  --dry-run              Test the setup without making changes
  --batch-size=N         Process N songs at a time (default: 50)
  --max-songs=N          Limit to N songs (default: all)
  --force                Force update even if data exists
  --skip-audio-features  Skip filling audio features
  --skip-genres-moods    Skip generating genres and moods
  --help, -h             Show this help message

Examples:
  node scripts/setup-mock-data.js --dry-run --max-songs=10
  node scripts/setup-mock-data.js --batch-size=25 --max-songs=100
  node scripts/setup-mock-data.js --force

What this script does:
1. Fills missing audio features with intelligent mock data
2. Generates realistic genres based on audio features
3. Generates realistic moods based on audio features
4. Shows before/after statistics
5. Makes AI recommendations work without Spotify API access

This is perfect for development and testing when Spotify API access is restricted!
`);
  process.exit(0);
}

main();
