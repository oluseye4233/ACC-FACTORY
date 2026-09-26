import express, {
  Router,
  type IRouter,
  type RequestHandler,
} from "express";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import {
  db,
  harnessEngineRunsTable,
  providerBillingReportsTable,
  providerBillingReportLinesTable,
} from "@workspace/db";
import {
  AdminGetProviderBillingReportParams,
  AdminGetProviderBillingReportResponse,
  AdminImportProviderBillingReportHeader,
  AdminImportProviderBillingReportParams,
  AdminImportProviderBillingReportResponse,
} from "@workspace/api-zod";
import { requireAdmin, requireAuth } from "../lib/auth";
import {
  isMaterialProviderDifference,
  parseProviderBillingCsv,
} from "../lib/provider-billing";

const router: IRouter = Router();
const CSV_MAX_BYTES = 1_000_000;
const textCsvParser = express.text({
  type: ["text/csv", "application/csv"],
  limit: CSV_MAX_BYTES,
});
const parseCsvBody: RequestHandler = (req, res, next) => {
  textCsvParser(req, res, (error?: unknown) => {
    if (!error) {
      next();
      return;
    }
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status: unknown }).status)
        : 0;
    if (status === 413) {
      res.status(413).json({ error: "CSV is larger than the 1 MB upload limit." });
      return;
    }
    next(error);
  });
};

function utcMonthRange(month: string): { start: Date; end: Date; monthStart: string } {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  return {
    start,
    end: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)),
    monthStart: `${month}-01`,
  };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function usd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Math.abs(value));
}

router.get(
  "/admin/provider-billing/:month",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsedParams = AdminGetProviderBillingReportParams.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: "Month must use YYYY-MM format." });
      return;
    }
    const { month } = parsedParams.data;
    const range = utcMonthRange(month);

    const [estimateRows, reports] = await Promise.all([
      db
        .select({
          provider: harnessEngineRunsTable.provider,
          modelId: harnessEngineRunsTable.modelId,
          amountUsd: sql<string>`COALESCE(SUM(${harnessEngineRunsTable.costUsd}), 0)::numeric`,
        })
        .from(harnessEngineRunsTable)
        .where(
          and(
            gte(harnessEngineRunsTable.createdAt, range.start),
            lt(harnessEngineRunsTable.createdAt, range.end),
          ),
        )
        .groupBy(harnessEngineRunsTable.provider, harnessEngineRunsTable.modelId),
      db
        .select({
          id: providerBillingReportsTable.id,
          provider: providerBillingReportsTable.provider,
          fileName: providerBillingReportsTable.fileName,
          importedAt: providerBillingReportsTable.importedAt,
        })
        .from(providerBillingReportsTable)
        .where(eq(providerBillingReportsTable.billingMonth, range.monthStart)),
    ]);

    const reportIds = reports.map((report) => report.id);
    const billingLines =
      reportIds.length === 0
        ? []
        : await db
            .select({
              reportId: providerBillingReportLinesTable.reportId,
              modelId: providerBillingReportLinesTable.modelId,
              amountUsd: providerBillingReportLinesTable.amountUsd,
            })
            .from(providerBillingReportLinesTable)
            .where(inArray(providerBillingReportLinesTable.reportId, reportIds));

    const estimatesByProvider = new Map<
      string,
      Map<string, { modelId: string; amountUsd: number }>
    >();
    for (const row of estimateRows) {
      const provider = row.provider.toLowerCase();
      const byModel = estimatesByProvider.get(provider) ?? new Map();
      const modelKey = row.modelId.toLowerCase();
      const current = byModel.get(modelKey);
      if (current) current.amountUsd += Number(row.amountUsd) || 0;
      else byModel.set(modelKey, { modelId: row.modelId, amountUsd: Number(row.amountUsd) || 0 });
      estimatesByProvider.set(provider, byModel);
    }

    const reportById = new Map(reports.map((report) => [report.id, report]));
    const reportsByProvider = new Map(reports.map((report) => [report.provider, report]));
    const billedByProvider = new Map<
      string,
      Map<string, { modelId: string; amountUsd: number }>
    >();
    for (const line of billingLines) {
      const report = reportById.get(line.reportId);
      if (!report) continue;
      const byModel = billedByProvider.get(report.provider) ?? new Map();
      const modelKey = line.modelId.toLowerCase();
      const current = byModel.get(modelKey);
      if (current) current.amountUsd += Number(line.amountUsd) || 0;
      else byModel.set(modelKey, { modelId: line.modelId, amountUsd: Number(line.amountUsd) || 0 });
      billedByProvider.set(report.provider, byModel);
    }

    const providers = [...new Set([...estimatesByProvider.keys(), ...reportsByProvider.keys()])]
      .sort()
      .map((provider) => {
        const estimatedModels = estimatesByProvider.get(provider) ?? new Map();
        const billedModels = billedByProvider.get(provider) ?? new Map();
        const report = reportsByProvider.get(provider);
        const reportUploaded = Boolean(report);
        const modelKeys = new Set([...estimatedModels.keys(), ...billedModels.keys()]);
        const models = [...modelKeys]
          .map((modelKey) => {
            const estimated = estimatedModels.get(modelKey);
            const billed = billedModels.get(modelKey);
            const estimatedUsd = estimated?.amountUsd ?? 0;
            const reportedUsd = reportUploaded ? (billed?.amountUsd ?? 0) : null;
            const differenceUsd =
              reportedUsd === null ? null : reportedUsd - estimatedUsd;
            const modelId = estimated?.modelId ?? billed?.modelId ?? modelKey;
            let explanation = "Not compared because this provider has no uploaded bill.";
            if (differenceUsd !== null) {
              if (Math.abs(differenceUsd) < 0.0000005) {
                explanation = "Reported amount matches the internal estimate.";
              } else if (differenceUsd > 0) {
                explanation = `Provider reported ${usd(differenceUsd)} more than the internal estimate for ${modelId}.`;
              } else if (reportedUsd === 0) {
                explanation = `The internal estimate for ${modelId} has no matching model line in the uploaded bill.`;
              } else {
                explanation = `The internal estimate is ${usd(differenceUsd)} higher than the provider-reported amount for ${modelId}.`;
              }
            }
            return {
              modelId,
              estimatedUsd,
              reportedUsd,
              differenceUsd,
              explanation,
              materialDifference:
                differenceUsd !== null &&
                reportedUsd !== null &&
                isMaterialProviderDifference(estimatedUsd, reportedUsd),
            };
          })
          .sort((a, b) => Math.abs(b.differenceUsd ?? 0) - Math.abs(a.differenceUsd ?? 0));

        const estimatedUsd = sum([...estimatedModels.values()].map((model) => model.amountUsd));
        const reportedUsd = reportUploaded
          ? sum([...billedModels.values()].map((model) => model.amountUsd))
          : null;
        const differenceUsd = reportedUsd === null ? null : reportedUsd - estimatedUsd;
        const largestModelGap = models.find((model) => (model.differenceUsd ?? 0) !== 0);
        let explanation = "No provider bill has been uploaded for this month.";
        if (reportedUsd !== null && differenceUsd !== null) {
          if (Math.abs(differenceUsd) < 0.0000005) {
            explanation = "Provider total matches the internal estimate.";
          } else {
            const direction = differenceUsd > 0 ? "higher" : "lower";
            explanation = `Provider total is ${usd(differenceUsd)} ${direction} than the internal estimate.`;
            if (largestModelGap) {
              explanation += ` Largest model-level gap: ${largestModelGap.modelId}.`;
            }
            if (!isMaterialProviderDifference(estimatedUsd, reportedUsd)) {
              explanation += " Below the material-difference threshold.";
            }
          }
        }

        return {
          provider,
          reportUploaded,
          fileName: report?.fileName ?? null,
          importedAt: report?.importedAt.toISOString() ?? null,
          estimatedUsd,
          reportedUsd,
          differenceUsd,
          materialDifference:
            differenceUsd !== null &&
            reportedUsd !== null &&
            isMaterialProviderDifference(estimatedUsd, reportedUsd),
          explanation,
          models,
        };
      });

    const coveredProviders = providers.filter((provider) => provider.reportUploaded);
    const estimatedUsd = sum(providers.map((provider) => provider.estimatedUsd));
    const reportedUsd =
      coveredProviders.length === 0
        ? null
        : sum(coveredProviders.map((provider) => provider.reportedUsd ?? 0));
    const comparedEstimatedUsd = sum(
      coveredProviders.map((provider) => provider.estimatedUsd),
    );
    const differenceUsd =
      reportedUsd === null ? null : reportedUsd - comparedEstimatedUsd;

    res.json(
      AdminGetProviderBillingReportResponse.parse({
        month,
        estimatedUsd,
        reportedUsd,
        comparedEstimatedUsd,
        differenceUsd,
        materialDifferenceCount: coveredProviders.filter(
          (provider) => provider.materialDifference,
        ).length,
        providers,
      }),
    );
  },
);

router.post(
  "/admin/provider-billing/:month",
  requireAuth,
  requireAdmin,
  parseCsvBody,
  async (req, res): Promise<void> => {
    const parsedParams = AdminImportProviderBillingReportParams.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: "Month must use YYYY-MM format." });
      return;
    }
    const parsedHeader = AdminImportProviderBillingReportHeader.safeParse({
      "X-Report-Filename": req.header("X-Report-Filename"),
    });
    if (!parsedHeader.success) {
      res.status(400).json({ error: "Report filename must be 255 characters or fewer." });
      return;
    }
    if (typeof req.body !== "string" || req.body.length === 0) {
      res.status(400).json({ error: "Upload a non-empty CSV using the text/csv content type." });
      return;
    }

    let lines: ReturnType<typeof parseProviderBillingCsv>;
    try {
      lines = parseProviderBillingCsv(req.body);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "The billing CSV could not be read.",
      });
      return;
    }

    const { month } = parsedParams.data;
    const monthStart = `${month}-01`;
    const providers = [...new Set(lines.map((line) => line.provider))].sort();
    const rawFilename =
      parsedHeader.data["X-Report-Filename"]?.trim() || "provider-billing.csv";
    const fileName =
      rawFilename.replace(/[\\/\r\n\0]/g, "_").slice(0, 255) ||
      "provider-billing.csv";
    const linesByProvider = new Map<string, typeof lines>();
    for (const line of lines) {
      const providerLines = linesByProvider.get(line.provider) ?? [];
      providerLines.push(line);
      linesByProvider.set(line.provider, providerLines);
    }

    const replacedProviders = await db.transaction(async (tx) => {
      const existing = await tx
        .select({
          id: providerBillingReportsTable.id,
          provider: providerBillingReportsTable.provider,
        })
        .from(providerBillingReportsTable)
        .where(
          and(
            eq(providerBillingReportsTable.billingMonth, monthStart),
            inArray(providerBillingReportsTable.provider, providers),
          ),
        );
      const existingByProvider = new Map(
        existing.map((report) => [report.provider, report.id]),
      );

      for (const provider of providers) {
        let reportId = existingByProvider.get(provider);
        if (reportId) {
          await tx
            .update(providerBillingReportsTable)
            .set({
              fileName,
              uploadedBy: req.localUser!.id,
              importedAt: new Date(),
            })
            .where(eq(providerBillingReportsTable.id, reportId));
          await tx
            .delete(providerBillingReportLinesTable)
            .where(eq(providerBillingReportLinesTable.reportId, reportId));
        } else {
          const [inserted] = await tx
            .insert(providerBillingReportsTable)
            .values({
              provider,
              billingMonth: monthStart,
              fileName,
              uploadedBy: req.localUser!.id,
            })
            .returning({ id: providerBillingReportsTable.id });
          reportId = inserted!.id;
        }

        const providerLines = linesByProvider.get(provider)!;
        await tx.insert(providerBillingReportLinesTable).values(
          providerLines.map((line) => ({
            reportId: reportId!,
            modelId: line.modelId,
            amountUsd: line.amountUsd,
          })),
        );
      }

      return providers.filter((provider) => existingByProvider.has(provider));
    });

    req.log.info(
      {
        adminUserId: req.localUser!.id,
        month,
        providers,
        importedLines: lines.length,
        replacedProviders,
      },
      "Admin imported provider billing report",
    );
    res.json(
      AdminImportProviderBillingReportResponse.parse({
        month,
        providers,
        importedLines: lines.length,
        replacedProviders,
      }),
    );
  },
);

export default router;