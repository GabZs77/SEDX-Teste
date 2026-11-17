import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const bundle = fs.readFileSync(new URL('./script.js', import.meta.url), 'utf8');
const client = {};
const normalStart = bundle.indexOf('function asObject(');
vm.runInNewContext(bundle.slice(normalStart, bundle.indexOf('const agendaTextureUrl', normalStart)), client);
const tasks = client.normalizeTasks([
  {id:'expired',due:'2000-01-01',raw:{answer_status:'draft'}},
  {id:'nested-expired',assignment:{is_expired:true},status:'pending'},
  {id:'nested-deadline',task:{deadline:'2000-01-01'},status:'pending'},
  {id:'pending',due:'2099-01-01'},
  {id:'completed',status:'completed',due:'2000-01-01'}
]);
assert.equal(tasks.length,4, 'Unfinished expired tasks remain in the list');
assert.equal(tasks[0].status,'expired', 'An overdue draft is expired');
assert.equal(tasks[1].status,'expired', 'An explicit nested expiration flag is respected');
assert.equal(tasks[2].status,'expired', 'A nested deadline is respected');
assert.equal(tasks[3].status,'pending');
assert.equal(tasks[0].due,'2000-01-01');
console.log('OK: expired tasks included, paginated, and classified without removing overdue drafts.');

const cases = [
  [{id:'raw-flag',status:'pending',due:null,raw:{task_expired:true}}, 'expired'],
  [{id:'raw-nested-flag',status:'pending',raw:{assignment:{is_expired:true}}}, 'expired'],
  [{id:'raw-nested-date',status:'pending',due:null,raw:{task:{deadline:'2000-01-01'}}}, 'expired'],
  [{id:'status-masked',answer_status:'pending',status:'expired'}, 'expired'],
  [{id:'raw-status',status:'pending',raw:{status:'expired'}}, 'expired'],
  [{id:'object-date',apply_moment:{start:'1999-01-01',end:'2000-01-01'}}, 'expired'],
  [{id:'invalid-date',due:'not-a-date',raw:{deadline:'2000-01-01'}}, 'expired'],
  [{id:'no-evidence',status:'pending',due:null}, 'pending'],
  [{id:'false-flag',raw:{task_expired:false},due:'2099-01-01'}, 'pending'],
  [{id:'future-window',apply_moment:{start:'2000-01-01',end:'2099-01-01'}}, 'pending'],
  [{id:'completed-expired',status:'completed',raw:{task_expired:true}}, 'completed'],
];
for (const [input, expected] of cases) {
  assert.equal(client.normalizeTasks([input], true)[0].status, expected, input.id);
}
assert.equal(client.normalizeTasks([{raw:{task:{deadline:'2000-01-01'}}}])[0].due, '2000-01-01');
console.log('OK: raw expiration flags, nested deadlines, masked statuses and completed tasks.');
