// Verificador de contraste da paleta (WCAG 2.1). Node puro, sem dependência.
//   node scripts/contraste.js
// Os valores aqui têm que bater com os de :root em css/estilo.css. O alvo é
// 4.5:1 em todo texto — o jogo é usado em pé, sob sol forte.
// WCAG 2.1 relative luminance / contrast ratio
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
export const razao = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const P = {
  chassi: '#e4eaf0', chassiAlt: '#d7dfe8', superficie: '#ffffff', superficie2: '#f3f6fa',
  tinta: '#0a1120', tintaMedia: '#404c60', leitura: '#0b1322', leituraTexto: '#ffffff',
  sistema: '#0b5f7a', sistemaNeon: '#3ae1ff',
  ataque: '#127a33', defesa: '#1746c8', especial: '#f6c50b', especialTinta: '#1a1400', tropeco: '#8a2bc4',
  perigo: '#c41f1f', escudo: '#1746c8', cura: '#127a33', ouro: '#765a00',
  tatu: '#95470b', sapo: '#0b6b62',
  vidaAlta: '#2ecc5a', vidaMedia: '#f6c50b', vidaBaixa: '#ff4d4d',
};
const pares = [
  ['tinta / chassi', P.tinta, P.chassi], ['tinta / chassiAlt', P.tinta, P.chassiAlt],
  ['tinta / superficie', P.tinta, P.superficie], ['tinta / superficie2', P.tinta, P.superficie2],
  ['tintaMedia / chassi', P.tintaMedia, P.chassi], ['tintaMedia / superficie', P.tintaMedia, P.superficie],
  ['tintaMedia / superficie2', P.tintaMedia, P.superficie2],
  ['sistema / chassi', P.sistema, P.chassi], ['sistema / superficie', P.sistema, P.superficie],
  ['perigo / superficie', P.perigo, P.superficie], ['perigo / chassi', P.perigo, P.chassi],
  ['escudo / superficie', P.escudo, P.superficie],
  ['ouro / superficie', P.ouro, P.superficie], ['ouro / chassi', P.ouro, P.chassi],
  ['branco / ataque', '#fff', P.ataque], ['branco / defesa', '#fff', P.defesa],
  ['branco / tropeco', '#fff', P.tropeco], ['branco / perigo', '#fff', P.perigo],
  ['branco / tatu', '#fff', P.tatu], ['branco / sapo', '#fff', P.sapo],
  ['especialTinta / especial', P.especialTinta, P.especial],
  ['leituraTexto / leitura', P.leituraTexto, P.leitura],
  ['sistemaNeon / leitura', P.sistemaNeon, P.leitura],
  ['vidaAlta / leitura', P.vidaAlta, P.leitura], ['vidaBaixa / leitura', P.vidaBaixa, P.leitura],
  ['tatu / superficie', P.tatu, P.superficie], ['sapo / superficie', P.sapo, P.superficie],
];
let ruins = 0;
for (const [nome, a, b] of pares) {
  const r = razao(a, b);
  const ok = r >= 4.5;
  if (!ok) ruins++;
  console.log(`${ok ? 'ok  ' : 'BAIXO'} ${nome.padEnd(26)} ${r.toFixed(2)}:1`);
}
console.log(ruins ? `\n${ruins} par(es) abaixo de 4.5:1` : '\nTodos >= 4.5:1');
