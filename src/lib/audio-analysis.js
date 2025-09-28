/**
 * Audio Feature Analysis Library
 * Handles vector similarity, clustering, and audio feature processing
 */

/**
 * Calculate cosine similarity between two audio feature vectors
 */
export function cosineSimilarity(features1, features2) {
  const keys = Object.keys(features1).filter(key => 
    typeof features1[key] === 'number' && typeof features2[key] === 'number'
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
 * Calculate Euclidean distance between two audio feature vectors
 */
export function euclideanDistance(features1, features2) {
  const keys = Object.keys(features1).filter(key => 
    typeof features1[key] === 'number' && typeof features2[key] === 'number'
  );
  
  if (keys.length === 0) return Infinity;

  let sum = 0;
  for (const key of keys) {
    const diff = features1[key] - features2[key];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Normalize audio features to 0-1 range
 */
export function normalizeFeatures(features) {
  const normalized = { ...features };
  
  // Define normalization ranges for each feature
  const ranges = {
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

  for (const [key, range] of Object.entries(ranges)) {
    if (normalized[key] !== undefined && normalized[key] !== null) {
      normalized[key] = (normalized[key] - range.min) / (range.max - range.min);
      normalized[key] = Math.max(0, Math.min(1, normalized[key]));
    }
  }

  return normalized;
}

/**
 * Weight audio features for recommendation scoring
 */
export function weightFeatures(features, weights = {}) {
  const defaultWeights = {
    energy: 0.2,
    danceability: 0.15,
    valence: 0.15,
    acousticness: 0.1,
    instrumentalness: 0.1,
    liveness: 0.1,
    speechiness: 0.1,
    tempo: 0.1
  };

  const finalWeights = { ...defaultWeights, ...weights };
  const weighted = {};

  for (const [key, value] of Object.entries(features)) {
    if (typeof value === 'number' && finalWeights[key] !== undefined) {
      weighted[key] = value * finalWeights[key];
    }
  }

  return weighted;
}

/**
 * Simple K-means clustering for genre/mood classification
 */
export function kMeansClustering(songs, k, maxIterations = 100) {
  if (songs.length === 0 || k <= 0) return [];

  // Extract audio features
  const features = songs.map(song => {
    const audioFeatures = song.audioFeatures || {};
    return normalizeFeatures({
      energy: audioFeatures.energy || 0,
      danceability: audioFeatures.danceability || 0,
      valence: audioFeatures.valence || 0,
      acousticness: audioFeatures.acousticness || 0,
      tempo: audioFeatures.tempo || 120
    });
  });

  // Initialize centroids randomly
  let centroids = [];
  for (let i = 0; i < k; i++) {
    const randomIndex = Math.floor(Math.random() * features.length);
    centroids.push({ ...features[randomIndex] });
  }

  let clusters = [];
  let iterations = 0;

  while (iterations < maxIterations) {
    // Assign each song to nearest centroid
    clusters = Array(k).fill().map(() => []);
    
    for (let i = 0; i < features.length; i++) {
      let minDistance = Infinity;
      let closestCluster = 0;

      for (let j = 0; j < k; j++) {
        const distance = euclideanDistance(features[i], centroids[j]);
        if (distance < minDistance) {
          minDistance = distance;
          closestCluster = j;
        }
      }

      clusters[closestCluster].push({
        song: songs[i],
        features: features[i]
      });
    }

    // Update centroids
    const newCentroids = [];
    for (let i = 0; i < k; i++) {
      if (clusters[i].length === 0) {
        newCentroids.push({ ...centroids[i] });
        continue;
      }

      const newCentroid = {};
      const featureKeys = Object.keys(clusters[i][0].features);
      
      for (const key of featureKeys) {
        newCentroid[key] = clusters[i].reduce((sum, item) => 
          sum + item.features[key], 0
        ) / clusters[i].length;
      }

      newCentroids.push(newCentroid);
    }

    // Check for convergence
    let converged = true;
    for (let i = 0; i < k; i++) {
      const distance = euclideanDistance(centroids[i], newCentroids[i]);
      if (distance > 0.001) {
        converged = false;
        break;
      }
    }

    centroids = newCentroids;
    iterations++;

    if (converged) break;
  }

  return clusters.map((cluster, index) => ({
    id: index,
    centroid: centroids[index],
    songs: cluster.map(item => item.song),
    size: cluster.length
  }));
}

/**
 * Find similar songs based on audio features
 */
export function findSimilarSongs(targetSong, allSongs, limit = 10) {
  if (!targetSong.audioFeatures) return [];

  const targetFeatures = normalizeFeatures(targetSong.audioFeatures);
  const similarities = [];

  for (const song of allSongs) {
    if (song.id === targetSong.id || !song.audioFeatures) continue;

    const songFeatures = normalizeFeatures(song.audioFeatures);
    const similarity = cosineSimilarity(targetFeatures, songFeatures);
    
    similarities.push({
      song,
      similarity,
      distance: euclideanDistance(targetFeatures, songFeatures)
    });
  }

  // Sort by similarity (descending) and return top results
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(item => ({
      ...item.song,
      similarity: item.similarity,
      distance: item.distance
    }));
}

/**
 * Generate audio feature signature for a song
 */
export function generateAudioSignature(audioFeatures) {
  if (!audioFeatures) return null;

  const normalized = normalizeFeatures(audioFeatures);
  
  // Create a signature based on dominant features
  const signature = {
    primary: {},
    secondary: {},
    characteristics: []
  };

  // Identify primary characteristics
  if (normalized.energy > 0.7) signature.characteristics.push('high-energy');
  if (normalized.danceability > 0.7) signature.characteristics.push('danceable');
  if (normalized.valence > 0.7) signature.characteristics.push('positive');
  if (normalized.acousticness > 0.7) signature.characteristics.push('acoustic');
  if (normalized.speechiness > 0.7) signature.characteristics.push('vocal-heavy');

  // Tempo classification
  if (normalized.tempo > 0.8) signature.characteristics.push('fast-tempo');
  else if (normalized.tempo < 0.3) signature.characteristics.push('slow-tempo');
  else signature.characteristics.push('medium-tempo');

  return signature;
}

/**
 * Calculate genre probability based on audio features
 */
export function calculateGenreProbabilities(audioFeatures) {
  const normalized = normalizeFeatures(audioFeatures);
  
  const genreModels = {
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
  };

  const probabilities = {};
  
  for (const [genre, model] of Object.entries(genreModels)) {
    const similarity = cosineSimilarity(normalized, model);
    probabilities[genre] = Math.max(0, similarity);
  }

  // Normalize probabilities to sum to 1
  const total = Object.values(probabilities).reduce((sum, prob) => sum + prob, 0);
  if (total > 0) {
    for (const genre in probabilities) {
      probabilities[genre] = probabilities[genre] / total;
    }
  }

  return probabilities;
}

/**
 * Advanced similarity scoring with multiple factors
 */
export function calculateAdvancedSimilarity(song1, song2, weights = {}) {
  const defaultWeights = {
    audioFeatures: 0.6,
    genre: 0.2,
    mood: 0.1,
    popularity: 0.1
  };

  const finalWeights = { ...defaultWeights, ...weights };
  let totalScore = 0;

  // Audio features similarity
  if (song1.audioFeatures && song2.audioFeatures) {
    const audioScore = cosineSimilarity(
      normalizeFeatures(song1.audioFeatures),
      normalizeFeatures(song2.audioFeatures)
    );
    totalScore += audioScore * finalWeights.audioFeatures;
  }

  // Genre similarity (if available)
  if (song1.genres && song2.genres) {
    const genre1Names = song1.genres.map(g => g.name);
    const genre2Names = song2.genres.map(g => g.name);
    const commonGenres = genre1Names.filter(g => genre2Names.includes(g));
    const genreScore = commonGenres.length / Math.max(genre1Names.length, genre2Names.length);
    totalScore += genreScore * finalWeights.genre;
  }

  // Mood similarity (if available)
  if (song1.moods && song2.moods) {
    const mood1Names = song1.moods.map(m => m.name);
    const mood2Names = song2.moods.map(m => m.name);
    const commonMoods = mood1Names.filter(m => mood2Names.includes(m));
    const moodScore = commonMoods.length / Math.max(mood1Names.length, mood2Names.length);
    totalScore += moodScore * finalWeights.mood;
  }

  // Popularity similarity
  const popularity1 = song1.popularity || 0;
  const popularity2 = song2.popularity || 0;
  const popularityDiff = Math.abs(popularity1 - popularity2) / 100;
  const popularityScore = 1 - popularityDiff;
  totalScore += popularityScore * finalWeights.popularity;

  return Math.max(0, Math.min(1, totalScore));
}
