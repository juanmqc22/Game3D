// Simulação da Raposa na Fazenda — não é teste e não faz parte do app.
//
// Uso:
//   node scripts/raposa-simulacao.js                 (relatório completo)
//   node scripts/raposa-simulacao.js --partidas 4000 --semente 7
//
// Bots:
//   honesto     declara sempre a face real
//   moderado    mente ~1 em 3 vezes quando colheu algo
//   constante   mente sempre que colheu algo
//   desconfiado quase não mente; duvida mais que os outros
// Os três primeiros duvidam na mesma taxa, para comparar só o efeito de mentir.
// Todos cumprem encomendas assim que podem e entregam o que o app sugere.
// Não simulamos trocas no mercado (conversa livre; entram só no tempo estimado).
//
// Alvos (RAPOSA.md): vila vence 50–65% a dois; o moderado vence mais que o
// constante; mentir às vezes vence mais que ser honesto; partida de 20–30 min.

import { pathToFileURL } from 'node:url';
import {
  FACES, DIAS, criarPartida, declarar, duvidar, confessar, cumprirEncomenda, podeCumprir,
  sugerirEntregas, entregar, sortearNoite, acaoDaRaposa, apurarVotos, fimDoDia, resultado,
  ordemDoDia, ativos, totalItens,
} from '../raposa/js/regras.js';

export const BOTS = {
  honesto: { mente: 0, duvida: 0.3 },
  moderado: { mente: 0.35, duvida: 0.3 },
  constante: { mente: 1, duvida: 0.3 },
  desconfiado: { mente: 0.1, duvida: 0.6 },
};

// Quanto a desconfiança sobe a cada vez que o jogador é pego mentindo.
export const SUSPEITA = { porFlagra: 2 };

// Tempo estimado de cada ação, em segundos, numa mesa real.
export const TEMPO = {
  caminhao: 15, giro: 25, declaracao: 8, duvido: 25, privada: 25,
  entrega: 20, mercado: 45, noite: 20, noitePorJogador: 12, assembleia: 90, votoPorJogador: 10,
};

function rng(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mentir = declarar outra face com colheita (a vila recebe o declarado, o real vai
// para o celeiro secreto). Com praga não há o que esconder: o bot fala a verdade.
function escolherDeclaracao(bot, real, r, raposa) {
  const chance = raposa ? 0.6 : BOTS[bot].mente;
  if (real === 'TROPECO' || r() >= chance) return real;
  // A Raposa (traidor) esconde tudo: declara praga para a vila não receber nada.
  if (raposa) return 'TROPECO';
  // Quem mente quer a vila vencendo: declara milho ou leite (2 itens), nunca menos.
  const outras = ['ATAQUE', 'DEFESA'].filter((f) => f !== real);
  return outras[Math.floor(r() * outras.length)];
}

function simularPartida(bots, semente, opcoes = {}) {
  const r = rng(semente * 7919 + 13);
  const jogadores = bots.map((b, i) => ({ nome: `${b}${i}`, codigo: opcoes.codigos?.[i] ?? null }));
  let e = criarPartida(jogadores, semente);
  const pegos = bots.map(() => 0);
  const mentiras = bots.map(() => 0);
  let segundos = 0;
  const n = bots.length;

  while (e.fase !== 'fim') {
    segundos += TEMPO.caminhao + TEMPO.giro;
    const reais = {};
    for (const idx of ordemDoDia(e)) {
      const real = FACES[Math.floor(r() * 4)];
      reais[idx] = real;
      const decl = escolherDeclaracao(bots[idx], real, r, e.raposa === idx);
      if (decl !== real) mentiras[idx]++;
      e = declarar(e, idx, decl);
      segundos += TEMPO.declaracao;
      // Outros podem duvidar, em ordem; desconfiança sobe com quem já foi pego.
      for (const outro of ordemDoDia(e)) {
        if (outro === idx) continue;
        if (e.jogadores[outro].estrelas === 0) continue;
        const p = Math.min(0.9, BOTS[bots[outro]].duvida * (1 + pegos[idx] * SUSPEITA.porFlagra) * (decl === 'TROPECO' ? 0.3 : 1));
        if (r() < p) {
          e = duvidar(e, idx, outro, real);
          if (e.rodada.desafios[idx].mentiu) pegos[idx]++;
          segundos += TEMPO.duvido;
          break;
        }
      }
    }
    for (const idx of ativos(e)) {
      e = confessar(e, idx, reais[idx]).estado;
      let achou = true;
      while (achou) {
        achou = false;
        for (const enc of e.jogadores[idx].encomendas) {
          if (podeCumprir(e.jogadores[idx], enc)) {
            e = cumprirEncomenda(e, idx, enc.id);
            achou = true;
            break;
          }
        }
      }
      segundos += TEMPO.privada;
    }
    for (const id of sugerirEntregas(e)) e = entregar(e, id).estado;
    segundos += TEMPO.entrega + TEMPO.mercado;
    if (e.modo === 'app') {
      e = sortearNoite(e);
      segundos += TEMPO.noite;
    } else {
      segundos += TEMPO.noite + TEMPO.noitePorJogador * ativos(e).length;
      // A Raposa rouba da vila quando ela está perto de entregar; senão de quem tem mais.
      if (!e.expulsos.includes(e.raposa)) {
        let alvo = 'vila';
        let mais = -1;
        for (const i of ativos(e)) {
          if (i === e.raposa) continue;
          const t = totalItens(e.jogadores[i].secreto);
          if (t > mais && e.jogadores[i].especie !== 'tatu') { mais = t; alvo = i; }
        }
        if (totalItens(e.vila) >= 3 || mais <= 0) alvo = 'vila';
        e = acaoDaRaposa(e, alvo);
      }
      // Assembleia: todos votam em quem foi pego mentindo mais (a Raposa desvia).
      segundos += TEMPO.assembleia + TEMPO.votoPorJogador * ativos(e).length;
      const suspeitos = ativos(e).filter((i) => pegos[i] > 0);
      if (suspeitos.length) {
        suspeitos.sort((a, b) => pegos[b] - pegos[a]);
        const principal = suspeitos[0];
        const votos = {};
        for (const i of ativos(e)) {
          if (i === e.raposa) votos[i] = principal === i ? suspeitos[1] ?? null : principal;
          else votos[i] = principal === i ? null : principal;
        }
        e = apurarVotos(e, votos);
      }
    }
    e = fimDoDia(e);
  }
  const res = resultado(e);
  return { res, estado: e, segundos, pegos, mentiras, n };
}

export function rodar({ bots, partidas = 2000, semente = 1, codigos }) {
  let vila = 0;
  let raposaGanhou = 0;
  let metaCumprida = 0;
  let expulsa = 0;
  const vitorias = {};
  const pontos = {};
  const extra = {};
  const entregues = [];
  const tempos = [];
  for (let k = 0; k < partidas; k++) {
    const { res, estado, segundos, pegos, mentiras } = simularPartida(bots, semente + k, { codigos });
    entregues.push(estado.entregues);
    if (res.metaCumprida) metaCumprida++;
    if (estado.modo === 'traidor' && estado.expulsos.includes(estado.raposa)) expulsa++;
    tempos.push(segundos / 60);
    if (res.vilaVenceu) {
      vila++;
      for (const idx of res.vencedores) {
        const b = bots[idx];
        vitorias[b] = (vitorias[b] || 0) + 1 / res.vencedores.length;
      }
    } else if (estado.modo === 'traidor') {
      raposaGanhou++;
    }
    estado.jogadores.forEach((j, idx) => {
      const b = bots[idx];
      pontos[b] = pontos[b] || [];
      pontos[b].push(j.pontos + j.estrelas);
      extra[b] = extra[b] || { cumpridas: 0, estrelas: 0, pegos: 0, mentiras: 0, jogos: 0 };
      extra[b].cumpridas += j.cumpridas;
      extra[b].estrelas += j.estrelas;
      extra[b].pegos += pegos[idx];
      extra[b].mentiras += mentiras[idx];
      extra[b].jogos += 1;
    });
  }
  const media = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const mediana = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  return {
    bots: bots.join(' x '),
    vila: vila / partidas,
    raposa: raposaGanhou / partidas,
    metaCumprida: metaCumprida / partidas,
    raposaExpulsa: expulsa / partidas,
    vitorias: Object.fromEntries(Object.entries(vitorias).map(([b, v]) => [b, v / partidas])),
    pontosMedios: Object.fromEntries(Object.entries(pontos).map(([b, xs]) => [b, media(xs)])),
    porBot: Object.fromEntries(Object.entries(extra).map(([b, x]) => [b, {
      cumpridas: x.cumpridas / x.jogos, estrelas: x.estrelas / x.jogos,
      mentiras: x.mentiras / x.jogos, pegos: x.pegos / x.jogos,
    }])),
    entreguesMedia: media(entregues),
    minutosMediana: mediana(tempos),
  };
}

function pct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

function imprimir(r) {
  const vit = Object.entries(r.vitorias).map(([b, v]) => `${b} ${pct(v)}`).join(', ');
  const pts = Object.entries(r.pontosMedios).map(([b, v]) => `${b} ${v.toFixed(1)}`).join(', ');
  console.log(`${r.bots}`);
  const traidor = r.raposa || r.raposaExpulsa
    ? ` | meta ${pct(r.metaCumprida)}, raposa expulsa ${pct(r.raposaExpulsa)}, raposa vence ${pct(r.raposa)}` : '';
  console.log(`  vila vence ${pct(r.vila)}${traidor}`
    + ` | entregues ${r.entreguesMedia.toFixed(2)} | ~${r.minutosMediana.toFixed(0)} min`);
  console.log(`  vitórias: ${vit || '—'}`);
  console.log(`  pontos médios: ${pts}`);
}

export const CENARIOS = [
  ['moderado', 'desconfiado'],
  ['moderado', 'moderado'],
  ['honesto', 'honesto'],
  ['moderado', 'constante'],
  ['honesto', 'moderado'],
  ['constante', 'desconfiado'],
  ['honesto', 'constante'],
  ['honesto', 'moderado', 'desconfiado'],
  ['moderado', 'desconfiado', 'honesto', 'moderado'],
  ['moderado', 'moderado', 'moderado', 'moderado'],
  ['moderado', 'desconfiado', 'honesto', 'moderado', 'honesto', 'desconfiado'],
];

function main() {
  const args = process.argv.slice(2);
  const valor = (nome, padrao) => {
    const k = args.indexOf(`--${nome}`);
    return k >= 0 ? Number(args[k + 1]) : padrao;
  };
  const partidas = valor('partidas', 3000);
  const semente = valor('semente', 1);
  console.log(`Raposa na Fazenda — ${partidas} partidas por cenário, ${DIAS} dias\n`);
  for (const bots of CENARIOS) imprimir(rodar({ bots, partidas, semente }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
