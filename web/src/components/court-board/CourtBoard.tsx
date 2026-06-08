import type { PlayerSeason, DraftSlot } from "../../types";
import { SLOTS, SLOT_LABELS, initials, positionsSummary } from "../../lib/utils";

interface CourtBoardProps {
  roster: Record<DraftSlot, PlayerSeason | undefined>;
  selectedPlayer: PlayerSeason | null;
  selectedSlots: DraftSlot[];
  onSlotClick: (slot: DraftSlot) => void;
}

export function CourtBoard({
  roster,
  selectedPlayer,
  selectedSlots,
  onSlotClick,
}: CourtBoardProps) {
  return (
    <section className="panel court-panel">
      <h2 className="panel-title">Court board</h2>
      <div className="court">
        <div className="lane" />
        <div className="rim" />
        {SLOTS.map((slot) => {
          const player = roster[slot];
          const isPlaceable = selectedSlots.includes(slot);
          return (
            <button
              key={slot}
              type="button"
              className={`court-slot slot-${slot.toLowerCase()} ${player ? "filled" : ""} ${isPlaceable ? "placeable" : ""} ${player?.id === selectedPlayer?.id ? "selected" : ""}`}
              disabled={!isPlaceable && !player}
              onClick={() => onSlotClick(slot)}
            >
              <span className="slot-code">{slot === "SIXTH" ? "6TH" : slot}</span>
              {player ? (
                <>
                  <strong>{initials(player.name)}</strong>
                  <small>{player.name}</small>
                </>
              ) : (
                <small>{SLOT_LABELS[slot]}</small>
              )}
            </button>
          );
        })}
      </div>
      <p className={`court-hint ${selectedPlayer ? "active" : ""}`}>
        {selectedPlayer
          ? `Placing ${selectedPlayer.name} — click a highlighted position to assign or swap.`
          : "Select a player from the list or click a filled court slot to reposition."}
      </p>

      <ul className="board-list">
        {SLOTS.map((slot) => {
          const player = roster[slot];
          return (
            <li key={slot}>
              <span>{slot === "SIXTH" ? "6th" : slot}</span>
              {player ? (
                <span>
                  {player.name} ({positionsSummary(player)})
                </span>
              ) : (
                <span>Open</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="constraint-note">
        Constraints: one player per team and decade. Open slots: {selectedSlots.length === 0 && !selectedPlayer ? "none" : (Object.entries(roster).filter(([, v]) => v).map(([k]) => k).join(", ") || "none")}.
      </p>
    </section>
  );
}