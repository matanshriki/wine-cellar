/**
 * NoCreditsModal
 *
 * Luxury full-screen interstitial shown when a user with
 * credit_enforcement_enabled = true tries to use an AI feature
 * with 0 credits remaining.
 *
 * Design: permanently dark glass panel (premium aesthetic regardless of theme).
 * Entry points: Sommi chat send, bottle label scan.
 */

import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, ArrowRight, Zap } from 'lucide-react';
import { useMonetizationAccess } from '../hooks/useMonetizationAccess';
import { trackEvent } from '../services/analytics';

// ── Wine glass SVG (inline, no extra dep) ────────────────────────────────────

function WineGlassIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Glass bowl */}
      <path
        d="M12 4 C12 4 8 28 32 40 C56 28 52 4 52 4 Z"
        fill="url(#glass-gradient)"
        opacity="0.9"
      />
      {/* Wine fill inside bowl */}
      <path
        d="M15 18 C15 18 13 30 32 38 C51 30 49 18 49 18 Z"
        fill="url(#wine-gradient)"
        opacity="0.85"
      />
      {/* Stem */}
      <rect x="29.5" y="40" width="5" height="24" rx="2.5" fill="url(#stem-gradient)" opacity="0.7" />
      {/* Base */}
      <rect x="18" y="62" width="28" height="5" rx="2.5" fill="url(#stem-gradient)" opacity="0.7" />
      {/* Shimmer highlight */}
      <path
        d="M18 10 C18 10 16 22 20 30"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.3"
      />
      <defs>
        <linearGradient id="glass-gradient" x1="12" y1="4" x2="52" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A" stopOpacity="0.15" />
          <stop offset="1" stopColor="#F59E0B" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="wine-gradient" x1="15" y1="18" x2="49" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3030" />
          <stop offset="1" stopColor="#5B1A1A" />
        </linearGradient>
        <linearGradient id="stem-gradient" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop stopColor="#FDE68A" stopOpacity="0.25" />
          <stop offset="1" stopColor="#F59E0B" stopOpacity="0.1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NoCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Context hint so the copy is specific: 'chat' | 'scan' | 'analysis' */
  context?: 'chat' | 'scan' | 'analysis';
}

const CONTEXT_COPY: Record<string, { action: string; description: string }> = {
  chat:     { action: 'chat with Sommi',   description: 'AI-powered wine recommendations and cellar insights' },
  scan:     { action: 'scan wine labels',           description: 'instant AI label recognition and wine data extraction' },
  analysis: { action: 'run a wine analysis',        description: 'deep AI-powered cellar and wine analysis' },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function NoCreditsModal({ isOpen, onClose, context = 'chat' }: NoCreditsModalProps) {
  const navigate = useNavigate();
  const { monetizationEnabled, effectiveBalance, monthlyLimit, planKey } = useMonetizationAccess();

  // Only relevant for users with monetization on — guard silently
  const visible = isOpen && monetizationEnabled;

  const { action, description } = CONTEXT_COPY[context] ?? CONTEXT_COPY.chat;

  // Track open
  useEffect(() => {
    if (!visible) return;
    trackEvent('no_credits_modal_opened', { context, plan_key: planKey });
  }, [visible, context, planKey]);

  // Keyboard close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose],
  );
  useEffect(() => {
    if (!visible) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [visible, handleKeyDown]);

  function handleUpgrade() {
    trackEvent('no_credits_upgrade_clicked', { context, plan_key: planKey });
    onClose();
    navigate('/upgrade');
  }

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="nc-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="nc-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nc-title"
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{ opacity: 0,  scale: 0.94, y: 16  }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-4 bottom-0 z-[61] mx-auto w-full max-w-sm rounded-t-3xl pb-safe sm:inset-0 sm:my-auto sm:max-h-fit sm:rounded-3xl"
            style={{
              background: 'linear-gradient(160deg, #100e1f 0%, #0d0b1a 60%, #120c1e 100%)',
              boxShadow: '0 -4px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar — mobile */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-white/15" />
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-2 text-white/30 transition-colors hover:bg-white/8 hover:text-white/60"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            {/* Content */}
            <div className="flex flex-col items-center px-8 pb-10 pt-8 text-center sm:pb-10 sm:pt-10">

              {/* Icon cluster */}
              <div className="relative mb-6">
                {/* Glow ring */}
                <div
                  className="absolute inset-0 rounded-full blur-2xl"
                  style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.22) 0%, transparent 70%)' }}
                />
                {/* Wine glass */}
                <div
                  className="relative flex h-24 w-24 items-center justify-center rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(120,53,15,0.12))',
                    border: '1px solid rgba(251,191,36,0.18)',
                  }}
                >
                  <WineGlassIcon className="h-14 w-14" />
                </div>
                {/* Empty badge */}
                <div
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                    boxShadow: '0 2px 8px rgba(220,38,38,0.4)',
                    color: '#fff',
                  }}
                >
                  0
                </div>
              </div>

              {/* Headline */}
              <h2
                id="nc-title"
                className="text-xl font-bold leading-snug text-white sm:text-2xl"
                style={{ letterSpacing: '-0.01em' }}
              >
                You've used all your<br />Sommi credits
              </h2>

              {/* Subtext */}
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/45">
                To {action} you need Sommi credits —
                your AI allowance for {description}.
              </p>

              {/* Credit pill */}
              <div
                className="mt-5 flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                style={{
                  background: 'rgba(220,38,38,0.1)',
                  border: '1px solid rgba(220,38,38,0.2)',
                }}
              >
                <Sparkles size={13} className="text-red-400" />
                <span className="font-semibold text-red-300">{effectiveBalance}</span>
                {monthlyLimit > 0 && (
                  <span className="text-red-400/60">/ {monthlyLimit} credits used</span>
                )}
              </div>

              {/* Primary CTA */}
              <motion.button
                type="button"
                onClick={handleUpgrade}
                whileTap={{ scale: 0.97 }}
                className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-sm font-semibold text-white"
                style={{
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                  boxShadow: '0 4px 20px rgba(245,158,11,0.35), 0 1px 0 rgba(255,255,255,0.15) inset',
                }}
              >
                <Zap size={16} />
                Get more Sommi credits
                <ArrowRight size={15} className="opacity-70" />
              </motion.button>

              {/* Secondary — dismiss */}
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full rounded-2xl py-3.5 text-sm font-medium text-white/35 transition-colors hover:text-white/55"
              >
                Maybe later
              </button>

              {/* Fine print */}
              <p className="mt-4 text-[11px] text-white/18">
                Credits reset monthly with your plan · Top-up credits never expire
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
