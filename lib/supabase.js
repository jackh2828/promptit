import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mfiqwintxbfuyaysqupu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1maXF3aW50eGJmdXlheXNxdXB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTIzOTUsImV4cCI6MjA5Mjg2ODM5NX0.duF0vwgBj5aAOel61prSL-wr7mwOoWbfl7ySKc_8tGE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});