# Entrega — redesign visual

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
