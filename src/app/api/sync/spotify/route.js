import { NextResponse } from 'next/server';
import { spotifyClient } from '@/lib/spotify';
import { prisma } from '@/lib/prisma';

/**
 * Sync Lil Uzi Vert's complete discography from Spotify
 * POST /api/sync/spotify
 */
export async function POST(request) {
  try {
    const { force = false, dryRun = false } = await request.json();

    console.log('🚀 Starting Spotify sync...', { force, dryRun });

    // Get complete discography from Spotify
    const discography = await spotifyClient.getCompleteDiscography();
    
    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: 'Dry run completed',
        data: {
          artist: discography.artist.name,
          totalAlbums: discography.totalAlbums,
          totalTracks: discography.totalTracks,
          tracks: discography.tracks.slice(0, 5).map(track => ({
            id: track.id,
            name: track.name,
            album: track.album.name,
            artists: track.artists.map(a => a.name),
            audioFeatures: track.audioFeatures ? {
              energy: track.audioFeatures.energy,
              danceability: track.audioFeatures.danceability,
              valence: track.audioFeatures.valence,
              tempo: track.audioFeatures.tempo
            } : null
          }))
        }
      });
    }

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    // Process each track
    for (const track of discography.tracks) {
      try {
        // Validate official release
        if (!spotifyClient.isOfficialRelease(track, discography.artist)) {
          results.skipped++;
          continue;
        }

        const trackData = {
          title: track.name,
          artist: 'Lil Uzi Vert',
          album: track.album.name,
          year: new Date(track.album.release_date).getFullYear(),
          spotifyId: track.id,
          
          // Media
          imageUrl: track.album.images?.[0]?.url,
          previewUrl: track.preview_url,
          duration: Math.round(track.duration_ms / 1000),
          
          // Platform data
          popularity: track.popularity,
          explicit: track.explicit,
          isOfficial: true,
          releaseType: mapReleaseType(track.album.album_type),
          
          // Audio features
          energy: track.audioFeatures?.energy,
          danceability: track.audioFeatures?.danceability,
          valence: track.audioFeatures?.valence,
          tempo: track.audioFeatures?.tempo,
          acousticness: track.audioFeatures?.acousticness,
          instrumentalness: track.audioFeatures?.instrumentalness,
          liveness: track.audioFeatures?.liveness,
          speechiness: track.audioFeatures?.speechiness,
          loudness: track.audioFeatures?.loudness,
          mode: track.audioFeatures?.mode,
          key: track.audioFeatures?.key,
          timeSignature: track.audioFeatures?.time_signature,
        };

        // Check if track already exists
        const existingTrack = await prisma.song.findUnique({
          where: { spotifyId: track.id }
        });

        if (existingTrack && !force) {
          results.skipped++;
          continue;
        }

        if (existingTrack) {
          // Update existing track
          await prisma.song.update({
            where: { spotifyId: track.id },
            data: trackData
          });
          results.updated++;
        } else {
          // Create new track
          await prisma.song.create({
            data: trackData
          });
          results.created++;
        }

        console.log(`✅ Processed: ${track.name} - ${track.album.name}`);

      } catch (error) {
        console.error(`❌ Error processing track ${track.name}:`, error);
        results.errors.push({
          track: track.name,
          error: error.message
        });
      }
    }

    // Update genres and moods based on audio features
    await updateGenresAndMoods(discography.tracks);

    console.log('🎉 Spotify sync completed!', results);

    return NextResponse.json({
      success: true,
      message: 'Spotify sync completed successfully',
      data: {
        artist: discography.artist.name,
        totalProcessed: discography.totalTracks,
        results
      }
    });

  } catch (error) {
    console.error('❌ Spotify sync failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Spotify sync failed', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Map Spotify album type to our ReleaseType enum
 */
function mapReleaseType(spotifyAlbumType) {
  const mapping = {
    'album': 'ALBUM',
    'single': 'SINGLE',
    'compilation': 'COMPILATION'
  };
  return mapping[spotifyAlbumType] || 'ALBUM';
}

/**
 * Update genres and moods based on audio features
 */
async function updateGenresAndMoods(tracks) {
  try {
    console.log('🎭 Updating genres and moods...');

    // Define genre/mood mapping based on audio features
    const genreRules = [
      { name: 'Trap', condition: (f) => f.tempo >= 140 && f.tempo <= 180 && f.energy >= 0.6 },
      { name: 'Hip-Hop', condition: (f) => f.speechiness >= 0.33 && f.tempo >= 60 && f.tempo <= 140 },
      { name: 'Rap', condition: (f) => f.speechiness >= 0.66 && f.energy >= 0.5 },
      { name: 'R&B', condition: (f) => f.valence >= 0.4 && f.valence <= 0.8 && f.danceability >= 0.6 },
      { name: 'Pop', condition: (f) => f.popularity >= 70 && f.valence >= 0.5 && f.danceability >= 0.5 },
    ];

    const moodRules = [
      { name: 'Energetic', condition: (f) => f.energy >= 0.7 },
      { name: 'Chill', condition: (f) => f.energy <= 0.4 && f.valence >= 0.4 },
      { name: 'Sad', condition: (f) => f.valence <= 0.3 },
      { name: 'Happy', condition: (f) => f.valence >= 0.7 },
      { name: 'Danceable', condition: (f) => f.danceability >= 0.7 },
      { name: 'Aggressive', condition: (f) => f.energy >= 0.8 && f.valence <= 0.4 },
    ];

    for (const track of tracks) {
      if (!track.audioFeatures) continue;

      const features = track.audioFeatures;
      const assignedGenres = [];
      const assignedMoods = [];

      // Apply genre rules
      for (const rule of genreRules) {
        if (rule.condition(features)) {
          assignedGenres.push(rule.name);
        }
      }

      // Apply mood rules
      for (const rule of moodRules) {
        if (rule.condition(features)) {
          assignedMoods.push(rule.name);
        }
      }

      // Update database
      if (assignedGenres.length > 0 || assignedMoods.length > 0) {
        try {
          const song = await prisma.song.findUnique({
            where: { spotifyId: track.id },
            include: { genres: true, moods: true }
          });

          if (song) {
            // Update genres
            for (const genreName of assignedGenres) {
              let genre = await prisma.genre.findUnique({ where: { name: genreName } });
              if (!genre) {
                genre = await prisma.genre.create({
                  data: { 
                    name: genreName, 
                    slug: genreName.toLowerCase().replace(/\s+/g, '-')
                  }
                });
              }

              await prisma.songGenre.upsert({
                where: { songId_genreId: { songId: song.id, genreId: genre.id } },
                update: {},
                create: { songId: song.id, genreId: genre.id }
              });
            }

            // Update moods
            for (const moodName of assignedMoods) {
              let mood = await prisma.mood.findUnique({ where: { name: moodName } });
              if (!mood) {
                mood = await prisma.mood.create({
                  data: { 
                    name: moodName, 
                    slug: moodName.toLowerCase().replace(/\s+/g, '-')
                  }
                });
              }

              await prisma.songMood.upsert({
                where: { songId_moodId: { songId: song.id, moodId: mood.id } },
                update: {},
                create: { songId: song.id, moodId: mood.id }
              });
            }
          }
        } catch (error) {
          console.error(`Error updating genres/moods for track ${track.name}:`, error);
        }
      }
    }

    console.log('✅ Genres and moods updated');
  } catch (error) {
    console.error('Error updating genres and moods:', error);
  }
}
