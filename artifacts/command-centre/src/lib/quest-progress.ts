import type { BadgeProgress } from "@workspace/api-client-react";

/**
 * A display of counted requirements, not an eligibility or award decision.
 * Surplus work in one category cannot satisfy another category's requirement.
 */
export function questCompletion(badge: Pick<BadgeProgress, "progress" | "requirements">) {
  const entries = Object.entries(badge.requirements);
  let unknown = entries.length === 0;
  const requirements = entries.flatMap(([key, target]) => {
    if (!Number.isFinite(target) || target <= 0) {
      unknown = true;
      return [];
    }
    const value = badge.progress[key];
    const current = Number.isFinite(value) ? Math.max(0, value) : 0;
    return [{ key, current, target }];
  });
  const total = requirements.reduce((sum, item) => sum + item.target, 0);
  const completed = requirements.reduce((sum, item) => sum + Math.min(item.current, item.target), 0);
  return {
    percent: unknown || !Number.isFinite(total) || total <= 0
      ? null
      : Math.min(100, Math.floor(completed / total * 100)),
    requirements,
  };
}
