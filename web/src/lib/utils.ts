import type { PlayerSeason, DraftSlot } from "../types";

export const SLOTS: DraftSlot[] = ["PG", "SG", "SF", "PF", "C", "SIXTH"];
export const POSITION_FILTERS = ["ALL", "PG", "SG", "SF", "PF", "C"] as const;
export type PositionFilter = (typeof POSITION_FILTERS)[number];
export type SortKey = "name" | "pts" | "reb" | "ast" | "stl" | "blk";
export type SortDirection = "asc" | "desc";

export const SLOT_LABELS: Record<DraftSlot, string> = {
  PG: "Point Guard",
  SG: "Shooting Guard",
  SF: "Small Forward",
  PF: "Power Forward",
  C: "Center",
  SIXTH: "6th Man",
};

export const EMPTY_ROSTER: Record<DraftSlot, PlayerSeason | undefined> = {
  PG: undefined,
  SG: undefined,
  SF: undefined,
  PF: undefined,
  C: undefined,
  SIXTH: undefined,
};

export function positionsFor(player: PlayerSeason): Set<string> {
  const values = player.positions?.length ? player.positions : [player.pos, ...player.pos2];
  return new Set(values.map((value) => value.trim()).filter(Boolean));
}

export function canPlaySlot(player: PlayerSeason, slot: DraftSlot): boolean {
  if (slot === "SIXTH") {
    return true;
  }
  return positionsFor(player).has(slot);
}

export function stat(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) {
    return "\u2014";
  }
  return value.toFixed(digits);
}

export function seasonSummary(player: PlayerSeason): string {
  const seasons =
    player.sampleSeasons && player.sampleSeasons.length
      ? [...player.sampleSeasons].sort((a, b) => a - b)
      : [player.season];
  if (seasons.length === 1) {
    return `${seasons[0]}`;
  }
  return `${seasons[0]}-${seasons[seasons.length - 1]} avg`;
}

export function positionsSummary(player: PlayerSeason): string {
  const values = player.positions?.length ? player.positions : [player.pos, ...player.pos2];
  const unique = Array.from(new Set(values));
  return unique.join(", ");
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}