# 🎵 UziVerse - AI-Powered Lil Uzi Vert Recommender Setup Guide

## Overview

UziVerse is a sophisticated AI-powered music recommendation platform specifically designed for Lil Uzi Vert's discography. It combines Spotify Web API integration, advanced machine learning algorithms, and user behavior tracking to provide personalized music discovery experiences.

## Features

- 🎵 **Complete Lil Uzi Vert Discography**: Automated sync from Spotify with audio features
- 🤖 **AI Recommendation Engine**: Collaborative filtering + content-based filtering
- 👤 **Personalized Recommendations**: User-specific suggestions based on listening patterns
- 📊 **User Behavior Tracking**: Implicit feedback system for continuous improvement
- 🎧 **Audio Feature Analysis**: Vector similarity and clustering algorithms
- 🔄 **Background Sync Jobs**: Automated catalog updates and maintenance
- ⚡ **Performance Optimization**: Caching and query optimization
- 🎯 **Official Content Only**: Strict filtering for verified releases

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, Lucide React
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: NextAuth.js
- **External APIs**: Spotify Web API
- **AI/ML**: Custom recommendation algorithms, vector similarity, collaborative filtering

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Spotify Developer Account
- (Optional) Redis for production caching

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd uzi-recommender-full-stack
npm install
```

### 2. Database Setup

#### Create PostgreSQL Database
```sql
CREATE DATABASE uzi_recommender;
CREATE USER uzi_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE uzi_recommender TO uzi_user;
```

#### Update Environment Variables
Edit `env.local`:
```env
# Database
DATABASE_URL="postgresql://uzi_user:your_password@localhost:5432/uzi_recommender"

# NextAuth
NEXTAUTH_URL="http://127.0.0.1:3000"
NEXTAUTH_SECRET="your-nextauth-secret-here"

# Spotify API
SPOTIFY_CLIENT_ID="your-spotify-client-id"
SPOTIFY_CLIENT_SECRET="your-spotify-client-secret"

# SoundCloud API (optional)
SOUNDCLOUD_CLIENT_ID="your-soundcloud-client-id"

# Redis (for caching)
REDIS_URL="redis://localhost:6379"

# Cron Job Security
CRON_SECRET="your-cron-secret-here"
```

### 3. Spotify API Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Copy Client ID and Client Secret to `env.local`
4. Add redirect URI: `http://127.0.0.1:3000/api/auth/callback/spotify`

### 4. Database Migration

```bash
# Push schema to database
npm run db:push

# (Optional) Seed with initial data
npm run db:seed
```

### 5. Sync Lil Uzi Vert's Discography

```bash
# Start the development server
npm run dev

# In another terminal, sync Spotify data
npm run sync:spotify
```

### 6. Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Open Prisma Studio
npm run db:studio

# Manual sync commands
npm run sync:spotify
npm run sync:cron
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `GET/POST /api/auth/[...nextauth]` - NextAuth endpoints

### Songs
- `GET /api/songs` - Get songs with search and filtering
- `GET /api/songs/[id]` - Get specific song details

### Recommendations
- `GET /api/recommendations` - Get basic recommendations for a song
- `GET /api/recommendations/personalized` - Get AI-powered personalized recommendations
- `POST /api/recommendations/personalized` - Record user feedback

### Interactions
- `POST /api/interactions` - Track user interactions (plays, likes, skips)
- `GET /api/interactions` - Get user's interaction history

### Sync
- `POST /api/sync/spotify` - Sync Lil Uzi Vert's discography from Spotify
- `POST /api/sync/cron` - Background sync job (requires cron secret)

## AI Recommendation System

### Collaborative Filtering
- **User-based**: Finds users with similar taste
- **Item-based**: Finds songs similar to user's preferences
- **Matrix Factorization**: Handles sparse user-item interactions

### Content-Based Filtering
- Audio feature similarity using cosine similarity
- Genre and mood matching
- Popularity-based recommendations

### Hybrid Approach
- Combines collaborative and content-based filtering
- Handles cold start problems for new users
- Real-time learning from user interactions

## Audio Feature Analysis

The system analyzes 12 audio features from Spotify:
- Energy, Danceability, Valence, Tempo
- Acousticness, Instrumentalness, Liveness
- Speechiness, Loudness, Mode, Key, Time Signature

### Similarity Algorithms
- Cosine similarity for feature vectors
- Euclidean distance for clustering
- K-means clustering for genre/mood classification

## User Interaction Tracking

### Tracked Interactions
- Song views, plays, pauses, completions
- Skips (with timing)
- Likes and dislikes
- Ratings (1-5 stars)
- Playlist additions
- Shares

### Privacy Considerations
- No personal data collection beyond necessary metrics
- User can opt out of tracking
- Data anonymization for analytics

## Background Jobs

### Automated Sync
- Periodic Spotify catalog updates
- Incremental updates to avoid re-processing
- Error handling and retry logic
- Cleanup of orphaned data

### Setup Cron Job (Production)
```bash
# Add to crontab for daily sync at 2 AM
0 2 * * * curl -X POST https://yourdomain.com/api/sync/cron \
  -H "Authorization: Bearer your-cron-secret" \
  -H "Content-Type: application/json" \
  -d '{"syncSpotify": true}'
```

## Performance Optimization

### Caching Strategy
- In-memory cache for development
- Redis cache for production
- Cache recommendations, song lists, and user interactions
- Automatic cache invalidation

### Database Optimization
- Indexed fields for fast queries
- Denormalized fields for performance
- Pagination for large datasets
- Connection pooling

## Deployment

### Environment Variables for Production
```env
DATABASE_URL="postgresql://user:pass@host:5432/db"
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="strong-random-secret"
SPOTIFY_CLIENT_ID="your-client-id"
SPOTIFY_CLIENT_SECRET="your-client-secret"
CRON_SECRET="strong-cron-secret"
REDIS_URL="redis://your-redis-host:6379"
```

### Build and Deploy
```bash
npm run build
npm start
```

## Monitoring and Analytics

### Key Metrics
- Recommendation accuracy
- User engagement rates
- API response times
- Cache hit rates
- Sync job success rates

### Logging
- Structured logging for all API calls
- Error tracking and alerting
- Performance monitoring
- User interaction analytics

## Troubleshooting

### Common Issues

1. **Spotify API Rate Limits**
   - Implement exponential backoff
   - Use caching to reduce API calls
   - Monitor rate limit headers

2. **Database Connection Issues**
   - Check PostgreSQL is running
   - Verify connection string
   - Check network connectivity

3. **Authentication Problems**
   - Verify NextAuth configuration
   - Check session handling
   - Ensure proper redirect URIs

4. **Recommendation Quality**
   - Monitor user feedback
   - Adjust algorithm weights
   - Implement A/B testing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review API documentation

---

**Note**: This is a sophisticated AI-powered music recommendation system. Make sure to comply with Spotify's API terms of service and implement proper rate limiting and error handling in production.
