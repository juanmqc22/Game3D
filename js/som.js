// Som da Arena, todo gerado em código com Web Audio: nenhum arquivo de áudio,
// nenhuma biblioteca, nenhuma música existente. Os efeitos moram aqui (SONS);
// a trilha sonora é dado em js/trilha.js, tocada pelo sequenciador abaixo.
//
// Três modos, no botão do canto: 'tudo' (efeitos + música), 'efeitos' (o
// padrão) e 'mudo'. A escolha fica em localStorage (CHAVE_SOM). O áudio só
// nasce depois do primeiro toque na página (regra do iPhone). Sem Web Audio,
// criarSom() devolve um som que não faz nada e o botão some.

import { FAIXAS, secaoDaVolta, eventosDaSecao, lerAcordes, soma } from './trilha.js?v=16';

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

// A música fica sempre abaixo dos efeitos (test/trilha.test.js confere).
export const VOLUME_EFEITOS = 0.32;
export const VOLUME_MUSICA = 0.12;

// Sequenciador: as notas da trilha (js/trilha.js) são agendadas pelo relógio
// do AudioContext, ANTECEDENCIA segundos à frente. Um setTimeout a cada
// REABASTECE ms só enche essa janela — nenhuma nota depende de timer.
const ANTECEDENCIA = 1.2;
const REABASTECE = 250;
const FADE = 0.5; // troca de faixa

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function criarSom({ janela = globalThis, storage = null } = {}) {
  const Ctx = janela.AudioContext || janela.webkitAudioContext;
  let modo = storage ? lerModoSom(storage) : MODO_SOM_PADRAO;
  const nada = {
    disponivel: false, modo: () => modo, definirModo: () => {}, destravar: () => {}, tocar: () => {}, musica: () => {},
  };
  if (!Ctx) return nada;

  let ctx = null;
  let efeitos = null;
  let musica = null;
  let ruido = null;
  let atual = null; // a faixa tocando: { nome, ganho, faixa, passo, volta, inicio, eventos, cursor, timer, fontes }
  let desejada = null; // a faixa que a tela pediu (toca só no modo 'tudo')

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
      // 1 s de ruído branco, reaproveitado por garrada, choque, poeira e percussão
      ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const dados = ruido.getChannelData(0);
      let semente = 12345; // ruído determinístico (gerador linear), nada de Math.random
      for (let i = 0; i < dados.length; i++) {
        semente = (semente * 1103515245 + 12345) >>> 0;
        dados[i] = semente / 2147483648 - 1;
      }
    }
    if (ctx.state === 'suspended' && janela.document?.visibilityState !== 'hidden') {
      ctx.resume().then(retomar).catch(() => {});
    }
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

  // ---------- os instrumentos da trilha ----------

  // Envelope: sobe em `ataque`, segura até o fim da nota e solta em `soltura`.
  function envelope(t, dur, ataque, soltura, pico, destino) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pico, t + ataque);
    g.gain.setValueAtTime(pico, t + Math.max(ataque, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(ataque, dur) + soltura);
    g.connect(destino);
    return g;
  }

  function oscilador(tipo, freq, cents, t, fim, destino) {
    const o = ctx.createOscillator();
    o.type = tipo;
    o.frequency.value = freq;
    o.detune.value = cents;
    o.connect(destino);
    o.start(t);
    o.stop(fim);
    return o;
  }

  function ruidoFiltrado(tipo, freq, t, decai, pico, destino) {
    const fonte = ctx.createBufferSource();
    fonte.buffer = ruido;
    const f = ctx.createBiquadFilter();
    f.type = tipo;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(pico, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decai);
    fonte.connect(f).connect(g).connect(destino);
    fonte.start(t, (t * 7919) % 0.5);
    fonte.stop(t + decai + 0.02);
    return fonte;
  }

  // Uma nota da trilha. Devolve as fontes (para parar na troca de faixa).
  function voz(e, t, dur, destino) {
    const f = e.midi === null ? 0 : hz(e.midi);
    const v = e.vol;
    switch (e.instr) {
      case 'metal': {
        // fanfarra: dois dentes de serra levemente desafinados, filtro que abre no ataque
        const filtro = ctx.createBiquadFilter();
        filtro.type = 'lowpass';
        filtro.Q.value = 1.4;
        filtro.frequency.setValueAtTime(500, t);
        filtro.frequency.linearRampToValueAtTime(2800, t + 0.05);
        filtro.frequency.linearRampToValueAtTime(1500, t + 0.3);
        filtro.connect(envelope(t, dur * 0.95, 0.03, 0.09, v * 0.2, destino));
        const fim = t + dur + 0.12;
        return [oscilador('sawtooth', f, -7, t, fim, filtro), oscilador('sawtooth', f, 7, t, fim, filtro)];
      }
      case 'cordas': {
        const filtro = ctx.createBiquadFilter();
        filtro.type = 'lowpass';
        filtro.frequency.value = 1700;
        const curta = dur < 0.6;
        filtro.connect(envelope(t, dur * 0.9, curta ? 0.015 : 0.14, curta ? 0.06 : 0.25, v * 0.11, destino));
        const fim = t + dur + 0.3;
        return [oscilador('sawtooth', f, -10, t, fim, filtro), oscilador('sawtooth', f, 10, t, fim, filtro)];
      }
      case 'sino': {
        // parciais inarmônicos, como sino de verdade, decaindo devagar
        const fontes = [];
        [[1, 1], [2.76, 0.45], [5.4, 0.2]].forEach(([mult, peso]) => {
          const g = ctx.createGain();
          g.gain.setValueAtTime(v * 0.1 * peso, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
          g.connect(destino);
          fontes.push(oscilador('sine', f * mult, 0, t, t + 1.65, g));
        });
        return fontes;
      }
      case 'celesta': {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(v * 0.15, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.5, dur));
        g.connect(destino);
        const brilho = ctx.createGain();
        brilho.gain.value = 0.18;
        brilho.connect(g);
        const fim = t + Math.max(0.5, dur) + 0.02;
        return [oscilador('triangle', f, 0, t, fim, g), oscilador('sine', f * 4, 0, t, fim, brilho)];
      }
      case 'baixo':
        return [oscilador('triangle', f, 0, t, t + dur + 0.1, envelope(t, dur * 0.9, 0.01, 0.06, v * 0.38, destino))];
      case 'bumbo': {
        const g = ctx.createGain();
        g.gain.setValueAtTime(v * 0.6, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        g.connect(destino);
        const o = oscilador('sine', 130, 0, t, t + 0.27, g);
        o.frequency.setValueAtTime(130, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.14);
        return [o];
      }
      case 'caixa':
        return [ruidoFiltrado('bandpass', 1900, t, 0.12, v * 0.3, destino)];
      case 'chimbal':
        return [ruidoFiltrado('highpass', 7500, t, 0.045, v * 0.12, destino)];
      case 'prato':
        return [ruidoFiltrado('highpass', 5000, t, 1.1, v * 0.14, destino)];
      default:
        return [];
    }
  }

  // ---------- o sequenciador ----------

  function carregarSecao(f) {
    const sec = f.faixa.ordem[f.passo];
    const s = secaoDaVolta(f.nome, sec, f.volta);
    f.eventos = eventosDaSecao(s);
    f.batidas = soma(lerAcordes(s.acordes));
    f.cursor = 0;
  }

  function agendar(f) {
    if (atual !== f) return;
    const spb = 60 / f.faixa.andamento;
    const horizonte = ctx.currentTime + ANTECEDENCIA;
    for (;;) {
      if (f.cursor < f.eventos.length) {
        const e = f.eventos[f.cursor];
        const t = f.inicio + e.inicio * spb;
        if (t > horizonte) break;
        if (t >= ctx.currentTime - 0.05) {
          for (const fonte of voz(e, Math.max(t, ctx.currentTime), e.dur * spb, f.ganho)) {
            f.fontes.add(fonte);
            fonte.onended = () => f.fontes.delete(fonte);
          }
        }
        f.cursor++;
        continue;
      }
      // fim da seção: a próxima começa logo depois (ou a faixa acaba)
      const proxima = f.inicio + f.batidas * spb;
      if (f.passo + 1 >= f.faixa.ordem.length) {
        if (!f.faixa.repete) {
          janela.setTimeout(() => { if (atual === f) parar(f, 0.05); }, Math.max(0, proxima - ctx.currentTime + 1.5) * 1000);
          return;
        }
        f.volta++;
      }
      f.passo = (f.passo + 1) % f.faixa.ordem.length;
      f.inicio = proxima;
      carregarSecao(f);
      if (proxima > horizonte) break;
    }
    f.timer = janela.setTimeout(() => agendar(f), REABASTECE);
  }

  function parar(f, fade = FADE) {
    if (!f) return;
    janela.clearTimeout(f.timer);
    if (atual === f) atual = null;
    const agora = ctx.currentTime;
    f.ganho.gain.cancelScheduledValues(agora);
    f.ganho.gain.setValueAtTime(Math.max(0.0001, f.ganho.gain.value), agora);
    f.ganho.gain.exponentialRampToValueAtTime(0.0001, agora + fade);
    for (const fonte of f.fontes) {
      try {
        fonte.stop(agora + fade + 0.02);
      } catch {
        // já parou
      }
    }
    janela.setTimeout(() => f.ganho.disconnect(), (fade + 0.3) * 1000);
  }

  // Troca a faixa com fade de FADE s (nome null = silêncio).
  function trocar(nome) {
    if (atual?.nome === nome && nome) return;
    parar(atual);
    if (!nome || !FAIXAS[nome] || modo !== 'tudo' || !ctx || ctx.state !== 'running') return;
    const agora = ctx.currentTime;
    const ganho = ctx.createGain();
    ganho.gain.setValueAtTime(0.0001, agora);
    ganho.gain.exponentialRampToValueAtTime(1, agora + FADE);
    ganho.connect(musica);
    const f = { nome, ganho, faixa: FAIXAS[nome], passo: 0, volta: 0, inicio: agora + 0.08, fontes: new Set(), timer: null };
    carregarSecao(f);
    atual = f;
    agendar(f);
  }

  // Depois de destravar ou voltar para a aba: retoma a faixa de fundo pedida.
  function retomar() {
    if (modo === 'tudo' && !atual && desejada && FAIXAS[desejada]?.repete) trocar(desejada);
  }

  // Aba escondida: o áudio dorme (e a música para de gastar CPU).
  janela.document?.addEventListener?.('visibilitychange', () => {
    if (!ctx) return;
    if (janela.document.visibilityState === 'hidden') ctx.suspend().catch(() => {});
    else if (modo !== 'mudo') ctx.resume().then(retomar).catch(() => {});
  });

  return {
    disponivel: true,
    modo: () => modo,
    definirModo(novo) {
      if (!MODOS_SOM.includes(novo)) return;
      modo = novo;
      if (storage) gravarModoSom(storage, modo);
      if (modo !== 'mudo') garantir();
      if (modo === 'tudo') retomar();
      else trocar(null);
    },
    // Chamar dentro de um toque: cria/destrava o AudioContext (iPhone).
    destravar() {
      if (modo === 'mudo' && !ctx) return;
      if (garantir() && ctx.state === 'running') retomar();
    },
    tocar(nome) {
      if (modo === 'mudo' || !ctx || ctx.state !== 'running' || !SONS[nome]) return;
      try {
        SONS[nome]();
      } catch {
        // som nunca derruba o jogo
      }
    },
    // A tela pede uma faixa (js/trilha.js): 'tema', 'batalha', ou um estinger
    // ('vs', 'vitoria', 'derrota', que tocam uma vez). Só soa no modo 'tudo'.
    musica(nome) {
      desejada = nome;
      if (modo !== 'tudo' || !ctx || ctx.state !== 'running') return;
      try {
        if (FAIXAS[nome] && !FAIXAS[nome].repete) {
          parar(atual);
          trocar(nome);
        } else {
          trocar(nome);
        }
      } catch {
        // música nunca derruba o jogo
      }
    },
  };
}
