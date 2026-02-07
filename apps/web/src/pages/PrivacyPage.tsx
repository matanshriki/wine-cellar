/**
 * Privacy Policy Page
 * 
 * Required by Google OAuth for app verification
 */

import { useTranslation } from 'react-i18next';

export default function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-surface)' }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Privacy Policy
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Last updated: February 7, 2026
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6" style={{ color: 'var(--text-secondary)' }}>
          
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Introduction
            </h2>
            <p>
              Welcome to Wine Cellar Brain. This Privacy Policy explains how we collect, use, and protect 
              your information when you use our wine collection management application.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Information We Collect
            </h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Account Information
                </h3>
                <p>
                  When you create an account, we collect:
                </p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>Email address</li>
                  <li>Name (first and last name)</li>
                  <li>Profile picture (optional, from Google OAuth)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Wine Collection Data
                </h3>
                <p>
                  To provide our core service, we store:
                </p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>Wine details (name, producer, vintage, region, etc.)</li>
                  <li>Bottle quantities and storage locations</li>
                  <li>Tasting notes and ratings</li>
                  <li>Wine photos you upload</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Usage Information
                </h3>
                <p>
                  We collect anonymous usage data via Google Analytics 4:
                </p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>Pages visited and features used</li>
                  <li>Device type and browser information</li>
                  <li>General location (country/city level only)</li>
                  <li>Session duration and interaction patterns</li>
                </ul>
                <p className="mt-2">
                  <strong>Important:</strong> We do NOT track personally identifiable information (PII) 
                  in analytics. Your wine collection data is never sent to Google Analytics.
                </p>
              </div>
            </div>
          </section>

          {/* How We Use Your Information */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              How We Use Your Information
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>To provide and maintain the Wine Cellar Brain service</li>
              <li>To authenticate your account and ensure security</li>
              <li>To store and manage your wine collection</li>
              <li>To provide personalized wine recommendations</li>
              <li>To improve our app based on usage patterns</li>
              <li>To communicate important updates about the service</li>
            </ul>
          </section>

          {/* Data Storage and Security */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Data Storage and Security
            </h2>
            <p>
              Your data is stored securely using Supabase (PostgreSQL database) with:
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Encrypted connections (HTTPS/TLS)</li>
              <li>Row-level security policies</li>
              <li>Regular backups</li>
              <li>Industry-standard security practices</li>
            </ul>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Third-Party Services
            </h2>
            <p>We use the following third-party services:</p>
            <div className="ml-4 mt-2 space-y-3">
              <div>
                <strong>• Supabase:</strong> Database and authentication hosting
                <br />
                <a 
                  href="https://supabase.com/privacy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm underline"
                  style={{ color: 'var(--wine-600)' }}
                >
                  Supabase Privacy Policy
                </a>
              </div>
              <div>
                <strong>• Google OAuth:</strong> Optional sign-in method
                <br />
                <a 
                  href="https://policies.google.com/privacy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm underline"
                  style={{ color: 'var(--wine-600)' }}
                >
                  Google Privacy Policy
                </a>
              </div>
              <div>
                <strong>• Google Analytics 4:</strong> Anonymous usage analytics
                <br />
                <a 
                  href="https://policies.google.com/privacy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm underline"
                  style={{ color: 'var(--wine-600)' }}
                >
                  Google Privacy Policy
                </a>
              </div>
              <div>
                <strong>• Vercel:</strong> Application hosting
                <br />
                <a 
                  href="https://vercel.com/legal/privacy-policy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm underline"
                  style={{ color: 'var(--wine-600)' }}
                >
                  Vercel Privacy Policy
                </a>
              </div>
            </div>
          </section>

          {/* Cookies and Tracking */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Cookies and Tracking
            </h2>
            <p>
              We use cookies for:
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li><strong>Essential cookies:</strong> Authentication and session management (required)</li>
              <li><strong>Analytics cookies:</strong> Google Analytics 4 for usage insights (optional)</li>
            </ul>
            <p className="mt-3">
              You can manage cookie preferences through our cookie consent banner.
            </p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Your Rights
            </h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your account and all associated data</li>
              <li>Export your wine collection data</li>
              <li>Opt-out of analytics tracking</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, please contact us using the information below.
            </p>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Data Retention
            </h2>
            <p>
              We retain your data as long as your account is active. When you delete your account:
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Your wine collection data is permanently deleted</li>
              <li>Your profile information is removed</li>
              <li>Anonymous analytics data may be retained for statistical purposes</li>
            </ul>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Children's Privacy
            </h2>
            <p>
              Wine Cellar Brain is not intended for use by children under 18 years of age. 
              We do not knowingly collect personal information from children.
            </p>
          </section>

          {/* Changes to This Policy */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes 
              by updating the "Last updated" date at the top of this policy.
            </p>
          </section>

          {/* Contact Us */}
          <section>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Contact Us
            </h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="mt-2">
              Email: <a href="mailto:matan.shriki3@gmail.com" style={{ color: 'var(--wine-600)' }} className="underline">
                matan.shriki3@gmail.com
              </a>
            </p>
          </section>
        </div>

        {/* Back to Home */}
        <div className="mt-12 pt-8 border-t" style={{ borderColor: 'var(--border-medium)' }}>
          <a 
            href="/"
            className="text-sm font-medium underline"
            style={{ color: 'var(--wine-600)' }}
          >
            ← Back to Wine Cellar Brain
          </a>
        </div>
      </div>
    </div>
  );
}
