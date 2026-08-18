"use client";

import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";

/**
 * One labelled control, with its hint and its refusal.
 *
 * **Namespaced, so it serves every form in the app.** F17 wrote it for the
 * profile; F18's registration wizard needs the identical wiring against
 * `drones.errors.*`. The namespace is a prop rather than the component being
 * copied, because a copy is two places that can disagree about how a field
 * announces itself to a screen reader.
 *
 * It exists because the wizard and the settings page render the **same** fields,
 * and a field whose error appears in one place and not the other is the kind of
 * defect no check in this repo catches (open thread 11). Wiring
 * `aria-describedby` and `aria-invalid` once is the other half: done per call
 * site, one of the eight would eventually be missed, and it would be missed for
 * the reader who most needs it.
 *
 * **The problem codes are the server's codes.** The same `ProfileProblem`
 * strings come back from a refused action and from the client-side pass over
 * the pure validators, so the sentence a pilot reads is identical whichever
 * side said no.
 *
 * **The fields carry `aria-required`, never the native `required`.** A native
 * `required` makes the browser cancel the submit and show its own popup, in the
 * browser's language and its own words — so on a Chrome set to English a pilot
 * reading the Arabic form gets "Please fill out this field", and the app's own
 * bilingual refusal never runs at all. Found by submitting an empty contact
 * pane and watching nothing happen. `aria-required` keeps the state a screen
 * reader announces; the validators keep the sentence.
 */

/** The codes a refusal came back with, as a set the fields can each test. */
export type Problems = ReadonlySet<string>;

export function Field({
  namespace,
  label,
  hint,
  /**
   * Every code that belongs to this field. A field can have more than one —
   * "too short" and "wrong script" are different answers about one input.
   */
  codes,
  problems,
  children,
}: {
  /** The catalogue namespace holding `errors.<code>` — `profile` or `drones`. */
  namespace: "profile" | "drones";
  label: string;
  hint?: string;
  codes: readonly string[];
  problems: Problems;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => ReactNode;
}) {
  const t = useTranslations(namespace);
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const problem = codes.find((code) => problems.has(code));
  const describedBy =
    [problem ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>

      {children({
        id,
        "aria-describedby": describedBy,
        // `undefined` rather than `false`: React renders `aria-invalid="false"`
        // for the boolean, and a screen reader announcing "not invalid" on every
        // field is noise.
        "aria-invalid": problem ? true : undefined,
      })}

      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}

      {problem ? (
        <p id={errorId} className="text-destructive text-xs">
          {t(`errors.${problem}`)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A refusal that belongs to the form rather than to any one field —
 * `id_already_registered`, `rate_limited`, `unauthorized`.
 *
 * Rendered as an `alert` because it appears after a submit the pilot expected to
 * succeed, and a message that only appears visually is a form that silently does
 * nothing for anyone not looking at that part of the screen.
 */
export function FormProblem({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-destructive text-sm">
      {children}
    </p>
  );
}
