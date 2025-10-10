/**
 * Intelligent Data Completion and Validation System
 * Automatically fills in missing song data using AI predictions and validation
 */

import { prisma } from './prisma';
import { aiPredictor } from './ai-prediction';

/**
 * Data Completion Engine
 */
export class DataCompletionEngine {
  constructor() {
    this.batchSize = 50;
    this.maxRetries = 3;
  }

  /**
   * Complete missing data for all songs in the database
   */
  async completeAllSongsData(options = {}) {
    const { 
      dryRun = false, 
      batchSize = this.batchSize,
      maxSongs = null 
    } = options;

    try {
      console.log('🔄 Starting data completion process...');

      // Get songs with missing data
      const songsWithMissingData = await this.getSongsWithMissingData(maxSongs);
      
      if (songsWithMissingData.length === 0) {
        console.log('✅ No songs with missing data found');
        return { completed: 0, skipped: 0, errors: 0 };
      }

      console.log(`📊 Found ${songsWithMissingData.length} songs with missing data`);

      let completed = 0;
      let skipped = 0;
      let errors = 0;

      // Process in batches
      for (let i = 0; i < songsWithMissingData.length; i += batchSize) {
        const batch = songsWithMissingData.slice(i, i + batchSize);
        console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(songsWithMissingData.length / batchSize)}`);

        const batchResults = await this.processBatch(batch, dryRun);
        completed += batchResults.completed;
        skipped += batchResults.skipped;
        errors += batchResults.errors;
      }

      console.log(`✅ Data completion finished: ${completed} completed, ${skipped} skipped, ${errors} errors`);
      
      return { completed, skipped, errors };

    } catch (error) {
      console.error('Error in data completion process:', error);
      throw error;
    }
  }

  /**
   * Complete missing data for a specific song
   */
  async completeSongData(songId, options = {}) {
    const { dryRun = false } = options;

    try {
      const song = await prisma.song.findUnique({
        where: { id: songId },
        include: { genres: true, moods: true }
      });

      if (!song) {
        throw new Error(`Song with ID ${songId} not found`);
      }

      const completionData = await this.generateCompletionData(song);
      
      if (dryRun) {
        console.log('Dry run - would update song:', songId, completionData);
        return { success: true, dryRun: true, data: completionData };
      }

      const updatedSong = await this.updateSongWithCompletionData(song, completionData);
      
      return { success: true, song: updatedSong, data: completionData };

    } catch (error) {
      console.error(`Error completing data for song ${songId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get songs with missing data
   */
  async getSongsWithMissingData(maxSongs = null) {
    const whereClause = {
      OR: [
        // Missing audio features
        { energy: null },
        { energy: 0 },
        { danceability: null },
        { danceability: 0 },
        { valence: null },
        { valence: 0 },
        { tempo: null },
        { tempo: 0 },
        // Missing genres
        { genres: { none: {} } },
        // Missing moods
        { moods: { none: {} } }
      ]
    };

    const songs = await prisma.song.findMany({
      where: whereClause,
      include: { genres: true, moods: true },
      take: maxSongs,
      orderBy: { createdAt: 'desc' }
    });

    return songs;
  }

  /**
   * Process a batch of songs
   */
  async processBatch(songs, dryRun = false) {
    let completed = 0;
    let skipped = 0;
    let errors = 0;

    for (const song of songs) {
      try {
        const completionData = await this.generateCompletionData(song);
        
        if (this.shouldSkipCompletion(song, completionData)) {
          skipped++;
          continue;
        }

        if (!dryRun) {
          await this.updateSongWithCompletionData(song, completionData);
        }

        completed++;
      } catch (error) {
        console.error(`Error processing song ${song.id}:`, error);
        errors++;
      }
    }

    return { completed, skipped, errors };
  }

  /**
   * Generate completion data for a song
   */
  async generateCompletionData(song) {
    const completionData = {};

    // Predict missing audio features
    const predictedFeatures = await aiPredictor.predictAudioFeatures(song);
    const missingFeatures = this.getMissingAudioFeatures(song);
    
    for (const feature of missingFeatures) {
      if (predictedFeatures[feature] !== null && predictedFeatures[feature] !== undefined) {
        completionData[feature] = predictedFeatures[feature];
      }
    }

    // Predict missing genres
    if (!song.genres || song.genres.length === 0) {
      const predictedGenres = await aiPredictor.predictGenres(song);
      completionData.predictedGenres = predictedGenres;
    }

    // Predict missing moods
    if (!song.moods || song.moods.length === 0) {
      const predictedMoods = await aiPredictor.predictMoods(song);
      completionData.predictedMoods = predictedMoods;
    }

    return completionData;
  }

  /**
   * Update song with completion data
   */
  async updateSongWithCompletionData(song, completionData) {
    const updateData = {};

    // Update audio features
    const audioFeatures = ['energy', 'danceability', 'valence', 'tempo', 'acousticness', 'instrumentalness', 'liveness', 'speechiness', 'loudness', 'mode', 'key', 'timeSignature'];
    
    for (const feature of audioFeatures) {
      if (completionData[feature] !== undefined) {
        updateData[feature] = completionData[feature];
      }
    }

    // Update song with audio features
    if (Object.keys(updateData).length > 0) {
      await prisma.song.update({
        where: { id: song.id },
        data: updateData
      });
    }

    // Update genres
    if (completionData.predictedGenres && completionData.predictedGenres.length > 0) {
      await this.updateSongGenres(song.id, completionData.predictedGenres);
    }

    // Update moods
    if (completionData.predictedMoods && completionData.predictedMoods.length > 0) {
      await this.updateSongMoods(song.id, completionData.predictedMoods);
    }

    // Return updated song
    return await prisma.song.findUnique({
      where: { id: song.id },
      include: { genres: true, moods: true }
    });
  }

  /**
   * Update song genres
   */
  async updateSongGenres(songId, genreNames) {
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

  /**
   * Update song moods
   */
  async updateSongMoods(songId, moodNames) {
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

  /**
   * Get missing audio features for a song
   */
  getMissingAudioFeatures(song) {
    const features = ['energy', 'danceability', 'valence', 'tempo', 'acousticness', 'instrumentalness', 'liveness', 'speechiness', 'loudness', 'mode', 'key', 'timeSignature'];
    
    return features.filter(feature => 
      song[feature] === null || song[feature] === undefined || song[feature] === 0
    );
  }

  /**
   * Determine if completion should be skipped
   */
  shouldSkipCompletion(song, completionData) {
    // Skip if no completion data
    if (Object.keys(completionData).length === 0) {
      return true;
    }

    // Skip if all predicted values are default/zero
    const hasValidPredictions = Object.values(completionData).some(value => 
      typeof value === 'number' ? value > 0 : Array.isArray(value) ? value.length > 0 : true
    );

    return !hasValidPredictions;
  }

  /**
   * Validate and clean existing data
   */
  async validateAndCleanData() {
    try {
      console.log('🧹 Starting data validation and cleaning...');

      const songs = await prisma.song.findMany({
        include: { genres: true, moods: true }
      });

      let cleaned = 0;
      let errors = 0;

      for (const song of songs) {
        try {
          const cleanedData = this.cleanSongData(song);
          
          if (Object.keys(cleanedData).length > 0) {
            await prisma.song.update({
              where: { id: song.id },
              data: cleanedData
            });
            cleaned++;
          }
        } catch (error) {
          console.error(`Error cleaning song ${song.id}:`, error);
          errors++;
        }
      }

      console.log(`✅ Data cleaning finished: ${cleaned} songs cleaned, ${errors} errors`);
      
      return { cleaned, errors };

    } catch (error) {
      console.error('Error in data validation and cleaning:', error);
      throw error;
    }
  }

  /**
   * Clean song data
   */
  cleanSongData(song) {
    const cleanedData = {};

    // Clean audio features - ensure they're within valid ranges
    const audioFeatures = {
      energy: { min: 0, max: 1 },
      danceability: { min: 0, max: 1 },
      valence: { min: 0, max: 1 },
      acousticness: { min: 0, max: 1 },
      instrumentalness: { min: 0, max: 1 },
      liveness: { min: 0, max: 1 },
      speechiness: { min: 0, max: 1 },
      tempo: { min: 50, max: 200 },
      loudness: { min: -60, max: 0 },
      mode: { min: 0, max: 1 },
      key: { min: 0, max: 11 },
      timeSignature: { min: 3, max: 7 }
    };

    for (const [feature, range] of Object.entries(audioFeatures)) {
      const value = song[feature];
      if (value !== null && value !== undefined) {
        if (value < range.min || value > range.max) {
          // Clamp to valid range
          cleanedData[feature] = Math.max(range.min, Math.min(range.max, value));
        }
      }
    }

    return cleanedData;
  }

  /**
   * Get data completion statistics
   */
  async getCompletionStats() {
    try {
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
        where: {
          genres: { some: {} }
        }
      });

      const songsWithMoods = await prisma.song.count({
        where: {
          moods: { some: {} }
        }
      });

      return {
        totalSongs,
        songsWithCompleteAudioFeatures,
        songsWithGenres,
        songsWithMoods,
        audioFeaturesCompletionRate: Math.round((songsWithCompleteAudioFeatures / totalSongs) * 100),
        genresCompletionRate: Math.round((songsWithGenres / totalSongs) * 100),
        moodsCompletionRate: Math.round((songsWithMoods / totalSongs) * 100)
      };

    } catch (error) {
      console.error('Error getting completion stats:', error);
      throw error;
    }
  }
}

// Export instance
export const dataCompletionEngine = new DataCompletionEngine();
