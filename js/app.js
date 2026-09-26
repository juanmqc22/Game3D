// Interface da Arena dos Bichinhos: telas, animações, loop de escaneio (?b=),
// coleção em localStorage e os três modos de jogo.
// Nenhuma regra de jogo mora aqui — tudo vem de js/regras.js.

// ?v= igual ao de index.html (ver comentário lá).
import { CRIATURAS, ESPECIES, SERIE_ATUAL, buscarCriatura, buscarCriaturaOuRival } from './criaturas.js?v=15';
import {
  DEFESA, ESPECIAL, TROPECO, SIMBOLOS, ROLAR, ARENA, MIRA, MODOS, CHOQUE_DANO,
  GIROU, FORA, estadoInicial, resolverRodadaModo, golpeDaRodada,
} from './regras.js?v=15';
import {
  iconeSimbolo, iconeEspecial, iconeEscudoAtivo, iconeVida,
  iconeTrofeu, iconeEmpate, iconeBichinho, iconePlaca,
  iconeRolar, iconeArena, iconeAlvo, iconeFora, iconeErrou, iconeMisterio, iconeQr, iconeSom,
} from './icones.js?v=15';
import {
  processarChegada, lerAguardando, limparAguardando, lerRegistrosNfc,
} from './escaneio.js?v=15';
import {
  lerColecao, registrarDescoberta, registrarPartida, contarDaSerie, estaDescoberta, listaDeEscolha,
} from './colecao.js?v=15';
import { arteDaCriatura } from './arte.js?v=15';
import { criarSom, proximoModoSom, TEXTO_MODO_SOM } from './som.js?v=15';

const ROTULOS = {
  ATAQUE: 'ATAQUE',
  DEFESA: 'DEFESA',
  ESPECIAL: 'ESPECIAL',
  TROPECO: 'TROPEÇO',
};

// Textos dos modos, em linguagem de criança. As peças são piões.
// ARENA continua ARENA no código; na tela ela se chama "Batalha".
const INFO_MODO = {
  [ROLAR]: {
    nome: 'Rolar',
    icone: iconeRolar,
    explicacao: 'Girem os piões. Quando pararem, vejam qual desenho ficou para cima.',
  },
  [ARENA]: {
    nome: 'Batalha',
    icone: iconeArena,
    explicacao: 'Girem os dois na mesma bandeja. Ganha quem girar mais ou jogar o outro pra fora.',
  },
  [MIRA]: {
    nome: 'Mira',
    icone: iconeAlvo,
    explicacao: 'Girem os piões perto de uma tampa ou prato. Quem parar em cima bate mais forte.',
  },
};

// Nome acessível de cada símbolo (o rótulo da tela vem em maiúsculas).
const NOME_SIMBOLO = { ATAQUE: 'Ataque', DEFESA: 'Defesa', ESPECIAL: 'Especial', TROPECO: 'Tropeço' };

// Os dois responderam: a rodada resolve sozinha depois deste tempo. Enquanto
// isso o botão do meio vira DESFAZER, para corrigir um toque errado.
const ESPERA_DESFAZER = 1500;

// Cena do especial por código (tocarCena). Quem não está aqui usa a estrela genérica.
const EFEITO_ESPECIAL = { SAP02: 'lingua', TAT01: 'bola' };

// Onde o loop de escaneio guarda a peça que está esperando a segunda.
// localStorage: o iPhone abre uma aba nova a cada leitura de NFC ou QR, e a
// espera tem que valer entre abas (ver js/escaneio.js).
const armazemEspera = () => window.localStorage;
const armazemColecao = () => window.localStorage;

// Som gerado em código (js/som.js). A escolha do botão fica no localStorage;
// se ele não existir, o som funciona só nesta visita.
function armazemSom() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const som = criarSom({ janela: window, storage: armazemSom() });

// O som de cada golpe (js/regras.js, golpeDaRodada), no impacto.
const SOM_DO_GOLPE = {
  GARRADA: 'garrada', DEFENDEU: 'defesa', TROPECOU: 'tropeco', TROPECARAM: 'tropeco',
  CHOQUE: 'choque', GIROU: 'giro', FORA: 'fora', ESPECIAL: 'garrada',
};

// Linha do tempo da luta (ms). O total não pode passar de 1200 — medindo do
// toque até os botões liberarem, com folga para a latência do toque. Rodada de
// especial: a cena (TEMPO_CENA) vem antes e a rodada inteira fica em até 2,5 s.
const TEMPO = {
  impacto: 260,
  barras: 440,
  duracaoBarras: 440,
  texto: 920,
  fim: 1080,
};

const app = {
  modo: ROLAR,
  escolhas: [null, null], // criaturas escolhidas pelos jogadores 1 e 2
  jogadorEscolhendo: 0,
  escolhaRestrita: false, // fallback da espera: a coleção + o Rato do Mato
  selecionada: null, // criatura marcada na tela de escolha
  partida: null, // estado de js/regras.js
  entradas: [], // rodada atual, por jogador: { simbolo, acertou (MIRA), ganhou (ARENA: GIROU | FORA) }
  fase: 'escolha', // batalha: 'escolha' | 'luta' (animando) | 'resultado'
  cena: [], // elementos de cada metade da tela dividida (renderBatalha)
  ultimaRodada: null, // { antes, resultado, placarGravado }
  animacao: null, // { finalizar } enquanto a rodada anima
  depoisDoDesbloqueio: null, // função a chamar ao tocar "Continuar" no card de novo bichinho
  leituraNfc: null, // AbortController da leitura NFC em andamento (tela de espera)
  contagem: null, // timer da resolução automática (enquanto o DESFAZER está no ar)
  vs: null, // { seguir } enquanto a tela de VS está no ar
  ultimoToque: null, // { jogador, campo } — o que o DESFAZER apaga
};

const $ = (id) => document.getElementById(id);

function contraRival() {
  return Boolean(app.partida?.jogadores.some((j) => j.criatura.rival));
}

// ---------- utilidades de DOM ----------

function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k === 'role' || k.startsWith('data-') || k.startsWith('aria-')) e.setAttribute(k, v);
    else e[k] = v;
  }
  for (const f of filhos) {
    if (f != null) e.append(f);
  }
  return e;
}

// Converte a string SVG de js/icones.js (conteúdo fixo) em elemento.
function icone(svgTexto) {
  const t = document.createElement('template');
  t.innerHTML = svgTexto.trim();
  return t.content.firstElementChild;
}

function movimentoReduzido() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function mostrarTela(id) {
  document.body.classList.toggle('em-batalha', id === 'tela-batalha');
  // saiu do VS por outro caminho (ex.: voltar do navegador): o VS não segue sozinho
  if (id !== 'tela-vs' && app.vs) { const vs = app.vs; app.vs = null; vs.cancelar?.(); }
  if (id !== 'tela-espera') pararNfc();
  if (id !== 'tela-batalha') cancelarContagem();
  for (const tela of document.querySelectorAll('.tela')) {
    tela.hidden = tela.id !== id;
  }
  // Entrada curta (220ms) da tela nova. O @media prefers-reduced-motion desliga.
  const nova = $(id);
  if (nova) {
    nova.classList.remove('entra');
    void nova.offsetWidth;
    nova.classList.add('entra');
  }
  window.scrollTo(0, 0);
}

function rotulo(simbolo) {
  return ROTULOS[simbolo];
}

function corDaEspecie(criatura) {
  return ESPECIES[criatura.especie]?.cor ?? '#111';
}

function nomeDaEspecie(criatura) {
  return ESPECIES[criatura.especie]?.rotulo ?? criatura.especie;
}

function linhaEspecial(criatura) {
  return el('span', { class: 'linha-especial' },
    icone(iconeEspecial()),
    el('b', {}, `${criatura.especial.nome}: `),
    criatura.especial.texto,
  );
}

// Retrato do bichinho. simbolo: um dos quatro, 'VAZIO' (esperando o arremesso)
// ou null (só o bichinho). A cor do corpo vem do CSS (--cor-corpo, por
// data-especie), então quem contém o retrato precisa carregar data-especie.
function retrato(criatura, simbolo = null) {
  return icone(iconeBichinho(criatura.especie, simbolo));
}

// Arte do bichinho (js/arte.js) como <img>, ou null se ele ainda não tem arte.
// largura: tamanho exibido em px, para o srcset escolher entre 256 e 512.
// Fora da primeira tela que aparece, a imagem carrega sob demanda (lazy).
function imagemArte(criatura, largura, { lazy = true } = {}) {
  const arte = arteDaCriatura(criatura.codigo);
  if (!arte) return null;
  return el('img', {
    class: 'arte-bicho',
    src: arte.src,
    srcset: arte.srcset,
    sizes: `${largura}px`,
    width: largura,
    height: largura,
    alt: criatura.nome,
    decoding: 'async',
    loading: lazy ? 'lazy' : 'eager',
  });
}

function seloEscudo() {
  return el('span', { class: 'selo-escudo' }, icone(iconeEscudoAtivo()), 'ESCUDO');
}

function seloSimbolo(simbolo) {
  return el('span', { class: 'selo-simbolo', 'data-simbolo': simbolo }, icone(iconeSimbolo(simbolo)));
}

// Em partida espelhada os dois têm o mesmo nome; o número do jogador desfaz a dúvida.
function nomeJogador(estado, i) {
  const [a, b] = estado.jogadores;
  const nome = estado.jogadores[i].criatura.nome;
  return a.criatura.codigo === b.criatura.codigo ? `${nome} (J${i + 1})` : nome;
}

// ---------- barra de vida (transform: scaleX) ----------

function faixaDaVida(p) {
  if (p > 0.5) return 'alta';
  if (p >= 0.2) return 'media';
  return 'baixa';
}

// Visor de vida: barra da frente + "fantasma" que fica para trás mostrando de
// onde a vida caiu (só quando cai). Tudo animado com transform.
function barraVida(vida, max) {
  const fantasma = el('div', { class: 'vida-fantasma' });
  const barra = el('div', { class: 'vida-barra' });
  const numero = el('span', { class: 'vida-numero' });
  const bloco = el('div', { class: 'vida' },
    el('div', { class: 'vida-trilho', role: 'presentation' }, fantasma, barra),
    numero,
  );
  let quadro = null;

  const fracao = (v) => (max > 0 ? v / max : 0);
  const pintar = (v) => {
    const p = fracao(v);
    barra.style.transform = `scaleX(${p})`;
    const faixa = faixaDaVida(p);
    barra.classList.toggle('faixa-media', faixa === 'media');
    barra.classList.toggle('faixa-baixa', faixa === 'baixa');
    bloco.classList.toggle('baixa', faixa === 'baixa');
    bloco.setAttribute('aria-label', `Vida ${v} de ${max}`);
  };
  const escrever = (v) => { numero.textContent = `${v}/${max}`; };

  bloco.definir = (v) => {
    if (quadro) cancelAnimationFrame(quadro);
    quadro = null;
    barra.classList.remove('animar');
    fantasma.classList.remove('animar');
    fantasma.style.transform = `scaleX(${fracao(v)})`;
    pintar(v);
    escrever(v);
  };

  // Desliza a barra e conta o número junto.
  bloco.animarPara = (de, para, duracao) => {
    barra.classList.add('animar');
    if (para < de) {
      // levou dano: o fantasma parte da vida antiga e alcança a nova depois
      fantasma.style.transform = `scaleX(${fracao(de)})`;
      void fantasma.offsetWidth;
      fantasma.classList.add('animar');
    } else {
      fantasma.classList.remove('animar');
    }
    fantasma.style.transform = `scaleX(${fracao(para)})`;
    pintar(para);
    if (de === para) return;
    const inicio = performance.now();
    const passo = (agora) => {
      const t = Math.min(1, (agora - inicio) / duracao);
      escrever(Math.round(de + (para - de) * t));
      quadro = t < 1 ? requestAnimationFrame(passo) : null;
    };
    quadro = requestAnimationFrame(passo);
  };

  bloco.definir(vida);
  return bloco;
}

// ---------- coleção (localStorage pode não existir) ----------

function colecaoAtual() {
  return lerColecao(armazemColecao());
}

function textoEstatisticas(colecao, codigo) {
  const item = colecao?.[codigo];
  if (!item) return null;
  const { partidas, vitorias } = item;
  return el('span', { class: 'cartao-placar' },
    el('span', { class: 'v' }, `${vitorias} ${vitorias === 1 ? 'vitória' : 'vitórias'}`),
    ' · ',
    `${partidas} ${partidas === 1 ? 'partida' : 'partidas'}`,
  );
}

// O contador só olha a série à venda (SERIE_ATUAL): "2 de 2".
function atualizarBotaoColecao() {
  const { descobertos, total } = contarDaSerie(colecaoAtual(), SERIE_ATUAL);
  $('btn-colecao-texto').textContent = `Minha coleção · ${descobertos} de ${total}`;
}

function seloFundador(numero) {
  return el('span', { class: 'selo-fundador' }, icone(iconeEspecial()), `Fundador #${numero}`);
}

// ---------- cartão de criatura ----------

// tocavel: botão na tela de escolha; senão, cartão só informativo.
// Com arte, a imagem no lugar da silhueta. O Rato leva o selo de rival.
function cartaoCriatura(c, { tocavel, colecao }) {
  const comum = { style: `--cor-base: ${corDaEspecie(c)}`, 'data-especie': c.especie };
  const classe = `cartao${c.rival ? ' cartao-rival' : ''}`;
  const props = tocavel
    ? { ...comum, type: 'button', class: classe, 'data-codigo': c.codigo, 'aria-pressed': 'false' }
    : { ...comum, class: `${classe} cartao-info` };
  const img = imagemArte(c, 76);
  return el(tocavel ? 'button' : 'div', props,
    el('span', { class: `cartao-bicho${img ? ' com-arte' : ''}`, 'aria-hidden': 'true' }, img ?? retrato(c)),
    el('span', { class: 'cartao-dados' },
    c.rival ? el('span', { class: 'cartao-rival-selo' }, 'Rival de treino') : null,
    el('span', { class: 'cartao-topo' },
      el('span', {},
        el('span', { class: 'cartao-nome' }, c.nome),
        tocavel ? el('span', { class: 'cartao-marca' }, 'ESCOLHIDO') : null,
      ),
      el('span', { class: 'cartao-codigo' }, c.rival ? 'Sem peça: gire o seu pião por ele' : `${nomeDaEspecie(c)} · ${c.codigo}`),
    ),
    el('span', { class: 'cartao-status' },
      el('span', {}, icone(iconeVida()), ` ${c.vida} de vida`),
      el('span', {}, `Força ${c.forca}`),
    ),
    el('span', { class: 'cartao-especial' }, linhaEspecial(c)),
    textoEstatisticas(colecao, c.codigo),
    ),
  );
}

// Carta grande do bichinho recém-descoberto (tela de desbloqueio).
// Primeiro contato depois de escanear a peça física: é a tela que tem que dar
// um sorriso, então ganha raios, varredura holográfica e atributos em placa.
function cartaoDesbloqueio(c, fundador = null) {
  const atributo = (valor, nome, extra) => el('span', { class: `atributo ${extra}` },
    el('b', {}, String(valor)), el('span', {}, nome));
  return el('div', { class: `carta-nova${fundador ? ' carta-fundador' : ''}`, style: `--cor-base: ${corDaEspecie(c)}`, 'data-especie': c.especie },
    el('span', { class: 'carta-nova-raios', 'aria-hidden': 'true' }),
    el('div', { class: 'carta-nova-chapa' },
      el('span', { class: 'carta-nova-chip' }, icone(iconeQr()), 'Peça registrada'),
      fundador ? seloFundador(fundador) : null,
      arteDesbloqueio(c),
      el('span', { class: 'carta-nova-nome' }, c.nome),
      el('span', { class: 'carta-nova-especie' }, `${nomeDaEspecie(c)} · ${c.codigo}`),
      el('div', { class: 'carta-nova-atributos' },
        atributo(c.vida, 'vida', 'atributo-vida'),
        atributo(c.forca, 'força', 'atributo-forca'),
      ),
      el('span', { class: 'carta-nova-especial' }, linhaEspecial(c)),
      el('span', { class: 'carta-nova-brilho', 'aria-hidden': 'true' }),
    ),
  );
}

// Com arte: a imagem grande entra pulando. Sem arte: o retrato redondo de sempre.
function arteDesbloqueio(c) {
  const img = imagemArte(c, 200, { lazy: false });
  if (!img) return el('span', { class: 'cartao-avatar', 'aria-hidden': 'true' }, retrato(c));
  return el('span', { class: 'carta-nova-arte' }, img);
}

// ---------- botões de modo ----------

function botaoModo(modo) {
  const info = INFO_MODO[modo];
  return el('button', { type: 'button', class: 'botao botao-modo', 'data-modo': modo },
    el('span', { class: 'botao-modo-icone' }, icone(info.icone())),
    el('span', { class: 'botao-modo-texto' },
      el('span', { class: 'botao-modo-nome' }, info.nome),
      el('span', { class: 'botao-modo-explicacao' }, info.explicacao),
    ),
  );
}

function montarBotoesModo(container, aoEscolher) {
  container.replaceChildren(...MODOS.map(botaoModo));
  container.addEventListener('click', (ev) => {
    const botao = ev.target.closest('.botao-modo');
    if (!botao) return;
    aoEscolher(botao.dataset.modo);
  });
}

// ---------- tela: escolher bichinho ----------
//
// A lista manual mostra só o que já foi escaneado (js/colecao.js,
// listaDeEscolha), as séries futuras travadas e o Rato do Mato, o rival de
// treino de quem só tem uma peça. Nada é sorteado.

function montarListaEscolha() {
  $('lista-criaturas').addEventListener('click', (ev) => {
    const cartao = ev.target.closest('.cartao[data-codigo]');
    if (!cartao) return;
    esconderErro();
    selecionar(buscarCriaturaOuRival(cartao.dataset.codigo));
  });
}

// Série futura ainda não escaneada: travada, sem nome nem números.
function cartaoEmBreve(serie) {
  return el('div', { class: 'cartao cartao-em-breve', 'aria-label': `Série ${serie}, em breve` },
    el('span', { class: 'cartao-bicho', 'aria-hidden': 'true' }, icone(iconeMisterio())),
    el('span', { class: 'cartao-dados' },
      el('span', { class: 'cartao-nome' }, `Série ${serie}`),
      el('span', { class: 'cartao-codigo' }, 'Em breve')),
  );
}

// restrito: fallback da espera ("Não tenho a segunda peça") — a coleção e o Rato.
function abrirEscolha(jogador, codigoInicial = null, { restrito = false } = {}) {
  app.jogadorEscolhendo = jogador;
  app.escolhaRestrita = restrito;
  app.selecionada = null;
  const colecao = colecaoAtual();
  // não existe Rato contra Rato
  const comRival = !(jogador === 1 && app.escolhas[0]?.rival);
  const { itens, temPeca } = listaDeEscolha(colecao, { comRival });
  $('lista-criaturas').replaceChildren(...itens.map((item) => (item.tipo === 'em-breve'
    ? cartaoEmBreve(item.serie)
    : cartaoCriatura(item.criatura, { tocavel: true, colecao }))));
  $('escolha-titulo').textContent = restrito
    ? 'Escolha o oponente'
    : `Jogador ${jogador + 1}: escolha seu bichinho`;
  $('escolha-ou').textContent = restrito ? 'ou escolha da sua coleção:' : 'ou toque no seu bichinho:';
  const vazia = $('escolha-vazia');
  vazia.hidden = temPeca;
  vazia.textContent = 'Escaneie a sua peça para jogar com o seu bichinho.';
  const anterior = $('escolha-anterior');
  anterior.hidden = jogador === 0;
  if (jogador === 1) anterior.textContent = `Jogador 1: ${app.escolhas[0].nome}. Modo ${INFO_MODO[app.modo].nome}.`;
  if (restrito) anterior.textContent = `Jogador 1: ${app.escolhas[0].nome}.`;
  $('campo-codigo').value = '';
  esconderErro();
  if (codigoInicial !== null) {
    tentarCodigo(codigoInicial);
  } else if (app.escolhas[jogador] && (comRival || !app.escolhas[jogador].rival)) {
    selecionar(app.escolhas[jogador]);
  }
  atualizarSelecao();
  mostrarTela('tela-escolha');
}

function tentarCodigo(texto) {
  const digitado = String(texto ?? '').trim();
  if (!digitado) {
    mostrarErro('Digite o código que está na peça (ex: TAT01).');
    return;
  }
  const criatura = buscarCriatura(digitado);
  if (!criatura) {
    mostrarErro(`Não achamos o código "${digitado.slice(0, 12).toUpperCase()}". Confira a etiqueta da peça ou toque no bichinho na lista.`);
    selecionar(null);
    return;
  }
  esconderErro();
  $('campo-codigo').value = criatura.codigo;
  selecionar(criatura);
}

function selecionar(criatura) {
  app.selecionada = criatura;
  atualizarSelecao();
}

function atualizarSelecao() {
  for (const cartao of $('lista-criaturas').children) {
    const marcado = Boolean(cartao.dataset.codigo) && app.selecionada?.codigo === cartao.dataset.codigo;
    cartao.setAttribute('aria-pressed', String(marcado));
  }
  const confirmar = $('btn-escolha-confirmar');
  confirmar.disabled = !app.selecionada;
  confirmar.textContent = app.selecionada ? `Escolher ${app.selecionada.nome}` : 'Escolha um bichinho';
}

function mostrarErro(msg) {
  const erro = $('erro-codigo');
  erro.textContent = msg;
  erro.hidden = false;
}

function esconderErro() {
  $('erro-codigo').hidden = true;
}

function confirmarEscolha() {
  if (!app.selecionada) return;
  app.escolhas[app.jogadorEscolhendo] = app.selecionada;
  if (app.escolhaRestrita) {
    // veio da tela de espera: a peça escaneada não espera mais ninguém
    limparAguardando(armazemEspera());
    abrirVs(abrirModo);
  } else if (app.jogadorEscolhendo === 0) {
    abrirEscolha(1);
  } else {
    abrirVs(iniciarPartida);
  }
}

// ---------- tela: VS (o confronto) ----------
//
// Logo que a partida fica montada — duas peças lidas (QR ou NFC), a lista
// manual ou "Não tenho a segunda peça", inclusive contra o Rato — aparece o
// VS: a tela dividida na diagonal, cada metade na cor da espécie, a arte de
// cada bichinho entrando pelo seu lado, o nome grande e vida/força embaixo.
// O VS bate no meio (tremida, faíscas, som). Dura TEMPO_VS.total (<= 2,5 s);
// um toque em qualquer lugar pula. Com movimento reduzido, a mesma
// composição parada por TEMPO_VS.reduzido. Só transform e opacity (CSS).

const TEMPO_VS = { impacto: 540, total: 2300, reduzido: 1200 };

function ladoDoVs(c, colecao) {
  const fundador = colecao?.[c.codigo]?.fundador ?? null;
  const img = imagemArte(c, 220, { lazy: false });
  return el('div', { class: 'vs-conteudo' },
    el('span', { class: `vs-arte${img ? '' : ' sem-arte'}`, 'aria-hidden': 'true' }, img ?? retrato(c)),
    el('span', { class: 'vs-textos' },
      fundador ? seloFundador(fundador) : null,
      c.rival ? el('span', { class: 'vs-rival' }, 'Rival de treino') : null,
      el('span', { class: 'vs-nome' }, c.nome),
      el('span', { class: 'vs-numeros' },
        el('span', {}, icone(iconeVida()), ` ${c.vida} de vida`),
        el('span', {}, `Força ${c.forca}`)),
    ),
  );
}

// Faíscas em ângulos fixos (nada sorteado): o JS só diz para onde cada uma voa.
function faiscasDoVs() {
  return Array.from({ length: 14 }, (_, i) => {
    const angulo = (i / 14) * Math.PI * 2 + 0.2;
    const raio = 90 + (i % 3) * 38;
    return el('i', { style: `--dx: ${Math.round(Math.cos(angulo) * raio)}px; --dy: ${Math.round(Math.sin(angulo) * raio)}px; --a: ${(i % 4) * 25}ms;` });
  });
}

// depois: função chamada no fim (escolha de modo ou a partida direto).
function abrirVs(depois) {
  // contra o Rato ele fica em cima, como na batalha
  if (app.escolhas[1]?.rival) app.escolhas = [app.escolhas[1], app.escolhas[0]];
  const colecao = colecaoAtual();
  app.escolhas.forEach((c, i) => {
    const lado = $(`vs-lado-${i}`);
    lado.dataset.especie = c.especie;
    lado.style.setProperty('--cor-base', corDaEspecie(c));
    lado.replaceChildren(ladoDoVs(c, colecao));
  });
  $('vs-faiscas').replaceChildren(...faiscasDoVs());
  $('vs-leitura').textContent = `${app.escolhas[0].nome} contra ${app.escolhas[1].nome}!`;
  const tela = $('tela-vs');
  tela.classList.remove('anima', 'impacto');
  mostrarTela('tela-vs');

  let feito = false;
  const timers = [];
  const seguir = () => {
    if (feito) return;
    feito = true;
    timers.forEach(clearTimeout);
    tela.removeEventListener('click', seguir);
    app.vs = null;
    depois();
  };
  app.vs = {
    seguir,
    cancelar: () => { feito = true; timers.forEach(clearTimeout); tela.removeEventListener('click', seguir); },
  };
  tela.addEventListener('click', seguir);
  if (movimentoReduzido()) {
    som.tocar('vs');
    timers.push(setTimeout(seguir, TEMPO_VS.reduzido));
    return;
  }
  void tela.offsetWidth;
  tela.classList.add('anima');
  timers.push(setTimeout(() => {
    tela.classList.add('impacto');
    som.tocar('vs');
  }, TEMPO_VS.impacto));
  timers.push(setTimeout(seguir, TEMPO_VS.total));
}

// ---------- tela: modo (depois de escanear as duas peças) ----------

function abrirModo() {
  const [a, b] = app.escolhas;
  $('modo-dupla').replaceChildren(
    el('b', {}, a.nome), ' contra ', el('b', {}, b.nome),
  );
  mostrarTela('tela-modo');
}

// ---------- tela: batalha (tela dividida) ----------
//
// O celular fica no chão entre os dois jogadores. Cada um tem a sua metade:
// o Jogador 1 em cima (a metade é girada 180° pelo CSS, então fica de frente
// para ele), o Jogador 2 embaixo. A ordem dentro da metade é a mesma para os
// dois: o bichinho perto do meio da tela (é lá que a luta acontece) e os
// botões perto da borda, onde a mão da criança alcança.
//
// A luta acontece na mesma tela e sem botão de lutar: quando os dois
// responderam, o botão do meio vira DESFAZER por ESPERA_DESFAZER e a rodada
// resolve sozinha. Depois da animação os botões de símbolo já aceitam a
// próxima escolha: o primeiro toque limpa o resultado e começa a rodada nova.

// Contra o Rato do Mato a criança joga sozinha, sentada de um lado: o Rato
// fica sempre na metade de cima, e essa metade não gira (ver .metade-rival).
function iniciarPartida() {
  if (app.escolhas[1]?.rival) app.escolhas = [app.escolhas[1], app.escolhas[0]];
  app.partida = estadoInicial(app.escolhas[0], app.escolhas[1]);
  app.ultimaRodada = null;
  novaRodadaLimpa();
  renderBatalha();
  mostrarTela('tela-batalha');
}

function novaRodadaLimpa() {
  cancelarContagem();
  app.entradas = [0, 1].map(() => ({ simbolo: null, acertou: null, ganhou: null }));
  app.ultimoToque = null;
  app.fase = 'escolha';
}

// O bichinho da luta: a arte (js/arte.js) com o símbolo numa placa por cima,
// ou a silhueta desenhada com o símbolo gravado no peito.
function bichoDaLuta(criatura) {
  const img = imagemArte(criatura, 220, { lazy: false });
  if (!img) return el('div', { class: 'bicho-luta' }, retrato(criatura, 'VAZIO'));
  return el('div', { class: 'bicho-luta com-arte' },
    img, el('span', { class: 'painel-bicho-placa' }, icone(iconePlaca('VAZIO'))));
}

function botaoOpcao(classe, dados, svg, texto, nomeAcessivel) {
  return el('button', { type: 'button', class: classe, ...dados, 'aria-pressed': 'false', 'aria-label': nomeAcessivel },
    icone(svg), el('span', {}, texto));
}

// Pergunta extra da Mira, na metade do jogador: parou em cima do alvo?
// (A Batalha pergunta tudo de uma vez na sobreposição "Quem ganhou?".)
function linhaDoModo(modo, i) {
  const j = String(i);
  const quem = `jogador ${i + 1}`;
  if (modo === MIRA) {
    return el('div', { class: 'linha-modo opcoes-alvo', role: 'group', 'aria-label': `Alvo do ${quem}` },
      botaoOpcao('opcao-alvo', { 'data-jogador': j, 'data-acertou': 'sim' }, iconeAlvo(), 'Acertou', `Acertou o alvo, ${quem}`),
      botaoOpcao('opcao-alvo', { 'data-jogador': j, 'data-acertou': 'nao' }, iconeErrou(), 'Errou', `Errou o alvo, ${quem}`));
  }
  return null;
}

// Batalha: a sobreposição "Quem ganhou?". Uma coluna por jogador (foto, nome
// e os dois jeitos de ganhar) e o Empate no meio. Um toque resolve a rodada.
function montarQuemGanhou(estado) {
  estado.jogadores.forEach((j, i) => {
    const c = j.criatura;
    const nome = nomeJogador(estado, i);
    const opcao = (jeito, texto) => el('button', {
      type: 'button', class: 'qg-opcao', 'data-jogador': String(i), 'data-ganhou': jeito,
      'aria-label': `${texto}: ${nome} ganhou`,
    }, texto);
    $(`qg-lado-${i}`).replaceChildren(
      el('span', { class: 'qg-foto', 'data-especie': c.especie, style: `--cor-base: ${corDaEspecie(c)}`, 'aria-hidden': 'true' },
        imagemArte(c, 120, { lazy: false }) ?? retrato(c)),
      el('span', { class: 'qg-nome' }, nome),
      opcao(GIROU, 'Girou mais'),
      opcao(FORA, 'Jogou pra fora'),
    );
  });
}

function renderBatalha() {
  const estado = app.partida;
  const modo = app.modo;
  const tela = $('tela-batalha');
  tela.classList.remove('fase-luta', 'fase-impacto', 'fase-texto', 'fase-final', 'sem-transicao');
  tela.dataset.modo = modo;
  tela.classList.toggle('contra-rival', contraRival());

  for (const chip of [$('rodada-cima'), $('rodada-baixo')]) {
    chip.replaceChildren(
      el('span', { class: 'chip-rodada-nome' }, 'Rodada'),
      el('b', {}, String(estado.rodada + 1)),
    );
    chip.setAttribute('aria-label', `Rodada ${estado.rodada + 1}, modo ${INFO_MODO[modo].nome}`);
  }

  app.cena = estado.jogadores.map((j, i) => {
    const metade = $(`metade-${i}`);
    metade.className = `metade metade-${i}${j.criatura.rival ? ' metade-rival' : ''}`;
    metade.style.setProperty('--cor-base', corDaEspecie(j.criatura));
    metade.dataset.especie = j.criatura.especie;
    metade.classList.toggle('com-escudo', j.escudo);
    metade.classList.toggle('tem-arte', Boolean(arteDaCriatura(j.criatura.codigo)));

    const bicho = bichoDaLuta(j.criatura);
    const barra = barraVida(j.vida, j.criatura.vida);
    const escudo = seloEscudo();
    escudo.classList.toggle('desligado', !j.escudo);
    const flutuantes = el('div', { class: 'flutuantes' });
    const estampa = el('span', { class: 'estampa' });
    const dica = el('p', { class: 'dica' });
    const resultado = el('div', { class: 'lado-resultado' });
    // aria-label com o jogador: a metade de cima está girada, mas o leitor de
    // tela lê o DOM, e os dois grupos precisam soar diferentes.
    const botoes = SIMBOLOS.map((s) =>
      el('button', {
        type: 'button', class: 'simbolo', 'data-jogador': String(i), 'data-simbolo': s, 'aria-pressed': 'false',
        'aria-label': `${NOME_SIMBOLO[s]}, jogador ${i + 1}`,
      },
      icone(iconeSimbolo(s)),
      el('span', { 'aria-hidden': 'true' }, rotulo(s)),
      ));
    // De cima (perto do meio da tela) para baixo (perto do jogador):
    //   palco — o bichinho e, ao lado, a pergunta do modo ou o resultado
    //   cabeça — nome e vida
    //   base — os botões de símbolo (sempre ali: depois da luta já aceitam a
    //          próxima escolha). O resultado e os selos ficam ao lado do bichinho.
    const corpo = el('div', { class: 'metade-corpo' },
      el('div', { class: 'palco-luta' },
        el('div', { class: 'bicho-lugar' },
          el('span', { class: 'halo' }),
          bicho,
          escudo,
          flutuantes,
        ),
        el('div', { class: 'lado' },
          el('div', { class: 'lado-info' },
            dica,
            linhaDoModo(modo, i),
            el('p', { class: 'painel-especial' }, linhaEspecial(j.criatura))),
          resultado,
        ),
        estampa,
      ),
      el('div', { class: 'metade-cabeca' },
        el('span', { class: 'metade-nome' },
          el('span', { class: 'metade-jogador' }, j.criatura.rival ? 'RIVAL' : `J${i + 1}`), nomeJogador(estado, i)),
        barra,
      ),
      el('div', { class: 'base' },
        el('div', { class: 'simbolos', role: 'group', 'aria-label': `Símbolo do jogador ${i + 1}` }, ...botoes),
        // Batalha: sem símbolos; depois do resultado, este botão chama a próxima rodada.
        el('button', { type: 'button', class: 'botao botao-principal botao-proxima', hidden: true }, 'Girar de novo'),
      ),
    );
    metade.replaceChildren(corpo);
    return { metade, corpo, bicho, barra, escudo, flutuantes, estampa, dica, resultado, criatura: j.criatura };
  });
  if (modo === ARENA) montarQuemGanhou(estado);
  atualizarEntradas();
}

// Rolar e Mira: a rodada resolve quando os dois responderam. (A Batalha
// resolve no toque da sobreposição.)
function entradaPronta(e) {
  if (app.modo === MIRA && e.acertou === null) return false;
  return e.simbolo !== null;
}

// Contra o Rato ninguém joga do outro lado: a criança gira o próprio pião de
// novo, pelo Rato, e toca o resultado na metade dele.
function textoDica(e, criatura) {
  const nada = e.simbolo === null && e.acertou === null;
  if (criatura.rival && nada && app.modo !== ARENA) return 'Gire o pião pelo Rato';
  if (app.modo === ARENA) return criatura.rival ? 'Gire um pião pelo Rato na bandeja' : 'Girem os piões na bandeja!';
  if (app.modo === MIRA && e.acertou === null) return 'Parou em cima do alvo?';
  if (e.simbolo === null) return 'Qual desenho ficou para cima?';
  return 'Pronto!';
}

function marcarGrupo(grupo, atributo, valor) {
  if (!grupo) return;
  grupo.classList.toggle('tem-escolha', valor !== null);
  for (const b of grupo.children) {
    b.setAttribute('aria-pressed', String(valor !== null && b.dataset[atributo] === (valor ? 'sim' : 'nao')));
  }
}

function atualizarEntradas() {
  const batalha = app.modo === ARENA;
  app.cena.forEach((c, i) => {
    const e = app.entradas[i];
    // O bichinho já mostra o símbolo tocado: confirma a escolha sem texto.
    // Na Batalha não há símbolo: só o bichinho.
    const simbolo = batalha ? null : (e.simbolo || 'VAZIO');
    const placa = c.bicho.querySelector('.painel-bicho-placa');
    if (placa) placa.replaceChildren(...(simbolo ? [icone(iconePlaca(simbolo))] : []));
    else c.bicho.replaceChildren(retrato(c.criatura, simbolo));

    const grupo = c.corpo.querySelector('.simbolos');
    grupo.hidden = batalha;
    grupo.classList.toggle('tem-escolha', e.simbolo !== null);
    for (const b of grupo.children) b.setAttribute('aria-pressed', String(b.dataset.simbolo === e.simbolo));
    marcarGrupo(c.corpo.querySelector('.opcoes-alvo'), 'acertou', e.acertou);
    const proxima = c.corpo.querySelector('.botao-proxima');
    proxima.hidden = !batalha;
    proxima.disabled = app.fase !== 'resultado' || Boolean(app.ultimaRodada?.resultado.fim.terminou);

    const pronto = !batalha && entradaPronta(e);
    c.dica.textContent = textoDica(e, c.criatura);
    c.dica.classList.toggle('pronto', pronto);
    c.metade.classList.toggle('pronta', pronto);
  });
  $('quem-ganhou').hidden = !(batalha && app.fase === 'escolha');
  // tudo respondido: arma a resolução automática (cada toque novo reinicia)
  if (!batalha && app.entradas.every(entradaPronta)) armarContagem();
  else cancelarContagem();
  atualizarCentro();
}

// O mesmo texto nas duas metades do botão: uma de cabeça para baixo, para o
// jogador de cima.
function rotularLutar(texto) {
  const botao = $('btn-lutar');
  for (const s of botao.querySelectorAll('.lutar-texto')) s.textContent = texto;
}

// O botão do meio: VS (esperando), DESFAZER (contagem), VER FIM (acabou).
function atualizarCentro() {
  const botao = $('btn-lutar');
  const acabou = app.fase === 'resultado' && Boolean(app.ultimaRodada?.resultado.fim.terminou);
  botao.classList.toggle('contando', Boolean(app.contagem));
  if (app.contagem) {
    rotularLutar('DESFAZER');
    botao.disabled = false;
    botao.setAttribute('aria-label', 'Desfazer a última escolha');
  } else if (acabou) {
    rotularLutar('VER FIM');
    botao.disabled = false;
    botao.removeAttribute('aria-label');
  } else {
    rotularLutar('VS');
    botao.disabled = app.fase !== 'luta';
    botao.removeAttribute('aria-label');
  }
  botao.setAttribute('aria-disabled', app.fase === 'luta' ? 'true' : 'false');
}

function armarContagem() {
  cancelarContagem();
  app.contagem = setTimeout(() => {
    app.contagem = null;
    resolver();
  }, ESPERA_DESFAZER);
  // o anel em volta do DESFAZER fecha em ESPERA_DESFAZER (reinicia a cada toque)
  const botao = $('btn-lutar');
  botao.classList.remove('contando');
  void botao.offsetWidth;
  $('resultado-leitura').textContent = 'Os dois responderam. A luta começa já; toque em Desfazer para corrigir.';
}

function cancelarContagem() {
  if (!app.contagem) return;
  clearTimeout(app.contagem);
  app.contagem = null;
  if (!$('tela-batalha').hidden) atualizarCentro();
}

// DESFAZER: apaga a última resposta tocada; a rodada espera de novo.
function desfazer() {
  cancelarContagem();
  const t = app.ultimoToque;
  if (t) app.entradas[t.jogador][t.campo] = null;
  app.ultimoToque = null;
  atualizarEntradas();
  $('resultado-leitura').textContent = t ? `Desfeito. Jogador ${t.jogador + 1}, escolha de novo.` : '';
}

// Lê o botão tocado: { jogador, campo, valor }.
function lerToque(botao) {
  const jogador = Number(botao.dataset.jogador);
  if (botao.classList.contains('simbolo')) return { jogador, campo: 'simbolo', valor: botao.dataset.simbolo };
  return { jogador, campo: 'acertou', valor: botao.dataset.acertou === 'sim' };
}

function aplicarToque(t) {
  const e = app.entradas[t.jogador];
  // tocar de novo na mesma opção desmarca
  e[t.campo] = e[t.campo] === t.valor ? null : t.valor;
  app.ultimoToque = { jogador: t.jogador, campo: t.campo };
  atualizarEntradas();
}

function tocarBatalha(ev) {
  if (app.animacao) return;
  if (ev.target.closest('.qg-sair')) {
    $('btn-sair').click();
    return;
  }
  const resposta = ev.target.closest('.qg-opcao');
  if (resposta) {
    if (app.fase === 'escolha') responderBatalha(resposta);
    return;
  }
  const botao = ev.target.closest('.simbolo, .opcao-alvo');
  if (app.fase === 'resultado') {
    // Depois da luta: tocar num símbolo (ou no resultado) já começa a rodada
    // seguinte, sem botão de "próxima". Na Batalha, "Girar de novo" abre a
    // pergunta da rodada seguinte.
    if (app.ultimaRodada?.resultado.fim.terminou) return;
    if (!botao && !ev.target.closest('.palco-luta, .botao-proxima')) return;
    const toque = botao && !botao.disabled ? lerToque(botao) : null;
    proximaRodada();
    if (toque) aplicarToque(toque);
    return;
  }
  if (app.fase !== 'escolha' || !botao) return;
  aplicarToque(lerToque(botao));
}

function tocarLutar() {
  if (app.animacao) return;
  if (app.contagem) desfazer();
  else if (app.fase === 'resultado' && app.ultimaRodada?.resultado.fim.terminou) {
    renderFim();
    mostrarTela('tela-fim');
  }
}

// Batalha: um toque na sobreposição diz quem ganhou e como (ou Empate) e já resolve.
function responderBatalha(botao) {
  app.entradas = [0, 1].map(() => ({ simbolo: null, acertou: null, ganhou: null }));
  if (botao.dataset.ganhou !== 'EMPATE') app.entradas[Number(botao.dataset.jogador)].ganhou = botao.dataset.ganhou;
  resolver();
}

function resolver() {
  const batalha = app.modo === ARENA;
  if (app.fase !== 'escolha' || (!batalha && !app.entradas.every(entradaPronta))) return;
  const antes = app.partida;
  const resultado = resolverRodadaModo(app.modo, antes, app.entradas);
  app.partida = resultado.estado;
  app.ultimaRodada = { antes, resultado, placarGravado: false };
  if (resultado.fim.terminou) {
    const codigos = resultado.estado.jogadores.map((j) => j.criatura.codigo);
    app.ultimaRodada.placarGravado = registrarPartida(armazemColecao(), codigos, resultado.fim.vencedor);
  }
  app.fase = 'luta';
  app.ultimoToque = null;
  $('quem-ganhou').hidden = true;
  const luta = prepararLuta();
  atualizarCentro();
  animarLuta(luta);
}

// ---------- a rodada contada em cada metade ----------

// O nome do golpe em letras grandes (js/regras.js, golpeDaRodada). "Venceu" e
// "perdeu" ficam só para a tela de fim da partida.
const NOME_GOLPE = {
  GARRADA: 'Garrada!',
  DEFENDEU: 'Defendeu!',
  TROPECOU: 'Tropeçou!',
  CHOQUE: 'Choque!',
  TROPECARAM: 'Tropeçaram!',
  EMPATE: 'Empate!',
  GIROU: 'Girou mais!',
  FORA: 'Pra fora!',
};

// Conta a rodada a partir do resumo de js/regras.js. As duas metades mostram
// o mesmo nome do golpe e, cada uma, o número do que aconteceu com a sua vida:
//   golpe     — { codigo, texto }: GARRADA!, DEFENDEU!, o nome do especial...
//   etiquetas — os detalhes viram selos curtos, cada um na metade de quem ele fala
//   nota      — no máximo uma linha, só para o que a tela sozinha esconderia
//   leitura   — a rodada por extenso, para quem usa leitor de tela
function descreverRodada(estado, resumo) {
  const nome = (i) => nomeJogador(estado, i);
  const [sa] = resumo.simbolos;
  const batalha = resumo.modo === ARENA;
  const codigo = golpeDaRodada(resumo);
  const v = resumo.vencedor;
  const especial = codigo === 'ESPECIAL' ? estado.jogadores[v].criatura.especial : null;
  const golpe = { codigo, texto: especial ? `${especial.nome}!` : NOME_GOLPE[codigo] };
  const confronto = batalha
    ? `${nome(0)} contra ${nome(1)}, na bandeja.`
    : `${nome(0)}: ${rotulo(resumo.simbolos[0])} × ${nome(1)}: ${rotulo(resumo.simbolos[1])}.`;
  const zerados = estado.jogadores.every((j) => j.vida === 0);

  if (resumo.choque) {
    // mesmo símbolo (ou empate na Batalha): cada um perde CHOQUE_DANO (o escudo segura)
    const etiquetas = [0, 1].filter((i) => resumo.choqueBloqueado[i])
      .map((i) => ({ quem: i, tipo: 'escudo', svg: iconeEscudoAtivo(), texto: 'Escudo segurou' }));
    const partes = [0, 1].map((i) => (resumo.choqueBloqueado[i]
      ? `o escudo do ${nome(i)} segurou o choque e acabou`
      : `${nome(i)} perdeu ${resumo.danoChoque[i]} de vida`));
    return {
      golpe,
      etiquetas,
      nota: zerados ? { quem: null, texto: 'Os dois ficaram sem vida!' } : null,
      leitura: `${confronto} Choque! ${batalha ? 'Empate na bandeja' : `Os dois tiraram ${rotulo(sa)}`}: ${partes.join(' e ')}.${zerados ? ' Os dois ficaram sem vida!' : ''}`,
    };
  }

  if (v === null) {
    return {
      golpe,
      etiquetas: [],
      nota: null,
      leitura: `${confronto} ${golpe.texto} Ninguém perde vida.`,
    };
  }

  const p = 1 - v;
  const etiquetas = [];
  const selo = (quem, tipo, svg, texto) => etiquetas.push({ quem, tipo, svg, texto });
  if (resumo.jeito === GIROU) selo(v, 'girou', iconeArena(), `Girou mais +${resumo.bonusGirou}`);
  if (resumo.jeito === FORA) selo(p, 'fora', iconeFora(), `Pra fora +${resumo.bonusFora}`);
  if (resumo.modo === MIRA) {
    if (resumo.metade) selo(v, 'errou', iconeErrou(), 'Errou: metade');
    else if (resumo.bonusAcerto > 0) selo(v, 'alvo', iconeAlvo(), `Alvo +${resumo.bonusAcerto}`);
  }
  if (resumo.bonusTropeco > 0 && codigo !== 'TROPECOU') selo(p, 'tropeco', iconeSimbolo(TROPECO), `Tropeço +${resumo.bonusTropeco}`);
  if (resumo.bloqueado) selo(p, 'escudo', iconeEscudoAtivo(), 'Escudo segurou');
  if (resumo.escudoAtivado) selo(v, 'escudo', iconeEscudoAtivo(), 'Escudo ligado');

  // Uma nota só, e só quando a tela sozinha enganaria a criança. Curta na
  // tela (cabe ao lado do bichinho em 360x640); por extenso no leitor de tela.
  let nota = null;
  if (resumo.recuo > 0 && estado.jogadores[v].vida === 0) {
    nota = { quem: v, texto: 'Se machucou e ficou sem vida!', falado: 'Se machucou com o próprio golpe e ficou sem vida!' };
  } else if (especial?.roubo && resumo.bloqueado) {
    nota = { quem: v, texto: 'Escudo: não roubou vida.', falado: 'O dano não passou, então não rouba vida.' };
  } else if (especial?.escudo && !resumo.escudoAtivado) {
    nota = { quem: v, texto: 'Escudo não acumula.', falado: 'Já estava com escudo, e o escudo não acumula.' };
  } else if (resumo.modo === MIRA && !resumo.metade && resumo.bonusAcerto === 0 && resumo.acertou?.[v]) {
    nota = { quem: v, texto: `Alvo: o extra já é +${resumo.bonusTropeco}.`, falado: `Acertou o alvo, mas o extra da rodada já é +${resumo.bonusTropeco} pelo tropeço.` };
  } else if (zerados) {
    nota = { quem: null, texto: 'Os dois ficaram sem vida!' };
  }

  let jogada;
  if (resumo.jeito === GIROU) jogada = 'girou mais tempo na bandeja';
  else if (resumo.jeito === FORA) jogada = `jogou ${nome(p)} pra fora da bandeja`;
  else jogada = especial ? `usou ${especial.nome}` : `ganhou a rodada com ${rotulo(resumo.simboloVencedor)}`;
  const efeito = resumo.bloqueado
    ? `o escudo do ${nome(p)} anulou o dano e acabou`
    : `${resumo.dano} de dano no ${nome(p)}`;
  const leitura = [`${confronto} ${golpe.texto} ${nome(v)} ${jogada}: ${efeito}.`]
    .concat(resumo.cura > 0 ? [`${nome(v)} ganhou ${resumo.cura} de vida.`] : [])
    .concat(resumo.recuo > 0 ? [`${nome(v)} perdeu ${resumo.recuo} de vida com o próprio golpe.`] : [])
    .concat(resumo.escudoAtivado ? [`${nome(v)} está com escudo.`] : [])
    .concat(nota ? [nota.quem === null ? nota.texto : `${nome(nota.quem)}: ${nota.falado ?? nota.texto}`] : [])
    .join(' ');

  return { golpe, etiquetas, nota, leitura };
}

function etiqueta(e) {
  return el('span', { class: `etiqueta etiqueta-${e.tipo}` }, icone(e.svg), el('span', {}, e.texto));
}

// O número grande de cada painel: quanto a vida daquele jogador mudou na
// rodada (-3, +4, 0). Com o escudo segurando, o 0 vem com o escudo.
function numeroDoPainel(antes, depois, segurou) {
  const delta = depois - antes;
  const tipo = delta < 0 ? 'dano' : delta > 0 ? 'cura' : (segurou ? 'escudo' : 'zero');
  const texto = delta < 0 ? `−${-delta}` : delta > 0 ? `+${delta}` : '0';
  const falado = delta < 0 ? `perdeu ${-delta} de vida` : delta > 0 ? `ganhou ${delta} de vida` : 'vida igual';
  return el('p', { class: `numero-painel numero-${tipo}`, 'aria-label': falado },
    tipo === 'escudo' ? icone(iconeEscudoAtivo()) : null, texto);
}

// Nome de golpe comprido ("Língua Chicote!") não pode vazar do lado do
// bichinho: diminui a letra até caber (mede uma vez, antes da animação).
function caberNaLargura(elemento, minimo = 15) {
  let tamanho = parseFloat(getComputedStyle(elemento).fontSize);
  for (let n = 0; n < 6 && elemento.scrollWidth > elemento.clientWidth + 1 && tamanho > minimo; n++) {
    tamanho = Math.max(minimo, tamanho * 0.88);
    elemento.style.fontSize = `${tamanho}px`;
  }
}

// O papel de cada jogador na luta (e a pose em que ele termina) e os números
// que sobem do bichinho.
function papelNaLuta(resumo, i) {
  if (resumo.choque) {
    const flutuantes = resumo.choqueBloqueado[i]
      ? [{ tipo: 'bloqueado', valor: CHOQUE_DANO }]
      : [{ tipo: 'dano', texto: `-${resumo.danoChoque[i]}` }];
    return { papel: 'choque', flutuantes };
  }
  if (resumo.vencedor === null) return { papel: 'empate', flutuantes: [] };
  if (i !== resumo.vencedor) {
    // Batalha: quem foi jogado para fora não avança para o choque
    const fora = resumo.jeito === FORA;
    if (resumo.bloqueado) {
      return { papel: 'protegido', fora, flutuantes: [{ tipo: 'bloqueado', valor: resumo.danoPrevisto }] };
    }
    const tombou = resumo.simbolos[i] === TROPECO;
    return {
      papel: tombou ? 'tombou' : 'perdeu',
      fora,
      flutuantes: [{ tipo: 'dano', texto: `-${resumo.dano}`, forte: resumo.dano >= 5 }],
    };
  }
  const flutuantes = [];
  if (resumo.cura > 0) flutuantes.push({ tipo: 'cura', texto: `+${resumo.cura}` });
  if (resumo.recuo > 0) flutuantes.push({ tipo: 'dano', texto: `-${resumo.recuo}` });
  return { papel: 'venceu', recuo: resumo.recuo > 0, flutuantes };
}

function numeroFlutuante(f) {
  if (f.tipo === 'bloqueado') {
    return el('span', { class: 'flutua bloqueado', 'aria-label': `${f.valor} de dano bloqueado` }, el('s', {}, String(f.valor)));
  }
  return el('span', { class: `flutua ${f.tipo}${f.forte ? ' forte' : ''}` }, f.texto);
}

// Liga os efeitos da rodada. data-fx escolhe a cena do especial (lingua,
// bola ou estrela — o genérico, também para código desconhecido).
function configurarEfeitos(tela, estado, resumo) {
  const v = resumo.vencedor;
  const houveGolpe = v !== null;
  // o especial só "acontece" quando a face especial venceu (nunca na Batalha)
  const usouEspecial = houveGolpe && resumo.simboloVencedor === ESPECIAL && resumo.modo !== ARENA;
  const codigo = usouEspecial ? estado.jogadores[v].criatura.codigo : '';
  tela.dataset.efeito = codigo;
  tela.dataset.fx = usouEspecial ? (EFEITO_ESPECIAL[codigo] ?? 'estrela') : '';
  tela.dataset.golpe = houveGolpe ? (resumo.bloqueado ? 'bloqueado' : 'dano') : (resumo.choque ? 'dano' : 'nenhum');
  tela.dataset.tropeco = resumo.bonusTropeco > 0 ? 'sim' : 'nao';
  return usouEspecial;
}

// Deixa as duas metades prontas para a luta: trava os botões, escreve o
// resultado de cada uma (escondido até a fase do texto) e devolve o que a
// animação precisa.
function prepararLuta() {
  const { antes, resultado } = app.ultimaRodada;
  const { estado, resumo, fim } = resultado;
  const texto = descreverRodada(estado, resumo);
  const tela = $('tela-batalha');
  const especial = configurarEfeitos(tela, estado, resumo);
  tela.classList.remove('fase-luta', 'fase-impacto', 'fase-texto', 'fase-final', 'sem-transicao');

  const lados = app.cena.map((c, i) => {
    const jAntes = antes.jogadores[i];
    const j = estado.jogadores[i];
    const papel = papelNaLuta(resumo, i);
    c.metade.classList.remove('com-escudo', 'pronta', 'atacante');
    c.metade.dataset.papel = papel.papel;
    c.metade.classList.toggle('fora', Boolean(papel.fora));
    if (papel.papel === 'venceu') c.metade.classList.add('atacante');
    for (const b of c.corpo.querySelectorAll('button')) b.disabled = true;

    c.estampa.textContent = papel.papel === 'tombou' ? `TROPEÇOU! +${resumo.bonusTropeco}` : '';
    const minhas = texto.etiquetas.filter((e) => e.quem === i);
    const nota = texto.nota && (texto.nota.quem === null || texto.nota.quem === i) ? texto.nota.texto : null;
    const segurou = (resumo.bloqueado && i !== resumo.vencedor) || resumo.choqueBloqueado[i];
    const golpe = el('p', { class: `veredito golpe-${texto.golpe.codigo.toLowerCase()}` }, texto.golpe.texto);
    // a nota (se houver) fica ao lado do número, para caber em tela baixa
    c.resultado.replaceChildren(...[
      golpe,
      el('div', { class: 'linha-numero' }, numeroDoPainel(jAntes.vida, j.vida, segurou), nota ? el('p', { class: 'nota' }, nota) : null),
      minhas.length ? el('div', { class: 'etiquetas selos-rodada' }, ...minhas.map(etiqueta)) : null,
    ].filter(Boolean));
    caberNaLargura(golpe);
    return {
      ...c, papel,
      vidaAntes: jAntes.vida, vidaDepois: j.vida,
      escudoAntes: jAntes.escudo, escudoDepois: j.escudo,
      avanca: !papel.fora,
    };
  });

  $('resultado-leitura').textContent = texto.leitura;
  return { tela, lados, resumo, fim, especial, golpe: texto.golpe.codigo };
}

// ---------- a cena do especial ----------
//
// Só nas rodadas em que a face ESPECIAL venceu, antes da luta: o fundo
// escurece, a arte do bichinho entra grande, o nome do especial aparece e o
// efeito vai de um painel para o outro. Dura TEMPO_CENA.total; somada à luta
// (TEMPO.fim), a rodada de especial fica em até 2,5 s. As rodadas normais não
// passam por aqui. Cada especial tem a sua forma, cor e movimento:
//   lingua  — Língua Chicote: língua rosa, fina e elástica, estica até o outro
//             e volta puxando um coração (a vida roubada)
//   bola    — Bola de Ferro: esfera cinza e pesada cai do alto no outro, com
//             poeira e tremor, e o escudo azul acende no Couraça
//   estrela — genérico (os outros especiais e código desconhecido)

const TEMPO_CENA = {
  total: 1400,
  efeito: 450,
};

// Centro de um lado dentro de #tela-batalha (a cena é posicionada nela).
function centroNaCena(lado, base) {
  const c = centroNaTela(lado);
  return { x: c.x - base.left, y: c.y - base.top };
}

const em0 = (x, y, extra = '') => `translate3d(${x}px, ${y}px, 0) ${extra}`;

function tocarCena({ tela, lados, resumo }, animar, em) {
  const cena = $('cena-especial');
  const v = resumo.vencedor;
  const p = 1 - v;
  const criatura = lados[v].criatura;
  const base = tela.getBoundingClientRect();
  const cv = centroNaCena(lados[v], base);
  const cp = centroNaCena(lados[p], base);
  const fx = tela.dataset.fx;
  // a arte vem de frente para quem usou o especial (a metade de cima está girada)
  const girada = v === 0 && !contraRival() ? ' rotate(180deg)' : '';
  // a arte grande fica no painel de quem usou o especial, um pouco para fora,
  // sem cobrir a faixa do nome no meio da tela
  const arteEm = { x: base.width / 2, y: cv.y + (cv.y < base.height / 2 ? -14 : 14) };

  cena.hidden = false;
  cena.dataset.fx = fx;
  const arte = cena.querySelector('.cena-arte');
  arte.dataset.especie = criatura.especie;
  arte.style.setProperty('--cor-base', corDaEspecie(criatura));
  arte.replaceChildren(imagemArte(criatura, 200, { lazy: false }) ?? retrato(criatura));
  for (const s of cena.querySelectorAll('.cena-nome span')) s.textContent = `${criatura.especial.nome}!`;

  const T = TEMPO_CENA.total;
  animar(cena.querySelector('.cena-fundo'), [
    { opacity: 0 }, { opacity: 1, offset: 0.14 }, { opacity: 1, offset: 0.86 }, { opacity: 0 },
  ], { duration: T, fill: 'none' });
  animar(arte, [
    { opacity: 0, transform: em0(cv.x, cv.y, `scale(0.3)${girada}`) },
    { opacity: 1, transform: em0(arteEm.x, arteEm.y, `scale(1.08)${girada}`), offset: 0.2, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)' },
    { opacity: 1, transform: em0(arteEm.x, arteEm.y, `scale(1)${girada}`), offset: 0.28 },
    { opacity: 1, transform: em0(arteEm.x, arteEm.y, `scale(1)${girada}`), offset: 0.82 },
    { opacity: 0, transform: em0(cv.x, cv.y, `scale(0.5)${girada}`) },
  ], { duration: T, fill: 'none' });
  animar(cena.querySelector('.cena-nome'), [
    { opacity: 0, transform: 'scaleX(0.2)' },
    { opacity: 1, transform: 'scaleX(1.04)', offset: 0.12 },
    { opacity: 1, transform: 'scaleX(1)', offset: 0.2 },
    { opacity: 1, transform: 'scaleX(1)', offset: 0.85 },
    { opacity: 0, transform: 'scaleX(1)' },
  ], { duration: T, fill: 'none', easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' });

  const t = TEMPO_CENA.efeito;
  em(t, () => som.tocar(`especial-${fx}`));
  if (fx === 'lingua') {
    // a língua sai da boca da arte grande e estica até o outro bichinho
    const dx = cp.x - arteEm.x;
    const dy = cp.y - arteEm.y;
    const lingua = cena.querySelector('.fx-lingua');
    lingua.style.height = `${Math.round(Math.hypot(dx, dy))}px`;
    const giro = `rotate(${Math.atan2(dx, -dy).toFixed(3)}rad)`;
    em(t, () => animar(lingua, [
      { opacity: 1, transform: em0(arteEm.x, arteEm.y, `${giro} scaleY(0.04)`) },
      { opacity: 1, transform: em0(arteEm.x, arteEm.y, `${giro} scaleY(1.1)`), offset: 0.22, easing: 'cubic-bezier(0.3, 1.4, 0.5, 1)' },
      { opacity: 1, transform: em0(arteEm.x, arteEm.y, `${giro} scaleY(1)`), offset: 0.4 },
      { opacity: 1, transform: em0(arteEm.x, arteEm.y, `${giro} scaleY(0.04)`), offset: 0.92, easing: 'cubic-bezier(0.6, 0, 0.9, 0.5)' },
      { opacity: 0, transform: em0(arteEm.x, arteEm.y, `${giro} scaleY(0.04)`) },
    ], { duration: 820, fill: 'none' }));
    if (resumo.cura > 0) {
      // a vida roubada volta presa na ponta da língua
      em(t + 300, () => animar(cena.querySelector('.fx-coracao'), [
        { opacity: 0, transform: em0(cp.x, cp.y, 'scale(0.5)') },
        { opacity: 1, transform: em0(cp.x, cp.y, 'scale(1.35)'), offset: 0.2 },
        { opacity: 1, transform: em0(arteEm.x, arteEm.y, 'scale(1.1)'), offset: 0.88, easing: 'cubic-bezier(0.6, 0, 0.9, 0.5)' },
        { opacity: 0, transform: em0(arteEm.x, arteEm.y, 'scale(0.6)') },
      ], { duration: 540, fill: 'none' }));
    }
    em(t + 140, () => tremer(lados[p].corpo, animar, 5, 260));
  } else if (fx === 'bola') {
    // cai do alto (vista de cima: grande e longe → do tamanho certo no chão)
    const bola = cena.querySelector('.fx-bola');
    em(t, () => animar(bola, [
      { opacity: 0, transform: em0(cp.x, cp.y, 'scale(3.4)') },
      { opacity: 1, transform: em0(cp.x, cp.y, 'scale(2.2)'), offset: 0.2 },
      { opacity: 1, transform: em0(cp.x, cp.y, 'scale(1)'), offset: 0.46, easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
      { opacity: 1, transform: em0(cp.x, cp.y, 'scale(1.22, 0.78)'), offset: 0.54 },
      { opacity: 1, transform: em0(cp.x, cp.y, 'scale(1)'), offset: 0.66 },
      { opacity: 1, transform: em0(cp.x, cp.y, 'scale(1)'), offset: 0.9 },
      { opacity: 0, transform: em0(cp.x, cp.y, 'scale(0.9)') },
    ], { duration: 780, fill: 'none' }));
    const impacto = t + Math.round(780 * 0.46);
    em(impacto, () => {
      animar(cena.querySelector('.fx-poeira'), [
        { opacity: 0.95, transform: em0(cp.x, cp.y, 'scale(0.3)') },
        { opacity: 0, transform: em0(cp.x, cp.y, 'scale(2.3)') },
      ], { duration: 420, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)', fill: 'none' });
      tremer(lados[p].corpo, animar, 12, 340);
    });
    em(impacto + 120, () => animar(cena.querySelector('.fx-domo'), [
      { opacity: 0, transform: em0(arteEm.x, arteEm.y, 'scale(0.4)') },
      { opacity: 1, transform: em0(arteEm.x, arteEm.y, 'scale(1.08)'), offset: 0.4 },
      { opacity: 0.9, transform: em0(arteEm.x, arteEm.y, 'scale(1)'), offset: 0.75 },
      { opacity: 0, transform: em0(arteEm.x, arteEm.y, 'scale(1.15)') },
    ], { duration: 520, fill: 'none' }));
  } else {
    em(t, () => animar(cena.querySelector('.fx-estrela'), [
      { opacity: 0, transform: em0(cp.x, cp.y, 'scale(0.2) rotate(-60deg)') },
      { opacity: 1, transform: em0(cp.x, cp.y, 'scale(1) rotate(0deg)'), offset: 0.35 },
      { opacity: 0, transform: em0(cp.x, cp.y, 'scale(1.8) rotate(30deg)') },
    ], { duration: 620, easing: 'cubic-bezier(0.15, 0.8, 0.3, 1)', fill: 'none' }));
    em(t + 150, () => tremer(lados[p].corpo, animar, 6, 260));
  }
  em(T, () => { cena.hidden = true; });
}

// Tremor de uma metade (só transform, sem ficar no fim).
function tremer(corpo, animar, forca, duracao) {
  const f = forca;
  animar(corpo, [
    { transform: 'translate3d(0, 0, 0)' },
    { transform: `translate3d(${-f}px, ${f * 0.3}px, 0)` },
    { transform: `translate3d(${f * 0.85}px, ${-f * 0.3}px, 0)` },
    { transform: `translate3d(${-f * 0.55}px, ${f * 0.15}px, 0)` },
    { transform: `translate3d(${f * 0.3}px, 0, 0)` },
    { transform: 'translate3d(0, 0, 0)' },
  ], { duration: duracao, easing: 'linear', fill: 'none' });
}

// ---------- a luta animada (Web Animations) ----------
//
// Tudo em transform e opacity, dentro do teto de TEMPO.fim (1,2s com o toque).
//   0 → impacto     os dois bichinhos avançam e se chocam no meio da tela
//   impacto         clarão e anel; quem perdeu voa para trás
//                   (ou tomba, no tropeço) e a metade dele treme
//   barras          a vida desliza e os números sobem do bichinho
//   texto           cada metade mostra o golpe e o número dela
//   fim             pose final; os botões já aceitam a próxima rodada
// Rodada de especial: tudo isso começa depois da cena (tocarCena).
// Um toque em qualquer lugar pula para o final.
//
// As metades têm o mesmo desenho, só que a de cima está girada: nas duas,
// "para o meio da tela" é para cima (translateY negativo) no próprio sistema
// de coordenadas. Por isso uma só receita serve aos dois jogadores.

// Pose em que cada papel termina — igual às regras .fase-final [data-papel] do CSS, para o
// último quadro da animação e o estado final baterem sem salto.
// [y, escala, giro]: y positivo = para longe do meio da tela (ver quadro()).
const POSE = {
  venceu: [0, 1.06, 0],
  perdeu: [10, 0.88, -9],
  tombou: [16, 0.86, -84],
  protegido: [0, 1, 0],
  choque: [0, 1, 0],
  empate: [0, 1, 0],
};
const NEUTRO = 'translate3d(0, 0, 0) scale(1) rotate(0deg)';

// Transform do bichinho da metade i. Na metade do Rato (em cima, sem giro)
// "longe do meio" é para cima, então y e o giro trocam de sinal.
function quadro(i, [y, escala, giro]) {
  const s = -sentidoDoMeio(i);
  return `translate3d(0, ${y * s}px, 0) scale(${escala}) rotate(${giro * s}deg)`;
}

// Centro do bichinho na tela (getBoundingClientRect já considera o giro).
function centroNaTela(lado) {
  const r = lado.bicho.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, altura: r.height };
}

// Converte um deslocamento na tela para o sistema da metade: a de cima está
// girada 180°, então lá x e y trocam de sinal. Contra o Rato a de cima não gira.
function naMetade(i, dx, dy) {
  const giro = i === 0 && !contraRival() ? -1 : 1;
  return { x: giro * dx, y: giro * dy };
}

// "Para o meio da tela" no sistema da metade: -1 (para cima) nas metades de
// sempre; +1 na do Rato, que fica em cima sem girar.
function sentidoDoMeio(i) {
  return i === 0 && contraRival() ? 1 : -1;
}

// Até onde cada bichinho anda para encostar no outro de frente, no meio da
// tela — medido na tela de verdade, vale em 360 ou 560 de largura e em
// qualquer altura.
function alvoDoBote(lado, i, meio) {
  const c = centroNaTela(lado);
  const acima = c.y < meio.y ? -1 : 1;
  return naMetade(i, meio.x - c.x, meio.y + acima * c.altura * 0.42 - c.y);
}

function animarLuta(luta) {
  const { tela, lados, fim } = luta;
  const timers = [];
  const anims = [];

  const finalizar = () => {
    if (app.animacao !== anim) return;
    for (const t of timers) clearTimeout(t);
    for (const a of anims) a.cancel();
    $('cena-especial').hidden = true;
    tela.classList.add('sem-transicao', 'fase-luta', 'fase-impacto', 'fase-texto', 'fase-final');
    for (const l of lados) {
      l.barra.definir(l.vidaDepois);
      l.escudo.classList.toggle('desligado', !l.escudoDepois);
      l.metade.classList.toggle('com-escudo', l.escudoDepois);
      l.flutuantes.replaceChildren();
    }
    app.animacao = null;
    app.fase = 'resultado';
    // Sem "Próxima": os símbolos já aceitam a escolha da rodada seguinte
    // (a partida acabou: ficam travados e o meio vira VER FIM).
    for (const l of lados) {
      const grupo = l.corpo.querySelector('.simbolos');
      grupo.classList.remove('tem-escolha');
      for (const b of grupo.children) {
        b.disabled = fim.terminou;
        b.setAttribute('aria-pressed', 'false');
      }
      l.corpo.querySelector('.botao-proxima').disabled = fim.terminou;
    }
    atualizarCentro();
  };
  const anim = { finalizar };
  app.animacao = anim;

  const podeAnimar = typeof Element.prototype.animate === 'function';
  if (movimentoReduzido() || !podeAnimar) {
    finalizar();
    som.tocar(SOM_DO_GOLPE[luta.golpe]);
    return;
  }

  const em = (ms, fn) => timers.push(setTimeout(fn, ms));
  const animar = (alvo, quadros, opcoes) => {
    const a = alvo.animate(quadros, { fill: 'forwards', ...opcoes });
    anims.push(a);
    return a;
  };

  // Rodada de especial: primeiro a cena (TEMPO_CENA.total), depois a luta de sempre.
  const t0 = luta.especial ? TEMPO_CENA.total : 0;
  if (luta.especial) tocarCena(luta, animar, em);

  const faixa = tela.querySelector('.faixa-centro').getBoundingClientRect();
  const meio = { x: faixa.left + faixa.width / 2, y: faixa.top + faixa.height / 2 };
  const bote = lados.map((l, i) => (l.avanca ? alvoDoBote(l, i, meio) : { x: 0, y: 0 }));
  const noChoque = (i) => `translate3d(${bote[i].x}px, ${bote[i].y}px, 0) scale(1.14) rotate(0deg)`;

  // 1. avanço: um passinho para trás (preparo) e o bote até o meio
  em(t0, () => {
    void tela.offsetWidth;
    tela.classList.add('fase-luta');
    lados.forEach((l, i) => {
      if (!l.avanca) return;
      animar(l.bicho, [
        { transform: NEUTRO },
        { transform: quadro(i, [9, 0.94, 0]), offset: 0.35, easing: 'cubic-bezier(0.55, 0, 0.9, 0.45)' },
        { transform: noChoque(i) },
      ], { duration: TEMPO.impacto });
    });
  });

  // 2. impacto
  em(t0 + TEMPO.impacto, () => {
    tela.classList.add('fase-impacto');
    som.tocar(SOM_DO_GOLPE[luta.golpe]);
    lados.forEach((l, i) => {
      const de = l.avanca ? noChoque(i) : NEUTRO;
      const pose = quadro(i, POSE[l.papel.papel]);
      let meioDoGolpe;
      if (l.papel.papel === 'perdeu') meioDoGolpe = [30, 0.84, -16];
      else if (l.papel.papel === 'tombou') meioDoGolpe = [26, 0.9, -40];
      else if (l.papel.papel === 'venceu' && lados[1 - i].papel.papel === 'protegido') {
        // o escudo do outro devolve o golpe: o atacante quica para trás
        meioDoGolpe = [24, 0.96, 5];
      } else meioDoGolpe = [12, 1.1, 0];
      animar(l.bicho, [
        { transform: de },
        { transform: quadro(i, meioDoGolpe), offset: 0.4 },
        { transform: pose },
      ], { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' });

      if (!l.escudoDepois) l.escudo.classList.add('desligado');
      // quem levou dano treme; no Estouro (e no recuo) o vencedor treme junto
      const treme = ['perdeu', 'tombou'].includes(l.papel.papel)
        || (l.papel.papel === 'choque' && l.vidaDepois < l.vidaAntes)
        || (l.papel.papel === 'venceu' && l.papel.recuo);
      if (treme) tremer(l.corpo, animar, 7, 260);
    });
  });

  // 3. vida desliza e os números sobem; quem venceu pula, quem perdeu treme
  em(t0 + TEMPO.barras, () => {
    for (const l of lados) {
      l.barra.animarPara(l.vidaAntes, l.vidaDepois, TEMPO.duracaoBarras);
      l.flutuantes.replaceChildren(...l.papel.flutuantes.map(numeroFlutuante));
      if (l.escudoDepois) {
        l.escudo.classList.remove('desligado');
        l.metade.classList.add('com-escudo');
      }
      const figura = l.bicho.querySelector('.arte-bicho, .bichinho');
      if (!figura) continue;
      if (l.papel.papel === 'venceu') {
        animar(figura, [
          { transform: 'translate3d(0, 0, 0)' },
          { transform: 'translate3d(0, -26px, 0)', offset: 0.3, easing: 'cubic-bezier(0.3, 0, 0.6, 1)' },
          { transform: 'translate3d(0, 0, 0)', offset: 0.6, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
          { transform: 'translate3d(0, -9px, 0)', offset: 0.8 },
          { transform: 'translate3d(0, 0, 0)' },
        ], { duration: 560, fill: 'none' });
      } else if (['perdeu', 'tombou'].includes(l.papel.papel) || (l.papel.papel === 'choque' && l.vidaDepois < l.vidaAntes)) {
        animar(figura, [
          { transform: 'translate3d(0, 0, 0)' },
          { transform: 'translate3d(-8px, 0, 0)' },
          { transform: 'translate3d(7px, 0, 0)' },
          { transform: 'translate3d(-6px, 0, 0)' },
          { transform: 'translate3d(5px, 0, 0)' },
          { transform: 'translate3d(-3px, 0, 0)' },
          { transform: 'translate3d(0, 0, 0)' },
        ], { duration: 460, easing: 'linear', fill: 'none' });
      }
    }
  });

  // 4. cada metade mostra o golpe e o número dela
  em(t0 + TEMPO.texto, () => tela.classList.add('fase-texto'));
  em(t0 + TEMPO.fim, finalizar);
}

function proximaRodada() {
  if (app.animacao || app.ultimaRodada?.resultado.fim.terminou) return;
  novaRodadaLimpa();
  renderBatalha();
}

// ---------- tela: fim ----------

// "VENCEU!" e "PERDEU" só aparecem aqui. O vencedor é inconfundível: selo
// VENCEU!, arte grande com o troféu, o nome e confete (uma vez; sem confete
// com movimento reduzido). Quem perdeu vem pequeno, embaixo.
function renderFim() {
  const { resultado, placarGravado } = app.ultimaRodada;
  const { estado, fim } = resultado;
  const titulo = $('fim-titulo');
  const sub = $('fim-sub');
  const iconeFim = $('fim-icone');
  const perdeu = $('fim-perdeu');
  const empate = fim.vencedor === null;
  $('fim-venceu').hidden = empate;
  perdeu.hidden = empate;
  iconeFim.classList.toggle('empate', empate);
  if (empate) {
    titulo.textContent = 'Empate!';
    sub.textContent = 'Os dois ficaram sem vida na mesma rodada.';
    iconeFim.replaceChildren(icone(iconeEmpate()));
    delete iconeFim.dataset.especie;
    $('fim-confete').replaceChildren();
  } else {
    const v = fim.vencedor;
    const campeao = estado.jogadores[v].criatura;
    const outro = estado.jogadores[1 - v].criatura;
    titulo.textContent = nomeJogador(estado, v);
    const detalhe = `${estado.rodada} rodadas · modo ${INFO_MODO[app.modo].nome}`;
    sub.textContent = campeao.rival
      ? `O Rato ganhou desta vez. Revanche? (${detalhe})`
      : `Parabéns${contraRival() ? '' : `, Jogador ${v + 1}`}! (${detalhe})`;
    iconeFim.dataset.especie = campeao.especie;
    iconeFim.style.setProperty('--cor-base', corDaEspecie(campeao));
    iconeFim.replaceChildren(
      el('span', { class: 'fim-arte' }, imagemArte(campeao, 240, { lazy: false }) ?? retrato(campeao)),
      icone(iconeTrofeu()),
    );
    perdeu.dataset.especie = outro.especie;
    perdeu.style.setProperty('--cor-base', corDaEspecie(outro));
    perdeu.replaceChildren(
      el('span', { class: 'fim-perdeu-arte', 'aria-hidden': 'true' }, imagemArte(outro, 56, { lazy: false }) ?? retrato(outro)),
      el('span', { class: 'fim-perdeu-nome' }, nomeJogador(estado, 1 - v)),
      el('b', { class: 'fim-perdeu-selo' }, 'Perdeu'),
    );
    $('fim-confete').replaceChildren(...(movimentoReduzido() ? [] : confete()));
    // fanfarra só quando a criança ganha (não quando o Rato ganha)
    if (!campeao.rival) som.tocar('vitoria');
  }

  // entrada de ~600ms (reinicia a cada fim de partida)
  for (const alvo of [iconeFim, titulo, $('fim-venceu')]) {
    alvo.classList.remove('fim-entrada');
    void alvo.offsetWidth;
    alvo.classList.add('fim-entrada');
  }

  $('fim-barras').replaceChildren(...estado.jogadores.map((j, i) =>
    el('div', {},
      el('div', { class: 'barra-rotulo' }, `${j.criatura.rival ? 'Rival' : `J${i + 1}`} · ${j.criatura.nome}`),
      barraVida(j.vida, j.criatura.vida),
    )));

  const aviso = $('fim-placar');
  const espelhada = estado.jogadores[0].criatura.codigo === estado.jogadores[1].criatura.codigo;
  aviso.hidden = placarGravado;
  if (empate) aviso.textContent = 'Empate não conta na coleção.';
  else if (espelhada) aviso.textContent = 'Bichinhos iguais: esta partida não conta na coleção.';
  else if (colecaoAtual() === null) aviso.textContent = 'Não foi possível guardar a partida neste navegador.';
  else aviso.textContent = 'Escaneie o QR das peças para as partidas contarem na coleção.';
}

// Confete: 28 papeizinhos que caem uma vez. Posições fixas, espalhadas pela
// razão áurea (nada sorteado).
function confete() {
  const cores = ['var(--especial)', 'var(--ataque)', 'var(--defesa)', 'var(--tropeco)', 'var(--perigo)', 'var(--sistema-neon)'];
  return Array.from({ length: 28 }, (_, i) => {
    const f = (i * 0.618034) % 1;
    return el('i', {
      style: `--x: ${(f * 100).toFixed(1)}%; --dx: ${Math.round((f - 0.5) * 80)}px; --r: ${(i % 2 ? 1 : -1) * (240 + i * 23)}deg;`
        + ` --d: ${1500 + (i % 5) * 180}ms; --a: ${(i % 7) * 70}ms; --c: ${cores[i % cores.length]};`,
    });
  });
}

// ---------- tela: minha coleção ----------

function cartaoColecao(c, colecao, i = 0) {
  // Série futura ainda não descoberta: só a silhueta e o aviso, sem nome nem números.
  if (!estaDescoberta(colecao, c.codigo) && c.serie > SERIE_ATUAL) {
    return el('div', { class: 'carta carta-misterio carta-em-breve', style: `--i: ${i}`, 'aria-label': `Série ${c.serie}, em breve` },
      el('span', { class: 'carta-avatar' }, icone(iconeMisterio())),
      el('span', { class: 'carta-nome' }, `Série ${c.serie}`),
      el('span', { class: 'carta-dica' }, 'Em breve'),
    );
  }
  if (!estaDescoberta(colecao, c.codigo)) {
    return el('div', { class: 'carta carta-misterio', style: `--i: ${i}`, 'aria-label': 'Bichinho ainda não descoberto' },
      el('span', { class: 'carta-avatar' }, icone(iconeMisterio())),
      el('span', { class: 'carta-nome' }, '???'),
      el('span', { class: 'carta-dica' }, icone(iconeQr()), 'Escaneie a peça para descobrir'),
    );
  }
  const item = colecao[c.codigo];
  const fundador = item.fundador ?? null;
  return el('div', { class: `carta${fundador ? ' carta-fundador' : ''}`, style: `--cor-base: ${corDaEspecie(c)}; --i: ${i}`, 'data-especie': c.especie },
    fundador ? seloFundador(fundador) : null,
    cartaAvatar(c),
    el('span', { class: 'carta-nome' }, c.nome),
    el('span', { class: 'carta-especie' }, `${nomeDaEspecie(c)} · ${c.codigo}`),
    el('span', { class: 'carta-status' },
      el('span', {}, icone(iconeVida()), ` ${c.vida}`),
      el('span', {}, `Força ${c.forca}`),
    ),
    el('span', { class: 'carta-especial' }, icone(iconeEspecial()), el('b', {}, c.especial.nome), ` ${c.especial.texto}`),
    el('span', { class: 'carta-placar' }, `${item.vitorias} ${item.vitorias === 1 ? 'vitória' : 'vitórias'} · ${item.partidas} ${item.partidas === 1 ? 'partida' : 'partidas'}`),
  );
}

// Só chega aqui bichinho descoberto: a arte nunca aparece antes da hora.
function cartaAvatar(c) {
  const img = imagemArte(c, 88);
  if (!img) return el('span', { class: 'carta-avatar', 'aria-hidden': 'true' }, retrato(c));
  return el('span', { class: 'carta-avatar com-arte', 'aria-hidden': 'true' }, img);
}

function abrirColecao() {
  const colecao = colecaoAtual();
  $('colecao-indisponivel').hidden = colecao !== null;
  const { descobertos, total } = contarDaSerie(colecao, SERIE_ATUAL);
  $('colecao-contador').textContent = `${descobertos} de ${total} da Série ${SERIE_ATUAL}`;
  $('lista-colecao').replaceChildren(...CRIATURAS.map((c, i) => cartaoColecao(c, colecao ?? {}, i)));
  mostrarTela('tela-colecao');
}

// ---------- tela: espera da segunda peça ----------

function abrirEspera(criatura, { repetido = false } = {}) {
  pararNfc();
  app.escolhas = [criatura, null];
  // Com arte: a imagem grande sobre o disco da espécie. Sem arte: o retrato redondo.
  const arte = imagemArte(criatura, 180, { lazy: false });
  const comum = { style: `--cor-base: ${corDaEspecie(criatura)}`, 'data-especie': criatura.especie };
  $('espera-selo').replaceChildren(arte
    ? el('span', { ...comum, class: 'carta-nova-arte espera-arte' }, arte)
    : el('span', { ...comum, class: 'cartao-avatar' }, retrato(criatura)));
  $('espera-titulo').textContent = `${criatura.nome} está pronto!`;
  $('espera-texto').textContent = 'Agora escaneie o bichinho do seu oponente.';
  const aviso = $('espera-aviso');
  aviso.hidden = !repetido;
  aviso.textContent = 'Esse é o mesmo bichinho! Escaneie outro.';
  $('espera-qr').replaceChildren(el('span', { class: 'mira-leitura' }, icone(iconeQr())));
  const nfc = $('btn-espera-nfc');
  nfc.hidden = !temNfc();
  // com NFC, "Encoste a segunda peça" é o caminho principal
  $('btn-espera-sem-peca').classList.toggle('botao-principal', nfc.hidden);
  $('btn-espera-sem-peca').classList.toggle('botao-secundario', !nfc.hidden);
  nfc.textContent = 'Encoste a segunda peça';
  nfc.setAttribute('aria-pressed', 'false');
  $('espera-nfc-status').hidden = true;
  mostrarTela('tela-espera');
}

// ---------- NFC no próprio app (Android/Chrome) ----------
//
// No Chrome do Android a página pode ler a etiqueta sem sair dela (Web NFC).
// No iPhone não existe: o botão nem aparece e a segunda peça chega pela URL,
// numa aba nova, com a espera guardada no localStorage.

function temNfc() {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

function pararNfc() {
  if (!app.leituraNfc) return;
  try {
    app.leituraNfc.abort();
  } catch {
    // já parou
  }
  app.leituraNfc = null;
}

function avisoEspera(texto) {
  const aviso = $('espera-aviso');
  aviso.textContent = texto;
  aviso.hidden = false;
}

async function lerSegundaPecaNfc() {
  if (app.leituraNfc) return;
  const botao = $('btn-espera-nfc');
  const status = $('espera-nfc-status');
  $('espera-aviso').hidden = true;
  const controle = new AbortController();
  app.leituraNfc = controle;
  const voltarBotao = () => {
    if (app.leituraNfc === controle) app.leituraNfc = null;
    botao.textContent = 'Encoste a segunda peça';
    botao.setAttribute('aria-pressed', 'false');
    status.hidden = true;
  };
  try {
    const leitor = new window.NDEFReader();
    leitor.onreadingerror = () => {
      status.textContent = 'Não deu para ler. Encoste de novo, bem no meio da peça.';
    };
    leitor.onreading = (ev) => {
      const lido = lerRegistrosNfc(ev.message?.records);
      if (!lido || !buscarCriatura(lido.codigo)) {
        status.textContent = 'Essa etiqueta não é de um bichinho. Tente outra peça.';
        return;
      }
      pararNfc();
      voltarBotao();
      chegarCodigo(lido.codigo, lido.fundador);
    };
    await leitor.scan({ signal: controle.signal });
    botao.textContent = 'Lendo… toque para parar';
    botao.setAttribute('aria-pressed', 'true');
    status.textContent = 'Encoste a peça nas costas do celular.';
    status.hidden = false;
  } catch (erro) {
    voltarBotao();
    if (erro?.name === 'AbortError') return;
    avisoEspera(erro?.name === 'NotAllowedError'
      ? 'O celular não deixou usar o NFC. Escaneie o QR da peça.'
      : 'O NFC não funcionou agora. Escaneie o QR da peça.');
  }
}

function tocarNfc() {
  if (app.leituraNfc) {
    pararNfc();
    $('btn-espera-nfc').textContent = 'Encoste a segunda peça';
    $('btn-espera-nfc').setAttribute('aria-pressed', 'false');
    $('espera-nfc-status').hidden = true;
    return;
  }
  lerSegundaPecaNfc();
}

function recomecar() {
  pararNfc();
  limparAguardando(armazemEspera());
  app.escolhas = [null, null];
  app.escolhaRestrita = false;
  irParaInicio();
}

// ---------- início ----------

function irParaInicio() {
  atualizarBotaoColecao();
  $('inicio-erro').hidden = true;
  // Uma peça já escaneada continua esperando a segunda (até expirar).
  const aguardando = lerAguardando(armazemEspera());
  const botao = $('btn-inicio-espera');
  botao.hidden = !aguardando;
  if (aguardando) {
    const criatura = buscarCriatura(aguardando.codigo);
    botao.replaceChildren(icone(iconeQr()), ` ${criatura.nome} está esperando o oponente`);
    botao.onclick = () => abrirEspera(criatura);
  }
  mostrarTela('tela-inicio');
}

function escolherModoEComecar(modo) {
  app.modo = modo;
  app.escolhas = [null, null];
  app.escolhaRestrita = false;
  abrirEscolha(0);
}

// Os dois botões de som (canto e faixa da batalha) mostram o mesmo modo.
function pintarBotoesSom() {
  for (const b of [$('btn-som'), $('btn-som-batalha')]) {
    b.hidden = !som.disponivel;
    b.dataset.modo = som.modo();
    b.setAttribute('aria-label', TEXTO_MODO_SOM[som.modo()]);
    b.replaceChildren(icone(iconeSom(som.modo())));
  }
}

function tocarBotaoSom() {
  som.definirModo(proximoModoSom(som.modo()));
  som.destravar();
  pintarBotoesSom();
  som.tocar('toque');
}

function ligarEventos() {
  // O áudio só nasce dentro de um toque (regra do iPhone): todo toque tenta destravar.
  for (const tipo of ['pointerdown', 'touchend', 'keydown']) {
    document.addEventListener(tipo, () => som.destravar(), { capture: true, passive: true });
  }
  pintarBotoesSom();
  $('btn-som').addEventListener('click', tocarBotaoSom);
  $('btn-som-batalha').addEventListener('click', tocarBotaoSom);

  // Durante a animação da rodada, qualquer toque só pula para o final.
  document.addEventListener('click', (ev) => {
    if (!app.animacao) {
      if (ev.target.closest('button:not(.botao-som)')) som.tocar('toque');
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    app.animacao.finalizar();
  }, true);

  montarBotoesModo($('inicio-modos'), escolherModoEComecar);
  montarBotoesModo($('modo-lista'), (modo) => {
    app.modo = modo;
    iniciarPartida();
  });
  $('btn-modo-voltar').addEventListener('click', recomecar);

  $('btn-colecao').addEventListener('click', abrirColecao);
  $('btn-colecao-voltar').addEventListener('click', irParaInicio);

  $('btn-desbloqueio-continuar').addEventListener('click', () => {
    const continuar = app.depoisDoDesbloqueio ?? irParaInicio;
    app.depoisDoDesbloqueio = null;
    continuar();
  });

  $('btn-espera-sem-peca').addEventListener('click', () => abrirEscolha(1, null, { restrito: true }));
  $('btn-espera-nfc').addEventListener('click', tocarNfc);
  $('btn-espera-recomecar').addEventListener('click', recomecar);

  $('form-codigo').addEventListener('submit', (ev) => {
    ev.preventDefault();
    tentarCodigo($('campo-codigo').value);
  });
  $('campo-codigo').addEventListener('input', esconderErro);
  $('btn-escolha-confirmar').addEventListener('click', confirmarEscolha);
  $('btn-escolha-voltar').addEventListener('click', () => {
    if (app.escolhaRestrita) abrirEspera(app.escolhas[0]);
    else if (app.jogadorEscolhendo === 1) abrirEscolha(0);
    else irParaInicio();
  });

  $('tela-batalha').addEventListener('click', tocarBatalha);
  $('btn-lutar').addEventListener('click', tocarLutar);
  $('btn-sair').addEventListener('click', () => {
    // a rodada não resolve sozinha com a pergunta aberta
    cancelarContagem();
    if (window.confirm('Sair da partida? A vida dos bichinhos será perdida.')) irParaInicio();
    else if (app.fase === 'escolha') atualizarEntradas();
  });

  $('btn-revanche').addEventListener('click', iniciarPartida);
  $('btn-fim-nova').addEventListener('click', irParaInicio);
}

// Chegada por ?b=CODIGO (QR ou NFC da peça).
function tratarChegada(chegada) {
  if (chegada.tipo === 'invalido') {
    irParaInicio();
    const erro = $('inicio-erro');
    erro.textContent = `Não achamos o código "${chegada.codigo}". Confira a etiqueta da peça.`;
    erro.hidden = false;
    return;
  }
  if (chegada.tipo === 'aguardando') {
    abrirEspera(chegada.criatura);
    return;
  }
  if (chegada.tipo === 'repetido') {
    abrirEspera(chegada.criatura, { repetido: true });
    return;
  }
  if (chegada.tipo === 'partida') {
    app.escolhas = [...chegada.criaturas];
    app.escolhaRestrita = false;
    abrirVs(abrirModo);
    return;
  }
  irParaInicio();
}

function iniciar() {
  $('logo-simbolos').replaceChildren(...SIMBOLOS.map(seloSimbolo));
  // a vida que a Língua Chicote puxa de um painel para o outro (cena do especial)
  document.querySelector('#cena-especial .fx-coracao').replaceChildren(icone(iconeVida()));
  montarListaEscolha();
  ligarEventos();

  // Deep link do QR da peça: index.html?b=TAT01 (ou só ?b=TAT01 na raiz)
  const parametros = new URLSearchParams(window.location.search);
  const codigo = parametros.get('b');
  // &f=N: número da peça fundadora (1 a 10), validado em js/colecao.js
  const fundador = parametros.get('f');
  if (codigo === null) {
    irParaInicio();
    return;
  }
  // Tira o ?b= da barra de endereço: recarregar a página não conta como um novo scan.
  try {
    window.history.replaceState(null, '', window.location.pathname);
  } catch {
    // sem history API: segue com a URL como está
  }

  chegarCodigo(codigo, fundador);
}

// Uma peça chegou, pela URL (?b=) ou pelo NFC lido na tela de espera: entra na
// coleção e segue o loop de escaneio. Bichinho novo ou selo de Fundador novo
// ganham a carta grande antes de seguir.
function chegarCodigo(codigo, fundador = null) {
  const descoberta = registrarDescoberta(armazemColecao(), codigo, new Date(), fundador);
  const chegada = processarChegada(codigo, armazemEspera());
  if (descoberta.nova || descoberta.ganhouSelo) {
    const numero = descoberta.colecao?.[descoberta.criatura.codigo]?.fundador ?? null;
    $('desbloqueio-chamada').textContent = descoberta.nova ? 'Novo bichinho!' : 'Selo de Fundador!';
    $('desbloqueio-cartao').replaceChildren(cartaoDesbloqueio(descoberta.criatura, numero));
    app.depoisDoDesbloqueio = () => tratarChegada(chegada);
    mostrarTela('tela-desbloqueio');
  } else {
    tratarChegada(chegada);
  }
}

iniciar();
