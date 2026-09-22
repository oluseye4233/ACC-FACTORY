---
name: SPC Player Exemplar KIT DECKS
description: Durable search, capacity, and F-process rules for assembling SPC Player decks from the Exemplar Library
---

SPC Player uses one unified catalog containing its official six-card Dev Kit and
SPCs discovered from the open Exemplar Library. A custom KIT DECK may contain
one through twelve unique SPCs in an explicit execution order.

**Why:** The user wants SPC Player to reuse the growing Exemplar Library, support
both automatic Capability Brief matching and manual selection, and allow larger
compositions without making execution unbounded.

**How to apply:** Keep the six-card Dev Kit as the named baseline. Rank automatic
recommendations deterministically from project title and Capability Brief
requirements against catalog metadata/content. Always retain manual catalog and
dropdown selection. Enforce the twelve-SPC unique-card ceiling in both the API
contract and server. SPC Player is an optional pre-build side-step at F5; it
must not advance or unlock the canonical F-process.