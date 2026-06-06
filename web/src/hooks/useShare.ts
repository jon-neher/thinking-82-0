import { useCallback } from "react";
import type { TeamScore } from "../types";

interface UseShareProps {
  teamScore: TeamScore | null;
}

export function useShare({ teamScore }: UseShareProps) {
  const shareResult = useCallback(async () => {
    if (!teamScore) {
      return;
    }
    const text = `82-0 Reimagined: ${teamScore.wins}-${teamScore.losses} (${teamScore.teamNetRating.toFixed(1)} NR)`;
    await navigator.clipboard.writeText(text);
  }, [teamScore]);

  return { shareResult };
}