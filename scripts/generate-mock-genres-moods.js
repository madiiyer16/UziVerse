#!/usr/bin/env node

/**
 * Generate Mock Genres and Moods Script
 * This script generates realistic genres and moods based on audio features
 * Use this after filling mock audio features
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Genre rules based on audio features
const GENRE_RULES = [
  {
    name: 'Trap',
    condition: (song) => song.tempo >= 140 && song.tempo <= 180 && song.energy >= 0.6 && song.speechiness >= 0.6,
    priority: 1
  },
  {
    name: 'Hip-Hop',
    condition: (song) => song.speechiness >= 0.33 && song.tempo >= 60 && song.tempo <= 140 && song.energy >= 0.4,
    priority: 2
  },
  {
    name: 'Rap',
    condition: (song) => song.speechiness >= 0.66 && song.energy >= 0.5,
    priority: 3
  },
  {
    name: 'R&B',
    condition: (song) => song.valence >= 0.4 && song.valence <= 0.8 && song.danceability >= 0.6 && song.speechiness <= 0.5,
    priority: 4
  },
  {
    name: 'Pop',
    condition: (song) => song.valence >= 0.5 && song.danceability >= 0.5 && song.energy >= 0.5,
    priority: 5
  },
  {
    name: 'Electronic',
    condition: (song) => song.energy >= 0.7 && song.danceability >= 0.7 && song.instrumentalness >= 0.3,
    priority: 6
  }
];

// Mood rules based on audio features
const MOOD_RULES = [
  {
    name: 'Energetic',
    condition: (song) => song.energy >= 0.7,
    priority: 1
  },
  {
    name: 'Chill',
    condition: (song) => song.energy <= 0.4 && song.valence >= 0.4,
    priority: 2
  },
  {
    name: 'Sad',
    condition: (song) => song.valence <= 0.3,
    priority: 3
  },
  {
    name: 'Happy',
    condition: (song) => song.valence >= 0.7,
    priority: 4
  },
  {
    name: 'Danceable',
    condition: (song) => song.danceability >= 0.7,
    priority: 5
  },
  {
    name: 'Aggressive',
    condition: (song) => song.energy >= 0.8 && song.valence <= 0.4,
    priority: 6
  },
  {
    name: 'Romantic',
    condition: (song) => song.valence >= 0.5 && song.valence <= 0.7 && song.energy <= 0.6,
    priority: 7
  },
  {
    name: 'Upbeat',
    condition: (song) => song.energy >= 0.6 && song.valence >= 0.6,
    priority: 8
  }
];

async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 50,
    maxSongs: parseInt(args.find(arg => arg.startsWith('--max-songs='))?.split('=')[1]) || null,
    force: args.includes('--force')
  };

  console.log('🎭 Generating Mock Genres and Moods...');
  console.log('Options:', options);

  try {
    // Get songs with audio features but no genres/moods
    console.log('\n📊 Getting songs that need genres and moods...');
    const songsNeedingGenresMoods = await getSongsNeedingGenresMoods(options.maxSongs);
    
    if (songsNeedingGenresMoods.length === 0) {
      console.log('✅ No songs need genres and moods!');
      return;
    }

    console.log(`📊 Found ${songsNeedingGenresMoods.length} songs that need genres and moods`);

    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: []
    };

    // Process in batches
    for (let i = 0; i < songsNeedingGenresMoods.length; i += options.batchSize) {
      const batch = songsNeedingGenresMoods.slice(i, i + options.batchSize);
      console.log(`\n🔄 Processing batch ${Math.floor(i / options.batchSize) + 1}/${Math.ceil(songsNeedingGenresMoods.length / options.batchSize)}`);

      const batchResults = await processBatch(batch, options);
      results.processed += batchResults.processed;
      results.updated += batchResults.updated;
      results.skipped += batchResults.skipped;
      results.errors += batchResults.errors;
      results.errorDetails.push(...batchResults.errorDetails);
    }

    console.log('\n🎉 Mock genres and moods generation completed!');
    console.log('Results:', results);

    // Show final statistics
    const finalStats = await getStats();
    console.log('\n📊 Final Statistics:');
    console.log(`Total songs: ${finalStats.totalSongs}`);
    console.log(`Songs with genres: ${finalStats.songsWithGenres}`);
    console.log(`Songs with moods: ${finalStats.songsWithMoods}`);
    console.log(`Total genres: ${finalStats.totalGenres}`);
    console.log(`Total moods: ${finalStats.totalMoods}`);

    console.log('\n💡 Next steps:');
    console.log('1. Check your For You page - AI recommendations should now work with genres and moods!');
    console.log('2. The AI will use these genres and moods for better recommendations');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function getSongsNeedingGenresMoods(maxSongs = null) {
  const whereClause = {
    AND: [
      // Has audio features
      { energy: { not: null, gt: 0 } },
      { danceability: { not: null, gt: 0 } },
      { valence: { not: null, gt: 0 } },
      { tempo: { not: null, gt: 0 } },
      // Missing genres or moods
      {
        OR: [
          { genres: { none: {} } },
          { moods: { none: {} } }
        ]
      }
    ]
  };

  const queryOptions = {
    where: whereClause,
    include: {
      genres: true,
      moods: true
    },
    orderBy: { createdAt: 'desc' }
  };

  // Only add take if maxSongs is specified
  if (maxSongs && maxSongs > 0) {
    queryOptions.take = maxSongs;
  }

  const songs = await prisma.song.findMany(queryOptions);

  return songs;
}

async function processBatch(songs, options) {
  const results = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: []
  };

  for (const song of songs) {
    try {
      results.processed++;
      
      // Check if song needs updating
      const needsGenres = !song.genres || song.genres.length === 0;
      const needsMoods = !song.moods || song.moods.length === 0;
      
      if (!needsGenres && !needsMoods && !options.force) {
        console.log(`⏭️ Skipping ${song.title} - already has genres and moods`);
        results.skipped++;
        continue;
      }

      // Generate genres and moods based on audio features
      const assignedGenres = needsGenres ? generateGenres(song) : [];
      const assignedMoods = needsMoods ? generateMoods(song) : [];
      
      if (options.dryRun) {
        console.log(`[DRY RUN] Would update ${song.title}:`);
        if (assignedGenres.length > 0) {
          console.log(`   Genres: ${assignedGenres.join(', ')}`);
        }
        if (assignedMoods.length > 0) {
          console.log(`   Moods: ${assignedMoods.join(', ')}`);
        }
        results.updated++;
        continue;
      }

      // Update genres
      if (assignedGenres.length > 0) {
        await updateSongGenres(song.id, assignedGenres);
        console.log(`✅ Updated ${song.title} genres: ${assignedGenres.join(', ')}`);
      }

      // Update moods
      if (assignedMoods.length > 0) {
        await updateSongMoods(song.id, assignedMoods);
        console.log(`✅ Updated ${song.title} moods: ${assignedMoods.join(', ')}`);
      }

      results.updated++;

    } catch (error) {
      console.error(`❌ Error processing song ${song.title}:`, error.message);
      results.errors++;
      results.errorDetails.push({
        songId: song.id,
        title: song.title,
        error: error.message
      });
    }
  }

  return results;
}

function generateGenres(song) {
  const assignedGenres = [];
  
  // Sort rules by priority
  const sortedRules = [...GENRE_RULES].sort((a, b) => a.priority - b.priority);
  
  for (const rule of sortedRules) {
    if (rule.condition(song)) {
      assignedGenres.push(rule.name);
    }
  }
  
  // If no genres assigned, assign based on artist
  if (assignedGenres.length === 0) {
    if (song.artist.toLowerCase().includes('uzi') || song.artist.toLowerCase().includes('vert')) {
      assignedGenres.push('Hip-Hop', 'Trap');
    } else {
      assignedGenres.push('Pop');
    }
  }
  
  // Limit to 2 genres
  return assignedGenres.slice(0, 2);
}

function generateMoods(song) {
  const assignedMoods = [];
  
  // Sort rules by priority
  const sortedRules = [...MOOD_RULES].sort((a, b) => a.priority - b.priority);
  
  for (const rule of sortedRules) {
    if (rule.condition(song)) {
      assignedMoods.push(rule.name);
    }
  }
  
  // If no moods assigned, assign based on energy and valence
  if (assignedMoods.length === 0) {
    if (song.energy >= 0.6) {
      assignedMoods.push('Energetic');
    } else {
      assignedMoods.push('Chill');
    }
    
    if (song.valence >= 0.6) {
      assignedMoods.push('Happy');
    } else {
      assignedMoods.push('Sad');
    }
  }
  
  // Limit to 2 moods
  return assignedMoods.slice(0, 2);
}

async function updateSongGenres(songId, genreNames) {
  // Remove existing genres
  await prisma.songGenre.deleteMany({
    where: { songId }
  });

  // Add new genres
  for (const genreName of genreNames) {
    let genre = await prisma.genre.findUnique({
      where: { name: genreName }
    });

    if (!genre) {
      genre = await prisma.genre.create({
        data: {
          name: genreName,
          slug: genreName.toLowerCase().replace(/\s+/g, '-')
        }
      });
    }

    await prisma.songGenre.create({
      data: {
        songId,
        genreId: genre.id
      }
    });
  }
}

async function updateSongMoods(songId, moodNames) {
  // Remove existing moods
  await prisma.songMood.deleteMany({
    where: { songId }
  });

  // Add new moods
  for (const moodName of moodNames) {
    let mood = await prisma.mood.findUnique({
      where: { name: moodName }
    });

    if (!mood) {
      mood = await prisma.mood.create({
        data: {
          name: moodName,
          slug: moodName.toLowerCase().replace(/\s+/g, '-')
        }
      });
    }

    await prisma.songMood.create({
      data: {
        songId,
        moodId: mood.id
      }
    });
  }
}

async function getStats() {
  const totalSongs = await prisma.song.count();
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
    songsWithGenres,
    songsWithMoods,
    totalGenres,
    totalMoods
  };
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🎭 Mock Genres and Moods Generator

This script generates realistic genres and moods based on audio features.

Usage: node scripts/generate-mock-genres-moods.js [options]

Options:
  --dry-run              Test the generation without making changes
  --batch-size=N         Process N songs at a time (default: 50)
  --max-songs=N          Limit to N songs (default: all)
  --force                Force update even if genres/moods exist
  --help, -h             Show this help message

Examples:
  node scripts/generate-mock-genres-moods.js --dry-run --max-songs=10
  node scripts/generate-mock-genres-moods.js --batch-size=25 --max-songs=100
  node scripts/generate-mock-genres-moods.js --force

Features:
- Generates genres based on audio features (trap, hip-hop, rap, R&B, pop, electronic)
- Generates moods based on audio features (energetic, chill, sad, happy, danceable, etc.)
- Uses intelligent rules to match audio features to appropriate genres/moods
- Works with mock or real audio features
`);
  process.exit(0);
}

main();
