# Arena dos Bichinhos — v1

Página web estática, mobile-first, que serve de **árbitro** para batalhas entre
bichinhos colecionáveis impressos em 3D. Cada peça é um "dado de 4 faces"
(ATAQUE, DEFESA, ESPECIAL, TROPECO): a criança arremessa a peça e toca no celular
o símbolo que saiu. O app guarda a vida, resolve a rodada e diz quem ganhou.
**Nenhuma aleatoriedade vem do software** — o acaso é o arremesso.

Público: crianças de 6 a 12 anos, 2 jogadores, um único celular, sem internet
depois de carregada. Cada peça tem um código (ex: `TAT01`); o QR da peça abre
`index.html?b=TAT01`.

## Regras do jogo (resumo — fonte da verdade: `js/regras.js`)

1. Triângulo: ESPECIAL > ATAQUE > DEFESA > ESPECIAL.
2. TROPECO perde para qualquer outro símbolo.
3. Símbolos iguais (inclusive TROPECO x TROPECO): empate, ninguém perde vida.
4. Dano do vencedor: ATAQUE ou DEFESA → `forca`; ESPECIAL → efeito do especial
   (todo especial causa dano).
5. Perdedor tirou TROPECO → +2 no dano ao perdedor.
6. Perdedor com escudo → dano anulado e escudo consumido. O escudo dura até
   anular algum dano e não acumula.
7. Vida entre 0 e a vida inicial. Vence quem zerar o outro; os dois zerados na
   mesma rodada = empate.

Esclarecimentos (cobertos por teste):
- **Cura própria** (Casca Dura) sempre acontece, mesmo se o escudo do oponente
  anular o dano.
- **Roubo** (Língua Chicote) só cura se o dano passar; a cura é fixa (+3), mesmo
  quando o dano foi 5 por causa do TROPECO.
- **Recuo** (Estouro) sempre acontece, ignora escudo, e pode zerar o vencedor.
- Partida espelhada (mesmo código nos dois lados) e empates não entram no placar.

## Estrutura

```
index.html                  telas (trocadas com `hidden`)
css/estilo.css              estilo mobile-first, alvo de toque >= 64px
js/criaturas.js             dados dos bichinhos — único arquivo a editar p/ adicionar um
js/regras.js                lógica pura (sem DOM, sem estado global)
js/app.js                   UI, navegação, animações, deep link ?b=, placar em localStorage
js/icones.js                SVGs dos 4 símbolos (mesma forma da peça) e ícones da UI
test/regras.test.js         testes das regras (node:test)
scripts/balanceamento.js    simulação dos confrontos (não é teste)
serve.json                  config do `npx serve`: cleanUrls=false (senão perde o ?b=) + raiz -> index.html
```

Deep link do QR (forma curta, preferida): `https://juanmqc22.github.io/Game3D/?b=TAT01`.
Todo caminho em index.html e nos imports é relativo — o Pages serve em /Game3D/.

## Comandos

- Testes: `node --test`
- Balanceamento: `node scripts/balanceamento.js` (faces opcionais:
  `--faces 25,25,25,25` na ordem ATAQUE,DEFESA,ESPECIAL,TROPECO; testar números
  sem editar a tabela: `--ajuste SAP06.vida=15,SAP06.recuo=1`)
- Guarda-corpo de bichinho novo (em `test/criaturas.test.js`): maior dano + 2
  do TROPECO <= 60% da vida de qualquer alvo. Não afrouxar esse limite.
- Rodar local: `npx serve`

## Restrições

- HTML + CSS + JS puro (ES modules). Sem framework, bundler ou dependências.
- Fora de escopo na v1: backend, login, XP, multiplayer em rede, leitor de QR,
  animações elaboradas, PWA, sons, dark mode, i18n, admin. Perguntar antes.
