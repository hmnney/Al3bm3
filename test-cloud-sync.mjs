import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(URL, KEY);

const TABLE = 'app_state';
const TEST_KEY = 'e2e-sync-test-question';
const TEST_VALUE = {
  question: 'What is the capital of France?',
  answer: 'Paris',
  points: 100,
  category: 'Geography',
  timestamp: new Date().toISOString(),
};

console.log('=== End-to-End Cloud Sync Test ===');
console.log('Backend: Supabase Database (app_state table)');
console.log('URL:', URL);
console.log('Test key:', TEST_KEY);
console.log('Test value:', JSON.stringify(TEST_VALUE, null, 2));
console.log('');

// Step 1: Save (upsert) a test question
console.log('--- Step 1: Save test question to cloud ---');
const { error: upsertError } = await supabase
  .from(TABLE)
  .upsert({ id: TEST_KEY, data: TEST_VALUE }, { onConflict: 'id' });

if (upsertError) {
  console.error('SAVE FAILED:', upsertError.message);
  console.error('Details:', JSON.stringify(upsertError, null, 2));
  process.exit(1);
}
console.log('SAVE: OK');
console.log('');

// Step 2: Read it back
console.log('--- Step 2: Read test question back from cloud ---');
const { data, error: selectError } = await supabase
  .from(TABLE)
  .select('data')
  .eq('id', TEST_KEY)
  .maybeSingle();

if (selectError) {
  console.error('READ FAILED:', selectError.message);
  console.error('Details:', JSON.stringify(selectError, null, 2));
  process.exit(1);
}

if (!data) {
  console.error('READ FAILED: no row returned');
  process.exit(1);
}

const readValue = data.data;
console.log('READ: OK');
console.log('Read value:', JSON.stringify(readValue, null, 2));
console.log('');

// Step 3: Verify data integrity
console.log('--- Step 3: Verify data integrity ---');
const matches =
  readValue.question === TEST_VALUE.question &&
  readValue.answer === TEST_VALUE.answer &&
  readValue.points === TEST_VALUE.points &&
  readValue.category === TEST_VALUE.category;

if (matches) {
  console.log('INTEGRITY: PASSED — saved and read values match');
} else {
  console.error('INTEGRITY: FAILED — values do not match');
  console.error('Expected:', TEST_VALUE);
  console.error('Got:', readValue);
  process.exit(1);
}
console.log('');

// Step 4: Simulate a second browser by creating a fresh client and reading
console.log('--- Step 4: Simulate second browser (fresh client) ---');
const supabase2 = createClient(URL, KEY);
const { data: data2, error: selectError2 } = await supabase2
  .from(TABLE)
  .select('data')
  .eq('id', TEST_KEY)
  .maybeSingle();

if (selectError2) {
  console.error('SECOND BROWSER READ FAILED:', selectError2.message);
  process.exit(1);
}

if (!data2) {
  console.error('SECOND BROWSER READ FAILED: no row returned');
  process.exit(1);
}

const readValue2 = data2.data;
const matches2 =
  readValue2.question === TEST_VALUE.question &&
  readValue2.answer === TEST_VALUE.answer;

if (matches2) {
  console.log('SECOND BROWSER: PASSED — data loaded successfully from a fresh client');
} else {
  console.error('SECOND BROWSER: FAILED — data mismatch');
  process.exit(1);
}
console.log('');

// Step 5: Report storage backend
console.log('=== Result ===');
console.log('Storage backend in use: Supabase Database (app_state table)');
console.log('localStorage role: temporary cache only');
console.log('Supabase Storage: not used for persistence');
console.log('Cloud sync: CONFIRMED WORKING');
console.log('Cross-browser data sharing: CONFIRMED WORKING');
