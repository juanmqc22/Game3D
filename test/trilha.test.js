// Trilha sonora como dados (js/trilha.js): durações pedidas, seções bem
// formadas e as variações da batalha.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FAIXAS, INSTRUMENTOS, midiDe, lerNotas, lerAcordes, soma, duracaoDaFaixa, secaoDaVolta, eventosDaSecao,
} from '../js/trilha.js';
import { VOLUME_EFEITOS, VOLUME_MUSICA } from '../js/som.js';

describe('notação', () => {
  test('notas e acidentes', () => {
    assert.equal(midiDe('C4'), 60);
    assert.equal(midiDe('F#5'), 78);
    assert.equal(midiDe('Bb4'), 70);
    assert.throws(() => midiDe('H2'));
  });
  test('notas com duração e pausa', () => {
    assert.deepEqual(lerNotas('E5/1 -/.5'), [{ midi: 76, dur: 1 }, { midi: null, dur: 0.5 }]);
    assert.throws(() => lerNotas('E5/0'));
  });
  test('acordes maior, menor e com sétima', () => {
    assert.deepEqual(lerAcordes('C/4')[0].tons, [48, 52, 55]);
    assert.deepEqual(lerAcordes('Am/2')[0].tons, [57, 60, 64]);
    assert.equal(lerAcordes('G7/4')[0].tons.length, 4);
    assert.throws(() => lerAcordes('Cmaj9/4'));
  });
});

describe('durações pedidas', () => {
  test('tema principal: pelo menos 60 s antes de repetir, com A, B e ponte', () => {
    assert.ok(duracaoDaFaixa('tema') >= 60, `${duracaoDaFaixa('tema').toFixed(1)} s`);
    for (const s of ['A', 'B', 'ponte']) assert.ok(FAIXAS.tema.ordem.includes(s), s);
    assert.equal(FAIXAS.tema.repete, true);
  });
  test('batalha: mais rápida que o tema e pelo menos 45 s antes de repetir', () => {
    assert.ok(duracaoDaFaixa('batalha') >= 45, `${duracaoDaFaixa('batalha').toFixed(1)} s`);
    assert.ok(FAIXAS.batalha.andamento > FAIXAS.tema.andamento);
  });
  test('estinger do VS <= 2,5 s; vitória <= 4 s; derrota curta', () => {
    assert.ok(duracaoDaFaixa('vs') <= 2.5);
    assert.ok(duracaoDaFaixa('vitoria') <= 4);
    assert.ok(duracaoDaFaixa('derrota') <= 4);
    for (const f of ['vs', 'vitoria', 'derrota']) assert.equal(FAIXAS[f].repete, false, f);
  });
});

describe('seções bem formadas', () => {
  for (const [nome, faixa] of Object.entries(FAIXAS)) {
    test(`${nome}: melodia e acordes do mesmo tamanho em cada seção`, () => {
      for (const sec of faixa.ordem) {
        const s = faixa.secoes[sec];
        assert.ok(s, `${nome}.${sec} não existe`);
        const m = soma(lerNotas(s.melodia));
        const a = soma(lerAcordes(s.acordes));
        assert.ok(Math.abs(m - a) < 1e-6, `${nome}.${sec}: melodia ${m} x acordes ${a}`);
        // seções de loop fecham em compassos de 4 batidas
        if (faixa.repete) assert.equal(a % 4, 0, `${nome}.${sec}`);
      }
    });
    test(`${nome}: instrumentos conhecidos, notas numa faixa confortável`, () => {
      const voltas = faixa.voltas?.length ?? 1;
      for (let v = 0; v < voltas; v++) {
        for (const sec of faixa.ordem) {
          for (const e of eventosDaSecao(secaoDaVolta(nome, sec, v))) {
            assert.ok(INSTRUMENTOS.includes(e.instr), e.instr);
            assert.ok(e.vol > 0 && e.vol <= 1);
            assert.ok(e.dur > 0);
            if (e.midi !== null) assert.ok(e.midi >= 28 && e.midi <= 108, `${nome}.${sec}: midi ${e.midi}`);
          }
        }
      }
    });
  }
});

describe('arranjo', () => {
  test('a batalha muda de instrumentação a cada volta (3 voltas diferentes)', () => {
    const assinatura = (v) => JSON.stringify(FAIXAS.batalha.ordem.map((s) => {
      const conta = {};
      for (const e of eventosDaSecao(secaoDaVolta('batalha', s, v))) conta[e.instr] = (conta[e.instr] ?? 0) + 1;
      return conta;
    }));
    const vistas = new Set([0, 1, 2].map(assinatura));
    assert.equal(vistas.size, 3);
    assert.equal(assinatura(3), assinatura(0), 'a quarta volta volta ao arranjo da primeira');
  });
  test('o tema tem metal, cordas em ostinato, sinos, celesta e percussão de marcha', () => {
    const instr = new Set(FAIXAS.tema.ordem.flatMap((s) => eventosDaSecao(secaoDaVolta('tema', s)).map((e) => e.instr)));
    for (const i of ['metal', 'cordas', 'sino', 'celesta', 'baixo', 'bumbo', 'caixa']) assert.ok(instr.has(i), i);
  });
  test('eventos em ordem e dentro da seção', () => {
    for (const s of FAIXAS.tema.ordem) {
      const sec = secaoDaVolta('tema', s);
      const fim = soma(lerAcordes(sec.acordes));
      const ev = eventosDaSecao(sec);
      ev.forEach((e, i) => {
        assert.ok(e.inicio >= 0 && e.inicio < fim, `${s}: ${e.inicio}`);
        if (i) assert.ok(e.inicio >= ev[i - 1].inicio);
      });
    }
  });
  test('música sempre abaixo dos efeitos', () => {
    assert.ok(VOLUME_MUSICA < VOLUME_EFEITOS);
  });
});
