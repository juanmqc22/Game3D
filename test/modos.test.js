// Testes dos modos ARENA e MIRA. Criaturas de teste próprias (como em regras.test.js).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATAQUE, DEFESA, ESPECIAL, TROPECO, ROLAR, ARENA, MIRA, MODOS,
  BONUS_FORA, BONUS_GIROU, BONUS_ACERTO, BONUS_TROPECO, CHOQUE_DANO, GIROU, FORA,
  estadoInicial, resolverRodada, resolverRodadaArena, resolverRodadaMira, resolverRodadaModo, danoMaximoDoModo,
} from '../js/regras.js';

function criatura(nome, vida, forca, especial) {
  return {
    codigo: nome.toUpperCase(), nome, especie: 'teste', vida, forca,
    especial: { nome: 'Especial', dano: 1, cura: 0, roubo: false, escudo: false, recuo: 0, texto: '', ...especial },
  };
}

const FORTE = criatura('Forte', 20, 4, { dano: 8 });
const ESPINHO = criatura('Espinho', 20, 3, { dano: 5 });
const LADRAO = criatura('Ladrao', 20, 3, { dano: 3, cura: 3, roubo: true });
const BOMBA = criatura('Bomba', 20, 3, { dano: 6, recuo: 2 });

function partida(a, b, ajustes = [{}, {}]) {
  const estado = estadoInicial(a, b);
  estado.jogadores = estado.jogadores.map((j, i) => ({ ...j, ...ajustes[i] }));
  return estado;
}
const vidas = (e) => e.jogadores.map((j) => j.vida);

describe('modo ARENA (Batalha: quem ganhou e como)', () => {
  test('as constantes pedidas: girou +1, fora +2', () => {
    assert.equal(BONUS_GIROU, 1);
    assert.equal(BONUS_FORA, 2);
  });
  test('girou mais: o vencedor causa força + BONUS_GIROU', () => {
    const { estado, resumo } = resolverRodadaArena(partida(ESPINHO, FORTE), 0, GIROU);
    assert.equal(resumo.modo, ARENA);
    assert.equal(resumo.vencedor, 0);
    assert.equal(resumo.jeito, GIROU);
    assert.equal(resumo.danoBase, 3);
    assert.equal(resumo.bonusGirou, BONUS_GIROU);
    assert.equal(resumo.bonusFora, 0);
    assert.equal(resumo.dano, 3 + BONUS_GIROU);
    assert.deepEqual(vidas(estado), [20, 20 - 3 - BONUS_GIROU]);
  });
  test('jogou pra fora: o vencedor causa força + BONUS_FORA', () => {
    const { estado, resumo } = resolverRodadaArena(partida(ESPINHO, FORTE), 1, FORA);
    assert.equal(resumo.vencedor, 1);
    assert.equal(resumo.bonusFora, BONUS_FORA);
    assert.equal(resumo.dano, 4 + BONUS_FORA);
    assert.deepEqual(vidas(estado), [20 - 4 - BONUS_FORA, 20]);
  });
  test('especial nunca ativa e não há face nem tropeço', () => {
    const { resumo } = resolverRodadaArena(partida(BOMBA, LADRAO), 0, FORA);
    assert.deepEqual(resumo.simbolos, [null, null]);
    assert.equal(resumo.simboloVencedor, null);
    assert.equal(resumo.recuo, 0);
    assert.equal(resumo.cura, 0);
    assert.equal(resumo.escudoAtivado, false);
    assert.equal(resumo.bonusTropeco, 0);
  });
  test('empate: Choque, cada um perde CHOQUE_DANO', () => {
    const { estado, resumo } = resolverRodadaArena(partida(ESPINHO, FORTE), null);
    assert.equal(resumo.choque, true);
    assert.equal(resumo.vencedor, null);
    assert.deepEqual(resumo.danoChoque, [CHOQUE_DANO, CHOQUE_DANO]);
    assert.deepEqual(vidas(estado), [20 - CHOQUE_DANO, 20 - CHOQUE_DANO]);
    assert.equal(estado.rodada, 1);
  });
  test('escudo anula o golpe e é consumido', () => {
    const { estado, resumo } = resolverRodadaArena(partida(ESPINHO, FORTE, [{}, { escudo: true }]), 0, FORA);
    assert.equal(resumo.bloqueado, true);
    assert.equal(resumo.danoPrevisto, 3 + BONUS_FORA);
    assert.deepEqual(vidas(estado), [20, 20]);
    assert.equal(estado.jogadores[1].escudo, false);
  });
  test('escudo anula o choque do empate e é consumido', () => {
    const { estado, resumo } = resolverRodadaArena(partida(ESPINHO, FORTE, [{ escudo: true }, {}]), null);
    assert.deepEqual(resumo.choqueBloqueado, [true, false]);
    assert.deepEqual(vidas(estado), [20, 20 - CHOQUE_DANO]);
    assert.equal(estado.jogadores[0].escudo, false);
  });
  test('o golpe pode zerar e terminar a partida; choque zerando os dois = empate', () => {
    const golpe = resolverRodadaArena(partida(ESPINHO, FORTE, [{}, { vida: 3 + BONUS_GIROU }]), 0, GIROU);
    assert.deepEqual(golpe.fim, { terminou: true, vencedor: 0 });
    const choque = resolverRodadaArena(partida(ESPINHO, FORTE, [{ vida: 1 }, { vida: 1 }]), null);
    assert.deepEqual(choque.fim, { terminou: true, vencedor: null });
  });
  test('entrada inválida gera erro', () => {
    assert.throws(() => resolverRodadaArena(partida(ESPINHO, FORTE), 2, GIROU));
    assert.throws(() => resolverRodadaArena(partida(ESPINHO, FORTE), 0, 'DENTRO'));
    assert.throws(() => resolverRodadaArena(partida(ESPINHO, FORTE), 0));
  });
  test('porta única: ganhou em um jogador; nenhum = empate; dois = erro', () => {
    const a = resolverRodadaModo(ARENA, partida(ESPINHO, FORTE), [{}, { ganhou: GIROU }]);
    assert.deepEqual(a, resolverRodadaArena(partida(ESPINHO, FORTE), 1, GIROU));
    assert.equal(resolverRodadaModo(ARENA, partida(ESPINHO, FORTE), [{}, {}]).resumo.choque, true);
    assert.throws(() => resolverRodadaModo(ARENA, partida(ESPINHO, FORTE), [{ ganhou: FORA }, { ganhou: GIROU }]));
  });
});

describe('modo MIRA', () => {
  test('vencedor acertou o alvo: +2 no dano', () => {
    const { estado, resumo } = resolverRodadaMira(partida(FORTE, ESPINHO), [true, false], [ATAQUE, DEFESA]);
    assert.equal(resumo.vencedor, 0);
    assert.equal(resumo.bonusAcerto, BONUS_ACERTO);
    assert.equal(resumo.dano, 4 + BONUS_ACERTO);
    assert.deepEqual(vidas(estado), [20, 14]);
    assert.equal(resumo.modo, MIRA);
  });
  test('vencedor errou o alvo: dano pela metade, arredondado para baixo', () => {
    const { resumo } = resolverRodadaMira(partida(ESPINHO, FORTE), [false, true], [ATAQUE, DEFESA]);
    assert.equal(resumo.metade, true);
    assert.equal(resumo.dano, 1); // floor(3 / 2)
    const esp = resolverRodadaMira(partida(ESPINHO, FORTE), [false, false], [ESPECIAL, ATAQUE]);
    assert.equal(esp.resumo.dano, 2); // floor(5 / 2)
  });
  test('errou o alvo com o outro em TROPECO: (forca + 2) / 2', () => {
    const { resumo } = resolverRodadaMira(partida(ESPINHO, FORTE), [false, false], [ATAQUE, TROPECO]);
    assert.equal(resumo.bonusTropeco, BONUS_TROPECO);
    assert.equal(resumo.dano, Math.floor((3 + 2) / 2));
  });
  test('acerto e tropeço não somam: o extra da rodada é no máximo +2', () => {
    const { resumo } = resolverRodadaMira(partida(FORTE, ESPINHO), [true, false], [ESPECIAL, TROPECO]);
    assert.equal(resumo.bonusTropeco, 2);
    assert.equal(resumo.bonusAcerto, 0);
    assert.equal(resumo.dano, 8 + 2);
  });
  test('só o acerto do vencedor importa', () => {
    const { resumo } = resolverRodadaMira(partida(FORTE, ESPINHO), [false, true], [ATAQUE, DEFESA]);
    assert.equal(resumo.metade, true);
    assert.equal(resumo.dano, 2);
  });
  test('empate: só o choque, sem bônus de acerto nem metade por erro', () => {
    const { estado, resumo } = resolverRodadaMira(partida(FORTE, ESPINHO), [true, false], [ATAQUE, ATAQUE]);
    assert.equal(resumo.vencedor, null);
    assert.equal(resumo.dano, 0);
    assert.equal(resumo.bonusAcerto, 0);
    assert.deepEqual(resumo.danoChoque, [1, 1]);
    assert.deepEqual(vidas(estado), [19, 19]);
  });
  test('empate de TROPECO: nada acontece, mesmo com acerto', () => {
    const { estado } = resolverRodadaMira(partida(FORTE, ESPINHO), [true, true], [TROPECO, TROPECO]);
    assert.deepEqual(vidas(estado), [20, 20]);
  });
  test('cura, recuo e escudo não mudam com o alvo', () => {
    const r = resolverRodadaMira(partida(LADRAO, FORTE, [{ vida: 10 }, {}]), [false, true], [ESPECIAL, ATAQUE]);
    assert.equal(r.resumo.dano, 1);
    assert.equal(r.resumo.cura, 3);
    const b = resolverRodadaMira(partida(BOMBA, FORTE), [true, true], [ESPECIAL, ATAQUE]);
    assert.equal(b.resumo.dano, 8);
    assert.equal(b.resumo.recuo, 2);
  });
  test('escudo anula o dano com bônus de acerto', () => {
    const { estado, resumo } = resolverRodadaMira(partida(FORTE, ESPINHO, [{}, { escudo: true }]), [true, false], [ATAQUE, DEFESA]);
    assert.equal(resumo.bloqueado, true);
    assert.equal(resumo.danoPrevisto, 6);
    assert.deepEqual(vidas(estado), [20, 20]);
  });
  test('acertou inválido gera erro', () => {
    assert.throws(() => resolverRodadaMira(partida(FORTE, ESPINHO), [1, 0], [ATAQUE, DEFESA]));
  });
});

describe('resolverRodadaModo e danoMaximoDoModo', () => {
  test('ROLAR pela porta única é igual a resolverRodada', () => {
    const a = resolverRodadaModo(ROLAR, partida(FORTE, ESPINHO), [{ simbolo: ATAQUE }, { simbolo: TROPECO }]);
    const b = resolverRodada(partida(FORTE, ESPINHO), ATAQUE, TROPECO);
    assert.deepEqual(a, b);
  });
  test('modo desconhecido gera erro', () => {
    assert.throws(() => resolverRodadaModo('PEDRA', partida(FORTE, ESPINHO), [{}, {}]));
  });
  test('dano máximo por modo bate com as constantes', () => {
    assert.equal(danoMaximoDoModo(ROLAR, FORTE), 8 + BONUS_TROPECO);
    assert.equal(danoMaximoDoModo(ARENA, FORTE), 4 + Math.max(BONUS_GIROU, BONUS_FORA), 'na Batalha o especial não ativa');
    assert.equal(danoMaximoDoModo(MIRA, FORTE), 8 + Math.max(BONUS_TROPECO, BONUS_ACERTO));
    assert.equal(MODOS.length, 3);
  });
});

describe('choque nos modos', () => {
  test('ARENA com vencedor: não há choque', () => {
    const um = resolverRodadaArena(partida(FORTE, ESPINHO), 0, GIROU);
    assert.equal(um.resumo.choque, false);
    assert.deepEqual(um.resumo.danoChoque, [0, 0]);
  });
});
