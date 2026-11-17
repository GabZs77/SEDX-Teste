const ALLOWED = new Set(['/login', '/resume', '/dashboard', '/chat/messages', '/chat/upload', '/groq-chat', '/feedback', '/feedback/mine', '/feedback/message', '/feedback/ticket', '/profile', '/redacoes', '/redacao', '/essays']);
const ORIGINS = new Set(['https://sed-gg.vercel.app', 'http://localhost:8081', 'http://localhost:19006']);

function cors(request) {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.has(origin) ? origin : '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Authorization, Content-Type, X-Requested-With, X-Token, X-Token2, X-Api-Key, X-Cd-Usuario, X-Task-User, X-Usuario, X-Avatar-Url',
    'Access-Control-Expose-Headers': 'Content-Type, X-Worker-Build',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}
function json(data, status, request) {
  const headers = new Headers(cors(request));
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { status, headers });
}
function allowedPath(pathname) {
  if (ALLOWED.has(pathname)) return true;
  return [...ALLOWED].some(path => path.endsWith('/') && pathname.startsWith(path));
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
    if (!allowedPath(url.pathname)) return json({ erro: 'Rota não disponível no aplicativo móvel.' }, 404, request);
    const headers = new Headers();
    for (const name of ['Accept', 'Content-Type', 'Authorization', 'X-Token', 'X-Token2', 'X-Api-Key', 'X-Cd-Usuario', 'X-Task-User', 'X-Usuario', 'X-Avatar-Url', 'X-Captcha-Token', 'X-Captcha-Session', 'X-Captcha-Cookie', 'X-Admin-User']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set('Origin', 'https://sed-gg.vercel.app');
    headers.set('X-Sedx-Client', 'native-expo');
    let body;
    if (request.method !== 'GET' && request.method !== 'HEAD') body = await request.arrayBuffer();
    const proxied = new Request(`https://sedx-core.internal${url.pathname}${url.search}`, { method: request.method, headers, body });
    const upstream = await env.SEDX_CORE.fetch(proxied);
    const responseHeaders = new Headers(cors(request));
    responseHeaders.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json; charset=utf-8');
    const build = upstream.headers.get('X-Worker-Build');
    if (build) responseHeaders.set('X-Worker-Build', build);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  },
};
