// Interface da Arena dos Bichinhos: telas, deep link ?b= e placar em localStorage.
// Nenhuma regra de jogo mora aqui — tudo vem de js/regras.js.

import { CRIATURAS, ESPECIES, buscarCriatura } from './criaturas.js';
import { DEFESA, ESPECIAL, SIMBOLOS, estadoInicial, resolverRodada } from './regras.js';

const ROTULOS = {
  ATAQUE: { texto: 'ATAQUE', icone: '⚔️' },
  DEFESA: { texto: 'DEFESA', icone: '🛡️' },
  ESPECIAL: { texto: 'ESPECIAL', icone: '⭐' },
  TROPECO: { texto: 'TROPEÇO', icone: '🌀' },
};

const CHAVE_PLACAR = 'arena-dos-bichinhos:placar';

const app = {
  escolhas: [null, null], // criaturas escolhidas pelos jogadores 1 e 2
  jogadorEscolhendo: 0,
  selecionada: null, // criatura marcada na tela de escolha
  partida: null, // estado de js/regras.js
  simbolos: [null, null], // símbolos tocados na rodada atual
  ultimaRodada: null, // { antes, resultado }
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

function mostrarTela(id) {
  for (const tela of document.querySelectorAll('.tela')) {
    tela.hidden = tela.id !== id;
  }
  window.scrollTo(0, 0);
}

function rotulo(simbolo) {
  return ROTULOS[simbolo].texto;
}

function corDaEspecie(criatura) {
  return ESPECIES[criatura.especie]?.cor ?? '#111';
}

function linhaEspecial(criatura) {
  return el('span', {}, el('b', {}, `⭐ ${criatura.especial.nome}: `), criatura.especial.texto);
}

// Em partida espelhada os dois têm o mesmo nome; o número do jogador desfaz a dúvida.
function nomeJogador(estado, i) {
  const [a, b] = estado.jogadores;
  const nome = estado.jogadores[i].criatura.nome;
  return a.criatura.codigo === b.criatura.codigo ? `${nome} (J${i + 1})` : nome;
}

// ---------- barra de vida ----------

function barraVida(vida, max) {
  const barra = el('div', { class: 'vida-barra' });
  const numero = el('span', { class: 'vida-numero' });
  const bloco = el('div', { class: 'vida' },
    el('div', { class: 'vida-trilho', role: 'presentation' }, barra),
    numero,
  );
  bloco.atualizar = (v) => {
    const p = max > 0 ? v / max : 0;
    barra.style.width = `${Math.round(p * 100)}%`;
    barra.classList.toggle('media', p <= 0.5 && p > 0.25);
    barra.classList.toggle('baixa', p <= 0.25);
    numero.textContent = `${v}/${max}`;
    bloco.setAttribute('aria-label', `Vida ${v} de ${max}`);
  };
  bloco.atualizar(vida);
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

// ---------- tela: escolher bichinho ----------

// Cartão tocável (tela de escolha) ou só informativo (placar, com `extra`).
function cartaoCriatura(c, extra = null) {
  const props = extra
    ? { class: 'cartao cartao-info', style: `--cor: ${corDaEspecie(c)}` }
    : { type: 'button', class: 'cartao', style: `--cor: ${corDaEspecie(c)}`, 'data-codigo': c.codigo, 'aria-pressed': 'false' };
  return el(extra ? 'div' : 'button', props,
    el('span', { class: 'cartao-topo' },
      el('span', { class: 'cartao-nome' }, c.nome),
      el('span', { class: 'cartao-codigo' }, `${ESPECIES[c.especie]?.rotulo ?? c.especie} · ${c.codigo}`),
    ),
    el('span', { class: 'cartao-status' }, `❤️ ${c.vida} de vida   💪 ${c.forca} de força`),
    el('span', { class: 'cartao-especial' }, linhaEspecial(c)),
    extra,
  );
}

function montarListaEscolha() {
  const lista = $('lista-criaturas');
  lista.replaceChildren(...CRIATURAS.map((c) => cartaoCriatura(c)));
  lista.addEventListener('click', (ev) => {
    const cartao = ev.target.closest('.cartao');
    if (!cartao) return;
    esconderErro();
    selecionar(buscarCriatura(cartao.dataset.codigo));
  });
}

function abrirEscolha(jogador, codigoInicial = null) {
  app.jogadorEscolhendo = jogador;
  app.selecionada = null;
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
        el('span', { class: 'icone', 'aria-hidden': 'true' }, ROTULOS[s].icone),
        el('span', {}, ROTULOS[s].texto),
      ));
    painel.replaceChildren(
      el('div', { class: 'painel-cabeca' },
        el('div', {},
          el('div', { class: 'painel-jogador' }, `Jogador ${i + 1}`),
          el('div', { class: 'painel-nome' }, j.criatura.nome),
        ),
        j.escudo ? el('span', { class: 'selo-escudo' }, '🔒 ESCUDO LIGADO') : null,
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
  app.ultimaRodada = { antes, resultado };
  if (resultado.fim.terminou) {
    app.ultimaRodada.placarGravado = gravarPlacar(resultado.estado, resultado.fim);
  }
  renderResultado();
  mostrarTela('tela-resultado');
  animarBarras($('resultado-barras'));
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
    ? `🛡️ O ESCUDO do ${nome(p)} bloqueou todo o dano! O escudo acabou.`
    : null;

  const [va, vb] = estado.jogadores.map((j) => j.vida);
  if (resumo.recuo > 0 && estado.jogadores[v].vida === 0) {
    detalhes.push(`${nome(v)} se machucou com o próprio golpe e ficou sem vida!`);
  } else if (va === 0 && vb === 0) {
    detalhes.push('Os dois ficaram sem vida!');
  }

  return { confronto, principal, destaque, detalhes };
}

function renderResultado() {
  const { antes, resultado } = app.ultimaRodada;
  const { estado, resumo, fim } = resultado;
  const texto = descreverRodada(estado, resumo);

  $('resultado-rodada').textContent = `Rodada ${resumo.numero}`;
  $('resultado-confronto').textContent = texto.confronto;
  $('resultado-frase').textContent = texto.principal;
  const destaque = $('resultado-destaque');
  destaque.hidden = !texto.destaque;
  destaque.textContent = texto.destaque ?? '';
  $('resultado-detalhes').replaceChildren(...texto.detalhes.map((d) => el('li', {}, d)));
  $('resultado-barras').replaceChildren(...barrasComparadas(antes, estado));
  $('btn-proxima').textContent = fim.terminou ? 'Ver quem ganhou' : 'Próxima rodada';
}

// Barras que começam na vida de antes e animam até a vida de agora.
function barrasComparadas(antes, depois) {
  return depois.jogadores.map((j, i) => {
    const vidaAntes = antes.jogadores[i].vida;
    const diferenca = j.vida - vidaAntes;
    const barra = barraVida(vidaAntes, j.criatura.vida);
    barra.vidaFinal = j.vida;
    const mudanca = diferenca === 0 ? null
      : el('span', { class: `barra-mudanca ${diferenca < 0 ? 'perdeu' : 'ganhou'}` }, ` ${diferenca > 0 ? '+' : ''}${diferenca}`);
    const escudo = j.escudo ? el('span', { class: 'selo-escudo' }, ' 🔒 ESCUDO') : null;
    return el('div', {},
      el('div', { class: 'barra-rotulo' }, `J${i + 1} · ${j.criatura.nome}`, mudanca, ' ', escudo),
      barra,
    );
  });
}

function animarBarras(container) {
  // dois quadros: o navegador precisa pintar a largura inicial antes da transição
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const barra of container.querySelectorAll('.vida')) {
      if (barra.vidaFinal !== undefined) barra.atualizar(barra.vidaFinal);
    }
  }));
}

function proximaRodada() {
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
  if (fim.vencedor === null) {
    titulo.textContent = 'Empate!';
    sub.textContent = 'Os dois ficaram sem vida na mesma rodada.';
  } else {
    titulo.textContent = `${nomeJogador(estado, fim.vencedor)} venceu!`;
    sub.textContent = `Parabéns, Jogador ${fim.vencedor + 1}! (${estado.rodada} rodadas)`;
  }
  document.querySelector('#tela-fim .trofeu').textContent = fim.vencedor === null ? '🤝' : '🏆';
  $('fim-barras').replaceChildren(...estado.jogadores.map((j, i) =>
    el('div', {},
      el('div', { class: 'barra-rotulo' }, `J${i + 1} · ${j.criatura.nome}`),
      barraVida(j.vida, j.criatura.vida),
    )));

  const aviso = $('fim-placar');
  const espelhada = estado.jogadores[0].criatura.codigo === estado.jogadores[1].criatura.codigo;
  aviso.hidden = placarGravado;
  if (fim.vencedor === null) aviso.textContent = 'Empate não conta no placar.';
  else if (espelhada) aviso.textContent = 'Bichinhos iguais: esta partida não conta no placar.';
  else aviso.textContent = 'Não foi possível guardar o placar neste navegador.';
}

// ---------- tela: meus bichinhos ----------

function abrirPlacar() {
  const placar = lerPlacar();
  $('placar-indisponivel').hidden = placar !== null;
  const dados = placar ?? {};
  $('lista-placar').replaceChildren(...CRIATURAS.map((c) => {
    const { v = 0, d = 0 } = dados[c.codigo] ?? {};
    const cartao = cartaoCriatura(c, el('span', { class: 'cartao-placar' },
      el('span', { class: 'v' }, `${v} ${v === 1 ? 'vitória' : 'vitórias'}`),
      ' · ',
      el('span', { class: 'd' }, `${d} ${d === 1 ? 'derrota' : 'derrotas'}`),
    ));
    return cartao;
  }));
  mostrarTela('tela-placar');
}

// ---------- início ----------

function novaBatalha() {
  app.escolhas = [null, null];
  abrirEscolha(0);
}

function ligarEventos() {
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
  montarListaEscolha();
  ligarEventos();
  // Deep link do QR da peça: index.html?b=TAT01
  const codigo = new URLSearchParams(window.location.search).get('b');
  if (codigo !== null) {
    abrirEscolha(0, codigo);
  } else {
    mostrarTela('tela-inicio');
  }
}

iniciar();
