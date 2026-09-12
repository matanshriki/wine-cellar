/**
 * Profile page placement for SommiMemoryCard (source-order contract).
 * Full RTL render coverage lives with TasteProfileCard overlay conventions.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('ProfilePage Sommi memory placement', () => {
  it('renders SommiMemoryCard directly below TasteProfileCard and before WeeklySummaryCard', () => {
    const src = readFileSync(resolve(__dirname, '../pages/ProfilePage.tsx'), 'utf8');
    const taste = src.indexOf('<TasteProfileCard');
    const memory = src.indexOf('<SommiMemoryCard');
    const weekly = src.indexOf('<WeeklySummaryCard');
    expect(taste).toBeGreaterThan(-1);
    expect(memory).toBeGreaterThan(taste);
    expect(weekly).toBeGreaterThan(memory);
  });

  it('Tell Sommi CTA navigates to /agent without sending a message', () => {
    const src = readFileSync(
      resolve(__dirname, '../components/SommiMemoryCard.tsx'),
      'utf8'
    );
    expect(src).toMatch(/navigate\('\/agent'\)/);
    expect(src).not.toMatch(/sendAgentMessage/);
    expect(src).not.toMatch(/\/api\/agent\/recommend/);
  });

  it('mutations go through /api/profile/sommi-memory only', () => {
    const src = readFileSync(
      resolve(__dirname, '../services/sommiMemoryService.ts'),
      'utf8'
    );
    expect(src).toMatch(/\/api\/profile\/sommi-memory/);
    expect(src).not.toMatch(/\/api\/agent\/recommend/);
  });

  it('confirm lifecycle mints one operation ID and reuses it on retry', () => {
    const src = readFileSync(
      resolve(__dirname, '../components/SommiMemoryCard.tsx'),
      'utf8'
    );
    expect(src).toMatch(/resolveOperationIdForAttempt/);
    expect(src).toMatch(/activeOperationId/);
    expect(src).toMatch(/if \(!confirm \|\| busyKey\) return/);
    expect(src).toMatch(/retainOperationId/);
    expect(src).toMatch(/setActiveOperationId\(null\)/);
  });
});
