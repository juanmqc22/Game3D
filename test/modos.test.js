// Testes dos modos ARENA e MIRA. Criaturas de teste próprias (como em regras.test.js).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATAQUE, DEFESA, ESPECIAL, TROPECO, ROLAR, ARENA, MIRA, MODOS,
  BONUS_FORA, BONUS_ACERTO, BONUS_TROPECO,
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

describe('modo ARENA', () => {
  test('os dois dentro: igual ao modo ROLAR', () => {
    const classico = resolverRodada(partida(FORTE, ESPINHO), ESPECIAL, TROPECO);
    const arena = resolverRodadaArena(partida(FORTE, ESPINHO), [true, true], [ESPECIAL, TROPECO]);
    assert.deepEqual(vidas(arena.estado), vidas(classico.estado));
    assert.equal(arena.resumo.dano, 8 + BONUS_TROPECO);
    assert.equal(arena.resumo.modo, ARENA);
    assert.deepEqual(arena.resumo.dentro, [true, true]);
  });
  test('os dois dentro: especial funciona (cura, recuo, escudo)', () => {
    const { resumo } = resolverRodadaArena(partida(BOMBA, ESPINHO), [true, true], [ESPECIAL, ATAQUE]);
    assert.equal(resumo.dano, 6);
    assert.equal(resumo.recuo, 2);
  });
  test('só o jogador 1 dentro: ele vence e o outro leva forca + 2', () => {
    const { estado, resumo } = resolverRodadaArena(partida(ESPINHO, FORTE), [true, false], [TROPECO, ESPECIAL]);
    assert.equal(resumo.vencedor, 0);
    assert.equal(resumo.danoBase, 3);
    assert.equal(resumo.bonusFora, BONUS_FORA);
    assert.equal(resumo.dano, 3 + BONUS_FORA);
    assert.deepEqual(vidas(estado), [20, 20 - 3 - BONUS_FORA]);
  });
  test('só o jogador 2 dentro: a face dele não importa (ESPECIAL não dispara efeito)', () => {
    const { estado, resumo } = resolverRodadaArena(partida(ESPINHO, BOMBA), [false, true], [ATAQUE, ESPECIAL]);
    assert.equal(resumo.vencedor, 1);
    assert.equal(resumo.dano, 3 + BONUS_FORA);
    assert.equal(resumo.recuo, 0, 'especial de quem ficou dentro sozinho não conta');
    assert.equal(resumo.bonusTropeco, 0);
    assert.deepEqual(vidas(estado), [20 - 3 - BONUS_FORA, 20]);
  });
  test('só um dentro: a face de quem ficou dentro pode ser omitida', () => {
    const { resumo } = resolverRodadaArena(partida(ESPINHO, FORTE), [true, false]);
    assert.equal(resumo.dano, 3 + BONUS_FORA);
    assert.deepEqual(resumo.simbolos, [null, null]);
  });
  test('só um dentro: quem ficou fora com TROPECO não leva o +2 do tropeço', () => {
    const { resumo } = resolverRodadaArena(partida(ESPINHO, FORTE), [true, false], [ATAQUE, TROPECO]);
    assert.equal(resumo.dano, 3 + BONUS_FORA);
  });
  test('só um dentro: escudo de quem ficou fora anula o dano e é consumido', () => {
    const { estado, resumo } = resolverRodadaArena(partida(ESPINHO, FORTE, [{}, { escudo: true }]), [true, false]);
    assert.equal(resumo.bloqueado, true);
    assert.equal(resumo.danoPrevisto, 3 + BONUS_FORA);
    assert.deepEqual(vidas(estado), [20, 20]);
    assert.equal(estado.jogadores[1].escudo, false);
  });
  test('nenhum dentro: rodada nula, ninguém perde vida, rodada conta', () => {
    const { estado, resumo, fim } = resolverRodadaArena(partida(ESPINHO, FORTE, [{}, { escudo: true }]), [false, false]);
    assert.equal(resumo.nula, true);
    assert.equal(resumo.vencedor, null);
    assert.deepEqual(vidas(estado), [20, 20]);
    assert.equal(estado.jogadores[1].escudo, true, 'rodada nula não consome escudo');
    assert.equal(estado.rodada, 1);
    assert.equal(fim.terminou, false);
  });
  test('quem fica fora pode ser zerado e a partida termina', () => {
    const { fim } = resolverRodadaArena(partida(ESPINHO, FORTE, [{}, { vida: 3 + BONUS_FORA }]), [true, false]);
    assert.deepEqual(fim, { terminou: true, vencedor: 0 });
  });
  test('dentro inválido gera erro', () => {
    assert.throws(() => resolverRodadaArena(partida(ESPINHO, FORTE), [true], [ATAQUE, ATAQUE]));
    assert.throws(() => resolverRodadaArena(partida(ESPINHO, FORTE), [true, true], [ATAQUE, 'PEDRA']));
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
    assert.equal(danoMaximoDoModo(ARENA, FORTE), Math.max(8 + BONUS_TROPECO, 4 + BONUS_FORA));
    assert.equal(danoMaximoDoModo(MIRA, FORTE), 8 + Math.max(BONUS_TROPECO, BONUS_ACERTO));
    assert.equal(MODOS.length, 3);
  });
});

describe('choque nos modos', () => {
  test('ARENA com os dois dentro e o mesmo símbolo: choque', () => {
    const { resumo, estado } = resolverRodadaArena(partida(FORTE, ESPINHO), [true, true], [DEFESA, DEFESA]);
    assert.equal(resumo.choque, true);
    assert.deepEqual(vidas(estado), [19, 19]);
  });
  test('ARENA com alguém fora: não há choque, mesmo com faces iguais', () => {
    const nula = resolverRodadaArena(partida(FORTE, ESPINHO), [false, false], [ATAQUE, ATAQUE]);
    assert.equal(nula.resumo.choque, false);
    assert.deepEqual(vidas(nula.estado), [20, 20]);
    const um = resolverRodadaArena(partida(FORTE, ESPINHO), [true, false], [ATAQUE, ATAQUE]);
    assert.equal(um.resumo.choque, false);
    assert.equal(um.resumo.vencedor, 0);
  });
});
