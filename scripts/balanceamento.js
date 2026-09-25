// Simulação de balanceamento — não é teste e não faz parte do app.
//
// Uso:
//   node scripts/balanceamento.js
//   node scripts/balanceamento.js --faces 20,20,20,40 --partidas 2000 --semente 1
//   node scripts/balanceamento.js --modo ARENA --chance 50
//
// --modo:  ROLAR (padrão), ARENA ou MIRA.
// --chance: em ARENA, chance (%) de cada peça parar dentro do círculo; em MIRA,
//           chance (%) de cada peça acertar o alvo. Padrão 50. Independente por jogador.
//
// --faces: peso de cada face na ordem ATAQUE,DEFESA,ESPECIAL,TROPECO
//          (não precisa somar 100; padrão 25,25,25,25 = peça justa).
// --ajuste: testa números sem editar js/criaturas.js. CODIGO.campo=valor,
//           separados por vírgula. Campos: vida, forca, dano, cura, recuo.
//           Ex.: --ajuste SAP06.vida=15,SAP06.recuo=1  (vale também RAT00)
// --rival: em vez do elenco inteiro, cada fundador (série atual) contra o
//          Rato do Mato, nas duas ordens somadas. Alvo: RIVAL_MIN a RIVAL_MAX.
//
// Alvos: taxa de vitória entre 30% e 70%, mediana de rodadas entre 5 e 15,
// nenhuma partida chegando ao limite de rodadas, e média de cada bichinho
// contra o resto do elenco entre MEDIA_ELENCO_MIN e MEDIA_ELENCO_MAX.

import { pathToFileURL } from 'node:url';
import { CRIATURAS, RIVAL, SERIE_ATUAL } from '../js/criaturas.js';
import { SIMBOLOS, MODOS, ROLAR, ARENA, MIRA, estadoInicial, resolverRodadaModo } from '../js/regras.js';

// Faixa da taxa média de vitória de cada bichinho contra o resto do elenco.
export const MEDIA_ELENCO_MIN = 0.45;
export const MEDIA_ELENCO_MAX = 0.57;
// Taxa de vitória de cada fundador contra o Rato do Mato (rival de treino).
export const RIVAL_MIN = 0.65;
export const RIVAL_MAX = 0.75;

export const FACES_UNIFORMES = [25, 25, 25, 25];
export const LIMITE_RODADAS = 40;
export const ALVOS = { taxaMin: 0.3, taxaMax: 0.7, medianaMin: 5, medianaMax: 15 };

const CAMPOS_DA_CRIATURA = ['vida', 'forca'];
const CAMPOS_DO_ESPECIAL = ['dano', 'cura', 'recuo'];

// Devolve uma cópia das criaturas com os ajustes aplicados ("SAP06.vida=15,SAP06.recuo=1").
export function aplicarAjustes(criaturas, texto) {
  const copia = structuredClone(criaturas);
  if (!texto) return copia;
  for (const item of texto.split(',')) {
    const m = item.trim().match(/^([A-Za-z0-9]+)\.(\w+)=(\d+)$/);
    if (!m) throw new Error(`Ajuste inválido: "${item}" (use CODIGO.campo=valor)`);
    const [, codigo, campo, valor] = m;
    const c = copia.find((x) => x.codigo === codigo.toUpperCase());
    if (!c) throw new Error(`Ajuste: código desconhecido ${codigo}`);
    if (CAMPOS_DA_CRIATURA.includes(campo)) c[campo] = Number(valor);
    else if (CAMPOS_DO_ESPECIAL.includes(campo)) c.especial[campo] = Number(valor);
    else throw new Error(`Ajuste: campo desconhecido ${campo}`);
  }
  return copia;
}

// Para cada bichinho: taxa média contra os outros (espelhos fora, as duas ordens
// contam) e a pior linha em que ele aparece.
export function resumoPorCriatura(resultados, criaturas) {
  return criaturas.map((c) => {
    const linhas = [];
    for (const r of resultados) {
      if (r.a.codigo === r.b.codigo) continue;
      if (r.a.codigo === c.codigo) linhas.push({ taxa: r.taxaA, oponente: r.b, ordem: 'A' });
      else if (r.b.codigo === c.codigo) linhas.push({ taxa: 1 - r.taxaA, oponente: r.a, ordem: 'B' });
    }
    const media = linhas.reduce((s, l) => s + l.taxa, 0) / linhas.length;
    const pior = linhas.reduce((p, l) => (l.taxa < p.taxa ? l : p));
    const foraDaFaixa = media < MEDIA_ELENCO_MIN ? 'abaixo' : media > MEDIA_ELENCO_MAX ? 'acima' : null;
    return { criatura: c, media, pior, foraDaFaixa };
  });
}

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
// sortearSim: devolve true/false (ARENA: ficou dentro; MIRA: acertou o alvo).
export function simularPartida(a, b, sortearFace, limite = LIMITE_RODADAS, modo = ROLAR, sortearSim = () => true) {
  let estado = estadoInicial(a, b);
  let maiorDano = 0;
  while (estado.rodada < limite) {
    const entradas = [0, 1].map(() => {
      const e = { simbolo: sortearFace() };
      if (modo === ARENA) e.dentro = sortearSim();
      if (modo === MIRA) e.acertou = sortearSim();
      return e;
    });
    const r = resolverRodadaModo(modo, estado, entradas);
    estado = r.estado;
    maiorDano = Math.max(maiorDano, r.resumo.dano);
    if (r.fim.terminou) {
      return { vencedor: r.fim.vencedor, rodadas: estado.rodada, bateuLimite: false, maiorDano };
    }
  }
  return { vencedor: null, rodadas: estado.rodada, bateuLimite: true, maiorDano };
}

export function simularConfronto(a, b, { partidas = 2000, faces = FACES_UNIFORMES, semente = 1, limite = LIMITE_RODADAS, modo = ROLAR, chance = 50 } = {}) {
  const aleatorio = criarGerador(semente);
  const sortearFace = criarSorteioDeFace(faces, aleatorio);
  const sortearSim = () => aleatorio() * 100 < chance;
  const r = { a, b, vitoriasA: 0, vitoriasB: 0, empates: 0, noLimite: 0, maiorDano: 0, rodadas: [] };
  for (let i = 0; i < partidas; i++) {
    const p = simularPartida(a, b, sortearFace, limite, modo, sortearSim);
    r.rodadas.push(p.rodadas);
    r.maiorDano = Math.max(r.maiorDano, p.maiorDano);
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

// Cada fundador contra o Rato, nas duas ordens (quem é o jogador 1 não pesa).
// Devolve [{ criatura, taxa, mediana, noLimite, maiorDano }] — taxa do fundador.
export function simularContraRival(fundadores, rival, opcoes = {}) {
  return fundadores.map((c) => {
    const ida = simularConfronto(c, rival, opcoes);
    const volta = simularConfronto(rival, c, opcoes);
    const vitorias = ida.vitoriasA + volta.vitoriasB;
    const derrotas = ida.vitoriasB + volta.vitoriasA;
    return {
      criatura: c,
      taxa: vitorias / (vitorias + derrotas),
      mediana: Math.max(ida.mediana, volta.mediana),
      noLimite: ida.noLimite + volta.noLimite,
      maiorDano: Math.max(ida.maiorDano, volta.maiorDano),
    };
  });
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const nome = (c) => `${c.codigo} ${c.nome}`;

function imprimirTabela(resultados, { partidas, faces, semente, limite, ajuste, modo, chance }) {
  const extra = modo === ROLAR ? '' : `  |  chance de ${modo === ARENA ? 'ficar dentro' : 'acertar'}: ${chance}%`;
  console.log(`Modo ${modo}${extra}`);
  console.log(`Faces (ATQ/DEF/ESP/TRO): ${faces.join('/')}  |  ${partidas} partidas por confronto  |  limite ${limite} rodadas  |  semente ${semente}`);
  if (ajuste) console.log(`Ajustes: ${ajuste}`);
  console.log(`Taxa = vitórias de A / (vitórias de A + vitórias de B); empates fora.\n`);
  const linhas = [['#', 'A', 'B', 'Vit A', 'Vit B', 'Emp', 'Taxa A', 'Mediana', 'Máx rod', 'Maior dano', 'No limite', 'Fora do alvo']];
  resultados.forEach((r, i) => {
    linhas.push([
      String(i + 1), nome(r.a), nome(r.b), String(r.vitoriasA), String(r.vitoriasB), String(r.empates),
      pct(r.taxaA), String(r.mediana), String(r.maximo), String(r.maiorDano), String(r.noLimite), r.problemas.join(', ') || '-',
    ]);
  });
  const larguras = linhas[0].map((_, c) => Math.max(...linhas.map((l) => l[c].length)));
  for (const [i, l] of linhas.entries()) {
    console.log(l.map((cel, c) => (c <= 2 || c === 11 ? cel.padEnd(larguras[c]) : cel.padStart(larguras[c]))).join('  '));
    if (i === 0) console.log(larguras.map((w) => '-'.repeat(w)).join('  '));
  }
  const ruins = resultados.filter((r) => r.problemas.length);
  console.log(`\nConfrontos fora do alvo: ${ruins.length} de ${resultados.length}`);
  const noLimite = resultados.reduce((s, r) => s + r.noLimite, 0);
  console.log(`Partidas que bateram no limite de ${limite} rodadas: ${noLimite}`);
}

function imprimirResumo(resumo) {
  console.log(`\nMédia contra o resto do elenco (alvo ${pct(MEDIA_ELENCO_MIN)} a ${pct(MEDIA_ELENCO_MAX)}; espelhos fora):`);
  for (const r of resumo) {
    const pior = `pior: ${pct(r.pior.taxa)} contra ${nome(r.pior.oponente)} (como ${r.pior.ordem})`;
    const marca = r.foraDaFaixa ? `  <- ${r.foraDaFaixa} da faixa` : '';
    console.log(`  ${nome(r.criatura).padEnd(15)} ${pct(r.media).padStart(6)}  ${pior}${marca}`);
  }
  const fora = resumo.filter((r) => r.foraDaFaixa).length;
  console.log(`Bichinhos fora da faixa: ${fora} de ${resumo.length}`);
}

function imprimirRival(linhas, rival, { modo, faces, partidas, ajuste }) {
  console.log(`Fundadores contra ${nome(rival)} (vida ${rival.vida}, força ${rival.forca}, ${rival.especial.nome} ${rival.especial.dano})`);
  console.log(`Modo ${modo}  |  faces ${faces.join('/')}  |  ${partidas} partidas por ordem${ajuste ? `  |  ajustes: ${ajuste}` : ''}`);
  console.log(`Alvo: ${pct(RIVAL_MIN)} a ${pct(RIVAL_MAX)} de vitórias do fundador.
`);
  for (const l of linhas) {
    const fora = l.taxa < RIVAL_MIN ? '  <- abaixo' : l.taxa > RIVAL_MAX ? '  <- acima' : '';
    console.log(`  ${nome(l.criatura).padEnd(15)} ${pct(l.taxa).padStart(6)}  mediana ${l.mediana}  maior dano ${l.maiorDano}  no limite ${l.noLimite}${fora}`);
  }
}

function lerArgumentos(argv) {
  const opcoes = { partidas: 2000, faces: FACES_UNIFORMES, semente: 1, limite: LIMITE_RODADAS, modo: ROLAR, chance: 50 };
  for (let i = 0; i < argv.length; i++) {
    const valor = argv[i + 1];
    switch (argv[i]) {
      case '--faces': opcoes.faces = valor.split(',').map(Number); i++; break;
      case '--partidas': opcoes.partidas = Number(valor); i++; break;
      case '--semente': opcoes.semente = Number(valor); i++; break;
      case '--limite': opcoes.limite = Number(valor); i++; break;
      case '--ajuste': opcoes.ajuste = valor; i++; break;
      case '--rival': opcoes.rival = true; break;
      case '--modo':
        opcoes.modo = String(valor).toUpperCase();
        if (!MODOS.includes(opcoes.modo)) throw new Error(`Modo desconhecido: ${valor} (use ${MODOS.join(', ')})`);
        i++;
        break;
      case '--chance':
        opcoes.chance = Number(valor);
        if (!(opcoes.chance >= 0 && opcoes.chance <= 100)) throw new Error('--chance deve estar entre 0 e 100');
        i++;
        break;
      default: throw new Error(`Argumento desconhecido: ${argv[i]}`);
    }
  }
  return opcoes;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opcoes = lerArgumentos(process.argv.slice(2));
  const todas = aplicarAjustes([...CRIATURAS, RIVAL], opcoes.ajuste);
  const rival = todas.pop();
  const criaturas = todas;
  if (opcoes.rival) {
    imprimirRival(simularContraRival(criaturas.filter((c) => c.serie === SERIE_ATUAL), rival, opcoes), rival, opcoes);
    process.exit(0);
  }
  const resultados = simularTodos(criaturas, opcoes);
  imprimirTabela(resultados, opcoes);
  imprimirResumo(resumoPorCriatura(resultados, criaturas));
}
