---
name: F9 hardware configuration selection
description: Firmware F8/F9 runs use a controlled hardware profile catalog.
---

Firmware scaffolding and F9 MECHA runs use one of three reference profiles: industrial MCU, robotics real-time control loop, or connected appliance fleet. The selected profile is carried from F8 into the bundle and must match the F9 selection; F9 records the profile and Code DJ customization brief in phase-one evidence and the signed artifact.

**Why:** Hardware-specific firmware constraints need to be visible and reproducible without treating a profile selection as external certification evidence.

**How to apply:** Add new profiles to both the API-validated catalog and the Command Centre selector, keep the profile ID stable, and leave external phase evidence gates intact.