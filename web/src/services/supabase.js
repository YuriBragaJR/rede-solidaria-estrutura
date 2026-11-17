import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://muomlkninhyihtpvkrbu.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11b21sa25pbmh5aWh0cHZrcmJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1OTUzNzYsImV4cCI6MjExMDE3MTM3Nn0.anKyziqwqAuNz7LMfhuT5yrP3AHc2evf9uhFjnhvhLQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
})
