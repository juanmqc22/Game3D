// Tutorial no navegador de verdade, com o Web NFC do Android simulado: um
// NDEFReader falso é instalado antes da página carregar. Confere o botão "Ler
// bichinho", a leitura entrando na coleção e o aviso de NFC desligado.
// Sem Chrome/Edge na máquina, pula (como test/orientacao.test.js).
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { acharNavegador, servir, abrirPagina } from './navegador.js';

const executavel = acharNavegador();

// falha: nome do DOMException que o scan() rejeita (null = lê normal).
const NDEF_FALSO = (falha) => `
  window.NDEFReader = class {
    async scan({ signal } = {}) {
      ${falha ? `throw new DOMException('simulado', '${falha}');` : ''}
      window.__leitor = this;
      signal?.addEventListener('abort', () => { window.__leitor = null; });
    }
  };
  // encosta uma etiqueta com o endereço dado
  window.__encostar = (url) => {
    const data = new TextEncoder().encode(url);
    window.__leitor?.onreading?.({ message: { records: [{ recordType: 'url', data: new DataView(data.buffer) }] } });
  };`;

describe('tutorial no navegador (Android com Web NFC simulado)', { skip: executavel ? false : 'sem Chrome/Edge (defina NAVEGADOR=...)', timeout: 60000 }, () => {
  let srv;
  let base;
  let p;
  let script = null;
  before(async () => {
    ({ srv, base } = await servir());
    p = await abrirPagina(executavel);
    await p.movimentoReduzido(true);
    await p.cdp('Emulation.setUserAgentOverride', {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    });
  });
  after(async () => {
    await p?.fechar();
    srv?.close();
  });
  const comNdef = async (falha) => {
    if (script) await p.cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: script });
    ({ identifier: script } = await p.cdp('Page.addScriptToEvaluateOnNewDocument', { source: NDEF_FALSO(falha) }));
  };
  const telaAtual = () => p.js(`[...document.querySelectorAll('.tela')].find((t) => !t.hidden)?.id`);
  const texto = (id) => p.js(`document.getElementById('${id}').textContent`);
  const comecar = async () => {
    await p.ir(base);
    await p.js('localStorage.clear()');
    await p.ir(base);
    await p.tocar('#btn-tutorial-principal');
    await p.tocar('#btn-tutorial-principal');
  };

  test('"Ler bichinho" lê as duas peças sem sair da página e chega na partida', async () => {
    await comNdef(null);
    await comecar();
    assert.equal(await texto('tutorial-titulo'), 'Encoste as costas do celular na face do X');
    assert.equal(await texto('btn-tutorial-principal'), 'Ler bichinho');
    await p.tocar('#btn-tutorial-principal');
    assert.equal(await texto('btn-tutorial-principal'), 'Lendo… toque para parar');
    await p.js(`window.__encostar('https://juanmqc22.github.io/Game3D/?b=TAT01&f=2')`);
    await p.espera(80);
    assert.equal(await telaAtual(), 'tela-desbloqueio');
    assert.equal(await texto('desbloqueio-chamada'), 'Couraça entrou na sua coleção!');
    assert.equal(await p.js(`JSON.parse(localStorage.getItem('bichinhos:colecao')).TAT01.fundador`), 2);
    await p.tocar('#btn-desbloqueio-continuar');
    assert.equal(await texto('tutorial-titulo'), 'Agora o outro bichinho');
    await p.tocar('#btn-tutorial-principal');
    // a mesma peça de novo: pede a outra
    await p.js(`window.__encostar('/?b=TAT01')`);
    await p.espera(80);
    assert.equal(await telaAtual(), 'tela-tutorial');
    assert.match(await texto('tutorial-aviso'), /já entrou/);
    await p.tocar('#btn-tutorial-principal');
    await p.js(`window.__encostar('/?b=SAP02')`);
    await p.espera(80);
    await p.tocar('#btn-desbloqueio-continuar');
    assert.equal(await texto('tutorial-titulo'), 'Primeira partida!');
    assert.equal(await p.js(`localStorage.getItem('bichinhos:aguardando')`), null, 'a espera do escaneio foi limpa');
    assert.deepEqual(p.erros, []);
  });

  test('NFC desligado: mostra como ligar em Configurações', async () => {
    await comNdef('NotReadableError');
    await comecar();
    await p.tocar('#btn-tutorial-principal');
    await p.espera(50);
    assert.match(await texto('tutorial-aviso'), /NFC está desligado.*Configurações/);
    assert.equal(await p.js(`document.getElementById('tutorial-aviso').hidden`), false);
    assert.equal(await texto('btn-tutorial-principal'), 'Ler bichinho');
    await p.tocar('#btn-tutorial-ajuda');
    assert.match(await texto('tutorial-ajuda-lista'), /NFC está ligado/);
    assert.deepEqual(p.erros, []);
  });
});
