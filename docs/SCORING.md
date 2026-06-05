# Scoring Model Specification

A deterministic **per-100-possession, era-relative net-rating** roster evaluator.
It blends visible box-score impact with advanced stats (BPM/OBPM/DBPM, TS%, USG%),
applies capped team-fit adjustments, and maps a final team net rating to a
projected 82-game record.

> Design principle: **box score is "first up"** (recognizable, drives the visible
> player rating), but advanced stats + fit meaningfully shape the final record.
> Fit adjustments are **capped** so player quality (BPM + box) dominates.

---

## 0. Data reality & era handling

| Stat | Availability | Pre-1974 handling |
|---|---|---|
| PTS / REB / AST | all eras | use directly (per-100, era-normalized) |
| TS% | all eras | use directly; rTS% vs season league avg |
| STL / BLK | 1973–74+ | **estimate** from position priors + correlated stats |
| USG% | 1973–74+ | **estimate** from shooting load (TSA) + assists |
| OBPM / DBPM / BPM | 1973–74+ | **estimate** from box profile; lower confidence |
| per-100 table (ORtg/DRtg) | 1974+ | derive per-100 from per-game via league pace |

Estimated values are **shrunk toward league-average priors**, never set to zero,
and carry a lower confidence weight in the blend.

---

## 1. Per-100 normalization & z-scores (Python pipeline)

For each player-season, compute per-100-possession box stats. For 1974+ use the real
`per_poss` table. For older seasons derive:

```
stat100 = statPerGame / mpg * leaguePace        # leaguePace ≈ poss/48min
```

For each season, among **qualified** players (`MP >= 500` or `G >= 40`), compute robust
z-scores using median + MAD:

```
z = clamp((value - seasonMedian) / (1.4826 * seasonMAD), -3, 3)
```

Precompute per player-season: `zPts100, zReb100, zAst100, zStl100, zBlk100, zRTS,
z3pa100, z3pPct`.

True shooting (all eras):
```
rTS_pp = 100 * (playerTS - leagueTS)            # percentage points vs era
```

Volume-adjusted shooting (don't overvalue low-volume efficiency):
```
tsa100 = pts100 / (2 * ts)
effZ   = zRTS * sqrt(clamp(tsa100 / leagueTsa100, 0.35, 1.35))
```

Low-minute reliability shrink:
```
reliability = clamp(minutes / 1500, 0.35, 1.0)
zEffective  = reliability * z          # applied to z-scores used downstream
```

---

## 2. Player impact

### Box-score impact (primary, visible)
```
boxOffNR = 1.45 * (0.70*zPts100 + 0.55*zAst100 + 0.75*effZ)
boxDefNR = 1.05 * (0.40*zReb100 + 0.55*zStlEff + 0.65*zBlkEff)
boxNR    = boxOffNR + boxDefNR
```

### Advanced blend
```
advOff = obpm ?? obpmEstimated
advDef = dbpm ?? dbpmEstimated

advConfidence = hasObservedBPM ? 1.0 : 0.60
ADV_WEIGHT    = 0.65

offNR = ADV_WEIGHT*advConfidence*advOff + (1 - ADV_WEIGHT*advConfidence)*boxOffNR
defNR = ADV_WEIGHT*advConfidence*advDef + (1 - ADV_WEIGHT*advConfidence)*boxDefNR

playerBaseNR = offNR + defNR
```

---

## 3. Roster aggregation (6 players)

```
SLOT_MINUTES = { PG:34, SG:34, SF:34, PF:34, C:34, SIXTH:26 }
TOTAL_TEAM_MINUTES = 240
BENCH_MINUTES      = 240 - sum(SLOT_MINUTES) = 44
BENCH_NET_RATING   = -1.0
CORE_SCALE         = 1.15

coreNR = CORE_SCALE * Σ ( slotMinutes/TOTAL_TEAM_MINUTES * playerBaseNR )
benchNR = BENCH_MINUTES/TOTAL_TEAM_MINUTES * BENCH_NET_RATING
baseTeamNR = coreNR + benchNR
```

Core minutes total = 5*34 + 26 = 196 (used as denominator in fit weights below).

---

## 4. Fit adjustments (capped)

### 4a. Usage fit
Use observed USG% or estimate:
```
tsa100   = pts100 / (2 * ts)
tsaRel   = tsa100 / leagueTsa100
usgEst   = clamp(20 * tsaRel^0.90 + 0.6*max(0, zAst100), 10, 38)
usgEff   = hasObservedUSG ? usg : 20 + 0.85*(usgEst - 20)
```

Rank players by usgEff desc. Rank caps `[33,28,24,21,19,18]`:
```
rankPenalty = 0.06 * Σ_rank ( (slotMinutes/196) * max(0, usgEff - cap[rank])^2 )
avgUsg      = Σ (slotMinutes * usgEff) / 196
avgOverload = 0.08 * max(0, avgUsg - 23.5)^2
shortage    = 0.10*max(0,26 - top1Usg)^2 + 0.04*max(0,50 - top1Usg - top2Usg)^2
            + 0.15*max(0,18 - avgUsg)^2
offBallBonus = 0.12 * Σ ( (slotMinutes/196) * max(0,22 - usgEff) * max(0, rTS_pp) )

usageFitNR = clamp(offBallBonus - rankPenalty - avgOverload - shortage, -6, 2)
```

### 4b. Spacing / shooting fit
```
shootingScore = (1980+ w/ 3PT): clamp(rTS_pp/6,-1.5,1.5) + 0.35*z3pa100 + 0.20*z3pPct
                (pre-1980):       clamp(rTS_pp/6,-1.5,1.5)
teamAvgShooting = minutes-weighted mean(shootingScore)
top3Shooting    = mean(top 3 shootingScore)
spacingFitNR = clamp(1.20*(top3Shooting - 0.40) + 0.60*(teamAvgShooting - 0.10), -3, 3)
```

### 4c. Defensive fit
```
rimDefenseScore       = 0.55*zBlkEff + 0.35*zReb100 + 0.35*dbpmEff
perimeterDefenseScore = 0.50*zStlEff + 0.35*dbpmEff

rimProtection   = 0.55*C.rim + 0.25*PF.rim + 0.20*bestOtherBig.rim
perimeterDef    = mean(PG.perim, SG.perim, SF.perim)
defenseFitNR = clamp(0.45*rimProtection + 0.35*perimeterDef
              - 1.00*max(0,0.30 - rimProtection) - 0.70*max(0,0.20 - perimeterDef), -3, 3)
```

### 4d. Position fit
```
posIndex: PG=0, SG=1, SF=2, PF=3, C=4
slotPenalty(player, slot):
  SIXTH                       -> 0
  primary == slot             -> 0
  slot in secondary           -> 0.4
  |posIndex diff| == 1        -> 1.2
  |posIndex diff| == 2        -> 2.5
  else                        -> 4.0
positionFitNR = - Σ ( (slotMinutes/34) * slotPenalty )
```

---

## 5. Final team net rating → record

```
rawTeamNR  = baseTeamNR + usageFitNR + spacingFitNR + defenseFitNR + positionFitNR
teamNetRating = clamp(rawTeamNR, -25, 25)

winPct = 1 / (1 + exp(-teamNetRating / 7.5))
wins   = round(82 * winPct)
losses = 82 - wins
```

Calibration anchors: NR 0 → 41 W, +5 → ~54 W, +10 → ~65 W, +15 → ~72 W, −10 → ~17 W.

---

## 6. Pre-1974 estimation priors

```
stealPrior  = { PG:0.45, SG:0.30, SF:0.10, PF:-0.20, C:-0.45 }
blockPrior  = { PG:-0.85, SG:-0.65, SF:-0.25, PF:0.35, C:0.75 }
dbpmPrior   = { PG:-0.15, SG:-0.10, SF:0.0, PF:0.10, C:0.20 }

zStlEst = clamp(0.35*zAst100 + 0.15*zPts100 + stealPrior[pos], -1.2, 1.8)
zStlEff = hasObservedStl ? zStl100 : 0.55*zStlEst

zBlkEst = clamp(0.55*zReb100 + blockPrior[pos], -1.2, 2.0)
zBlkEff = hasObservedBlk ? zBlk100 : 0.55*zBlkEst

dbpmEst = clamp(0.65*zReb100 + 0.45*zStlEff + 0.60*zBlkEff + dbpmPrior[pos], -3.5, 5.0)
dbpmEff = hasObservedBPM ? dbpm : dbpmEst

obpmEst = clamp(-0.20 + 1.15*zPts100 + 0.85*zAst100 + 1.10*effZ
              - 0.25*max(0,usgEff-28)*max(0,-rTS_pp/4), -5, 9)
bpmEst  = clamp(obpmEst + dbpmEst, -7, 12)
```

---

## 7. Component caps (guardrails)
| Component | Range |
|---|---|
| usageFitNR | −6 .. +2 |
| spacingFitNR | −3 .. +3 |
| defenseFitNR | −3 .. +3 |
| positionFitNR | typically 0 .. −6 |
| teamNetRating | −25 .. +25 |

Credit: model designed with the Oracle advisor; per-100 normalization emphasis per user.
