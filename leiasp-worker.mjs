const SED_TOKEN_URL = 'https://sedintegracoes.educacao.sp.gov.br/saladofuturobffapi/integracoes/Token?plataforma=LeiaSP%2B';
const ELEFANTE_OAUTH_URL = 'https://prod-apiaccounts.elefanteletrado.com.br/api/oauth/seducsp/token';
const ELEFANTE_API = 'https://prod-apistudent.elefanteletrado.com.br';
const CDN = 'https://prod-us.elefanteletrado.com.br/cdn';

function json(data, status = 200, request) {
  const origin = request?.headers.get('Origin') || '';
  const allowed = origin === 'https://sed-gg.vercel.app' ? origin : 'https://sed-gg.vercel.app';
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Accept,X-Token,X-Token2,X-Cd-Usuario,X-Usuario,X-Task-User',
    'Cache-Control': 'no-store', Vary: 'Origin',
  }});
}

function upstreamHeaders(token, origin = 'https://reader.elefanteletrado.com.br') {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json, text/plain, */*', 'Accept-Language': 'pt-BR,pt;q=0.9', Origin: origin, Referer: `${origin}/`, 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36' };
}

async function readJson(response) { const text = await response.text(); try { return text ? JSON.parse(text) : {}; } catch { return { raw: text }; } }

async function authenticate(request, env) {
  const sedApiKey = String(env?.SED_API_KEY || '').trim();
  if (!sedApiKey) throw Object.assign(new Error('Secret SED_API_KEY não configurado no Worker.'), { status: 500 });
  const tokenSed = String(request.headers.get('X-Token') || '').trim();
  if (!tokenSed) throw Object.assign(new Error('Sessão SED ausente. Entre novamente.'), { status: 401 });
  const sedResponse = await fetch(SED_TOKEN_URL, { headers: {
    ...upstreamHeaders(tokenSed, 'https://saladofuturo.educacao.sp.gov.br'),
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    Authorization: `Bearer ${tokenSed}`,
    'Ocp-Apim-Subscription-Key': sedApiKey,
    'X-Product-Name': 'SalaDoFuturo',
    'X-Requested-With': 'com.unixshells.devbrowser',
    'sec-ch-ua': '"Chromium";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  } });
  const sedData = await readJson(sedResponse);
  const jwt = String(sedData?.data || sedData?.token || sedData?.data?.token || '').trim();
  if (!sedResponse.ok || !jwt) throw Object.assign(new Error('Não foi possível autenticar no LeiaSP.'), { status: sedResponse.status >= 500 ? 502 : 401 });
  const oauth = await fetch(`${ELEFANTE_OAUTH_URL}?token=${encodeURIComponent(jwt)}`, { redirect: 'manual', headers: { Accept: 'application/json', 'Accept-Language': 'pt-BR,pt;q=0.9', 'User-Agent': 'Mozilla/5.0' } });
  const location = oauth.headers.get('location') || '';
  let access = '';
  const encoded = new URL(location || 'https://invalid.invalid').searchParams.get('t');
  if (encoded) { try { const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/')); access = JSON.parse(binary).access_token || ''; } catch { /* resposta OAuth inválida */ } }
  if (!access && oauth.ok) { const data = await readJson(oauth); access = data?.access_token || data?.token || ''; }
  if (!access) throw Object.assign(new Error('O LeiaSP não retornou uma sessão válida.'), { status: 502 });
  return access;
}

function coverUrl(value) { const path = String(value || ''); return path.startsWith('/') ? `${CDN}${path}` : path; }
function fileUrl(value) { const path = String(value || ''); return path.startsWith('/') ? `${CDN}${path}` : path; }

async function getBooks(token) {
  const headers = upstreamHeaders(token);
  const [discoverResponse, readingsResponse] = await Promise.all([
    fetch(`${ELEFANTE_API}/v1/library/discover/`, { headers }),
    fetch(`${ELEFANTE_API}/v1/library/book/readings`, { headers }),
  ]);
  const discover = discoverResponse.ok ? await readJson(discoverResponse) : [];
  const readings = readingsResponse.ok ? await readJson(readingsResponse) : [];
  const merged = new Map();
  for (const item of (Array.isArray(discover) ? discover : [])) { const id = item?.Id || item?.BookId; if (id) merged.set(String(id), { ...item }); }
  for (const item of (Array.isArray(readings) ? readings : [])) {
    const id = item?.Id || item?.BookId; if (!id) continue;
    const current = merged.get(String(id)) || {};
    for (const [key, value] of Object.entries(item)) if (value !== null && value !== '' && value !== 0) current[key] = value;
    merged.set(String(id), current);
  }
  return [...merged.values()].map((book) => {
    const total = Number(book.NumberPages || 0), page = Number(book.Page || 0), raw = Number(book.ReadingPercent);
    const progress = raw > 0 ? raw : total > 0 && page > 0 ? Math.round((page / total) * 1000) / 10 : 0;
    return { id: book.Id || book.BookId, title: book.BookTitle || book.Title || 'Sem título', author: Array.isArray(book.Authors) ? book.Authors.join(', ') : book.AuthorStr || book.Author || 'Desconhecido', publisher: book.Publisher || '', total_pages: total, current_page: page, progress, is_complete: Boolean(book.IsReadCompleted || progress >= 100), is_quiz_active: Boolean(book.IsQuizActive), cover_url: coverUrl(book.CoverPageUrl || book.ThumbnailCoverPic || book.CoverUrl || book.CoverThumbnailUrl || book.UrlToCoverImage), epub_url: fileUrl(book.EpubUrl || book.UrlToEpubFile || book.FullUrlToEpubFile || book.EpubFilePath), level: book.LevelName || book.Level || book.Genre || 'Leitura', genre: book.Genre || '', synopsis: book.Synopsis || book.Description || '' };
  }).sort((a, b) => Number(a.is_complete) - Number(b.is_complete) || b.progress - a.progress || a.title.localeCompare(b.title, 'pt-BR'));
}

async function handle(request, url, env) {
  if (request.method === 'OPTIONS') return json({}, 204, request);
  if (request.method !== 'GET') return json({ erro: 'Método não permitido.' }, 405, request);
  try {
    const token = await authenticate(request, env);
    if (url.pathname === '/leiasp/books') return json({ success: true, books: await getBooks(token) }, 200, request);
    if (url.pathname === '/leiasp/stats') {
      const response = await fetch(`${ELEFANTE_API}/v1/student/stats`, { headers: upstreamHeaders(token) });
      return json(response.ok ? { success: true, stats: await readJson(response) } : { success: true, stats: {} }, 200, request);
    }
    const match = url.pathname.match(/^\/leiasp\/book\/(\d+)$/);
    if (match) {
      const response = await fetch(`${ELEFANTE_API}/v1/student/books/${match[1]}`, { headers: upstreamHeaders(token) });
      return json(response.ok ? { success: true, book: await readJson(response) } : { erro: 'Livro não encontrado.' }, response.ok ? 200 : 404, request);
    }
    const quiz = url.pathname.match(/^\/leiasp\/book\/(\d+)\/quiz$/);
    if (quiz) {
      const response = await fetch(`${ELEFANTE_API}/v2/student/books/${quiz[1]}/quiz`, { headers: upstreamHeaders(token) });
      return json(response.ok ? { success: true, quiz: await readJson(response) } : { success: true, quiz: null }, 200, request);
    }
    return null;
  } catch (error) { return json({ erro: error?.message || 'Não foi possível carregar o LeiaSP.' }, error?.status || 502, request); }
}

export async function handleLeiaSPRequest(request, env, url) {
  if (!url.pathname.startsWith('/leiasp')) return null;
  return handle(request, url, env);
}
