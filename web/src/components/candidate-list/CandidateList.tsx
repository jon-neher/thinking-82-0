import { useState } from "react";
import type { PlayerSeason, Mode, SortKey, SortDirection, Roll } from "../../types";
import { stat, seasonSummary, positionsSummary, canPlaySlot, type PositionFilter } from "../../lib/utils";

interface CandidateListProps {
  roll: Roll | null;
  mode: Mode;
  positionFilter: PositionFilter;
  setPositionFilter: (filter: PositionFilter) => void;
  search: string;
  setSearch: (search: string) => void;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSortChange: (key: SortKey) => void;
  sortedCandidates: PlayerSeason[];
  openSlots: string[];
  selectedPlayer: PlayerSeason | null;
  setSelectedPlayerId: (id: string | null) => void;
}

const POSITION_FILTERS = ["ALL", "PG", "SG", "SF", "PF", "C"] as const;

export function CandidateList({
  roll,
  mode,
  positionFilter,
  setPositionFilter,
  search,
  setSearch,
  sortKey,
  sortDirection,
  onSortChange,
  sortedCandidates,
  openSlots,
  selectedPlayer,
  setSelectedPlayerId,
}: CandidateListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (playerId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const sortLabel = (key: SortKey, label: string): string => {
    if (sortKey !== key) {
      return label;
    }
    return `${label} ${sortDirection === "asc" ? "\u2191" : "\u2193"}`;
  };

  if (!roll) {
    return (
      <section className="panel candidates-panel">
        <h2 className="panel-title">Available players</h2>
        <p className="empty-text">Spin the machine to reveal eligible players.</p>
      </section>
    );
  }

  return (
    <section className="panel candidates-panel">
      <h2 className="panel-title">Available players</h2>
      <div className="candidate-controls">
        <div className="position-pills">
          {POSITION_FILTERS.map((position) => (
            <button
              key={position}
              type="button"
              className={positionFilter === position ? "active" : ""}
              onClick={() => setPositionFilter(position)}
            >
              {position}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search player or season"
        />
      </div>

      <div className="candidate-header-row">
        <button type="button" onClick={() => onSortChange("name")}>
          {sortLabel("name", "Player")}
        </button>
        <button type="button" onClick={() => onSortChange("pts")}>
          {sortLabel("pts", "PTS")}
        </button>
        <button type="button" onClick={() => onSortChange("reb")}>
          {sortLabel("reb", "REB")}
        </button>
        <button type="button" onClick={() => onSortChange("ast")}>
          {sortLabel("ast", "AST")}
        </button>
        <button type="button" onClick={() => onSortChange("stl")}>
          {sortLabel("stl", "STL")}
        </button>
        <button type="button" onClick={() => onSortChange("blk")}>
          {sortLabel("blk", "BLK")}
        </button>
        <span>{mode === "classic" ? "" : "IQ"}</span>
      </div>

      <ul className="candidate-list">
        {sortedCandidates.map((player) => {
          const isSelected = selectedPlayer?.id === player.id;
          const hasOpenCompatibleSlot = openSlots.some((slot) => canPlaySlot(player, slot as any));
          const isExpanded = expandedIds.has(player.id) && mode === "classic";
          return (
            <li key={player.id} className="candidate-item">
              <button
                type="button"
                className={`candidate-row ${isSelected ? "selected" : ""} ${hasOpenCompatibleSlot ? "" : "no-open-slot"}`}
                onClick={() => {
                  setSelectedPlayerId(player.id);
                  if (mode === "classic") {
                    toggleExpanded(player.id);
                  }
                }}
              >
                <span className="candidate-player">
                  <strong>{player.name}</strong>
                  <small>
                    {positionsSummary(player)} • {seasonSummary(player)}
                  </small>
                  {!hasOpenCompatibleSlot ? <small>No open slot right now</small> : null}
                </span>
                {mode === "classic" ? (
                  <>
                    <span>{stat(player.box.pts)}</span>
                    <span>{stat(player.box.reb)}</span>
                    <span>{stat(player.box.ast)}</span>
                    <span>{stat(player.box.stl)}</span>
                    <span>{stat(player.box.blk)}</span>
                    <span />
                  </>
                ) : (
                  <>
                    <span>?</span>
                    <span>?</span>
                    <span>?</span>
                    <span>?</span>
                    <span>?</span>
                    <span>Hidden</span>
                  </>
                )}
              </button>
              <div
                className={`candidate-advanced-wrapper ${isSelected && mode === "classic" ? "expanded" : ""}`}
                style={{
                  gridTemplateRows: isExpanded ? "1fr" : "0fr",
                  maxHeight: isExpanded ? "500px" : "0",
                  opacity: isExpanded ? 1 : 0,
                  transition: "grid-template-rows 0.3s ease, max-height 0.3s ease, opacity 0.3s ease",
                }}
              >
                <div className="candidate-advanced">
                  <div className="candidate-advanced-header">
                    <span className="candidate-advanced-label">ADVANCED STATS</span>
                    <span>TS%</span>
                    <span>USG</span>
                    <span>BPM</span>
                    <span>OBPM</span>
                    <span>DBPM</span>
                    <span>NR</span>
                  </div>
                  <div className="candidate-advanced-row">
                    <span />
                    <span>{stat(player.adv.ts ? player.adv.ts * 100 : null)}</span>
                    <span>{stat(player.m.usgEff)}</span>
                    <span>{stat(player.m.bpmEff)}</span>
                    <span>{stat(player.m.obpmEff)}</span>
                    <span>{stat(player.m.dbpmEff)}</span>
                    <span>{stat(player.m.playerBaseNR)}</span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
        {!sortedCandidates.length ? <p className="empty-text">No players match your filter.</p> : null}
      </ul>
    </section>
  );
}