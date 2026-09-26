// Som da Arena, todo gerado em código com Web Audio: nenhum arquivo de áudio,
// nenhuma biblioteca, nenhuma música existente.
//
// Três modos, no botão do canto: 'tudo' (efeitos + música), 'efeitos' (o
// padrão) e 'mudo'. A escolha fica em localStorage (CHAVE_SOM). O áudio só
// nasce depois do primeiro toque na página (regra do iPhone). Sem Web Audio,
// criarSom() devolve um som que não faz nada e o botão some.

export const CHAVE_SOM = 'bichinhos:som';
export const MODOS_SOM = ['tudo', 'efeitos', 'mudo'];
export const MODO_SOM_PADRAO = 'efeitos';

// ---------- parte pura (testada em test/som.test.js) ----------

export function lerModoSom(storage) {
  try {
    const v = storage.getItem(CHAVE_SOM);
    return MODOS_SOM.includes(v) ? v : MODO_SOM_PADRAO;
  } catch {
    return MODO_SOM_PADRAO;
  }
}

export function gravarModoSom(storage, modo) {
  if (!MODOS_SOM.includes(modo)) return false;
  try {
    storage.setItem(CHAVE_SOM, modo);
    return true;
  } catch {
    return false;
  }
}

// Um toque no botão passa para o próximo: tudo → efeitos → mudo → tudo.
export function proximoModoSom(modo) {
  const i = MODOS_SOM.indexOf(modo);
  return MODOS_SOM[(i + 1) % MODOS_SOM.length];
}

export const TEXTO_MODO_SOM = {
  tudo: 'Som: música e efeitos',
  efeitos: 'Som: só efeitos',
  mudo: 'Som: mudo',
};

// ---------- motor (navegador) ----------

const VOLUME_EFEITOS = 0.32;
const VOLUME_MUSICA = 0.07;

// Loop da música: 4 compassos em colcheias, estilo videogame antigo (onda
// quadrada na melodia, triangular no baixo). Números = notas MIDI; 0 = pausa.
const ANDAMENTO = 138; // batidas por minuto
const MELODIA = [
  72, 76, 79, 76, 74, 77, 81, 77,
  76, 79, 84, 79, 77, 76, 74, 0,
  69, 72, 76, 72, 71, 74, 79, 74,
  72, 76, 79, 84, 83, 79, 74, 0,
];
const BAIXO = [48, 48, 50, 50, 48, 48, 43, 43, 45, 45, 50, 50, 48, 48, 43, 43];

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function criarSom({ janela = globalThis, storage = null } = {}) {
  const Ctx = janela.AudioContext || janela.webkitAudioContext;
  let modo = storage ? lerModoSom(storage) : MODO_SOM_PADRAO;
  const nada = {
    disponivel: false, modo: () => modo, definirModo: () => {}, destravar: () => {}, tocar: () => {},
  };
  if (!Ctx) return nada;

  let ctx = null;
  let efeitos = null;
  let musica = null;
  let ruido = null;
  let relogio = null; // setInterval do agendador da música
  let passo = 0;
  let proximaNota = 0;

  function garantir() {
    if (!ctx) {
      try {
        ctx = new Ctx();
      } catch {
        return null;
      }
      efeitos = ctx.createGain();
      efeitos.gain.value = VOLUME_EFEITOS;
      efeitos.connect(ctx.destination);
      musica = ctx.createGain();
      musica.gain.value = VOLUME_MUSICA;
      musica.connect(ctx.destination);
      // 1 s de ruído branco, reaproveitado por garrada, choque e poeira
      ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const dados = ruido.getChannelData(0);
      let semente = 12345; // ruído determinístico (gerador linear), nada de Math.random
      for (let i = 0; i < dados.length; i++) {
        semente = (semente * 1103515245 + 12345) >>> 0;
        dados[i] = semente / 2147483648 - 1;
      }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // Uma nota com envelope curto. tipo: sine | square | triangle | sawtooth.
  function nota(tipo, de, para, inicio, dur, vol = 0.5, destino = efeitos) {
    const t = ctx.currentTime + inicio;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(de, t);
    if (para !== de) osc.frequency.exponentialRampToValueAtTime(Math.max(20, para), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(destino);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Ruído filtrado (arranhão, pancada, poeira).
  function chiado(filtro, freq, inicio, dur, vol = 0.5) {
    const t = ctx.currentTime + inicio;
    const fonte = ctx.createBufferSource();
    fonte.buffer = ruido;
    const f = ctx.createBiquadFilter();
    f.type = filtro;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    fonte.connect(f).connect(g).connect(efeitos);
    fonte.start(t, (inicio * 7919) % 0.5);
    fonte.stop(t + dur + 0.02);
  }

  const SONS = {
    toque: () => nota('square', 880, 660, 0, 0.05, 0.18),
    // três arranhões rápidos
    garrada: () => {
      for (const t of [0, 0.055, 0.11]) chiado('bandpass', 2600, t, 0.06, 0.6);
      nota('sawtooth', 420, 140, 0, 0.14, 0.18);
    },
    // pancada grave + "ting" do escudo
    defesa: () => {
      nota('triangle', 170, 80, 0, 0.14, 0.7);
      nota('sine', 1250, 1250, 0.03, 0.2, 0.16);
    },
    // escorregão que cai
    tropeco: () => {
      nota('triangle', 560, 150, 0, 0.32, 0.5);
      nota('square', 300, 110, 0.16, 0.24, 0.1);
    },
    // os dois batem: estalo + duas notas brigando
    choque: () => {
      chiado('lowpass', 1400, 0, 0.14, 0.7);
      nota('square', 220, 200, 0, 0.13, 0.12);
      nota('square', 233, 212, 0, 0.13, 0.12);
    },
    // Batalha: o pião que girou mais (sobe rodando) e o que saiu (cai longe)
    giro: () => {
      nota('triangle', 300, 900, 0, 0.18, 0.45);
      nota('triangle', 450, 1300, 0.08, 0.16, 0.25);
    },
    fora: () => {
      chiado('lowpass', 900, 0, 0.12, 0.6);
      nota('sine', 700, 180, 0.04, 0.3, 0.35);
    },
    // Língua Chicote: estica (slurp subindo), estala e volta
    'especial-lingua': () => {
      nota('sine', 260, 1500, 0, 0.18, 0.5);
      nota('square', 1700, 1700, 0.19, 0.03, 0.14);
      nota('sine', 1300, 420, 0.32, 0.26, 0.4);
    },
    // Bola de Ferro: assobio caindo, depois o baque pesado com poeira
    'especial-bola': () => {
      nota('sine', 1500, 320, 0, 0.35, 0.22);
      nota('sine', 95, 38, 0.36, 0.36, 0.95);
      chiado('lowpass', 500, 0.36, 0.3, 0.8);
    },
    // os outros especiais: brilho em arpejo
    'especial-estrela': () => {
      [1047, 1319, 1568, 2093].forEach((f, i) => nota('square', f, f, i * 0.06, 0.09, 0.14));
    },
    // VS: o confronto — sopro subindo, estrondo grave e um "clang" metálico
    vs: () => {
      chiado('bandpass', 900, 0, 0.18, 0.35);
      nota('sine', 110, 42, 0.02, 0.42, 0.95);
      chiado('lowpass', 700, 0.02, 0.3, 0.8);
      nota('square', 587, 587, 0.03, 0.2, 0.12);
      nota('square', 880, 880, 0.03, 0.26, 0.1);
      nota('sine', 2200, 2100, 0.05, 0.3, 0.08);
    },
    // vitória: fanfarra curta
    vitoria: () => {
      [523, 659, 784].forEach((f, i) => nota('square', f, f, i * 0.11, 0.1, 0.2));
      nota('square', 1047, 1047, 0.33, 0.42, 0.2);
      nota('triangle', 262, 262, 0.33, 0.42, 0.45);
    },
  };

  function agendarMusica() {
    const colcheia = 60 / ANDAMENTO / 2;
    while (proximaNota < ctx.currentTime + 0.15) {
      const inicio = Math.max(0, proximaNota - ctx.currentTime);
      const m = MELODIA[passo % MELODIA.length];
      if (m) nota('square', hz(m), hz(m), inicio, colcheia * 0.85, 0.3, musica);
      if (passo % 2 === 0) {
        const b = BAIXO[(passo / 2) % BAIXO.length];
        nota('triangle', hz(b), hz(b), inicio, colcheia * 1.8, 0.6, musica);
      }
      passo++;
      proximaNota += colcheia;
    }
  }

  function atualizarMusica() {
    const tocando = modo === 'tudo' && ctx && janela.document?.visibilityState !== 'hidden';
    if (tocando && !relogio) {
      proximaNota = ctx.currentTime + 0.05;
      relogio = janela.setInterval(agendarMusica, 40);
    } else if (!tocando && relogio) {
      janela.clearInterval(relogio);
      relogio = null;
    }
  }

  janela.document?.addEventListener?.('visibilitychange', atualizarMusica);

  return {
    disponivel: true,
    modo: () => modo,
    definirModo(novo) {
      if (!MODOS_SOM.includes(novo)) return;
      modo = novo;
      if (storage) gravarModoSom(storage, modo);
      if (modo !== 'mudo') garantir();
      atualizarMusica();
    },
    // Chamar dentro de um toque: cria/destrava o AudioContext (iPhone).
    destravar() {
      if (modo === 'mudo' && !ctx) return;
      if (garantir()) atualizarMusica();
    },
    tocar(nome) {
      if (modo === 'mudo' || !ctx || ctx.state !== 'running' || !SONS[nome]) return;
      try {
        SONS[nome]();
      } catch {
        // som nunca derruba o jogo
      }
    },
  };
}
