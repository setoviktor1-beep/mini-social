import type { Metadata } from 'next'
import LegalLayout from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Rules for using Mini Social, including usage-based pricing terms.',
}

const sections = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    content: (
      <p>
        By accessing or using Mini Social, you agree to these Terms. If you do not agree, do not use the service.
      </p>
    ),
  },
  {
    id: 'accounts-auth',
    title: '2. Account and Authentication',
    content: (
      <>
        <p>
          You are responsible for your account credentials and for activity performed under your account.
        </p>
        <p>
          Authentication methods may include email/password and social login providers such as Google, where enabled.
        </p>
      </>
    ),
  },
  {
    id: 'user-content',
    title: '3. User Content',
    content: (
      <>
        <p>
          You are solely responsible for content you post, including text, images, comments, and interactions.
        </p>
        <p>
          You retain ownership of your content, but grant us a non-exclusive license to host, display, and process it as
          needed to operate the platform.
        </p>
      </>
    ),
  },
  {
    id: 'prohibited',
    title: '4. Prohibited Content and Conduct',
    content: (
      <>
        <p>
          You must not publish or distribute spam, illegal content, hate content, intellectual-property infringing content,
          malware, or attempt to break, abuse, or gain unauthorized access to the service.
        </p>
      </>
    ),
  },
  {
    id: 'moderation',
    title: '5. Moderation and Suspension',
    content: (
      <p>
        We may remove content, restrict access, or suspend accounts that violate these Terms or create safety and
        operational risks.
      </p>
    ),
  },
  {
    id: 'pricing-billing',
    title: '6. Pricing and Billing',
    content: (
      <>
        <p>Currency: EUR.</p>
        <p>
          AI/API usage is charged on a usage-based basis. Current reference price: €0.0035 per 1,000 tokens.
        </p>
        <p>
          Prices may change at any time. New prices apply only to future usage and do not retroactively change already
          consumed usage.
        </p>
        <p>
          We may introduce new model options, image generation, and different pricing tiers in the future.
        </p>
        <p>
          If wallet top-up is introduced or expanded, wallet balance may be used for platform services and detailed rules
          will be described on pricing-related pages.
        </p>
      </>
    ),
  },
  {
    id: 'availability',
    title: '7. Service Availability',
    content: (
      <p>
        The service is provided on an “as is” and “as available” basis. We do not provide a guaranteed uptime SLA unless
        explicitly stated otherwise.
      </p>
    ),
  },
  {
    id: 'liability',
    title: '8. Limitation of Liability',
    content: (
      <p>
        To the maximum extent allowed by applicable law, we are not liable for indirect, incidental, special, or
        consequential damages related to use of the platform.
      </p>
    ),
  },
  {
    id: 'changes',
    title: '9. Changes to Terms',
    content: (
      <p>
        We may update these Terms from time to time. Material changes may be communicated through the UI, email, or both.
      </p>
    ),
  },
  {
    id: 'law-disputes',
    title: '10. Governing Law and Disputes',
    content: (
      <p>
        These Terms are governed and interpreted in accordance with applicable laws. Disputes are handled under applicable
        legal procedures.
      </p>
    ),
  },
  {
    id: 'contact',
    title: '11. Contact',
    content: (
      <p>
        Questions about these Terms can be sent to: <a href="mailto:support@yourdomain.com">support@yourdomain.com</a>
      </p>
    ),
  },
]

export default function TermsPage() {
  return <LegalLayout title="Terms of Service" lastUpdated="February 14, 2026" sections={sections} />
}
