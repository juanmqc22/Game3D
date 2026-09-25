// Confere que os dados em js/criaturas.js estão completos — pega erros de digitação
// ao adicionar um bichinho novo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CRIATURAS, ESPECIES, buscarCriatura } from '../js/criaturas.js';
import {
  MODOS, ROLAR, BONUS_TROPECO, ESPECIAL, ATAQUE, TROPECO, danoMaximoDoModo, estadoInicial, resolverRodada,
} from '../js/regras.js';

test('códigos são únicos', () => {
  const codigos = CRIATURAS.map((c) => c.codigo);
  assert.equal(new Set(codigos).size, codigos.length);
});

for (const c of CRIATURAS) {
  test(`${c.codigo} tem dados válidos`, () => {
    assert.match(c.codigo, /^[A-Z0-9]+$/);
    assert.ok(c.nome);
    assert.ok(ESPECIES[c.especie], `espécie "${c.especie}" não está em ESPECIES`);
    assert.ok(Number.isInteger(c.vida) && c.vida > 0);
    assert.ok(Number.isInteger(c.forca) && c.forca > 0);
    assert.ok(Number.isInteger(c.serie) && c.serie >= 1, 'série é um inteiro >= 1');
    const e = c.especial;
    assert.ok(e.nome);
    assert.ok(Number.isInteger(e.dano) && e.dano > 0, 'todo especial causa dano');
    assert.ok(Number.isInteger(e.cura) && e.cura >= 0);
    assert.ok(Number.isInteger(e.recuo) && e.recuo >= 0);
    assert.equal(typeof e.roubo, 'boolean');
    assert.equal(typeof e.escudo, 'boolean');
    const linha = `${e.nome}: ${e.texto}`;
    assert.ok(linha.length <= 64, `texto longo demais (${linha.length}): ${linha}`);
  });
}

// Guarda-corpo de balanceamento: o pior golpe único de cada modo (calculado por
// força bruta com as próprias regras, em js/regras.js) não pode passar de 60% da
// vida do alvo — nenhum bichinho morre de vida cheia em uma ou duas rodadas por
// causa de um único golpe. No modo ROLAR isso é maior dano + 2 do TROPECO.
const FRACAO_MAXIMA = 0.6;

for (const modo of MODOS) {
  for (const atacante of CRIATURAS) {
    for (const alvo of CRIATURAS) {
      test(`golpe máximo em ${modo}: ${atacante.codigo} -> ${alvo.codigo}`, () => {
        const piorGolpe = danoMaximoDoModo(modo, atacante, alvo);
        const limite = FRACAO_MAXIMA * alvo.vida;
        // Compara em inteiros (piorGolpe * 5 <= vida * 3) para evitar erro de ponto flutuante.
        assert.ok(
          piorGolpe * 5 <= alvo.vida * 3,
          `pior golpe ${piorGolpe} > ${limite.toFixed(1)} (60% de ${alvo.vida}); excesso ${(piorGolpe - limite).toFixed(1)}`,
        );
      });
    }
  }
}

test('no modo ROLAR o pior golpe é maior dano + 2 do TROPECO', () => {
  for (const c of CRIATURAS) {
    assert.equal(danoMaximoDoModo(ROLAR, c), Math.max(c.forca, c.especial.dano) + BONUS_TROPECO);
  }
});

test('buscarCriatura aceita minúsculas e espaços', () => {
  assert.equal(buscarCriatura(' sap 02 ').nome, 'Bocão');
});

test('buscarCriatura retorna null para código inválido', () => {
  assert.equal(buscarCriatura('XYZ99'), null);
  assert.equal(buscarCriatura(''), null);
  assert.equal(buscarCriatura(undefined), null);
});

// Balanceamento dos fundadores (ENTREGA.md): a Língua Chicote passou de 3/3 para 4/4.
test('SAP02 Língua Chicote: 4 de dano e rouba 4 (fixo, mesmo com o tropeço)', () => {
  const bocao = buscarCriatura('SAP02');
  const couraca = buscarCriatura('TAT01');
  assert.equal(bocao.especial.dano, 4);
  assert.equal(bocao.especial.cura, 4);
  assert.equal(bocao.especial.roubo, true);
  assert.match(bocao.especial.texto, /-4 .*\+4/);
  const inicio = estadoInicial(bocao, couraca);
  inicio.jogadores[0].vida = 8;
  const normal = resolverRodada(inicio, ESPECIAL, ATAQUE);
  assert.equal(normal.resumo.dano, 4);
  assert.equal(normal.resumo.cura, 4);
  assert.deepEqual(normal.estado.jogadores.map((j) => j.vida), [12, 12]);
  const tropeco = resolverRodada(inicio, ESPECIAL, TROPECO);
  assert.equal(tropeco.resumo.dano, 6);
  assert.equal(tropeco.resumo.cura, 4);
});
