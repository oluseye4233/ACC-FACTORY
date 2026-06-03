---
name: UpgradeCTA gating (402 vs 403)
description: How tier gates vs cost-cap gates surface in the command-centre workspaces and the UpgradeCTA dialog.
---

The shared `UpgradeCTA` dialog is opened by each engine workspace (F5, F6DraftPdd, F6VdjBuild, F7, F8) from their error handlers.

- **403** = tier/authorization gate (`requireTier`).
- **402 `COST_CAP_EXCEEDED`** = monthly LLM cost cap (`requireCostBudget`); body carries an `onRamp` hint for F1000 practitioners.

**Rule:** every workspace error handler must open UpgradeCTA on `402 || 403`, not just 403. Handling only 403 silently swallows the cost-cap on-ramp.

**Why:** the F1000 promo's whole point is the one-click ARCHITECT on-ramp when a practitioner hits their $49 cap (a 402). Originally most workspaces only branched on 403, so the on-ramp never showed.

**How to apply:** pass `costCap={status === 402}` into UpgradeCTA so the *copy* reflects the cause ("USAGE BUDGET REACHED" vs "AUTHORIZATION REQUIRED"). The Architect one-click *button* keys off F1000 membership (UpgradeCTA fetches `/api/me`: `f1000Member && tier === PRACTITIONER`), independent of the cause — for an F1000 practitioner, ARCHITECT is the right next step whether they hit a 402 cap or a 403 Architect-only gate.
