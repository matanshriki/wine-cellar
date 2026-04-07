/**
 * UpgradePage
 *
 * Full-page Sommelier Credits / plan selection experience.
 * Protected by MonetizationRoute — only accessible to users with
 * monetization_enabled = true.
 *
 * Route: /upgrade
 *
 * Design approach:
 *  - Page chrome (header, back, tabs, top-up section) uses theme CSS variables
 *    so it respects the user's light / dark theme preference.
 *  - Plan cards live inside a permanently-dark "pricing island" — this gives
 *    the premium dark-glass look regardless of the page theme, and avoids
 *    white text on a white background in light mode.
 *
 * Mobile UX:
 *  - Plan cards are a horizontal snap-scroll carousel on mobile so all three
 *    tiers are visible with a swipe without deep vertical scrolling.
 *  - The rest of the page (tabs, top-up, explainer) scrolls normally.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Sparkles, Check, Zap, Star, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { PLANS, TOP_UP_OPTIONS } from '../lib/creditPolicy';
import { useMonetizationAccess } from '../hooks/useMonetizationAccess';
import { trackEvent } from '../services/analytics';
import { toast } from '../lib/toast';
import { openCheckout, getPortalUrl } from '../lib/paddle';
import { supabase } from '../lib/supabase';

// ── Per-plan accent config (always on dark bg) ─────────────────────────────

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free:      <Sparkles size={18} className="text-white/40" />,
  premium:   <Star     size={18} className="text-amber-400" />,
  collector: <TrendingUp size={18} className="text-violet-400" />,
};

const PLAN_ACCENT = {
  free: {
    border:   'rgba(255,255,255,0.12)',
    cardBg:   'rgba(255,255,255,0.04)',
    check:    'rgba(255,255,255,0.35)',
    cta:      { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)' } as React.CSSProperties,
    badge:    undefined as string | undefined,
  },
  premium: {
    border:   'rgba(251,191,36,0.4)',
    cardBg:   'linear-gradient(160deg, rgba(251,191,36,0.12) 0%, rgba(251,191,36,0.04) 100%)',
    check:    '#FBB524',
    cta:      { background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#fff', boxShadow: '0 4px 14px rgba(245,158,11,0.35)' } as React.CSSProperties,
    badge:    'linear-gradient(135deg, #F59E0B, #D97706)',
  },
  collector: {
    border:   'rgba(167,139,250,0.4)',
    cardBg:   'linear-gradient(160deg, rgba(167,139,250,0.12) 0%, rgba(167,139,250,0.04) 100%)',
    check:    '#A78BFA',
    cta:      { background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', color: '#fff', boxShadow: '0 4px 14px rgba(139,92,246,0.35)' } as React.CSSProperties,
    badge:    undefined as string | undefined,
  },
} as const;

const PLAN_CTA: Record<string, string> = {
  free:      'Continue with Free',
  premium:   'Upgrade to Premium',
  collector: 'Upgrade to Collector',
};

// ── Checkout helpers ──────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UpgradePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    planKey: currentPlan,
    effectiveBalance,
    monthlyLimit,
    isLowBalance,
    creditsLoading,
    refresh,
  } = useMonetizationAccess();

  const [activeTab, setActiveTab] = useState<'plans' | 'topup'>('plans');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const savePercent = Math.round((1 - 90 / (9 * 12)) * 100); // 17

  // Show success toast when returning from Paddle checkout
  useEffect(() => {
    if (searchParams.get('success') === '1') {
      toast.success(t('sommelierCredits.toast.topUpSuccess'));
      // Remove the ?success=1 param without a full navigation
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('success');
      navigate({ search: newParams.toString() }, { replace: true });
    }
  }, [searchParams, navigate]);

  async function handleSelectPlan(planKey: string) {
    if (planKey === currentPlan || planKey === 'free') return;
    trackEvent('pricing_plan_selected', { plan_key: planKey, source: 'upgrade_page' });
    setCheckoutLoading(`plan:${planKey}`);
    try {
      const plan = PLANS.find((p) => p.key === planKey);
      const period = (billingPeriod === 'yearly' && plan?.priceYearly !== null) ? 'yearly' : 'monthly';
      const token = await getAuthToken();
      await openCheckout({ plan: planKey, period }, {
        authToken: token,
        onSuccess: () => {
          refresh();
          trackEvent('pricing_plan_purchased', { plan_key: planKey });
          toast.success(
            t('sommelierCredits.toast.welcomeMessage', { credits: plan?.monthlyCredits }),
            t('sommelierCredits.toast.welcomeTitle', { plan: plan?.label }),
          );
        },
      });
    } catch (err: any) {
      console.error('[UpgradePage] Checkout error:', err);
      toast.error(err?.message ?? t('sommelierCredits.toast.checkoutError'));
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleTopUp(credits: number, price: number) {
    trackEvent('pricing_topup_selected', { credits, price, source: 'upgrade_page' });
    setCheckoutLoading(`topup:${credits}`);
    try {
      const token = await getAuthToken();
      await openCheckout({ topup: String(credits) }, { authToken: token });
    } catch (err: any) {
      console.error('[UpgradePage] Top-up error:', err);
      toast.error(err?.message ?? t('sommelierCredits.toast.checkoutError'));
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const token = await getAuthToken();
      const url = await getPortalUrl(token);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err?.message ?? t('sommelierCredits.toast.portalError'));
    } finally {
      setPortalLoading(false);
    }
  }

  if (creditsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2"
          style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--text-secondary)' }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-4 sm:py-6">

      {/* Back */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-5 flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <ArrowLeft size={14} />
        {t('sommelierCredits.cta.back')}
      </button>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <div className="mb-2 flex items-center gap-2">
          <Sparkles size={15} className="text-amber-500" />
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('sommelierCredits.title')}
          </span>
        </div>
        <h1
          className="text-xl font-bold leading-snug sm:text-3xl"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-display, inherit)', letterSpacing: '-0.01em' }}
        >
          {t('sommelierCredits.subtitle')}
        </h1>
        <p className="mt-2 text-sm sm:text-base" style={{ color: 'var(--text-tertiary)' }}>
          {t('sommelierCredits.upgradeSubtitle')}
        </p>

        {isLowBalance && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm font-medium text-amber-600">
            <Sparkles size={12} className="text-amber-500" />
            {monthlyLimit > 0
              ? t('sommelierCredits.plan.creditsRemainingOf', { count: effectiveBalance, limit: monthlyLimit })
              : t('sommelierCredits.plan.creditsRemaining', { count: effectiveBalance })}
          </div>
        )}
      </motion.div>

      {/* ── Tab switcher ──────────────────────────────────────────────────── */}
      <div
        className="mb-6 flex gap-1 rounded-xl p-1 w-fit"
        style={{ background: 'var(--bg-muted)' }}
      >
        {(['plans', 'topup'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={
              activeTab === tab
                ? { background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: 'var(--text-tertiary)' }
            }
          >
            {tab === 'plans' ? t('sommelierCredits.tabs.monthlyPlans') : t('sommelierCredits.tabs.topUp')}
          </button>
        ))}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {/* Plans tab */}
        {activeTab === 'plans' && (
          <motion.div
            key="plans"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
          >
            {/*
             * Dark pricing island — always dark so plan cards look premium
             * regardless of light / dark page theme.
             * Extends past the parent padding on mobile (-mx-4 sm:mx-0) so the
             * horizontal scroll area fills edge-to-edge.
             */}
            <div
              className="-mx-4 rounded-none px-4 py-6 sm:mx-0 sm:rounded-3xl sm:px-8 sm:py-8"
              style={{ background: 'linear-gradient(160deg, #11101e 0%, #0e0c1b 100%)' }}
            >
              {/* Billing period toggle */}
              <div className="mb-5 flex justify-center">
                <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1">
                  {(['monthly', 'yearly'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setBillingPeriod(p)}
                      className="relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
                      style={
                        billingPeriod === p
                          ? { background: 'rgba(255,255,255,0.1)', color: '#fff' }
                          : { color: 'rgba(255,255,255,0.4)' }
                      }
                    >
                      {p === 'monthly' ? t('sommelierCredits.billing.monthly') : t('sommelierCredits.billing.yearly')}
                      {p === 'yearly' && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                          style={{ background: 'rgba(52,211,153,0.18)', color: '#34d399' }}
                        >
                          {t('sommelierCredits.billing.savePercent', { percent: savePercent })}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plan grid: snap-scroll carousel on mobile, 3-col grid on sm+ */}
              <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 sm:pt-0 sm:gap-5">
                {PLANS.map((plan) => {
                  const isCurrent = currentPlan === plan.key;
                  const accent = PLAN_ACCENT[plan.key as keyof typeof PLAN_ACCENT];

                  const features = t(`sommelierCredits.planFeatures.${plan.key}`, { returnObjects: true }) as string[];

                  return (
                    <div
                      key={plan.key}
                      className="relative flex w-[78vw] max-w-[300px] shrink-0 snap-center flex-col rounded-2xl border p-5 transition-all sm:w-auto sm:max-w-none sm:shrink sm:p-6"
                      style={{ borderColor: accent.border, background: accent.cardBg }}
                    >
                      {/* Popular badge */}
                      {plan.highlight && (
                        <span
                          className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white"
                          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
                        >
                          {t('sommelierCredits.badges.mostPopular')}
                        </span>
                      )}

                      {/* Plan header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {PLAN_ICONS[plan.key]}
                          <span className="font-semibold text-white">{plan.label}</span>
                        </div>
                        {isCurrent && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                            style={
                              plan.highlight
                                ? plan.key === 'premium'
                                  ? { background: 'rgba(251,191,36,0.15)', color: '#F59E0B', border: '1px solid rgba(251,191,36,0.3)' }
                                  : { background: 'rgba(167,139,250,0.15)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.3)' }
                                : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)' }
                            }
                          >
                            <Check size={9} strokeWidth={3} />
                            {t('sommelierCredits.badges.active')}
                          </span>
                        )}
                      </div>

                      {/* Credits (primary metric) */}
                      <div className="mt-4">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-4xl font-bold tabular-nums text-white">
                            {plan.monthlyCredits}
                          </span>
                          <span className="text-xs leading-snug text-white/35" style={{ whiteSpace: 'pre-line' }}>
                            {t('sommelierCredits.plan.creditsPerMonth')}
                          </span>
                        </div>
                        <div className="mt-1.5 text-sm text-white/50">
                          {plan.priceMonthly !== null ? (
                            billingPeriod === 'yearly' && plan.priceYearly !== null ? (
                              <>
                                <span className="font-semibold text-white/80">${plan.priceYearly}</span> {t('sommelierCredits.plan.perYear')}
                                <p className="mt-0.5 text-xs text-white/35">
                                  {t('sommelierCredits.plan.perMonthBilled', { price: (plan.priceYearly / 12).toFixed(2).replace(/\.00$/, '') })} · {t('sommelierCredits.billing.billedYearly')}
                                </p>
                              </>
                            ) : (
                              <>
                                <span className="font-semibold text-white/80">${plan.priceMonthly}</span> {t('sommelierCredits.plan.perMonth')}
                              </>
                            )
                          ) : (
                            t('sommelierCredits.plan.alwaysFree')
                          )}
                        </div>
                      </div>

                      {/* Features */}
                      <ul className="mt-5 flex-1 space-y-2.5">
                        {(Array.isArray(features) ? features : plan.features).map((f) => (
                          <li key={f} className="flex items-start gap-2.5">
                            <Check size={13} className="mt-0.5 shrink-0" style={{ color: accent.check }} />
                            <span className="text-sm leading-relaxed text-white/55">{f}</span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA */}
                      <button
                        type="button"
                        onClick={() => handleSelectPlan(plan.key)}
                        disabled={isCurrent || !!checkoutLoading}
                        className="mt-6 w-full rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-default flex items-center justify-center gap-2"
                        style={
                          isCurrent
                            ? { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }
                            : accent.cta
                        }
                      >
                        {checkoutLoading === `plan:${plan.key}` && (
                          <Loader2 size={14} className="animate-spin" />
                        )}
                        {isCurrent
                          ? t('sommelierCredits.cta.currentPlan')
                          : checkoutLoading === `plan:${plan.key}`
                          ? t('sommelierCredits.cta.openingCheckout')
                          : t(`sommelierCredits.cta.${plan.key}`)}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Swipe hint — mobile only */}
              <p className="mt-4 text-center text-[11px] text-white/20 sm:hidden">
                {t('sommelierCredits.cta.swipeHint')}
              </p>

              <p className="mt-5 text-center text-[11px] text-white/25">
                {t('sommelierCredits.footer')}
                {currentPlan && currentPlan !== 'free' && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      onClick={handleManageBilling}
                      disabled={portalLoading}
                      className="underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity disabled:opacity-40"
                    >
                      {portalLoading ? t('sommelierCredits.cta.manageBillingLoading') : t('sommelierCredits.cta.manageBilling')}
                    </button>
                  </>
                )}
              </p>
            </div>
          </motion.div>
        )}

        {/* Top-up tab */}
        {activeTab === 'topup' && (
          <motion.div
            key="topup"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.18 }}
            className="max-w-2xl"
          >
            <p className="text-sm sm:text-base" style={{ color: 'var(--text-tertiary)' }}>
              {t('sommelierCredits.topUp.description')}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {TOP_UP_OPTIONS.map((opt, i) => (
                <motion.button
                  key={opt.credits}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: i * 0.07 }}
                  onClick={() => handleTopUp(opt.credits, opt.price)}
                  disabled={!!checkoutLoading}
                  className="group flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{ borderColor: 'var(--border-medium)', background: 'var(--bg-muted)' }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap size={15} style={{ color: 'var(--text-tertiary)' }} />
                      <span className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>
                        {opt.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      One-time purchase — no subscription
                    </p>
                  </div>
                  <div className="shrink-0 pl-4">
                    <span className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>
                      ${opt.price}
                    </span>
                    <ArrowRight size={13} className="ml-1 inline" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                </motion.button>
              ))}
            </div>

            {/* How it works */}
            <div
              className="mt-7 rounded-2xl border p-5"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-muted)' }}
            >
              <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                How Sommelier Credits work
              </h3>
              <ul className="space-y-3">
                {[
                  { icon: <Sparkles size={12} />, text: 'Each Sommelier conversation, wine analysis, or label scan uses a small number of credits.' },
                  { icon: <Check size={12} />,    text: 'Monthly plan credits reset on the 1st of each month.' },
                  { icon: <Zap size={12} />,      text: 'Top-up credits never expire and are used after your monthly allowance runs out.' },
                ].map(({ icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    <span className="mt-0.5 shrink-0 opacity-50">{icon}</span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-5 text-center text-xs" style={{ color: 'var(--text-tertiary)', opacity: 0.5 }}>
              Secured by Paddle · No subscription required for top-ups
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
