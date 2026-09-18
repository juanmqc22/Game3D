// Interface da Arena dos Bichinhos: telas, animações, loop de escaneio (?b=),
// coleção em localStorage e os três modos de jogo.
// Nenhuma regra de jogo mora aqui — tudo vem de js/regras.js.

// ?v= igual ao de index.html (ver comentário lá).
import { CRIATURAS, ESPECIES, buscarCriatura } from './criaturas.js?v=9';
import {
  DEFESA, ESPECIAL, SIMBOLOS, ROLAR, ARENA, MIRA, MODOS,
  estadoInicial, resolverRodada, resolverRodadaArena, resolverRodadaMira,
} from './regras.js?v=9';
import {
  iconeSimbolo, iconeEspecial, iconeEscudoAtivo, iconeVida, iconeTrofeu, iconeEmpate,
  iconeRolar, iconeArena, iconeAlvo, iconeDentro, iconeFora, iconeErrou, iconeMisterio, iconeQr,
} from './icones.js?v=9';
import { processarChegada, lerAguardando, limparAguardando } from './escaneio.js?v=9';
import {
  lerColecao, registrarDescoberta, registrarPartida, contarDescobertos, estaDescoberta, sortearOponente,
} from './colecao.js?v=9';

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
// sessionStorage vale por aba; se o leitor de QR do celular abrir uma aba nova a
// cada leitura, troque aqui por window.localStorage (ver js/escaneio.js).
const armazemEspera = () => window.sessionStorage;
const armazemColecao = () => window.localStorage;

// Linha do tempo da rodada (ms). O total não pode passar de 1200.
const TEMPO = {
  impacto: 300,
  barras: 500,
  duracaoBarras: 500,
  texto: 1000,
  fim: 1150,
};

const app = {
  modo: ROLAR,
  escolhas: [null, null], // criaturas escolhidas pelos jogadores 1 e 2
  jogadorEscolhendo: 0,
  escolhaRestrita: false, // fallback da espera: só a coleção + oponente surpresa
  selecionada: null, // criatura marcada na tela de escolha
  partida: null, // estado de js/regras.js
  entradas: [{ simbolo: null, acertou: null }, { simbolo: null, acertou: null }], // rodada atual
  dentro: null, // ARENA: 'ambos' | 0 | 1 | 'nenhum' | null
  ultimaRodada: null, // { antes, resultado, placarGravado }
  animacao: null, // { finalizar } enquanto a rodada anima
  depoisDoDesbloqueio: null, // função a chamar ao tocar "Continuar" no card de novo bichinho
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
      el('span', { class: 'cartao-avatar', 'aria-hidden': 'true' }, c.nome.charAt(0)),
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

// ---------- tela: batalha ----------

function iniciarPartida() {
  app.partida = estadoInicial(app.escolhas[0], app.escolhas[1]);
  app.ultimaRodada = null;
  novaRodadaLimpa();
  renderBatalha();
  mostrarTela('tela-batalha');
}

function novaRodadaLimpa() {
  app.entradas = [{ simbolo: null, acertou: null }, { simbolo: null, acertou: null }];
  app.dentro = null;
}

function renderBatalha() {
  const estado = app.partida;
  const modo = app.modo;
  $('batalha-rodada').textContent = `Rodada ${estado.rodada + 1}`;
  $('batalha-modo').replaceChildren(icone(INFO_MODO[modo].icone()), INFO_MODO[modo].nome);
  $('batalha-instrucao').textContent = INFO_MODO[modo].instrucao;

  const pergunta = $('arena-pergunta');
  pergunta.hidden = modo !== ARENA;
  if (modo === ARENA) {
    const nomes = estado.jogadores.map((_, i) => nomeJogador(estado, i));
    const opcoes = [
      { valor: 'ambos', texto: 'Os dois', icone: iconeDentro },
      { valor: '0', texto: `Só ${nomes[0]}`, icone: iconeDentro },
      { valor: '1', texto: `Só ${nomes[1]}`, icone: iconeDentro },
      { valor: 'nenhum', texto: 'Nenhum', icone: iconeFora },
    ];
    $('arena-opcoes').replaceChildren(...opcoes.map((o) =>
      el('button', { type: 'button', class: 'opcao-dentro', 'data-dentro': o.valor, 'aria-pressed': 'false' },
        icone(o.icone()), el('span', {}, o.texto))));
  }

  estado.jogadores.forEach((j, i) => {
    const painel = $(`painel-${i}`);
    painel.style.setProperty('--cor-base', corDaEspecie(j.criatura));
    painel.dataset.especie = j.criatura.especie;
    painel.classList.toggle('com-escudo', j.escudo);
    const botoes = SIMBOLOS.map((s) =>
      el('button', { type: 'button', class: 'simbolo', 'data-jogador': String(i), 'data-simbolo': s, 'aria-pressed': 'false' },
        icone(iconeSimbolo(s)),
        el('span', {}, rotulo(s)),
      ));
    const alvo = modo !== MIRA ? null : el('div', { class: 'pergunta-alvo' },
      el('span', { class: 'pergunta-alvo-titulo' }, 'Acertou o alvo?'),
      el('div', { class: 'opcoes-alvo', role: 'group', 'aria-label': `Alvo do jogador ${i + 1}` },
        el('button', { type: 'button', class: 'opcao-alvo', 'data-jogador': String(i), 'data-acertou': 'sim', 'aria-pressed': 'false' },
          icone(iconeAlvo()), el('span', {}, 'Acertou')),
        el('button', { type: 'button', class: 'opcao-alvo', 'data-jogador': String(i), 'data-acertou': 'nao', 'aria-pressed': 'false' },
          icone(iconeErrou()), el('span', {}, 'Errou')),
      ));
    painel.replaceChildren(...[
      el('div', { class: 'painel-cabeca' },
        el('div', {},
          el('div', { class: 'painel-jogador' }, `Jogador ${i + 1}`),
          el('div', { class: 'painel-nome' }, j.criatura.nome),
        ),
        j.escudo ? seloEscudo() : null,
      ),
      barraVida(j.vida, j.criatura.vida),
      el('p', { class: 'painel-especial' }, linhaEspecial(j.criatura)),
      el('p', { class: 'painel-situacao', hidden: true }),
      alvo,
      el('div', { class: 'simbolos', role: 'group', 'aria-label': `Símbolo do jogador ${i + 1}` }, ...botoes),
    ].filter((n) => n !== null));
  });
  atualizarEntradas();
}

// ARENA: a face só é perguntada quando os dois ficaram dentro do círculo.
function precisaFace() {
  if (app.modo !== ARENA) return true;
  return app.dentro === 'ambos';
}

function atualizarEntradas() {
  const modo = app.modo;
  const estado = app.partida;

  if (modo === ARENA) {
    for (const b of $('arena-opcoes').children) {
      b.setAttribute('aria-pressed', String(app.dentro !== null && b.dataset.dentro === String(app.dentro)));
    }
  }

  for (let i = 0; i < 2; i++) {
    const painel = $(`painel-${i}`);
    const grupo = painel.querySelector('.simbolos');
    const mostrarFace = precisaFace();
    grupo.hidden = !mostrarFace;
    grupo.classList.toggle('tem-escolha', app.entradas[i].simbolo !== null);
    for (const b of grupo.children) {
      b.setAttribute('aria-pressed', String(b.dataset.simbolo === app.entradas[i].simbolo));
    }
    const situacao = painel.querySelector('.painel-situacao');
    if (modo === ARENA && app.dentro !== null && app.dentro !== 'ambos') {
      const ficouDentro = app.dentro === i;
      situacao.hidden = false;
      situacao.className = `painel-situacao ${ficouDentro ? 'dentro' : 'fora'}`;
      situacao.replaceChildren(icone(ficouDentro ? iconeDentro() : iconeFora()),
        ficouDentro ? 'Ficou dentro do círculo' : 'Ficou fora do círculo');
    } else {
      situacao.hidden = true;
    }
    if (modo === MIRA) {
      const grupoAlvo = painel.querySelector('.opcoes-alvo');
      grupoAlvo.classList.toggle('tem-escolha', app.entradas[i].acertou !== null);
      for (const b of grupoAlvo.children) {
        const valor = b.dataset.acertou === 'sim';
        b.setAttribute('aria-pressed', String(app.entradas[i].acertou === valor));
      }
    }
  }

  const botao = $('btn-resolver');
  const facesOk = !precisaFace() || app.entradas.every((e) => e.simbolo !== null);
  if (modo === ARENA) {
    if (app.dentro === null) {
      botao.disabled = true;
      botao.textContent = 'Quem ficou dentro?';
    } else if (app.dentro === 'nenhum') {
      botao.disabled = false;
      botao.textContent = 'Ninguém dentro: rodada nula';
    } else if (app.dentro === 'ambos') {
      botao.disabled = !facesOk;
      botao.textContent = 'Resolver rodada';
    } else {
      botao.disabled = false;
      botao.textContent = `${nomeJogador(estado, app.dentro)} ficou dentro: resolver`;
    }
  } else if (modo === MIRA) {
    const alvosOk = app.entradas.every((e) => e.acertou !== null);
    botao.disabled = !(facesOk && alvosOk);
    botao.textContent = alvosOk || !facesOk ? 'Resolver rodada' : 'Falta dizer quem acertou o alvo';
  } else {
    botao.disabled = !facesOk;
    botao.textContent = 'Resolver rodada';
  }
}

function tocarBatalha(ev) {
  const simbolo = ev.target.closest('.simbolo');
  if (simbolo) {
    const i = Number(simbolo.dataset.jogador);
    const s = simbolo.dataset.simbolo;
    // tocar de novo no mesmo símbolo desmarca
    app.entradas[i].simbolo = app.entradas[i].simbolo === s ? null : s;
    atualizarEntradas();
    return;
  }
  const alvo = ev.target.closest('.opcao-alvo');
  if (alvo) {
    const i = Number(alvo.dataset.jogador);
    const valor = alvo.dataset.acertou === 'sim';
    app.entradas[i].acertou = app.entradas[i].acertou === valor ? null : valor;
    atualizarEntradas();
    return;
  }
  const dentro = ev.target.closest('.opcao-dentro');
  if (dentro) {
    const v = dentro.dataset.dentro;
    const valor = v === '0' || v === '1' ? Number(v) : v;
    app.dentro = app.dentro === valor ? null : valor;
    atualizarEntradas();
  }
}

function resolver() {
  const antes = app.partida;
  const simbolos = app.entradas.map((e) => e.simbolo);
  let resultado;
  if (app.modo === ARENA) {
    if (app.dentro === null) return;
    const dentro = [app.dentro === 'ambos' || app.dentro === 0, app.dentro === 'ambos' || app.dentro === 1];
    if (app.dentro === 'ambos' && simbolos.some((s) => s === null)) return;
    resultado = resolverRodadaArena(antes, dentro, simbolos);
  } else if (app.modo === MIRA) {
    if (simbolos.some((s) => s === null) || app.entradas.some((e) => e.acertou === null)) return;
    resultado = resolverRodadaMira(antes, app.entradas.map((e) => e.acertou), simbolos);
  } else {
    if (simbolos.some((s) => s === null)) return;
    resultado = resolverRodada(antes, simbolos[0], simbolos[1]);
  }
  app.partida = resultado.estado;
  novaRodadaLimpa();
  app.ultimaRodada = { antes, resultado, placarGravado: false };
  if (resultado.fim.terminou) {
    const codigos = resultado.estado.jogadores.map((j) => j.criatura.codigo);
    app.ultimaRodada.placarGravado = registrarPartida(armazemColecao(), codigos, resultado.fim.vencedor);
  }
  const cena = renderResultado();
  mostrarTela('tela-resultado');
  animarRodada(cena);
}

// ---------- tela: resultado da rodada ----------

// Monta as frases da rodada a partir do resumo de js/regras.js.
function descreverRodada(estado, resumo) {
  const nome = (i) => nomeJogador(estado, i);
  const [sa, sb] = resumo.simbolos;
  const face = (i) => {
    if (resumo.modo === ARENA && resumo.dentro && !resumo.dentro[i]) return 'FORA';
    const s = resumo.simbolos[i];
    return s === null ? 'DENTRO' : rotulo(s);
  };
  const confronto = `${nome(0)}: ${face(0)}  ×  ${nome(1)}: ${face(1)}`;

  if (resumo.nula) {
    return {
      confronto,
      principal: 'Ninguém ficou dentro do círculo. Rodada nula!',
      destaque: null,
      detalhes: ['Ninguém perde vida. Arremessem de novo.'],
    };
  }

  if (resumo.vencedor === null) {
    return {
      confronto,
      principal: `Empate! Os dois tiraram ${rotulo(sa)}.`,
      destaque: null,
      detalhes: ['Ninguém perde vida.'],
    };
  }

  const v = resumo.vencedor;
  const p = 1 - v;
  const detalhes = [];
  const danoNoPerdedor = resumo.bloqueado ? `0 no ${nome(p)} (escudo)` : `-${resumo.dano} no ${nome(p)}`;
  let principal;

  if (resumo.bonusFora > 0) {
    // ARENA: só um ficou dentro
    principal = `${nome(v)} ficou dentro e ${nome(p)} ficou fora: ${danoNoPerdedor}`;
    detalhes.push(`Quem fica fora leva a força do outro (${resumo.danoBase}) + ${resumo.bonusFora} = ${resumo.danoPrevisto}.`);
  } else if (resumo.simboloVencedor === ESPECIAL) {
    const especial = estado.jogadores[v].criatura.especial;
    const partes = [danoNoPerdedor];
    if (resumo.cura > 0) partes.push(`+${resumo.cura} no ${nome(v)}`);
    if (resumo.recuo > 0) partes.push(`-${resumo.recuo} no ${nome(v)}`);
    if (resumo.escudoAtivado) partes.push(`escudo ligado no ${nome(v)}`);
    principal = `${nome(v)} venceu com ESPECIAL — ${especial.nome}: ${partes.join(', ')}`;

    if (especial.roubo && resumo.bloqueado) {
      detalhes.push(`Sem roubo de vida: o dano não passou, então ${nome(v)} não ganha +${especial.cura}.`);
    } else if (especial.cura > 0 && resumo.cura < especial.cura) {
      detalhes.push(`${nome(v)} só ganhou +${resumo.cura}: a vida não passa do máximo.`);
    }
    if (especial.escudo && !resumo.escudoAtivado) {
      detalhes.push(`${nome(v)} já estava com escudo (não acumula).`);
    }
    if (resumo.recuo > 0) {
      detalhes.push(`${especial.nome} machuca quem usa: -${resumo.recuo} no ${nome(v)}.`);
    }
  } else {
    const contra = resumo.simboloVencedor === DEFESA ? ' (contra-ataque)' : '';
    principal = `${nome(v)} venceu com ${rotulo(resumo.simboloVencedor)}${contra}: ${danoNoPerdedor}`;
  }

  if (resumo.bonusTropeco > 0) {
    detalhes.unshift(resumo.bloqueado
      ? `${nome(p)} tropeçou (+${resumo.bonusTropeco} de dano), mas o escudo segurou tudo.`
      : `${nome(p)} tropeçou: +${resumo.bonusTropeco} de dano.`);
  }

  if (resumo.modo === MIRA) {
    const soma = resumo.danoBase + resumo.bonusTropeco + resumo.bonusAcerto;
    if (resumo.metade) {
      detalhes.push(`${nome(v)} errou o alvo: o dano caiu pela metade (${soma} → ${resumo.danoPrevisto}).`);
    } else if (resumo.bonusAcerto > 0) {
      detalhes.push(`${nome(v)} acertou o alvo: +${resumo.bonusAcerto} de dano.`);
    } else {
      detalhes.push(`${nome(v)} acertou o alvo, mas o extra da rodada já é +${resumo.bonusTropeco} pelo tropeço.`);
    }
    if (!resumo.bloqueado && (resumo.bonusTropeco > 0 || resumo.bonusAcerto > 0 || resumo.metade)) {
      detalhes.push(`Dano final: ${resumo.dano}.`);
    }
  } else if (resumo.bonusTropeco > 0 && !resumo.bloqueado) {
    detalhes.push(`${resumo.danoBase} + ${resumo.bonusTropeco} = ${resumo.dano} de dano.`);
  }

  const destaque = resumo.bloqueado
    ? `O ESCUDO do ${nome(p)} bloqueou todo o dano! O escudo acabou.`
    : null;

  const [va, vb] = estado.jogadores.map((j) => j.vida);
  if (resumo.recuo > 0 && estado.jogadores[v].vida === 0) {
    detalhes.push(`${nome(v)} se machucou com o próprio golpe e ficou sem vida!`);
  } else if (va === 0 && vb === 0) {
    detalhes.push('Os dois ficaram sem vida!');
  }

  return { confronto, principal, destaque, detalhes };
}

// O que cada painel faz na animação (papel e números flutuantes).
function efeitosDoPainel(resumo, i) {
  if (resumo.vencedor === null) return { papel: null, flutuantes: [] };
  if (i !== resumo.vencedor) {
    if (resumo.bloqueado) {
      return { papel: 'protegido', flutuantes: [{ tipo: 'bloqueado', valor: resumo.danoPrevisto }] };
    }
    return { papel: 'levou-dano', flutuantes: [{ tipo: 'dano', texto: `-${resumo.dano}` }] };
  }
  const flutuantes = [];
  if (resumo.cura > 0) flutuantes.push({ tipo: 'cura', texto: `+${resumo.cura}` });
  if (resumo.recuo > 0) flutuantes.push({ tipo: 'dano', texto: `-${resumo.recuo}` });
  return { papel: 'venceu', flutuantes };
}

function numeroFlutuante(f) {
  if (f.tipo === 'bloqueado') {
    return el('span', { class: 'flutua bloqueado', 'aria-label': `${f.valor} de dano bloqueado` }, el('s', {}, String(f.valor)));
  }
  return el('span', { class: `flutua ${f.tipo}` }, f.texto);
}

// Ficha do jogador na arena do resultado: símbolo, ou DENTRO/FORA na Arena.
function preencherFicha(ficha, resumo, i) {
  const simbolo = resumo.simbolos[i];
  ficha.className = 'ficha';
  delete ficha.dataset.simbolo;
  if (resumo.vencedor !== null) ficha.classList.add(resumo.vencedor === i ? 'venceu' : 'perdeu');
  const filhos = [];
  if (resumo.modo === ARENA && !resumo.dentro[i]) {
    ficha.classList.add('fora');
    filhos.push(icone(iconeFora()), el('span', {}, 'FORA'));
  } else if (simbolo === null) {
    ficha.classList.add('dentro');
    filhos.push(icone(iconeDentro()), el('span', {}, 'DENTRO'));
  } else {
    ficha.dataset.simbolo = simbolo;
    filhos.push(icone(iconeSimbolo(simbolo)), el('span', {}, rotulo(simbolo)));
  }
  if (resumo.modo === MIRA) {
    const acertou = resumo.acertou[i];
    ficha.classList.add('tem-alvo');
    filhos.push(el('span', { class: `ficha-alvo ${acertou ? 'acertou' : 'errou'}` },
      icone(acertou ? iconeAlvo() : iconeErrou()), acertou ? 'acertou' : 'errou'));
  }
  ficha.replaceChildren(...filhos);
}

// Desenha a tela no estado "antes" e devolve o que a animação precisa.
function renderResultado() {
  const { antes, resultado } = app.ultimaRodada;
  const { estado, resumo, fim } = resultado;
  const texto = descreverRodada(estado, resumo);
  const tela = $('tela-resultado');
  tela.classList.remove('fase-choque', 'fase-impacto', 'fase-texto', 'sem-transicao');

  $('resultado-rodada').textContent = `Rodada ${resumo.numero} · ${INFO_MODO[resumo.modo].nome}`;

  const paineis = estado.jogadores.map((j, i) => {
    const jAntes = antes.jogadores[i];
    const efeitos = efeitosDoPainel(resumo, i);
    const barra = barraVida(jAntes.vida, j.criatura.vida);
    const escudo = seloEscudo();
    escudo.classList.toggle('desligado', !jAntes.escudo);
    const flutuantes = el('div', { class: 'flutuantes' });
    const painel = $(`res-painel-${i}`);
    painel.className = `painel-res${efeitos.papel ? ` ${efeitos.papel}` : ''}`;
    painel.style.setProperty('--cor-base', corDaEspecie(j.criatura));
    painel.dataset.especie = j.criatura.especie;
    painel.replaceChildren(
      el('div', { class: 'painel-res-cabeca' },
        el('span', { class: 'painel-res-nome' }, `J${i + 1} · ${j.criatura.nome}`),
        escudo,
      ),
      barra,
      flutuantes,
      el('div', { class: 'halo' }),
    );

    preencherFicha($(`ficha-${i}`), resumo, i);
    $('arena-palco').classList.toggle('tem-alvo', resumo.modo === MIRA);

    return {
      barra, escudo, flutuantes,
      vidaAntes: jAntes.vida, vidaDepois: j.vida,
      escudoDepois: j.escudo, lista: efeitos.flutuantes,
    };
  });

  $('resultado-confronto').textContent = texto.confronto;
  $('resultado-frase').textContent = texto.principal;
  const destaque = $('resultado-destaque');
  destaque.hidden = !texto.destaque;
  destaque.replaceChildren(...(texto.destaque ? [icone(iconeEscudoAtivo()), el('span', {}, texto.destaque)] : []));
  $('resultado-detalhes').replaceChildren(...texto.detalhes.map((d) => el('li', {}, d)));
  $('btn-proxima').textContent = fim.terminou ? 'Ver quem ganhou' : 'Próxima rodada';

  return { tela, paineis };
}

// Sequência de no máximo 1,2s. Um toque em qualquer lugar pula para o final.
function animarRodada(cena) {
  const { tela, paineis } = cena;
  const botao = $('btn-proxima');
  const timers = [];

  const finalizar = () => {
    if (app.animacao !== anim) return;
    for (const t of timers) clearTimeout(t);
    tela.classList.add('sem-transicao', 'fase-choque', 'fase-impacto', 'fase-texto');
    for (const p of paineis) {
      p.barra.definir(p.vidaDepois);
      p.escudo.classList.toggle('desligado', !p.escudoDepois);
      p.flutuantes.replaceChildren();
    }
    app.animacao = null;
    botao.setAttribute('aria-disabled', 'false');
  };
  const anim = { finalizar };
  app.animacao = anim;
  botao.setAttribute('aria-disabled', 'true');

  if (movimentoReduzido()) {
    finalizar();
    return;
  }

  const em = (ms, fn) => timers.push(setTimeout(fn, ms));
  void tela.offsetWidth; // aplica o estado inicial antes de começar as transições

  // 1. (0-300) símbolos crescem e se aproximam
  tela.classList.add('fase-choque');
  // 2. (300-500) impacto: clarão, tremida em quem levou dano, pulinho no vencedor, halo do escudo
  em(TEMPO.impacto, () => {
    tela.classList.add('fase-impacto');
    for (const p of paineis) {
      if (!p.escudoDepois) p.escudo.classList.add('desligado');
    }
  });
  // 3. (500-1000) barras deslizam, número conta, dano flutua
  em(TEMPO.barras, () => {
    for (const p of paineis) {
      p.barra.animarPara(p.vidaAntes, p.vidaDepois, TEMPO.duracaoBarras);
      p.flutuantes.replaceChildren(...p.lista.map(numeroFlutuante));
      if (p.escudoDepois) p.escudo.classList.remove('desligado');
    }
  });
  // 4. (1000-1200) frase aparece
  em(TEMPO.texto, () => tela.classList.add('fase-texto'));
  em(TEMPO.fim, finalizar);
}

function proximaRodada() {
  if (app.animacao) return;
  if (app.ultimaRodada?.resultado.fim.terminou) {
    renderFim();
    mostrarTela('tela-fim');
  } else {
    renderBatalha();
    mostrarTela('tela-batalha');
  }
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
  iconeFim.replaceChildren(icone(empate ? iconeEmpate() : iconeTrofeu()));
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
    el('span', { class: 'carta-avatar', 'aria-hidden': 'true' }, c.nome.charAt(0)),
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
  app.escolhas = [criatura, null];
  $('espera-selo').replaceChildren(
    el('span', { class: 'cartao-avatar', style: `--cor-base: ${corDaEspecie(criatura)}`, 'data-especie': criatura.especie }, criatura.nome.charAt(0)),
  );
  $('espera-titulo').textContent = `${criatura.nome} está pronto!`;
  $('espera-texto').textContent = 'Agora escaneie o bichinho do seu oponente.';
  const aviso = $('espera-aviso');
  aviso.hidden = !repetido;
  aviso.textContent = 'Esse é o mesmo bichinho! Escaneie outro.';
  $('espera-qr').replaceChildren(el('span', { class: 'mira-leitura' }, icone(iconeQr())));
  mostrarTela('tela-espera');
}

function recomecar() {
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
  $('btn-resolver').addEventListener('click', resolver);
  $('btn-sair').addEventListener('click', () => {
    if (window.confirm('Sair da partida? A vida dos bichinhos será perdida.')) irParaInicio();
  });
  $('btn-proxima').addEventListener('click', proximaRodada);

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
