'use client';

import { MessageCircle, Phone } from 'lucide-react';
import { telLink, whatsAppLink } from '@/lib/utils/contact';

interface RideContactActionsProps {
  /** The other resident's name, for the button labels */
  name: string;
  mobile: string;
  /** Pre-filled WhatsApp message */
  message: string;
}

/**
 * Call or WhatsApp a fellow resident once both of you have agreed to share a
 * ride. The WhatsApp message is pre-filled and can be edited before sending.
 */
export function RideContactActions({ name, mobile, message }: RideContactActionsProps) {
  const firstName = name.trim().split(/\s+/)[0] || name;
  return (
    <div className="grid grid-cols-2 gap-2 text-support font-semibold">
      <a
        href={telLink(mobile)}
        aria-label={`Call ${name}`}
        className="h-11 px-3 rounded-control bg-surface border border-line-strong text-ink hover:bg-sunken flex items-center justify-center gap-1.5"
      >
        <Phone className="w-4 h-4" aria-hidden="true" />
        Call {firstName}
      </a>
      <a
        href={whatsAppLink(message, mobile)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Send ${name} a WhatsApp message`}
        className="h-11 px-3 rounded-control bg-ride-deep text-ink-inverse hover:bg-ride-deep/90 flex items-center justify-center gap-1.5"
      >
        <MessageCircle className="w-4 h-4" aria-hidden="true" />
        WhatsApp
      </a>
    </div>
  );
}
