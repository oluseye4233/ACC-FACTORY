import type { QueryClient } from "@tanstack/react-query";
import {
  getGetExemplarQueryKey,
  getGetSphinxCatalogQueryKey,
  getGetSphinxMarketplaceStatusQueryKey,
  getListExemplarsQueryKey,
} from "@workspace/api-client-react";

export const CATALOG_STALE_MS = 30_000;

export async function invalidateCatalog(qc: QueryClient, id?: string) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: getListExemplarsQueryKey() }),
    qc.invalidateQueries({ queryKey: getGetSphinxCatalogQueryKey() }),
    qc.invalidateQueries({ queryKey: getGetSphinxMarketplaceStatusQueryKey() }),
    id ? qc.invalidateQueries({ queryKey: getGetExemplarQueryKey(id) }) : Promise.resolve(),
  ]);
}
