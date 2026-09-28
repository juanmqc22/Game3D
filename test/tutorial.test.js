// Tutorial do primeiro contato (js/tutorial.js), sem DOM: storage falso em
// memória, compartilhado entre "abas" como o localStorage de verdade.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAVE_TUTORIAL, PASSO, estadoVazio, lerTutorial, gravarTutorial, decidirEntrada, registrarLeitura,
  comecarRegistro, soTenhoUm, parDaPartida, pular, concluir, rever, passoParaAba,
  detectarPlataforma, motivoFalhaNfc, escolherVoz, proximaDica,
} from '../js/tutorial.js';
import { registrarDescoberta, lerColecao } from '../js/colecao.js';

function storageFalso() {
  const dados = new Map();
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => { dados.set(k, String(v)); },
    removeItem: (k) => { dados.delete(k); },
  };
}
const quebrado = {
  getItem: () => { throw new Error('bloqueado'); },
  setItem: () => { throw new Error('bloqueado'); },
  removeItem: () => { throw new Error('bloqueado'); },
};
const codigos = (s) => Object.keys(lerColecao(s) ?? {});

// Uma aba abrindo a página: decide a entrada e, se chegou peça, registra
// na coleção (função existente) e no tutorial — como js/app.js faz.
function abrirAba(s, codigo = null) {
  const d = decidirEntrada(lerTutorial(s), { via: codigo ? 'peca' : 'inicio', codigos: codigos(s) });
  if (!d) {
    if (codigo) registrarDescoberta(s, codigo);
    return null;
  }
  gravarTutorial(s, d.estado);
  if (!codigo) return { ...d, passoFinal: d.passo };
  registrarDescoberta(s, codigo);
  const { estado, repetido } = registrarLeitura(lerTutorial(s), codigo);
  gravarTutorial(s, estado);
  return { ...d, passoFinal: estado.step, repetido };
}

describe('lerTutorial / gravarTutorial', () => {
  test('vazio: step 0, nada concluído', () => {
    assert.deepEqual(lerTutorial(storageFalso()), estadoVazio());
  });
  test('ida e volta', () => {
    const s = storageFalso();
    gravarTutorial(s, { step: 3, done: false, skipped: false, pecas: ['TAT01'] });
    assert.deepEqual(lerTutorial(s), { step: 3, done: false, skipped: false, pecas: ['TAT01'] });
  });
  test('lixo vira estado vazio; peça desconhecida e repetida saem', () => {
    const s = storageFalso();
    for (const lixo of ['{', '[]', 'null', '"x"', '{"step":9}', '{"step":"2"}']) {
      s.setItem(CHAVE_TUTORIAL, lixo);
      assert.equal(lerTutorial(s).step, 0, lixo);
    }
    s.setItem(CHAVE_TUTORIAL, JSON.stringify({ step: 3, done: 'sim', pecas: ['XYZ', 'tat01', 'TAT01', 'RAT00'] }));
    assert.deepEqual(lerTutorial(s), { step: 3, done: false, skipped: false, pecas: ['TAT01'] });
  });
  test('storage quebrado: null, e o tutorial não aparece sozinho', () => {
    assert.equal(lerTutorial(quebrado), null);
    assert.equal(gravarTutorial(quebrado, estadoVazio()), false);
    assert.equal(decidirEntrada(null, { via: 'inicio', codigos: [] }), null);
  });
});

describe('entrada pela home (QR do cartão do kit)', () => {
  test('coleção vazia e nada feito: começa nas boas-vindas', () => {
    const s = storageFalso();
    const r = abrirAba(s);
    assert.equal(r.passo, PASSO.BOAS_VINDAS);
    assert.equal(r.curta, false);
    assert.equal(lerTutorial(s).step, PASSO.BOAS_VINDAS);
  });
  test('fluxo completo: boas-vindas → 1º → 2º → partida → fim', () => {
    const s = storageFalso();
    abrirAba(s);
    gravarTutorial(s, comecarRegistro(lerTutorial(s)));
    assert.equal(lerTutorial(s).step, PASSO.PRIMEIRO);
    // Android: a peça é lida na mesma aba
    registrarDescoberta(s, 'TAT01');
    let r = registrarLeitura(lerTutorial(s), 'TAT01');
    assert.equal(r.estado.step, PASSO.SEGUNDO);
    gravarTutorial(s, r.estado);
    registrarDescoberta(s, 'SAP02');
    r = registrarLeitura(lerTutorial(s), 'SAP02');
    assert.equal(r.estado.step, PASSO.PARTIDA);
    assert.deepEqual(parDaPartida(r.estado).map((c) => c.codigo), ['TAT01', 'SAP02']);
    gravarTutorial(s, concluir(r.estado));
    assert.equal(lerTutorial(s).done, true);
    assert.equal(abrirAba(s), null, 'concluído: não aparece mais');
  });
  test('recarregar no meio retoma o mesmo passo', () => {
    const s = storageFalso();
    gravarTutorial(s, { step: PASSO.SEGUNDO, done: false, skipped: false, pecas: ['TAT01'] });
    registrarDescoberta(s, 'TAT01');
    assert.equal(abrirAba(s).passo, PASSO.SEGUNDO);
  });
  test('partida já oferecida (passo 4): a home não insiste', () => {
    const s = storageFalso();
    gravarTutorial(s, { step: PASSO.PARTIDA, done: false, skipped: false, pecas: ['TAT01', 'SAP02'] });
    assert.equal(abrirAba(s), null);
  });
  test('quem já tinha 1 peça antes do tutorial não é interrompido na home', () => {
    const s = storageFalso();
    registrarDescoberta(s, 'TAT01');
    assert.equal(abrirAba(s), null);
  });
});

describe('entrada direto pela peça (NFC)', () => {
  test('nada feito, coleção vazia: boas-vindas curta, a leitura conta e vai para o 2º', () => {
    const s = storageFalso();
    const r = abrirAba(s, 'SAP02');
    assert.equal(r.curta, true);
    assert.equal(r.passo, PASSO.PRIMEIRO);
    assert.equal(r.passoFinal, PASSO.SEGUNDO);
    assert.deepEqual(codigos(s), ['SAP02'], 'entrou na coleção');
  });
  test('já tinha 1 na coleção: boas-vindas curta na etapa 3; a peça nova leva à partida', () => {
    const s = storageFalso();
    registrarDescoberta(s, 'TAT01');
    const r = abrirAba(s, 'SAP02');
    assert.equal(r.curta, true);
    assert.equal(r.passo, PASSO.SEGUNDO);
    assert.equal(r.passoFinal, PASSO.PARTIDA);
    assert.deepEqual(parDaPartida(lerTutorial(s)).map((c) => c.codigo), ['TAT01', 'SAP02']);
  });
  test('já tinha 1 e leu a mesma: continua pedindo o outro', () => {
    const s = storageFalso();
    registrarDescoberta(s, 'TAT01');
    const r = abrirAba(s, 'TAT01');
    assert.equal(r.passoFinal, PASSO.SEGUNDO);
    assert.equal(r.repetido, true);
  });
  test('no meio do tutorial: sem boas-vindas de novo', () => {
    const s = storageFalso();
    abrirAba(s);
    gravarTutorial(s, comecarRegistro(lerTutorial(s)));
    const r = abrirAba(s, 'TAT01');
    assert.equal(r.curta, false);
    assert.equal(r.passoFinal, PASSO.SEGUNDO);
  });
  test('parou nas boas-vindas (passo 1) e leu a peça: curta de novo, e a leitura conta', () => {
    const s = storageFalso();
    abrirAba(s);
    const r = abrirAba(s, 'TAT01');
    assert.equal(r.curta, true);
    assert.equal(r.passoFinal, PASSO.SEGUNDO);
  });
});

describe('retomada em outra aba (iPhone abre aba nova a cada leitura)', () => {
  test('a aba nova segue o passo e a antiga se atualiza pelo evento storage', () => {
    const s = storageFalso(); // o mesmo localStorage para as duas abas
    abrirAba(s); // aba A: home
    gravarTutorial(s, comecarRegistro(lerTutorial(s)));
    const mostradoA = lerTutorial(s).step; // A mostra "encoste o 1º"
    assert.equal(mostradoA, PASSO.PRIMEIRO);

    const b = abrirAba(s, 'TAT01'); // aba B: leitura NFC
    assert.equal(b.passoFinal, PASSO.SEGUNDO);
    assert.equal(passoParaAba(mostradoA, lerTutorial(s)), PASSO.SEGUNDO, 'A pula para o 2º');

    const c = abrirAba(s, 'SAP02'); // aba C: segunda leitura
    assert.equal(c.curta, false);
    assert.equal(c.passoFinal, PASSO.PARTIDA);
    assert.equal(passoParaAba(PASSO.SEGUNDO, lerTutorial(s)), PASSO.PARTIDA);
    assert.deepEqual(parDaPartida(lerTutorial(s)).map((x) => x.codigo), ['TAT01', 'SAP02']);
  });
  test('passoParaAba: mesmo passo ou atrás não mexe; concluído ou pulado volta ao início', () => {
    const e = (step, extra = {}) => ({ ...estadoVazio(), step, ...extra });
    assert.equal(passoParaAba(PASSO.SEGUNDO, e(PASSO.SEGUNDO)), null);
    assert.equal(passoParaAba(PASSO.SEGUNDO, e(PASSO.PRIMEIRO)), null);
    assert.equal(passoParaAba(PASSO.SEGUNDO, e(PASSO.FIM, { done: true })), 'sair');
    assert.equal(passoParaAba(PASSO.PRIMEIRO, e(PASSO.PRIMEIRO, { skipped: true })), 'sair');
    assert.equal(passoParaAba(PASSO.PRIMEIRO, null), null);
  });
});

describe('pular', () => {
  test('marca skipped e não volta sozinho, nem pela home nem pela peça', () => {
    const s = storageFalso();
    abrirAba(s);
    gravarTutorial(s, pular(lerTutorial(s)));
    assert.equal(lerTutorial(s).skipped, true);
    assert.equal(abrirAba(s), null);
    assert.equal(abrirAba(s, 'TAT01'), null);
    assert.deepEqual(codigos(s), ['TAT01'], 'a peça entra na coleção normalmente');
  });
  test('rever depois de pular recomeça do zero', () => {
    const s = storageFalso();
    gravarTutorial(s, pular(lerTutorial(s)));
    gravarTutorial(s, rever());
    assert.deepEqual(lerTutorial(s), { step: PASSO.BOAS_VINDAS, done: false, skipped: false, pecas: [] });
    assert.equal(abrirAba(s).passo, PASSO.BOAS_VINDAS);
  });
  test('rever com a coleção cheia: a peça lida conta como 1º e pede o 2º', () => {
    const s = storageFalso();
    registrarDescoberta(s, 'TAT01');
    registrarDescoberta(s, 'SAP02');
    gravarTutorial(s, rever());
    gravarTutorial(s, comecarRegistro(lerTutorial(s)));
    const r = abrirAba(s, 'SAP02');
    assert.equal(r.passoFinal, PASSO.SEGUNDO);
    assert.equal(abrirAba(s, 'TAT01').passoFinal, PASSO.PARTIDA);
  });
});

describe('"Só tenho 1 bichinho"', () => {
  test('vai para a partida contra o Rato', () => {
    const t = soTenhoUm({ ...estadoVazio(), step: PASSO.SEGUNDO, pecas: ['SAP02'] });
    assert.equal(t.step, PASSO.PARTIDA);
    assert.deepEqual(parDaPartida(t).map((c) => c.codigo), ['SAP02', 'RAT00']);
    assert.equal(parDaPartida(t)[1].rival, true);
  });
  test('sem peça lida no tutorial, usa a da coleção', () => {
    const t = soTenhoUm({ ...estadoVazio(), step: PASSO.SEGUNDO }, ['TAT01']);
    assert.deepEqual(parDaPartida(t).map((c) => c.codigo), ['TAT01', 'RAT00']);
  });
  test('sem peça nenhuma: não há par', () => {
    assert.equal(parDaPartida(soTenhoUm(estadoVazio(), [])), null);
  });
});

describe('coleção já cheia', () => {
  test('2 ou mais peças: nada pela home nem pela peça', () => {
    const s = storageFalso();
    registrarDescoberta(s, 'TAT01');
    registrarDescoberta(s, 'SAP02');
    assert.equal(abrirAba(s), null);
    assert.equal(abrirAba(s, 'TAT01'), null);
    assert.equal(lerTutorial(s).step, PASSO.NADA);
  });
  test('registrarLeitura ignora código desconhecido', () => {
    const t = { ...estadoVazio(), step: PASSO.PRIMEIRO };
    assert.deepEqual(registrarLeitura(t, 'XYZ99'), { estado: t, repetido: false });
  });
});

describe('detectarPlataforma', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
  const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
  test('iPhone', () => assert.equal(detectarPlataforma({ userAgent: IPHONE, maxTouchPoints: 5 }), 'ios'));
  test('iPad (se diz Mac, mas tem toque) não lê NFC', () => assert.equal(detectarPlataforma({ userAgent: IPAD, maxTouchPoints: 5 }), 'sem-nfc'));
  test('Mac de verdade', () => assert.equal(detectarPlataforma({ userAgent: IPAD, maxTouchPoints: 0 }), 'sem-nfc'));
  test('Android com Web NFC (Chrome)', () => assert.equal(detectarPlataforma({ userAgent: ANDROID, temNdef: true }), 'android'));
  test('Android sem Web NFC (outro navegador)', () => assert.equal(detectarPlataforma({ userAgent: ANDROID, temNdef: false }), 'android-sem-leitor'));
  test('computador sem NFC', () => assert.equal(detectarPlataforma({ userAgent: PC }), 'sem-nfc'));
  test('sem nada', () => assert.equal(detectarPlataforma(), 'sem-nfc'));
});

describe('motivoFalhaNfc', () => {
  test('cada DOMException do scan()', () => {
    assert.equal(motivoFalhaNfc({ name: 'AbortError' }), 'cancelado');
    assert.equal(motivoFalhaNfc({ name: 'NotAllowedError' }), 'permissao');
    assert.equal(motivoFalhaNfc({ name: 'NotReadableError' }), 'desligado');
    assert.equal(motivoFalhaNfc({ name: 'NotSupportedError' }), 'sem-suporte');
    assert.equal(motivoFalhaNfc(new Error('x')), 'outro');
    assert.equal(motivoFalhaNfc(undefined), 'outro');
  });
});

describe('escolherVoz', () => {
  test('pt-BR primeiro, depois qualquer português, senão null', () => {
    const pt = { lang: 'pt-PT' };
    const br = { lang: 'pt_BR' };
    assert.equal(escolherVoz([{ lang: 'en-US' }, pt, br]), br);
    assert.equal(escolherVoz([{ lang: 'en-US' }, pt]), pt);
    assert.equal(escolherVoz([{ lang: 'en-US' }]), null);
    assert.equal(escolherVoz(undefined), null);
  });
});

describe('dicas da primeira partida', () => {
  test('uma por vez e cada uma só uma vez', () => {
    const vistas = new Set();
    const girar = proximaDica('inicio', vistas);
    assert.equal(girar.texto, 'Girem os dois ao mesmo tempo');
    vistas.add(girar.id);
    assert.equal(proximaDica('inicio', vistas), null);
    assert.equal(proximaDica('escolha', vistas).texto, 'Toque no desenho que ficou virado pra cima');
  });
  test('choque e tropeço na primeira vez', () => {
    const vistas = new Set();
    assert.equal(proximaDica('rodada', vistas, { golpe: 'GARRADA' }), null);
    const choque = proximaDica('rodada', vistas, { golpe: 'CHOQUE' });
    assert.equal(choque.texto, 'Mesmo desenho: os dois perdem 1');
    vistas.add(choque.id);
    assert.equal(proximaDica('rodada', vistas, { golpe: 'CHOQUE' }), null);
    assert.equal(proximaDica('rodada', vistas, { golpe: 'TROPECOU' }).texto, 'O X perde pra tudo');
    assert.equal(proximaDica('rodada', vistas, { golpe: 'TROPECARAM' }), null, 'os dois tropeçaram: ninguém perde');
  });
  test('contra o Rato: a criança gira duas vezes', () => {
    assert.match(proximaDica('inicio', new Set(), { contraRival: true }).texto, /duas vezes/);
  });
});
