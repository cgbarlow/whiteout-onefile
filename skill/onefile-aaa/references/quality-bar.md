# Quality bar: how this skill judges and raises its own visual quality

The skill judges a build against **its own standard**, never against other games:

1. **Absolute anchors**: the per-axis descriptions in `critic-rubric.md` §2. They say what a 9, a 7 or a 5 looks like, in visual terms only.
2. **Its own calibration set** (`calibration/`):
   - `floor/` is a booting graybox, the lowest frame quality the pipeline should ever produce;
   - `best/` is the best shipped frames this skill has made so far.

   Their scores are recorded in `quality-bar.json` → `anchors`.
3. **Its own bar**: the numbers in `quality-bar.json` (`look`, `g2`). They start at the first run's baseline and only go up (ratchet).
4. **Its own history**: every shipped run appends one row to `quality-bar.json` → `history`. Progress is measured against that history.

## Critic drift check (start of every run, about 2 critic calls, done by the workflow's Calibrate step)
The blind critic wobbles, and it changes when the model changes. Before a run:
- Score `calibration/best/` with a fresh `onefile-critic`. If its mean differs from `anchors.best.mean` by more than 0.75, set
  `criticOffset = new - recorded` in the game's `STATE.json`, and subtract it from every score in this run before applying gates.
- If `anchors.floor.mean` is null, score `calibration/floor/` once and record it. If floor and best come out within 1.0 of
  each other, the critic is not discriminating. Report that to the user instead of trusting the gates.

## Within a run: improve against itself
- Each round is compared with the run's own `best` by blind pairwise A/B (`critic-rubric.md` §5). Absolute scores are used only for gates.
- At ship time the final frames are also blind-A/B'd against `calibration/best/` (the skill's best ever). The result is
  `beatBest: win|tie|lose`, and it goes in the report and the history row.

## Ratchet: raise the bar after each run (main session, after Reflect)
1. Append the history row (date, game, budget, mean, majors, min axis, G2 pass, beatBest).
2. **New best**: if the final set wins the blind A/B against `calibration/best/` clearly (`beatBest = win-clear` in the workflow result), replace `calibration/best/` with
   the new final critic JPEGs (main pose + yaw shots only, ≤ 2.5 MB) and update `anchors.best`.
3. **Raise G2**: when the last 2 shipped runs both passed G2, set
   - `minMean = min(stretch.minMean, max(minMean, mean of those 2 runs − 0.2))`,
   - `maxMajors = max(stretch.maxMajors, min(maxMajors, max majors of those 2 runs))`,
   - `minAxis` +0.5, when every axis in both runs beat it by ≥ 1.
4. **Never lower the bar automatically.** If runs keep failing, the fix goes into the skill (cookbook, prompts, rounds; see
   `run-log.md`), not into the numbers. Lowering needs a written reason in `run-log.md` and the user's OK.
5. Bump `version`. Commit the skill change with the reason.

The `stretch` numbers (no major, every axis ≥ 7.5, mean ≥ 8.0) are where the ratchet is headed. They are not a gate yet.
