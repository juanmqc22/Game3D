// Contraste da paleta da Raposa na Fazenda (WCAG 2.1). Node puro.
//   node scripts/raposa-contraste.js
// Os valores têm que bater com raposa/css/raposa.css. Alvo: 4.5:1 em todo texto.
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const razao = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const P = {
  fundo: '#f7e9cf', cartao: '#fffaf0', tinta: '#3b2a1e', suave: '#6b4f3a',
  celeiro: '#a83c29', textoBotao: '#fffaf0', trigo: '#e9b949', trigoClaro: '#fbe6ad',
  campo: '#3f6628', campoClaro: '#dcebc8', ruim: '#9c2f1f', ruimClaro: '#fbe0d6',
  noiteCartao: '#283052', textoNoite: '#fff4d6', derrota: '#3a1510', laranja: '#ffb27a',
  desabFundo: '#ece3d3', desabTexto: '#5c5047', placeholder: '#6b5d52', discretoNoite: '#d8c7a6',
};
const pares = [
  ['tinta / fundo', P.tinta, P.fundo], ['tinta / cartao', P.tinta, P.cartao],
  ['suave / fundo', P.suave, P.fundo], ['suave / cartao', P.suave, P.cartao],
  ['textoBotao / celeiro', P.textoBotao, P.celeiro], ['tinta / trigo', P.tinta, P.trigo],
  ['tinta / trigoClaro', P.tinta, P.trigoClaro], ['tinta / campoClaro', P.tinta, P.campoClaro],
  ['tinta / ruimClaro', P.tinta, P.ruimClaro], ['campo / cartao', P.campo, P.cartao],
  ['campo / fundo', P.campo, P.fundo], ['ruim / cartao', P.ruim, P.cartao],
  ['textoBotao / ruim', P.textoBotao, P.ruim], ['trigo / tinta (capa)', P.trigo, P.tinta],
  ['textoNoite / tinta (capa)', P.textoNoite, P.tinta], ['textoNoite / noiteCartao', P.textoNoite, P.noiteCartao],
  ['textoNoite / derrota', P.textoNoite, P.derrota], ['laranja / derrota', P.laranja, P.derrota],
  ['desabTexto / desabFundo', P.desabTexto, P.desabFundo], ['placeholder / branco', P.placeholder, '#ffffff'],
  ['discretoNoite(borda) / noiteCartao', P.discretoNoite, P.noiteCartao],
];
let falhas = 0;
for (const [nome, a, b] of pares) {
  const r = razao(a, b);
  const ok = r >= 4.5;
  if (!ok) falhas++;
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${r.toFixed(2).padStart(5)}:1  ${nome}`);
}
process.exitCode = falhas ? 1 : 0;
