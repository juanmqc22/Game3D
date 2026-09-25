// Coleção (Fase 2), sem DOM: storage falso em memória.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CRIATURAS, SERIE_ATUAL } from '../js/criaturas.js';
import {
  CHAVE_COLECAO, lerColecao, registrarDescoberta, registrarPartida, contarDescobertos, estaDescoberta,
  lerFundador, contarDaSerie,
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

describe('selo de Fundador (?b=TAT01&f=3)', () => {
  test('lerFundador: só inteiro de 1 a 10', () => {
    for (const [entrada, esperado] of [['1', 1], ['3', 3], ['10', 10], [' 7 ', 7], [5, 5]]) {
      assert.equal(lerFundador(entrada), esperado, String(entrada));
    }
    for (const lixo of ['0', '11', '-1', '3.5', '03', 'abc', '', ' ', null, undefined, 3.5, 0, 11, '1e1', '0x3']) {
      assert.equal(lerFundador(lixo), null, String(lixo));
    }
  });
  test('primeira leitura com f válido: a carta guarda o número', () => {
    const s = storageFalso();
    const r = registrarDescoberta(s, 'TAT01', AGORA, '3');
    assert.equal(r.nova, true);
    assert.equal(r.ganhouSelo, true);
    assert.deepEqual(JSON.parse(s.bruto(CHAVE_COLECAO)).TAT01,
      { descobertoEm: '2026-09-18T12:00:00.000Z', partidas: 0, vitorias: 0, fundador: 3 });
    assert.equal(lerColecao(s).TAT01.fundador, 3);
  });
  test('f inválido é ignorado: registra normal, sem selo', () => {
    for (const f of ['0', '11', 'x', '2.5']) {
      const s = storageFalso();
      const r = registrarDescoberta(s, 'SAP02', AGORA, f);
      assert.equal(r.nova, true);
      assert.equal(r.ganhouSelo, false);
      assert.equal('fundador' in lerColecao(s).SAP02, false, f);
    }
  });
  test('sem f nada muda (formato antigo intacto)', () => {
    const s = storageFalso();
    registrarDescoberta(s, 'TAT01', AGORA);
    assert.deepEqual(lerColecao(s).TAT01, { descobertoEm: '2026-09-18T12:00:00.000Z', partidas: 0, vitorias: 0 });
  });
  test('já registrado sem f ganha o selo quando chega com f, e guarda partidas e data', () => {
    const s = storageFalso();
    registrarDescoberta(s, 'TAT01', AGORA);
    registrarDescoberta(s, 'SAP02', AGORA);
    registrarPartida(s, ['TAT01', 'SAP02'], 0);
    const r = registrarDescoberta(s, 'tat01', new Date('2026-10-01T00:00:00.000Z'), '7');
    assert.equal(r.nova, false);
    assert.equal(r.ganhouSelo, true);
    assert.deepEqual(lerColecao(s).TAT01, { descobertoEm: '2026-09-18T12:00:00.000Z', partidas: 1, vitorias: 1, fundador: 7 });
  });
  test('quem já tem selo fica com o primeiro número', () => {
    const s = storageFalso();
    registrarDescoberta(s, 'TAT01', AGORA, '3');
    const r = registrarDescoberta(s, 'TAT01', AGORA, '9');
    assert.equal(r.ganhouSelo, false);
    assert.equal(lerColecao(s).TAT01.fundador, 3);
  });
  test('fundador inválido gravado no storage é descartado na leitura', () => {
    const s = storageFalso();
    s.setItem(CHAVE_COLECAO, JSON.stringify({ TAT01: { descobertoEm: 'x', partidas: 0, vitorias: 0, fundador: 42 } }));
    assert.deepEqual(lerColecao(s), { TAT01: { descobertoEm: 'x', partidas: 0, vitorias: 0 } });
  });
});

describe('série disponível', () => {
  test('a Série 1 são os fundadores Couraça e Bocão', () => {
    assert.equal(SERIE_ATUAL, 1);
    assert.deepEqual(CRIATURAS.filter((c) => c.serie === SERIE_ATUAL).map((c) => c.codigo), ['TAT01', 'SAP02']);
  });
  test('contador conta só a série pedida', () => {
    const s = storageFalso();
    assert.deepEqual(contarDaSerie(lerColecao(s), 1), { descobertos: 0, total: 2 });
    registrarDescoberta(s, 'TAT01', AGORA);
    registrarDescoberta(s, 'SAP04', AGORA); // série 2 não entra na conta da série 1
    assert.deepEqual(contarDaSerie(lerColecao(s), 1), { descobertos: 1, total: 2 });
    registrarDescoberta(s, 'SAP02', AGORA);
    assert.deepEqual(contarDaSerie(lerColecao(s), 1), { descobertos: 2, total: 2 });
    assert.deepEqual(contarDaSerie(lerColecao(s), 2), { descobertos: 1, total: 4 });
    assert.deepEqual(contarDaSerie(null, 1), { descobertos: 0, total: 2 });
  });
});
