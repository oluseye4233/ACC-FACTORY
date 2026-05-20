import type { ContextCraftBadge } from "@workspace/api-client-react";

const PILLAR_NAME: Record<ContextCraftBadge["pillar"], string> = {
  SYSTEM: "System",
  ROLE: "Role",
  INSTRUCTION: "Instruction",
  DATA: "Data",
  FORMAT: "Format",
  EXAMPLE: "Example",
  CONSTRAINT: "Constraint",
};

interface Props {
  badge: ContextCraftBadge;
  size?: number;
  showLabel?: boolean;
  title?: string;
}

export function PillarTriangle({
  badge,
  size = 56,
  showLabel = true,
  title,
}: Props) {
  const earned = badge.earned;
  const stroke = earned ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.4)";
  const fill = earned ? "hsl(var(--primary) / 0.18)" : "transparent";
  const textColor = earned ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.6)";
  const w = size;
  const h = Math.round(size * 0.92); // equilateral-ish

  const tooltipBase = `${PILLAR_NAME[badge.pillar]} — ${
    earned
      ? `Earned · best score ${badge.bestScore}/${badge.maxScore}`
      : `Locked · reach ${badge.threshold}/${badge.maxScore} on F1 or F2 to unlock`
  }`;
  const tooltip = title ?? tooltipBase;

  return (
    <div
      className={`inline-flex flex-col items-center gap-1 ${
        earned ? "" : "opacity-60"
      }`}
      title={tooltip}
      data-testid={`pillar-${badge.pillar.toLowerCase()}`}
    >
      <svg
        width={w}
        height={h}
        viewBox="0 0 100 92"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={tooltip}
        role="img"
      >
        <polygon
          points="50,6 96,86 4,86"
          fill={fill}
          stroke={stroke}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <text
          x="50"
          y="68"
          textAnchor="middle"
          fontFamily="var(--font-display, ui-sans-serif)"
          fontSize="38"
          fontWeight={700}
          fill={textColor}
        >
          {badge.letter}
        </text>
        {earned && (
          <circle
            cx={82}
            cy={20}
            r={7}
            fill="hsl(var(--primary))"
            stroke="hsl(var(--background))"
            strokeWidth={2}
          />
        )}
      </svg>
      <span className="sr-only">{earned ? "Earned: " : "Locked: "}{tooltip}</span>
      {showLabel && (
        <div className="text-center leading-tight">
          <div
            className={`text-[10px] font-mono font-bold tracking-wider ${
              earned ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {PILLAR_NAME[badge.pillar].toUpperCase()}
          </div>
          <div className="text-[9px] font-mono text-muted-foreground">
            {badge.bestScore}/{badge.maxScore}
          </div>
        </div>
      )}
    </div>
  );
}
