# Entrega — escaneio, coleção e modos de jogo

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
