/**
 * Serving Recommendations
 * 
 * Derives serving temperature and decant recommendations based on wine characteristics.
 */

import type { BottleWithWineInfo } from '../services/bottleService';

export interface ServingRecommendation {
  servingTemp: {
    celsius: number;
    label: string;
    description: string;
  };
  decant: {
    recommended: boolean;
    minutes: number;
    label: string;
    description: string;
  };
  rateReminderMinutes: number;
}

// Serving temperature ranges by wine type
const TEMP_RANGES = {
  sparkling: { min: 6, max: 8, label: 'Well Chilled', description: 'Serve ice cold for best bubbles' },
  lightWhite: { min: 8, max: 10, label: 'Chilled', description: 'Crisp and refreshing' },
  fullWhite: { min: 10, max: 13, label: 'Lightly Chilled', description: 'Cool but not cold' },
  rose: { min: 8, max: 12, label: 'Chilled', description: 'Fresh and vibrant' },
  lightRed: { min: 14, max: 16, label: 'Slightly Cool', description: 'Below room temperature' },
  mediumRed: { min: 16, max: 18, label: 'Cellar Temperature', description: 'Cool to the touch' },
  fullRed: { min: 17, max: 19, label: 'Room Temperature', description: 'Classic serving temp' },
  dessert: { min: 8, max: 14, label: 'Varied', description: 'Depends on style' },
  fortified: { min: 12, max: 18, label: 'Cool to Room', description: 'Style dependent' },
};

// Decant recommendations based on power and tannin
function getDecantRecommendation(
  power: number | null,
  tannin: number | null,
  body: number | null,
  color: string | undefined,
  age: number | undefined
): { recommended: boolean; minutes: number; label: string; description: string } {
  // White wines, rosé, and sparkling rarely need decanting
  if (color === 'white' || color === 'rosé' || color === 'sparkling') {
    return {
      recommended: false,
      minutes: 0,
      label: 'No Decant Needed',
      description: 'Serve directly from the bottle',
    };
  }

  // Normalize values (power is 1-10, tannin/body are 1-5)
  const normalizedPower = power ? power / 10 : 0.5;
  const normalizedTannin = tannin ? tannin / 5 : 0.5;
  const normalizedBody = body ? body / 5 : 0.5;

  // Calculate decant score
  const decantScore = (normalizedPower * 0.4) + (normalizedTannin * 0.4) + (normalizedBody * 0.2);

  // Young, powerful wines need more decanting
  const ageModifier = age !== undefined ? (age < 5 ? 1.2 : age > 15 ? 0.7 : 1) : 1;
  const adjustedScore = decantScore * ageModifier;

  if (adjustedScore < 0.35) {
    return {
      recommended: false,
      minutes: 0,
      label: 'No Decant Needed',
      description: 'Light and ready to enjoy',
    };
  } else if (adjustedScore < 0.5) {
    return {
      recommended: true,
      minutes: 15,
      label: 'Quick Splash',
      description: 'A brief pour will open it up',
    };
  } else if (adjustedScore < 0.65) {
    return {
      recommended: true,
      minutes: 30,
      label: 'Standard Decant',
      description: 'Let it breathe for best results',
    };
  } else if (adjustedScore < 0.8) {
    return {
      recommended: true,
      minutes: 45,
      label: 'Full Decant',
      description: 'Needs time to reveal its depth',
    };
  } else {
    return {
      recommended: true,
      minutes: 60,
      label: 'Extended Decant',
      description: 'A powerful wine that rewards patience',
    };
  }
}

function getServingTemp(
  color: string | undefined,
  body: number | null,
  style: string | undefined,
  existingTemp: number | null
): { celsius: number; label: string; description: string } {
  // Use existing temperature if available
  if (existingTemp && existingTemp > 0) {
    let label = 'Cellar Temperature';
    let description = 'As recommended';
    if (existingTemp <= 8) {
      label = 'Well Chilled';
      description = 'Serve cold';
    } else if (existingTemp <= 12) {
      label = 'Chilled';
      description = 'Cool and refreshing';
    } else if (existingTemp <= 16) {
      label = 'Lightly Cool';
      description = 'Below room temperature';
    } else {
      label = 'Room Temperature';
      description = 'Classic serving temp';
    }
    return { celsius: existingTemp, label, description };
  }

  // Derive from wine characteristics
  const normalColor = color?.toLowerCase() || 'red';
  const normalBody = body || 3;

  // Sparkling
  if (normalColor === 'sparkling' || style?.toLowerCase().includes('sparkling')) {
    return { ...TEMP_RANGES.sparkling, celsius: 7 };
  }

  // Rosé
  if (normalColor === 'rosé' || normalColor === 'rose') {
    return { ...TEMP_RANGES.rose, celsius: 10 };
  }

  // White wines
  if (normalColor === 'white') {
    if (normalBody <= 2) {
      return { ...TEMP_RANGES.lightWhite, celsius: 9 };
    } else if (normalBody >= 4) {
      return { ...TEMP_RANGES.fullWhite, celsius: 12 };
    }
    return { ...TEMP_RANGES.lightWhite, celsius: 10 };
  }

  // Red wines
  if (normalBody <= 2) {
    return { ...TEMP_RANGES.lightRed, celsius: 15 };
  } else if (normalBody >= 4) {
    return { ...TEMP_RANGES.fullRed, celsius: 18 };
  }
  return { ...TEMP_RANGES.mediumRed, celsius: 17 };
}

export function getServingRecommendations(bottle: BottleWithWineInfo): ServingRecommendation {
  const wine = bottle.wine;
  const wineProfile = wine?.wine_profile as {
    body?: number;
    tannin?: number;
    power?: number;
  } | null;

  const currentYear = new Date().getFullYear();
  const age = wine?.vintage ? currentYear - wine.vintage : undefined;

  const servingTemp = getServingTemp(
    wine?.color,
    wineProfile?.body ?? null,
    wine?.regional_wine_style,
    bottle.serve_temp_c ?? null
  );

  // Use existing decant_minutes if available
  let decant: ServingRecommendation['decant'];
  if (bottle.decant_minutes && bottle.decant_minutes > 0) {
    const mins = bottle.decant_minutes;
    let label = 'Standard Decant';
    let description = 'As recommended';
    if (mins <= 15) {
      label = 'Quick Splash';
      description = 'A brief pour will open it up';
    } else if (mins <= 30) {
      label = 'Standard Decant';
      description = 'Let it breathe for best results';
    } else if (mins <= 45) {
      label = 'Full Decant';
      description = 'Needs time to reveal its depth';
    } else {
      label = 'Extended Decant';
      description = 'A powerful wine that rewards patience';
    }
    decant = { recommended: true, minutes: mins, label, description };
  } else {
    decant = getDecantRecommendation(
      wineProfile?.power ?? null,
      wineProfile?.tannin ?? null,
      wineProfile?.body ?? null,
      wine?.color,
      age
    );
  }

  // Rate reminder: based on decant time + some buffer
  const rateReminderMinutes = decant.recommended 
    ? Math.max(20, decant.minutes + 15) 
    : 20;

  return {
    servingTemp,
    decant,
    rateReminderMinutes,
  };
}

// Preset options for decant duration
export const DECANT_PRESETS = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 45, label: '45 min' },
  { minutes: 60, label: '60 min' },
];

// Preset options for rate reminder
export const RATE_REMINDER_PRESETS = [
  { minutes: 20, label: '20 min' },
  { minutes: 45, label: '45 min' },
  { minutes: 90, label: '90 min' },
];

// Get default decant preset index based on recommendation
export function getDefaultDecantPresetIndex(recommendedMinutes: number): number {
  const presets = DECANT_PRESETS.map(p => p.minutes);
  let closest = 0;
  let minDiff = Math.abs(presets[0] - recommendedMinutes);
  
  for (let i = 1; i < presets.length; i++) {
    const diff = Math.abs(presets[i] - recommendedMinutes);
    if (diff < minDiff) {
      minDiff = diff;
      closest = i;
    }
  }
  
  return closest;
}

// Get default rate reminder preset index based on decant time
export function getDefaultRatePresetIndex(decantMinutes: number): number {
  if (decantMinutes >= 45) return 2; // 90 min
  if (decantMinutes >= 20) return 1; // 45 min
  return 0; // 20 min
}
