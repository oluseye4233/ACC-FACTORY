import { reconcileStaleCartridgeCredits } from "./cartridge-credits";
import { recoverPreparationStorage, type PreparationRecoveryReport } from "./artifact-operations/preparation-recovery";
import { subscriptionsEnabled } from "./feature-flags";
import { logger } from "./logger";

type CreditResult =
  | { status: "disabled" }
  | { status: "completed"; recovered: number }
  | { status: "failed" };
type StorageResult =
  | { status: "unconfigured" }
  | { status: "completed" | "failed"; report: PreparationRecoveryReport }
  | { status: "failed" };

export interface RecoverySweepResult {
  ok: boolean;
  credits: CreditResult;
  storage: StorageResult;
}

/**
 * External wake-up entry point for the existing bounded recovery workers.
 * Each lane runs independently so one failure cannot prevent the other retry.
 * Existing fencing, transaction locks and provenance checks remain authoritative
 * when this overlaps a startup/interval worker or another API instance.
 */
export async function runRecoverySweep(): Promise<RecoverySweepResult> {
  let credits: CreditResult = { status: "disabled" };
  let storage: StorageResult = { status: "unconfigured" };

  if (subscriptionsEnabled()) {
    try {
      credits = { status: "completed", recovered: await reconcileStaleCartridgeCredits() };
    } catch (err) {
      logger.error({ err }, "Scheduled Cartridge credit recovery failed");
      credits = { status: "failed" };
    }
  }

  if (process.env.PRIVATE_OBJECT_DIR) {
    try {
      // Never accept a caller-supplied deletion flag. The existing operator
      // opt-in remains the sole authority, and absence means report-only.
      const report = await recoverPreparationStorage({
        dryRun: process.env.PREPARATION_ORPHAN_RECOVERY_APPLY !== "true",
      });
      storage = { status: report.errors > 0 ? "failed" : "completed", report };
    } catch (err) {
      logger.error({ err }, "Scheduled private preparation recovery failed");
      storage = { status: "failed" };
    }
  }

  return {
    ok: credits.status !== "failed" && storage.status !== "failed",
    credits,
    storage,
  };
}
