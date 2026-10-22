import { afterEach, describe, expect, it } from 'vitest';
import {
  closeModalLayer,
  isTopmostModalLayer,
  openModalLayer,
  openModalLayerCount,
  setModalBackgroundAdapter,
  subscribeModalStack,
} from './modalStack';

function fakeBackground() {
  const log: string[] = [];
  const restore = setModalBackgroundAdapter({ lock: () => log.push('lock'), unlock: () => log.push('unlock') });
  return { log, restore };
}

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
});

describe('modal stack', () => {
  it('locks the background once for nested dialogs and unlocks after the last one closes', () => {
    const bg = fakeBackground();
    restore = bg.restore;
    const planner = openModalLayer();
    const swap = openModalLayer();
    expect(bg.log).toEqual(['lock']);
    closeModalLayer(swap);
    expect(bg.log).toEqual(['lock']);
    closeModalLayer(planner);
    expect(bg.log).toEqual(['lock', 'unlock']);
    expect(openModalLayerCount()).toBe(0);
  });

  it('only the newest dialog is topmost, so Escape closes just that one', () => {
    restore = fakeBackground().restore;
    const planner = openModalLayer();
    const swap = openModalLayer();
    expect(isTopmostModalLayer(swap)).toBe(true);
    expect(isTopmostModalLayer(planner)).toBe(false);
    closeModalLayer(swap);
    expect(isTopmostModalLayer(planner)).toBe(true);
    closeModalLayer(planner);
  });

  it('closing a layer twice or out of order keeps the stack consistent', () => {
    const bg = fakeBackground();
    restore = bg.restore;
    const a = openModalLayer();
    const b = openModalLayer();
    closeModalLayer(a);
    closeModalLayer(a);
    expect(isTopmostModalLayer(b)).toBe(true);
    expect(bg.log).toEqual(['lock']);
    closeModalLayer(b);
    expect(bg.log).toEqual(['lock', 'unlock']);
  });

  it('notifies subscribers so topmost state re-renders', () => {
    restore = fakeBackground().restore;
    let calls = 0;
    const unsubscribe = subscribeModalStack(() => { calls += 1; });
    const a = openModalLayer();
    closeModalLayer(a);
    unsubscribe();
    closeModalLayer(openModalLayer());
    expect(calls).toBe(2);
  });
});
