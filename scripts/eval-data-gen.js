/**
 * Synthetic evaluation data generator.
 *
 * Generates 50 synthetic users whose song preferences are driven by a 4-dim
 * LATENT taste vector — not genre/mood — so genre-based content methods have
 * no structural advantage in the eval.
 *
 * Latent song dimensions (orthogonal to genre/mood):
 *   f0  release year, normalised 2009→0, 2024→1
 *   f1  popularity ordinal rank, 0→least popular, 1→most popular
 *   f2  duration bucket: <150 s → 0, 150–300 s → 0.5, >300 s → 1
 *   f3  explicit flag: 0 or 1
 *
 * Like probability: sigmoid(u · v  +  ε),  ε ~ N(0, 0.35)
 * No separate popularity bias — popularity preference is captured only via
 * u[f1], so the most-popular baseline competes on a fair playing field.
 *
 * Idempotent: deletes all synthetic_ users before recreating them.
 * Fixed seed 42 for full reproducibility.
 *
 * Usage:  npm run eval:gen
 */
import './load-env.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED = 42;
const NUM_USERS = 50;
const TARGET_LIKES_MIN = 12;
const TARGET_LIKES_MAX = 25;
const MIN_LIKES_FOR_EVAL = 3;
const DIMS = 4;
const NOISE_SIGMA = 0.35;

// ── Seeded PRNG (Mulberry32) ──────────────────────────────────────────────────
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller: two uniform draws → one standard-normal variate
function normalRandom(rng) {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
function dot(a, b) { return a.reduce((s, ai, i) => s + ai * b[i], 0); }

function buildSongVector(song, popularityRanks) {
  const f0 = song.year
    ? Math.max(0, Math.min(1, (song.year - 2009) / (2024 - 2009)))
    : 0.5;
  const f1 = popularityRanks.get(song.id) ?? 0.5;
  const dur = song.duration ?? 200;
  const f2 = dur < 150 ? 0.0 : dur > 300 ? 1.0 : 0.5;
  const f3 = song.explicit ? 1.0 : 0.0;
  return [f0, f1, f2, f3];
}

async function main() {
  console.log('Loading catalog...');
  const songs = await prisma.song.findMany({
    select: { id: true, year: true, popularity: true, duration: true, explicit: true }
  });

  if (songs.length === 0) {
    console.error('No songs found — run npm run sync:spotify first.');
    process.exit(1);
  }
  console.log(`Found ${songs.length} songs.`);

  // Popularity ranks: ordinal 0→1 ascending (least popular = 0)
  const ranked = [...songs].sort((a, b) => (a.popularity ?? 0) - (b.popularity ?? 0));
  const popularityRanks = new Map(
    ranked.map((s, i) => [s.id, i / Math.max(ranked.length - 1, 1)])
  );

  const songVectors = new Map(
    songs.map(s => [s.id, buildSongVector(s, popularityRanks)])
  );

  // Clean up any prior synthetic run
  console.log('Removing existing synthetic data...');
  const existing = await prisma.user.findMany({
    where: { username: { startsWith: 'synthetic_' } },
    select: { id: true }
  });
  if (existing.length > 0) {
    const ids = existing.map(u => u.id);
    await prisma.userSongLike.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    console.log(`Removed ${existing.length} old synthetic users.`);
  }

  // One bcrypt hash shared by all synthetic users (avoid 50× slow hashing)
  const SYNTHETIC_HASH = await bcrypt.hash('synthetic-eval-not-for-login', 10);

  const rng = mulberry32(SEED);
  let created = 0;
  const BASE_MS = new Date('2024-01-01T00:00:00Z').getTime();

  for (let i = 1; i <= NUM_USERS; i++) {
    const username = `synthetic_${String(i).padStart(4, '0')}`;

    // User latent vector: 4 independent N(0,1) draws
    const u = Array.from({ length: DIMS }, () => normalRandom(rng));

    // Score each song and add N(0, NOISE_SIGMA) noise
    const scores = songs.map(song => ({
      songId: song.id,
      score: sigmoid(dot(u, songVectors.get(song.id)) + normalRandom(rng) * NOISE_SIGMA)
    }));

    // Take top targetLikes by score
    scores.sort((a, b) => b.score - a.score);
    const targetLikes =
      TARGET_LIKES_MIN + Math.floor(rng() * (TARGET_LIKES_MAX - TARGET_LIKES_MIN + 1));
    const liked = scores.slice(0, targetLikes);

    if (liked.length < MIN_LIKES_FOR_EVAL) {
      process.stdout.write('s');
      continue;
    }

    const user = await prisma.user.create({
      data: { username, email: `${username}@eval.local`, hashedPassword: SYNTHETIC_HASH }
    });

    // Stagger createdAt by 1 h so leave-one-out picks the last item correctly
    for (let j = 0; j < liked.length; j++) {
      await prisma.userSongLike.create({
        data: {
          userId: user.id,
          songId: liked[j].songId,
          createdAt: new Date(BASE_MS + j * 3_600_000)
        }
      });
    }

    created++;
    process.stdout.write(created % 10 === 0 ? `\n${created}` : '.');
  }

  console.log(`\n\nDone. Created ${created} synthetic users `
    + `with ${TARGET_LIKES_MIN}–${TARGET_LIKES_MAX} likes each (seed=${SEED}).`);

  await prisma.$disconnect();
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
