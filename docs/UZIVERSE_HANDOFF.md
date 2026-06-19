# Uziverse Recommender — Session Handoff

**Date:** 2026-06-17  
**Status:** Genre/mood fix complete in code + DB. API verification blocked on WSL server setup.

---

## What Was Done This Session

### Bug 1 Fixed: Broken Prisma includes (all genre/mood names were null)

Root cause: `include: { genres: true }` on an explicit many-to-many join table returns the join row (`SongGenre`), not the nested `Genre`. To get the name you must drill: `include: { genres: { include: { genre: true } } }` and read `g.genre.name` (not `g.name`).

**23 sites fixed across 8 files:**

| File | What changed |
|------|-------------|
| `src/lib/recommendation-engine.js` | 7 includes drilled; 8 `.name` reads → `.genre.name` / `.mood.name` |
| `src/lib/ai-prediction.js` | 4 includes drilled; 7 name reads fixed; line 542 `predictMoodsFromGenres` call now extracts string names before passing |
| `src/lib/audio-analysis.js` | 4 name reads fixed in `calculateAdvancedSimilarity()` |
| `src/app/api/recommendations/ai-enhanced/route.js` | 1 include drilled; 3 name reads fixed; `getUserTopGenres()` counter fixed |
| `src/app/api/interactions/route.js` | 3 includes drilled (replace_all) |
| `src/lib/data-completion.js` | 4 includes drilled (replace_all) |
| `src/app/api/sync/spotify/route.js` | 1 include drilled + Bug 2 fix (see below) |
| `src/app/api/sync/cron/route.js` | Same as spotify route |

**Already correct (not touched):**
- `src/app/api/liked-songs/route.js`
- `src/app/api/recommendations/route.js`
- `src/app/api/songs/route.js`
- `src/app/api/albums/[slug]/route.js`
- `src/app/api/recommendations/personalized/route.js`

---

### Bug 2 Fixed: Spotify-synced songs skipped during genre assignment

Root cause: `updateGenresAndMoods()` in the sync routes had `if (!track.audioFeatures) continue;` — since the Spotify `/audio-features` endpoint is deprecated (removed for apps created after Nov 27 2024), ALL synced tracks have null audio features and ALL were skipped.

Fix applied to both `src/app/api/sync/spotify/route.js` and `src/app/api/sync/cron/route.js`:
- Removed the `if (!track.audioFeatures) continue;` guard
- Added two helper functions: `getBaselineGenres(track)` (returns `['Trap', 'Hip-Hop', 'Rap']` + `'Rap'` if release year >= 2015) and `getBaselineMoods(track)` (returns `['Neutral']`)
- Fallback kicks in when audio features are absent OR when audio-feature rules produce no matches
- DB writes (upsert) now always run

---

### DB Backfill: 100% complete

Ran existing WSL script `/home/murdi/uzi-recommender-full-stack/scripts/auto-assign-genres-moods.js` which successfully backfilled 236 existing Spotify-synced songs. Then ran `check-genres-moods.js` which confirmed:
- 239 songs total
- 0 without genres (100%)
- 0 without moods (100%)

Sample confirmed in DB:
```
XO Tour Llif3:  genres=Hip Hop, Emo Rap;  moods=Dark, Emotional
Dark Knight Dummo:  genres=Trap, Hip Hop;  moods=Dark, Aggressive
```

---

### New Files Created (scripts + backfill endpoint)

- `scripts/backfill-genres.js` — standalone backfill script (safe to re-run, uses upserts)
- `scripts/verify-genres.js` — shows genre/mood coverage stats + 5 sample songs
- `scripts/test-api.js` — hits `/api/recommendations` and prints genre/mood names
- `src/app/api/sync/genres-backfill/route.js` — POST endpoint for in-app backfill
- `prisma/schema.prisma` — added `binaryTargets = ["native", "windows", "debian-openssl-3.0.x"]` (can be reverted; see Windows issue below)

---

## What's NOT Done Yet

### API verification not confirmed

`GET /api/recommendations/ai-enhanced` requires an authenticated session, and the dev server has been unreachable from localhost this session (see Windows/WSL issue below). The DB data is confirmed correct, but we haven't seen a live API response showing real genre names.

**What to verify:**
1. Log in as a user who has liked songs
2. Hit `GET /api/recommendations/ai-enhanced`
3. Confirm response shows `"genres": ["Trap", "Hip Hop"]` (real names, not `[null, null]` or `[]`)
4. Confirm `getUserTopGenres` in the same response returns actual genre strings

### No git commits made

All code changes are unstaged edits in `c:\Users\murdi\uzi-recommender-full-stack\`. No commits exist yet for either bug fix.

---

## The Windows/WSL Environment Issue

### Root cause
The Prisma client was generated in WSL and only has a **Linux binary** (`libquery_engine-debian-openssl-3.0.x.so.node`). Windows Node.js can't use it. WSL Node.js can use it, but only when the working directory is on the **native WSL filesystem** (`/home/murdi/...`), not the Windows mount (`/mnt/c/...`).

When the dev server runs from `/mnt/c/Users/murdi/uzi-recommender-full-stack`, DNS resolution for the database host fails and every DB-hitting route returns 500.

### How the old server was working
It was running `next start` (production mode) which uses a **WASM-bundled Prisma** engine baked into the `.next/server/` directory at build time. WASM Prisma doesn't need the native binary and uses a different connection path. That server was inadvertently killed during this session.

### Fix going forward — always run dev server from native WSL path

```bash
# Open VS Code connected to WSL (use Ctrl+Shift+P -> "WSL: Reopen Folder in WSL")
# Then from within WSL at the native path:
cd /home/murdi/uzi-recommender-full-stack
node node_modules/next/dist/bin/next dev
# (NOT: npm run dev — the .bin/next wrapper is a Windows .cmd file WSL can't execute)
```

### Syncing code changes between Windows and WSL
The Windows-side changes (`c:\Users\murdi\...`) and WSL-side (`/home/murdi/...`) are **two separate git repos**. Changes made via Claude Code go to the Windows repo. To get them into WSL:

```bash
# On Windows side (PowerShell), commit first:
git add src/lib/recommendation-engine.js src/lib/ai-prediction.js src/lib/audio-analysis.js
git add src/app/api/recommendations/ai-enhanced/route.js src/app/api/interactions/route.js
git add src/app/api/sync/spotify/route.js src/app/api/sync/cron/route.js
git add src/lib/data-completion.js prisma/schema.prisma
git add scripts/backfill-genres.js scripts/verify-genres.js scripts/test-api.js
git add src/app/api/sync/genres-backfill/route.js
git commit -m "fix(genres): drill Prisma includes, decouple sync from audio features, backfill endpoint"
git push

# On WSL side:
cd /home/murdi/uzi-recommender-full-stack
git pull
```

---

## Audio Features (Out of Scope — Separate Effort)

The Spotify `/audio-features` endpoint is deprecated for apps registered after Nov 27 2024. All synced songs have null audio features. This causes:
- Cosine similarity returning 0 for audio-based matching
- `energy || 0`, `danceability || 0` etc. fallbacks returning zeros in API responses
- AI prediction models have nothing to train on for audio features

This was explicitly out of scope for this session. Separate effort needed — options: AcousticBrainz, Essentia, client-side analysis, or pure genre/mood similarity.

---

## Key Architecture Notes

- **DB:** Supabase (the `.env.local` comment says "Neon" but the URL host is `aws-1-us-west-1.pooler.supabase.com` — this is Supabase's session pooler)
- **Prisma schema:** explicit many-to-many via `SongGenre` and `SongMood` join tables. Correct include pattern: `{ genres: { include: { genre: true } } }`, read names as `g.genre.name`
- **Recommendation stack:** `CollaborativeFiltering` → `ContentBasedFiltering` → `AIEnhancedRecommendationEngine` → `HybridRecommendationEngine`, all in `src/lib/`
- **Sync routes:** `src/app/api/sync/spotify/route.js` (manual) and `src/app/api/sync/cron/route.js` (scheduled) — both now assign baseline genres/moods when audio features are absent

---

## Immediate Next Steps

1. **Commit** the Windows-side changes (git add the files listed above, commit, push)
2. **Pull** into WSL at `/home/murdi/uzi-recommender-full-stack`
3. **Start dev server** from WSL native path (see command above)
4. **Log in and hit** `GET /api/recommendations/ai-enhanced` — confirm real genre names in response
5. **Optionally revert** the `binaryTargets` change in `prisma/schema.prisma` (harmless but unnecessary once on WSL-only dev)
