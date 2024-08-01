import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types';
import 'dotenv/config';

let Supabase: SupabaseClient<Database> | undefined;

try { 
    if (!process.env.SUPABASE_SERVICE_KEY || !process.env.SUPABASE_URL) {
        throw new Error('SUPABASE_SERVICE_KEY or SUPABASE_URL is undefined.');
    }
    
    Supabase = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    if (Supabase.auth && Supabase.storage) {
        console.log('Connection successful!')
    } 
} catch (err) {
    console.log('Error connecting to supabase', err)
}

export default Supabase;