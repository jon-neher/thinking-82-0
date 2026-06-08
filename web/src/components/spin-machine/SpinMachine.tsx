import type { Dataset, Roll } from "../../types";

interface SpinMachineProps {
  roll: Roll | null;
  spinning: boolean;
  displayTeam: string | null;
  displayDecade: string | null;
  teamSkips: number;
  decadeSkips: number;
  isComplete: boolean;
  dataset: Dataset;
  onSpin: () => void;
  onReRollTeam: () => void;
  onReRollDecade: () => void;
}

export function SpinMachine({
  roll,
  spinning,
  displayTeam,
  displayDecade,
  teamSkips,
  decadeSkips,
  isComplete,
  dataset,
  onSpin,
  onReRollTeam,
  onReRollDecade,
}: SpinMachineProps) {
  return (
    <section className="panel machine">
      <div className="spin-header">
        <h2 className="panel-title">Spin machine</h2>
        <div className="skip-controls">
          <button
            type="button"
            className="reroll-btn"
            disabled={!roll || spinning || teamSkips < 1}
            onClick={onReRollTeam}
          >
            Re-roll Team ({teamSkips})
          </button>
          <button
            type="button"
            className="reroll-btn"
            disabled={!roll || spinning || decadeSkips < 1}
            onClick={onReRollDecade}
          >
            Re-roll Era ({decadeSkips})
          </button>
        </div>
      </div>
      <div className="roll-machine">
        <div className="roll-cards">
          <article className={`roll-card team-card ${spinning ? "spinning" : ""}`}>
            <p>Team</p>
            <h3>{displayTeam ?? "\u2014"}</h3>
          </article>
          <article className={`roll-card era-card ${spinning ? "spinning" : ""}`}>
            <p>Era</p>
            <h3>{displayDecade ?? "\u2014"}</h3>
          </article>
        </div>
        <button
          type="button"
          className="spin-btn"
          disabled={Boolean(roll) || spinning || isComplete}
          onClick={onSpin}
        >
          {spinning ? "SPINNING..." : "SPIN"}
        </button>
        <p className="roll-subtext">
          {spinning
            ? "Spinning..."
            : roll
              ? dataset.teams[roll.team].name
              : isComplete
                ? "Roster complete"
                : "Hit spin to roll a team and era"}
        </p>
      </div>
    </section>
  );
}