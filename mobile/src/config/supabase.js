import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Extraire l'URL Supabase depuis l'URL du backend
// En dev : le backend tourne sur localhost:3001
// En prod : remplacer par les vraies variables d'environnement

// Pour l'instant, valeurs en dur (à remplacer par .env plus tard)
const SUPABASE_URL = 'https://lxmqsgnsoqmlixhotblw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4bXFzZ25zb3FtbGl4aG90Ymx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgyNTksImV4cCI6MjA4NjA1NDI1OX0.SsuoIqbnriYtLSdAhAZkI4iF6eaMAG9fAAWMFhXCsyk';


// Créer le client Supabase avec AsyncStorage pour persistance
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default supabase;
