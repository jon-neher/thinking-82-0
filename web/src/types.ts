export type DraftSlot = "PG" | "SG" | "SF" | "PF" | "C" | "SIXTH";
export type Mode = "classic" | "hoopiq";

export interface PlayerMetrics {
  zPts: number;
  zReb: number;
  zAst: number;
  zStl: number;
  zBlk: number;
  rtsPP: number;
  effZ: number;
  usgEff: number;
  obpmEff: number;
  dbpmEff: number;
  bpmEff: number;
  playerBaseNR: number;
  boxOff: number;
  boxDef: number;
  shooting: number;
  rimDef: number;
  perimDef: number;
  hasObservedBPM: boolean;
  hasObservedDef: boolean;
  hasObservedUSG: boolean;
  hasThree: boolean;
}

export interface PlayerBox {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
}

export interface PlayerAdvanced {
  ts: number;
  usg: number | null;
  bpm: number | null;
  obpm: number | null;
  dbpm: number | null;
  per: number | null;
}

export interface PlayerSeason {
  id: string;
  pid: string;
  name: string;
  team: string;
  decade: string;
  season: number;
  pos: string;
  pos2: string[];
  g: number;
  mpg: number;
  box: PlayerBox;
  adv: PlayerAdvanced;
  m: PlayerMetrics;
}

export interface Dataset {
  meta: {
    source: string;
    seasons: number[];
    generated_categories: string[];
    player_count: number;
  };
  decades: string[];
  teams: Record<string, { name: string; decades: string[] }>;
  players: PlayerSeason[];
}

export interface SlotAssignment {
  slot: DraftSlot;
  player: PlayerSeason;
}

export interface TeamScore {
  teamNetRating: number;
  wins: number;
  losses: number;
  baseTeamNR: number;
  usageFitNR: number;
  spacingFitNR: number;
  defenseFitNR: number;
  positionFitNR: number;
  offenseNR: number;
  defenseNR: number;
}
