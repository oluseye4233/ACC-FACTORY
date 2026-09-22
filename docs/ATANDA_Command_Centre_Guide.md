# ATANDA Command Centre Guide

This document is the authoritative companion to the `ATANDA_Command_Centre_Guide.pdf`, reflecting the currently shipped product features.

## Core Workflows

### ATOMIC UI Stage Cockpit
The Command Centre sessions are now navigated via the ATOMIC UI Stage Cockpit. This interface simplifies the F1-F8 engine pipeline into a focused, linear track:
1.  **Contextual Awareness:** The interface is split into three columns: previous stage context (left), current active engine workspace (center), and next stage progression/artifact tray (right).
2.  **State Persistence:** Outputs from each engine run are automatically saved and immediately available in the session's artifact tray.
3.  **Ingestion & Cartridges:** You can still begin sessions from a raw prompt, an uploaded document (Ingestion), or a pre-configured domain Cartridge.

### ATLAS 360 Views
The ATLAS 360 feature allows you to extract structured data from generated PDDs:
*   **PLAN View:** A 12-part execution guide for engineering teams.
*   **SCAN View:** An 8-stage audit profile for governance and compliance checks.
*   **Export:** Export the generated views as one ZIP containing both Markdown and JSON files for external workflows.
*   *Note: Generating these views requires Practitioner tier or an active escalation.*

### The Exemplar Library
A shared repository for high-quality cognitive assets:
*   **Browse:** View canonical SPARTAN-certified PDDs and SPCs.
*   **Contribute:** Users can upload their own files (SPC, MA, MPDD, PDD in formats `.txt`, `.md`, `.pdf`, `.docx`) or entire folders to the open backend marketplace.
*   **Fork:** Clone any exemplar directly into a new session to use as a starting point.

### SPC Player (Standalone Workflow)
The SPC Player is an open-access cockpit for registering, executing, and delivering specific capability requirements:
1.  **Registration:** Users define a project title, a capability brief, and select required draft cards from the Dev Kit registry.
2.  **Review:** The system displays the active Governance Policy and the selected Draft Card References.
3.  **Manifest Export:** Users can download a JSON manifest of the draft.
4.  **Execute & Download:** Execute without a tier, entitlement, credit, billing, or LLM gate, then download the final JSON package with separate clarity, truthfulness, and detectability figures.
5.  **Authorized Delivery:** Optionally authorize a public HTTPS webhook for one owned run, then deliver its final package. Environment sketches remain documentation and are not live integrations.

## Administration and Verification
*   **Costs:** Live spend tracking per engine call against org-wide monthly caps.
*   **Public Verification:** The `/verify` route remains the anchor for validating SPARTAN-certified documents using their public URLs.
*   **Activity:** A chronological audit trail of all generated artifacts and engine runs.