'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Music, RefreshCw, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function SyncPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);

  // Redirect if not authenticated
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin');
    return null;
  }

  const handleSoundCloudSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    
    try {
      const response = await fetch('/api/sync/soundcloud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: 50,
          offset: 0,
          forceUpdate: true
        })
      });

      const data = await response.json();
      setSyncResult(data);
    } catch (error) {
      setSyncResult({
        success: false,
        error: 'Failed to sync SoundCloud tracks',
        details: error.message
      });
    } finally {
      setSyncing(false);
    }
  };

  const getSyncStatus = async () => {
    try {
      const response = await fetch('/api/sync/soundcloud');
      const data = await response.json();
      setSyncStatus(data);
    } catch (error) {
      console.error('Error getting sync status:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Sync Management</h1>
            <p className="text-gray-600">Manage data synchronization with external platforms</p>
          </div>

          {/* SoundCloud Sync Section */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                <Music className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">SoundCloud Sync</h2>
                <p className="text-gray-600">Sync official Lil Uzi Vert tracks from SoundCloud</p>
              </div>
            </div>

            {/* Sync Status */}
            {syncStatus && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Current Status</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">SoundCloud Tracks:</span>
                    <span className="font-semibold ml-2">{syncStatus.data?.soundcloudTracks || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Tracks:</span>
                    <span className="font-semibold ml-2">{syncStatus.data?.totalTracks || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Percentage:</span>
                    <span className="font-semibold ml-2">{syncStatus.data?.percentage || 0}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Sync Actions */}
            <div className="flex gap-4 mb-4">
              <button
                onClick={handleSoundCloudSync}
                disabled={syncing}
                className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {syncing ? 'Syncing...' : 'Sync SoundCloud'}
              </button>

              <button
                onClick={getSyncStatus}
                className="flex items-center gap-2 px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Get Status
              </button>
            </div>

            {/* Sync Result */}
            {syncResult && (
              <div className={`p-4 rounded-lg ${
                syncResult.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {syncResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <h3 className={`font-semibold ${
                    syncResult.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {syncResult.success ? 'Sync Successful' : 'Sync Failed'}
                  </h3>
                </div>
                
                {syncResult.success ? (
                  <div className="text-green-800">
                    <p className="mb-2">{syncResult.message}</p>
                    {syncResult.data && (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>Tracks Processed: <span className="font-semibold">{syncResult.data.tracksProcessed}</span></div>
                        <div>Tracks Created: <span className="font-semibold">{syncResult.data.tracksCreated}</span></div>
                        <div>Tracks Updated: <span className="font-semibold">{syncResult.data.tracksUpdated}</span></div>
                        <div>Tracks Skipped: <span className="font-semibold">{syncResult.data.tracksSkipped}</span></div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-red-800">
                    <p className="mb-2">{syncResult.error}</p>
                    {syncResult.details && (
                      <p className="text-sm text-red-600">{syncResult.details}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Legal Notice */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Legal Notice</h4>
              <p className="text-sm text-blue-800">
                This sync only imports official tracks from Lil Uzi Vert's verified SoundCloud account. 
                All content is publicly available and properly attributed. No unreleased or unauthorized content is included.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

