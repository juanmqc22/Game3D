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

// Modos de jogo. ROLAR é o clássico; MIRA reaproveita as regras 1 a 7 e
// acrescenta um modificador de dano. ARENA (na tela: "Batalha") não usa as
// faces: diz só quem ganhou e como (ver resolverRodadaArena).
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
// ARENA: como o vencedor ganhou. GIROU = o pião dele girou mais tempo;
// FORA = ele jogou o outro para fora da bandeja. O vencedor causa a própria
// força + o bônus do jeito. Empate = Choque. As faces não contam e nenhum
// especial ativa. Medido no simulador: ver ENTREGA.md.
export const GIROU = 'GIROU';
export const FORA = 'FORA';
export const JEITOS = [GIROU, FORA];
export const BONUS_GIROU = 1;
export const BONUS_FORA = 2;
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
//   jeito        — GIROU | FORA | null, só em ARENA;  acertou — [bool, bool] só em MIRA
//   danoBase     — forca (ATAQUE/DEFESA/ARENA) ou dano do especial
//   bonusTropeco — +2 se o perdedor tirou TROPECO
//   bonusGirou   — ARENA: o pião do vencedor girou mais (BONUS_GIROU)
//   bonusFora    — ARENA: o vencedor jogou o outro para fora (BONUS_FORA)
//   bonusAcerto  — +2 se o vencedor acertou o alvo (MIRA), limitado pelo teto do extra
//   metade       — true se o vencedor errou o alvo (MIRA) e o dano caiu pela metade
//   danoPrevisto — dano calculado, antes do escudo
//   bloqueado    — true se o escudo do perdedor anulou o dano
//   dano         — dano que o perdedor realmente sofreu
//   cura         — vida que o vencedor realmente recuperou
//   recuo        — dano que o vencedor causou em si mesmo
//   escudoAtivado — true se o vencedor ganhou escudo nesta rodada
//   choque       — true se foi empate de símbolos iguais (não TROPECO), ou empate
//                  na ARENA, com CHOQUE_DANO > 0
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

// Modo ARENA ("Batalha"): um toque diz quem ganhou e como.
//   vencedor 0 | 1, jeito GIROU → forca do vencedor + BONUS_GIROU;
//   vencedor 0 | 1, jeito FORA  → forca do vencedor + BONUS_FORA;
//   vencedor null (empate)      → Choque: cada um perde CHOQUE_DANO.
// Sem faces e sem especial. O escudo continua valendo (regra 6), também no choque.
export function resolverRodadaArena(estado, vencedor, jeito = null) {
  if (vencedor === null) {
    return resolver(estado, { modo: ARENA, simbolos: [null, null], vencedor: null, jeito: null, choque: true });
  }
  if (vencedor !== 0 && vencedor !== 1) throw new Error(`vencedor inválido: ${vencedor}`);
  if (!JEITOS.includes(jeito)) throw new Error(`jeito inválido: ${jeito}`);
  return resolver(estado, {
    modo: ARENA, simbolos: [null, null], vencedor, jeito, usarEspecial: false,
    bonusGirou: jeito === GIROU ? BONUS_GIROU : 0,
    bonusFora: jeito === FORA ? BONUS_FORA : 0,
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

// Porta única para a interface e o simulador. entradas = [{ simbolo, acertou, ganhou }, { ... }].
// ARENA: ganhou = GIROU | FORA em quem venceu (no máximo um); nenhum = empate.
export function resolverRodadaModo(modo, estado, entradas) {
  const simbolos = entradas.map((e) => e.simbolo ?? null);
  if (modo === ROLAR) return resolverRodada(estado, simbolos[0], simbolos[1]);
  if (modo === ARENA) {
    const ganharam = [0, 1].filter((i) => entradas[i].ganhou);
    if (ganharam.length > 1) throw new Error('ARENA: só um jogador ganha a rodada');
    const v = ganharam.length ? ganharam[0] : null;
    return resolverRodadaArena(estado, v, v === null ? null : entradas[v].ganhou);
  }
  if (modo === MIRA) return resolverRodadaMira(estado, entradas.map((e) => Boolean(e.acertou)), simbolos);
  throw new Error(`Modo inválido: ${modo}`);
}

// O nome do golpe da rodada, que a tela escreve em letras grandes no lugar de
// "venceu/perdeu" (quem venceu a partida só aparece na tela de fim). Recebe o
// resumo de uma resolução e devolve um código:
//   ESPECIAL   — a face ESPECIAL venceu (a tela usa o nome do especial)
//   TROPECOU   — o perdedor tirou TROPECO (vale mais que GARRADA/DEFENDEU)
//   GARRADA    — venceu com ATAQUE;  DEFENDEU — venceu com DEFESA
//   GIROU/FORA — Batalha: como o vencedor ganhou
//   CHOQUE     — mesmo símbolo dos dois lados, ou empate na Batalha
//   TROPECARAM — TROPECO x TROPECO: ninguém perde vida
//   EMPATE     — empate sem choque (só com CHOQUE_DANO = 0)
export function golpeDaRodada(resumo) {
  if (resumo.choque) return 'CHOQUE';
  if (resumo.vencedor === null) {
    return resumo.simbolos[0] === TROPECO && resumo.simbolos[1] === TROPECO ? 'TROPECARAM' : 'EMPATE';
  }
  if (resumo.jeito) return resumo.jeito;
  if (resumo.simboloVencedor === ESPECIAL) return 'ESPECIAL';
  if (resumo.simbolos[1 - resumo.vencedor] === TROPECO) return 'TROPECOU';
  return resumo.simboloVencedor === DEFESA ? 'DEFENDEU' : 'GARRADA';
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
  if (modo === ARENA) {
    for (const jeito of JEITOS) testar([{ ganhou: jeito }, {}]);
    return maior;
  }
  for (const sa of SIMBOLOS) {
    for (const sb of SIMBOLOS) {
      if (modo === ROLAR) testar([{ simbolo: sa }, { simbolo: sb }]);
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
    jeito: plano.jeito ?? null,
    acertou: plano.acertou ?? null,
    vencedor,
    simboloVencedor: vencedor === null ? null : simbolos[vencedor],
    danoBase: 0,
    bonusTropeco: 0,
    bonusGirou: 0,
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

  // Choque: os dois tiraram o mesmo símbolo (menos TROPECO), ou empate na
  // ARENA, e cada um perde CHOQUE_DANO.
  const mesmoSimbolo = simbolos[0] !== null && simbolos[0] === simbolos[1] && simbolos[0] !== TROPECO;
  if (vencedor === null && CHOQUE_DANO > 0 && (plano.choque || mesmoSimbolo)) {
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
    // ARENA: como o vencedor ganhou.
    resumo.bonusGirou = plano.bonusGirou ?? 0;
    resumo.bonusFora = plano.bonusFora ?? 0;
    // MIRA: o extra da rodada (tropeço + acerto) tem teto de BONUS_ACERTO.
    if (plano.acertouAlvo === true) {
      resumo.bonusAcerto = Math.max(0, BONUS_ACERTO - resumo.bonusTropeco);
    }
    let total = resumo.danoBase + resumo.bonusTropeco + resumo.bonusGirou + resumo.bonusFora + resumo.bonusAcerto;
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
