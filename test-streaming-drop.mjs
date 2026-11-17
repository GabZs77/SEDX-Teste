import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const script = await readFile(new URL('./platforms-tab.js', import.meta.url), 'utf8');
assert.doesNotMatch(script, /data-community-channel=\"drops\"|Streaming Drop/, 'Streaming Drop must not appear in the Community tab');
assert.doesNotMatch(script, /COMMUNITY_ROUTE}\/streaming|channel === ['\"]drops['\"]/, 'The removed channel must not remain routable from Community');
console.log('OK: Streaming Drop foi removido da aba Comunidade.');
