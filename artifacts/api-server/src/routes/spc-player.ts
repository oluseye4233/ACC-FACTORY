import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import dns from "node:dns/promises";
import https from "node:https";
import net from "node:net";
import { and, asc, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  exemplarLibraryItemsTable,
  spcDevKitsTable,
  spcLibraryCardsTable,
  spcPlayerDraftRunsTable,
  spcPlayerRunsTable,
  spcPlayerWebhookAuthorizationsTable,
    harnessArtifactsTable,
  type LlmProvider,
} from "@workspace/db";
import {
  AuthorizeSpcPlayerWebhookBody,
  AuthorizeSpcPlayerWebhookParams,
  CreateSpcPlayerRunBody,
  DeliverSpcPlayerRunParams,
  DownloadSpcPlayerRunParams,
  ExecuteSpcPlayerRunBody,
  ExecuteSpcPlayerRunParams,
  GetSpcPlayerRunManifestParams,
  GetSpcPlayerRunParams,
} from "@workspace/api-zod";
import { buildArtifactFilename } from "@workspace/artifact-naming";
import { requireAuth } from "../lib/auth";
import { getCostBudgetDenial, requireCostBudget } from "../lib/cost-budget";
import {
  callLlmJson,
  resolveProvider,
  sendProviderTierError,
} from "../engines/shared";
import { spcPlayerRegistry } from "../lib/spc-player";
import { getExemplar, listExemplars } from "../data/exemplars";

const router: IRouter = Router();

const GOVERNANCE = {
  specVersion: "v4.0" as const,
  source: "user-authorized REVERB v3 derivation (conservative generic SPC Player adaptation)",
  scorePolicy: {
    axes: ["clarity", "truthfulness", "detectability"] as const,
  },
};

const PLAN_ONLY_DISTRIBUTION = {
  status: "plan_only" as const,
  connectorInvoked: false as const,
  externalSend: false as const,
};

// A provider call is expected to finish well inside this lease. The lease is
// deliberately conservative so a slow provider cannot be reclaimed while its
// worker is still making progress; the attempt token remains the hard fence.
const EXECUTION_LEASE_MS = 15 * 60 * 1000;
const MAX_KIT_DECK_CARDS = 12;
const MAX_EXEMPLAR_SEARCH_TEXT = 16_000;

const StageOutputSchema = z
  .object({
    verdict: z.string().min(1),
    content: z.string(),
    evidence: z.array(z.string()).default([]),
  })
  .strict();

const GovernanceOutputSchema = z
  .object({
    verdict: z.string().min(1),
    content: z.string(),
    evidence: z.array(z.string()).default([]),
    scores: z
      .object({
        clarity: z.number().int().min(0).max(100),
        truthfulness: z.number().int().min(0).max(100),
        detectability: z.number().int().min(0).max(100),
      })
      .strict(),
  })
  .strict();

type StageResult = {
  stageIndex: number;
  cardId: string;
  cardSlug: string;
  invoked: true;
  verdict: string;
  content: string;
  evidence: string[];
  completedAt: string;
};

type GovernanceEvaluation = {
  kind: "governance_evaluation";
  invoked: true;
  verdict: string;
  content: string;
  evidence: string[];
  scores: {
    clarity: number;
    truthfulness: number;
    detectability: number;
  };
  completedAt: string;
};

type Transition = { from: string; to: string; at: string; reason?: string };

function executionAdvisory(
  profile: "full" | "rapid",
  stages: StageResult[],
  governanceEvaluationInvoked = false,
) {
  return {
    authority: "user-authorized REVERB v3 derivation" as const,
    status: "PRE_BUILD" as const,
    profile,
    invokedStages: stages.map((stage) => stage.stageIndex),
    governanceEvaluationInvoked,
    evidenceTrail: stages.flatMap((stage) =>
      stage.evidence.length > 0
        ? stage.evidence
        : [`stage ${stage.stageIndex} (${stage.cardSlug}) returned verdict: ${stage.verdict}`],
    ),
    distribution: "plan-only; no connector invoked" as const,
  };
}

function classifyIntake(brief: string) {
  const normalized = brief.trim().toLowerCase();
  const kind = normalized.includes("bug") || normalized.includes("fix")
    ? "remediation"
    : normalized.includes("plan") || normalized.includes("design")
      ? "planning"
      : normalized.includes("review") || normalized.includes("audit")
        ? "review"
        : "general";
  return {
    kind,
    classification: kind,
    summary: brief.trim(),
    classifiedBy: "deterministic intake classifier",
  };
}

type DraftRow = typeof spcPlayerDraftRunsTable.$inferSelect;
type ExecutionRow = typeof spcPlayerRunsTable.$inferSelect;
type ExecutionUpdate = Partial<ExecutionRow>;

type ExecutionClaim =
  | { kind: "claimed"; execution: ExecutionRow; attemptToken: string }
  | { kind: "completed"; execution: ExecutionRow }
  | { kind: "busy"; execution: ExecutionRow };

function leaseUntil(now = new Date()): Date {
  return new Date(now.getTime() + EXECUTION_LEASE_MS);
}

async function claimExecution(
  draft: DraftRow,
  existing: ExecutionRow | undefined,
  userId: string,
  profile: "full" | "rapid",
  snapshots: Array<Record<string, unknown>>,
  structuredBrief: Record<string, unknown>,
): Promise<ExecutionClaim> {
  const now = new Date();
  const attemptToken = randomUUID();
  const initialTransitions: Transition[] = [
    { from: "DRAFT", to: "RUNNING", at: now.toISOString() },
  ];
  const initialValues = {
    id: draft.id,
    userId,
    selectedExemplar: snapshots,
    profile,
    structuredBrief,
    status: "running" as const,
    stageResults: [],
    governanceEvaluation: null,
    attemptToken,
    leaseExpiresAt: leaseUntil(now),
    transitions: initialTransitions,
    outputPackage: null,
    clarityScore: null,
    truthfulnessScore: null,
    detectabilityScore: null,
    executionAdvisory: executionAdvisory(profile, []),
    distributionPlan: PLAN_ONLY_DISTRIBUTION,
    error: null,
    completedAt: null,
    updatedAt: now,
  };

  if (!existing) {
    const [inserted] = await db
      .insert(spcPlayerRunsTable)
      .values(initialValues)
      .onConflictDoNothing({ target: spcPlayerRunsTable.id })
      .returning();
    if (inserted) return { kind: "claimed", execution: inserted, attemptToken };
  }

  const [current] = await db
    .select()
    .from(spcPlayerRunsTable)
    .where(
      and(
        eq(spcPlayerRunsTable.id, draft.id),
        eq(spcPlayerRunsTable.userId, userId),
      ),
    )
    .limit(1);
  if (current?.status === "completed") return { kind: "completed", execution: current };
  if (
    current?.status === "running"
    && current.leaseExpiresAt
    && current.leaseExpiresAt > now
  ) {
    return { kind: "busy", execution: current };
  }

  const recoveryTransition: Transition = {
    from: current?.status?.toUpperCase() ?? "DRAFT",
    to: "RUNNING",
    at: now.toISOString(),
    ...(current?.status === "running"
      ? { reason: "lease_expired_recovery" }
      : { reason: "retry" }),
  };
  const [reclaimed] = await db
    .update(spcPlayerRunsTable)
    .set({
      selectedExemplar: snapshots,
      profile,
      structuredBrief,
      status: "running",
      stageResults: [],
      governanceEvaluation: null,
      attemptToken,
      leaseExpiresAt: leaseUntil(now),
      transitions: [
        ...((current?.transitions ?? []) as Transition[]),
        recoveryTransition,
      ],
      outputPackage: null,
      clarityScore: null,
      truthfulnessScore: null,
      detectabilityScore: null,
      executionAdvisory: executionAdvisory(profile, []),
      distributionPlan: PLAN_ONLY_DISTRIBUTION,
      error: null,
      completedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(spcPlayerRunsTable.id, draft.id),
        eq(spcPlayerRunsTable.userId, userId),
        or(
          eq(spcPlayerRunsTable.status, "failed"),
          and(
            eq(spcPlayerRunsTable.status, "running"),
            or(
              isNull(spcPlayerRunsTable.leaseExpiresAt),
              lte(spcPlayerRunsTable.leaseExpiresAt, now),
            ),
          ),
        ),
      ),
    )
    .returning();
  if (reclaimed) return { kind: "claimed", execution: reclaimed, attemptToken };

  const [afterRace] = await db
    .select()
    .from(spcPlayerRunsTable)
    .where(
      and(
        eq(spcPlayerRunsTable.id, draft.id),
        eq(spcPlayerRunsTable.userId, userId),
      ),
    )
    .limit(1);
  if (afterRace?.status === "completed") return { kind: "completed", execution: afterRace };
  return { kind: "busy", execution: afterRace ?? current! };
}

async function fencedUpdate(
  executionId: string,
  userId: string,
  attemptToken: string,
  values: ExecutionUpdate,
): Promise<ExecutionRow | undefined> {
  const [updated] = await db
    .update(spcPlayerRunsTable)
    .set(values)
    .where(
      and(
        eq(spcPlayerRunsTable.id, executionId),
        eq(spcPlayerRunsTable.userId, userId),
        eq(spcPlayerRunsTable.attemptToken, attemptToken),
        eq(spcPlayerRunsTable.status, "running"),
      ),
    )
    .returning();
  return updated;
}

function runResponse(row: DraftRow, execution?: ExecutionRow) {
  const stages = (execution?.stageResults ?? []) as StageResult[];
  const now = new Date();
  const isRunning = execution?.status === "running";
  const hasActiveLease = Boolean(
    isRunning
    && execution?.leaseExpiresAt
    && execution.leaseExpiresAt > now,
  );
  const executionState = !execution
    ? "IDLE"
    : execution.status === "completed"
      ? "FINISHED"
      : isRunning
        ? hasActiveLease
          ? "ACTIVE"
          : "RECOVERABLE"
        : "IDLE";
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    sourceArtifactId: row.sourceArtifactId,
    title: row.title,
    brief: row.brief,
    selectedCardIds: row.selectedCardIds,
    profile: (execution?.profile ?? row.profile ?? "full") as "full" | "rapid",
    status: execution?.status
      ? execution.status.toUpperCase()
      : row.status,
    executionState,
    canExecute: !execution || execution.status === "failed" || (isRunning && !hasActiveLease),
    retryAvailableAt: isRunning && execution?.leaseExpiresAt
      ? execution.leaseExpiresAt.toISOString()
      : null,
    governance: row.governance,
    stageResults: stages,
    governanceEvaluation: execution?.governanceEvaluation ?? null,
    executionAdvisory: execution?.executionAdvisory ?? null,
    distributionPlan: execution?.distributionPlan ?? PLAN_ONLY_DISTRIBUTION,
    error: execution?.error ?? null,
    transitions: (execution?.transitions ?? []) as Transition[],
    completedAt: execution?.completedAt?.toISOString() ?? null,
    outputPackage: execution?.outputPackage ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: (execution?.updatedAt ?? row.updatedAt).toISOString(),
  };
}

function cardResponse(row: typeof spcLibraryCardsTable.$inferSelect) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    provenance: row.provenance,
    status: row.status,
    preBuild: row.preBuild,
    cheatSheetPublished: row.cheatSheetPublished,
    cheatSheet: row.cheatSheet,
    thirdPartyDefinitions: row.thirdPartyDefinitions,
  };
}

function exemplarCardSlug(id: string): string {
  return `exemplar-${id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

async function syncExemplarSpcCards(): Promise<void> {
  const curated = listExemplars()
    .filter((item) => item.kind === "SPC")
    .map((item) => {
      const full = getExemplar(item.id);
      return {
        id: item.id,
        title: item.title,
        tagline: item.tagline,
        body: full?.body ?? `${item.title}\n${item.tagline}`,
        marketplace: "curated",
      };
    });
  const contributed = await db
    .select()
    .from(exemplarLibraryItemsTable)
    .where(eq(exemplarLibraryItemsTable.kind, "SPC"))
    .orderBy(desc(exemplarLibraryItemsTable.createdAt));
  const exemplars = [
    ...curated,
    ...contributed.map((item) => ({
      id: item.id,
      title: item.title,
      tagline: item.tagline,
      body: item.body,
      marketplace: "open",
    })),
  ];
  if (exemplars.length === 0) return;

  await db.transaction(async (tx) => {
    for (const exemplar of exemplars) {
      const searchText = `${exemplar.title}\n${exemplar.tagline}\n${exemplar.body}`
        .slice(0, MAX_EXEMPLAR_SEARCH_TEXT);
      await tx
        .insert(spcLibraryCardsTable)
        .values({
          slug: exemplarCardSlug(exemplar.id),
          name: exemplar.title,
          provenance: {
            source: "exemplar-library",
            version: "1",
            status: "published",
            exemplarId: exemplar.id,
            marketplace: exemplar.marketplace,
            tagline: exemplar.tagline,
            searchText,
          },
          status: "PRE_BUILD",
          preBuild: true,
          cheatSheetPublished: false,
        })
        .onConflictDoUpdate({
          target: spcLibraryCardsTable.slug,
          set: {
            name: exemplar.title,
            provenance: {
              source: "exemplar-library",
              version: "1",
              status: "published",
              exemplarId: exemplar.id,
              marketplace: exemplar.marketplace,
              tagline: exemplar.tagline,
              searchText,
            },
            updatedAt: new Date(),
          },
        });
    }
  });
}

function publicIpv4(ip: string): boolean {
  const octets = ip.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }
  const [a, b, c] = octets as [number, number, number, number];
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function ipv6Value(ip: string): bigint | null {
  let normalized = ip.toLowerCase();
  const mappedIpv4 = normalized.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4) {
    if (!net.isIPv4(mappedIpv4[2]!)) return null;
    const octets = mappedIpv4[2]!.split(".").map(Number);
    normalized = `${mappedIpv4[1]}${((octets[0]! << 8) | octets[1]!).toString(16)}:${((octets[2]! << 8) | octets[3]!).toString(16)}`;
  }
  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) {
    return null;
  }
  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n);
}

function inIpv6Range(value: bigint, base: bigint, prefix: number): boolean {
  return value >> BigInt(128 - prefix) === base >> BigInt(128 - prefix);
}

function publicIpv6(ip: string): boolean {
  const value = ipv6Value(ip);
  if (value === null) return false;
  const mappedBase = 0xffffn << 32n;
  if (inIpv6Range(value, mappedBase, 96)) {
    const mapped = Number(value & 0xffffffffn);
    return publicIpv4(
      `${mapped >>> 24}.${(mapped >>> 16) & 255}.${(mapped >>> 8) & 255}.${mapped & 255}`,
    );
  }
  const globalUnicast = inIpv6Range(value, 0x2000n << 112n, 3);
  const documentation = inIpv6Range(value, 0x20010db8n << 96n, 32);
  const benchmarking = inIpv6Range(value, 0x200100020000n << 80n, 48);
  return globalUnicast && !documentation && !benchmarking;
}

export function publicAddress(ip: string): boolean {
  return net.isIPv4(ip) ? publicIpv4(ip) : net.isIPv6(ip) ? publicIpv6(ip) : false;
}

type ValidatedWebhookDestination = {
  url: URL;
  address: string;
  family: 4 | 6;
};

async function safeWebhookDestination(
  value: string,
): Promise<ValidatedWebhookDestination | null> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname === "metadata.google.internal"
  ) {
    return null;
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(hostname)) {
    return publicAddress(hostname)
      ? { url, address: hostname, family: net.isIPv4(hostname) ? 4 : 6 }
      : null;
  }
  try {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some(({ address }) => !publicAddress(address))) {
      return null;
    }
    const selected = addresses[0]!;
    if (selected.family !== 4 && selected.family !== 6) return null;
    return { url, address: selected.address, family: selected.family };
  } catch {
    return null;
  }
}

async function pinnedHttpsPost(
  destination: ValidatedWebhookDestination,
  payload: Record<string, unknown>,
): Promise<number> {
  const body = Buffer.from(JSON.stringify(payload));
  const hostname = destination.url.hostname.replace(/^\[|\]$/g, "");
  return new Promise<number>((resolve, reject) => {
    const request = https.request(
      {
        protocol: "https:",
        hostname,
        port: destination.url.port || 443,
        method: "POST",
        path: `${destination.url.pathname}${destination.url.search}`,
        servername: net.isIP(hostname) ? undefined : hostname,
        headers: {
          host: destination.url.host,
          "content-type": "application/json",
          "content-length": body.byteLength,
        },
        lookup: (_lookupHostname, _options, callback) => {
          callback(null, destination.address, destination.family);
        },
      },
      (response) => {
        response.resume();
        response.once("end", () => resolve(response.statusCode ?? 502));
      },
    );
    request.setTimeout(10_000, () => request.destroy(new Error("Webhook delivery timed out")));
    request.once("error", reject);
    request.end(body);
  });
}

export const spcPlayerWebhookTransport = {
  post: pinnedHttpsPost,
};

async function ownedRun(
  runId: string,
  ownerUserId: string,
): Promise<{ draft: DraftRow; execution?: ExecutionRow } | undefined> {
  const [draft] = await db
    .select()
    .from(spcPlayerDraftRunsTable)
    .where(
      and(
        eq(spcPlayerDraftRunsTable.id, runId),
        eq(spcPlayerDraftRunsTable.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);
  if (!draft) return undefined;
  const [execution] = await db
    .select()
    .from(spcPlayerRunsTable)
    .where(
      and(
        eq(spcPlayerRunsTable.id, runId),
        eq(spcPlayerRunsTable.userId, ownerUserId),
      ),
    )
    .limit(1);
  return { draft, execution };
}

async function persistFailure(
  executionId: string,
  userId: string,
  profile: "full" | "rapid",
  stages: StageResult[],
  transitions: Transition[],
  error: string,
  attemptToken: string,
  reason?: string,
): Promise<boolean> {
  const now = new Date();
  const updated = await fencedUpdate(executionId, userId, attemptToken, {
      status: "failed",
      stageResults: stages,
      governanceEvaluation: null,
      transitions: [
        ...transitions,
        {
          from: "RUNNING",
          to: "FAILED",
          at: now.toISOString(),
          ...(reason ? { reason } : {}),
        },
      ],
      executionAdvisory: executionAdvisory(profile, stages),
      distributionPlan: PLAN_ONLY_DISTRIBUTION,
      error,
      leaseExpiresAt: null,
      updatedAt: now,
    });
  return Boolean(updated);
}

router.get("/spc-player/registry", (_req, res): void => {
  res.json(spcPlayerRegistry());
});

router.get(
  "/spc-player/catalog",
  requireAuth,
  async (_req, res): Promise<void> => {
    await syncExemplarSpcCards();
    const cards = await db
      .select()
      .from(spcLibraryCardsTable)
      .orderBy(asc(spcLibraryCardsTable.createdAt));
    res.json(cards.map(cardResponse));
  },
);

router.get(
  "/spc-player/dev-kit",
  requireAuth,
  async (_req, res): Promise<void> => {
    const [registry] = await db
      .select()
      .from(spcDevKitsTable)
      .where(eq(spcDevKitsTable.name, "SPC Dev Kit"))
      .limit(1);
    if (!registry || !Array.isArray(registry.cardIds)) {
      res.status(503).json({ error: "SPC Dev Kit registry is unavailable" });
      return;
    }

    const cardIds = registry.cardIds;
    if (
      cardIds.length !== 6 ||
      !cardIds.every((id): id is string => typeof id === "string") ||
      new Set(cardIds).size !== cardIds.length
    ) {
      res.status(503).json({ error: "SPC Dev Kit registry is invalid" });
      return;
    }

    const cardRows = await db
      .select()
      .from(spcLibraryCardsTable)
      .where(inArray(spcLibraryCardsTable.id, cardIds));
    const cardsById = new Map(cardRows.map((card) => [card.id, card]));
    const orderedCards = cardIds
      .map((cardId) => cardsById.get(cardId));
    if (orderedCards.some((card) => !card)) {
      res.status(503).json({ error: "SPC Dev Kit registry references missing cards" });
      return;
    }

    res.json({
      id: registry.id,
      name: registry.name,
      cardIds,
      cards: orderedCards.map((card) => cardResponse(card!)),
      registrationNote: registry.registrationNote,
      executes: false,
    });
  },
);

router.get(
  "/spc-player/runs",
  requireAuth,
  async (req, res): Promise<void> => {
    const drafts = await db
      .select()
      .from(spcPlayerDraftRunsTable)
      .where(eq(spcPlayerDraftRunsTable.ownerUserId, req.localUser!.id))
      .orderBy(desc(spcPlayerDraftRunsTable.updatedAt));
    const ids = drafts.map((draft) => draft.id);
    const executions = ids.length
      ? await db
          .select()
          .from(spcPlayerRunsTable)
          .where(
            and(
              eq(spcPlayerRunsTable.userId, req.localUser!.id),
              inArray(spcPlayerRunsTable.id, ids),
            ),
          )
      : [];
    const byId = new Map(executions.map((execution) => [execution.id, execution]));
    res.json(drafts.map((draft) => runResponse(draft, byId.get(draft.id))));
  },
);

router.post(
  "/spc-player/runs",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = CreateSpcPlayerRunBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid SPC Player draft", issues: parsed.error.issues });
      return;
    }

    const selectedCardIds = parsed.data.selectedCardIds;
    const uniqueCardIds = [...new Set(selectedCardIds)];
    if (uniqueCardIds.length !== selectedCardIds.length) {
      res.status(400).json({ error: "A KIT DECK cannot contain the same SPC more than once" });
      return;
    }
    if (selectedCardIds.length > MAX_KIT_DECK_CARDS) {
      res.status(400).json({
        error: `A KIT DECK can contain at most ${MAX_KIT_DECK_CARDS} SPCs`,
      });
      return;
    }
    const cards = await db
      .select({ id: spcLibraryCardsTable.id })
      .from(spcLibraryCardsTable)
      .where(inArray(spcLibraryCardsTable.id, uniqueCardIds));
    if (cards.length !== uniqueCardIds.length) {
      res.status(400).json({ error: "One or more SPC card references are unknown" });
      return;
    }

    let sourceArtifact: typeof harnessArtifactsTable.$inferSelect | undefined;
    if (parsed.data.sourceArtifactId) {
      [sourceArtifact] = await db
        .select()
        .from(harnessArtifactsTable)
        .where(
          and(
            eq(harnessArtifactsTable.id, parsed.data.sourceArtifactId),
            eq(harnessArtifactsTable.userId, req.localUser!.id),
          ),
        )
        .limit(1);
      if (!sourceArtifact) {
        res.status(404).json({ error: "Source artifact not found" });
        return;
      }
    }

    const [run] = await db
      .insert(spcPlayerDraftRunsTable)
      .values({
        ownerUserId: req.localUser!.id,
        sourceArtifactId: parsed.data.sourceArtifactId ?? null,
        title: parsed.data.title,
        brief: parsed.data.brief,
        selectedCardIds,
        profile: parsed.data.profile ?? "full",
        status: "DRAFT",
        governance: GOVERNANCE,
        outputPackage: null,
      })
      .returning();
    res.status(201).json(runResponse(run!));
  },
);

router.get(
  "/spc-player/runs/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = GetSpcPlayerRunParams.safeParse({ id: req.params.id });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid SPC Player run id" });
      return;
    }
    const owned = await ownedRun(parsed.data.id, req.localUser!.id);
    if (!owned) {
      res.status(404).json({ error: "SPC Player run not found" });
      return;
    }
    res.json(runResponse(owned.draft, owned.execution));
  },
);

router.post(
  "/spc-player/runs/:id/execute",
  requireAuth,
  requireCostBudget,
  async (req, res): Promise<void> => {
    const parsed = ExecuteSpcPlayerRunParams.safeParse({ id: req.params.id });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid SPC Player run id" });
      return;
    }
    const owned = await ownedRun(parsed.data.id, req.localUser!.id);
    if (!owned) {
      res.status(404).json({ error: "SPC Player run not found" });
      return;
    }
    const input = ExecuteSpcPlayerRunBody.safeParse(req.body ?? {});
    if (!input.success) {
      res.status(400).json({ error: "Invalid SPC Player execution input", issues: input.error.issues });
      return;
    }
    const profile = (owned.execution?.profile ?? owned.draft.profile ?? "full") as "full" | "rapid";

    let sourceArtifact: typeof harnessArtifactsTable.$inferSelect | undefined;
    if (owned.draft.sourceArtifactId) {
      [sourceArtifact] = await db
        .select()
        .from(harnessArtifactsTable)
        .where(
          and(
            eq(harnessArtifactsTable.id, owned.draft.sourceArtifactId),
            eq(harnessArtifactsTable.userId, req.localUser!.id),
          ),
        )
        .limit(1);
      if (!sourceArtifact) {
        res.status(404).json({ error: "Source artifact not found" });
        return;
      }
    }

    const cardRows = await db
      .select()
      .from(spcLibraryCardsTable)
      .where(inArray(spcLibraryCardsTable.id, owned.draft.selectedCardIds as string[]));
    const cardsById = new Map(cardRows.map((card) => [card.id, card]));
    const orderedCards = (owned.draft.selectedCardIds as string[])
      .map((cardId) => cardsById.get(cardId));
    if (orderedCards.some((card) => !card)) {
      res.status(400).json({ error: "One or more SPC card references are unknown" });
      return;
    }

    const stages: StageResult[] = [];
    const snapshots = orderedCards.map((card) => ({
      id: card!.id,
      slug: card!.slug,
      name: card!.name,
      provenance: card!.provenance,
    }));
    const structuredBrief = {
      ...classifyIntake(owned.draft.brief),
      title: owned.draft.title,
      selectedCardOrder: owned.draft.selectedCardIds,
      sourceArtifact: sourceArtifact
        ? {
            id: sourceArtifact.id,
            sessionId: sourceArtifact.sessionId,
            artifactType: sourceArtifact.artifactType,
            name: sourceArtifact.name,
            artifactContent: sourceArtifact.artifactContent,
          }
        : null,
    };
    const claim = await claimExecution(
      owned.draft,
      owned.execution,
      req.localUser!.id,
      profile,
      snapshots,
      structuredBrief,
    );
    if (claim.kind === "completed") {
      res.json(runResponse(owned.draft, claim.execution));
      return;
    }
    if (claim.kind === "busy") {
      res.status(409).json({ error: "SPC Player run is already executing" });
      return;
    }
    const execution = claim.execution;
    const attemptToken = claim.attemptToken;
    const transitions = (execution.transitions ?? []) as Transition[];

    let provider: LlmProvider = "claude";
    let governanceEvaluation: GovernanceEvaluation | null = null;
    const stopIfCostCapReached = async (): Promise<boolean> => {
      const denial = await getCostBudgetDenial(req, req.localUser!.id);
      if (!denial) return false;
      const failedPersisted = await persistFailure(
        execution.id,
        req.localUser!.id,
        profile,
        stages,
        transitions,
        denial.body.error,
        attemptToken,
        "monthly_cost_cap_reached",
      );
      if (!failedPersisted) {
        res.status(409).json({ error: "SPC Player execution attempt was superseded" });
      } else {
        res.status(denial.status).json(denial.body);
      }
      return true;
    };
    try {
      provider = resolveProvider(req, input.data.provider, "claude");
      for (let index = 0; index < orderedCards.length; index += 1) {
        if (await stopIfCostCapReached()) return;
        const card = orderedCards[index]!;
        const result = await callLlmJson(
          provider,
          `You are executing one generic SPC Player card in a conservative PRE_BUILD runtime derived from a user-authorized REVERB v3 source. Do not invent card-specific editorial behavior. Return the card's own verdict unchanged, concise useful content, and evidence. Execution profile: ${profile}.`,
          [
            `Brief:\n${owned.draft.brief}`,
            `Card: ${card.name} (${card.slug})`,
            `Card responsibility metadata: ${JSON.stringify(card.provenance)}`,
            "Execute only this card. Do not claim any other stage was invoked.",
            sourceArtifact
              ? `SOURCE PROJECT ARTIFACT (${sourceArtifact.artifactType}${sourceArtifact.name ? ` · ${sourceArtifact.name}` : ""}):\n${JSON.stringify(sourceArtifact.artifactContent)}\nUse this artifact as the primary project context for this card.`
              : null,
          ]
            .filter(Boolean)
            .join("\n\n"),
          StageOutputSchema,
          { sessionId: null, userId: req.localUser!.id, engineId: 30 },
        );
        stages.push({
          stageIndex: index,
          cardId: card.id,
          cardSlug: card.slug,
          invoked: true,
          verdict: result.verdict,
          content: result.content,
          evidence: result.evidence,
          completedAt: new Date().toISOString(),
        });
        const stageAdvisory = executionAdvisory(profile, stages);
        const progressed = await fencedUpdate(execution.id, req.localUser!.id, attemptToken, {
          stageResults: stages,
          executionAdvisory: stageAdvisory,
          leaseExpiresAt: leaseUntil(),
          updatedAt: new Date(),
        });
        if (!progressed) {
          res.status(409).json({ error: "SPC Player execution attempt was superseded" });
          return;
        }
      }
      if (await stopIfCostCapReached()) return;
      const evaluation = await callLlmJson(
        provider,
        "You are the final governance evaluator for a conservative generic SPC Player run derived from a user-authorized REVERB v3 source. Evaluate only the retained card results below. Return independent integer scores from 0 through 100 for clarity, truthfulness, and detectability. Never return a composite score.",
        `Brief:\n${owned.draft.brief}\n\nRetained card results:\n${JSON.stringify(stages)}`,
        GovernanceOutputSchema,
        { sessionId: null, userId: req.localUser!.id, engineId: 30 },
      );
      governanceEvaluation = {
        kind: "governance_evaluation",
        invoked: true,
        verdict: evaluation.verdict,
        content: evaluation.content,
        evidence: evaluation.evidence,
        scores: evaluation.scores,
        completedAt: new Date().toISOString(),
      };
      const evaluated = await fencedUpdate(execution.id, req.localUser!.id, attemptToken, {
        governanceEvaluation,
        executionAdvisory: executionAdvisory(profile, stages, true),
        leaseExpiresAt: leaseUntil(),
        updatedAt: new Date(),
      });
      if (!evaluated) {
        res.status(409).json({ error: "SPC Player execution attempt was superseded" });
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "SPC Player provider execution failed";
      const failedPersisted = await persistFailure(
        execution.id,
        req.localUser!.id,
        profile,
        stages,
        transitions,
        message,
        attemptToken,
      );
      if (!failedPersisted) {
        res.status(409).json({ error: "SPC Player execution attempt was superseded" });
        return;
      }
      if (sendProviderTierError(res, err)) {
        return;
      }
      const failed = await ownedRun(execution.id, req.localUser!.id);
      res.status(502).json(failed ? runResponse(failed.draft, failed.execution) : { error: message });
      return;
    }

    const advisory = executionAdvisory(profile, stages, true);
    const completedAt = new Date();
    const outputPackage = {
      content: stages,
      governanceEvaluation,
      advisory,
      scores: governanceEvaluation!.scores,
      distributionPlan: PLAN_ONLY_DISTRIBUTION,
    };
    const completed = await fencedUpdate(execution.id, req.localUser!.id, attemptToken, {
        status: "completed",
        stageResults: stages,
        governanceEvaluation,
        executionAdvisory: advisory,
        distributionPlan: PLAN_ONLY_DISTRIBUTION,
        outputPackage,
        clarityScore: governanceEvaluation!.scores.clarity,
        truthfulnessScore: governanceEvaluation!.scores.truthfulness,
        detectabilityScore: governanceEvaluation!.scores.detectability,
        error: null,
        transitions: [...transitions, { from: "RUNNING", to: "COMPLETED", at: completedAt.toISOString() }],
        completedAt,
        leaseExpiresAt: null,
        updatedAt: completedAt,
      });
    if (!completed) {
      const current = await ownedRun(execution.id, req.localUser!.id);
      if (current?.execution?.status === "completed") {
        res.json(runResponse(current.draft, current.execution));
      } else {
        res.status(409).json({ error: "SPC Player execution attempt was superseded" });
      }
      return;
    }
    res.json(runResponse(owned.draft, completed));
  },
);

router.get(
  "/spc-player/runs/:id/authorize",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = GetSpcPlayerRunManifestParams.safeParse({ id: req.params.id });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid SPC Player run id" });
      return;
    }
    const owned = await ownedRun(parsed.data.id, req.localUser!.id);
    if (!owned) {
      res.status(404).json({ error: "SPC Player run not found" });
      return;
    }
    const [grant] = await db
      .select()
      .from(spcPlayerWebhookAuthorizationsTable)
      .where(eq(spcPlayerWebhookAuthorizationsTable.runId, owned.draft.id))
      .limit(1);
    res.json({
      authorized: Boolean(grant),
      connector: "webhook" as const,
      endpoint: grant?.endpoint ?? null,
      authorizedAt: grant?.authorizedAt.toISOString() ?? null,
    });
  },
);

router.post(
  "/spc-player/runs/:id/authorize",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = AuthorizeSpcPlayerWebhookParams.safeParse({ id: req.params.id });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid SPC Player run id" });
      return;
    }
    const owned = await ownedRun(parsed.data.id, req.localUser!.id);
    if (!owned) {
      res.status(404).json({ error: "SPC Player run not found" });
      return;
    }
    const body = AuthorizeSpcPlayerWebhookBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid webhook endpoint", issues: body.error.issues });
      return;
    }
    const destination = await safeWebhookDestination(body.data.endpoint);
    if (!destination) {
      res.status(400).json({ error: "Webhook endpoint must be a public HTTPS destination" });
      return;
    }
    const authorizedAt = new Date();
    const [grant] = await db
      .insert(spcPlayerWebhookAuthorizationsTable)
      .values({ runId: owned.draft.id, endpoint: destination.url.toString(), authorizedAt })
      .onConflictDoUpdate({
        target: spcPlayerWebhookAuthorizationsTable.runId,
        set: { endpoint: destination.url.toString(), authorizedAt },
      })
      .returning();
    res.json({
      connector: "webhook" as const,
      endpoint: grant!.endpoint,
      authorizedAt: grant!.authorizedAt.toISOString(),
    });
  },
);

router.post(
  "/spc-player/runs/:id/deliver",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = DeliverSpcPlayerRunParams.safeParse({ id: req.params.id });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid SPC Player run id" });
      return;
    }
    const owned = await ownedRun(parsed.data.id, req.localUser!.id);
    if (!owned) {
      res.status(404).json({ error: "SPC Player run not found" });
      return;
    }
    const execution = owned.execution;
    if (!execution?.outputPackage || execution.status !== "completed") {
      res.status(400).json({ error: "SPC Player run must be executed before delivery" });
      return;
    }
    const [grant] = await db
      .select()
      .from(spcPlayerWebhookAuthorizationsTable)
      .where(eq(spcPlayerWebhookAuthorizationsTable.runId, owned.draft.id))
      .limit(1);
    if (!grant) {
      res.status(400).json({ error: "Webhook authorization is required before delivery" });
      return;
    }
    const destination = await safeWebhookDestination(grant.endpoint);
    if (!destination) {
      res.status(400).json({ error: "Webhook endpoint is no longer a safe public destination" });
      return;
    }
    try {
      const statusCode = await spcPlayerWebhookTransport.post(
        destination,
        {
          ...(execution.outputPackage as Record<string, unknown>),
          connector: "webhook",
          action: "deliver",
          format: "json",
        },
      );
      if (statusCode < 200 || statusCode >= 300) {
        req.log.warn({ runId: owned.draft.id, statusCode }, "SPC Player webhook returned failure");
        res.status(502).json({ error: "Webhook delivery failed", statusCode });
        return;
      }
      res.json({
        runId: owned.draft.id,
        connector: "webhook" as const,
        deliveredAt: new Date().toISOString(),
        statusCode,
      });
    } catch (error) {
      req.log.warn({ err: error, runId: owned.draft.id }, "SPC Player webhook delivery failed");
      res.status(502).json({ error: "Webhook delivery failed" });
    }
  },
);

router.get(
  "/spc-player/runs/:id/download",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = DownloadSpcPlayerRunParams.safeParse({ id: req.params.id });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid SPC Player run id" });
      return;
    }
    const owned = await ownedRun(parsed.data.id, req.localUser!.id);
    if (!owned) {
      res.status(404).json({ error: "SPC Player run not found" });
      return;
    }
    if (!owned.execution?.outputPackage) {
      res.status(400).json({ error: "SPC Player run has not been executed" });
      return;
    }
    const filename = buildArtifactFilename({
      type: "SPC_PLAYER",
      title: owned.draft.title || owned.draft.brief,
      id: owned.draft.id,
      extension: "json",
    });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.type("application/json").send(JSON.stringify(owned.execution.outputPackage, null, 2));
  },
);

router.get(
  "/spc-player/runs/:id/manifest",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = GetSpcPlayerRunManifestParams.safeParse({ id: req.params.id });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid SPC Player run id" });
      return;
    }
    const owned = await ownedRun(parsed.data.id, req.localUser!.id);
    if (!owned) {
      res.status(404).json({ error: "SPC Player run not found" });
      return;
    }

    const manifest = {
      manifestVersion: "spc-player-manifest-v2" as const,
      run: runResponse(owned.draft, owned.execution),
      governance: owned.draft.governance,
      capabilities: {
        connectors: ["download", "webhook"] as const,
        actions: ["execute", "deliver"] as const,
        formats: ["json"] as const,
        entitlement: "open_access" as const,
      },
    };
    const filename = buildArtifactFilename({
      type: "SPC_PLAYER_MANIFEST",
      title: owned.draft.title || owned.draft.brief,
      id: owned.draft.id,
      extension: "json",
    });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.type("application/json").send(JSON.stringify(manifest, null, 2));
  },
);

export default router;
