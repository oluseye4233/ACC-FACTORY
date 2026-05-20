// Investor-preview mode. When VITE_DEMO_MODE === "true":
//   - The landing CTA points to /demo (the 7-stage dummy-data walkthrough)
//     instead of /sign-up.
//   - A persistent yellow banner is rendered above every page making it
//     unambiguous that the visitor is looking at sample data, not a live
//     system.
//   - The signed-out TopNav drops Sign In / INITIATE and surfaces a single
//     "VIEW THE DEMO" CTA so investors never hit an auth wall.
//
// The flag is read at bundle time (Vite env), so flipping it requires a
// rebuild — exactly what we want for an explicit investor-preview deploy
// that is provably distinct from go-live.
export const DEMO_MODE =
  (import.meta.env.VITE_DEMO_MODE as string | undefined) === "true";
