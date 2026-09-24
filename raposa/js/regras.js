// Raposa na Fazenda — lógica pura (sem DOM, sem storage).
//
// Toda função recebe um estado e devolve um estado NOVO (o original não muda).
// O único acaso que o app gera (pedidos, encomendas, noite, papel da Raposa)
// sai de um gerador com semente guardada no próprio estado: recarregar a página
// continua a mesma partida. A colheita NUNCA é sorteada: é a face do pião.

// ---------- constantes (números finais vieram de scripts/raposa-simulacao.js) ----------

export const DIAS = 7;
export const ESTRELAS_INICIAIS = 3;
export const PEDIDOS_ATIVOS = 2;
export const ENCOMENDAS_INICIAIS = 2;
export const MIN_JOGADORES = 2;
export const MAX_JOGADORES = 6;
// A partir de quantos jogadores um deles é secretamente a Raposa (Fase 2).
export const JOGADORES_TRAIDOR = 4;
// Quantos itens a Raposa leva numa noite.
export const ROUBO_VILA = 1;
export const ROUBO_SECRETO = 2;
export const ROUBO_TRAIDOR = 1;

export const ITENS = ['ovo', 'milho', 'leite'];
export const FACES = ['ESPECIAL', 'ATAQUE', 'DEFESA', 'TROPECO'];

// Colheita de cada face do pião.
export const COLHEITA = {
  ESPECIAL: { ovo: 1 },
  ATAQUE: { milho: 2 },
  DEFESA: { leite: 2 },
  TROPECO: {},
};

// Pedidos entregues para a vila vencer, por número de jogadores.
export const META = { 2: 3, 3: 5, 4: 4, 5: 5, 6: 6 };

// Pedidos do caminhão. prazo = dias, contando o dia em que chega.
export const MODELOS_PEDIDO = [
  { itens: { milho: 2, leite: 1 }, prazo: 3 },
  { itens: { leite: 2, milho: 1 }, prazo: 3 },
  { itens: { milho: 2, ovo: 1 }, prazo: 3 },
  { itens: { leite: 2, ovo: 1 }, prazo: 3 },
  { itens: { milho: 1, leite: 1, ovo: 1 }, prazo: 3 },
  { itens: { milho: 3 }, prazo: 2 },
  { itens: { leite: 3 }, prazo: 2 },
  { itens: { milho: 2, leite: 2 }, prazo: 4 },
];

// Encomendas secretas: só se cumprem com o celeiro secreto.
export const MODELOS_ENCOMENDA = [
  { itens: { ovo: 2 }, pontos: 4 },
  { itens: { ovo: 1, milho: 2 }, pontos: 3 },
  { itens: { ovo: 1, leite: 2 }, pontos: 3 },
  { itens: { milho: 2, leite: 2 }, pontos: 3 },
  { itens: { milho: 2, leite: 1 }, pontos: 2 },
  { itens: { milho: 2 }, pontos: 2 },
  { itens: { leite: 2 }, pontos: 2 },
  { itens: { ovo: 1 }, pontos: 2 },
];

// Eventos da noite no modo 2–3 (a Raposa é o app). Peso = chance relativa.
export const EVENTOS_NOITE = [
  { tipo: 'roubaVila', peso: 2 },
  { tipo: 'roubaSecreto', peso: 5 },
  { tipo: 'pedidoFalso', peso: 1 },
  { tipo: 'tranquila', peso: 2 },
];

// ---------- utilidades ----------

export function cestaVazia() {
  return { ovo: 0, milho: 0, leite: 0 };
}

export function totalItens(cesta) {
  return ITENS.reduce((s, i) => s + (cesta[i] || 0), 0);
}

export function temItens(cesta, pedido) {
  return ITENS.every((i) => (cesta[i] || 0) >= (pedido[i] || 0));
}

function somar(cesta, outra, sinal = 1) {
  for (const i of ITENS) cesta[i] = (cesta[i] || 0) + sinal * (outra[i] || 0);
}

// Talento pela peça: TAT.. = tatu, SAP.. = sapo. Outras espécies não têm talento.
export function especieDoCodigo(codigo) {
  if (typeof codigo !== 'string') return null;
  const c = codigo.replace(/\s+/g, '').toUpperCase();
  if (c.startsWith('TAT')) return 'tatu';
  if (c.startsWith('SAP')) return 'sapo';
  return null;
}

// O que uma face rende para quem tem essa espécie (sapo: +1 leite ao colher leite).
export function colheita(face, especie) {
  if (!FACES.includes(face)) throw new Error(`face desconhecida: ${face}`);
  const c = { ...cestaVazia(), ...COLHEITA[face] };
  if (especie === 'sapo' && c.leite > 0) c.leite += 1;
  return c;
}

// O que vai para o celeiro secreto: o que foi colhido de verdade e não foi declarado.
// Declarar a mais não tira nada de ninguém (vale para a vila); por isso só a parte positiva.
export function diferencaSecreta(real, declarado) {
  const d = cestaVazia();
  for (const i of ITENS) d[i] = Math.max(0, (real[i] || 0) - (declarado[i] || 0));
  return d;
}

// Gerador mulberry32 com o estado dentro de `e.rng` (serializável).
function aleatorio(e) {
  e.rng = (e.rng + 0x6d2b79f5) >>> 0;
  let t = e.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function sortearIndice(e, n) {
  return Math.floor(aleatorio(e) * n);
}

function clonar(estado) {
  return structuredClone(estado);
}

// ---------- montagem ----------

export function modoDaPartida(n) {
  return n >= JOGADORES_TRAIDOR ? 'traidor' : 'app';
}

function novoPedido(e) {
  const m = MODELOS_PEDIDO[sortearIndice(e, MODELOS_PEDIDO.length)];
  const p = { id: e.proxId++, itens: { ...m.itens }, prazo: m.prazo, falso: false };
  if (e.proximoFalso) {
    p.falso = true;
    e.proximoFalso = false;
  }
  return p;
}

function novaEncomenda(e) {
  const m = MODELOS_ENCOMENDA[sortearIndice(e, MODELOS_ENCOMENDA.length)];
  return { id: e.proxId++, itens: { ...m.itens }, pontos: m.pontos };
}

// jogadores: [{ nome, codigo }]. semente: inteiro qualquer.
export function criarPartida(jogadores, semente = Date.now()) {
  if (!Array.isArray(jogadores) || jogadores.length < MIN_JOGADORES || jogadores.length > MAX_JOGADORES) {
    throw new Error(`precisa de ${MIN_JOGADORES} a ${MAX_JOGADORES} jogadores`);
  }
  const n = jogadores.length;
  const e = {
    versao: 1,
    modo: modoDaPartida(n),
    dia: 1,
    fase: 'papeis',
    rng: semente >>> 0,
    proxId: 1,
    proximoFalso: false,
    vila: cestaVazia(),
    pedidos: [],
    entregues: 0,
    falhas: 0,
    meta: META[n],
    raposa: null,
    expulsos: [],
    noite: null,
    assembleia: null,
    rodada: null,
    jogadores: jogadores.map((j) => ({
      nome: String(j.nome || '').trim() || 'Jogador',
      codigo: j.codigo || null,
      especie: especieDoCodigo(j.codigo),
      estrelas: ESTRELAS_INICIAIS,
      secreto: cestaVazia(),
      encomendas: [],
      pontos: 0,
      cumpridas: 0,
    })),
  };
  for (const j of e.jogadores) {
    for (let k = 0; k < ENCOMENDAS_INICIAIS; k++) j.encomendas.push(novaEncomenda(e));
  }
  if (e.modo === 'traidor') e.raposa = sortearIndice(e, n);
  completarPedidos(e);
  e.rodada = novaRodada(e);
  return e;
}

function completarPedidos(e) {
  while (e.pedidos.length < PEDIDOS_ATIVOS) e.pedidos.push(novoPedido(e));
}

export function ativos(estado) {
  return estado.jogadores.map((_, i) => i).filter((i) => !estado.expulsos.includes(i));
}

// Quem começa a declarar gira a cada dia.
export function ordemDoDia(estado) {
  const a = ativos(estado);
  const inicio = (estado.dia - 1) % a.length;
  return [...a.slice(inicio), ...a.slice(0, inicio)];
}

function novaRodada(e) {
  return { ordem: ordemDoDia(e), declaracoes: {}, desafios: {}, confessados: {} };
}

export function irPara(estado, fase) {
  const e = clonar(estado);
  e.fase = fase;
  return e;
}

// ---------- colheita e Duvido ----------

// A declaração é pública e vai direto para o celeiro da vila.
export function declarar(estado, idx, face) {
  const e = clonar(estado);
  if (e.rodada.declaracoes[idx] !== undefined) throw new Error('já declarou');
  e.rodada.declaracoes[idx] = face;
  somar(e.vila, colheita(face, e.jogadores[idx].especie));
  return e;
}

// Alguém duvidou de `idx`; a peça foi revelada e mostrou `faceReal`.
// Mentiu (face diferente) → perde a colheita inteira e 1 estrela.
// Verdade → quem duvidou perde 1 estrela.
export function duvidar(estado, idx, quemDuvidou, faceReal) {
  const e = clonar(estado);
  const declarada = e.rodada.declaracoes[idx];
  if (declarada === undefined) throw new Error('ninguém declarou ainda');
  if (idx === quemDuvidou) throw new Error('não dá para duvidar de si mesmo');
  if (e.rodada.desafios[idx]) throw new Error('já foi desafiado');
  if (!podeDuvidar(e, quemDuvidou)) throw new Error('precisa de estrela para duvidar');
  const mentiu = declarada !== faceReal;
  if (mentiu) {
    somar(e.vila, colheita(declarada, e.jogadores[idx].especie), -1);
    for (const i of ITENS) e.vila[i] = Math.max(0, e.vila[i]);
    // A estrela do mentiroso vai para quem duvidou (decisão de balanceamento, ver RAPOSA.md).
    if (e.jogadores[idx].estrelas > 0) {
      e.jogadores[idx].estrelas -= 1;
      e.jogadores[quemDuvidou].estrelas += 1;
    }
  } else {
    e.jogadores[quemDuvidou].estrelas = Math.max(0, e.jogadores[quemDuvidou].estrelas - 1);
  }
  e.rodada.desafios[idx] = { por: quemDuvidou, real: faceReal, mentiu };
  // Quem foi desafiado já mostrou a peça: não tem nada a confessar.
  e.rodada.confessados[idx] = faceReal;
  return e;
}

// Duvidar custa uma estrela se errar: sem estrela, não dá para duvidar de graça.
export function podeDuvidar(estado, quem) {
  return estado.jogadores[quem].estrelas > 0 && !estado.expulsos.includes(quem);
}

export function foiDesafiado(estado, idx) {
  return Boolean(estado.rodada.desafios[idx]);
}

// Confissão secreta: o que colheu de verdade. A diferença vai para o celeiro secreto.
export function confessar(estado, idx, faceReal) {
  const e = clonar(estado);
  if (e.rodada.confessados[idx] !== undefined) {
    return { estado: e, ganho: cestaVazia() };
  }
  const j = e.jogadores[idx];
  const declarada = e.rodada.declaracoes[idx];
  const ganho = diferencaSecreta(colheita(faceReal, j.especie), colheita(declarada, j.especie));
  somar(j.secreto, ganho);
  e.rodada.confessados[idx] = faceReal;
  return { estado: e, ganho };
}

// ---------- encomendas secretas ----------

export function podeCumprir(jogador, encomenda) {
  return temItens(jogador.secreto, encomenda.itens);
}

export function cumprirEncomenda(estado, idx, idEncomenda) {
  const e = clonar(estado);
  const j = e.jogadores[idx];
  const k = j.encomendas.findIndex((x) => x.id === idEncomenda);
  if (k < 0) throw new Error('encomenda não existe');
  const enc = j.encomendas[k];
  if (!podeCumprir(j, enc)) throw new Error('faltam itens no celeiro secreto');
  somar(j.secreto, enc.itens, -1);
  j.pontos += enc.pontos;
  j.cumpridas += 1;
  j.encomendas.splice(k, 1, novaEncomenda(e));
  return e;
}

// ---------- entrega ----------

// Pedidos que dá para entregar juntos agora, os de prazo mais curto primeiro.
export function sugerirEntregas(estado) {
  const resto = { ...estado.vila };
  const ordem = [...estado.pedidos].sort((a, b) => a.prazo - b.prazo || a.id - b.id);
  const ids = [];
  for (const p of ordem) {
    if (temItens(resto, p.itens)) {
      somar(resto, p.itens, -1);
      ids.push(p.id);
    }
  }
  return ids;
}

// Entrega um pedido com o celeiro da vila. Pedido falso: os itens somem e não conta.
export function entregar(estado, idPedido) {
  const e = clonar(estado);
  const k = e.pedidos.findIndex((p) => p.id === idPedido);
  if (k < 0) throw new Error('pedido não existe');
  const p = e.pedidos[k];
  if (!temItens(e.vila, p.itens)) throw new Error('faltam itens no celeiro da vila');
  somar(e.vila, p.itens, -1);
  e.pedidos.splice(k, 1);
  if (p.falso) return { estado: e, falso: true };
  e.entregues += 1;
  return { estado: e, falso: false };
}

// ---------- mercado ----------

// a dá `daA` para b; b dá `daB` para a. Só entre celeiros secretos.
export function trocar(estado, a, b, daA, daB) {
  const e = clonar(estado);
  if (a === b) throw new Error('troca precisa de dois jogadores');
  const ja = e.jogadores[a];
  const jb = e.jogadores[b];
  if (!temItens(ja.secreto, daA) || !temItens(jb.secreto, daB)) throw new Error('itens insuficientes');
  if (totalItens(daA) + totalItens(daB) === 0) throw new Error('troca vazia');
  somar(ja.secreto, daA, -1);
  somar(jb.secreto, daA);
  somar(jb.secreto, daB, -1);
  somar(ja.secreto, daB);
  return e;
}

// ---------- noite ----------

function roubarDe(e, cesta, quantos) {
  const levado = cestaVazia();
  for (let k = 0; k < quantos; k++) {
    const opcoes = ITENS.filter((i) => cesta[i] > 0);
    if (opcoes.length === 0) break;
    const item = opcoes[sortearIndice(e, opcoes.length)];
    cesta[item] -= 1;
    levado[item] += 1;
  }
  return levado;
}

// Modo 2–3: o app sorteia o evento da Raposa e já aplica.
export function sortearNoite(estado) {
  const e = clonar(estado);
  const total = EVENTOS_NOITE.reduce((s, ev) => s + ev.peso, 0);
  let r = aleatorio(e) * total;
  let tipo = EVENTOS_NOITE[EVENTOS_NOITE.length - 1].tipo;
  for (const ev of EVENTOS_NOITE) {
    if (r < ev.peso) { tipo = ev.tipo; break; }
    r -= ev.peso;
  }
  e.noite = aplicarEvento(e, tipo);
  return e;
}

function aplicarEvento(e, tipo) {
  if (tipo === 'roubaVila') {
    const levado = roubarDe(e, e.vila, ROUBO_VILA);
    if (totalItens(levado) === 0) return { tipo: 'rondou' };
    return { tipo, levado };
  }
  if (tipo === 'roubaSecreto') {
    // Quem tem mais no celeiro secreto. Tatu é imune; empate → o primeiro da mesa.
    let alvo = null;
    let mais = 0;
    for (const i of ativos(e)) {
      const t = totalItens(e.jogadores[i].secreto);
      if (t > mais) { mais = t; alvo = i; }
    }
    if (alvo === null) return { tipo: 'rondou' };
    if (e.jogadores[alvo].especie === 'tatu') return { tipo: 'tatuImune', alvo };
    return { tipo, alvo, levado: roubarDe(e, e.jogadores[alvo].secreto, ROUBO_SECRETO) };
  }
  if (tipo === 'pedidoFalso') {
    e.proximoFalso = true;
    return { tipo };
  }
  return { tipo: 'tranquila' };
}

// Modo traidor: a Raposa (jogador) escolhe o alvo: índice de um jogador ou 'vila'.
export function acaoDaRaposa(estado, alvo) {
  const e = clonar(estado);
  if (e.expulsos.includes(e.raposa)) {
    e.noite = { tipo: 'tranquila' };
    return e;
  }
  if (alvo === 'vila') {
    const levado = roubarDe(e, e.vila, ROUBO_TRAIDOR);
    e.noite = totalItens(levado) ? { tipo: 'roubaVila', levado } : { tipo: 'rondou' };
    return e;
  }
  const j = e.jogadores[alvo];
  if (!j || alvo === e.raposa) throw new Error('alvo inválido');
  if (j.especie === 'tatu') {
    e.noite = { tipo: 'tatuImune', alvo };
    return e;
  }
  const levado = roubarDe(e, j.secreto, ROUBO_TRAIDOR);
  e.noite = totalItens(levado) ? { tipo: 'roubaSecreto', alvo, levado } : { tipo: 'rondou', alvo };
  return e;
}

// ---------- assembleia (modo traidor) ----------

// votos: { eleitor: alvo | null }. Expulsa quem tiver mais da metade dos votos dos ativos.
export function apurarVotos(estado, votos) {
  const e = clonar(estado);
  const votantes = ativos(e);
  const conta = {};
  for (const v of votantes) {
    const alvo = votos[v];
    if (alvo === null || alvo === undefined || !votantes.includes(alvo)) continue;
    conta[alvo] = (conta[alvo] || 0) + 1;
  }
  let expulso = null;
  for (const [alvo, n] of Object.entries(conta)) {
    if (n * 2 > votantes.length) expulso = Number(alvo);
  }
  if (expulso !== null) e.expulsos.push(expulso);
  e.assembleia = { conta, expulso, eraRaposa: expulso !== null && expulso === e.raposa };
  return e;
}

export function raposaExpulsa(estado) {
  return estado.modo === 'traidor' && estado.expulsos.includes(estado.raposa);
}

// ---------- fim do dia ----------

// Prazos andam, pedidos vencidos somem (falha; falso vencido não conta), novo dia.
export function fimDoDia(estado) {
  const e = clonar(estado);
  const vencidos = [];
  e.pedidos = e.pedidos.filter((p) => {
    p.prazo -= 1;
    if (p.prazo > 0) return true;
    vencidos.push(p);
    if (!p.falso) e.falhas += 1;
    return false;
  });
  e.ultimosVencidos = vencidos;
  e.noite = null;
  e.assembleia = null;
  e.dia += 1;
  if (e.dia > DIAS) {
    e.fase = 'fim';
    return e;
  }
  completarPedidos(e);
  e.rodada = novaRodada(e);
  e.fase = 'caminhao';
  return e;
}

// ---------- resultado ----------

export function pontuacao(jogador) {
  return jogador.pontos + jogador.estrelas;
}

export function resultado(estado) {
  const metaCumprida = estado.entregues >= estado.meta;
  const vilaVenceu = estado.modo === 'traidor' ? metaCumprida && raposaExpulsa(estado) : metaCumprida;
  const ranking = estado.jogadores
    .map((j, idx) => ({ idx, nome: j.nome, pontos: pontuacao(j), encomendas: j.pontos, estrelas: j.estrelas }))
    .filter((r) => !estado.expulsos.includes(r.idx) && r.idx !== estado.raposa)
    .sort((a, b) => b.pontos - a.pontos || b.estrelas - a.estrelas);
  const topo = ranking.length ? ranking[0].pontos : 0;
  const vencedores = vilaVenceu ? ranking.filter((r) => r.pontos === topo).map((r) => r.idx) : [];
  return { vilaVenceu, metaCumprida, ranking, vencedores };
}
