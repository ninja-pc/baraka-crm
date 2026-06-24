import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dqhxbijlibvpuoxxofzr.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxaHhiaWpsaWJ2cHVveHhvZnpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTk4MTQ4NCwiZXhwIjoyMDk3NTU3NDg0fQ.gwkBQAgFGNk3XzRSPrjsuXNIS_riOG5JdCwLrPuD9c0'

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

export const SUPERADMIN_ID = 'fe5a1e93-4342-4054-bffc-c2e19229edd8'
