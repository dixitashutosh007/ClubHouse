'use client';

import React, { useEffect, useId, useRef } from 'react';
import { cn } from './cn';
import { Button } from './Button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /**
   * 'dialog' (default): centred card. 'sheet': slides up from the bottom
   * on phones (easy to reach with a thumb) and is a centred card from 640px.
   */
  variant?: 'dialog' | 'sheet';
  /** Width on larger screens: sm 384px (default), md 512px, lg 640px */
  size?: 'sm' | 'md' | 'lg';
  /** Where focus goes on open: the first control (browser default) or the title, so a form's first field does not open its keyboard or suggestions */
  initialFocus?: 'first' | 'title';
}

const WIDTH = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

/**
 * Modal dialog built on the native <dialog> element, which provides focus
 * trapping, Escape to close and the dialog role for screen readers.
 */
export function Dialog({ open, onClose, title, description, children, variant = 'dialog', size = 'sm', initialFocus = 'first' }: DialogProps) {
  const sheet = variant === 'sheet';
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      if (initialFocus === 'title') titleRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, initialFocus]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (outside the panel) closes the dialog
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'p-0 bg-transparent backdrop:bg-ink/60 backdrop:backdrop-blur-xs max-h-[90dvh]',
        sheet
          ? 'w-full max-w-none mt-auto mb-0 mx-0 sm:m-auto sm:w-[calc(100%-2rem)]'
          : 'w-[calc(100%-2rem)] max-w-sm m-auto',
        WIDTH[size]
      )}
    >
      <div
        className={cn(
          'bg-surface border border-line shadow-overlay p-5 sm:p-6 overflow-y-auto max-h-[90dvh]',
          sheet ? 'rounded-t-sheet sm:rounded-sheet pb-[max(1.25rem,env(safe-area-inset-bottom))]' : 'rounded-sheet'
        )}
      >
        {sheet && <div aria-hidden="true" className="mx-auto -mt-2 mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" />}
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className="font-display text-section font-bold text-ink mb-1 focus:outline-none">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="text-support text-ink-muted mb-4">
            {description}
          </p>
        )}
        {open && children}
      </div>
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Accessible replacement for window.confirm() */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Keep',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} title={title} description={description}>
      <div className="flex gap-2 pt-2">
        <Button variant="secondary" fullWidth onClick={onCancel} className="flex-1">
          {cancelLabel}
        </Button>
        <Button variant={destructive ? 'danger' : 'primary'} fullWidth onClick={onConfirm} className="flex-1">
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

/** A bottom sheet on phones, a centred dialog on larger screens */
export function BottomSheet(props: Omit<DialogProps, 'variant'>) {
  return <Dialog {...props} variant="sheet" />;
}
