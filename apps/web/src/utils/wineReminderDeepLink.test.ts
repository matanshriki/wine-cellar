import { describe, expect, it } from 'vitest';
import {
  buildWineReminderPath,
  parseKeepReminderBottleId,
} from './wineReminderDeepLink';

describe('buildWineReminderPath', () => {
  it('builds keep deep link with bottleId', () => {
    const path = buildWineReminderPath({
      reminderType: 'keep',
      bottleId: 'bottle-uuid-1',
      wineName: 'Pinot Noir',
      producer: 'Local Cellar',
    });
    expect(path).toBe(
      '/cellar?reminder=keep&bottleId=bottle-uuid-1&wineName=Pinot+Noir&producer=Local+Cellar',
    );
  });

  it('does not collapse keep into decant', () => {
    const path = buildWineReminderPath({
      reminderType: 'keep',
      bottleId: 'b1',
    });
    expect(path).toContain('reminder=keep');
    expect(path).not.toContain('reminder=decant');
  });

  it('keeps rate and decant formats intact', () => {
    expect(
      buildWineReminderPath({
        reminderType: 'rate',
        historyId: 'h1',
        wineName: 'X',
      }),
    ).toContain('reminder=rate');
    expect(
      buildWineReminderPath({
        reminderType: 'decant',
        bottleId: 'b1',
      }),
    ).toContain('reminder=decant');
  });
});

describe('parseKeepReminderBottleId', () => {
  it('extracts bottleId from keep query', () => {
    expect(parseKeepReminderBottleId('?reminder=keep&bottleId=abc')).toBe('abc');
  });

  it('returns null for other reminder types', () => {
    expect(parseKeepReminderBottleId('?reminder=decant&bottleId=abc')).toBeNull();
    expect(parseKeepReminderBottleId('')).toBeNull();
  });
});
