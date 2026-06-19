# UziVerse Recommender — Methodology

> A technical writeup of the recommendation system: data, models, evaluation,
> and results. This is the document an admissions reviewer or interviewer will
> actually read, so keep it honest, specific, and quantitative.
>
> **How to use this scaffold:** fill every `[TODO]`. Replace guidance in
> *italics* with real content. Delete this blockquote when done. Don't claim
> anything you haven't measured — the value here is rigor, not polish.

---

## Abstract

*[TODO: 4–6 sentences. What problem, what data, what methods, the single
headline result (e.g. "the hybrid model improves NDCG@10 by X% over a
popularity baseline"), and the main limitation. Write this last.]*

---

## 1. Problem statement & motivation

*[TODO: 1–2 paragraphs.]*
- The task: given a user and a single-artist catalog of ~290 songs, produce a
  ranked list of songs the user is likely to engage with.
- Why it's non-trivial: single-artist catalog (low genre diversity → content
  signals are subtle), sparse interaction data, and cold-start for new users.
- Framing: this is a **top-N recommendation** problem over **implicit feedback**
  (likes/plays), not rating prediction.

---

## 2. Data

### 2.1 Source & collection
*[TODO]* Discography and audio features pulled from the Spotify Web API and
stored in PostgreSQL via Prisma. State: number of songs, albums/EPs/singles,
date of the snapshot, and how sync works (`scripts/sync-spotify.js`).

### 2.2 Item features
*[TODO: list the exact audio features used and their ranges.]* For each song,
the model uses N audio features (e.g. energy, danceability, valence, tempo,
acousticness, instrumentalness, liveness, speechiness), plus genre, mood, and
popularity. State which are continuous vs categorical and the normalization
applied (e.g. min–max to [0,1]; z-score; tempo scaled by /250).

### 2.3 Interaction data & sparsity
*[TODO — be honest here, it reads as maturity.]* Report: number of users,
number of interactions (likes/plays/ratings), and the resulting density
( interactions / (users × items) ). State the cold-start regime explicitly.
If synthetic interactions were generated for evaluation, describe the
generative process and **label all synthetic results as synthetic** wherever
they appear.

### 2.4 Preprocessing
*[TODO]* Feature normalization, handling of missing audio features, and how the
user×item interaction matrix is constructed (binary implicit feedback vs.
weighted by play count / recency).

---

## 3. Methods

*The system is a hybrid of three scorers combined into a final ranking. Document
each precisely enough that someone could reimplement it.*

### 3.1 Content-based scorer
*[TODO: confirm against `src/lib/recommendation-engine.js`.]*
Similarity between songs `i` and `j` is cosine similarity over the normalized
audio-feature vectors:

```
sim(i, j) = (v_i · v_j) / (||v_i|| · ||v_j||)
```

The content score blends audio similarity with genre, mood, and popularity
signals using weights `w_audio, w_genre, w_mood, w_pop`.
*[TODO: state the actual weights and — importantly — how they were chosen. If
hand-set, say so and reference §3.4/Future Work for learning them.]*

### 3.2 Personalized scorer
*[TODO]* Given a user's liked songs, candidate songs are scored by aggregating
genre overlap, mood overlap, and audio similarity to the liked set. State the
aggregation (mean? max? weighted sum?) and the weights.

### 3.3 Collaborative filtering / matrix factorization
*[TODO — this is the section reviewers will scrutinize most.]*
Describe the CF approach. If matrix factorization: state the model
( e.g. learn user factors `p_u ∈ R^k` and item factors `q_i ∈ R^k` so that
`r̂_{u,i} = p_uᵀ q_i` ), the objective (e.g. implicit-feedback ALS / BPR),
the regularization, the number of latent factors `k`, and how it was trained.
State the fallback when CF can't run (cold-start → content-based).

### 3.4 Hybrid combination
*[TODO]* How the three scorers are combined into the final ranking (weighted sum,
cascade, switching). State the blend weights and **how they were determined** —
grid search against the eval harness, or a learned learning-to-rank model. If
still hand-tuned, name that as a known limitation.

### 3.5 Cold-start strategy
*[TODO]* New user (no history) → onboarding seed selection / popularity +
content blend. New item (just synced) → audio-feature nearest neighbors.
Describe the exact fallback chain.

### 3.6 Explainability
*[TODO]* How each recommendation's explanation is generated from the *actual*
contributing factors (e.g. top contributing features and the specific liked
song(s) that drove the score), not detached templates.

---

## 4. Evaluation

### 4.1 Protocol
*[TODO]* Train/test split strategy: leave-one-out (hold out each user's most
recent positive interaction) and/or a temporal split. State the random seed for
reproducibility and how many users/interactions are in each split.

### 4.2 Metrics
*Report ranking quality and beyond-accuracy metrics. Definitions for the writeup:*
- **Precision@K** — fraction of the top-K that are relevant.
- **Recall@K** — fraction of relevant items captured in the top-K.
- **MAP** — mean average precision across users.
- **NDCG@K** — discounted cumulative gain normalized by the ideal ranking:
  `DCG@K = Σ_{r=1..K} rel_r / log2(r+1)`, `NDCG@K = DCG@K / IDCG@K`.
- **Catalog coverage** — fraction of the catalog ever recommended across users.
- **Intra-list diversity** — `1 − mean pairwise audio-feature similarity` within
  a recommendation list.
- **Novelty** — popularity-weighted; how non-obvious the recommendations are.

*[TODO: report K values used, e.g. K ∈ {5, 10, 20}.]*

### 4.3 Baselines
*[TODO]* Compare every model against: **Random**, **Most-Popular**, and each tier
individually (content-only, personalized, CF) plus the full hybrid. Baselines are
what turn "I built a recommender" into "I measured a recommender."

---

## 5. Results

*[TODO: fill from the eval harness output. One row per method.]*

| Method            | Precision@10 | Recall@10 | MAP   | NDCG@10 | Coverage | Diversity |
| ----------------- | ------------ | --------- | ----- | ------- | -------- | --------- |
| Random            | [TODO]       | [TODO]    | [TODO]| [TODO]  | [TODO]   | [TODO]    |
| Most-Popular      | [TODO]       | [TODO]    | [TODO]| [TODO]  | [TODO]   | [TODO]    |
| Content-based     | [TODO]       | [TODO]    | [TODO]| [TODO]  | [TODO]   | [TODO]    |
| Personalized      | [TODO]       | [TODO]    | [TODO]| [TODO]  | [TODO]   | [TODO]    |
| Collaborative (MF)| [TODO]       | [TODO]    | [TODO]| [TODO]  | [TODO]   | [TODO]    |
| **Hybrid (full)** | [TODO]       | [TODO]    | [TODO]| [TODO]  | [TODO]   | [TODO]    |

*[TODO: 1–2 paragraphs reading the table. Which model wins on NDCG@10 and by how
much vs. Most-Popular? Any accuracy/diversity tradeoff? Note whether results use
real or synthetic interactions.]*

---

## 6. Discussion & limitations

*[TODO — honesty here is a strength, not a weakness.]*
- Single-artist catalog limits genre/diversity signal.
- Interaction sparsity / small user base limits collaborative filtering.
- Hand-tuned weights (if still the case) are not learned from data.
- Offline metrics are a proxy for real user satisfaction; no online A/B test.

---

## 7. Future work

*[TODO]* Learned blend weights (learning-to-rank), richer item embeddings,
session-based recommendation, online evaluation, expanding beyond a single
artist to test generalization of the methodology.

---

## 8. Reproducibility

*[TODO]*
- Environment: Node version, `npm install`, env vars (`.env.example`).
- Data: how to seed (`npm run db:seed`) and sync (`npm run sync:spotify`).
- Evaluation: exact command to reproduce the results table (e.g. `npm run eval`),
  the random seed, and expected runtime.

---

## References

*[TODO: cite the canonical methods you used. Suggested starting points —
replace with the ones actually relevant to your final implementation:]*
- Koren, Bell & Volinsky (2009), *Matrix Factorization Techniques for
  Recommender Systems*.
- Hu, Koren & Volinsky (2008), *Collaborative Filtering for Implicit Feedback
  Datasets* (implicit ALS).
- Rendle et al. (2009), *BPR: Bayesian Personalized Ranking from Implicit
  Feedback*.
- Järvelin & Kekäläinen (2002), *Cumulated Gain-based Evaluation of IR
  Techniques* (NDCG).
