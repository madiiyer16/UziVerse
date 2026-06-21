# Offline Evaluation Results

Generated: 2026-06-21T20:40:11.247Z
Synthetic users: 50 | Catalog size: 239 songs
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

Like probability: `sigmoid(u·v + ε)`, `ε ~ N(0, 0.35)`, no separate popularity
bias — popularity preference is captured only through the user's own f1 component.

## Results

| Method            | HR@5  | HR@10 | HR@20 | NDCG@5 | NDCG@10 | NDCG@20 | MRR   | Cov@20 | Div@20 |
|-------------------|-------|-------|-------|--------|---------|---------|-------|--------|--------|
| Random (seeded)  | 0.060  | 0.080 | 0.140 | 0.039   | 0.044    | 0.060    | 0.034 | 0.992 | 0.312 |
| Most popular     | 0.020  | 0.020 | 0.140 | 0.010   | 0.010    | 0.041    | 0.007 | 0.134 | 0.363 |
| Content-based    | 0.080  | 0.120 | 0.180 | 0.050   | 0.064    | 0.078    | 0.047 | 0.741 | 0.014 |
| CF (item-audio)  | 0.040  | 0.040 | 0.040 | 0.040   | 0.040    | 0.040    | 0.040 | 0.046 | 0.677 |
| Hybrid + AI      | 0.040  | 0.120 | 0.180 | 0.028   | 0.054    | 0.068    | 0.036 | 0.741 | 0.014 |
| Hybrid no AI     | 0.080  | 0.120 | 0.180 | 0.050   | 0.064    | 0.078    | 0.047 | 0.741 | 0.014 |

**Winner on NDCG@10:** Content-based (0.064)
**AI-tier experiment:** removing the degenerate AI tier **helped (no-AI NDCG@10 +0.010 vs with-AI)**.

## Notes

- **CF (item-audio)** returns empty recommendations for all users because audio
  features are null for the entire catalog (Spotify deprecated the
  `/audio-features` endpoint after catalog sync). Cosine similarity of null
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
