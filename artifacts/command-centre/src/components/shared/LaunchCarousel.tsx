import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, CirclePlus, FileUp, Package } from "lucide-react";

export const LAUNCH_OPTIONS = [
  {
    id: "new-session",
    href: "/session/new",
    color: "red",
    lines: ["NEW", "SESSION"],
    label: "New Session",
    caption: "Start from a fresh idea",
    icon: CirclePlus,
    testId: "button-build-something",
    circle: "bg-red-600 text-white border-red-300/40 shadow-[0_0_0_10px_rgba(220,38,38,0.08),0_18px_45px_rgba(220,38,38,0.32)]",
    ring: "focus-visible:ring-red-500/50",
  },
  {
    id: "ingestion",
    href: "/ingest",
    color: "blue",
    lines: ["INGESTION"],
    label: "Ingestion",
    caption: "Start from an existing document",
    icon: FileUp,
    testId: "button-launch-ingestion",
    circle: "bg-blue-700 text-white border-blue-300/40 shadow-[0_0_0_10px_rgba(29,78,216,0.08),0_18px_45px_rgba(29,78,216,0.32)]",
    ring: "focus-visible:ring-blue-500/50",
  },
  {
    id: "cartridge",
    href: "/cartridge",
    color: "green",
    lines: ["CARTRIDGE"],
    label: "Cartridge",
    caption: "Build a session from a cartridge",
    icon: Package,
    testId: "button-launch-cartridge",
    circle: "bg-green-700 text-white border-green-300/40 shadow-[0_0_0_10px_rgba(21,128,61,0.08),0_18px_45px_rgba(21,128,61,0.32)]",
    ring: "focus-visible:ring-green-500/50",
  },
] as const;

const SWIPE_THRESHOLD = 40;
const wrap = (i: number) => (i + LAUNCH_OPTIONS.length) % LAUNCH_OPTIONS.length;

function usePrefersReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const get = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const [reduced, setReduced] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

export function LaunchCarousel({ initialIndex = 0 }: { initialIndex?: number }) {
  const [active, setActive] = useState(wrap(initialIndex));
  const reduced = usePrefersReducedMotion();
  const startX = useRef<number | null>(null);
  const suppressClick = useRef(false);

  const go = (delta: number) => setActive((i) => wrap(i + delta));
  const current = LAUNCH_OPTIONS[active];

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
  };
  const onPointerDown = (e: PointerEvent) => { startX.current = e.clientX; suppressClick.current = false; };
  const onPointerUp = (e: PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      suppressClick.current = true;
      go(dx < 0 ? 1 : -1);
    }
  };

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label="Launch options"
      data-testid="launch-carousel"
      data-reduced-motion={reduced ? "true" : "false"}
      onKeyDown={onKeyDown}
      className="flex flex-col items-center"
    >
      <div
        className="relative h-56 w-full max-w-xl touch-pan-y select-none [container-type:inline-size] md:h-64"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { startX.current = null; }}
        data-testid="launch-carousel-track"
      >
        {LAUNCH_OPTIONS.map((opt, i) => {
          const offset = i === active ? 0 : i === wrap(active + 1) ? 1 : -1;
          const isActive = offset === 0;
          const Icon = opt.icon;
          const onClick = (e: MouseEvent) => {
            if (suppressClick.current) { e.preventDefault(); suppressClick.current = false; return; }
            if (!isActive) { e.preventDefault(); setActive(i); }
          };
          return (
            <Link
              key={opt.id}
              href={opt.href}
              onClick={onClick}
              draggable={false}
              tabIndex={isActive ? 0 : -1}
              aria-current={isActive ? "true" : undefined}
              aria-label={isActive ? `Open ${opt.label}: ${opt.caption}` : `Show ${opt.label}`}
              data-testid={opt.testId}
              data-color={opt.color}
              data-active={isActive ? "true" : "false"}
              data-position={offset === 0 ? "center" : offset === 1 ? "right" : "left"}
              style={{
                transform: `translate(-50%, -50%) translateX(calc(${offset} * min(calc(50cqw - 3.5rem), 13rem))) scale(${isActive ? 1 : 0.62})`,
                zIndex: isActive ? 2 : 1,
              }}
              className={`group absolute left-1/2 top-1/2 flex h-44 w-44 flex-col items-center justify-center rounded-full border-4 text-center outline-none focus-visible:ring-4 focus-visible:ring-offset-4 focus-visible:ring-offset-card md:h-52 md:w-52 ${opt.circle} ${opt.ring} ${reduced ? "" : "transition-[transform,opacity] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"} ${isActive ? `opacity-100 hover:brightness-110 ${reduced ? "" : "progression-glow"}` : "cursor-pointer opacity-55 hover:opacity-80"}`}
            >
              <Icon className={`mb-2 h-7 w-7 ${isActive && !reduced ? "transition-transform group-hover:rotate-90" : ""}`} aria-hidden="true" />
              {opt.lines.map((line) => (
                <span key={line} className={`font-display leading-none ${line.length > 7 ? "text-xl tracking-[0.04em]" : "text-2xl tracking-[0.12em]"}`}>{line}</span>
              ))}
              <span className="mt-2 px-4 font-mono text-[9px] uppercase tracking-wider opacity-90">{opt.caption}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-4">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous launch option"
          data-testid="button-launch-prev"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="flex items-center gap-2" aria-hidden="true">
          {LAUNCH_OPTIONS.map((opt, i) => (
            <span key={opt.id} className={`h-1.5 rounded-full ${i === active ? `w-5 ${opt.circle.split(" ")[0]}` : "w-1.5 bg-muted-foreground/40"}`} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next launch option"
          data-testid="button-launch-next"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <p className="sr-only" aria-live="polite" data-testid="launch-carousel-status">
        {current.label} selected, {active + 1} of {LAUNCH_OPTIONS.length}
      </p>
      <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground" data-testid="launch-carousel-help">
        Swipe, use the arrows or arrow keys to choose. Press the centre circle to open {current.label}.
      </p>
    </div>
  );
}
