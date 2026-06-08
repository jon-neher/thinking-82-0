# Project Overview & Goals
This project is an improved reimagining of the roster-building game at [82-0.com](https://www.82-0.com/). 
The core loop remains addictive: drafting one real NBA player from a randomly spun (team, decade) combination to fill a 6-slot roster. 

**Key Innovations:**
1. **6th Man Draft Slot**: Roster includes PG, SG, SF, PF, C, + Flex 6th Man.
2. **Fit-Aware Scoring**: Rewards "team fit" (spacing, usage balance, and defensive coverage) rather than just raw stat accumulation.
3. **The Ringer Aesthetic**: A bright, editorial design language (white canvas, bold accents, strong typography).

## Data Reality & Pipeline Quirks
- **Source**: Basketball-Reference league tables (`per_game`, `advanced`, and `per_poss`).
- **Availability**: 
    - **TS%, BPM, OBPM, DBPM, USG%**, etc., are only available from the 1973–74 season onward.
    - Pre-1974 seasons rely on estimates (shrunk toward priors).
- **Normalization**: All player stats are normalized to a per-100 possession basis and then converted to season-relative robust z-scores for comparison across eras.
- **Peak Selection**: Each `(team, decade)` entry selects the player's peak season based on minutes-weighted impact.
- **Dataset**: The primary data source is `data/players.json`, which is generated at build-time by the `/data/pipeline` scripts (Python).

## Scoring Logic Summary
1. **Base Rating (`playerBaseNR`)**: A blend of box-score stats and advanced metrics (BPM/OBPM/DBPM), weighted based on data confidence (lower for estimated pre-1974 eras).
2. **Minutes weighting**: Starters play 34 mins, 6th man plays 26 mins.
3. **Capped Fit Adjustments**:
    - **Usage FIT**: Penalties for high usage in secondary spots; rewards balance.
    - **Spacing/Shooting FIT**: Rewards 3PT and TS% portability (high for pre-1980).
    - **Defensive FIT**: Rim protection for bigs, perimeter steals for guards.
    - **Position FIT**: Penalties for playing a player significantly out of position (except the Flex slot).
4. **Win Projection**: `winPct = 1 / (1 + exp(-netRating / 7.5))`, maps to a scale of ~0 to ~82 wins.

## UI & UX Standards
### Player Statistics
- **Advanced Stats Integration**: Advanced statistics should not be shown globally. They must be integrated into the player selection card and revealed via a "slide-down" animation only when a player is selected.
- **Grid Alignment**: Advanced stat rows must use CSS Grid to perfectly mirror the column widths of the primary box score stats.
- **Header Rows**: When displaying advanced metrics, always include a header row above the values to label each metric (e.g., TS%, USG, BPM).
- **Mode Sensitivity**: Ensure advanced stats are only visible in "Classic" mode; "HoopIQ" mode should hide specific numerical values to preserve the challenge.

### Gameplay & Realism
- **Ranking Signals**: Avoid showing explicit "Scout" tiers or ranking chips in the frontend. This encourages players to evaluate athletes based on their raw stats and fit rather than min-maxing based on assigned tiers.
- **Redundancy**: Keep subtitles clean. Avoid repeating stats in the player subtitle that are already present in the stats grid (e.g., TS%).

## Technical Implementation
- **Transitions**: Use `grid-template-rows: 0fr/1fr` or `max-height` transitions for smooth expansion panels.
- **Styling**: Use shared CSS variables for colors (`--orange`, `--blue-700`) to maintain brand consistency.
- **Build Process**: Always run `npm run build` in the `web/` directory after UI changes to verify type safety and layout integrity.