# Arena dos Bichinhos — v1

Página web estática, mobile-first, que serve de **árbitro** para batalhas entre
bichinhos colecionáveis impressos em 3D. Cada peça é um "dado de 4 faces"
(ATAQUE, DEFESA, ESPECIAL, TROPECO): a criança arremessa a peça e toca no celular
o símbolo que saiu. O app guarda a vida, resolve a rodada e diz quem ganhou.
**Nenhuma aleatoriedade vem do software** — o acaso é o arremesso.

Público: crianças de 6 a 12 anos, 2 jogadores, um único celular, sem internet
depois de carregada. Cada peça tem um código (ex: `TAT01`); o QR da peça abre
`?b=TAT01`. Escanear duas peças em sequência (mesmo em abas diferentes, como no iPhone) monta a partida
(`js/escaneio.js`); cada código escaneado entra na coleção (`js/colecao.js`).

**Rato do Mato (`RIVAL`, RAT00):** rival de treino de quem só tem uma peça — a criança
gira o próprio pião duas vezes, uma por ela e uma pelo Rato. Não tem peça: fica fora
de `CRIATURAS` (escaneio, coleção, contador, Raposa e média do elenco não o veem);
`buscarCriaturaOuRival` acha os dois. Na batalha e no VS o Rato fica sempre em cima. Alvo: cada
fundador vence o Rato 65–75% (`node scripts/balanceamento.js --rival`). A lista manual
(`listaDeEscolha`) mostra só os escaneados, o Rato e a Série 2 travada; não há sorteio.

**Segundo jogo (adulto):** Raposa na Fazenda, tudo em `raposa/` — ver `RAPOSA.md`.
A única ligação com o jogo das crianças é `js/desvio-raposa.js` (carregado antes do
app em `index.html`): só desvia `?b=` para `raposa/` com partida da Raposa ativa.

## Modos de jogo (fonte da verdade: `js/regras.js`)

- **Rolar** (clássico): as regras abaixo.
- **Arena** (na tela: **Batalha**; as peças são piões numa bandeja): sem face.
  Uma sobreposição ("QUEM GANHOU?") resolve num toque: **Girou mais** → o
  vencedor causa `forca + BONUS_GIROU` (1); **Jogou pra fora** → `forca +
  BONUS_FORA` (2); **Empate** → Choque. Nenhum especial ativa. Escudo continua
  valendo (inclusive no choque). Simulador: `--modo ARENA --girou 45 --fora 35 --empate 20`.
- **Mira**: igual ao Rolar; vencedor acertou o alvo → `+BONUS_ACERTO` (2), que
  **não soma** com o +2 do tropeço (extra máximo da rodada é +2); errou → dano
  pela metade, arredondado para baixo. Cura, recuo e escudo não mudam.

## Regras do jogo (resumo — fonte da verdade: `js/regras.js`)

1. Triângulo: ESPECIAL > ATAQUE > DEFESA > ESPECIAL.
2. TROPECO perde para qualquer outro símbolo.
3. Símbolos iguais: empate. **Choque** (`CHOQUE_DANO` = 1): com o mesmo símbolo
   dos dois lados, exceto TROPECO x TROPECO, cada um perde 1; o escudo anula o
   choque e é consumido. TROPECO x TROPECO: ninguém perde vida.
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
- **Roubo** (Língua Chicote) só cura se o dano passar; a cura é fixa (+4), mesmo
  quando o dano foi 6 por causa do TROPECO.
- **Recuo** (Estouro) sempre acontece, ignora escudo, e pode zerar o vencedor.
- Partida espelhada (mesmo código nos dois lados) e empates não entram no placar.

## Estrutura

```
index.html                  telas (trocadas com `hidden`)
css/estilo.css              estilo mobile-first, alvo de toque >= 64px
js/criaturas.js             dados dos bichinhos — único arquivo a editar p/ adicionar um; `serie` + `SERIE_ATUAL`; `RIVAL` (Rato)
js/regras.js                lógica pura dos 3 modos (sem DOM, sem estado global)
js/escaneio.js              loop de escaneio (localStorage `bichinhos:aguardando`, 10 min; vale entre abas), puro; extração do ?b= de URL/NFC
js/colecao.js               coleção (localStorage `bichinhos:colecao`), selo de Fundador (&f=1..10), contador por série, puro
js/app.js                   UI, navegação, batalha em tela dividida, luta animada, deep link ?b=, modos
js/som.js                   som gerado em código (Web Audio): efeitos, sequenciador da trilha, modo tudo/efeitos/mudo (localStorage `bichinhos:som`)
js/trilha.js                a trilha sonora como dados (melodias, acordes, arranjo, voltas da batalha), pura
js/arte.js                  mapa código → arte (img/criaturas/CODIGO-256/512.webp); quem não está nele usa a silhueta
img/criaturas/              arte publicada (WebP 256 e 512, gerada por `npm run arte`)
img/originais/              originais da arte, CODIGO.png|webp — fora do Pages (_config.yml)
scripts/arte.js             gera img/criaturas/ com sharp (única dependência, só de dev)
_config.yml                 exclusões do Jekyll/Pages (originais, node_modules, package*.json)
js/icones.js                SVGs: os 4 símbolos, o bichinho (silhueta da peça) e ícones da UI
test/regras.test.js         regras do modo Rolar (node:test)
test/modos.test.js          Arena e Mira
test/escaneio.test.js       loop de escaneio
test/colecao.test.js        coleção
test/criaturas.test.js      dados + guarda-corpo de golpe máximo nos 3 modos
test/arte.test.js           mapa de arte: código existe, arquivos existem e <= 80 KB
test/golpe.test.js          nome do golpe (golpeDaRodada)
test/som.test.js            modo do som e queda sem Web Audio
test/trilha.test.js         trilha: durações pedidas, seções bem formadas, voltas da batalha, música < efeitos
test/orientacao.test.js     nenhum texto girado, em todas as telas e estados (navegador headless; se pula sem Chrome/Edge)
test/navegador.js           apoio: servidor estático + Chrome/Edge headless via DevTools Protocol
test/rival.test.js          Rato: dados, guarda-corpo como alvo/atacante, 65–75%, lista manual
scripts/balanceamento.js    simulação dos confrontos (não é teste); --modo e --chance
scripts/contraste.js        confere a paleta do CSS (WCAG); node puro, sem dependência
js/desvio-raposa.js         desvio NFC para raposa/ (script clássico; test/raposa-desvio.test.js)
raposa/                     Raposa na Fazenda (jogo adulto) — ver RAPOSA.md
serve.json                  config do `npx serve`: cleanUrls=false (senão perde o ?b=) + raiz -> index.html
```

Deep link do QR (forma curta, preferida): `https://juanmqc22.github.io/Game3D/?b=TAT01`.
Peça fundadora: `?b=TAT01&f=3` → a carta guarda "Fundador #3" (f inteiro de 1 a 10;
inválido é ignorado). Na coleção, bichinho de série futura ainda não descoberto
aparece como "Série N — em breve", e o contador só conta a `SERIE_ATUAL`.
Todo caminho em index.html e nos imports é relativo — o Pages serve em /Game3D/.

**Cache (Pages usa max-age=600):** ao mudar qualquer `.js`, `estilo.css` ou a estrutura do
`index.html`, aumente o `?v=N` em `index.html` (CSS e app.js), nos imports do topo de
`js/app.js` **e** nos imports de `js/escaneio.js`, `js/colecao.js` e `js/som.js` (e, se mudar
`js/arte.js`, `criaturas.js` ou `icones.js`, nos imports de `raposa/js/app.js`). Sem isso o celular
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
  está em `TEMPO` no topo de `js/app.js` (hoje 1080ms internos, ~1087ms medidos).
  **Só as rodadas de especial** podem ir até **2,5 s**: a cena (`TEMPO_CENA`,
  1400ms) vem antes da luta (~2486ms medidos).
- **`prefers-reduced-motion`** desliga tudo e a informação continua completa.
- **Alvos de toque >= 44px**; os principais em 64px (`--toque`).
- **Sem `:has()`, `color-mix()` ou `backdrop-filter`** — faltam em WebView antiga
  de Android de entrada. Precisa de estado no CSS? Ponha uma classe pelo JS.
- Validar em **360x640** além dos tamanhos grandes: sem rolagem lateral.
- **Tela de VS** (`#tela-vs`, `abrirVs` em `js/app.js`): aparece sempre que a partida
  fica montada (duas peças lidas, lista manual, "Não tenho a segunda peça", contra o
  Rato), antes da escolha de modo. Diagonal com `clip-path` estático, cada metade na cor
  da espécie; ≤ 2,5 s (`TEMPO_VS`), um toque pula; movimento reduzido = parada 1,2 s.
- **Cenário por modo** (`#tela-batalha[data-modo]`, CSS/SVG estático): Rolar = terra e
  folhas, Batalha = estádio/bandeja vista de cima, Mira = gramado com alvo. Só na moldura
  e no chão sob o bichinho (`.bicho-lugar::before`) — nunca atrás de texto.
- A cor da espécie vem do CSS por `data-especie`; `--cor-base` (de
  `js/criaturas.js`) é o fallback de uma espécie nova.
- O bichinho (`iconeBichinho`) é a silhueta da peça impressa, com o símbolo da
  rodada gravado no peito. O corpo usa `--cor-corpo` da espécie (tom claro do
  plástico): espécie nova precisa de `--cor-corpo` junto de `--cor-tema`, e quem
  contém o retrato tem que carregar `data-especie`.
- **Tudo se lê de um lado só, na orientação normal do celular: nenhum texto
  gira** (nem 180°, nem inclinado). `test/orientacao.test.js` percorre todas as
  telas e estados num Chrome/Edge headless (`test/navegador.js`) e falha se algum
  elemento com texto tiver rotação ≠ 0°. Sem navegador na máquina ele se pula;
  `NAVEGADOR=/caminho` escolhe outro.
- **Batalha em tela dividida** (`#tela-batalha`): Jogador 1 na metade de cima,
  Jogador 2 embaixo, nenhuma gira. Nas duas o bichinho fica perto do meio e os
  botões perto da borda (a de cima usa `column-reverse`). A luta acontece na mesma tela (LUTAR → animação → PRÓXIMA), sem tela de
  resultado separada, e sem botão de lutar: quando os dois responderam, o
  botão do meio vira DESFAZER por 1,5 s (`ESPERA_DESFAZER`) e a rodada resolve
  sozinha; depois da animação os botões de símbolo já aceitam a próxima escolha
  (o primeiro toque começa a rodada nova). Anime `.metade-corpo` ou `.bicho-luta`,
  não a `.metade`. "Para o meio da tela" muda de sinal entre as metades
  (`sentidoDoMeio`; `quadro()` espelha as poses).
- **A luta é animada em JS** (Web Animations, `animarLuta` em `js/app.js`): o
  bote é medido na tela de verdade para os dois se chocarem de frente no meio.
  A pose final de cada papel está em `POSE` (JS) e em `.fase-final
  [data-papel]` (CSS) — mantenha os dois iguais. Sem `Element.animate`, pula
  direto para o fim.
- **A rodada é contada por desenho, não por parágrafo:** nas rodadas não existe
  VENCEU/PERDEU. As duas metades mostram o **nome do golpe** (`golpeDaRodada` em
  `js/regras.js`: GARRADA!, DEFENDEU!, TROPEÇOU!, CHOQUE!, o nome do especial,
  GIROU MAIS!, PRA FORA!) e cada uma o **número** do que aconteceu com a vida
  dela (`.numero-painel`: −3, +4, 0), mais os selos (`.etiqueta`) e no máximo
  uma `.nota`. VENCEU!/PERDEU só na tela de fim (arte grande, nome, confete). O
  texto completo continua em `#resultado-leitura` (`.so-leitor`), para leitor de
  tela — ao mexer no resultado, mantenha essa linha em dia.
- O especial tem **cena própria** (`tocarCena`, `#cena-especial`), antes da
  luta: fundo escurece, a arte entra grande, o nome aparece na faixa do meio
  e o efeito vai de um painel ao outro, por `EFEITO_ESPECIAL`
  (`data-fx`): Língua Chicote = língua rosa elástica que volta com um coração;
  Bola de Ferro = esfera cinza que cai com poeira e tremor + escudo azul;
  qualquer outro código usa a estrela genérica. Um toque pula; movimento
  reduzido vai direto ao resultado.
- Com arte, o bichinho da batalha fica grande (`.metade.tem-arte`) e reage ao
  resultado: vencedor pula, perdedor treme (≤ 0,8 s, dentro do teto da rodada).

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
- Arte de bichinho novo: `img/originais/CODIGO.png` → `npm install` (1ª vez) →
  `npm run arte` → uma linha em `ARTE` (`js/arte.js`). Aparece no desbloqueio, na
  coleção (só descobertos), na luta, no fim da partida e na montagem da Raposa.
  Original sem transparência: o script tira o fundo claro ligado à borda — confira.

## Restrições

- HTML + CSS + JS puro (ES modules). Sem framework, bundler ou dependências de
  runtime. A única dependência de dev é o `sharp`, só para `npm run arte`.
- A tabela de `js/criaturas.js` está balanceada e validada: não mexer. (Língua
  Chicote 4/4 e o Choque foram pedidos e medidos — ver ENTREGA.md.)
- Fora de escopo na v1: backend, login, XP, multiplayer em rede, leitor de QR,
  PWA, dark mode, i18n, admin. Perguntar antes.
- **Som** (`js/som.js`): só Web Audio gerado em código — nenhum arquivo de áudio,
  biblioteca ou música existente. Curto e baixo. O áudio nasce no primeiro toque
  (iPhone); sem Web Audio o botão some. Padrão: só efeitos.
- **Trilha** (`js/trilha.js`, só no modo "tudo"): tema (telas fora da batalha, ≥ 60 s
  até repetir), batalha (≥ 45 s, instrumentação muda a cada volta), estingers de VS
  (≤ 2,5 s), vitória (≤ 4 s) e derrota. Toda melodia é original: **nunca** imitar
  melodia, motivo, ritmo ou progressão reconhecível de obra existente, nem citar
  franquias. As notas são agendadas pelo relógio do AudioContext (o `setTimeout`
  só enche a janela de 1,2 s); troca de faixa com fade de 0,5 s; `VOLUME_MUSICA`
  sempre abaixo de `VOLUME_EFEITOS`. `faixaDaTela` em `js/app.js` escolhe a faixa.
