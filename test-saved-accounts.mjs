import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

class MockStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const localStorage = new MockStorage();
const document = {
  head: { appendChild() {} },
  documentElement: {},
  createElement() { return { textContent: "" }; },
  querySelector() { return null; },
};
class MutationObserver { observe() {} }
const listeners = new Map();
const window = {
  location: { reload() {} },
  addEventListener(type, handler) { listeners.set(type, handler); },
  dispatchEvent(event) { listeners.get(event.type)?.(event); },
};
const context = { Storage: MockStorage, localStorage, document, MutationObserver, window, Event: class Event { constructor(type, options = {}) { this.type = type; Object.assign(this, options); } } };
vm.runInNewContext(fs.readFileSync(new URL("./saved-accounts.js", import.meta.url), "utf8"), context);

localStorage.setItem("sed_sessao", JSON.stringify({ usuario: "123456789SP", nome: "Ana Souza", token: "token-a", token2: "token2-a", senha: "nao-salvar" }));
localStorage.setItem("sed_sessao", JSON.stringify({ usuario: "99887766-5SP", nome: "Bruno Lima", token2: "token2-b" }));
localStorage.setItem("sed_sessao", JSON.stringify({ usuario: "123456789SP", nome: "Ana Silva", token: "token-a2", token2: "token2-a2" }));
window.dispatchEvent({ type: "sedx:credentials", detail: { usuario: "12345678-9SP", senha: "senha-da-ana" } });

const accounts = JSON.parse(localStorage.getItem("sed_contas_salvas"));
assert.equal(accounts.length, 2, "A mesma conta deve ser atualizada, não duplicada");
assert.equal(accounts[0].usuario, "123456789SP", "A conta usada recentemente deve aparecer primeiro");
assert.equal(accounts[0].nome, "Ana Silva", "O nome mais recente deve ser mostrado");
assert.equal(accounts[1].nome, "Bruno Lima");
assert.equal(accounts[0].senha, "senha-da-ana", "A senha deve ser vinculada à conta após o login");
assert.equal(localStorage.getItem("sed_sessao") !== null, true, "A sessão atual continua compatível com o app");
console.log("OK: contas salvas por dispositivo, deduplicadas e com preenchimento de credenciais.");
