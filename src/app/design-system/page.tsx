import { notFound } from 'next/navigation';
import { Gallery } from './_components/Gallery';

export const metadata = { title: 'Aangan design system · Club House' };

/**
 * The Aangan component gallery, for building and reviewing the design
 * system. Development only: production returns 404, like the other dev tools.
 */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Gallery />;
}
