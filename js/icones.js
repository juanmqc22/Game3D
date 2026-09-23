// Ícones SVG inline — único lugar onde as formas vivem.
// As formas dos quatro símbolos devem ser as mesmas gravadas na peça física:
// se a gravação mudar, ajuste só o desenho aqui.
//
// Cada função devolve uma string SVG (conteúdo fixo, sem dados do usuário).
// Todos usam viewBox 0 0 24 24 e `currentColor`, então a cor vem do CSS.

function svg(conteudo, classe = '') {
  return `<svg class="icone ${classe}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${conteudo}</svg>`;
}

// Desenho de cada símbolo, sem o <svg> em volta: a mesma forma serve para o
// ícone solto e para a gravação no peito do bichinho (iconeBichinho).
const FORMA = {
  // ATAQUE — três riscos de garra
  ATAQUE:
    '<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">'
    + '<path d="M10 2.5Q8.6 12 3 20.5"/>'
    + '<path d="M15.5 3Q14.1 12.5 8.5 21.5"/>'
    + '<path d="M21 3.5Q19.6 13 14 21.5"/>'
    + '</g>',
  // DEFESA — escudo
  DEFESA: '<path fill="currentColor" d="M12 1.8 20.5 5v6.2c0 5.4-3.5 9.4-8.5 11-5-1.6-8.5-5.6-8.5-11V5z"/>',
  // ESPECIAL — estrela de cinco pontas
  ESPECIAL: '<path fill="currentColor" d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.2L12 17.6l-6.4 3.6L7 14l-5.3-5 7.2-.9z"/>',
  // TROPECO — X
  TROPECO: '<path fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" d="M5 5l14 14M19 5 5 19"/>',
};

export function iconeAtaque() { return svg(FORMA.ATAQUE, 'icone-ataque'); }
export function iconeDefesa() { return svg(FORMA.DEFESA, 'icone-defesa'); }
export function iconeEspecial() { return svg(FORMA.ESPECIAL, 'icone-especial'); }
export function iconeTropeco() { return svg(FORMA.TROPECO, 'icone-tropeco'); }

export function iconeSimbolo(simbolo) {
  return svg(FORMA[simbolo], `icone-${String(simbolo).toLowerCase()}`);
}

// ---------- o bichinho ----------
//
// Mesma silhueta da peça impressa: ponta em cima, antena, olhos grandes, ponta
// embaixo — e o símbolo que saiu gravado no peito, como na peça de verdade.
// viewBox 0 0 64 120 (mais alto que largo). Altura e cor vêm do CSS.

// Rosto por espécie. Espécie sem rosto próprio cai no padrão.
const ROSTOS = {
  // Tatu: focinho achatado com duas narinas, entre as orelhas redondas.
  tatu:
    '<g class="bicho-traco">'
    + '<ellipse cx="15" cy="66" rx="7" ry="5"/><ellipse cx="49" cy="66" rx="7" ry="5"/>'
    + '<path d="M25 59h14l4 14H21z"/>'
    + '</g>'
    + '<circle class="bicho-furo" cx="29" cy="67" r="1.8"/>'
    + '<circle class="bicho-furo" cx="35" cy="67" r="1.8"/>',
  // Sapo: bocão largo de canto a canto.
  sapo: '<path class="bicho-traco" d="M17 60q15 14 30 0v4q-15 14-30 0z"/>',
};
const ROSTO_PADRAO = '<path class="bicho-traco" d="M23 63h18v5H23z"/>';

// Peito: um dos quatro símbolos, a placa vazia esperando o arremesso ('VAZIO'),
// ou nada (null) quando é só o retrato do bichinho.
export function iconeBichinho(especie, simbolo = null) {
  const forma = FORMA[simbolo];
  let peito = '';
  if (forma) {
    peito = `<g class="bicho-simbolo" data-simbolo="${simbolo}">`
      + '<rect class="bicho-placa" x="17" y="74" width="30" height="30" rx="9"/>'
      + `<g transform="translate(19.4 76.4) scale(1.05)">${forma}</g>`
      + '</g>';
  } else if (simbolo === 'VAZIO') {
    peito = '<rect class="bicho-placa bicho-placa-vazia" x="17" y="74" width="30" height="30" rx="9"/>';
  }
  return '<svg class="icone bichinho" viewBox="0 0 64 120" aria-hidden="true" focusable="false">'
    + '<path class="bicho-antena" d="M32 4v12" stroke="currentColor" stroke-width="7" stroke-linecap="round" fill="none"/>'
    + '<path class="bicho-casco" fill="currentColor" d="M32 12 56 30v70L32 118 8 100V30z"/>'
    + '<circle cx="22" cy="46" r="9.5" fill="#fff"/><circle cx="42" cy="46" r="9.5" fill="#fff"/>'
    + '<circle class="bicho-pupila" cx="23.5" cy="46" r="4.2"/><circle class="bicho-pupila" cx="40.5" cy="46" r="4.2"/>'
    + (ROSTOS[especie] ?? ROSTO_PADRAO)
    + peito
    + '</svg>';
}

// Escudo ativo (Bola de Ferro): escudo com a bola no meio.
// Diferente do ícone de DEFESA, que é o escudo liso.
export function iconeEscudoAtivo() {
  return svg(
    '<path fill="currentColor" d="M12 1.8 20.5 5v6.2c0 5.4-3.5 9.4-8.5 11-5-1.6-8.5-5.6-8.5-11V5z"/>'
    + '<circle cx="12" cy="11" r="4.2" fill="#fff"/>'
    + '<circle cx="12" cy="11" r="2.4" fill="currentColor"/>',
    'icone-escudo-ativo',
  );
}

export function iconeVida() {
  return svg(
    '<path fill="currentColor" d="M12 21s-8.5-5.3-8.5-11.2A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 3.2C20.5 15.7 12 21 12 21z"/>',
    'icone-vida',
  );
}

// Vida perdida — o mesmo coração de iconeVida, rachado no meio.
export function iconeVidaPerdida() {
  return svg(
    '<path fill="currentColor" d="M12 21s-8.5-5.3-8.5-11.2A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 3.2C20.5 15.7 12 21 12 21z"/>'
    + '<path fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round" d="M12 6.6 9.8 11h4.4L11.5 16"/>',
    'icone-vida-perdida',
  );
}

export function iconeTrofeu() {
  return svg(
    '<path fill="currentColor" d="M7 2h10v2h4v3a5 5 0 0 1-4.6 5A6 6 0 0 1 13 15.9V18h3.5v3h-9v-3H11v-2.1A6 6 0 0 1 7.6 12 5 5 0 0 1 3 7V4h4zm0 4H5v1a3 3 0 0 0 2 2.8zm10 0v3.8A3 3 0 0 0 19 7V6z"/>',
    'icone-trofeu',
  );
}

// Empate — dois traços iguais
export function iconeEmpate() {
  return svg(
    '<path fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" d="M5 8.5h14M5 15.5h14"/>',
    'icone-empate',
  );
}

// ---------- modos de jogo ----------

// ROLAR — a peça (dado alongado) rolando
export function iconeRolar() {
  return svg(
    '<rect x="3" y="6" width="18" height="12" rx="4" fill="none" stroke="currentColor" stroke-width="2.6"/>'
    + '<circle cx="8.5" cy="12" r="1.8" fill="currentColor"/>'
    + '<circle cx="15.5" cy="12" r="1.8" fill="currentColor"/>',
    'icone-rolar',
  );
}

// ARENA — o círculo no chão
export function iconeArena() {
  return svg(
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.8"/>'
    + '<circle cx="9" cy="13" r="2.2" fill="currentColor"/>'
    + '<circle cx="15" cy="10.5" r="2.2" fill="currentColor"/>',
    'icone-arena',
  );
}

// MIRA — alvo de círculos concêntricos
export function iconeAlvo() {
  return svg(
    '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.4"/>'
    + '<circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="2.4"/>'
    + '<circle cx="12" cy="12" r="1.9" fill="currentColor"/>',
    'icone-alvo',
  );
}

// ARENA: peça que ficou dentro do círculo
export function iconeDentro() {
  return svg(
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.6"/>'
    + '<circle cx="12" cy="12" r="3.4" fill="currentColor"/>',
    'icone-dentro',
  );
}

// ARENA: peça que ficou fora do círculo
export function iconeFora() {
  return svg(
    '<circle cx="10" cy="14" r="7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-dasharray="4 3"/>'
    + '<circle cx="19" cy="5.5" r="3.2" fill="currentColor"/>',
    'icone-fora',
  );
}

// Erro (alvo) — X pequeno
export function iconeErrou() {
  return svg(
    '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.4"/>'
    + '<path fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>',
    'icone-errou',
  );
}

// Coleção: bichinho ainda não descoberto
export function iconeMisterio() {
  return svg(
    '<path fill="currentColor" d="M12 2.5c-4.4 0-7.5 3-7.5 6.6 0 1.8.8 3.3 2 4.4-.6 1.6-1.9 2.6-3.4 3.2 2.8.5 5-.3 6.4-1.6.8.2 1.6.3 2.5.3 4.4 0 7.5-3 7.5-6.6S16.4 2.5 12 2.5z"/>'
    + '<text x="12" y="12.8" text-anchor="middle" font-size="11.5" font-weight="900" fill="#fff" font-family="system-ui, sans-serif">?</text>',
    'icone-misterio',
  );
}

// Coleção: QR (escaneie a peça)
export function iconeQr() {
  return svg(
    '<g fill="none" stroke="currentColor" stroke-width="2.4">'
    + '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>'
    + '</g>'
    + '<path fill="currentColor" d="M5.5 5.5h2v2h-2zM16.5 5.5h2v2h-2zM5.5 16.5h2v2h-2zM14 14h2.5v2.5H14zM18.5 14H21v2.5h-2.5zM14 18.5h2.5V21H14zM18.5 18.5H21V21h-2.5z"/>',
    'icone-qr',
  );
}
