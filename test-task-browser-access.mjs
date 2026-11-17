import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./script.js', import.meta.url), 'utf8');
const start = source.indexOf('async function fetchTaskDetails(');
const end = source.indexOf('async function submitTaskAnswers(', start);
assert.ok(start >= 0 && end > start, 'O helper de abertura da atividade deve existir');

let calls = 0;
let status = 200;
let network = false;
const fetchTaskDetails = new Function(
  'request',
  'URLSearchParams',
  source.slice(start, end) + ';return fetchTaskDetails',
)(async (path, options) => {
  calls++;
  const url = new URL(`https://worker.test${path}`);
  const headers = new Headers(options.headers);
  assert.equal(url.pathname, '/task-details');
  assert.equal(url.searchParams.get('task_id'), '1');
  assert.equal(url.searchParams.get('room_name'), 'room');
  assert.equal(options.method, 'GET');
  assert.equal(options.cache, 'no-store');
  assert.equal(headers.get('X-Captcha-Token'), 'verified-test');
  assert.equal(headers.get('X-Captcha-Session'), 'session-test');
  assert.equal(headers.get('X-Captcha-Cookie'), 'sid=abc');
  if (network) throw new TypeError('network');
  if (status !== 200) throw Object.assign(new Error('CAPTCHA rejected'), { status });
  return { questions: [{ id: 1 }] };
}, URLSearchParams);

await assert.rejects(fetchTaskDetails(1, 'room', ''));
assert.equal(calls, 0);
assert.equal((await fetchTaskDetails(1, 'room', 'verified-test', '', 'session-test', 'sid=abc')).questions[0].id, 1);
assert.equal(calls, 1);
status = 403;
await assert.rejects(
  fetchTaskDetails(1, 'room', 'verified-test', '', 'session-test', 'sid=abc'),
  error => error.status === 403 && error.taskAccessBlocked
);
assert.equal(calls, 2);
status = 200;
network = true;
await assert.rejects(
  fetchTaskDetails(1, 'room', 'verified-test', '', 'session-test', 'sid=abc'),
  error => error instanceof TypeError && error.taskAccessBlocked !== true
);
assert.equal(calls, 3);
console.log('OK: abertura pelo Worker encaminha CAPTCHA, sessão e cookie; rede instável não classifica o CAPTCHA como recusado.');
