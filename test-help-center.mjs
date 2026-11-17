import fs from "node:fs";
import assert from "node:assert/strict";

const app = fs.readFileSync(new URL("./script.js", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("./feedback-modal.js", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("./style.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");

const quickLinksStart = app.indexOf('className:"dashboard-quick-links support-center-links"');
assert.ok(quickLinksStart >= 0, "a dashboard deve ter o atalho da Central de ajuda");
const quickLinksEnd = app.indexOf('className:"section-block"', quickLinksStart);
const quickLinks = app.slice(quickLinksStart, quickLinksEnd);
assert.ok(quickLinks.includes('children:"Suporte"'), "o atalho deve continuar identificado como Suporte");
assert.ok(quickLinks.includes("window.openSedxFeedbackModal"), "Suporte deve abrir a Central de ajuda");
assert.ok(!quickLinks.includes("mailto:"), "Suporte não deve sair do SEDX para um e-mail externo");
assert.ok(!quickLinks.includes("Ideias e bugs"), "o atalho antigo de ideias não deve duplicar a Central");

for (const label of ["Central de ajuda", "Atendimento SEDX", "Abrir novo atendimento", "Seus atendimentos", "Nenhum atendimento", "Suas conversas com o suporte aparecerão aqui."]) {
  assert.ok(page.includes(label), `a tela deve conter '${label}'`);
}
assert.ok(page.includes("api('/feedback/mine')"), "a tela deve carregar chamados do aluno autenticado");
assert.ok(page.includes("api('/feedback'"), "o formulário deve enviar atendimento pelo endpoint existente");
assert.ok(page.includes("adminReply"), "a tela deve mostrar respostas existentes da equipe");
assert.ok(page.includes("X-Token2"), "o fluxo deve continuar autenticando a sessão do aluno");
assert.ok(styles.includes(".sedx-feedback-modal.sedx-help-center"), "a Central deve abrir em tela cheia com estilos próprios");
assert.ok(styles.includes(".help-new-ticket"), "o botão de novo atendimento deve ter estilo responsivo");
assert.ok(html.includes('feedback-modal.js?v=profile-global-3'), "o HTML deve carregar o módulo atualizado sem cache antigo");
assert.ok(!html.includes("platforms-hub"), "a aba Plataformas removida não deve ser carregada novamente");
for (const piece of ["api(`/feedback/ticket?id=", "'/feedback/message'", "method: 'PUT'", "method: 'DELETE'", "data-msg-edit", "data-msg-delete", "data-ticket-delete", "window.openSedxFeedbackTicket"]) {
  assert.ok(page.includes(piece), `a conversa do atendimento deve conter '${piece}'`);
}
for (const route of ["const HELP_ROUTE = '/ajuda'", "const TICKET_ROUTE_PREFIX = '/ajuda/a/'", "history[method]", "popstate"]) {
  assert.ok(page.includes(route), `a navegação deve conter '${route}'`);
}
assert.ok(app.includes('path:"/ajuda"') && app.includes('path:"/ajuda/a/:ticketId"'), "o roteador principal deve reconhecer a Central e seus atendimentos");
assert.ok(page.includes("mine || canDeleteAssistant ? `<div class=\"help-msg-actions\">"), "editar/excluir aparece apenas nas mensagens do próprio autor");
assert.ok(page.includes("data.admin ? '<div class=\"help-ticket-admin-tools\">"), "excluir atendimento aparece apenas para o administrador");
const admin = fs.readFileSync(new URL("./admin-panel.js", import.meta.url), "utf8");
assert.ok(admin.includes("data-action=\"open-feedback\"") && admin.includes("data-action=\"delete-feedback\""), "o painel do administrador deve abrir e excluir atendimentos");
assert.ok(page.includes("raDigits(value) === currentRa()"), "o RA com 'SP' no final deve ser reconhecido como o RA do login");
assert.ok(page.includes("looksLikeRa"), "o nome exibido não deve ser o número do RA");
console.log("OK: Suporte abre a Central de ajuda em tela cheia, com criação e listagem de chamados existentes.");
