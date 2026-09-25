// Arte dos bichinhos: o único mapa código → imagem.
//
// Para dar arte a um bichinho novo:
//   1. coloque o original em img/originais/CODIGO.png (ou .webp), fundo transparente;
//   2. rode `npm run arte` (gera img/criaturas/CODIGO-512.webp e -256.webp);
//   3. acrescente uma linha aqui: CODIGO: 'Descrição curta da arte',
//
// Quem não está aqui continua com a silhueta desenhada (js/icones.js).
const ARTE = {
  TAT01: 'tatu marrom de casco listrado, punhos erguidos',
  SAP02: 'sapo verde sorridente, punhos erguidos',
  RAT00: 'rato cinza de pião, punhos erguidos e curativo na bochecha',
};

// Resolvido a partir deste arquivo: vale tanto na raiz quanto em raposa/.
const pasta = (codigo, tamanho) => new URL(`../img/criaturas/${codigo}-${tamanho}.webp`, import.meta.url).href;

// { src, srcset } para <img>, ou null se o bichinho ainda não tem arte.
// src é a de 256 (lugares pequenos); srcset deixa o navegador pegar a de 512
// quando a imagem for grande ou a tela tiver alta densidade.
export function arteDaCriatura(codigo) {
  if (!Object.prototype.hasOwnProperty.call(ARTE, codigo)) return null;
  return {
    src: pasta(codigo, 256),
    srcset: `${pasta(codigo, 256)} 256w, ${pasta(codigo, 512)} 512w`,
    descricao: ARTE[codigo],
  };
}

export const CODIGOS_COM_ARTE = Object.keys(ARTE);
