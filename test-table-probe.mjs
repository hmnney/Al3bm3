const URL = 'https://ywyyuhjkzznuycafftgr.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3eXl1aGprenpudWljYWZmdGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTEwODcsImV4cCI6MjEwMDk4NzA4N30.e2IHZPc3HiUOOZcBI79nRtOsKPSxNPy16dFUs02Kvzg';

const headers = {
  'apikey': KEY,
  'Authorization': `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

// Test 1: Try selecting from app_state table
console.log('=== Test 1: SELECT from app_state ===');
try {
  const res = await fetch(`${URL}/rest/v1/app_state?select=*`, { headers });
  const body = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', body.substring(0, 500));
} catch (e) {
  console.log('Error:', e.message);
}

// Test 2: Try inserting a row
console.log('\n=== Test 2: INSERT into app_state ===');
try {
  const res = await fetch(`${URL}/rest/v1/app_state`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify({ key: 'test-question', value: { test: true, question: 'What is 2+2?', answer: '4' } }),
  });
  const body = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', body.substring(0, 500));
} catch (e) {
  console.log('Error:', e.message);
}

// Test 3: Try with data column instead of value
console.log('\n=== Test 3: INSERT with data column ===');
try {
  const res = await fetch(`${URL}/rest/v1/app_state`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify({ key: 'test-question-2', data: { test: true, question: 'What is 3+3?', answer: '6' } }),
  });
  const body = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', body.substring(0, 500));
} catch (e) {
  console.log('Error:', e.message);
}

// Test 4: Try with content column
console.log('\n=== Test 4: INSERT with content column ===');
try {
  const res = await fetch(`${URL}/rest/v1/app_state`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify({ key: 'test-question-3', content: JSON.stringify({ test: true, question: 'What is 4+4?', answer: '8' }) }),
  });
  const body = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', body.substring(0, 500));
} catch (e) {
  console.log('Error:', e.message);
}

// Test 5: Try with payload column
console.log('\n=== Test 5: INSERT with payload column ===');
try {
  const res = await fetch(`${URL}/rest/v1/app_state`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify({ key: 'test-question-4', payload: { test: true, question: 'What is 5+5?', answer: '10' } }),
  });
  const body = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', body.substring(0, 500));
} catch (e) {
  console.log('Error:', e.message);
}
