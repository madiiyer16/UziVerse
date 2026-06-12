# UziVerse

A full-stack music platform for Lil Uzi Vert's discography. Browse albums and tracks, get personalized recommendations, rate and review songs, and build playlists — all backed by live Spotify data.

**Live:** [uzi-recommender-full-stack.vercel.app](https://uzi-recommender-full-stack.vercel.app)

## Features

- **Discography browser** — albums, tracks, and Spotify-style track listings
- **Personalized recommendations** — based on listening history and ratings
- **For You feed** — AI-enhanced song suggestions
- **Ratings & reviews** — rate songs and read community reviews
- **Liked songs** — save tracks across sessions
- **Playlists** — create and manage personal playlists
- **Spotify sync** — pull live track data, audio features, and metadata via the Spotify API
- **Auth** — sign up / sign in with email + password (NextAuth)

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL via [Neon](https://neon.tech) |
| ORM | Prisma |
| Auth | NextAuth v4 |
| Styling | Tailwind CSS |
| Music data | Spotify Web API |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) database
- A [Spotify Developer](https://developer.spotify.com/dashboard) app

### Setup

1. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/madiiyer16/UziVerse.git
   cd UziVerse
   npm install
   ```

2. Copy the example env file and fill in your values:
   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   |---|---|
   | `DATABASE_URL` | Neon PostgreSQL connection string |
   | `NEXTAUTH_SECRET` | Random secret for session signing |
   | `NEXTAUTH_URL` | `http://localhost:3000` for local dev |
   | `SPOTIFY_CLIENT_ID` | From Spotify Developer Dashboard |
   | `SPOTIFY_CLIENT_SECRET` | From Spotify Developer Dashboard |

3. Push the schema and seed the database:
   ```bash
   npm run db:push
   npm run db:seed
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run db:push` | Sync Prisma schema to database |
| `npm run db:seed` | Seed genres, moods, and songs |
| `npm run db:studio` | Open Prisma Studio |
| `npm run sync:spotify` | Pull latest track data from Spotify |

## Deployment

The project is deployed on Vercel with Neon as the database. Environment variables are set in the Vercel dashboard. The build script runs `prisma generate` automatically before `next build`.

To deploy your own instance:

```bash
npm i -g vercel
vercel --prod
```

Add the same environment variables from the table above in your Vercel project settings. Set `NEXTAUTH_URL` to your production domain.

For Spotify OAuth to work in production, add your Vercel domain to the **Redirect URIs** in the Spotify Developer Dashboard:
```
https://your-app.vercel.app/api/auth/callback/spotify
```
