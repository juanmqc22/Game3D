// Trilha sonora da Arena, como dados: melodias, acordes e arranjo de cada
// faixa. Tudo original, composto para o jogo. Nenhum som mora aqui — quem toca
// é o sequenciador de js/som.js (Web Audio). Funções puras, testadas em
// test/trilha.test.js.
//
// Notação: "E5/1 G5/.5 -/.5" = nota/duração em batidas ("-" é pausa).
// Acordes: "C/4 Bb/4 D/2 G/2" = acorde/duração em batidas. Qualidades: maior
// (C), menor (Am), com sétima de dominante (G7).
//
// Clima: aventura de colecionar criaturas num mundo mágico escondido. Tons
// maiores com toques modais (o II maior lídio e o bVII mixolídio no tema; o
// dórico na batalha), fanfarras de metal, cordas em ostinato, sinos e celesta
// para a magia, percussão leve de marcha.

export const INSTRUMENTOS = ['metal', 'cordas', 'sino', 'celesta', 'baixo', 'bumbo', 'caixa', 'chimbal', 'prato'];

const NOTA = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// "F#5" → 78; "Bb4" → 70.
export function midiDe(nome) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(nome);
  if (!m) throw new Error(`nota inválida: ${nome}`);
  const [, letra, acidente, oitava] = m;
  return 12 * (Number(oitava) + 1) + NOTA[letra] + (acidente === '#' ? 1 : acidente === 'b' ? -1 : 0);
}

// "E5/1 -/.5" → [{ midi: 76, dur: 1 }, { midi: null, dur: 0.5 }]
export function lerNotas(texto) {
  return texto.trim().split(/\s+/).map((pedaco) => {
    const [nome, dur] = pedaco.split('/');
    const d = Number(dur);
    if (!(d > 0)) throw new Error(`duração inválida: ${pedaco}`);
    return { midi: nome === '-' ? null : midiDe(nome), dur: d };
  });
}

// "Am/4" → { tons: [57, 60, 64] (lá3, dó4, mi4), raiz: 45 (lá2), dur: 4 }
export function lerAcordes(texto) {
  return texto.trim().split(/\s+/).map((pedaco) => {
    const m = /^([A-G](?:#|b)?)(m|7)?\/([\d.]+)$/.exec(pedaco);
    if (!m) throw new Error(`acorde inválido: ${pedaco}`);
    const [, raizNome, tipo, dur] = m;
    const raiz = midiDe(`${raizNome}3`);
    const intervalos = tipo === 'm' ? [0, 3, 7] : tipo === '7' ? [0, 4, 7, 10] : [0, 4, 7];
    // tons do acorde perto do dó central, para as cordas
    const base = raiz > 59 ? raiz - 12 : raiz;
    return { tons: intervalos.map((i) => base + i), raiz: raiz - 12, dur: Number(dur) };
  });
}

export const soma = (lista) => lista.reduce((s, x) => s + x.dur, 0);

// ---------- as faixas ----------
//
// Cada seção: acordes, melodia, o instrumento que canta (lider), uma dobra
// opcional ({ instr, oitava }), e o acompanhamento gerado pelos acordes:
//   cordas:    'ostinato' (colcheias nos tons do acorde) | 'longo' (acorde parado)
//   baixo:     'marcha' (tônica e quinta em semínimas) | 'pulso' (colcheias) | 'longo'
//   percussao: 'marcha' | 'leve' | 'rufo' (caixa crescendo) | 'batalha' | 'impacto'
//   sinos:     sino no começo de cada acorde;  celesta: arpejo subindo no fim do compasso
//   golpes:    metal curto no tempo 1 e no "e" do 2 (batalha)

export const FAIXAS = {
  // Tema principal: tela inicial, coleção e as outras telas fora da batalha.
  // 38 compassos a 112 batidas por minuto: ~81 s antes de repetir.
  tema: {
    andamento: 112,
    repete: true,
    ordem: ['intro', 'A', 'A2', 'B', 'ponte', 'A3'],
    secoes: {
      intro: {
        acordes: 'C/4 D/4',
        melodia: 'G5/.5 C6/.5 E6/.5 G6/.5 E6/.5 C6/.5 G5/1 F#5/.5 A5/.5 D6/.5 F#6/.5 D6/1 A5/1',
        lider: 'celesta', cordas: 'longo', baixo: 'longo', percussao: null, sinos: true,
      },
      A: {
        acordes: 'C/4 G/4 Am/4 F/4 C/4 Bb/4 F/4 G/4',
        melodia: 'E5/1 G5/1 C6/1.5 B5/.5 D6/2 B5/1 G5/1 A5/1 C6/1 E6/1.5 D6/.5 C6/2 A5/1 -/1 '
          + 'G5/1 E5/.5 G5/.5 C6/1 D6/1 D6/1 Bb5/1 F5/1 Bb5/1 A5/1.5 C6/.5 F6/1 E6/1 D6/3 -/1',
        lider: 'metal', cordas: 'ostinato', baixo: 'marcha', percussao: 'marcha',
      },
      A2: {
        acordes: 'C/4 G/4 Am/4 F/4 C/4 Bb/4 F/2 G/2 C/4',
        melodia: 'E5/1 G5/1 C6/1.5 B5/.5 D6/2 G6/1 F6/.5 E6/.5 E6/1 C6/1 A5/1.5 C6/.5 F6/2 E6/1 C6/1 '
          + 'G6/1 E6/.5 C6/.5 G5/1 C6/1 Bb5/1 D6/1 F6/1.5 D6/.5 C6/1 A5/1 B5/1 D6/1 C6/3 -/1',
        lider: 'metal', dobra: { instr: 'celesta', oitava: 1 }, cordas: 'ostinato', baixo: 'marcha', percussao: 'marcha',
      },
      B: {
        acordes: 'Am/4 F/4 C/4 G/4 Am/4 F/4 D/4 G/4',
        melodia: 'A5/2 E5/1 A5/1 C6/3 A5/1 G5/2 E5/1 G5/1 D6/3 -/1 '
          + 'E6/2 D6/1 C6/1 A5/2 F5/1 A5/1 F#5/1 A5/1 D6/1.5 C6/.5 B5/2 D6/1 -/1',
        lider: 'cordas', cordas: 'longo', baixo: 'longo', percussao: 'leve', sinos: true, celesta: true,
      },
      ponte: {
        acordes: 'Eb/4 F/4 G/4 G7/4',
        melodia: 'Eb5/.5 G5/.5 Bb5/1 G5/1 Bb5/1 F5/.5 A5/.5 C6/1 A5/1 C6/1 G5/.5 B5/.5 D6/1 G6/2 F6/1 D6/1 B5/1 G5/1',
        lider: 'metal', cordas: 'ostinato', baixo: 'marcha', percussao: 'rufo',
      },
      A3: {
        acordes: 'C/4 G/4 Am/4 F/4 C/4 Bb/4 F/4 G/4',
        melodia: 'E5/1 G5/1 C6/1.5 B5/.5 D6/2 B5/1 G5/1 A5/1 C6/1 E6/1.5 D6/.5 C6/2 A5/1 -/1 '
          + 'G5/1 E5/.5 G5/.5 C6/1 D6/1 D6/1 Bb5/1 F5/1 Bb5/1 A5/1.5 C6/.5 F6/1 E6/1 D6/3 -/1',
        lider: 'metal', dobra: { instr: 'cordas', oitava: -1 }, cordas: 'ostinato', baixo: 'marcha', percussao: 'marcha', sinos: true,
      },
    },
  },

  // Batalha: mais rápida e tensa, em ré dórico. 32 compassos a 152: ~50 s.
  // A cada volta muda a instrumentação (voltas[volta % 3]).
  batalha: {
    andamento: 152,
    repete: true,
    ordem: ['A', 'B', 'C', 'D'],
    voltas: [
      {},
      { lider: 'cordas', dobra: { instr: 'celesta', oitava: 1 }, golpes: true },
      { dobra: { instr: 'cordas', oitava: -1 }, sinos: true, percussao: 'marcha' },
    ],
    secoes: {
      A: {
        acordes: 'Dm/4 C/4 Bb/4 C/4 Dm/4 C/4 Bb/4 A/4',
        melodia: 'D5/.5 D5/.5 F5/.5 A5/.5 G5/.5 F5/.5 E5/.5 F5/.5 G5/1 E5/.5 C5/.5 E5/1 G5/1 '
          + 'F5/.5 F5/.5 Bb5/.5 D6/.5 C6/.5 Bb5/.5 A5/.5 Bb5/.5 C6/1.5 G5/.5 E5/1 C5/1 '
          + 'D5/.5 F5/.5 A5/.5 D6/.5 C6/1 A5/1 G5/.5 E5/.5 G5/.5 C6/.5 B5/1 G5/1 '
          + 'F5/.5 G5/.5 A5/.5 Bb5/.5 D6/1 Bb5/1 C#6/2 A5/1 E5/1',
        lider: 'metal', cordas: 'ostinato', baixo: 'pulso', percussao: 'batalha',
      },
      B: {
        acordes: 'F/4 C/4 Gm/4 A/4 F/4 C/4 Bb/4 A/4',
        melodia: 'A5/1 C6/1 F6/1.5 E6/.5 E6/1 D6/.5 C6/.5 G5/2 Bb5/1 D6/1 G6/1 F6/1 E6/2 C#6/1 A5/1 '
          + 'A5/.5 C6/.5 F6/1 E6/.5 D6/.5 C6/1 E6/1 G6/1 E6/1 C6/1 D6/.5 F6/.5 Bb6/1 A6/.5 G6/.5 F6/1 E6/3 -/1',
        lider: 'metal', cordas: 'ostinato', baixo: 'pulso', percussao: 'batalha',
      },
      C: {
        acordes: 'Bb/4 C/4 Dm/4 Dm/4 Bb/4 C/4 A/4 A/4',
        melodia: 'D5/.5 -/.5 F5/.5 -/.5 Bb5/1 A5/1 E5/.5 -/.5 G5/.5 -/.5 C6/1 Bb5/1 '
          + 'A5/.5 A5/.5 D6/.5 A5/.5 F5/.5 A5/.5 D6/1 E6/.5 D6/.5 C6/.5 A5/.5 D6/2 '
          + 'Bb5/1 F5/.5 Bb5/.5 D6/1 C6/1 C6/1 G5/.5 C6/.5 E6/1 D6/1 '
          + 'C#6/.5 E6/.5 A6/1 G6/.5 F6/.5 E6/1 A5/.5 C#6/.5 E6/.5 A6/.5 -/2',
        lider: 'celesta', cordas: 'ostinato', baixo: 'marcha', percussao: 'leve', sinos: true,
      },
      D: {
        acordes: 'Dm/4 Bb/4 C/4 Dm/4 Gm/4 A/4 Dm/4 A7/4',
        melodia: 'A5/1 D6/1 F6/1 E6/1 D6/1 Bb5/1 F5/1 Bb5/1 C6/1.5 E6/.5 G6/1 E6/1 F6/2 D6/1 A5/1 '
          + 'G5/.5 Bb5/.5 D6/.5 G6/.5 F6/1 D6/1 E6/1 C#6/1 A5/1 E5/1 D5/.5 F5/.5 A5/.5 D6/.5 F6/1 D6/1 C#6/1 E6/1 A6/2',
        lider: 'metal', dobra: { instr: 'cordas', oitava: -1 }, cordas: 'ostinato', baixo: 'pulso', percussao: 'batalha', golpes: true,
      },
    },
  },

  // Tela de VS: estinger de confronto, 4,5 batidas a 120 (2,25 s).
  vs: {
    andamento: 120,
    repete: false,
    ordem: ['golpe'],
    secoes: {
      golpe: {
        acordes: 'D/1.5 F/1 G/2',
        melodia: 'D5/.25 D5/.25 A5/1 C6/.5 F5/.5 G5/2',
        lider: 'metal', dobra: { instr: 'metal', oitava: -1 }, cordas: 'longo', baixo: 'longo', percussao: 'impacto',
      },
    },
  },

  // Vitória: fanfarra curta, 7 batidas a 126 (~3,3 s).
  vitoria: {
    andamento: 126,
    repete: false,
    ordem: ['fanfarra'],
    secoes: {
      fanfarra: {
        acordes: 'C/1 F/1 G/1 C/4',
        melodia: 'G4/.333 C5/.333 E5/.334 A5/.5 F5/.5 B5/.5 D6/.5 C6/4',
        lider: 'metal', dobra: { instr: 'celesta', oitava: 1 }, cordas: 'longo', baixo: 'longo', percussao: 'impacto', sinos: true,
      },
    },
  },

  // Derrota: frase curta e simpática, que termina em maior (~3 s).
  derrota: {
    andamento: 104,
    repete: false,
    ordem: ['frase'],
    secoes: {
      frase: {
        acordes: 'Am/1 F/1 G/1 C/2',
        melodia: 'E5/.5 C5/.5 A4/.5 C5/.5 D5/.5 B4/.5 C5/2',
        lider: 'celesta', cordas: 'longo', baixo: 'longo', percussao: null, sinos: true,
      },
    },
  },
};

// Duração de uma faixa até repetir (ou até acabar), em segundos.
export function duracaoDaFaixa(nome) {
  const f = FAIXAS[nome];
  const batidas = f.ordem.reduce((s, sec) => s + soma(lerAcordes(f.secoes[sec].acordes)), 0);
  return batidas * 60 / f.andamento;
}

// A seção com o arranjo da volta (só a batalha varia).
export function secaoDaVolta(nome, secao, volta = 0) {
  const f = FAIXAS[nome];
  const extra = f.voltas ? f.voltas[volta % f.voltas.length] : {};
  return { ...f.secoes[secao], ...extra };
}

// Eventos de uma seção: [{ inicio (batidas), dur (batidas), midi (null na
// percussão), instr, vol (0..1) }]. O sequenciador só converte batidas em
// segundos e toca.
export function eventosDaSecao(s) {
  const ev = [];
  const por = (inicio, dur, midi, instr, vol) => ev.push({ inicio, dur, midi, instr, vol });

  // melodia (e a dobra, na oitava pedida)
  let t = 0;
  for (const n of lerNotas(s.melodia)) {
    if (n.midi !== null) {
      por(t, n.dur, n.midi, s.lider, 0.9);
      if (s.dobra) por(t, n.dur, n.midi + 12 * s.dobra.oitava, s.dobra.instr, 0.5);
    }
    t += n.dur;
  }

  // acompanhamento, acorde por acorde
  t = 0;
  for (const a of lerAcordes(s.acordes)) {
    const [r, terca, quinta] = a.tons;
    if (s.cordas === 'longo') for (const tom of a.tons) por(t, a.dur, tom, 'cordas', 0.35);
    if (s.cordas === 'ostinato') {
      const figura = [r, quinta, terca + 12, quinta];
      for (let x = 0; x < a.dur; x += 0.5) por(t + x, 0.45, figura[(x * 2) % 4], 'cordas', 0.4);
    }
    if (s.baixo === 'longo') por(t, a.dur, a.raiz, 'baixo', 0.8);
    if (s.baixo === 'marcha') for (let x = 0; x < a.dur; x += 1) por(t + x, 0.9, x % 2 ? a.raiz + 7 : a.raiz, 'baixo', 0.8);
    if (s.baixo === 'pulso') for (let x = 0; x < a.dur; x += 0.5) por(t + x, 0.45, x % 2 === 1.5 ? a.raiz + 12 : a.raiz, 'baixo', 0.75);
    if (s.sinos) por(t, Math.min(a.dur, 2), a.tons[a.tons.length - 1] + 24, 'sino', 0.45);
    if (s.celesta && a.dur >= 4) [r, terca, quinta, r + 12].forEach((tom, i) => por(t + 2 + i * 0.5, 0.5, tom + 24, 'celesta', 0.4));
    if (s.golpes) for (const x of [0, 1.5]) if (x < a.dur) for (const tom of a.tons.slice(0, 3)) por(t + x, 0.3, tom + 12, 'metal', 0.35);
    // percussão (midi null)
    const p = s.percussao;
    for (let x = 0; x < a.dur; x += 0.5) {
      const tempo = x % 1 === 0;
      const batida = Math.floor(x) % 4;
      if (p === 'marcha') {
        if (tempo && batida % 2 === 0) por(t + x, 0.3, null, 'bumbo', 0.8);
        if (tempo && batida % 2 === 1) por(t + x, 0.2, null, 'caixa', 0.6);
        if (!tempo) por(t + x, 0.1, null, 'caixa', 0.18);
      }
      if (p === 'leve') {
        if (tempo && batida === 0) por(t + x, 0.3, null, 'bumbo', 0.55);
        por(t + x, 0.1, null, 'chimbal', tempo ? 0.5 : 0.3);
      }
      if (p === 'batalha') {
        if (x % 4 === 0 || x % 4 === 2.5 || x % 4 === 2) por(t + x, 0.3, null, 'bumbo', 0.85);
        if (tempo && batida % 2 === 1) por(t + x, 0.2, null, 'caixa', 0.7);
        por(t + x, 0.1, null, 'chimbal', tempo ? 0.55 : 0.35);
      }
      if (p === 'rufo') {
        // semicolcheias na caixa, crescendo até o fim do acorde
        for (const y of [0, 0.25]) por(t + x + y, 0.12, null, 'caixa', 0.15 + 0.6 * ((x + y) / a.dur));
        if (tempo && batida === 0) por(t + x, 0.3, null, 'bumbo', 0.7);
      }
    }
    if (p === 'impacto' && t === 0) {
      por(0, 0.5, null, 'bumbo', 1);
      por(0, 0.3, null, 'caixa', 0.8);
      por(0, 2, null, 'prato', 0.7);
    }
    t += a.dur;
  }
  if (s.percussao === 'impacto') por(t - Math.min(2, t / 2), 0.5, null, 'bumbo', 0.9);
  return ev.sort((x, y) => x.inicio - y.inicio);
}
