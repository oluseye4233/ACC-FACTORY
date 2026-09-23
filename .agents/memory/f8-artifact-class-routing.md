---
name: F8 artifact class routing
description: Software and Firmware F8 bundles take different downstream stage paths.
---

F8 must persist an explicit `SOFTWARE` or `FIRMWARE` classification in the code bundle. Software bundles skip F9 and unlock the native F10/F11 path; Firmware bundles retain the F9 → F10/F11 path. The API must enforce the distinction, not just the Command Centre navigation.

**Why:** F9 MECHA is a firmware machine-floor gate, while software has an existing direct bundle deployment and hosting path. UI-only routing could be bypassed by direct API calls.

**How to apply:** When adding or changing downstream F-stage gates, treat only explicit `SOFTWARE` as an F9 bypass; legacy bundles without a class remain eligible for F9 for compatibility.