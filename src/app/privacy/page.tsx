import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';
import { LegalPage, privacyContact } from '../_components/LegalPage';

export const metadata: Metadata = { title: `Privacy Policy · ${APP_NAME}` };

export default function PrivacyPage() {
  const contact = privacyContact();
  return (
    <LegalPage title="Privacy Policy" updated="13 November 2026">
      <p>
        {APP_NAME} is a private app for the residents of a housing society. This policy explains what we collect,
        why, who can see it, and the choices you have. It is written to meet India&apos;s Digital Personal Data
        Protection Act, 2023.
      </p>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Your mobile number, verified by an SMS code when you sign in.</li>
          <li>Your name, flat number, email, gender, and work location, which you give when you join.</li>
          <li>Vehicles you add (make, model, colour, number plate, mileage).</li>
          <li>Rides you offer, request or join; classes you post; ratings, reports and suggestions you send.</li>
          <li>Notifications we send you, and a device token if you turn on push alerts.</li>
          <li>A record of important actions (for example approvals and changes to settings) for safety and audit.</li>
        </ul>
        <p className="mt-2">We do not collect payment details, your contacts, or your location in the background.</p>
      </section>

      <section>
        <h2>Why we use it</h2>
        <ul>
          <li>To confirm you live in the society (your society admin approves you).</li>
          <li>To match rides and show classes from your neighbours.</li>
          <li>To let neighbours contact each other once both have agreed to share a ride.</li>
          <li>To keep the community safe: reports, moderation and the activity record.</li>
        </ul>
      </section>

      <section>
        <h2>Who can see what</h2>
        <ul>
          <li>Only verified residents of your own society can see you. Other societies cannot.</li>
          <li>
            Your mobile number, flat number and number plate are hidden until you and the other resident have both
            agreed to share a ride.
          </li>
          <li>Your society admins can see your profile, to approve and manage members.</li>
          <li>Your gender is used only to honour women-only or men-only rides and is never shown to others.</li>
          <li>We do not sell your data or use it for advertising.</li>
        </ul>
      </section>

      <section>
        <h2>Where it is kept</h2>
        <p>
          Data is stored with Google Cloud (Firebase) and the app is served by Amazon Web Services. Access is limited
          to the app&apos;s servers; your phone never reads the database directly.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          We keep your data while you are a member. When you leave a society or delete your account, your profile is
          removed and your past rides and classes are kept only in anonymised form, so others&apos; histories still
          make sense. The activity record is kept for safety for up to two years.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <ul>
          <li>
            <strong>See and download your data:</strong> Profile → Your data → Download my data.
          </li>
          <li>
            <strong>Correct it:</strong> edit your profile at any time.
          </li>
          <li>
            <strong>Leave a society or delete your account:</strong> Profile → Your data.
          </li>
          <li>
            <strong>Raise a concern:</strong>{' '}
            {contact ? (
              <>
                write to <a href={`mailto:${contact}`} className="font-semibold text-emerald-800 underline">{contact}</a>
              </>
            ) : (
              'contact your society admin, who can reach the Club House team'
            )}
            . We reply within 30 days.
          </li>
        </ul>
      </section>

      <p>
        See also our <Link href="/terms" className="font-semibold text-emerald-800 underline">Terms of Use</Link>.
      </p>
    </LegalPage>
  );
}
