import type { TeamScore } from "../../types";

interface ResultsModalProps {
  teamScore: TeamScore;
  fitTotal: number;
  onClose: () => void;
  onShare: () => void;
  onViewCourt: () => void;
}

export function ResultsModal({ teamScore, fitTotal, onClose, onShare, onViewCourt }: ResultsModalProps) {
  return (
    <div className="results-overlay">
      <section className="panel results-modal">
        <button
          type="button"
          className="close-overlay"
          onClick={onClose}
          aria-label="Close results"
        >
          ×
        </button>
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
            <p>{fitTotal.toFixed(1)}</p>
          </div>
        </div>
        <div className="result-actions">
          <button type="button" className="share-btn" onClick={onShare}>
            Copy result
          </button>
          <button type="button" className="ghost-btn" onClick={onViewCourt}>
            View Court
          </button>
        </div>
      </section>
    </div>
  );
}