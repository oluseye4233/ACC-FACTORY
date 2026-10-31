import { useState } from "react";
import {
  usePrepareAutoCommandOrder, getGetAutoCommandWorkspaceQueryKey,
  type AutoCommandDraft, type AutoCommandOrder,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function AutoCommandOrders({ drafts, orders }: { drafts: AutoCommandDraft[]; orders: AutoCommandOrder[] }) {
  const prepare = usePrepareAutoCommandOrder();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  async function freeze(draftId: string) {
    setError("");
    try {
      await prepare.mutateAsync({ data: { draftId } });
      await queryClient.invalidateQueries({ queryKey: getGetAutoCommandWorkspaceQueryKey() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Order could not be confirmed. Retry the same draft; it will not create a duplicate.");
    }
  }
  const available = drafts.filter(draft => !orders.some(order => order.draftId === draft.id));
  return <section className="mt-10 border-t pt-8" aria-labelledby="production-orders-heading">
    <h3 id="production-orders-heading" className="font-display text-3xl">Your production orders</h3>
    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
      Prepare an order from a saved brief to freeze its input and see its applicable production stages.
      This does not start paid generation, take payment or claim your free package.
      Checkout and package delivery are not open yet.
    </p>
    {available.length > 0 && <ul className="mt-4 space-y-2">
      {available.map(draft => <li key={draft.id} className="flex flex-wrap items-center justify-between gap-3 border p-3">
        <span>{draft.projectName}<span className="ml-2 text-xs text-muted-foreground">Saved {new Date(draft.createdAt).toLocaleString()}</span></span>
        <button type="button" disabled={prepare.isPending} onClick={() => void freeze(draft.id)}
          className="border px-4 py-2 text-sm disabled:opacity-50" data-testid={`prepare-order-${draft.id}`}>
          {prepare.isPending && prepare.variables?.data.draftId === draft.id ? "Preparing…" : "Prepare production order"}
        </button>
      </li>)}
    </ul>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {orders.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No prepared orders yet. Save a brief first.</p>}
    <div className="mt-4 space-y-4">
      {orders.map(order => <article key={order.id} className="border bg-card p-4" data-testid={`production-order-${order.id}`}>
        <h4 className="font-display text-2xl">{order.projectName}</h4>
        <p className="mt-1 text-sm">{order.state === "AWAITING_AUTHORIZATION"
          ? "Intake checked. Waiting for production authorization — no generation has started."
          : order.state.replace(/_/g, " ")}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {order.completedStages} / {order.totalStages} preparation and production steps saved.
          This is not a payment or delivery confirmation.
        </p>
        <progress className="mt-2 h-2 w-full accent-primary" value={order.completedStages} max={order.totalStages}
          aria-label={`${order.projectName}: saved stage progress`} />
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {order.stages.map(stage => <li key={stage.key} className="border p-2 text-sm">
            <strong>{stage.key}</strong> · {stage.title}
            <span className="block text-xs text-muted-foreground">{stage.state === "COMPLETE" ? "Complete" :
              stage.state === "PENDING" ? "Not started" : stage.state.replace(/_/g, " ")}</span>
          </li>)}
        </ol>
        <p className="mt-3 break-all font-mono text-[11px] text-muted-foreground">Order {order.id} · Snapshot {order.snapshotHash}</p>
        <p className="mt-1 text-xs text-muted-foreground">To change the brief, save a new draft and prepare a new order. This order retains the original input.</p>
      </article>)}
    </div>
  </section>;
}
