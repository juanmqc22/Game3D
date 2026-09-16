// Ícones SVG inline — único lugar onde as formas vivem.
// As formas dos quatro símbolos devem ser as mesmas gravadas na peça física:
// se a gravação mudar, ajuste só o desenho aqui.
//
// Cada função devolve uma string SVG (conteúdo fixo, sem dados do usuário).
// Todos usam viewBox 0 0 24 24 e `currentColor`, então a cor vem do CSS.

function svg(conteudo, classe = '') {
  return `<svg class="icone ${classe}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${conteudo}</svg>`;
}

// ATAQUE — três riscos de garra
export function iconeAtaque() {
  return svg(
    '<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">'
    + '<path d="M10 2.5Q8.6 12 3 20.5"/>'
    + '<path d="M15.5 3Q14.1 12.5 8.5 21.5"/>'
    + '<path d="M21 3.5Q19.6 13 14 21.5"/>'
    + '</g>',
    'icone-ataque',
  );
}

// DEFESA — escudo
export function iconeDefesa() {
  return svg(
    '<path fill="currentColor" d="M12 1.8 20.5 5v6.2c0 5.4-3.5 9.4-8.5 11-5-1.6-8.5-5.6-8.5-11V5z"/>',
    'icone-defesa',
  );
}

// ESPECIAL — estrela de cinco pontas
export function iconeEspecial() {
  return svg(
    '<path fill="currentColor" d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.2L12 17.6l-6.4 3.6L7 14l-5.3-5 7.2-.9z"/>',
    'icone-especial',
  );
}

// TROPECO — X
export function iconeTropeco() {
  return svg(
    '<path fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" d="M5 5l14 14M19 5 5 19"/>',
    'icone-tropeco',
  );
}

const POR_SIMBOLO = {
  ATAQUE: iconeAtaque,
  DEFESA: iconeDefesa,
  ESPECIAL: iconeEspecial,
  TROPECO: iconeTropeco,
};

export function iconeSimbolo(simbolo) {
  return POR_SIMBOLO[simbolo]();
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
