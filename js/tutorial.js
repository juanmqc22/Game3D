// Tutorial do primeiro contato: do QR do cartão do kit até a primeira partida,
// passando por registrar os 2 bichinhos do kit. Lógica pura: recebe o
// "storage" (localStorage) e os dados, não toca no DOM (a tela está em js/app.js).
//
// localStorage, chave CHAVE_TUTORIAL:
//   { step: 3, done: false, skipped: false, pecas: ['TAT01'] }
// step  — PASSO abaixo (0 = nunca começou)
// pecas — códigos lidos durante o tutorial, na ordem: são o par da primeira
//         partida (a espera do escaneio expira em 10 min; esta lista, não).
// É localStorage porque o iPhone abre uma aba nova a cada leitura NFC: o
// tutorial continua na aba nova, e a aba antiga ouve o evento `storage`.
//
// A leitura da peça, a coleção, o escaneio e o combate não mudam: o tutorial
// só decide qual tela mostrar em volta deles.

import { buscarCriatura, RIVAL } from './criaturas.js?v=18';

export const CHAVE_TUTORIAL = 'bichinhos:tutorial';

export const PASSO = {
  NADA: 0,
  BOAS_VINDAS: 1,
  PRIMEIRO: 2, // registrar o 1º bichinho
  SEGUNDO: 3, // registrar o 2º (ou "Só tenho 1")
  PARTIDA: 4, // primeira partida guiada
  FIM: 5,
};

export function estadoVazio() {
  return { step: PASSO.NADA, done: false, skipped: false, pecas: [] };
}

// Devolve o estado limpo, ou null se o storage não funciona (aba privada
// antiga, storage bloqueado): sem storage o tutorial não aparece sozinho,
// senão "Pular" nunca ficaria guardado e ele voltaria a cada visita.
export function lerTutorial(storage) {
  let bruto;
  try {
    bruto = storage.getItem(CHAVE_TUTORIAL);
  } catch {
    return null;
  }
  if (!bruto) return estadoVazio();
  let dados = null;
  try {
    dados = JSON.parse(bruto);
  } catch {
    dados = null;
  }
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return estadoVazio();
  const step = Number.isInteger(dados.step) && dados.step >= PASSO.NADA && dados.step <= PASSO.FIM ? dados.step : PASSO.NADA;
  const pecas = Array.isArray(dados.pecas)
    ? [...new Set(dados.pecas.map((c) => buscarCriatura(String(c))?.codigo).filter(Boolean))].slice(0, 2)
    : [];
  return { step, done: dados.done === true, skipped: dados.skipped === true, pecas };
}

export function gravarTutorial(storage, estado) {
  try {
    storage.setItem(CHAVE_TUTORIAL, JSON.stringify(estado));
    return true;
  } catch {
    return false;
  }
}

// Etapa 0: o que mostrar ao abrir a página.
//   via: 'inicio' (sem ?b=, ex.: QR do cartão do kit) ou 'peca' (?b= da etiqueta)
//   codigos: códigos já na coleção (antes de registrar a peça que chegou)
// Devolve null (nada de tutorial) ou { passo, curta, estado }:
//   passo  — PASSO onde o tutorial está
//   curta  — true: entrou direto pela peça; mostra 1 tela curta de boas-vindas
//   estado — o estado a gravar
// Na chegada pela peça, a leitura conta: quem chama registra a peça em seguida
// (registrarLeitura) e o tutorial segue para a etapa 3 ou 4.
export function decidirEntrada(tutorial, { via, codigos = [] }) {
  if (!tutorial || tutorial.done || tutorial.skipped) return null;
  const { step } = tutorial;
  if (step >= PASSO.PARTIDA) return null; // a partida já foi oferecida
  if (via === 'inicio') {
    if (step === PASSO.NADA) {
      return codigos.length === 0 ? { passo: PASSO.BOAS_VINDAS, curta: false, estado: { ...tutorial, step: PASSO.BOAS_VINDAS } } : null;
    }
    return { passo: step, curta: false, estado: tutorial };
  }
  // pela peça, no meio do tutorial (ex.: a aba nova do iPhone): segue sem boas-vindas
  if (step >= PASSO.PRIMEIRO) return { passo: step, curta: false, estado: tutorial };
  // pela peça, sem ter começado: quem já tem 2 ou mais não vê nada
  if (step === PASSO.NADA && codigos.length >= 2) return null;
  // o que já está na coleção conta como o 1º bichinho
  const pecas = tutorial.pecas.length ? tutorial.pecas : codigos.filter((c) => buscarCriatura(c)).slice(0, 1);
  const passo = pecas.length ? PASSO.SEGUNDO : PASSO.PRIMEIRO;
  return { passo, curta: true, estado: { ...tutorial, step: passo, pecas } };
}

// Uma peça foi lida numa etapa de registro. Devolve { estado, repetido }:
// repetido = essa peça já tinha sido lida no tutorial (continua na etapa 3).
// Com 2 peças diferentes, vai para a partida.
export function registrarLeitura(tutorial, codigo) {
  const c = buscarCriatura(String(codigo ?? ''));
  if (!c) return { estado: tutorial, repetido: false };
  const repetido = tutorial.pecas.includes(c.codigo);
  const pecas = repetido ? tutorial.pecas : [...tutorial.pecas, c.codigo].slice(0, 2);
  const step = pecas.length >= 2 ? PASSO.PARTIDA : PASSO.SEGUNDO;
  return { estado: { ...tutorial, step, pecas }, repetido };
}

// Boas-vindas lidas: vai para o registro (1º ou 2º, conforme as peças lidas).
export function comecarRegistro(tutorial) {
  return { ...tutorial, step: tutorial.pecas.length ? PASSO.SEGUNDO : PASSO.PRIMEIRO };
}

// "Só tenho 1 bichinho": partida contra o Rato do Mato.
export function soTenhoUm(tutorial, codigos = []) {
  const pecas = tutorial.pecas.length ? tutorial.pecas.slice(0, 1) : codigos.filter((c) => buscarCriatura(c)).slice(0, 1);
  return { ...tutorial, step: PASSO.PARTIDA, pecas };
}

// Os dois da primeira partida: as 2 peças lidas, ou a peça e o Rato.
// null se não há peça nenhuma.
export function parDaPartida(tutorial) {
  const [a, b] = tutorial.pecas.map((c) => buscarCriatura(c));
  if (!a) return null;
  return [a, b ?? RIVAL];
}

export function pular(tutorial) {
  return { ...(tutorial ?? estadoVazio()), skipped: true };
}

export function concluir(tutorial) {
  return { ...(tutorial ?? estadoVazio()), step: PASSO.FIM, done: true };
}

// "Rever tutorial" (início): começa de novo, do zero.
export function rever() {
  return { ...estadoVazio(), step: PASSO.BOAS_VINDAS };
}

// Outra aba mudou o tutorial. passoMostrado: o PASSO que esta aba mostra.
// Devolve 'sair' (acabou ou foi pulado: volta ao início), o novo PASSO (a
// outra aba avançou) ou null (nada a fazer).
export function passoParaAba(passoMostrado, novo) {
  if (!novo) return null;
  if (novo.done || novo.skipped) return 'sair';
  if (novo.step > passoMostrado && novo.step <= PASSO.PARTIDA) return novo.step;
  return null;
}

// ---------- plataforma ----------

// 'ios'              — iPhone: lê a etiqueta sozinho e mostra um aviso no topo
// 'android'          — Chrome no Android: Web NFC (NDEFReader), botão "Ler bichinho"
// 'android-sem-leitor' — Android noutro navegador: o sistema abre o link da etiqueta
// 'sem-nfc'          — computador, iPad: não lê a peça
// ambiente: { userAgent, maxTouchPoints, temNdef }
export function detectarPlataforma({ userAgent = '', maxTouchPoints = 0, temNdef = false } = {}) {
  const ua = String(userAgent);
  if (/iPhone|iPod/.test(ua)) return 'ios';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'sem-nfc';
  if (temNdef) return 'android';
  if (/Android/.test(ua)) return 'android-sem-leitor';
  return 'sem-nfc';
}

// Por que o NDEFReader.scan() falhou (o nome do DOMException):
// 'cancelado' (o próprio app parou), 'permissao', 'desligado' (o Chrome usa
// NotReadableError para o NFC desligado nas Configurações), 'sem-suporte', 'outro'.
export function motivoFalhaNfc(erro) {
  switch (erro?.name) {
    case 'AbortError': return 'cancelado';
    case 'NotAllowedError': return 'permissao';
    case 'NotReadableError': return 'desligado';
    case 'NotSupportedError': return 'sem-suporte';
    default: return 'outro';
  }
}

// Voz do botão "Ouvir": a primeira pt-BR; senão qualquer português; senão null
// (o navegador usa a padrão com lang = 'pt-BR').
export function escolherVoz(vozes) {
  const lista = Array.from(vozes ?? []);
  const lang = (v) => String(v?.lang ?? '').replace('_', '-').toLowerCase();
  return lista.find((v) => lang(v) === 'pt-br') ?? lista.find((v) => lang(v).startsWith('pt')) ?? null;
}

// ---------- dicas da primeira partida (coach) ----------

// Uma dica por vez, cada uma só uma vez. momento:
//   'inicio'  — a partida abriu (antes do 1º giro)
//   'escolha' — logo depois (escolher o resultado)
//   'rodada'  — uma rodada acabou; golpe = golpeDaRodada (js/regras.js)
// Devolve { id, texto } ou null.
export function proximaDica(momento, vistas, { golpe = null, contraRival = false } = {}) {
  const nova = (id, texto) => (vistas.has(id) ? null : { id, texto });
  if (momento === 'inicio') {
    return nova('girar', contraRival
      ? 'Gire o seu pião duas vezes: uma por você, outra pelo Rato'
      : 'Girem os dois ao mesmo tempo');
  }
  if (momento === 'escolha') return nova('tocar', 'Toque no desenho que ficou virado pra cima');
  if (momento === 'rodada') {
    if (golpe === 'CHOQUE') return nova('choque', 'Mesmo desenho: os dois perdem 1');
    if (golpe === 'TROPECOU') return nova('tropeco', 'O X perde pra tudo');
  }
  return null;
}
