import React from 'react';
import Link from 'next/link';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { MODULE_THEMES, type ModuleId } from '@/lib/design/modules';

export type ButtonVariant = 'primary' | 'tonal' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonStyleOptions {
  variant?: ButtonVariant;
  /** Module colour for primary and tonal buttons (default: Club House terracotta) */
  tone?: ModuleId;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/** md and lg are 44px+ touch targets; sm (36px) is for dense desktop layouts only */
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-support gap-1.5',
  md: 'h-11 px-4 text-body gap-2',
  lg: 'h-12 px-5 text-body gap-2',
};

export function buttonClasses({ variant = 'primary', tone = 'home', size = 'md', fullWidth }: ButtonStyleOptions = {}) {
  const theme = MODULE_THEMES[tone];
  const look: Record<ButtonVariant, string> = {
    primary: theme.solid,
    tonal: theme.tonal,
    secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken active:bg-line',
    ghost: 'bg-transparent text-ink hover:bg-sunken active:bg-line',
    danger: 'bg-danger text-ink-inverse hover:bg-danger/90 active:bg-danger/80',
  };
  return cn(
    'inline-flex items-center justify-center rounded-control font-semibold whitespace-nowrap select-none',
    'transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none',
    SIZES[size],
    look[variant],
    fullWidth && 'w-full'
  );
}

type NativeButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

export interface ButtonProps extends ButtonStyleOptions, NativeButtonProps {
  children: React.ReactNode;
  /** Icon before the label */
  icon?: LucideIcon;
  /** Shows a spinner and blocks presses while an action runs */
  loading?: boolean;
  /** Renders a link (Next.js Link) with button styling instead of a <button> */
  href?: string;
}

/**
 * The one button for Club House. Primary buttons take the module's deep
 * colour; use one primary action per screen or card.
 */
export function Button({
  variant,
  tone,
  size,
  fullWidth,
  icon: Icon,
  loading = false,
  href,
  className,
  children,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  const classes = cn(buttonClasses({ variant, tone, size, fullWidth }), className);
  const content = (
    <>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      ) : null}
      <span>{children}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} aria-disabled={disabled || undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button {...rest} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined}>
      {content}
    </button>
  );
}

export interface IconButtonProps extends Omit<NativeButtonProps, 'aria-label'> {
  icon: LucideIcon;
  /** Required: what the button does, for screen readers (e.g. "Close") */
  label: string;
  variant?: 'ghost' | 'secondary' | 'tonal';
  tone?: ModuleId;
  /** md is a 44px touch target; sm (36px) for dense desktop layouts */
  size?: 'sm' | 'md';
  /** Small red dot, e.g. unread notifications */
  dot?: boolean;
}

/** An icon-only button; always has an accessible name and a 44px target by default */
export function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  tone = 'home',
  size = 'md',
  dot = false,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const look = {
    ghost: 'text-ink hover:bg-sunken active:bg-line',
    secondary: 'bg-surface text-ink border border-line hover:bg-sunken',
    tonal: MODULE_THEMES[tone].tonal,
  }[variant];
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex items-center justify-center rounded-full transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none',
        size === 'md' ? 'w-11 h-11' : 'w-9 h-9',
        look,
        className
      )}
    >
      <Icon className="w-5 h-5" aria-hidden="true" />
      {dot && <span aria-hidden="true" className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-terracotta-deep ring-2 ring-surface" />}
    </button>
  );
}
