import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const [html, script, styles, schema] = await Promise.all([
  readFile(new URL('./index.html', import.meta.url), 'utf8'),
  readFile(new URL('./platforms-tab.js', import.meta.url), 'utf8'),
  readFile(new URL('./platforms-tab.css', import.meta.url), 'utf8'),
  readFile(new URL('./sedx-admin-schema.sql', import.meta.url), 'utf8'),
]);
assert.match(html, /platforms-tab\.css/);
assert.match(html, /platforms-tab\.js/);
assert.match(script, /TAB_VALUE = 'chat'/);
assert.match(script, /<span>Comunidade<\/span>/);
assert.match(script, /Abrir Comunidade/);
assert.match(script, /chat\/messages/);
assert.match(script, /data-chat-preview/);
assert.match(script, /readFile/);
assert.match(script, /chat-audio-wave/);
assert.match(script, /formatDuration/);
assert.match(script, /MediaRecorder/);
assert.match(script, /data-chat-edit/);
assert.match(script, /data-chat-delete/);
assert.match(script, /admin\/chat/);
assert.match(script, /data-chat-ban/);
assert.match(script, /X-Task-User/);
assert.match(script, /profilePrefs/);
assert.match(script, /profileAvatar/);
assert.match(script, /const initials/);
assert.match(script, /slice\(0, 2\)/);
assert.match(script, /\.page-content/);
assert.match(styles, /\.sedx-chat-page/);
assert.match(styles, /\.sedx-chat-host/);
assert.match(styles, /\.is-mine/);
assert.match(styles, /\.chat-attachment-image/);
assert.match(schema, /CREATE TABLE IF NOT EXISTS chat_messages/);
assert.match(schema, /CREATE TABLE IF NOT EXISTS chat_mutes/);
assert.match(schema, /CREATE TABLE IF NOT EXISTS chat_bans/);
console.log('OK: a aba Chat possui mensagens públicas, anexos, áudio, edição, exclusão e moderação.');
