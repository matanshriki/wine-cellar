import en from '../scripts/en-captions.json';
import he from '../scripts/he-captions.json';

export type CaptionLocale = 'en' | 'he';

export type CaptionScript = {
  locale: string;
  dir: 'ltr' | 'rtl';
  totalDurationSec: number;
  voiceover: { startSec: number; endSec: number; text: string }[];
  onScreen: { startSec: number; endSec: number; line: string }[];
};

export const captionsByLocale: Record<CaptionLocale, CaptionScript> = {
  en: en as CaptionScript,
  he: he as CaptionScript,
};

export function activeOnScreen(script: CaptionScript, timeSec: number): string {
  const hit = script.onScreen.find((c) => timeSec >= c.startSec && timeSec < c.endSec);
  return hit?.line ?? '';
}

export function activeVoiceover(script: CaptionScript, timeSec: number): string {
  const hit = script.voiceover.find((c) => timeSec >= c.startSec && timeSec < c.endSec);
  return hit?.text ?? '';
}
