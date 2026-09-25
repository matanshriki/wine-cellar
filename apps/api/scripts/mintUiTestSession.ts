/**
 * Mint a short-lived user session via magic-link OTP (no password change).
 * Writes tokens to /tmp/sommi-ui-session.json for local UI smoke tests.
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function main() {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: sample } = await admin
    .from('bottles')
    .select('user_id')
    .gt('quantity', 0)
    .limit(5000);
  const counts = new Map<string, number>();
  for (const r of sample || []) counts.set(r.user_id, (counts.get(r.user_id) || 0) + 1);
  const uid = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  await admin.from('profiles').update({ cellar_agent_enabled: true }).eq('id', uid);
  const { data: authUser } = await admin.auth.admin.getUserById(uid);
  const email = authUser.user!.email!;

  const { data: linkData, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (error) throw error;

  const hashed = linkData.properties.hashed_token;
  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verified, error: vErr } = await userClient.auth.verifyOtp({
    token_hash: hashed,
    type: 'email',
  });
  if (vErr || !verified.session) throw vErr || new Error('no session');

  writeFileSync(
    '/tmp/sommi-ui-session.json',
    JSON.stringify({
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
      expires_at: verified.session.expires_at,
      user_id: uid,
      email,
      supabaseUrl: url,
      anonKey: anon,
    })
  );
  console.log(JSON.stringify({ ok: true, userPrefix: uid.slice(0, 8) }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
