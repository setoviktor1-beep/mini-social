export default function PrivacyPolicy() {
  return (
    <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 prose max-w-none">
      <h1 className="text-3xl font-black mb-6">Privacy Policy</h1>
      <p className="text-gray-500 mb-8 italic">Effective Date: February 8, 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">1. Data We Collect</h2>
        <p>We collect information you provide directly to us, such as when you create an account (email, username, display name), post content, or communicate with us. We also log standard web information like IP addresses for security and moderation purposes.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">2. How We Use Data</h2>
        <p>We use the data to provide the service, enforce our community guidelines through moderation, and ensure the security of our users. We do not sell your personal data to third parties.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">3. Storage and Security</h2>
        <p>Your data is stored securely using Supabase. Media files (images) are stored in encrypted buckets. We implement RLS (Row Level Security) to ensure only authorized users can access or modify their data.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">4. Your Rights</h2>
        <p>You have the right to access, update, or delete your information at any time through your settings page. For complete account deletion, please contact our support.</p>
      </section>

      <div className="mt-12 pt-8 border-t border-gray-100 text-gray-500 text-sm">
        Contact: support@minisocial.example.com
      </div>
    </div>
  )
}
