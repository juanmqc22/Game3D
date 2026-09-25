// Interface da Arena dos Bichinhos: telas, animações, loop de escaneio (?b=),
// coleção em localStorage e os três modos de jogo.
// Nenhuma regra de jogo mora aqui — tudo vem de js/regras.js.

// ?v= igual ao de index.html (ver comentário lá).
import { CRIATURAS, ESPECIES, buscarCriatura } from './criaturas.js?v=13';
import {
  DEFESA, ESPECIAL, TROPECO, SIMBOLOS, ROLAR, ARENA, MIRA, MODOS, CHOQUE_DANO,
  estadoInicial, resolverRodada, resolverRodadaArena, resolverRodadaMira,
} from './regras.js?v=13';
import {
  iconeSimbolo, iconeEspecial, iconeEscudoAtivo, iconeVida, iconeVidaPerdida,
  iconeTrofeu, iconeEmpate, iconeBichinho, iconePlaca,
  iconeRolar, iconeArena, iconeAlvo, iconeDentro, iconeFora, iconeErrou, iconeMisterio, iconeQr,
} from './icones.js?v=13';
import {
  processarChegada, lerAguardando, limparAguardando, lerRegistrosNfc,
} from './escaneio.js?v=13';
import {
  lerColecao, registrarDescoberta, registrarPartida, contarDescobertos, estaDescoberta, sortearOponente,
} from './colecao.js?v=13';
import { arteDaCriatura } from './arte.js?v=13';

const ROTULOS = {
  ATAQUE: 'ATAQUE',
  DEFESA: 'DEFESA',
  ESPECIAL: 'ESPECIAL',
  TROPECO: 'TROPEÇO',
};

// Textos dos modos, em linguagem de criança.
const INFO_MODO = {
  [ROLAR]: {
    nome: 'Rolar',
    icone: iconeRolar,
    explicacao: 'Joguem as peças no chão e vejam qual desenho ficou para cima.',
    instrucao: 'Arremessem juntos e toquem no símbolo que saiu.',
  },
  [ARENA]: {
    nome: 'Arena',
    icone: iconeArena,
    explicacao: 'Desenhem um círculo no chão. Joguem de fora e tentem empurrar a peça do outro para fora.',
    instrucao: 'Arremessem de fora para dentro do círculo. Depois digam quem ficou dentro.',
  },
  [MIRA]: {
    nome: 'Mira',
    icone: iconeAlvo,
    explicacao: 'Coloquem uma tampa ou um prato longe. Quem parar em cima bate mais forte.',
    instrucao: 'Arremessem na direção do alvo. Digam se acertaram e qual símbolo saiu.',
  },
};

// Onde o loop de escaneio guarda a peça que está esperando a segunda.
// localStorage: o iPhone abre uma aba nova a cada leitura de NFC ou QR, e a
// espera tem que valer entre abas (ver js/escaneio.js).
const armazemEspera = () => window.localStorage;
const armazemColecao = () => window.localStorage;

// Linha do tempo da luta (ms). O total não pode passar de 1200 — medindo do
// toque em LUTAR até o botão liberar, com folga para a latência do toque.
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
  escolhaRestrita: false, // fallback da espera: só a coleção + oponente surpresa
  selecionada: null, // criatura marcada na tela de escolha
  partida: null, // estado de js/regras.js
  entradas: [], // rodada atual, por jogador: { simbolo, acertou (MIRA), dentro (ARENA) }
  fase: 'escolha', // batalha: 'escolha' | 'luta' (animando) | 'resultado'
  cena: [], // elementos de cada metade da tela dividida (renderBatalha)
  ultimaRodada: null, // { antes, resultado, placarGravado }
  animacao: null, // { finalizar } enquanto a rodada anima
  depoisDoDesbloqueio: null, // função a chamar ao tocar "Continuar" no card de novo bichinho
  leituraNfc: null, // AbortController da leitura NFC em andamento (tela de espera)
};

const $ = (id) => document.getElementById(id);

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
  if (id !== 'tela-espera') pararNfc();
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

function atualizarBotaoColecao() {
  const total = contarDescobertos(colecaoAtual());
  $('btn-colecao-texto').textContent = `Minha coleção · ${total} de ${CRIATURAS.length}`;
}

// ---------- cartão de criatura ----------

// tocavel: botão na tela de escolha; senão, cartão só informativo.
function cartaoCriatura(c, { tocavel, colecao }) {
  const comum = { style: `--cor-base: ${corDaEspecie(c)}`, 'data-especie': c.especie };
  const props = tocavel
    ? { ...comum, type: 'button', class: 'cartao', 'data-codigo': c.codigo, 'aria-pressed': 'false' }
    : { ...comum, class: 'cartao cartao-info' };
  return el(tocavel ? 'button' : 'div', props,
    el('span', { class: 'cartao-bicho', 'aria-hidden': 'true' }, retrato(c)),
    el('span', { class: 'cartao-dados' },
    el('span', { class: 'cartao-topo' },
      el('span', {},
        el('span', { class: 'cartao-nome' }, c.nome),
        tocavel ? el('span', { class: 'cartao-marca' }, 'ESCOLHIDO') : null,
      ),
      el('span', { class: 'cartao-codigo' }, `${nomeDaEspecie(c)} · ${c.codigo}`),
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
function cartaoDesbloqueio(c) {
  const atributo = (valor, nome, extra) => el('span', { class: `atributo ${extra}` },
    el('b', {}, String(valor)), el('span', {}, nome));
  return el('div', { class: 'carta-nova', style: `--cor-base: ${corDaEspecie(c)}`, 'data-especie': c.especie },
    el('span', { class: 'carta-nova-raios', 'aria-hidden': 'true' }),
    el('div', { class: 'carta-nova-chapa' },
      el('span', { class: 'carta-nova-chip' }, icone(iconeQr()), 'Peça registrada'),
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

function montarListaEscolha() {
  $('lista-criaturas').addEventListener('click', (ev) => {
    const surpresa = ev.target.closest('.cartao-surpresa');
    if (surpresa) {
      esconderErro();
      selecionar(sortearOponente());
      return;
    }
    const cartao = ev.target.closest('.cartao');
    if (!cartao) return;
    esconderErro();
    selecionar(buscarCriatura(cartao.dataset.codigo));
  });
}

function cartaoSurpresa() {
  return el('button', { type: 'button', class: 'cartao cartao-surpresa', 'aria-pressed': 'false' },
    el('span', { class: 'cartao-topo' },
      el('span', { class: 'cartao-nome' }, 'Oponente surpresa'),
    ),
    el('span', { class: 'cartao-especial' }, 'Sorteia um dos 6 bichinhos para ser seu adversário.'),
  );
}

// restrito: fallback da espera — só bichinhos da coleção + oponente surpresa.
function abrirEscolha(jogador, codigoInicial = null, { restrito = false } = {}) {
  app.jogadorEscolhendo = jogador;
  app.escolhaRestrita = restrito;
  app.selecionada = null;
  const colecao = colecaoAtual();
  const lista = restrito ? CRIATURAS.filter((c) => estaDescoberta(colecao, c.codigo)) : CRIATURAS;
  $('lista-criaturas').replaceChildren(
    ...lista.map((c) => cartaoCriatura(c, { tocavel: true, colecao })),
    ...(restrito ? [cartaoSurpresa()] : []),
  );
  $('escolha-titulo').textContent = restrito
    ? 'Escolha o oponente'
    : `Jogador ${jogador + 1}: escolha seu bichinho`;
  $('escolha-ou').textContent = restrito ? 'ou escolha da sua coleção:' : 'ou toque no seu bichinho:';
  const vazia = $('escolha-vazia');
  vazia.hidden = !(restrito && lista.length === 0);
  vazia.textContent = 'Sua coleção só tem este bichinho por enquanto. Toque em "Oponente surpresa".';
  const anterior = $('escolha-anterior');
  anterior.hidden = jogador === 0;
  if (jogador === 1) anterior.textContent = `Jogador 1: ${app.escolhas[0].nome}. Modo ${INFO_MODO[app.modo].nome}.`;
  if (restrito) anterior.textContent = `Jogador 1: ${app.escolhas[0].nome}.`;
  $('campo-codigo').value = '';
  esconderErro();
  if (codigoInicial !== null) {
    tentarCodigo(codigoInicial);
  } else if (app.escolhas[jogador]) {
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
    abrirModo();
  } else if (app.jogadorEscolhendo === 0) {
    abrirEscolha(1);
  } else {
    iniciarPartida();
  }
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
// A luta acontece na mesma tela: tocar em LUTAR resolve a rodada e anima o
// choque ali mesmo; o botão vira PRÓXIMA e a rodada seguinte limpa as escolhas.

function iniciarPartida() {
  app.partida = estadoInicial(app.escolhas[0], app.escolhas[1]);
  app.ultimaRodada = null;
  novaRodadaLimpa();
  renderBatalha();
  mostrarTela('tela-batalha');
}

function novaRodadaLimpa() {
  app.entradas = [0, 1].map(() => ({ simbolo: null, acertou: null, dentro: null }));
  app.fase = 'escolha';
}

// O bichinho da luta: a arte (js/arte.js) com o símbolo numa placa por cima,
// ou a silhueta desenhada com o símbolo gravado no peito.
function bichoDaLuta(criatura) {
  const img = imagemArte(criatura, 160, { lazy: false });
  if (!img) return el('div', { class: 'bicho-luta' }, retrato(criatura, 'VAZIO'));
  return el('div', { class: 'bicho-luta com-arte' },
    img, el('span', { class: 'painel-bicho-placa' }, icone(iconePlaca('VAZIO'))));
}

function botaoOpcao(classe, dados, svg, texto) {
  return el('button', { type: 'button', class: classe, ...dados, 'aria-pressed': 'false' },
    icone(svg), el('span', {}, texto));
}

// Pergunta extra do modo, na metade do jogador: Mira (acertou o alvo?) e
// Arena (ficou dentro do círculo?). No Rolar não tem.
function linhaDoModo(modo, i) {
  const j = String(i);
  if (modo === MIRA) {
    return el('div', { class: 'linha-modo opcoes-alvo', role: 'group', 'aria-label': `Alvo do jogador ${i + 1}` },
      botaoOpcao('opcao-alvo', { 'data-jogador': j, 'data-acertou': 'sim' }, iconeAlvo(), 'Acertou'),
      botaoOpcao('opcao-alvo', { 'data-jogador': j, 'data-acertou': 'nao' }, iconeErrou(), 'Errou'));
  }
  if (modo === ARENA) {
    return el('div', { class: 'linha-modo opcoes-dentro', role: 'group', 'aria-label': `Círculo do jogador ${i + 1}` },
      botaoOpcao('opcao-dentro', { 'data-jogador': j, 'data-dentro': 'sim' }, iconeDentro(), 'Dentro'),
      botaoOpcao('opcao-dentro', { 'data-jogador': j, 'data-dentro': 'nao' }, iconeFora(), 'Fora'));
  }
  return null;
}

function renderBatalha() {
  const estado = app.partida;
  const modo = app.modo;
  const tela = $('tela-batalha');
  tela.classList.remove('fase-luta', 'fase-impacto', 'fase-texto', 'fase-final', 'sem-transicao');
  tela.dataset.modo = modo;

  for (const chip of [$('rodada-cima'), $('rodada-baixo')]) {
    chip.replaceChildren(
      el('span', { class: 'chip-rodada-nome' }, 'Rodada'),
      el('b', {}, String(estado.rodada + 1)),
    );
    chip.setAttribute('aria-label', `Rodada ${estado.rodada + 1}, modo ${INFO_MODO[modo].nome}`);
  }

  app.cena = estado.jogadores.map((j, i) => {
    const metade = $(`metade-${i}`);
    metade.className = `metade metade-${i}`;
    metade.style.setProperty('--cor-base', corDaEspecie(j.criatura));
    metade.dataset.especie = j.criatura.especie;
    metade.classList.toggle('com-escudo', j.escudo);

    const bicho = bichoDaLuta(j.criatura);
    const barra = barraVida(j.vida, j.criatura.vida);
    const escudo = seloEscudo();
    escudo.classList.toggle('desligado', !j.escudo);
    const flutuantes = el('div', { class: 'flutuantes' });
    const estampa = el('span', { class: 'estampa' });
    const dica = el('p', { class: 'dica' });
    const resultado = el('div', { class: 'lado-resultado' });
    const selos = el('div', { class: 'etiquetas selos-rodada' });
    const botoes = SIMBOLOS.map((s) =>
      el('button', { type: 'button', class: 'simbolo', 'data-jogador': String(i), 'data-simbolo': s, 'aria-pressed': 'false' },
        icone(iconeSimbolo(s)),
        el('span', {}, rotulo(s)),
      ));
    // De cima (perto do meio da tela) para baixo (perto do jogador):
    //   palco — o bichinho e, ao lado, a pergunta do modo ou o resultado
    //   cabeça — nome e vida
    //   base — os botões de símbolo; na hora do resultado, os selos da rodada
    //          no mesmo lugar (os dois ocupam a mesma célula: a tela não pula)
    const corpo = el('div', { class: 'metade-corpo' },
      el('div', { class: 'palco-luta' },
        el('div', { class: 'bicho-lugar' },
          el('span', { class: 'domo' }),
          el('span', { class: 'halo' }),
          el('span', { class: 'lingua' }),
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
          el('span', { class: 'metade-jogador' }, `J${i + 1}`), nomeJogador(estado, i)),
        barra,
      ),
      el('div', { class: 'base' },
        el('div', { class: 'simbolos', role: 'group', 'aria-label': `Símbolo do jogador ${i + 1}` }, ...botoes),
        el('p', { class: 'base-aviso', hidden: true }, 'Alguém ficou fora: o símbolo não conta.'),
        selos,
      ),
    );
    metade.replaceChildren(corpo);
    return { metade, corpo, bicho, barra, escudo, flutuantes, estampa, dica, resultado, selos, criatura: j.criatura };
  });
  atualizarEntradas();
}

// ARENA: a face só importa quando os dois ficaram dentro do círculo. Quem
// marcou "Fora" (ou está contra quem marcou) não precisa dizer o símbolo.
function precisaFace() {
  if (app.modo !== ARENA) return true;
  return app.entradas.every((e) => e.dentro !== false);
}

function entradaPronta(e) {
  if (app.modo === MIRA && e.acertou === null) return false;
  if (app.modo === ARENA && e.dentro === null) return false;
  return !precisaFace() || e.simbolo !== null;
}

function textoDica(e) {
  if (app.modo === ARENA && e.dentro === null) return 'Ficou dentro do círculo?';
  if (app.modo === MIRA && e.acertou === null) return 'Acertou o alvo?';
  if (precisaFace() && e.simbolo === null) return 'Qual símbolo saiu?';
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
  const mostrarFace = precisaFace();
  app.cena.forEach((c, i) => {
    const e = app.entradas[i];
    // O bichinho já mostra o símbolo tocado: confirma a escolha sem texto.
    const simbolo = (mostrarFace && e.simbolo) || 'VAZIO';
    const placa = c.bicho.querySelector('.painel-bicho-placa');
    if (placa) placa.replaceChildren(icone(iconePlaca(simbolo)));
    else c.bicho.replaceChildren(retrato(c.criatura, simbolo));

    const grupo = c.corpo.querySelector('.simbolos');
    grupo.hidden = !mostrarFace;
    c.corpo.querySelector('.base-aviso').hidden = mostrarFace;
    grupo.classList.toggle('tem-escolha', e.simbolo !== null);
    for (const b of grupo.children) b.setAttribute('aria-pressed', String(b.dataset.simbolo === e.simbolo));
    marcarGrupo(c.corpo.querySelector('.opcoes-alvo'), 'acertou', e.acertou);
    marcarGrupo(c.corpo.querySelector('.opcoes-dentro'), 'dentro', e.dentro);

    const pronto = entradaPronta(e);
    c.dica.textContent = textoDica(e);
    c.dica.classList.toggle('pronto', pronto);
    c.metade.classList.toggle('pronta', pronto);
  });
  const pronto = app.entradas.every(entradaPronta);
  $('btn-lutar').disabled = !pronto;
  rotularLutar('LUTAR!');
}

// O mesmo texto nas duas metades do botão: uma de cabeça para baixo, para o
// jogador de cima.
function rotularLutar(texto) {
  const botao = $('btn-lutar');
  for (const s of botao.querySelectorAll('.lutar-texto')) s.textContent = texto;
}

function tocarBatalha(ev) {
  if (app.fase !== 'escolha') return;
  const botao = ev.target.closest('.simbolo, .opcao-alvo, .opcao-dentro');
  if (!botao) return;
  const e = app.entradas[Number(botao.dataset.jogador)];
  // tocar de novo na mesma opção desmarca
  if (botao.classList.contains('simbolo')) {
    const s = botao.dataset.simbolo;
    e.simbolo = e.simbolo === s ? null : s;
  } else if (botao.classList.contains('opcao-alvo')) {
    const v = botao.dataset.acertou === 'sim';
    e.acertou = e.acertou === v ? null : v;
  } else {
    const v = botao.dataset.dentro === 'sim';
    e.dentro = e.dentro === v ? null : v;
  }
  atualizarEntradas();
}

function tocarLutar() {
  if (app.animacao) return;
  if (app.fase === 'escolha') resolver();
  else if (app.fase === 'resultado') proximaRodada();
}

function resolver() {
  if (!app.entradas.every(entradaPronta)) return;
  const antes = app.partida;
  const simbolos = precisaFace() ? app.entradas.map((e) => e.simbolo) : [null, null];
  let resultado;
  if (app.modo === ARENA) {
    resultado = resolverRodadaArena(antes, app.entradas.map((e) => e.dentro), simbolos);
  } else if (app.modo === MIRA) {
    resultado = resolverRodadaMira(antes, app.entradas.map((e) => e.acertou), simbolos);
  } else {
    resultado = resolverRodada(antes, simbolos[0], simbolos[1]);
  }
  app.partida = resultado.estado;
  app.ultimaRodada = { antes, resultado, placarGravado: false };
  if (resultado.fim.terminou) {
    const codigos = resultado.estado.jogadores.map((j) => j.criatura.codigo);
    app.ultimaRodada.placarGravado = registrarPartida(armazemColecao(), codigos, resultado.fim.vencedor);
  }
  app.fase = 'luta';
  const luta = prepararLuta();
  animarLuta(luta);
}

// ---------- a rodada contada em cada metade ----------

// Conta a rodada a partir do resumo de js/regras.js. Cada metade conta a sua
// parte da rodada, virada para o seu jogador:
//   veredito  — uma palavra por jogador (VENCEU!, PERDEU, EMPATE...)
//   etiquetas — os detalhes viram selos curtos, cada um na metade de quem ele fala
//   nota      — no máximo uma linha, só para o que a tela sozinha esconderia
//   leitura   — a rodada por extenso, para quem usa leitor de tela
function descreverRodada(estado, resumo) {
  const nome = (i) => nomeJogador(estado, i);
  const [sa] = resumo.simbolos;
  const face = (i) => {
    if (resumo.modo === ARENA && resumo.dentro && !resumo.dentro[i]) return 'FORA';
    const s = resumo.simbolos[i];
    return s === null ? 'DENTRO' : rotulo(s);
  };
  const confronto = `${nome(0)}: ${face(0)} × ${nome(1)}: ${face(1)}.`;

  if (resumo.nula) {
    return {
      veredito: ['Rodada nula', 'Rodada nula'],
      etiquetas: [],
      nota: { quem: null, texto: 'Ninguém ficou dentro. Arremessem de novo.' },
      leitura: `${confronto} Rodada nula: ninguém ficou dentro do círculo e ninguém perde vida.`,
    };
  }

  if (resumo.choque) {
    // mesmo símbolo: os dois se chocam e cada um perde CHOQUE_DANO (o escudo segura)
    const perdeu = (i) => resumo.danoChoque[i];
    const etiquetas = [0, 1].map((i) => (resumo.choqueBloqueado[i]
      ? { quem: i, tipo: 'escudo', svg: iconeEscudoAtivo(), texto: 'Escudo segurou' }
      : { quem: i, tipo: 'dano', svg: iconeVidaPerdida(), texto: `-${perdeu(i)} de vida` }));
    const partes = [0, 1].map((i) => (resumo.choqueBloqueado[i]
      ? `o escudo do ${nome(i)} segurou o choque e acabou`
      : `${nome(i)} perdeu ${perdeu(i)} de vida`));
    const zerados = estado.jogadores.every((j) => j.vida === 0);
    return {
      veredito: ['Choque!', 'Choque!'],
      etiquetas,
      nota: zerados ? { quem: null, texto: 'Os dois ficaram sem vida!' } : null,
      leitura: `${confronto} Choque: os dois tiraram ${rotulo(sa)}; ${partes.join(' e ')}.${zerados ? ' Os dois ficaram sem vida!' : ''}`,
    };
  }

  if (resumo.vencedor === null) {
    return {
      veredito: ['Empate!', 'Empate!'],
      etiquetas: [0, 1].map((i) => ({ quem: i, tipo: 'empate', svg: iconeEmpate(), texto: `Os dois: ${rotulo(sa)}` })),
      nota: null,
      leitura: `${confronto} Empate: ninguém perde vida.`,
    };
  }

  const v = resumo.vencedor;
  const p = 1 - v;
  const porFora = resumo.bonusFora > 0;
  const especial = !porFora && resumo.simboloVencedor === ESPECIAL
    ? estado.jogadores[v].criatura.especial
    : null;
  const etiquetas = [];
  const selo = (quem, tipo, svg, texto) => etiquetas.push({ quem, tipo, svg, texto });

  if (especial) selo(v, 'especial', iconeEspecial(), especial.nome);
  // Vencer com DEFESA não é óbvio para a criança: o selo dá nome à jogada.
  if (!porFora && resumo.simboloVencedor === DEFESA) selo(v, 'contra', iconeSimbolo(DEFESA), 'Contra-ataque');
  if (porFora) selo(p, 'fora', iconeFora(), `Fora +${resumo.bonusFora}`);
  if (resumo.modo === MIRA) {
    if (resumo.metade) selo(v, 'errou', iconeErrou(), 'Errou: metade');
    else if (resumo.bonusAcerto > 0) selo(v, 'alvo', iconeAlvo(), `Alvo +${resumo.bonusAcerto}`);
  }
  if (resumo.bonusTropeco > 0) selo(p, 'tropeco', iconeSimbolo(TROPECO), `Tropeço +${resumo.bonusTropeco}`);
  if (resumo.bloqueado) selo(p, 'escudo', iconeEscudoAtivo(), 'Escudo segurou');
  else selo(p, 'dano', iconeVidaPerdida(), `-${resumo.dano} de vida`);
  if (resumo.cura > 0) selo(v, 'cura', iconeVida(), `+${resumo.cura} de vida`);
  if (resumo.recuo > 0) selo(v, 'recuo', iconeVidaPerdida(), `-${resumo.recuo} de vida`);
  if (resumo.escudoAtivado) selo(v, 'escudo', iconeEscudoAtivo(), 'Escudo ligado');

  const veredito = [];
  veredito[v] = 'Venceu!';
  if (resumo.bloqueado) veredito[p] = 'Protegido!';
  else veredito[p] = resumo.simbolos[p] === TROPECO ? 'Tropeçou!' : 'Perdeu';

  // Uma nota só, e só quando a tela sozinha enganaria a criança.
  let nota = null;
  if (resumo.recuo > 0 && estado.jogadores[v].vida === 0) {
    nota = { quem: v, texto: 'Se machucou com o próprio golpe e ficou sem vida!' };
  } else if (especial?.roubo && resumo.bloqueado) {
    nota = { quem: v, texto: 'O dano não passou, então não rouba vida.' };
  } else if (especial?.escudo && !resumo.escudoAtivado) {
    nota = { quem: v, texto: 'Já estava com escudo (não acumula).' };
  } else if (especial?.cura > 0 && resumo.cura < especial.cura) {
    nota = { quem: v, texto: 'Já estava quase cheio: a vida não passa do máximo.' };
  } else if (resumo.modo === MIRA && !resumo.metade && resumo.bonusAcerto === 0 && resumo.acertou?.[v]) {
    nota = { quem: v, texto: `Acertou o alvo, mas o extra da rodada já é +${resumo.bonusTropeco} pelo tropeço.` };
  } else if (estado.jogadores.every((j) => j.vida === 0)) {
    nota = { quem: null, texto: 'Os dois ficaram sem vida!' };
  }

  const golpe = porFora
    ? `ficou dentro do círculo e ${nome(p)} ficou fora`
    : (especial ? `venceu com ESPECIAL, ${especial.nome}` : `venceu com ${rotulo(resumo.simboloVencedor)}`);
  const efeito = resumo.bloqueado
    ? `o escudo do ${nome(p)} anulou o dano e acabou`
    : `${resumo.dano} de dano no ${nome(p)}`;
  const leitura = [`${confronto} ${nome(v)} ${golpe}: ${efeito}.`]
    .concat(resumo.cura > 0 ? [`${nome(v)} ganhou ${resumo.cura} de vida.`] : [])
    .concat(resumo.recuo > 0 ? [`${nome(v)} perdeu ${resumo.recuo} de vida com o próprio golpe.`] : [])
    .concat(resumo.escudoAtivado ? [`${nome(v)} está com escudo.`] : [])
    .concat(nota ? [nota.quem === null ? nota.texto : `${nome(nota.quem)}: ${nota.texto}`] : [])
    .join(' ');

  return { veredito, etiquetas, nota, leitura };
}

function etiqueta(e) {
  return el('span', { class: `etiqueta etiqueta-${e.tipo}` }, icone(e.svg), el('span', {}, e.texto));
}

// O papel de cada jogador na luta (e a pose em que ele termina) e os números
// que sobem do bichinho.
function papelNaLuta(resumo, i) {
  if (resumo.nula) return { papel: 'nula', flutuantes: [] };
  if (resumo.choque) {
    const flutuantes = resumo.choqueBloqueado[i]
      ? [{ tipo: 'bloqueado', valor: CHOQUE_DANO }]
      : [{ tipo: 'dano', texto: `-${resumo.danoChoque[i]}` }];
    return { papel: 'choque', flutuantes };
  }
  if (resumo.vencedor === null) return { papel: 'empate', flutuantes: [] };
  if (i !== resumo.vencedor) {
    const fora = resumo.bonusFora > 0;
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

// Liga os efeitos da rodada. Cada especial tem o seu (ver css/estilo.css);
// um código desconhecido cai no efeito genérico, sem quebrar nada.
function configurarEfeitos(tela, estado, resumo) {
  const v = resumo.vencedor;
  const houveGolpe = v !== null && !resumo.nula;
  // o especial só "acontece" quando a face especial venceu de verdade
  const usouEspecial = houveGolpe && resumo.simboloVencedor === ESPECIAL && resumo.bonusFora === 0;
  tela.dataset.efeito = usouEspecial ? estado.jogadores[v].criatura.codigo : '';
  tela.dataset.golpe = houveGolpe ? (resumo.bloqueado ? 'bloqueado' : 'dano') : (resumo.choque ? 'dano' : 'nenhum');
  tela.dataset.tropeco = resumo.bonusTropeco > 0 ? 'sim' : 'nao';
}

// Deixa as duas metades prontas para a luta: trava os botões, escreve o
// resultado de cada uma (escondido até a fase do texto) e devolve o que a
// animação precisa.
function prepararLuta() {
  const { antes, resultado } = app.ultimaRodada;
  const { estado, resumo, fim } = resultado;
  const texto = descreverRodada(estado, resumo);
  const tela = $('tela-batalha');
  configurarEfeitos(tela, estado, resumo);
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
    c.resultado.replaceChildren(...[
      el('p', { class: `veredito veredito-${papel.papel}` }, texto.veredito[i]),
      nota ? el('p', { class: 'nota' }, nota) : null,
    ].filter(Boolean));
    c.selos.replaceChildren(...minhas.map(etiqueta));
    return {
      ...c, papel,
      vidaAntes: jAntes.vida, vidaDepois: j.vida,
      escudoAntes: jAntes.escudo, escudoDepois: j.escudo,
      // Arena: quem ficou fora do círculo não avança para o choque
      avanca: !resumo.nula && !papel.fora,
    };
  });

  $('resultado-leitura').textContent = texto.leitura;
  rotularLutar(fim.terminou ? 'VER FIM' : 'PRÓXIMA');
  return { tela, lados, resumo };
}

// ---------- a luta animada (Web Animations) ----------
//
// Tudo em transform e opacity, dentro do teto de TEMPO.fim (1,2s com o toque).
//   0 → impacto     os dois bichinhos avançam e se chocam no meio da tela
//   impacto         clarão + efeito do especial; quem perdeu voa para trás
//                   (ou tomba, no tropeço) e a metade dele treme
//   barras          a vida desliza e os números sobem do bichinho
//   texto           cada metade mostra o próprio resultado
//   fim             pose final; LUTAR vira PRÓXIMA
// Um toque em qualquer lugar pula para o final.
//
// As metades têm o mesmo desenho, só que a de cima está girada: nas duas,
// "para o meio da tela" é para cima (translateY negativo) no próprio sistema
// de coordenadas. Por isso uma só receita serve aos dois jogadores.

// Pose em que cada papel termina — igual às regras .fase-final [data-papel] do CSS, para o
// último quadro da animação e o estado final baterem sem salto.
const POSE = {
  venceu: 'translate3d(0, 0, 0) scale(1.06) rotate(0deg)',
  perdeu: 'translate3d(0, 10px, 0) scale(0.88) rotate(-9deg)',
  tombou: 'translate3d(0, 16px, 0) scale(0.86) rotate(-84deg)',
  protegido: 'translate3d(0, 0, 0) scale(1) rotate(0deg)',
  choque: 'translate3d(0, 0, 0) scale(1) rotate(0deg)',
  empate: 'translate3d(0, 0, 0) scale(1) rotate(0deg)',
  nula: 'translate3d(0, 0, 0) scale(1) rotate(0deg)',
};
const NEUTRO = 'translate3d(0, 0, 0) scale(1) rotate(0deg)';

// Centro do bichinho na tela (getBoundingClientRect já considera o giro).
function centroNaTela(lado) {
  const r = lado.bicho.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, altura: r.height };
}

// Converte um deslocamento na tela para o sistema da metade: a de cima está
// girada 180°, então lá x e y trocam de sinal.
function naMetade(i, dx, dy) {
  const giro = i === 0 ? -1 : 1;
  return { x: giro * dx, y: giro * dy };
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
  const { tela, lados } = luta;
  const botao = $('btn-lutar');
  const timers = [];
  const anims = [];

  const finalizar = () => {
    if (app.animacao !== anim) return;
    for (const t of timers) clearTimeout(t);
    for (const a of anims) a.cancel();
    tela.classList.add('sem-transicao', 'fase-luta', 'fase-impacto', 'fase-texto', 'fase-final');
    for (const l of lados) {
      l.barra.definir(l.vidaDepois);
      l.escudo.classList.toggle('desligado', !l.escudoDepois);
      l.metade.classList.toggle('com-escudo', l.escudoDepois);
      l.flutuantes.replaceChildren();
    }
    app.animacao = null;
    app.fase = 'resultado';
    botao.disabled = false;
    botao.setAttribute('aria-disabled', 'false');
  };
  const anim = { finalizar };
  app.animacao = anim;
  botao.setAttribute('aria-disabled', 'true');

  const podeAnimar = typeof Element.prototype.animate === 'function';
  if (movimentoReduzido() || !podeAnimar) {
    finalizar();
    return;
  }

  const em = (ms, fn) => timers.push(setTimeout(fn, ms));
  const animar = (alvo, quadros, opcoes) => {
    const a = alvo.animate(quadros, { fill: 'forwards', ...opcoes });
    anims.push(a);
    return a;
  };

  const faixa = tela.querySelector('.faixa-centro').getBoundingClientRect();
  const meio = { x: faixa.left + faixa.width / 2, y: faixa.top + faixa.height / 2 };
  const bote = lados.map((l, i) => (l.avanca ? alvoDoBote(l, i, meio) : { x: 0, y: 0 }));
  const noChoque = (i) => `translate3d(${bote[i].x}px, ${bote[i].y}px, 0) scale(1.14) rotate(0deg)`;
  // a Língua Chicote sai do vencedor e aponta para o outro bichinho
  const centros = lados.map(centroNaTela);
  lados.forEach((l, i) => {
    const v = naMetade(i, centros[1 - i].x - centros[i].x, centros[1 - i].y - centros[i].y);
    l.metade.style.setProperty('--alcance', `${Math.round(Math.hypot(v.x, v.y))}px`);
    l.metade.style.setProperty('--giro-lingua', `${Math.atan2(v.x, -v.y).toFixed(3)}rad`);
  });

  void tela.offsetWidth;
  tela.classList.add('fase-luta');

  // 1. avanço: um passinho para trás (preparo) e o bote até o meio
  lados.forEach((l, i) => {
    if (!l.avanca) return;
    animar(l.bicho, [
      { transform: NEUTRO },
      { transform: 'translate3d(0, 9px, 0) scale(0.94) rotate(0deg)', offset: 0.35, easing: 'cubic-bezier(0.55, 0, 0.9, 0.45)' },
      { transform: noChoque(i) },
    ], { duration: TEMPO.impacto });
  });

  // 2. impacto
  em(TEMPO.impacto, () => {
    tela.classList.add('fase-impacto');
    lados.forEach((l, i) => {
      const de = l.avanca ? noChoque(i) : NEUTRO;
      const pose = POSE[l.papel.papel];
      let meio;
      if (l.papel.papel === 'perdeu') meio = 'translate3d(0, 30px, 0) scale(0.84) rotate(-16deg)';
      else if (l.papel.papel === 'tombou') meio = 'translate3d(0, 26px, 0) scale(0.9) rotate(-40deg)';
      else if (l.papel.papel === 'nula') meio = 'translate3d(0, 0, 0) scale(1) rotate(-7deg)';
      else if (l.papel.papel === 'venceu' && lados[1 - i].papel.papel === 'protegido') {
        // o escudo do outro devolve o golpe: o atacante quica para trás
        meio = 'translate3d(0, 24px, 0) scale(0.96) rotate(5deg)';
      } else meio = 'translate3d(0, 12px, 0) scale(1.1) rotate(0deg)';
      animar(l.bicho, [
        { transform: de },
        { transform: meio, offset: 0.4 },
        { transform: pose },
      ], { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' });

      if (!l.escudoDepois) l.escudo.classList.add('desligado');
      // quem levou dano treme; no Estouro (e no recuo) o vencedor treme junto
      const treme = ['perdeu', 'tombou'].includes(l.papel.papel)
        || (l.papel.papel === 'choque' && l.vidaDepois < l.vidaAntes)
        || (l.papel.papel === 'venceu' && l.papel.recuo)
        || tela.dataset.efeito === 'SAP06';
      if (treme) {
        animar(l.corpo, [
          { transform: 'translate3d(0, 0, 0)' },
          { transform: 'translate3d(-7px, 2px, 0)' },
          { transform: 'translate3d(6px, -2px, 0)' },
          { transform: 'translate3d(-4px, 1px, 0)' },
          { transform: 'translate3d(2px, 0, 0)' },
          { transform: 'translate3d(0, 0, 0)' },
        ], { duration: 260, easing: 'linear', fill: 'none' });
      }
    });
  });

  // 3. vida desliza e os números sobem
  em(TEMPO.barras, () => {
    for (const l of lados) {
      l.barra.animarPara(l.vidaAntes, l.vidaDepois, TEMPO.duracaoBarras);
      l.flutuantes.replaceChildren(...l.papel.flutuantes.map(numeroFlutuante));
      if (l.escudoDepois) {
        l.escudo.classList.remove('desligado');
        l.metade.classList.add('com-escudo');
      }
    }
  });

  // 4. cada metade conta a sua parte
  em(TEMPO.texto, () => tela.classList.add('fase-texto'));
  em(TEMPO.fim, finalizar);
}

function proximaRodada() {
  if (app.animacao) return;
  if (app.ultimaRodada?.resultado.fim.terminou) {
    renderFim();
    mostrarTela('tela-fim');
    return;
  }
  novaRodadaLimpa();
  renderBatalha();
}

// ---------- tela: fim ----------

function renderFim() {
  const { resultado, placarGravado } = app.ultimaRodada;
  const { estado, fim } = resultado;
  const titulo = $('fim-titulo');
  const sub = $('fim-sub');
  const iconeFim = $('fim-icone');
  const empate = fim.vencedor === null;
  if (empate) {
    titulo.textContent = 'Empate!';
    sub.textContent = 'Os dois ficaram sem vida na mesma rodada.';
  } else {
    titulo.textContent = `${nomeJogador(estado, fim.vencedor)} venceu!`;
    sub.textContent = `Parabéns, Jogador ${fim.vencedor + 1}! (${estado.rodada} rodadas · modo ${INFO_MODO[app.modo].nome})`;
  }
  // Quem ganhou aparece em pessoa, com o troféu ao lado.
  if (empate) {
    iconeFim.replaceChildren(icone(iconeEmpate()));
    delete iconeFim.dataset.especie;
  } else {
    const campeao = estado.jogadores[fim.vencedor].criatura;
    iconeFim.dataset.especie = campeao.especie;
    iconeFim.replaceChildren(imagemArte(campeao, 150, { lazy: false }) ?? retrato(campeao), icone(iconeTrofeu()));
  }
  iconeFim.classList.toggle('empate', empate);

  // entrada de ~600ms (reinicia a cada fim de partida)
  for (const alvo of [iconeFim, titulo]) {
    alvo.classList.remove('fim-entrada');
    void alvo.offsetWidth;
    alvo.classList.add('fim-entrada');
  }

  $('fim-barras').replaceChildren(...estado.jogadores.map((j, i) =>
    el('div', {},
      el('div', { class: 'barra-rotulo' }, `J${i + 1} · ${j.criatura.nome}`),
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

// ---------- tela: minha coleção ----------

function cartaoColecao(c, colecao, i = 0) {
  if (!estaDescoberta(colecao, c.codigo)) {
    return el('div', { class: 'carta carta-misterio', style: `--i: ${i}`, 'aria-label': 'Bichinho ainda não descoberto' },
      el('span', { class: 'carta-avatar' }, icone(iconeMisterio())),
      el('span', { class: 'carta-nome' }, '???'),
      el('span', { class: 'carta-dica' }, icone(iconeQr()), 'Escaneie a peça para descobrir'),
    );
  }
  const item = colecao[c.codigo];
  return el('div', { class: 'carta', style: `--cor-base: ${corDaEspecie(c)}; --i: ${i}`, 'data-especie': c.especie },
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
  const total = contarDescobertos(colecao);
  $('colecao-contador').textContent = `${total} de ${CRIATURAS.length} bichinhos`;
  $('lista-colecao').replaceChildren(...CRIATURAS.map((c, i) => cartaoColecao(c, colecao ?? {}, i)));
  mostrarTela('tela-colecao');
}

// ---------- tela: espera da segunda peça ----------

function abrirEspera(criatura, { repetido = false } = {}) {
  pararNfc();
  app.escolhas = [criatura, null];
  $('espera-selo').replaceChildren(
    el('span', { class: 'cartao-avatar', style: `--cor-base: ${corDaEspecie(criatura)}`, 'data-especie': criatura.especie }, retrato(criatura)),
  );
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

function ligarEventos() {
  // Durante a animação da rodada, qualquer toque só pula para o final.
  document.addEventListener('click', (ev) => {
    if (!app.animacao) return;
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
    if (window.confirm('Sair da partida? A vida dos bichinhos será perdida.')) irParaInicio();
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
    abrirModo();
    return;
  }
  irParaInicio();
}

function iniciar() {
  $('logo-simbolos').replaceChildren(...SIMBOLOS.map(seloSimbolo));
  montarListaEscolha();
  ligarEventos();

  // Deep link do QR da peça: index.html?b=TAT01 (ou só ?b=TAT01 na raiz)
  const codigo = new URLSearchParams(window.location.search).get('b');
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

  chegarCodigo(codigo);
}

// Uma peça chegou, pela URL (?b=) ou pelo NFC lido na tela de espera: entra na
// coleção e segue o loop de escaneio.
function chegarCodigo(codigo) {
  const descoberta = registrarDescoberta(armazemColecao(), codigo);
  const chegada = processarChegada(codigo, armazemEspera());
  if (descoberta.nova) {
    $('desbloqueio-cartao').replaceChildren(cartaoDesbloqueio(descoberta.criatura));
    app.depoisDoDesbloqueio = () => tratarChegada(chegada);
    mostrarTela('tela-desbloqueio');
  } else {
    tratarChegada(chegada);
  }
}

iniciar();
