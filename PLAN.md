# 82-0 Reimagined — Project Plan

An improved clone of the roster-building game at [82-0.com](https://www.82-0.com/),
built in this repo. Same addictive core loop, but with:

1. **A 6th-man draft slot** (6 players: PG, SG, SF, PF, C, + flex 6th man).
2. **Advanced-stat-aware scoring** that rewards *team fit*, not just stat-stuffers
   — using BPM/OBPM/DBPM, TS%, USG% — while keeping box-score stats primary/visible.
3. **A brighter, "The Ringer"–style design** that is at least as polished as the original.
4. **Real NBA statistics** (no mock data), sourced from Basketball-Reference and
   shipped as a generated static dataset.

---

## 1. How the original game works (reference)

- A **slot machine** spins a `(team, decade)` combination each round.
- The player drafts **one** real NBA player from that team+era to fill a roster slot.
  Once a slot is filled, it's locked (a later, better roll at the same slot is wasted).
- Original roster = **5 starters** (PG/SG/SF/PF/C). Constraint themes: one player per
  decade (1960s–2020s) and per franchise.
- **Scoring:** sums 5 box-score categories (PTS, REB, AST, STL, BLK) into a
  "Strength Rating", run through a **nonlinear win-projection curve** → simulated
  W–L record out of 82. Era adjustments are applied; missing old-era defensive
  stats are estimated.
- **Skips:** one team skip + one decade skip per game.
- **Modes:** Classic (stats visible) and HoopIQ (stats hidden).

---

## 2. Target design of our version

### Roster (6 slots)
`PG, SG, SF, PF, C, SIXTH (flex)`. The 6th man accepts any position and plays
fewer minutes in the simulation.

### Data reality (drives everything)
From Basketball-Reference per-season league tables:
- **TS%** computable for **all eras** (needs PTS/FGA/FTA).
- **BPM / OBPM / DBPM / USG% / STL / BLK** only exist from the **1973–74 season**
  onward (no turnover/steal/block tracking before then).
- The dedicated **per-100-possessions table (`per_poss`, with ORtg/DRtg)** exists
  from **1974** onward; pre-1974 we derive per-100 from per-game via league pace.
- 1960s seasons effectively have only **PTS / REB / AST + TS%**.

→ The model must **estimate missing advanced/defensive stats** for pre-1974 players
(shrunk toward priors, not zero) and **normalize everything era-relative**.

### Scoring model (summary — full spec in `docs/SCORING.md`)
Per-100-possession, era-relative **net-rating** model:
1. Normalize each player-season to **per-100** (real `per_poss` for 1974+, pace-derived
   otherwise), then to **season-relative robust z-scores**.
2. **Box-score impact** (primary, visible) + **BPM/OBPM/DBPM blend** (with lower
   confidence weight when estimated) → `playerBaseNR`.
3. Aggregate the 6 players by **fixed slot minutes** (starters 34, 6th man 26) into a
   base team net rating.
4. **Capped fit adjustments:**
   - **Usage fit** — finite-possession penalty (rank-based usage caps), rewards
     balance & off-ball efficiency, punishes 4th/5th/6th high-usage players.
   - **Spacing/shooting fit** — rTS% + 3PT (pre-1980 judged on TS portability only).
   - **Defensive fit** — rim protection (C/PF + blocks/rebounds) + perimeter (steals).
   - **Position fit** — penalty for playing a player out of position (6th man is flex).
5. Map final team net rating → wins: `winPct = 1 / (1 + exp(-netRating / 7.5))`,
   `wins = round(82 * winPct)`. (0 NR → 41 W; +10 → ~65 W; +15 → ~72 W.)

Box score stays "first up" in UI; advanced stats are secondary/expandable but
meaningfully shape the record.

### Visual / UX
- Bright, editorial **Ringer-style** palette (off-white canvas, bold accent color,
  strong type, generous spacing), not the dark casino look of the original.
- Slot-machine spin animation, draft board with 6 slots, player cards showing box
  score first + an "advanced" toggle, animated final-record reveal with a breakdown
  (offense / defense / fit), Classic & HoopIQ modes, team/decade skips, shareable result.

---

## 3. Architecture

```
data/
  pipeline/            Python scraper + dataset builder (BBR)
  raw/                 cached raw HTML/CSV per season (gitignored)
  players.json         generated dataset consumed by the app (committed)
docs/
  SCORING.md           full scoring spec & constants
web/                   Vite + React + TS + Tailwind app
  src/lib/scoring.ts   scoring engine (mirrors SCORING.md)
  src/data/            loads players.json
PLAN.md
```

- **Data pipeline:** Python 3, polite scraping of BBR league tables
  (`per_game`, `advanced`, and `per_poss` for 1974+) for seasons ~1960–2025,
  ~3.5s rate limiting, raw HTML cached to disk. Merges tables, handles multi-team
  (TOT) rows, computes per-season league averages + robust z-score params, estimates
  missing pre-1974 stats, selects each player's **peak season within each
  (team, decade)**, and emits a compact `players.json`.
- **Frontend:** Vite + React + TypeScript + Tailwind. Fully client-side; loads the
  static dataset. Scoring engine in TS, validated against a Python reference.
- **Stack rationale:** static + client-side → trivial to run/deploy; real data baked
  in at build time so the app never depends on a live scrape.

---

## 4. Task breakdown (iterative, commit after each)

- [ ] **T0** Repo scaffolding: `.gitignore`, this plan, `docs/SCORING.md`. *(commit)*
- [ ] **T1** Data pipeline — scraper for BBR per_game/advanced/per_poss with caching
  + rate limiting; smoke-test on 2–3 seasons. *(commit)*
- [ ] **T2** Dataset builder — merge tables, league averages, z-score params,
  pre-1974 estimation, per-100 normalization, peak-season-per-(team,decade) selection
  → `players.json`. Run full range. *(commit)*
- [ ] **T3** Frontend scaffold (Vite+React+TS+Tailwind) + Ringer-style design system
  (palette, type, tokens). *(commit)*
- [ ] **T4** Scoring engine in TS (`scoring.ts`) per `docs/SCORING.md` + unit tests.
  *(commit)*
- [ ] **T5** Core game loop: slot machine spin, draft 6 slots, skips, player selection.
  *(commit)*
- [ ] **T6** Player cards (box score first, advanced toggle) + draft board UI. *(commit)*
- [ ] **T7** Final simulation reveal: animated W–L + offense/defense/fit breakdown +
  share. *(commit)*
- [ ] **T8** Game modes (Classic / HoopIQ), how-to-play, polish, responsive. *(commit)*
- [ ] **T9** Verification pass: build, lint, sanity-check records for known rosters;
  README with run instructions. *(commit)*

---

## 5. Open decisions / notes
- Season range: BBR `NBA_1960` = 1959–60. Fetch **1960–2025**. Decades 1960s–2020s.
- Respect BBR rate limits (≤20 req/min). Cache raw to avoid re-fetching.
- Peak-season selection metric: composite of minutes-weighted impact (tunable).
- Keep fit adjustments **capped** so BPM + box score drive most of the rating.
- Calibration check: known elite teams should land in believable win ranges.
