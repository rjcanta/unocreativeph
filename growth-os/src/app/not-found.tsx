import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div className="text-lg font-semibold">Not found</div>
      <p className="mt-2 text-sm text-ink-muted">This record doesn&apos;t exist in your workspace, or it was archived.</p>
      <LinkButton href="/" className="mt-5">
        Back to dashboard
      </LinkButton>
    </div>
  );
}
