'use client';

import { useState } from 'react';
import { Music, Database, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function SpotifySyncPage() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [syncResults, setSyncResults] = useState(null);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/sync/spotify-audio-features?includeDetails=true');
      const data = await response.json();
      
      if (data.success) {
        setStats(data);
      } else {
        setError(data.error || 'Failed to fetch statistics');
      }
    } catch (error) {
      setError('Failed to fetch statistics: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const runSync = async (options = {}) => {
    try {
      setLoading(true);
      setError(null);
      setSyncResults(null);
      
      const response = await fetch('/api/sync/spotify-audio-features', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchSize: 50,
          maxSongs: options.maxSongs || null,
          dryRun: options.dryRun || false,
          force: options.force || false
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSyncResults(data.data);
        // Refresh stats after sync
        await fetchStats();
      } else {
        setError(data.error || 'Sync failed');
      }
    } catch (error) {
      setError('Sync failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Music className="w-8 h-8 text-purple-600" />
            <h1 className="text-4xl font-bold text-gray-900">Spotify Audio Features Sync</h1>
          </div>
          <p className="text-gray-600 text-lg">
            Fill missing audio features for songs using the Spotify API
          </p>
        </div>

        {/* Statistics Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Database Statistics</h2>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              Refresh Stats
            </button>
          </div>

          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-900">{stats.stats.totalSongs}</div>
                <div className="text-sm text-gray-600">Total Songs</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{stats.stats.songsWithCompleteAudioFeatures}</div>
                <div className="text-sm text-gray-600">With Complete Audio Features</div>
                <div className="text-xs text-gray-500">{stats.stats.completionRate}% completion rate</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600">{stats.stats.songsWithMissingAudioFeatures}</div>
                <div className="text-sm text-gray-600">Missing Audio Features</div>
                <div className="text-xs text-gray-500">
                  {stats.stats.songsWithSpotifyId > 0 ? 
                    `${Math.round((stats.stats.songsWithMissingAudioFeatures / stats.stats.songsWithSpotifyId) * 100)}% of Spotify songs` : 
                    '0% of Spotify songs'
                  }
                </div>
              </div>
            </div>
          )}

          {stats?.details?.sampleSongsWithMissingFeatures && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Sample Songs with Missing Features</h3>
              <div className="space-y-2">
                {stats.details.sampleSongsWithMissingFeatures.slice(0, 5).map((song, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{song.title}</div>
                      <div className="text-sm text-gray-600">{song.album} ({song.artist})</div>
                    </div>
                    <div className="text-sm text-gray-500">
                      Energy: {song.energy || 'N/A'} • Dance: {song.danceability || 'N/A'} • Valence: {song.valence || 'N/A'} • Tempo: {song.tempo || 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sync Actions */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Sync Actions</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => runSync({ dryRun: true, maxSongs: 10 })}
              disabled={loading}
              className="p-4 border-2 border-blue-200 rounded-lg hover:border-blue-300 disabled:opacity-50 flex items-center gap-3"
            >
              <AlertCircle className="w-6 h-6 text-blue-600" />
              <div className="text-left">
                <div className="font-semibold text-gray-900">Dry Run (10 songs)</div>
                <div className="text-sm text-gray-600">Test sync without making changes</div>
              </div>
            </button>

            <button
              onClick={() => runSync({ maxSongs: 50 })}
              disabled={loading}
              className="p-4 border-2 border-green-200 rounded-lg hover:border-green-300 disabled:opacity-50 flex items-center gap-3"
            >
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div className="text-left">
                <div className="font-semibold text-gray-900">Sync 50 Songs</div>
                <div className="text-sm text-gray-600">Update missing audio features</div>
              </div>
            </button>

            <button
              onClick={() => runSync({ maxSongs: 200 })}
              disabled={loading}
              className="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-300 disabled:opacity-50 flex items-center gap-3"
            >
              <Database className="w-6 h-6 text-purple-600" />
              <div className="text-left">
                <div className="font-semibold text-gray-900">Sync 200 Songs</div>
                <div className="text-sm text-gray-600">Larger batch update</div>
              </div>
            </button>

            <button
              onClick={() => runSync({ force: true })}
              disabled={loading}
              className="p-4 border-2 border-red-200 rounded-lg hover:border-red-300 disabled:opacity-50 flex items-center gap-3"
            >
              <AlertCircle className="w-6 h-6 text-red-600" />
              <div className="text-left">
                <div className="font-semibold text-gray-900">Force Sync All</div>
                <div className="text-sm text-gray-600">Update all songs (use with caution)</div>
              </div>
            </button>
          </div>
        </div>

        {/* Results */}
        {syncResults && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Sync Results</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{syncResults.processed}</div>
                <div className="text-sm text-gray-600">Processed</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{syncResults.updated}</div>
                <div className="text-sm text-gray-600">Updated</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-600">{syncResults.skipped}</div>
                <div className="text-sm text-gray-600">Skipped</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-600">{syncResults.errors}</div>
                <div className="text-sm text-gray-600">Errors</div>
              </div>
            </div>

            {syncResults.errorDetails && syncResults.errorDetails.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Details</h3>
                <div className="space-y-2">
                  {syncResults.errorDetails.slice(0, 5).map((error, index) => (
                    <div key={index} className="p-3 bg-red-50 rounded-lg">
                      <div className="font-medium text-red-900">{error.title || error.songId}</div>
                      <div className="text-sm text-red-700">{error.error}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div className="font-semibold text-red-900">Error</div>
            </div>
            <div className="text-red-700 mt-1">{error}</div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Loader className="w-5 h-5 text-blue-600 animate-spin" />
              <div className="font-semibold text-blue-900">Processing...</div>
            </div>
            <div className="text-blue-700 mt-1">Please wait while we sync audio features from Spotify</div>
          </div>
        )}
      </div>
    </div>
  );
}
