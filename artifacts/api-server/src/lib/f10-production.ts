import { and, desc, eq, sql } from "drizzle-orm";
import { db, f10AttemptsTable, f10DestinationsTable, f10DlqTable, f10ReceiptsTable, f10ReleaseRequestsTable, f10ReleaseTransitionsTable, f9MechaRunsTable, osirisCustodiesTable } from "@workspace/db";
import { canonicalF9Payload, verifyF9Hmac, createSafeHttpsAdapter } from "./f10";
import type { F10Store, Receipt } from "./f10-service";

export function envSecretProvider(allow = /^F10_SECRET_[A-Z0-9_]+$/u) {
  return { async get(ref:string) { if(!allow.test(ref)) throw new Error("secret reference is not allowlisted"); const value=process.env[ref]; if(!value) throw new Error("secret reference is unavailable"); return value; } };
}
export function createF10ProductionStore(): F10Store {
  return {
    async getRelease(id, tenantId) {
      const [r]=await db.select().from(f10ReleaseRequestsTable).where(and(eq(f10ReleaseRequestsTable.id,id),eq(f10ReleaseRequestsTable.tenantId,tenantId))).limit(1);
      if(!r) return null;
      const [last]=await db.select({nextAttemptAt:f10AttemptsTable.nextAttemptAt,state:f10AttemptsTable.state}).from(f10AttemptsTable).where(eq(f10AttemptsTable.releaseId,id)).orderBy(desc(f10AttemptsTable.attempt)).limit(1);
       const [receipt]=await db.select({payload:f10ReceiptsTable.receiptPayload}).from(f10ReceiptsTable).where(eq(f10ReceiptsTable.releaseId,id)).limit(1);
       return {...r,nextAttemptAt:last?.state==="RETRYABLE"?last.nextAttemptAt:null,receipt:receipt?.payload as Receipt|undefined};
    },
    async getDestination(tenantId,id) { const [d]=await db.select().from(f10DestinationsTable).where(and(eq(f10DestinationsTable.id,id),eq(f10DestinationsTable.tenantId,tenantId))).limit(1); return d; },
    async getArtifact(tenantId, publicId) {
      const runs=await db.select().from(f9MechaRunsTable).where(and(eq(f9MechaRunsTable.userId,tenantId),eq(f9MechaRunsTable.status,"EMITTED")));
      const run=runs.find(x=>(x.artifactContent as Record<string,unknown>|null)?.machine_artifact_id===publicId); if(!run) return null;
       const content=run.artifactContent as Record<string,any>; const [c]=await db.select().from(osirisCustodiesTable).where(and(eq(osirisCustodiesTable.machineArtifactId,publicId),eq(osirisCustodiesTable.ownerUserId,tenantId))).limit(1); if(!c) return null;
      const active=["active","recovered"].includes(c.custodyState)&&c.expiresAt>new Date();
       return {machineArtifactId:publicId,mechaRunId:run.mechaRunId,artifactVersion:run.artifactVersion,mediaType:c.mediaType,spkId:String(content.spk_id??""),custodyRef:c.id,payloadHash:run.payloadHash!,artifactSignature:run.artifactSignature!,signingKeyPem:"",signatureSecret:process.env.SESSION_SECRET,expiresAt:c.expiresAt,custodyActive:active,ucgVerdict:String(content.ucg_certificate?.verdict??"FAIL"),mmVerdict:String(content.mm_verdict??"FAIL"),savantVerdict:String(content.savant_verdict??"FAIL"),envelope:{machine_artifact_id:publicId,mecha_run_id:run.mechaRunId,artifact_version:run.artifactVersion,media_type:c.mediaType,spk_id:String(content.spk_id??""),ucg_certificate:{verdict:String(content.ucg_certificate?.verdict??"FAIL"),expires_at:c.expiresAt.toISOString(),signature:run.artifactSignature!},payload_hash:run.payloadHash!,artifact_signature:run.artifactSignature!,osiris_custody_attestation:{osiris_custody:active,expires_at:c.expiresAt.toISOString(),signature:c.sourceSignature}},_content:content,_sourceArtifactId:run.sourceArtifactId};
    },
    async transition(id,from,to,reason,fence) { await db.transaction(async tx=>{ const where=from?and(eq(f10ReleaseRequestsTable.id,id),eq(f10ReleaseRequestsTable.state,from)):eq(f10ReleaseRequestsTable.id,id); const [r]=await tx.update(f10ReleaseRequestsTable).set({state:to,updatedAt:new Date()}).where(where).returning({policyVersion:f10ReleaseRequestsTable.policyVersion}); if(!r) throw new Error("invalid state transition"); await tx.insert(f10ReleaseTransitionsTable).values({releaseId:id,fromState:from,toState:to,reason,attemptToken:fence??null,policyVersion:r.policyVersion}); }); },
    async claimAttempt(id,fence,attempt) { return db.transaction(async tx=>{ const [changed]=await tx.update(f10ReleaseRequestsTable).set({state:"DISPATCHING",attemptCount:sql`${f10ReleaseRequestsTable.attemptCount}+1`,updatedAt:new Date()}).where(and(eq(f10ReleaseRequestsTable.id,id),eq(f10ReleaseRequestsTable.state,"QUEUED"))).returning({attemptCount:f10ReleaseRequestsTable.attemptCount,policyVersion:f10ReleaseRequestsTable.policyVersion}); if(!changed) return false; await tx.insert(f10AttemptsTable).values({releaseId:id,attempt:changed.attemptCount,fenceToken:fence,state:"CLAIMED",nextAttemptAt:attempt.nextAttemptAt,deadline:attempt.deadline}); await tx.insert(f10ReleaseTransitionsTable).values({releaseId:id,fromState:"QUEUED",toState:"DISPATCHING",reason:"fenced attempt claimed",attemptToken:fence,policyVersion:changed.policyVersion}); return true; }); },
    async finalizeAttempt(id,fence,state,result,nextAttemptAt) { const rows=await db.update(f10AttemptsTable).set({state,resultClass:result,...(nextAttemptAt?{nextAttemptAt}:{})}).where(and(eq(f10AttemptsTable.releaseId,id),eq(f10AttemptsTable.fenceToken,fence),eq(f10AttemptsTable.state,"CLAIMED"))).returning({id:f10AttemptsTable.id}); return Boolean(rows[0]); },
    async finalizeSuccessfulAttempt(id,fence,receipt:Receipt) {
      return db.transaction(async tx => {
        // The fenced CLAIMED update is the write barrier. Nothing else in this
        // transaction may happen unless this worker owns that attempt.
        const [attempt] = await tx.update(f10AttemptsTable).set({state:"ACKNOWLEDGED",resultClass:"accepted"}).where(and(eq(f10AttemptsTable.releaseId,id),eq(f10AttemptsTable.fenceToken,fence),eq(f10AttemptsTable.state,"CLAIMED"))).returning({id:f10AttemptsTable.id});
        if (!attempt) return {status:"STALE" as const};
        const inserted = await tx.insert(f10ReceiptsTable).values({releaseId:id,payloadHash:String(receipt.payload_hash),destinationIdentity:String(receipt.destination_identity),adapterId:String(receipt.adapter_id),adapterVersion:String(receipt.adapter_version),attempt:Number(receipt.attempt),downstreamReceiptId:receipt.downstream_receipt_id?String(receipt.downstream_receipt_id):null,policyHash:String(receipt.snapshot_policy_hash),receiptSignature:String(receipt.f10_receipt_signature),receiptPayload:receipt}).onConflictDoNothing().returning({id:f10ReceiptsTable.id});
        let authoritative: Receipt = receipt;
        if (!inserted[0]) {
          const [existing] = await tx.select({payload:f10ReceiptsTable.receiptPayload}).from(f10ReceiptsTable).where(eq(f10ReceiptsTable.releaseId,id)).limit(1);
          if (existing?.payload) authoritative = existing.payload as Receipt;
        }
        const [release] = await tx.update(f10ReleaseRequestsTable).set({state:"ACKNOWLEDGED",updatedAt:new Date()}).where(and(eq(f10ReleaseRequestsTable.id,id),eq(f10ReleaseRequestsTable.state,"DISPATCHING"))).returning({policyVersion:f10ReleaseRequestsTable.policyVersion});
        if (!release) throw new Error("release is no longer dispatching");
        await tx.insert(f10ReleaseTransitionsTable).values({releaseId:id,fromState:"DISPATCHING",toState:"ACKNOWLEDGED",reason:"downstream receipt accepted",attemptToken:fence,policyVersion:release.policyVersion});
        return {status:"ACKNOWLEDGED" as const,receipt:authoritative};
      });
    },
    async deadLetter(id,reason,attempts) { await db.insert(f10DlqTable).values({releaseId:id,reason,attempts}).onConflictDoNothing(); },
  };
}
export function createF10CustodyProvider(tenantId:string, artifactId:string) {
   return { async active(ref:string) { const [c]=await db.select().from(osirisCustodiesTable).where(and(eq(osirisCustodiesTable.id,ref),eq(osirisCustodiesTable.ownerUserId,tenantId))).limit(1); return Boolean(c&&["active","recovered"].includes(c.custodyState)&&c.expiresAt>new Date()); }, async load(ref:string) { const [c]=await db.select().from(osirisCustodiesTable).where(and(eq(osirisCustodiesTable.id,ref),eq(osirisCustodiesTable.ownerUserId,tenantId))).limit(1); const [run]=await db.select().from(f9MechaRunsTable).where(and(eq(f9MechaRunsTable.userId,tenantId),eq(f9MechaRunsTable.id,c?.machineArtifactId??""))).limit(1); if(!c||!run || run.id !== c.machineArtifactId) throw new Error("custody does not match F9 artifact"); if(c.sourceHash !== run.payloadHash || c.sourceSignature !== run.artifactSignature || c.artifactVersion !== run.artifactVersion) throw new Error("custody snapshot does not match F9 artifact"); const content={...(run.artifactContent as Record<string,unknown>)}; delete content.payload_hash; delete content.artifact_signature; return Buffer.from(canonicalF9Payload(content)); } };
}
export function createF10Adapters(secret=envSecretProvider()) { return { get(id:string,version:string,endpoint:string,secretRef:string) { return createSafeHttpsAdapter(secret,{id,version,endpoint,secretRef}); } }; }