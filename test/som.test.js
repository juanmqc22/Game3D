// Som: o modo do botão (tudo / efeitos / mudo), o localStorage e a queda
// segura quando o navegador não tem Web Audio.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAVE_SOM, MODOS_SOM, MODO_SOM_PADRAO, lerModoSom, gravarModoSom, proximoModoSom, criarSom, TEXTO_MODO_SOM,
} from '../js/som.js';

function storageFalso(inicial = {}) {
  const dados = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
  };
}
const quebrado = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };

describe('modo do som', () => {
  test('padrão é só efeitos', () => {
    assert.equal(MODO_SOM_PADRAO, 'efeitos');
    assert.equal(lerModoSom(storageFalso()), 'efeitos');
  });
  test('lê o que foi gravado; valor estranho vira o padrão', () => {
    assert.equal(lerModoSom(storageFalso({ [CHAVE_SOM]: 'mudo' })), 'mudo');
    assert.equal(lerModoSom(storageFalso({ [CHAVE_SOM]: 'alto' })), 'efeitos');
  });
  test('storage quebrado não derruba nada', () => {
    assert.equal(lerModoSom(quebrado), 'efeitos');
    assert.equal(gravarModoSom(quebrado, 'mudo'), false);
  });
  test('gravar só aceita os três modos', () => {
    const s = storageFalso();
    assert.equal(gravarModoSom(s, 'tudo'), true);
    assert.equal(s.getItem(CHAVE_SOM), 'tudo');
    assert.equal(gravarModoSom(s, 'alto'), false);
  });
  test('o botão gira pelos três: tudo → efeitos → mudo → tudo', () => {
    assert.deepEqual(MODOS_SOM, ['tudo', 'efeitos', 'mudo']);
    assert.equal(proximoModoSom('tudo'), 'efeitos');
    assert.equal(proximoModoSom('efeitos'), 'mudo');
    assert.equal(proximoModoSom('mudo'), 'tudo');
  });
  test('todo modo tem texto para o leitor de tela', () => {
    for (const m of MODOS_SOM) assert.ok(TEXTO_MODO_SOM[m]);
  });
});

describe('criarSom', () => {
  test('sem Web Audio: indisponível e tudo vira nada', () => {
    const som = criarSom({ janela: {}, storage: storageFalso() });
    assert.equal(som.disponivel, false);
    som.destravar();
    som.tocar('garrada');
    som.definirModo('tudo');
  });
  test('com Web Audio: começa no modo gravado e guarda a troca sem criar áudio antes do toque', () => {
    let criados = 0;
    const janela = { AudioContext: class { constructor() { criados++; } } };
    const s = storageFalso({ [CHAVE_SOM]: 'mudo' });
    const som = criarSom({ janela, storage: s });
    assert.equal(som.disponivel, true);
    assert.equal(som.modo(), 'mudo');
    som.tocar('garrada');
    som.destravar(); // mudo: não cria áudio
    assert.equal(criados, 0);
    som.definirModo('mudo');
    assert.equal(s.getItem(CHAVE_SOM), 'mudo');
  });
});
