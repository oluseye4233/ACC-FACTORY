// Single source of truth for whether public billing flows are active.
// Set to false for investor demos / private previews — pricing CTAs become
// "Request access" mailto links and the Billing page hides the Stripe portal
// button. The backend endpoints stay wired (they already return 503 gracefully
// when Stripe is unavailable), so flipping this back to true at GA is a
// one-line change.
export const BILLING_ENABLED = false;

// Where "Request access" CTAs send the user when BILLING_ENABLED is false.
// Replace with your real intake email before sharing the preview URL.
export const ACCESS_REQUEST_EMAIL = "access@atanda.example";
