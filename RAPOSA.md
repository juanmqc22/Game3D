# Raposa na Fazenda — entrega

**Para jogar:** https://juanmqc22.github.io/Game3D/raposa/

Segundo jogo, para adultos (2 a 6), com as mesmas peças. Blefe semi-cooperativo:
a vila entrega os pedidos do caminhão junto, mas cada um tem encomendas secretas.
O jogo das crianças não mudou (só ganhou o desvio NFC descrito abaixo).

## O que ficou pronto

### Fase 1 — 2 a 3 jogadores (a Raposa é o app): pronta, jogável de ponta a ponta
- Montagem: nomes, bichinho por lista ou etiqueta NFC, modo escolhido pelo número de jogadores.
- Encomendas iniciais em tela privada.
- Dia completo: caminhão → giro → declaração → Duvido → confissão secreta → entrega → mercado → noite.
- Tela de privacidade: capa opaca com o nome ("Passe o celular para Ana"); o conteúdo só é
  criado depois do toque e é apagado ao esconder.
- Mercado com troca registrada e confirmação privada dos dois lados.
- Noite com evento sorteado (roubo da vila, roubo do secreto mais cheio — tatu imune —,
  pedido falso, noite tranquila).
- Fim: ranking da vila vencedora ou a tela da Raposa vencedora.
- Partida guardada no aparelho: recarregar continua do mesmo ponto (o sorteio tem semente no estado).
- Regras resumidas no botão **?**, em qualquer tela.

### Fase 2 — 4 a 6 jogadores (Raposa escondida): pronta, mas menos testada à mesa
- Papel (Fazendeiro/Raposa) na tela privada inicial.
- Noite: o celular passa por todos. A Raposa escolhe quem roubar (ou o celeiro da vila);
  os fazendeiros deixam um palpite anônimo de quem desconfiam (as telas têm a mesma forma,
  para ninguém saber quem agiu).
- Assembleia: palpites da noite à mostra, voto secreto, expulsa quem tiver mais da metade.
  O papel do expulso é revelado. Expulso deixa de jogar.
- A vila só vence com a meta **e** a Raposa expulsa.

### NFC
- `js/desvio-raposa.js` (script clássico, antes do app das crianças): com partida da Raposa
  ativa (`localStorage` `raposa:ativa`, 6 h, renovada a cada jogada), `/?b=CODIGO` vai para
  `/raposa/?b=CODIGO`. Tira o `?b=` da barra antes, para a peça não entrar na coleção das
  crianças. Sem partida ativa, não faz nada. A flag some no fim da partida ou em "Encerrar".
- Na montagem, a peça lida vai para o primeiro jogador sem peça. Em jogo, só avisa.

## Números da simulação (`node scripts/raposa-simulacao.js`, 3000 partidas por cenário)

| Mesa | Vila vence | Vitórias | Tempo est. |
|---|---|---|---|
| moderado x desconfiado (mesa típica a dois) | **54%** | moderado 29%, desconfiado 25% | ~25 min |
| moderado x moderado | 58% | — | ~24 min |
| honesto x honesto | 67% | — | ~24 min |
| honesto x moderado | 62% | honesto 36%, **moderado 26%** | ~24 min |
| moderado x constante | 35% | **moderado 24% > constante 11%** | ~24 min |
| honesto x constante | 38% | honesto 28%, constante 11% | ~24 min |
| 3 jogadores (honesto, moderado, desconfiado) | 49% | 20% / 20% / 10% | ~30 min |
| 4 jogadores (Fase 2) | 26% (Raposa 74%) | meta 54%, Raposa expulsa 43% | ~49 min |
| 6 jogadores (Fase 2) | 41% (Raposa 60%) | meta 72%, Raposa expulsa 57% | ~62 min |

Alvos: vila a dois entre 50% e 65% ✔ · o constante perde para o moderado ✔ · mentir às vezes
compensa (o moderado vence 26% contra um honesto) ✔ · partida a dois de 20–30 min ✔.

Números finais: meta 3 pedidos (2 jog.), 5 (3), 4 (4), 5 (5), 6 (6) · pedidos de 3–4 itens,
prazo de 2 a 4 dias · noite: roubo do secreto 5, tranquila 2, roubo da vila 2, pedido falso 1
(pesos) · a Raposa leva 2 itens do secreto ou 1 da vila (modo app) e 1 item (modo traidor) ·
encomendas de 1 a 4 itens valendo 2 a 4 pontos · 3 estrelas iniciais.

Limites honestos da simulação:
- Os bots duvidam em ~30% das declarações e 3× mais de quem já foi pego. O resultado
  "constante perde" depende de a mesa reagir assim; com gente que nunca duvida, mentir sempre compensa.
- Trocas no mercado não são simuladas.
- Fase 2: os bots só votam em quem foi pego mentindo, então a Raposa ganha demais (74% a 4).
  Pessoas conversando devem achá-la mais. E o tempo estimado (47–62 min) passa dos 30 min.
  Se ficar desequilibrado à mesa, o primeiro ajuste é `META` do número de jogadores.

## Decisões tomadas (a opção mais simples quando o pedido era ambíguo)

1. **Declara-se a face**, não itens soltos. Mentir = declarar outra face.
2. **Celeiro secreto** recebe só a parte positiva de (real − declarado). Declarar a mais vale
   para a vila e não tira nada de ninguém; se for pego no Duvido, é mentira do mesmo jeito.
3. **A estrela do mentiroso pego vai para quem duvidou** (o pedido só dizia "perde 1 estrela").
   Sem isso o mentiroso constante ganhava do moderado em toda configuração testada.
4. **Precisa ter estrela para duvidar**, senão duvidar sairia de graça. Estrela nunca fica negativa.
5. Só **uma pessoa** duvida por declaração (a primeira que tocar).
6. **Todos** passam pela confissão secreta, até quem foi desafiado (só não informa a face):
   assim ninguém descobre nada pelo tempo de cada um.
7. Encomendas se cumprem na confissão secreta (a "própria vez" em tela privada). Cumpriu, recebe uma nova.
8. **Pedidos**: sempre 2 no começo de cada dia; entregue ou vencido só é reposto no dia
   seguinte. Prazo conta o dia em que chegou ("vence hoje" = último dia).
9. **Pedido falso**: descoberto ao entregar, a carga some e não conta. Se vencer sem ser entregue,
   não conta como falha.
10. **Mercado**: trocas só entre celeiros secretos; presente (um lado vazio) é permitido.
11. **Empate** de pontos: todos os empatados vencem. Desempate não existe.
12. Fase 2: expulso sai do jogo (não colhe, não vota, não entra no ranking). A Raposa expulsa
    não rouba mais e a assembleia deixa de acontecer.
13. Montagem sem peça é permitida ("Sem peça" = sem talento). Espécie vem do prefixo do código (TAT/SAP).
14. Plan mode formal não foi usado: ele pararia esperando aprovação, e o pedido era não perguntar nada.

## Arquivos

```
raposa/index.html        telas + resumo das regras
raposa/css/raposa.css    visual (céu dia/noite, animações só transform/opacity)
raposa/js/regras.js      lógica pura dos dois modos (testada)
raposa/js/salvar.js      partida no localStorage + flag do desvio NFC (testada)
raposa/js/desenhos.js    SVG feito à mão: celeiro, caminhão, galinha, milho, leite, ovo, lua, raposa…
raposa/js/app.js         interface e fluxo
js/desvio-raposa.js      desvio mínimo da raiz (único arquivo novo no jogo das crianças)
test/raposa-regras.test.js, test/raposa-desvio.test.js
scripts/raposa-simulacao.js, scripts/raposa-contraste.js
```

Testes: 209 antes → 269 agora (`node --test`), todos passando. Contraste: `node scripts/raposa-contraste.js`.
Cache: ao mudar algo em `raposa/`, suba o `?v=` em `raposa/index.html` e nos imports do topo de `raposa/js/app.js`.

## Visual
- Cores quentes e claras, cantos arredondados, fonte Fredoka (cai na do sistema sem internet).
- Céu escurece na noite (1,5 s), lua sobe; derrota com céu vermelho.
- Momentos: caminhão chegando (1,2 s), carta virando + carimbo no Duvido (1,2 s), olhos da
  Raposa + evento subindo (1,4 s). `prefers-reduced-motion` desliga tudo.
- Botões ≥ 56 px (principais 60–68 px), todo texto ≥ 4,5:1, testado em 360×640 sem rolagem lateral.
