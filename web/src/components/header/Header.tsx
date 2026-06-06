import type { Mode } from "../../types";
import { SLOTS } from "../../lib/utils";

interface HeaderProps {
  roundNumber: number;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onNewGame: () => void;
}

export function Header({ roundNumber, mode, onModeChange, onNewGame }: HeaderProps) {
  return (
    <header className="hero">
      <div>
        <p className="kicker">Round {roundNumber}/{SLOTS.length}</p>
        <h1>82-0 Reimagined</h1>
        <p className="hero-copy">
          Draft <strong>PG/SG/SF/PF/C + 6th man</strong>. Team and decade are random each round.
        </p>
      </div>
      <div className="toolbar">
        <div className="mode-toggle">
          <button
            type="button"
            className={mode === "classic" ? "active" : ""}
            onClick={() => onModeChange("classic")}
          >
            Classic
          </button>
          <button
            type="button"
            className={mode === "hoopiq" ? "active" : ""}
            onClick={() => onModeChange("hoopiq")}
          >
            HoopIQ
          </button>
        </div>
        <button type="button" className="ghost-btn" onClick={onNewGame}>
          New game
        </button>
      </div>
    </header>
  );
}