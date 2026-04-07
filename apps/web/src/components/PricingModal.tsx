/**
 * PricingModal
 *
 * Premium plan selector for Sommelier Credits.
 * ONLY rendered for users with monetization_enabled = true.
 * Never accessible to non-flagged users — the guard is enforced here
 * AND at every callsite.
 *
 * Entry points:
 *   - Compact credit badge in Layout nav bar
 *   - Upgrade CTA in SommelierCreditsDisplay (low / blocked state)
 *   - Upgrade button in AgentPageWorking when credits are low
 *   - Direct navigation to /upgrade (UpgradePage renders this inline)
 */

import React, { useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Sparkles, Check, Zap, Star, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { PLANS, TOP_UP_OPTIONS, type PlanDefinition } from '../lib/creditPolicy';
import { useMonetizationAccess } from '../hooks/useMonetizationAccess';
import { trackEvent } from '../services/analytics';
import { toast } from '../lib/toast';
import { openCheckout } from '../lib/paddle';
import { supabase } from '../lib/supabase';
import { PurchaseSuccessModal } from './PurchaseSuccessModal';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** If provided, highlights this plan as the recommended upgrade */
  recommendedPlanKey?: string;
  /** If true, shows a "low credits" callout at the top */
  showLowCreditPrompt?: boolean;
}

// ── Plan meta ─────────────────────────────────────────────────────────────────

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free:      <Sparkles size={16} className="text-white/50" />,
  premium:   <Star size={16} className="text-amber-400" />,
  collector: <TrendingUp size={16} className="text-violet-400" />,
};

const PLAN_CTA: Record<string, string> = {
  free:      'Continue with Free',
  premium:   'Upgrade to Premium',
  collector: 'Upgrade to Collector',
};

const PLAN_GRADIENT: Record<string, string> = {
  free:      '',
  premium:   'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,191,36,0.04))',
  collector: 'linear-gradient(135deg, rgba(167,139,250,0.12), rgba(167,139,250,0.04))',
};

// ── Checkout helpers ──────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

async function launchPlanCheckout(
  planKey: string,
  period: 'monthly' | 'yearly',
  opts?: { onSuccess?: () => void },
) {
  const token = await getAuthToken();
  await openCheckout({ plan: planKey, period }, { authToken: token, onSuccess: opts?.onSuccess });
}

async function launchTopUpCheckout(credits: number, opts?: { onSuccess?: () => void }) {
  const token = await getAuthToken();
  await openCheckout({ topup: String(credits) }, { authToken: token, onSuccess: opts?.onSuccess });
}

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  isCurrent,
  isRecommended,
  billingPeriod,
  onSelect,
  loading,
}: {
  plan: PlanDefinition;
  isCurrent: boolean;
  isRecommended: boolean;
  billingPeriod: 'monthly' | 'yearly';
  onSelect: () => void;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const isHighlighted = plan.highlight || isRecommended;
  const features = t(`sommelierCredits.planFeatures.${plan.key}`, { returnObjects: true }) as string[];
  const showYearly = billingPeriod === 'yearly' && plan.priceYearly !== null;
  const effectiveMonthlyPrice = showYearly && plan.priceYearly
    ? (plan.priceYearly / 12).toFixed(2).replace(/\.00$/, '')
    : null;

  return (
    <div
      className="relative flex w-[72vw] max-w-[260px] shrink-0 snap-center flex-col rounded-2xl border p-5 transition-all sm:w-auto sm:max-w-none sm:shrink"
      style={{
        background: isHighlighted ? PLAN_GRADIENT[plan.key] : 'rgba(255,255,255,0.03)',
        borderColor: isHighlighted
          ? plan.key === 'premium'
            ? 'rgba(251,191,36,0.35)'
            : 'rgba(167,139,250,0.35)'
          : 'rgba(255,255,255,0.1)',
        boxShadow: isHighlighted
          ? plan.key === 'premium'
            ? '0 0 0 1px rgba(251,191,36,0.15), 0 8px 32px rgba(0,0,0,0.3)'
            : '0 0 0 1px rgba(167,139,250,0.15), 0 8px 32px rgba(0,0,0,0.3)'
          : '0 4px 16px rgba(0,0,0,0.2)',
      }}
    >
      {/* Badge */}
      {(plan.highlight || isRecommended) && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wider"
          style={{
            background: plan.key === 'premium'
              ? 'linear-gradient(135deg, #F59E0B, #D97706)'
              : 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
            color: '#fff',
          }}
        >
          {isRecommended ? t('sommelierCredits.badges.recommended') : t('sommelierCredits.badges.mostPopular')}
        </span>
      )}

      {/* Plan header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {PLAN_ICONS[plan.key]}
          <span className="text-sm font-semibold text-white">{plan.label}</span>
        </div>
        {isCurrent && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
            style={
              isHighlighted
                ? plan.key === 'premium'
                  ? {
                      background: 'rgba(251,191,36,0.15)',
                      color: '#F59E0B',
                      border: '1px solid rgba(251,191,36,0.3)',
                    }
                  : {
                      background: 'rgba(167,139,250,0.15)',
                      color: '#A78BFA',
                      border: '1px solid rgba(167,139,250,0.3)',
                    }
                : {
                    background: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.45)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }
            }
          >
            <Check size={9} strokeWidth={3} />
            {t('sommelierCredits.badges.active')}
          </span>
        )}
      </div>

      {/* Credits — the KEY metric */}
      <div className="mt-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tabular-nums text-white">
            {plan.monthlyCredits}
          </span>
          <span className="text-xs text-white/40 leading-none" style={{ whiteSpace: 'pre-line' }}>{t('sommelierCredits.plan.creditsPerMonth')}</span>
        </div>
        <div className="mt-1.5">
          {plan.priceMonthly !== null ? (
            <div>
              {showYearly ? (
                <>
                  <span className="text-sm text-white/50">
                    <span className="font-medium text-white/70">${plan.priceYearly}</span> {t('sommelierCredits.plan.perYear')}
                  </span>
                  <p className="mt-0.5 text-xs text-white/35">
                    {t('sommelierCredits.plan.perMonthBilled', { price: effectiveMonthlyPrice })} · {t('sommelierCredits.billing.billedYearly')}
                  </p>
                </>
              ) : (
                <span className="text-sm text-white/50">
                  <span className="font-medium text-white/70">${plan.priceMonthly}</span> {t('sommelierCredits.plan.perMonth')}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm font-medium text-white/50">{t('sommelierCredits.plan.alwaysFree')}</span>
          )}
        </div>
      </div>

      {/* Features */}
      <ul className="mt-5 flex-1 space-y-2.5">
        {(Array.isArray(features) ? features : plan.features).map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check
              size={13}
              className="mt-0.5 shrink-0"
              style={{
                color: plan.key === 'premium'
                  ? 'rgba(251,191,36,0.7)'
                  : plan.key === 'collector'
                  ? 'rgba(167,139,250,0.7)'
                  : 'rgba(255,255,255,0.3)',
              }}
            />
            <span className="text-xs leading-relaxed text-white/60">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        type="button"
        onClick={onSelect}
        disabled={isCurrent || loading}
        className="mt-5 w-full rounded-xl py-2.5 text-sm font-medium transition-all active:scale-[0.98] disabled:cursor-default flex items-center justify-center gap-2"
        style={
          isCurrent
            ? { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)' }
            : isHighlighted
            ? {
                background:
                  plan.key === 'premium'
                    ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                    : 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }
            : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }
        }
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : null}
        {isCurrent
          ? t('sommelierCredits.cta.currentPlan')
          : loading
          ? t('sommelierCredits.cta.openingCheckout')
          : t(`sommelierCredits.cta.${plan.key}`)}
      </button>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function PricingModal({
  isOpen,
  onClose,
  recommendedPlanKey,
  showLowCreditPrompt = false,
}: PricingModalProps) {
  const { t } = useTranslation();
  const { monetizationEnabled, planKey: currentPlan, effectiveBalance, monthlyLimit, refresh } = useMonetizationAccess();
  const [activeTab, setActiveTab] = useState<'plans' | 'topup'>('plans');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const yearlyEnabled = import.meta.env.VITE_PADDLE_YEARLY_ENABLED === 'true';
  const savePercent = Math.round((1 - 90 / (9 * 12)) * 100); // 17 — same for both plans
  const [successModal, setSuccessModal] = useState<{ credits: number; price: number } | null>(null);

  async function handleSelectPlan(planKey: string) {
    if (planKey === currentPlan || planKey === 'free') return;
    trackEvent('pricing_plan_selected', { plan_key: planKey, source: 'pricing_modal' });
    setCheckoutLoading(`plan:${planKey}`);
    try {
      const plan = PLANS.find((p) => p.key === planKey);
      const period = (billingPeriod === 'yearly' && plan?.priceYearly !== null) ? 'yearly' : 'monthly';
      await launchPlanCheckout(planKey, period, {
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
      console.error('[PricingModal] Checkout error:', err);
      toast.error(err?.message ?? t('sommelierCredits.toast.checkoutError'));
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleTopUp(credits: number, price: number) {
    trackEvent('pricing_topup_selected', { credits, price, source: 'pricing_modal' });
    setCheckoutLoading(`topup:${credits}`);
    try {
      await launchTopUpCheckout(credits, {
        onSuccess: () => {
          setSuccessModal({ credits, price });
          setCheckoutLoading(null);
          // Webhook takes a moment to be processed server-side; refresh after a short delay
          setTimeout(() => { refresh(); }, 4000);
        },
      });
    } catch (err: any) {
      console.error('[PricingModal] Top-up checkout error:', err);
      toast.error(err?.message ?? t('sommelierCredits.toast.checkoutError'));
    } finally {
      setCheckoutLoading(null);
    }
  }

  // ── Dark launch guard ─────────────────────────────────────────────────────
  const visible = isOpen && monetizationEnabled;
  if (isOpen && !monetizationEnabled) {
    console.warn('[PricingModal] Suppressed — user does not have monetization_enabled.');
  }

  // ── Keyboard / scroll lock ────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose],
  );

  useEffect(() => {
    if (!visible) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    trackEvent('pricing_modal_opened', {
      current_plan: currentPlan,
      show_low_credit_prompt: showLowCreditPrompt,
      recommended_plan: recommendedPlanKey,
    });
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [visible, handleKeyDown, currentPlan, showLowCreditPrompt, recommendedPlanKey]);

  return (
    <>
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="pricing-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal panel */}
          <motion.div
            key="pricing-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pricing-modal-title"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-3xl overflow-y-auto rounded-t-3xl max-h-[92vh] sm:inset-0 sm:my-auto sm:max-h-[90vh] sm:rounded-3xl"
            style={{
              background: 'linear-gradient(160deg, #0e0c1b 0%, #13101f 60%, #0e0c1b 100%)',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar (mobile) */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="px-6 pt-5 pb-0 sm:pt-8 sm:px-8">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <Sparkles size={16} className="text-amber-400" />
                    <h2
                      id="pricing-modal-title"
                      className="text-lg font-semibold text-white sm:text-xl"
                    >
                      {t('sommelierCredits.title')}
                    </h2>
                  </div>
                  <p className="mt-1.5 text-sm text-white/45 max-w-md">
                    {t('sommelierCredits.subtitle')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="ml-4 shrink-0 rounded-full p-2 text-white/35 transition-colors hover:bg-white/8 hover:text-white/70"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Low-credit prompt */}
              {showLowCreditPrompt && (
                <div
                  className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3"
                >
                  <Sparkles size={14} className="mt-0.5 shrink-0 text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">
                      {monthlyLimit > 0
                        ? t('sommelierCredits.plan.creditsRemainingOf', { count: effectiveBalance, limit: monthlyLimit })
                        : t('sommelierCredits.plan.creditsRemaining', { count: effectiveBalance })}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-400/60">
                      {t('sommelierCredits.upgradeSubtitle')}
                    </p>
                  </div>
                </div>
              )}

              {/* Tab switcher */}
              <div className="mt-5 flex gap-1 rounded-xl bg-white/5 p-1">
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
                  {t('sommelierCredits.tabs.monthlyPlans')}
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
                  {t('sommelierCredits.tabs.topUp')}
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 pb-8 pt-5 sm:px-8 sm:pb-10">
              <AnimatePresence mode="wait">
                {activeTab === 'plans' ? (
                  <motion.div
                    key="plans-tab"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    {/* Billing period toggle — only shown when yearly prices are configured */}
                    {yearlyEnabled && <div className="mb-4 flex justify-center">
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
                    </div>}

                    <div className="-mx-2 flex snap-x snap-mandatory gap-4 overflow-x-auto px-2 pb-1 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 sm:pt-0 sm:gap-4">
                    {PLANS.map((plan) => (
                      <PlanCard
                        key={plan.key}
                        plan={plan}
                        isCurrent={currentPlan === plan.key}
                        isRecommended={recommendedPlanKey === plan.key && currentPlan !== plan.key}
                        billingPeriod={billingPeriod}
                        onSelect={() => handleSelectPlan(plan.key)}
                        loading={checkoutLoading === `plan:${plan.key}`}
                      />
                    ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="topup-tab"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.18 }}
                  >
                    <p className="text-sm text-white/45">
                      {t('sommelierCredits.topUp.description')}
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {TOP_UP_OPTIONS.map((opt) => (
                        <button
                          key={opt.credits}
                          type="button"
                          onClick={() => handleTopUp(opt.credits, opt.price)}
                          disabled={!!checkoutLoading}
                          className="group relative flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-5 py-4 text-left transition-all hover:border-white/20 hover:bg-white/7 active:scale-[0.98] disabled:opacity-60"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <Zap size={14} className="text-white/40 group-hover:text-amber-400 transition-colors" />
                              <span className="text-base font-semibold text-white">
                                {t('sommelierCredits.topUp.credits', { credits: opt.credits })}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-white/40">
                              {t('sommelierCredits.topUp.oneTimePurchase')}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="text-xl font-bold text-white">${opt.price}</span>
                            <ArrowRight
                              size={14}
                              className="ml-1.5 inline text-white/30 group-hover:text-white/60 transition-colors"
                            />
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Visual separator */}
                    <div className="mt-6 flex items-center gap-3">
                      <div className="h-px flex-1 bg-white/8" />
                      <span className="text-[11px] text-white/25">{t('sommelierCredits.topUp.howItWorks')}</span>
                      <div className="h-px flex-1 bg-white/8" />
                    </div>

                    {/* How-it-works micro guide */}
                    <ul className="mt-4 space-y-3">
                      {(t('sommelierCredits.topUp.bullets', { returnObjects: true }) as string[]).map((text, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-white/40">
                          <span className="mt-0.5 shrink-0 text-white/30">
                            {i === 0 ? <Sparkles size={12} /> : i === 1 ? <Check size={12} /> : <Zap size={12} />}
                          </span>
                          {text}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Fine print */}
              <p className="mt-6 text-center text-[11px] text-white/20">
                {t('sommelierCredits.footer')}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    <PurchaseSuccessModal
      open={successModal !== null}
      credits={successModal?.credits ?? 0}
      price={successModal?.price ?? 0}
      newBalance={successModal !== null ? effectiveBalance : null}
      onClose={() => setSuccessModal(null)}
    />
    </>
  );
}
