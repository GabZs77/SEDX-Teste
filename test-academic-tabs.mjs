import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
const bundle = fs.readFileSync(new URL("./script.js", import.meta.url), "utf8");
const navStart = bundle.indexOf("navItems=[");
const navEnd = bundle.indexOf("];function AppShell", navStart);
const navBlock = bundle.slice(navStart, navEnd);
assert.ok(!navBlock.includes('href:"/presenca"'), "Presença não deve aparecer no menu principal");
assert.ok(!navBlock.includes('href:"/boletim"'), "Boletim não deve aparecer no menu principal");
assert.ok(!navBlock.includes('href:"/agenda"'), "Agenda não deve aparecer no menu principal");
assert.ok(bundle.includes('path:"/presenca",children:jsxRuntimeExports.jsx(Redirect,{to:"/dashboard"})'), "Presença deve redirecionar para a dashboard");
assert.ok(bundle.includes('path:"/boletim",children:jsxRuntimeExports.jsx(Redirect,{to:"/dashboard"})'), "Boletim deve redirecionar para a dashboard");
assert.ok(bundle.includes('path:"/agenda",children:jsxRuntimeExports.jsx(Redirect,{to:"/dashboard"})'), "Agenda deve redirecionar para a dashboard");
const helperStart = bundle.indexOf("function asObject(");
const helperEnd = bundle.indexOf("function formatTaskDeadline(", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "normalizadores acadêmicos devem existir no bundle");
const helperContext = {};
vm.runInNewContext(`${bundle.slice(helperStart, helperEnd)}\nthis.normalizeGrades=normalizeGrades;this.filterGradesByPeriod=filterGradesByPeriod;this.normalizeAttendance=normalizeAttendance;this.normalizeAgenda=normalizeAgenda;`, helperContext);
const grades = helperContext.normalizeGrades({ data: [{ componenteCurricularId: 42, nomeComponenteCurricular: "Matemática", notaAtribuida: "8,5", notaAtribuidaMediaFinal: "9,0", primeiroBimestre: true }] });
assert.equal(grades.length, 1);
assert.equal(grades[0].grade, 8.5);
assert.equal(grades[0].average, 9);
assert.equal(helperContext.filterGradesByPeriod(grades, "1").length, 1);
const attendance = helperContext.normalizeAttendance({ data: [{ totalFaltasBimestre: 13, totalAulasRealizadas: 72, porcentagemFrequencia: 82 }] });
assert.equal(attendance.frequency, 82);
assert.equal(attendance.absences, 13);
assert.equal(attendance.classes, 72);
const weightedAttendance = helperContext.normalizeAttendance({ data: [
  { totalAulasRealizadas: 40, porcentagemFrequencia: 80 },
  { totalAulasRealizadas: 60, porcentagemFrequencia: 100 },
] });
assert.equal(weightedAttendance.frequency, 92, "frequência agregada deve ser ponderada pelo número de aulas");
const contradictoryAttendance = helperContext.normalizeAttendance({
  frequenciaGeral: 76.5,
  totalFaltas: 149,
  totalAulasRealizadas: 149,
  data: [
    { totalAulasRealizadas: 40, totalFaltasBimestre: 40, porcentagemFrequencia: 83.7 },
    { totalAulasRealizadas: 45, totalFaltasBimestre: 45, porcentagemFrequencia: 77.2 },
    { totalAulasRealizadas: 64, totalFaltasBimestre: 64, porcentagemFrequencia: 71.4 },
  ],
});
assert.equal(contradictoryAttendance.inconsistent, false);
assert.equal(contradictoryAttendance.countMismatch, true, "a contagem incompatível de faltas deve ser marcada separadamente");
assert.equal(contradictoryAttendance.frequency, 76.5, "preservar o percentual oficial compatível com os percentuais bimestrais ponderados");
assert.equal(contradictoryAttendance.absences, null);
assert.equal(contradictoryAttendance.classes, 149);
assert.equal(contradictoryAttendance.absenceRate, 23.5);
assert.equal(contradictoryAttendance.periods.length, 3);
assert.ok(contradictoryAttendance.periods.every((period) => period.absences === null), "não exibir faltas por bimestre incompatíveis com a frequência");
const recomputedAttendance = helperContext.normalizeAttendance({
  frequenciaGeral: 50,
  data: [
    { totalAulasRealizadas: 40, porcentagemFrequencia: 83.7 },
    { totalAulasRealizadas: 45, porcentagemFrequencia: 77.2 },
    { totalAulasRealizadas: 64, porcentagemFrequencia: 71.4 },
  ],
});
assert.ok(Math.abs(recomputedAttendance.frequency - 76.4537) < 0.001, "quando o resumo geral diverge, calcular frequência ponderada pelos totais bimestrais");
const subjects = helperContext.normalizeAttendance({ data: [{ disciplinaId: 2400, nomeDisciplina: "BIOLOGIA", numeroFaltasBimestre: 1, porcentagemPresenca: 95 }] });
assert.equal(subjects.subjects.length, 1);
const officialAgenda = helperContext.normalizeAgenda({ data: { agendaAluno: [{ disciplinaId: 2400, nomeDisciplina: "BIOLOGIA", dataInicio: "2026-10-23T00:00:00", horaInicioAula: "16:10:00", horaFimAula: "17:00:00", descricaoTurma: "4050 - ADMINISTRAÇÃO" }] } });
assert.equal(officialAgenda.length, 1);
assert.equal(officialAgenda[0].start, "16:10");
assert.ok(bundle.includes('normalizeAgenda(agendaData??a?.agenda)'), "Agenda deve usar o retorno direto da API antes do dashboard");
console.log("OK: Presença, Boletim e Agenda foram removidos do menu e redirecionam para a dashboard.");
