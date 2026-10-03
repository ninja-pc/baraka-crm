import { supabase } from './supabaseClient'

// Privileged SuperAdmin actions must be moved to a server-side endpoint.
// Never put a Supabase service-role key in the browser bundle.
export const supabaseAdmin = supabase
export const SUPERADMIN_ID = 'fe5a1e93-4342-4054-bffc-c2e19229edd8'
