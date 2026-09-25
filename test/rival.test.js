// Rato do Mato (RAT00): o rival de treino de quem só tem uma peça.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CRIATURAS, ESPECIES, RIVAL, SERIE_ATUAL, buscarCriatura, buscarCriaturaOuRival } from '../js/criaturas.js';
import { MODOS, danoMaximoDoModo } from '../js/regras.js';
import { processarChegada } from '../js/escaneio.js';
import {
  CHAVE_COLECAO, lerColecao, registrarDescoberta, contarDaSerie, listaDeEscolha,
} from '../js/colecao.js';
import { arteDaCriatura } from '../js/arte.js';
import { simularContraRival, RIVAL_MIN, RIVAL_MAX } from '../scripts/balanceamento.js';

function storageFalso(inicial = {}) {
  const dados = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
  };
}

describe('dados do Rato', () => {
  test('RAT00 é rival, da espécie rato, com números inteiros válidos', () => {
    assert.equal(RIVAL.codigo, 'RAT00');
    assert.equal(RIVAL.nome, 'Rato do Mato');
    assert.equal(RIVAL.rival, true);
    assert.ok(ESPECIES[RIVAL.especie]);
    assert.equal(RIVAL.especie, 'rato');
    for (const n of [RIVAL.vida, RIVAL.forca, RIVAL.especial.dano]) assert.ok(Number.isInteger(n) && n > 0);
    assert.equal(RIVAL.especial.nome, 'Mordida Rápida');
    assert.ok(`${RIVAL.especial.nome}: ${RIVAL.especial.texto}`.length <= 64);
  });
  test('números medidos: vida 14, força 2, Mordida 3', () => {
    assert.deepEqual([RIVAL.vida, RIVAL.forca, RIVAL.especial.dano], [14, 2, 3]);
  });
  test('não está no elenco de peças nem é achado como peça', () => {
    assert.ok(!CRIATURAS.some((c) => c.codigo === 'RAT00' || c.rival));
    assert.equal(buscarCriatura('RAT00'), null);
  });
  test('buscarCriaturaOuRival acha o Rato e as peças', () => {
    assert.equal(buscarCriaturaOuRival(' rat 00 '), RIVAL);
    assert.equal(buscarCriaturaOuRival('tat01').codigo, 'TAT01');
    assert.equal(buscarCriaturaOuRival('XYZ99'), null);
    assert.equal(buscarCriaturaOuRival(null), null);
  });
  test('tem arte', () => {
    assert.match(arteDaCriatura('RAT00').src, /RAT00-256\.webp$/);
  });
});

// O mesmo guarda-corpo de test/criaturas.test.js, com o Rato como alvo e como atacante.
describe('golpe máximo com o Rato', () => {
  for (const modo of MODOS) {
    for (const c of CRIATURAS) {
      test(`${modo}: ${c.codigo} -> RAT00 <= 60% da vida`, () => {
        assert.ok(danoMaximoDoModo(modo, c, RIVAL) * 5 <= RIVAL.vida * 3);
      });
      test(`${modo}: RAT00 -> ${c.codigo} <= 60% da vida`, () => {
        assert.ok(danoMaximoDoModo(modo, RIVAL, c) * 5 <= c.vida * 3);
      });
    }
  }
});

describe('fundadores contra o Rato: vencem entre 65% e 75%', () => {
  const fundadores = CRIATURAS.filter((c) => c.serie === SERIE_ATUAL);
  for (const [nome, faces] of [['justo', [25, 25, 25, 25]], ['medido', [11, 21, 31, 32]]]) {
    test(`Rolar, faces ${nome}`, () => {
      for (const l of simularContraRival(fundadores, RIVAL, { partidas: 4000, faces, semente: 1 })) {
        assert.ok(l.taxa >= RIVAL_MIN && l.taxa <= RIVAL_MAX, `${l.criatura.codigo}: ${(l.taxa * 100).toFixed(1)}%`);
        assert.equal(l.noLimite, 0);
      }
    });
  }
});

describe('o Rato não entra em nenhum caminho de peça', () => {
  test('?b=RAT00 é código inválido e não vira espera', () => {
    const s = storageFalso();
    assert.equal(processarChegada('RAT00', s).tipo, 'invalido');
    assert.equal(s.getItem('bichinhos:aguardando'), null);
  });
  test('não entra na coleção nem no contador', () => {
    const s = storageFalso({ [CHAVE_COLECAO]: JSON.stringify({ RAT00: { partidas: 1, vitorias: 1 } }) });
    assert.deepEqual(lerColecao(s), {});
    assert.equal(registrarDescoberta(s, 'RAT00').criatura, null);
    assert.deepEqual(contarDaSerie(lerColecao(s), SERIE_ATUAL), { descobertos: 0, total: 2 });
  });
});

describe('lista manual (listaDeEscolha)', () => {
  const tipos = (lista) => lista.itens.map((i) => (i.tipo === 'em-breve' ? `em-breve:${i.serie}` : `${i.tipo}:${i.criatura.codigo}`));

  test('sem nada escaneado: só o Rato', () => {
    const lista = listaDeEscolha({});
    assert.equal(lista.temPeca, false);
    assert.deepEqual(tipos(lista), ['rival:RAT00']);
  });
  test('storage indisponível vale como coleção vazia', () => {
    assert.equal(listaDeEscolha(null).temPeca, false);
  });
  test('escaneados, depois o Rato, depois a Série 2 travada', () => {
    const lista = listaDeEscolha({ TAT01: { partidas: 0, vitorias: 0 } });
    assert.equal(lista.temPeca, true);
    assert.deepEqual(tipos(lista), ['bicho:TAT01', 'rival:RAT00', 'em-breve:2', 'em-breve:2', 'em-breve:2', 'em-breve:2']);
  });
  test('série futura já escaneada aparece aberta, e sai das travadas', () => {
    const lista = listaDeEscolha({ SAP04: { partidas: 0, vitorias: 0 } });
    assert.deepEqual(tipos(lista), ['bicho:SAP04', 'rival:RAT00', 'em-breve:2', 'em-breve:2', 'em-breve:2']);
  });
  test('item travado não carrega nome nem números', () => {
    const travado = listaDeEscolha({ TAT01: {} }).itens.at(-1);
    assert.deepEqual(Object.keys(travado).sort(), ['serie', 'tipo']);
  });
  test('comRival = false tira o Rato (não existe Rato contra Rato)', () => {
    assert.ok(!tipos(listaDeEscolha({ TAT01: {} }, { comRival: false })).includes('rival:RAT00'));
  });
});
