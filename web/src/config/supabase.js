/**
 * Supabase Client Configuration (Web)
 * Uses environment variables for secure credential management
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables (from .env or .env.local)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lxmqsgnsoqmlixhotblw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4bXFzZ25zb3FtbGl4aG90Ymx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgyNTksImV4cCI6MjA4NjA1NDI1OX0.SsuoIqbnriYtLSdAhAZkI4iF6eaMAG9fAAWMFhXCsyk';

// Create Supabase client with secure defaults
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use localStorage for web (secure for browser environment)
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // Support OAuth callbacks
    // Security: Enable PKCE flow for better security
    flowType: 'pkce',
  },
  // Enable realtime for future features
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export default supabase;
