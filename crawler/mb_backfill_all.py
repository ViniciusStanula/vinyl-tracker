"""
mb_backfill_all.py — Orchestrator for the MusicBrainz enrichment passes.

MusicBrainz allows ~1 request/sec PER IP, so the three MB passes cannot run
concurrently. This runs them strictly in sequence, each to completion:

    1. mb_enrich.py    — match release-groups (mbid, year, type, genres)
    2. mb_rating.py    — community rating for matched records
    3. mb_tracklist.py — tracklist + durations for matched records

By default it loops: after a full cycle it sleeps, then runs again to pick up
new records added by the crawler. Use --once for a single cycle.

The Last.fm listener drain (backfill_listeners.py) uses a different API and
should run as its own separate process — do NOT add it here.

Usage:
    python mb_backfill_all.py                 # loop forever
    python mb_backfill_all.py --once          # one full cycle, then stop
    python mb_backfill_all.py --sleep 3600    # seconds between cycles (default 3600)
"""
import sys
import time
import argparse
import logging
import subprocess
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  [orchestrator] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

HERE = Path(__file__).parent
PASSES = ["mb_enrich.py", "mb_rating.py", "mb_tracklist.py"]


def run_pass(script: str) -> int:
    """Runs one MB pass to completion. Returns its exit code."""
    log.info("── starting %s ──", script)
    t0 = time.monotonic()
    proc = subprocess.run([sys.executable, str(HERE / script)], cwd=str(HERE))
    log.info("── %s finished (exit %d) in %.0fs ──",
             script, proc.returncode, time.monotonic() - t0)
    return proc.returncode


def parse_args():
    p = argparse.ArgumentParser(description="Run the MusicBrainz enrichment passes in sequence")
    p.add_argument("--once",  action="store_true", help="Run one full cycle, then stop")
    p.add_argument("--sleep", type=int, default=3600, metavar="S",
                   help="Seconds to sleep between cycles when looping (default: 3600)")
    return p.parse_args()


def main():
    args = parse_args()
    cycle = 0
    while True:
        cycle += 1
        log.info("===== cycle %d =====", cycle)
        for script in PASSES:
            try:
                run_pass(script)
            except Exception as exc:
                log.error("pass %s crashed: %s — continuing to next pass.", script, exc)
        if args.once:
            log.info("--once set — done after one cycle.")
            break
        log.info("cycle %d complete — sleeping %ds before next cycle.", cycle, args.sleep)
        time.sleep(args.sleep)


if __name__ == "__main__":
    main()
