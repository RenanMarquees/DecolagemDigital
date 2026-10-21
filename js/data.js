'use strict';
/* ============================================================
   DADOS DO JOGO — tudo que é "conteúdo" mora aqui:
   classes, habilidades, itens, inimigos, reinos e história.
   Para adicionar um inimigo, item ou reino novo, edite só este arquivo.
   ============================================================ */

/** Personagens que usam um arquivo pronto em modelos/<id>.glb no lugar do modelo feito por código (veja docs/MINIATURAS.md).
 *  Exemplo: const MODELOS_GLB = ['cerbero', 'hades']; */
const MODELOS_GLB = [];
const NIVEL_MAX = 20;
const VIDA_MAX_JOGO = 30;          // ninguém passa disso: as contas ficam fáceis

const RARIDADE_COR = { comum: '#b8b8c4', incomum: '#5fd068', raro: '#4aa3ff', epico: '#b46bff', lendario: '#ffb02e' };

/* ---------- CLASSES ----------
   Tudo que o herói FAZ no turno (andar, atacar, curar, empurrar) vem da CARTA que ele joga (js/cartas.js).
   A classe define a vida (cresce um pouco por nível) e as cartas. Não há atributos: o herói melhora ganhando CARTAS (1 a cada nível). */
const CLASSES = {
  guerreiro: {
    nome: 'Guerreiro', icone: '⚔️', hpBase: 12, hpNivel: 0.8,
    desc: 'Muita vida (até 30), cartas de golpe forte e de empurrar. Aguenta os golpes dos deuses e responde com fúria.',
  },
  cacador: {
    nome: 'Caçador', icone: '🏹', hpBase: 9, hpNivel: 0.7,
    desc: 'Rápido e preciso. Cartas de longo alcance e de movimento: acerta de longe e some.',
  },
  oraculo: {
    nome: 'Oráculo', icone: '🔮', hpBase: 8, hpNivel: 0.7,
    desc: 'Mestre da magia. Cartas de raio, de cura e de área: fere vários inimigos e cuida de si.',
  },
};

/* ---------- ITENS ----------
   Cada herói leva: 1 item na CABEÇA, 1 no PEITO, 1 nos PÉS, 2 nas MÃOS e vários na MOCHILA.
   Bônus possíveis (todos pequenos): hp (vida máxima), atq (dano), esc (escudo: reduz cada golpe recebido),
   mov (movimento), alc (alcance), cura (cura das suas cartas).
   Itens da MOCHILA são consumíveis e usá-los NÃO gasta a sua jogada. */
const SLOTS = { cabeca: 'Cabeça', peito: 'Peito', maos: 'Mãos', pes: 'Pés', mochila: 'Mochila' };
const ITENS = {
  // Consumíveis (mochila): heal = vida recuperada; buff = efeito até o fim do turno/rodada; limpa = tira veneno e gelo
  pocao:         { nome: 'Poção de Cura',        tipo: 'mochila', icone: '🧪', heal: 4,  preco: 6,  raridade: 'comum',   desc: 'Recupera 4 de vida.' },
  hidromel:      { nome: 'Hidromel de Odin',     tipo: 'mochila', icone: '🍺', heal: 8,  preco: 14, raridade: 'incomum', desc: 'Recupera 8 de vida.' },
  ambrosia:      { nome: 'Ambrosia',             tipo: 'mochila', icone: '🍯', heal: 12, preco: 28, raridade: 'raro',    desc: 'Recupera 12 de vida.' },
  agua_nilo:     { nome: 'Água do Nilo Sagrado', tipo: 'mochila', icone: '🌊', heal: 16, limpa: true, preco: 45, raridade: 'raro', desc: 'Recupera 16 de vida e limpa veneno e gelo.' },
  nectar:        { nome: 'Néctar Divino',        tipo: 'mochila', icone: '🏺', heal: 99, limpa: true, preco: 80, raridade: 'epico', desc: 'Recupera toda a vida e limpa veneno e gelo.' },
  pedra_amolar:  { nome: 'Pedra de Amolar',      tipo: 'mochila', icone: '🪨', buff: { atq: 2 },    preco: 8,  raridade: 'comum',   desc: '+2 de dano até o fim deste turno.' },
  tonico_veloz:  { nome: 'Tônico Veloz',         tipo: 'mochila', icone: '⚡', buff: { mov: 2 },    preco: 8,  raridade: 'comum',   desc: '+2 de movimento neste turno.' },
  pele_pedra:    { nome: 'Poção Pele de Pedra',  tipo: 'mochila', icone: '🗿', buff: { escudo: 2 }, preco: 10, raridade: 'incomum', desc: '+2 de escudo até o fim da rodada.' },
  antidoto:      { nome: 'Antídoto',             tipo: 'mochila', icone: '🌿', limpa: true,          preco: 5,  raridade: 'comum',   desc: 'Limpa veneno e gelo.' },

  // Relíquias dos chefes (únicas)
  presa_fenrir: { nome: 'Presa de Fenrir', tipo: 'peito',   icone: '🦷', hp: 2, atq: 1,        preco: 90,  raridade: 'lendario', desc: 'Ainda pulsa com a fome do lobo.' },
  elmo_ares:    { nome: 'Elmo de Ares',    tipo: 'cabeca',  icone: '🪖', hp: 3, esc: 1,        preco: 160, raridade: 'lendario', desc: 'O orgulho do deus da guerra.' },
  coroa_hades:  { nome: 'Coroa de Hades',  tipo: 'cabeca',  icone: '👑', hp: 2, atq: 2,        preco: 260, raridade: 'lendario', desc: 'Pesa como mil almas.' },
  olho_set:     { nome: 'Olho de Set',     tipo: 'maos',    icone: '🧿', atq: 3, mov: 1, alc: 1, preco: 400, raridade: 'lendario', desc: 'Vê o caos em todas as coisas.' },
};

// Equipamentos por tier (0 = inicial, 1 = Valhala, 2 = Olimpo, 3 = Inferno, 4 = Duat)
const TIER_RARIDADE = ['comum', 'incomum', 'raro', 'epico', 'lendario'];
const EQUIP_TIER = {
  cabeca: { hp: [0, 1, 1, 2, 3], preco: [4, 8, 20, 42, 80], nomes: [['Capuz de Pano', '🧢'], ['Elmo de Ferro', '⛑️'], ['Elmo Laureado', '🪖'], ['Elmo de Obsidiana', '🖤'], ['Coroa Solar', '👑']] },
  peito:  { hp: [1, 2, 3, 4, 5], esc: [0, 0, 0, 1, 1], preco: [0, 12, 30, 60, 110], nomes: [['Túnica de Couro', '🥋'], ['Cota de Malha', '⛓️'], ['Peitoral de Bronze', '🛡️'], ['Couraça de Obsidiana', '🖤'], ['Manto Solar de Rá', '🌅']] },
  pes:    { hp: [0, 1, 1, 1, 2], mov: [0, 0, 1, 1, 1], preco: [4, 8, 20, 42, 80], nomes: [['Sandálias', '🩴'], ['Botas de Couro', '🥾'], ['Botas Aladas', '🪽'], ['Botas Infernais', '🔥'], ['Sandálias de Rá', '☀️']] },
};
const ARMA_TIER = { atq: [1, 2, 3, 4, 5], alc: [0, 0, 1, 1, 1], preco: [0, 14, 34, 70, 130] };   // `alc` só para quem ataca de longe
const ESCUDO_TIER = { hp: [1, 1, 1, 2, 2], esc: [0, 0, 1, 1, 2], preco: [8, 16, 36, 72, 130], nomes: [['Escudo de Madeira', '🛡️'], ['Escudo Nórdico', '🛡️'], ['Égide de Bronze', '🛡️'], ['Escudo Demoníaco', '😈'], ['Escudo de Anúbis', '🐺']] };
const NOMES_ARMAS = {
  guerreiro: [['Espada de Ferro', '🗡️'], ['Machado Nórdico', '🪓'], ['Gládio de Ares', '⚔️'], ['Lâmina Infernal', '🔥'], ['Khopesh Dourado', '🌞']],
  cacador:   [['Arco de Freixo', '🏹'], ['Arco de Teixo', '🏹'], ['Arco de Ártemis', '🌙'], ['Arco Sombrio', '🦇'], ['Arco de Rá', '☀️']],
  oraculo:   [['Cajado de Carvalho', '🪄'], ['Cajado de Runas', '🔮'], ['Cajado de Apolo', '✨'], ['Cetro das Sombras', '💀'], ['Cajado de Thoth', '📜']],
};

/** O que o equipamento faz quando você o USA (1 vez por cenário): "✚ cura 3 · 🛡️ escudo 1 · ⚔️ +2 de dano...". */
function descreverBonus(it) {
  const o = [], cura = (it.hp || 0) + (it.cura || 0);
  if (cura) o.push(`✚ cura ${cura}`); if (it.atq) o.push(`⚔️ +${it.atq} de dano`); if (it.mov) o.push(`👣 +${it.mov} de movimento`);
  if (it.esc) o.push(`🛡️ escudo ${it.esc}`); if (it.alc) o.push(`🎯 +${it.alc} de alcance`);
  return o.join(' · ');
}

// Gera automaticamente os equipamentos a partir das tabelas acima
(function gerarEquipamentos() {
  for (const [slot, tab] of Object.entries(EQUIP_TIER)) {
    tab.nomes.forEach(([nome, icone], t) => {
      const it = { nome, icone, tipo: slot, preco: tab.preco[t], raridade: TIER_RARIDADE[t] };
      if (tab.hp && tab.hp[t]) it.hp = tab.hp[t]; if (tab.esc && tab.esc[t]) it.esc = tab.esc[t]; if (tab.mov && tab.mov[t]) it.mov = tab.mov[t];
      it.desc = descreverBonus(it) || 'Sem bônus';
      ITENS[`${slot}_${t}`] = it;
    });
  }
  for (const classe of Object.keys(NOMES_ARMAS)) {
    NOMES_ARMAS[classe].forEach(([nome, icone], t) => {
      const longe = classe !== 'guerreiro';
      const it = { nome, icone, tipo: 'maos', classe, atq: ARMA_TIER.atq[t], preco: ARMA_TIER.preco[t], raridade: TIER_RARIDADE[t] };
      if (longe && ARMA_TIER.alc[t]) it.alc = ARMA_TIER.alc[t];
      it.desc = descreverBonus(it) + ` (só ${CLASSES[classe].nome})`;
      ITENS[`${classe}_${t}`] = it;
    });
  }
  ESCUDO_TIER.nomes.forEach(([nome, icone], t) => {
    const it = { nome, icone, tipo: 'maos', hp: ESCUDO_TIER.hp[t], preco: ESCUDO_TIER.preco[t], raridade: TIER_RARIDADE[t] };
    if (ESCUDO_TIER.esc[t]) it.esc = ESCUDO_TIER.esc[t];
    it.desc = descreverBonus(it);
    ITENS[`escudo_${t}`] = it;
  });
})();

/* ---------- INIMIGOS ----------
   hp = vida, atk = dano base de cada golpe (a carta do turno soma/subtrai), def = quanto cada golpe SEU contra ele é reduzido.
   Números pequenos de propósito: dá para fazer a conta de cabeça. */
const INIMIGOS = {
  // --- Valhala ---
  draugr:      { nome: 'Draugr',              icone: '🧟', mov: 2, alc: 1, hp: 5,  atk: 2, def: 0,  xp: 2, gold: 1,  drops: [{ id: 'pocao', chance: 0.25 }] },
  lobo_gelo:   { nome: 'Lobo de Gelo',        icone: '🐺', mov: 4, alc: 1, hp: 4,  atk: 3, def: 0,  xp: 2, gold: 1,  drops: [{ id: 'pocao', chance: 0.2 }] },
  valquiria:   { nome: 'Valquíria Caída',     icone: '🧝‍♀️', mov: 2, alc: 3, hp: 5,  atk: 2, def: 0,  xp: 3, gold: 2, drops: [{ id: 'tonico_veloz', chance: 0.25 }] },
  troll_gelo:  { nome: 'Troll de Gelo',       icone: '🧌', mov: 2, alc: 1, hp: 9,  atk: 3, def: 1,  xp: 4, gold: 2, drops: [{ id: 'hidromel', chance: 0.12 }, { id: 'pocao', chance: 0.3 }] },
  fenrir: {
    nome: 'Fenrir, o Lobo Devorador', icone: '🐺', mov: 4, alc: 1, chefe: true, hp: 20, atk: 3, def: 0, xp: 20, gold: 15,
    reliquia: 'presa_fenrir', fragmento: 'Fragmento do Destino: Gelo',
    drops: [{ id: 'hidromel', chance: 1 }],
    falaAntes: [
      { icone: '🐺', texto: 'Das sombras de Valhala surge Fenrir, as correntes do mundo ainda penduradas em seu pescoço. "Mortal... o Fio se rompeu e eu estou livre. Vou devorar o sol, depois você."' },
    ],
    falaDepois: [
      { icone: '🐺', texto: 'Fenrir tomba. Entre suas presas brilha um fio de luz gelada: o primeiro Fragmento do Destino. Hugin pousa no seu ombro: "Um de quatro. O Olimpo chama."' },
    ],
  },

  // --- Olimpo ---
  harpia:      { nome: 'Harpia',              icone: '🦅', mov: 4, alc: 1, hp: 8, atk: 3, def: 0,  xp: 3,  gold: 2, drops: [{ id: 'tonico_veloz', chance: 0.25 }, { id: 'hidromel', chance: 0.15 }] },
  satiro:      { nome: 'Sátiro Furioso',      icone: '🐐', mov: 3, alc: 1, hp: 9, atk: 4, def: 0,  xp: 3,  gold: 2, drops: [{ id: 'hidromel', chance: 0.2 }] },
  ciclope:     { nome: 'Ciclope',             icone: '👁️', mov: 2, alc: 4, hp: 14, atk: 4, def: 1, xp: 5,  gold: 3, drops: [{ id: 'ambrosia', chance: 0.1 }, { id: 'hidromel', chance: 0.25 }] },
  minotauro:   { nome: 'Minotauro',           icone: '🐂', mov: 3, alc: 1, hp: 15, atk: 5, def: 1, xp: 6,  gold: 4, drops: [{ id: 'ambrosia', chance: 0.12 }] },
  ares: {
    nome: 'Ares, Deus da Guerra', icone: '🔱', mov: 3, alc: 1, chefe: true, hp: 34, atk: 4, def: 1, xp: 40, gold: 30,
    reliquia: 'elmo_ares', fragmento: 'Fragmento do Destino: Guerra',
    drops: [{ id: 'ambrosia', chance: 1 }],
    falaAntes: [
      { icone: '🔱', texto: 'No topo do Olimpo, Ares ergue a lança. "Os outros deuses dormem, mas a guerra nunca dorme! Prove que merece o Fragmento, mortal!"' },
    ],
    falaDepois: [
      { icone: '🔱', texto: 'Ares ri, ferido e satisfeito: "Há muito tempo ninguém me fazia sangrar." Ele estende o segundo Fragmento. "Desça ao Inferno. Hades guarda o próximo, e ele não é tão gentil."' },
    ],
  },

  // --- Inferno ---
  alma_penada: { nome: 'Alma Penada',         icone: '👻', mov: 3, alc: 2, hp: 12, atk: 4, def: 0, xp: 6, gold: 4, drops: [{ id: 'tonico_veloz', chance: 0.3 }] },
  diabrete:    { nome: 'Diabrete',            icone: '😈', mov: 3, alc: 3, hp: 11, atk: 5, def: 1, xp: 6, gold: 4, drops: [{ id: 'ambrosia', chance: 0.15 }] },
  cerbero:     { nome: 'Cérbero',             icone: '🐕‍🦺', mov: 4, alc: 1, hp: 17, atk: 5, def: 1, xp: 8, gold: 5, drops: [{ id: 'ambrosia', chance: 0.2 }, { id: 'nectar', chance: 0.05 }] },
  demonio:     { nome: 'Demônio Alado',       icone: '🦇', mov: 4, alc: 1, hp: 19, atk: 6, def: 1, xp: 9, gold: 6, drops: [{ id: 'ambrosia', chance: 0.2 }, { id: 'nectar', chance: 0.06 }] },
  hades: {
    nome: 'Hades, Senhor do Inferno', icone: '👑', mov: 2, alc: 3, chefe: true, hp: 48, atk: 5, def: 1, xp: 70, gold: 50,
    reliquia: 'coroa_hades', fragmento: 'Fragmento do Destino: Morte',
    drops: [{ id: 'nectar', chance: 1 }],
    falaAntes: [
      { icone: '👑', texto: 'O trono de Hades range sob a chama negra. "Todo mortal chega até mim, cedo ou tarde. Você só veio mais cedo do que o previsto."' },
    ],
    falaDepois: [
      { icone: '👑', texto: 'Hades se curva, sem fôlego. "O Fio rompido... não foi obra dos deuses. Algo desperta no Duat. Leve o Fragmento e termine isto." As chamas do Inferno se apagam por um instante.' },
    ],
  },

  // --- Duat (Egito) ---
  escaravelho: { nome: 'Escaravelho Devorador', icone: '🪲', mov: 3, alc: 1, hp: 20, atk: 6, def: 1, xp: 10, gold: 6, drops: [{ id: 'agua_nilo', chance: 0.2 }] },
  mumia:       { nome: 'Múmia Amaldiçoada',   icone: '🪦', mov: 2, alc: 1, hp: 23, atk: 6, def: 2, xp: 11, gold: 7, drops: [{ id: 'agua_nilo', chance: 0.22 }, { id: 'nectar', chance: 0.06 }] },
  chacal:      { nome: 'Guardião Chacal',     icone: '🦊', mov: 4, alc: 1, hp: 24, atk: 7, def: 2, xp: 12, gold: 8, drops: [{ id: 'agua_nilo', chance: 0.25 }, { id: 'nectar', chance: 0.08 }] },
  serpente:    { nome: 'Serpente de Apófis',  icone: '🐍', mov: 3, alc: 3, hp: 26, atk: 7, def: 2, xp: 13, gold: 9, drops: [{ id: 'nectar', chance: 0.1 }] },
  set: {
    nome: 'Set, Deus do Caos', icone: '🦂', mov: 3, alc: 2, chefe: true, hp: 62, atk: 6, def: 2, xp: 100, gold: 70,
    reliquia: 'olho_set', fragmento: 'Fragmento do Destino: Caos',
    drops: [{ id: 'nectar', chance: 1 }],
    falaAntes: [
      { icone: '🦂', texto: 'Nas areias do Duat, Set sorri com mil dentes. "Fui eu quem cortou o Fio, mortal. Fui eu quem sussurrou o nome do Caos. E agora você vem me parar?"' },
    ],
    falaDepois: [
      { icone: '🦂', texto: 'Set se desfaz em areia, rindo. "Tarde demais... Ele já desperta." O quarto Fragmento brilha em suas mãos. Os quatro Fragmentos se unem sozinhos e o céu se parte. Um portal se abre: o Abismo do Caos.' },
    ],
  },

  // --- Final ---
  caos: {
    nome: 'Caos Primordial', icone: '🌌', mov: 4, alc: 5, chefe: true, hp: 80, atk: 7, def: 2, xp: 0, gold: 0,
    drops: [],
    falaAntes: [
      { icone: '🌌', texto: 'No Abismo não há chão nem céu. Só uma voz que vem de antes do primeiro deus: "Eu sou o que havia antes do Fio. Eu sou o que haverá depois."' },
    ],
    falaDepois: [],
  },
};

/* ---------- GRUPOS EM BATALHA ----------
   Como agora há vários inimigos no mapa, cada um é mais fraco que o "solo" da lista acima.
   stat = multiplicador de vida e ataque; xp = multiplicador de XP e ouro. */
const ESCALA_GRUPO = { 2: { stat: 1, xp: 1 }, 3: { stat: 1, xp: 1 }, 4: { stat: 1, xp: 1 }, 5: { stat: 1, xp: 1 } };   // (os números dos inimigos já são pensados para grupos)
const ESCALA_ADD = { stat: 0.7, xp: 0.4 }; // capangas que acompanham um chefe
const ADDS_CHEFE = 3;

/* ---------- ARMADILHAS ----------
   Cada cenário tem a sua. Quem pisa nela (herói ou inimigo) dispara o efeito, e a armadilha some.
   dano  = pontos de vida perdidos (chefes sofrem só metade; a dificuldade aumenta/diminui)
   turnos= quantas rodadas o efeito dura */
const ARMADILHAS = {
  gelo:   { nome: 'Armadilha de gelo',   icone: '❄️', cor: '#7fd4ff', turnos: 2, desc: 'Reduz 1 de movimento por 2 rodadas.' },
  raio:   { nome: 'Armadilha de raio',   icone: '⚡', cor: '#ffe14d', dano: 1, desc: 'Dá 1 de dano e paralisa: o movimento acaba aqui.' },
  fogo:   { nome: 'Armadilha de fogo',   icone: '🔥', cor: '#ff7a45', dano: 2, desc: 'Causa 2 de dano.' },
  veneno: { nome: 'Armadilha venenosa',  icone: '☠️', cor: '#7ddc4a', turnos: 3, dano: 1, desc: 'Causa 1 de dano por 3 rodadas.' },
  vazio:  { nome: 'Armadilha do vazio',  icone: '🌀', cor: '#c58bff', dano: 1, descarta: 1, desc: 'Dá 1 de dano e faz você perder 1 carta da mão.' },
};
const CHEFE_FATOR_ARM = 0.5;   // chefes sofrem metade do efeito das armadilhas

/* ---------- DIFICULDADES ----------
   nivel      soma ao nível do cenário (que é metade do seu nível, arredondado para cima)
   stat       multiplica vida e ataque dos inimigos
   recompensa multiplica o XP e as moedas
   armadilha  multiplica o efeito das armadilhas
   porta      parte da vida que você recupera ao atravessar uma porta */
const DIFICULDADES = {
  facil:         { nome: 'Fácil',         icone: '🌱', nivel: -1, stat: 0.85, recompensa: 0.8, armadilha: 0.7, porta: 0.25 },
  intermediario: { nome: 'Intermediário', icone: '⚔️', nivel: 0,  stat: 1.0,  recompensa: 1.0, armadilha: 1.0, porta: 0.15 },
  dificil:       { nome: 'Difícil',       icone: '🔥', nivel: 1,  stat: 1.1,  recompensa: 1.2, armadilha: 1.3, porta: 0.10 },
  expert:        { nome: 'Expert',        icone: '💀', nivel: 2,  stat: 1.15,  recompensa: 1.5, armadilha: 1.6, porta: 0.05 },
};
const DIFICULDADE_PADRAO = 'intermediario';
/** Botões gerais de equilíbrio: forca multiplica vida e ataque de TODOS os inimigos; ataque multiplica só o dano deles; xp multiplica o XP ganho.
 *  (Para deixar o jogo mais fácil ou mais difícil de uma vez, mexa só aqui.) */
const BALANCO = { forca: 0.2, ataque: 0.5, xp: 1 };
/** A cada nível do cenário acima do "nível-base" do reino, os inimigos ganham este tanto de vida/ataque (e o contrário abaixo). */
const FORCA_POR_NIVEL = 0.03;
const RECOMPENSA_POR_NIVEL = 0.05;

/* ---------- ESTRUTURAS A DESTRUIR (objetivo "destruir") ---------- */
const ESTRUTURAS = {
  valhala: { nome: 'Torre de gelo',          mini: 'torre_gelo',   hp: 8,  def: 0 },
  olimpo:  { nome: 'Altar de Zeus',          mini: 'altar',        hp: 12, def: 1 },
  inferno: { nome: 'Portal demoníaco',       mini: 'portal_fogo',  hp: 18, def: 1 },
  duat:    { nome: 'Estela amaldiçoada',     mini: 'estela',       hp: 24, def: 1 },
  caos:    { nome: 'Cristal do Caos',        mini: 'cristal_caos', hp: 32, def: 2 },
};

/* ---------- REINOS ---------- */
const REINOS = [
  {
    id: 'valhala', nivelBase: 2, armadilha: 'gelo', salas: ['v_salao', 'v_floresta'], arena: 'v_covil', nome: 'Valhala', icone: '🛡️', tier: 1, nivelRec: '1–4',
    intro: 'O grande salão dos guerreiros mortos está coberto de neve e silêncio. Os einherjar, antes honrados, vagam como draugr. No fundo do salão, algo uiva.',
    inimigos: ['draugr', 'lobo_gelo', 'valquiria', 'troll_gelo'], chefe: 'fenrir',
    mercador: { nome: 'Brokkr, o Ferreiro Anão', icone: '🧔', fala: 'Aço é aço, em qualquer reino! O que vai ser?' },
    consumiveis: ['pocao', 'pedra_amolar', 'antidoto'], descanso: 3,
  },
  {
    id: 'olimpo', nivelBase: 4, armadilha: 'raio', salas: ['o_jardins', 'o_escadaria'], arena: 'o_arena', nome: 'Olimpo', icone: '🏛️', tier: 2, nivelRec: '5–8',
    intro: 'Colunas de mármore flutuam entre as nuvens. As harpias dominam os jardins dos deuses e o trovão de Zeus ecoa, sem dono, pelos corredores vazios.',
    inimigos: ['harpia', 'satiro', 'ciclope', 'minotauro'], chefe: 'ares',
    mercador: { nome: 'Hefesto, o Ferreiro Divino', icone: '🔥', fala: 'Forjado no Etna! Escolha com sabedoria, mortal.' },
    consumiveis: ['pocao', 'hidromel', 'tonico_veloz'], descanso: 5,
  },
  {
    id: 'inferno', nivelBase: 6, armadilha: 'fogo', salas: ['i_flegetonte', 'i_dite'], arena: 'i_trono', nome: 'Inferno', icone: '🔥', tier: 3, nivelRec: '9–12',
    intro: 'Rios de fogo cortam um mundo sem céu. As almas condenadas gritam em coro e demônios patrulham as muralhas de Dite. Cada passo queima.',
    inimigos: ['alma_penada', 'diabrete', 'cerbero', 'demonio'], chefe: 'hades',
    mercador: { nome: 'Caronte, o Barqueiro', icone: '🛶', fala: 'Só aceito ouro. Ouro, e nunca perguntas.' },
    consumiveis: ['hidromel', 'ambrosia', 'pele_pedra'], descanso: 8,
  },
  {
    id: 'duat', nivelBase: 8, armadilha: 'veneno', salas: ['d_osiris', 'd_dunas'], arena: 'd_piramide', nome: 'Duat', icone: '🏜️', tier: 4, nivelRec: '13–17',
    intro: 'O mundo dos mortos egípcio é um deserto infinito sob um sol negro. Pirâmides sussurram o nome de Set, e a Balança de Maat pende torta.',
    inimigos: ['escaravelho', 'mumia', 'chacal', 'serpente'], chefe: 'set',
    mercador: { nome: 'Khenti, o Embalsamador', icone: '🏺', fala: 'Tudo se conserva no Duat... menos a esperança.' },
    consumiveis: ['ambrosia', 'agua_nilo', 'pele_pedra'], descanso: 12,
  },
  {
    id: 'caos', nivelBase: 9, armadilha: 'vazio', salas: ['c_ruinas', 'c_fenda'], arena: 'c_abismo', nome: 'Abismo do Caos', icone: '🌌', tier: 5, nivelRec: '17+', final: true,
    intro: 'Não há chão aqui. Os Fragmentos do Destino flutuam ao seu redor, formando uma escada de luz até a escuridão primordial.',
    inimigos: ['escaravelho', 'mumia', 'chacal', 'serpente'], // ecos do Duat que acompanham o Caos
    chefe: 'caos',
    mercador: { nome: 'Thot, o Escriba Perdido', icone: '📜', fala: 'Tudo o que existe está escrito, exceto o que vem a seguir. Compre depressa.' },
    consumiveis: ['agua_nilo', 'nectar', 'tonico_veloz'], descanso: 15,
  },
];

/* ---------- HISTÓRIA ---------- */
const HISTORIA_PROLOGO = [
  { icone: '🧶', texto: 'Antes de todos os tempos, os deuses antigos teciam o Fio do Destino: nórdicos, gregos, egípcios, cada um em seu reino, cada fio ligado ao próximo.' },
  { icone: '✂️', texto: 'Mas o Fio se rompeu. Os deuses mergulharam em fúria e silêncio. Os mortos andam em Valhala, os monstros tomam o Olimpo, o Inferno transborda e o Duat sussurra o nome do Caos.' },
  { icone: '🐦‍⬛', texto: 'Dois corvos pousam no ombro de {nome}. "Mortal", diz Hugin, "tu foste escolhido. Reúne os quatro Fragmentos do Destino antes que o Caos Primordial desperte."' },
];

const HISTORIA_FINAL = [
  { icone: '🌌', texto: 'O Caos Primordial se desfaz como névoa ao amanhecer. Os quatro Fragmentos giram, brilham e se unem num fio dourado.' },
  { icone: '🧶', texto: '{nome} ergue o Fio. Ele se estende pelos nove mundos: Valhala, Olimpo, Inferno e Duat voltam a se ligar, e os deuses antigos acordam, um por um.' },
  { icone: '🌅', texto: 'Odin, Zeus, Hades e Rá se curvam diante de um mortal. "O destino agora é seu para tecer", dizem. Fim do primeiro ato. Mas há outros mundos além destes...' },
];
