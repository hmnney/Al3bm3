const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ywyyuhjkzznuycafftgr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3eXl1aGprenpudWljYWZmdGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTEwODcsImV4cCI6MjEwMDk4NzA4N30.e2IHZPc3HiUOOZcBI79nRtOsKPSxNPy16dFUs02Kvzg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  // List buckets
  console.log('=== List buckets ===');
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  console.log('Buckets:', buckets, 'Error:', bErr);

  // Upload using the JS client
  console.log('\n=== Upload via JS client ===');
  const testPayload = JSON.stringify({ test: true, message: 'js-client-upload', timestamp: Date.now() });
  const { data: upData, error: upErr } = await supabase.storage
    .from('app-state')
    .upload('cloud-sync-test.json', testPayload, {
      contentType: 'application/json',
      upsert: true,
    });
  console.log('Upload data:', upData, 'Error:', upErr);

  // Download using the JS client
  console.log('\n=== Download via JS client ===');
  const { data: dlData, error: dlErr } = await supabase.storage
    .from('app-state')
    .download('cloud-sync-test.json');
  if (dlData) {
    const text = await dlData.text();
    console.log('Download text:', text);
  } else {
    console.log('Download error:', dlErr);
  }
}

run().catch(console.error);
