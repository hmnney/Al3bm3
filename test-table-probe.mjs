import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(URL, KEY);

const TABLE = 'app_state';

// Try selecting with * to see what columns exist
console.log('=== Probe 1: SELECT * ===');
{
  const { data, error } = await supabase.from(TABLE).select('*').limit(1);
  if (error) console.log('Error:', error.message, JSON.stringify(error));
  else console.log('Data:', JSON.stringify(data, null, 2));
}

// Try common column name combos
const combos = [
  ['id', 'data'],
  ['id', 'value'],
  ['id', 'payload'],
  ['id', 'content'],
  ['name', 'data'],
  ['name', 'value'],
  ['name', 'payload'],
  ['name', 'content'],
  ['key', 'data'],
  ['key', 'payload'],
  ['key', 'content'],
  ['slug', 'data'],
  ['slug', 'value'],
  ['slug', 'payload'],
];

for (const [k, v] of combos) {
  const { data, error } = await supabase.from(TABLE).select(`${k},${v}`).limit(1);
  if (!error) {
    console.log(`FOUND COLUMNS: ${k}, ${v} =>`, JSON.stringify(data));
  }
}
