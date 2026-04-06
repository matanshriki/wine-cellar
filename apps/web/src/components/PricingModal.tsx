/**
 * PricingModal
 *
 * Premium plan selector for Sommelier Credits.
 * ONLY rendered for users with monetization_enabled = true.
 * Never accessible to non-flagged users — the guard is enforced here
 * AND at every callsite.
 *
 * Stripe is NOT wired. CTA handlers are placeholder-ready:
 *   handleSelectPlan(planKey)  → replace with Stripe Checkout
 *   handleTopUp(packageKey)    → replace with Stripe one-time payment
 *
 * Entry points:
 *   - Compact credit badge in Layout nav bar
 *   - Upgrade CTA in SommelierCreditsDisplay (low / blocked state)
 *   - Upgrade button in AgentPageWorking when credits are low
 *   - Direct navigation to /upgrade (UpgradePage renders this inline)
 */

import React, { useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Check, Zap, Star, TrendingUp, ArrowRight } from 'lucide-react';
import { PLANS, TOP_UP_OPTIONS, type PlanDefinition } from '../lib/creditPolicy';
import { useMonetizationAccess } from '../hooks/useMonetizationAccess';
import { trackEvent } from '../services/analytics';
import { toast } from '../lib/toast';

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

// ── Handlers (placeholder — replace with Stripe) ─────────────────────────────

function handleSelectPlan(planKey: string, currentPlan: string | null) {
  if (planKey === currentPlan) return;

  trackEvent('pricing_plan_selected', { plan_key: planKey, source: 'pricing_modal' });

  console.log('[PricingModal] Plan selected (Stripe not wired yet):', planKey);
  toast.success(
    `${planKey.charAt(0).toUpperCase() + planKey.slice(1)} plan coming soon — ` +
    `you're among the first to be notified.`,
  );
}

function handleTopUp(credits: number, price: number) {
  trackEvent('pricing_topup_selected', { credits, price, source: 'pricing_modal' });

  console.log('[PricingModal] Top-up selected (Stripe not wired yet):', credits, 'credits');
  toast.success(`${credits} Sommelier Credits — top-ups coming soon!`);
}

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  isCurrent,
  isRecommended,
  onSelect,
}: {
  plan: PlanDefinition;
  isCurrent: boolean;
  isRecommended: boolean;
  onSelect: () => void;
}) {
  const isHighlighted = plan.highlight || isRecommended;

  return (
    <div
      className="relative flex flex-col rounded-2xl border p-5 transition-all"
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
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            background: plan.key === 'premium'
              ? 'linear-gradient(135deg, #F59E0B, #D97706)'
              : 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
            color: '#fff',
          }}
        >
          {isRecommended ? 'Recommended' : 'Most popular'}
        </span>
      )}

      {/* Plan header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {PLAN_ICONS[plan.key]}
          <span className="text-sm font-semibold text-white">{plan.label}</span>
        </div>
        {isCurrent && (
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-white/50">
            Your plan
          </span>
        )}
      </div>

      {/* Credits — the KEY metric */}
      <div className="mt-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tabular-nums text-white">
            {plan.monthlyCredits}
          </span>
          <span className="text-xs text-white/40 leading-none">credits<br/>/ month</span>
        </div>
        <div className="mt-1.5">
          {plan.priceMonthly !== null ? (
            <span className="text-sm text-white/50">
              <span className="font-medium text-white/70">${plan.priceMonthly}</span> / month
            </span>
          ) : (
            <span className="text-sm font-medium text-white/50">Always free</span>
          )}
        </div>
      </div>

      {/* Features */}
      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((f) => (
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
        disabled={isCurrent}
        className="mt-5 w-full rounded-xl py-2.5 text-sm font-medium transition-all active:scale-[0.98] disabled:cursor-default"
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
        {isCurrent ? 'Your current plan' : PLAN_CTA[plan.key]}
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
  const { monetizationEnabled, planKey: currentPlan, effectiveBalance, monthlyLimit } = useMonetizationAccess();
  const [activeTab, setActiveTab] = useState<'plans' | 'topup'>('plans');

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
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-3xl overflow-y-auto rounded-t-3xl sm:inset-0 sm:my-auto sm:max-h-[90vh] sm:rounded-3xl"
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
                      Sommelier Credits
                    </h2>
                  </div>
                  <p className="mt-1.5 text-sm text-white/45 max-w-md">
                    Choose the plan that fits how you discover, collect, and enjoy wine.
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
                      You have {effectiveBalance} Sommelier Credit{effectiveBalance === 1 ? '' : 's'} remaining
                      {monthlyLimit > 0 ? ` of ${monthlyLimit}` : ''}.
                    </p>
                    <p className="mt-0.5 text-xs text-amber-400/60">
                      Upgrade for deeper cellar insights and more Sommelier sessions.
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
                    className="grid gap-4 sm:grid-cols-3"
                  >
                    {PLANS.map((plan) => (
                      <PlanCard
                        key={plan.key}
                        plan={plan}
                        isCurrent={currentPlan === plan.key}
                        isRecommended={recommendedPlanKey === plan.key && currentPlan !== plan.key}
                        onSelect={() => handleSelectPlan(plan.key, currentPlan)}
                      />
                    ))}
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
                      Need more? Add extra Sommelier Credits anytime — they stack on top of
                      your monthly allowance and never expire.
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {TOP_UP_OPTIONS.map((opt) => (
                        <button
                          key={opt.credits}
                          type="button"
                          onClick={() => handleTopUp(opt.credits, opt.price)}
                          className="group relative flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-5 py-4 text-left transition-all hover:border-white/20 hover:bg-white/7 active:scale-[0.98]"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <Zap size={14} className="text-white/40 group-hover:text-amber-400 transition-colors" />
                              <span className="text-base font-semibold text-white">
                                {opt.label}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-white/40">
                              One-time purchase — no subscription
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
                      <span className="text-[11px] text-white/25">How Sommelier Credits work</span>
                      <div className="h-px flex-1 bg-white/8" />
                    </div>

                    {/* How-it-works micro guide */}
                    <ul className="mt-4 space-y-3">
                      {[
                        { icon: <Sparkles size={12} />, text: 'Each Sommelier conversation, wine analysis, or label scan uses a small number of credits.' },
                        { icon: <Check size={12} />, text: 'Monthly plan credits reset on the 1st of each month.' },
                        { icon: <Zap size={12} />, text: 'Top-up credits never expire and are used after your monthly allowance.' },
                      ].map(({ icon, text }) => (
                        <li key={text} className="flex items-start gap-2.5 text-xs text-white/40">
                          <span className="mt-0.5 shrink-0 text-white/30">{icon}</span>
                          {text}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Fine print */}
              <p className="mt-6 text-center text-[11px] text-white/20">
                Subscriptions and payments are coming soon — you'll be the first to know.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
