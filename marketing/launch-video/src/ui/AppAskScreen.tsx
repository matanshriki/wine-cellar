import type { FC } from 'react';
import { DEMO_ASK_EN, DEMO_ASK_HE } from './demoData';
import { theme } from '../theme';
import type { CaptionLocale } from '../captions';

type Props = {
  locale: CaptionLocale;
};

export const AppAskScreen: FC<Props> = ({ locale }) => {
  const isHe = locale === 'he';
  const ask = isHe ? DEMO_ASK_HE : DEMO_ASK_EN;

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
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600, color: theme.gold, letterSpacing: isHe ? 0 : '0.12em', textTransform: 'uppercase' }}>
        Sommi
      </div>
      <div
        style={{
          marginTop: 10,
          fontFamily: 'Fraunces, Georgia, serif',
          fontSize: 40,
          fontWeight: 650,
          color: theme.burgundy,
        }}
      >
        {isHe ? 'שאלו את סומי' : 'Ask Sommi'}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 20, paddingBottom: 24 }}>
        <div
          style={{
            alignSelf: isHe ? 'flex-start' : 'flex-end',
            maxWidth: '88%',
            background: theme.burgundyMid,
            color: '#fff',
            borderRadius: isHe ? '28px 28px 28px 8px' : '28px 28px 8px 28px',
            padding: '22px 26px',
            fontSize: 26,
            lineHeight: 1.4,
            boxShadow: '0 12px 32px rgba(107,31,47,0.28)',
          }}
        >
          {ask}
        </div>
        <div
          style={{
            alignSelf: isHe ? 'flex-end' : 'flex-start',
            fontSize: 20,
            color: theme.stone,
            paddingInline: 8,
          }}
        >
          {isHe ? 'בודק את המרתף לדוגמה…' : 'Looking through your sample cellar…'}
        </div>
      </div>

      <div
        style={{
          borderRadius: 999,
          border: '1px solid rgba(74,23,34,0.14)',
          background: 'rgba(255,253,249,0.9)',
          padding: '18px 24px',
          color: theme.stone,
          fontSize: 22,
        }}
      >
        {isHe ? 'שאלה על ארוחה או אירוע…' : 'Ask about a meal or occasion…'}
      </div>
    </div>
  );
};
