import type { Metadata } from 'next'
import LegalLayout from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Mini Social collects, uses, and protects personal data.',
}

const sections = [
  {
    id: 'introduction',
    title: '1. Introduction',
    content: (
      <>
        <p>
          Mini Social is a social platform where users can create profiles, publish posts, interact with content, and use
          AI-assisted features. This Privacy Policy explains what data we process and why.
        </p>
      </>
    ),
  },
  {
    id: 'data-collected',
    title: '2. Data We Collect',
    content: (
      <>
        <p>
          Account data: email address, username, display name, and profile information you choose to provide.
        </p>
        <p>
          Content data: posts, comments, reactions, messages, and related social activity.
        </p>
        <p>
          Technical data: IP address, browser details, device information, request logs, and service diagnostics.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use',
    title: '3. How We Use Data',
    content: (
      <>
        <p>
          We process data to authenticate users, deliver platform features, maintain account security, prevent abuse, and
          improve service reliability.
        </p>
      </>
    ),
  },
  {
    id: 'legal-basis',
    title: '4. Legal Bases (GDPR)',
    content: (
      <>
        <p>We rely on the following legal bases where applicable:</p>
        <ul>
          <li>performance of a contract (to provide the service),</li>
          <li>legitimate interests (security, fraud and abuse prevention, operations),</li>
          <li>consent (where required by law).</li>
        </ul>
      </>
    ),
  },
  {
    id: 'storage-security',
    title: '5. Data Storage and Security',
    content: (
      <>
        <p>
          We use technical and organizational measures to protect personal data. Supabase is used as a core infrastructure
          and data processor for authentication and database services.
        </p>
      </>
    ),
  },
  {
    id: 'third-parties',
    title: '6. Third-Party Services',
    content: (
      <>
        <ul>
          <li>Supabase: authentication and database infrastructure.</li>
          <li>Vercel: application hosting and delivery.</li>
          <li>
            Stripe: payment processing. We do not store your full payment card details on our systems.
          </li>
          <li>Analytics: currently minimal or not enabled unless explicitly introduced.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'international-transfers',
    title: '7. International Transfers',
    content: (
      <>
        <p>
          Service providers may process data outside the EEA. Where applicable, we rely on contractual safeguards and other
          lawful transfer mechanisms.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: '8. Data Retention',
    content: (
      <>
        <p>
          We keep personal data for as long as needed to provide the service and comply with legal obligations. Account
          data is retained while your account is active. After closure, some logs may be retained for a reasonable period
          (typically 30-90 days) for security and compliance.
        </p>
      </>
    ),
  },
  {
    id: 'rights',
    title: '9. Your Rights (GDPR)',
    content: (
      <>
        <p>You may have the right to access, rectify, erase, restrict, port, or object to processing of your data.</p>
      </>
    ),
  },
  {
    id: 'account-deletion',
    title: '10. Account Deletion and Requests',
    content: (
      <>
        <p>
          You can request account deletion and data requests by contacting support. We may request verification to protect
          your account.
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    title: '11. Contact',
    content: (
      <>
        <p>
          For privacy-related requests, contact: <a href="mailto:support@yourdomain.com">support@yourdomain.com</a>
        </p>
      </>
    ),
  },
]

export default function PrivacyPolicyPage() {
  return <LegalLayout title="Privacy Policy" lastUpdated="February 14, 2026" sections={sections} />
}
