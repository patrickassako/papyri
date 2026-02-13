const { createClient } = require('@supabase/supabase-js');
const config = require('./env');

// Supabase Admin client (service role key - bypasses RLS)
// Use for admin operations like user management
const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Supabase client (anon key - respects RLS)
// Use for operations that should respect Row Level Security
const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Test connection
async function testConnection() {
  try {
    const { data, error } = await supabaseAdmin.from('profiles').select('count').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist yet
      console.error('❌ Supabase connection failed:', error.message);
      return false;
    }
    console.log('✅ Supabase connected');
    return true;
  } catch (err) {
    console.error('❌ Supabase connection error:', err.message);
    return false;
  }
}

module.exports = { supabase, supabaseAdmin, testConnection };
