import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env' });

async function main() {
  const admin = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: keep } = await admin
    .from('bottles')
    .select('user_id')
    .eq('is_reserved', true)
    .gt('quantity', 0)
    .limit(3000);
  const { data: fridge } = await admin
    .from('bottles')
    .select('user_id, storage_location')
    .gt('quantity', 0)
    .not('storage_location', 'is', null)
    .limit(3000);

  const keepUsers = new Map<string, number>();
  for (const r of keep || []) {
    keepUsers.set(r.user_id, (keepUsers.get(r.user_id) || 0) + 1);
  }
  const fridgeUsers = new Map<string, number>();
  const locs = new Set<string>();
  for (const r of fridge || []) {
    const loc = r.storage_location || '';
    locs.add(loc);
    const low = loc.toLowerCase();
    if (low.includes('fridge') || loc.includes('מקרר')) {
      fridgeUsers.set(r.user_id, (fridgeUsers.get(r.user_id) || 0) + 1);
    }
  }
  console.log(
    JSON.stringify(
      {
        keepRows: (keep || []).length,
        keepUsers: [...keepUsers.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([u, n]) => ({ u: u.slice(0, 8), n })),
        fridgeTaggedUsers: [...fridgeUsers.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([u, n]) => ({ u: u.slice(0, 8), n })),
        sampleLocs: [...locs].slice(0, 20),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
