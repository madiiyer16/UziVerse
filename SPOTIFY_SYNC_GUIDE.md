# 🎵 Spotify Audio Features Sync Guide

This guide explains how to use the new Spotify API integration to fill missing audio features in your database, which will improve AI recommendations.

## 🚀 Quick Start

### 1. Set up Spotify API Credentials

Add these to your `.env.local` file:

```bash
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

### 2. Run the Sync Script

```bash
# Test with a small batch first
node scripts/sync-spotify.js --dry-run --max-songs=10

# Fill missing audio features for 50 songs
node scripts/sync-spotify.js --audio-features-only --max-songs=50

# Full sync (discography + audio features)
node scripts/sync-spotify.js
```

## 📊 What Gets Updated

The sync will fill in these missing audio features:

- **Energy** (0.0 - 1.0): Perceptual measure of intensity and power
- **Danceability** (0.0 - 1.0): How suitable a track is for dancing
- **Valence** (0.0 - 1.0): Musical positivity conveyed by a track
- **Tempo** (BPM): Overall estimated tempo
- **Acousticness** (0.0 - 1.0): Confidence measure of whether the track is acoustic
- **Instrumentalness** (0.0 - 1.0): Predicts whether a track contains no vocals
- **Liveness** (0.0 - 1.0): Detects the presence of an audience in the recording
- **Speechiness** (0.0 - 1.0): Detects the presence of spoken words
- **Loudness** (dB): Overall loudness of a track
- **Mode** (0 or 1): Major (1) or minor (0) key
- **Key** (0-11): The key the track is in
- **Time Signature** (3-7): Estimated overall time signature

## 🛠️ Available Scripts

### Main Sync Script

```bash
# Full sync (recommended for first time)
node scripts/sync-spotify.js

# Test without making changes
node scripts/sync-spotify.js --dry-run

# Only fill audio features (skip discography sync)
node scripts/sync-spotify.js --audio-features-only

# Limit to specific number of songs
node scripts/sync-spotify.js --max-songs=100

# Skip audio features (only sync discography)
node scripts/sync-spotify.js --skip-audio-features
```

### Audio Features Only Script

```bash
# Fill missing audio features for all songs
node scripts/fill-spotify-audio-features.js

# Test with 10 songs
node scripts/fill-spotify-audio-features.js --dry-run --max-songs=10

# Process 25 songs at a time
node scripts/fill-spotify-audio-features.js --batch-size=25 --max-songs=100

# Force update even if features exist
node scripts/fill-spotify-audio-features.js --force
```

## 🌐 Web Interface

Visit `/admin/spotify-sync` in your browser to:

- View database statistics
- See sample songs with missing features
- Run sync operations with a UI
- Monitor sync progress and results

## 📈 Expected Results

After running the sync, you should see:

1. **Better AI Recommendations**: Songs with complete audio features will provide better similarity matching
2. **No More "N/A" Values**: Songs will show actual genre, mood, and audio feature data
3. **Improved "For You" Page**: AI-enhanced recommendations with confidence scores
4. **Visual Indicators**: Blue "(AI)" tags show which data was predicted vs. from Spotify

## 🔧 Troubleshooting

### Common Issues

**"Insufficient training data for AI models"**
- This is normal if you haven't synced audio features yet
- Run the Spotify sync to populate missing data
- The AI will use fallback models until you have enough training data

**"Spotify API error: 401 Unauthorized"**
- Check your Spotify API credentials
- Make sure your Spotify app has the correct permissions
- Verify the credentials are in `.env.local`

**"No songs with missing audio features found"**
- Great! Your database is already up to date
- You can still run with `--force` to update existing data

### Rate Limiting

The scripts include built-in rate limiting to respect Spotify's API limits:
- 100ms delay between requests
- Batch processing (50 songs at a time by default)
- Automatic retry logic

## 🎯 Next Steps

After syncing audio features:

1. **Check the For You page** - Visit `/for-you` to see AI-enhanced recommendations
2. **Monitor AI predictions** - Look for blue "(AI)" tags showing predicted data
3. **Run periodic syncs** - Set up a cron job to keep data fresh
4. **Review statistics** - Use the admin interface to monitor data quality

## 📊 Database Impact

The sync will update your existing songs with:

- **Audio Features**: Energy, danceability, valence, tempo, etc.
- **Genres**: Automatically assigned based on audio features
- **Moods**: Automatically assigned based on audio features
- **Popularity**: Spotify popularity scores

## 🔄 Automation

You can set up automated syncing:

```bash
# Add to crontab for daily sync
0 2 * * * cd /path/to/your/app && node scripts/sync-spotify.js --audio-features-only --max-songs=50
```

## 🆘 Support

If you encounter issues:

1. Check the console logs for detailed error messages
2. Verify your Spotify API credentials
3. Ensure your Next.js server is running
4. Try the dry-run mode first to test without making changes

The AI recommendation system will automatically improve as you add more songs with complete audio features!
