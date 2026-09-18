// Coleção (Fase 2), sem DOM: storage falso em memória.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CRIATURAS } from '../js/criaturas.js';
import {
  CHAVE_COLECAO, lerColecao, registrarDescoberta, registrarPartida, contarDescobertos, estaDescoberta, sortearOponente,
} from '../js/colecao.js';

function storageFalso() {
  const dados = new Map();
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => { dados.set(k, String(v)); },
    removeItem: (k) => { dados.delete(k); },
    bruto: (k) => dados.get(k),
  };
}
const AGORA = new Date('2026-09-18T12:00:00.000Z');

describe('registrarDescoberta', () => {
  test('primeira vez: nova = true, gravado com descobertoEm ISO e contadores zerados', () => {
    const s = storageFalso();
    const r = registrarDescoberta(s, 'TAT01', AGORA);
    assert.equal(r.nova, true);
    assert.equal(r.criatura.nome, 'Couraça');
    assert.deepEqual(JSON.parse(s.bruto(CHAVE_COLECAO)), {
      TAT01: { descobertoEm: '2026-09-18T12:00:00.000Z', partidas: 0, vitorias: 0 },
    });
  });
  test('segunda vez: nova = false e a data original é mantida', () => {
    const s = storageFalso();
    registrarDescoberta(s, 'TAT01', AGORA);
    const r = registrarDescoberta(s, 'tat01', new Date('2026-10-01T00:00:00.000Z'));
    assert.equal(r.nova, false);
    assert.equal(lerColecao(s).TAT01.descobertoEm, '2026-09-18T12:00:00.000Z');
  });
  test('código inválido nunca entra na coleção', () => {
    const s = storageFalso();
    const r = registrarDescoberta(s, 'XYZ99', AGORA);
    assert.equal(r.nova, false);
    assert.equal(r.criatura, null);
    assert.equal(s.bruto(CHAVE_COLECAO), undefined);
    assert.equal(registrarDescoberta(s, undefined, AGORA).criatura, null);
  });
  test('contador de descobertos', () => {
    const s = storageFalso();
    assert.equal(contarDescobertos(lerColecao(s)), 0);
    registrarDescoberta(s, 'TAT01', AGORA);
    registrarDescoberta(s, 'SAP04', AGORA);
    registrarDescoberta(s, 'SAP04', AGORA);
    const c = lerColecao(s);
    assert.equal(contarDescobertos(c), 2);
    assert.equal(estaDescoberta(c, 'SAP04'), true);
    assert.equal(estaDescoberta(c, 'TAT03'), false);
    assert.equal(estaDescoberta(null, 'TAT01'), false);
  });
});

describe('lerColecao', () => {
  test('storage vazio = {}', () => {
    assert.deepEqual(lerColecao(storageFalso()), {});
  });
  test('lixo é descartado item a item', () => {
    const s = storageFalso();
    s.setItem(CHAVE_COLECAO, JSON.stringify({
      TAT01: { descobertoEm: 'x', partidas: -1, vitorias: 'a' },
      XYZ99: { descobertoEm: 'x', partidas: 0, vitorias: 0 },
      SAP02: null,
    }));
    assert.deepEqual(lerColecao(s), { TAT01: { descobertoEm: 'x', partidas: 0, vitorias: 0 } });
    s.setItem(CHAVE_COLECAO, '[1,2]');
    assert.deepEqual(lerColecao(s), {});
    s.setItem(CHAVE_COLECAO, '{{');
    assert.equal(lerColecao(s), null);
  });
  test('storage bloqueado = null e registrar não quebra', () => {
    const erro = () => { throw new Error('bloqueado'); };
    const s = { getItem: erro, setItem: erro, removeItem: erro };
    assert.equal(lerColecao(s), null);
    assert.equal(registrarDescoberta(s, 'TAT01', AGORA).nova, true);
    assert.equal(registrarPartida(s, ['TAT01', 'SAP04'], 0), false);
  });
});

describe('registrarPartida', () => {
  test('conta partida para os dois e vitória só para o vencedor', () => {
    const s = storageFalso();
    registrarDescoberta(s, 'TAT01', AGORA);
    registrarDescoberta(s, 'SAP04', AGORA);
    assert.equal(registrarPartida(s, ['TAT01', 'SAP04'], 1), true);
    const c = lerColecao(s);
    assert.deepEqual([c.TAT01.partidas, c.TAT01.vitorias, c.SAP04.partidas, c.SAP04.vitorias], [1, 0, 1, 1]);
  });
  test('quem não está na coleção não é contado (nem criado)', () => {
    const s = storageFalso();
    registrarDescoberta(s, 'TAT01', AGORA);
    assert.equal(registrarPartida(s, ['TAT01', 'SAP04'], 0), true);
    const c = lerColecao(s);
    assert.equal(c.SAP04, undefined);
    assert.equal(c.TAT01.vitorias, 1);
    assert.equal(registrarPartida(s, ['SAP02', 'SAP04'], 0), false);
  });
  test('empate e partida espelhada não contam', () => {
    const s = storageFalso();
    registrarDescoberta(s, 'TAT01', AGORA);
    registrarDescoberta(s, 'SAP04', AGORA);
    assert.equal(registrarPartida(s, ['TAT01', 'SAP04'], null), false);
    assert.equal(registrarPartida(s, ['TAT01', 'TAT01'], 0), false);
    assert.equal(lerColecao(s).TAT01.partidas, 0);
  });
});

describe('sortearOponente', () => {
  test('cobre todas as criaturas e nunca sai da lista', () => {
    const vistos = new Set();
    for (let i = 0; i < CRIATURAS.length; i++) vistos.add(sortearOponente(() => i / CRIATURAS.length).codigo);
    assert.equal(vistos.size, CRIATURAS.length);
    assert.equal(sortearOponente(() => 0.999999).codigo, CRIATURAS.at(-1).codigo);
    assert.equal(sortearOponente(() => 1).codigo, CRIATURAS.at(-1).codigo);
    assert.equal(sortearOponente(() => 0).codigo, CRIATURAS[0].codigo);
  });
});
