# Offline Evaluation Results

Generated: 2026-06-23T01:55:01.991Z (post CF-rewrite run)
Synthetic users: 50 | Catalog size: 239 songs
Protocol: leave-one-out (held-out = most recent like per user)

## Generative process

Synthetic user preferences are driven by a 4-dimensional latent taste vector
**orthogonal to genre/mood**, eliminating structural bias toward content-based methods:

| Dim | Feature | Why orthogonal |
|-----|---------|----------------|
| f0 | Release year (2009→0, 2024→1) | independent of genre assignment |
| f1 | Popularity rank (0→1 ordinal) | CB uses popularity *diff* between pairs, not absolute rank |
| f2 | Duration bucket (short/med/long) | structural property, not a genre |
| f3 | Explicit flag (0/1) | lyrical content flag, not a genre |

Like probability: `sigmoid(u·v + ε)`, `ε ~ N(0, 0.35)`, no separate popularity
bias — popularity preference is captured only through the user's own f1 component,
so the most-popular baseline competes on a fair playing field.

## Results

| Method              | HR@5  | HR@10 | HR@20 | NDCG@5 | NDCG@10 | NDCG@20 | MRR   | Cov@20 | Div@20 |
|---------------------|-------|-------|-------|--------|---------|---------|-------|--------|--------|
| Random (seeded)     | 0.060 | 0.080 | 0.140 | 0.039  | 0.044   | 0.060   | 0.034 | 0.992  | 0.312  |
| Most popular        | 0.020 | 0.020 | 0.140 | 0.010  | 0.010   | 0.041   | 0.007 | 0.134  | 0.363  |
| Content-based       | 0.080 | 0.120 | 0.180 | 0.050  | 0.064   | 0.078   | 0.047 | 0.741  | 0.014  |
| CF (item-co-like)   | 0.140 | 0.220 | 0.360 | 0.087  | 0.112   | 0.145   | 0.079 | 0.728  | 0.306  |
| Hybrid + AI         | 0.080 | 0.120 | 0.180 | 0.061  | 0.074   | 0.088   | 0.060 | 0.741  | 0.014  |
| Hybrid no AI        | 0.100 | 0.120 | 0.180 | 0.077  | 0.084   | 0.099   | 0.073 | 0.741  | 0.014  |

**Winner on NDCG@10:** CF (item-co-like) — 0.112 (75% above content-based, 2.5× above random)
**AI-tier experiment:** removing the degenerate AI tier helped — hybrid-no-AI NDCG@10 0.084 vs 0.074 with AI (+0.010).

## Notes

- **CF (item-co-like)** uses Jaccard similarity on the user×item like matrix:
  `sim(i,j) = |U_i ∩ U_j| / |U_i ∪ U_j|` where U_k is the set of users who liked
  song k. This replaced the original audio-feature cosine CF (which was dead — all
  audio features are null after Spotify deprecated `/audio-features` in Nov 2024).
  The behavioral approach achieves Coverage@20 = 72.8% vs 4.6% for the audio approach,
  and NDCG@10 = 0.112 vs 0.040 prior.

- **AI-enhanced tier** fills songs with missing audio features with identical
  defaults (energy=0.5, danceability=0.5, …). Cosine similarity between identical
  vectors = 1.0 for all pairs, so the AI tier assigns a uniform score to every song.
  It adds noise rather than signal; removing it raises NDCG@10 by +0.010 in the hybrid.

- **Most-popular below random** (NDCG@10 0.010 vs 0.044) validates the synthetic
  data design: no explicit popularity bias was added, so the popular baseline has
  no structural advantage. That it scores below random confirms the synthetic
  preferences are driven by latent structure, not catalog-wide popularity.

- **Hybrid underperforms pure CF** (NDCG@10 0.084 vs 0.112). The hybrid CF weight
  (0.188) is too low relative to content-based (0.688), which is the weaker method
  on this data. Rebalancing weights to favour CF is a known next step.

- **Content-based diversity** (Div@20 = 0.014) is near-zero because every song in
  this catalog shares the same primary genres (Hip-Hop, Trap, Rap) and the same
  artist. CF diversity (0.306) is 22× higher because co-like patterns differentiate
  songs by behavioral sub-taste, not genre tags.

## Weight Sweep — Finding the Optimal CF-Dominant Blend

**Run date:** 2026-06-22 | **Script:** `npm run eval:sweep`

**Methodological caveat:** these weights are tuned on the same 50 synthetic users
used for the baseline results above. They represent the best fit to this synthetic
data, not a held-out generalisation claim. The winning config is an informed
starting point, not a validated real-world optimum.

**Grid:** CF ∈ {0.4, 0.5, 0.6, 0.7} × CB ∈ {0.15, 0.25, 0.35} × Pop ∈ {0.05,
0.10, 0.15} × AI = 0. Each (cf, cb, pop) triplet renormalised to sum to 1.0.
36 configurations evaluated.

### Full sweep results (sorted by NDCG@10)

| Rank | wCF   | wCB   | wPop  | NDCG@10 | HR@10 | MRR   | Cov@20 | Div@20 |
|------|-------|-------|-------|---------|-------|-------|--------|--------|
|    1 | 0.700 | 0.150 | 0.150 | 0.124   | 0.180 | 0.106 | 0.762  | 0.038  |
|    2 | 0.625 | 0.187 | 0.187 | 0.116   | 0.160 | 0.102 | 0.745  | 0.024  |
|    3 | 0.667 | 0.167 | 0.167 | 0.116   | 0.160 | 0.102 | 0.753  | 0.030  |
|    4 | 0.778 | 0.167 | 0.056 | 0.112   | 0.160 | 0.097 | 0.762  | 0.027  |
|    5 | 0.737 | 0.158 | 0.105 | 0.112   | 0.160 | 0.097 | 0.757  | 0.030  |
|    6 | 0.571 | 0.214 | 0.214 | 0.103   | 0.140 | 0.092 | 0.749  | 0.020  |
|    7 | 0.667 | 0.200 | 0.133 | 0.103   | 0.140 | 0.092 | 0.749  | 0.021  |
|    8 | 0.750 | 0.187 | 0.063 | 0.103   | 0.140 | 0.092 | 0.757  | 0.023  |
|    9 | 0.706 | 0.176 | 0.118 | 0.103   | 0.140 | 0.092 | 0.757  | 0.023  |
|   10 | 0.667 | 0.250 | 0.083 | 0.083   | 0.120 | 0.072 | 0.745  | 0.014  |
|   11 | 0.615 | 0.231 | 0.154 | 0.083   | 0.120 | 0.072 | 0.749  | 0.015  |
|   12 | 0.571 | 0.357 | 0.071 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   13 | 0.533 | 0.333 | 0.133 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   14 | 0.500 | 0.313 | 0.187 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   15 | 0.500 | 0.437 | 0.063 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   16 | 0.471 | 0.412 | 0.118 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   17 | 0.444 | 0.389 | 0.167 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   18 | 0.714 | 0.214 | 0.071 | 0.083   | 0.120 | 0.072 | 0.749  | 0.016  |
|   19 | 0.625 | 0.313 | 0.063 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   20 | 0.588 | 0.294 | 0.118 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   21 | 0.556 | 0.278 | 0.167 | 0.083   | 0.120 | 0.072 | 0.745  | 0.014  |
|   22 | 0.556 | 0.389 | 0.056 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   23 | 0.526 | 0.368 | 0.105 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   24 | 0.500 | 0.350 | 0.150 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   25 | 0.667 | 0.278 | 0.056 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   26 | 0.632 | 0.263 | 0.105 | 0.083   | 0.120 | 0.072 | 0.745  | 0.014  |
|   27 | 0.600 | 0.250 | 0.150 | 0.083   | 0.120 | 0.072 | 0.745  | 0.014  |
|   28 | 0.600 | 0.350 | 0.050 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   29 | 0.571 | 0.333 | 0.095 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   30 | 0.545 | 0.318 | 0.136 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   31 | 0.700 | 0.250 | 0.050 | 0.083   | 0.120 | 0.072 | 0.745  | 0.014  |
|   32 | 0.667 | 0.238 | 0.095 | 0.083   | 0.120 | 0.072 | 0.745  | 0.014  |
|   33 | 0.636 | 0.227 | 0.136 | 0.083   | 0.120 | 0.072 | 0.749  | 0.015  |
|   34 | 0.636 | 0.318 | 0.045 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   35 | 0.609 | 0.304 | 0.087 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |
|   36 | 0.583 | 0.292 | 0.125 | 0.083   | 0.120 | 0.072 | 0.741  | 0.014  |

### Comparison: winner vs baselines

| Config           | NDCG@10 | HR@10 | MRR   | Cov@20 | Div@20 |
|------------------|---------|-------|-------|--------|--------|
| Pure CF          | 0.112   | 0.220 | 0.079 | 0.728  | 0.306  |
| Old hybrid no-AI | 0.084   | 0.120 | 0.073 | 0.741  | 0.014  |
| **Best hybrid**  | **0.124** | **0.180** | **0.106** | **0.762** | **0.038** |

**Winner:** wCF=0.700, wCB=0.150, wPop=0.150 (these are the normalised weights;
raw grid point CF=0.7, CB=0.15, Pop=0.15 already sums to 1.0).

**VERDICT: The best hybrid BEATS pure CF by +0.012 NDCG@10** (0.124 vs 0.112)
and improves MRR from 0.079 to 0.106 (+34%). HR@10 is slightly lower (0.180 vs
0.220) — the hybrid places the hit at a higher rank on average, but miss more
often at exactly the top-10 cutoff. NDCG, which rewards rank, is the more
informative metric here.

### Structural finding from the sweep

The 36 configs split into two regimes:
- **CF-dominated (wCB < 0.20):** NDCG@10 = 0.103–0.124 (ranks 1–9)
- **CB-influenced (wCB ≥ 0.25):** NDCG@10 = 0.083 (ranks 10–36), identical to the old hybrid

This is not a smooth tradeoff — it is a step function. Once CB weight exceeds the threshold (~0.20), CB's weak, catalog-homogeneous signal dominates the ranking and performance collapses to the old baseline. The hybrid only wins when CF accounts for at least 57% of the blend and CB is held below 20%.
