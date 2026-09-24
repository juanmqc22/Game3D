// Desvio NFC da raiz para /raposa/ (js/desvio-raposa.js) e a flag que o alimenta
// (raposa/js/salvar.js). Sem partida da Raposa ativa, nada muda para as crianças.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHAVE_ATIVA, VALIDADE_MS, salvar, carregar, limpar, codigoDaUrl } from '../raposa/js/salvar.js';

await import('../js/desvio-raposa.js');
const destino = globalThis.destinoDesvioRaposa;

const T0 = 1_700_000_000_000;
const flag = (expira) => JSON.stringify({ expira });

function storageFalso() {
  const dados = new Map();
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => { dados.set(k, String(v)); },
    removeItem: (k) => { dados.delete(k); },
    tamanho: () => dados.size,
  };
}

describe('destino do desvio', () => {
  test('usa a mesma chave que a Raposa grava', () => {
    assert.equal(globalThis.CHAVE_RAPOSA_ATIVA, CHAVE_ATIVA);
  });

  test('sem partida ativa: não desvia', () => {
    assert.equal(destino('?b=TAT01', null, T0), null);
    assert.equal(destino('?b=TAT01', '', T0), null);
    assert.equal(destino('?b=TAT01', 'lixo{', T0), null);
    assert.equal(destino('?b=TAT01', '{"expira":"amanhã"}', T0), null);
  });

  test('partida vencida: não desvia', () => {
    assert.equal(destino('?b=TAT01', flag(T0), T0), null);
    assert.equal(destino('?b=TAT01', flag(T0 - 1), T0), null);
  });

  test('sem ?b=: não desvia mesmo com partida ativa', () => {
    assert.equal(destino('', flag(T0 + 1000), T0), null);
    assert.equal(destino('?x=1', flag(T0 + 1000), T0), null);
    assert.equal(destino('?b=', flag(T0 + 1000), T0), null);
  });

  test('partida ativa + ?b=: vai para raposa/?b=', () => {
    assert.equal(destino('?b=TAT01', flag(T0 + 1000), T0), 'raposa/?b=TAT01');
    assert.equal(destino('?x=1&b=SAP02', flag(T0 + 1000), T0), 'raposa/?b=SAP02');
  });

  test('no navegador: tira o ?b= da barra e troca de página', async () => {
    const chamadas = [];
    globalThis.window = {
      location: { search: '?b=SAP04', pathname: '/Game3D/', replace: (u) => chamadas.push(['replace', u]) },
      localStorage: { getItem: () => flag(Date.now() + 60_000) },
      history: { replaceState: (_, __, u) => chamadas.push(['replaceState', u]) },
    };
    try {
      await import('../js/desvio-raposa.js?caso=ativo');
    } finally {
      delete globalThis.window;
    }
    assert.deepEqual(chamadas, [['replaceState', '/Game3D/'], ['replace', 'raposa/?b=SAP04']]);
  });

  test('no navegador sem partida: não toca em nada', async () => {
    const chamadas = [];
    globalThis.window = {
      location: { search: '?b=SAP04', pathname: '/', replace: (u) => chamadas.push(u) },
      localStorage: { getItem: () => null },
      history: { replaceState: () => chamadas.push('replaceState') },
    };
    try {
      await import('../js/desvio-raposa.js?caso=inativo');
    } finally {
      delete globalThis.window;
    }
    assert.deepEqual(chamadas, []);
  });

  test('storage bloqueado: não quebra o jogo das crianças', async () => {
    globalThis.window = {
      location: { search: '?b=SAP04', pathname: '/', replace: () => { throw new Error('não devia'); } },
      localStorage: { getItem: () => { throw new Error('bloqueado'); } },
      history: { replaceState: () => {} },
    };
    try {
      await import('../js/desvio-raposa.js?caso=bloqueado');
    } finally {
      delete globalThis.window;
    }
  });

  test('index.html carrega o desvio antes do app, como script clássico', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const desvio = html.search(/<script src="\.\/js\/desvio-raposa\.js\?v=\d+"><\/script>/);
    const app = html.indexOf('<script type="module" src="./js/app.js');
    assert.ok(desvio > 0, 'script do desvio presente');
    assert.ok(desvio < app, 'desvio vem antes do app');
  });
});

describe('flag de partida ativa', () => {
  test('salvar grava a partida e a flag com 6 h de validade', () => {
    const s = storageFalso();
    assert.equal(salvar(s, { x: 1 }, T0), true);
    assert.equal(destino('?b=TAT01', s.getItem(CHAVE_ATIVA), T0 + VALIDADE_MS - 1), 'raposa/?b=TAT01');
    assert.equal(destino('?b=TAT01', s.getItem(CHAVE_ATIVA), T0 + VALIDADE_MS), null);
    assert.deepEqual(carregar(s, T0 + 1000), { x: 1 });
  });

  test('partida velha é descartada e a flag some', () => {
    const s = storageFalso();
    salvar(s, { x: 1 }, T0);
    assert.equal(carregar(s, T0 + VALIDADE_MS), null);
    assert.equal(s.tamanho(), 0);
  });

  test('limpar desliga o desvio', () => {
    const s = storageFalso();
    salvar(s, { x: 1 }, T0);
    limpar(s);
    assert.equal(destino('?b=TAT01', s.getItem(CHAVE_ATIVA), T0), null);
    assert.equal(carregar(s, T0), null);
  });

  test('storage quebrado não derruba nada', () => {
    const erro = () => { throw new Error('x'); };
    const s = { getItem: erro, setItem: erro, removeItem: erro };
    assert.equal(salvar(s, {}, T0), false);
    assert.equal(carregar(s, T0), null);
    limpar(s);
  });

  test('código da URL', () => {
    assert.equal(codigoDaUrl('?b=tat 01'), 'TAT01');
    assert.equal(codigoDaUrl('?b=<script>'), null);
    assert.equal(codigoDaUrl(''), null);
  });
});
