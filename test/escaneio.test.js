// Loop de escaneio de duas peças (Fase 1), sem DOM: storage falso em memória.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAVE_AGUARDANDO, EXPIRACAO_MS, processarChegada, lerAguardando, limparAguardando, guardarAguardando,
} from '../js/escaneio.js';

function storageFalso() {
  const dados = new Map();
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => { dados.set(k, String(v)); },
    removeItem: (k) => { dados.delete(k); },
    tamanho: () => dados.size,
  };
}

function storageQuebrado() {
  const erro = () => { throw new Error('storage bloqueado'); };
  return { getItem: erro, setItem: erro, removeItem: erro };
}

const T0 = 1_700_000_000_000;

describe('processarChegada', () => {
  test('sem ?b=: tela inicial normal, nada gravado', () => {
    const s = storageFalso();
    assert.deepEqual(processarChegada(null, s, T0), { tipo: 'sem-codigo' });
    assert.deepEqual(processarChegada(undefined, s, T0), { tipo: 'sem-codigo' });
    assert.equal(s.tamanho(), 0);
  });

  test('fluxo feliz: TAT01 aguarda, SAP04 inicia Couraça vs Salta', () => {
    const s = storageFalso();
    const r1 = processarChegada('TAT01', s, T0);
    assert.equal(r1.tipo, 'aguardando');
    assert.equal(r1.criatura.nome, 'Couraça');
    assert.deepEqual(lerAguardando(s, T0 + 1000), { codigo: 'TAT01', em: T0 });

    const r2 = processarChegada('SAP04', s, T0 + 60_000);
    assert.equal(r2.tipo, 'partida');
    assert.deepEqual(r2.criaturas.map((c) => c.nome), ['Couraça', 'Salta']);
    assert.equal(lerAguardando(s, T0 + 60_000), null, 'estado limpo depois da partida');
    assert.equal(s.tamanho(), 0);
  });

  test('código em minúsculas e com espaço funciona igual', () => {
    const s = storageFalso();
    processarChegada('tat 01', s, T0);
    assert.equal(lerAguardando(s, T0).codigo, 'TAT01');
    assert.equal(processarChegada(' sap04 ', s, T0).tipo, 'partida');
  });

  test('código repetido: não inicia espelhada, continua aguardando o mesmo', () => {
    const s = storageFalso();
    processarChegada('TAT01', s, T0);
    const r = processarChegada('tat01', s, T0 + 5000);
    assert.equal(r.tipo, 'repetido');
    assert.equal(r.criatura.codigo, 'TAT01');
    assert.deepEqual(lerAguardando(s, T0 + 5000), { codigo: 'TAT01', em: T0 }, 'timestamp original é mantido');
    // depois do repetido, outro código ainda inicia a partida
    assert.equal(processarChegada('SAP02', s, T0 + 6000).tipo, 'partida');
  });

  test('expiração: depois de 10 minutos o próximo scan vira Jogador 1 de novo', () => {
    const s = storageFalso();
    processarChegada('TAT01', s, T0);
    assert.equal(lerAguardando(s, T0 + EXPIRACAO_MS - 1).codigo, 'TAT01', 'ainda vale um instante antes');
    const r = processarChegada('SAP04', s, T0 + EXPIRACAO_MS);
    assert.equal(r.tipo, 'aguardando');
    assert.equal(r.criatura.codigo, 'SAP04');
    assert.deepEqual(lerAguardando(s, T0 + EXPIRACAO_MS), { codigo: 'SAP04', em: T0 + EXPIRACAO_MS });
  });

  test('expiração com o mesmo código: vira Jogador 1 de novo (não é "repetido")', () => {
    const s = storageFalso();
    processarChegada('TAT01', s, T0);
    assert.equal(processarChegada('TAT01', s, T0 + EXPIRACAO_MS + 1).tipo, 'aguardando');
  });

  test('código inválido: erro, nada gravado, espera anterior intacta', () => {
    const s = storageFalso();
    const r = processarChegada('XYZ99', s, T0);
    assert.deepEqual(r, { tipo: 'invalido', codigo: 'XYZ99' });
    assert.equal(s.tamanho(), 0);

    processarChegada('TAT01', s, T0);
    assert.equal(processarChegada('abc', s, T0 + 1).tipo, 'invalido');
    assert.equal(lerAguardando(s, T0 + 1).codigo, 'TAT01');
    assert.equal(processarChegada('', s, T0 + 1).tipo, 'invalido');
  });

  test('storage bloqueado: não quebra, cada scan vira Jogador 1', () => {
    const s = storageQuebrado();
    assert.equal(processarChegada('TAT01', s, T0).tipo, 'aguardando');
    assert.equal(processarChegada('SAP04', s, T0).tipo, 'aguardando');
    assert.equal(lerAguardando(s, T0), null);
    assert.doesNotThrow(() => limparAguardando(s));
    assert.equal(guardarAguardando(s, 'TAT01', T0), false);
  });
});

describe('lerAguardando', () => {
  test('lixo no storage é descartado e limpo', () => {
    for (const lixo of ['{', '[]', '{"codigo":"XYZ99","em":1}', '{"codigo":"TAT01"}', '{"codigo":"TAT01","em":"x"}']) {
      const s = storageFalso();
      s.setItem(CHAVE_AGUARDANDO, lixo);
      assert.equal(lerAguardando(s, T0), null, lixo);
      assert.equal(s.tamanho(), 0, `não limpou: ${lixo}`);
    }
  });
  test('timestamp no futuro (relógio mudou) é descartado', () => {
    const s = storageFalso();
    guardarAguardando(s, 'TAT01', T0 + 1000);
    assert.equal(lerAguardando(s, T0), null);
  });
  test('limparAguardando zera o estado', () => {
    const s = storageFalso();
    guardarAguardando(s, 'TAT01', T0);
    limparAguardando(s);
    assert.equal(lerAguardando(s, T0), null);
  });
});
