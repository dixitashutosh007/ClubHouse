'use client';

import React, { useId } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from './cn';

/**
 * Form controls with their label, hint and error built in. The error sits
 * right under its field and is tied to it (aria-invalid, aria-describedby),
 * so it is announced and never shows far from the control it is about.
 */

interface FieldOwnProps {
  label: string;
  /** Helper text under the label */
  hint?: string;
  /** Error message; marks the field invalid */
  error?: string;
  /** Hide the label visually (it stays available to screen readers) */
  hideLabel?: boolean;
  /** Extra classes for the wrapper */
  wrapperClassName?: string;
}

const controlBase =
  'w-full rounded-control border bg-surface text-ink text-body placeholder:text-ink-muted ' +
  'transition-colors duration-150 focus:outline-none focus-visible:outline-none focus:ring-3 focus:ring-terracotta/30 focus:border-terracotta-deep ' +
  'disabled:bg-sunken disabled:text-ink-muted disabled:cursor-not-allowed';

function controlState(error?: string) {
  return error ? 'border-danger focus:border-danger focus:ring-danger/25' : 'border-line-strong';
}

function useFieldIds(id?: string) {
  const auto = useId();
  const controlId = id ?? `field-${auto}`;
  return { controlId, hintId: `${controlId}-hint`, errorId: `${controlId}-error` };
}

function describedBy(hint: string | undefined, error: string | undefined, hintId: string, errorId: string, own?: string) {
  return [own, hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
}

function FieldFrame({
  controlId,
  hintId,
  errorId,
  label,
  hint,
  error,
  hideLabel,
  required,
  wrapperClassName,
  children,
}: FieldOwnProps & { controlId: string; hintId: string; errorId: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('grid gap-1.5 min-w-0', wrapperClassName)}>
      <label htmlFor={controlId} className={cn('text-support font-semibold text-ink', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {' '}*
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-meta text-ink-muted -mt-1">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-meta font-medium text-danger">
          <AlertCircle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export type InputProps = FieldOwnProps & React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ label, hint, error, hideLabel, wrapperClassName, id, className, required, ...rest }: InputProps) {
  const ids = useFieldIds(id);
  return (
    <FieldFrame {...ids} label={label} hint={hint} error={error} hideLabel={hideLabel} required={required} wrapperClassName={wrapperClassName}>
      <input
        {...rest}
        id={ids.controlId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids.hintId, ids.errorId, rest['aria-describedby'])}
        className={cn(controlBase, controlState(error), 'h-11 px-3', className)}
      />
    </FieldFrame>
  );
}

export type TextareaProps = FieldOwnProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ label, hint, error, hideLabel, wrapperClassName, id, className, required, rows = 4, ...rest }: TextareaProps) {
  const ids = useFieldIds(id);
  return (
    <FieldFrame {...ids} label={label} hint={hint} error={error} hideLabel={hideLabel} required={required} wrapperClassName={wrapperClassName}>
      <textarea
        {...rest}
        id={ids.controlId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids.hintId, ids.errorId, rest['aria-describedby'])}
        className={cn(controlBase, controlState(error), 'px-3 py-2.5 leading-relaxed', className)}
      />
    </FieldFrame>
  );
}

export type SelectProps = FieldOwnProps & React.SelectHTMLAttributes<HTMLSelectElement>;

/** A native select (phones show their own picker) styled to match the inputs */
export function Select({ label, hint, error, hideLabel, wrapperClassName, id, className, required, children, ...rest }: SelectProps) {
  const ids = useFieldIds(id);
  return (
    <FieldFrame {...ids} label={label} hint={hint} error={error} hideLabel={hideLabel} required={required} wrapperClassName={wrapperClassName}>
      <div className="relative">
        <select
          {...rest}
          id={ids.controlId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hint, error, ids.hintId, ids.errorId, rest['aria-describedby'])}
          className={cn(controlBase, controlState(error), 'h-11 pl-3 pr-9 appearance-none', className)}
        >
          {children}
        </select>
        <ChevronDown className="w-4 h-4 text-ink-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
      </div>
    </FieldFrame>
  );
}

interface ChoiceProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  /** Second line under the label */
  description?: string;
}

const choiceInput =
  'mt-0.5 w-5 h-5 shrink-0 accent-terracotta-deep cursor-pointer disabled:cursor-not-allowed';

/** A checkbox with its label; the whole row (44px tall) is the touch target */
export function Checkbox({ label, description, id, className, ...rest }: ChoiceProps) {
  const auto = useId();
  const inputId = id ?? `check-${auto}`;
  return (
    <label htmlFor={inputId} className={cn('flex items-start gap-3 min-h-11 py-2 cursor-pointer', className)}>
      <input {...rest} id={inputId} type="checkbox" className={choiceInput} />
      <span className="min-w-0">
        <span className="block text-body font-medium text-ink">{label}</span>
        {description && <span className="block text-meta text-ink-muted">{description}</span>}
      </span>
    </label>
  );
}

/** One radio option; group them inside <RadioGroup> */
export function Radio({ label, description, id, className, ...rest }: ChoiceProps) {
  const auto = useId();
  const inputId = id ?? `radio-${auto}`;
  return (
    <label htmlFor={inputId} className={cn('flex items-start gap-3 min-h-11 py-2 cursor-pointer', className)}>
      <input {...rest} id={inputId} type="radio" className={choiceInput} />
      <span className="min-w-0">
        <span className="block text-body font-medium text-ink">{label}</span>
        {description && <span className="block text-meta text-ink-muted">{description}</span>}
      </span>
    </label>
  );
}

/** A set of radios with a visible legend */
export function RadioGroup({ legend, children, className }: { legend: string; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={cn('grid gap-0.5 min-w-0', className)}>
      <legend className="text-support font-semibold text-ink mb-1">{legend}</legend>
      {children}
    </fieldset>
  );
}
