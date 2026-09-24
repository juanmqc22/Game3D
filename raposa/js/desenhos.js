// Ilustrações da fazenda, em SVG feito à mão. Conteúdo fixo (sem dados do usuário).
// Cores vêm das variáveis do CSS quando faz sentido, para o tema da noite.

function svg(viewBox, conteudo, classe = '') {
  return `<svg class="des ${classe}" viewBox="${viewBox}" aria-hidden="true" focusable="false">${conteudo}</svg>`;
}

// ---------- itens ----------

export function desMilho(classe = '') {
  return svg('0 0 48 48', ''
    + '<path fill="#6f9a4a" d="M24 44c-7-4-13-12-12-24 5 5 8 11 10 18z"/>'
    + '<path fill="#86b35a" d="M24 44c7-4 13-12 12-24-5 5-8 11-10 18z"/>'
    + '<ellipse cx="24" cy="21" rx="8" ry="17" fill="#f2c53d"/>'
    + '<g fill="#e0a92a">'
    + '<circle cx="21" cy="10" r="2"/><circle cx="27" cy="10" r="2"/>'
    + '<circle cx="19" cy="16" r="2"/><circle cx="24" cy="15" r="2"/><circle cx="29" cy="16" r="2"/>'
    + '<circle cx="19" cy="22" r="2"/><circle cx="24" cy="21" r="2"/><circle cx="29" cy="22" r="2"/>'
    + '<circle cx="20" cy="28" r="2"/><circle cx="25" cy="27" r="2"/><circle cx="29" cy="29" r="1.8"/>'
    + '</g>'
    + '<path fill="#5c8a3c" d="M24 44c-4-3-7-9-7-15 4 3 6 8 7 15z"/>', `item milho ${classe}`);
}

export function desLeite(classe = '') {
  return svg('0 0 48 48', ''
    + '<rect x="19" y="3" width="10" height="5" rx="2" fill="#3f7cc4"/>'
    + '<path fill="#fffdf7" stroke="#c9bfae" stroke-width="1.5" d="M19 8h10v5l5 7v20a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V20l5-7z"/>'
    + '<path fill="#dbe9f7" d="M14.8 26h18.4v8H14.8z"/>'
    + '<path fill="#3f7cc4" d="M20 30.5c1.5-2 3-2 4 0s2.5 2 4 0" stroke="#3f7cc4" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
    + '<path fill="#fff" opacity=".9" d="M17 21h2v17h-2z"/>', `item leite ${classe}`);
}

export function desOvo(classe = '') {
  return svg('0 0 48 48', ''
    + '<path fill="#e0a526" stroke="#a8700f" stroke-width="1.2" d="M24 4c8 0 15 13 15 23s-7 17-15 17S9 37 9 27 16 4 24 4z"/>'
    + '<path fill="#f5c542" d="M24 6c6 0 12 11 12 20 0 6-3 10-8 12-9 1-16-5-16-12C12 17 18 6 24 6z"/>'
    + '<ellipse cx="18.5" cy="17" rx="3" ry="5" fill="#fff" opacity=".75" transform="rotate(-20 18.5 17)"/>'
    + '<path fill="#fff8d6" d="M34 9l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z"/>', `item ovo ${classe}`);
}

// Praga: uma lagartinha comendo a folha.
export function desPraga(classe = '') {
  return svg('0 0 48 48', ''
    + '<path fill="#9bbf6a" d="M8 38C8 20 22 8 42 8c0 20-12 34-30 34z"/>'
    + '<path fill="none" stroke="#6f9a4a" stroke-width="1.6" d="M12 38 38 12"/>'
    + '<circle cx="30" cy="26" r="5" fill="#f6ecd6"/>'
    + '<g fill="#8a5a2b"><circle cx="14" cy="30" r="4"/><circle cx="19" cy="31" r="4.4"/>'
    + '<circle cx="24.5" cy="30" r="4.6"/></g>'
    + '<circle cx="28" cy="27.5" r="5" fill="#a36a33"/>'
    + '<circle cx="29.5" cy="26.5" r="1.3" fill="#2b1d12"/>'
    + '<path d="M27 22.6 25 19M30.5 22.8l1-3.8" stroke="#2b1d12" stroke-width="1.3" stroke-linecap="round"/>', `item praga ${classe}`);
}

export function desEstrela(classe = '') {
  return svg('0 0 24 24',
    '<path fill="#f5c542" stroke="#a8700f" stroke-width="1.2" stroke-linejoin="round" d="M12 2.2l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 16.9l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/>',
    `estrela ${classe}`);
}

export const DES_ITEM = { ovo: desOvo, milho: desMilho, leite: desLeite };
export const DES_FACE = { ESPECIAL: desOvo, ATAQUE: desMilho, DEFESA: desLeite, TROPECO: desPraga };

// ---------- cenário ----------

export function desCeleiro(classe = '') {
  return svg('0 0 160 130', ''
    + '<path fill="#8f3524" d="M14 58 80 10l66 48v8H14z"/>'
    + '<path fill="#b3432f" d="M22 60 80 18l58 42v64H22z"/>'
    + '<path fill="#f6ecd6" d="M22 60 80 18l58 42-4 3L80 24 26 63z"/>'
    + '<rect x="66" y="40" width="28" height="20" rx="3" fill="#f6ecd6"/>'
    + '<path fill="#6b2a1c" d="M70 44h20v12H70z"/>'
    + '<path stroke="#f6ecd6" stroke-width="2" d="M80 44v12M70 50h20"/>'
    + '<rect x="54" y="74" width="52" height="50" rx="2" fill="#f6ecd6"/>'
    + '<rect x="58" y="78" width="44" height="46" fill="#8f3524"/>'
    + '<path stroke="#f6ecd6" stroke-width="4" d="M58 78l44 46M102 78l-44 46M80 78v46"/>'
    + '<rect x="30" y="80" width="14" height="14" rx="2" fill="#f6ecd6"/>'
    + '<rect x="116" y="80" width="14" height="14" rx="2" fill="#f6ecd6"/>'
    + '<path fill="#6b2a1c" d="M32 82h10v10H32zM118 82h10v10h-10z"/>'
    + '<path fill="#e9b949" d="M4 124c10-10 20-10 30 0zM128 124c8-12 20-12 28 0z"/>', `celeiro ${classe}`);
}

export function desCaminhao(classe = '') {
  return svg('0 0 200 110', ''
    + '<rect x="8" y="30" width="118" height="54" rx="6" fill="#e9b949"/>'
    + '<path fill="#c98a14" d="M8 44h118v6H8zM8 64h118v6H8z"/>'
    + '<rect x="18" y="14" width="24" height="20" rx="3" fill="#b3432f"/>'
    + '<rect x="46" y="18" width="22" height="16" rx="3" fill="#6f9a4a"/>'
    + '<rect x="72" y="10" width="26" height="24" rx="3" fill="#b3432f"/>'
    + '<rect x="102" y="18" width="18" height="16" rx="3" fill="#fffdf7" stroke="#c9bfae"/>'
    + '<path fill="#3f7cc4" d="M130 38h36l20 22v24h-56z"/>'
    + '<path fill="#dbe9f7" d="M138 44h24l14 16h-38z"/>'
    + '<rect x="182" y="70" width="10" height="8" rx="2" fill="#f5c542"/>'
    + '<rect x="4" y="80" width="190" height="8" rx="4" fill="#5b4636"/>'
    + '<g class="roda"><circle cx="40" cy="90" r="14" fill="#3b2a1e"/><circle cx="40" cy="90" r="6" fill="#c9bfae"/></g>'
    + '<g class="roda"><circle cx="160" cy="90" r="14" fill="#3b2a1e"/><circle cx="160" cy="90" r="6" fill="#c9bfae"/></g>', `caminhao ${classe}`);
}

export function desGalinha(classe = '') {
  return svg('0 0 80 80', ''
    + '<path fill="#fffdf7" stroke="#c9bfae" stroke-width="1.5" d="M18 46c0-14 10-22 22-22 4-10 16-10 18 0 2 6-2 10-4 12 6 6 8 12 8 18 0 12-10 18-22 18S18 62 18 46z"/>'
    + '<path fill="#f0e4cc" d="M26 48c6 6 16 8 24 2-2 10-20 12-24-2z"/>'
    + '<path fill="#d9412b" d="M46 14c2-4 6-4 7 0 3-2 6 0 5 4H46z"/>'
    + '<path fill="#f5a623" d="M59 26l9 3-9 3z"/>'
    + '<circle cx="52" cy="24" r="2.2" fill="#2b1d12"/>'
    + '<path fill="#d9412b" d="M57 32c2 3 0 6-2 6s-2-4 2-6z"/>'
    + '<path stroke="#f5a623" stroke-width="3" stroke-linecap="round" d="M34 70v8M44 70v8"/>'
    + '<path fill="#e9dcc2" d="M12 36c4 2 8 6 8 12-6-2-9-6-8-12z"/>', `galinha ${classe}`);
}

export function desLua(classe = '') {
  return svg('0 0 64 64', ''
    + '<path fill="#fff4c9" d="M40 6a26 26 0 1 0 18 42A22 22 0 0 1 40 6z"/>'
    + '<circle cx="26" cy="24" r="3" fill="#f0e2a8"/><circle cx="20" cy="38" r="4" fill="#f0e2a8"/>'
    + '<circle cx="32" cy="46" r="2.4" fill="#f0e2a8"/>', `lua ${classe}`);
}

export function desSol(classe = '') {
  return svg('0 0 64 64', ''
    + '<g stroke="#f5b53d" stroke-width="4" stroke-linecap="round">'
    + '<path d="M32 4v8M32 52v8M4 32h8M52 32h8M12 12l6 6M46 46l6 6M12 52l6-6M46 18l6-6"/></g>'
    + '<circle cx="32" cy="32" r="14" fill="#f9d25c"/>', `sol ${classe}`);
}

// A Raposa: rosto de frente. `astuta` = olhos semicerrados.
export function desRaposa(classe = '') {
  return svg('0 0 120 110', ''
    + '<path fill="#d9692b" d="M14 6l30 30H24z"/><path fill="#d9692b" d="M106 6 76 36h20z"/>'
    + '<path fill="#3b2a1e" d="M18 12l18 20H24zM102 12 84 32h12z"/>'
    + '<path fill="#e8792f" d="M60 104C30 104 12 76 12 50c0-12 8-20 20-22h56c12 2 20 10 20 22 0 26-18 54-48 54z"/>'
    + '<path fill="#fffdf7" d="M60 104c-16 0-30-10-38-26 10 2 22 0 30-8h16c8 8 20 10 30 8-8 16-22 26-38 26z"/>'
    + '<g class="olhos-raposa">'
    + '<path fill="#2b1d12" d="M32 54c4-6 14-6 18 2-6 3-12 2-18-2z"/>'
    + '<path fill="#2b1d12" d="M88 54c-4-6-14-6-18 2 6 3 12 2 18-2z"/>'
    + '<circle cx="42" cy="55" r="1.6" fill="#f5c542"/><circle cx="78" cy="55" r="1.6" fill="#f5c542"/>'
    + '</g>'
    + '<path fill="#2b1d12" d="M52 80c4-4 12-4 16 0-2 5-14 5-16 0z"/>'
    + '<path fill="none" stroke="#2b1d12" stroke-width="2" stroke-linecap="round" d="M60 84v6M52 92c4 3 12 3 16 0"/>', `raposa ${classe}`);
}

// Só os olhos brilhando no escuro (suspense da noite).
export function desOlhos(classe = '') {
  return svg('0 0 120 40', ''
    + '<g class="olhos-brilho"><path fill="#f5d547" d="M14 22c8-12 26-12 32 2-10 6-22 6-32-2z"/>'
    + '<path fill="#f5d547" d="M106 22c-8-12-26-12-32 2 10 6 22 6 32-2z"/>'
    + '<path fill="#2b1d12" d="M28 16h4v12h-4zM88 16h4v12h-4z"/></g>', `olhos ${classe}`);
}

export function desColinas(classe = '') {
  return svg('0 0 400 120', ''
    + '<path class="colina-longe" d="M0 70C60 30 120 40 180 62s130 10 220-24v82H0z"/>'
    + '<path class="colina-perto" d="M0 96c80-34 170-30 250-6 60 18 110 8 150-6v36H0z"/>'
    + '<g class="cerca"><path d="M20 94v18M44 92v18M68 92v18M92 93v18M116 95v18"/>'
    + '<path d="M16 100h104M16 107h104"/></g>', `colinas ${classe}`);
}

export function desCadeado(classe = '') {
  return svg('0 0 48 48', ''
    + '<path fill="none" stroke="currentColor" stroke-width="5" d="M15 22v-6a9 9 0 0 1 18 0v6"/>'
    + '<rect x="9" y="21" width="30" height="23" rx="5" fill="currentColor"/>'
    + '<circle cx="24" cy="31" r="3.5" fill="var(--cor-fundo-cartao)"/>'
    + '<path d="M22.5 33h3v6h-3z" fill="var(--cor-fundo-cartao)"/>', `cadeado ${classe}`);
}
