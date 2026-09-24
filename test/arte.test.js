import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { arteDaCriatura, CODIGOS_COM_ARTE } from '../js/arte.js';
import { buscarCriatura } from '../js/criaturas.js';

test('toda arte do mapa é de um bichinho que existe', () => {
  for (const codigo of CODIGOS_COM_ARTE) assert.ok(buscarCriatura(codigo), codigo);
});

test('os dois tamanhos existem e cabem em 80 KB', () => {
  for (const codigo of CODIGOS_COM_ARTE) {
    for (const tamanho of [256, 512]) {
      const arquivo = fileURLToPath(new URL(`../img/criaturas/${codigo}-${tamanho}.webp`, import.meta.url));
      assert.ok(statSync(arquivo).size <= 80 * 1024, `${codigo}-${tamanho}`);
    }
  }
});

test('src é a de 256 e o srcset oferece a de 512', () => {
  const arte = arteDaCriatura('TAT01');
  assert.match(arte.src, /img\/criaturas\/TAT01-256\.webp$/);
  assert.match(arte.srcset, /TAT01-256\.webp 256w, .*TAT01-512\.webp 512w$/);
});

test('bichinho sem arte continua sem arte', () => {
  for (const codigo of ['TAT03', 'SAP04', 'TAT05', 'SAP06', 'XXX99']) {
    assert.equal(arteDaCriatura(codigo), null, codigo);
  }
});
