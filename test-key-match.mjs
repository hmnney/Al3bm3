// Decode the JWT to get the exact ref
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3eXl1aGprenpudWljYWZmdGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTEwODcsImV4cCI6MjEwMDk4NzA4N30.e2IHZPc3HiUOOZcBI79nRtOsKPSxNPy16dFUs02Kvzg';

const payload = JSON.parse(Buffer.from(KEY.split('.')[1], 'base64url').toString());
console.log('JWT ref:', payload.ref);
console.log('URL ref: ywyyuhjkzznuycafftgr');
console.log('Match:', payload.ref === 'ywyyuhjkzznuycafftgr');

// Try both URLs
const urlA = `https://${payload.ref}.supabase.co`;
const urlB = 'https://ywyyuhjkzznuycafftgr.supabase.co';

for (const [label, url] of [['JWT-ref', urlA], ['env-URL', urlB]]) {
  console.log(`\n=== ${label}: ${url} ===`);
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { 'apikey': KEY },
    });
    console.log('  auth/health status:', res.status, (await res.text()).substring(0, 200));
  } catch (e) {
    console.log('  auth/health error:', e.message);
  }
  try {
    const res = await fetch(`${url}/rest/v1/app_state?select=*&limit=1`, {
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` },
    });
    console.log('  rest/v1/app_state status:', res.status, (await res.text()).substring(0, 200));
  } catch (e) {
    console.log('  rest error:', e.message);
  }
}
