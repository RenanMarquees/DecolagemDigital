'use strict';
/* ============================================================
   CARTAS DE HABILIDADE DOS INIMIGOS (estilo Gloomhaven)

   Cada TIPO de inimigo tem um baralho embaralhado. A cada rodada, antes do seu turno,
   o jogo vira a carta do topo de cada baralho e MOSTRA na tela o que aquele tipo vai fazer.
   Todos os inimigos do mesmo tipo fazem o que a carta manda.

   Campos de uma carta (o que não aparece = o inimigo NÃO faz aquilo):
     ini            iniciativa: quem tem número menor age primeiro
     mov            anda (valor base do inimigo + mov).  Sem "mov": não anda
     atq            ataca (dano base do inimigo + atq, em pontos de vida).  Sem "atq": não ataca
     alc            muda o alcance do ataque (ex.: +1)
     curar          cura a si mesmo e aos aliados ao lado: N pontos de vida
     fortalecer     aliados ao lado (e ele mesmo) ganham +N de dano nesta rodada
     escudo         reduz em N cada golpe que ele (e aliados ao lado) recebe nesta rodada
     empurrarHeroi  se o ataque acertar, empurra você N hexágonos
     puxarHeroi     se o ataque acertar, puxa você N hexágonos para perto
   ============================================================ */

/** Atalho para escrever cartas: K('Nome', iniciativa, { campos }). */
const K = (nome, ini, campos = {}) => ({ nome, ini, ...campos });

/* ---------- Baralhos-base por "jeito de lutar" ---------- */
const ARQUETIPOS = {
  // corpo a corpo que avança e bate
  investida: [
    K('Avançar',        30, { mov: 1, atq: -1 }),
    K('Golpe pesado',   60, { atq: 2 }),
    K('Investida',      22, { mov: 2, atq: -1 }),
    K('Ataque firme',   45, { mov: 0, atq: 0 }),
    K('Guarda',         70, { escudo: 2, atq: -1 }),
    K('Rugido',         50, { fortalecer: 1, mov: 0, atq: 0 }),
  ],
  // rápidos: dão o bote e somem
  predador: [
    K('Bote',           12, { mov: 2, atq: 0 }),
    K('Perseguir',      25, { mov: 3, atq: -2 }),
    K('Mordida',        40, { mov: 1, atq: 1 }),
    K('Dilacerar',      55, { atq: 2 }),
    K('Rodear',         35, { mov: 2, atq: -1 }),
    K('Chamado',        65, { fortalecer: 1, mov: 1 }),
  ],
  // atacam de longe
  atirador: [
    K('Mirar',          50, { atq: 2, alc: 1 }),
    K('Reposicionar',   28, { mov: 1, atq: -1 }),
    K('Salva',          42, { atq: 0 }),
    K('Recarregar',     80, { escudo: 1 }),
    K('Tiro certeiro',  35, { mov: 1, atq: 1, alc: 1 }),
    K('Fogo de cobertura', 60, { fortalecer: 1, atq: -1 }),
  ],
  // curam e fortalecem os outros
  suporte: [
    K('Cura menor',     20, { curar: 2 }),
    K('Cura e fortalece', 25, { curar: 2, fortalecer: 1 }),
    K('Aproximar-se',   40, { mov: 1, atq: -1 }),
    K('Golpe',          55, { atq: 1 }),
    K('Escudo coletivo', 35, { escudo: 1, curar: 1 }),
    K('Assombrar',      48, { mov: 1, atq: 0 }),
  ],
  // lentos e pesados
  bruto: [
    K('Marchar',        40, { mov: 0, atq: 0 }),
    K('Esmagar',        75, { atq: 2, empurrarHeroi: 1 }),
    K('Provocar',       30, { escudo: 2, mov: 1 }),
    K('Pancada',        50, { mov: 1, atq: 0 }),
    K('Descansar',      85, { curar: 2 }),
    K('Arremesso',      60, { atq: 1, empurrarHeroi: 1 }),
  ],
};

/** Cada inimigo comum usa um arquétipo + 1 carta só dele (a "assinatura"). */
const JEITO = {
  draugr:      ['investida', K('Maldição dos mortos', 38, { fortalecer: 1, atq: 0 })],
  lobo_gelo:   ['predador',  K('Uivo da matilha', 18, { fortalecer: 1, mov: 2 })],
  valquiria:   ['atirador',  K('Lança arremessada', 32, { atq: 2, alc: 2 })],
  troll_gelo:  ['bruto',     K('Regeneração gélida', 72, { curar: 3 })],
  harpia:      ['predador',  K('Rasante', 14, { mov: 3, atq: 1, puxarHeroi: 1 })],
  satiro:      ['suporte',   K('Flauta de Pã', 15, { fortalecer: 2 })],
  ciclope:     ['atirador',  K('Pedra enorme', 65, { atq: 2, alc: 1, empurrarHeroi: 1 })],
  minotauro:   ['bruto',     K('Chifrada', 24, { mov: 2, atq: 2, empurrarHeroi: 2 })],
  alma_penada: ['suporte',   K('Sussurro do além', 22, { curar: 2, fortalecer: 1, escudo: 1 })],
  diabrete:    ['atirador',  K('Bola de fogo', 38, { atq: 2, alc: 1 })],
  cerbero:     ['investida', K('Três mordidas', 26, { mov: 1, atq: 2 })],
  demonio:     ['predador',  K('Mergulho infernal', 16, { mov: 3, atq: 1, empurrarHeroi: 1 })],
  escaravelho: ['predador',  K('Enxame', 20, { mov: 2, fortalecer: 1, atq: 0 })],
  mumia:       ['bruto',     K('Abraço de ataduras', 58, { atq: 1, puxarHeroi: 1 })],
  chacal:      ['investida', K('Julgamento de Anúbis', 34, { mov: 1, atq: 2, escudo: 1 })],
  serpente:    ['atirador',  K('Cuspe venenoso', 30, { atq: 2, alc: 1, mov: 1 })],
};

/* ---------- Baralhos únicos dos chefes (8 cartas cada). As cartas fortes mostram o perigo antes de acontecer ---------- */
const BARALHOS_CHEFE = {
  fenrir: [
    K('Mordida do Ragnarök', 15, { mov: 2, atq: 3, empurrarHeroi: 1 }),
    K('Salto',               10, { mov: 3, atq: 0 }),
    K('Garras',              35, { mov: 1, atq: 1 }),
    K('Uivo gelado',         50, { fortalecer: 2, mov: 1 }),
    K('Cerco',               28, { mov: 2, atq: -1 }),
    K('Dilacerar',           45, { atq: 2 }),
    K('Pele de gelo',        70, { escudo: 3 }),
    K('Fome do lobo',        20, { mov: 2, atq: 1, curar: 1 }),
  ],
  ares: [
    K('Fúria de Ares',       12, { mov: 2, atq: 3 }),
    K('Lançada',             30, { mov: 1, atq: 1, alc: 1 }),
    K('Investida do escudo', 22, { mov: 2, atq: 0, empurrarHeroi: 2 }),
    K('Grito de guerra',     48, { fortalecer: 2, escudo: 1 }),
    K('Golpe de espada',     40, { atq: 2 }),
    K('Muralha de bronze',   65, { escudo: 3, atq: -1 }),
    K('Marcha',              33, { mov: 2, atq: -1 }),
    K('Sede de sangue',      18, { mov: 1, atq: 2, curar: 1 }),
  ],
  hades: [
    K('Toque da Morte',      14, { mov: 1, atq: 3, alc: 1 }),
    K('Garra das sombras',   30, { atq: 2, puxarHeroi: 2 }),
    K('Chamado dos mortos',  45, { fortalecer: 2, curar: 2 }),
    K('Passo sombrio',       24, { mov: 2, atq: 0 }),
    K('Maldição',            50, { atq: 1, alc: 1 }),
    K('Véu do Inferno',      70, { escudo: 3 }),
    K('Fogo negro',          36, { atq: 2, alc: 1, empurrarHeroi: 1 }),
    K('Drenar vida',         55, { atq: 1, curar: 2 }),
  ],
  set: [
    K('Tempestade de Areia', 13, { mov: 2, atq: 3, alc: 1 }),
    K('Ferroada',            28, { mov: 1, atq: 2 }),
    K('Pinças',              38, { atq: 2, puxarHeroi: 1 }),
    K('Caos nas dunas',      50, { fortalecer: 2, mov: 1 }),
    K('Rastejar',            22, { mov: 3, atq: -1 }),
    K('Casca de escorpião',  68, { escudo: 3 }),
    K('Veneno de Set',       32, { mov: 1, atq: 2, empurrarHeroi: 1 }),
    K('Regeneração',         80, { curar: 3 }),
  ],
  caos: [
    K('Colapso do Cosmos',   11, { mov: 2, atq: 4, alc: 1 }),
    K('Tentáculos',          26, { atq: 2, puxarHeroi: 2 }),
    K('Onda do vazio',       36, { atq: 2, empurrarHeroi: 2 }),
    K('Ecos do Caos',        48, { fortalecer: 2, curar: 2 }),
    K('Deslizar',            20, { mov: 3, atq: 0 }),
    K('Manto estelar',       70, { escudo: 3, atq: -1 }),
    K('Olhares',             42, { atq: 2, alc: 2 }),
    K('Devorar',             58, { atq: 2, curar: 3 }),
  ],
  // estruturas (torres, altares...) não jogam cartas
};


/* ============================================================
   CARTAS DO HERÓI (estilo Gloomhaven) — habilidades e iniciativa

   No começo de cada rodada você escolhe UMA carta da sua mão. O número da carta é a sua INICIATIVA:
   quem tem o menor número age primeiro (você e os inimigos entram na mesma fila).
   A carta diz TUDO que você faz no turno: quanto anda, qual o ataque, curas, escudo, empurrões.
   Carta usada vai para o descarte; quando a mão acaba (ou quando você quiser) você DESCANSA:
   perde a vez (iniciativa 99), recupera vida e pega todas as cartas de volta.
   Os números são pequenos de propósito (dano 2, 3, 6...). O seu dano final = dano da carta + bônus de atributo e armas.

   Campos da carta do herói (o que não aparece = não faz):
     ini      iniciativa (1 a 99)
     mov      quantos hexágonos você anda (soma o bônus de botas e destreza)
     atq      dano do seu ataque (soma o bônus de força/arma). Sem "atq": a carta não ataca
     alc      alcance do ataque (1 = corpo a corpo). Se for maior que 1, armas de longo alcance somam
     alvo     'um' (padrão) | 'ao-redor' (todos os inimigos ao seu lado) | 'vizinhos' (o alvo e quem está colado nele)
     empurrar empurra quem foi atingido N hexágonos
     puxar    puxa quem foi atingido N hexágonos até você
     escudo   cada golpe que você recebe nesta rodada diminui em N
     cura     recupera N de vida no começo do seu turno
     dreno    você recupera metade do dano que causar
   ============================================================ */
const BARALHOS_HEROI = {
  guerreiro: [
    K('Golpe firme',     30, { mov: 2, atq: 3 }),
    K('Investida',       15, { mov: 4, atq: 2 }),
    K('Marretada',       70, { mov: 1, atq: 6, empurrar: 1 }),
    K('Muralha',         45, { mov: 2, atq: 2, escudo: 2 }),
    K('Giro de lâmina',  50, { mov: 2, atq: 3, alvo: 'ao-redor' }),
    K('Empurrão',        40, { mov: 2, atq: 2, empurrar: 2 }),
    K('Fôlego',          80, { mov: 1, cura: 4 }),
    K('Fúria',           25, { mov: 3, atq: 4 }),
    K('Desafio',         20, { mov: 3, atq: 2, alc: 3, puxar: 2 }),
    K('Golpe pesado',    60, { mov: 2, atq: 5 }),
  ],
  cacador: [
    K('Tiro certeiro',   40, { mov: 2, atq: 3, alc: 4 }),
    K('Recuar e atirar', 25, { mov: 4, atq: 1, alc: 3 }),
    K('Flecha pesada',   75, { mov: 1, atq: 5, alc: 4, empurrar: 1 }),
    K('Rajada',          55, { mov: 2, atq: 2, alc: 3, alvo: 'vizinhos' }),
    K('Salto',           10, { mov: 5 }),
    K('Camuflagem',      30, { mov: 3, atq: 1, alc: 3, escudo: 2 }),
    K('Flecha atordoante', 50, { mov: 2, atq: 2, alc: 3, empurrar: 2 }),
    K('Mira firme',      65, { mov: 1, atq: 4, alc: 5 }),
    K('Fôlego',          70, { mov: 2, cura: 3 }),
    K('Tiro rápido',     20, { mov: 3, atq: 2, alc: 3 }),
  ],
  oraculo: [
    K('Raio',            35, { mov: 2, atq: 3, alc: 4 }),
    K('Tempestade',      85, { mov: 1, atq: 4, alc: 4, alvo: 'vizinhos' }),
    K('Bênção de cura',  50, { mov: 2, cura: 5 }),
    K('Vento arcano',    25, { mov: 2, atq: 1, alc: 3, empurrar: 2 }),
    K('Drenar alma',     45, { mov: 2, atq: 2, alc: 3, dreno: true, puxar: 1 }),
    K('Escudo arcano',   30, { mov: 2, atq: 1, alc: 3, escudo: 3 }),
    K('Explosão',        65, { mov: 1, atq: 3, alvo: 'ao-redor' }),
    K('Passo etéreo',    12, { mov: 4, atq: 1, alc: 3 }),
    K('Julgamento',      75, { mov: 1, atq: 5, alc: 4 }),
    K('Meditar',         80, { mov: 1, cura: 3 }),
  ],
};
/** A carta de descanso: iniciativa 99, você não anda nem age, mas recupera vida e todas as cartas. */
const CARTA_DESCANSO = K('Descansar', 99, { descanso: true });

/** Monta a mão inicial do herói (cada carta ganha um id para ser escolhida). */
function maoDoHeroi(classe) {
  return (BARALHOS_HEROI[classe] || BARALHOS_HEROI.guerreiro).map((c, i) => ({ ...c, id: classe + '_' + i }));
}

/** Texto curto dos efeitos de uma carta do herói: [{icone, texto}]. `bonus` (opcional) soma os bônus de atributos e itens. */
function descreverCartaHeroi(c, bonus) {
  const b = bonus || { dano: 0, mov: 0, cura: 0, alc: 0 };
  if (c.descanso) return [{ icone: '💤', texto: 'não anda nem age' }, { icone: '✚', texto: 'recupera vida' }, { icone: '🃏', texto: 'cartas voltam à mão' }];
  const out = [];
  if (c.mov) out.push({ icone: '👣', texto: 'anda ' + (c.mov + b.mov) });
  if (c.atq) {
    const alc = (c.alc || 1) + ((c.alc || 1) > 1 ? b.alc : 0);
    const alvo = c.alvo === 'ao-redor' ? ' (ao redor)' : c.alvo === 'vizinhos' ? ' (+vizinhos)' : '';
    out.push({ icone: '⚔️', texto: `dano ${c.atq + b.dano}${alvo}` });
    out.push({ icone: '🎯', texto: alc > 1 ? 'alcance ' + alc : 'corpo a corpo' });
  }
  if (c.empurrar) out.push({ icone: '💨', texto: 'empurra ' + c.empurrar });
  if (c.puxar) out.push({ icone: '🧲', texto: 'puxa ' + c.puxar });
  if (c.escudo) out.push({ icone: '🛡️', texto: 'escudo ' + c.escudo });
  if (c.cura) out.push({ icone: '✚', texto: 'cura ' + (c.cura + b.cura) });
  if (c.dreno) out.push({ icone: '🩸', texto: 'rouba vida' });
  if (!out.length) out.push({ icone: '▫️', texto: 'turno normal' });
  return out;
}

/** Monta o baralho (lista de cartas) de um tipo de inimigo. */
function baralhoDe(idInimigo) {
  if (BARALHOS_CHEFE[idInimigo]) return BARALHOS_CHEFE[idInimigo].map(c => ({ ...c }));
  const j = JEITO[idInimigo] || ['investida', null];
  const base = ARQUETIPOS[j[0]].map(c => ({ ...c }));
  if (j[1]) base.push({ ...j[1] });
  return base;
}

/** Texto curto de cada efeito da carta, para mostrar na tela: [{icone, texto}] */
function descreverCarta(c) {
  const sinal = n => (n > 0 ? '+' + n : String(n));
  const out = [];
  out.push(c.mov === undefined ? { icone: '👣', texto: 'não anda' } : { icone: '👣', texto: c.mov === 0 ? 'anda normal' : 'anda ' + sinal(c.mov) });
  out.push(c.atq === undefined ? { icone: '⚔️', texto: 'não ataca' } : { icone: '⚔️', texto: c.atq === 0 ? 'ataque normal' : 'ataque ' + sinal(c.atq) });
  if (c.alc) out.push({ icone: '🎯', texto: 'alcance ' + sinal(c.alc) });
  if (c.curar) out.push({ icone: '✚', texto: 'cura ' + c.curar });
  if (c.fortalecer) out.push({ icone: '💪', texto: 'fortalece ' + c.fortalecer });
  if (c.escudo) out.push({ icone: '🛡️', texto: 'escudo ' + c.escudo });
  if (c.empurrarHeroi) out.push({ icone: '💨', texto: 'empurra você ' + c.empurrarHeroi });
  if (c.puxarHeroi) out.push({ icone: '🧲', texto: 'puxa você ' + c.puxarHeroi });
  return out;
}
