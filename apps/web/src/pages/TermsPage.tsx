/**
 * Terms & Conditions Page
 *
 * Required for subscription and pricing model compliance.
 * Public route — no authentication required.
 */

export default function TermsPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-surface)' }}>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Terms & Conditions
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Last updated: April 6, 2026
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8" style={{ color: 'var(--text-secondary)' }}>

          {/* Introduction */}
          <section>
            <p className="leading-relaxed">
              Welcome to Wine Cellar Brain. By accessing or using our application, you agree to be bound
              by these Terms &amp; Conditions. Please read them carefully before using the service. If
              you do not agree to these terms, please do not use the app.
            </p>
          </section>

          {/* 1. Acceptance of Terms */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              1. Acceptance of Terms
            </h2>
            <p className="leading-relaxed">
              By creating an account or otherwise using Wine Cellar Brain ("the Service"), you acknowledge
              that you have read, understood, and agree to be legally bound by these Terms &amp; Conditions
              and our{' '}
              <a href="/privacy" className="underline" style={{ color: 'var(--wine-600)' }}>
                Privacy Policy
              </a>
              . These terms apply to all users of the Service, including free and paid subscribers.
            </p>
          </section>

          {/* 2. Description of Service */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              2. Description of Service
            </h2>
            <p className="leading-relaxed mb-3">
              Wine Cellar Brain is a personal wine collection management application that provides:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Wine cellar cataloguing and bottle tracking</li>
              <li>AI-powered wine recommendations and pairing suggestions</li>
              <li>Drink window estimation and vintage analysis</li>
              <li>Label scanning and wine data enrichment</li>
              <li>Collection sharing and export features</li>
            </ul>
            <p className="leading-relaxed mt-3">
              The Service is provided "as is" and we reserve the right to modify, suspend, or discontinue
              any feature at any time, with reasonable notice where possible.
            </p>
          </section>

          {/* 3. Accounts */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              3. User Accounts
            </h2>
            <p className="leading-relaxed mb-3">
              To use Wine Cellar Brain you must create an account. You are responsible for:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Providing accurate and up-to-date registration information</li>
              <li>Maintaining the confidentiality of your login credentials</li>
              <li>All activity that occurs under your account</li>
              <li>Notifying us immediately of any unauthorised use of your account</li>
            </ul>
            <p className="leading-relaxed mt-3">
              You must be at least 18 years of age to create an account, consistent with the legal
              drinking age in most jurisdictions. We reserve the right to suspend or terminate accounts
              that violate these terms.
            </p>
          </section>

          {/* 4. Subscription Plans */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              4. Subscription Plans &amp; Pricing
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Free Tier
                </h3>
                <p className="leading-relaxed">
                  Wine Cellar Brain offers a free tier with access to core features including bottle cataloguing,
                  drink window tracking, and basic recommendations. Free tier users may be subject to
                  usage limits (e.g., number of bottles, AI recommendation credits).
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Paid Subscription (Sommelier Plan)
                </h3>
                <p className="leading-relaxed">
                  Premium features — including advanced AI recommendations, unlimited cellar size, priority
                  enrichment, and additional Sommelier credits — are available through a paid subscription.
                  Pricing, billing cycles, and included features are displayed in the app at the time of
                  purchase and may be updated with prior notice.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Sommelier Credits
                </h3>
                <p className="leading-relaxed">
                  AI-powered features consume Sommelier credits. Credits are allocated on a monthly basis
                  depending on your plan. Unused credits do not roll over between billing periods unless
                  explicitly stated. Additional credit packs may be available for purchase.
                </p>
              </div>
            </div>
          </section>

          {/* 5. Payment & Billing */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              5. Payment &amp; Billing
            </h2>
            <p className="leading-relaxed mb-3">
              When you subscribe to a paid plan:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>You authorise us to charge your payment method on a recurring basis (monthly or annually, as selected)</li>
              <li>Payments are processed securely through our third-party payment provider</li>
              <li>All prices are listed in USD unless otherwise stated; applicable taxes may apply</li>
              <li>Subscription fees are billed in advance at the start of each billing period</li>
              <li>You will receive a payment receipt via email after each successful charge</li>
            </ul>
            <p className="leading-relaxed mt-3">
              If a payment fails, we may suspend access to premium features until the outstanding balance
              is settled. We will make reasonable attempts to notify you before suspension.
            </p>
          </section>

          {/* 6. Cancellation & Refunds */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              6. Cancellation &amp; Refunds
            </h2>
            <p className="leading-relaxed mb-3">
              You may cancel your subscription at any time from the account settings page.
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Cancellation takes effect at the end of the current billing period; you retain access to premium features until then</li>
              <li>We do not offer pro-rated refunds for partial billing periods unless required by applicable law</li>
              <li>Refund requests within 7 days of initial subscription, where the service has not been substantially used, will be considered on a case-by-case basis — contact us at{' '}
                <a href="mailto:matan.shriki3@gmail.com" className="underline" style={{ color: 'var(--wine-600)' }}>
                  matan.shriki3@gmail.com
                </a>
              </li>
              <li>One-time credit pack purchases are non-refundable once credits have been used</li>
            </ul>
          </section>

          {/* 7. Acceptable Use */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              7. Acceptable Use
            </h2>
            <p className="leading-relaxed mb-3">
              You agree not to use the Service to:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Violate any applicable law or regulation</li>
              <li>Upload malicious content or interfere with the Service's infrastructure</li>
              <li>Attempt to gain unauthorised access to other users' data</li>
              <li>Scrape, copy, or redistribute content from the Service without permission</li>
              <li>Use automated tools to generate excessive load on the Service</li>
              <li>Resell or sublicense access to the Service to third parties</li>
            </ul>
            <p className="leading-relaxed mt-3">
              Violation of these rules may result in immediate account suspension without refund.
            </p>
          </section>

          {/* 8. Intellectual Property */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              8. Intellectual Property
            </h2>
            <p className="leading-relaxed mb-3">
              All content, design, software, and trademarks associated with Wine Cellar Brain are the
              intellectual property of the developer and are protected by applicable copyright and
              intellectual property laws. You may not copy, modify, distribute, or create derivative
              works without explicit written permission.
            </p>
            <p className="leading-relaxed">
              You retain ownership of any data you upload to the Service (e.g., wine notes, photos).
              By uploading content, you grant us a limited licence to store and process that content
              solely to provide the Service to you.
            </p>
          </section>

          {/* 9. Disclaimers */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              9. Disclaimers
            </h2>
            <p className="leading-relaxed mb-3">
              The Service is provided on an "as is" and "as available" basis without warranties of any
              kind, either express or implied. We do not warrant that:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>The Service will be uninterrupted, secure, or error-free</li>
              <li>AI-generated recommendations are accurate or suitable for your specific needs</li>
              <li>Drink window estimates are guaranteed to be correct — they are indicative only</li>
              <li>Wine data enriched from third-party sources is always complete or accurate</li>
            </ul>
            <p className="leading-relaxed mt-3">
              Wine recommendations are for informational and entertainment purposes only and do not
              constitute professional sommelier advice.
            </p>
          </section>

          {/* 10. Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              10. Limitation of Liability
            </h2>
            <p className="leading-relaxed">
              To the maximum extent permitted by law, Wine Cellar Brain and its developer shall not be
              liable for any indirect, incidental, special, consequential, or punitive damages arising
              from your use of the Service — including but not limited to loss of data, lost profits, or
              business interruption — even if we have been advised of the possibility of such damages.
              Our total aggregate liability to you shall not exceed the amount you paid us in the
              12 months preceding the claim.
            </p>
          </section>

          {/* 11. Privacy */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              11. Privacy
            </h2>
            <p className="leading-relaxed">
              Your use of the Service is also governed by our{' '}
              <a href="/privacy" className="underline" style={{ color: 'var(--wine-600)' }}>
                Privacy Policy
              </a>
              , which is incorporated into these Terms &amp; Conditions by reference. By using the
              Service, you consent to the collection and use of your information as described therein.
            </p>
          </section>

          {/* 12. Changes to Terms */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              12. Changes to These Terms
            </h2>
            <p className="leading-relaxed">
              We may update these Terms &amp; Conditions from time to time. We will notify you of
              material changes by updating the "Last updated" date at the top of this page and, where
              appropriate, by sending an email notification. Your continued use of the Service after
              changes take effect constitutes your acceptance of the revised terms.
            </p>
          </section>

          {/* 13. Governing Law */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              13. Governing Law
            </h2>
            <p className="leading-relaxed">
              These Terms &amp; Conditions are governed by and construed in accordance with the laws of
              Israel, without regard to conflict-of-law principles. Any disputes arising under these
              terms shall be subject to the exclusive jurisdiction of the competent courts in Tel Aviv,
              Israel.
            </p>
          </section>

          {/* 14. Contact */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              14. Contact Us
            </h2>
            <p className="leading-relaxed">
              If you have any questions about these Terms &amp; Conditions, please contact us at:
            </p>
            <p className="mt-2">
              Email:{' '}
              <a
                href="mailto:matan.shriki3@gmail.com"
                className="underline"
                style={{ color: 'var(--wine-600)' }}
              >
                matan.shriki3@gmail.com
              </a>
            </p>
          </section>

        </div>

        {/* Back & Legal links */}
        <div
          className="mt-12 pt-8 border-t flex flex-wrap items-center gap-4"
          style={{ borderColor: 'var(--border-medium)' }}
        >
          <a
            href="/"
            className="text-sm font-medium underline"
            style={{ color: 'var(--wine-600)' }}
          >
            ← Back to Wine Cellar Brain
          </a>
          <span style={{ color: 'var(--border-medium)' }}>|</span>
          <a
            href="/privacy"
            className="text-sm font-medium underline"
            style={{ color: 'var(--wine-600)' }}
          >
            Privacy Policy
          </a>
        </div>

      </div>
    </div>
  );
}
