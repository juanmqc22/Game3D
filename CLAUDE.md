# Arena dos Bichinhos — v1

Página web estática, mobile-first, que serve de **árbitro** para batalhas entre
bichinhos colecionáveis impressos em 3D. Cada peça é um "dado de 4 faces"
(ATAQUE, DEFESA, ESPECIAL, TROPECO): a criança arremessa a peça e toca no celular
o símbolo que saiu. O app guarda a vida, resolve a rodada e diz quem ganhou.
**Nenhuma aleatoriedade vem do software** — o acaso é o arremesso.

Público: crianças de 6 a 12 anos, 2 jogadores, um único celular, sem internet
depois de carregada. Cada peça tem um código (ex: `TAT01`); o QR da peça abre
`?b=TAT01`. Escanear duas peças em sequência na mesma aba monta a partida
(`js/escaneio.js`); cada código escaneado entra na coleção (`js/colecao.js`).

## Modos de jogo (fonte da verdade: `js/regras.js`)

- **Rolar** (clássico): as regras abaixo.
- **Arena**: os dois dentro do círculo → igual ao Rolar. Só um dentro → ele
  vence, a face não importa, o outro leva `forca + BONUS_FORA` (1). Nenhum
  dentro → rodada nula. Escudo continua valendo.
- **Mira**: igual ao Rolar; vencedor acertou o alvo → `+BONUS_ACERTO` (2), que
  **não soma** com o +2 do tropeço (extra máximo da rodada é +2); errou → dano
  pela metade, arredondado para baixo. Cura, recuo e escudo não mudam.

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
js/regras.js                lógica pura dos 3 modos (sem DOM, sem estado global)
js/escaneio.js              loop de escaneio (sessionStorage `bichinhos:aguardando`, 10 min), puro
js/colecao.js               coleção (localStorage `bichinhos:colecao`), puro
js/app.js                   UI, navegação, animações, deep link ?b=, modos
js/icones.js                SVGs dos 4 símbolos (mesma forma da peça) e ícones da UI
test/regras.test.js         regras do modo Rolar (node:test)
test/modos.test.js          Arena e Mira
test/escaneio.test.js       loop de escaneio
test/colecao.test.js        coleção
test/criaturas.test.js      dados + guarda-corpo de golpe máximo nos 3 modos
scripts/balanceamento.js    simulação dos confrontos (não é teste); --modo e --chance
scripts/contraste.js        confere a paleta do CSS (WCAG); node puro, sem dependência
serve.json                  config do `npx serve`: cleanUrls=false (senão perde o ?b=) + raiz -> index.html
```

Deep link do QR (forma curta, preferida): `https://juanmqc22.github.io/Game3D/?b=TAT01`.
Todo caminho em index.html e nos imports é relativo — o Pages serve em /Game3D/.

**Cache (Pages usa max-age=600):** ao mudar qualquer `.js`, `estilo.css` ou a estrutura do
`index.html`, aumente o `?v=N` em `index.html` (CSS e app.js), nos imports do topo de
`js/app.js` **e** nos imports de `js/escaneio.js` e `js/colecao.js`. Sem isso o celular
mistura HTML novo com JS antigo e trava. Mudar só `criaturas.js` não exige (no pior caso o
bichinho novo aparece ~10 min depois).

## Sistema visual

Direção: **instrumento de batalha em luz do dia** — chassi claro de alto
contraste, com o preto reservado aos visores (vida, chips, placas). O jogo é
usado em pé, sob sol forte: tema escuro perde porque o reflexo domina a luz
emitida. Detalhes e números medidos em ENTREGA.md.

Regras que não podem regredir:

- **Contraste >= 4.5:1 em todo texto.** Confira com `node scripts/contraste.js`
  ao mexer em `:root`. Nunca use `opacity` para marcar estado "não escolhido" ou
  "desabilitado": texto lavado some no sol. Use contorno ou cinza sólido.
- **Animar só `transform` e `opacity`.** Nada de animar width/height/top/left/
  box-shadow/filter, e nada de `backdrop-filter`. Efeitos decorativos rodam uma
  vez; loop infinito só onde é sinal de estado (vida baixa, escudo, leitura do QR).
- **Teto de 1,2s por rodada**, incluindo a latência do toque. A linha do tempo
  está em `TEMPO` no topo de `js/app.js` (hoje 1080ms internos, ~1126ms medidos).
- **`prefers-reduced-motion`** desliga tudo e a informação continua completa.
- **Alvos de toque >= 44px**; os principais em 64px (`--toque`).
- **Sem `:has()`, `color-mix()` ou `backdrop-filter`** — faltam em WebView antiga
  de Android de entrada. Precisa de estado no CSS? Ponha uma classe pelo JS.
- Validar em **360x640** além dos tamanhos grandes: sem rolagem lateral.
- A cor da espécie vem do CSS por `data-especie`; `--cor-base` (de
  `js/criaturas.js`) é o fallback de uma espécie nova.
- Efeitos por especial são mapeados por código da criatura em `css/estilo.css`;
  código desconhecido cai no efeito genérico.

## Comandos

- Testes: `node --test`
- Balanceamento: `node scripts/balanceamento.js` (faces opcionais:
  `--faces 25,25,25,25` na ordem ATAQUE,DEFESA,ESPECIAL,TROPECO; testar números
  sem editar a tabela: `--ajuste SAP06.vida=15,SAP06.recuo=1`; outros modos:
  `--modo ARENA --chance 50`)
- Guarda-corpo de bichinho novo (em `test/criaturas.test.js`): o maior dano
  possível numa rodada, em cada modo (`danoMaximoDoModo`), <= 60% da vida de
  qualquer alvo. Não afrouxar esse limite; se um modo estourar, ajuste o
  bônus do modo, nunca a tabela.
- Contraste da paleta: `node scripts/contraste.js`
- Rodar local: `npx serve`

## Restrições

- HTML + CSS + JS puro (ES modules). Sem framework, bundler ou dependências.
- A tabela de `js/criaturas.js` está balanceada e validada: não mexer.
- Fora de escopo na v1: backend, login, XP, multiplayer em rede, leitor de QR,
  animações elaboradas, PWA, sons, dark mode, i18n, admin. Perguntar antes.
