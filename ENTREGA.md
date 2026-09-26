# Entrega — polimento 2: Rato do Mato, Batalha simplificada, especiais e som

Branch `feat/polimento-2`, um commit por fase, levada para a `main` (merge
local; **falta o `git push`** para o Pages publicar). As cinco fases ficaram prontas.

**Testes:** 306 antes, **371 depois** (`node --test`: 371 pass, 0 fail). A
suíte passou em cada commit. Paleta: `node scripts/contraste.js` → todos >= 4.5:1.

| Commit | Fase | Testes |
|---|---|---|
| `Fase 1` | Rato do Mato (rival de treino) e lista manual sem sorteio | 356 |
| `Fase 2` | Batalha em uma tela só ("Quem ganhou?") | 355 |
| `Fase 3` | nome do golpe nas rodadas, cena do especial, fim com VENCEU! | 363 |
| `Fase 4` | cenário por modo | 363 |
| `Fase 5` | som gerado em código | 371 |
| `Entrega` | versão de cache 14 → 15 e este arquivo | 371 |

Na Fase 2 a conta caiu 1: saíram os testes da Arena antiga e entraram os da
nova. Ela nunca ficou abaixo dos 306 de partida e terminou em 371.

## Roteiro para testar no iPhone

Espere ~10 min depois do push (o Pages guarda cache por 600 s) ou use uma aba
anônima. Para zerar tudo: Ajustes → Safari → Avançado → Dados de Sites → apague
`juanmqc22.github.io`.

1. **Contra o Rato com uma peça só.** Escaneie só o Bocão
   (`https://juanmqc22.github.io/Game3D/?b=SAP02&f=1`) → Continuar → na tela
   "Bocão está pronto!" toque em **Não tenho a segunda peça**. A lista mostra o
   Bocão, o **Rato do Mato** (selo "Rival de treino", com a arte) e quatro
   cartões "Série 2 — em breve". Não existe mais "Oponente surpresa". Escolha o
   Rato → modo **Rolar**. O Rato fica **em cima, sem estar de cabeça para
   baixo**, com "Gire o pião pelo Rato". Gire o seu pião e toque o desenho na
   sua metade (embaixo); gire de novo e toque o desenho na metade do Rato.
2. **Lista manual sem nada escaneado.** Numa aba anônima, abra
   `https://juanmqc22.github.io/Game3D/` e toque em Rolar: aparece só o Rato e
   "Escaneie a sua peça para jogar com o seu bichinho."
3. **Uma partida de Batalha.** Escaneie SAP02 e TAT01 → **Batalha**. A tela
   escurece e aparece **QUEM GANHOU?** com as duas fotos. Toque **Girou mais**
   ou **Jogou pra fora** embaixo de quem ganhou, ou **Empate** no meio. A
   rodada resolve no toque. Depois, **Girar de novo** abre a pergunta outra vez.
   Jogue até o fim: a tela de fim mostra **VENCEU!**, a arte grande, o nome, o
   confete e, embaixo, o outro com **PERDEU**.
4. **Um especial de cada fundador** (modo Rolar). Bocão com ESPECIAL vencendo
   → cena da **Língua Chicote**: a língua rosa estica até o Couraça e volta com
   um coração. Couraça com ESPECIAL vencendo → **Bola de Ferro**: a bola cinza
   cai no Bocão, levanta poeira, o painel treme e o escudo azul acende no
   Couraça. Cada cena leva ~2,5 s com o resultado; um toque em qualquer lugar
   pula. Nas rodadas normais o nome do golpe aparece grande (**GARRADA!**,
   **DEFENDEU!**, **TROPEÇOU!**, **CHOQUE!**) e cada painel mostra o número da
   vida (−3, +4, 0).
5. **Botão de som** (canto de cima; na batalha, à esquerda da faixa do meio).
   Começa em **só efeitos** (alto-falante com ondas). Toque uma vez → **mudo**
   (X); outra → **tudo** (nota musical: entra a musiquinha); outra → só efeitos
   de novo. Recarregue a página: ele lembra. Com a chave lateral do iPhone no
   silencioso, o Safari não toca Web Audio. Isso é do aparelho, não do jogo.

Se algo parecer antigo, é cache: confira que
`https://juanmqc22.github.io/Game3D/js/som.js?v=15` existe.

## Fase 1 — Rato do Mato ✅

**Números finais: vida 14, força 2, Mordida Rápida 3 de dano.**

Os números de partida (vida 12) davam 75,5–76,2% para os fundadores e, pior,
**reprovavam o guarda-corpo como alvo**: Salta e Trovão batem 8 no Rolar, e 60%
de 12 é 7,2. Com vida 14 (60% = 8,4) todo golpe de todo bichinho, em todo
modo, fica dentro do limite, e os fundadores caem no meio da faixa sem mexer na
força nem no especial.

Fundadores contra o Rato (10.000 partidas por ordem, as duas ordens somadas;
alvo 65–75%):

| Modo | Faces | Couraça | Bocão | Mediana |
|---|---|---|---|---|
| Rolar | justo, semente 1 | 69,5% | 70,9% | 7–8 |
| Rolar | justo, semente 2 | 69,7% | 71,2% | 7–8 |
| Rolar | medido (11,21,31,32), semente 1 | 68,5% | 70,1% | 7–8 |
| Rolar | medido, semente 2 | 68,3% | 70,0% | 7–8 |
| Mira | justo | 68,5% | 70,4% | 8–10 |
| Mira | medido | 68,6% | 71,2% | 9–10 |
| Batalha (nova), semente 1 | 45/35/20 | 70,4% | 66,3% | 7 |
| Batalha (nova), semente 2 | 45/35/20 | 70,1% | 66,4% | 7 |

`node scripts/balanceamento.js --rival` (aceita `--modo`, `--faces` e
`--ajuste RAT00.vida=12`). Também ficou um teste (`test/rival.test.js`) que
roda a simulação e exige 65–75% nas duas distribuições, e o guarda-corpo de
60% com o Rato como alvo **e** como atacante, nos três modos.

- O Rato fica **fora de `CRIATURAS`** (`RIVAL` em `js/criaturas.js`, com
  `rival: true`). Assim nenhum caminho de peça o vê: `?b=RAT00` é código
  inválido, ele nunca entra na coleção nem no contador, não aparece na Raposa e
  não conta na média do elenco. `buscarCriaturaOuRival` acha os dois.
- Cor ardósia `--rato: #44536a` (7,80:1 com branco; 6,44:1 no chassi), no
  `scripts/contraste.js`. Arte: `img/originais/rato.png` virou `RAT00.png`
  (o `npm run arte` só aceita o nome no formato do código) → `RAT00-512.webp`
  com 24 KB e `RAT00-256.webp` com 10 KB.
- **Lista manual:** só os escaneados (com a arte), depois o Rato, depois os da
  Série 2 travados ("Série 2 — em breve", sem nome nem números). Sem nada
  escaneado: só o Rato e o texto pedido. O "Oponente surpresa" e o
  `sortearOponente` saíram de todo lugar, inclusive do README.

## Fase 2 — Batalha em uma tela só ✅

`BONUS_GIROU = 1` e `BONUS_FORA = 2` em `js/regras.js`. **Não precisei baixar
o BONUS_FORA:** com +2 nada saiu do alvo.

Simulador: `--modo ARENA --girou 45 --fora 35 --empate 20` (esses são os
padrões). Em cada rodada: 20% empate (Choque); senão um lado ganha (metade das
vezes cada), por "girou" (45 em 80) ou "fora" (35 em 80). Como a Batalha não
usa faces, justo e medido dão o mesmo resultado.

| Bichinho | Média contra o elenco (semente 1) | Semente 2 |
|---|---|---|
| TAT01 Couraça | 51,5% | 51,4% |
| SAP02 Bocão | 46,9% | 46,9% |
| TAT03 Ferrão | 46,9% | 46,9% |
| SAP04 Salta | 52,8% | 52,8% |
| TAT05 Casco | 55,0% | 55,2% |
| SAP06 Trovão | 46,9% | 46,9% |

Alvo 45–57%: todos dentro. Nenhum confronto fora de 30–70% (o pior é 42,7%),
medianas de 5 a 7 rodadas, nenhuma partida no limite de 40. Couraça × Bocão:
54,3 × 45,7. Guarda-corpo: o maior golpe da Batalha é força 4 + 2 = 6 (Salta),
abaixo de 60% de qualquer alvo.

Bocão, Ferrão e Trovão empatam em 46,9% porque, sem faces nem especial, a
Batalha é decidida só por força e vida, e os três têm força 3 e vida 15. Ela
virou um modo de pura habilidade no pião.

## Fase 3 — leitura da rodada e especiais ✅

- **Nome do golpe no lugar de VENCEU/PERDEU**, igual nas duas metades, vindo de
  `golpeDaRodada` (função pura em `js/regras.js`, com teste): GARRADA!,
  DEFENDEU!, TROPEÇOU!, CHOQUE!, o nome do especial; na Batalha, GIROU MAIS! e
  PRA FORA!. Cada painel mostra o número grande da própria vida na rodada (−3
  vermelho, +4 verde, 0 cinza, 0 azul com escudo quando o escudo segurou).
- **Tela de fim:** selo amarelo **VENCEU!**, arte grande (até 230 px) com o
  troféu, o nome, 28 papéis de confete (uma vez) e, embaixo, a miniatura do
  outro com **PERDEU**. Com movimento reduzido, sem confete.
- **Cena do especial:** o fundo escurece, a arte entra grande sobre o painel de
  quem usou, o nome aparece na faixa do meio (uma linha para cada jogador) e o
  efeito vai de um painel ao outro. Língua Chicote = língua **rosa, fina e
  elástica**, que **estica na diagonal** até o outro e volta com um coração
  vermelho. Bola de Ferro = esfera **cinza e pesada** que **cai de cima**,
  achata no impacto, levanta poeira e faz o painel tremer, e o escudo **azul**
  acende. Os outros especiais (inclusive a Mordida Rápida do Rato) usam a estrela.
- **Tempos medidos** (do fim do DESFAZER até os botões liberarem): rodada
  normal **~1087 ms** (≤ 1,2 s); rodada de especial **~2486 ms** (≤ 2,5 s). Um
  toque pula a cena; com movimento reduzido o resultado aparece direto.

## Fase 4 — cenário por modo ✅

Só CSS e SVG em data URI, estático: Rolar = terra com folhas e pedrinhas;
Batalha = estádio redondo em anéis (a bandeja vista de cima); Mira = gramado
listrado com um alvo vermelho e branco. Aparece na moldura em volta dos painéis
e num "chão" sob cada bichinho. Nunca fica atrás de texto, por isso o contraste
medido não muda (ver a auditoria abaixo).

## Fase 5 — som ✅

`js/som.js`, só Web Audio gerado em código: toque em botão, garrada (três
arranhões), defesa (pancada + "ting"), tropeço (escorregão), choque (estalo +
duas notas brigando), girou/pra fora na Batalha, **Língua Chicote** (slurp
subindo, estalo, volta), **Bola de Ferro** (assobio caindo + baque pesado com
poeira), estrela genérica e fanfarra de vitória. Música opcional: loop de 4
compassos em onda quadrada com baixo triangular, volume 0,07. Botão com três
estados, padrão **só efeitos**, guardado em `bichinhos:som`. O `AudioContext`
só nasce no primeiro toque. Sem Web Audio os dois botões somem (testado
apagando o `AudioContext` antes de carregar: nenhum erro).

## Decisões que tomei sozinho (a mais simples em cada caso)

- **Plan mode:** como na entrega anterior, aprovar um plano seria uma pergunta;
  li os arquivos inteiros, planejei e segui.
- **O Rato fica fora de `CRIATURAS`**, em vez de um filtro em cada lugar. É o
  jeito de ele nunca vazar para escaneio, coleção, contador ou Raposa.
- **Vida do Rato 14, não 12**, por causa do guarda-corpo (ver Fase 1).
- **Contra o Rato ele fica sempre em cima, e a metade dele não gira:** a
  criança joga sozinha, sentada de um lado, e precisa ler "Gire o pião pelo
  Rato" do lado certo. Se o Rato for escolhido como Jogador 1, a ordem troca.
- **Vitória contra o Rato conta** nas estatísticas do bichinho da criança (só
  o Rato não tem cartão). Quando o Rato ganha, não toca a fanfarra.
- **Não existe Rato contra Rato:** se o Jogador 1 escolheu o Rato, ele some da
  lista do Jogador 2. Os travados ficam depois do Rato.
- **"QUEM GANHOU?" resolve no toque, sem DESFAZER.** A pergunta vem escrita
  para os dois lados (a cópia de baixo do painel fica de cabeça para baixo, para
  o jogador de cima). Depois do resultado, **Girar de novo** abre a pergunta da
  próxima rodada. A pergunta tem um "Sair" próprio, porque cobre a faixa do meio.
- **Nomes que você não definiu:** TROPEÇO × TROPEÇO = "TROPEÇARAM!"; na
  Batalha, "GIROU MAIS!" e "PRA FORA!". Especial vencendo quem tropeçou mostra
  o nome do especial (o carimbo "TROPEÇOU! +2" continua na metade de quem
  tropeçou).
- **O número de cada painel é quanto a vida mudou**, inclusive 0, porque você
  pediu o número "em cada painel".
- **A cena do especial acontece mesmo se o escudo segurar o dano;** a luta que
  vem depois mostra o escudo segurando.
- **Os efeitos antigos do especial dentro da luta** (faixa amarela, língua e
  bola) saíram: a cena já conta isso, e repetir estouraria os 2,5 s.
- **Notas curtas na tela** ("Escudo não acumula.") para caber em 360×640; o
  leitor de tela continua lendo a versão por extenso.
- **O cenário fica só na moldura e no chão sob o bichinho**, nunca atrás de texto.
- **Botão de som:** na batalha ele vai para a faixa do meio (no canto ele
  cobriria os botões do jogador de cima). Cada toque avança um estado: tudo →
  efeitos → mudo → tudo.
- **Confete e ruído do som sem `Math.random`:** posições fixas pela razão áurea
  e ruído com semente. O app continua sem sortear nada.

## Cache

`?v=14` → `?v=15` em `index.html` (CSS, desvio da Raposa, app.js), nos imports
de `js/app.js` (inclusive o novo `som.js`), de `js/escaneio.js` e de
`js/colecao.js`, e nos imports de `../../js/` em `raposa/js/app.js`
(`criaturas.js`, `arte.js` e `icones.js` mudaram). A entrada da Raposa foi de
`app.js?v=3` para `?v=4`. A Raposa carrega sem erro.

## Como validei

- `node --test`: 371 pass, 0 fail. `node scripts/contraste.js`: todos >= 4.5:1.
- Edge headless via DevTools Protocol (script fora do repositório), em 360×640
  e 390×844. **Atenção:** o Edge desta máquina informa `prefers-reduced-motion`
  ligado (vem da configuração do Windows). Os testes de animação forçam "sem
  preferência", e o teste de movimento reduzido liga a opção de propósito.
- **Contraste no DOM real** (cor do texto contra o fundo efetivo, misturando
  camadas translúcidas) em 12 telas: início, escolha vazia e cheia, coleção,
  batalha antes e depois nos três modos, contra o Rato e fim. **0 textos abaixo
  de 4,5:1.**
- **FPS com CPU 4x mais lenta** (`Emulation.setCPUThrottlingRate`), pior quadro
  de cada cena: rodada normal 19 ms, Língua Chicote 19 ms, Bola de Ferro 19 ms,
  Batalha com a sobreposição 13 ms, Mordida Rápida na Mira 19 ms, fim com
  confete 7 ms. Nenhuma cena abaixo de ~52 fps. (O headless não trava em 60 Hz;
  a média passou de 150 fps em todas.)
- Sem rolagem lateral em 360 e sem erro de console. O resultado cabe ao lado do
  bichinho em 360×640. O caso mais cheio (Mira, especial com escudo) passa 4 px
  do palco para o vão antes da barra de vida, sem cobrir nada.
- **Não validei em aparelho de verdade:** o som no Safari do iPhone (inclusive
  com a chave de silencioso), o ritmo real de uma criança girando o pião duas
  vezes contra o Rato, e se as cenas de 2,5 s ficam longas demais no uso. O
  roteiro acima é o teste que falta.

---

# Entrega — polimento para o lançamento (fundadores Couraça e Bocão)

Branch `feat/lancamento`, um commit por fase, levada para a `main`. As quatro
fases ficaram prontas.

**Testes:** 273 antes, **306 depois** (`node --test`: 306 pass, 0 fail). A
suíte passou em cada commit. Paleta: `node scripts/contraste.js` → todos >= 4.5:1.

| Commit | Fase |
|---|---|
| `Fase 1` | escaneio entre abas (iPhone) e NFC na tela de espera |
| `Fase 2` | Língua Chicote 4/4 e o Choque |
| `Fase 3` | rodada sem LUTAR/PRÓXIMA, arte grande, momento do especial |
| `Fase 4` | selo de Fundador e a coleção por série |
| `Entrega` | versão de cache 13 → 14 e este arquivo |

## Testar no iPhone (o bug que motivou tudo)

Espere ~10 min depois do push (o Pages guarda cache por 600 s), ou abra numa aba
anônima. Para começar do zero: Ajustes → Safari → Avançado → Dados de Sites →
apague `juanmqc22.github.io`.

URLs exatas (as mesmas que vão nas etiquetas):

- Bocão, fundador #1: `https://juanmqc22.github.io/Game3D/?b=SAP02&f=1`
- Couraça, fundador #3: `https://juanmqc22.github.io/Game3D/?b=TAT01&f=3`
- Sem selo (forma curta de sempre): `https://juanmqc22.github.io/Game3D/?b=SAP02` e `?b=TAT01`

Roteiro:

1. **Encoste o SAP02.** Abre uma aba nova com a carta **"Novo bichinho!"** do
   Bocão, com borda dourada e o selo **FUNDADOR #1**. Toque em Continuar →
   **"Bocão está pronto!"**, agora com a arte grande do sapo.
2. **Encoste o TAT01.** O iPhone abre outra aba nova. Aparece "Novo bichinho!"
   do Couraça com **FUNDADOR #3** → Continuar → **"Como vocês vão jogar?"**
   com *Bocão contra Couraça*. Antes do conserto, esta aba mostrava "Couraça
   está pronto!" (virava Jogador 1 de novo).
3. Escolha **Rolar**. Os dois tocam no desenho que ficou para cima. Assim que o
   segundo toca, o botão do meio vira **DESFAZER** com um anel fechando;
   1,5 s depois a luta roda sozinha. Toque no símbolo da próxima rodada direto,
   sem "Próxima".
4. **Encoste o TAT01 de novo** (terceira leitura): começa um ciclo novo com
   "Couraça está pronto!", sem a carta de desbloqueio. A partida anterior limpou
   a espera.
5. Abra **Minha coleção**: "2 de 2 da Série 1", as duas cartas com selo e
   quatro cartas **"Série 2 — em breve"**.

Se o passo 2 ainda mostrar "Couraça está pronto!", é cache: confira se o
arquivo novo chegou abrindo `https://juanmqc22.github.io/Game3D/js/escaneio.js?v=14`
e procurando `localStorage` no comentário do topo.

No Android com Chrome, a tela de espera mostra também **"Encoste a segunda
peça"**: toque, encoste a peça atrás do celular, e o fluxo é o mesmo do QR.

## Fase 1 — escaneio no iPhone ✅

- A espera da primeira peça mudou de `sessionStorage` (vale por aba) para
  `localStorage` (vale para todas as abas). A chave (`bichinhos:aguardando`) e
  a expiração de 10 min continuam.
- A partida começada pela segunda leitura limpa a espera; a terceira leitura
  começa um ciclo novo (já era assim na lógica; agora tem teste para isso).
- Botão **"Encoste a segunda peça"** só quando existe `NDEFReader` (Chrome
  Android). Ele lê o registro de URL da etiqueta (aceita também `absolute-url`
  e registro de texto com o endereço), extrai o `?b=` e o `&f=`, e segue o
  mesmo caminho da chegada por URL. Mesma peça → "Esse é o mesmo bichinho!".
  Permissão negada → "O celular não deixou usar o NFC. Escaneie o QR da peça."
  Qualquer outro erro → mensagem curta equivalente. No iPhone o botão não aparece.
- Testes novos: duas "abas" com `sessionStorage` próprio e o mesmo
  `localStorage` (a segunda inicia a partida; com `sessionStorage` reproduz o
  bug); terceira leitura; mesma peça em aba nova = repetido; extração do
  código de URL completa, relativa, com `%xx`, `+` e lixo; leitura de registros
  NFC (`DataView`, como o Chrome entrega).

## Fase 2 — combate ✅

### Língua Chicote 4/4

Dano 4, cura 4, roubo continua ("oponente -4 de vida, você +4 de vida").
Nenhum teste de regra dependia do 3 (eles usam criaturas de teste próprias);
acrescentei um teste que fixa o 4/4 do Bocão, com a cura fixa em +4 mesmo
quando o tropeço leva o dano a 6.

### Choque: **ficou ligado** (`CHOQUE_DANO = 1`)

Mesmo símbolo dos dois lados, exceto TROPEÇO × TROPEÇO: cada um perde 1. O
escudo anula o choque de quem o tem e é consumido. Nenhum bichinho saiu de
45–57% e nenhuma mediana saiu de 5–15, em nenhum modo e em nenhuma das duas
distribuições. Na tela: veredito **CHOQUE!** nas duas metades, "-1 de vida"
(ou "Escudo segurou") em cada uma, os dois tremem.

O guarda-corpo de golpe máximo não precisou mudar: o choque (1) nunca é o
maior golpe de uma rodada, e o pior golpe do Bocão com 4/4 é 6 (60% de 14 é 8,4).

### Balanceamento: antes e depois

Simulação: 10.000 partidas por confronto e por ordem (as duas ordens somadas
para os fundadores), semente 1, limite de 40 rodadas. "Justo" = 25/25/25/25;
"medido" = `--faces 11,21,31,32`. Arena e Mira com 50% de chance.

**Couraça × Bocão**

| Modo | Faces | Antes | Língua 4/4 | Língua 4/4 + Choque (entregue) | Mediana (entregue) |
|---|---|---|---|---|---|
| Rolar | justo | 54,3 × 45,7 | 50,9 × 49,1 | 48,7 × 51,3 | 8 |
| Rolar | medido | 55,5 × 44,5 | 51,1 × 48,9 | 49,0 × 51,0 | 8 |
| Batalha | justo | 52,9 × 47,1 | 51,7 × 48,3 | 51,2 × 48,8 | 9 |
| Batalha | medido | 52,8 × 47,2 | 51,7 × 48,3 | 51,2 × 48,8 | 9 |
| Mira | justo | 55,8 × 44,2 | 50,5 × 49,5 | 48,4 × 51,6 | 10 |
| Mira | medido | 56,6 × 43,4 | 50,8 × 49,2 | 48,1 × 51,9 | 10 |

A sua simulação da Língua 4/4 bate com a minha (50,9 × 49,1 no justo). No
medido a sua deu 56,5 → 50,9 e a minha 55,5 → 51,1 — a diferença é de semente.
Com o Choque, o Bocão passa um pouco à frente no Rolar e na Mira (51 × 49,
como você previu, só que com o lado invertido).

**Elenco inteiro — média de cada um contra os outros 5 (alvo 45–57%)**

Rolar:

| Bichinho | Antes (justo / medido) | Entregue (justo / medido) |
|---|---|---|
| TAT01 Couraça | 50,7 / 51,5 | 48,7 / 49,0 |
| SAP02 Bocão | 45,8 / 45,4 | 50,6 / 50,8 |
| TAT03 Ferrão | 48,8 / 49,1 | 47,9 / 48,3 |
| SAP04 Salta | 55,3 / 54,9 | 54,0 / 53,6 |
| TAT05 Casco | 51,2 / 50,6 | 51,0 / 50,2 |
| SAP06 Trovão | 48,2 / 48,5 | 47,8 / 48,0 |

Batalha (Arena):

| Bichinho | Antes (justo / medido) | Entregue (justo / medido) |
|---|---|---|
| TAT01 Couraça | 50,0 / 49,7 | 49,5 / 49,2 |
| SAP02 Bocão | 45,6 / 45,4 | 47,4 / 47,4 |
| TAT03 Ferrão | 45,9 / 46,1 | 46,3 / 46,4 |
| SAP04 Salta | **57,1 / 57,1** | 56,6 / 56,6 |
| TAT05 Casco | 55,1 / 54,9 | 53,8 / 53,6 |
| SAP06 Trovão | 46,3 / 46,8 | 46,4 / 46,7 |

Mira:

| Bichinho | Antes (justo / medido) | Entregue (justo / medido) |
|---|---|---|
| TAT01 Couraça | 52,2 / 52,6 | 49,4 / 49,5 |
| SAP02 Bocão | 46,0 / 45,7 | 51,8 / 52,6 |
| TAT03 Ferrão | 46,3 / 46,5 | 45,5 / 45,6 |
| SAP04 Salta | 56,0 / 55,5 | 54,4 / 53,9 |
| TAT05 Casco | 53,4 / 53,4 | 53,4 / 53,0 |
| SAP06 Trovão | 46,1 / 46,2 | 45,4 / 45,5 |

Medianas por confronto (entregue): Rolar 5–10, Batalha 7–10, Mira 6–12.
Partidas que bateram no limite de 40 rodadas na Mira medida: 62 antes, 2 depois.

Três observações:

- **O Salta na Batalha já estava fora da faixa antes** (57,1%). Com as duas
  mudanças ele volta para 56,6%.
- **Só a Língua 4/4, sem o Choque, deixaria o Trovão em 45,0% na Mira medida**
  (na borda de baixo). O Choque o empurra para 45,5%.
- Os mais perto da borda no que foi entregue são Ferrão e Trovão na Mira
  (45,4–45,6%). Rodei de novo com a semente 2 e deu o mesmo (45,3–45,5%).

## Fase 3 — visual e fluxo da batalha ✅

- **Menos toques.** Não existe mais LUTAR nem PRÓXIMA. Quando os dois
  responderam, o botão do meio vira **DESFAZER** por 1,5 s, com um anel
  fechando; tocar nele apaga a última resposta tocada e a rodada volta a
  esperar. Qualquer toque novo nesses 1,5 s reinicia a contagem. Depois da
  animação, os botões de símbolo já aceitam a escolha da próxima rodada: o
  primeiro toque (num símbolo ou no resultado) limpa o resultado e começa a
  rodada nova, já com aquele símbolo marcado. Batalha e Mira resolvem quando
  as perguntas delas também foram respondidas. No fim da partida o meio vira
  **VER FIM** (um toque, para dar tempo de ver o golpe final).
- **Arte grande.** Com arte, o bichinho ocupa ~52% do painel (antes 42%) e
  reage: o vencedor pula, o perdedor treme (0,56 s e 0,46 s, começando em
  440 ms). A tela "X está pronto!" usa a arte sobre o disco da espécie. Sem
  arte, fica o visual de antes.
- **O especial tem momento próprio.** O nome entra grande numa faixa amarela
  sobre o meio da tela, escrito para os dois lados. A Língua Chicote estica até
  o outro e um coração viaja do painel do perdedor para o do Bocão (só quando o
  roubo acontece). Na Bola de Ferro, a bola cai do alto no outro (vista de
  cima, ela encolhe e achata) e o escudo acende em volta do Couraça. Os outros
  4 especiais usam a estrela genérica. Linha do tempo: o último efeito
  termina em 1020 ms, e a rodada fecha nos mesmos 1080 ms de antes. Com
  `prefers-reduced-motion`, o resultado aparece direto.
- **Saiu o aviso** de vida cheia ("a vida não passa do máximo").
- **Piões.** Rolar: "Girem os piões. Quando pararem, vejam qual desenho ficou
  para cima." **Batalha** (continua `ARENA` no código): "Girem os dois na mesma
  bandeja. Perde quem parar de girar primeiro ou sair da bandeja." A pergunta
  virou "Quem parou primeiro ou saiu da bandeja?", com as opções **Girando**
  (o antigo Dentro) e **Parou ou saiu** (o antigo Fora). Mira: "Girem os
  piões perto de uma tampa ou prato. Quem parar em cima bate mais forte."
- **aria-label** em todos os botões de símbolo e de pergunta, com o jogador
  ("Ataque, jogador 1"), inclusive na metade de cabeça para baixo. O DESFAZER
  tem "Desfazer a última escolha".

## Fase 4 — coleção e lançamento ✅

- **Selo de Fundador.** `?b=TAT01&f=3` grava `fundador: 3` na carta. Só vale
  inteiro de 1 a 10 escrito sem zero à esquerda ("3" vale; "03", "3.5", "11"
  e "abc" são ignorados, e a peça entra normalmente). Sem `f`, nada muda (o
  formato antigo da coleção continua igual). Uma peça já registrada sem selo
  ganha o selo quando chega com `f`, e aparece a carta **"Selo de Fundador!"**.
  A carta tem borda dourada dupla e o selo "Fundador #N", na coleção e no
  desbloqueio. O NFC do Android também lê o `&f=`.
- **Série.** Campo `serie` em `js/criaturas.js` e `SERIE_ATUAL = 1` (Couraça
  e Bocão). As 4 cartas travadas de série 2 viram **"Série 2 — em breve"**
  (a mesma silhueta travada, sem nome nem números). O contador ficou "2 de 2
  da Série 1", e o botão da tela inicial ficou "Minha coleção · 2 de 2".
- Cor nova `--ouro: #765a00` (6,50:1 no branco, 5,36:1 no chassi), incluída
  no `scripts/contraste.js`.

## Decisões que tomei sozinho (a mais simples em cada caso)

- **Plan mode:** você pediu plan mode e também "não me pergunte nada". Aprovar
  um plano seria uma pergunta, então li os quatro arquivos inteiros, planejei e
  segui direto.
- **DESFAZER apaga a última resposta** (não volta ao valor anterior). Assim a
  rodada nunca se arma de novo sozinha logo depois do desfazer.
- **O resultado fica na tela até o primeiro toque** da rodada seguinte. Não
  some por tempo.
- **Fim de partida:** mantive um toque em VER FIM em vez de ir sozinho para a
  tela de fim, para dar tempo de ver o golpe que decidiu.
- **Choque:** vale nos três modos, sem bônus de Mira nem metade por erro. Na
  Batalha, só vale com os dois ainda girando. ESPECIAL × ESPECIAL é choque puro:
  nenhum especial ativa. Pode terminar a partida, e os dois zerados = empate
  (regra 7).
- **Efeitos antigos** de Espinho, Pulo Duplo, Casca Dura e Estouro
  (estilhaços, anel duplo, casca) saíram, porque você pediu a estrela genérica
  para esses 4. O tremor do recuo do Estouro ficou, porque ele mostra a regra.
- **Mira:** os botões continuam "Acertou/Errou"; só a pergunta virou "Parou em
  cima do alvo?".
- **"Rolar"** continua com esse nome (você só pediu para renomear a Arena).
- **Fundador:** quem já tem selo fica com o primeiro número. Um bichinho de
  série 2 que alguém já descobriu (digitando o código, por exemplo) aparece
  normal na coleção, mas não entra no contador da Série 1.
- **NFC com etiqueta de outro bichinho inválido** fica na tela de espera com
  "Essa etiqueta não é de um bichinho", em vez de voltar para o início.
- **Selos da rodada:** saíram do lugar dos botões e foram para baixo do
  veredito, ao lado do bichinho, porque os botões agora ficam sempre na tela.
  Atualizei essa regra no CLAUDE.md.

## Cache

`?v=13` → `?v=14` em `index.html` (CSS, desvio da Raposa, app.js), nos imports
de `js/app.js`, `js/escaneio.js` e `js/colecao.js`, e nos imports de
`../../js/` em `raposa/js/app.js` (o `criaturas.js` mudou). A entrada da Raposa
foi de `app.js?v=2` para `?v=3`. A Raposa carrega sem erro.

## Como validei

- `node --test`: 306 pass, 0 fail.
- Chrome headless, via DevTools Protocol (script fora do repositório), em
  360×640 e 390×844: duas abas compartilhando o storage (o cenário do iPhone),
  NFC simulado (mesma peça, outra peça e permissão negada), DESFAZER, rodada
  automática, Bola de Ferro, Língua Chicote com roubo e bloqueada pelo escudo,
  estrela, Choque, movimento reduzido, partida inteira na Batalha até a tela
  de fim, selo de Fundador (novo, tardio e `f` inválido), coleção por série,
  sem rolagem lateral e sem erro no console.
- **Não validei em aparelho de verdade**: nem o Safari do iPhone abrindo aba
  nova a cada leitura, nem o NFC real do Chrome Android. O roteiro acima é o
  teste que falta.

---

# Entrega anterior — redesign visual

Branch: `feat/redesign-hud`, com os mesmos commits levados para a `main` (você
pediu para testar direto no GitHub Pages). Nenhuma regra mudou: `js/regras.js` e
`js/criaturas.js` não foram tocados.

**Os 209 testes passam** (`node --test`: 209 pass, 0 fail) em cada um dos três
commits do redesign.

## A decisão estética principal, e por que ela contraria o clichê

O briefing pedia futurista, HUD de nave, carta holográfica. O caminho óbvio é
tema escuro com neon. **Não fiz isso, e o motivo é a sua própria restrição.**

Sob sol forte, tela escura é o pior caso: a luz refletida no vidro passa a
dominar a luz emitida, e o preto vira cinza-espelho. Tema claro ganha porque a
tela emite mais luz total. Então a direção virou **"instrumento de batalha em
luz do dia"**: chassi claro de alto contraste, tinta quase preta, e o preto
reservado aos **visores** — as poucas áreas pequenas onde branco sobre quase
preto dá 18:1 e o número é lido de braço estendido.

O futurismo vem da geometria e não da escuridão:

- **Cantos cortados em diagonal** (`border-radius: 3px 16px 3px 16px`) em painéis,
  cartões e botões: leem como chapa de equipamento, não como card de site.
- **Grade técnica** de 32px no fundo, com clarão radial no topo — profundidade
  sem uma única imagem.
- **Tipografia com personalidade**: Chakra Petch (Google Fonts, uma só família,
  pesos 500/600/700), terminais quadrados e números distintos. Carrega com
  `font-display: swap` atrás de `media="print"` + `onload`, então nunca bloqueia
  a pintura; offline cai no fallback de sistema e o jogo continua legível.
- **Neon só onde funciona**: o ciano `#3ae1ff` aparece exclusivamente sobre o
  visor escuro e nas cartas travadas da coleção. Brilho nunca substitui contraste.

### Três escolhas que vieram da restrição do sol, não do gosto

1. **Opacidade saiu dos estados.** Botão não escolhido e botão desabilitado
   usavam `opacity: 0.4`. Texto lavado desaparece na claridade. Agora o não
   escolhido vira **contorno legível** (fundo branco, borda e ícone na cor do
   símbolo) e o desabilitado vira **cinza sólido** com tinta média — 7:1 em vez
   de um fantasma.
2. **O perdedor do confronto encolhe em vez de desbotar.** A ficha perdedora
   ficava em `opacity: 0.5` e o rótulo sumia. Agora ela vai a `scale(0.8)` e
   torce; o vencedor vai a `1.26`. A diferença de tamanho é 1,5x, legível de longe.
3. **Rodapé virou barra de comando sólida**, sangrada até a borda e com régua
   superior. Antes era um gradiente que deixava meio símbolo aparecendo por baixo.

## Paleta final, com contraste medido

Medido com `node scripts/contraste.js` (WCAG 2.1, sem dependência), que vive no
repositório e tem que ser mantido em sincronia com `:root` do CSS.

| Par | Razão |
|---|---|
| tinta `#0a1120` / superfície `#ffffff` | 18,85:1 |
| tinta / chassi `#e4eaf0` | 15,55:1 |
| branco / visor `#0b1322` | 18,58:1 |
| ciano `#3ae1ff` / visor | 11,85:1 |
| tinta do especial / especial `#f6c50b` | 11,29:1 |
| barra alta `#2ecc5a` / visor | 8,76:1 |
| tinta média `#404c60` / superfície | 8,68:1 |
| escudo `#1746c8` / superfície | 7,65:1 |
| branco / defesa `#1746c8` | 7,65:1 |
| tinta média / chassi | 7,16:1 |
| sistema `#0b5f7a` / superfície | 7,16:1 |
| branco / tatu `#95470b` | 6,60:1 |
| branco / tropeço `#8a2bc4` | 6,52:1 |
| branco / sapo `#0b6b62` | 6,38:1 |
| sistema / chassi | 5,91:1 |
| branco / perigo `#c41f1f` | 5,89:1 |
| barra baixa `#ff4d4d` / visor | 5,68:1 |
| branco / ataque `#127a33` | 5,44:1 |
| perigo / chassi | 4,86:1 |

Papéis: **sistema** (ciano escuro) para traços, chips e títulos; **tatu** âmbar e
**sapo** teal para espécie; **perigo** vermelho só para dano e vida baixa;
**escudo** azul só para proteção. O tropeço saiu do vermelho e foi para o roxo,
para não competir com "dano" — ele tem identidade própria agora.

A cor da espécie passou a vir do CSS via `data-especie`. A tabela não foi tocada:
`js/criaturas.js` continua alimentando `--cor-base`, que é o que uma espécie nova
usaria automaticamente até ganhar tratamento próprio.

## Onde o esforço foi gasto

**1. Animação da rodada.** Camada de efeitos com peças genéricas (anel,
estilhaços, língua, domo, carimbo) que `data-efeito` acende. Cada especial tem o
seu:

| Especial | Efeito |
|---|---|
| Bola de Ferro (TAT01) | domo azul de escudo fechando em volta do vencedor |
| Língua Chicote (SAP02) | chicote rosa que dispara do vencedor até o oponente e recolhe |
| Espinho (TAT03) | estilhaços âmbar irradiando do ponto de impacto |
| Pulo Duplo (SAP04) | dois anéis em sequência, o segundo 140ms depois |
| Casca Dura (TAT05) | domo verde fechando no próprio vencedor |
| Estouro (SAP06) | estilhaços laranja e **os dois** painéis tremendo |

**Tropeço** tem tratamento próprio: a peça **tomba de lado** (rotação de 74°) e um
carimbo roxo **"TROPEÇOU! +2"** bate embaixo, fora do caminho da peça. A arena
cresce só nessa rodada para abrir espaço.

Golpe de 5 ou mais traz o número de dano maior. O vencedor é localizado em **%
da arena**, não em pixels, então o foco dos efeitos continua certo de 360 a 560
de largura.

**2. Barras de vida e painéis.** A vida virou visor escuro segmentado com uma
**barra-fantasma** vermelha que fica para trás e mostra de onde a vida caiu —
só quando cai; curar não tem rastro. Vida abaixo de 20% acende moldura vermelha
pulsando. Escudo ativo dá moldura azul no painel inteiro mais um anel pulsando,
óbvio à distância.

**3. Coleção.** Descobertas ganham faixas holográficas na cor da espécie e um
brilho que atravessa a carta uma vez. Travadas deixaram de ser silhueta cinza
(que parecia erro de carregamento) e viraram **slot de dados escuro** com neon,
"?" respirando e "escaneie a peça para descobrir". O contraste entre as duas é
o que cria a vontade.

**4. Carta de desbloqueio.** Raios abrindo atrás, chip "PEÇA REGISTRADA",
atributos em placas escuras (16 em coral, 3 em ciano) e varredura holográfica.

**5. Tela inicial e modos.** Cada modo tem faixa diagonal na sua cor e ícone em
placa. Transição de 220ms entre telas.

## Desempenho: o que foi medido, e em qual perfil

Chromium headless, viewport 360×640, **CPU freada via CDP** (`Emulation.setCPUThrottlingRate`),
contando quadros com `requestAnimationFrame` durante cada cena.

| Cena | 4x mais lenta | 6x mais lenta |
|---|---|---|
| Rodada Estouro + tropeço (a mais pesada) | 58,7 fps | 56,2 fps |
| Rodada Bola de Ferro | 60,0 fps | 58,1 fps |
| Abrir coleção (6 cartas entrando) | 58,1 fps | 57,0 fps |
| Carta de desbloqueio | 60,0 fps | 60,0 fps |
| Batalha com vida baixa (loop pulsando) | 60,0 fps | 60,0 fps |

Nenhuma cena abaixo de 50fps, com folga até 6x. Regras seguidas: só `transform` e
`opacity` animam; o pulso do escudo, que antes animava `box-shadow`, virou anel em
`scale`/`opacity`; nada de `backdrop-filter`; os brilhos das cartas rodam **uma vez**
e param.

Também evitei `:has()` e `color-mix()`, que faltam em WebView antiga de Android de
entrada — o `:has()` que existia no CSS virou classe (`tem-alvo`) posta pelo JS.

**Teto de 1,2s por rodada:** a linha do tempo foi apertada para 1080ms internos.
Medido do toque em "Resolver" até o botão liberar: **1125–1126ms** nos três piores
casos. Antes do aperto dava 1207ms, ou seja, estourava.

**Movimento reduzido:** com `prefers-reduced-motion: reduce`, o resultado aparece
em **50ms**, com **0 animações em curso**, barras já no valor final e todo o texto
(dano, tropeço, recuo, cura) presente.

**Auditoria automática de tela**, em 360×640 e 390×844, percorrendo 14 estados
(início, escolha, desbloqueio, espera, modo, coleção, batalha nos três modos,
resultado, fim):

- contraste calculado no DOM real, com mistura de fundos translúcidos: **0 textos
  abaixo de 4.5:1**; o pior caso é 4,77:1 ("Ficou dentro do círculo", verde sobre
  verde claro);
- **0 alvos de toque abaixo de 44px** (os principais estão em 64px);
- **0 textos cortados** e **0 telas com rolagem lateral**.

Um defeito real foi encontrado e corrigido nessa auditoria: os raios da carta de
desbloqueio vazavam e criavam rolagem lateral em 360px.

## O que ficou de fora, e por quê

- **Tema escuro geral**: rejeitado de propósito, explicado acima. Se você quiser
  ver, dá para prototipar trocando os tokens de `:root` — mas eu testaria no sol
  antes de subir.
- **Raios girando continuamente** na carta de desbloqueio: cortado. Ficava bonito
  mas mantinha animação em loop indefinido num aparelho fraco pelo ganho de quase nada.
- **Fonte auto-hospedada**: não incluí os arquivos da fonte no repositório para
  não trazer binário nem build. O custo é que, na primeira carga sem internet, a
  tela usa a fonte do sistema.
- **Efeitos por especial são mapeados por código** (TAT01…SAP06). Bichinho novo
  cai no efeito genérico — não quebra, só não ganha assinatura própria até
  alguém acrescentar seis linhas de CSS.
- **Não mexi** em `js/regras.js`, `js/criaturas.js`, no fluxo de escaneio, nas
  chaves de storage nem nos nomes dos modos.

## URLs para testar no celular

Base: `https://juanmqc22.github.io/Game3D/` — todos os arquivos subiram para
`?v=9`, então o cache velho não mistura.

| O que ver | Como chegar |
|---|---|
| Tela inicial e os três modos | `https://juanmqc22.github.io/Game3D/` |
| Carta de desbloqueio (raios + varredura) | `https://juanmqc22.github.io/Game3D/?b=TAT03` numa aba onde esse bichinho ainda não foi escaneado |
| Tela de espera com visor de leitura | continuar depois do desbloqueio acima |
| Partida montada por escaneio | `?b=TAT01` e depois `?b=SAP04` na mesma aba |
| Coleção holográfica + slots travados | botão "Minha coleção" na tela inicial |
| Visor de vida, escudo e vida baixa | qualquer partida; escolha Couraça para ver o escudo |
| Tropeço (peça tombando + carimbo) | numa rodada, toque TROPEÇO num jogador e ATAQUE no outro |
| Os seis especiais | escolha o bichinho e toque ESPECIAL contra ATAQUE do adversário |
| Arena e Mira | botões "Arena" e "Mira" na tela inicial |
| Movimento reduzido | ligue "Reduzir movimento" no celular e resolva uma rodada |

## Como rodar as verificações

```bash
node --test               # 209 testes
node scripts/contraste.js # paleta: todos os pares >= 4.5:1
npx serve                 # rodar local
```

As auditorias de tela, quadros por segundo e duração da rodada rodaram com
Playwright fora do repositório, para não criar dependência no projeto.

---

# Entrega anterior — escaneio, coleção e modos de jogo

Branch: `claude/escaneio-e-modos-rdtbjv` (a branch designada pelo ambiente; o
nome pedido, `feat/escaneio-e-modos`, não pôde ser usado). Os mesmos commits
foram enviados para a `main`, como pedido no fim da tarefa, para testar amanhã
no GitHub Pages.

Testes: **209 passando** (`node --test`). Além deles, cada fluxo foi rodado num
Chromium headless (Playwright) sem erros de console.

## O que ficou pronto

### Fase 1 — loop de escaneio ✅
- `?b=CODIGO` sem ninguém esperando → "Couraça está pronto! Agora escaneie o
  bichinho do seu oponente.", com **Não tenho a segunda peça** e **Recomeçar**.
- Segundo código diferente → escolha do modo e partida.
- Mesmo código → "Esse é o mesmo bichinho! Escaneie outro." e continua esperando
  (o timestamp original é mantido).
- Espera em `sessionStorage`, chave `bichinhos:aguardando`, `{ codigo, em }`,
  expira em 10 minutos. Timestamp no futuro (relógio mudou) também expira.
- Sem `?b=` → tela inicial normal.
- Fallback: escolha manual entre os bichinhos da coleção + **Oponente surpresa**
  (sorteia entre os 6). Também dá para digitar um código.
- Testes em `test/escaneio.test.js`: feliz, repetido, expiração, inválido, sem
  parâmetro, lixo no storage, storage bloqueado.

### Fase 2 — coleção ✅
- `localStorage`, chave `bichinhos:colecao`,
  `{ TAT01: { descobertoEm, partidas, vitorias } }`.
- Todo `?b=` válido registra; inválido nunca entra.
- Primeira vez: card "Novo bichinho! Couraça, o tatu" com atributos e Continuar,
  antes de qualquer outra tela.
- Tela "Minha coleção": 6 cartas, contador "2 de 6 bichinhos", descobertos com
  nome/espécie/vida/força/especial/partidas; não descobertos como silhueta cinza
  com "???" e "Escaneie a peça para descobrir" (sem nome, sem números).
- O botão da tela inicial já mostra "Minha coleção · 2 de 6".
- Testes em `test/colecao.test.js`.

### Fase 3 — modo Arena ✅
- Pergunta 1: "Quem ficou dentro do círculo?" (Os dois / Só X / Só Y / Nenhum).
- Pergunta 2: as faces, só quando os dois ficaram dentro.
- Os dois dentro = Rolar; só um dentro = o outro leva força + **1** (ver ajustes);
  nenhum = rodada nula. `resolverRodadaArena` em `js/regras.js`.

### Fase 4 — modo Mira ✅
- Por jogador: "Acertou o alvo?" + face.
- Vencedor acertou → +2; errou → metade, arredondado para baixo.
  `resolverRodadaMira` em `js/regras.js`.
- Guarda-corpo estendido: `danoMaximoDoModo(modo, atacante)` calcula por força
  bruta (com as próprias funções de resolução) o maior dano possível numa rodada
  de cada modo, e `test/criaturas.test.js` valida os três modos contra 60% da
  vida de cada alvo (108 combinações).
- `scripts/balanceamento.js --modo ARENA|MIRA --chance N`.

### Fase 5 — seleção de modo e acabamento ✅
- Tela inicial com Rolar / Arena / Mira, cada um com uma linha de explicação.
- Ícones SVG das 4 faces já existiam; novos ícones para modos, dentro/fora,
  alvo, mistério e QR. Nenhum emoji.
- Animação da rodada continua com teto de 1,2 s (não mudou).
- Escudo ativo: painel com borda azul e brilho, selo pulsando.
- `prefers-reduced-motion`: resultado direto (testado no Chromium).
- Alvos de toque ≥ 64 px nos botões principais; nada abaixo de 44 px.

### O que não deu tempo / ficou de fora
- Nada das cinco fases ficou de fora. Um detalhe de organização: os commits
  ficaram por *camada* e não estritamente um por fase (regras dos modos; lógica
  da Fase 1; lógica da Fase 2; interface das Fases 1–5), porque a interface das
  cinco fases vive no mesmo `app.js` e não dava para separar com os testes
  passando em cada commit.

## Decisões tomadas sozinho

1. **Arena com só um dentro não pergunta a face.** A especificação pede a face
   "para cada peça que ficou dentro", mas diz também que ela não importa nesse
   caso. Perguntar seria um toque a mais sem efeito. `resolverRodadaArena`
   aceita a face se vier.
2. **Escudo vale na Arena** quando quem ficou fora tinha escudo: anula o dano e é
   consumido (regra 6, comportamento mais simples e consistente).
3. **Modo é escolhido depois do segundo scan** (tela "Como vocês vão jogar?").
   No fluxo manual o modo é escolhido na tela inicial, antes dos bichinhos.
4. **O `?b=` sai da URL** (`history.replaceState`) depois de tratado. Sem isso,
   recarregar a página contaria como um novo scan.
5. **Código digitado não desbloqueia** a coleção; só o `?b=` (QR/NFC) registra,
   como está na especificação. A lista manual do fluxo "Rolar/Arena/Mira" da tela
   inicial continua mostrando os 6 bichinhos (comportamento que já existia).
6. **A tela "Meus bichinhos" (placar antigo, chave
   `arena-dos-bichinhos:placar`) foi substituída** por "Minha coleção". Os dados
   antigos são ignorados; partidas/vitórias agora ficam em `bichinhos:colecao` e
   só contam para bichinhos já descobertos.
7. **Oponente surpresa usa `Math.random`.** É a única aleatoriedade no software
   e não interfere no jogo (a peça continua decidindo tudo). Foi pedido.
8. Na Mira, **só o acerto do vencedor importa**; o app pergunta aos dois porque
   ninguém sabe quem venceu antes de resolver.
9. Ordem na chegada: registra na coleção → calcula o estado de espera → mostra o
   card de desbloqueio (se for novo) → só depois a espera/partida.
10. Se a página for recarregada com uma peça esperando, a tela inicial mostra
    "Couraça está esperando o oponente" com um botão que volta à tela de espera.

## Bônus ajustados (e por quê)

| Modo  | Especificação                 | Final                                  |
|-------|-------------------------------|----------------------------------------|
| Arena | fora leva força + 2           | **força + 1** (`BONUS_FORA = 1`)       |
| Mira  | acertou +2 / errou metade     | **acertou +2, sem somar com o tropeço**; errou metade (floor) |

- **Mira:** com +2 somando ao +2 do tropeço, Salta e Trovão (dano 6) chegariam a
  10 contra Salta (vida 14; teto 8,4). Mesmo +1 estoura (9). A única forma de
  manter algum bônus de acerto sem mexer na tabela foi **não somar**: o extra de
  uma rodada é no máximo +2 (tropeço ou acerto). Quem acerta o alvo *e* pega o
  outro tropeçando causa dano + 2, não + 4. A tela explica isso quando acontece.
- **Arena:** o guarda-corpo passava com +2, mas o simulador (`--modo ARENA`,
  50% de chance de ficar dentro) deixava o Bocão em 44,8–45,2% conforme a
  semente, na borda da faixa de 45%. Com +1 ele fica em 45,3–45,7% em todas as
  sementes e a mediana continua entre 6 e 9 rodadas.

Resultado do simulador (2000 partidas por confronto, semente 1, 50%):

| Modo  | Médias por bichinho | Mediana de rodadas | Fora da faixa |
|-------|---------------------|--------------------|---------------|
| Rolar | 45,9% a 55,3%       | 6 a 11             | 0             |
| Arena | 45,7% a 55,1%       | 6 a 9              | 0             |
| Mira  | 45,9% a 55,9%       | 6 a 14             | 0             |

Na Mira, 5 partidas em 72 000 bateram no limite de 40 rodadas (Casco/Couraça,
escudo + cura + dano pela metade). Está dentro dos critérios pedidos (média e
mediana); anoto porque o README lista "nenhuma partida em 40 rodadas" como alvo
do modo clássico. Se as crianças errarem muito (`--chance 30`), Arena e Mira
ficam mais longos; com 70% ficam mais curtos e ainda dentro da faixa.

## ⚠️ Um risco para você validar no celular

A espera fica em **sessionStorage**, que vale **por aba**. Se o leitor de QR do
celular (câmera do iPhone, Google Lens) abrir **uma aba nova a cada leitura**, o
segundo scan não vai enxergar o primeiro e os dois viram "Jogador 1". Se isso
acontecer no seu teste, a troca é uma linha em `js/app.js`:

```js
const armazemEspera = () => window.localStorage; // era window.sessionStorage
```

A expiração de 10 minutos continua protegendo, e os testes já cobrem os dois
storages (a lógica recebe o storage por parâmetro).

## URLs para testar no celular

Pages: `https://juanmqc22.github.io/Game3D/` (o cache do Pages leva até 10 min;
todos os arquivos estão em `?v=8`).

1. **Loop de escaneio (Fase 1 + 2):**
   - `https://juanmqc22.github.io/Game3D/?b=TAT01` → "Novo bichinho!" → Continuar → espera.
   - `https://juanmqc22.github.io/Game3D/?b=TAT01` de novo → "Esse é o mesmo bichinho!".
   - `https://juanmqc22.github.io/Game3D/?b=SAP04` (mesma aba) → "Como vocês vão jogar?" → Couraça vs Salta.
   - `https://juanmqc22.github.io/Game3D/?b=XYZ99` → erro na tela inicial, nada entra na coleção.
   - Expiração: escaneie um, espere 10 min, escaneie outro → o outro vira Jogador 1.
2. **Fallback:** `?b=SAP02` → Continuar → "Não tenho a segunda peça" → coleção + Oponente surpresa.
3. **Coleção:** `https://juanmqc22.github.io/Game3D/` → "Minha coleção · N de 6".
4. **Arena:** tela inicial → Arena → escolha dois → "Quem ficou dentro do círculo?".
5. **Mira:** tela inicial → Mira → escolha dois → "Acertou o alvo?" em cada painel.
6. **Reduced motion:** ative "Reduzir movimento" no celular e resolva uma rodada:
   o resultado aparece direto.

Local: `npx serve` e as mesmas rotas em `http://localhost:3000/?b=TAT01`.

## Como rodar os testes

```bash
node --test                                   # 209 testes
node scripts/balanceamento.js                 # Rolar
node scripts/balanceamento.js --modo ARENA    # Arena (--chance 50 padrão)
node scripts/balanceamento.js --modo MIRA     # Mira
```
