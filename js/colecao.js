// Coleção de bichinhos descobertos neste celular. Lógica pura sobre um
// "storage" (localStorage), sem DOM.
//
// localStorage, chave CHAVE_COLECAO:
//   { TAT01: { descobertoEm: '2026-09-18T12:00:00.000Z', partidas: 3, vitorias: 2 }, ... }

import { CRIATURAS, buscarCriatura } from './criaturas.js?v=12';

export const CHAVE_COLECAO = 'bichinhos:colecao';

// Devolve o objeto da coleção, {} se vazio, ou null se o storage não funciona.
export function lerColecao(storage) {
  try {
    const bruto = storage.getItem(CHAVE_COLECAO);
    if (!bruto) return {};
    const dados = JSON.parse(bruto);
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return {};
    const limpa = {};
    for (const [codigo, item] of Object.entries(dados)) {
      if (!buscarCriatura(codigo) || !item || typeof item !== 'object') continue;
      limpa[codigo] = {
        descobertoEm: typeof item.descobertoEm === 'string' ? item.descobertoEm : new Date(0).toISOString(),
        partidas: Number.isInteger(item.partidas) && item.partidas >= 0 ? item.partidas : 0,
        vitorias: Number.isInteger(item.vitorias) && item.vitorias >= 0 ? item.vitorias : 0,
      };
    }
    return limpa;
  } catch {
    return null;
  }
}

function gravarColecao(storage, colecao) {
  try {
    storage.setItem(CHAVE_COLECAO, JSON.stringify(colecao));
    return true;
  } catch {
    return false;
  }
}

// Registra a criatura (só se o código existir). Devolve { nova, criatura, colecao }:
// nova = true na primeira vez. Código inválido: { nova: false, criatura: null }.
export function registrarDescoberta(storage, codigoBruto, agora = new Date()) {
  const criatura = buscarCriatura(String(codigoBruto ?? ''));
  if (!criatura) return { nova: false, criatura: null, colecao: lerColecao(storage) };
  const colecao = lerColecao(storage) ?? {};
  const nova = !colecao[criatura.codigo];
  if (nova) {
    colecao[criatura.codigo] = { descobertoEm: new Date(agora).toISOString(), partidas: 0, vitorias: 0 };
    gravarColecao(storage, colecao);
  }
  return { nova, criatura, colecao };
}

export function estaDescoberta(colecao, codigo) {
  return Boolean(colecao && colecao[codigo]);
}

export function contarDescobertos(colecao) {
  return colecao ? Object.keys(colecao).length : 0;
}

// Contabiliza uma partida terminada para quem está na coleção.
// vencedor: 0, 1 ou null (empate). Partida espelhada e empate não contam.
// Devolve true se gravou.
export function registrarPartida(storage, codigos, vencedor) {
  if (vencedor !== 0 && vencedor !== 1) return false;
  if (codigos[0] === codigos[1]) return false;
  const colecao = lerColecao(storage);
  if (colecao === null) return false;
  let mudou = false;
  codigos.forEach((codigo, i) => {
    if (!colecao[codigo]) return;
    colecao[codigo].partidas += 1;
    if (i === vencedor) colecao[codigo].vitorias += 1;
    mudou = true;
  });
  return mudou ? gravarColecao(storage, colecao) : false;
}

// Oponente surpresa: sorteia entre todas as criaturas (aleatorio: função 0 <= x < 1).
export function sortearOponente(aleatorio = Math.random, criaturas = CRIATURAS) {
  const i = Math.min(criaturas.length - 1, Math.max(0, Math.floor(aleatorio() * criaturas.length)));
  return criaturas[i];
}
