/**
 * Auth helpers for edge functions that must require a logged-in user.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export async function requireUser(req: Request): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'server_misconfigured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  return { ok: true, userId: data.user.id };
}
