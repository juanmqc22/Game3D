// Loop de escaneio de duas peças no mesmo celular. Lógica pura: recebe o
// "storage" (localStorage) e o relógio, não toca no DOM.
//
// Estado de espera em localStorage, chave CHAVE_AGUARDANDO:
//   { codigo: 'TAT01', em: 1700000000000 }   (em = Date.now() do primeiro scan)
// Expira em EXPIRACAO_MS. É localStorage (e não sessionStorage) porque o iPhone
// abre uma aba nova a cada leitura de NFC ou QR: a espera tem que valer entre
// abas. A expiração de 10 minutos impede que uma peça esquecida vire Jogador 1
// da próxima brincadeira.

import { buscarCriatura } from './criaturas.js?v=13';

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
//   { tipo: 'partida', criaturas: [jogador1, jogador2] }    — segunda peça chegou; a espera é
//                                                             limpa, a próxima leitura começa outro ciclo
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

// Código da peça a partir do endereço gravado na etiqueta (NFC) ou no QR:
// "https://.../Game3D/?b=TAT01&f=3", "/?b=sap02", "?b=TAT01". Devolve o valor
// bruto do ?b= (quem valida é processarChegada) ou null se não houver ?b=.
export function codigoDaUrl(texto) {
  if (typeof texto !== 'string') return null;
  const m = /[?&]b=([^&#]*)/.exec(texto);
  if (!m) return null;
  let valor = m[1].replace(/\+/g, ' ');
  try {
    valor = decodeURIComponent(valor);
  } catch {
    // %xx quebrado: fica o texto como veio
  }
  return valor.trim() ? valor : null;
}

// Mesma ideia para o selo de Fundador (&f=3): devolve o texto bruto ou null.
export function fundadorDaUrl(texto) {
  if (typeof texto !== 'string') return null;
  const m = /[?&]f=([^&#]*)/.exec(texto);
  return m ? m[1] : null;
}

// Web NFC (Android/Chrome): acha o endereço nos registros da etiqueta.
// registros: message.records do evento "reading" do NDEFReader, cada um com
// { recordType, data (DataView), encoding }. Aceita registro "url" e
// "absolute-url"; "text" também, para etiquetas gravadas como texto.
// Devolve { codigo, fundador } do primeiro registro com ?b=, ou null.
export function lerRegistrosNfc(registros) {
  for (const r of registros ?? []) {
    if (!r || !['url', 'absolute-url', 'text'].includes(r.recordType)) continue;
    let texto = null;
    try {
      texto = typeof r.data === 'string' ? r.data : new TextDecoder(r.encoding || 'utf-8').decode(r.data);
    } catch {
      continue;
    }
    const codigo = codigoDaUrl(texto);
    if (codigo !== null) return { codigo, fundador: fundadorDaUrl(texto) };
  }
  return null;
}
