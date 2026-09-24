// Gera a arte otimizada dos bichinhos: img/originais/CODIGO.(png|webp) →
// img/criaturas/CODIGO-512.webp e CODIGO-256.webp (quadradas, fundo transparente).
//
//   npm install          (só na primeira vez: instala o sharp, dependência de dev)
//   npm run arte
//
// Depois, acrescente o código em ARTE (js/arte.js). O site não usa o sharp: ele
// só existe para este passo, e img/originais/ não vai para o Pages (_config.yml).
//
// Original sem transparência (fundo branco ou xadrez "falso" desenhado na
// imagem): o fundo claro e sem cor ligado à borda vira transparente.

import { readdir, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ORIGEM = path.join(RAIZ, 'img', 'originais');
const DESTINO = path.join(RAIZ, 'img', 'criaturas');
const TAMANHOS = [512, 256];
const LIMITE = 80 * 1024;
const MARGEM = 0.04; // folga em volta do bichinho, fração do lado

// Remove o fundo claro e neutro que toca a borda (preenchimento a partir das bordas).
function tirarFundo(dados, largura, altura) {
  const n = largura * altura;
  const fundo = new Uint8Array(n);
  const neutro = (i) => {
    const r = dados[i * 4], g = dados[i * 4 + 1], b = dados[i * 4 + 2];
    return Math.max(r, g, b) - Math.min(r, g, b) < 14 && (r + g + b) / 3 > 196;
  };
  const pilha = [];
  for (let x = 0; x < largura; x++) pilha.push(x, (altura - 1) * largura + x);
  for (let y = 0; y < altura; y++) pilha.push(y * largura, y * largura + largura - 1);
  while (pilha.length) {
    const i = pilha.pop();
    if (fundo[i] || !neutro(i)) continue;
    fundo[i] = 1;
    const x = i % largura;
    if (x > 0) pilha.push(i - 1);
    if (x < largura - 1) pilha.push(i + 1);
    if (i >= largura) pilha.push(i - largura);
    if (i < n - largura) pilha.push(i + largura);
  }
  // Borda suave: o pixel do bichinho encostado no fundo fica meio transparente.
  for (let i = 0; i < n; i++) {
    if (fundo[i]) { dados[i * 4 + 3] = 0; continue; }
    const x = i % largura;
    const vizinhos = (x > 0 && fundo[i - 1]) + (x < largura - 1 && fundo[i + 1])
      + (i >= largura && fundo[i - largura]) + (i < n - largura && fundo[i + largura]);
    if (vizinhos) dados[i * 4 + 3] = Math.round(255 * (1 - vizinhos / 5));
  }
}

async function temTransparencia(arquivo) {
  const { channels, isOpaque } = await sharp(arquivo).stats();
  return channels.length === 4 && !isOpaque;
}

async function processar(arquivo, codigo) {
  let img = sharp(arquivo).ensureAlpha();
  if (!(await temTransparencia(arquivo))) {
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    tirarFundo(data, info.width, info.height);
    img = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
    console.log(`${codigo}: original sem transparência — fundo claro da borda removido. Confira o resultado.`);
  }
  // Recorta no bichinho e centraliza num quadrado com margem.
  const { data, info } = await sharp(await img.png().toBuffer()).trim({ threshold: 1 })
    .raw().toBuffer({ resolveWithObject: true });
  const lado = Math.round(Math.max(info.width, info.height) * (1 + 2 * MARGEM));
  const quadrado = await sharp(data, { raw: info })
    .extend({
      top: Math.floor((lado - info.height) / 2), bottom: Math.ceil((lado - info.height) / 2),
      left: Math.floor((lado - info.width) / 2), right: Math.ceil((lado - info.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png().toBuffer();

  for (const t of TAMANHOS) {
    const saida = path.join(DESTINO, `${codigo}-${t}.webp`);
    let qualidade = 82;
    for (;;) {
      await sharp(quadrado).resize(t, t).webp({ quality: qualidade, alphaQuality: 90, effort: 6 }).toFile(saida);
      const { size } = await stat(saida);
      if (size <= LIMITE || qualidade <= 40) {
        console.log(`${path.relative(RAIZ, saida)}  ${(size / 1024).toFixed(1)} KB  (q${qualidade})`
          + (size > LIMITE ? '  ACIMA DE 80 KB' : ''));
        break;
      }
      qualidade -= 6;
    }
  }
}

await mkdir(DESTINO, { recursive: true });
const arquivos = (await readdir(ORIGEM)).filter((f) => /\.(png|webp)$/i.test(f));
for (const f of arquivos) {
  const codigo = path.parse(f).name.toUpperCase();
  if (!/^[A-Z]{3}\d{2}$/.test(codigo)) {
    console.log(`${f}: ignorado (o nome tem que ser o código da peça, ex: TAT01.png)`);
    continue;
  }
  await processar(path.join(ORIGEM, f), codigo);
}
