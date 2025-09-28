/**
 * Spotify Web API Client for Lil Uzi Vert Music Recommender
 * Handles authentication, artist data fetching, and audio features
 */

class SpotifyClient {
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.baseURL = 'https://api.spotify.com/v1';
  }

  /**
   * Get access token using client credentials flow
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials'
      });

      if (!response.ok) {
        throw new Error(`Spotify auth failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000; // 1 minute buffer

      return this.accessToken;
    } catch (error) {
      console.error('Error getting Spotify access token:', error);
      throw error;
    }
  }

  /**
   * Make authenticated request to Spotify API
   */
  async makeRequest(endpoint, options = {}) {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Search for Lil Uzi Vert artist
   */
  async findLilUziVertArtist() {
    try {
      const data = await this.makeRequest('/search?q=Lil%20Uzi%20Vert&type=artist&limit=5');
      
      // Find the exact match for Lil Uzi Vert
      const uziArtist = data.artists.items.find(artist => 
        artist.name.toLowerCase().includes('lil uzi vert') ||
        artist.name.toLowerCase().includes('lil uzi')
      );

      if (!uziArtist) {
        throw new Error('Lil Uzi Vert artist not found on Spotify');
      }

      return uziArtist;
    } catch (error) {
      console.error('Error finding Lil Uzi Vert artist:', error);
      throw error;
    }
  }

  /**
   * Get all albums by artist ID
   */
  async getArtistAlbums(artistId, includeGroups = ['album', 'single']) {
    const albums = [];
    let nextUrl = `/artists/${artistId}/albums?include_groups=${includeGroups.join(',')}&limit=50`;

    try {
      while (nextUrl) {
        const data = await this.makeRequest(nextUrl.replace(this.baseURL, ''));
        albums.push(...data.items);
        nextUrl = data.next;
        
        // Rate limiting - small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return albums;
    } catch (error) {
      console.error('Error fetching artist albums:', error);
      throw error;
    }
  }

  /**
   * Get all tracks from an album
   */
  async getAlbumTracks(albumId) {
    try {
      const data = await this.makeRequest(`/albums/${albumId}/tracks?limit=50`);
      return data.items;
    } catch (error) {
      console.error(`Error fetching album ${albumId} tracks:`, error);
      return [];
    }
  }

  /**
   * Get audio features for multiple tracks
   */
  async getAudioFeatures(trackIds) {
    if (trackIds.length === 0) return [];

    try {
      // Spotify allows up to 100 tracks per request
      const chunks = [];
      for (let i = 0; i < trackIds.length; i += 100) {
        chunks.push(trackIds.slice(i, i + 100));
      }

      const allFeatures = [];
      for (const chunk of chunks) {
        const data = await this.makeRequest(`/audio-features?ids=${chunk.join(',')}`);
        allFeatures.push(...data.audio_features.filter(f => f !== null));
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return allFeatures;
    } catch (error) {
      console.error('Error fetching audio features:', error);
      return [];
    }
  }

  /**
   * Get detailed track information
   */
  async getTrackDetails(trackIds) {
    if (trackIds.length === 0) return [];

    try {
      const chunks = [];
      for (let i = 0; i < trackIds.length; i += 50) {
        chunks.push(trackIds.slice(i, i + 50));
      }

      const allTracks = [];
      for (const chunk of chunks) {
        const data = await this.makeRequest(`/tracks?ids=${chunk.join(',')}`);
        allTracks.push(...data.tracks.filter(t => t !== null));
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return allTracks;
    } catch (error) {
      console.error('Error fetching track details:', error);
      return [];
    }
  }

  /**
   * Get complete Lil Uzi Vert discography with audio features
   */
  async getCompleteDiscography() {
    try {
      console.log('🔍 Finding Lil Uzi Vert artist...');
      const artist = await this.findLilUziVertArtist();
      console.log(`✅ Found artist: ${artist.name} (ID: ${artist.id})`);

      console.log('📀 Fetching all albums...');
      const albums = await this.getArtistAlbums(artist.id);
      console.log(`✅ Found ${albums.length} albums/singles`);

      const allTracks = [];
      const albumDetails = [];

      console.log('🎵 Fetching tracks from albums...');
      for (const album of albums) {
        try {
          const tracks = await this.getAlbumTracks(album.id);
          console.log(`  📀 ${album.name}: ${tracks.length} tracks`);
          
          const trackIds = tracks.map(track => track.id);
          const trackDetails = await this.getTrackDetails(trackIds);
          const audioFeatures = await this.getAudioFeatures(trackIds);

          // Combine track data with audio features
          const enrichedTracks = trackDetails.map(track => {
            const features = audioFeatures.find(f => f.id === track.id);
            return {
              ...track,
              audioFeatures: features,
              album: album
            };
          });

          allTracks.push(...enrichedTracks);
          albumDetails.push({
            ...album,
            trackCount: tracks.length
          });

        } catch (error) {
          console.error(`Error processing album ${album.name}:`, error);
        }
      }

      console.log(`✅ Total tracks found: ${allTracks.length}`);

      return {
        artist,
        albums: albumDetails,
        tracks: allTracks,
        totalTracks: allTracks.length,
        totalAlbums: albumDetails.length
      };

    } catch (error) {
      console.error('Error getting complete discography:', error);
      throw error;
    }
  }

  /**
   * Validate if track is official Lil Uzi Vert release
   */
  isOfficialRelease(track, artist) {
    if (!track || !track.artists) return false;
    
    // Check if Lil Uzi Vert is the primary artist
    const isPrimaryArtist = track.artists.some(trackArtist => 
      trackArtist.id === artist.id
    );

    // Additional validation for official releases
    const isOfficial = track.album && 
                      track.album.album_type !== 'compilation' &&
                      !track.name.toLowerCase().includes('(feat.') && // Exclude features
                      !track.name.toLowerCase().includes('remix') &&
                      !track.name.toLowerCase().includes('live');

    return isPrimaryArtist && isOfficial;
  }
}

// Export singleton instance
export const spotifyClient = new SpotifyClient();
export default spotifyClient;
