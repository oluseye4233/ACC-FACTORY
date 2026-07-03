---
name: Scheduled cron ticks vs private deployment wall
description: Why external cron drivers cannot reach a Replit deployment published with Private visibility, and what the agent can/cannot do about Scheduled Deployments.
---

# Scheduled cron ticks vs the private-app wall

Rule: any externally driven cron tick (Scheduled Deployment → HTTPS → `/api/cron/*`) requires the target autoscale deployment to be published with **Public** visibility. A Private deployment's Replit auth wall 307-redirects every external request to a Replit login (following the redirect yields 403 "Expected X-Requested-With header"), so the cron endpoint is unreachable regardless of `CRON_SECRET`.

**Why:** Verified live — this project's prod deployment is Private and the cron driver got 307 → wall. The driver now uses `redirect: "manual"` and prints an explicit "behind Replit's private-app wall" error when the redirect Location looks like a Replit auth URL.

**How to apply:**
- Task agents have NO callback to create Scheduled Deployments (`deployConfig`/similar are absent; `suggestDeploy` is main-agent-only). Creating a Scheduled Deployment is a user action in the Publishing tool — prepare the exact run command + UTC cron expression and instruct the user.
- When debugging "cron never fires in prod": check `getDeploymentInfo().visibility` first before suspecting the secret or the route.
- Cron drivers that use `fetch` should set `redirect: "manual"` — silently following the wall redirect produces a misleading downstream error body.
