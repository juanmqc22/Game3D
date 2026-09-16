// Interface da Arena dos Bichinhos: telas, animações, deep link ?b= e placar em localStorage.
// Nenhuma regra de jogo mora aqui — tudo vem de js/regras.js.

import { CRIATURAS, ESPECIES, buscarCriatura } from './criaturas.js';
import { DEFESA, ESPECIAL, SIMBOLOS, estadoInicial, resolverRodada } from './regras.js';
import {
  iconeSimbolo, iconeEspecial, iconeEscudoAtivo, iconeVida, iconeTrofeu, iconeEmpate,
} from './icones.js';

const ROTULOS = {
  ATAQUE: 'ATAQUE',
  DEFESA: 'DEFESA',
  ESPECIAL: 'ESPECIAL',
  TROPECO: 'TROPEÇO',
};

const CHAVE_PLACAR = 'arena-dos-bichinhos:placar';

// Linha do tempo da rodada (ms). O total não pode passar de 1200.
const TEMPO = {
  impacto: 300,
  barras: 500,
  duracaoBarras: 500,
  texto: 1000,
  fim: 1150,
};

const app = {
  escolhas: [null, null], // criaturas escolhidas pelos jogadores 1 e 2
  jogadorEscolhendo: 0,
  selecionada: null, // criatura marcada na tela de escolha
  partida: null, // estado de js/regras.js
  simbolos: [null, null], // símbolos tocados na rodada atual
  ultimaRodada: null, // { antes, resultado, placarGravado }
  animacao: null, // { timers, barras, finalizar } enquanto a rodada anima
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
  window.scrollTo(0, 0);
}

function rotulo(simbolo) {
  return ROTULOS[simbolo];
}

function corDaEspecie(criatura) {
  return ESPECIES[criatura.especie]?.cor ?? '#111';
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

function barraVida(vida, max) {
  const barra = el('div', { class: 'vida-barra' });
  const numero = el('span', { class: 'vida-numero' });
  const bloco = el('div', { class: 'vida' },
    el('div', { class: 'vida-trilho', role: 'presentation' }, barra),
    numero,
  );
  let quadro = null;

  const pintar = (v) => {
    const p = max > 0 ? v / max : 0;
    barra.style.transform = `scaleX(${p})`;
    const faixa = faixaDaVida(p);
    barra.classList.toggle('faixa-media', faixa === 'media');
    barra.classList.toggle('faixa-baixa', faixa === 'baixa');
    bloco.setAttribute('aria-label', `Vida ${v} de ${max}`);
  };
  const escrever = (v) => { numero.textContent = `${v}/${max}`; };

  bloco.definir = (v) => {
    if (quadro) cancelAnimationFrame(quadro);
    quadro = null;
    barra.classList.remove('animar');
    pintar(v);
    escrever(v);
  };

  // Desliza a barra e conta o número junto.
  bloco.animarPara = (de, para, duracao) => {
    barra.classList.add('animar');
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

// ---------- placar (localStorage pode não existir) ----------

function lerPlacar() {
  try {
    const bruto = window.localStorage.getItem(CHAVE_PLACAR);
    const placar = bruto ? JSON.parse(bruto) : {};
    return placar && typeof placar === 'object' ? placar : {};
  } catch {
    return null;
  }
}

// Empates e partidas espelhadas não entram no placar.
function gravarPlacar(estado, fim) {
  if (fim.vencedor === null) return false;
  const vencedor = estado.jogadores[fim.vencedor].criatura.codigo;
  const perdedor = estado.jogadores[1 - fim.vencedor].criatura.codigo;
  if (vencedor === perdedor) return false;
  try {
    const placar = lerPlacar() ?? {};
    const somar = (codigo, campo) => {
      const atual = placar[codigo] ?? {};
      placar[codigo] = { v: Number(atual.v) || 0, d: Number(atual.d) || 0 };
      placar[codigo][campo] += 1;
    };
    somar(vencedor, 'v');
    somar(perdedor, 'd');
    window.localStorage.setItem(CHAVE_PLACAR, JSON.stringify(placar));
    return true;
  } catch {
    return false;
  }
}

function textoPlacar(placar, codigo) {
  const { v = 0, d = 0 } = placar?.[codigo] ?? {};
  return el('span', { class: 'cartao-placar' },
    el('span', { class: 'v' }, `${v} ${v === 1 ? 'vitória' : 'vitórias'}`),
    ' · ',
    el('span', { class: 'd' }, `${d} ${d === 1 ? 'derrota' : 'derrotas'}`),
  );
}

// ---------- cartão de criatura ----------

// tocavel: botão na tela de escolha; senão, cartão só informativo.
// placar: objeto do localStorage, ou null quando indisponível (linha omitida).
function cartaoCriatura(c, { tocavel, placar }) {
  const especie = ESPECIES[c.especie]?.rotulo ?? c.especie;
  const props = tocavel
    ? { type: 'button', class: 'cartao', style: `--cor: ${corDaEspecie(c)}`, 'data-codigo': c.codigo, 'aria-pressed': 'false' }
    : { class: 'cartao cartao-info', style: `--cor: ${corDaEspecie(c)}` };
  return el(tocavel ? 'button' : 'div', props,
    el('span', { class: 'cartao-topo' },
      el('span', {},
        el('span', { class: 'cartao-nome' }, c.nome),
        tocavel ? el('span', { class: 'cartao-marca' }, 'ESCOLHIDO') : null,
      ),
      el('span', { class: 'cartao-codigo' }, `${especie} · ${c.codigo}`),
    ),
    el('span', { class: 'cartao-status' },
      el('span', {}, icone(iconeVida()), ` ${c.vida} de vida`),
      el('span', {}, `Força ${c.forca}`),
    ),
    el('span', { class: 'cartao-especial' }, linhaEspecial(c)),
    placar === null ? null : textoPlacar(placar, c.codigo),
  );
}

// ---------- tela: escolher bichinho ----------

function montarListaEscolha() {
  $('lista-criaturas').addEventListener('click', (ev) => {
    const cartao = ev.target.closest('.cartao');
    if (!cartao) return;
    esconderErro();
    selecionar(buscarCriatura(cartao.dataset.codigo));
  });
}

function abrirEscolha(jogador, codigoInicial = null) {
  app.jogadorEscolhendo = jogador;
  app.selecionada = null;
  const placar = lerPlacar();
  $('lista-criaturas').replaceChildren(...CRIATURAS.map((c) => cartaoCriatura(c, { tocavel: true, placar })));
  $('escolha-titulo').textContent = `Jogador ${jogador + 1}: escolha seu bichinho`;
  const anterior = $('escolha-anterior');
  anterior.hidden = jogador === 0;
  if (jogador === 1) anterior.textContent = `Jogador 1 escolheu ${app.escolhas[0].nome}.`;
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
    const marcado = app.selecionada?.codigo === cartao.dataset.codigo;
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
  if (app.jogadorEscolhendo === 0) {
    abrirEscolha(1);
  } else {
    iniciarPartida();
  }
}

// ---------- tela: batalha ----------

function iniciarPartida() {
  app.partida = estadoInicial(app.escolhas[0], app.escolhas[1]);
  app.simbolos = [null, null];
  app.ultimaRodada = null;
  renderBatalha();
  mostrarTela('tela-batalha');
}

function renderBatalha() {
  const estado = app.partida;
  $('batalha-rodada').textContent = `Rodada ${estado.rodada + 1}`;
  estado.jogadores.forEach((j, i) => {
    const painel = $(`painel-${i}`);
    painel.style.setProperty('--cor', corDaEspecie(j.criatura));
    const botoes = SIMBOLOS.map((s) =>
      el('button', { type: 'button', class: 'simbolo', 'data-jogador': String(i), 'data-simbolo': s, 'aria-pressed': 'false' },
        icone(iconeSimbolo(s)),
        el('span', {}, rotulo(s)),
      ));
    painel.replaceChildren(
      el('div', { class: 'painel-cabeca' },
        el('div', {},
          el('div', { class: 'painel-jogador' }, `Jogador ${i + 1}`),
          el('div', { class: 'painel-nome' }, j.criatura.nome),
        ),
        j.escudo ? seloEscudo() : null,
      ),
      barraVida(j.vida, j.criatura.vida),
      el('p', { class: 'painel-especial' }, linhaEspecial(j.criatura)),
      el('div', { class: 'simbolos', role: 'group', 'aria-label': `Símbolo do jogador ${i + 1}` }, ...botoes),
    );
  });
  atualizarSimbolos();
}

function atualizarSimbolos() {
  for (let i = 0; i < 2; i++) {
    const grupo = $(`painel-${i}`).querySelector('.simbolos');
    grupo.classList.toggle('tem-escolha', app.simbolos[i] !== null);
    for (const b of grupo.children) {
      b.setAttribute('aria-pressed', String(b.dataset.simbolo === app.simbolos[i]));
    }
  }
  $('btn-resolver').disabled = app.simbolos.some((s) => s === null);
}

function tocarSimbolo(ev) {
  const botao = ev.target.closest('.simbolo');
  if (!botao) return;
  const i = Number(botao.dataset.jogador);
  const s = botao.dataset.simbolo;
  // tocar de novo no mesmo símbolo desmarca
  app.simbolos[i] = app.simbolos[i] === s ? null : s;
  atualizarSimbolos();
}

function resolver() {
  if (app.simbolos.some((s) => s === null)) return;
  const antes = app.partida;
  const resultado = resolverRodada(antes, app.simbolos[0], app.simbolos[1]);
  app.partida = resultado.estado;
  app.simbolos = [null, null];
  app.ultimaRodada = { antes, resultado, placarGravado: false };
  if (resultado.fim.terminou) {
    app.ultimaRodada.placarGravado = gravarPlacar(resultado.estado, resultado.fim);
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
  const confronto = `${nome(0)}: ${rotulo(sa)}  ×  ${nome(1)}: ${rotulo(sb)}`;

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

  if (resumo.simboloVencedor === ESPECIAL) {
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
      : `${nome(p)} tropeçou: ${resumo.danoBase} + ${resumo.bonusTropeco} = ${resumo.dano} de dano.`);
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
      return { papel: 'protegido', flutuantes: [{ tipo: 'bloqueado', valor: resumo.danoBase + resumo.bonusTropeco }] };
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

// Desenha a tela no estado "antes" e devolve o que a animação precisa.
function renderResultado() {
  const { antes, resultado } = app.ultimaRodada;
  const { estado, resumo, fim } = resultado;
  const texto = descreverRodada(estado, resumo);
  const tela = $('tela-resultado');
  tela.classList.remove('fase-choque', 'fase-impacto', 'fase-texto', 'sem-transicao');

  $('resultado-rodada').textContent = `Rodada ${resumo.numero}`;

  const paineis = estado.jogadores.map((j, i) => {
    const jAntes = antes.jogadores[i];
    const efeitos = efeitosDoPainel(resumo, i);
    const barra = barraVida(jAntes.vida, j.criatura.vida);
    const escudo = seloEscudo();
    escudo.classList.toggle('desligado', !jAntes.escudo);
    const flutuantes = el('div', { class: 'flutuantes' });
    const painel = $(`res-painel-${i}`);
    painel.className = `painel-res${efeitos.papel ? ` ${efeitos.papel}` : ''}`;
    painel.style.setProperty('--cor', corDaEspecie(j.criatura));
    painel.replaceChildren(
      el('div', { class: 'painel-res-cabeca' },
        el('span', { class: 'painel-res-nome' }, `J${i + 1} · ${j.criatura.nome}`),
        escudo,
      ),
      barra,
      flutuantes,
      el('div', { class: 'halo' }),
    );

    const ficha = $(`ficha-${i}`);
    const simbolo = resumo.simbolos[i];
    ficha.className = 'ficha';
    if (resumo.vencedor !== null) ficha.classList.add(resumo.vencedor === i ? 'venceu' : 'perdeu');
    ficha.dataset.simbolo = simbolo;
    ficha.replaceChildren(icone(iconeSimbolo(simbolo)), el('span', {}, rotulo(simbolo)));

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
    sub.textContent = `Parabéns, Jogador ${fim.vencedor + 1}! (${estado.rodada} rodadas)`;
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
  if (empate) aviso.textContent = 'Empate não conta no placar.';
  else if (espelhada) aviso.textContent = 'Bichinhos iguais: esta partida não conta no placar.';
  else aviso.textContent = 'Não foi possível guardar o placar neste navegador.';
}

// ---------- tela: meus bichinhos ----------

function abrirPlacar() {
  const placar = lerPlacar();
  $('placar-indisponivel').hidden = placar !== null;
  $('lista-placar').replaceChildren(...CRIATURAS.map((c) => cartaoCriatura(c, { tocavel: false, placar: placar ?? {} })));
  mostrarTela('tela-placar');
}

// ---------- início ----------

function novaBatalha() {
  app.escolhas = [null, null];
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

  $('btn-nova-batalha').addEventListener('click', novaBatalha);
  $('btn-meus-bichinhos').addEventListener('click', abrirPlacar);
  $('btn-placar-voltar').addEventListener('click', () => mostrarTela('tela-inicio'));

  $('form-codigo').addEventListener('submit', (ev) => {
    ev.preventDefault();
    tentarCodigo($('campo-codigo').value);
  });
  $('campo-codigo').addEventListener('input', esconderErro);
  $('btn-escolha-confirmar').addEventListener('click', confirmarEscolha);
  $('btn-escolha-voltar').addEventListener('click', () => {
    if (app.jogadorEscolhendo === 1) abrirEscolha(0);
    else mostrarTela('tela-inicio');
  });

  $('tela-batalha').addEventListener('click', tocarSimbolo);
  $('btn-resolver').addEventListener('click', resolver);
  $('btn-sair').addEventListener('click', () => {
    if (window.confirm('Sair da partida? A vida dos bichinhos será perdida.')) mostrarTela('tela-inicio');
  });
  $('btn-proxima').addEventListener('click', proximaRodada);

  $('btn-revanche').addEventListener('click', iniciarPartida);
  $('btn-fim-nova').addEventListener('click', novaBatalha);
}

function iniciar() {
  $('logo-simbolos').replaceChildren(...SIMBOLOS.map(seloSimbolo));
  montarListaEscolha();
  ligarEventos();
  // Deep link do QR da peça: index.html?b=TAT01 (ou só ?b=TAT01 na raiz)
  const codigo = new URLSearchParams(window.location.search).get('b');
  if (codigo !== null) {
    abrirEscolha(0, codigo);
  } else {
    mostrarTela('tela-inicio');
  }
}

iniciar();
