# Arena dos Bichinhos

Árbitro de batalha para os bichinhos colecionáveis impressos em 3D. Cada peça é
um dado de 4 faces (ATAQUE, DEFESA, ESPECIAL, TROPEÇO): as crianças arremessam
as peças e tocam no celular o símbolo que saiu. O app guarda a vida, resolve a
rodada e mostra quem ganhou.

É uma página estática (HTML + CSS + JavaScript puro). Não tem servidor, conta
nem dependências, e funciona sem internet depois de carregada.

## Rodar no computador

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npx serve
```

Abra o endereço que aparecer (normalmente http://localhost:3000).

> Abrir o `index.html` com dois cliques (`file://`) **não funciona**: o
> navegador bloqueia ES modules fora de um servidor.

O arquivo `serve.json` desliga as "clean URLs" do `serve` e manda a raiz para o
`index.html`. Sem ele, `index.html?b=TAT01` é redirecionado para `/index` e
perde o `?b=`. Com ele, as duas formas funcionam: `/?b=TAT01` e
`/index.html?b=TAT01`.

### Testar no celular (mesma rede Wi-Fi)

1. Rode `npx serve` no computador.
2. No terminal, procure a linha **Network**, por exemplo
   `http://192.168.0.12:3000`, e abra esse endereço no celular.
3. Se não abrir, libere o Node.js no firewall do Windows quando ele perguntar.

Para testar o QR de uma peça, abra `http://<endereço>/?b=SAP02`: aparece o
card "Novo bichinho!" e depois a tela de espera. Abra em seguida
`http://<endereço>/?b=TAT01` na mesma aba: a partida Bocão x Couraça é montada.

## Testes

```bash
node --test
```

- `test/regras.test.js`: as regras do jogo (regras 1 a 7, escudo, cura, roubo
  e recuo).
- `test/modos.test.js`: os modos Arena e Mira.
- `test/escaneio.test.js`: o loop de escaneio de duas peças (espera, repetido,
  expiração, inválido).
- `test/colecao.test.js`: a coleção em localStorage.
- `test/criaturas.test.js`: confere os dados dos bichinhos, a busca por código
  e o **guarda-corpo de golpe máximo**: o maior dano possível numa rodada, em
  cada um dos três modos, não pode passar de 60% da vida de nenhum alvo.

## Balanceamento

```bash
node scripts/balanceamento.js
node scripts/balanceamento.js --faces 20,20,20,40
node scripts/balanceamento.js --ajuste SAP06.vida=15,SAP06.recuo=1
node scripts/balanceamento.js --modo ARENA --chance 50
node scripts/balanceamento.js --modo MIRA --chance 50
```

O script simula todos os confrontos (2000 partidas cada) e mostra a taxa de
vitória, a mediana de rodadas, o maior dano numa rodada e a média de cada
bichinho contra o resto do elenco.

- `--faces`: pesos das faces na ordem ATAQUE, DEFESA, ESPECIAL, TROPEÇO. Use
  aqui o resultado dos arremessos reais de uma peça.
- `--ajuste`: testa números novos sem editar a tabela. Campos aceitos: `vida`,
  `forca`, `dano`, `cura` e `recuo`.
- `--modo`: `ROLAR` (padrão), `ARENA` ou `MIRA`. `--chance`: na Arena, chance
  (%) de cada peça parar dentro do círculo; na Mira, de acertar o alvo.

Alvos:

- taxa de vitória entre 30% e 70% em cada confronto;
- mediana entre 5 e 15 rodadas;
- nenhuma partida chegando a 40 rodadas;
- média de cada bichinho entre 45% e 57%.

## Adicionar um bichinho

1. Edite **só** `js/criaturas.js` e acrescente um item em `CRIATURAS`. Se for
   uma espécie nova, acrescente também a espécie em `ESPECIES`.
2. Rode `node --test`. O guarda-corpo reprova especiais fortes demais antes de
   você imprimir a peça.
3. Rode `node scripts/balanceamento.js` e confira os alvos.

## Publicar no GitHub Pages

O repositório já aponta para `https://github.com/juanmqc22/Game3D`.

1. Envie o código:
   ```bash
   git push -u origin main
   ```
2. No GitHub, abra o repositório e vá em **Settings → Pages**.
3. Em **Build and deployment**, escolha:
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Pasta:** `/ (root)`

   Depois clique em **Save**.
4. Em um ou dois minutos, o site fica em:
   **https://juanmqc22.github.io/Game3D/**
5. Os QR codes das peças devem apontar para:
   `https://juanmqc22.github.io/Game3D/?b=TAT01`
   (troque `TAT01` pelo código de cada peça). A forma longa, com
   `index.html?b=TAT01`, também funciona, mas deixa o QR mais denso.

Observações:

- O GitHub Pages não precisa do `serve.json`, porque ele não redireciona
  `index.html`.
- No plano gratuito do GitHub, o Pages só funciona com repositório **público**.
- Depois de publicar, cada `git push` na `main` atualiza o site sozinho.
- A coleção (bichinhos descobertos, partidas e vitórias) fica guardada só no
  navegador de cada celular.

## Modos de jogo

- **Rolar**: o clássico. Cada um arremessa e toca no símbolo que saiu.
- **Arena**: desenhem um círculo no chão (ou usem uma bandeja). Os dois
  arremessam de fora para dentro. Quem ficar fora não causa dano e leva a força
  do outro + 1. Os dois dentro: igual ao Rolar. Nenhum dentro: rodada nula.
- **Mira**: coloquem uma tampa ou um prato a alguns passos. Quem venceu a
  rodada e parou dentro do alvo causa +2 de dano; quem venceu e errou causa
  metade do dano.

## Escanear duas peças

O QR de cada peça abre `?b=CODIGO`. O primeiro scan mostra o bichinho e fica
esperando; o segundo, na mesma aba, monta a partida e pede o modo. Quem só tem
uma peça toca em "Não tenho a segunda peça" e escolhe um oponente da coleção ou
um "Oponente surpresa". A espera dura 10 minutos.
