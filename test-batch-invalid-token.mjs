import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const src = readFileSync(new URL("./script.js", import.meta.url), "utf8");
assert.ok(src.includes('catch(retryError){if(Number(retryError?.status||0)===401||(Number(retryError?.status||0)===400&&/invalid\\s+token/i.test('), "invalid token after renewal must ask for reauth");
assert.ok(src.includes('if(error?.taskSessionRequired||st===401){g(null);w("");'), "batch send must open reauth on expired session");
console.log("ok");
assert.ok(src.includes('let currentTask="",completed=0,agreementFailures=[];try{$(!0);if(typeof readSession==="function"&&typeof resumeSession==="function"&&readSession()?.token){try{await resumeSession()}'), "batch send renews the access key before submitting");
