import type { FC } from 'react';
import { DEMO_BOTTLES, DEMO_WHY_EN, DEMO_WHY_HE } from './demoData';
import { theme } from '../theme';
import type { CaptionLocale } from '../captions';

type Props = {
  locale: CaptionLocale;
};

export const AppResultScreen: FC<Props> = ({ locale }) => {
  const isHe = locale === 'he';
  const pick = DEMO_BOTTLES[0];
  const why = isHe ? DEMO_WHY_HE : DEMO_WHY_EN;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(180deg, #F7F1E8 0%, #EBE4D9 100%)',
        padding: '64px 28px 40px',
        boxSizing: 'border-box',
        direction: isHe ? 'rtl' : 'ltr',
        fontFamily: 'Rubik, Assistant, system-ui, sans-serif',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600, color: theme.gold, letterSpacing: isHe ? 0 : '0.12em', textTransform: 'uppercase' }}>
        {isHe ? 'בחירה לדוגמה' : 'Example pick'}
      </div>
      <div
        style={{
          marginTop: 10,
          fontFamily: 'Fraunces, Georgia, serif',
          fontSize: 36,
          fontWeight: 650,
          color: theme.burgundy,
          lineHeight: 1.2,
        }}
      >
        {isHe ? 'מהמרתף שלכם' : 'From your cellar'}
      </div>

      <div
        style={{
          marginTop: 28,
          borderRadius: 24,
          overflow: 'hidden',
          background: theme.surface,
          border: '1px solid rgba(74,23,34,0.1)',
          boxShadow: '0 16px 40px rgba(45,24,16,0.1)',
        }}
      >
        <div
          style={{
            height: 160,
            background: `linear-gradient(135deg, ${pick.color} 0%, #1a1014 100%)`,
            display: 'flex',
            alignItems: 'flex-end',
            padding: 24,
          }}
        >
          <div>
            <div style={{ color: 'rgba(247,241,232,0.75)', fontSize: 18 }}>{pick.producer}</div>
            <div style={{ color: theme.ivory, fontSize: 34, fontWeight: 650, fontFamily: 'Fraunces, Georgia, serif' }}>
              {pick.name}, {pick.vintage}
            </div>
          </div>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 999,
                background: theme.sageSoft,
                color: '#3F5238',
              }}
            >
              {isHe ? pick.readinessLabelHe : pick.readinessLabelEn}
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 500,
                padding: '6px 12px',
                borderRadius: 999,
                background: 'rgba(74,23,34,0.06)',
                color: theme.stone,
              }}
            >
              {pick.region} · {isHe ? 'אדום' : 'Red'}
            </span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: theme.ink, marginBottom: 8 }}>
            {isHe ? 'למה הבקבוק הזה' : 'Why this bottle'}
          </div>
          <div style={{ fontSize: 22, color: theme.stone, lineHeight: 1.45 }}>{why}</div>
          <div style={{ marginTop: 14, fontSize: 16, color: theme.stone }}>
            {isHe
              ? 'הנחיית חלון שתייה היא הערכה—לא תחזית מובטחת.'
              : 'Drink-window guidance is an estimate—not a guaranteed prediction.'}
          </div>
        </div>
      </div>
    </div>
  );
};
