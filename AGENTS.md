# Development Principles

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
