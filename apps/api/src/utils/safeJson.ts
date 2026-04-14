/**
 * Parse JSON from LLM chat output: tolerates markdown fences and extra prose
 * by extracting the first complete [...] or {...} block when direct parse fails.
 */

export function parseJsonFromModelContent(
  content: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (content == null || typeof content !== 'string') {
    return { ok: false, error: 'empty_content' };
  }

  let s = content.trim();

  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    s = fence[1].trim();
  }

  const tryParse = (raw: string): unknown | undefined => {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  };

  let value = tryParse(s);
  if (value !== undefined) {
    return { ok: true, value };
  }

  const arrStart = s.indexOf('[');
  const arrEnd = s.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    const slice = s.slice(arrStart, arrEnd + 1);
    value = tryParse(slice);
    if (value !== undefined) {
      return { ok: true, value };
    }
  }

  const objStart = s.indexOf('{');
  const objEnd = s.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) {
    const slice = s.slice(objStart, objEnd + 1);
    value = tryParse(slice);
    if (value !== undefined) {
      return { ok: true, value };
    }
  }

  return { ok: false, error: 'invalid_json' };
}
