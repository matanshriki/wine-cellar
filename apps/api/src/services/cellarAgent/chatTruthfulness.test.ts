/**
 * Chat statements that must match what the app shows: bottle vs wine counts,
 * plural forms, and no sweetness claims without label evidence.
 */
import { describe, it, expect } from 'vitest';
import { buildDeterministicInventoryResponse } from './inventoryQuery.js';
import { extractConstraints } from './tools.js';
import {
  buildConversationalSystemPrompt,
  buildLegacySystemPrompt,
  buildOrchestratedSystemPrompt,
  formatCellarAccessFacts,
} from './prompt.js';
import type { CellarBottleInput } from './types.js';

function bottle(partial: Partial<CellarBottleInput> & { id: string }): CellarBottleInput {
  return { producer: 'P', wineName: 'W', quantity: 1, color: 'red', ...partial };
}

function inventoryMessage(bottles: CellarBottleInput[], language?: string): string {
  const physical = bottles.reduce((n, b) => n + (b.quantity ?? 0), 0);
  const { response } = buildDeterministicInventoryResponse({
    cellarBottles: bottles,
    scannedBottleRows: bottles.length,
    scannedPhysicalBottles: physical,
    constraints: extractConstraints('list my reds'),
    offset: 0,
    language,
  });
  return String(response.message);
}

describe('inventory message counts', () => {
  it('reports physical bottles and distinct wines separately (EN)', () => {
    const msg = inventoryMessage([bottle({ id: 'a', quantity: 3 }), bottle({ id: 'b', quantity: 2 })]);
    expect(msg).toContain('5 bottles across 2 wines');
    expect(msg).not.toMatch(/bottle records/);
  });

  it('uses singular forms for one bottle / one wine (EN)', () => {
    const msg = inventoryMessage([bottle({ id: 'a', quantity: 1 })]);
    expect(msg).toContain('1 bottle across 1 wine.');
    expect(msg).toContain('1 wine matches');
  });

  it('uses Hebrew singular and plural forms', () => {
    const one = inventoryMessage([bottle({ id: 'a', quantity: 1 })], 'he');
    expect(one).toContain('בקבוק אחד ב־יין אחד');
    expect(one).toContain('יין אחד תואם');
    const many = inventoryMessage([bottle({ id: 'a', quantity: 4 }), bottle({ id: 'b', quantity: 1 })], 'he');
    expect(many).toContain('5 בקבוקים ב־2 יינות');
    expect(many).toContain('2 יינות תואמים');
  });
});

describe('cellar access facts', () => {
  it('tells the model that rows are wines and physical bottles are the app count', () => {
    const facts = formatCellarAccessFacts({
      scope: 'full_cellar',
      cellarScannedFully: true,
      scannedBottleRows: 50,
      scannedPhysicalBottles: 55,
      matchedBottleRows: 50,
      matchedPhysicalBottles: 55,
    });
    expect(facts).toContain('"scannedPhysicalBottles": 55');
    expect(facts).toMatch(/COUNTING RULE/);
    expect(facts).toMatch(/Never call rows "bottles"/);
  });
});

describe('sweetness claims in chat prompts', () => {
  const orchestrated = buildOrchestratedSystemPrompt({ shortlistJson: '[]', summary: '', reasoningBlock: '' });
  const legacy = buildLegacySystemPrompt({ cellarJson: '[]', summary: '' });
  const conversational = buildConversationalSystemPrompt({ wineDetails: 'Equinox Campania Rosso Amabile 2021' });

  it.each([
    ['orchestrated', orchestrated],
    ['legacy', legacy],
    ['conversational', conversational],
  ])('%s prompt forbids default "dry" claims and requires label evidence', (_name, prompt) => {
    expect(prompt).toMatch(/no measured sweetness data/i);
    expect(prompt).toMatch(/Amabile/);
    expect(prompt).toMatch(/not confirmed/);
  });
});
