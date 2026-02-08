export default function TermsOfService() {
  return (
    <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 prose max-w-none">
      <h1 className="text-3xl font-black mb-6">Terms of Service</h1>
      <p className="text-gray-500 mb-8 italic">Effective Date: February 8, 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">1. Acceptance of Terms</h2>
        <p>By creating an account or using Mini Social, you agree to these terms. If you do not agree, do not use the service.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">2. User Content</h2>
        <p>You are responsible for the content you post. You must not post illegal, harmful, or copyright-infringing material. We reserve the right to hide or delete content that violates our community standards.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">3. Moderation</h2>
        <p>Our moderators may suspend or ban accounts that repeatedly violate these terms or engage in harassment. Moderation decisions are final.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">4. Disclaimer</h2>
        <p>The service is provided "as is". We are not liable for any damages resulting from your use of the platform or the content posted by other users.</p>
      </section>
    </div>
  )
}
