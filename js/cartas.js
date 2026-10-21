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

/* ---------- Cartas do herói: mão inicial, cartas de nível e a mão que você leva ---------- */
const MAO_INICIAL = 8;   // cartas com que o herói começa
const MAO_MAX = 10;      // quantas cartas entram na mão de um cenário (as outras ficam na coleção)
const MAO_MIN = 6;
const ROMANO = ['', ' II', ' III', ' IV', ' V'];

/** Modelos das cartas de nível de cada classe: o nível sobe, os números crescem (t = 0 a 4). */
const MODELOS_NIVEL = {
  guerreiro: [
    (t) => K('Golpe duplo',  0, { mov: 2, atq: 3 + t }),
    (t) => K('Carga',        0, { mov: 4, atq: 2 + t }),
    (t) => K('Esmagar',      0, { mov: 1, atq: 5 + t, empurrar: 1 }),
    (t) => K('Baluarte',     0, { mov: 2, atq: 2 + Math.ceil(t / 2), escudo: 2 + Math.floor(t / 2) }),
    (t) => K('Redemoinho',   0, { mov: 2, atq: 3 + t, alvo: 'ao-redor' }),
    (t) => K('Respirar fundo', 0, { mov: 1, cura: 3 + t }),
    (t) => K('Grito de guerra', 0, { mov: 3, atq: 2 + t, alc: 3, puxar: 2 }),
    (t) => K('Derrubar',     0, { mov: 2, atq: 4 + t, empurrar: 2 }),
  ],
  cacador: [
    (t) => K('Flecha veloz', 0, { mov: 3, atq: 2 + t, alc: 3 }),
    (t) => K('Disparo longo', 0, { mov: 2, atq: 3 + t, alc: 5 }),
    (t) => K('Flecha de pedra', 0, { mov: 1, atq: 5 + t, alc: 4, empurrar: 1 }),
    (t) => K('Chuva de flechas', 0, { mov: 2, atq: 2 + t, alc: 3, alvo: 'vizinhos' }),
    (t) => K('Corrida',      0, { mov: 5 + Math.floor(t / 2) }),
    (t) => K('Esconderijo',  0, { mov: 3, atq: 1 + t, alc: 3, escudo: 2 + Math.floor(t / 2) }),
    (t) => K('Erva curativa', 0, { mov: 2, cura: 3 + t }),
    (t) => K('Armadilha viva', 0, { mov: 2, atq: 2 + t, alc: 3, puxar: 2 }),
  ],
  oraculo: [
    (t) => K('Faísca',       0, { mov: 3, atq: 2 + t, alc: 3 }),
    (t) => K('Relâmpago',    0, { mov: 1, atq: 5 + t, alc: 4 }),
    (t) => K('Onda de força', 0, { mov: 2, atq: 1 + t, alc: 3, empurrar: 2 }),
    (t) => K('Chuva de fogo', 0, { mov: 1, atq: 3 + t, alc: 4, alvo: 'vizinhos' }),
    (t) => K('Aura de luz',  0, { mov: 2, cura: 4 + t }),
    (t) => K('Barreira',     0, { mov: 2, atq: 1 + t, alc: 3, escudo: 3 + Math.floor(t / 2) }),
    (t) => K('Pulso',        0, { mov: 1, atq: 3 + t, alvo: 'ao-redor' }),
    (t) => K('Sifão de vida', 0, { mov: 2, atq: 2 + t, alc: 3, dreno: true }),
  ],
};
/** As DUAS cartas oferecidas ao chegar no nível `nivel` (2 a 20). Escolhe-se uma; a outra se perde para sempre. */
function cartasDoNivel(classe, nivel) {
  const m = MODELOS_NIVEL[classe] || MODELOS_NIVEL.guerreiro, t = Math.min(4, Math.floor((nivel - 2) / 4));
  const a = ((nivel - 2) * 2) % m.length;
  return [0, 1].map(k => {
    const c = m[(a + k) % m.length](t);
    return { ...c, nome: c.nome + ROMANO[t], ini: ((nivel * 37 + k * 53) % 89) + 6, id: `${classe}_n${nivel}${k ? 'b' : 'a'}` };
  });
}
/** Acha qualquer carta do herói pelo id (inicial ou de nível). */
function cartaHeroiPorId(id) {
  let m = /^([a-z]+)_(\d+)$/.exec(id);
  if (m) { const c = (BARALHOS_HEROI[m[1]] || [])[+m[2]]; return c ? { ...c, id } : null; }
  m = /^([a-z]+)_n(\d+)([ab])$/.exec(id);
  return m ? cartasDoNivel(m[1], +m[2])[m[3] === 'a' ? 0 : 1] : null;
}
/** Ids das cartas com que o herói começa. */
function idsMaoInicial(classe) { return (BARALHOS_HEROI[classe] || BARALHOS_HEROI.guerreiro).slice(0, MAO_INICIAL).map((c, i) => classe + '_' + i); }
/** Monta a mão do herói para o cenário: as cartas escolhidas (`p.mao`) com seus ids. */
function maoDoHeroi(p) {
  return p.mao.map(cartaHeroiPorId).filter(Boolean).map(c => ({ ...c }));
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

/* ============================================================
   BARALHO DE MODIFICADORES (a "sorte" do jogo, estilo Gloomhaven)

   Todo ataque vira UMA carta do baralho do atacante, automaticamente, e a carta aparece na tela:
     +N / −N   soma ou tira N do dano (nunca deixa o ataque abaixo de 1)
     ×2        dano em dobro
     ✖ bloqueio  o ataque falha (dano 0, e empurrar/puxar não acontecem)
   O baralho só é EMBARALHADO de novo quando sai um ×2 ou um bloqueio (todas as cartas voltam para o monte).
   O herói e os monstros têm um baralho cada (o dos monstros vale para todos eles) com no máximo 15 cartas.
   O herói melhora o seu baralho com conquistas (MARCOS, logo abaixo).
   ============================================================ */
const BARALHO_MAX = 15;
const CARTAS_MOD = {
  '-2':   { id: '-2',   tipo: 'valor',    v: -2, rotulo: '−2', nome: 'Fraqueza' },
  '-1':   { id: '-1',   tipo: 'valor',    v: -1, rotulo: '−1', nome: 'Tropeço' },
  '0':    { id: '0',    tipo: 'valor',    v: 0,  rotulo: '+0', nome: 'Golpe normal' },
  '+1':   { id: '+1',   tipo: 'valor',    v: 1,  rotulo: '+1', nome: 'Golpe firme' },
  '+2':   { id: '+2',   tipo: 'valor',    v: 2,  rotulo: '+2', nome: 'Golpe forte' },
  '+3':   { id: '+3',   tipo: 'valor',    v: 3,  rotulo: '+3', nome: 'Golpe brutal' },
  '+4':   { id: '+4',   tipo: 'valor',    v: 4,  rotulo: '+4', nome: 'Golpe lendário' },
  'x2':   { id: 'x2',   tipo: 'x2',       rotulo: '×2', nome: 'Dano em dobro' },
  'bloq': { id: 'bloq', tipo: 'bloqueio', rotulo: '✖', nome: 'Bloqueio' },
};
/** Baralho inicial (12 cartas): o herói e os monstros começam iguais. */
const BARALHO_BASE = ['0', '0', '0', '0', '+1', '+1', '-1', '-1', '+2', '-2', 'x2', 'bloq'];
/** Baralho dos monstros em cada dificuldade: Fácil não tem ×2 e erra bastante; Difícil e Expert ganham golpes melhores. */
const BARALHO_INIM = {
  facil:         ['0', '0', '0', '0', '+1', '+2', '-1', '-1', '-2', 'bloq', 'bloq'],
  intermediario: BARALHO_BASE,
  dificil:       [...BARALHO_BASE, '+1'],
  expert:        [...BARALHO_BASE, '+1', '+2'],
};
const baralhoInimigos = difId => (BARALHO_INIM[difId] || BARALHO_BASE).slice();

/** Liga/desliga a sorte (os testes de regras desligam para os números ficarem exatos: sem sorte = sempre +0). */
const SORTE = { ativa: true };

function misturar(lista) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Um baralho em jogo: monte de comprar + descarte. */
function novoBaralhoMod(ids) { return { compra: misturar(ids), descarte: [], todas: ids.slice() }; }
/** Vira a carta do topo. Se for ×2 ou bloqueio, todas as cartas voltam ao monte e são embaralhadas. */
function sacarMod(b) {
  if (!SORTE.ativa) return { ...CARTAS_MOD['0'], embaralhou: false };
  let embaralhou = false;
  if (!b.compra.length) { b.compra = misturar(b.descarte.length ? b.descarte : b.todas); b.descarte = []; embaralhou = true; }   // acabou o monte
  const id = b.compra.shift();
  b.descarte.push(id);
  const c = CARTAS_MOD[id];
  if (c.tipo !== 'valor') { b.compra = misturar(b.todas); b.descarte = []; embaralhou = true; }
  return { ...c, embaralhou };
}
/** Aplica a carta ao ataque (valor do golpe antes das defesas). Devolve o novo valor do golpe (0 = errou). */
function aplicarMod(ataque, carta) {
  if (carta.tipo === 'bloqueio') return 0;
  if (carta.tipo === 'x2') return ataque * 2;
  return Math.max(1, ataque + carta.v);
}
/** Texto curto do resultado: "+2 → 5", "×2 → 8", "bloqueio". */
function resumoMod(carta, ataque, final) {
  if (carta.tipo === 'bloqueio') return 'ataque falhou!';
  return `${ataque} ${carta.tipo === 'x2' ? '×2' : (carta.v >= 0 ? '+' : '−') + Math.abs(carta.v)} = ${final}`;
}

/* ---------- Conquistas: cada uma põe uma carta melhor no baralho do herói ---------- */
/** stat: o que conta (xp, ouro, abates, baus, cenarios, chefes). Os números valem para a campanha toda. */
const MARCOS = [
  { id: 'xp100',    stat: 'xp',       meta: 100,  carta: '+1', nome: 'Ganhar 100 XP' },
  { id: 'ouro50',   stat: 'ouro',     meta: 50,   carta: '+1', nome: 'Juntar 50 moedas de ouro' },
  { id: 'abates10', stat: 'abates',   meta: 10,   carta: '+2', nome: 'Derrotar 10 inimigos' },
  { id: 'baus2',    stat: 'baus',     meta: 2,    carta: '+1', nome: 'Abrir 2 baús' },
  { id: 'cen4',     stat: 'cenarios', meta: 4,    carta: '+2', nome: 'Vencer 4 cenários' },
  { id: 'xp300',    stat: 'xp',       meta: 300,  carta: '+2', nome: 'Ganhar 300 XP' },
  { id: 'chefe1',   stat: 'chefes',   meta: 1,    carta: 'x2', nome: 'Derrotar um chefe' },
  { id: 'ouro200',  stat: 'ouro',     meta: 200,  carta: '+2', nome: 'Juntar 200 moedas de ouro' },
  { id: 'abates40', stat: 'abates',   meta: 40,   carta: '+3', nome: 'Derrotar 40 inimigos' },
  { id: 'baus6',    stat: 'baus',     meta: 6,    carta: '+3', nome: 'Abrir 6 baús' },
  { id: 'cen10',    stat: 'cenarios', meta: 10,   carta: '+3', nome: 'Vencer 10 cenários' },
  { id: 'chefe3',   stat: 'chefes',   meta: 3,    carta: 'x2', nome: 'Derrotar 3 chefes' },
  { id: 'xp600',    stat: 'xp',       meta: 600,  carta: '+3', nome: 'Ganhar 600 XP' },
  { id: 'ouro600',  stat: 'ouro',     meta: 600,  carta: '+4', nome: 'Juntar 600 moedas de ouro' },
  { id: 'cen20',    stat: 'cenarios', meta: 20,   carta: '+4', nome: 'Vencer os 20 cenários' },
];
const STATS_ROTULO = { xp: 'XP', ouro: 'moedas de ouro', abates: 'inimigos', baus: 'baús', cenarios: 'cenários', chefes: 'chefes' };

/** Coloca a carta no baralho do herói. Se já tem 15, ela toma o lugar da pior (−2, −1, +0, +1: bloqueio e ×2 ficam). */
function adicionarCartaMod(p, id) {
  const pior = ['-2', '-1', '0', '+1'];
  if (p.baralho.length >= BARALHO_MAX) {
    const i = pior.map(x => p.baralho.indexOf(x)).find(k => k >= 0);
    if (i === undefined) return { ok: false };
    const saiu = p.baralho.splice(i, 1)[0];
    p.baralho.push(id);
    return { ok: true, trocou: saiu };
  }
  p.baralho.push(id);
  return { ok: true };
}
/** Confere as conquistas. Devolve as novas: [{ marco, trocou }] (e já coloca as cartas no baralho). */
function verificarMarcos(p) {
  const novos = [];
  for (const m of MARCOS) {
    if (p.marcos[m.id]) continue;
    if ((p.stats[m.stat] || 0) >= m.meta) {
      p.marcos[m.id] = true;
      const r = adicionarCartaMod(p, m.carta);
      novos.push({ marco: m, trocou: r.trocou || null });
    }
  }
  return novos;
}
