/**
 * Resolves VITE_LANDING_DEMO_VIDEO_URL for the public landing page (bundled default
 * is /videos/sommi-ai-smarter.mp4 unless overridden):
 * YouTube (watch, short, embed), Vimeo, or a direct video file (MP4/WebM path or URL).
 */

export type LandingDemoResolved =
  | { kind: 'iframe'; src: string; allow: string }
  | { kind: 'video'; src: string };

function toYoutubeEmbed(input: string): string | null {
  try {
    const u = new URL(input, 'https://www.youtube.com');
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }

    if (host.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) {
        return `https://www.youtube-nocookie.com${u.pathname}${u.search}`;
      }
      const v = u.searchParams.get('v');
      if (v) {
        return `https://www.youtube-nocookie.com/embed/${v}`;
      }
      const shorts = u.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shorts?.[1]) {
        return `https://www.youtube-nocookie.com/embed/${shorts[1]}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Returns how to render the configured landing demo URL, or null if empty. */
export function resolveLandingDemoVideo(raw: string): LandingDemoResolved | null {
  const url = raw.trim();
  if (!url) return null;

  if (/youtube\.com|youtu\.be/i.test(url)) {
    const embed = toYoutubeEmbed(url);
    if (!embed) return null;
    // Muted autoplay: browsers allow autoplay only when muted; user can unmute in the player
    const sep = embed.includes('?') ? '&' : '?';
    return {
      kind: 'iframe',
      src: `${embed}${sep}rel=0&autoplay=1&mute=1`,
      allow:
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
    };
  }

  if (/vimeo\.com/i.test(url)) {
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    if (!vimeoMatch?.[1]) return null;
    return {
      kind: 'iframe',
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=1`,
      allow: 'autoplay; fullscreen; picture-in-picture',
    };
  }

  return { kind: 'video', src: url };
}
