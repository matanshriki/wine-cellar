import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  acquireScrollLock,
  isScrollLocked,
  releaseOrphanedScrollLock,
  resetScrollLockForTests,
  suspendScrollLock,
} from './scrollLock';

type FakeStyle = { overflow: string; position: string; top: string; width: string };
let style: FakeStyle;
const originalDocument = globalThis.document;

beforeEach(() => {
  style = { overflow: '', position: '', top: '', width: '' };
  (globalThis as { document: unknown }).document = { body: { style } };
  resetScrollLockForTests();
});

afterEach(() => {
  (globalThis as { document: unknown }).document = originalDocument;
});

describe('scroll lock', () => {
  it('stays locked until the last overlapping holder releases', () => {
    const details = acquireScrollLock();
    const quantity = acquireScrollLock();
    expect(style.overflow).toBe('hidden');

    details();
    expect(style.overflow).toBe('hidden');

    quantity();
    expect(style.overflow).toBe('');
    expect(isScrollLocked()).toBe(false);
  });

  it('releasing the same holder twice does not unlock someone else', () => {
    const a = acquireScrollLock();
    const b = acquireScrollLock();
    a();
    a();
    expect(style.overflow).toBe('hidden');
    b();
    expect(style.overflow).toBe('');
  });

  it('never restores a stale "hidden" left behind by an earlier leak', () => {
    style.overflow = 'hidden';
    const release = acquireScrollLock();
    release();
    expect(style.overflow).toBe('');
  });

  it('suspend lets the page scroll and resume re-locks only if still held', () => {
    const release = acquireScrollLock();
    const resume = suspendScrollLock();
    expect(style.overflow).toBe('');
    resume();
    expect(style.overflow).toBe('hidden');

    const resumeAfterClose = suspendScrollLock();
    release();
    resumeAfterClose();
    expect(style.overflow).toBe('');
  });

  it('clears orphaned lock styles only when nobody holds the lock', () => {
    const release = acquireScrollLock();
    expect(releaseOrphanedScrollLock()).toBe(false);
    expect(style.overflow).toBe('hidden');
    release();

    Object.assign(style, { overflow: 'hidden', position: 'fixed', top: '-300px', width: '100%' });
    expect(releaseOrphanedScrollLock()).toBe(true);
    expect(style).toEqual({ overflow: '', position: '', top: '', width: '' });
    expect(releaseOrphanedScrollLock()).toBe(false);
  });
});
