// Loop de escaneio de duas peças (Fase 1), sem DOM: storage falso em memória.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAVE_AGUARDANDO, EXPIRACAO_MS, processarChegada, lerAguardando, limparAguardando, guardarAguardando,
  codigoDaUrl, fundadorDaUrl, lerRegistrosNfc,
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

// iPhone: cada leitura de NFC/QR abre uma aba nova. A espera vive no
// localStorage, que é um só para todas as abas da mesma origem.
describe('abas diferentes compartilhando o localStorage (iPhone)', () => {
  // Cada "aba" tem o seu sessionStorage, mas todas veem o mesmo localStorage.
  function navegador() {
    const local = storageFalso();
    return { novaAba: () => ({ localStorage: local, sessionStorage: storageFalso() }), local };
  }

  test('SAP02 numa aba, TAT01 em outra: a segunda aba inicia a partida', () => {
    const nav = navegador();
    const aba1 = nav.novaAba();
    const aba2 = nav.novaAba();
    assert.equal(processarChegada('SAP02', aba1.localStorage, T0).tipo, 'aguardando');
    const r = processarChegada('TAT01', aba2.localStorage, T0 + 20_000);
    assert.equal(r.tipo, 'partida');
    assert.deepEqual(r.criaturas.map((c) => c.codigo), ['SAP02', 'TAT01'], 'quem chegou primeiro é o Jogador 1');
  });

  test('com sessionStorage (o bug), a segunda aba virava Jogador 1 de novo', () => {
    const nav = navegador();
    const aba1 = nav.novaAba();
    const aba2 = nav.novaAba();
    processarChegada('SAP02', aba1.sessionStorage, T0);
    assert.equal(processarChegada('TAT01', aba2.sessionStorage, T0 + 20_000).tipo, 'aguardando');
  });

  test('a partida limpa a espera: a terceira leitura começa um novo ciclo', () => {
    const nav = navegador();
    processarChegada('SAP02', nav.novaAba().localStorage, T0);
    processarChegada('TAT01', nav.novaAba().localStorage, T0 + 1000);
    assert.equal(nav.local.tamanho(), 0, 'nada fica esperando depois da partida');
    const r3 = processarChegada('TAT01', nav.novaAba().localStorage, T0 + 2000);
    assert.equal(r3.tipo, 'aguardando');
    assert.equal(r3.criatura.codigo, 'TAT01');
    const r4 = processarChegada('SAP02', nav.novaAba().localStorage, T0 + 3000);
    assert.equal(r4.tipo, 'partida');
    assert.deepEqual(r4.criaturas.map((c) => c.codigo), ['TAT01', 'SAP02']);
  });

  test('a mesma peça lida em outra aba é "repetido", não partida espelhada', () => {
    const nav = navegador();
    processarChegada('TAT01', nav.novaAba().localStorage, T0);
    assert.equal(processarChegada('TAT01', nav.novaAba().localStorage, T0 + 1000).tipo, 'repetido');
  });
});

describe('codigoDaUrl / fundadorDaUrl', () => {
  test('endereço completo da etiqueta', () => {
    assert.equal(codigoDaUrl('https://juanmqc22.github.io/Game3D/?b=TAT01'), 'TAT01');
    assert.equal(codigoDaUrl('https://juanmqc22.github.io/Game3D/?b=TAT01&f=3'), 'TAT01');
    assert.equal(codigoDaUrl('https://x.io/Game3D/index.html?x=1&b=sap02#topo'), 'sap02');
  });
  test('endereço relativo ou só a busca', () => {
    assert.equal(codigoDaUrl('/?b=SAP02'), 'SAP02');
    assert.equal(codigoDaUrl('?b=TAT%2001'), 'TAT 01');
    assert.equal(codigoDaUrl('?b=tat+01'), 'tat 01');
  });
  test('sem ?b= ou vazio: null', () => {
    assert.equal(codigoDaUrl('https://juanmqc22.github.io/Game3D/'), null);
    assert.equal(codigoDaUrl('https://x.io/?bb=TAT01'), null);
    assert.equal(codigoDaUrl('?b='), null);
    assert.equal(codigoDaUrl(null), null);
    assert.equal(codigoDaUrl(42), null);
  });
  test('%xx quebrado não lança', () => {
    assert.equal(codigoDaUrl('?b=TAT%ZZ'), 'TAT%ZZ');
  });
  test('fundador vem cru (quem valida é a coleção)', () => {
    assert.equal(fundadorDaUrl('https://x.io/?b=TAT01&f=3'), '3');
    assert.equal(fundadorDaUrl('https://x.io/?b=TAT01'), null);
    assert.equal(fundadorDaUrl(undefined), null);
  });
});

describe('lerRegistrosNfc', () => {
  const dv = (texto) => {
    const bytes = new TextEncoder().encode(texto);
    return new DataView(bytes.buffer);
  };

  test('registro de URL com ?b= e &f=', () => {
    const r = lerRegistrosNfc([{ recordType: 'url', data: dv('https://juanmqc22.github.io/Game3D/?b=TAT01&f=3') }]);
    assert.deepEqual(r, { codigo: 'TAT01', fundador: '3' });
  });
  test('pula registros sem endereço e acha o primeiro com ?b=', () => {
    const r = lerRegistrosNfc([
      { recordType: 'mime', data: dv('{}') },
      { recordType: 'url', data: dv('https://exemplo.com/') },
      { recordType: 'absolute-url', data: dv('https://juanmqc22.github.io/Game3D/?b=SAP02') },
      { recordType: 'url', data: dv('https://juanmqc22.github.io/Game3D/?b=TAT01') },
    ]);
    assert.deepEqual(r, { codigo: 'SAP02', fundador: null });
  });
  test('registro de texto com o endereço também serve', () => {
    const r = lerRegistrosNfc([{ recordType: 'text', encoding: 'utf-8', data: dv('?b=SAP02') }]);
    assert.equal(r.codigo, 'SAP02');
  });
  test('etiqueta vazia ou sem endereço: null', () => {
    assert.equal(lerRegistrosNfc([]), null);
    assert.equal(lerRegistrosNfc(undefined), null);
    assert.equal(lerRegistrosNfc([{ recordType: 'empty' }]), null);
    assert.equal(lerRegistrosNfc([{ recordType: 'url', data: null }]), null);
  });
  test('o código lido segue o mesmo fluxo da chegada por URL', () => {
    const s = storageFalso();
    processarChegada('TAT01', s, T0);
    const lido = lerRegistrosNfc([{ recordType: 'url', data: dv('https://juanmqc22.github.io/Game3D/?b=tat01') }]);
    assert.equal(processarChegada(lido.codigo, s, T0 + 1000).tipo, 'repetido');
  });
});
