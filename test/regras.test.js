// Testes das regras. Usam criaturas de teste próprias (não as de js/criaturas.js),
// para que mudanças de balanceamento na tabela não quebrem os testes de regra.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATAQUE, DEFESA, ESPECIAL, TROPECO, SIMBOLOS, CHOQUE_DANO,
  estadoInicial, vencedorDoConfronto, resolverRodada, verificarFim,
} from '../js/regras.js';

function criatura(nome, vida, forca, especial) {
  return {
    codigo: nome.toUpperCase(), nome, especie: 'teste', vida, forca,
    especial: { nome: 'Especial', dano: 1, cura: 0, roubo: false, escudo: false, recuo: 0, texto: '', ...especial },
  };
}

const ESCUDEIRO = criatura('Escudeiro', 12, 3, { dano: 2, escudo: true }); // tipo Bola de Ferro
const LADRAO = criatura('Ladrao', 11, 3, { dano: 3, cura: 3, roubo: true }); // tipo Língua Chicote
const ESPINHO = criatura('Espinho', 12, 3, { dano: 5 }); // tipo Espinho
const FORTE = criatura('Forte', 10, 4, { dano: 8 }); // tipo Pulo Duplo
const CURADOR = criatura('Curador', 13, 3, { dano: 2, cura: 4 }); // tipo Casca Dura
const BOMBA = criatura('Bomba', 11, 3, { dano: 6, recuo: 2 }); // tipo Estouro

// Monta uma partida com vida/escudo ajustados: ajustes = [{ vida, escudo }, { vida, escudo }].
function partida(a, b, ajustes = [{}, {}]) {
  const estado = estadoInicial(a, b);
  estado.jogadores = estado.jogadores.map((j, i) => ({ ...j, ...ajustes[i] }));
  return estado;
}

function vidas(estado) {
  return estado.jogadores.map((j) => j.vida);
}

describe('estado inicial', () => {
  test('vida cheia, sem escudo, rodada 0', () => {
    const e = estadoInicial(ESPINHO, FORTE);
    assert.deepEqual(vidas(e), [12, 10]);
    assert.deepEqual(e.jogadores.map((j) => j.escudo), [false, false]);
    assert.equal(e.rodada, 0);
  });
});

describe('regra 1 — triângulo', () => {
  test('ESPECIAL vence ATAQUE', () => {
    assert.equal(vencedorDoConfronto(ESPECIAL, ATAQUE), 0);
    assert.equal(vencedorDoConfronto(ATAQUE, ESPECIAL), 1);
  });
  test('ATAQUE vence DEFESA', () => {
    assert.equal(vencedorDoConfronto(ATAQUE, DEFESA), 0);
    assert.equal(vencedorDoConfronto(DEFESA, ATAQUE), 1);
  });
  test('DEFESA vence ESPECIAL', () => {
    assert.equal(vencedorDoConfronto(DEFESA, ESPECIAL), 0);
    assert.equal(vencedorDoConfronto(ESPECIAL, DEFESA), 1);
  });
});

describe('regra 2 — TROPECO perde para qualquer outro', () => {
  for (const s of [ATAQUE, DEFESA, ESPECIAL]) {
    test(`${s} vence TROPECO`, () => {
      assert.equal(vencedorDoConfronto(s, TROPECO), 0);
      assert.equal(vencedorDoConfronto(TROPECO, s), 1);
    });
  }
});

describe('regra 3 — símbolos iguais empatam (com choque)', () => {
  for (const s of SIMBOLOS) {
    const choque = s !== TROPECO;
    test(`${s} x ${s} é empate${choque ? ' e cada um perde o choque' : ' e ninguém perde vida'}`, () => {
      assert.equal(vencedorDoConfronto(s, s), null);
      const { estado, resumo, fim } = resolverRodada(partida(ESPINHO, BOMBA), s, s);
      assert.equal(resumo.vencedor, null);
      assert.equal(resumo.choque, choque);
      assert.equal(resumo.dano, 0, 'o choque não é dano de vencedor');
      assert.deepEqual(vidas(estado), choque ? [12 - CHOQUE_DANO, 11 - CHOQUE_DANO] : [12, 11]);
      assert.equal(fim.terminou, false);
    });
  }
  test('TROPECO x TROPECO não aplica o bônus de +2', () => {
    const { estado, resumo } = resolverRodada(partida(ESPINHO, BOMBA), TROPECO, TROPECO);
    assert.equal(resumo.bonusTropeco, 0);
    assert.deepEqual(vidas(estado), [12, 11]);
  });
  test('TROPECO x TROPECO não consome escudo', () => {
    const { estado } = resolverRodada(partida(ESPINHO, BOMBA, [{ escudo: true }, {}]), TROPECO, TROPECO);
    assert.equal(estado.jogadores[0].escudo, true);
  });
  test('símbolo inválido gera erro', () => {
    assert.throws(() => vencedorDoConfronto('PEDRA', ATAQUE));
  });
});

describe('regra 4 — dano do vencedor', () => {
  test('venceu com ATAQUE: dano = forca do vencedor', () => {
    const { estado, resumo } = resolverRodada(partida(FORTE, ESPINHO), ATAQUE, DEFESA);
    assert.equal(resumo.dano, 4);
    assert.deepEqual(vidas(estado), [10, 8]);
  });
  test('venceu com DEFESA: dano = forca do vencedor (contra-ataque)', () => {
    const { estado, resumo } = resolverRodada(partida(ESPINHO, FORTE), ESPECIAL, DEFESA);
    assert.equal(resumo.vencedor, 1);
    assert.equal(resumo.dano, 4);
    assert.deepEqual(vidas(estado), [8, 10]);
  });
  test('venceu com ESPECIAL: dano do especial, não a forca', () => {
    const { estado, resumo } = resolverRodada(partida(ESPINHO, FORTE), ESPECIAL, ATAQUE);
    assert.equal(resumo.danoBase, 5);
    assert.deepEqual(vidas(estado), [12, 5]);
  });
  test('venceu com ESPECIAL: escudo é ativado no vencedor', () => {
    const { estado, resumo } = resolverRodada(partida(ESCUDEIRO, FORTE), ESPECIAL, ATAQUE);
    assert.equal(resumo.escudoAtivado, true);
    assert.equal(estado.jogadores[0].escudo, true);
    assert.deepEqual(vidas(estado), [12, 8]);
  });
  test('escudo não acumula: vencer com ele ativo não ativa de novo', () => {
    const inicio = partida(ESCUDEIRO, FORTE, [{ escudo: true }, {}]);
    const { estado, resumo } = resolverRodada(inicio, ESPECIAL, ATAQUE);
    assert.equal(resumo.escudoAtivado, false);
    assert.equal(estado.jogadores[0].escudo, true);
    // um único dano recebido já consome o escudo
    const r2 = resolverRodada(estado, TROPECO, ATAQUE);
    assert.equal(r2.resumo.bloqueado, true);
    assert.equal(r2.estado.jogadores[0].escudo, false);
    const r3 = resolverRodada(r2.estado, TROPECO, ATAQUE);
    assert.equal(r3.resumo.bloqueado, false);
    assert.equal(r3.resumo.dano, 6);
  });
  test('cura própria (tipo Casca Dura) é aplicada e respeita a vida inicial', () => {
    const { estado, resumo } = resolverRodada(partida(CURADOR, FORTE, [{ vida: 7 }, {}]), ESPECIAL, ATAQUE);
    assert.equal(resumo.cura, 4);
    assert.deepEqual(vidas(estado), [11, 8]);
    const cheio = resolverRodada(partida(CURADOR, FORTE, [{ vida: 11 }, {}]), ESPECIAL, ATAQUE);
    assert.equal(cheio.resumo.cura, 2);
    assert.equal(cheio.estado.jogadores[0].vida, 13);
  });
  test('roubo (tipo Língua Chicote): oponente -3, vencedor +3', () => {
    const { estado, resumo } = resolverRodada(partida(LADRAO, FORTE, [{ vida: 5 }, {}]), ESPECIAL, ATAQUE);
    assert.equal(resumo.dano, 3);
    assert.equal(resumo.cura, 3);
    assert.deepEqual(vidas(estado), [8, 7]);
  });
  test('cura do roubo também tem teto na vida inicial', () => {
    const { estado } = resolverRodada(partida(LADRAO, FORTE, [{ vida: 10 }, {}]), ESPECIAL, ATAQUE);
    assert.equal(estado.jogadores[0].vida, 11);
  });
  test('recuo (tipo Estouro): 6 no oponente e 2 em si mesmo', () => {
    const { estado, resumo } = resolverRodada(partida(BOMBA, ESPINHO), ESPECIAL, ATAQUE);
    assert.equal(resumo.dano, 6);
    assert.equal(resumo.recuo, 2);
    assert.deepEqual(vidas(estado), [9, 6]);
  });
  test('perdedor não causa nada: especial de quem perdeu é ignorado', () => {
    const { estado } = resolverRodada(partida(BOMBA, ESPINHO), ESPECIAL, DEFESA);
    assert.deepEqual(vidas(estado), [8, 12]);
  });
});

describe('regra 5 — perdedor com TROPECO leva +2', () => {
  test('ATAQUE contra TROPECO: forca + 2', () => {
    const { estado, resumo } = resolverRodada(partida(FORTE, ESPINHO), ATAQUE, TROPECO);
    assert.equal(resumo.bonusTropeco, 2);
    assert.equal(resumo.dano, 6);
    assert.deepEqual(vidas(estado), [10, 6]);
  });
  test('DEFESA contra TROPECO: forca + 2', () => {
    const { resumo } = resolverRodada(partida(FORTE, ESPINHO), DEFESA, TROPECO);
    assert.equal(resumo.dano, 6);
  });
  test('ESPECIAL contra TROPECO: dano do especial + 2', () => {
    const { resumo } = resolverRodada(partida(ESPINHO, FORTE), ESPECIAL, TROPECO);
    assert.equal(resumo.dano, 7);
  });
  test('roubo cura 3 fixo mesmo quando o dano foi 5 por causa do TROPECO', () => {
    const inicio = partida(LADRAO, FORTE, [{ vida: 2 }, {}]);
    const { estado, resumo } = resolverRodada(inicio, ESPECIAL, TROPECO);
    assert.equal(resumo.dano, 5);
    assert.equal(resumo.cura, 3);
    assert.deepEqual(vidas(estado), [5, 5]);
  });
  test('o +2 não entra no recuo', () => {
    const { estado, resumo } = resolverRodada(partida(BOMBA, ESPINHO), ESPECIAL, TROPECO);
    assert.equal(resumo.dano, 8);
    assert.equal(resumo.recuo, 2);
    assert.deepEqual(vidas(estado), [9, 4]);
  });
});

describe('regra 6 — escudo anula todo o dano e é consumido', () => {
  test('escudo anula forca + bônus do TROPECO e é consumido', () => {
    const inicio = partida(FORTE, ESPINHO, [{}, { escudo: true }]);
    const { estado, resumo } = resolverRodada(inicio, ATAQUE, TROPECO);
    assert.equal(resumo.bloqueado, true);
    assert.equal(resumo.dano, 0);
    assert.deepEqual(vidas(estado), [10, 12]);
    assert.equal(estado.jogadores[1].escudo, false);
  });
  test('escudo consumido: o dano seguinte passa normalmente', () => {
    const inicio = partida(FORTE, ESPINHO, [{}, { escudo: true }]);
    const r1 = resolverRodada(inicio, ATAQUE, DEFESA);
    const r2 = resolverRodada(r1.estado, ATAQUE, DEFESA);
    assert.equal(r2.resumo.bloqueado, false);
    assert.deepEqual(vidas(r2.estado), [10, 8]);
  });
  test('escudo dura até anular algum dano, mesmo após rodadas sem dano', () => {
    let estado = partida(FORTE, ESPINHO, [{}, { escudo: true }]);
    estado = resolverRodada(estado, TROPECO, TROPECO).estado; // empate sem choque
    estado = resolverRodada(estado, TROPECO, ATAQUE).estado; // o dono do escudo vence
    assert.equal(estado.jogadores[1].escudo, true);
    const r = resolverRodada(estado, ATAQUE, DEFESA);
    assert.equal(r.resumo.bloqueado, true);
  });
  test('escudo anula o dano do especial', () => {
    const inicio = partida(ESPINHO, FORTE, [{}, { escudo: true }]);
    const { estado } = resolverRodada(inicio, ESPECIAL, ATAQUE);
    assert.deepEqual(vidas(estado), [12, 10]);
  });
  test('cura própria acontece mesmo quando o escudo do oponente anula o dano', () => {
    const inicio = partida(CURADOR, FORTE, [{ vida: 5 }, { escudo: true }]);
    const { estado, resumo } = resolverRodada(inicio, ESPECIAL, ATAQUE);
    assert.equal(resumo.bloqueado, true);
    assert.equal(resumo.cura, 4);
    assert.deepEqual(vidas(estado), [9, 10]);
  });
  test('roubo não acontece quando o escudo bloqueia: sem -3 e sem +3', () => {
    const inicio = partida(LADRAO, FORTE, [{ vida: 5 }, { escudo: true }]);
    const { estado, resumo } = resolverRodada(inicio, ESPECIAL, ATAQUE);
    assert.equal(resumo.bloqueado, true);
    assert.equal(resumo.cura, 0);
    assert.deepEqual(vidas(estado), [5, 10]);
  });
  test('recuo acontece mesmo quando o escudo do oponente anula o dano', () => {
    const inicio = partida(BOMBA, ESPINHO, [{}, { escudo: true }]);
    const { estado, resumo } = resolverRodada(inicio, ESPECIAL, ATAQUE);
    assert.equal(resumo.bloqueado, true);
    assert.equal(resumo.recuo, 2);
    assert.deepEqual(vidas(estado), [9, 12]);
  });
  test('recuo ignora o escudo do próprio vencedor', () => {
    const inicio = partida(BOMBA, ESPINHO, [{ escudo: true }, {}]);
    const { estado } = resolverRodada(inicio, ESPECIAL, ATAQUE);
    assert.equal(estado.jogadores[0].vida, 9);
    assert.equal(estado.jogadores[0].escudo, true);
  });
  test('escudo ativado em espelho protege contra o especial do oponente', () => {
    const inicio = partida(ESCUDEIRO, ESCUDEIRO, [{}, { escudo: true }]);
    const { estado, resumo } = resolverRodada(inicio, ESPECIAL, ATAQUE);
    assert.equal(resumo.bloqueado, true);
    assert.deepEqual(vidas(estado), [12, 12]);
    assert.deepEqual(estado.jogadores.map((j) => j.escudo), [true, false]);
  });
});

describe('regra 7 — vida travada em 0 e fim de partida', () => {
  test('vida nunca fica abaixo de 0', () => {
    const { estado, fim } = resolverRodada(partida(FORTE, ESPINHO, [{}, { vida: 3 }]), ESPECIAL, TROPECO);
    assert.equal(estado.jogadores[1].vida, 0);
    assert.deepEqual(fim, { terminou: true, vencedor: 0 });
  });
  test('recuo nunca deixa vida abaixo de 0', () => {
    const { estado } = resolverRodada(partida(BOMBA, ESPINHO, [{ vida: 1 }, {}]), ESPECIAL, ATAQUE);
    assert.equal(estado.jogadores[0].vida, 0);
  });
  test('vence quem zerar a vida do outro (jogador 2)', () => {
    const { fim } = resolverRodada(partida(FORTE, ESPINHO, [{ vida: 3 }, {}]), ATAQUE, ESPECIAL);
    assert.deepEqual(fim, { terminou: true, vencedor: 1 });
  });
  test('Trovão (recuo) pode se matar numa rodada que venceu: o oponente ganha', () => {
    const recuo = 1;
    const trovao = criatura('TrovaoTeste', 14, 3, { dano: 6, recuo });
    const { estado, resumo, fim } = resolverRodada(partida(trovao, ESPINHO, [{ vida: recuo }, {}]), ESPECIAL, ATAQUE);
    assert.equal(resumo.vencedor, 0);
    assert.equal(estado.jogadores[0].vida, 0);
    assert.equal(estado.jogadores[1].vida, 12 - 6);
    assert.deepEqual(fim, { terminou: true, vencedor: 1 });
  });
  test('empate duplo: os dois zeram na mesma rodada', () => {
    const { estado, fim } = resolverRodada(partida(BOMBA, ESPINHO, [{ vida: 2 }, { vida: 6 }]), ESPECIAL, ATAQUE);
    assert.deepEqual(vidas(estado), [0, 0]);
    assert.deepEqual(fim, { terminou: true, vencedor: null });
  });
  test('partida em andamento não terminou', () => {
    assert.deepEqual(verificarFim(estadoInicial(FORTE, ESPINHO)), { terminou: false });
  });
  test('resolver rodada depois do fim gera erro', () => {
    assert.throws(() => resolverRodada(partida(FORTE, ESPINHO, [{}, { vida: 0 }]), ATAQUE, DEFESA));
  });
});

describe('pureza', () => {
  test('resolverRodada não altera o estado recebido', () => {
    const inicio = partida(LADRAO, FORTE, [{ vida: 5 }, { escudo: true }]);
    const copia = structuredClone(inicio);
    resolverRodada(inicio, ESPECIAL, ATAQUE);
    assert.deepEqual(inicio, copia);
  });
  test('rodada é contada', () => {
    const { estado, resumo } = resolverRodada(estadoInicial(FORTE, ESPINHO), ATAQUE, ATAQUE);
    assert.equal(resumo.numero, 1);
    assert.equal(estado.rodada, 1);
  });
});

describe('choque — mesmo símbolo dos dois lados', () => {
  test('CHOQUE_DANO é 1', () => {
    assert.equal(CHOQUE_DANO, 1);
  });
  test('resumo conta quanto cada um perdeu', () => {
    const { resumo } = resolverRodada(partida(ESPINHO, BOMBA), DEFESA, DEFESA);
    assert.deepEqual(resumo.danoChoque, [1, 1]);
    assert.deepEqual(resumo.choqueBloqueado, [false, false]);
  });
  test('escudo anula o choque de quem tem e é consumido; o outro perde 1', () => {
    const { estado, resumo } = resolverRodada(partida(ESCUDEIRO, BOMBA, [{ escudo: true }, {}]), ATAQUE, ATAQUE);
    assert.deepEqual(resumo.danoChoque, [0, 1]);
    assert.deepEqual(resumo.choqueBloqueado, [true, false]);
    assert.deepEqual(vidas(estado), [12, 10]);
    assert.equal(estado.jogadores[0].escudo, false);
  });
  test('os dois com escudo: ninguém perde vida e os dois escudos acabam', () => {
    const { estado } = resolverRodada(partida(ESCUDEIRO, ESCUDEIRO, [{ escudo: true }, { escudo: true }]), ESPECIAL, ESPECIAL);
    assert.deepEqual(vidas(estado), [12, 12]);
    assert.deepEqual(estado.jogadores.map((j) => j.escudo), [false, false]);
  });
  test('ESPECIAL x ESPECIAL não ativa especial nenhum (nem cura, nem escudo)', () => {
    const { estado, resumo } = resolverRodada(partida(CURADOR, ESCUDEIRO, [{ vida: 5 }, {}]), ESPECIAL, ESPECIAL);
    assert.equal(resumo.cura, 0);
    assert.equal(resumo.escudoAtivado, false);
    assert.deepEqual(vidas(estado), [4, 11]);
  });
  test('choque pode terminar a partida; os dois zerados = empate (regra 7)', () => {
    const um = resolverRodada(partida(ESPINHO, BOMBA, [{ vida: 1 }, {}]), ATAQUE, ATAQUE);
    assert.deepEqual(um.fim, { terminou: true, vencedor: 1 });
    const dois = resolverRodada(partida(ESPINHO, BOMBA, [{ vida: 1 }, { vida: 1 }]), DEFESA, DEFESA);
    assert.deepEqual(dois.fim, { terminou: true, vencedor: null });
  });
});
