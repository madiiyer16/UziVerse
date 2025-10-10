#!/usr/bin/env node

/**
 * Auto-Assign Genres and Moods to Songs
 * Uses album patterns and audio features to intelligently assign genres/moods
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Album-based genre mapping for Lil Uzi Vert
const ALBUM_GENRE_MAP = {
  'Luv Is Rage 2': ['Hip Hop', 'Trap', 'Emo Rap'],
  'Eternal Atake': ['Hip Hop', 'Trap', 'Experimental'],
  'The Perfect Luv Tape': ['Hip Hop', 'Trap', 'Cloud Rap'],
  'Luv Is Rage': ['Hip Hop', 'Trap'],
  'Lil Uzi Vert vs. The World': ['Hip Hop', 'Trap', 'Melodic Rap'],
  'Pluto x Baby Pluto': ['Hip Hop', 'Trap'],
  'Pink Tape': ['Hip Hop', 'Trap', 'Rage', 'Rock'],
  'Barter 16': ['Hip Hop', 'Trap']
};

// Audio feature-based mood inference
function inferMoodsFromAudioFeatures(song) {
  const moods = [];
  
  if (song.energy !== null && song.valence !== null) {
    // High energy + high valence = Energetic/Hype
    if (song.energy > 0.7 && song.valence > 0.6) {
      moods.push('Energetic', 'Hype');
    }
    // High energy + low valence = Aggressive/Dark
    else if (song.energy > 0.7 && song.valence < 0.4) {
      moods.push('Aggressive', 'Dark');
    }
    // Low energy + high valence = Chill/Happy
    else if (song.energy < 0.5 && song.valence > 0.6) {
      moods.push('Chill', 'Happy');
    }
    // Low energy + low valence = Melancholic/Sad
    else if (song.energy < 0.5 && song.valence < 0.4) {
      moods.push('Melancholic', 'Sad');
    }
  }
  
  // Danceability
  if (song.danceability !== null && song.danceability > 0.7) {
    moods.push('Party');
  }
  
  // Acousticness suggests introspective/emotional
  if (song.acousticness !== null && song.acousticness > 0.5) {
    moods.push('Introspective');
  }
  
  return moods.length > 0 ? moods : ['Upbeat']; // Default mood
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  
  console.log(`🎵 Auto-assigning Genres and Moods${dryRun ? ' (DRY RUN)' : ''}...\n`);

  // First, ensure we have the genres and moods in the database
  const genresToCreate = [
    { name: 'Hip Hop', slug: 'hip-hop', description: 'Hip Hop music' },
    { name: 'Trap', slug: 'trap', description: 'Trap music' },
    { name: 'Emo Rap', slug: 'emo-rap', description: 'Emo Rap' },
    { name: 'Experimental', slug: 'experimental', description: 'Experimental Hip Hop' },
    { name: 'Cloud Rap', slug: 'cloud-rap', description: 'Cloud Rap' },
    { name: 'Melodic Rap', slug: 'melodic-rap', description: 'Melodic Rap' },
    { name: 'Rage', slug: 'rage', description: 'Rage music' },
    { name: 'Rock', slug: 'rock', description: 'Rock music' }
  ];

  const moodsToCreate = [
    { name: 'Energetic', slug: 'energetic', description: 'High energy' },
    { name: 'Hype', slug: 'hype', description: 'Gets you pumped' },
    { name: 'Aggressive', slug: 'aggressive', description: 'Aggressive vibes' },
    { name: 'Dark', slug: 'dark', description: 'Dark and moody' },
    { name: 'Chill', slug: 'chill', description: 'Relaxed vibes' },
    { name: 'Happy', slug: 'happy', description: 'Happy and upbeat' },
    { name: 'Melancholic', slug: 'melancholic', description: 'Sad and reflective' },
    { name: 'Sad', slug: 'sad', description: 'Emotional and sad' },
    { name: 'Party', slug: 'party', description: 'Party music' },
    { name: 'Introspective', slug: 'introspective', description: 'Thoughtful and deep' },
    { name: 'Upbeat', slug: 'upbeat', description: 'Upbeat and positive' }
  ];

  if (!dryRun) {
    console.log('📦 Creating genres and moods if they don\'t exist...');
    for (const genre of genresToCreate) {
      await prisma.genre.upsert({
        where: { slug: genre.slug },
        update: {},
        create: genre
      });
    }
    for (const mood of moodsToCreate) {
      await prisma.mood.upsert({
        where: { slug: mood.slug },
        update: {},
        create: mood
      });
    }
    console.log('✅ Genres and moods ready\n');
  }

  // Get all genres and moods
  const allGenres = await prisma.genre.findMany();
  const allMoods = await prisma.mood.findMany();

  const genreMap = Object.fromEntries(allGenres.map(g => [g.name, g.id]));
  const moodMap = Object.fromEntries(allMoods.map(m => [m.name, m.id]));

  // Get songs without genres or moods
  const songsToProcess = await prisma.song.findMany({
    where: {
      OR: [
        { genres: { none: {} } },
        { moods: { none: {} } }
      ]
    },
    include: {
      genres: { include: { genre: true } },
      moods: { include: { mood: true } }
    }
  });

  console.log(`🎯 Found ${songsToProcess.length} songs to process\n`);

  let genresAssigned = 0;
  let moodsAssigned = 0;

  for (const song of songsToProcess) {
    const needsGenres = song.genres.length === 0;
    const needsMoods = song.moods.length === 0;

    if (!needsGenres && !needsMoods) continue;

    console.log(`Processing: ${song.title} - ${song.album}`);

    // Assign genres based on album
    if (needsGenres && song.album) {
      let genresToAssign = [];
      
      // Check if album matches any known patterns
      for (const [albumPattern, genres] of Object.entries(ALBUM_GENRE_MAP)) {
        if (song.album.includes(albumPattern)) {
          genresToAssign = genres;
          break;
        }
      }

      // Default genres if no match
      if (genresToAssign.length === 0) {
        genresToAssign = ['Hip Hop', 'Trap'];
      }

      console.log(`   Genres: ${genresToAssign.join(', ')}`);

      if (!dryRun) {
        for (const genreName of genresToAssign) {
          if (genreMap[genreName]) {
            await prisma.songGenre.create({
              data: {
                songId: song.id,
                genreId: genreMap[genreName]
              }
            }).catch(() => {}); // Ignore if already exists
          }
        }
        genresAssigned++;
      }
    }

    // Assign moods based on audio features
    if (needsMoods) {
      const moodsToAssign = inferMoodsFromAudioFeatures(song);
      
      console.log(`   Moods: ${moodsToAssign.join(', ')}`);

      if (!dryRun) {
        for (const moodName of moodsToAssign) {
          if (moodMap[moodName]) {
            await prisma.songMood.create({
              data: {
                songId: song.id,
                moodId: moodMap[moodName]
              }
            }).catch(() => {}); // Ignore if already exists
          }
        }
        moodsAssigned++;
      }
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(`   Genres assigned to: ${genresAssigned} songs`);
  console.log(`   Moods assigned to: ${moodsAssigned} songs`);

  if (dryRun) {
    console.log('\n💡 This was a dry run. Run without --dry-run to apply changes.');
  }

}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
