// Partida guardada no aparelho (sem DOM; storage injetado para testar).
//
// `raposa:ativa` é a flag que a raiz do site lê (js/desvio-raposa.js) para mandar
// a etiqueta NFC para cá. Ela é renovada a cada jogada e vale 6 h.

export const CHAVE_ATIVA = 'raposa:ativa';
export const CHAVE_PARTIDA = 'raposa:partida';
export const VALIDADE_MS = 6 * 60 * 60 * 1000;

export function salvar(storage, dados, agora = Date.now()) {
  try {
    storage.setItem(CHAVE_PARTIDA, JSON.stringify({ em: agora, dados }));
    storage.setItem(CHAVE_ATIVA, JSON.stringify({ expira: agora + VALIDADE_MS }));
    return true;
  } catch {
    return false;
  }
}

export function carregar(storage, agora = Date.now()) {
  try {
    const bruto = JSON.parse(storage.getItem(CHAVE_PARTIDA));
    if (!bruto || typeof bruto.em !== 'number' || !bruto.dados) return null;
    if (agora - bruto.em >= VALIDADE_MS) {
      limpar(storage);
      return null;
    }
    return bruto.dados;
  } catch {
    return null;
  }
}

// Fim de partida ou "sair": a raiz volta a ser só das crianças.
export function limpar(storage) {
  try {
    storage.removeItem(CHAVE_PARTIDA);
    storage.removeItem(CHAVE_ATIVA);
  } catch {
    // nada a fazer
  }
}

export function codigoDaUrl(busca) {
  const b = new URLSearchParams(busca || '').get('b');
  if (!b) return null;
  const c = b.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{3}\d{2}$/.test(c) ? c : null;
}
