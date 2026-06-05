"""
Build the game dataset (players.json) from cached Basketball-Reference tables.

Pipeline:
  1. Merge per_game + advanced (+ per_poss for 1974+) per season, per player-team.
  2. Compute per-season league baselines + robust z-score params (median/MAD).
  3. Normalize each player-season era-relative (per-100 basis, z-scores, rTS%).
  4. Estimate missing pre-1974 stats (STL/BLK/USG/BPM) shrunk toward priors.
  5. Precompute per-player model fields used by the TS scoring engine.
  6. Select each player's PEAK season within each (team, decade).
  7. Emit data/players.json.

Real data only — no mocks. See docs/SCORING.md for the model spec.
"""
from __future__ import annotations

import json
import math
import os
import statistics
from collections import defaultdict

import fetch

OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "players.json")

START, END = 1960, 2025
COMBINED_TEAMS = {"2TM", "3TM", "4TM", "5TM", "TOT"}

TEAM_NAMES = {
    "ATL": "Atlanta Hawks", "BAL": "Baltimore Bullets", "BOS": "Boston Celtics",
    "BRK": "Brooklyn Nets", "BUF": "Buffalo Braves", "CAP": "Capital Bullets",
    "CHA": "Charlotte Bobcats", "CHH": "Charlotte Hornets", "CHO": "Charlotte Hornets",
    "CHI": "Chicago Bulls", "CHP": "Chicago Packers", "CHZ": "Chicago Zephyrs",
    "CIN": "Cincinnati Royals", "CLE": "Cleveland Cavaliers", "DAL": "Dallas Mavericks",
    "DEN": "Denver Nuggets", "DET": "Detroit Pistons", "GSW": "Golden State Warriors",
    "HOU": "Houston Rockets", "IND": "Indiana Pacers", "KCK": "Kansas City Kings",
    "KCO": "Kansas City-Omaha Kings", "LAC": "Los Angeles Clippers",
    "LAL": "Los Angeles Lakers", "MEM": "Memphis Grizzlies", "MIA": "Miami Heat",
    "MIL": "Milwaukee Bucks", "MIN": "Minnesota Timberwolves", "MNL": "Minneapolis Lakers",
    "NJN": "New Jersey Nets", "NOH": "New Orleans Hornets", "NOJ": "New Orleans Jazz",
    "NOK": "New Orleans/Oklahoma City Hornets", "NOP": "New Orleans Pelicans",
    "NYK": "New York Knicks", "NYN": "New York Nets", "OKC": "Oklahoma City Thunder",
    "ORL": "Orlando Magic", "PHI": "Philadelphia 76ers", "PHO": "Phoenix Suns",
    "PHW": "Philadelphia Warriors", "POR": "Portland Trail Blazers",
    "SAC": "Sacramento Kings", "SAS": "San Antonio Spurs", "SDC": "San Diego Clippers",
    "SDR": "San Diego Rockets", "SEA": "Seattle SuperSonics",
    "SFW": "San Francisco Warriors", "STL": "St. Louis Hawks", "SYR": "Syracuse Nationals",
    "TOR": "Toronto Raptors", "UTA": "Utah Jazz", "VAN": "Vancouver Grizzlies",
    "WAS": "Washington Wizards", "WSB": "Washington Bullets",
}

# --- estimation priors (see docs/SCORING.md §6) ---
STEAL_PRIOR = {"PG": 0.45, "SG": 0.30, "SF": 0.10, "PF": -0.20, "C": -0.45}
BLOCK_PRIOR = {"PG": -0.85, "SG": -0.65, "SF": -0.25, "PF": 0.35, "C": 0.75}
DBPM_PRIOR = {"PG": -0.15, "SG": -0.10, "SF": 0.0, "PF": 0.10, "C": 0.20}

# Inclusion thresholds for a player's peak season to be draftable for a team+decade.
MIN_GAMES = 20
MIN_MPG = 12.0


def f(x):
    if x is None or x == "":
        return None
    try:
        return float(x)
    except ValueError:
        return None


def pct(x):
    """Parse a BBR percent string like '.701' -> 0.701."""
    return f(x)


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def decade_label(season: int) -> str:
    return f"{(season // 10) * 10}s"


def norm_pos(pos: str | None):
    if not pos:
        return "SF", []
    parts = pos.replace(" ", "").split("-")
    valid = [p for p in parts if p in ("PG", "SG", "SF", "PF", "C")]
    if not valid:
        return "SF", []
    return valid[0], valid[1:]


def robust_z(value, med, mad):
    if value is None or mad is None or mad == 0:
        return 0.0
    return clamp((value - med) / (1.4826 * mad), -3, 3)


def med_mad(vals):
    vals = [v for v in vals if v is not None]
    if len(vals) < 5:
        return (statistics.median(vals) if vals else 0.0, 1.0)
    m = statistics.median(vals)
    mad = statistics.median([abs(v - m) for v in vals])
    return m, (mad if mad > 0 else 1.0)


def merge_season(season: int):
    """Return list of merged player-team records for a season (no combined rows)."""
    pg = {(r["player_id"], r.get("team_name_abbr")): r
          for r in fetch.get_season_table(season, "per_game")}
    adv = {(r["player_id"], r.get("team_name_abbr")): r
           for r in fetch.get_season_table(season, "advanced")}
    pp = {(r["player_id"], r.get("team_name_abbr")): r
          for r in fetch.get_season_table(season, "per_poss")}

    out = []
    for key, p in pg.items():
        pid, team = key
        if not team or team in COMBINED_TEAMS:
            continue
        a = adv.get(key, {})
        q = pp.get(key, {})
        games = f(p.get("games")) or 0
        mpg = f(p.get("mp_per_g")) or 0.0
        primary, secondary = norm_pos(p.get("pos") or a.get("pos"))

        ppg = f(p.get("pts_per_g"))
        rpg = f(p.get("trb_per_g"))
        apg = f(p.get("ast_per_g"))
        spg = f(p.get("stl_per_g"))
        bpg = f(p.get("blk_per_g"))
        fg3a_pg = f(p.get("fg3a_per_g"))
        fg3_pg = f(p.get("fg3_per_g"))

        # per-100 basis: real per_poss when available, else per-game.
        has_poss = bool(q)
        pts100 = f(q.get("pts_per_poss")) if has_poss else ppg
        reb100 = f(q.get("trb_per_poss")) if has_poss else rpg
        ast100 = f(q.get("ast_per_poss")) if has_poss else apg
        stl100 = f(q.get("stl_per_poss")) if has_poss else spg
        blk100 = f(q.get("blk_per_poss")) if has_poss else bpg
        fg3a100 = f(q.get("fg3a_per_poss")) if has_poss else fg3a_pg

        rec = {
            "player_id": pid,
            "name": p.get("name_display") or a.get("name_display"),
            "team": team,
            "season": season,
            "decade": decade_label(season),
            "primary": primary,
            "secondary": secondary,
            "games": int(games),
            "mpg": mpg,
            "minutes": mpg * games,
            # display box score (per game) — "first up" in UI
            "ppg": ppg, "rpg": rpg, "apg": apg, "spg": spg, "bpg": bpg,
            "fg3a_pg": fg3a_pg, "fg3_pg": fg3_pg,
            # advanced (observed)
            "ts": pct(a.get("ts_pct")),
            "usg": f(a.get("usg_pct")),
            "bpm": f(a.get("bpm")),
            "obpm": f(a.get("obpm")),
            "dbpm": f(a.get("dbpm")),
            "per": f(a.get("per")),
            "fg3pct": pct(p.get("fg3_pct")),
            # per-100 basis (for modeling)
            "pts100": pts100, "reb100": reb100, "ast100": ast100,
            "stl100": stl100, "blk100": blk100, "fg3a100": fg3a100,
        }
        out.append(rec)
    return out


def season_baselines(recs):
    """Per-season league baselines + robust z params over qualified players."""
    qual = [r for r in recs if r["minutes"] >= 500 or r["games"] >= 40]
    if not qual:
        qual = recs

    def col(name):
        return [r[name] for r in qual]

    base = {}
    for c in ["pts100", "reb100", "ast100", "stl100", "blk100", "fg3a100"]:
        base[c] = med_mad(col(c))
    # rTS baseline: minutes-weighted league TS
    tsw = [(r["ts"], r["minutes"]) for r in qual if r["ts"] is not None]
    if tsw:
        tot = sum(w for _, w in tsw) or 1
        league_ts = sum(t * w for t, w in tsw) / tot
    else:
        league_ts = 0.5
    base["league_ts"] = league_ts
    # league true-shooting attempts per-100 basis (pts100 / (2*ts))
    tsa = []
    for r in qual:
        if r["pts100"] and r["ts"]:
            tsa.append(r["pts100"] / (2 * r["ts"]))
    base["league_tsa100"] = (statistics.median(tsa) if tsa else 1.0)
    # rTS distribution for z
    rts_vals = [100 * (r["ts"] - league_ts) for r in qual if r["ts"] is not None]
    base["rts"] = med_mad(rts_vals)
    # 3p% distribution (shooters only)
    fg3 = [r["fg3pct"] for r in qual
           if r["fg3pct"] is not None and (r["fg3a_pg"] or 0) >= 1.0]
    base["fg3pct"] = med_mad(fg3) if len(fg3) >= 5 else (0.33, 0.05)
    return base


def model_fields(r, base):
    """Compute era-relative z-scores, estimates, and impact fields for a player."""
    pos = r["primary"]
    reliability = clamp(r["minutes"] / 1500, 0.35, 1.0)

    def z(col):
        med, mad = base[col]
        return robust_z(r[col], med, mad)

    zPts = z("pts100") * reliability
    zReb = z("reb100") * reliability
    zAst = z("ast100") * reliability
    zStlObs = z("stl100") * reliability if r["stl100"] is not None else None
    zBlkObs = z("blk100") * reliability if r["blk100"] is not None else None

    # rTS + volume-adjusted shooting
    rts_pp = 100 * (r["ts"] - base["league_ts"]) if r["ts"] is not None else 0.0
    med, mad = base["rts"]
    zRTS = robust_z(rts_pp, med, mad) * reliability
    tsa100 = (r["pts100"] / (2 * r["ts"])) if (r["pts100"] and r["ts"]) else 0.0
    vol = clamp(tsa100 / base["league_tsa100"], 0.35, 1.35) if base["league_tsa100"] else 1.0
    effZ = zRTS * math.sqrt(vol)

    # 3pt z (post-1980 shooters)
    if r["season"] >= 1980 and (r["fg3a_pg"] or 0) >= 0.5:
        m3, d3 = base["fg3a100"]
        z3pa = robust_z(r["fg3a100"], m3, d3) * reliability
        mp3, dp3 = base["fg3pct"]
        z3pp = robust_z(r["fg3pct"], mp3, dp3) * reliability if r["fg3pct"] else 0.0
        has_three = True
    else:
        z3pa, z3pp, has_three = 0.0, 0.0, False

    # --- estimates for missing pre-1974 stats ---
    has_stl = r["stl100"] is not None
    has_blk = r["blk100"] is not None
    has_usg = r["usg"] is not None
    has_bpm = r["bpm"] is not None

    zStlEst = clamp(0.35 * zAst + 0.15 * zPts + STEAL_PRIOR[pos], -1.2, 1.8)
    zStlEff = zStlObs if has_stl else 0.55 * zStlEst
    zBlkEst = clamp(0.55 * zReb + BLOCK_PRIOR[pos], -1.2, 2.0)
    zBlkEff = zBlkObs if has_blk else 0.55 * zBlkEst

    # usage
    tsa_rel = (tsa100 / base["league_tsa100"]) if base["league_tsa100"] else 1.0
    usgEst = clamp(20 * (tsa_rel ** 0.90) + 0.6 * max(0, zAst), 10, 38)
    usgEff = r["usg"] if has_usg else 20 + 0.85 * (usgEst - 20)

    dbpmEst = clamp(0.65 * zReb + 0.45 * zStlEff + 0.60 * zBlkEff + DBPM_PRIOR[pos],
                    -3.5, 5.0)
    dbpmEff = r["dbpm"] if (has_bpm and r["dbpm"] is not None) else dbpmEst
    obpmEst = clamp(-0.20 + 1.15 * zPts + 0.85 * zAst + 1.10 * effZ
                    - 0.25 * max(0, usgEff - 28) * max(0, -rts_pp / 4), -5, 9)
    obpmEff = r["obpm"] if (has_bpm and r["obpm"] is not None) else obpmEst

    # box-score impact (visible, primary)
    boxOff = 1.45 * (0.70 * zPts + 0.55 * zAst + 0.75 * effZ)
    boxDef = 1.05 * (0.40 * zReb + 0.55 * zStlEff + 0.65 * zBlkEff)

    advConf = 1.0 if has_bpm else 0.60
    ADV_W = 0.65
    offNR = ADV_W * advConf * obpmEff + (1 - ADV_W * advConf) * boxOff
    defNR = ADV_W * advConf * dbpmEff + (1 - ADV_W * advConf) * boxDef
    playerBaseNR = offNR + defNR

    # fit helper scores
    if has_three:
        shooting = clamp(rts_pp / 6, -1.5, 1.5) + 0.35 * z3pa + 0.20 * z3pp
    else:
        shooting = clamp(rts_pp / 6, -1.5, 1.5)
    rimDef = 0.55 * zBlkEff + 0.35 * zReb + 0.35 * dbpmEff
    perimDef = 0.50 * zStlEff + 0.35 * dbpmEff

    return {
        "zPts": round(zPts, 3), "zReb": round(zReb, 3), "zAst": round(zAst, 3),
        "zStl": round(zStlEff, 3), "zBlk": round(zBlkEff, 3),
        "rtsPP": round(rts_pp, 2), "effZ": round(effZ, 3),
        "usgEff": round(usgEff, 2), "obpmEff": round(obpmEff, 2),
        "dbpmEff": round(dbpmEff, 2), "bpmEff": round(obpmEff + dbpmEff, 2),
        "playerBaseNR": round(playerBaseNR, 3),
        "boxOff": round(boxOff, 3), "boxDef": round(boxDef, 3),
        "shooting": round(shooting, 3),
        "rimDef": round(rimDef, 3), "perimDef": round(perimDef, 3),
        "hasObservedBPM": has_bpm, "hasObservedDef": has_stl and has_blk,
        "hasObservedUSG": has_usg, "hasThree": has_three,
    }


def main():
    all_recs = []
    for season in range(START, END + 1):
        recs = merge_season(season)
        base = season_baselines(recs)
        for r in recs:
            r["model"] = model_fields(r, base)
        all_recs.extend(recs)
        print(f"{season}: {len(recs)} player-team records")

    # peak season per (player, team, decade)
    groups = defaultdict(list)
    for r in all_recs:
        groups[(r["player_id"], r["team"], r["decade"])].append(r)

    players = []
    for key, recs in groups.items():
        elig = [r for r in recs if r["games"] >= 30] or recs
        peak = max(elig, key=lambda r: r["model"]["playerBaseNR"])
        if peak["games"] < MIN_GAMES or peak["mpg"] < MIN_MPG:
            continue
        players.append(peak)

    # assemble output
    teams_present = defaultdict(set)
    for p in players:
        teams_present[p["team"]].add(p["decade"])

    out = {
        "meta": {
            "source": "Basketball-Reference (real data)",
            "seasons": [START, END],
            "generated_categories": ["per_game", "advanced", "per_poss"],
            "player_count": len(players),
        },
        "decades": [f"{d}s" for d in range(1960, 2030, 10)],
        "teams": {abbr: {"name": TEAM_NAMES.get(abbr, abbr),
                         "decades": sorted(teams_present[abbr])}
                  for abbr in sorted(teams_present)},
        "players": [serialize(p) for p in players],
    }
    with open(OUT_PATH, "w", encoding="utf-8") as fp:
        json.dump(out, fp, separators=(",", ":"), ensure_ascii=False)
    size = os.path.getsize(OUT_PATH) / 1024
    print(f"\nWrote {len(players)} players to players.json ({size:.0f} KB)")
    print(f"Teams: {len(out['teams'])}")


def serialize(p):
    """Compact public player record."""
    rnd = lambda x: round(x, 1) if isinstance(x, float) else x
    return {
        "id": f"{p['player_id']}_{p['team']}_{p['decade']}",
        "pid": p["player_id"],
        "name": p["name"],
        "team": p["team"],
        "decade": p["decade"],
        "season": p["season"],
        "pos": p["primary"],
        "pos2": p["secondary"],
        "g": p["games"],
        "mpg": rnd(p["mpg"]),
        "box": {"pts": rnd(p["ppg"]), "reb": rnd(p["rpg"]), "ast": rnd(p["apg"]),
                "stl": rnd(p["spg"]), "blk": rnd(p["bpg"])},
        "adv": {"ts": round(p["ts"], 3) if p["ts"] is not None else None,
                "usg": p["usg"], "bpm": p["bpm"], "obpm": p["obpm"],
                "dbpm": p["dbpm"], "per": p["per"]},
        "m": p["model"],
    }


if __name__ == "__main__":
    main()
