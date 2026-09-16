// Confere que os dados em js/criaturas.js estão completos — pega erros de digitação
// ao adicionar um bichinho novo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CRIATURAS, ESPECIES, buscarCriatura } from '../js/criaturas.js';

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

// Guarda-corpo de balanceamento: o pior golpe único (maior dano + 2 do TROPECO)
// não pode passar de 60% da vida do alvo — nenhum bichinho morre de vida cheia
// em uma ou duas rodadas por causa de um único golpe.
const BONUS_TROPECO = 2;
const FRACAO_MAXIMA = 0.6;

for (const atacante of CRIATURAS) {
  for (const alvo of CRIATURAS) {
    test(`golpe máximo: ${atacante.codigo} -> ${alvo.codigo}`, () => {
      const piorGolpe = Math.max(atacante.forca, atacante.especial.dano) + BONUS_TROPECO;
      const limite = FRACAO_MAXIMA * alvo.vida;
      // Compara em inteiros (piorGolpe * 5 <= vida * 3) para evitar erro de ponto flutuante.
      assert.ok(
        piorGolpe * 5 <= alvo.vida * 3,
        `pior golpe ${piorGolpe} > ${limite.toFixed(1)} (60% de ${alvo.vida}); excesso ${(piorGolpe - limite).toFixed(1)}`,
      );
    });
  }
}

test('buscarCriatura aceita minúsculas e espaços', () => {
  assert.equal(buscarCriatura(' sap 02 ').nome, 'Bocão');
});

test('buscarCriatura retorna null para código inválido', () => {
  assert.equal(buscarCriatura('XYZ99'), null);
  assert.equal(buscarCriatura(''), null);
  assert.equal(buscarCriatura(undefined), null);
});
