const SUPABASE_URL = 'https://ywyyuhjkzznuycafftgr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3eXl1aGprenpudXljYWZmdGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTEwODcsImV4cCI6MjEwMDk4NzA4N30.e2IHZPc3HiUOOZcBI79nRtOsKPSxNPy16dFUs02Kvzg';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

// Step 1: List existing buckets
console.log('=== Step 1: List existing buckets ===');
try {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, { headers });
  const list = await res.json();
  console.log('Status:', res.status);
  console.log('Buckets:', JSON.stringify(list.map(b => b.id || b.name)));
} catch (e) {
  console.log('Error:', e.message);
}

// Step 2: Create app-state bucket
console.log('\n=== Step 2: Create app-state bucket ===');
try {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: 'app-state', name: 'app-state', public: true }),
  });
  const body = await res.text();
  console.log('Status:', res.status, body.substring(0, 300));
} catch (e) {
  console.log('Error:', e.message);
}

// Step 3: Create question-media bucket
console.log('\n=== Step 3: Create question-media bucket ===');
try {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: 'question-media', name: 'question-media', public: true }),
  });
  const body = await res.text();
  console.log('Status:', res.status, body.substring(0, 300));
} catch (e) {
  console.log('Error:', e.message);
}

// Step 4: List buckets again
console.log('\n=== Step 4: List buckets after creation ===');
try {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, { headers });
  const list = await res.json();
  console.log('Status:', res.status);
  console.log('Buckets:', JSON.stringify(list.map(b => b.id || b.name)));
} catch (e) {
  console.log('Error:', e.message);
}

// Step 5: Upload test file to app-state
console.log('\n=== Step 5: Upload test file ===');
const testContent = JSON.stringify({ test: true, message: 'cloud sync verification', timestamp: Date.now() });
try {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/app-state/cloud-sync-test.json`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    },
    body: testContent,
  });
  const body = await res.text();
  console.log('Status:', res.status, body.substring(0, 300));
} catch (e) {
  console.log('Error:', e.message);
}

// Step 6: Download test file
console.log('\n=== Step 6: Download test file ===');
try {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/app-state/cloud-sync-test.json`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  const body = await res.text();
  console.log('Status:', res.status, body.substring(0, 300));
} catch (e) {
  console.log('Error:', e.message);
}
