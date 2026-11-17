import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('./script.js', import.meta.url), 'utf8');
const start = source.indexOf('async function requestWithPollinations(');
const end = source.indexOf('\nconst queuedAiRequest=', start);
assert.ok(start >= 0 && end > start, 'requestWithPollinations não encontrado');
const calls = [];
const context = {
  request: async () => { throw new Error('Groq indisponível'); },
  fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, text: async () => '{"ok":true}' }; },
};
vm.runInNewContext(`${source.slice(start, end)}\nthis.requestWithPollinations = requestWithPollinations;`, context);
const result = await context.requestWithPollinations('/groq-chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'Teste do fallback' }] }) });
assert.equal(result.provider, 'pollinations');
assert.equal(result.response, '{"ok":true}');
assert.equal(calls.length, 1);
assert.match(calls[0].url, /^https:\/\/text\.pollinations\.ai\//);
assert.match(decodeURIComponent(calls[0].url), /Teste do fallback/);
console.log('OK: fallback da Pollinations é usado quando a Groq falha.');
