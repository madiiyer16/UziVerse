/**
 * AI-Powered Audio Feature Prediction System
 * Handles missing audio features, genres, and moods using machine learning approaches
 */

import { prisma } from './prisma';

/**
 * AI Feature Prediction Engine
 */
export class AIFeaturePredictor {
  constructor() {
    this.featureModels = new Map();
    this.genreModels = new Map();
    this.moodModels = new Map();
    this.initialized = false;
  }

  /**
   * Initialize prediction models with training data
   */
  async initialize() {
    if (this.initialized) return;

    try {
      console.log('🤖 Initializing AI prediction models...');
      
      // Get training data - songs with complete audio features
      const trainingData = await prisma.song.findMany({
        where: {
          AND: [
            { energy: { not: null, gt: 0 } },
            { danceability: { not: null, gt: 0 } },
            { valence: { not: null, gt: 0 } },
            { tempo: { not: null, gt: 0 } }
          ]
        },
        include: {
          genres: true,
          moods: true
        }
      });

      if (trainingData.length < 5) {
        console.warn('⚠️ Insufficient training data for AI models, using fallback predictions');
        this.initializeFallbackModels();
        this.initialized = true;
        return;
      }

      // Train feature prediction models
      await this.trainFeatureModels(trainingData);
      
      // Train genre prediction models (even with fewer samples)
      await this.trainGenreModels(trainingData);
      
      // Train mood prediction models (even with fewer samples)
      await this.trainMoodModels(trainingData);

      this.initialized = true;
      console.log(`✅ AI models initialized with ${trainingData.length} training samples`);
    } catch (error) {
      console.error('Error initializing AI models:', error);
      // Initialize fallback models on error
      this.initializeFallbackModels();
      this.initialized = true;
    }
  }

  /**
   * Initialize fallback models when training data is insufficient
   */
  initializeFallbackModels() {
    console.log('🔄 Initializing fallback prediction models...');
    
    // Initialize with default genre models
    this.genreModels.set('averages', {
      'Trap': {
        energy: 0.8,
        danceability: 0.7,
        valence: 0.5,
        tempo: 0.8,
        speechiness: 0.6
      },
      'Hip-Hop': {
        energy: 0.6,
        danceability: 0.6,
        valence: 0.5,
        tempo: 0.5,
        speechiness: 0.8
      },
      'R&B': {
        energy: 0.5,
        danceability: 0.7,
        valence: 0.6,
        tempo: 0.4,
        speechiness: 0.3
      },
      'Pop': {
        energy: 0.7,
        danceability: 0.8,
        valence: 0.7,
        tempo: 0.6,
        speechiness: 0.2
      }
    });

    // Initialize with default mood models
    this.moodModels.set('averages', {
      'Energetic': {
        energy: 0.8,
        danceability: 0.7,
        valence: 0.6,
        tempo: 0.8
      },
      'Chill': {
        energy: 0.3,
        danceability: 0.5,
        valence: 0.6,
        tempo: 0.3
      },
      'Happy': {
        energy: 0.6,
        danceability: 0.7,
        valence: 0.8,
        tempo: 0.6
      },
      'Sad': {
        energy: 0.3,
        danceability: 0.4,
        valence: 0.2,
        tempo: 0.4
      },
      'Danceable': {
        energy: 0.7,
        danceability: 0.9,
        valence: 0.7,
        tempo: 0.7
      },
      'Aggressive': {
        energy: 0.9,
        danceability: 0.6,
        valence: 0.3,
        tempo: 0.8
      }
    });

    // Initialize with basic feature correlations
    this.featureModels.set('correlations', {
      energy: {
        danceability: 0.3,
        valence: 0.4,
        tempo: 0.2
      },
      danceability: {
        energy: 0.3,
        valence: 0.5,
        tempo: 0.1
      },
      valence: {
        energy: 0.4,
        danceability: 0.5,
        tempo: 0.1
      },
      tempo: {
        energy: 0.2,
        danceability: 0.1,
        valence: 0.1
      }
    });

    console.log('✅ Fallback models initialized');
  }

  /**
   * Predict missing audio features for a song
   */
  async predictAudioFeatures(song) {
    await this.initialize();

    const predictions = {
      energy: song.energy,
      danceability: song.danceability,
      valence: song.valence,
      tempo: song.tempo,
      acousticness: song.acousticness,
      instrumentalness: song.instrumentalness,
      liveness: song.liveness,
      speechiness: song.speechiness,
      loudness: song.loudness,
      mode: song.mode,
      key: song.key,
      timeSignature: song.timeSignature
    };

    // Predict missing features based on available data
    const missingFeatures = Object.entries(predictions)
      .filter(([key, value]) => value === null || value === undefined || value === 0)
      .map(([key]) => key);

    if (missingFeatures.length === 0) {
      return predictions;
    }

    // Use available features to predict missing ones
    const availableFeatures = Object.entries(predictions)
      .filter(([key, value]) => value !== null && value !== undefined && value !== 0)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    // Predict each missing feature
    for (const feature of missingFeatures) {
      predictions[feature] = await this.predictFeature(feature, availableFeatures, song);
    }

    return predictions;
  }

  /**
   * Predict genres for a song based on available data
   */
  async predictGenres(song) {
    await this.initialize();

    // If song already has genres, return them
    if (song.genres && song.genres.length > 0) {
      return song.genres.map(g => g.name);
    }

    const audioFeatures = await this.predictAudioFeatures(song);
    const predictedGenres = this.predictGenresFromFeatures(audioFeatures, song);

    return predictedGenres;
  }

  /**
   * Predict moods for a song based on available data
   */
  async predictMoods(song) {
    await this.initialize();

    // If song already has moods, return them
    if (song.moods && song.moods.length > 0) {
      return song.moods.map(m => m.name);
    }

    const audioFeatures = await this.predictAudioFeatures(song);
    const predictedMoods = this.predictMoodsFromFeatures(audioFeatures, song);

    return predictedMoods;
  }

  /**
   * Train feature prediction models
   */
  async trainFeatureModels(trainingData) {
    // Create feature correlation models
    const featureCorrelations = this.calculateFeatureCorrelations(trainingData);
    this.featureModels.set('correlations', featureCorrelations);

    // Create artist-based models
    const artistModels = this.createArtistModels(trainingData);
    this.featureModels.set('artists', artistModels);

    // Create year-based models
    const yearModels = this.createYearModels(trainingData);
    this.featureModels.set('years', yearModels);
  }

  /**
   * Train genre prediction models
   */
  async trainGenreModels(trainingData) {
    const genreFeatures = {};
    
    for (const song of trainingData) {
      const genres = song.genres.map(g => g.name);
      const features = this.extractAudioFeatures(song);
      
      for (const genre of genres) {
        if (!genreFeatures[genre]) {
          genreFeatures[genre] = [];
        }
        genreFeatures[genre].push(features);
      }
    }

    // Calculate average features for each genre
    const genreAverages = {};
    for (const [genre, features] of Object.entries(genreFeatures)) {
      genreAverages[genre] = this.calculateAverageFeatures(features);
    }

    this.genreModels.set('averages', genreAverages);
  }

  /**
   * Train mood prediction models
   */
  async trainMoodModels(trainingData) {
    const moodFeatures = {};
    
    for (const song of trainingData) {
      const moods = song.moods.map(m => m.name);
      const features = this.extractAudioFeatures(song);
      
      for (const mood of moods) {
        if (!moodFeatures[mood]) {
          moodFeatures[mood] = [];
        }
        moodFeatures[mood].push(features);
      }
    }

    // Calculate average features for each mood
    const moodAverages = {};
    for (const [mood, features] of Object.entries(moodFeatures)) {
      moodAverages[mood] = this.calculateAverageFeatures(features);
    }

    this.moodModels.set('averages', moodAverages);
  }

  /**
   * Predict a specific feature based on available data
   */
  async predictFeature(featureName, availableFeatures, song) {
    const correlations = this.featureModels.get('correlations');
    const artistModels = this.featureModels.get('artists');
    const yearModels = this.featureModels.get('years');

    let prediction = null;
    let confidence = 0;

    // Try artist-based prediction first
    if (artistModels && artistModels[song.artist]) {
      const artistFeatures = artistModels[song.artist];
      if (artistFeatures[featureName] !== undefined) {
        prediction = artistFeatures[featureName];
        confidence = 0.8;
      }
    }

    // Try year-based prediction
    if (!prediction && yearModels && song.year) {
      const yearRange = this.getYearRange(song.year);
      if (yearModels[yearRange] && yearModels[yearRange][featureName] !== undefined) {
        prediction = yearModels[yearRange][featureName];
        confidence = 0.6;
      }
    }

    // Try correlation-based prediction
    if (!prediction && correlations && correlations[featureName]) {
      const featureCorrelation = correlations[featureName];
      let weightedSum = 0;
      let totalWeight = 0;

      for (const [correlatedFeature, correlation] of Object.entries(featureCorrelation)) {
        if (availableFeatures[correlatedFeature] !== undefined) {
          weightedSum += availableFeatures[correlatedFeature] * correlation;
          totalWeight += Math.abs(correlation);
        }
      }

      if (totalWeight > 0) {
        prediction = weightedSum / totalWeight;
        confidence = Math.min(totalWeight, 0.7);
      }
    }

    // Fallback to default values based on feature type
    if (!prediction) {
      prediction = this.getDefaultFeatureValue(featureName);
      confidence = 0.3;
    }

    // Apply confidence-based adjustment
    return this.adjustPredictionByConfidence(prediction, confidence, featureName);
  }

  /**
   * Predict genres from audio features using advanced ML approach
   */
  predictGenresFromFeatures(audioFeatures, song) {
    const genreAverages = this.genreModels.get('averages');
    if (!genreAverages) return this.predictGenresFromMetadata(song);

    // Use ensemble approach combining multiple prediction methods
    const predictions = [];

    // Method 1: Audio feature similarity
    const audioPredictions = this.predictGenresFromAudioFeatures(audioFeatures, genreAverages);
    predictions.push(...audioPredictions.map(p => ({ genre: p, confidence: p.confidence, method: 'audio' })));

    // Method 2: Metadata-based prediction
    const metadataPredictions = this.predictGenresFromMetadata(song);
    predictions.push(...metadataPredictions.map(p => ({ genre: p, confidence: 0.6, method: 'metadata' })));

    // Method 3: Artist-based prediction
    const artistPredictions = this.predictGenresFromArtist(song.artist);
    predictions.push(...artistPredictions.map(p => ({ genre: p, confidence: 0.7, method: 'artist' })));

    // Method 4: Year-based prediction
    const yearPredictions = this.predictGenresFromYear(song.year);
    predictions.push(...yearPredictions.map(p => ({ genre: p, confidence: 0.5, method: 'year' })));

    // Combine predictions using weighted voting
    const combinedScores = {};
    for (const prediction of predictions) {
      if (!combinedScores[prediction.genre]) {
        combinedScores[prediction.genre] = 0;
      }
      combinedScores[prediction.genre] += prediction.confidence;
    }

    // Return top genres with highest combined scores
    return Object.entries(combinedScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([genre]) => genre);
  }

  /**
   * Predict genres from audio features using similarity
   */
  predictGenresFromAudioFeatures(audioFeatures, genreAverages) {
    const genreScores = {};
    
    for (const [genre, avgFeatures] of Object.entries(genreAverages)) {
      const similarity = this.calculateFeatureSimilarity(audioFeatures, avgFeatures);
      genreScores[genre] = { genre, confidence: similarity };
    }

    return Object.values(genreScores)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }

  /**
   * Predict genres from metadata using advanced heuristics
   */
  predictGenresFromMetadata(song) {
    const predictions = [];
    
    // Artist-based predictions
    const artistLower = song.artist.toLowerCase();
    if (artistLower.includes('uzi') || artistLower.includes('vert')) {
      predictions.push('Trap', 'Hip-Hop', 'Rap');
    }
    
    // Title-based predictions
    const titleLower = song.title.toLowerCase();
    if (titleLower.includes('trap') || titleLower.includes('drill')) {
      predictions.push('Trap');
    }
    if (titleLower.includes('love') || titleLower.includes('heart')) {
      predictions.push('R&B', 'Pop');
    }
    if (titleLower.includes('party') || titleLower.includes('dance')) {
      predictions.push('Pop', 'Dance');
    }
    
    // Year-based predictions
    if (song.year) {
      if (song.year >= 2015 && song.year <= 2020) {
        predictions.push('Trap', 'Hip-Hop');
      } else if (song.year >= 2020) {
        predictions.push('Rap', 'Hip-Hop');
      }
    }
    
    // Remove duplicates and return top predictions
    return [...new Set(predictions)].slice(0, 2);
  }

  /**
   * Predict genres from artist name
   */
  predictGenresFromArtist(artist) {
    const artistLower = artist.toLowerCase();
    const predictions = [];
    
    // Known artist patterns
    const artistPatterns = {
      'trap': ['uzi', 'vert', 'carti', 'thug', 'future', 'migos'],
      'hip-hop': ['drake', 'kendrick', 'cole', 'kanye', 'jay-z'],
      'r&b': ['weeknd', 'beyonce', 'rihanna', 'usher', 'chris brown'],
      'pop': ['taylor', 'swift', 'ariana', 'grande', 'justin', 'bieber']
    };
    
    for (const [genre, patterns] of Object.entries(artistPatterns)) {
      if (patterns.some(pattern => artistLower.includes(pattern))) {
        predictions.push(genre);
      }
    }
    
    return predictions;
  }

  /**
   * Predict genres from release year
   */
  predictGenresFromYear(year) {
    if (!year) return [];
    
    const predictions = [];
    
    if (year >= 2010 && year <= 2015) {
      predictions.push('Hip-Hop', 'Pop');
    } else if (year >= 2015 && year <= 2020) {
      predictions.push('Trap', 'Hip-Hop', 'Rap');
    } else if (year >= 2020) {
      predictions.push('Rap', 'Hip-Hop', 'Trap');
    }
    
    return predictions;
  }

  /**
   * Predict moods from audio features using advanced ML approach
   */
  predictMoodsFromFeatures(audioFeatures, song) {
    const moodAverages = this.moodModels.get('averages');
    if (!moodAverages) return this.predictMoodsFromMetadata(song);

    // Use ensemble approach combining multiple prediction methods
    const predictions = [];

    // Method 1: Audio feature similarity
    const audioPredictions = this.predictMoodsFromAudioFeatures(audioFeatures, moodAverages);
    predictions.push(...audioPredictions.map(p => ({ mood: p, confidence: p.confidence, method: 'audio' })));

    // Method 2: Metadata-based prediction
    const metadataPredictions = this.predictMoodsFromMetadata(song);
    predictions.push(...metadataPredictions.map(p => ({ mood: p, confidence: 0.6, method: 'metadata' })));

    // Method 3: Title-based prediction
    const titlePredictions = this.predictMoodsFromTitle(song.title);
    predictions.push(...titlePredictions.map(p => ({ mood: p, confidence: 0.5, method: 'title' })));

    // Method 4: Genre-based prediction
    const genrePredictions = this.predictMoodsFromGenres(song.genres || []);
    predictions.push(...genrePredictions.map(p => ({ mood: p, confidence: 0.4, method: 'genre' })));

    // Combine predictions using weighted voting
    const combinedScores = {};
    for (const prediction of predictions) {
      if (!combinedScores[prediction.mood]) {
        combinedScores[prediction.mood] = 0;
      }
      combinedScores[prediction.mood] += prediction.confidence;
    }

    // Return top moods with highest combined scores
    return Object.entries(combinedScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([mood]) => mood);
  }

  /**
   * Predict moods from audio features using similarity
   */
  predictMoodsFromAudioFeatures(audioFeatures, moodAverages) {
    const moodScores = {};
    
    for (const [mood, avgFeatures] of Object.entries(moodAverages)) {
      const similarity = this.calculateFeatureSimilarity(audioFeatures, avgFeatures);
      moodScores[mood] = { mood, confidence: similarity };
    }

    return Object.values(moodScores)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }

  /**
   * Predict moods from metadata using advanced heuristics
   */
  predictMoodsFromMetadata(song) {
    const predictions = [];
    
    // Energy-based predictions
    if (song.energy && song.energy > 0.7) {
      predictions.push('Energetic', 'Upbeat');
    } else if (song.energy && song.energy < 0.3) {
      predictions.push('Chill', 'Relaxed');
    }
    
    // Valence-based predictions
    if (song.valence && song.valence > 0.7) {
      predictions.push('Happy', 'Positive');
    } else if (song.valence && song.valence < 0.3) {
      predictions.push('Sad', 'Melancholic');
    }
    
    // Danceability-based predictions
    if (song.danceability && song.danceability > 0.7) {
      predictions.push('Danceable', 'Party');
    }
    
    // Tempo-based predictions
    if (song.tempo && song.tempo > 140) {
      predictions.push('Fast', 'Energetic');
    } else if (song.tempo && song.tempo < 80) {
      predictions.push('Slow', 'Chill');
    }
    
    // Remove duplicates and return top predictions
    return [...new Set(predictions)].slice(0, 2);
  }

  /**
   * Predict moods from song title
   */
  predictMoodsFromTitle(title) {
    if (!title) return [];
    
    const titleLower = title.toLowerCase();
    const predictions = [];
    
    // Mood keywords
    const moodKeywords = {
      'Happy': ['happy', 'joy', 'smile', 'sunshine', 'bright', 'cheerful'],
      'Sad': ['sad', 'cry', 'tears', 'lonely', 'broken', 'hurt', 'pain'],
      'Energetic': ['energy', 'fire', 'power', 'strong', 'wild', 'crazy'],
      'Chill': ['chill', 'calm', 'peaceful', 'quiet', 'soft', 'gentle'],
      'Romantic': ['love', 'heart', 'romance', 'kiss', 'sweet', 'tender'],
      'Aggressive': ['fight', 'war', 'battle', 'rage', 'angry', 'furious'],
      'Party': ['party', 'dance', 'club', 'night', 'celebration', 'fun']
    };
    
    for (const [mood, keywords] of Object.entries(moodKeywords)) {
      if (keywords.some(keyword => titleLower.includes(keyword))) {
        predictions.push(mood);
      }
    }
    
    return predictions;
  }

  /**
   * Predict moods from genres
   */
  predictMoodsFromGenres(genres) {
    if (!genres || genres.length === 0) return [];
    
    const predictions = [];
    const genreNames = genres.map(g => g.name || g).map(name => name.toLowerCase());
    
    // Genre-mood mappings
    const genreMoodMappings = {
      'trap': ['Energetic', 'Aggressive'],
      'hip-hop': ['Energetic', 'Confident'],
      'rap': ['Aggressive', 'Confident'],
      'r&b': ['Romantic', 'Chill'],
      'pop': ['Happy', 'Danceable'],
      'rock': ['Energetic', 'Aggressive'],
      'jazz': ['Chill', 'Sophisticated'],
      'classical': ['Peaceful', 'Sophisticated'],
      'electronic': ['Energetic', 'Danceable'],
      'country': ['Happy', 'Nostalgic']
    };
    
    for (const genreName of genreNames) {
      for (const [genre, moods] of Object.entries(genreMoodMappings)) {
        if (genreName.includes(genre)) {
          predictions.push(...moods);
        }
      }
    }
    
    return [...new Set(predictions)].slice(0, 2);
  }

  /**
   * Calculate feature correlations from training data
   */
  calculateFeatureCorrelations(trainingData) {
    const features = ['energy', 'danceability', 'valence', 'tempo', 'acousticness', 'instrumentalness', 'liveness', 'speechiness'];
    const correlations = {};

    for (const feature of features) {
      correlations[feature] = {};
      
      for (const otherFeature of features) {
        if (feature !== otherFeature) {
          const correlation = this.calculateCorrelation(
            trainingData.map(s => s[feature]).filter(v => v !== null),
            trainingData.map(s => s[otherFeature]).filter(v => v !== null)
          );
          correlations[feature][otherFeature] = correlation;
        }
      }
    }

    return correlations;
  }

  /**
   * Create artist-based feature models
   */
  createArtistModels(trainingData) {
    const artistFeatures = {};
    
    for (const song of trainingData) {
      if (!artistFeatures[song.artist]) {
        artistFeatures[song.artist] = [];
      }
      artistFeatures[song.artist].push(this.extractAudioFeatures(song));
    }

    const artistModels = {};
    for (const [artist, features] of Object.entries(artistFeatures)) {
      if (features.length >= 3) { // Only use artists with enough data
        artistModels[artist] = this.calculateAverageFeatures(features);
      }
    }

    return artistModels;
  }

  /**
   * Create year-based feature models
   */
  createYearModels(trainingData) {
    const yearFeatures = {};
    
    for (const song of trainingData) {
      if (song.year) {
        const yearRange = this.getYearRange(song.year);
        if (!yearFeatures[yearRange]) {
          yearFeatures[yearRange] = [];
        }
        yearFeatures[yearRange].push(this.extractAudioFeatures(song));
      }
    }

    const yearModels = {};
    for (const [yearRange, features] of Object.entries(yearFeatures)) {
      if (features.length >= 5) { // Only use year ranges with enough data
        yearModels[yearRange] = this.calculateAverageFeatures(features);
      }
    }

    return yearModels;
  }

  /**
   * Extract audio features from song
   */
  extractAudioFeatures(song) {
    return {
      energy: song.energy || 0,
      danceability: song.danceability || 0,
      valence: song.valence || 0,
      tempo: song.tempo || 120,
      acousticness: song.acousticness || 0,
      instrumentalness: song.instrumentalness || 0,
      liveness: song.liveness || 0,
      speechiness: song.speechiness || 0,
      loudness: song.loudness || -10,
      mode: song.mode || 1,
      key: song.key || 0,
      timeSignature: song.timeSignature || 4
    };
  }

  /**
   * Calculate average features from array of feature objects
   */
  calculateAverageFeatures(featuresArray) {
    if (featuresArray.length === 0) return {};

    const averages = {};
    const featureKeys = Object.keys(featuresArray[0]);

    for (const key of featureKeys) {
      const values = featuresArray.map(f => f[key]).filter(v => v !== null && v !== undefined);
      if (values.length > 0) {
        averages[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
      }
    }

    return averages;
  }

  /**
   * Calculate correlation between two arrays
   */
  calculateCorrelation(x, y) {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate similarity between two feature objects
   */
  calculateFeatureSimilarity(features1, features2) {
    const keys = Object.keys(features1).filter(key => 
      features1[key] !== null && features1[key] !== undefined &&
      features2[key] !== null && features2[key] !== undefined
    );

    if (keys.length === 0) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (const key of keys) {
      dotProduct += features1[key] * features2[key];
      norm1 += features1[key] * features1[key];
      norm2 += features2[key] * features2[key];
    }

    if (norm1 === 0 || norm2 === 0) return 0;

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Get year range for grouping
   */
  getYearRange(year) {
    if (year < 2000) return '1990s';
    if (year < 2010) return '2000s';
    if (year < 2020) return '2010s';
    return '2020s';
  }

  /**
   * Get default value for a feature
   */
  getDefaultFeatureValue(featureName) {
    const defaults = {
      energy: 0.5,
      danceability: 0.5,
      valence: 0.5,
      tempo: 120,
      acousticness: 0.1,
      instrumentalness: 0.1,
      liveness: 0.1,
      speechiness: 0.1,
      loudness: -10,
      mode: 1,
      key: 0,
      timeSignature: 4
    };

    return defaults[featureName] || 0;
  }

  /**
   * Adjust prediction based on confidence
   */
  adjustPredictionByConfidence(prediction, confidence, featureName) {
    const defaultVal = this.getDefaultFeatureValue(featureName);
    
    // Blend prediction with default value based on confidence
    return prediction * confidence + defaultVal * (1 - confidence);
  }
}

/**
 * Enhanced Recommendation Engine with AI Predictions
 */
export class AIEnhancedRecommendationEngine {
  constructor() {
    this.predictor = new AIFeaturePredictor();
  }

  /**
   * Get enhanced recommendations with AI-predicted features
   */
  async getEnhancedRecommendations(userId, options = {}) {
    const { limit = 20 } = options;

    try {
      // Get user's liked songs
      const userLikes = await prisma.userSongLike.findMany({
        where: { userId },
        include: { 
          song: { 
            include: { genres: true, moods: true } 
          } 
        }
      });

      if (userLikes.length === 0) {
        return this.getFallbackRecommendations(limit);
      }

      // Enhance liked songs with AI predictions
      const enhancedLikedSongs = [];
      for (const like of userLikes) {
        const song = like.song;
        const enhancedSong = await this.enhanceSongWithPredictions(song);
        enhancedLikedSongs.push(enhancedSong);
      }

      // Get all songs and enhance them
      const allSongs = await prisma.song.findMany({
        include: { genres: true, moods: true }
      });

      const enhancedAllSongs = [];
      for (const song of allSongs) {
        const enhancedSong = await this.enhanceSongWithPredictions(song);
        enhancedAllSongs.push(enhancedSong);
      }

      // Find similar songs based on enhanced features
      const recommendations = [];
      for (const likedSong of enhancedLikedSongs) {
        const similarSongs = this.findSimilarSongsWithAI(likedSong, enhancedAllSongs, 10);
        recommendations.push(...similarSongs);
      }

      // Remove duplicates and songs user already liked
      const likedSongIds = new Set(userLikes.map(l => l.song.id));
      const uniqueRecommendations = recommendations
        .filter(rec => !likedSongIds.has(rec.id))
        .reduce((acc, rec) => {
          if (!acc.find(r => r.id === rec.id)) {
            acc.push(rec);
          }
          return acc;
        }, []);

      // Sort by similarity and return top results
      return uniqueRecommendations
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting enhanced recommendations:', error);
      return this.getFallbackRecommendations(limit);
    }
  }

  /**
   * Enhance song with AI predictions for missing data
   */
  async enhanceSongWithPredictions(song) {
    const enhancedSong = { ...song };

    // Predict missing audio features
    const predictedFeatures = await this.predictor.predictAudioFeatures(song);
    enhancedSong.audioFeatures = predictedFeatures;

    // Predict missing genres
    const predictedGenres = await this.predictor.predictGenres(song);
    enhancedSong.predictedGenres = predictedGenres;

    // Predict missing moods
    const predictedMoods = await this.predictor.predictMoods(song);
    enhancedSong.predictedMoods = predictedMoods;

    return enhancedSong;
  }

  /**
   * Find similar songs using AI-enhanced features
   */
  findSimilarSongsWithAI(targetSong, allSongs, limit = 10) {
    const similarities = [];

    for (const song of allSongs) {
      if (song.id === targetSong.id) continue;

      const similarity = this.calculateEnhancedSimilarity(targetSong, song);
      
      similarities.push({
        ...song,
        similarity,
        basedOn: targetSong.title
      });
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Calculate enhanced similarity using AI predictions
   */
  calculateEnhancedSimilarity(song1, song2) {
    let totalScore = 0;
    let weightSum = 0;

    // Audio features similarity (60% weight)
    if (song1.audioFeatures && song2.audioFeatures) {
      const audioScore = this.calculateFeatureSimilarity(song1.audioFeatures, song2.audioFeatures);
      totalScore += audioScore * 0.6;
      weightSum += 0.6;
    }

    // Genre similarity (20% weight)
    const genreScore = this.calculateGenreSimilarity(song1, song2);
    totalScore += genreScore * 0.2;
    weightSum += 0.2;

    // Mood similarity (10% weight)
    const moodScore = this.calculateMoodSimilarity(song1, song2);
    totalScore += moodScore * 0.1;
    weightSum += 0.1;

    // Artist similarity (10% weight)
    const artistScore = song1.artist === song2.artist ? 1 : 0;
    totalScore += artistScore * 0.1;
    weightSum += 0.1;

    return weightSum > 0 ? totalScore / weightSum : 0;
  }

  /**
   * Calculate feature similarity
   */
  calculateFeatureSimilarity(features1, features2) {
    const keys = Object.keys(features1).filter(key => 
      features1[key] !== null && features1[key] !== undefined &&
      features2[key] !== null && features2[key] !== undefined
    );

    if (keys.length === 0) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (const key of keys) {
      dotProduct += features1[key] * features2[key];
      norm1 += features1[key] * features1[key];
      norm2 += features2[key] * features2[key];
    }

    if (norm1 === 0 || norm2 === 0) return 0;

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Calculate genre similarity
   */
  calculateGenreSimilarity(song1, song2) {
    const genres1 = song1.genres?.map(g => g.name) || song1.predictedGenres || [];
    const genres2 = song2.genres?.map(g => g.name) || song2.predictedGenres || [];

    if (genres1.length === 0 || genres2.length === 0) return 0;

    const commonGenres = genres1.filter(g => genres2.includes(g));
    return commonGenres.length / Math.max(genres1.length, genres2.length);
  }

  /**
   * Calculate mood similarity
   */
  calculateMoodSimilarity(song1, song2) {
    const moods1 = song1.moods?.map(m => m.name) || song1.predictedMoods || [];
    const moods2 = song2.moods?.map(m => m.name) || song2.predictedMoods || [];

    if (moods1.length === 0 || moods2.length === 0) return 0;

    const commonMoods = moods1.filter(m => moods2.includes(m));
    return commonMoods.length / Math.max(moods1.length, moods2.length);
  }

  /**
   * Get fallback recommendations when AI fails
   */
  async getFallbackRecommendations(limit) {
    try {
      const songs = await prisma.song.findMany({
        orderBy: [
          { totalLikes: 'desc' },
          { avgRating: 'desc' },
          { totalPlays: 'desc' }
        ],
        take: limit,
        include: { genres: true, moods: true }
      });

      return songs.map(song => ({
        ...song,
        similarity: 0.5,
        basedOn: 'Popular songs'
      }));
    } catch (error) {
      console.error('Error getting fallback recommendations:', error);
      return [];
    }
  }
}

// Export instances
export const aiPredictor = new AIFeaturePredictor();
export const aiEnhancedEngine = new AIEnhancedRecommendationEngine();
