import { useCallback } from "react";
import type { PlayerSeason, DraftSlot, Roll } from "../types";
import { SLOTS, canPlaySlot } from "../lib/utils";

interface UseDraftProps {
  roster: Record<DraftSlot, PlayerSeason | undefined>;
  setRoster: React.Dispatch<React.SetStateAction<Record<DraftSlot, PlayerSeason | undefined>>>;
  roll: Roll | null;
  setRoll: React.Dispatch<React.SetStateAction<Roll | null>>;
  setSelectedPlayerId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedSlots: DraftSlot[];
  selectedPlayer: PlayerSeason | null;
}

export function useDraft({
  roster,
  setRoster,
  roll,
  setRoll,
  setSelectedPlayerId,
  selectedSlots,
  selectedPlayer,
}: UseDraftProps) {
  const draftPlayer = useCallback(
    (player: PlayerSeason, slot: DraftSlot) => {
      if (!canPlaySlot(player, slot)) {
        return;
      }
      setRoster((previous) => {
        const sourceSlot = SLOTS.find((candidateSlot) => previous[candidateSlot]?.id === player.id) ?? null;
        const targetPlayer = previous[slot];
        if (sourceSlot === slot) {
          return previous;
        }
        if (!sourceSlot && targetPlayer) {
          return previous;
        }
        const next = { ...previous };
        if (sourceSlot) {
          next[sourceSlot] = undefined;
        }
        if (sourceSlot && targetPlayer && !canPlaySlot(targetPlayer, sourceSlot)) {
          return previous;
        }
        if (sourceSlot && targetPlayer) {
          next[sourceSlot] = targetPlayer;
        }
        next[slot] = player;
        return next;
      });
      if (roll?.candidates.some((candidate) => candidate.id === player.id)) {
        setRoll(null);
      }
      setSelectedPlayerId(player.id);
    },
    [roll, setRoster, setRoll, setSelectedPlayerId],
  );

  const handleCourtSlotClick = useCallback(
    (slot: DraftSlot) => {
      if (selectedPlayer && selectedSlots.includes(slot)) {
        draftPlayer(selectedPlayer, slot);
      } else if (roster[slot]) {
        setSelectedPlayerId(roster[slot]!.id);
      }
    },
    [selectedPlayer, selectedSlots, roster, draftPlayer, setSelectedPlayerId],
  );

  const resetGame = useCallback(() => {
    setRoster({
      PG: undefined,
      SG: undefined,
      SF: undefined,
      PF: undefined,
      C: undefined,
      SIXTH: undefined,
    });
    setRoll(null);
    setSelectedPlayerId(null);
  }, [setRoster, setRoll, setSelectedPlayerId]);

  return { draftPlayer, handleCourtSlotClick, resetGame };
}