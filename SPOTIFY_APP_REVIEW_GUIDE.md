# 🎵 Spotify App Review Guide

Your Spotify app is in "Development Mode" which restricts access to many tracks and audio features. Here's how to fix this.

## 🚨 **Current Issue**

- **App Status**: Development Mode
- **Problem**: 403 Forbidden errors for many tracks
- **Solution**: Request app review from Spotify

## 🔧 **How to Request App Review**

### **Step 1: Go to Spotify Developer Dashboard**

1. Visit [https://developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Click on your app
3. Look for "Request Extension" or "Submit for Review" button

### **Step 2: Fill Out the Review Form**

**App Information:**
- **App Name**: Your app name (e.g., "Lil Uzi Vert Music Recommender")
- **App Description**: "A music recommendation system that helps users discover new songs based on their preferences and audio features"
- **App Category**: "Music"
- **App Type**: "Web Application"

**Use Case Description:**
```
I'm building a music recommendation system that:

1. Helps users discover new music based on their listening preferences
2. Uses Spotify's audio features (energy, danceability, valence, tempo) to find similar songs
3. Provides personalized recommendations for users who like specific songs
4. Helps users explore music from their favorite artists

The app uses Spotify's Web API to:
- Fetch audio features for songs
- Search for tracks and artists
- Provide music recommendations based on audio similarity

This is for personal/educational use to learn about music recommendation algorithms and Spotify's API capabilities.
```

**Technical Details:**
- **API Endpoints Used**: 
  - `/audio-features` - To get audio features for songs
  - `/search` - To find tracks and artists
  - `/tracks` - To get track information
- **Data Usage**: Only using public track data and audio features
- **User Data**: Not collecting or storing user data beyond basic preferences

### **Step 3: Submit the Request**

1. Fill out all required fields
2. Submit the request
3. Wait for Spotify's review (usually 1-2 weeks)

## 🧪 **Test with Development Mode Compatible Tracks**

While waiting for review, you can test with tracks that work in development mode:

```bash
node scripts/test-dev-mode-tracks.js
```

This will:
- Test with popular tracks that should work in development mode
- Find accessible Lil Uzi Vert tracks
- Test database updates with working tracks

## 🎯 **Expected Results After Review**

Once approved, you should have access to:
- ✅ Most official tracks and albums
- ✅ Audio features for most songs
- ✅ Higher rate limits
- ✅ Access to more regional content

## 🔍 **Alternative: Use Different Tracks**

If you don't want to wait for review, you can:

1. **Use the test script** to find tracks that work in development mode
2. **Focus on official releases** instead of leaked/unreleased content
3. **Use popular tracks** that are more likely to be accessible

## 📋 **Development Mode Limitations**

Current restrictions in development mode:
- ❌ Many tracks return 403 Forbidden
- ❌ Leaked/unreleased content not accessible
- ❌ Some regional content restricted
- ❌ Lower rate limits
- ❌ Limited access to audio features

## 💡 **Quick Test**

Run this to see what tracks work in your current setup:

```bash
node scripts/test-dev-mode-tracks.js
```

This will show you which tracks are accessible and test database updates with them.

## 🚀 **Next Steps**

1. **Request app review** from Spotify (recommended)
2. **Test with compatible tracks** using the test script
3. **Update your database** with accessible tracks
4. **Wait for review approval** for full access

The review process is usually straightforward for educational/personal projects like yours!
