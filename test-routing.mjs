import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./script.js", import.meta.url), "utf8");

assert.match(source, /navItems=\[\{href:"\/dashboard",label:"Início"/);
assert.match(source, /href:"\/dashboard",className:"mobile-brand"/);
assert.match(source, /await s\(P,u\),a\(new URLSearchParams\(window\.location\.search\)\.get\("next"\)==="\/notificacoes"\?/);
assert.match(source, /function ProtectedRoutes\(\).*?path==="\/login"\?jsxRuntimeExports\.jsx\(Login,\{\}\):jsxRuntimeExports\.jsx\(Redirect,\{to:path==="\/notificacoes"\?/s);
assert.match(source, /Route,\{path:"\/dashboard",component:DashboardPage\}/);
assert.match(source, /path:"\/",children:jsxRuntimeExports\.jsx\(Redirect,\{to:"\/dashboard"\}\)/);
assert.match(source, /path:"\/login",children:jsxRuntimeExports\.jsx\(Redirect,\{to:"\/dashboard"\}\)/);
assert.match(source, /to:"\/dashboard\?sedxTab=chat&channel=announcements"/);

console.log("OK: /login e /dashboard protegem o app, redirecionam a raiz e preservam avisos legados.");
