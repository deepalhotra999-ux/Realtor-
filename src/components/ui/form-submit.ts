"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Submit a form to a `useActionState` dispatcher without React 19's automatic
 * form reset. `<form action={fn}>` resets uncontrolled fields when the action
 * finishes — even when it returns a validation error — which would wipe what
 * the user typed. Keep `action={fn}` on the form too, as the no-JS fallback.
 */
export function submitKeepingValues(dispatch: (payload: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Include the clicked button's name/value (e.g. intent=publish).
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(data));
  };
}
