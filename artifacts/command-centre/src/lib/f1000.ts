// Shared types + storage key for the F1000 ("First 1000") soft-launch promo.

export const F1000_PENDING_KEY = "f1000PendingInvite";

export type F1000StatusResult = {
  total: number;
  claimed: number;
  remaining: number;
  open: boolean;
};

export type F1000ActivateResult = {
  code: string;
  seq: number;
  signupPath: string;
};

export type F1000RedeemResult = {
  ok: true;
  seq: number;
  alreadyRedeemed: boolean;
};
