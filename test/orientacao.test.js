// Orientação dos textos: tudo se lê de um lado só, na orientação normal do
// celular — com UMA exceção: na tela de fim, a metade do Jogador 1 (em cima)
// vem girada 180° para quem está do outro lado da mesa (contra o Rato, não).
// Percorre todas as telas e estados num navegador de verdade e falha se algum
// elemento com texto visível tiver rotação diferente da esperada (somando o
// giro de todos os ancestrais). Sem Chrome/Edge na máquina, a parte do
// navegador se pula; a checagem estática do CSS roda sempre.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { acharNavegador, servir, abrirPagina } from './navegador.js';

const css = readFileSync(new URL('../css/estilo.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('orientação: checagem estática', () => {
  test('rotate(180deg) só na metade de cima da tela de fim', () => {
    const regras = [...css.matchAll(/([^{}]+)\{[^{}]*rotate\(\s*180deg\s*\)[^{}]*\}/g)].map((m) => m[1].trim());
    assert.deepEqual(regras, ['.fim-metade-0 .fim-conteudo']);
    assert.doesNotMatch(html, /rotate\(\s*180deg\s*\)/);
  });
  test('sem as cópias de cabeça para baixo de antes', () => {
    for (const velho of ['lutar-cima', 'rodada-cima', 'qg-titulo-cima', 'cn-cima', 'fe-cima']) {
      assert.ok(!html.includes(velho), velho);
    }
  });
});

// Giro de cada elemento com texto visível, somando os ancestrais. Esperado:
// 180° na metade de cima do fim (fora do jogo contra o Rato), 0° no resto.
const GIRADOS = `(() => {
  const giro = (el) => {
    let m = new DOMMatrix();
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const t = getComputedStyle(e).transform;
      if (t && t !== 'none') m = new DOMMatrix(t).multiply(m);
    }
    return Math.atan2(m.b, m.a) * 180 / Math.PI;
  };
  const fora = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!['SCRIPT', 'STYLE', 'TEMPLATE'].includes(el.tagName)
      && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || el.closest('[hidden]')) continue;
      const g = giro(el);
      const esperado = el.closest('#tela-fim:not(.contra-rival) #fim-metade-0') ? 180 : 0;
      const erro = Math.abs((((g - esperado) % 360) + 540) % 360 - 180);
      if (erro > 0.5) fora.push(el.textContent.trim().slice(0, 24) + ' (' + g.toFixed(1) + '°)');
    }
  }
  return fora;
})()`;

const executavel = acharNavegador();

describe('orientação: auditoria no navegador (todas as telas e estados)', { skip: executavel ? false : 'sem Chrome/Edge (defina NAVEGADOR=...)', timeout: 120000 }, () => {
  let srv;
  let base;
  let p;
  const visitados = [];
  before(async () => {
    ({ srv, base } = await servir());
    p = await abrirPagina(executavel);
  });
  after(async () => {
    await p?.fechar();
    srv?.close();
  });

  const conferir = async (estado) => {
    visitados.push(estado);
    assert.deepEqual(await p.js(GIRADOS), [], `texto girado em: ${estado}`);
  };
  const telaAtual = () => p.js(`[...document.querySelectorAll('.tela')].find((t) => !t.hidden)?.id`);
  const partida = async (modo, a, b) => {
    await p.js(`localStorage.setItem('bichinhos:colecao', JSON.stringify({ TAT01: { fundador: 3 }, SAP02: {} }))`);
    await p.ir(base);
    await p.tocar(`#inicio-modos [data-modo="${modo}"]`);
    await p.tocar(`#lista-criaturas [data-codigo="${a}"]`);
    await p.tocar('#btn-escolha-confirmar');
    await p.tocar(`#lista-criaturas [data-codigo="${b}"]`);
    await p.tocar('#btn-escolha-confirmar');
    await p.tocar('#tela-vs'); // pula o VS
    assert.equal(await telaAtual(), 'tela-batalha');
  };
  const rodada = async (s0, s1, mira = false) => {
    await p.tocar(`#metade-0 .simbolo[data-simbolo="${s0}"]`);
    await p.tocar(`#metade-1 .simbolo[data-simbolo="${s1}"]`);
    if (mira) {
      await p.tocar('#metade-0 .opcao-alvo[data-acertou="sim"]');
      await p.tocar('#metade-1 .opcao-alvo[data-acertou="nao"]');
    }
  };
  const esperarFim = async () => {
    for (let i = 0; i < 80; i++) {
      if (await p.js(`document.getElementById('tela-batalha').classList.contains('fase-final')`)) return;
      await p.espera(50);
    }
  };

  test('telas de fora da batalha', async () => {
    await p.movimentoReduzido(true);
    await p.ir(base);
    await p.js('localStorage.clear()');
    await p.ir(base);
    await conferir('início');
    await p.tocar('#inicio-modos [data-modo="ROLAR"]');
    await conferir('escolha sem nada escaneado');
    await p.ir(`${base}?b=TAT01&f=3`);
    await conferir('desbloqueio com Fundador');
    await p.tocar('#btn-desbloqueio-continuar');
    await conferir('espera da segunda peça');
    await p.tocar('#btn-espera-sem-peca');
    await conferir('não tenho a segunda peça');
    await p.ir(`${base}?b=SAP02`);
    await p.tocar('#btn-desbloqueio-continuar');
    assert.equal(await telaAtual(), 'tela-vs');
    await conferir('VS (movimento reduzido)');
    await p.tocar('#tela-vs');
    await conferir('escolha do modo');
    await p.ir(base);
    await p.tocar('#btn-colecao');
    await conferir('coleção');
  });

  test('VS animado', async () => {
    await p.movimentoReduzido(false);
    await p.ir(`${base}?b=TAT01`);
    await p.ir(`${base}?b=SAP02`);
    for (const ms of [100, 600, 400]) {
      await p.espera(ms);
      await conferir(`VS animado +${ms}ms`);
    }
  });

  // A última rodada leva sozinha à tela de fim (nocaute; sem botão).
  const jogarAteOFim = async (s0, s1) => {
    for (let i = 0; i < 12; i++) {
      if (i) await p.tocar('#metade-0 .palco-luta');
      await rodada(s0, s1);
      await esperarFim();
      if (await p.js(`document.getElementById('tela-batalha').classList.contains('fase-morte')`)) break;
    }
    for (let i = 0; i < 80 && await telaAtual() !== 'tela-fim'; i++) await p.espera(50);
    assert.equal(await telaAtual(), 'tela-fim', 'a tela de fim devia entrar sozinha');
  };

  test('batalha: Rolar, Mira, Batalha, contra o Rato e fim', async () => {
    await p.movimentoReduzido(true);
    await partida('ROLAR', 'TAT01', 'SAP02');
    await conferir('Rolar antes');
    await rodada('ATAQUE', 'TROPECO');
    await esperarFim();
    await conferir('Rolar: TROPEÇOU!');
    await p.tocar('#metade-0 .palco-luta');
    await rodada('DEFESA', 'DEFESA');
    await esperarFim();
    await conferir('Rolar: CHOQUE!');

    await partida('MIRA', 'SAP02', 'TAT01');
    await rodada('ESPECIAL', 'ATAQUE', true);
    await esperarFim();
    await conferir('Mira: especial');

    await partida('ARENA', 'TAT01', 'SAP02');
    await conferir('Batalha: Quem ganhou?');
    await p.tocar('#qg-lado-1 .qg-opcao[data-ganhou="FORA"]');
    await esperarFim();
    await conferir('Batalha: resultado');

    await partida('ROLAR', 'SAP02', 'RAT00');
    await conferir('contra o Rato');
    await jogarAteOFim('DEFESA', 'ATAQUE');
    await conferir('fim contra o Rato (nada girado)');

    await partida('ROLAR', 'TAT01', 'SAP02');
    await jogarAteOFim('ATAQUE', 'DEFESA');
    await conferir('fim de dois jogadores (metade de cima girada)');
    assert.equal(await p.js(`document.getElementById('fim-metade-0').dataset.papel`), 'venceu');
    assert.equal(await p.js(`document.getElementById('fim-metade-1').dataset.papel`), 'perdeu');
  });

  test('nocaute animado leva ao fim sozinho', async () => {
    await p.movimentoReduzido(false);
    await partida('ROLAR', 'SAP02', 'TAT01');
    await jogarAteOFim('ATAQUE', 'DEFESA');
    await p.espera(700);
    await conferir('fim animado');
    assert.deepEqual(p.erros, []);
  });

  test('cena do especial no meio da animação', async () => {
    await p.movimentoReduzido(false);
    await partida('ROLAR', 'TAT01', 'SAP02');
    await rodada('ATAQUE', 'ESPECIAL');
    await p.espera(1500 + 600);
    assert.equal(await p.js(`document.getElementById('cena-especial').hidden`), false, 'a cena devia estar no ar');
    await conferir('cena da Língua Chicote');
    await p.espera(1200);
    await conferir('luta depois da cena');
    await esperarFim();
    assert.deepEqual(p.erros, []);
    assert.ok(visitados.length >= 20, `visitou ${visitados.length} estados`);
  });
});
