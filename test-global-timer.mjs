import fs from "node:fs";
import assert from "node:assert";

const src = fs.readFileSync(new URL("./script.js", import.meta.url), "utf8");
const store = {};
globalThis.localStorage = {
  getItem: (key) => (key in store ? store[key] : null),
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
};

const grab = (name) => {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `função ${name} encontrada`);
  let depth = 0;
  const bodyStart = src.indexOf("{", start);
  for (let index = bodyStart; index < src.length; index += 1) {
    if (src[index] === "{") depth += 1;
    if (src[index] === "}" && --depth === 0) return src.slice(start, index + 1);
  }
  throw new Error(`função ${name} incompleta`);
};

const code = [
  "getGlobalTaskTimer",
  "getGlobalTaskRemainingSeconds",
  "formatTaskTimerSeconds",
  "getTaskDurationForTask",
  "getTaskDurationMinutes",
].map(grab).join(";") + ";const getRedacaoDurationMinutes=()=>20;return{getGlobalTaskTimer,getGlobalTaskRemainingSeconds,formatTaskTimerSeconds,getTaskDurationForTask}";
const {
  getGlobalTaskTimer,
  getGlobalTaskRemainingSeconds,
  formatTaskTimerSeconds,
  getTaskDurationForTask,
} = new Function(code)();

store.sed_task_duration_minutes = "3";
assert.equal(getTaskDurationForTask({}), 3);

const startedAt = 1_000_000;
store.sed_global_task_timer = JSON.stringify({ minutes: 7, startedAt });
assert.equal(getTaskDurationForTask({}), 7, "atividade usa o tempo global");
assert.equal(getTaskDurationForTask({ isRedacao: true }), 20, "redação mantém seu próprio tempo");

const timer = getGlobalTaskTimer();
assert.equal(getGlobalTaskRemainingSeconds(timer, startedAt), 420, "sete minutos começam com 07:00 restantes");
assert.equal(getGlobalTaskRemainingSeconds(timer, startedAt + 65_000), 355, "todas usam a mesma contagem: 05:55 após 65 segundos");
assert.equal(getGlobalTaskRemainingSeconds(timer, startedAt + 420_000), 0, "a contagem termina em zero");
assert.equal(getGlobalTaskRemainingSeconds(timer, startedAt + 500_000), 0, "a contagem nunca fica negativa");
assert.equal(formatTaskTimerSeconds(355), "05:55");
assert.equal(formatTaskTimerSeconds(0), "00:00");
assert.ok(!src.includes("Realizar todas atividades"), "botão de lote removido");
console.log("ok");
