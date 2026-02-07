/**
 * Footer Component
 * 
 * Simple footer with privacy policy link (required for Google OAuth)
 */

import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer 
      className="py-6 px-4 text-center text-sm"
      style={{ 
        color: 'var(--text-tertiary)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <span>© {new Date().getFullYear()} Wine Cellar Brain</span>
          <span>•</span>
          <Link 
            to="/privacy"
            className="underline hover:opacity-70 transition-opacity"
            style={{ color: 'var(--wine-600)' }}
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
