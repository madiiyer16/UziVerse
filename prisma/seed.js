const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create genres with slugs
  const genres = [
    { name: 'Hip Hop', slug: 'hip-hop', color: '#FF6B6B' },
    { name: 'Trap', slug: 'trap', color: '#4ECDC4' },
    { name: 'Emo Rap', slug: 'emo-rap', color: '#45B7D1' },
    { name: 'Melodic Rap', slug: 'melodic-rap', color: '#96CEB4' },
    { name: 'SoundCloud Rap', slug: 'soundcloud-rap', color: '#FFEAA7' },
    { name: 'Jersey Club', slug: 'jersey-club', color: '#DDA0DD' },
    { name: 'Alternative Hip Hop', slug: 'alt-hip-hop', color: '#98D8C8' }
  ];
  
  for (const genre of genres) {
    await prisma.genre.upsert({
      where: { slug: genre.slug },
      update: {},
      create: genre
    });
  }

  // Create moods with slugs
  const moods = [
    { name: 'Dark', slug: 'dark', color: '#2C3E50' },
    { name: 'Emotional', slug: 'emotional', color: '#E74C3C' },
    { name: 'Upbeat', slug: 'upbeat', color: '#F39C12' },
    { name: 'Confident', slug: 'confident', color: '#27AE60' },
    { name: 'Chill', slug: 'chill', color: '#3498DB' },
    { name: 'Romantic', slug: 'romantic', color: '#E91E63' },
    { name: 'Energetic', slug: 'energetic', color: '#FF9800' },
    { name: 'Party', slug: 'party', color: '#9C27B0' },
    { name: 'Melancholic', slug: 'melancholic', color: '#607D8B' },
    { name: 'Aggressive', slug: 'aggressive', color: '#795548' }
  ];
  
  for (const mood of moods) {
    await prisma.mood.upsert({
      where: { slug: mood.slug },
      update: {},
      create: mood
    });
  }

  // Create sample songs with fields that exist in your schema
  const sampleSongs = [
    {
      title: "XO Tour Llif3",
      album: "Luv Is Rage 2",
      year: 2017,
      spotifyId: "7GX5flRQZVHRAGd6B4TmDO",
      youtubeId: "WrsFXgQk5UI",
      energy: 0.7,
      danceability: 0.8,
      valence: 0.3,
      tempo: 155,
      acousticness: 0.1,
      instrumentalness: 0.0,
      liveness: 0.2,
      speechiness: 0.3,
      loudness: -5.5,
      avgRating: 4.8,
      totalRatings: 1234,
      isOfficial: true,
      releaseType: 'ALBUM',
      genres: ['hip-hop', 'emo-rap'],
      moods: ['dark', 'emotional']
    },
    {
      title: "Money Longer",
      album: "Lil Uzi Vert vs. the World",
      year: 2016,
      spotifyId: "2GjZrmNdWLLwgoCRPgZyEJ",
      youtubeId: "aj7gSq_hAFI",
      energy: 0.8,
      danceability: 0.9,
      valence: 0.7,
      tempo: 145,
      acousticness: 0.05,
      instrumentalness: 0.0,
      liveness: 0.1,
      speechiness: 0.25,
      loudness: -4.2,
      avgRating: 4.6,
      totalRatings: 987,
      isOfficial: true,
      releaseType: 'MIXTAPE',
      genres: ['trap', 'hip-hop'],
      moods: ['upbeat', 'confident']
    },
    {
      title: "20 Min",
      album: "Luv Is Rage 2",
      year: 2017,
      spotifyId: "4jAIqgrPjKLTY9Gbez25Qb",
      youtubeId: "bnGWzGNeG3s",
      energy: 0.6,
      danceability: 0.7,
      valence: 0.6,
      tempo: 140,
      acousticness: 0.2,
      instrumentalness: 0.0,
      liveness: 0.15,
      speechiness: 0.2,
      loudness: -6.1,
      avgRating: 4.4,
      totalRatings: 756,
      isOfficial: true,
      releaseType: 'ALBUM',
      genres: ['hip-hop', 'melodic-rap'],
      moods: ['chill', 'romantic']
    }
  ];

  // Create songs with relationships
  for (const songData of sampleSongs) {
    const { genres: genreNames, moods: moodNames, ...songInfo } = songData;
    
    // Create the song
    const song = await prisma.song.upsert({
      where: { spotifyId: songInfo.spotifyId },
      update: songInfo,
      create: songInfo
    });

    // Connect genres
    for (const genreSlug of genreNames) {
      const genre = await prisma.genre.findUnique({ where: { slug: genreSlug } });
      if (genre) {
        await prisma.songGenre.upsert({
          where: {
            songId_genreId: {
              songId: song.id,
              genreId: genre.id
            }
          },
          update: {},
          create: {
            songId: song.id,
            genreId: genre.id
          }
        });
      }
    }

    // Connect moods
    for (const moodSlug of moodNames) {
      const mood = await prisma.mood.findUnique({ where: { slug: moodSlug } });
      if (mood) {
        await prisma.songMood.upsert({
          where: {
            songId_moodId: {
              songId: song.id,
              moodId: mood.id
            }
          },
          update: {},
          create: {
            songId: song.id,
            moodId: mood.id
          }
        });
      }
    }
  }

  // Create a sample user
  const sampleUser = await prisma.user.upsert({
    where: { email: 'demo@uziverse.com' },
    update: {},
    create: {
      username: 'uzilover23',
      email: 'demo@uziverse.com',
    }
  });

  // Create sample review
  const songs = await prisma.song.findMany();
  if (songs.length > 0) {
    await prisma.review.upsert({
      where: { 
        userId_songId: {
          userId: sampleUser.id,
          songId: songs[0].id
        }
      },
      update: {},
      create: {
        userId: sampleUser.id,
        songId: songs[0].id,
        reviewText: "This song changed my life. The emotional depth and production are incredible."
      }
    });

    await prisma.rating.upsert({
      where: {
        userId_songId: {
          userId: sampleUser.id,
          songId: songs[0].id
        }
      },
      update: {},
      create: {
        userId: sampleUser.id,
        songId: songs[0].id,
        rating: 5
      }
    });
  }

  console.log('✅ Database seed completed!');
  console.log(`Created ${genres.length} genres, ${moods.length} moods, ${sampleSongs.length} songs`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
