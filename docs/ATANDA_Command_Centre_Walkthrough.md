# ATANDA Command Centre Walkthrough

## Introduction
The ATANDA Command Centre is your primary workspace for building, certifying, and exporting cognitive assets and software design documents. This guide covers the end-to-end features currently shipped in the product.

## 1. The Engine Pipeline (F1 - F8)
The core of the ATANDA Command Centre is the engine pipeline, now driven by the **ATOMIC UI Stage Cockpit**. The cockpit focuses your attention on one clear action at a time, keeping the underlying engine complexity under the hood.

*   **F1 JCSE SCORER:** Scores your raw prompt against the 7-pillar JCSE rubric.
*   **F2 ATOMIC PROMPT:** Condenses your idea into a sharp, machine-readable brief.
*   **F3 CELL GENERATOR:** Expands the atomic prompt into individual feature cells.
*   **F4 MICRO PDD:** Generates a lightweight product design document.
*   **F5 SPC COMPILER:** Creates a Super Prompt Card (SPC).
*   **F6 ATLAS PDD:** Expands the SPC into a comprehensive ATLAS PDD.
*   **F7 SPARTAN COMPRESSOR:** Certifies the MVP PDD and stamps a public verification URL.
*   **F8 CODE ORACLE:** Scaffolds a runnable codebase from the certified spec.

### ATOMIC UI Stage Cockpit Features:
*   **Linear Guidance:** The UI explicitly shows "Where you came from" (Left Column), "What you are doing now" (Center Column), and "Where you are going next" (Right Column).
*   **Artifact Tray:** All generated artifacts are persisted in the session artifacts tray on the right.
*   **Cross-Engine Navigation:** Easily jump back and forth between available engines.

## 2. ATLAS 360: PLAN & SCAN Views
From any session containing a generated PDD, you can access the ATLAS 360 panel to project different views of the asset:

*   **PLAN View:** Generates a structured 12-part technical execution plan designed for build teams.
*   **SCAN View:** Generates an 8-stage assurance audit profile for governance, compliance, and oversight.
*   **Export:** Both views can be exported as one ZIP containing both Markdown and JSON files for use in external workflows.

## 3. The Exemplar Library
The Exemplar Library is your reference and marketplace for high-performing assets.

*   **Canonical References:** Study pristine SPCs and PDDs produced by the HARNESS.
*   **Open Backend Marketplace:** Upload your own SPC, MA, MPDD, or PDD files to share them with other operators.
*   **Fork to Session:** Instantly clone an exemplar into a new session to use as a proven baseline for your own work.

## 4. SPC Player
The SPC Player is a standalone cognitive production cockpit dedicated to capability briefs.

*   **Draft Registration:** Create a new brief by providing a title and context, then select required capability cards from the Dev Kit registry.
*   **Governance:** Review the established governance policy and selected card requirements before execution.
*   **Open Execution & Download:** Execute without a tier, entitlement, credit, billing, or LLM gate, then download the final JSON package with separate clarity, truthfulness, and detectability figures.
*   **Authorized Webhook Delivery:** Explicitly authorize a public HTTPS endpoint for one owned run before delivering its final package. Environment sketches are documentation, not live integrations.

## 5. Additional Features
*   **F0 Advisory:** Run business intelligence and viability reports based on a SOCRATES discovery interview.
*   **Quests & Badges:** Earn automated achievements based on real engine work and certified runs.
*   **Ascension Protocol:** Climb the 13-rung onboarding ladder proven by real signals.
*   **Activity Log & Costs:** Track every engine call and monitor live LLM spend telemetry against your org's monthly cap.
*   **Public Verification:** Anyone can validate a SPARTAN-certified document using its stamped public URL.