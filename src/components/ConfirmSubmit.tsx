"use client";

import type { ComponentProps } from "react";
import { SubmitButton } from "./SubmitButton";

type Props = ComponentProps<typeof SubmitButton> & {
  /** The question shown before anything happens, e.g. "Remove this payment?" */
  confirm: string;
};

/** A submit button that asks "Are you sure?" first. Tapping Cancel does nothing. */
export function ConfirmSubmit({ confirm, onClick, ...rest }: Props) {
  return (
    <SubmitButton
      {...rest}
      onClick={(e) => {
        if (!window.confirm(confirm)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    />
  );
}
