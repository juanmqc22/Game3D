// O nome do golpe (golpeDaRodada): o que a tela escreve no lugar de venceu/perdeu.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATAQUE, DEFESA, ESPECIAL, TROPECO, GIROU, FORA,
  estadoInicial, resolverRodada, resolverRodadaArena, resolverRodadaMira, golpeDaRodada,
} from '../js/regras.js';

const bicho = (codigo, especial = {}) => ({
  codigo, nome: codigo, especie: 'teste', vida: 20, forca: 3,
  especial: { nome: 'Especial', dano: 4, cura: 0, roubo: false, escudo: false, recuo: 0, texto: '', ...especial },
});
const A = bicho('A');
const B = bicho('B', { escudo: true, dano: 2 });
const rolar = (sa, sb, estado = estadoInicial(A, B)) => golpeDaRodada(resolverRodada(estado, sa, sb).resumo);

describe('golpeDaRodada', () => {
  test('ATAQUE vencendo: GARRADA (dos dois lados)', () => {
    assert.equal(rolar(ATAQUE, DEFESA), 'GARRADA');
    assert.equal(rolar(DEFESA, ATAQUE), 'GARRADA');
  });
  test('DEFESA vencendo: DEFENDEU', () => {
    assert.equal(rolar(DEFESA, ESPECIAL), 'DEFENDEU');
  });
  test('ESPECIAL vencendo: ESPECIAL (a tela usa o nome dele)', () => {
    assert.equal(rolar(ESPECIAL, ATAQUE), 'ESPECIAL');
  });
  test('perdedor com TROPEÇO: TROPECOU, menos quando o vencedor usou o especial', () => {
    assert.equal(rolar(ATAQUE, TROPECO), 'TROPECOU');
    assert.equal(rolar(TROPECO, DEFESA), 'TROPECOU');
    assert.equal(rolar(ESPECIAL, TROPECO), 'ESPECIAL');
  });
  test('símbolos iguais: CHOQUE; TROPEÇO x TROPEÇO: TROPECARAM', () => {
    for (const s of [ATAQUE, DEFESA, ESPECIAL]) assert.equal(rolar(s, s), 'CHOQUE');
    assert.equal(rolar(TROPECO, TROPECO), 'TROPECARAM');
  });
  test('escudo segurando não muda o nome do golpe', () => {
    const estado = estadoInicial(A, B);
    estado.jogadores[1].escudo = true;
    assert.equal(rolar(ATAQUE, DEFESA, estado), 'GARRADA');
  });
  test('Mira usa os mesmos nomes', () => {
    const { resumo } = resolverRodadaMira(estadoInicial(A, B), [true, false], [DEFESA, ESPECIAL]);
    assert.equal(golpeDaRodada(resumo), 'DEFENDEU');
  });
  test('Batalha: GIROU, FORA e CHOQUE no empate', () => {
    assert.equal(golpeDaRodada(resolverRodadaArena(estadoInicial(A, B), 0, GIROU).resumo), 'GIROU');
    assert.equal(golpeDaRodada(resolverRodadaArena(estadoInicial(A, B), 1, FORA).resumo), 'FORA');
    assert.equal(golpeDaRodada(resolverRodadaArena(estadoInicial(A, B), null).resumo), 'CHOQUE');
  });
});
