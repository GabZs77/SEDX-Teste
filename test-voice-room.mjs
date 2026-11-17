import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, community, client, styles] = await Promise.all([
  readFile(new URL('./index.html', import.meta.url), 'utf8'),
  readFile(new URL('./platforms-tab.js', import.meta.url), 'utf8'),
  readFile(new URL('./voice-room.js', import.meta.url), 'utf8'),
  readFile(new URL('./voice-room.css', import.meta.url), 'utf8'),
]);

assert.match(html, /voice-room\.css/);
assert.match(html, /voice-room\.js/);
assert.ok(html.indexOf('voice-room.js') < html.indexOf('platforms-tab.js'), 'O cliente precisa ser carregado antes da Comunidade.');
assert.match(community, /data-community-channel="voice"/);
assert.doesNotMatch(community, /Sala dispon[ií]vel em breve/);
assert.match(community, /channel === 'voice'\) renderVoiceRoom\(\)/);
assert.match(community, /unmountVoiceRoom\(\)/);
assert.match(client, /const ROOM_ID = 'sala-de-voz'/);
assert.match(client, /const MAX_PEERS = 20/);
assert.match(client, /new WebSocket\(/);
assert.match(client, /RTCPeerConnection/);
assert.match(client, /getUserMedia/);
assert.match(client, /getDisplayMedia/);
assert.match(client, /replaceTrack/);
for (const action of ['mute', 'audio', 'screen', 'output', 'leave']) {
  assert.match(client, new RegExp(`data-voice-action="${action}"`));
}
assert.match(client, /peer-state/);
assert.match(client, /type: 'signal'/);
assert.match(client, /host\.addEventListener\('pointerdown', wakeRemoteAudio/);
assert.match(client, /audio\.muted = state\.deaf/);
assert.match(client, /sendState\(\{ deaf: state\.deaf, sharing: state\.sharing, speaking: lastSpeaking \}\)/);
assert.match(client, /if \(disposed \|\| state\.roomFull\) \{ stream\.getTracks\(\)\.forEach/);
assert.match(client, /releaseLocalCapture\(\)/);
assert.match(styles, /\.voice-tile\.is-speaking/);
assert.match(styles, /prefers-reduced-motion/);
assert.match(styles, /max-width: 760px/);

console.log('OK: Sala de voz integrada, com limpeza e recuperação de áudio/tela verificadas.');
