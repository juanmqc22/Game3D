// Desvio da etiqueta NFC para a Raposa na Fazenda (jogo adulto em /raposa/).
//
// As etiquetas apontam para /?b=CODIGO (jogo das crianças). Se houver uma partida
// da Raposa ativa (localStorage `raposa:ativa`, expira em 6 h), a raiz manda para
// raposa/?b=CODIGO. Sem partida ativa, não faz nada.
//
// Script clássico (não é módulo) carregado antes de js/app.js: roda primeiro e,
// ao desviar, tira o ?b= da barra antes de o app das crianças ler a URL — assim a
// peça não entra na coleção nem no escaneio delas. Coberto por test/raposa-desvio.test.js.
(function (raiz) {
  var CHAVE = 'raposa:ativa';

  function destino(busca, flag, agora) {
    var m = /[?&]b=([^&#]*)/.exec(busca || '');
    if (!m || !m[1]) return null;
    var expira;
    try { expira = JSON.parse(flag).expira; } catch (e) { return null; }
    if (typeof expira !== 'number' || !(agora < expira)) return null;
    return 'raposa/?b=' + m[1];
  }

  raiz.destinoDesvioRaposa = destino;
  raiz.CHAVE_RAPOSA_ATIVA = CHAVE;
  if (typeof window === 'undefined' || !window.location) return;
  try {
    var alvo = destino(window.location.search, window.localStorage.getItem(CHAVE), Date.now());
    if (!alvo) return;
    window.history.replaceState(null, '', window.location.pathname);
    window.location.replace(alvo);
  } catch (e) {
    // storage bloqueado ou sem history: segue o jogo das crianças normalmente
  }
})(globalThis);
