(function () {
  'use strict';
  const KEY = 'sedx-profile-preferences-v1';
  const WORKER_URL = 'https://sdf.gabrielreplit56.workers.dev';
  const presets = [
    { id: 'sedx', name: 'SEDX', accent: '#ff9f3f', secondary: '#d44b2a', bg: '#120b08', foreground: '#f7f7f7' },
    { id: 'ocean', name: 'Oceano', accent: '#45b9ff', secondary: '#5d6bff', bg: '#07111c', foreground: '#f7f7f7' },
    { id: 'violet', name: 'Violeta', accent: '#c58cff', secondary: '#745cff', bg: '#10091c', foreground: '#f7f7f7' },
    { id: 'forest', name: 'Floresta', accent: '#64d39b', secondary: '#1e9c76', bg: '#07150f', foreground: '#f7f7f7' }
  ];
  const session = () => { try { return JSON.parse(localStorage.getItem('sed_sessao') || 'null'); } catch (_) { return null; } };
  const accountKey = () => `${KEY}:${String(session()?.usuario || 'visitante').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const profileSessionKeyStorage = () => `${KEY}:session-key:${String(session()?.usuario || 'visitante').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const read = () => { try { return JSON.parse(localStorage.getItem(accountKey()) || '{}'); } catch (_) { return {}; } };
  const save = (data) => { localStorage.setItem(accountKey(), JSON.stringify(data)); applyTheme(data); broadcast(data); };
  const storedProfileKey = () => { try { return String(localStorage.getItem(profileSessionKeyStorage()) || ''); } catch (_) { return ''; } };
  const authHeaders = (profileKey = storedProfileKey()) => { const current = session() || {}; const result = { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Token2': current.token2 || '', 'X-Token': current.token || '', 'X-Usuario': current.usuario || '', 'X-Cd-Usuario': current.cdUsuarioCurto || '' }; if (profileKey) result['X-Profile-Key'] = profileKey; return result; };
  const ensureProfileKey = async () => { const current = session() || {}; const existing = storedProfileKey(); if (existing || !current.usuario || !current.token) return existing; try { const response = await fetch(`${WORKER_URL}/profile/session`, { method: 'POST', headers: authHeaders(''), body: JSON.stringify({ usuario: current.usuario, token: current.token }) }); const payload = await response.json().catch(() => ({})); const key = String(payload.profileKey || ''); if (response.ok && key) { localStorage.setItem(profileSessionKeyStorage(), key); return key; } } catch (_) {} return ''; };
  const syncProfile = async (profile) => { const current = session() || {}; if (!current.usuario || !current.token2) return; try { const key = await ensureProfileKey(); if (!key) return; const response = await fetch(`${WORKER_URL}/profile`, { method: 'PUT', headers: authHeaders(key), body: JSON.stringify({ photo: profile.photo || '', banner: profile.banner || '', description: profile.description || '', theme: profile.theme || 'sedx', accent: profile.accent, secondary: profile.secondary, bg: profile.bg, foreground: profile.foreground }) }); if (!response.ok) throw new Error('profile sync failed'); } catch (_) { /* A cópia local continua disponível até a próxima sincronização. */ } };
  const persist = (data) => { save(data); void syncProfile(data); };
  const hydrateRemote = async () => { const current = session() || {}; if (!current.usuario || !current.token2) return; try { await ensureProfileKey(); const response = await fetch(`${WORKER_URL}/profile`, { headers: authHeaders() }); const payload = await response.json().catch(() => ({})); if (response.ok && payload.profile) save(payload.profile); } catch (_) {} };
  const applyTheme = (data) => {
    const root = document.documentElement;
    const accent = data.accent || '#ff9f3f'; const secondary = data.secondary || '#d44b2a'; const bg = data.bg || '#120b08'; const foreground = /^#[0-9a-f]{6}$/i.test(String(data.foreground || '')) ? data.foreground : '#f7f7f7';
    root.style.setProperty('--theme-accent', accent); root.style.setProperty('--theme-secondary', secondary); root.style.setProperty('--theme-background', bg);
    root.style.setProperty('--background', bg); root.style.setProperty('--foreground', foreground); root.style.setProperty('--card-foreground', foreground); root.style.setProperty('--muted-strong', foreground); root.style.setProperty('--primary', accent); root.style.setProperty('--primary-strong', secondary);
    root.style.setProperty('--primary-foreground', '#160d07'); root.style.setProperty('--card', `color-mix(in srgb, ${bg} 72%, #ffffff 8%)`); root.style.setProperty('--card-soft', `color-mix(in srgb, ${bg} 62%, #ffffff 12%)`);
    root.style.setProperty('--border', `color-mix(in srgb, ${accent} 38%, #ffffff 10%)`); root.style.setProperty('--border-soft', `color-mix(in srgb, ${accent} 22%, transparent)`);
    root.style.setProperty('--amber', accent); root.style.setProperty('--cyan', accent); root.style.setProperty('--green', accent);
    let textStyle = document.getElementById('sedx-profile-text-color');
    if (!textStyle) { textStyle = document.createElement('style'); textStyle.id = 'sedx-profile-text-color'; document.head.appendChild(textStyle); }
    textStyle.textContent = `body, body * { color: ${foreground} !important; } body *::placeholder { color: ${foreground} !important; opacity: .72; }`;
    document.documentElement.style.backgroundColor = bg; if (document.body) document.body.style.backgroundColor = bg; document.body.dataset.sedxTheme = data.theme || 'sedx';
  };
  const broadcast = (data) => {
    window.dispatchEvent(new CustomEvent('sedx-profile-updated', { detail: data }));
    const name = document.querySelector('.topbar-user span')?.textContent?.trim() || 'Aluno'; const letters = initials(name);
    document.querySelectorAll('.user-avatar,.message-avatar.user-avatar').forEach((node) => { node.innerHTML = data.photo ? `<img src="${String(data.photo).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" alt="Foto do perfil">` : letters; });
    document.querySelectorAll('.topbar-user .avatar').forEach((node) => { if (data.photo) node.innerHTML = `<img src="${String(data.photo).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" alt="Foto do perfil">`; });
  };
  const initials = (name) => String(name || 'Aluno').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'AL';
  const currentName = () => document.querySelector('.topbar-user span')?.textContent?.trim() || 'Aluno';
  const readFile = (file, done) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const source = new Image();
      source.onload = () => {
        const maxSide = 900; const scale = Math.min(1, maxSide / source.width, maxSide / source.height);
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(source.width * scale)); canvas.height = Math.max(1, Math.round(source.height * scale));
        const context = canvas.getContext('2d');
        if (!context) { done(String(reader.result)); return; }
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        let quality = 0.82; let value = canvas.toDataURL('image/jpeg', quality);
        while (value.length > 300000 && quality > 0.45) { quality -= 0.08; value = canvas.toDataURL('image/jpeg', quality); }
        done(value);
      };
      source.onerror = () => done(String(reader.result)); source.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };
  function openProfile() {
    if (document.querySelector('.sedx-profile-screen')) return;
    const old = read();
    const name = currentName();
    const screen = document.createElement('section');
    screen.className = 'sedx-profile-screen';
    screen.setAttribute('aria-label', 'Perfil');
    screen.innerHTML = `<div class="sedx-profile-header"><button type="button" class="sedx-profile-close" aria-label="Voltar">←</button><div><span class="sedx-profile-eyebrow">Conta do aluno</span><h1>Perfil</h1></div></div><div class="sedx-profile-content"><section class="sedx-profile-card sedx-profile-hero"><div class="sedx-profile-banner" data-banner></div><button type="button" class="sedx-profile-edit-banner" data-edit-banner>Editar banner</button><input type="file" accept="image/*" data-banner-file hidden><div class="sedx-profile-identity"><button type="button" class="sedx-profile-photo" data-edit-photo aria-label="Editar foto"><span data-initials>${initials(name)}</span><img data-photo alt="Foto do perfil" hidden></button><input type="file" accept="image/*" data-photo-file hidden><div><h2 data-name></h2><p class="sedx-profile-ra-note">Nome da conta</p></div></div></section><section class="sedx-profile-card"><div class="sedx-profile-section-title"><h2>Informações do perfil</h2><span>Personalize como os outros alunos veem você.</span></div><label class="sedx-profile-field"><span>Nome <small>não editável</small></span><input data-name-input readonly></label><label class="sedx-profile-field"><span>Descrição <small>editável</small></span><textarea data-description maxlength="180" placeholder="Conte um pouco sobre você..."></textarea></label><button type="button" class="sedx-profile-save" data-save-description>Salvar descrição</button></section><section class="sedx-profile-card"><div class="sedx-profile-section-title"><h2>Temas</h2><span>Escolha um tema pronto ou crie sua própria combinação.</span></div><div class="sedx-theme-grid" data-presets></div><div class="sedx-custom-theme"><h3>Personalização própria</h3><div class="sedx-color-row"><label>Cor principal<input type="color" data-accent></label><label>Cor secundária<input type="color" data-secondary></label><label>Fundo<input type="color" data-bg></label><label>Cor das letras<input type="color" data-foreground></label></div><button type="button" class="sedx-profile-save" data-save-theme>Aplicar meu tema</button></div></section></div>`;
    document.body.appendChild(screen);
    const banner = screen.querySelector('[data-banner]'); const photo = screen.querySelector('[data-photo]'); const initialsNode = screen.querySelector('[data-initials]');
    screen.querySelector('[data-name]').textContent = name; screen.querySelector('[data-name-input]').value = name; screen.querySelector('[data-description]').value = old.description || '';
    if (old.banner) { banner.style.backgroundImage = `url(${old.banner})`; banner.classList.add('has-image'); }
    if (old.photo) { photo.src = old.photo; photo.hidden = false; initialsNode.hidden = true; }
    const active = presets.find((item) => item.id === old.theme) || presets[0];
    screen.querySelector('[data-accent]').value = old.accent || active.accent; screen.querySelector('[data-secondary]').value = old.secondary || active.secondary; screen.querySelector('[data-bg]').value = old.bg || active.bg; screen.querySelector('[data-foreground]').value = old.foreground || active.foreground || '#f7f7f7';
    screen.querySelector('[data-presets]').innerHTML = presets.map((item) => `<button type="button" class="sedx-theme-option ${active.id === item.id ? 'is-active' : ''}" data-theme="${item.id}" style="--preview-a:${item.accent};--preview-b:${item.secondary};--preview-bg:${item.bg}"><i></i><span>${item.name}</span></button>`).join('');
    screen.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', () => { const item = presets.find((preset) => preset.id === button.dataset.theme); if (!item) return; screen.querySelectorAll('[data-theme]').forEach((el) => el.classList.toggle('is-active', el === button)); screen.querySelector('[data-accent]').value = item.accent; screen.querySelector('[data-secondary]').value = item.secondary; screen.querySelector('[data-bg]').value = item.bg; screen.querySelector('[data-foreground]').value = item.foreground; persist({ ...read(), ...item }); }));
    screen.querySelector('[data-edit-banner]').onclick = () => screen.querySelector('[data-banner-file]').click(); screen.querySelector('[data-banner-file]').onchange = (event) => readFile(event.target.files[0], (value) => { banner.style.backgroundImage = `url(${value})`; banner.classList.add('has-image'); persist({ ...read(), banner: value }); });
    screen.querySelector('[data-edit-photo]').onclick = () => screen.querySelector('[data-photo-file]').click(); screen.querySelector('[data-photo-file]').onchange = (event) => readFile(event.target.files[0], (value) => { photo.src = value; photo.hidden = false; initialsNode.hidden = true; persist({ ...read(), photo: value }); });
    screen.querySelector('[data-save-description]').onclick = (event) => { persist({ ...read(), description: screen.querySelector('[data-description]').value.trim() }); event.currentTarget.textContent = 'Descrição salva'; setTimeout(() => { event.currentTarget.textContent = 'Salvar descrição'; }, 1800); };
    screen.querySelector('[data-save-theme]').onclick = (event) => { persist({ ...read(), theme: 'custom', accent: screen.querySelector('[data-accent]').value, secondary: screen.querySelector('[data-secondary]').value, bg: screen.querySelector('[data-bg]').value, foreground: screen.querySelector('[data-foreground]').value }); event.currentTarget.textContent = 'Tema aplicado'; setTimeout(() => { event.currentTarget.textContent = 'Aplicar meu tema'; }, 1800); };
    const close = () => screen.remove(); screen.querySelector('.sedx-profile-close').onclick = close;
    applyTheme(old);
  }
  document.addEventListener('click', (event) => { if (event.target.closest('.topbar-user, .rail-profile')) { event.preventDefault(); void openProfile(); } });
  window.addEventListener('sedx:credentials', () => { void hydrateRemote(); });
  applyTheme(read());
  void hydrateRemote();
})();
