require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const PAYMENT_ID = 'fdbde920-e1f4-4c69-8619-4692ebd51fba';
  const { data, error } = await supabaseAdmin
    .from('payments')
    .update({ status: 'succeeded', paid_at: new Date().toISOString() })
    .eq('id', PAYMENT_ID)
    .select('id, status, amount, currency')
    .single();
  if (error) { console.error(error); process.exit(1); }
  console.log('Updated:', JSON.stringify(data));
}
main();
