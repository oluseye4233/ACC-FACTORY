"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, max = 100, ...props }, ref) => {
  const limit = Number.isFinite(max) && max > 0 ? max : 100
  const current = typeof value === "number" && Number.isFinite(value)
    ? Math.min(limit, Math.max(0, value))
    : null
  const percent = current === null ? 0 : current / limit * 100
  return <ProgressPrimitive.Root
    ref={ref}
    value={current}
    max={limit}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - percent}%)` }}
    />
  </ProgressPrimitive.Root>
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
