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

// Regra 5: dano extra quando o perdedor tirou TROPECO.
export const BONUS_TROPECO = 2;

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

// Resolve uma rodada. Retorna { estado, resumo, fim } — `estado` é um objeto novo.
//
// resumo: {
//   numero, simbolos, vencedor (0|1|null), simboloVencedor,
//   danoBase    — forca (ATAQUE/DEFESA) ou dano do especial
//   bonusTropeco — +2 se o perdedor tirou TROPECO
//   bloqueado   — true se o escudo do perdedor anulou o dano
//   dano        — dano que o perdedor realmente sofreu
//   cura        — vida que o vencedor realmente recuperou
//   recuo       — dano que o vencedor causou em si mesmo
//   escudoAtivado — true se o vencedor ganhou escudo nesta rodada
// }
export function resolverRodada(estado, simboloA, simboloB) {
  if (verificarFim(estado).terminou) {
    throw new Error('A partida já terminou.');
  }
  const simbolos = [simboloA, simboloB];
  const vencedor = vencedorDoConfronto(simboloA, simboloB);
  const jogadores = estado.jogadores.map((j) => ({ ...j }));
  const resumo = {
    numero: estado.rodada + 1,
    simbolos,
    vencedor,
    simboloVencedor: vencedor === null ? null : simbolos[vencedor],
    danoBase: 0,
    bonusTropeco: 0,
    bloqueado: false,
    dano: 0,
    cura: 0,
    recuo: 0,
    escudoAtivado: false,
  };

  if (vencedor !== null) {
    const venc = jogadores[vencedor];
    const perd = jogadores[1 - vencedor];
    const especial = resumo.simboloVencedor === ESPECIAL ? venc.criatura.especial : null;

    // Regra 4: força para ATAQUE/DEFESA, dano do especial para ESPECIAL.
    resumo.danoBase = especial ? especial.dano : venc.criatura.forca;
    // Regra 5.
    resumo.bonusTropeco = simbolos[1 - vencedor] === TROPECO ? BONUS_TROPECO : 0;

    // Regra 6: escudo anula todo o dano da rodada e é consumido.
    if (perd.escudo) {
      resumo.bloqueado = true;
      perd.escudo = false;
    } else {
      resumo.dano = resumo.danoBase + resumo.bonusTropeco;
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
