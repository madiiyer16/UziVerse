/**
 * Hybrid weight sweep — leave-one-out on 50 synthetic users.
 *
 * Grid: CF ∈ {0.4, 0.5, 0.6, 0.7} × CB ∈ {0.15, 0.25, 0.35} × Pop ∈ {0.05, 0.10, 0.15}
 * AI weight = 0 throughout (eval showed it hurts — degenerate uniform scores).
 * All (cf, cb, pop) triplets are renormalised to sum to 1.0.
 *
 * METHODOLOGICAL NOTE:
 * These weights are tuned ON the same eval set used for the baseline results.
 * They represent the best fit to this synthetic data, not a held-out
 * generalisation claim. The winning config is an informed starting point, not
 * a validated real-world optimum.
 *
 * Efficiency: rather than calling the hybrid engine 36 times per user, we
 * call CB and CF once each, collect raw score maps, then apply all 36 weight
 * configs offline. This exactly replicates the hybrid merge logic at 1/36 the
 * DB round-trips.
 *
 * Usage: npm run eval:sweep
 */
import './load-env.js';
import { PrismaClient } from '@prisma/client';
import {
  collaborativeFiltering,
  contentBasedFiltering
} from '../src/lib/recommendation-engine.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Weight grid ───────────────────────────────────────────────────────────────
const CF_VALS  = [0.4, 0.5, 0.6, 0.7];
const CB_VALS  = [0.15, 0.25, 0.35];
const POP_VALS = [0.05, 0.10, 0.15];

const CONFIGS = [];
for (const cf of CF_VALS) {
  for (const cb of CB_VALS) {
    for (const pop of POP_VALS) {
      const total = cf + cb + pop;
      CONFIGS.push({
        rawCF: cf, rawCB: cb, rawPop: pop,
        wCF:  cf  / total,
        wCB:  cb  / total,
        wPop: pop / total
      });
    }
  }
}

// ── Metrics ───────────────────────────────────────────────────────────────────
function computeMetrics(recs, relevant, k) {
  const topK = recs.slice(0, k);
  let dcg = 0, firstHitRank = 0, hits = 0;
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
    hr:   hits > 0 ? 1 : 0,
    ndcg: idcg > 0 ? dcg / idcg : 0,
    mrr:  firstHitRank > 0 ? 1 / firstHitRank : 0
  };
}

function catalogCoverage(recSets, total) {
  const seen = new Set();
  for (const recs of recSets) for (const id of recs) seen.add(id);
  return total > 0 ? seen.size / total : 0;
}

function intraListDiversity(recSets, songGenresMap) {
  if (recSets.length === 0) return 0;
  const divs = recSets.map(recs => {
    if (recs.length < 2) return 1;
    let totalSim = 0, pairs = 0;
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
      `SAFETY VIOLATION: attempted delete for non-synthetic user "${user.username}" (${user.id})`
    );
  }
}

async function safeCall(fn, label) {
  try { return await fn(); }
  catch (e) {
    process.stderr.write(`\n[${label}] error: ${e.message}\n`);
    return [];
  }
}

// Extract {id → score} map from heterogeneous engine return shapes
function toScoreMap(recs, scoreField) {
  const map = new Map();
  for (const r of recs) {
    const id    = r?.song?.id ?? r?.id;
    const score = r?.[scoreField] ?? r?.similarity ?? 0;
    if (id && score > 0) map.set(id, score);
  }
  return map;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const songs = await prisma.song.findMany({
    select: { id: true, totalLikes: true, popularity: true, genres: { include: { genre: true } } },
    orderBy: [{ totalLikes: 'desc' }, { popularity: 'desc' }]
  });
  const songGenresMap = new Map(
    songs.map(s => [s.id, new Set(s.genres.map(g => g.genre?.name).filter(Boolean))])
  );

  console.log(`Catalog: ${songs.length} songs`);
  console.log(`Grid: ${CONFIGS.length} weight configs (AI=0 throughout)`);

  // Popular song scores are constant across users (doesn't depend on training set).
  // Mirrors hybrid engine: getPopularSongs(ceil(limit * 0.2)) = getPopularSongs(4)
  // with default similarity = 0.5 per song.
  const popRaw = await contentBasedFiltering.getPopularSongs(4);
  const popScoreMap = new Map(popRaw.map(r => [r.song.id, r.similarity ?? 0.5]));

  const syntheticUsers = await prisma.user.findMany({
    where: { username: { startsWith: 'synthetic_' } },
    include: { likes: { orderBy: { createdAt: 'asc' } } }
  });
  const evalUsers = syntheticUsers.filter(u => u.likes.length >= 2);
  console.log(`Users: ${evalUsers.length} synthetic users with ≥2 likes`);

  if (evalUsers.length === 0) {
    console.error('No eval users — run npm run eval:gen first.');
    process.exit(1);
  }

  // Per-config accumulators
  const accs = CONFIGS.map(() => ({ metricsList: [], recsList20: [] }));

  // Crash recovery
  const inFlight = new Map();
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
  process.on('SIGINT',  async () => { await restoreAll(); await prisma.$disconnect(); process.exit(130); });
  process.on('SIGTERM', async () => { await restoreAll(); await prisma.$disconnect(); process.exit(143); });

  // Suppress engine logs
  const origLog = console.log;
  console.log = () => {};

  let done = 0;
  for (const user of evalUsers) {
    assertSynthetic(user);
    const allLikes = user.likes;
    const heldOut  = allLikes.at(-1);
    const relevant = new Set([heldOut.songId]);

    try {
      assertSynthetic(user);
      await prisma.userSongLike.delete({
        where: { userId_songId: { userId: user.id, songId: heldOut.songId } }
      });
      inFlight.set(user.id, { songId: heldOut.songId, createdAt: heldOut.createdAt });

      // Two engine calls per user (instead of 36 hybrid calls)
      const [cbRaw, cfRaw] = await Promise.all([
        safeCall(() => contentBasedFiltering.getRecommendations(user.id, 20), 'CB'),
        safeCall(() => collaborativeFiltering.findSimilarItems(user.id, 20), 'CF')
      ]);

      const cbScoreMap = toScoreMap(cbRaw, 'similarity');
      const cfScoreMap = toScoreMap(cfRaw, 'score');

      // Apply all 36 weight configs offline — replicates hybrid merge exactly
      for (let ci = 0; ci < CONFIGS.length; ci++) {
        const { wCF, wCB, wPop } = CONFIGS[ci];

        const combined = new Map();
        for (const [id, s] of cfScoreMap)  combined.set(id, (combined.get(id) ?? 0) + s * wCF);
        for (const [id, s] of cbScoreMap)  combined.set(id, (combined.get(id) ?? 0) + s * wCB);
        // Pop songs: not filtered for training likes — mirrors hybrid engine behaviour
        for (const [id, s] of popScoreMap) combined.set(id, (combined.get(id) ?? 0) + s * wPop);

        const ranked20 = [...combined.entries()]
          .sort(([, a], [, b]) => b - a)
          .slice(0, 20)
          .map(([id]) => id);

        accs[ci].metricsList.push(computeMetrics(ranked20, relevant, 10));
        accs[ci].recsList20.push(ranked20);
      }

    } finally {
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

  console.log = origLog;
  console.log('\n\nComputing metrics...');

  // Aggregate per config and sort by NDCG@10
  const f3 = v => v.toFixed(3);
  const configResults = CONFIGS.map((cfg, ci) => {
    const mList = accs[ci].metricsList;
    const rList = accs[ci].recsList20;
    const avg   = key => mList.reduce((s, m) => s + (m[key] ?? 0), 0) / mList.length;
    return {
      ...cfg,
      ndcg10: avg('ndcg'),
      hr10:   avg('hr'),
      mrr:    avg('mrr'),
      cov20:  catalogCoverage(rList, songs.length),
      div20:  intraListDiversity(rList, songGenresMap)
    };
  }).sort((a, b) => b.ndcg10 - a.ndcg10);

  // ── Print sweep table ─────────────────────────────────────────────────────
  const hdr = '| Rank | wCF   | wCB   | wPop  | NDCG@10 | HR@10 | MRR   | Cov@20 | Div@20 |';
  const sep = '|------|-------|-------|-------|---------|-------|-------|--------|--------|';
  console.log('\n=== WEIGHT SWEEP RESULTS (sorted by NDCG@10) ===\n');
  console.log(hdr);
  console.log(sep);
  for (let i = 0; i < configResults.length; i++) {
    const r = configResults[i];
    console.log(
      `| ${String(i + 1).padStart(4)} | ${f3(r.wCF)} | ${f3(r.wCB)} | ${f3(r.wPop)} |` +
      ` ${f3(r.ndcg10)}   | ${f3(r.hr10)} | ${f3(r.mrr)} | ${f3(r.cov20)}  | ${f3(r.div20)}  |`
    );
  }

  // ── Comparison summary ────────────────────────────────────────────────────
  const PURE_CF_NDCG10    = 0.112;
  const OLD_HYBRID_NDCG10 = 0.084;

  const winner = configResults[0];
  console.log('\n=== COMPARISON ===\n');
  console.log(`Best hybrid:    wCF=${f3(winner.wCF)}, wCB=${f3(winner.wCB)}, wPop=${f3(winner.wPop)}`);
  console.log(`  raw grid:     CF=${winner.rawCF}, CB=${winner.rawCB}, Pop=${winner.rawPop} (renorm'd)`);
  console.log(`  NDCG@10:      ${f3(winner.ndcg10)}`);
  console.log(`Pure CF:        NDCG@10 = ${PURE_CF_NDCG10} (from baseline eval)`);
  console.log(`Old hybrid:     NDCG@10 = ${OLD_HYBRID_NDCG10} (wCF=0.188, wCB=0.688)`);
  console.log(`Improvement vs old hybrid: ${(winner.ndcg10 - OLD_HYBRID_NDCG10 >= 0 ? '+' : '')}${f3(winner.ndcg10 - OLD_HYBRID_NDCG10)}`);

  const margin = winner.ndcg10 - PURE_CF_NDCG10;
  if (margin > 0.001) {
    console.log(`\nVERDICT: Best hybrid BEATS pure CF by +${f3(margin)} NDCG@10.`);
  } else if (margin >= -0.001) {
    console.log(`\nVERDICT: Best hybrid TIES pure CF (difference < 0.001).`);
  } else {
    console.log(`\nVERDICT: Pure CF remains the best method. Best hybrid is ${f3(Math.abs(margin))} below pure CF.`);
    console.log(`  This is a legitimate finding: on this data, the hybrid cannot beat pure CF`);
    console.log(`  regardless of weight — mixing in CB and pop reduces rather than increases accuracy.`);
  }

  await prisma.$disconnect();
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
