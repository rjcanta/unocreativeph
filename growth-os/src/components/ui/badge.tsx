import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium leading-4 whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "border-line bg-subtle text-ink-muted",
      sage: "border-sage-200 bg-sage-50 text-sage-700",
      sand: "border-sand-200 bg-sand-50 text-clay-600",
      amber: "border-amber-600/20 bg-amber-50 text-amber-600",
      rose: "border-rose-600/20 bg-rose-50 text-rose-600",
      sky: "border-sky-600/20 bg-sky-50 text-sky-600",
      dark: "border-ink bg-ink text-white",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

export type Tone = NonNullable<VariantProps<typeof badge>["tone"]>;
