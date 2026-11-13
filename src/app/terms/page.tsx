import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';
import { LegalPage } from '../_components/LegalPage';

export const metadata: Metadata = { title: `Terms of Use · ${APP_NAME}` };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="13 November 2026">
      <p>
        By using {APP_NAME} you agree to these terms. They are short because the app is simple: neighbours helping
        neighbours.
      </p>

      <section>
        <h2>Who can use it</h2>
        <p>
          Residents of a society on {APP_NAME}, verified by mobile number and approved by the society admin. Use your
          real name and flat number, and keep your account to yourself.
        </p>
      </section>

      <section>
        <h2>RideShare is not a taxi service</h2>
        <ul>
          <li>Rides are offered by residents in their own vehicles, for their own commute, not for profit.</li>
          <li>
            {APP_NAME} handles no payments. Any fuel sharing shown is an estimate and is settled between neighbours.
          </li>
          <li>
            Offerers must hold a valid licence, insurance and registration, and drive safely. Riders and offerers
            choose to travel together at their own risk.
          </li>
          <li>Cancel early if your plans change, and be on time.</li>
        </ul>
      </section>

      <section>
        <h2>Classes</h2>
        <p>
          Classes are run by residents. Fees, if any, are agreed and paid between you and the teacher. Your society
          admin approves classes before they are shown.
        </p>
      </section>

      <section>
        <h2>Be a good neighbour</h2>
        <ul>
          <li>No harassment, discrimination, spam or commercial selling.</li>
          <li>Use other residents&apos; contact details only for the ride or class you agreed on.</li>
          <li>Report anything unsafe; admins can suspend or remove members who break these terms.</li>
        </ul>
      </section>

      <section>
        <h2>Our role</h2>
        <p>
          {APP_NAME} connects verified neighbours. We do not employ drivers or teachers and are not responsible for
          what happens on a ride or in a class. We may update these terms and will tell you in the app when we do.
        </p>
      </section>

      <p>
        How we handle your data: <Link href="/privacy" className="font-semibold text-emerald-800 underline">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
