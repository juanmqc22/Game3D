// Apoio para testes que precisam de um navegador de verdade: sobe um servidor
// estático do repositório e abre um Chrome/Edge headless pelo DevTools
// Protocol (sem dependência: o WebSocket e o fetch são do próprio Node).
// Não é um teste (não termina em .test.js).
//
// O caminho do navegador pode vir em NAVEGADOR=/caminho/do/chrome. Sem
// navegador instalado, acharNavegador() devolve null e o teste se pula.

import http from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json',
};
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

export function acharNavegador() {
  const candidatos = [
    process.env.NAVEGADOR,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);
  for (const c of candidatos) if (existsSync(c)) return c;
  for (const nome of ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    try {
      return execFileSync('which', [nome], { encoding: 'utf8' }).trim() || null;
    } catch {
      // não tem esse
    }
  }
  return null;
}

export function servir() {
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    try {
      const dados = await readFile(path.join(RAIZ, p));
      res.writeHead(200, { 'content-type': TIPOS[path.extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(dados);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ srv, base: `http://127.0.0.1:${srv.address().port}/` })));
}

// Abre o navegador e devolve uma página com: js(expr), ir(url), tocar(seletor),
// movimentoReduzido(bool), fechar(), erros (exceções do console).
export async function abrirPagina(executavel, { largura = 360, altura = 640 } = {}) {
  const perfil = await mkdtemp(path.join(tmpdir(), 'arena-teste-'));
  const proc = spawn(executavel, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank',
  ], { stdio: 'ignore' });
  let porta = null;
  for (let i = 0; i < 100 && !porta; i++) {
    await espera(100);
    try {
      porta = (await readFile(path.join(perfil, 'DevToolsActivePort'), 'utf8')).split('\n')[0].trim();
    } catch {
      // ainda subindo
    }
  }
  if (!porta) throw new Error('o navegador não abriu a porta de depuração');
  let alvo = null;
  for (let i = 0; i < 50 && !alvo; i++) {
    try {
      alvo = (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).find((t) => t.type === 'page');
    } catch {
      // ainda subindo
    }
    if (!alvo) await espera(100);
  }
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((ok, erro) => { ws.addEventListener('open', ok); ws.addEventListener('error', erro); });
  let id = 0;
  const pendentes = new Map();
  const erros = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pendentes.has(m.id)) { pendentes.get(m.id)(m); pendentes.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  });
  const cmd = (method, params = {}) => new Promise((ok, erro) => {
    const n = ++id;
    pendentes.set(n, (m) => (m.error ? erro(new Error(`${method}: ${m.error.message}`)) : ok(m.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  await cmd('Runtime.enable');
  await cmd('Page.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: true });

  const pagina = {
    erros,
    espera,
    async js(expr) {
      const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    async ir(url) {
      await cmd('Page.navigate', { url });
      for (let i = 0; i < 60; i++) {
        await espera(50);
        if (await pagina.js(`document.readyState === 'complete' && [...document.querySelectorAll('.tela')].some((t) => !t.hidden)`).catch(() => false)) break;
      }
      await espera(120);
    },
    async tocar(seletor) {
      const ok = await pagina.js(`(() => { const e = document.querySelector(${JSON.stringify(seletor)}); if (!e) return false; e.click(); return true; })()`);
      if (!ok) throw new Error(`não achei ${seletor}`);
      await espera(40);
    },
    async movimentoReduzido(sim) {
      await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: sim ? 'reduce' : 'no-preference' }] });
    },
    async fechar() {
      try { await cmd('Browser.close'); } catch { /* já fechou */ }
      proc.kill();
      await espera(200);
      await rm(perfil, { recursive: true, force: true }).catch(() => {});
    },
  };
  return pagina;
}
