import { useMemo, useState } from "react";
import { getDataset, getPlayersForTeamDecade } from "./data/dataset";
import { evaluateRoster } from "./lib/scoring";
import type { DraftSlot, Mode, PlayerSeason, SlotAssignment } from "./types";

interface Roll {
  team: string;
  decade: string;
  candidates: PlayerSeason[];
}

const SLOTS: DraftSlot[] = ["PG", "SG", "SF", "PF", "C", "SIXTH"];
const SLOT_LABELS: Record<DraftSlot, string> = {
  PG: "Point Guard",
  SG: "Shooting Guard",
  SF: "Small Forward",
  PF: "Power Forward",
  C: "Center",
  SIXTH: "6th Man",
};

const EMPTY_ROSTER: Record<DraftSlot, PlayerSeason | undefined> = {
  PG: undefined,
  SG: undefined,
  SF: undefined,
  PF: undefined,
  C: undefined,
  SIXTH: undefined,
};

function positionsFor(player: PlayerSeason): Set<string> {
  return new Set([player.pos, ...player.pos2.split(",")].map((value) => value.trim()).filter(Boolean));
}

function canPlaySlot(player: PlayerSeason, slot: DraftSlot): boolean {
  if (slot === "SIXTH") {
    return true;
  }
  return positionsFor(player).has(slot);
}

function stat(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(digits);
}

export default function App() {
  const dataset = useMemo(() => getDataset(), []);
  const teams = useMemo(() => Object.keys(dataset.teams).sort(), [dataset.teams]);
  const decades = dataset.decades;

  const [mode, setMode] = useState<Mode>("classic");
  const [roster, setRoster] = useState<Record<DraftSlot, PlayerSeason | undefined>>(EMPTY_ROSTER);
  const [roll, setRoll] = useState<Roll | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [teamSkips, setTeamSkips] = useState(1);
  const [decadeSkips, setDecadeSkips] = useState(1);
  const draftedPlayers = useMemo(
    () => Object.values(roster).filter((player): player is PlayerSeason => Boolean(player)),
    [roster],
  );

  const usedTeams = useMemo(
    () => new Set(draftedPlayers.map((player) => player.team)),
    [draftedPlayers],
  );
  const usedDecades = useMemo(
    () => new Set(draftedPlayers.map((player) => player.decade)),
    [draftedPlayers],
  );
  const openSlots = useMemo(() => SLOTS.filter((slot) => !roster[slot]), [roster]);
  const isComplete = openSlots.length === 0;

  const assignments = useMemo<SlotAssignment[]>(
    () =>
      SLOTS.map((slot) => ({ slot, player: roster[slot] }))
        .filter((entry): entry is SlotAssignment => Boolean(entry.player)),
    [roster],
  );

  const teamScore = useMemo(
    () => (isComplete ? evaluateRoster(assignments) : null),
    [assignments, isComplete],
  );

  function eligibleSlots(player: PlayerSeason): DraftSlot[] {
    return openSlots.filter((slot) => canPlaySlot(player, slot));
  }

  function buildRollCandidates(nextTeam: string, nextDecade: string): PlayerSeason[] {
    return getPlayersForTeamDecade(nextTeam, nextDecade)
      .filter((player) => eligibleSlots(player).length > 0)
      .slice(0, 18);
  }

  function rollPool(options?: {
    team?: string;
    decade?: string;
    excludeTeam?: string;
    excludeDecade?: string;
  }): Array<{ team: string; decade: string; candidates: PlayerSeason[] }> {
    const teamPool = options?.team
      ? [options.team]
      : teams.filter((team) => !usedTeams.has(team) && team !== options?.excludeTeam);
    const decadePool = options?.decade
      ? [options.decade]
      : decades.filter((decade) => !usedDecades.has(decade) && decade !== options?.excludeDecade);
    const pools: Array<{ team: string; decade: string; candidates: PlayerSeason[] }> = [];
    for (const team of teamPool) {
      for (const decade of decadePool) {
        if (team === options?.excludeTeam || decade === options?.excludeDecade) {
          continue;
        }
        const candidates = buildRollCandidates(team, decade);
        if (candidates.length) {
          pools.push({ team, decade, candidates });
        }
      }
    }
    return pools;
  }

  function spin(options?: { team?: string; decade?: string; excludeTeam?: string; excludeDecade?: string }) {
    if (isComplete) {
      return;
    }
    const pool = rollPool(options);
    if (!pool.length) {
      setRoll(null);
      return;
    }
    setSpinning(true);
    setRoll(null);
    const selected = pool[Math.floor(Math.random() * pool.length)];
    window.setTimeout(() => {
      setRoll(selected);
      setSpinning(false);
    }, 550);
  }

  function draftPlayer(player: PlayerSeason, slot: DraftSlot) {
    if (!roll || !openSlots.includes(slot) || !canPlaySlot(player, slot)) {
      return;
    }
    setRoster((previous) => ({ ...previous, [slot]: player }));
    setRoll(null);
  }

  function resetGame() {
    setRoster(EMPTY_ROSTER);
    setRoll(null);
    setTeamSkips(1);
    setDecadeSkips(1);
    setSpinning(false);
  }

  async function shareResult() {
    if (!teamScore) {
      return;
    }
    const text = `82-0 Reimagined: ${teamScore.wins}-${teamScore.losses} (${teamScore.teamNetRating.toFixed(1)} NR)`;
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="kicker">Bright-mode basketball draft simulator</p>
        <h1>82-0 Reimagined</h1>
        <p>
          Draft <strong>PG/SG/SF/PF/C + 6th man</strong> from random team+decade rolls using real data.
          Box score comes first; advanced impact and fit decide your final record.
        </p>
        <div className="toolbar">
          <div className="mode-toggle">
            <button
              type="button"
              className={mode === "classic" ? "active" : ""}
              onClick={() => setMode("classic")}
            >
              Classic
            </button>
            <button
              type="button"
              className={mode === "hoopiq" ? "active" : ""}
              onClick={() => setMode("hoopiq")}
            >
              HoopIQ
            </button>
          </div>
          <button type="button" onClick={() => setShowAdvanced((value) => !value)}>
            {showAdvanced ? "Hide advanced" : "Show advanced"}
          </button>
          <button type="button" onClick={resetGame}>
            New game
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="panel machine">
          <h2>Spin machine</h2>
          <div className={`roll-view ${spinning ? "spinning" : ""}`}>
            {spinning ? (
              <span>Spinning…</span>
            ) : roll ? (
              <span>
                <strong>{dataset.teams[roll.team].name}</strong> • {roll.decade}
              </span>
            ) : (
              <span>{isComplete ? "Roster complete" : "No active roll"}</span>
            )}
          </div>
          <div className="controls">
            <button type="button" disabled={Boolean(roll) || spinning || isComplete} onClick={() => spin()}>
              Spin
            </button>
            <button
              type="button"
              disabled={!roll || spinning || teamSkips < 1}
              onClick={() => {
                if (!roll) {
                  return;
                }
                setTeamSkips((value) => value - 1);
                spin({ decade: roll.decade, excludeTeam: roll.team });
              }}
            >
              Skip team ({teamSkips})
            </button>
            <button
              type="button"
              disabled={!roll || spinning || decadeSkips < 1}
              onClick={() => {
                if (!roll) {
                  return;
                }
                setDecadeSkips((value) => value - 1);
                spin({ team: roll.team, excludeDecade: roll.decade });
              }}
            >
              Skip decade ({decadeSkips})
            </button>
          </div>

          <h3>Available players</h3>
          {roll ? (
            <ul className="candidate-list">
              {roll.candidates.map((player) => {
                const slots = eligibleSlots(player);
                return (
                  <li key={player.id} className="card">
                    <div className="card-head">
                      <div>
                        <strong>{player.name}</strong>
                        <p>
                          {player.season} • {player.pos}
                        </p>
                      </div>
                      {mode === "classic" ? (
                        <span className="rating">{player.m.playerBaseNR.toFixed(1)} NR</span>
                      ) : (
                        <span className="rating">Hidden</span>
                      )}
                    </div>
                    <div className="stats-row">
                      {mode === "classic" ? (
                        <>
                          <span>PTS {stat(player.box.pts)}</span>
                          <span>REB {stat(player.box.reb)}</span>
                          <span>AST {stat(player.box.ast)}</span>
                          <span>STL {stat(player.box.stl)}</span>
                          <span>BLK {stat(player.box.blk)}</span>
                        </>
                      ) : (
                        <span>Stats hidden in HoopIQ mode</span>
                      )}
                    </div>
                    {showAdvanced && mode === "classic" ? (
                      <div className="advanced-row">
                        <span>TS% {stat(player.adv.ts * 100, 1)}</span>
                        <span>USG {stat(player.m.usgEff, 1)}</span>
                        <span>BPM {stat(player.m.bpmEff, 1)}</span>
                        <span>OBPM {stat(player.m.obpmEff, 1)}</span>
                        <span>DBPM {stat(player.m.dbpmEff, 1)}</span>
                      </div>
                    ) : null}
                    <div className="slot-buttons">
                      {slots.map((slot) => (
                        <button key={`${player.id}-${slot}`} type="button" onClick={() => draftPlayer(player, slot)}>
                          Draft {slot}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty-text">Spin to reveal candidates.</p>
          )}
        </section>

        <section className="panel">
          <h2>Draft board</h2>
          <ul className="board">
            {SLOTS.map((slot) => {
              const player = roster[slot];
              return (
                <li key={slot} className="slot-card">
                  <div className="slot-title">{SLOT_LABELS[slot]}</div>
                  {player ? (
                    <div>
                      <strong>{player.name}</strong>
                      <p>
                        {dataset.teams[player.team].name} • {player.decade}
                      </p>
                      <p>
                        {player.season} • {player.pos}
                      </p>
                      {mode === "classic" ? (
                        <p>
                          PTS {stat(player.box.pts)} / REB {stat(player.box.reb)} / AST {stat(player.box.ast)}
                        </p>
                      ) : (
                        <p>Stats hidden</p>
                      )}
                    </div>
                  ) : (
                    <p className="empty-text">Open slot</p>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="constraint-note">
            Constraints: one player per team and decade. Open slots: {openSlots.join(", ") || "none"}.
          </p>
        </section>
      </main>

      {teamScore ? (
        <section className="panel reveal">
          <h2>Final record</h2>
          <div className="record">
            <span>{teamScore.wins}</span>
            <small>-</small>
            <span>{teamScore.losses}</span>
          </div>
          <p className="net">Net Rating: {teamScore.teamNetRating.toFixed(1)}</p>
          <div className="breakdown">
            <div>
              <h3>Offense</h3>
              <p>{teamScore.offenseNR.toFixed(1)}</p>
            </div>
            <div>
              <h3>Defense</h3>
              <p>{teamScore.defenseNR.toFixed(1)}</p>
            </div>
            <div>
              <h3>Fit</h3>
              <p>
                {(teamScore.usageFitNR + teamScore.spacingFitNR + teamScore.defenseFitNR + teamScore.positionFitNR).toFixed(1)}
              </p>
            </div>
          </div>
          <button type="button" onClick={shareResult}>
            Copy result
          </button>
        </section>
      ) : null}
    </div>
  );
}
