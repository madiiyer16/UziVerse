/**
 * Advanced Recommendation Engine
 * Implements collaborative filtering, content-based filtering, and hybrid approaches
 */

import { prisma } from './prisma';
import { 
  cosineSimilarity, 
  euclideanDistance, 
  normalizeFeatures,
  findSimilarSongs,
  calculateAdvancedSimilarity 
} from './audio-analysis';
import { aiEnhancedEngine } from './ai-prediction';

/**
 * Collaborative Filtering Engine
 */
export class CollaborativeFiltering {
  
  /**
   * User-based collaborative filtering
   * Find users with similar taste and recommend songs they like
   */
  async findSimilarUsers(userId, limit = 50) {
    try {
      // Get user's ratings and interactions
      const userRatings = await prisma.rating.findMany({
        where: { userId },
        include: { song: true }
      });

      const userInteractions = await prisma.userSongInteraction.findMany({
        where: { userId },
        include: { song: true }
      });

      if (userRatings.length === 0 && userInteractions.length === 0) {
        return [];
      }

      // Create user profile vector
      const userProfile = this.createUserProfile(userRatings, userInteractions);
      
      // Find other users with interactions
      const otherUsers = await prisma.user.findMany({
        where: { 
          id: { not: userId },
          ratings: { some: {} }
        },
        include: {
          ratings: { include: { song: true } },
          interactions: { include: { song: true } }
        }
      });

      // Calculate similarities
      const similarities = [];
      for (const otherUser of otherUsers) {
        const otherProfile = this.createUserProfile(otherUser.ratings, otherUser.interactions);
        const similarity = this.calculateUserSimilarity(userProfile, otherProfile);
        
        if (similarity > 0.1) { // Threshold for similarity
          similarities.push({
            user: otherUser,
            similarity,
            profile: otherProfile
          });
        }
      }

      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      console.error('Error finding similar users:', error);
      return [];
    }
  }

  /**
   * Item-based collaborative filtering
   * Find songs similar to ones the user has interacted with
   */
  async findSimilarItems(userId, limit = 20) {
    try {
      // Get user's liked/interacted songs
      const userInteractions = await prisma.userSongInteraction.findMany({
        where: { userId },
        include: { song: { include: { genres: true, moods: true } } }
      });

      const userLikes = await prisma.userSongLike.findMany({
        where: { userId },
        include: { song: { include: { genres: true, moods: true } } }
      });

      const userRatedSongs = await prisma.rating.findMany({
        where: { userId, rating: { gte: 4 } }, // High ratings only
        include: { song: { include: { genres: true, moods: true } } }
      });

      const userSongs = [
        ...userInteractions.map(i => ({ ...i.song, interaction: i })),
        ...userLikes.map(l => ({ ...l.song, liked: true })),
        ...userRatedSongs.map(r => ({ ...r.song, rating: r.rating }))
      ];

      if (userSongs.length === 0) return [];

      // Get all songs for similarity comparison
      const allSongs = await prisma.song.findMany({
        include: { genres: true, moods: true }
      });

      // Find similar songs
      const recommendations = new Map();
      
      for (const userSong of userSongs) {
        const similarSongs = findSimilarSongs(userSong, allSongs, 10);
        
        for (const similarSong of similarSongs) {
          if (userSongs.some(us => us.id === similarSong.id)) continue; // Skip already interacted songs
          
          const existingScore = recommendations.get(similarSong.id);
          const newScore = similarSong.similarity * this.getUserSongWeight(userSong);
          
          recommendations.set(similarSong.id, {
            song: similarSong,
            score: existingScore ? Math.max(existingScore.score, newScore) : newScore,
            basedOn: userSong.title
          });
        }
      }

      return Array.from(recommendations.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    } catch (error) {
      console.error('Error finding similar items:', error);
      return [];
    }
  }

  /**
   * Matrix Factorization for sparse user-item interactions
   */
  async matrixFactorization(userId, factors = 10, iterations = 100) {
    try {
      // Get user-item interaction matrix
      const interactions = await this.buildInteractionMatrix();
      
      if (interactions.length === 0) return [];

      // Initialize factor matrices
      const users = [...new Set(interactions.map(i => i.userId))];
      const items = [...new Set(interactions.map(i => i.songId))];
      
      let userFactors = this.initializeFactors(users.length, factors);
      let itemFactors = this.initializeFactors(items.length, factors);

      // Gradient descent
      for (let iter = 0; iter < iterations; iter++) {
        for (const interaction of interactions) {
          const userIdx = users.indexOf(interaction.userId);
          const itemIdx = items.indexOf(interaction.songId);
          
          if (userIdx === -1 || itemIdx === -1) continue;

          const prediction = this.predictRating(userFactors[userIdx], itemFactors[itemIdx]);
          const error = interaction.rating - prediction;
          
          // Update factors
          this.updateFactors(userFactors[userIdx], itemFactors[itemIdx], error, 0.01);
        }
      }

      // Generate recommendations for target user
      const userIdx = users.indexOf(userId);
      if (userIdx === -1) return [];

      const userRecommendations = [];
      for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
        const predictedRating = this.predictRating(userFactors[userIdx], itemFactors[itemIdx]);
        const songId = items[itemIdx];
        
        userRecommendations.push({
          songId,
          predictedRating
        });
      }

      return userRecommendations
        .sort((a, b) => b.predictedRating - a.predictedRating)
        .slice(0, 20);

    } catch (error) {
      console.error('Error in matrix factorization:', error);
      return [];
    }
  }

  /**
   * Create user profile from ratings and interactions
   */
  createUserProfile(ratings, interactions) {
    const profile = {
      genres: {},
      moods: {},
      audioFeatures: {
        energy: 0,
        danceability: 0,
        valence: 0,
        tempo: 0,
        acousticness: 0
      },
      totalWeight: 0
    };

    // Process ratings
    for (const rating of ratings) {
      const weight = rating.rating / 5; // Normalize rating to 0-1
      profile.totalWeight += weight;
      
      // Aggregate audio features
      if (rating.song.audioFeatures) {
        for (const [key, value] of Object.entries(rating.song.audioFeatures)) {
          if (profile.audioFeatures[key] !== undefined && value !== null) {
            profile.audioFeatures[key] += value * weight;
          }
        }
      }
    }

    // Process interactions
    for (const interaction of interactions) {
      const weight = Math.min(interaction.playCount / 10, 1); // Play count weight
      profile.totalWeight += weight;
      
      if (interaction.song.audioFeatures) {
        for (const [key, value] of Object.entries(interaction.song.audioFeatures)) {
          if (profile.audioFeatures[key] !== undefined && value !== null) {
            profile.audioFeatures[key] += value * weight;
          }
        }
      }
    }

    // Normalize audio features
    if (profile.totalWeight > 0) {
      for (const key in profile.audioFeatures) {
        profile.audioFeatures[key] /= profile.totalWeight;
      }
    }

    return profile;
  }

  /**
   * Calculate similarity between two user profiles
   */
  calculateUserSimilarity(profile1, profile2) {
    if (profile1.totalWeight === 0 || profile2.totalWeight === 0) return 0;
    
    return cosineSimilarity(profile1.audioFeatures, profile2.audioFeatures);
  }

  /**
   * Get weight for user-song interaction
   */
  getUserSongWeight(userSong) {
    let weight = 1;
    
    if (userSong.rating) weight += userSong.rating / 5;
    if (userSong.liked) weight += 1;
    if (userSong.interaction) {
      weight += Math.min(userSong.interaction.playCount / 5, 2);
      weight += Math.min(userSong.interaction.totalTime / 180, 1); // 3 minutes = 1 weight point
    }
    
    return weight;
  }

  /**
   * Build interaction matrix from database
   */
  async buildInteractionMatrix() {
    const ratings = await prisma.rating.findMany({
      include: { song: true }
    });

    const interactions = await prisma.userSongInteraction.findMany({
      include: { song: true }
    });

    const matrix = [];

    // Convert ratings to matrix entries
    for (const rating of ratings) {
      matrix.push({
        userId: rating.userId,
        songId: rating.songId,
        rating: rating.rating / 5 // Normalize to 0-1
      });
    }

    // Convert interactions to matrix entries
    for (const interaction of interactions) {
      const playScore = Math.min(interaction.playCount / 10, 1);
      matrix.push({
        userId: interaction.userId,
        songId: interaction.songId,
        rating: playScore
      });
    }

    return matrix;
  }

  /**
   * Initialize factor matrices
   */
  initializeFactors(rows, factors) {
    const matrix = [];
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < factors; j++) {
        row.push(Math.random() * 0.1); // Small random values
      }
      matrix.push(row);
    }
    return matrix;
  }

  /**
   * Predict rating using factor matrices
   */
  predictRating(userFactors, itemFactors) {
    let prediction = 0;
    for (let i = 0; i < userFactors.length; i++) {
      prediction += userFactors[i] * itemFactors[i];
    }
    return Math.max(0, Math.min(1, prediction));
  }

  /**
   * Update factors using gradient descent
   */
  updateFactors(userFactors, itemFactors, error, learningRate) {
    for (let i = 0; i < userFactors.length; i++) {
      const userGradient = -2 * error * itemFactors[i];
      const itemGradient = -2 * error * userFactors[i];
      
      userFactors[i] -= learningRate * userGradient;
      itemFactors[i] -= learningRate * itemGradient;
    }
  }
}

/**
 * Content-Based Filtering Engine
 */
export class ContentBasedFiltering {
  
  /**
   * Get content-based recommendations
   */
  async getRecommendations(userId, limit = 20) {
    try {
      // Get user's preferred songs
      const userPreferences = await this.getUserPreferences(userId);
      
      if (userPreferences.length === 0) {
        return this.getPopularSongs(limit);
      }

      // Get all songs
      const allSongs = await prisma.song.findMany({
        include: { genres: true, moods: true }
      });

      // Calculate similarity scores
      const recommendations = [];
      for (const song of allSongs) {
        // Skip songs user has already interacted with
        const hasInteracted = userPreferences.some(pref => pref.song.id === song.id);
        if (hasInteracted) continue;

        const similarity = this.calculateContentSimilarity(userPreferences, song);
        if (similarity > 0.3) {
          recommendations.push({
            song,
            similarity,
            reason: 'Content-based match'
          });
        }
      }

      return recommendations
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting content-based recommendations:', error);
      return [];
    }
  }

  /**
   * Get user preferences from interactions
   */
  async getUserPreferences(userId) {
    const interactions = await prisma.userSongInteraction.findMany({
      where: { userId },
      include: { song: { include: { genres: true, moods: true } } }
    });

    const likes = await prisma.userSongLike.findMany({
      where: { userId },
      include: { song: { include: { genres: true, moods: true } } }
    });

    const ratings = await prisma.rating.findMany({
      where: { userId, rating: { gte: 4 } },
      include: { song: { include: { genres: true, moods: true } } }
    });

    return [
      ...interactions.map(i => ({ ...i, type: 'interaction' })),
      ...likes.map(l => ({ ...l, type: 'like' })),
      ...ratings.map(r => ({ ...r, type: 'rating' }))
    ];
  }

  /**
   * Calculate content similarity between user preferences and song
   */
  calculateContentSimilarity(userPreferences, song) {
    let totalSimilarity = 0;
    let weightSum = 0;

    for (const preference of userPreferences) {
      const similarity = this.calculateEnhancedSimilarity(preference.song, song);
      const weight = this.getPreferenceWeight(preference);
      
      totalSimilarity += similarity * weight;
      weightSum += weight;
    }

    return weightSum > 0 ? totalSimilarity / weightSum : 0;
  }

  /**
   * Calculate enhanced similarity that handles missing data
   */
  calculateEnhancedSimilarity(song1, song2) {
    const defaultWeights = {
      audioFeatures: 0.5,
      genre: 0.2,
      mood: 0.1,
      artist: 0.1,
      popularity: 0.1
    };

    let totalScore = 0;
    let weightSum = 0;

    // Audio features similarity
    if (this.hasAudioFeatures(song1) && this.hasAudioFeatures(song2)) {
      const audioScore = calculateAdvancedSimilarity(song1, song2);
      totalScore += audioScore * defaultWeights.audioFeatures;
      weightSum += defaultWeights.audioFeatures;
    } else if (this.hasAudioFeatures(song1) || this.hasAudioFeatures(song2)) {
      // If only one song has audio features, use partial scoring
      const audioScore = this.calculatePartialAudioSimilarity(song1, song2);
      totalScore += audioScore * defaultWeights.audioFeatures * 0.5;
      weightSum += defaultWeights.audioFeatures * 0.5;
    }

    // Genre similarity
    if (this.hasGenres(song1) && this.hasGenres(song2)) {
      const genreScore = this.calculateGenreSimilarity(song1, song2);
      totalScore += genreScore * defaultWeights.genre;
      weightSum += defaultWeights.genre;
    } else if (this.hasGenres(song1) || this.hasGenres(song2)) {
      // Use predicted genres for missing data
      const genreScore = this.calculateGenreSimilarityWithPredictions(song1, song2);
      totalScore += genreScore * defaultWeights.genre * 0.7;
      weightSum += defaultWeights.genre * 0.7;
    }

    // Mood similarity
    if (this.hasMoods(song1) && this.hasMoods(song2)) {
      const moodScore = this.calculateMoodSimilarity(song1, song2);
      totalScore += moodScore * defaultWeights.mood;
      weightSum += defaultWeights.mood;
    } else if (this.hasMoods(song1) || this.hasMoods(song2)) {
      // Use predicted moods for missing data
      const moodScore = this.calculateMoodSimilarityWithPredictions(song1, song2);
      totalScore += moodScore * defaultWeights.mood * 0.7;
      weightSum += defaultWeights.mood * 0.7;
    }

    // Artist similarity
    const artistScore = song1.artist === song2.artist ? 1 : 0;
    totalScore += artistScore * defaultWeights.artist;
    weightSum += defaultWeights.artist;

    // Popularity similarity
    const popularity1 = song1.popularity || 0;
    const popularity2 = song2.popularity || 0;
    const popularityDiff = Math.abs(popularity1 - popularity2) / 100;
    const popularityScore = 1 - popularityDiff;
    totalScore += popularityScore * defaultWeights.popularity;
    weightSum += defaultWeights.popularity;

    return weightSum > 0 ? Math.max(0, Math.min(1, totalScore / weightSum)) : 0;
  }

  /**
   * Check if song has audio features
   */
  hasAudioFeatures(song) {
    return song.energy !== null && song.energy !== undefined && song.energy > 0 &&
           song.danceability !== null && song.danceability !== undefined && song.danceability > 0 &&
           song.valence !== null && song.valence !== undefined && song.valence > 0;
  }

  /**
   * Check if song has genres
   */
  hasGenres(song) {
    return song.genres && song.genres.length > 0;
  }

  /**
   * Check if song has moods
   */
  hasMoods(song) {
    return song.moods && song.moods.length > 0;
  }

  /**
   * Calculate partial audio similarity when one song has missing features
   */
  calculatePartialAudioSimilarity(song1, song2) {
    const features1 = this.extractAvailableFeatures(song1);
    const features2 = this.extractAvailableFeatures(song2);
    
    const commonFeatures = Object.keys(features1).filter(key => 
      features2[key] !== undefined && features2[key] !== null
    );

    if (commonFeatures.length === 0) return 0;

    let similarity = 0;
    for (const feature of commonFeatures) {
      const diff = Math.abs(features1[feature] - features2[feature]);
      similarity += 1 - Math.min(diff, 1);
    }

    return similarity / commonFeatures.length;
  }

  /**
   * Extract available audio features from song
   */
  extractAvailableFeatures(song) {
    const features = {};
    const featureKeys = ['energy', 'danceability', 'valence', 'tempo', 'acousticness', 'instrumentalness', 'liveness', 'speechiness'];
    
    for (const key of featureKeys) {
      if (song[key] !== null && song[key] !== undefined && song[key] > 0) {
        features[key] = song[key];
      }
    }

    return features;
  }

  /**
   * Calculate genre similarity with predictions
   */
  calculateGenreSimilarityWithPredictions(song1, song2) {
    const genres1 = song1.genres?.map(g => g.name) || this.predictGenresFromMetadata(song1);
    const genres2 = song2.genres?.map(g => g.name) || this.predictGenresFromMetadata(song2);

    if (genres1.length === 0 || genres2.length === 0) return 0;

    const commonGenres = genres1.filter(g => genres2.includes(g));
    return commonGenres.length / Math.max(genres1.length, genres2.length);
  }

  /**
   * Calculate mood similarity with predictions
   */
  calculateMoodSimilarityWithPredictions(song1, song2) {
    const moods1 = song1.moods?.map(m => m.name) || this.predictMoodsFromMetadata(song1);
    const moods2 = song2.moods?.map(m => m.name) || this.predictMoodsFromMetadata(song2);

    if (moods1.length === 0 || moods2.length === 0) return 0;

    const commonMoods = moods1.filter(m => moods2.includes(m));
    return commonMoods.length / Math.max(moods1.length, moods2.length);
  }

  /**
   * Calculate genre similarity
   */
  calculateGenreSimilarity(song1, song2) {
    const genres1 = song1.genres.map(g => g.name);
    const genres2 = song2.genres.map(g => g.name);

    if (genres1.length === 0 || genres2.length === 0) return 0;

    const commonGenres = genres1.filter(g => genres2.includes(g));
    return commonGenres.length / Math.max(genres1.length, genres2.length);
  }

  /**
   * Calculate mood similarity
   */
  calculateMoodSimilarity(song1, song2) {
    const moods1 = song1.moods.map(m => m.name);
    const moods2 = song2.moods.map(m => m.name);

    if (moods1.length === 0 || moods2.length === 0) return 0;

    const commonMoods = moods1.filter(m => moods2.includes(m));
    return commonMoods.length / Math.max(moods1.length, moods2.length);
  }

  /**
   * Predict genres from metadata when missing
   */
  predictGenresFromMetadata(song) {
    // Simple heuristics based on artist and year
    const predictions = [];
    
    if (song.artist.toLowerCase().includes('uzi')) {
      predictions.push('Trap', 'Hip-Hop');
    }
    
    if (song.year && song.year >= 2015) {
      predictions.push('Rap');
    }
    
    return predictions.length > 0 ? predictions : ['Unknown'];
  }

  /**
   * Predict moods from metadata when missing
   */
  predictMoodsFromMetadata(song) {
    // Simple heuristics based on available data
    const predictions = [];
    
    if (song.energy && song.energy > 0.7) {
      predictions.push('Energetic');
    }
    
    if (song.valence && song.valence > 0.6) {
      predictions.push('Happy');
    }
    
    if (song.danceability && song.danceability > 0.7) {
      predictions.push('Danceable');
    }
    
    return predictions.length > 0 ? predictions : ['Neutral'];
  }

  /**
   * Get weight for user preference
   */
  getPreferenceWeight(preference) {
    switch (preference.type) {
      case 'rating':
        return preference.rating / 5;
      case 'like':
        return 1;
      case 'interaction':
        return Math.min(preference.playCount / 5, 1);
      default:
        return 0.5;
    }
  }

  /**
   * Get popular songs as fallback
   */
  async getPopularSongs(limit = 20) {
    try {
      const songs = await prisma.song.findMany({
        orderBy: [
          { totalPlays: 'desc' },
          { avgRating: 'desc' },
          { popularity: 'desc' }
        ],
        take: limit,
        include: { genres: true, moods: true }
      });

      return songs.map(song => ({
        song,
        similarity: 0.5, // Default similarity for popular songs
        reason: 'Popular song'
      }));
    } catch (error) {
      console.error('Error getting popular songs:', error);
      return [];
    }
  }
}

/**
 * Hybrid Recommendation Engine
 */
export class HybridRecommendationEngine {
  constructor() {
    this.collaborative = new CollaborativeFiltering();
    this.contentBased = new ContentBasedFiltering();
  }

  /**
   * Get hybrid recommendations combining multiple approaches
   */
  async getRecommendations(userId, options = {}) {
    const {
      collaborativeWeight = 0.3,
      contentBasedWeight = 0.3,
      aiEnhancedWeight = 0.3,
      popularityWeight = 0.1,
      limit = 20
    } = options;

    try {
      console.log(`🎯 Generating hybrid recommendations for user ${userId}`);

      // Get recommendations from different approaches
      const [collaborativeRecs, contentBasedRecs, aiEnhancedRecs, popularSongs] = await Promise.all([
        this.collaborative.findSimilarItems(userId, limit),
        this.contentBased.getRecommendations(userId, limit),
        aiEnhancedEngine.getEnhancedRecommendations(userId, { limit }),
        this.contentBased.getPopularSongs(Math.ceil(limit * 0.2))
      ]);

      // Combine and score recommendations
      const combinedRecs = new Map();

      // Add collaborative filtering results
      for (const rec of collaborativeRecs) {
        const score = rec.score * collaborativeWeight;
        combinedRecs.set(rec.song.id, {
          song: rec.song,
          score,
          sources: ['collaborative'],
          details: { basedOn: rec.basedOn }
        });
      }

      // Add content-based results
      for (const rec of contentBasedRecs) {
        const score = rec.similarity * contentBasedWeight;
        const existing = combinedRecs.get(rec.song.id);
        
        if (existing) {
          existing.score += score;
          existing.sources.push('content-based');
        } else {
          combinedRecs.set(rec.song.id, {
            song: rec.song,
            score,
            sources: ['content-based'],
            details: { reason: rec.reason }
          });
        }
      }

      // Add AI-enhanced results
      for (const rec of aiEnhancedRecs) {
        const score = rec.similarity * aiEnhancedWeight;
        const existing = combinedRecs.get(rec.id);
        
        if (existing) {
          existing.score += score;
          existing.sources.push('ai-enhanced');
        } else {
          combinedRecs.set(rec.id, {
            song: rec,
            score,
            sources: ['ai-enhanced'],
            details: { basedOn: rec.basedOn }
          });
        }
      }

      // Add popular songs
      for (const rec of popularSongs) {
        const score = rec.similarity * popularityWeight;
        const existing = combinedRecs.get(rec.song.id);
        
        if (existing) {
          existing.score += score;
          existing.sources.push('popularity');
        } else {
          combinedRecs.set(rec.song.id, {
            song: rec.song,
            score,
            sources: ['popularity'],
            details: { reason: rec.reason }
          });
        }
      }

      // Sort by combined score and return top results
      const finalRecommendations = Array.from(combinedRecs.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((rec, index) => ({
          ...rec.song,
          recommendationScore: rec.score,
          rank: index + 1,
          sources: rec.sources,
          details: rec.details
        }));

      console.log(`✅ Generated ${finalRecommendations.length} hybrid recommendations`);

      return finalRecommendations;

    } catch (error) {
      console.error('Error generating hybrid recommendations:', error);
      return [];
    }
  }

  /**
   * Handle cold start problem for new users
   */
  async getColdStartRecommendations(userId, limit = 20) {
    try {
      // Check if user has any interactions
      const userInteractions = await prisma.userSongInteraction.count({
        where: { userId }
      });

      const userRatings = await prisma.rating.count({
        where: { userId }
      });

      // If user has some interactions, use hybrid approach
      if (userInteractions > 0 || userRatings > 0) {
        return this.getRecommendations(userId, { limit });
      }

      // Cold start: return popular and diverse songs
      const popularSongs = await this.contentBased.getPopularSongs(limit);
      return popularSongs.map(rec => ({
        ...rec.song,
        recommendationScore: rec.similarity,
        sources: ['cold-start'],
        details: { reason: 'Popular songs for new users' }
      }));

    } catch (error) {
      console.error('Error getting cold start recommendations:', error);
      return [];
    }
  }
}

// Export instances
export const collaborativeFiltering = new CollaborativeFiltering();
export const contentBasedFiltering = new ContentBasedFiltering();
export const hybridEngine = new HybridRecommendationEngine();
