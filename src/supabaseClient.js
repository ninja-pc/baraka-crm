import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dqhxbijlibvpuoxxofzr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxaHhiaWpsaWJ2cHVveHhvZnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5ODE0ODQsImV4cCI6MjA5NzU1NzQ4NH0.bL2B568oHJx6KXhu6o45kW6QWe5iEK2gV7bzh-8EVaA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
