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

O arquivo `serve.json` desliga as "clean URLs" do `serve`. Sem ele, o endereço
`index.html?b=TAT01` é redirecionado para `/index` e perde o `?b=`.

### Testar no celular (mesma rede Wi-Fi)

1. Rode `npx serve` no computador.
2. No terminal, procure a linha **Network**, por exemplo
   `http://192.168.0.12:3000`, e abra esse endereço no celular.
3. Se não abrir, libere o Node.js no firewall do Windows quando ele perguntar.

Para testar o QR de uma peça, abra `http://<endereço>/index.html?b=SAP02`: a
tela de escolha deve abrir com o Bocão já marcado.

## Testes

```bash
node --test
```

- `test/regras.test.js`: as regras do jogo (regras 1 a 7, escudo, cura, roubo
  e recuo).
- `test/criaturas.test.js`: confere os dados dos bichinhos, a busca por código
  e o **guarda-corpo de golpe máximo**: o maior dano mais os 2 do TROPEÇO não
  pode passar de 60% da vida de nenhum alvo.

## Balanceamento

```bash
node scripts/balanceamento.js
node scripts/balanceamento.js --faces 20,20,20,40
node scripts/balanceamento.js --ajuste SAP06.vida=15,SAP06.recuo=1
```

O script simula todos os confrontos (2000 partidas cada) e mostra a taxa de
vitória, a mediana de rodadas, o maior dano numa rodada e a média de cada
bichinho contra o resto do elenco.

- `--faces`: pesos das faces na ordem ATAQUE, DEFESA, ESPECIAL, TROPEÇO. Use
  aqui o resultado dos arremessos reais de uma peça.
- `--ajuste`: testa números novos sem editar a tabela. Campos aceitos: `vida`,
  `forca`, `dano`, `cura` e `recuo`.

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
   `https://juanmqc22.github.io/Game3D/index.html?b=TAT01`
   (troque `TAT01` pelo código de cada peça).

Observações:

- O GitHub Pages não precisa do `serve.json`, porque ele não redireciona
  `index.html`.
- No plano gratuito do GitHub, o Pages só funciona com repositório **público**.
- Depois de publicar, cada `git push` na `main` atualiza o site sozinho.
- O placar (vitórias e derrotas) fica guardado só no navegador de cada celular.
