const SUPABASE_URL = 'https://ywyyuhjkzznuycafftgr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3eXl1aGprenpudWljYWZmdGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTEwODcsImV4cCI6MjEwMDk4NzA4N30.e2IHZPc3HiUOOZcBI79nRtOsKPSxNPy16dFUs02Kvzg';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};

let passed = 0;
let failed = 0;

function test(name, condition, detail = '') {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name} ${detail}`);
    failed++;
  }
}

// ============================================================
// TEST 1: Upload a test JSON file to app-state bucket
// ============================================================
console.log('\n=== TEST 1: Upload test JSON to app-state bucket ===');
const testPayload = JSON.stringify({
  test: true,
  message: 'cloud sync verification',
  timestamp: Date.now(),
  source: 'verification-script',
});

let uploadOk = false;
try {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/app-state/cloud-sync-test.json`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'x-upsert': 'true' },
    body: testPayload,
  });
  const body = await res.text();
  console.log('  Upload status:', res.status, body.substring(0, 200));
  uploadOk = res.ok;
  test('Upload test JSON to app-state', res.ok, body);
} catch (e) {
  console.log('  Upload error:', e.message);
  test('Upload test JSON to app-state', false, e.message);
}

// ============================================================
// TEST 2: Download the same file back
// ============================================================
console.log('\n=== TEST 2: Download test JSON from app-state bucket ===');
let downloadedText = null;
try {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/app-state/cloud-sync-test.json`, {
    headers,
  });
  downloadedText = await res.text();
  console.log('  Download status:', res.status, 'size:', downloadedText.length);
  test('Download test JSON from app-state', res.ok, downloadedText.substring(0, 200));

  // Verify content matches
  const parsed = JSON.parse(downloadedText);
  test('Downloaded content matches upload', parsed.test === true && parsed.message === 'cloud sync verification');
} catch (e) {
  console.log('  Download error:', e.message);
  test('Download test JSON from app-state', false, e.message);
}

// ============================================================
// TEST 3: Save question bank to cloud (simulates admin save)
// ============================================================
console.log('\n=== TEST 3: Save question bank to cloud ===');
const questionBank = {
  categories: [
    { id: 'cat-1', name: 'Science', glyph: '🔬', color: '#3B82F6', order: 0 },
    { id: 'cat-2', name: 'History', glyph: '📜', color: '#EF4444', order: 1 },
    { id: 'cat-3', name: 'Sports', glyph: '⚽', color: '#10B981', order: 2 },
  ],
  questions: [
    { id: 'q1', categoryId: 'cat-1', points: 100, text: 'What is the chemical symbol for gold?', answer: 'Au', difficulty: 'easy' },
    { id: 'q2', categoryId: 'cat-1', points: 200, text: 'What planet is closest to the sun?', answer: 'Mercury', difficulty: 'easy' },
    { id: 'q3', categoryId: 'cat-2', points: 100, text: 'In what year did WWII end?', answer: '1945', difficulty: 'medium' },
    { id: 'q4', categoryId: 'cat-3', points: 300, text: 'How many players are on a soccer team?', answer: '11', difficulty: 'easy' },
  ],
};

let bankSaveOk = false;
try {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/app-state/admin-data.json`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'x-upsert': 'true' },
    body: JSON.stringify(questionBank),
  });
  const body = await res.text();
  console.log('  Question bank save status:', res.status, body.substring(0, 200));
  bankSaveOk = res.ok;
  test('Save question bank to cloud', res.ok, body);
} catch (e) {
  console.log('  Save error:', e.message);
  test('Save question bank to cloud', false, e.message);
}

// ============================================================
// TEST 4: Load question bank from cloud (simulates same browser)
// ============================================================
console.log('\n=== TEST 4: Load question bank from cloud (same browser) ===');
let loadedBank = null;
try {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/app-state/admin-data.json`, {
    headers,
  });
  const text = await res.text();
  loadedBank = JSON.parse(text);
  console.log('  Load status:', res.status, 'categories:', loadedBank.categories?.length, 'questions:', loadedBank.questions?.length);
  test('Load question bank from cloud', res.ok, text.substring(0, 200));
  test('Question bank has 3 categories', loadedBank.categories?.length === 3);
  test('Question bank has 4 questions', loadedBank.questions?.length === 4);
  test('Question q1 text matches', loadedBank.questions?.[0]?.text === 'What is the chemical symbol for gold?');
} catch (e) {
  console.log('  Load error:', e.message);
  test('Load question bank from cloud', false, e.message);
}

// ============================================================
// TEST 5: Simulate another browser/device loading the same bank
// (Fresh fetch with no cache — different "browser session")
// ============================================================
console.log('\n=== TEST 5: Cross-device load (fresh fetch, no cache) ===');
try {
  // Simulate a completely fresh device: new fetch, no localStorage, just the public URL
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/app-state/admin-data.json`;
  const res = await fetch(publicUrl);
  const text = await res.text();
  const freshBank = JSON.parse(text);
  console.log('  Cross-device load status:', res.status, 'categories:', freshBank.categories?.length, 'questions:', freshBank.questions?.length);
  test('Cross-device load succeeds', res.ok, text.substring(0, 200));
  test('Cross-device data matches original (categories)', JSON.stringify(freshBank.categories) === JSON.stringify(questionBank.categories));
  test('Cross-device data matches original (questions)', JSON.stringify(freshBank.questions) === JSON.stringify(questionBank.questions));
  test('Cross-device question count matches', freshBank.questions?.length === 4);
} catch (e) {
  console.log('  Cross-device error:', e.message);
  test('Cross-device load succeeds', false, e.message);
}

// ============================================================
// TEST 6: Save and load settings (second cloud-synced blob)
// ============================================================
console.log('\n=== TEST 6: Save and load settings blob ===');
const settings = {
  game: { defaultGameName: 'Trivia Night', defaultNumberOfCategories: 6 },
  timer: { defaultPreset: 45, presets: [30, 45, 60, 90, 120] },
  teams: { defaultTeamNames: ['Team A', 'Team B'], maxTeams: 2 },
};
try {
  const saveRes = await fetch(`${SUPABASE_URL}/storage/v1/object/app-state/admin-settings.json`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'x-upsert': 'true' },
    body: JSON.stringify(settings),
  });
  test('Save settings to cloud', saveRes.ok, await saveRes.text());

  const loadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/app-state/admin-settings.json`, { headers });
  const loadedSettings = JSON.parse(await loadRes.text());
  test('Load settings from cloud', loadRes.ok);
  test('Settings timer preset matches', loadedSettings.timer?.defaultPreset === 45);
  test('Settings team names match', JSON.stringify(loadedSettings.teams?.defaultTeamNames) === JSON.stringify(['Team A', 'Team B']));
} catch (e) {
  test('Save and load settings', false, e.message);
}

// ============================================================
// TEST 7: Verify upsert (overwrite) works correctly
// ============================================================
console.log('\n=== TEST 7: Verify upsert (overwrite) works ===');
try {
  const updatedBank = { ...questionBank, questions: [...questionBank.questions, { id: 'q5', categoryId: 'cat-2', points: 400, text: 'New question', answer: 'New answer', difficulty: 'hard' }] };
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/app-state/admin-data.json`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'x-upsert': 'true' },
    body: JSON.stringify(updatedBank),
  });
  test('Upsert (overwrite) upload', res.ok);

  const loadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/app-state/admin-data.json`, { headers });
  const reloaded = JSON.parse(await loadRes.text());
  test('Upsert produced 5 questions', reloaded.questions?.length === 5);
  test('Upsert new question present', reloaded.questions?.[4]?.text === 'New question');
} catch (e) {
  test('Upsert verification', false, e.message);
}

// ============================================================
// SUMMARY
// ============================================================
console.log('\n========================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
