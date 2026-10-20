/** Match the current destination, including the two operations views. */
export function isCurrentDestination(href: string, pathname: string, search: string) {
  const [destination, query] = href.split("?");
  if (destination === "/sessions" && pathname.startsWith("/session/")) return true;
  if (pathname !== destination && !pathname.startsWith(`${destination}/`)) return false;
  if (!query) return true;
  const expected = new URLSearchParams(query);
  const actual = new URLSearchParams(search);
  // Operations defaults to IMPRIMA when no recognized kind is selected.
  if (destination === "/operations" && !["imprima", "short-sprints"].includes(actual.get("kind") ?? "")) {
    actual.set("kind", "imprima");
  }
  return [...expected].every(([key, value]) => actual.get(key) === value);
}

/** Focus the existing page landmark without adding it to ordinary tab order. */
export function focusMainContent() {
  const main = document.querySelector<HTMLElement>("main");
  if (!main) return false;
  if (!main.id) main.id = "main-content";
  if (!main.hasAttribute("tabindex")) main.tabIndex = -1;
  main.focus({ preventScroll: true });
  main.scrollIntoView?.({ block: "start", behavior: "auto" });
  return true;
}
