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
    <div className="grid grid-cols-2 gap-2 text-xs font-bold">
      <a
        href={telLink(mobile)}
        aria-label={`Call ${name}`}
        className="py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 flex items-center justify-center gap-1.5"
      >
        <Phone className="w-4 h-4" aria-hidden="true" />
        Call {firstName}
      </a>
      <a
        href={whatsAppLink(message, mobile)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Send ${name} a WhatsApp message`}
        className="py-2.5 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 flex items-center justify-center gap-1.5"
      >
        <MessageCircle className="w-4 h-4" aria-hidden="true" />
        WhatsApp
      </a>
    </div>
  );
}
