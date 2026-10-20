import type { FC } from 'react';
import { DEMO_BOTTLES } from './demoData';
import { theme } from '../theme';
import type { CaptionLocale } from '../captions';

type Props = {
  locale: CaptionLocale;
};

export const AppCellarScreen: FC<Props> = ({ locale }) => {
  const isHe = locale === 'he';
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
        Sommi
      </div>
      <div
        style={{
          marginTop: 10,
          fontFamily: 'Fraunces, Georgia, serif',
          fontSize: 44,
          fontWeight: 650,
          color: theme.burgundy,
        }}
      >
        {isHe ? 'המרתף' : 'Cellar'}
      </div>
      <div style={{ marginTop: 8, fontSize: 22, color: theme.stone }}>
        {isHe ? '3 בקבוקים לדוגמה' : '3 sample bottles'}
      </div>

      <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {DEMO_BOTTLES.map((b) => (
          <div
            key={b.id}
            style={{
              display: 'flex',
              gap: 18,
              padding: 20,
              borderRadius: 20,
              background: 'linear-gradient(180deg, rgba(255,253,249,0.95), rgba(255,252,248,0.8))',
              border: '1px solid rgba(74,23,34,0.1)',
              boxShadow: '0 10px 28px rgba(45,24,16,0.06)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: `linear-gradient(145deg, ${b.color}, #2d1810)`,
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 18, color: theme.stone }}>{b.producer}</div>
              <div style={{ fontSize: 26, fontWeight: 600, color: theme.ink, marginTop: 2 }}>
                {b.name} · {b.vintage}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    padding: '4px 12px',
                    borderRadius: 999,
                    background: b.readiness === 'ready' ? theme.sageSoft : 'rgba(74,23,34,0.08)',
                    color: b.readiness === 'ready' ? '#3F5238' : theme.burgundyMid,
                  }}
                >
                  {isHe ? b.readinessLabelHe : b.readinessLabelEn}
                </span>
                <span style={{ fontSize: 16, color: theme.stone }}>{b.region}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
