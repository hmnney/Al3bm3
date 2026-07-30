const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3eXl1aGprenpudWljYWZmdGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTEwODcsImV4cCI6MjEwMDk4NzA4N30.e2IHZPc3HiUOOZcBI79nRtOsKPSxNPy16dFUs02Kvzg';

// The JWT ref field decodes to: ywyyuhjkzznuicafftgr
// The URL the user gave:        ywyyuhjkzznuycafftgr
// Try the URL that matches the JWT ref:
const URL_FROM_JWT = 'https://ywyyuhjkzznuicafftgr.supabase.co';
const URL_FROM_USER = 'https://ywyyuhjkzznuycafftgr.supabase.co';

const headers = { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` };

console.log('=== Test URL from JWT ref:', URL_FROM_JWT, '===');
try {
  const res = await fetch(`${URL_FROM_JWT}/storage/v1/bucket`, { headers });
  const body = await res.text();
  console.log('List buckets status:', res.status, body.substring(0, 500));
} catch (e) {
  console.log('Error:', e.message);
}

console.log('\n=== Test URL from user:', URL_FROM_USER, '===');
try {
  const res = await fetch(`${URL_FROM_USER}/storage/v1/bucket`, { headers });
  const body = await res.text();
  console.log('List buckets status:', res.status, body.substring(0, 500));
} catch (e) {
  console.log('Error:', e.message);
}

// Try upload to the JWT-matching URL
console.log('\n=== Upload to JWT-matching URL ===');
try {
  const res = await fetch(`${URL_FROM_JWT}/storage/v1/object/app-state/cloud-sync-test.json`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'x-upsert': 'true' },
    body: JSON.stringify({ test: true, ts: Date.now() }),
  });
  console.log('Upload status:', res.status, (await res.text()).substring(0, 300));
} catch (e) {
  console.log('Error:', e.message);
}
