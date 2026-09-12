/**
 * Prominent Sommi shortcut above the Tonight form.
 * Shown only when the cellar agent is enabled and the form is available.
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SOMMI_AGENT_ICON_URL } from '../constants/brandAssets';
import { trackRecommendation } from '../services/analytics';
import {
  AGENT_ENTRY_TONIGHT_CARD,
  markTonightCardEntry,
  type AgentLocationState,
} from '../types/agentEntry';

/** Suppress Strict Mode double-mount duplicate in the same tick window. */
let lastSommiCardShownAt = 0;

export function TonightSommiCard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const shownTrackedRef = useRef(false);

  useEffect(() => {
    if (shownTrackedRef.current) return;
    const now = Date.now();
    if (now - lastSommiCardShownAt < 1000) {
      shownTrackedRef.current = true;
      return;
    }
    shownTrackedRef.current = true;
    lastSommiCardShownAt = now;
    trackRecommendation.sommiCardShown({
      locale: i18n.language,
      source_page: 'recommendation',
    });
    // Once per card mount / page view — not when locale reference churns.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-once
  }, []);

  function handleTalkToSommi() {
    trackRecommendation.sommiCardClicked({ source: AGENT_ENTRY_TONIGHT_CARD });
    markTonightCardEntry();

    const state: AgentLocationState = {
      agentEntry: { source: AGENT_ENTRY_TONIGHT_CARD },
    };
    navigate('/agent', { state });
  }

  return (
    <div className="mb-6">
      <section
        className="rounded-2xl p-4 sm:p-5"
        style={{
          background: 'var(--bg-surface)',
          border: '2px solid var(--wine-500)',
          boxShadow: 'var(--shadow-card)',
        }}
        aria-labelledby="tonight-sommi-card-title"
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <img
            src={SOMMI_AGENT_ICON_URL}
            alt=""
            width={48}
            height={48}
            className="h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 rounded-full object-cover"
            style={{ border: '1px solid var(--border-subtle)' }}
          />

          <div className="min-w-0 flex-1 text-start">
            <h2
              id="tonight-sommi-card-title"
              className="text-lg sm:text-xl font-semibold leading-snug"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--text-heading)',
              }}
            >
              {t('recommendation.sommiCard.title')}
            </h2>

            <p
              className="mt-1.5 text-sm sm:text-[15px] leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('recommendation.sommiCard.body')}
            </p>

            <button
              type="button"
              onClick={handleTalkToSommi}
              className="btn btn-primary mt-3 min-h-[44px] w-full sm:w-auto px-5"
              data-testid="tonight-sommi-card-cta"
            >
              {t('recommendation.sommiCard.cta')}
            </button>
          </div>
        </div>
      </section>

      <p
        className="mt-5 mb-1 text-center text-xs sm:text-sm font-medium tracking-wide"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {t('recommendation.sommiCard.orPickYourWay')}
      </p>
    </div>
  );
}
