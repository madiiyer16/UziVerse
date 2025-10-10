#!/usr/bin/env node

/**
 * Check Genres and Moods Assignment
 * See which songs have genres/moods assigned and which don't
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Checking genre and mood assignments...\n');

    // Get all genres
    const genres = await prisma.genre.findMany({
      include: {
        _count: {
          select: { songs: true }
        }
      }
    });

    console.log('📊 Available Genres:');
    genres.forEach(genre => {
      console.log(`   - ${genre.name} (${genre._count.songs} songs)`);
    });

    // Get all moods
    const moods = await prisma.mood.findMany({
      include: {
        _count: {
          select: { songs: true }
        }
      }
    });

    console.log('\n😊 Available Moods:');
    moods.forEach(mood => {
      console.log(`   - ${mood.name} (${mood._count.songs} songs)`);
    });

    // Get songs with no genres
    const songsWithoutGenres = await prisma.song.findMany({
      where: {
        genres: {
          none: {}
        }
      },
      select: {
        id: true,
        title: true,
        album: true
      },
      take: 10
    });

    console.log(`\n❌ Songs without genres: ${songsWithoutGenres.length > 0 ? songsWithoutGenres.length + '+' : '0'}`);
    if (songsWithoutGenres.length > 0) {
      console.log('   First 10 examples:');
      songsWithoutGenres.forEach((song, i) => {
        console.log(`   ${i + 1}. ${song.title} - ${song.album}`);
      });
    }

    // Get songs with no moods
    const songsWithoutMoods = await prisma.song.findMany({
      where: {
        moods: {
          none: {}
        }
      },
      select: {
        id: true,
        title: true,
        album: true
      },
      take: 10
    });

    console.log(`\n❌ Songs without moods: ${songsWithoutMoods.length > 0 ? songsWithoutMoods.length + '+' : '0'}`);
    if (songsWithoutMoods.length > 0) {
      console.log('   First 10 examples:');
      songsWithoutMoods.forEach((song, i) => {
        console.log(`   ${i + 1}. ${song.title} - ${song.album}`);
      });
    }

    // Show some examples of properly assigned songs
    console.log('\n✅ Examples of songs with genres and moods:');
    const wellAssignedSongs = await prisma.song.findMany({
      where: {
        AND: [
          { genres: { some: {} } },
          { moods: { some: {} } }
        ]
      },
      include: {
        genres: {
          include: {
            genre: true
          }
        },
        moods: {
          include: {
            mood: true
          }
        }
      },
      take: 5
    });

    wellAssignedSongs.forEach((song, i) => {
      const genreNames = song.genres.map(sg => sg.genre.name).join(', ');
      const moodNames = song.moods.map(sm => sm.mood.name).join(', ');
      console.log(`\n   ${i + 1}. ${song.title} - ${song.album}`);
      console.log(`      Genres: ${genreNames || 'None'}`);
      console.log(`      Moods: ${moodNames || 'None'}`);
    });

    // Get count of songs with both
    const songsWithBoth = await prisma.song.count({
      where: {
        AND: [
          { genres: { some: {} } },
          { moods: { some: {} } }
        ]
      }
    });

    const totalSongs = await prisma.song.count();

    console.log(`\n📈 Summary:`);
    console.log(`   Total songs: ${totalSongs}`);
    console.log(`   Songs with genres AND moods: ${songsWithBoth} (${Math.round(songsWithBoth / totalSongs * 100)}%)`);
    
    if (songsWithBoth < totalSongs * 0.5) {
      console.log('\n⚠️  WARNING: Less than 50% of songs have genres and moods assigned!');
      console.log('   This will affect recommendation quality.');
      console.log('   Consider running a script to auto-assign genres/moods based on album or audio features.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
