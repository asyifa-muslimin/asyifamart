import { createClient } from '@supabase/supabase-js';

// Supabase URL and anon key provided in the original code
const meta = import.meta as any;
export const supabaseUrl = meta.env?.VITE_SUPABASE_URL || "https://otttejogcuuvhfbesjac.supabase.co";
export const supabaseKey = meta.env?.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90dHRlam9nY3V1dmhmYmVzamFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NzM5NDQsImV4cCI6MjA5NzI0OTk0NH0.jdo5RfNOhRhJP3_J3_jiQZgStwmWmT_UyXBLz2fIYlk";

// Initialize the client
export const supabase = createClient(supabaseUrl, supabaseKey);
