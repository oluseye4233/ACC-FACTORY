import { randomUUID, createHash, createHmac } from "node:crypto";
import { retryDelay, type AdapterResult, type F10ReleaseAdapter, validateArtifact, type F10ArtifactRecord, type F10Custody, type ReadonlyEnvelope } from "./f10";
export type ServiceState = "REQUESTED"|"VERIFYING"|"AUTHORIZED"|"QUEUED"|"DISPATCHING"|"ACKNOWLEDGED"|"BLOCKED"|"FAILED_PERMANENT"|"DEAD_LETTERED";
export type Attempt = { number: number; fence: string; deadline: Date; nextAttemptAt: Date; resultClass?: string };
export type Receipt = Record<string, unknown> & { f10_receipt_signature: string };
export type F10Store = {
  getRelease(id: string, tenantId: string): Promise<any>;
  getArtifact(tenantId: string, machineArtifactId: string): Promise<F10ArtifactRecord & { machineArtifactId:string; mechaRunId:string; artifactVersion:string; mediaType:string; spkId:string } | null>;
  getDestination(tenantId: string, id: string): Promise<any>;
  transition(id:string, from:ServiceState|null, to:ServiceState, reason:string, fence?:string):Promise<void>;
  claimAttempt(id:string, fence:string, attempt:Attempt):Promise<boolean>;
  finalizeAttempt(id:string,fence:string,state:"SUCCEEDED"|"RETRYABLE"|"PERMANENT",result:string,nextAttemptAt?:Date):Promise<boolean>;
  finalizeSuccessfulAttempt(id:string, fence:string, receipt:Receipt):Promise<{status:"ACKNOWLEDGED"|"STALE"; receipt?:Receipt}>;
  deadLetter(id:string, reason:string, attempts:number):Promise<void>;
};
export type F10ServiceDeps = { store:F10Store; custody:F10Custody; adapters:Map<string,F10ReleaseAdapter>; secret:{ get(ref:string):Promise<string> }; signingSecret:string; now?:()=>Date; maxAttempts?:number; validateArtifact?: (a:F10ArtifactRecord,c:F10Custody,n:Date)=>Promise<Uint8Array> };

export class F10ReleaseService {
  private readonly now:()=>Date;
  constructor(private readonly d:F10ServiceDeps) { this.now=d.now ?? (()=>new Date()); }
  async process(id:string, tenantId:string):Promise<{state:ServiceState; receipt?:Receipt}> {
    const r=await this.d.store.getRelease(id,tenantId); if(!r) throw new Error("release not found");
    if (r.state==="ACKNOWLEDGED" || r.state==="DEAD_LETTERED" || r.state==="FAILED_PERMANENT") return {state:r.state,receipt:r.receipt};
    if (r.nextAttemptAt && new Date(r.nextAttemptAt) > this.now()) return {state:"QUEUED"};
    const a=await this.d.store.getArtifact(tenantId,r.machineArtifactId), dest=await this.d.store.getDestination(tenantId,r.destinationRef);
    if(!a || !dest || !dest.active) { await this.d.store.transition(id,r.state,"BLOCKED","artifact/custody/destination unavailable or revoked"); return {state:"BLOCKED"}; }
    const adapter=this.d.adapters.get(dest.adapterId); if(!adapter) { await this.d.store.transition(id,r.state,"FAILED_PERMANENT","adapter unavailable"); return {state:"FAILED_PERMANENT"}; }
    let bytes:Uint8Array;
    try { bytes=await (this.d.validateArtifact ?? validateArtifact)(a,this.d.custody,this.now()); } catch(e) { await this.d.store.transition(id,r.state,"BLOCKED",e instanceof Error?e.message:"validation failed"); return {state:"BLOCKED"}; }
    // Re-read revocation and custody immediately before adapter I/O.
    const freshDest=await this.d.store.getDestination(tenantId,r.destinationRef);
    const freshArtifact=await this.d.store.getArtifact(tenantId,r.machineArtifactId);
    if(!freshDest?.active || !freshArtifact?.custodyActive) { await this.d.store.transition(id,r.state,"BLOCKED","revoked immediately before dispatch"); return {state:"BLOCKED"}; }
    const attemptNo=(r.attemptCount??0)+1, fence=randomUUID(), deadline=new Date(this.now().getTime()+30_000);
    const claimed=await this.d.store.claimAttempt(id,fence,{number:attemptNo,fence,deadline,nextAttemptAt:this.now()});
    if(!claimed) return {state:r.state};
    try {
      await adapter.validate(freshDest.endpoint);
      await this.d.secret.get(freshDest.secretRef); // resolve to prove reference is valid; never place secret in envelope/logs
      const result=await adapter.deliver(
        freshArtifact.envelope ?? ({...r,envelopeBytes:bytes} as ReadonlyEnvelope),
        `${r.idempotencyKey}`,
        deadline,
      );
      if (!result.accepted) {
        await this.d.store.finalizeAttempt(id,fence,"PERMANENT","downstream did not accept receipt");
        await this.d.store.transition(id,"DISPATCHING","FAILED_PERMANENT","downstream receipt was not accepted",fence);
        return {state:"FAILED_PERMANENT"};
      }
      const receiptBase={receipt_id:`F10-REC-${randomUUID()}`,release_id:id,spk_id:freshArtifact.spkId,machine_artifact_id:freshArtifact.machineArtifactId,artifact_version:freshArtifact.artifactVersion,payload_hash:freshArtifact.payloadHash,destination_identity:dest.id,adapter_id:dest.adapterId,adapter_version:dest.adapterVersion,attempt:attemptNo,timestamp:this.now().toISOString(),downstream_status:result.accepted?"accepted":"rejected",downstream_receipt_id:result.downstreamReceiptId??null,snapshot_policy_hash:r.policyHash};
      const receipt={...receiptBase,f10_receipt_signature:createHmac("sha256",this.d.signingSecret).update(JSON.stringify(receiptBase)).digest("hex")} as Receipt;
       const acknowledged=await this.d.store.finalizeSuccessfulAttempt(id,fence,receipt);
       if (acknowledged.status==="STALE") return {state:"QUEUED"};
       return {state:"ACKNOWLEDGED",receipt:acknowledged.receipt ?? receipt};
    } catch(e) {
      const cls=adapter.classify(e);
      if(cls==="permanent") {
        await this.d.store.finalizeAttempt(id,fence,"PERMANENT",cls);
        await this.d.store.transition(id,"DISPATCHING","FAILED_PERMANENT","permanent adapter failure",fence);
        return {state:"FAILED_PERMANENT"};
      }
      const max=this.d.maxAttempts??5;
      if(attemptNo>=max) {
        await this.d.store.finalizeAttempt(id,fence,"RETRYABLE",cls);
        await this.d.store.deadLetter(id,"retry exhaustion",attemptNo);
        await this.d.store.transition(id,"DISPATCHING","DEAD_LETTERED","retry exhaustion",fence);
        return {state:"DEAD_LETTERED"};
      }
      const delay=retryDelay(attemptNo);
      await this.d.store.finalizeAttempt(id,fence,"RETRYABLE",cls,new Date(this.now().getTime()+delay));
      await this.d.store.transition(id,"DISPATCHING","QUEUED",`retry scheduled after ${delay}ms`,fence); return {state:"QUEUED"};
    }
  }
}