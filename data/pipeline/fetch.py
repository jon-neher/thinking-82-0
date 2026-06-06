"""
Polite scraper for Basketball-Reference season league tables.

Fetches per-season tables (per_game / advanced / per_poss / play_by_play), caches raw HTML to
data/raw/, and parses rows keyed by BBR player id + team using the stable
`data-stat` attributes. Real data only.

Usage:
    python3 fetch.py --start 1960 --end 2025                 # fetch & cache all
    python3 fetch.py --start 2023 --end 2023 --no-cache-only # force refetch
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import time
import urllib.request
from html.parser import HTMLParser

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "raw")
RATE_LIMIT_SECONDS = 3.5
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

# table-type -> (url segment, table element id)
TABLES = {
    "per_game": ("per_game", "per_game_stats"),
    "advanced": ("advanced", "advanced"),
    "per_poss": ("per_poss", "per_poss"),
    "play_by_play": ("play-by-play", "pbp_stats"),
}


def season_url(season: int, ttype: str) -> str:
    seg = TABLES[ttype][0]
    return f"https://www.basketball-reference.com/leagues/NBA_{season}_{seg}.html"


def cache_path(season: int, ttype: str) -> str:
    return os.path.join(RAW_DIR, f"NBA_{season}_{ttype}.html")


def fetch_html(season: int, ttype: str, force: bool = False) -> str | None:
    """Return raw HTML for a season/table, using on-disk cache when present."""
    os.makedirs(RAW_DIR, exist_ok=True)
    path = cache_path(season, ttype)
    if os.path.exists(path) and not force:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    url = season_url(season, ttype)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            # e.g. per_poss / play_by_play in unsupported eras — expected; cache a sentinel.
            with open(path, "w", encoding="utf-8") as f:
                f.write("<!--404-->")
            time.sleep(RATE_LIMIT_SECONDS)
            return None
        print(f"  HTTP {e.code} for {url}", file=sys.stderr)
        return None
    except Exception as e:  # noqa: BLE001
        print(f"  ERROR fetching {url}: {e}", file=sys.stderr)
        return None
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    time.sleep(RATE_LIMIT_SECONDS)
    return html


class _TableRowParser(HTMLParser):
    """Extract data rows of a single <table id=...> as dicts of data-stat -> text.

    Also captures the player id from `data-append-csv` on the name cell.
    Skips the playoff (_post) tables by only reading the first matching table id.
    """

    def __init__(self, table_id: str):
        super().__init__()
        self.table_id = table_id
        self.in_table = False
        self.depth = 0
        self.in_row = False
        self.cur: dict | None = None
        self.cur_stat: str | None = None
        self.buf: list[str] = []
        self.rows: list[dict] = []
        self._done = False

    def handle_starttag(self, tag, attrs):
        if self._done:
            return
        a = dict(attrs)
        if tag == "table":
            if not self.in_table and a.get("id") == self.table_id:
                self.in_table = True
                self.depth = 1
            elif self.in_table:
                self.depth += 1
            return
        if not self.in_table:
            return
        if tag == "tr":
            self.in_row = True
            self.cur = {}
        elif tag in ("td", "th") and self.in_row:
            self.cur_stat = a.get("data-stat")
            self.buf = []
            if a.get("data-append-csv"):
                self.cur["player_id"] = a["data-append-csv"]

    def handle_data(self, data):
        if self.cur_stat is not None:
            self.buf.append(data)

    def handle_endtag(self, tag):
        if self._done or not self.in_table:
            return
        if tag in ("td", "th") and self.cur_stat is not None:
            if self.cur is not None:
                self.cur[self.cur_stat] = "".join(self.buf).strip()
            self.cur_stat = None
            self.buf = []
        elif tag == "tr" and self.in_row:
            self.in_row = False
            if self.cur and self.cur.get("player_id"):
                self.rows.append(self.cur)
            self.cur = None
        elif tag == "table":
            self.depth -= 1
            if self.depth == 0:
                self.in_table = False
                self._done = True  # ignore the _post table that follows


def parse_table(html: str, table_id: str) -> list[dict]:
    if not html or html.strip() == "<!--404-->":
        return []
    p = _TableRowParser(table_id)
    p.feed(html)
    return p.rows


def get_season_table(season: int, ttype: str, force: bool = False) -> list[dict]:
    html = fetch_html(season, ttype, force=force)
    if html is None:
        return []
    return parse_table(html, TABLES[ttype][1])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, default=1960)
    ap.add_argument("--end", type=int, default=2025)
    ap.add_argument("--force", action="store_true", help="refetch even if cached")
    args = ap.parse_args()

    for season in range(args.start, args.end + 1):
        counts = {}
        for ttype in TABLES:
            rows = get_season_table(season, ttype, force=args.force)
            counts[ttype] = len(rows)
        print(
            f"{season}: per_game={counts['per_game']:>4}  "
            f"advanced={counts['advanced']:>4}  per_poss={counts['per_poss']:>4}  "
            f"play_by_play={counts['play_by_play']:>4}"
        )


if __name__ == "__main__":
    main()
