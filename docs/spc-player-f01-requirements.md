# SPC Player F0.1 Supported Foundation

**Status: Pre-Build foundation; not FORGE certified.**

This document defines the supported implementation boundary. It does not
certify the player, its cards, draft manifests, or any generated output.

## Available authority

The supplied SPC Player Omnibus v3 and v4 sources establish:

- The six-card SPC Dev Kit registry.
- Cheat Sheet publication metadata and defaults.
- Separate clarity, truthfulness, and detectability axes with no composite
  score.
- Pre-Build status.

The user explicitly authorized `attached_assets/REVERB_v3_0_1789342293111.pdf`
as the replacement source for the omitted standalone F0.1 execution
contracts. The runtime authority is therefore recorded as:

> **user-authorized REVERB v3 derivation**

This is a conservative generic adaptation. It does not infer REVERB-specific
editorial card-roster behavior; card metadata and each card's own returned
verdict remain authoritative for that stage.

## Supported foundation

1. Authenticated users can view the SPC card catalog and six-card Dev Kit
   registry. The registry reports `available` with `open_access`; its separate
   `pre_build` certification status does not restrict access.
2. Users can register, list, and retrieve their own SPC Player drafts.
3. Draft ownership is enforced for detail, execution, authorization, delivery,
   download, and manifest requests.
4. Draft records preserve the selected card IDs, brief, Pre-Build status, and
   v4 governance metadata.
5. Draft output packages may contain only separate clarity, truthfulness, and
   detectability values. Composite score fields are rejected.
6. A draft can execute in the supported `full` or `rapid` profile. Selected
   card IDs are invoked sequentially in the user's stored order.
7. Every invoked card produces a retained stage result containing its actual
   verdict, content, and evidence. The runtime never claims a stage was
   invoked when it was not.
8. Completed output packages contain content, a non-detachable Execution
   Advisory/evidence trail, independent nullable clarity/truthfulness/
   detectability scores, and a distribution plan.
9. Execution is open access and has no entitlement, pricing approval,
   project-credit, or billing gate. Execution's persisted distribution plan is
   plan-only; connector actions are separate from execution and operate only
   on completed output.
10. The built-in `download` connector returns an ownership-scoped JSON
    attachment. The `webhook` connector requires explicit per-run
    authorization, persists only public endpoint metadata and consent time,
    and reports persisted authorization status.
11. Webhook authorization accepts only HTTPS destinations whose every resolved
    address is public. Delivery is server-side, pinned to the validated public
    DNS resolution, rejects redirects, applies a timeout, and reports non-2xx
    failures without storing credentials or request payloads.

## Derived state transition table

| Current state | Event | Next state | Persisted requirements |
| --- | --- | --- | --- |
| `DRAFT` | Execute accepted | `RUNNING` | owner, profile, intake classification, ordered card snapshot, advisory shell, plan-only distribution, transition |
| `RUNNING` | Card returns | `RUNNING` | append only that card's actual stage result and evidence; update advisory invoked-stage list |
| `RUNNING` | All selected cards return | `COMPLETED` | retain all stage results; package content + advisory + independent scores + distribution plan; set completion time |
| `RUNNING` | Provider, schema, or execution error | `FAILED` | retain completed stage results, advisory/evidence to failure, error text, and failure transition |
| `FAILED` | Execute accepted again | `RUNNING` | reset transient output/error while retaining the new transition and rerun evidence |
| `COMPLETED` | Execute requested | `COMPLETED` | return the immutable completed result; no duplicate invocation |

`DRAFT` is the registration state in the existing draft table. Execution
state and transitions are persisted in the standalone execution record keyed
by the same run ID, so a reload always exposes the latest state and output.
`PRE_BUILD` remains the product status for registry, cards, and generated
content.