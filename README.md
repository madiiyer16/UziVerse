# UziVerse 🎵

An AI-powered Lil Uzi Vert song recommender and review platform. Browse his complete discography of 290+ songs, get personalized song recommendations based on audio features, and discover new tracks through a clean, responsive web interface.

🔗 **Live Demo:** https://uzi-recommender-full-stack.vercel.app/

> **Note:** Spotify login is currently in developer mode. To try the full experience, [watch the demo video](#demo) or request access via the contact info below.

---

## Features

- **AI-Powered Recommendations** — Collaborative filtering and content-based algorithms analyze audio features (energy, danceability, tempo) to suggest songs you'll actually like
- **Complete Discography** — Browse and search 290+ Lil Uzi Vert tracks synced from Spotify
- **Album Browser** — Explore his full catalog organized by album and single
- **User Reviews & Ratings** — Rate songs and read community reviews
- **Personalized Feed** — Get a "For You" recommendation feed based on your listening preferences
- **Secure Authentication** — Login with NextAuth.js and bcrypt password hashing
- **Responsive UI** — Clean, mobile-friendly design built with Tailwind CSS

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Next.js, Tailwind CSS |
| Backend | Next.js API Routes |
| Database | PostgreSQL, Prisma ORM |
| Authentication | NextAuth.js, bcrypt |
| Music Data | Spotify Web API |
| ML Recommendations | Collaborative filtering, content-based filtering |
| Deployment | Vercel |
| Version Control | GitHub |

---

## How the Recommendation Engine Works

The recommendation engine analyzes Spotify audio features for each track including energy, danceability, tempo, valence, and acousticness. It combines two approaches:

**Content-based filtering** finds songs with similar audio feature vectors to ones you have already liked, using cosine similarity to rank candidates.

**Collaborative filtering** identifies patterns across users with similar taste profiles and surfaces songs that users like you have enjoyed but you have not heard yet.

Both signals are combined and weighted to produce a final ranked list of recommendations served through the "For You" and "Discover" tabs.

---

## Demo

> Demo video coming soon — recording in progress.

Screenshots:

*(Add screenshots here after recording)*

---

## How to Run Locally

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Spotify Developer account (for API keys)

### 1. Clone the repo
```bash
git clone https://github.com/madiiyer16/UziVerse.git
cd UziVerse
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Copy `.env.example` to `.env.local` and fill in your values:
```bash
cp .env.example .env.local
```

Required variables:
```
DATABASE_URL=your_postgresql_connection_string
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

### 4. Set up the database
```bash
npx prisma migrate dev
npx prisma generate
```

### 5. Sync Spotify data
```bash
node scripts/syncSpotify.js
```
This populates your database with Lil Uzi Vert's full discography and audio features.

### 6. Start the development server
```bash
npm run dev
```
App runs at http://localhost:3000

---

## Project Structure

```
UziVerse/
├── prisma/          # Database schema and migrations
├── public/          # Static assets
├── scripts/         # Spotify sync and data scripts
├── src/
│   ├── app/         # Next.js app router pages and API routes
│   └── components/  # Reusable React components
└── .env.example     # Environment variable template
```

---

## What I Would Improve With More Time

- **Apply for Spotify extended quota** — allow any user to log in with their own Spotify account without needing manual approval
- **Add demo mode** — pre-seeded data so visitors can try recommendations without logging in
- **Improve recommendation diversity** — add a novelty factor so recommendations do not cluster around the same album
- **Listening history integration** — pull real Spotify listening history to personalize recommendations further
- **Better cold start handling** — smarter onboarding for new users with no history yet

---

## Author

Madhavan Iyer — [GitHub](https://github.com/madiiyer16)
