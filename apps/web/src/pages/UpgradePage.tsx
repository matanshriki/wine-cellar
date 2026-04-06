/**
 * UpgradePage
 *
 * Full-page Sommelier Credits / plan selection experience.
 * Protected by MonetizationRoute — only accessible to users with
 * monetization_enabled = true. Completely invisible to all other users.
 *
 * Route: /upgrade
 * Entry points:
 *  - Low-credit CTA in SommelierCreditsDisplay (full-card variant)
 *  - Agent page insufficient-credits blocked state
 *  - Any future deep-link in a test email / in-app notification
 *
 * The page renders the same plan content as PricingModal but in a
 * full-page layout with more breathing room, suitable for desktop and
 * tablet use. It shares the same placeholder handlers — easy to
 * replace with Stripe Checkout later.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Check, Zap, Star, TrendingUp, ArrowRight } from 'lucide-react';
import { PLANS, TOP_UP_OPTIONS } from '../lib/creditPolicy';
import { useMonetizationAccess } from '../hooks/useMonetizationAccess';
import { trackEvent } from '../services/analytics';
import { toast } from '../lib/toast';

// ── Plan visual config ────────────────────────────────────────────────────────

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free:      <Sparkles size={20} className="text-white/40" />,
  premium:   <Star size={20} className="text-amber-400" />,
  collector: <TrendingUp size={20} className="text-violet-400" />,
};

const PLAN_ACCENT: Record<string, { border: string; glow: string; cta: string; check: string }> = {
  free: {
    border: 'rgba(255,255,255,0.1)',
    glow:   'none',
    cta:    'rgba(255,255,255,0.08)',
    check:  'rgba(255,255,255,0.3)',
  },
  premium: {
    border: 'rgba(251,191,36,0.35)',
    glow:   '0 0 40px rgba(251,191,36,0.08)',
    cta:    'linear-gradient(135deg, #F59E0B, #D97706)',
    check:  'rgba(251,191,36,0.7)',
  },
  collector: {
    border: 'rgba(167,139,250,0.35)',
    glow:   '0 0 40px rgba(167,139,250,0.08)',
    cta:    'linear-gradient(135deg, #8B5CF6, #6D28D9)',
    check:  'rgba(167,139,250,0.7)',
  },
};

const PLAN_CTA: Record<string, string> = {
  free:      'Continue with Free',
  premium:   'Upgrade to Premium',
  collector: 'Upgrade to Collector',
};

// ── Placeholder handlers ──────────────────────────────────────────────────────

function handleSelectPlan(planKey: string, currentPlan: string | null) {
  if (planKey === currentPlan) return;
  trackEvent('pricing_plan_selected', { plan_key: planKey, source: 'upgrade_page' });
  console.log('[UpgradePage] Plan selected (Stripe not wired yet):', planKey);
  toast.success(
    `${planKey.charAt(0).toUpperCase() + planKey.slice(1)} plan coming soon — ` +
    `you'll be among the first to be notified.`,
  );
}

function handleTopUp(credits: number, price: number) {
  trackEvent('pricing_topup_selected', { credits, price, source: 'upgrade_page' });
  console.log('[UpgradePage] Top-up selected (Stripe not wired yet):', credits);
  toast.success(`${credits} Sommelier Credits — top-ups coming soon!`);
}

// ── Component ────────────────────────────────────────────────────────────────

export function UpgradePage() {
  const navigate = useNavigate();
  const {
    planKey: currentPlan,
    effectiveBalance,
    monthlyLimit,
    isLowBalance,
    creditsLoading,
  } = useMonetizationAccess();

  const [activeTab, setActiveTab] = useState<'plans' | 'topup'>('plans');

  if (creditsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-6">
      {/* Back navigation */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-8 flex items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/70"
      >
        <ArrowLeft size={14} />
        Back
      </button>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mb-10"
      >
        <div className="flex items-center gap-3 mb-3">
          <Sparkles size={20} className="text-amber-400" />
          <span className="text-sm font-medium uppercase tracking-widest text-white/40">
            Sommelier Credits
          </span>
        </div>
        <h1
          className="text-2xl font-bold text-white sm:text-3xl"
          style={{ fontFamily: 'var(--font-display, inherit)', letterSpacing: '-0.01em' }}
        >
          Choose the plan that fits how you discover,<br className="hidden sm:block" /> collect, and enjoy wine.
        </h1>
        <p className="mt-3 text-base text-white/45 max-w-xl">
          Upgrade for deeper cellar insights and more Sommelier sessions.
        </p>

        {/* Current balance pill (shown when low) */}
        {isLowBalance && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
            <Sparkles size={13} className="text-amber-400" />
            {effectiveBalance} Sommelier Credit{effectiveBalance === 1 ? '' : 's'} remaining
            {monthlyLimit > 0 ? ` of ${monthlyLimit}` : ''}
          </div>
        )}
      </motion.div>

      {/* Tab switcher */}
      <div className="mb-8 flex gap-1 rounded-xl bg-white/5 p-1 max-w-xs">
        <button
          type="button"
          onClick={() => setActiveTab('plans')}
          className="flex-1 rounded-lg py-2 text-sm font-medium transition-colors"
          style={
            activeTab === 'plans'
              ? { background: 'rgba(255,255,255,0.1)', color: '#fff' }
              : { color: 'rgba(255,255,255,0.4)' }
          }
        >
          Monthly plans
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('topup')}
          className="flex-1 rounded-lg py-2 text-sm font-medium transition-colors"
          style={
            activeTab === 'topup'
              ? { background: 'rgba(255,255,255,0.1)', color: '#fff' }
              : { color: 'rgba(255,255,255,0.4)' }
          }
        >
          Top-up credits
        </button>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === 'plans' ? (
          <motion.div
            key="plans"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Plan grid */}
            <div className="grid gap-5 sm:grid-cols-3">
              {PLANS.map((plan, i) => {
                const isCurrent = currentPlan === plan.key;
                const accent = PLAN_ACCENT[plan.key];

                return (
                  <motion.div
                    key={plan.key}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.06 }}
                    className="relative flex flex-col rounded-2xl border p-6 transition-all"
                    style={{
                      borderColor: accent.border,
                      boxShadow: accent.glow,
                      background: plan.highlight
                        ? 'linear-gradient(160deg, rgba(251,191,36,0.08) 0%, rgba(0,0,0,0) 60%)'
                        : plan.key === 'collector'
                        ? 'linear-gradient(160deg, rgba(167,139,250,0.08) 0%, rgba(0,0,0,0) 60%)'
                        : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    {/* Popular badge */}
                    {plan.highlight && (
                      <span
                        className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white"
                        style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
                      >
                        Most popular
                      </span>
                    )}

                    {/* Plan icon + name */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {PLAN_ICONS[plan.key]}
                        <span className="font-semibold text-white">{plan.label}</span>
                      </div>
                      {isCurrent && (
                        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-white/50">
                          Your plan
                        </span>
                      )}
                    </div>

                    {/* Credits */}
                    <div className="mt-5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold tabular-nums text-white">
                          {plan.monthlyCredits}
                        </span>
                        <span className="text-xs leading-snug text-white/35">
                          credits<br />/ month
                        </span>
                      </div>
                      <div className="mt-1.5">
                        {plan.priceMonthly !== null ? (
                          <span className="text-sm text-white/50">
                            <span className="font-semibold text-white/80">
                              ${plan.priceMonthly}
                            </span>{' '}
                            / month
                          </span>
                        ) : (
                          <span className="text-sm text-white/50">Always free</span>
                        )}
                      </div>
                    </div>

                    {/* Features */}
                    <ul className="mt-6 flex-1 space-y-3">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-3">
                          <Check
                            size={14}
                            className="mt-0.5 shrink-0"
                            style={{ color: accent.check }}
                          />
                          <span className="text-sm leading-relaxed text-white/55">{f}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <button
                      type="button"
                      onClick={() => handleSelectPlan(plan.key, currentPlan)}
                      disabled={isCurrent}
                      className="mt-7 w-full rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-default"
                      style={
                        isCurrent
                          ? { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)' }
                          : { background: accent.cta, color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }
                      }
                    >
                      {isCurrent ? 'Your current plan' : PLAN_CTA[plan.key]}
                    </button>
                  </motion.div>
                );
              })}
            </div>

            {/* Fine print */}
            <p className="mt-8 text-center text-xs text-white/25">
              Subscriptions and payments are coming soon — you'll be among the first to know.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="topup"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="max-w-2xl"
          >
            <p className="text-base text-white/45">
              Need more? Add extra Sommelier Credits anytime — they stack on top of your
              monthly allowance and never expire.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {TOP_UP_OPTIONS.map((opt, i) => (
                <motion.button
                  key={opt.credits}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.08 }}
                  onClick={() => handleTopUp(opt.credits, opt.price)}
                  className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-6 py-5 text-left transition-all hover:border-white/20 hover:bg-white/7 active:scale-[0.98]"
                >
                  <div>
                    <div className="flex items-center gap-2.5">
                      <Zap
                        size={16}
                        className="text-white/35 transition-colors group-hover:text-amber-400"
                      />
                      <span className="text-lg font-bold text-white">{opt.label}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-white/40">
                      One-time purchase — no subscription required
                    </p>
                  </div>
                  <div className="shrink-0 pl-4 text-right">
                    <span className="text-2xl font-bold text-white">${opt.price}</span>
                    <ArrowRight
                      size={16}
                      className="ml-1.5 inline text-white/25 transition-colors group-hover:text-white/60"
                    />
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Explainer */}
            <div className="mt-8 rounded-2xl border border-white/8 bg-white/3 px-5 py-5">
              <h3 className="text-sm font-semibold text-white/70 mb-3">
                How Sommelier Credits work
              </h3>
              <ul className="space-y-3">
                {[
                  { icon: <Sparkles size={12} />, text: 'Each Sommelier conversation, wine analysis, or label scan uses a small number of credits.' },
                  { icon: <Check size={12} />, text: 'Monthly plan credits reset on the 1st of each month.' },
                  { icon: <Zap size={12} />, text: 'Top-up credits never expire and are used after your monthly allowance runs out.' },
                ].map(({ icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-sm text-white/40">
                    <span className="mt-0.5 shrink-0 text-white/25">{icon}</span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-6 text-center text-xs text-white/25">
              Payments coming soon — you'll be the first to know when top-ups go live.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
