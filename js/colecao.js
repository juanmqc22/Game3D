// Coleção de bichinhos descobertos neste celular. Lógica pura sobre um
// "storage" (localStorage), sem DOM.
//
// localStorage, chave CHAVE_COLECAO:
//   { TAT01: { descobertoEm: '2026-09-18T12:00:00.000Z', partidas: 3, vitorias: 2, fundador: 3 }, ... }
// fundador só existe nas peças da primeira leva (etiqueta com &f=N, N de 1 a 10).

import { CRIATURAS, RIVAL, SERIE_ATUAL, buscarCriatura } from './criaturas.js?v=16';

export const CHAVE_COLECAO = 'bichinhos:colecao';

// Numeração das peças fundadoras: ?b=TAT01&f=3 → "Fundador #3".
export const FUNDADOR_MIN = 1;
export const FUNDADOR_MAX = 10;

// Número do fundador (1 a 10) a partir do texto da URL, ou null se não for
// um inteiro nessa faixa ("3" vale; "03", "3.5", "11", "abc" e vazio não).
export function lerFundador(valor) {
  if (typeof valor === 'number') return Number.isInteger(valor) && valor >= FUNDADOR_MIN && valor <= FUNDADOR_MAX ? valor : null;
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor.trim())) return null;
  const n = Number(valor.trim());
  return n >= FUNDADOR_MIN && n <= FUNDADOR_MAX ? n : null;
}

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
      const fundador = lerFundador(item.fundador);
      if (fundador !== null) limpa[codigo].fundador = fundador;
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

// Registra a criatura (só se o código existir). Devolve { nova, criatura, colecao, ganhouSelo }:
// nova = true na primeira vez. Código inválido: { nova: false, criatura: null }.
// fundadorBruto: o &f= da etiqueta. Válido (1 a 10), a carta guarda o número;
// inválido é ignorado. Quem já estava na coleção sem selo ganha o selo agora
// (ganhouSelo = true); quem já tem selo fica com o primeiro número.
export function registrarDescoberta(storage, codigoBruto, agora = new Date(), fundadorBruto = null) {
  const criatura = buscarCriatura(String(codigoBruto ?? ''));
  if (!criatura) return { nova: false, criatura: null, colecao: lerColecao(storage), ganhouSelo: false };
  const colecao = lerColecao(storage) ?? {};
  const fundador = lerFundador(fundadorBruto);
  const nova = !colecao[criatura.codigo];
  let ganhouSelo = false;
  if (nova) {
    colecao[criatura.codigo] = { descobertoEm: new Date(agora).toISOString(), partidas: 0, vitorias: 0 };
  }
  if (fundador !== null && colecao[criatura.codigo].fundador === undefined) {
    colecao[criatura.codigo].fundador = fundador;
    ganhouSelo = true;
  }
  if (nova || ganhouSelo) gravarColecao(storage, colecao);
  return { nova, criatura, colecao, ganhouSelo };
}

export function estaDescoberta(colecao, codigo) {
  return Boolean(colecao && colecao[codigo]);
}

export function contarDescobertos(colecao) {
  return colecao ? Object.keys(colecao).length : 0;
}

// Contador da série disponível: { descobertos, total } só dos bichinhos da série.
export function contarDaSerie(colecao, serie, criaturas = CRIATURAS) {
  const daSerie = criaturas.filter((c) => c.serie === serie);
  return {
    descobertos: daSerie.filter((c) => estaDescoberta(colecao, c.codigo)).length,
    total: daSerie.length,
  };
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

// Lista manual (tela de escolha e "Não tenho a segunda peça"). Devolve
// { itens, temPeca }, na ordem da tela:
//   { tipo: 'bicho', criatura }   — já escaneado (qualquer série)
//   { tipo: 'rival', criatura }   — o Rato do Mato (comRival = false tira)
//   { tipo: 'em-breve', serie }   — série futura ainda não escaneada: sem nome nem números
// Bichinho da série atual ainda não escaneado não aparece. Quem não escaneou
// nada vê só o Rato (temPeca = false; a tela pede para escanear a peça).
// Sem storage (colecao null) vale como coleção vazia.
export function listaDeEscolha(colecao, { comRival = true, criaturas = CRIATURAS, serieAtual = SERIE_ATUAL, rival = RIVAL } = {}) {
  const bichos = criaturas.filter((c) => estaDescoberta(colecao, c.codigo)).map((criatura) => ({ tipo: 'bicho', criatura }));
  const temPeca = bichos.length > 0;
  const emBreve = temPeca
    ? criaturas.filter((c) => c.serie > serieAtual && !estaDescoberta(colecao, c.codigo)).map((c) => ({ tipo: 'em-breve', serie: c.serie }))
    : [];
  return { itens: [...bichos, ...(comRival ? [{ tipo: 'rival', criatura: rival }] : []), ...emBreve], temPeca };
}
