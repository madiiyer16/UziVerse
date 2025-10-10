# 🔧 Troubleshooting Guide

If you're not seeing changes in your database after running the sync scripts, follow this step-by-step troubleshooting guide.

## 🚨 **Quick Diagnosis**

First, let's check what's in your database:

```bash
node scripts/check-database.js
```

This will show you:
- How many songs you have
- Which songs have Spotify IDs
- Which songs are missing audio features
- Sample data from your database

## 🔍 **Step-by-Step Troubleshooting**

### **Step 1: Check Your Database**

```bash
node scripts/check-database.js
```

**Expected output:**
- Should show songs with missing audio features
- Should show Spotify IDs for songs that can be updated

**If you see "No songs found with missing audio features":**
- Your database might already be up to date
- Or you don't have songs with Spotify IDs

### **Step 2: Test Spotify Connection**

```bash
node scripts/test-spotify-update.js
```

**This will:**
- Test your Spotify API credentials
- Try to update one song with audio features
- Show you exactly what's happening

**Expected output:**
- Should show "Access token obtained"
- Should show audio features from Spotify
- Should update one song in your database

### **Step 3: Run Direct Sync (Recommended)**

If the test works, run the direct sync:

```bash
# Test with 5 songs first
node scripts/direct-spotify-sync.js --dry-run --max-songs=5

# If dry run looks good, run for real
node scripts/direct-spotify-sync.js --max-songs=50
```

## 🐛 **Common Issues & Solutions**

### **Issue 1: "Missing Spotify credentials"**

**Error:** `❌ Missing Spotify credentials`

**Solution:**
1. Create a `.env.local` file in your project root
2. Add your Spotify credentials:
   ```bash
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   ```
3. Restart your terminal/command prompt

### **Issue 2: "No songs found with missing audio features"**

**Error:** `❌ No songs found with missing audio features`

**Possible causes:**
1. **No songs with Spotify IDs:** Your songs don't have `spotifyId` values
2. **Already up to date:** All songs already have audio features
3. **Wrong database:** You might be looking at a different database

**Solutions:**
1. **Check if songs have Spotify IDs:**
   ```bash
   node scripts/check-database.js
   ```
   Look for "Songs with Spotify ID: X"

2. **If no Spotify IDs, you need to sync the discography first:**
   ```bash
   # Make sure your Next.js server is running
   npm run dev
   
   # In another terminal, run the full sync
   node scripts/sync-spotify.js --dry-run
   ```

3. **If you want to force update existing data:**
   ```bash
   node scripts/direct-spotify-sync.js --force --max-songs=10
   ```

### **Issue 3: "Spotify auth failed: 401 Unauthorized"**

**Error:** `❌ Spotify auth failed: 401 Unauthorized`

**Solutions:**
1. **Check your credentials:** Make sure they're correct in `.env.local`
2. **Check your Spotify app settings:**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Make sure your app is active
   - Check that you're using the correct Client ID and Secret
3. **Regenerate credentials:** Create new Client ID and Secret if needed

### **Issue 4: "No audio features found for this song"**

**Error:** `❌ No audio features found for this song`

**Possible causes:**
1. **Invalid Spotify ID:** The song's Spotify ID might be wrong
2. **Track not available:** The track might not be available in Spotify's database
3. **API limits:** You might have hit rate limits

**Solutions:**
1. **Check the Spotify ID:** Look at the song in your database
2. **Try a different song:** Some songs might not have audio features
3. **Wait and retry:** If it's a rate limit issue, wait a few minutes

### **Issue 5: Scripts run but database doesn't change**

**Symptoms:** Scripts complete successfully but you don't see changes

**Possible causes:**
1. **Wrong database:** You might be looking at a different database
2. **Transaction rollback:** Database transaction might have failed
3. **Caching:** Your database viewer might be showing cached data

**Solutions:**
1. **Refresh your database viewer:** If using Prisma Studio, refresh the page
2. **Check the actual database:** Run `node scripts/check-database.js` again
3. **Check for errors:** Look for any error messages in the script output

## 🎯 **Recommended Workflow**

1. **Check current state:**
   ```bash
   node scripts/check-database.js
   ```

2. **Test with one song:**
   ```bash
   node scripts/test-spotify-update.js
   ```

3. **Run small batch:**
   ```bash
   node scripts/direct-spotify-sync.js --dry-run --max-songs=5
   ```

4. **Run larger batch:**
   ```bash
   node scripts/direct-spotify-sync.js --max-songs=50
   ```

5. **Verify results:**
   ```bash
   node scripts/check-database.js
   ```

## 🔧 **Advanced Debugging**

### **Check Environment Variables**

```bash
# On Windows
echo %SPOTIFY_CLIENT_ID%
echo %SPOTIFY_CLIENT_SECRET%

# On Mac/Linux
echo $SPOTIFY_CLIENT_ID
echo $SPOTIFY_CLIENT_SECRET
```

### **Check Database Connection**

```bash
# Test database connection
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.song.count().then(count => {
  console.log('Database connected! Songs:', count);
  prisma.\$disconnect();
}).catch(err => {
  console.error('Database error:', err);
  prisma.\$disconnect();
});
"
```

### **Check Spotify API Directly**

```bash
# Test Spotify API with curl
curl -X POST https://accounts.spotify.com/api/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $(echo -n 'YOUR_CLIENT_ID:YOUR_CLIENT_SECRET' | base64)" \
  -d "grant_type=client_credentials"
```

## 📞 **Still Having Issues?**

If you're still having problems:

1. **Share the output** of `node scripts/check-database.js`
2. **Share the output** of `node scripts/test-spotify-update.js`
3. **Check your `.env.local`** file (without sharing the actual credentials)
4. **Verify your Spotify app** is active in the developer dashboard

The most common issue is missing or incorrect Spotify API credentials, so double-check those first!
