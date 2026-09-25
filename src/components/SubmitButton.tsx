"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type Props = Omit<ComponentProps<"button">, "type"> & {
  pendingText?: ReactNode;
};

/** A submit button that disables itself and shows progress while its form is sending. */
export function SubmitButton({
  children,
  pendingText,
  disabled,
  className = "btn btn-primary",
  ...rest
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      {...rest}
      type="submit"
      className={pending ? `${className} is-pending` : className}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
