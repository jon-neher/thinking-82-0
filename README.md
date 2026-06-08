# 82-0 Reimagined

An improved, high-fidelity reimagining of the roster-building game at [82-0.com](https://www.82-0.com/).

## Overview
In this game, players draft a real NBA team based on randomly spun `(team, decade)` combinations. Unlike the original experience, our version introduces **Fit-Aware Scoring**—rewarding team chemistry and positional balance over mere stat-stuffing.

### Key Features
- **6th Man Roster**: Draft 6 slots (PG, SG, SF, PF, C + Flex).
- **Advanced Scouting**: Ratings are derived from NBA real data (BPM, OBPM, TS%, USG%) normalized across all eras.
- **Fit Adjustments**: The simulation accounts for:
    - **Spacing & Shooting**: Rewards portable 3PT ability and perimeter spacing.
    - **Usage Balance**: Penalties for "overcrowding" high usage on the court.
    - **Defensive Coverage**: Rim protection and perimeter steals matter as much as scoring.
- **Ringer Aesthetic**: A polished, bright, editorial design language.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/jon-neher/thinking-82-0.git
   cd thinking-82-0
   ```
2. Install dependencies:
   ```bash
   cd web
   npm install
   ```

### Development
To start the development server:
```bash
cd web
npm run dev
```

The app will be available at `http://localhost:5173`.

## Project Structure
- `/data`: Contains the Python pipeline for scraping and building the athlete dataset (`players.json`).
- `/web`: The React + Vite frontend application.
- `/docs`: Reference materials for scoring specs and project details.
- `AGENTS.md`: Operational rules, logic summaries, and project quirks for the development agent.

## Data Pipeline
The data is refreshed via Python scripts in `/data/pipeline`. These scripts fetch raw HTML from Basketball-Reference and generate a compact, static JSON dataset used by the frontend. For performance reasons, this happens at build time or as a standalone process (not during runtime).