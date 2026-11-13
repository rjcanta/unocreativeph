"use client";

import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/server/action";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./ui/button";

type ServerAction = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

export function SubmitButton({ children, pendingLabel, ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

export function ResultMessage({ result, className }: { result: ActionResult | null; className?: string }) {
  if (!result?.message) return null;
  return (
    <div role="status" className={cn("flex items-start gap-1.5 text-[13px]", result.ok ? "text-sage-700" : "text-rose-600", className)}>
      {result.ok ? <CheckCircle2 className="mt-px size-4 shrink-0" /> : <AlertCircle className="mt-px size-4 shrink-0" />}
      <span className="whitespace-pre-line">{result.message}</span>
    </div>
  );
}

/**
 * Form bound to a server action. Optional `confirm` shows a confirmation
 * dialog before submitting (used for bulk and irreversible operations).
 */
export function ActionForm({
  action,
  children,
  confirm,
  confirmLabel = "Confirm",
  className,
  showResult = true,
  resetOnSuccess = false,
  redirectTo,
  onResult,
}: {
  action: ServerAction;
  children: React.ReactNode;
  confirm?: string;
  confirmLabel?: string;
  className?: string;
  showResult?: boolean;
  resetOnSuccess?: boolean;
  /** Navigate on success. "{id}" is replaced with result.data.id. */
  redirectTo?: string;
  onResult?: (r: ActionResult) => void;
}) {
  const [result, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!result) return;
    onResult?.(result);
    if (result.ok) {
      if (resetOnSuccess) formRef.current?.reset();
      const id = (result.data as { id?: string } | undefined)?.id;
      if (redirectTo) router.push(id ? redirectTo.replace("{id}", id) : redirectTo.replace("{id}", ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className={className}
        onSubmit={(e) => {
          if (confirm && !confirmed) {
            e.preventDefault();
            dialogRef.current?.showModal();
          } else setConfirmed(false);
        }}
      >
        {children}
        {showResult ? <ResultMessage result={result} className="mt-2" /> : null}
      </form>
      {confirm ? (
        <dialog ref={dialogRef} className="m-auto w-[min(92vw,420px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl">
          <div className="p-5">
            <div className="text-[15px] font-semibold">Please confirm</div>
            <p className="mt-2 text-sm text-ink-muted">{confirm}</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-line bg-subtle/60 px-5 py-3">
            <Button variant="secondary" type="button" onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                dialogRef.current?.close();
                setConfirmed(true);
                requestAnimationFrame(() => formRef.current?.requestSubmit());
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </dialog>
      ) : null}
    </>
  );
}

/** One-button form for simple actions. Hidden fields go in `fields`. */
export function ActionButton({
  action,
  fields,
  children,
  confirm,
  confirmLabel,
  variant = "secondary",
  size = "sm",
  pendingLabel,
  className,
  showResult = true,
  disabled,
}: {
  action: ServerAction;
  fields?: Record<string, string>;
  children: React.ReactNode;
  confirm?: string;
  confirmLabel?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  pendingLabel?: string;
  className?: string;
  showResult?: boolean;
  disabled?: boolean;
}) {
  return (
    <ActionForm action={action} confirm={confirm} confirmLabel={confirmLabel} className={cn("inline-block", className)} showResult={showResult}>
      {Object.entries(fields ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton variant={variant} size={size} pendingLabel={pendingLabel} disabled={disabled}>
        {children}
      </SubmitButton>
    </ActionForm>
  );
}
