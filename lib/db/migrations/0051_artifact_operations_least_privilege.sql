-- Adapted from the supplied ARK RLS package to the existing public tables.
-- No data is replaced, and no authentication or organisation IDs are remapped.
-- This is a dev migration; managed Publish remains responsible for production.
REVOKE DELETE, TRUNCATE ON imprima_jobs, imprima_files, short_sprint_runs,
  artifact_operation_events, sprint_verifier_authorities FROM atanda_artifact_operations;
--> statement-breakpoint
REVOKE UPDATE ON imprima_files, artifact_operation_events FROM atanda_artifact_operations;
-- Custom SQL migration file, put your code below! --