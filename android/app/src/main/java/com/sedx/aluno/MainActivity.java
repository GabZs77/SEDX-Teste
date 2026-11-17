package com.sedx.aluno;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Space;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String WORKER = "https://sdf.gabrielreplit56.workers.dev";
    private static final String PREFS = "sedx_native_session";
    private static final String SESSION = "session";
    private static final int BG = Color.rgb(11, 12, 15);
    private static final int CARD = Color.rgb(24, 27, 34);
    private static final int TEXT = Color.rgb(245, 246, 250);
    private static final int MUTED = Color.rgb(166, 170, 184);
    private static final int ACCENT = Color.rgb(190, 143, 255);
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private SharedPreferences prefs;
    private JSONObject session;
    private LinearLayout root;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        session = readSession();
        if (session == null) showLogin(); else showDashboard();
    }

    private JSONObject readSession() {
        try { String raw = prefs.getString(SESSION, ""); return raw.isEmpty() ? null : new JSONObject(raw); } catch (Exception e) { return null; }
    }
    private void saveSession(JSONObject value) { session = value; prefs.edit().putString(SESSION, value.toString()).apply(); }
    private String s(String key) { return session == null ? "" : session.optString(key, ""); }
    private boolean isAdmin() { String ra = s("usuario").replaceAll("\\D", ""); return ra.equals("1703202") || ra.equals("17032026"); }

    private TextView text(String value, float size, int color, boolean bold) {
        TextView v = new TextView(this); v.setText(value); v.setTextSize(size); v.setTextColor(color); v.setPadding(0, 5, 0, 5);
        if (bold) v.setTypeface(Typeface.DEFAULT, Typeface.BOLD); return v;
    }
    private Button button(String label) {
        Button b = new Button(this); b.setText(label); b.setTextColor(TEXT); b.setTextSize(13); b.setAllCaps(false); b.setBackgroundColor(Color.rgb(55, 45, 78));
        b.setPadding(16, 8, 16, 8); return b;
    }
    private EditText input(String hint, boolean password) {
        EditText e = new EditText(this); e.setHint(hint); e.setHintTextColor(MUTED); e.setTextColor(TEXT); e.setTextSize(15); e.setSingleLine(!hint.contains("mensagem") && !hint.contains("descrição"));
        e.setPadding(16, 12, 16, 12); e.setBackgroundColor(Color.rgb(29, 32, 40)); if (password) e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD); return e;
    }
    private LinearLayout page(String title) {
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(22, 28, 22, 18); root.setBackgroundColor(BG);
        setContentView(root); root.addView(text("SEDX", 28, ACCENT, true)); root.addView(text(title, 25, TEXT, true));
        return root;
    }
    private ScrollView scroll(LinearLayout content) { ScrollView s = new ScrollView(this); s.setFillViewport(true); s.addView(content); return s; }
    private void status(String value) { Toast.makeText(this, value, Toast.LENGTH_SHORT).show(); }

    private void showLogin() {
        LinearLayout p = page("Entrar no SEDX"); p.setGravity(Gravity.CENTER_HORIZONTAL); Space top = new Space(this); p.addView(top, new LinearLayout.LayoutParams(1, 42));
        p.addView(text("Sua jornada começa aqui.", 16, MUTED, false));
        EditText ra = input("RA com dígito e UF", false); EditText pass = input("Senha", true); p.addView(ra, full()); p.addView(pass, full());
        Button login = button("Entrar"); p.addView(login, full()); TextView error = text("", 12, Color.rgb(255, 135, 135), false); p.addView(error, full());
        login.setOnClickListener(v -> { login.setEnabled(false); error.setText("Conectando…"); executor.execute(() -> { try { JSONObject body = new JSONObject().put("usuario", ra.getText().toString().trim()).put("senha", pass.getText().toString()); JSONObject result = request("/login", "POST", body, null); result.put("usuario", ra.getText().toString().trim()); saveSession(result); runOnUiThread(this::showDashboard); } catch (Exception e) { runOnUiThread(() -> { login.setEnabled(true); error.setText(e.getMessage()); }); } }); });
    }

    private void showDashboard() {
        LinearLayout p = page("Olá, " + firstName(s("nome"), s("usuario")) + "!"); p.addView(text("Vamos cuidar dos seus estudos?", 15, MUTED, false));
        LinearLayout hero = card(); hero.addView(text("Tudo em dia!", 23, TEXT, true)); hero.addView(text("Seu próximo passo começa aqui.", 14, MUTED, false)); Button activities = button("Ver atividades"); hero.addView(activities, full()); p.addView(hero, full());
        p.addView(text("Acesso rápido", 18, TEXT, true));
        LinearLayout grid = new LinearLayout(this); grid.setOrientation(LinearLayout.VERTICAL);
        Button community = button("Comunidade  ›"); Button help = button("Suporte e ideias  ›"); Button profile = button("Meu perfil  ›"); Button logout = button("Sair da conta"); grid.addView(community, full()); grid.addView(help, full()); grid.addView(profile, full()); grid.addView(logout, full()); p.addView(grid, full());
        community.setOnClickListener(v -> showCommunity()); help.setOnClickListener(v -> showHelp()); profile.setOnClickListener(v -> showProfile()); logout.setOnClickListener(v -> { prefs.edit().clear().apply(); session = null; showLogin(); });
        if (isAdmin()) { TextView badge = text("✓ ADMINISTRADOR", 12, Color.rgb(255, 197, 116), true); badge.setPadding(0, 18, 0, 0); p.addView(badge); }
    }

    private void showCommunity() {
        LinearLayout p = page("Comunidade"); Button back = button("‹ Voltar"); p.addView(back, full()); back.setOnClickListener(v -> showDashboard());
        LinearLayout messages = new LinearLayout(this); messages.setOrientation(LinearLayout.VERTICAL); p.addView(scroll(messages), new LinearLayout.LayoutParams(-1, 0, 1));
        LinearLayout composer = new LinearLayout(this); composer.setOrientation(LinearLayout.HORIZONTAL); EditText message = input("Escreva uma mensagem…", false); message.setSingleLine(false); Button send = button("Enviar"); composer.addView(message, new LinearLayout.LayoutParams(0, -2, 1)); composer.addView(send, new LinearLayout.LayoutParams(-2, -2)); p.addView(composer, full());
        loadChat(messages); send.setOnClickListener(v -> { String value = message.getText().toString().trim(); if (value.isEmpty()) return; send.setEnabled(false); executor.execute(() -> { try { request("/chat/messages", "POST", new JSONObject().put("content", value), session); runOnUiThread(() -> { message.setText(""); send.setEnabled(true); loadChat(messages); }); } catch (Exception e) { runOnUiThread(() -> { send.setEnabled(true); status(e.getMessage()); }); } }); });
    }
    private void loadChat(LinearLayout target) { executor.execute(() -> { try { JSONObject data = request("/chat/messages?limit=100", "GET", null, session); JSONArray list = data.optJSONArray("messages"); runOnUiThread(() -> { target.removeAllViews(); if (list == null || list.length() == 0) { target.addView(text("O grupo está esperando você.", 15, MUTED, false)); return; } for (int i = 0; i < list.length(); i++) { JSONObject m = list.optJSONObject(i); if (m == null) continue; LinearLayout item = card(); JSONObject author = m.optJSONObject("author"); String name = author == null ? m.optString("authorName", "Aluno") : author.optString("name", "Aluno"); TextView nameView = text(name + (m.optBoolean("isAdmin") ? "   ✓ ADMIN" : ""), 13, m.optBoolean("isAdmin") ? Color.rgb(255, 197, 116) : TEXT, true); item.addView(nameView); item.addView(text(m.optString("content", m.optBoolean("deleted") ? "Mensagem removida." : ""), 15, TEXT, false)); target.addView(item, full()); } }); } catch (Exception e) { runOnUiThread(() -> status(e.getMessage())); } }); }

    private void showHelp() {
        LinearLayout p = page("Central de ajuda"); Button back = button("‹ Voltar"); p.addView(back, full()); back.setOnClickListener(v -> showDashboard()); p.addView(text("Envie uma sugestão ou relate um bug. O atendimento aparecerá para o administrador.", 14, MUTED, false));
        EditText content = input("Descreva sua ideia ou problema…", false); content.setSingleLine(false); p.addView(content, full()); Button send = button("Enviar atendimento"); p.addView(send, full()); LinearLayout list = new LinearLayout(this); list.setOrientation(LinearLayout.VERTICAL); p.addView(list, full());
        send.setOnClickListener(v -> { String value = content.getText().toString().trim(); if (value.length() < 10) { status("Escreva pelo menos 10 caracteres."); return; } send.setEnabled(false); executor.execute(() -> { try { request("/feedback", "POST", new JSONObject().put("type", "sugestao").put("content", value), session); runOnUiThread(() -> { content.setText(""); send.setEnabled(true); status("Atendimento enviado."); loadHelp(list); }); } catch (Exception e) { runOnUiThread(() -> { send.setEnabled(true); status(e.getMessage()); }); } }); }); loadHelp(list);
    }
    private void loadHelp(LinearLayout target) { executor.execute(() -> { try { JSONObject data = request("/feedback/mine", "GET", null, session); JSONArray list = data.optJSONArray("feedback"); runOnUiThread(() -> { target.removeAllViews(); if (list == null) return; for (int i = 0; i < list.length(); i++) { JSONObject t = list.optJSONObject(i); if (t == null) continue; LinearLayout c = card(); c.addView(text(t.optString("type", "Atendimento").toUpperCase(), 11, ACCENT, true)); c.addView(text(t.optString("content", ""), 14, TEXT, false)); c.addView(text(t.optString("status", "aberto"), 11, MUTED, false)); target.addView(c, full()); } }); } catch (Exception e) { runOnUiThread(() -> status(e.getMessage())); } }); }

    private void showProfile() {
        LinearLayout p = page("Meu perfil"); Button back = button("‹ Voltar"); p.addView(back, full()); back.setOnClickListener(v -> showDashboard()); p.addView(text("Sua identidade no SEDX", 15, MUTED, false)); EditText description = input("Descrição", false); description.setSingleLine(false); description.setText(prefs.getString("description", "")); p.addView(description, full()); String[] themes = {"Tema SEDX", "Tema Violeta", "Tema Oceano", "Tema Floresta"}; for (String theme : themes) { Button b = button(theme); p.addView(b, full()); b.setOnClickListener(v -> prefs.edit().putString("theme", theme).apply()); } Button save = button("Salvar perfil"); p.addView(save, full()); save.setOnClickListener(v -> { prefs.edit().putString("description", description.getText().toString()).apply(); status("Perfil salvo neste aparelho."); });
    }

    private LinearLayout card() { LinearLayout c = new LinearLayout(this); c.setOrientation(LinearLayout.VERTICAL); c.setPadding(18, 16, 18, 16); c.setBackgroundColor(CARD); LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2); lp.setMargins(0, 10, 0, 10); c.setLayoutParams(lp); return c; }
    private LinearLayout.LayoutParams full() { return new LinearLayout.LayoutParams(-1, -2); }
    private String firstName(String name, String fallback) { String v = name == null || name.trim().isEmpty() ? fallback : name.trim(); return v.split(" ")[0]; }

    private JSONObject request(String path, String method, JSONObject body, JSONObject auth) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(WORKER + path).openConnection(); c.setRequestMethod(method); c.setConnectTimeout(20000); c.setReadTimeout(30000); c.setRequestProperty("Accept", "application/json");
        if (auth != null) { c.setRequestProperty("X-Token2", auth.optString("token2", "")); c.setRequestProperty("X-Token", auth.optString("token", "")); c.setRequestProperty("X-Usuario", auth.optString("usuario", "")); c.setRequestProperty("X-Task-User", auth.optString("nome", "")); if (isAdmin()) c.setRequestProperty("X-Admin-User", s("usuario")); }
        if (body != null) { c.setDoOutput(true); c.setRequestProperty("Content-Type", "application/json"); try (OutputStream out = c.getOutputStream()) { out.write(body.toString().getBytes(StandardCharsets.UTF_8)); } }
        int code = c.getResponseCode(); InputStream stream = code >= 400 ? c.getErrorStream() : c.getInputStream(); StringBuilder raw = new StringBuilder(); if (stream != null) { try (BufferedReader r = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) { String line; while ((line = r.readLine()) != null) raw.append(line); } }
        JSONObject result; try { result = new JSONObject(raw.toString()); } catch (Exception e) { result = new JSONObject(); }
        if (code < 200 || code >= 300) throw new Exception(result.optString("erro", "Não foi possível concluir a operação (HTTP " + code + ").")); return result;
    }

    @Override public void onBackPressed() { showDashboard(); }
    @Override protected void onDestroy() { executor.shutdownNow(); super.onDestroy(); }
}
