# ART-TITLE-001 — Project-first artifact titles

## Register entry

| Field | Value |
| --- | --- |
| Invariant ID | ART-TITLE-001 |
| Authority | Explicit project-owner instruction |
| Rule | Every artifact title created during the production process must start with the project name. |
| Scope | All newly created project artifacts, across production stages, supporting processes and derived versions |
| Enforcement status | Specified; mandatory for future artifact production and implementation changes |
| Live-platform verification | Not verified by this documentation change |

This is an additive register entry. It does not renumber historical SPARTAN
invariants or imply that unresolved register conflicts have been closed.

## Naming contract

Use:

```text
<Project name> — <Artifact description>
```

The project name must come from the artifact's owning project/session record,
not an invented model-generated label. Preserve the readable artifact type,
stage and version after the prefix. Apply the same project-first rule to the
artifact's display title and any newly generated document title.

Examples for a project named `Solar Monitor`:

- `Solar Monitor — F5 SPC`
- `Solar Monitor — ATLAS 360 SCAN`
- `Solar Monitor — F6 ATLAS PDD`
- `Solar Monitor — F8 CODE ONE + Code Bundle`
- `Solar Monitor — F8 Code Bundle · Upgraded 1`
- `Solar Monitor — F8 Code Bundle · Upgraded 2`

Do not duplicate a project prefix that is already present. A missing project
name must be resolved before producing a new artifact title; a generic
`Untitled artifact` does not satisfy this invariant.

## Integrity and scope boundaries

- Preserve Boomerang lineage, artifact IDs, stage identifiers and upgrade
  numbering. A new title does not grant approval or certification.
- Apply the rule when creating a new artifact/version. Do not retroactively
  mutate historical, signed, certified or hash-bound artifact bytes.
- Merely selecting an existing Exemplar or other source does not authorize
  changing its original title. Newly produced project derivatives use the
  receiving project's name.
- This governs titles, not the separate download-filename serialization
  convention. Filesystem sanitization must not replace the displayed project
  name with a generic label.
- This does not require project prefixes on unrelated account reports,
  platform-wide documentation or other non-project records.

## Evidence required before declaring enforcement active

Verify every artifact-creation path, not only the shared engine save helper:

1. New artifacts with missing, generic or unprefixed candidate titles receive
   the owning project's prefix.
2. Already-prefixed titles do not acquire duplicate prefixes.
3. Derived artifacts and repeated Boomerang upgrades preserve the prefix and
   their correct upgrade numbering.
4. Saved titles remain project-first after reload and in generated documents.
5. Immutable historical artifacts remain unchanged.

These are acceptance criteria, not a claim that runtime checks or production
verification have been completed.
