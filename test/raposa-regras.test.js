// Raposa na Fazenda — lógica pura (raposa/js/regras.js).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIAS, META, ESTRELAS_INICIAIS, PEDIDOS_ATIVOS, ENCOMENDAS_INICIAIS, ROUBO_SECRETO, EVENTOS_NOITE,
  colheita, diferencaSecreta, especieDoCodigo, criarPartida, modoDaPartida, ordemDoDia,
  declarar, duvidar, podeDuvidar, confessar, cumprirEncomenda, sugerirEntregas, entregar, trocar,
  sortearNoite, acaoDaRaposa, apurarVotos, fimDoDia, resultado, totalItens, cestaVazia,
} from '../raposa/js/regras.js';

const DOIS = [{ nome: 'Ana', codigo: 'SAP02' }, { nome: 'Beto', codigo: 'TAT01' }];
const cesta = (x) => ({ ...cestaVazia(), ...x });

describe('colheita', () => {
  test('cada face rende o combinado', () => {
    assert.deepEqual(colheita('ESPECIAL'), cesta({ ovo: 1 }));
    assert.deepEqual(colheita('ATAQUE'), cesta({ milho: 2 }));
    assert.deepEqual(colheita('DEFESA'), cesta({ leite: 2 }));
    assert.deepEqual(colheita('TROPECO'), cesta({}));
  });

  test('sapo ganha +1 leite só quando colhe leite', () => {
    assert.deepEqual(colheita('DEFESA', 'sapo'), cesta({ leite: 3 }));
    assert.deepEqual(colheita('ATAQUE', 'sapo'), cesta({ milho: 2 }));
    assert.deepEqual(colheita('DEFESA', 'tatu'), cesta({ leite: 2 }));
  });

  test('face inválida é erro', () => {
    assert.throws(() => colheita('PULO'));
  });

  test('espécie sai do prefixo do código', () => {
    assert.equal(especieDoCodigo('tat 05'), 'tatu');
    assert.equal(especieDoCodigo('SAP06'), 'sapo');
    assert.equal(especieDoCodigo('XYZ01'), null);
    assert.equal(especieDoCodigo(null), null);
  });

  test('celeiro secreto: só o que foi colhido e não declarado', () => {
    assert.deepEqual(diferencaSecreta(colheita('DEFESA'), colheita('ATAQUE')), cesta({ leite: 2 }));
    assert.deepEqual(diferencaSecreta(colheita('TROPECO'), colheita('ESPECIAL')), cesta({}));
    assert.deepEqual(diferencaSecreta(colheita('DEFESA', 'sapo'), colheita('DEFESA', 'sapo')), cesta({}));
  });
});

describe('montagem', () => {
  test('2 a 6 jogadores; modo muda em 4', () => {
    assert.throws(() => criarPartida([{ nome: 'Só' }]));
    assert.throws(() => criarPartida(Array.from({ length: 7 }, (_, i) => ({ nome: `J${i}` }))));
    assert.equal(modoDaPartida(2), 'app');
    assert.equal(modoDaPartida(3), 'app');
    assert.equal(modoDaPartida(4), 'traidor');
    assert.equal(modoDaPartida(6), 'traidor');
  });

  test('estado inicial', () => {
    const e = criarPartida(DOIS, 42);
    assert.equal(e.dia, 1);
    assert.equal(e.modo, 'app');
    assert.equal(e.raposa, null);
    assert.equal(e.meta, META[2]);
    assert.equal(e.pedidos.length, PEDIDOS_ATIVOS);
    assert.equal(e.jogadores[0].especie, 'sapo');
    assert.equal(e.jogadores[1].especie, 'tatu');
    for (const j of e.jogadores) {
      assert.equal(j.estrelas, ESTRELAS_INICIAIS);
      assert.equal(j.encomendas.length, ENCOMENDAS_INICIAIS);
      assert.equal(totalItens(j.secreto), 0);
    }
  });

  test('mesma semente, mesma partida (recarregar não muda nada)', () => {
    assert.deepEqual(criarPartida(DOIS, 7), criarPartida(DOIS, 7));
    const a = sortearNoite(criarPartida(DOIS, 7));
    const b = sortearNoite(JSON.parse(JSON.stringify(criarPartida(DOIS, 7))));
    assert.deepEqual(a, b);
  });

  test('modo traidor sorteia uma Raposa entre os jogadores', () => {
    const e = criarPartida(['A', 'B', 'C', 'D'].map((nome) => ({ nome })), 3);
    assert.equal(e.modo, 'traidor');
    assert.ok(e.raposa >= 0 && e.raposa < 4);
  });

  test('quem começa gira a cada dia', () => {
    let e = criarPartida([{ nome: 'A' }, { nome: 'B' }, { nome: 'C' }], 1);
    assert.deepEqual(ordemDoDia(e), [0, 1, 2]);
    e = fimDoDia(e);
    assert.deepEqual(ordemDoDia(e), [1, 2, 0]);
  });
});

describe('declaração, Duvido e confissão', () => {
  test('a declaração vai para o celeiro da vila (com talento)', () => {
    const e = declarar(criarPartida(DOIS, 1), 0, 'DEFESA');
    assert.deepEqual(e.vila, cesta({ leite: 3 }));
  });

  test('funções não mudam o estado recebido', () => {
    const e0 = criarPartida(DOIS, 1);
    const copia = structuredClone(e0);
    declarar(e0, 0, 'ATAQUE');
    assert.deepEqual(e0, copia);
  });

  test('não declara duas vezes', () => {
    const e = declarar(criarPartida(DOIS, 1), 0, 'ATAQUE');
    assert.throws(() => declarar(e, 0, 'DEFESA'));
  });

  test('Duvido em mentiroso: perde a colheita e a estrela vai para quem duvidou', () => {
    let e = declarar(criarPartida(DOIS, 1), 1, 'ATAQUE');
    e = duvidar(e, 1, 0, 'DEFESA');
    assert.deepEqual(e.vila, cesta({}));
    assert.equal(e.jogadores[1].estrelas, ESTRELAS_INICIAIS - 1);
    assert.equal(e.jogadores[0].estrelas, ESTRELAS_INICIAIS + 1);
    assert.equal(e.rodada.desafios[1].mentiu, true);
    // Mostrou a peça: não tem confissão e nada vai para o secreto.
    const r = confessar(e, 1, 'DEFESA');
    assert.deepEqual(r.estado.jogadores[1].secreto, cesta({}));
  });

  test('Duvido em quem falou a verdade: quem duvidou perde 1 estrela', () => {
    let e = declarar(criarPartida(DOIS, 1), 1, 'ESPECIAL');
    e = duvidar(e, 1, 0, 'ESPECIAL');
    assert.deepEqual(e.vila, cesta({ ovo: 1 }));
    assert.equal(e.jogadores[0].estrelas, ESTRELAS_INICIAIS - 1);
    assert.equal(e.jogadores[1].estrelas, ESTRELAS_INICIAIS);
    assert.equal(e.rodada.desafios[1].mentiu, false);
  });

  test('mentiroso sem estrela não dá estrela; ninguém fica negativo', () => {
    let e = criarPartida(DOIS, 1);
    e.jogadores[1].estrelas = 0;
    e = declarar(e, 1, 'ATAQUE');
    e = duvidar(e, 1, 0, 'TROPECO');
    assert.equal(e.jogadores[1].estrelas, 0);
    assert.equal(e.jogadores[0].estrelas, ESTRELAS_INICIAIS);
  });

  test('sem estrela não dá para duvidar', () => {
    const e = declarar(criarPartida(DOIS, 1), 1, 'ATAQUE');
    e.jogadores[0].estrelas = 0;
    assert.equal(podeDuvidar(e, 0), false);
    assert.throws(() => duvidar(e, 1, 0, 'ATAQUE'));
  });

  test('não duvida de si mesmo nem duas vezes', () => {
    const e = declarar(criarPartida(DOIS, 1), 0, 'ATAQUE');
    assert.throws(() => duvidar(e, 0, 0, 'ATAQUE'));
    const f = duvidar(e, 0, 1, 'ATAQUE');
    assert.throws(() => duvidar(f, 0, 1, 'ATAQUE'));
  });

  test('confissão: escondeu leite declarando milho → vila tem milho, secreto tem leite', () => {
    let e = declarar(criarPartida(DOIS, 1), 1, 'ATAQUE');
    const r = confessar(e, 1, 'DEFESA');
    e = r.estado;
    assert.deepEqual(r.ganho, cesta({ leite: 2 }));
    assert.deepEqual(e.vila, cesta({ milho: 2 }));
    assert.deepEqual(e.jogadores[1].secreto, cesta({ leite: 2 }));
  });

  test('declarar a mais é permitido: a vila fica com o declarado e o secreto não muda', () => {
    let e = declarar(criarPartida(DOIS, 1), 0, 'ESPECIAL');
    e = confessar(e, 0, 'TROPECO').estado;
    assert.deepEqual(e.vila, cesta({ ovo: 1 }));
    assert.deepEqual(e.jogadores[0].secreto, cesta({}));
  });

  test('confessar duas vezes não duplica', () => {
    let e = declarar(criarPartida(DOIS, 1), 1, 'TROPECO');
    e = confessar(e, 1, 'ATAQUE').estado;
    e = confessar(e, 1, 'ATAQUE').estado;
    assert.deepEqual(e.jogadores[1].secreto, cesta({ milho: 2 }));
  });
});

describe('encomendas', () => {
  test('cumpre com o celeiro secreto, soma pontos e recebe uma nova', () => {
    let e = criarPartida(DOIS, 1);
    const enc = e.jogadores[0].encomendas[0];
    e.jogadores[0].secreto = { ovo: 5, milho: 5, leite: 5 };
    e = cumprirEncomenda(e, 0, enc.id);
    const j = e.jogadores[0];
    assert.equal(j.pontos, enc.pontos);
    assert.equal(j.cumpridas, 1);
    assert.equal(j.encomendas.length, ENCOMENDAS_INICIAIS);
    assert.ok(!j.encomendas.some((x) => x.id === enc.id));
    assert.equal(totalItens(j.secreto), 15 - totalItens(enc.itens));
  });

  test('sem itens suficientes não cumpre', () => {
    const e = criarPartida(DOIS, 1);
    assert.throws(() => cumprirEncomenda(e, 0, e.jogadores[0].encomendas[0].id));
  });
});

describe('entrega', () => {
  function comPedidos(pedidos, vila) {
    const e = criarPartida(DOIS, 1);
    e.pedidos = pedidos;
    e.vila = cesta(vila);
    return e;
  }

  test('sugere o de prazo mais curto quando não dá para os dois', () => {
    const e = comPedidos([
      { id: 90, itens: { milho: 2 }, prazo: 3, falso: false },
      { id: 91, itens: { milho: 2 }, prazo: 1, falso: false },
    ], { milho: 3 });
    assert.deepEqual(sugerirEntregas(e), [91]);
  });

  test('sugere os dois quando dá', () => {
    const e = comPedidos([
      { id: 90, itens: { milho: 2 }, prazo: 3, falso: false },
      { id: 91, itens: { leite: 1, ovo: 1 }, prazo: 2, falso: false },
    ], { milho: 2, leite: 1, ovo: 1 });
    assert.deepEqual(sugerirEntregas(e), [91, 90]);
  });

  test('entregar gasta o celeiro e conta', () => {
    const e = comPedidos([{ id: 90, itens: { milho: 2 }, prazo: 3, falso: false }], { milho: 3 });
    const r = entregar(e, 90);
    assert.equal(r.falso, false);
    assert.equal(r.estado.entregues, 1);
    assert.deepEqual(r.estado.vila, cesta({ milho: 1 }));
    assert.equal(r.estado.pedidos.length, 0);
  });

  test('pedido falso: os itens somem e não conta', () => {
    const e = comPedidos([{ id: 90, itens: { milho: 2 }, prazo: 3, falso: true }], { milho: 2 });
    const r = entregar(e, 90);
    assert.equal(r.falso, true);
    assert.equal(r.estado.entregues, 0);
    assert.deepEqual(r.estado.vila, cesta({}));
  });

  test('sem itens não entrega', () => {
    const e = comPedidos([{ id: 90, itens: { milho: 2 }, prazo: 3, falso: false }], { milho: 1 });
    assert.throws(() => entregar(e, 90));
  });
});

describe('mercado', () => {
  test('troca entre celeiros secretos', () => {
    let e = criarPartida(DOIS, 1);
    e.jogadores[0].secreto = cesta({ ovo: 1 });
    e.jogadores[1].secreto = cesta({ milho: 2 });
    e = trocar(e, 0, 1, { ovo: 1 }, { milho: 2 });
    assert.deepEqual(e.jogadores[0].secreto, cesta({ milho: 2 }));
    assert.deepEqual(e.jogadores[1].secreto, cesta({ ovo: 1 }));
  });

  test('presente (um lado vazio) vale; troca vazia, consigo ou sem itens não', () => {
    const e = criarPartida(DOIS, 1);
    e.jogadores[0].secreto = cesta({ ovo: 1 });
    assert.deepEqual(trocar(e, 0, 1, { ovo: 1 }, {}).jogadores[1].secreto, cesta({ ovo: 1 }));
    assert.throws(() => trocar(e, 0, 1, {}, {}));
    assert.throws(() => trocar(e, 0, 0, { ovo: 1 }, {}));
    assert.throws(() => trocar(e, 0, 1, { ovo: 2 }, {}));
  });
});

describe('noite (Raposa do app)', () => {
  function aplicar(tipo, prepara) {
    const pesos = EVENTOS_NOITE.map((ev) => ev.peso);
    EVENTOS_NOITE.forEach((ev) => { ev.peso = ev.tipo === tipo ? 1 : 0; });
    try {
      const e = criarPartida(DOIS, 5);
      prepara?.(e);
      return sortearNoite(e);
    } finally {
      EVENTOS_NOITE.forEach((ev, k) => { ev.peso = pesos[k]; });
    }
  }

  test('rouba 1 item do celeiro da vila', () => {
    const e = aplicar('roubaVila', (x) => { x.vila = cesta({ milho: 3 }); });
    assert.equal(e.noite.tipo, 'roubaVila');
    assert.deepEqual(e.vila, cesta({ milho: 2 }));
  });

  test('vila vazia: a Raposa só ronda', () => {
    assert.equal(aplicar('roubaVila').noite.tipo, 'rondou');
  });

  test('rouba do secreto de quem tem mais', () => {
    const e = aplicar('roubaSecreto', (x) => {
      x.jogadores[0].secreto = cesta({ leite: 4 });
      x.jogadores[1].secreto = cesta({ ovo: 1 });
    });
    assert.equal(e.noite.tipo, 'roubaSecreto');
    assert.equal(e.noite.alvo, 0);
    assert.deepEqual(e.jogadores[0].secreto, cesta({ leite: 4 - ROUBO_SECRETO }));
  });

  test('tatu é imune ao roubo noturno', () => {
    const e = aplicar('roubaSecreto', (x) => { x.jogadores[1].secreto = cesta({ ovo: 3 }); });
    assert.equal(e.noite.tipo, 'tatuImune');
    assert.deepEqual(e.jogadores[1].secreto, cesta({ ovo: 3 }));
  });

  test('pedido falso marca o próximo pedido que chegar', () => {
    let e = aplicar('pedidoFalso');
    assert.equal(e.noite.tipo, 'pedidoFalso');
    e.pedidos = [e.pedidos[0]];
    e.pedidos[0].prazo = 5;
    e = fimDoDia(e);
    assert.equal(e.pedidos.length, 2);
    assert.equal(e.pedidos[1].falso, true);
    assert.equal(e.pedidos[0].falso, false);
  });

  test('noite tranquila não muda nada', () => {
    const e = aplicar('tranquila', (x) => { x.vila = cesta({ ovo: 1 }); });
    assert.equal(e.noite.tipo, 'tranquila');
    assert.deepEqual(e.vila, cesta({ ovo: 1 }));
  });
});

describe('fim do dia e da estação', () => {
  test('prazo anda; pedido vencido é falha e é reposto', () => {
    let e = criarPartida(DOIS, 1);
    e.pedidos[0].prazo = 1;
    e.pedidos[1].prazo = 3;
    const id0 = e.pedidos[0].id;
    e = fimDoDia(e);
    assert.equal(e.falhas, 1);
    assert.equal(e.dia, 2);
    assert.equal(e.fase, 'caminhao');
    assert.equal(e.pedidos.length, PEDIDOS_ATIVOS);
    assert.ok(!e.pedidos.some((p) => p.id === id0));
    assert.equal(e.pedidos[0].prazo, 2);
  });

  test('pedido falso vencido não conta como falha', () => {
    let e = criarPartida(DOIS, 1);
    e.pedidos[0].prazo = 1;
    e.pedidos[0].falso = true;
    e.pedidos[1].prazo = 3;
    e = fimDoDia(e);
    assert.equal(e.falhas, 0);
  });

  test(`depois de ${DIAS} dias a partida acaba`, () => {
    let e = criarPartida(DOIS, 1);
    for (let d = 0; d < DIAS; d++) e = fimDoDia(e);
    assert.equal(e.fase, 'fim');
    assert.equal(e.dia, DIAS + 1);
  });

  test('vila vence com a meta; ganha quem tem mais encomendas + estrelas', () => {
    const e = criarPartida(DOIS, 1);
    e.entregues = e.meta;
    e.jogadores[0].pontos = 4;
    e.jogadores[1].estrelas = 5;
    const r = resultado(e);
    assert.equal(r.vilaVenceu, true);
    assert.deepEqual(r.vencedores, [0]);
    assert.equal(r.ranking[0].pontos, 4 + ESTRELAS_INICIAIS);
  });

  test('empate de pontos: os dois vencem', () => {
    const e = criarPartida(DOIS, 1);
    e.entregues = e.meta;
    assert.deepEqual(resultado(e).vencedores, [0, 1]);
  });

  test('sem a meta todos perdem', () => {
    const e = criarPartida(DOIS, 1);
    e.entregues = e.meta - 1;
    const r = resultado(e);
    assert.equal(r.vilaVenceu, false);
    assert.deepEqual(r.vencedores, []);
  });
});

describe('modo traidor (4–6)', () => {
  const QUATRO = ['Ana', 'Beto', 'Caio', 'Duda'].map((nome, i) => ({ nome, codigo: i === 3 ? 'TAT01' : 'SAP02' }));

  test('a Raposa rouba do jogador escolhido; tatu é imune', () => {
    let e = criarPartida(QUATRO, 9);
    e.raposa = 0;
    e.jogadores[1].secreto = cesta({ milho: 2 });
    e.jogadores[3].secreto = cesta({ milho: 2 });
    const r = acaoDaRaposa(e, 1);
    assert.equal(r.noite.tipo, 'roubaSecreto');
    assert.equal(totalItens(r.jogadores[1].secreto), 1);
    assert.equal(acaoDaRaposa(e, 3).noite.tipo, 'tatuImune');
    assert.throws(() => acaoDaRaposa(e, 0));
  });

  test('a Raposa pode roubar do celeiro da vila', () => {
    const e = criarPartida(QUATRO, 9);
    e.vila = cesta({ ovo: 2 });
    assert.equal(totalItens(acaoDaRaposa(e, 'vila').vila), 1);
  });

  test('assembleia expulsa só com mais da metade', () => {
    let e = criarPartida(QUATRO, 9);
    e.raposa = 2;
    assert.equal(apurarVotos(e, { 0: 2, 1: 2, 2: 0, 3: null }).assembleia.expulso, null);
    e = apurarVotos(e, { 0: 2, 1: 2, 2: 0, 3: 2 });
    assert.equal(e.assembleia.expulso, 2);
    assert.equal(e.assembleia.eraRaposa, true);
    assert.deepEqual(e.expulsos, [2]);
    // Expulso não declara mais e a Raposa expulsa não rouba.
    assert.ok(!ordemDoDia(e).includes(2));
    assert.equal(acaoDaRaposa(e, 'vila').noite.tipo, 'tranquila');
  });

  test('vila só vence com a meta E a Raposa expulsa', () => {
    const e = criarPartida(QUATRO, 9);
    e.raposa = 1;
    e.entregues = e.meta;
    assert.equal(resultado(e).vilaVenceu, false);
    e.expulsos = [1];
    const r = resultado(e);
    assert.equal(r.vilaVenceu, true);
    assert.ok(!r.ranking.some((x) => x.idx === 1), 'a Raposa não entra no ranking');
  });
});
