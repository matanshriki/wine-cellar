import type { FC, ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';

type Props = {
  children: ReactNode;
};

/** Device chrome matching the landing phone stage aesthetic. */
export const PhoneChrome: FC<Props> = ({ children }) => {
  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '72px 48px 100px',
      }}
    >
      <div
        style={{
          width: 780,
          height: 1560,
          borderRadius: 72,
          padding: 14,
          background:
            'linear-gradient(165deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 42%, rgba(0,0,0,0.35) 100%), linear-gradient(180deg, #2a2426 0%, #120f10 100%)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 58,
            overflow: 'hidden',
            background: '#F7F1E8',
            position: 'relative',
          }}
        >
          {/* Dynamic island */}
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 120,
              height: 28,
              borderRadius: 999,
              background: '#0c0a0b',
              zIndex: 5,
            }}
          />
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};
