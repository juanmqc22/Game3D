// Dados dos bichinhos. Para adicionar um novo, basta acrescentar um item em CRIATURAS.
//
// Campos do especial (lidos por js/regras.js):
//   dano   — dano causado no oponente ao vencer com ESPECIAL (sempre > 0)
//   cura   — vida que o vencedor recupera (nunca passa da vida inicial)
//   roubo  — true: a cura só acontece se o dano passar (não foi anulado por escudo)
//   escudo — true: o vencedor ganha escudo (anula o próximo dano que receber)
//   recuo  — dano que o vencedor causa em si mesmo (sempre acontece, ignora escudo)
//   texto  — frase curta mostrada na tela (nome + texto em ~60 caracteres)

// Cor do cartão por espécie. Espécie nova: acrescente aqui também.
export const ESPECIES = {
  tatu: { rotulo: 'Tatu', cor: '#8a4b12' },
  sapo: { rotulo: 'Sapo', cor: '#1f6b2a' },
};

export const CRIATURAS = [
  {
    codigo: 'TAT01', nome: 'Couraça', especie: 'tatu', vida: 16, forca: 3,
    especial: {
      nome: 'Bola de Ferro', dano: 2, cura: 0, roubo: false, escudo: true, recuo: 0,
      texto: '2 de dano e ativa escudo (anula o próximo dano)',
    },
  },
  {
    codigo: 'SAP02', nome: 'Bocão', especie: 'sapo', vida: 15, forca: 3,
    especial: {
      nome: 'Língua Chicote', dano: 4, cura: 4, roubo: true, escudo: false, recuo: 0,
      texto: 'oponente -4 de vida, você +4 de vida',
    },
  },
  {
    codigo: 'TAT03', nome: 'Ferrão', especie: 'tatu', vida: 15, forca: 3,
    especial: {
      nome: 'Espinho', dano: 5, cura: 0, roubo: false, escudo: false, recuo: 0,
      texto: '5 de dano direto',
    },
  },
  {
    codigo: 'SAP04', nome: 'Salta', especie: 'sapo', vida: 14, forca: 4,
    especial: {
      nome: 'Pulo Duplo', dano: 6, cura: 0, roubo: false, escudo: false, recuo: 0,
      texto: '6 de dano direto',
    },
  },
  {
    codigo: 'TAT05', nome: 'Casco', especie: 'tatu', vida: 17, forca: 3,
    especial: {
      nome: 'Casca Dura', dano: 2, cura: 4, roubo: false, escudo: false, recuo: 0,
      texto: '+4 de vida e causa 2 de dano',
    },
  },
  {
    codigo: 'SAP06', nome: 'Trovão', especie: 'sapo', vida: 15, forca: 3,
    especial: {
      nome: 'Estouro', dano: 6, cura: 0, roubo: false, escudo: false, recuo: 1,
      texto: '6 de dano no oponente e 1 em você mesmo',
    },
  },
];

// Aceita "sap02", " SAP 02 " etc. Retorna null se o código não existir.
export function buscarCriatura(codigo) {
  if (typeof codigo !== 'string') return null;
  const normalizado = codigo.replace(/\s+/g, '').toUpperCase();
  return CRIATURAS.find((c) => c.codigo === normalizado) ?? null;
}
