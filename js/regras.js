// Regras da Arena dos Bichinhos — único lugar onde elas vivem.
// Funções puras: sem DOM, sem estado global, nunca alteram a entrada.
//
// Estado da partida:
//   { rodada: number, jogadores: [ { criatura, vida, escudo }, { ... } ] }
// Jogadores são identificados pelo índice: 0 (jogador 1) e 1 (jogador 2).

export const ATAQUE = 'ATAQUE';
export const DEFESA = 'DEFESA';
export const ESPECIAL = 'ESPECIAL';
export const TROPECO = 'TROPECO';
export const SIMBOLOS = [ATAQUE, DEFESA, ESPECIAL, TROPECO];

// Modos de jogo. ROLAR é o clássico; ARENA e MIRA reaproveitam as regras 1 a 7
// e acrescentam um modificador de dano (ver resolverRodadaArena / resolverRodadaMira).
export const ROLAR = 'ROLAR';
export const ARENA = 'ARENA';
export const MIRA = 'MIRA';
export const MODOS = [ROLAR, ARENA, MIRA];

// Choque: mesmo símbolo dos dois lados (exceto TROPECO x TROPECO) → cada um
// perde este tanto. O escudo anula o choque e é consumido. 0 desliga (volta a
// ser o empate seco da regra 3). Vale nos três modos, sem bônus de modo.
export const CHOQUE_DANO = 1;

// Regra 5: dano extra quando o perdedor tirou TROPECO.
export const BONUS_TROPECO = 2;
// ARENA: quem ficou fora do círculo leva a força do adversário + este bônus.
// Era +2 na especificação; com +2 o Bocão fica em ~44,8% no simulador (abaixo
// da faixa de 45%), com +1 fica em ~45,5% em todas as sementes.
export const BONUS_FORA = 1;
// MIRA: quem venceu e acertou o alvo causa este bônus a mais. Não soma com o
// bônus do TROPECO: o extra de uma rodada nunca passa de +2 (guarda-corpo de
// 60% da vida em test/criaturas.test.js).
export const BONUS_ACERTO = 2;
// MIRA: quem venceu e errou o alvo causa metade do dano (arredondado para baixo).
export const DIVISOR_ERRO = 2;

// Regra 1: cada símbolo vence o símbolo indicado.
const VENCE = {
  [ESPECIAL]: ATAQUE,
  [ATAQUE]: DEFESA,
  [DEFESA]: ESPECIAL,
};

export function estadoInicial(criaturaA, criaturaB) {
  return {
    rodada: 0,
    jogadores: [criaturaA, criaturaB].map((criatura) => ({
      criatura,
      vida: criatura.vida,
      escudo: false,
    })),
  };
}

// Retorna 0 se `a` vence, 1 se `b` vence, null se empate.
export function vencedorDoConfronto(a, b) {
  validarSimbolo(a);
  validarSimbolo(b);
  if (a === b) return null; // regra 3 (inclui TROPECO x TROPECO)
  if (b === TROPECO) return 0; // regra 2
  if (a === TROPECO) return 1;
  return VENCE[a] === b ? 0 : 1; // regra 1
}

// Regra 7. Retorna { terminou: false } ou { terminou: true, vencedor: 0 | 1 | null }.
export function verificarFim(estado) {
  const [a, b] = estado.jogadores.map((j) => j.vida <= 0);
  if (a && b) return { terminou: true, vencedor: null };
  if (a) return { terminou: true, vencedor: 1 };
  if (b) return { terminou: true, vencedor: 0 };
  return { terminou: false };
}

// Resolve uma rodada do modo ROLAR (clássico). Retorna { estado, resumo, fim } —
// `estado` é um objeto novo.
//
// resumo: {
//   modo, numero, simbolos, vencedor (0|1|null), simboloVencedor,
//   nula         — true quando a rodada não conta (ARENA: ninguém dentro)
//   dentro       — [bool, bool] só em ARENA;  acertou — [bool, bool] só em MIRA
//   danoBase     — forca (ATAQUE/DEFESA/fora do círculo) ou dano do especial
//   bonusTropeco — +2 se o perdedor tirou TROPECO
//   bonusFora    — +2 se o perdedor ficou fora do círculo (ARENA)
//   bonusAcerto  — +2 se o vencedor acertou o alvo (MIRA), limitado pelo teto do extra
//   metade       — true se o vencedor errou o alvo (MIRA) e o dano caiu pela metade
//   danoPrevisto — dano calculado, antes do escudo
//   bloqueado    — true se o escudo do perdedor anulou o dano
//   dano         — dano que o perdedor realmente sofreu
//   cura         — vida que o vencedor realmente recuperou
//   recuo        — dano que o vencedor causou em si mesmo
//   escudoAtivado — true se o vencedor ganhou escudo nesta rodada
//   choque       — true se foi empate de símbolos iguais (não TROPECO) com CHOQUE_DANO > 0
//   danoChoque   — [n, n] vida que cada um perdeu no choque (0 onde o escudo segurou)
//   choqueBloqueado — [bool, bool] escudo de quem anulou o choque (e acabou)
// }
export function resolverRodada(estado, simboloA, simboloB) {
  const simbolos = [simboloA, simboloB];
  return resolver(estado, {
    modo: ROLAR,
    simbolos,
    vencedor: vencedorDoConfronto(simboloA, simboloB),
    usarEspecial: true,
  });
}

// Modo ARENA. dentro = [bool, bool] (quem ficou dentro do círculo);
// simbolos = [s, s] (só importam quando os dois ficaram dentro).
//   - os dois dentro: igual ao modo ROLAR;
//   - só um dentro: ele vence, a face não importa, o outro leva forca + BONUS_FORA;
//   - nenhum dentro: rodada nula.
// O escudo continua valendo (regra 6): anula qualquer dano recebido.
export function resolverRodadaArena(estado, dentro, simbolos = [null, null]) {
  validarDupla(dentro, 'dentro');
  const [da, db] = dentro;
  if (da && db) {
    return resolver(estado, {
      modo: ARENA, dentro, simbolos: [simbolos[0], simbolos[1]],
      vencedor: vencedorDoConfronto(simbolos[0], simbolos[1]), usarEspecial: true,
    });
  }
  if (!da && !db) {
    return resolver(estado, { modo: ARENA, dentro, simbolos: [null, null], vencedor: null, nula: true });
  }
  const vencedor = da ? 0 : 1;
  const face = simbolos[vencedor] ?? null;
  if (face !== null) validarSimbolo(face);
  const mostrados = [null, null];
  mostrados[vencedor] = face;
  return resolver(estado, {
    modo: ARENA, dentro, simbolos: mostrados, vencedor, usarEspecial: false, bonusFora: BONUS_FORA,
  });
}

// Modo MIRA. acertou = [bool, bool] (quem parou dentro do alvo); simbolos = [s, s].
// Resolve como ROLAR e aplica ao dano do vencedor:
//   - acertou: +BONUS_ACERTO (o extra da rodada, tropeço + acerto, não passa de +2);
//   - errou: dano dividido por DIVISOR_ERRO, arredondado para baixo.
// Cura, recuo e escudo não mudam.
export function resolverRodadaMira(estado, acertou, simbolos) {
  validarDupla(acertou, 'acertou');
  const vencedor = vencedorDoConfronto(simbolos[0], simbolos[1]);
  return resolver(estado, {
    modo: MIRA, acertou, simbolos: [simbolos[0], simbolos[1]], vencedor, usarEspecial: true,
    acertouAlvo: vencedor === null ? null : acertou[vencedor],
  });
}

// Porta única para a interface e o simulador. entradas = [{ simbolo, dentro, acertou }, { ... }].
export function resolverRodadaModo(modo, estado, entradas) {
  const simbolos = entradas.map((e) => e.simbolo ?? null);
  if (modo === ROLAR) return resolverRodada(estado, simbolos[0], simbolos[1]);
  if (modo === ARENA) return resolverRodadaArena(estado, entradas.map((e) => Boolean(e.dentro)), simbolos);
  if (modo === MIRA) return resolverRodadaMira(estado, entradas.map((e) => Boolean(e.acertou)), simbolos);
  throw new Error(`Modo inválido: ${modo}`);
}

// Maior dano que `atacante` consegue causar numa única rodada do modo, contra um
// alvo com vida cheia e sem escudo. Calculado por força bruta com as próprias
// funções de resolução, para nunca divergir das regras.
export function danoMaximoDoModo(modo, atacante, alvo = atacante) {
  const estado = estadoInicial(atacante, alvo);
  let maior = 0;
  const testar = (entradas) => {
    const { resumo } = resolverRodadaModo(modo, estado, entradas);
    if (resumo.vencedor === 0) maior = Math.max(maior, resumo.dano);
  };
  const bools = [false, true];
  for (const sa of SIMBOLOS) {
    for (const sb of SIMBOLOS) {
      if (modo === ROLAR) testar([{ simbolo: sa }, { simbolo: sb }]);
      if (modo === ARENA) {
        for (const da of bools) {
          for (const db of bools) testar([{ simbolo: sa, dentro: da }, { simbolo: sb, dentro: db }]);
        }
      }
      if (modo === MIRA) {
        for (const aa of bools) {
          for (const ab of bools) testar([{ simbolo: sa, acertou: aa }, { simbolo: sb, acertou: ab }]);
        }
      }
    }
  }
  return maior;
}

// ---------- núcleo comum aos três modos ----------

function resolver(estado, plano) {
  if (verificarFim(estado).terminou) {
    throw new Error('A partida já terminou.');
  }
  const { modo, simbolos, vencedor } = plano;
  const jogadores = estado.jogadores.map((j) => ({ ...j }));
  const resumo = {
    modo,
    numero: estado.rodada + 1,
    simbolos,
    nula: Boolean(plano.nula),
    dentro: plano.dentro ?? null,
    acertou: plano.acertou ?? null,
    vencedor,
    simboloVencedor: vencedor === null ? null : simbolos[vencedor],
    danoBase: 0,
    bonusTropeco: 0,
    bonusFora: 0,
    bonusAcerto: 0,
    metade: false,
    danoPrevisto: 0,
    bloqueado: false,
    dano: 0,
    cura: 0,
    recuo: 0,
    escudoAtivado: false,
    choque: false,
    danoChoque: [0, 0],
    choqueBloqueado: [false, false],
  };

  // Choque: os dois tiraram o mesmo símbolo (menos TROPECO) e cada um perde CHOQUE_DANO.
  if (vencedor === null && !resumo.nula && CHOQUE_DANO > 0
      && simbolos[0] !== null && simbolos[0] === simbolos[1] && simbolos[0] !== TROPECO) {
    resumo.choque = true;
    jogadores.forEach((j, i) => {
      if (j.escudo) {
        resumo.choqueBloqueado[i] = true;
        j.escudo = false;
      } else {
        resumo.danoChoque[i] = CHOQUE_DANO;
        j.vida = limitarVida(j.vida - CHOQUE_DANO, j.criatura);
      }
    });
  }

  if (vencedor !== null) {
    const venc = jogadores[vencedor];
    const perd = jogadores[1 - vencedor];
    const especial = plano.usarEspecial && resumo.simboloVencedor === ESPECIAL ? venc.criatura.especial : null;

    // Regra 4: força para ATAQUE/DEFESA, dano do especial para ESPECIAL.
    resumo.danoBase = especial ? especial.dano : venc.criatura.forca;
    // Regra 5.
    resumo.bonusTropeco = simbolos[1 - vencedor] === TROPECO ? BONUS_TROPECO : 0;
    // ARENA: perdedor ficou fora do círculo.
    resumo.bonusFora = plano.bonusFora ?? 0;
    // MIRA: o extra da rodada (tropeço + acerto) tem teto de BONUS_ACERTO.
    if (plano.acertouAlvo === true) {
      resumo.bonusAcerto = Math.max(0, BONUS_ACERTO - resumo.bonusTropeco);
    }
    let total = resumo.danoBase + resumo.bonusTropeco + resumo.bonusFora + resumo.bonusAcerto;
    if (plano.acertouAlvo === false) {
      resumo.metade = true;
      total = Math.floor(total / DIVISOR_ERRO);
    }
    resumo.danoPrevisto = total;

    // Regra 6: escudo anula todo o dano da rodada e é consumido.
    if (perd.escudo) {
      resumo.bloqueado = true;
      perd.escudo = false;
    } else {
      resumo.dano = total;
      perd.vida = limitarVida(perd.vida - resumo.dano, perd.criatura);
    }

    if (especial) {
      // Cura própria sempre acontece; roubo só se o dano passou.
      // A cura é o valor fixo do especial, mesmo com o bônus do TROPECO.
      if (especial.cura > 0 && !(especial.roubo && resumo.bloqueado)) {
        const antes = venc.vida;
        venc.vida = limitarVida(venc.vida + especial.cura, venc.criatura);
        resumo.cura = venc.vida - antes;
      }
      // Recuo sempre acontece, ignora escudo e pode zerar o vencedor.
      if (especial.recuo > 0) {
        resumo.recuo = especial.recuo;
        venc.vida = limitarVida(venc.vida - especial.recuo, venc.criatura);
      }
      // Escudo não acumula.
      if (especial.escudo && !venc.escudo) {
        venc.escudo = true;
        resumo.escudoAtivado = true;
      }
    }
  }

  const novoEstado = { rodada: estado.rodada + 1, jogadores };
  return { estado: novoEstado, resumo, fim: verificarFim(novoEstado) };
}

// Regra 7: vida entre 0 e a vida inicial.
function limitarVida(vida, criatura) {
  return Math.max(0, Math.min(criatura.vida, vida));
}

function validarSimbolo(s) {
  if (!SIMBOLOS.includes(s)) {
    throw new Error(`Símbolo inválido: ${s}`);
  }
}

function validarDupla(lista, nome) {
  if (!Array.isArray(lista) || lista.length !== 2 || lista.some((x) => typeof x !== 'boolean')) {
    throw new Error(`${nome} deve ser [boolean, boolean]`);
  }
}
