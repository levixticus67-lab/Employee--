import { Link } from "wouter";
import { Layout } from "@/components/layout";

export default function PrivacyPolicy() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="glass-panel-heavy rounded-3xl p-8 md:p-12 border-white/50 space-y-8">

          <div className="space-y-2">
            <h1 className="text-3xl font-serif text-blue-950">Privacy Policy</h1>
            <p className="text-sm text-blue-800/50">Last updated: June 2026</p>
          </div>

          <p className="text-blue-900/70 leading-relaxed">
            Jojo Collections ("we", "us", or "our") is committed to protecting your personal
            information. This Privacy Policy explains what data we collect, how we use it, and
            your rights under Uganda's <strong>Data Protection and Privacy Act 2019 (DIPA)</strong>.
          </p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">1. Who We Are</h2>
            <p className="text-blue-900/70 leading-relaxed">
              Jojo Collections is an online perfume store based in Uganda. For any
              privacy-related questions or requests, contact us at{" "}
              <a href="mailto:levixticus67@gmail.com" className="text-amber-600 hover:underline">
                levixticus67@gmail.com
              </a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">2. Information We Collect</h2>
            <ul className="list-disc list-inside space-y-2 text-blue-900/70">
              <li><strong>Account information</strong> — your name, email address, and password (stored as a secure hash) when you sign up.</li>
              <li><strong>Google Sign-In</strong> — if you choose to sign in with Google, we receive your name, email, and Google account ID.</li>
              <li><strong>Order information</strong> — your delivery address, phone number, items ordered, and payment method chosen at checkout.</li>
              <li><strong>Usage data</strong> — pages visited, products viewed, wishlist items, and session activity to improve the shopping experience.</li>
              <li><strong>Technical data</strong> — IP address, browser type, and crash/error reports (via Sentry) used solely for security and debugging.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 text-blue-900/70">
              <li>To process and fulfil your orders.</li>
              <li>To authenticate you and keep your account secure.</li>
              <li>To send order confirmations and delivery updates.</li>
              <li>To improve our products, website, and customer experience.</li>
              <li>To comply with legal obligations under Ugandan law.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">4. Third Parties We Share Data With</h2>
            <p className="text-blue-900/70 leading-relaxed">
              We only share your data with trusted third parties that help us run the store:
            </p>
            <ul className="list-disc list-inside space-y-2 text-blue-900/70">
              <li><strong>Google / Firebase</strong> — authentication, database storage, and frontend hosting.</li>
              <li><strong>Pesapal</strong> — payment processing. Your payment details go directly to Pesapal and are never stored on our servers.</li>
              <li><strong>Cloudinary</strong> — product image and media storage.</li>
              <li><strong>Cloudflare</strong> — link-preview generation for social sharing.</li>
              <li><strong>Sentry</strong> — error tracking and crash reporting.</li>
              <li><strong>Render</strong> — our backend API is hosted on Render's servers.</li>
            </ul>
            <p className="text-blue-900/70 leading-relaxed font-medium">
              We never sell, rent, or trade your personal data to any third party.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">5. Data Retention</h2>
            <ul className="list-disc list-inside space-y-2 text-blue-900/70">
              <li><strong>Order records</strong> — kept for 5 years for legal and tax compliance.</li>
              <li><strong>Account data</strong> — retained while your account is active. Deleted within 30 days of a verified deletion request.</li>
              <li><strong>Session data</strong> — automatically expires after inactivity.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">6. Cookies</h2>
            <p className="text-blue-900/70 leading-relaxed">
              We use a single session cookie to keep you logged in. We do not use
              advertising or tracking cookies. No third-party ad networks have access to
              your browsing activity on our site.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">7. Your Rights (DIPA 2019)</h2>
            <p className="text-blue-900/70 leading-relaxed">
              Under Uganda's Data Protection and Privacy Act 2019, you have the right to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-blue-900/70">
              <li><strong>Access</strong> — request a copy of the personal data we hold about you.</li>
              <li><strong>Correction</strong> — ask us to correct inaccurate or incomplete data.</li>
              <li><strong>Deletion</strong> — request that we delete your account and associated data.</li>
              <li><strong>Objection</strong> — object to how we process your data in certain circumstances.</li>
            </ul>
            <p className="text-blue-900/70 leading-relaxed">
              To exercise any of these rights, email us at{" "}
              <a href="mailto:levixticus67@gmail.com" className="text-amber-600 hover:underline">
                levixticus67@gmail.com
              </a>{" "}
              with the subject line <em>"Privacy Request"</em>. We will respond within 21 days.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">8. Data Security</h2>
            <p className="text-blue-900/70 leading-relaxed">
              We use industry-standard security measures including HTTPS encryption, hashed
              passwords, server-side session storage, and security headers on all responses.
              No system is 100% secure — if you suspect unauthorised access to your account,
              please contact us immediately.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">9. Children's Privacy</h2>
            <p className="text-blue-900/70 leading-relaxed">
              Our store is not directed at children under 13. We do not knowingly collect
              personal data from children. If you believe a child has provided us with
              personal information, contact us and we will delete it promptly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">10. Changes to This Policy</h2>
            <p className="text-blue-900/70 leading-relaxed">
              We may update this policy from time to time. Changes will be posted on this
              page with an updated date. Continued use of the site after changes constitutes
              acceptance of the revised policy.
            </p>
          </section>

          <div className="border-t border-white/20 pt-6 text-center">
            <Link href="/" className="text-sm text-amber-600 hover:underline">
              ← Back to Home
            </Link>
          </div>

        </div>
      </div>
    </Layout>
  );
}
