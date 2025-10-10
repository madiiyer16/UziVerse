#!/usr/bin/env node

/**
 * Database Check Script
 * Check what's currently in your database
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Checking database contents...\n');

    // Get total songs
    const totalSongs = await prisma.song.count();
    console.log(`📊 Total songs in database: ${totalSongs}`);

    // Get songs with Spotify IDs
    const songsWithSpotifyId = await prisma.song.count({
      where: { spotifyId: { not: null } }
    });
    console.log(`🎵 Songs with Spotify ID: ${songsWithSpotifyId}`);

    // Get songs with complete audio features
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
    console.log(`✅ Songs with complete audio features: ${songsWithCompleteAudioFeatures}`);

    // Get songs with missing audio features
    const songsWithMissingAudioFeatures = await prisma.song.count({
      where: {
        AND: [
          { spotifyId: { not: null } },
          {
            OR: [
              { energy: null },
              { energy: 0 },
              { danceability: null },
              { danceability: 0 },
              { valence: null },
              { valence: 0 },
              { tempo: null },
              { tempo: 0 }
            ]
          }
        ]
      }
    });
    console.log(`❌ Songs with missing audio features: ${songsWithMissingAudioFeatures}`);

    // Show sample songs
    console.log('\n📋 Sample songs:');
    const sampleSongs = await prisma.song.findMany({
      take: 10,
      select: {
        id: true,
        title: true,
        artist: true,
        album: true,
        spotifyId: true,
        energy: true,
        danceability: true,
        valence: true,
        tempo: true
      },
      orderBy: { createdAt: 'desc' }
    });

    sampleSongs.forEach((song, index) => {
      console.log(`\n${index + 1}. ${song.title} - ${song.album}`);
      console.log(`   Artist: ${song.artist}`);
      console.log(`   Spotify ID: ${song.spotifyId || 'None'}`);
      console.log(`   Energy: ${song.energy || 'N/A'}`);
      console.log(`   Danceability: ${song.danceability || 'N/A'}`);
      console.log(`   Valence: ${song.valence || 'N/A'}`);
      console.log(`   Tempo: ${song.tempo || 'N/A'}`);
    });

    // Show songs with missing features
    if (songsWithMissingAudioFeatures > 0) {
      console.log('\n❌ Songs with missing audio features:');
      const missingFeaturesSongs = await prisma.song.findMany({
        where: {
          AND: [
            { spotifyId: { not: null } },
            {
              OR: [
                { energy: null },
                { energy: 0 },
                { danceability: null },
                { danceability: 0 },
                { valence: null },
                { valence: 0 },
                { tempo: null },
                { tempo: 0 }
              ]
            }
          ]
        },
        take: 5,
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          spotifyId: true,
          energy: true,
          danceability: true,
          valence: true,
          tempo: true
        },
        orderBy: { createdAt: 'desc' }
      });

      missingFeaturesSongs.forEach((song, index) => {
        console.log(`\n${index + 1}. ${song.title} - ${song.album}`);
        console.log(`   Spotify ID: ${song.spotifyId}`);
        console.log(`   Energy: ${song.energy || 'NULL'}`);
        console.log(`   Danceability: ${song.danceability || 'NULL'}`);
        console.log(`   Valence: ${song.valence || 'NULL'}`);
        console.log(`   Tempo: ${song.tempo || 'NULL'}`);
      });
    }

    // Show genres and moods
    const genreCount = await prisma.genre.count();
    const moodCount = await prisma.mood.count();
    console.log(`\n🎭 Genres in database: ${genreCount}`);
    console.log(`🎭 Moods in database: ${moodCount}`);

    if (genreCount > 0) {
      const genres = await prisma.genre.findMany({
        take: 10,
        select: { name: true, _count: { select: { songs: true } } }
      });
      console.log('   Sample genres:', genres.map(g => `${g.name} (${g._count.songs} songs)`).join(', '));
    }

    if (moodCount > 0) {
      const moods = await prisma.mood.findMany({
        take: 10,
        select: { name: true, _count: { select: { songs: true } } }
      });
      console.log('   Sample moods:', moods.map(m => `${m.name} (${m._count.songs} songs)`).join(', '));
    }

    console.log('\n💡 Next steps:');
    if (songsWithMissingAudioFeatures > 0) {
      console.log('1. Run: node scripts/direct-spotify-sync.js --dry-run --max-songs=5');
      console.log('2. If that works, run: node scripts/direct-spotify-sync.js --max-songs=50');
    } else {
      console.log('✅ Your database looks good! No missing audio features found.');
    }

  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
