/**
 * ARK-X issuer wire-claim fixture. Keep claim spelling/casing and the numeric
 * protocol version aligned with the issuer contract (not an ACC-local alias).
 */
export const arkXHiveGoldWireClaims = {
  iss: "ark-x",
  aud: "acc-factory",
  eligibility: "hive_gold",
  discountPercent: 50,
  sub: "ark-subject-123",
  jti: "assertion-123",
  version: 1,
} as const;