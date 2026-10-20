import type { FC } from 'react';
import { Composition } from 'remotion';
import { SommiLaunch } from './SommiLaunch';
import { DURATION_FRAMES, FPS, HEIGHT, WIDTH } from './theme';

export const RemotionRoot: FC = () => {
  return (
    <>
      <Composition
        id="SommiLaunchEn"
        component={SommiLaunch}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ locale: 'en' as const }}
      />
      <Composition
        id="SommiLaunchHe"
        component={SommiLaunch}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ locale: 'he' as const }}
      />
    </>
  );
};
