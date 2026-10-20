/**
 * Landing file / iframe demo video with muted in-view autoplay.
 * Preserves mobile gesture / autoplay edge-case handling from prior landing.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LandingDemoResolved } from '../../lib/landingDemoVideo';

function videoSourceType(src: string): string | undefined {
  const path = src.split('?')[0].split('#')[0].toLowerCase();
  if (path.endsWith('.webm')) return 'video/webm';
  if (path.endsWith('.mp4')) return 'video/mp4';
  if (path.endsWith('.ogg') || path.endsWith('.ogv')) return 'video/ogg';
  return undefined;
}

function LandingFileDemoVideo({
  src,
  poster,
  onError,
}: {
  src: string;
  poster?: string;
  onError: () => void;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inViewRef = useRef(false);
  const [inView, setInView] = useState(false);
  const [showTapToPlay, setShowTapToPlay] = useState(false);

  const armMuted = (video: HTMLVideoElement) => {
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', 'true');
    try {
      video.setAttribute('webkit-playsinline', 'true');
    } catch {
      // ignore
    }
  };

  const handleUserStart = () => {
    const video = videoRef.current;
    if (!video) return;
    armMuted(video);
    void video
      .play()
      .then(() => setShowTapToPlay(false))
      .catch(() => {});
  };

  useEffect(() => {
    const video = videoRef.current;
    const box = containerRef.current;
    if (!video || !box) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    const minVisible = isCoarse ? 0.1 : 0.25;
    let tapDebounce: ReturnType<typeof setTimeout> | undefined;

    const tryPlay = () => {
      armMuted(video);
      const p = video.play();
      if (p === undefined) return;
      p.catch(() => {
        const onReady = () => {
          armMuted(video);
          void video.play().catch(() => {});
        };
        video.addEventListener('canplay', onReady, { once: true });
        video.addEventListener('loadeddata', onReady, { once: true });
      });
    };

    const leave = () => {
      if (tapDebounce) {
        clearTimeout(tapDebounce);
        tapDebounce = undefined;
      }
      inViewRef.current = false;
      setInView(false);
      setShowTapToPlay(false);
      video.pause();
    };

    const enter = () => {
      inViewRef.current = true;
      setInView(true);
      setShowTapToPlay(false);
      tryPlay();
      if (isCoarse) {
        if (tapDebounce) clearTimeout(tapDebounce);
        tapDebounce = setTimeout(() => {
          tapDebounce = undefined;
          if (inViewRef.current && videoRef.current && videoRef.current.paused) {
            setShowTapToPlay(true);
          }
        }, 480);
      }
    };
    let inViewLatched = false;

    const onIo: IntersectionObserverCallback = (entries) => {
      for (const entry of entries) {
        const ok = entry.isIntersecting && entry.intersectionRatio >= minVisible;
        if (ok) {
          if (!inViewLatched) {
            inViewLatched = true;
            enter();
          } else if (video.paused) {
            tryPlay();
          }
        } else {
          inViewLatched = false;
          leave();
        }
      }
    };

    const io = new IntersectionObserver(onIo, {
      root: null,
      threshold: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1],
      rootMargin: '60px 0px',
    });
    io.observe(box);

    const syncFromLayout = () => {
      const r = box.getBoundingClientRect();
      const vh = window.innerHeight;
      const visibleH = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      const ratio = r.height > 0 ? Math.max(0, visibleH) / r.height : 0;
      if (ratio >= minVisible) {
        if (!inViewLatched) {
          inViewLatched = true;
          enter();
        } else if (video.paused) {
          tryPlay();
        }
      } else {
        inViewLatched = false;
        leave();
      }
    };

    const c = { r0: 0, r1: 0, t1: undefined as ReturnType<typeof setTimeout> | undefined };
    c.r0 = requestAnimationFrame(() => {
      c.r1 = requestAnimationFrame(() => {
        syncFromLayout();
        c.t1 = setTimeout(syncFromLayout, 200);
      });
    });

    return () => {
      cancelAnimationFrame(c.r0);
      cancelAnimationFrame(c.r1);
      if (c.t1) clearTimeout(c.t1);
      if (tapDebounce) clearTimeout(tapDebounce);
      io.disconnect();
    };
  }, [src]);

  return (
    <div ref={containerRef} className="absolute inset-0 bg-[#0c0a0b]">
      <video
        ref={videoRef}
        className="absolute inset-0 z-0 h-full w-full object-cover object-center"
        controls
        muted
        autoPlay={inView}
        playsInline
        preload="metadata"
        poster={poster}
        onError={onError}
        onPlaying={() => setShowTapToPlay(false)}
        onLoadStart={() => {
          const v = videoRef.current;
          if (v) armMuted(v);
        }}
        onLoadedData={() => {
          if (!inViewRef.current) return;
          const v = videoRef.current;
          if (!v) return;
          armMuted(v);
          void v.play().catch(() => {});
        }}
      >
        <source src={src} type={videoSourceType(src)} />
      </video>
      {showTapToPlay ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <button
            type="button"
            onClick={handleUserStart}
            className="pointer-events-auto min-h-[44px] min-w-[44px] rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-lg sm:text-base"
            style={{ background: 'linear-gradient(135deg, #a63552, #6b1f2f)' }}
            aria-label={t('landing.demoTapToPlay')}
          >
            {t('landing.demoTapToPlay')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Wide 16:9 player for the landscape app-tour video. */
export function LandingWideVideo({ src, poster }: { src: string; poster?: string }) {
  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-[1.25rem] sm:rounded-[1.75rem] bg-[#0c0a0b]"
      style={{ boxShadow: '0 32px 90px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08)' }}
    >
      <LandingFileDemoVideo
        key={src}
        src={src}
        poster={poster}
        onError={() => {
          console.error('[Landing tour] Video failed to load:', src);
        }}
      />
    </div>
  );
}

export function LandingDemoStage({
  demo,
  demoPoster,
  demoTitle,
}: {
  demo: LandingDemoResolved;
  demoPoster?: string;
  demoTitle: string;
}) {
  const inner =
    demo.kind === 'iframe' ? (
      <div className="relative aspect-video w-full overflow-hidden rounded-[1.35rem] bg-black">
        <iframe
          src={demo.src}
          title={demoTitle}
          className="absolute inset-0 h-full w-full border-0"
          allow={demo.allow}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    ) : (
      <div className="relative aspect-[9/16] w-full max-h-[min(82svh,680px)] sm:max-h-[min(78vh,640px)] overflow-hidden rounded-[1.35rem] bg-[#0c0a0b]">
        <LandingFileDemoVideo
          key={demo.src}
          src={demo.src}
          poster={demoPoster}
          onError={() => {
            console.error(
              '[Landing demo] Video failed to load:',
              demo.src,
              '— If this is /videos/…, the file must exist under apps/web/public/videos and be deployed.',
            );
          }}
        />
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-[min(360px,calc(100vw-1rem))] sm:max-w-[320px]">
      <div
        className="rounded-[2.25rem] p-[10px] sm:p-3 shadow-2xl border border-white/10"
        style={{
          background:
            'linear-gradient(165deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.02) 42%, rgba(0,0,0,0.25) 100%), linear-gradient(180deg, #2a2426 0%, #120f10 100%)',
          boxShadow: '0 28px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset',
        }}
      >
        <div className="flex justify-center pb-2">
          <div className="h-5 w-[4.25rem] rounded-full bg-black/55 ring-1 ring-white/10" aria-hidden />
        </div>
        {inner}
      </div>
    </div>
  );
}
