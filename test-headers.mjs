const SUPABASE_URL = 'https://ywyyuhjkzznuycafftgr.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3eXl1aGprenpudWljYWZmdGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTEwODcsImV4cCI6MjEwMDk4NzA4N30.e2IHZPc3HiUOOZcBI79nRtOsKPSxNPy16dFUs02Kvzg';

const body = JSON.stringify({ test: true, ts: Date.now() });

// Test A: GET with auth (should work)
console.log('=== A: GET with Bearer auth ===');
{
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/app-state/test.json`, {
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` },
  });
  console.log('Status:', res.status, await res.text());
}

// Test B: GET without auth (public bucket)
console.log('\n=== B: GET without auth (public URL) ===');
{
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/app-state/test.json`);
  console.log('Status:', res.status, await res.text());
}

// Test C: POST with Bearer + apikey
console.log('\n=== C: POST with Bearer + apikey ===');
{
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/app-state/test.json`, {
    method: 'POST',
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json', 'x-upsert': 'true' },
    body,
  });
  console.log('Status:', res.status, await res.text());
}

// Test D: PUT with Bearer + apikey
console.log('\n=== D: PUT with Bearer + apikey ===');
{
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/app-state/test.json`, {
    method: 'PUT',
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body,
  });
  console.log('Status:', res.status, await res.text());
}

// Test E: POST with only apikey (no Authorization)
console.log('\n=== E: POST with only apikey ===');
{
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/app-state/test.json`, {
    method: 'POST',
    headers: { 'apikey': KEY, 'Content-Type': 'application/json', 'x-upsert': 'true' },
    body,
  });
  console.log('Status:', res.status, await res.text());
}

// Test F: POST with Authorization only (no apikey)
console.log('\n=== F: POST with Authorization only ===');
{
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/app-state/test.json`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json', 'x-upsert': 'true' },
    body,
  });
  console.log('Status:', res.status, await res.text());
}

// Test G: List buckets (GET)
console.log('\n=== G: List buckets ===');
{
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` },
  });
  console.log('Status:', res.status, (await res.text()).substring(0, 500));
}

// Decode JWT payload to verify
console.log('\n=== JWT payload decode ===');
{
  const parts = KEY.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  console.log('Payload:', JSON.stringify(payload, null, 2));
}
