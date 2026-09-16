// Simulação de balanceamento — não é teste e não faz parte do app.
//
// Uso:
//   node scripts/balanceamento.js
//   node scripts/balanceamento.js --faces 20,20,20,40 --partidas 2000 --semente 1
//
// --faces: peso de cada face na ordem ATAQUE,DEFESA,ESPECIAL,TROPECO
//          (não precisa somar 100; padrão 25,25,25,25 = peça justa).
//
// Alvos: taxa de vitória entre 30% e 70%, mediana de rodadas entre 5 e 15,
// nenhuma partida chegando ao limite de rodadas.

import { pathToFileURL } from 'node:url';
import { CRIATURAS } from '../js/criaturas.js';
import { SIMBOLOS, estadoInicial, resolverRodada } from '../js/regras.js';

export const FACES_UNIFORMES = [25, 25, 25, 25];
export const LIMITE_RODADAS = 40;
export const ALVOS = { taxaMin: 0.3, taxaMax: 0.7, medianaMin: 5, medianaMax: 15 };

// Gerador com semente (mulberry32): os mesmos parâmetros dão sempre a mesma tabela.
export function criarGerador(semente) {
  let s = semente >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Recebe os pesos das faces (ordem de SIMBOLOS) e devolve uma função que sorteia um símbolo.
export function criarSorteioDeFace(faces, aleatorio) {
  if (faces.length !== SIMBOLOS.length || faces.some((p) => !(p >= 0))) {
    throw new Error(`faces deve ter ${SIMBOLOS.length} pesos >= 0 (ATAQUE,DEFESA,ESPECIAL,TROPECO)`);
  }
  const total = faces.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error('a soma dos pesos das faces deve ser maior que 0');
  return function () {
    let r = aleatorio() * total;
    for (let i = 0; i < SIMBOLOS.length; i++) {
      r -= faces[i];
      if (r < 0) return SIMBOLOS[i];
    }
    return SIMBOLOS[SIMBOLOS.length - 1];
  };
}

// Joga uma partida até o fim ou até o limite de rodadas.
export function simularPartida(a, b, sortearFace, limite = LIMITE_RODADAS) {
  let estado = estadoInicial(a, b);
  while (estado.rodada < limite) {
    const r = resolverRodada(estado, sortearFace(), sortearFace());
    estado = r.estado;
    if (r.fim.terminou) {
      return { vencedor: r.fim.vencedor, rodadas: estado.rodada, bateuLimite: false };
    }
  }
  return { vencedor: null, rodadas: estado.rodada, bateuLimite: true };
}

export function simularConfronto(a, b, { partidas = 2000, faces = FACES_UNIFORMES, semente = 1, limite = LIMITE_RODADAS } = {}) {
  const sortearFace = criarSorteioDeFace(faces, criarGerador(semente));
  const r = { a, b, vitoriasA: 0, vitoriasB: 0, empates: 0, noLimite: 0, rodadas: [] };
  for (let i = 0; i < partidas; i++) {
    const p = simularPartida(a, b, sortearFace, limite);
    r.rodadas.push(p.rodadas);
    if (p.bateuLimite) r.noLimite++;
    else if (p.vencedor === 0) r.vitoriasA++;
    else if (p.vencedor === 1) r.vitoriasB++;
    else r.empates++;
  }
  const decididas = r.vitoriasA + r.vitoriasB;
  r.taxaA = decididas ? r.vitoriasA / decididas : 0.5;
  r.mediana = mediana(r.rodadas);
  r.maximo = Math.max(...r.rodadas);
  r.problemas = problemas(r);
  delete r.rodadas;
  return r;
}

// Os N x N confrontos (inclui espelhos e as duas ordens), ordenados por mediana decrescente.
export function simularTodos(criaturas, opcoes = {}) {
  const resultados = [];
  for (const a of criaturas) {
    for (const b of criaturas) {
      resultados.push(simularConfronto(a, b, opcoes));
    }
  }
  return resultados.sort((x, y) => y.mediana - x.mediana || x.a.codigo.localeCompare(y.a.codigo) || x.b.codigo.localeCompare(y.b.codigo));
}

function mediana(valores) {
  const v = [...valores].sort((x, y) => x - y);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function problemas(r) {
  const lista = [];
  if (r.taxaA < ALVOS.taxaMin || r.taxaA > ALVOS.taxaMax) lista.push('taxa');
  if (r.mediana < ALVOS.medianaMin || r.mediana > ALVOS.medianaMax) lista.push('mediana');
  if (r.noLimite > 0) lista.push('limite');
  return lista;
}

function imprimirTabela(resultados, { partidas, faces, semente, limite }) {
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const nome = (c) => `${c.codigo} ${c.nome}`;
  console.log(`Faces (ATQ/DEF/ESP/TRO): ${faces.join('/')}  |  ${partidas} partidas por confronto  |  limite ${limite} rodadas  |  semente ${semente}`);
  console.log(`Taxa = vitórias de A / (vitórias de A + vitórias de B); empates fora.\n`);
  const linhas = [['#', 'A', 'B', 'Vit A', 'Vit B', 'Emp', 'Taxa A', 'Mediana', 'Máx', 'No limite', 'Fora do alvo']];
  resultados.forEach((r, i) => {
    linhas.push([
      String(i + 1), nome(r.a), nome(r.b), String(r.vitoriasA), String(r.vitoriasB), String(r.empates),
      pct(r.taxaA), String(r.mediana), String(r.maximo), String(r.noLimite), r.problemas.join(', ') || '-',
    ]);
  });
  const larguras = linhas[0].map((_, c) => Math.max(...linhas.map((l) => l[c].length)));
  for (const [i, l] of linhas.entries()) {
    console.log(l.map((cel, c) => (c <= 2 || c === 10 ? cel.padEnd(larguras[c]) : cel.padStart(larguras[c]))).join('  '));
    if (i === 0) console.log(larguras.map((w) => '-'.repeat(w)).join('  '));
  }
  const ruins = resultados.filter((r) => r.problemas.length);
  console.log(`\nConfrontos fora do alvo: ${ruins.length} de ${resultados.length}`);
  const noLimite = resultados.reduce((s, r) => s + r.noLimite, 0);
  console.log(`Partidas que bateram no limite de ${limite} rodadas: ${noLimite}`);
}

function lerArgumentos(argv) {
  const opcoes = { partidas: 2000, faces: FACES_UNIFORMES, semente: 1, limite: LIMITE_RODADAS };
  for (let i = 0; i < argv.length; i++) {
    const valor = argv[i + 1];
    switch (argv[i]) {
      case '--faces': opcoes.faces = valor.split(',').map(Number); i++; break;
      case '--partidas': opcoes.partidas = Number(valor); i++; break;
      case '--semente': opcoes.semente = Number(valor); i++; break;
      case '--limite': opcoes.limite = Number(valor); i++; break;
      default: throw new Error(`Argumento desconhecido: ${argv[i]}`);
    }
  }
  return opcoes;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opcoes = lerArgumentos(process.argv.slice(2));
  imprimirTabela(simularTodos(CRIATURAS, opcoes), opcoes);
}
