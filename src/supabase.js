import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://djdjmplzveexvlsytjys.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqZGptcGx6dmVleHZsc3l0anlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDM0NzYsImV4cCI6MjA5MDIxOTQ3Nn0.qtrDtP0GmIKFzjtAZ4NX2ctSZ9yHqwGsZ8kIeD5ZunE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
export const SHEETS_URL = 'https://script.google.com/macros/s/AKfycby-It6dRCUuRL6KQMwF3uiIYqRDtXrN-eYkHX64L2m4WbiN0zGxwa3SzegPpUhyz1imyA/exec'