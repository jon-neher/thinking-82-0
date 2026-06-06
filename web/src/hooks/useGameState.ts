import { useState, useMemo, useEffect, useCallback } from "react";
import { getDataset } from "../data/dataset";
import { evaluateRoster } from "../lib/scoring";
import type { Mode, PlayerSeason, DraftSlot, SlotAssignment, TeamScore, Dataset } from "../types";
import { SLOTS, EMPTY_ROSTER, type PositionFilter, type SortKey, type SortDirection } from "../lib/utils";

interface Roll {
  team: string;
  decade: string;
  candidates: PlayerSeason[];
}

interface UseGameStateReturn {
  dataset: Dataset;
  teams: string[];
  decades: string[];
  mode: Mode;
  setMode: (mode: Mode) => void;
  roster: Record<DraftSlot, PlayerSeason | undefined>;
  setRoster: React.Dispatch<React.SetStateAction<Record<DraftSlot, PlayerSeason | undefined>>>;
  roll: Roll | null;
  setRoll: React.Dispatch<React.SetStateAction<Roll | null>>;
  spinning: boolean;
  setSpinning: React.Dispatch<React.SetStateAction<boolean>>;
  displayTeam: string | null;
  setDisplayTeam: React.Dispatch<React.SetStateAction<string | null>>;
  displayDecade: string | null;
  setDisplayDecade: React.Dispatch<React.SetStateAction<string | null>>;
  teamSkips: number;
  setTeamSkips: React.Dispatch<React.SetStateAction<number>>;
  decadeSkips: number;
  setDecadeSkips: React.Dispatch<React.SetStateAction<number>>;
  positionFilter: PositionFilter;
  setPositionFilter: React.Dispatch<React.SetStateAction<PositionFilter>>;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  selectedPlayerId: string | null;
  setSelectedPlayerId: React.Dispatch<React.SetStateAction<string | null>>;
  showResults: boolean;
  setShowResults: React.Dispatch<React.SetStateAction<boolean>>;
  sortKey: SortKey;
  setSortKey: React.Dispatch<React.SetStateAction<SortKey>>;
  sortDirection: SortDirection;
  setSortDirection: React.Dispatch<React.SetStateAction<SortDirection>>;
  draftedPlayers: PlayerSeason[];
  usedTeams: Set<string>;
  usedDecades: Set<string>;
  openSlots: DraftSlot[];
  isComplete: boolean;
  assignments: SlotAssignment[];
  teamScore: TeamScore | null;
  findRosterSlotByPlayerId: (playerId: string) => DraftSlot | null;
  selectedPlayer: PlayerSeason | null;
  selectedPlayerCurrentSlot: DraftSlot | null;
  selectedSlots: DraftSlot[];
  tieBreakOrder: Map<string, number>;
  sortedCandidates: PlayerSeason[];
  roundNumber: number;
  fitTotal: number | null;
  resetFilters: () => void;
}

export function useGameState(): UseGameStateReturn {
  const dataset = useMemo(() => getDataset(), []);
  const teams = useMemo(() => Object.keys(dataset.teams).sort(), [dataset.teams]);
  const decades = dataset.decades;

  const [mode, setMode] = useState<Mode>("classic");
  const [roster, setRoster] = useState<Record<DraftSlot, PlayerSeason | undefined>>(EMPTY_ROSTER);
  const [roll, setRoll] = useState<Roll | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [displayTeam, setDisplayTeam] = useState<string | null>(null);
  const [displayDecade, setDisplayDecade] = useState<string | null>(null);
  const [teamSkips, setTeamSkips] = useState(1);
  const [decadeSkips, setDecadeSkips] = useState(1);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [search, setSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

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

  const findRosterSlotByPlayerId = useCallback(
    (playerId: string): DraftSlot | null => {
      for (const slot of SLOTS) {
        if (roster[slot]?.id === playerId) {
          return slot;
        }
      }
      return null;
    },
    [roster],
  );

  const selectedPlayer = useMemo(
    () =>
      (roll?.candidates.find((candidate) => candidate.id === selectedPlayerId) ??
        draftedPlayers.find((candidate) => candidate.id === selectedPlayerId) ??
        null),
    [draftedPlayers, roll, selectedPlayerId],
  );
  const selectedPlayerCurrentSlot = selectedPlayer ? findRosterSlotByPlayerId(selectedPlayer.id) : null;
  const selectedSlots = useMemo(
    () => {
      if (!selectedPlayer) {
        return [];
      }
      return SLOTS.filter((slot) => {
        if (!canPlaySlot(selectedPlayer, slot)) {
          return false;
        }
        if (selectedPlayerCurrentSlot === slot) {
          return true;
        }
        const slotPlayer = roster[slot];
        if (!slotPlayer) {
          return true;
        }
        if (!selectedPlayerCurrentSlot) {
          return false;
        }
        return canPlaySlot(slotPlayer, selectedPlayerCurrentSlot);
      });
    },
    [selectedPlayer, selectedPlayerCurrentSlot, roster],
  );

  const tieBreakOrder = useMemo(() => {
    if (!roll) {
      return new Map<string, number>();
    }
    const shuffled = roll.candidates.map((player) => player.id);
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const current = shuffled[index];
      shuffled[index] = shuffled[swapIndex];
      shuffled[swapIndex] = current;
    }
    return new Map(shuffled.map((id, index) => [id, index]));
  }, [roll]);

  const sortedCandidates = useMemo(() => {
    if (!roll) {
      return [];
    }
    const query = search.trim().toLowerCase();
    const filtered = roll.candidates.filter((player) => {
      const matchesPos = positionFilter === "ALL" || positionsFor(player).has(positionFilter);
      const matchesQuery =
        !query ||
        player.name.toLowerCase().includes(query) ||
        `${player.season}`.includes(query) ||
        positionsSummary(player).toLowerCase().includes(query);
      return matchesPos && matchesQuery;
    });
    const valueFor = (player: PlayerSeason): string | number => {
      switch (sortKey) {
        case "name":
          return player.name.toLowerCase();
        case "pts":
          return player.box.pts ?? -Infinity;
        case "reb":
          return player.box.reb ?? -Infinity;
        case "ast":
          return player.box.ast ?? -Infinity;
        case "stl":
          return player.box.stl ?? -Infinity;
        case "blk":
          return player.box.blk ?? -Infinity;
      }
    };
    return [...filtered].sort((a, b) => {
      const left = valueFor(a);
      const right = valueFor(b);
      if (typeof left === "string" && typeof right === "string") {
        const cmp = left.localeCompare(right);
        if (cmp !== 0) {
          return sortDirection === "asc" ? cmp : -cmp;
        }
        return (tieBreakOrder.get(a.id) ?? 0) - (tieBreakOrder.get(b.id) ?? 0);
      }
      const cmp = Number(left) - Number(right);
      if (cmp !== 0) {
        return sortDirection === "asc" ? cmp : -cmp;
      }
      return (tieBreakOrder.get(a.id) ?? 0) - (tieBreakOrder.get(b.id) ?? 0);
    });
  }, [positionFilter, roll, search, sortDirection, sortKey, tieBreakOrder]);

  const roundNumber = Math.min(draftedPlayers.length + 1, SLOTS.length);
  const fitTotal = teamScore
    ? teamScore.usageFitNR + teamScore.spacingFitNR + teamScore.defenseFitNR + teamScore.positionFitNR
    : null;

  const resetFilters = useCallback(() => {
    setSelectedPlayerId(null);
    setPositionFilter("ALL");
    setSearch("");
  }, []);

  useEffect(() => {
    resetFilters();
  }, [roll?.team, roll?.decade, resetFilters]);

  useEffect(() => {
    if (isComplete) {
      setShowResults(true);
    }
  }, [isComplete]);

  return {
    dataset,
    teams,
    decades,
    mode,
    setMode,
    roster,
    setRoster,
    roll,
    setRoll,
    spinning,
    setSpinning,
    displayTeam,
    setDisplayTeam,
    displayDecade,
    setDisplayDecade,
    teamSkips,
    setTeamSkips,
    decadeSkips,
    setDecadeSkips,
    positionFilter,
    setPositionFilter,
    search,
    setSearch,
    selectedPlayerId,
    setSelectedPlayerId,
    showResults,
    setShowResults,
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    draftedPlayers,
    usedTeams,
    usedDecades,
    openSlots,
    isComplete,
    assignments,
    teamScore,
    findRosterSlotByPlayerId,
    selectedPlayer,
    selectedPlayerCurrentSlot,
    selectedSlots,
    tieBreakOrder,
    sortedCandidates,
    roundNumber,
    fitTotal,
    resetFilters,
  };
}

function positionsFor(player: PlayerSeason): Set<string> {
  const values = player.positions?.length ? player.positions : [player.pos, ...player.pos2];
  return new Set(values.map((value) => value.trim()).filter(Boolean));
}

function canPlaySlot(player: PlayerSeason, slot: DraftSlot): boolean {
  if (slot === "SIXTH") {
    return true;
  }
  return positionsFor(player).has(slot);
}

function positionsSummary(player: PlayerSeason): string {
  const values = player.positions?.length ? player.positions : [player.pos, ...player.pos2];
  const unique = Array.from(new Set(values));
  return unique.join(", ");
}