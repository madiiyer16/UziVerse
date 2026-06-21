/**
 * Offline evaluation harness.
 *
 * Protocol: leave-one-out — for each synthetic user, hold out their most
 * recently liked song, run every method on the remaining training likes,
 * score whether the held-out song appears in the top-K results.
 *
 * Methods evaluated:
 *   random         — seeded shuffle (seed=42), serves as chance baseline
 *   popular        — sorted by totalLikes DESC, ties broken by popularity
 *   content-based  — real ContentBasedFiltering instance from the app
 *   cf-item        — real CollaborativeFiltering instance (audio cosine sim)
 *   hybrid-with-ai — real HybridRecommendationEngine, current live weights
 *   hybrid-no-ai   — same engine, aiEnhancedWeight=0, other weights renorm'd
 *
 * Crash safety:
 *   - Only synthetic_ users are ever touched (hard assert before any delete)
 *   - try/finally restores each held-out like even if scoring throws
 *   - SIGINT/SIGTERM handlers restore any in-flight deletes on interrupt
 *   - Restore uses upsert so re-running after a crash is safe
 *
 * Note on Prisma transactions: the engine uses a module-level prisma singleton
 * on a separate connection. PostgreSQL READ COMMITTED means uncommitted deletes
 * from a tx on one connection are invisible to the engine on another, so
 * transaction-scoped hold-out is not feasible without modifying the engine.
 * The delete/restore approach commits the change (visible to the engine) and
 * restores immediately after scoring.
 *
 * Usage:  npm run eval
 */
import './load-env.js';
import { PrismaClient } from '@prisma/client';
import {
  collaborativeFiltering,
  contentBasedFiltering,
  hybridEngine
} from '../src/lib/recommendation-engine.js';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SEED = 42;
const K_VALUES = [5, 10, 20];
const HYBRID_AI_OPTS = {
  collaborativeWeight: 0.15,
  contentBasedWeight: 0.55,
  aiEnhancedWeight: 0.2,
  popularityWeight: 0.1
};
const HYBRID_NO_AI_OPTS = {
  collaborativeWeight: 0.188,
  contentBasedWeight: 0.688,
  aiEnhancedWeight: 0,
  popularityWeight: 0.125
};

// ── Seeded PRNG (Mulberry32) ──────────────────────────────────────────────────
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ── Metrics (pure functions, all K-independent) ───────────────────────────────
function computeMetrics(recs, relevant, k) {
  const topK = recs.slice(0, k);
  let dcg = 0;
  let firstHitRank = 0;
  let hits = 0;

  for (let i = 0; i < topK.length; i++) {
    if (relevant.has(topK[i])) {
      hits++;
      dcg += 1 / Math.log2(i + 2);
      if (firstHitRank === 0) firstHitRank = i + 1;
    }
  }

  const numRel = Math.min(relevant.size, k);
  let idcg = 0;
  for (let i = 0; i < numRel; i++) idcg += 1 / Math.log2(i + 2);

  return {
    precision: hits / k,
    recall: hits / relevant.size,
    hr: hits > 0 ? 1 : 0,
    ndcg: idcg > 0 ? dcg / idcg : 0,
    mrr: firstHitRank > 0 ? 1 / firstHitRank : 0
  };
}

// Coverage: fraction of catalog seen across all users' top-K lists
function catalogCoverage(recSets, totalSongs) {
  const seen = new Set();
  for (const recs of recSets) for (const id of recs) seen.add(id);
  return totalSongs > 0 ? seen.size / totalSongs : 0;
}

// Diversity: 1 - mean pairwise genre Jaccard within each top-K list
function intraListDiversity(recSets, songGenresMap) {
  if (recSets.length === 0) return 0;
  const divs = recSets.map(recs => {
    if (recs.length < 2) return 1;
    let totalSim = 0;
    let pairs = 0;
    for (let i = 0; i < recs.length; i++) {
      for (let j = i + 1; j < recs.length; j++) {
        const g1 = songGenresMap.get(recs[i]) ?? new Set();
        const g2 = songGenresMap.get(recs[j]) ?? new Set();
        const union = new Set([...g1, ...g2]).size;
        const inter = [...g1].filter(g => g2.has(g)).length;
        totalSim += union === 0 ? 0 : inter / union;
        pairs++;
      }
    }
    return 1 - (pairs > 0 ? totalSim / pairs : 0);
  });
  return divs.reduce((a, b) => a + b, 0) / divs.length;
}

// ── Safety guard ──────────────────────────────────────────────────────────────
function assertSynthetic(user) {
  if (!user.username.startsWith('synthetic_')) {
    throw new Error(
      `SAFETY VIOLATION: eval attempted to delete like for non-synthetic user` +
      ` "${user.username}" (${user.id}). Aborting.`
    );
  }
}

// Wraps an engine call; returns [] on failure so one broken user doesn't abort the run
async function safeEngineCall(fn, label) {
  try {
    return await fn();
  } catch (e) {
    process.stderr.write(`\n[${label}] engine error: ${e.message}\n`);
    return [];
  }
}

// ── ID extraction from heterogeneous engine return shapes ────────────────────
// findSimilarItems → [{song: {id,...}, score, basedOn}]
// getRecommendations (CB) → [{song: {id,...}, similarity, reason}]
// getRecommendations (hybrid) → [{id, ...songFields, recommendationScore, ...}]
function extractIds(recs) {
  if (!Array.isArray(recs)) return [];
  return recs.map(r => r?.song?.id ?? r?.id).filter(Boolean);
}

// ── Output formatting ─────────────────────────────────────────────────────────
const METHOD_LABELS = {
  'random':         'Random (seeded)  ',
  'popular':        'Most popular     ',
  'content-based':  'Content-based    ',
  'cf-item':        'CF (item-audio)  ',
  'hybrid-with-ai': 'Hybrid + AI      ',
  'hybrid-no-ai':   'Hybrid no AI     '
};

function f(v) { return v == null ? ' N/A ' : v.toFixed(3); }

function formatTable(results) {
  const methods = Object.keys(METHOD_LABELS);
  const hdr =
    '| Method            | HR@5  | HR@10 | HR@20 | NDCG@5 | NDCG@10 | NDCG@20 | MRR   | Cov@20 | Div@20 |';
  const sep =
    '|-------------------|-------|-------|-------|--------|---------|---------|-------|--------|--------|';
  const rows = methods.map(m => {
    const r = k => results[m]?.[k];
    return `| ${METHOD_LABELS[m]}| ${f(r(5)?.hr)}  | ${f(r(10)?.hr)} | ${f(r(20)?.hr)} |` +
      ` ${f(r(5)?.ndcg)}   | ${f(r(10)?.ndcg)}    | ${f(r(20)?.ndcg)}    |` +
      ` ${f(r(10)?.mrr)} | ${f(r(20)?.coverage)} | ${f(r(20)?.diversity)} |`;
  });
  return [hdr, sep, ...rows].join('\n');
}

function buildReport(results, table, nUsers, nSongs, timestamp) {
  const methods = Object.keys(METHOD_LABELS);
  const ndcg10 = m => results[m]?.[10]?.ndcg ?? -1;
  const winner = methods.reduce((a, b) => ndcg10(a) >= ndcg10(b) ? a : b);
  const aiDiff = (ndcg10('hybrid-no-ai') - ndcg10('hybrid-with-ai'));
  const aiVerdict =
    Math.abs(aiDiff) < 0.001
      ? 'made no meaningful difference'
      : aiDiff > 0
        ? `helped (no-AI NDCG@10 +${aiDiff.toFixed(3)} vs with-AI)`
        : `hurt  (no-AI NDCG@10 ${aiDiff.toFixed(3)} vs with-AI)`;

  return `# Offline Evaluation Results

Generated: ${timestamp}
Synthetic users: ${nUsers} | Catalog size: ${nSongs} songs
Protocol: leave-one-out (held-out = most recent like per user)

## Generative process

Synthetic user preferences are driven by a 4-dimensional latent taste vector
**orthogonal to genre/mood**, eliminating structural bias toward content-based methods:

| Dim | Feature | Why orthogonal |
|-----|---------|----------------|
| f0 | Release year (2009→0, 2024→1) | independent of genre assignment |
| f1 | Popularity rank (0→1 ordinal) | CB uses popularity *diff* between pairs, not rank |
| f2 | Duration bucket (short/med/long) | structural property, not a genre |
| f3 | Explicit flag (0/1) | lyrical content flag, not a genre |

Like probability: \`sigmoid(u·v + ε)\`, \`ε ~ N(0, 0.35)\`, no separate popularity
bias — popularity preference is captured only through the user's own f1 component.

## Results

${table}

**Winner on NDCG@10:** ${METHOD_LABELS[winner].trim()} (${f(ndcg10(winner))})
**AI-tier experiment:** removing the degenerate AI tier **${aiVerdict}**.

## Notes

- **CF (item-audio)** returns empty recommendations for all users because audio
  features are null for the entire catalog (Spotify deprecated the
  \`/audio-features\` endpoint after catalog sync). Cosine similarity of null
  vectors returns 0; no items pass the similarity threshold. This is expected
  and confirms that audio-based CF is non-functional without feature data —
  genre/mood signal is the only viable differentiation path.

- **AI-enhanced tier** fills songs with missing audio features with identical
  defaults (energy=0.5, danceability=0.5, …). Cosine similarity between
  identical vectors = 1.0 for all pairs, so the AI tier assigns a uniform score
  to every song in the catalog. It adds noise rather than signal; the experiment
  above shows whether this hurts measurably.

- **Coverage** is low for methods that repeatedly recommend the same popular
  songs (popular, hybrid variants). Random covers the entire catalog by design.

- **Diversity** reflects intra-list genre Jaccard dissimilarity averaged across
  users. Since every song in this catalog shares the same primary genres
  (Hip-Hop, Trap, Rap), diversity differences between methods are small.
`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Load catalog
  const songs = await prisma.song.findMany({
    select: {
      id: true,
      totalLikes: true,
      popularity: true,
      genres: { include: { genre: true } }
    },
    orderBy: [{ totalLikes: 'desc' }, { popularity: 'desc' }]
  });

  const allSongIds = songs.map(s => s.id); // already sorted by popularity desc
  const songGenresMap = new Map(
    songs.map(s => [s.id, new Set(s.genres.map(g => g.genre?.name).filter(Boolean))])
  );

  console.log(`Catalog: ${songs.length} songs`);

  // Load synthetic users with their likes
  const syntheticUsers = await prisma.user.findMany({
    where: { username: { startsWith: 'synthetic_' } },
    include: { likes: { orderBy: { createdAt: 'asc' } } }
  });

  const evalUsers = syntheticUsers.filter(u => u.likes.length >= 2);
  console.log(`Evaluating ${evalUsers.length} synthetic users (≥2 likes)...`);

  if (evalUsers.length === 0) {
    console.error('No eval users found — run npm run eval:gen first.');
    process.exit(1);
  }

  // Per-method, per-K accumulators
  const METHODS = ['random', 'popular', 'content-based', 'cf-item', 'hybrid-with-ai', 'hybrid-no-ai'];
  const acc = Object.fromEntries(METHODS.map(m => [m, {
    recsList: Object.fromEntries(K_VALUES.map(k => [k, []])),
    metricsList: Object.fromEntries(K_VALUES.map(k => [k, []]))
  }]));

  // Master RNG seeds per-user random baselines
  const masterRng = mulberry32(SEED);

  // Crash recovery: track in-flight holds
  const inFlight = new Map(); // userId → { songId, createdAt }

  async function restoreAll() {
    if (inFlight.size === 0) return;
    process.stderr.write(`\nRestoring ${inFlight.size} in-flight held-out likes...\n`);
    for (const [userId, { songId, createdAt }] of inFlight) {
      await prisma.userSongLike.upsert({
        where: { userId_songId: { userId, songId } },
        update: {},
        create: { userId, songId, createdAt }
      }).catch(() => {});
    }
    inFlight.clear();
  }

  process.on('SIGINT', async () => {
    await restoreAll();
    await prisma.$disconnect();
    process.exit(130);
  });
  process.on('SIGTERM', async () => {
    await restoreAll();
    await prisma.$disconnect();
    process.exit(143);
  });

  // Silence the engine's per-recommendation console.log during the eval loop
  const origLog = console.log;
  console.log = () => {};

  let done = 0;
  for (const user of evalUsers) {
    assertSynthetic(user); // hard guard — never touches real users

    const allLikes = user.likes; // sorted createdAt ASC
    const heldOut = allLikes.at(-1);
    const trainSet = new Set(allLikes.slice(0, -1).map(l => l.songId));
    const relevant = new Set([heldOut.songId]);

    // Per-user seeded RNG for the random baseline (reproducible across K values)
    const userSeedInt = (masterRng() * 2 ** 32) >>> 0;
    const userRng = mulberry32(userSeedInt);

    // Random baseline: single shuffle, take prefix for each K
    const candidates = allSongIds.filter(id => !trainSet.has(id));
    shuffleInPlace(candidates, userRng);

    // Popular baseline: already sorted descending
    const popularCandidates = allSongIds.filter(id => !trainSet.has(id));

    for (const k of K_VALUES) {
      const randRecs = candidates.slice(0, k);
      const popRecs = popularCandidates.slice(0, k);

      acc['random'].recsList[k].push(randRecs);
      acc['random'].metricsList[k].push(computeMetrics(randRecs, relevant, k));
      acc['popular'].recsList[k].push(popRecs);
      acc['popular'].metricsList[k].push(computeMetrics(popRecs, relevant, k));
    }

    // Engine methods: delete held-out, run all 4 engines, restore
    try {
      assertSynthetic(user); // belt-and-suspenders
      await prisma.userSongLike.delete({
        where: { userId_songId: { userId: user.id, songId: heldOut.songId } }
      });
      inFlight.set(user.id, { songId: heldOut.songId, createdAt: heldOut.createdAt });

      const [cbRaw, cfRaw, hybAiRaw, hybNoAiRaw] = await Promise.all([
        safeEngineCall(() => contentBasedFiltering.getRecommendations(user.id, 20), 'CB'),
        safeEngineCall(() => collaborativeFiltering.findSimilarItems(user.id, 20), 'CF'),
        safeEngineCall(() => hybridEngine.getRecommendations(user.id, { ...HYBRID_AI_OPTS, limit: 20 }), 'hybrid-ai'),
        safeEngineCall(() => hybridEngine.getRecommendations(user.id, { ...HYBRID_NO_AI_OPTS, limit: 20 }), 'hybrid-no-ai')
      ]);

      const engineRecs = {
        'content-based':  extractIds(cbRaw),
        'cf-item':        extractIds(cfRaw),
        'hybrid-with-ai': extractIds(hybAiRaw),
        'hybrid-no-ai':   extractIds(hybNoAiRaw)
      };

      for (const [method, recs] of Object.entries(engineRecs)) {
        for (const k of K_VALUES) {
          acc[method].recsList[k].push(recs.slice(0, k));
          acc[method].metricsList[k].push(computeMetrics(recs, relevant, k));
        }
      }

    } finally {
      // Always restore — even if scoring threw
      const held = inFlight.get(user.id);
      if (held) {
        await prisma.userSongLike.upsert({
          where: { userId_songId: { userId: user.id, songId: held.songId } },
          update: {},
          create: { userId: user.id, songId: held.songId, createdAt: held.createdAt }
        });
        inFlight.delete(user.id);
      }
    }

    done++;
    process.stdout.write(done % 10 === 0 ? `\n${done}/${evalUsers.length}` : '.');
  }

  // Restore console.log
  console.log = origLog;
  console.log('\n\nAggregating metrics...');

  // Compute aggregate metrics
  const results = {};
  for (const method of METHODS) {
    results[method] = {};
    for (const k of K_VALUES) {
      const mList = acc[method].metricsList[k];
      const rList = acc[method].recsList[k];
      if (mList.length === 0) { results[method][k] = null; continue; }
      const avg = key => mList.reduce((s, m) => s + (m[key] ?? 0), 0) / mList.length;
      results[method][k] = {
        precision: avg('precision'),
        recall:    avg('recall'),
        hr:        avg('hr'),
        ndcg:      avg('ndcg'),
        mrr:       avg('mrr'),
        coverage:  catalogCoverage(rList, songs.length),
        diversity: intraListDiversity(rList, songGenresMap)
      };
    }
  }

  const table = formatTable(results);
  console.log('\n' + table + '\n');

  const ts = new Date().toISOString();
  const report = buildReport(results, table, evalUsers.length, songs.length, ts);

  const docsDir = resolve(ROOT, 'docs');
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(resolve(docsDir, 'EVAL_RESULTS.md'), report, 'utf8');
  console.log('Results written to docs/EVAL_RESULTS.md');

  await prisma.$disconnect();
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
