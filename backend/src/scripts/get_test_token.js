require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // Reset password du compte test
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    '3c03c3cc-392a-4107-8536-974942ebf268', // test@example.com
    { password: 'TestPapyri2026' }
  );
  if (error) { console.error('Update error:', error); process.exit(1); }
  console.log('Password updated for:', data.user?.email);
}
main();
