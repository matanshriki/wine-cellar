import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const FPS = 30;

/** Marks the page's largest vertical scroll container (or the document) and returns its selector. */
export async function markMainScroller(page) {
  return page.evaluate(() => {
    document.querySelectorAll('[data-main-scroll]').forEach((e) => e.removeAttribute('data-main-scroll'));
    const doc = document.scrollingElement;
    if (doc.scrollHeight > doc.clientHeight + 50) {
      doc.setAttribute('data-main-scroll', '1');
      return '[data-main-scroll="1"]';
    }
    const el = [document.body, ...document.querySelectorAll('body *')]
      .filter((e) => e.scrollHeight > e.clientHeight + 50 && /(auto|scroll|overlay)/.test(getComputedStyle(e).overflowY))
      .sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth)[0];
    (el || doc).setAttribute('data-main-scroll', '1');
    return '[data-main-scroll="1"]';
  });
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Builds a 30fps clip from screenshots. Each screenshot is held for a number of
 * frames, so captures can be slow without the result looking slow.
 */
export class Recorder {
  constructor(page, outDir, name) {
    this.page = page;
    this.name = name;
    this.dir = path.join(outDir, name);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    this.entries = [];
    this.n = 0;
    this.taps = [];
  }

  get frames() {
    return this.entries.reduce((s, e) => s + e.frames, 0);
  }

  async snap(frames = 1) {
    const file = path.join(this.dir, `f${String(this.n++).padStart(5, '0')}.jpg`);
    await this.page.screenshot({ path: file, type: 'jpeg', quality: 92 });
    this.entries.push({ file, frames });
  }

  async hold(sec) {
    await this.snap(Math.max(1, Math.round(sec * FPS)));
  }

  /** Real-time capture: each shot is held for the wall-clock time it covers. */
  async live(sec, { speed = 1 } = {}) {
    const end = Date.now() + sec * 1000;
    let last = Date.now();
    while (Date.now() < end) {
      const file = path.join(this.dir, `f${String(this.n++).padStart(5, '0')}.jpg`);
      await this.page.screenshot({ path: file, type: 'jpeg', quality: 92 });
      const now = Date.now();
      this.entries.push({ file, frames: Math.max(1, Math.round(((now - last) / 1000) * FPS / speed)) });
      last = now;
    }
  }

  /** Eased scroll of the window or a scroll container, one screenshot per frame. */
  async scroll(to, sec, selector = null) {
    if (!selector) selector = await markMainScroller(this.page);
    const steps = Math.max(2, Math.round(sec * FPS));
    const from = await this.page.evaluate(
      (sel) => (sel ? document.querySelector(sel)?.scrollTop ?? 0 : window.scrollY),
      selector,
    );
    for (let i = 1; i <= steps; i++) {
      const y = from + (to - from) * ease(i / steps);
      await this.page.evaluate(
        ([sel, yy]) => {
          const el = sel ? document.querySelector(sel) : document.scrollingElement;
          if (el) el.scrollTop = yy;
        },
        [selector, y],
      );
      await this.snap(1);
    }
  }

  /** Draws a tap ripple at the element's center, then clicks it. */
  async tap(locator, { holdAfter = 0 } = {}) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const box = await locator.boundingBox();
    if (!box) throw new Error(`tap target not visible in ${this.name}`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    this.taps.push({ frame: this.frames, x, y });
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      await this.page.evaluate(
        ([xx, yy, tt]) => {
          let d = document.getElementById('__tap');
          if (!d) {
            d = document.createElement('div');
            d.id = '__tap';
            d.style.cssText =
              'position:fixed;z-index:2147483647;pointer-events:none;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.55);border:2px solid rgba(255,255,255,.9);box-shadow:0 4px 18px rgba(0,0,0,.25)';
            document.body.appendChild(d);
          }
          d.style.left = xx + 'px';
          d.style.top = yy + 'px';
          d.style.transform = `scale(${0.6 + tt * 0.5})`;
          d.style.opacity = String(tt < 0.5 ? 1 : 1 - (tt - 0.5) * 2);
        },
        [x, y, t],
      );
      await this.snap(1);
    }
    await this.page.evaluate(() => document.getElementById('__tap')?.remove());
    await locator.click();
    if (holdAfter) await this.live(holdAfter);
  }

  encode(outFile) {
    const list = path.join(this.dir, 'list.txt');
    const lines = [];
    for (const e of this.entries) {
      lines.push(`file '${path.resolve(e.file)}'`, `duration ${(e.frames / FPS).toFixed(5)}`);
    }
    lines.push(`file '${path.resolve(this.entries.at(-1).file)}'`);
    fs.writeFileSync(list, lines.join('\n'));
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
      '-vf', `fps=${FPS},scale=1170:2532:flags=lanczos,format=yuv420p`,
      '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-movflags', '+faststart', outFile,
    ]);
    const meta = { name: this.name, seconds: this.frames / FPS, taps: this.taps };
    fs.writeFileSync(outFile.replace(/\.mp4$/, '.json'), JSON.stringify(meta, null, 2));
    console.log(`clip ${path.basename(outFile)} ${meta.seconds.toFixed(2)}s`);
    return meta;
  }
}
