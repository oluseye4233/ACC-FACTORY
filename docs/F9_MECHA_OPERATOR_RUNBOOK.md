# F9 MECHA operator runbook

F9 is a deterministic machine floor, not a creative generation endpoint. It accepts
an owned F8 `CODEBASE_BUNDLE` whose `sourceMvpPddArtifactId` points to an owned,
SPARTAN-certified `MVP_PDD`. The server creates one `mecha_run_id` and persists
every phase, external verdict, terminal state, and refusal.

## Run

`POST /api/harness/f9` (Architect tier)

The request must contain `sessionId`, `sourceArtifactId`, `deviceClass`, and
exactly seven phase records numbered 1 through 7. Each phase carries evidence
provided by its named external gate. The server never synthesizes missing
evidence, changes a verdict, or accepts a phase out of order.

The seven phases are READ, DISCOVER, CLASSIFY, CULTIVATE, VALIDATE, CLEAR &
CERTIFY, and EMIT. A refusal is terminal and cites both a MECHA constraint and a
platform invariant. Refusals are expected when evidence is incomplete.

## Emission requirements

Emission requires a non-safety hazard classification, architecture-before-code,
a declared fail-safe default, `MATH_VERIFIED`, all three ARES vectors `PASS`,
fail-safe reachability, no `HOLD-IP`, a UCG score at the lane threshold with
three distinct identities, PCE fidelity of at least 99% with zero orphans and a
clean ARES scan, and `osiris_custody: true`.

The emitted payload is canonicalized, SHA-256 hashed, and signed with the
server-side `SESSION_SECRET`. The secret is never returned or logged. The response
sets `regulatory_conformity_asserted: false`: a mathematical gate is not a
regulatory or functional-safety certification.

`GET /api/harness/f9/runs?sessionId=...` lists only runs belonging to the
authenticated operator's session.