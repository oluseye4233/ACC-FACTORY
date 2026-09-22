# BUGMXT — repeatable change-set scan

One command scans everything committed since the last scan and writes a dated
report here:

```
pnpm --filter @workspace/scripts run bugmxt-latest
```

What it does:

1. Reads the last scanned commit from `.last-scan.json` (override once with
   `-- --base=<sha>` if the state file is missing or wrong).
2. Builds the run config automatically from `git log`/`git diff` for
   `<last-scanned>..HEAD` (prior BUGMXT reports and `.agents/` are excluded
   from the diff).
3. Injects `TRIAGE_NOTES.md` into the prompt so verified false positives and
   accepted risks from past runs are not re-flagged.
4. Runs the 4-phase BUGMXT SI scan and assembles
   `BUGMXT_Report_<YYYY-MM-DD>_<base>-<head>.{md,pdf}` in this directory.
5. Advances `.last-scan.json` to HEAD — only after a successful assemble, so a
   failed run can simply be re-run.

If HEAD is already scanned, the command exits 0 with "up to date".

After triaging a report, append verified false positives / accepted risks to
`TRIAGE_NOTES.md` (dated section) so the next scan carries them forward.

Individual phases remain available for debugging:
`node scripts/src/run-bugmxt-scan.mjs <phase1|phase2|phase3|phase4|assemble|all> --run=latest`.
The older named run configs (`--run=account-delete`, `--run=guide-github-sync`)
still work and write to `docs/` as before.
