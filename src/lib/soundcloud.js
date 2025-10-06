/**
 * SoundCloud API Client for Lil Uzi Vert Music Recommender
 * Handles authentication and fetching official tracks
 */

class SoundCloudClient {
  constructor() {
    this.clientId = process.env.SOUNDCLOUD_CLIENT_ID;
    this.baseURL = 'https://api.soundcloud.com';
  }

  /**
   * Get Lil Uzi Vert's official SoundCloud tracks
   * Uses SoundCloud's public API to fetch tracks from official account
   */
  async getOfficialTracks(limit = 50, offset = 0) {
    try {
      if (!this.clientId) {
        throw new Error('SoundCloud Client ID not configured');
      }

      // Lil Uzi Vert's official SoundCloud user ID (this is public info)
      const officialUserId = 'liluzivert';
      
      // Fetch tracks from official account using public API
      const response = await fetch(
        `${this.baseURL}/users/${officialUserId}/tracks?client_id=${this.clientId}&limit=${limit}&offset=${offset}`
      );

      if (!response.ok) {
        throw new Error(`SoundCloud API error: ${response.status} ${response.statusText}`);
      }

      const tracks = await response.json();
      
      // Filter for official releases only
      const officialTracks = tracks.filter(track => this.isOfficialRelease(track));
      
      console.log(`🎧 Found ${officialTracks.length} official SoundCloud tracks (${tracks.length} total)`);

      return {
        tracks: officialTracks,
        total: officialTracks.length,
        hasMore: tracks.length === limit,
        offset: offset + tracks.length
      };

    } catch (error) {
      console.error('Error fetching SoundCloud tracks:', error);
      throw error;
    }
  }

  /**
   * Validate if track is official Lil Uzi Vert release
   * Enhanced validation to ensure only legitimate official content
   */
  isOfficialRelease(track) {
    if (!track) return false;

    // Must be from official Lil Uzi Vert account
    const officialUsername = 'liluzivert';
    const userName = track.user?.username?.toLowerCase() || '';
    const permalink = track.permalink_url?.toLowerCase() || '';
    
    const isOfficialAccount = userName === officialUsername || 
                             permalink.includes(`/${officialUsername}/`);

    if (!isOfficialAccount) {
      return false;
    }

    // Additional validation for official releases
    const trackTitle = track.title?.toLowerCase() || '';
    
    // Exclude unofficial content indicators
    const unofficialIndicators = [
      'leak',
      'unreleased',
      'demo',
      'freestyle',
      'remix',
      'live',
      'acapella',
      'instrumental',
      'snippet',
      'preview'
    ];

    const hasUnofficialIndicator = unofficialIndicators.some(indicator => 
      trackTitle.includes(indicator)
    );

    // Must be a proper track (not playlist, etc.)
    const isProperTrack = track.kind === 'track' && 
                         track.duration > 30000 && // At least 30 seconds
                         track.duration < 600000; // Less than 10 minutes

    // Should have basic metadata
    const hasMetadata = track.title && 
                       track.title.length > 2 &&
                       track.permalink_url;

    return isOfficialAccount && 
           !hasUnofficialIndicator && 
           isProperTrack && 
           hasMetadata;
  }

  /**
   * Get track audio features (placeholder)
   * SoundCloud doesn't provide audio features like Spotify
   * This would need to be implemented with audio analysis
   */
  async getAudioFeatures(trackId) {
    // Placeholder - would need audio analysis service
    return {
      energy: null,
      danceability: null,
      valence: null,
      tempo: null,
      acousticness: null,
      instrumentalness: null,
      liveness: null,
      speechiness: null,
      loudness: null,
      mode: null,
      key: null,
      timeSignature: null
    };
  }

  /**
   * Sync SoundCloud tracks with database
   */
  async syncWithDatabase(tracks) {
    const { prisma } = await import('@/lib/prisma');
    
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const track of tracks) {
      try {
        // Check if track already exists
        const existingSong = await prisma.song.findUnique({
          where: { soundcloudId: track.id.toString() }
        });

        const songData = {
          title: track.title,
          artist: 'Lil Uzi Vert',
          album: this.extractAlbumFromTitle(track.title),
          year: this.extractYearFromDate(track.created_at),
          soundcloudId: track.id.toString(),
          imageUrl: track.artwork_url || track.user?.avatar_url,
          previewUrl: track.stream_url ? `${track.stream_url}?client_id=${this.clientId}` : null,
          duration: Math.round(track.duration / 1000), // Convert to seconds
          soundcloudPlays: track.playback_count || 0,
          explicit: track.sharing === 'public' && track.downloadable === false,
          isOfficial: true,
          releaseType: this.determineReleaseType(track),
          // SoundCloud doesn't provide audio features, so we'll leave them null
          // They can be populated later via audio analysis if needed
        };

        if (existingSong) {
          // Update existing song
          await prisma.song.update({
            where: { id: existingSong.id },
            data: {
              ...songData,
              updatedAt: new Date()
            }
          });
          updated++;
        } else {
          // Create new song
          await prisma.song.create({
            data: songData
          });
          created++;
        }
      } catch (error) {
        console.error(`Error syncing track ${track.title}:`, error);
        skipped++;
      }
    }

    console.log(`🎧 SoundCloud sync complete: ${created} created, ${updated} updated, ${skipped} skipped`);
    return { created, updated, skipped };
  }

  /**
   * Extract album name from track title
   */
  extractAlbumFromTitle(title) {
    // Many SoundCloud tracks don't have explicit album info
    // We'll try to extract it from common patterns
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      return parts[1] || 'SoundCloud Release';
    }
    return 'SoundCloud Release';
  }

  /**
   * Extract year from creation date
   */
  extractYearFromDate(dateString) {
    if (!dateString) return null;
    return new Date(dateString).getFullYear();
  }

  /**
   * Determine release type based on track info
   */
  determineReleaseType(track) {
    const title = track.title?.toLowerCase() || '';
    
    if (title.includes('single')) return 'SINGLE';
    if (title.includes('ep')) return 'EP';
    if (title.includes('mixtape')) return 'MIXTAPE';
    if (title.includes('album')) return 'ALBUM';
    
    // Default to single for SoundCloud releases
    return 'SINGLE';
  }
}

// Export singleton instance
export const soundcloudClient = new SoundCloudClient();
export default soundcloudClient;
