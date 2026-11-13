"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-surface p-6 text-center">
      <div className="text-lg font-semibold">Something went wrong</div>
      <p className="mt-2 text-sm text-ink-muted">{error.message || "An unexpected error occurred."}</p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
