// Loop de escaneio de duas peças no mesmo celular. Lógica pura: recebe o
// "storage" (sessionStorage) e o relógio, não toca no DOM.
//
// Estado de espera em sessionStorage, chave CHAVE_AGUARDANDO:
//   { codigo: 'TAT01', em: 1700000000000 }   (em = Date.now() do primeiro scan)
// Expira em EXPIRACAO_MS. sessionStorage vale por aba: as duas peças precisam
// ser abertas na mesma aba. Se o leitor de QR do celular abrir uma aba nova a
// cada leitura, troque `window.sessionStorage` por `window.localStorage` em
// js/app.js (a expiração de 10 minutos continua protegendo).

import { buscarCriatura } from './criaturas.js?v=10';

export const CHAVE_AGUARDANDO = 'bichinhos:aguardando';
export const EXPIRACAO_MS = 10 * 60 * 1000;

// Devolve { codigo, em } ou null (nada, expirado ou inválido — nesses casos limpa).
export function lerAguardando(storage, agora = Date.now()) {
  let bruto = null;
  try {
    bruto = storage.getItem(CHAVE_AGUARDANDO);
  } catch {
    return null;
  }
  if (!bruto) return null;
  let dados = null;
  try {
    dados = JSON.parse(bruto);
  } catch {
    dados = null;
  }
  const valido = dados && typeof dados === 'object'
    && buscarCriatura(dados.codigo) !== null
    && Number.isFinite(dados.em)
    && agora - dados.em >= 0
    && agora - dados.em < EXPIRACAO_MS;
  if (!valido) {
    limparAguardando(storage);
    return null;
  }
  return { codigo: buscarCriatura(dados.codigo).codigo, em: dados.em };
}

export function guardarAguardando(storage, codigo, agora = Date.now()) {
  try {
    storage.setItem(CHAVE_AGUARDANDO, JSON.stringify({ codigo, em: agora }));
    return true;
  } catch {
    return false;
  }
}

export function limparAguardando(storage) {
  try {
    storage.removeItem(CHAVE_AGUARDANDO);
  } catch {
    // storage indisponível: não há o que limpar
  }
}

// Processa a chegada em ?b=codigo. Devolve um destes:
//   { tipo: 'sem-codigo' }                                  — URL sem ?b=
//   { tipo: 'invalido', codigo }                            — código desconhecido (nada é gravado)
//   { tipo: 'aguardando', criatura }                        — virou Jogador 1, esperando o segundo
//   { tipo: 'repetido', criatura }                          — mesma peça de novo; continua esperando
//   { tipo: 'partida', criaturas: [jogador1, jogador2] }    — segunda peça chegou, estado limpo
export function processarChegada(codigoBruto, storage, agora = Date.now()) {
  if (codigoBruto === null || codigoBruto === undefined) return { tipo: 'sem-codigo' };
  const criatura = buscarCriatura(String(codigoBruto));
  if (!criatura) return { tipo: 'invalido', codigo: String(codigoBruto).trim().slice(0, 12).toUpperCase() };

  const aguardando = lerAguardando(storage, agora);
  if (!aguardando) {
    guardarAguardando(storage, criatura.codigo, agora);
    return { tipo: 'aguardando', criatura };
  }
  if (aguardando.codigo === criatura.codigo) {
    return { tipo: 'repetido', criatura };
  }
  limparAguardando(storage);
  return { tipo: 'partida', criaturas: [buscarCriatura(aguardando.codigo), criatura] };
}
