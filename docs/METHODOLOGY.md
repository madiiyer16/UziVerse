# UziVerse Recommender — Methodology

---

## Abstract

We build and evaluate a top-N music recommender for the complete Lil Uzi Vert
catalog: 239 songs served to users who express implicit feedback through likes.
Because Spotify deprecated its `/audio-features` endpoint in November 2024
before this catalog was synced, all audio features are null; the system runs
entirely on genre/mood tags and behavioral co-like patterns. We compare six
methods — random, most-popular, content-based (genre/mood similarity),
item-based collaborative filtering using Jaccard co-occurrence on the like
matrix, and two hybrid variants — using leave-one-out evaluation on 50
synthetic users. Behavioral CF achieves NDCG@10 = 0.112, outperforming
content-based by 75% (0.064) and confirming that co-like behavioral structure
captures taste dimensions that genre tags cannot. The primary limitation is that
evaluation is entirely synthetic (one real user in production); hybrid weights
are hand-tuned, not learned.

---

## 1. Problem statement & motivation

The task is top-N recommendation: given a user and a single-artist catalog of
239 Lil Uzi Vert songs, produce a ranked list of songs the user is likely to
engage with. Feedback is implicit — users signal preference by liking songs, not
by assigning star ratings.

This is non-trivial for three reasons. First, the catalog is single-artist, so
genre diversity is low: nearly every song carries the same primary tags (Hip-Hop,
Trap, Rap). Content-based methods that rely on genre/mood differentiation are
therefore weak. Second, the interaction matrix is extremely sparse: at launch,
one real user and a handful of likes exist, placing every user in a cold-start
regime. Third, audio features — the natural way to differentiate tracks within a
catalog — are entirely unavailable. A system that works under these constraints
must discover structure from behavioral signal, not metadata.

---

## 2. Data

### 2.1 Source & collection

Songs are pulled from Spotify's catalog API via `scripts/sync-spotify.js` and
stored in a Neon (serverless PostgreSQL) database through Prisma ORM. The
snapshot used for this evaluation contains **239 songs** from Lil Uzi Vert's
official discography — albums, EPs, mixtapes, and singles. Sync is incremental:
new releases are added on subsequent runs without re-ingesting the full catalog.

### 2.2 Item features — and an important caveat

Spotify's `/audio-features` endpoint was deprecated in November 2024. This
catalog was synced after that date, so the following fields are **null for every
song in the database**: `energy`, `danceability`, `valence`, `tempo`,
`acousticness`, `instrumentalness`, `liveness`, `speechiness`, `loudness`,
`mode`, `key`, `timeSignature`.

This is not hidden or papered over. It is the actual condition the system
operates under, and the evaluation is designed accordingly. The system uses three
signals that are available:

- **Genre tags** (categorical): assigned by a rule-based predictor using song
  metadata (title, artist, album). Primary genres present in the catalog: Hip-Hop,
  Trap, Rap, R&B, Pop (subset of songs). Because all songs are by the same artist,
  genre diversity is low — most songs share the same 2–3 tags.
- **Mood tags** (categorical): similarly assigned. Tags include Energetic, Chill,
  Sad, Happy, Danceable, Aggressive.
- **Popularity** (continuous, 0–100): from Spotify's track popularity score.
  Not null; available for all songs.
- **Behavioral signal** (implicit feedback): user likes via `UserSongLike`.

The AI-enhanced tier in the hybrid attempts to fill missing audio features with
predicted defaults. In practice, every song receives identical predictions
(energy=0.5, danceability=0.5, …) because the predictor's fallback fires for
all songs uniformly. Cosine similarity between identical vectors = 1.0, so the
AI tier assigns the same score to every song and contributes noise, not signal.
The evaluation quantifies this (see §5).

### 2.3 Interaction data & sparsity

**Real users:** 1 user at time of evaluation, with 11 likes and 0 plays or
ratings. This places the entire real-user base in a cold-start regime.

**Synthetic users (evaluation only):** 50 synthetic users, each with 12–25 likes
(mean ≈ 18), generated from a seeded latent-factor model (see §4.1). All
synthetic users are prefixed `synthetic_` and are never shown to real users. The
synthetic interaction matrix has density ≈ 7.5% (≈ 900 like events / (50 users
× 239 songs)).

Real and synthetic data are kept separate in the database. All metrics in §5
are computed on synthetic users only; no real-user data is evaluated.

### 2.4 Preprocessing

- **Interaction matrix:** binary implicit feedback. A like contributes value 1.0;
  plays contribute `min(playCount / 10, 1)`; ratings contribute `rating / 5`.
  Since no real user has plays or ratings, the effective signal is binary likes.
- **Popularity:** used as-is (0–100); similarity is computed as
  `1 − |pop_i − pop_j| / 100`.
- **Missing audio features:** not imputed for CF or content-based scoring. The
  code gates on non-null, non-zero values before using them; missing features are
  excluded from the similarity computation and their weight is redistributed to
  available signals.

---

## 3. Methods

### 3.1 Content-based scorer

Pairwise item similarity uses `calculateEnhancedSimilarity` in
`src/lib/recommendation-engine.js`. The scorer combines up to five signals with
fixed weights:

| Signal | Nominal weight | Effective weight (audio null) |
|--------|---------------|-------------------------------|
| Audio cosine similarity | 0.50 | 0.00 (skipped) |
| Genre Jaccard | 0.20 | 0.40 |
| Mood Jaccard | 0.10 | 0.20 |
| Artist match (binary) | 0.10 | 0.20 |
| Popularity similarity | 0.10 | 0.20 |

Because audio features are null for all songs, the audio component is always
skipped and the remaining four weights are renormalized. Because all songs share
the same artist (Lil Uzi Vert), the artist-match term contributes a constant
+0.20 to every pair's score, adding no differentiation. Effective pairwise
differentiation comes only from genre Jaccard (0.40) and mood Jaccard (0.20),
with popularity similarity (0.20) adding a modest continuous signal.

A candidate song's user score is the weighted mean similarity to all songs in
the user's training likes, using preference weights (like=1, rating=rating/5,
play=min(playCount/10, 1)). Only candidates with similarity > 0.3 are included;
the top-N are returned sorted by score.

Weights are hand-set, not learned. See §6 (limitations) and §7 (future work).

### 3.2 Collaborative filtering — item-based Jaccard co-occurrence

This is the ML centerpiece. Rather than audio-feature similarity, item-item
similarity is derived from behavioral co-like patterns.

**Algorithm:**

Let $U_k$ denote the set of users who liked song $k$.

**Item-item similarity (Jaccard):**
$$\text{sim}(i, j) = \frac{|U_i \cap U_j|}{|U_i \cup U_j|}$$

**User score for candidate $j$, given training likes $T$:**
$$\text{score}(u, j) = \frac{1}{|T|} \sum_{i \in T} \text{sim}(i, j)$$

This is the mean Jaccard similarity of candidate $j$ to every song the user has
liked. Candidates with a score of 0 (no co-like overlap) are excluded.

**Implementation:** the full `UserSongLike` table is loaded once per call
(`O(N_likes)` read). Two hash-map indices are built — item→users and
user→items — then the sum is computed by iterating over training items and
their user sets, using set intersection on the smaller of the two sets for
efficiency. Complexity per call: `O(|T| × N_songs × mean_|U_k|)`, where
`mean_|U_k| ≈ 3.8` given the current database size.

**Cold start:** if the target user has no training likes, or no co-like
overlap exists with any catalog item, the method returns `[]`. The hybrid
engine's `getColdStartRecommendations` handles the full cold-start path
(no signal at all → popular songs).

**Why this replaced the previous CF:** the original `findSimilarItems` called
`findSimilarSongs`, which computed cosine similarity on audio feature vectors.
With all features null, cosine similarity was 0 for every pair, producing an
empty recommendation list for all users (Coverage@20 = 4.6%). The behavioral
approach achieves Coverage@20 = 72.8%.

### 3.3 AI-enhanced tier (degenerate — documented for completeness)

`aiEnhancedEngine.getEnhancedRecommendations` predicts missing audio features
and re-ranks songs by predicted audio similarity. In this catalog it is
degenerate: all songs receive identical default predictions, so every pair has
cosine similarity = 1.0 and every song receives the same score. The eval shows
including this tier reduces NDCG@10 in the hybrid from 0.084 to 0.074 (−0.010).
The tier is retained in the codebase for when real audio features become
available (e.g. via Tunebat extraction) but its weight could reasonably be set
to 0 in production today.

### 3.4 Hybrid combination

The final score is a weighted sum across tiers, with two configurations
evaluated:

**Hybrid with AI** (current live weights):
- Content-based: 0.55
- Collaborative: 0.15
- AI-enhanced: 0.20
- Popularity: 0.10

**Hybrid without AI** (renormalized, evaluated as ablation):
- Content-based: 0.688
- Collaborative: 0.188
- Popularity: 0.125

The original weights were hand-tuned. A subsequent 36-config grid search
(§5, Finding 4; `npm run eval:sweep`) found the optimal blend on this synthetic
eval set: wCF=0.700, wCB=0.150, wPop=0.150, which achieves NDCG@10=0.124 and
beats pure CF. Note that these weights are tuned on the same eval data used for
the primary results — they are an informed starting point, not cross-validated.

### 3.5 Cold-start strategy

A user is considered "warm" if they have any `UserSongLike`, `Rating`, or
`UserSongInteraction` row. Warm users receive the full hybrid pipeline. Cold
users (no signal at all) receive the most-popular songs via `getPopularSongs`,
ordered by `totalLikes DESC`. The cold-start gate was corrected in an earlier
session to check `UserSongLike` count — previously it only checked plays and
ratings, misclassifying users with likes as cold-start.

### 3.6 Explainability

Each recommendation carries a `sources` array (e.g. `['collaborative',
'content-based']`) and a `basedOn` field from the CF scorer
(`'co-liked by similar users'`). The content-based scorer tags recommendations
with `'Content-based match'`. These labels are surfaced in the API response but
are not yet shown in the UI.

---

## 4. Evaluation

### 4.1 Synthetic data generation

Because only one real user exists, evaluation requires synthetic interaction
data. Fifty synthetic users are generated with the following generative model
(seed=42, implemented in `scripts/eval-data-gen.js`):

Each song $v$ is assigned a 4-dimensional latent vector from features
**orthogonal to genre/mood** to avoid circularity:

| Dim | Feature | Construction |
|-----|---------|--------------|
| $f_0$ | Release year | $(year - 2009) / (2024 - 2009)$, clipped to $[0,1]$ |
| $f_1$ | Popularity rank | Ordinal rank normalized to $[0,1]$ |
| $f_2$ | Duration bucket | $0$ (< 150 s), $0.5$ (150–300 s), $1.0$ (> 300 s) |
| $f_3$ | Explicit flag | $0$ or $1$ |

Each user $u$ is assigned a latent taste vector $\mathbf{u} \sim \mathcal{N}(0,
I_4)$. The probability of liking song $v$ is:
$$P(\text{like} \mid u, v) = \sigma(\mathbf{u} \cdot \mathbf{v} + \varepsilon),
\quad \varepsilon \sim \mathcal{N}(0, 0.35)$$

No separate popularity bias term is added. Users like the top 12–25 songs by
score; likes are inserted with staggered `createdAt` timestamps so the
leave-one-out protocol has a well-defined temporal ordering. The script is
idempotent (`npm run eval:gen` deletes and regenerates from the fixed seed).

**Why orthogonal to genre/mood:** if synthetic preferences were generated from
genre/mood proximity (the same signal the content-based scorer uses), CB methods
would win by construction and the eval would prove nothing. Using year,
popularity rank, duration, and explicit flag as latent dimensions ensures the
evaluation is a genuine test of each method's ability to discover latent taste
structure.

### 4.2 Protocol

Leave-one-out: for each synthetic user, the most recently liked song (latest
`createdAt`) is held out as the test item. The remaining likes are the training
set. Each method generates a top-K recommendation list from the training set;
the metric measures whether the held-out item appears and at what rank. K ∈
{5, 10, 20}.

Crash safety: the harness deletes the held-out `UserSongLike` row before calling
the engine (so the engine sees only training data) and restores it immediately
after scoring, in a `try/finally` block with `SIGINT`/`SIGTERM` handlers. Only
rows belonging to `synthetic_` users are ever deleted; this is asserted before
every delete.

### 4.3 Metrics

Under single-item leave-one-out, one item is relevant per user. Metrics reduce
to their standard forms with $|\text{relevant}| = 1$:

- **HR@K** (Hit Rate): 1 if the held-out item appears in the top-K, else 0.
  Averaged across users.
- **NDCG@K**: $1 / \log_2(\text{rank} + 1)$ if the item is found at rank ≤ K,
  else 0. Normalized by the ideal (rank 1). Sensitive to where in the list the
  relevant item appears.
- **MRR** (Mean Reciprocal Rank): $1/\text{rank}$ if found within K, else 0.
  Mathematically identical to MAP under single-item LOO; only MRR is reported.
- **Catalog Coverage@20**: fraction of the 239-song catalog that appears in at
  least one user's top-20 list. Measures how much of the catalog a method
  explores.
- **Diversity@20**: $1 - \text{mean pairwise genre Jaccard}$ within each user's
  top-20 list, averaged across users. Low = recommends the same genre cluster to
  everyone; high = varied lists.

---

## 5. Results

All results are on 50 synthetic users. Real user data is not evaluated (sample
size = 1).

| Method              | HR@5  | HR@10 | HR@20 | NDCG@5 | NDCG@10 | NDCG@20 | MRR   | Cov@20 | Div@20 |
|---------------------|-------|-------|-------|--------|---------|---------|-------|--------|--------|
| Random (seeded)     | 0.060 | 0.080 | 0.140 | 0.039  | 0.044   | 0.060   | 0.034 | 0.992  | 0.312  |
| Most popular        | 0.020 | 0.020 | 0.140 | 0.010  | 0.010   | 0.041   | 0.007 | 0.134  | 0.363  |
| Content-based       | 0.080 | 0.120 | 0.180 | 0.050  | 0.064   | 0.078   | 0.047 | 0.741  | 0.014  |
| **CF (item-co-like)**   | **0.140** | **0.220** | **0.360** | **0.087** | **0.112** | **0.145** | **0.079** | **0.728** | **0.306** |
| Hybrid + AI         | 0.080 | 0.120 | 0.180 | 0.061  | 0.074   | 0.088   | 0.060 | 0.741  | 0.014  |
| Hybrid no AI        | 0.100 | 0.120 | 0.180 | 0.077  | 0.084   | 0.099   | 0.073 | 0.741  | 0.014  |

**Finding 1 — CF beats content-based by 75% on NDCG@10 (0.112 vs 0.064) and
finds latent structure CB cannot.**
Content-based uses genre/mood tags, which are near-identical across a
single-artist catalog. All songs share Hip-Hop/Trap/Rap, so genre Jaccard
between most pairs is high regardless of what the user actually likes. CB
therefore recommends the same cluster of songs to every user (Diversity@20 =
0.014, close to zero). Behavioral CF discovers that different users with similar
latent tastes — defined over year, duration, and explicitness — consistently
like the same subset of songs, and exploits that co-occurrence. This is the
mechanism genre tags were designed to approximate but cannot, given the catalog's
homogeneity.

**Finding 2 — Removing the degenerate AI tier improves the hybrid
(NDCG@10 0.074 → 0.084).**
The AI-enhanced tier assigns uniform scores to all songs (identical predicted
features → cosine similarity = 1.0). Including it at 20% weight dilutes the
content-based signal, which has at least some differentiation from mood and
popularity. Removing it and redistributing weight to CB and CF improves
NDCG@10 by +0.010.

**Finding 3 — Most-popular scores below random (NDCG@10 0.010 vs 0.044),
validating the synthetic data design.**
No explicit popularity bias was added to the generative model, so the catalog's
most-played songs are not preferentially liked by synthetic users. The fact that
most-popular underperforms chance confirms that popularity rank is not a proxy
for synthetic user preferences — the latent structure is genuinely independent
of it.

**Finding 4 — After weight rebalancing, the tuned hybrid beats pure CF
(NDCG@10 0.124 vs 0.112, +11%).**
The original hybrid-no-AI weights (CF=0.188, CB=0.688) made CB the dominant
signal; this reduced NDCG@10 to 0.084, below pure CF. A 36-configuration grid
search (`npm run eval:sweep`) over CF ∈ {0.4, 0.5, 0.6, 0.7} × CB ∈ {0.15,
0.25, 0.35} × Pop ∈ {0.05, 0.10, 0.15} (AI=0, weights renormalised to sum 1)
found the winning config: **wCF=0.700, wCB=0.150, wPop=0.150**.

The sweep revealed a sharp step function rather than a smooth tradeoff: any
config with wCB ≥ 0.25 collapsed to NDCG@10 = 0.083 regardless of CF weight,
while configs with wCB < 0.20 achieved 0.103–0.124. Once CB weight crosses ~0.20,
CB's weak catalog-homogeneous signal dominates the ranking.

**Methodological caveat:** the winning weights were selected against the same 50
synthetic users used for baseline measurement. This is in-sample tuning, not
cross-validation. The 0.124 figure represents best-fit to this synthetic data;
real-world generalisation is unverified. See full sweep table in
`docs/EVAL_RESULTS.md`.

---

## 6. Discussion & limitations

**Small, synthetic interaction data.** The eval runs on 50 synthetic users with
a generative model that is an approximation. Real user behavior may have
different structure (session effects, discovery patterns, social influence) that
the latent-factor model does not capture. Results should be treated as
indicative, not definitive, until real user interaction data accumulates.

**No audio features.** The Spotify `/audio-features` deprecation is a hard
constraint. The content-based scorer falls back to genre/mood, which are
coarse-grained and near-identical across this catalog. Any method that would
benefit from fine-grained acoustic similarity (e.g. "more songs that sound like
this") cannot be evaluated or deployed without an alternative audio-feature
source.

**In-sample weight tuning.** The grid search that produced wCF=0.700, wCB=0.150,
wPop=0.150 was run on the same 50 synthetic users used for the baseline results.
This is in-sample optimisation, not cross-validation. The 0.124 NDCG@10 figure
represents best-fit to this synthetic data; the true generalisation error is
unknown. Held-out weight selection would require a second, independent synthetic
cohort or real user data.

**Offline metrics are proxies.** NDCG on synthetic data measures the ability to
recover a held-out generated like, not real user satisfaction. No online A/B
test or real-user engagement signal exists.

**Single-artist generalization.** All design choices are calibrated to a
catalog where genre diversity is near-zero and audio features are absent. The
genre-based content scorer would likely be more useful on a multi-artist catalog
with varied genres; the behavioral CF would remain useful in either setting.

---

## 7. Future work

**Validate tuned weights on held-out data.** The grid search (Finding 4) found
wCF=0.700 optimal on the same 50 synthetic users used for measurement — this is
in-sample selection. To get an unbiased estimate of generalisation, either
generate a second independent synthetic cohort (different seed) or accumulate
real user data, then re-run `npm run eval:sweep` on the held-out set. The step-
function structure of the sweep (all configs with wCB ≥ 0.25 collapse to 0.083)
suggests the result is not particularly sensitive to the exact CF weight within
the CF-dominated regime (0.60–0.78 all achieve 0.112–0.124).

**Audio features via extraction.** Tunebat and similar services provide
audio analysis for individual tracks without requiring the Spotify endpoint.
If integrated, the content-based scorer would gain its full 0.50 weight and the
AI-enhanced tier would have real data to work from. This should be treated as a
controlled experiment: run the eval with and without, and report whether adding
audio features meaningfully improves NDCG@10 above the behavioral CF baseline.

**Learned blend weights.** Cross-validate blend weights using the existing eval
harness (`npm run eval` with `--weights` flags, or a simple Bayesian optimization
loop) rather than hand-tuning. This would also enable per-user weight
personalization for users with enough history.

**Real interaction feedback loop.** As the real user base grows, replace
synthetic users with real held-out interactions for evaluation. At ~20 real users
with ≥5 likes each, a meaningful real-data eval becomes possible. Track whether
CF's advantage over CB is maintained on real behavior.

**Matrix factorization.** The codebase contains a complete SGD-based MF
scaffold (`matrixFactorization`, `buildInteractionMatrix`, `predictRating`,
`updateFactors` in `CollaborativeFiltering`). It is not wired into the production
path, and `buildInteractionMatrix` has been updated to include `UserSongLike`.
Implicit-feedback ALS (Hu et al. 2008) would be the appropriate objective.
With 50+ users, MF could discover compressed latent representations that
generalize better than pairwise Jaccard.

---

## 8. Reproducibility

**Environment:** Node.js v22.22.3, npm. Clone the repository and run
`npm install`. Copy `.env.example` to `.env` and fill in `DATABASE_URL`
(Neon PostgreSQL connection string) and Spotify API credentials
(`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`).

**Data:** `npm run sync:spotify` syncs the Lil Uzi Vert catalog from Spotify.
Current snapshot: 239 songs. Runtime: ~2 minutes.

**Synthetic evaluation data:**
```
npm run eval:gen
```
Generates 50 synthetic users (`synthetic_0001`–`synthetic_0050`) with 12–25
likes each. Idempotent — deletes and recreates on each run. Seed = 42.
Runtime: ~15 seconds (one bcrypt hash + 50 × N Prisma inserts).

**Evaluation:**
```
npm run eval
```
Runs leave-one-out evaluation across all 6 methods, prints the results table to
stdout, and writes `docs/EVAL_RESULTS.md`. Requires synthetic data to exist
first. Runtime: ~2–3 minutes on Neon's serverless PostgreSQL (network latency
dominates). Seed = 42 for the random baseline.

**Weight sweep:**
```
npm run eval:sweep
```
Runs a 36-config grid search (CF × CB × Pop, AI=0). Calls CB and CF engines
once per user, applies all 36 weight configs offline — same leave-one-out
protocol, no additional DB mutations. Writes results to stdout only. Runtime:
~2–3 minutes. Requires synthetic data to exist first.

**Determinism:** the random baseline and synthetic data generation are fully
deterministic given seed=42. The CF, CB, and hybrid methods are deterministic
given the database state. Re-running `eval:gen` followed by `eval` should
reproduce the table in §5 exactly. The sweep results in §5 Finding 4 are also
deterministic given the same database state.

---

## References

- Sarwar, B., Karypis, G., Konstan, J., & Riedl, J. (2001). Item-based
  collaborative filtering recommendation algorithms. *WWW 2001*.
  — Foundation for item-based CF with co-occurrence similarity.
- Hu, Y., Koren, Y., & Volinsky, C. (2008). Collaborative filtering for
  implicit feedback datasets. *ICDM 2008*.
  — Implicit-feedback ALS; relevant to the MF scaffold and future work.
- Järvelin, K., & Kekäläinen, J. (2002). Cumulated gain-based evaluation of IR
  techniques. *TOIS 20*(4).
  — NDCG definition used throughout.
- Cremonesi, P., Koren, Y., & Turrin, R. (2010). Performance of recommender
  algorithms on top-N recommendation tasks. *RecSys 2010*.
  — Establishes NDCG and HR as appropriate metrics for top-N, implicit-feedback
  evaluation.
