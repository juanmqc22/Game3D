// Raposa na Fazenda — interface. A lógica está em regras.js (pura, testada).
// ?v= igual ao de raposa/index.html.
import {
  DIAS, ITENS, FACES, MIN_JOGADORES, MAX_JOGADORES, META, ROUBO_TRAIDOR,
  colheita, criarPartida, modoDaPartida, ordemDoDia, ativos,
  declarar, duvidar, podeDuvidar, confessar, podeCumprir, cumprirEncomenda,
  sugerirEntregas, entregar, trocar, temItens, totalItens, cestaVazia,
  sortearNoite, acaoDaRaposa, apurarVotos, raposaExpulsa, fimDoDia, resultado, especieDoCodigo,
} from './regras.js?v=1';
import { salvar, carregar, limpar, codigoDaUrl } from './salvar.js?v=1';
import {
  DES_ITEM, DES_FACE, desEstrela, desCeleiro, desCaminhao, desGalinha, desLua, desSol,
  desRaposa, desOlhos, desColinas, desCadeado,
} from './desenhos.js?v=1';
import { iconeSimbolo } from '../../js/icones.js?v=11';
import { CRIATURAS } from '../../js/criaturas.js?v=11';

// ---------- utilidades de DOM ----------

const $ = (id) => document.getElementById(id);

// h('div', {class: 'x', onclick}, filhos...). Strings viram texto (nunca HTML).
function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v; // só para SVG fixo de desenhos.js/icones.js
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) {
    if (f === null || f === undefined || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}

const arte = (svg, classe = '') => h('span', { class: `arte ${classe}`, html: svg });

function bt(texto, aoTocar, classe = 'bt-principal', extra = {}) {
  return h('button', { type: 'button', class: `bt ${classe}`, onclick: aoTocar, ...extra }, texto);
}

const semMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- textos ----------

const NOME_ITEM = {
  ovo: ['ovo dourado', 'ovos dourados'],
  milho: ['milho', 'milho'],
  leite: ['leite', 'leite'],
};
const NOME_FACE = { ESPECIAL: 'Especial', ATAQUE: 'Garras', DEFESA: 'Escudo', TROPECO: 'Tropeço' };

function textoCesta(c) {
  const partes = ITENS.filter((i) => c[i] > 0).map((i) => `${c[i]} ${NOME_ITEM[i][c[i] > 1 ? 1 : 0]}`);
  return partes.length ? partes.join(' + ') : 'nada';
}

function textoColheita(face, especie) {
  return face === 'TROPECO' ? 'praga (nada)' : textoCesta(colheita(face, especie));
}

// Fila de ícones de uma cesta: [milho][milho][leite]…
function filaItens(c, classe = '', vazio = 'vazio') {
  const itens = [];
  for (const i of ITENS) {
    for (let k = 0; k < (c[i] || 0); k++) itens.push(arte(DES_ITEM[i](), `mini ${i}`));
  }
  return h('span', { class: `fila-itens ${classe}`, 'aria-label': textoCesta(c) },
    itens.length ? itens : h('span', { class: 'vazio' }, vazio));
}

// Contador por tipo: [ovo] 2  [milho] 3  [leite] 0
function celeiro(c, titulo, classe = '') {
  return h('div', { class: `celeiro-box ${classe}` },
    h('p', { class: 'celeiro-titulo' }, titulo),
    h('ul', { class: 'celeiro-lista' },
      ITENS.map((i) => h('li', { class: c[i] ? '' : 'zerado', 'aria-label': `${c[i]} ${NOME_ITEM[i][1]}` },
        arte(DES_ITEM[i](), 'medio'), h('b', {}, String(c[i]))))));
}

function estrelas(n) {
  return h('span', { class: 'estrelas', 'aria-label': `${n} estrela${n === 1 ? '' : 's'}` },
    n > 0 ? Array.from({ length: Math.min(n, 8) }, () => arte(desEstrela(), 'mini')) : h('span', { class: 'vazio' }, 'sem estrelas'),
    n > 8 ? h('b', {}, ` ${n}`) : null);
}

// ---------- estado da tela ----------

const armazem = () => {
  try { return window.localStorage; } catch { return null; }
};

let jogo = { estado: null, ui: { tela: 'inicio' }, montagem: null };
let codigoPendente = null;

function guardar() {
  const s = armazem();
  if (!s) return;
  if (!jogo.estado && !jogo.montagem) return;
  salvar(s, jogo);
}

function ir(tela, extra = {}) {
  jogo.ui = { tela, ...extra };
  guardar();
  desenhar();
}

function mudarEstado(novo, tela, extra = {}) {
  jogo.estado = novo;
  ir(tela, extra);
}

function avisar(texto) {
  const a = $('aviso');
  a.textContent = texto;
  a.hidden = false;
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => { a.hidden = true; }, 3200);
}

// ---------- céu (dia → noite) ----------

function ceu(modo) {
  document.body.classList.toggle('noite', modo === 'noite');
  document.body.classList.toggle('derrota', modo === 'derrota');
  document.body.classList.toggle('dia', modo === 'dia');
}

function barra() {
  const e = jogo.estado;
  const info = $('barra-info');
  if (!e || jogo.ui.tela === 'inicio' || jogo.ui.tela === 'montagem') {
    info.replaceChildren(h('b', {}, 'Raposa na Fazenda'));
    return;
  }
  if (e.fase === 'fim') {
    info.replaceChildren(h('b', {}, 'Fim da estação'));
    return;
  }
  info.replaceChildren(
    h('b', {}, `Dia ${e.dia} de ${DIAS}`),
    h('span', { class: 'barra-meta' }, `Entregues ${e.entregues}/${e.meta}`),
  );
}

// ---------- desenho das telas ----------

const TELAS = {};

function desenhar() {
  const t = jogo.ui.tela;
  const palco = $('palco');
  const noite = ['noite', 'noiteTraidor', 'assembleia'].includes(t);
  const derrota = t === 'fim' && jogo.estado && !resultado(jogo.estado).vilaVenceu;
  ceu(derrota ? 'derrota' : noite ? 'noite' : 'dia');
  barra();
  const conteudo = (TELAS[t] || TELAS.inicio)();
  palco.replaceChildren(conteudo);
  palco.scrollTop = 0;
  window.scrollTo(0, 0);
  palco.focus({ preventScroll: true });
}

// ---------- tela de privacidade ----------
//
// Capa opaca com o nome. O conteúdo só é criado depois do toque, e some ao
// terminar — nada fica na tela para quem pegar o celular em seguida.
function privada(idx, titulo, conteudo) {
  const e = jogo.estado;
  const nome = e.jogadores[idx].nome;
  if (!jogo.ui.aberto) {
    return h('section', { class: 'tela capa-privada' },
      arte(desCadeado(), 'cadeado-grande'),
      h('p', { class: 'capa-passe' }, 'Passe o celular para'),
      h('h2', { class: 'capa-nome' }, nome),
      h('p', { class: 'capa-dica' }, `${titulo}. Só ${nome} olha.`),
      bt(`Sou ${nome} — ver`, () => { jogo.ui.aberto = true; guardar(); desenhar(); }, 'bt-principal bt-grande'),
    );
  }
  return h('section', { class: 'tela privada' },
    h('p', { class: 'privada-selo' }, arte(desCadeado(), 'mini'), `Só ${nome}`),
    conteudo(),
  );
}

// ---------- início ----------

TELAS.inicio = () => {
  const salvo = jogo.estado && jogo.estado.fase !== 'fim';
  return h('section', { class: 'tela inicio' },
    h('div', { class: 'cena-inicio' },
      arte(desCeleiro(), 'celeiro-inicio'),
      arte(desGalinha(), 'galinha-inicio'),
      arte(desRaposa(), 'raposa-espia'),
    ),
    h('h1', { class: 'titulo' }, 'Raposa', h('br'), h('small', {}, 'na Fazenda')),
    h('p', { class: 'sub' }, 'Blefe na colheita, entregue os pedidos juntos — e cuidado com a Raposa. 2 a 6 jogadores.'),
    h('div', { class: 'acoes' },
      salvo ? bt(`Continuar — dia ${jogo.estado.dia}`, () => ir(jogo.ui.retomar || 'caminhao', jogo.ui.retomarExtra || {})) : null,
      jogo.montagem ? bt('Continuar a montagem', () => ir('montagem')) : null,
      bt('Nova partida', novaMontagem, salvo || jogo.montagem ? 'bt-secundario' : 'bt-principal'),
      bt('Como se joga', abrirRegras, 'bt-discreto'),
    ),
  );
};

function novaMontagem() {
  if (jogo.estado && jogo.estado.fase !== 'fim' && !window.confirm('Começar outra partida? A atual será perdida.')) return;
  jogo.estado = null;
  jogo.montagem = { jogadores: [{ nome: '', codigo: null }, { nome: '', codigo: null }] };
  if (codigoPendente) {
    jogo.montagem.jogadores[0].codigo = codigoPendente;
    codigoPendente = null;
  }
  ir('montagem');
}

// ---------- montagem ----------

function atribuirCodigo(codigo) {
  const m = jogo.montagem;
  const livre = m.jogadores.find((j) => !j.codigo);
  if (livre) {
    livre.codigo = codigo;
    return m.jogadores.indexOf(livre);
  }
  if (m.jogadores.length < MAX_JOGADORES) {
    m.jogadores.push({ nome: '', codigo });
    return m.jogadores.length - 1;
  }
  return -1;
}

function nomeCriatura(codigo) {
  const c = CRIATURAS.find((x) => x.codigo === codigo);
  return c ? `${c.nome} (${codigo})` : codigo;
}

function talento(codigo) {
  const esp = especieDoCodigo(codigo);
  if (esp === 'sapo') return 'Sapo: +1 leite ao colher leite';
  if (esp === 'tatu') return 'Tatu: imune ao roubo noturno';
  return 'Sem talento';
}

TELAS.montagem = () => {
  const m = jogo.montagem;
  const n = m.jogadores.length;
  const modo = modoDaPartida(n);
  const lista = h('ol', { class: 'lista-jogadores' });
  m.jogadores.forEach((j, i) => {
    const escolha = h('div', { class: 'escolha-bicho', role: 'group', 'aria-label': `Bichinho de ${j.nome || `jogador ${i + 1}`}` },
      [...CRIATURAS.map((c) => c.codigo), null].map((cod) => h('button', {
        type: 'button',
        class: `chip ${j.codigo === cod ? 'ativo' : ''}`,
        'aria-pressed': j.codigo === cod ? 'true' : 'false',
        'data-especie': especieDoCodigo(cod) || 'nenhuma',
        onclick: () => { j.codigo = cod; guardar(); desenhar(); },
      }, cod ? nomeCriatura(cod) : 'Sem peça')));
    lista.append(h('li', { class: 'cartao jogador-montagem' },
      h('div', { class: 'linha-nome' },
        h('label', { for: `nome-${i}`, class: 'so-leitor' }, `Nome do jogador ${i + 1}`),
        h('input', {
          id: `nome-${i}`, class: 'campo', type: 'text', maxlength: '14', autocomplete: 'off',
          placeholder: `Jogador ${i + 1}`, value: j.nome,
          oninput: (ev) => { j.nome = ev.target.value; guardar(); },
        }),
        n > MIN_JOGADORES ? h('button', {
          type: 'button', class: 'bt-x', 'aria-label': `Tirar jogador ${i + 1}`,
          onclick: () => { m.jogadores.splice(i, 1); guardar(); desenhar(); },
        }, '×') : null,
      ),
      escolha,
      h('p', { class: 'talento' }, talento(j.codigo)),
    ));
  });
  return h('section', { class: 'tela montagem' },
    h('h2', {}, 'Quem vai jogar?'),
    h('p', { class: 'sub' }, 'Encoste a peça no celular (NFC) ou escolha o bichinho na lista.'),
    lista,
    n < MAX_JOGADORES ? bt('+ Jogador', () => { m.jogadores.push({ nome: '', codigo: null }); guardar(); desenhar(); }, 'bt-secundario') : null,
    h('div', { class: `cartao modo-aviso ${modo}` },
      arte(modo === 'app' ? desRaposa() : desOlhos(), 'medio'),
      h('p', {}, modo === 'app'
        ? h('span', {}, h('b', {}, `${n} jogadores:`), ' a Raposa é o próprio app. ', `Meta: ${META[n]} pedidos.`)
        : h('span', {}, h('b', {}, `${n} jogadores:`), ' um de vocês é secretamente a Raposa. ', `Meta: ${META[n]} pedidos e expulsar a Raposa.`)),
    ),
    h('div', { class: 'acoes' },
      bt('Começar a estação', comecar),
      bt('Voltar', () => ir('inicio'), 'bt-discreto'),
    ),
  );
};

function comecar() {
  const m = jogo.montagem;
  const jogadores = m.jogadores.map((j, i) => ({ nome: (j.nome || '').trim() || `Jogador ${i + 1}`, codigo: j.codigo }));
  const nomes = new Set(jogadores.map((j) => j.nome.toLowerCase()));
  if (nomes.size !== jogadores.length) {
    avisar('Dois jogadores com o mesmo nome — mude um deles.');
    return;
  }
  const semente = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  jogo.montagem = null;
  mudarEstado(criarPartida(jogadores, semente), 'papeis', { vez: 0, aberto: false });
}

// ---------- papéis e encomendas iniciais ----------

function cartaoEncomenda(j, enc, idx, podeUsar) {
  const pode = podeUsar && podeCumprir(j, enc);
  return h('li', { class: `encomenda ${pode ? 'pronta' : ''}` },
    filaItens(enc.itens),
    h('span', { class: 'enc-pontos' }, `${enc.pontos} pts`),
    podeUsar ? bt(pode ? 'Cumprir' : 'Faltam itens', () => {
      jogo.estado = cumprirEncomenda(jogo.estado, idx, enc.id);
      avisar(`Encomenda cumprida: +${enc.pontos} pontos!`);
      guardar();
      desenhar();
    }, pode ? 'bt-principal bt-curto' : 'bt-secundario bt-curto', { disabled: !pode }) : null,
  );
}

function blocoPapel(idx) {
  const e = jogo.estado;
  if (e.modo !== 'traidor') return null;
  const raposa = e.raposa === idx;
  return h('div', { class: `papel ${raposa ? 'papel-raposa' : 'papel-fazendeiro'}` },
    arte(raposa ? desRaposa() : desGalinha(), 'papel-arte'),
    h('div', {},
      h('p', { class: 'papel-rotulo' }, 'Seu papel'),
      h('p', { class: 'papel-nome' }, raposa ? 'Você é a RAPOSA' : 'Você é FAZENDEIRO'),
      h('p', {}, raposa
        ? 'Faça a vila fracassar ou chegue ao fim sem ser expulsa. À noite, você escolhe quem roubar. Finja ser fazendeiro.'
        : 'Entregue os pedidos com a vila e descubra a Raposa na assembleia.'),
    ),
  );
}

TELAS.papeis = () => {
  const e = jogo.estado;
  const vez = jogo.ui.vez;
  return privada(vez, e.modo === 'traidor' ? 'Seu papel e suas encomendas' : 'Suas encomendas secretas', () => {
    const j = e.jogadores[vez];
    return h('div', { class: 'pilha' },
      blocoPapel(vez),
      h('h2', {}, 'Encomendas secretas'),
      h('p', { class: 'sub' }, 'Cumpra com o seu celeiro secreto — o que você colher e não declarar. Cada uma vale pontos se a vila vencer.'),
      h('ul', { class: 'lista-encomendas' }, j.encomendas.map((enc) => cartaoEncomenda(j, enc, vez, false))),
      bt('Pronto — esconder', () => {
        if (vez + 1 < e.jogadores.length) ir('papeis', { vez: vez + 1, aberto: false });
        else ir('caminhao', { chegou: true });
      }, 'bt-principal bt-grande'),
    );
  });
};

// ---------- caminhão ----------

function cartaoPedido(p, { sugerido = false, podeEntregar = false, aoEntregar = null } = {}) {
  const prazo = p.prazo === 1 ? 'vence hoje' : `${p.prazo} dias`;
  return h('li', { class: `pedido ${p.prazo === 1 ? 'urgente' : ''} ${sugerido ? 'sugerido' : ''}` },
    filaItens(p.itens, 'grande'),
    h('p', { class: 'pedido-texto' }, textoCesta(p.itens)),
    h('p', { class: 'pedido-prazo' }, prazo),
    sugerido ? h('p', { class: 'selo-sugerido' }, 'sugerido') : null,
    aoEntregar ? bt(podeEntregar ? 'Entregar' : 'Faltam itens', aoEntregar, podeEntregar ? 'bt-principal bt-curto' : 'bt-secundario bt-curto', { disabled: !podeEntregar }) : null,
  );
}

TELAS.caminhao = () => {
  const e = jogo.estado;
  jogo.ui.retomar = 'caminhao';
  const anima = jogo.ui.chegou && !semMovimento();
  jogo.ui.chegou = false;
  const vencidos = (e.ultimosVencidos || []).filter((p) => !p.falso);
  const faltam = Math.max(0, e.meta - e.entregues);
  return h('section', { class: `tela caminhao-tela ${anima ? 'anima' : ''}` },
    h('h2', { class: 'dia-titulo' }, `Dia ${e.dia}`, h('small', {}, ` de ${DIAS}`)),
    h('div', { class: 'estrada' }, arte(desCaminhao(), 'caminhao-arte')),
    vencidos.length ? h('p', { class: 'nota nota-ruim' }, `Pedido vencido ontem: ${vencidos.map((p) => textoCesta(p.itens)).join('; ')}.`) : null,
    h('ul', { class: 'lista-pedidos' }, e.pedidos.map((p) => cartaoPedido(p))),
    h('div', { class: 'progresso cartao' },
      h('p', {}, h('b', {}, `${e.entregues} de ${e.meta}`), ' pedidos entregues',
        faltam ? ` · faltam ${faltam}` : ' · meta cumprida!'),
      h('div', { class: 'trilho', 'aria-hidden': 'true' },
        Array.from({ length: e.meta }, (_, k) => h('span', { class: k < e.entregues ? 'cheio' : '' }))),
    ),
    celeiro(e.vila, 'Celeiro da vila'),
    h('div', { class: 'acoes' }, bt('Hora da colheita', () => ir('giro'), 'bt-principal bt-grande')),
  );
};

// ---------- colheita ----------

TELAS.giro = () => {
  const e = jogo.estado;
  const ordem = ordemDoDia(e);
  return h('section', { class: 'tela giro' },
    h('h2', {}, 'Todos girem o pião!'),
    h('p', { class: 'sub grande' }, 'Quando parar, cubra com a mão ou um copo. Ninguém espia.'),
    h('ol', { class: 'ordem' }, ordem.map((i) => h('li', {}, e.jogadores[i].nome))),
    h('p', { class: 'sub' }, 'Depois, cada um declara na ordem acima.'),
    h('div', { class: 'acoes' }, bt('Todos cobriram', () => ir('declarar', { pos: 0, sub: 'escolher' }), 'bt-principal bt-grande')),
  );
};

function botoesFace(especie, aoEscolher, rotulo) {
  return h('div', { class: 'faces', role: 'group', 'aria-label': rotulo },
    FACES.map((f) => h('button', {
      type: 'button', class: `face face-${f.toLowerCase()}`, onclick: () => aoEscolher(f),
    },
    arte(DES_FACE[f](), 'face-arte'),
    h('span', { class: 'face-colheita' }, textoColheita(f, especie)),
    h('span', { class: 'face-peca' }, h('span', { class: 'sim', html: iconeSimbolo(f) }), NOME_FACE[f]),
    )));
}

TELAS.declarar = () => {
  const e = jogo.estado;
  const ordem = e.rodada.ordem;
  const { pos, sub } = jogo.ui;
  const idx = ordem[pos];
  const j = e.jogadores[idx];
  const declarada = e.rodada.declaracoes[idx];

  const proximo = () => {
    if (pos + 1 < ordem.length) ir('declarar', { pos: pos + 1, sub: 'escolher' });
    else ir('confissao', { vez: 0, aberto: false });
  };

  if (sub === 'escolher') {
    return h('section', { class: 'tela declarar' },
      h('p', { class: 'vez-de' }, `Vez ${pos + 1} de ${ordem.length}`),
      h('h2', {}, `${j.nome}, o que você colheu?`),
      h('p', { class: 'sub' }, 'Declare em voz alta e toque. Pode blefar — mas cuidado com o Duvido!'),
      botoesFace(j.especie, (f) => {
        mudarEstado(declarar(e, idx, f), 'declarar', { pos, sub: 'duvido' });
      }, `Declaração de ${j.nome}`),
    );
  }

  if (sub === 'duvido') {
    const outros = ativos(e).filter((o) => o !== idx);
    return h('section', { class: 'tela duvido' },
      h('p', { class: 'vez-de' }, `${j.nome} declarou`),
      h('div', { class: 'declaracao-grande' },
        arte(DES_FACE[declarada](), 'grande'),
        h('p', {}, textoColheita(declarada, j.especie))),
      h('h2', {}, 'Alguém duvida?'),
      h('div', { class: 'grade-duvido' },
        outros.map((o) => bt(podeDuvidar(e, o) ? `${e.jogadores[o].nome}: Duvido!` : `${e.jogadores[o].nome} (sem estrela)`,
          () => ir('declarar', { pos, sub: 'revelar', por: o }), 'bt-duvido', { disabled: !podeDuvidar(e, o) }))),
      bt('Ninguém duvida', proximo, 'bt-principal bt-grande'),
    );
  }

  if (sub === 'revelar') {
    const por = jogo.ui.por;
    return h('section', { class: 'tela revelar' },
      h('h2', {}, `${e.jogadores[por].nome} duvidou!`),
      h('p', { class: 'sub grande' }, `${j.nome}, levante a mão e mostre a peça. Qual face está para cima?`),
      botoesFace(j.especie, (f) => {
        mudarEstado(duvidar(e, idx, por, f), 'declarar', { pos, sub: 'resultado', revela: true });
      }, `Face real de ${j.nome}`),
      bt('Voltar — ninguém duvidou', () => ir('declarar', { pos, sub: 'duvido' }), 'bt-discreto'),
    );
  }

  // resultado do Duvido
  const d = e.rodada.desafios[idx];
  const anima = jogo.ui.revela && !semMovimento();
  jogo.ui.revela = false;
  const duvidou = e.jogadores[d.por].nome;
  return h('section', { class: `tela resultado-duvido ${anima ? 'anima' : ''} ${d.mentiu ? 'mentiu' : 'verdade'}` },
    h('div', { class: 'revelacao' },
      h('div', { class: 'carta-virar' },
        h('div', { class: 'carta-frente' }, arte(DES_FACE[declarada](), 'grande'), h('p', {}, 'declarou')),
        h('div', { class: 'carta-verso' }, arte(DES_FACE[d.real](), 'grande'), h('p', {}, textoColheita(d.real, j.especie))),
      ),
      h('p', { class: 'carimbo' }, d.mentiu ? 'Mentira!' : 'Verdade!'),
    ),
    h('p', { class: 'veredito' }, d.mentiu
      ? `${j.nome} perde a colheita e 1 estrela${e.jogadores[d.por].estrelas > 0 ? ` — que vai para ${duvidou}` : ''}.`
      : `${duvidou} perde 1 estrela. A colheita de ${j.nome} vale.`),
    h('div', { class: 'placar-estrelas' },
      [idx, d.por].map((i) => h('p', {}, h('b', {}, e.jogadores[i].nome), ' ', estrelas(e.jogadores[i].estrelas)))),
    h('div', { class: 'acoes' }, bt('Continuar', proximo, 'bt-principal bt-grande')),
  );
};

// ---------- confissão secreta ----------

TELAS.confissao = () => {
  const e = jogo.estado;
  const lista = ativos(e);
  const vez = jogo.ui.vez;
  const idx = lista[vez];
  const j = e.jogadores[idx];
  const declarada = e.rodada.declaracoes[idx];

  const terminar = () => {
    if (vez + 1 < lista.length) ir('confissao', { vez: vez + 1, aberto: false });
    else ir('entrega', {});
  };

  return privada(idx, 'Confissão secreta', () => {
    const jaConfessou = e.rodada.confessados[idx] !== undefined;
    if (!jaConfessou) {
      return h('div', { class: 'pilha' },
        h('h2', {}, 'O que saiu de verdade?'),
        h('p', { class: 'sub' }, 'Você declarou: ', h('b', {}, textoColheita(declarada, j.especie)),
          '. O que você colheu e não declarou vai para o seu celeiro secreto.'),
        botoesFace(j.especie, (f) => {
          const r = confessar(e, idx, f);
          jogo.estado = r.estado;
          jogo.ui.ganho = r.ganho;
          guardar();
          desenhar();
        }, 'Face real'),
      );
    }
    const ganho = jogo.ui.ganho;
    const desafiado = e.rodada.desafios[idx];
    return h('div', { class: 'pilha' },
      blocoPapel(idx),
      desafiado ? h('p', { class: 'nota' }, 'Sua peça foi revelada no Duvido: nada a esconder hoje.')
        : ganho && totalItens(ganho) > 0
          ? h('p', { class: 'nota nota-boa' }, 'Escondido hoje: ', filaItens(ganho))
          : h('p', { class: 'nota' }, 'Nada escondido hoje.'),
      celeiro(j.secreto, 'Seu celeiro secreto', 'secreto'),
      h('h3', {}, 'Encomendas secretas'),
      h('ul', { class: 'lista-encomendas' }, j.encomendas.map((enc) => cartaoEncomenda(j, enc, idx, true))),
      h('p', { class: 'resumo-pontos' }, `Pontos: ${j.pontos} de encomendas + `, estrelas(j.estrelas)),
      bt('Pronto — esconder', terminar, 'bt-principal bt-grande'),
    );
  });
};

// ---------- entrega ----------

TELAS.entrega = () => {
  const e = jogo.estado;
  jogo.ui.retomar = 'entrega';
  const sugeridos = sugerirEntregas(e);
  const ultima = jogo.ui.ultima;
  const anima = jogo.ui.anima && !semMovimento();
  jogo.ui.anima = false;
  return h('section', { class: 'tela entrega' },
    h('h2', {}, 'Entrega'),
    ultima === 'falso' ? h('div', { class: `cartao alerta-falso ${anima ? 'anima' : ''}` },
      arte(desRaposa(), 'medio'),
      h('p', {}, h('b', {}, 'Era um pedido falso!'), ' A Raposa sumiu com a carga.'))
      : ultima === 'ok' ? h('p', { class: `nota nota-boa ${anima ? 'pulo' : ''}` }, `Entregue! ${e.entregues} de ${e.meta}.`) : null,
    celeiro(e.vila, 'Celeiro da vila'),
    e.pedidos.length
      ? h('ul', { class: 'lista-pedidos' }, e.pedidos.map((p) => cartaoPedido(p, {
        sugerido: sugeridos.includes(p.id),
        podeEntregar: temItens(e.vila, p.itens),
        aoEntregar: () => {
          const r = entregar(e, p.id);
          mudarEstado(r.estado, 'entrega', { ultima: r.falso ? 'falso' : 'ok', anima: true });
        },
      })))
      : h('p', { class: 'nota' }, 'Nenhum pedido esperando. Amanhã chega mais.'),
    sugeridos.length ? h('p', { class: 'sub' }, 'O app sugere os pedidos marcados. Vocês decidem.') : null,
    h('div', { class: 'acoes' }, bt('Ir ao mercado', () => ir('mercado', {}), 'bt-principal bt-grande')),
  );
};

// ---------- mercado ----------

function seletorJogador(rotulo, atual, excluir, aoEscolher) {
  const e = jogo.estado;
  return h('div', { class: 'seletor', role: 'group', 'aria-label': rotulo },
    h('p', { class: 'rotulo' }, rotulo),
    h('div', { class: 'chips' }, ativos(e).filter((i) => i !== excluir).map((i) => h('button', {
      type: 'button', class: `chip ${atual === i ? 'ativo' : ''}`, 'aria-pressed': atual === i ? 'true' : 'false',
      onclick: () => aoEscolher(i),
    }, e.jogadores[i].nome))));
}

function passos(cesta, rotulo) {
  return h('div', { class: 'passos', role: 'group', 'aria-label': rotulo },
    h('p', { class: 'rotulo' }, rotulo),
    ITENS.map((i) => h('div', { class: 'passo' },
      arte(DES_ITEM[i](), 'medio'),
      h('button', { type: 'button', class: 'bt-passo', 'aria-label': `menos ${NOME_ITEM[i][0]}`, onclick: () => { cesta[i] = Math.max(0, cesta[i] - 1); guardar(); desenhar(); } }, '−'),
      h('b', { 'aria-live': 'polite' }, String(cesta[i])),
      h('button', { type: 'button', class: 'bt-passo', 'aria-label': `mais ${NOME_ITEM[i][0]}`, onclick: () => { cesta[i] = Math.min(9, cesta[i] + 1); guardar(); desenhar(); } }, '+'),
    )));
}

TELAS.mercado = () => {
  const e = jogo.estado;
  jogo.ui.retomar = 'mercado';
  const t = jogo.ui.troca;
  const irNoite = () => {
    if (e.modo === 'traidor' && !raposaExpulsa(e)) ir('noiteTraidor', { vez: 0, aberto: false, palpites: {} });
    else ir('noite', { sub: 'suspense', chegou: true });
  };

  if (!t) {
    return h('section', { class: 'tela mercado' },
      h('h2', {}, 'Mercado'),
      arte(desGalinha(), 'galinha-mercado'),
      h('p', { class: 'sub grande' }, 'Conversem e negociem trocas entre os celeiros secretos. Cada um confirma em segredo.'),
      h('div', { class: 'acoes' },
        bt('Registrar troca', () => ir('mercado', { troca: { a: null, b: null, daA: cestaVazia(), daB: cestaVazia(), etapa: 'form' } }), 'bt-secundario bt-grande'),
        bt('Anoitecer', irNoite, 'bt-principal bt-grande'),
      ),
    );
  }

  if (t.etapa === 'form') {
    const nome = (i) => (i === null ? '…' : e.jogadores[i].nome);
    const pronto = t.a !== null && t.b !== null && totalItens(t.daA) + totalItens(t.daB) > 0;
    return h('section', { class: 'tela mercado' },
      h('h2', {}, 'Registrar troca'),
      seletorJogador('Quem dá', t.a, t.b, (i) => { t.a = i; guardar(); desenhar(); }),
      seletorJogador('Com quem', t.b, t.a, (i) => { t.b = i; guardar(); desenhar(); }),
      passos(t.daA, `${nome(t.a)} dá`),
      passos(t.daB, `${nome(t.b)} dá em troca`),
      h('div', { class: 'acoes' },
        bt('Confirmar em segredo', () => { t.etapa = 'confA'; jogo.ui.aberto = false; guardar(); desenhar(); }, 'bt-principal bt-grande', { disabled: !pronto }),
        bt('Cancelar', () => ir('mercado', {}), 'bt-discreto'),
      ),
    );
  }

  const quem = t.etapa === 'confA' ? t.a : t.b;
  const da = quem === t.a ? t.daA : t.daB;
  const recebe = quem === t.a ? t.daB : t.daA;
  const outro = quem === t.a ? t.b : t.a;
  return privada(quem, 'Confirmar troca', () => {
    const j = e.jogadores[quem];
    const tem = temItens(j.secreto, da);
    return h('div', { class: 'pilha' },
      h('h2', {}, 'Confirma a troca?'),
      h('p', { class: 'troca-linha' }, 'Você dá ', filaItens(da, '', 'nada'), ` para ${e.jogadores[outro].nome}`),
      h('p', { class: 'troca-linha' }, 'e recebe ', filaItens(recebe, '', 'nada')),
      celeiro(j.secreto, 'Seu celeiro secreto', 'secreto'),
      tem ? null : h('p', { class: 'nota nota-ruim' }, 'Você não tem esses itens. A troca não pode acontecer.'),
      h('div', { class: 'acoes' },
        tem ? bt('Confirmo', () => {
          if (t.etapa === 'confA') {
            t.etapa = 'confB';
            jogo.ui.aberto = false;
            guardar();
            desenhar();
            return;
          }
          try {
            mudarEstado(trocar(e, t.a, t.b, t.daA, t.daB), 'mercado', {});
            avisar('Troca feita!');
          } catch {
            ir('mercado', {});
            avisar('A troca não fechou: faltaram itens.');
          }
        }, 'bt-principal bt-grande') : null,
        bt('Recusar', () => { ir('mercado', {}); avisar('Troca cancelada.'); }, tem ? 'bt-discreto' : 'bt-principal bt-grande'),
      ),
    );
  });
};

// ---------- noite (Raposa do app) ----------

function descricaoNoite(n) {
  const e = jogo.estado;
  const alvo = n.alvo !== undefined ? e.jogadores[n.alvo]?.nome : '';
  switch (n.tipo) {
    case 'roubaVila': return ['A Raposa invadiu o celeiro da vila!', `Levou ${textoCesta(n.levado)}.`];
    case 'roubaSecreto': return ['A Raposa achou um esconderijo!', `Levou ${textoCesta(n.levado)} do celeiro secreto de ${alvo}.`];
    case 'tatuImune': return ['A Raposa tentou um celeiro secreto…', `…mas ${alvo} é tatu: a casca protegeu tudo.`];
    case 'pedidoFalso': return ['A Raposa falsificou um pedido!', 'Um dos próximos pedidos do caminhão é falso. Só se descobre ao entregar.'];
    case 'rondou': return ['A Raposa rondou a fazenda…', 'Mas não achou nada para levar.'];
    default: return ['Noite tranquila.', 'Só os grilos e a lua.'];
  }
}

function amanhecer() {
  const novo = fimDoDia(jogo.estado);
  if (novo.fase === 'fim') mudarEstado(novo, 'fim', {});
  else mudarEstado(novo, 'caminhao', { chegou: true });
}

TELAS.noite = () => {
  let e = jogo.estado;
  jogo.ui.retomar = 'noite';
  if (!e.noite) {
    // Sorteia uma vez e guarda: recarregar não muda o evento.
    e = e.modo === 'traidor' ? { ...e, noite: { tipo: 'tranquila' } } : sortearNoite(e);
    jogo.estado = e;
    guardar();
  }
  const anima = jogo.ui.chegou && !semMovimento();
  jogo.ui.chegou = false;
  const [titulo, texto] = descricaoNoite(e.noite);
  const perigo = !['tranquila', 'rondou', 'tatuImune'].includes(e.noite.tipo);
  return h('section', { class: `tela noite-tela ${anima ? 'anima' : ''}` },
    h('h2', { class: 'titulo-noite' }, 'Anoiteceu na fazenda'),
    h('div', { class: 'moita' }, arte(desOlhos(), 'olhos-arte')),
    h('div', { class: `cartao evento ${perigo ? 'perigo' : 'calmo'}` },
      arte(perigo ? desRaposa() : desLua(), 'evento-arte'),
      h('p', { class: 'evento-titulo' }, titulo),
      h('p', {}, texto),
    ),
    h('div', { class: 'acoes' }, bt(e.dia >= DIAS ? 'Ver o fim da estação' : 'Amanhecer', amanhecer, 'bt-principal bt-grande')),
  );
};

// ---------- noite e assembleia (Raposa entre os jogadores) ----------

TELAS.noiteTraidor = () => {
  const e = jogo.estado;
  const lista = ativos(e);
  const vez = jogo.ui.vez;
  const idx = lista[vez];
  const souRaposa = idx === e.raposa;

  const seguir = (escolha) => {
    let novo = jogo.estado;
    if (souRaposa) novo = acaoDaRaposa(novo, escolha);
    else jogo.ui.palpites[escolha] = (jogo.ui.palpites[escolha] || 0) + 1;
    jogo.estado = novo;
    if (vez + 1 < lista.length) {
      jogo.ui = { ...jogo.ui, tela: 'noiteTraidor', vez: vez + 1, aberto: false };
      guardar();
      desenhar();
    } else {
      ir('noite', { sub: 'evento', chegou: true, palpites: jogo.ui.palpites, depois: 'assembleia' });
    }
  };

  return privada(idx, 'Noite', () => h('div', { class: 'pilha' },
    h('h2', {}, souRaposa ? 'De quem você vai roubar?' : 'Em quem você desconfia?'),
    h('p', { class: 'sub' }, souRaposa
      ? `Você leva ${ROUBO_TRAIDOR === 1 ? '1 item' : `até ${ROUBO_TRAIDOR} itens`}. Tatu é imune.`
      : 'Seu palpite entra, sem nome, na conversa da assembleia.'),
    h('div', { class: 'grade-escolha' },
      lista.filter((i) => i !== idx).map((i) => bt(e.jogadores[i].nome, () => seguir(i), 'bt-secundario bt-grande')),
      souRaposa ? bt('Celeiro da vila', () => seguir('vila'), 'bt-secundario bt-grande') : null,
    ),
  ));
};

// A tela de noite serve aos dois modos; no traidor, depois dela vem a assembleia.
const telaNoiteBase = TELAS.noite;
TELAS.noite = () => {
  const secao = telaNoiteBase();
  if (jogo.ui.depois === 'assembleia') {
    const acoes = secao.querySelector('.acoes');
    acoes.replaceChildren(bt('Assembleia', () => ir('assembleia', { sub: 'debate', palpites: jogo.ui.palpites, votos: {} }), 'bt-principal bt-grande'));
  }
  return secao;
};

TELAS.assembleia = () => {
  const e = jogo.estado;
  const lista = ativos(e);
  const { sub, palpites } = jogo.ui;
  jogo.ui.retomar = 'assembleia';

  if (sub === 'debate') {
    const linhas = Object.entries(palpites || {}).sort((a, b) => b[1] - a[1]);
    return h('section', { class: 'tela assembleia' },
      h('h2', {}, 'Assembleia'),
      h('p', { class: 'sub grande' }, 'Conversem: quem é a Raposa? Depois, cada um vota em segredo. Expulsa quem tiver mais da metade dos votos.'),
      h('div', { class: 'cartao' },
        h('h3', {}, 'Desconfianças da noite'),
        linhas.length
          ? h('ul', { class: 'lista-palpites' }, linhas.map(([i, n]) => h('li', {}, h('b', {}, e.jogadores[i].nome), ` — ${n} palpite${n > 1 ? 's' : ''}`)))
          : h('p', {}, 'Ninguém desconfiou de ninguém.')),
      h('div', { class: 'acoes' },
        bt('Votar em segredo', () => ir('assembleia', { sub: 'votos', vez: 0, aberto: false, votos: {}, palpites }), 'bt-principal bt-grande'),
        bt('Pular a votação', amanhecer, 'bt-discreto'),
      ),
    );
  }

  if (sub === 'votos') {
    const vez = jogo.ui.vez;
    const idx = lista[vez];
    const votar = (alvo) => {
      const votos = { ...jogo.ui.votos, [idx]: alvo };
      if (vez + 1 < lista.length) {
        jogo.ui = { ...jogo.ui, vez: vez + 1, aberto: false, votos };
        guardar();
        desenhar();
      } else {
        mudarEstado(apurarVotos(jogo.estado, votos), 'assembleia', { sub: 'resultado', revela: true });
      }
    };
    return privada(idx, 'Voto secreto', () => h('div', { class: 'pilha' },
      h('h2', {}, 'Quem deve ser expulso?'),
      h('div', { class: 'grade-escolha' },
        lista.filter((i) => i !== idx).map((i) => bt(e.jogadores[i].nome, () => votar(i), 'bt-secundario bt-grande')),
        bt('Ninguém', () => votar(null), 'bt-discreto bt-grande'),
      ),
    ));
  }

  const a = e.assembleia;
  const anima = jogo.ui.revela && !semMovimento();
  jogo.ui.revela = false;
  let corpo;
  if (a.expulso === null) {
    corpo = h('div', { class: 'cartao evento calmo' }, h('p', { class: 'evento-titulo' }, 'Ninguém foi expulso.'), h('p', {}, 'Os votos se dividiram.'));
  } else {
    const nome = e.jogadores[a.expulso].nome;
    corpo = h('div', { class: `cartao evento ${a.eraRaposa ? 'vitoria-vila' : 'perigo'}` },
      arte(a.eraRaposa ? desRaposa() : desGalinha(), 'evento-arte'),
      h('p', { class: 'evento-titulo' }, `${nome} foi expulso…`),
      h('p', { class: 'carimbo-papel' }, a.eraRaposa ? 'e era a RAPOSA!' : 'e era FAZENDEIRO.'),
      h('p', {}, a.eraRaposa ? 'As noites agora são tranquilas. Falta entregar a meta!' : 'A Raposa continua entre vocês.'));
  }
  return h('section', { class: `tela assembleia ${anima ? 'anima' : ''}` },
    h('h2', {}, 'Resultado da votação'),
    corpo,
    h('div', { class: 'acoes' }, bt(e.dia >= DIAS ? 'Ver o fim da estação' : 'Amanhecer', amanhecer, 'bt-principal bt-grande')),
  );
};

// ---------- fim ----------

TELAS.fim = () => {
  const e = jogo.estado;
  const r = resultado(e);
  const s = armazem();
  if (s) limpar(s);
  const raposaNome = e.raposa !== null ? e.jogadores[e.raposa].nome : null;
  const acoes = h('div', { class: 'acoes' },
    bt('Nova partida', () => { jogo = { estado: null, ui: { tela: 'inicio' }, montagem: null }; novaMontagem(); }, 'bt-principal bt-grande'),
    bt('Início', () => { jogo = { estado: null, ui: { tela: 'inicio' }, montagem: null }; desenhar(); }, 'bt-discreto'),
  );

  if (!r.vilaVenceu) {
    let motivo;
    if (!r.metaCumprida) motivo = `A vila entregou ${e.entregues} de ${e.meta} pedidos. O caminhão foi embora vazio.`;
    else motivo = `A vila bateu a meta, mas ${raposaNome} era a Raposa e nunca foi expulsa.`;
    return h('section', { class: 'tela fim derrota-tela' },
      arte(desRaposa(), 'raposa-vitoriosa'),
      h('h2', { class: 'titulo-derrota' }, 'A Raposa venceu'),
      h('p', { class: 'sub grande' }, motivo),
      raposaNome && r.metaCumprida === false ? h('p', { class: 'nota' }, `A Raposa era ${raposaNome}.`) : null,
      h('p', { class: 'sub' }, 'Todos os fazendeiros perdem.'),
      acoes,
    );
  }

  return h('section', { class: 'tela fim vitoria-tela' },
    arte(desSol(), 'sol-vitoria'),
    h('h2', {}, 'A vila venceu!'),
    h('p', { class: 'sub grande' }, `${e.entregues} pedidos entregues. ${raposaNome ? `A Raposa era ${raposaNome}. ` : ''}Agora, os pontos:`),
    h('ol', { class: 'ranking' }, r.ranking.map((x) => h('li', { class: r.vencedores.includes(x.idx) ? 'vencedor' : '' },
      h('span', { class: 'rank-nome' }, x.nome),
      h('span', { class: 'rank-conta' }, `${x.encomendas} encomendas + ${x.estrelas} estrelas`),
      h('b', { class: 'rank-total' }, `${x.pontos} pts`)))),
    h('p', { class: 'veredito' }, r.vencedores.length > 1
      ? `Empate: ${r.vencedores.map((i) => e.jogadores[i].nome).join(' e ')}!`
      : `${e.jogadores[r.vencedores[0]].nome} é o melhor fazendeiro da estação!`),
    acoes,
  );
};

// ---------- regras e saída ----------

function abrirRegras() {
  const r = $('regras');
  r.hidden = false;
  $('bt-sair').hidden = !jogo.estado && !jogo.montagem;
  $('bt-fechar-regras').focus();
}

function fecharRegras() {
  $('regras').hidden = true;
  $('bt-regras').focus();
}

function sair() {
  if (!window.confirm('Encerrar a partida? Ela não poderá ser retomada.')) return;
  const s = armazem();
  if (s) limpar(s);
  jogo = { estado: null, ui: { tela: 'inicio' }, montagem: null };
  fecharRegras();
  desenhar();
}

// ---------- início ----------

function iniciar() {
  $('ceu-sol').innerHTML = desSol();
  $('ceu-lua').innerHTML = desLua();
  $('ceu-colinas').innerHTML = desColinas();
  for (const el of document.querySelectorAll('.sim-peca')) {
    el.innerHTML = iconeSimbolo(el.dataset.face);
  }
  $('bt-regras').addEventListener('click', abrirRegras);
  $('bt-fechar-regras').addEventListener('click', fecharRegras);
  $('bt-sair').addEventListener('click', sair);
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !$('regras').hidden) fecharRegras();
  });

  const s = armazem();
  const salvo = s ? carregar(s) : null;
  if (salvo && (salvo.estado || salvo.montagem)) {
    jogo = { estado: salvo.estado || null, ui: salvo.ui || { tela: 'inicio' }, montagem: salvo.montagem || null };
  }

  // Etiqueta NFC: /?b=CODIGO chega aqui (via desvio da raiz) ou direto.
  const codigo = codigoDaUrl(window.location.search);
  if (window.location.search) {
    try { window.history.replaceState(null, '', window.location.pathname); } catch { /* segue */ }
  }
  if (codigo) {
    if (jogo.montagem) {
      const i = atribuirCodigo(codigo);
      if (jogo.ui.tela !== 'montagem') jogo.ui = { tela: 'montagem' };
      guardar();
      desenhar();
      avisar(i >= 0 ? `${nomeCriatura(codigo)} → jogador ${i + 1}` : 'Mesa cheia: 6 jogadores.');
      return;
    }
    if (jogo.estado && jogo.estado.fase !== 'fim') {
      desenhar();
      avisar(`Peça ${codigo} lida. A partida já está em andamento.`);
      return;
    }
    codigoPendente = codigo;
    jogo.ui = { tela: 'inicio' };
    desenhar();
    avisar(`Peça ${codigo} lida. Toque em Nova partida.`);
    return;
  }
  desenhar();
}

iniciar();
