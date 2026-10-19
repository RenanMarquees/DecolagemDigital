'use strict';
/* ============================================================
   DADOS DO JOGO — tudo que é "conteúdo" mora aqui:
   classes, habilidades, itens, inimigos, reinos e história.
   Para adicionar um inimigo, item ou reino novo, edite só este arquivo.
   ============================================================ */

const ATRIBUTOS = ['FOR', 'DES', 'INT', 'VIT'];
const ATRIBUTO_NOME = { FOR: 'Força', DES: 'Destreza', INT: 'Inteligência', VIT: 'Vitalidade' };
const ATRIBUTO_DESC = {
  FOR: 'Aumenta o dano físico do Guerreiro',
  DES: 'Dano do Caçador, crítico, esquiva e movimento',
  INT: 'Dano e cura do Oráculo, mana',
  VIT: 'Vida máxima e defesa',
};
const NIVEL_MAX = 20;
const PONTOS_POR_NIVEL = 3;

const RARIDADE_COR = { comum: '#b8b8c4', incomum: '#5fd068', raro: '#4aa3ff', epico: '#b46bff', lendario: '#ffb02e' };

/* ---------- CLASSES ---------- */
const CLASSES = {
  guerreiro: {
    nome: 'Guerreiro', icone: '⚔️', mov: 4, alcanceBasico: 1, basico: 'FOR', hpMult: 1.3, danoMult: 1.12, danoRecebido: 0.85, regenMp: 6,
    desc: 'Força bruta, muita vida, +12% de dano e recebe 15% menos dano. Aguenta os golpes dos deuses e responde com fúria.',
    attr: { FOR: 8, DES: 4, INT: 2, VIT: 7 },
    habilidades: ['golpe_poderoso', 'grito_guerra', 'furia_tor', 'martelo_titas'],
  },
  cacador: {
    nome: 'Caçador', icone: '🏹', mov: 3, alcanceBasico: 3, basico: 'DES', hpMult: 0.95, danoMult: 1, danoRecebido: 1, regenMp: 3,
    desc: 'Rápido e preciso. Acerta golpes críticos e desvia dos ataques.',
    attr: { FOR: 3, DES: 9, INT: 3, VIT: 6 },
    habilidades: ['tiro_certeiro', 'flecha_dupla', 'chuva_artemis', 'flecha_apolo'],
  },
  oraculo: {
    nome: 'Oráculo', icone: '🔮', mov: 3, alcanceBasico: 3, basico: 'INT', hpMult: 1, danoMult: 1, danoRecebido: 1, regenMp: 2,
    desc: 'Mestre da magia. Fere com raios, cura aliados e drena a alma dos inimigos.',
    attr: { FOR: 2, DES: 4, INT: 9, VIT: 5 },
    habilidades: ['raio_zeus', 'bencao_apolo', 'drenar_alma', 'julgamento_deuses'],
  },
};

/* ---------- HABILIDADES ----------
   tipo: dano | cura | dreno | buff   —   custo em mana (MP) */
const HABILIDADES = {
  golpe_poderoso:    { nome: 'Golpe Poderoso',       icone: '💥', empurrar: 1, alcance: 1, custo: 6,  nivel: 1,  tipo: 'dano', stat: 'FOR', mult: 2.0, desc: 'Golpe pesado que empurra o inimigo 1 hexágono.' },
  grito_guerra:      { nome: 'Grito de Guerra',      icone: '📣', alcance: 0, custo: 6,  nivel: 3,  tipo: 'buff', mult: 1.5, turnos: 4, desc: '+50% de dano por 4 turnos.' },
  furia_tor:         { nome: 'Fúria de Thor',        icone: '⚡', puxar: 2, alcance: 3, custo: 11, nivel: 5,  tipo: 'dano', stat: 'FOR', mult: 3.2, desc: 'O trovão atinge um inimigo a até 3 hexágonos e o PUXA 2 hexágonos até você.' },
  martelo_titas:     { nome: 'Martelo dos Titãs',    icone: '🔨', empurrar: 1, alcance: 0, area: 'ao-redor', custo: 20, nivel: 9,  tipo: 'dano', stat: 'FOR', mult: 4.8, desc: 'Golpeia todos os inimigos ao seu redor e os empurra 1 hexágono.' },

  tiro_certeiro:     { nome: 'Tiro Certeiro',        icone: '🎯', empurrar: 1, alcance: 4, custo: 5,  nivel: 1,  tipo: 'dano', stat: 'DES', mult: 1.9, critBonus: 0.25, desc: 'Mais chance de crítico. Empurra o alvo 1 hexágono.' },
  flecha_dupla:      { nome: 'Flecha Dupla',         icone: '🏹', alcance: 3, custo: 9,  nivel: 3,  tipo: 'dano', stat: 'DES', mult: 1.3, golpes: 2, desc: 'Duas flechas seguidas.' },
  chuva_artemis:     { nome: 'Chuva de Ártemis',     icone: '🌧️', empurrar: 1, alcance: 3, area: 'alvo+vizinhos', custo: 15, nivel: 5,  tipo: 'dano', stat: 'DES', mult: 3.3, desc: 'Atinge o alvo e quem está ao lado dele, empurrando todos 1 hexágono.' },
  flecha_apolo:      { nome: 'Flecha de Apolo',      icone: '☀️', empurrar: 2, alcance: 5, custo: 20, nivel: 9,  tipo: 'dano', stat: 'DES', mult: 4.8, critBonus: 0.4, desc: 'Luz solar em forma de flecha. Empurra o alvo 2 hexágonos.' },

  raio_zeus:         { nome: 'Raio de Zeus',         icone: '⚡', empurrar: 1, alcance: 4, custo: 6,  nivel: 1,  tipo: 'dano', stat: 'INT', mult: 2.1, desc: 'Um raio divino que empurra o alvo 1 hexágono.' },
  bencao_apolo:      { nome: 'Bênção de Apolo',      icone: '☀️', alcance: 0, custo: 12, nivel: 3,  tipo: 'cura', stat: 'INT', mult: 3.5, desc: 'Cura suas feridas.' },
  drenar_alma:       { nome: 'Drenar Alma',          icone: '💀', puxar: 2, alcance: 3, custo: 13, nivel: 5,  tipo: 'dreno', stat: 'INT', mult: 2.4, desc: 'Fere o inimigo, recupera metade do dano e PUXA o alvo 2 hexágonos até você.' },
  julgamento_deuses: { nome: 'Julgamento dos Deuses', icone: '⚖️', empurrar: 2, alcance: 4, area: 'alvo+vizinhos', custo: 24, nivel: 9, tipo: 'dano', stat: 'INT', mult: 5.0, desc: 'Atinge o alvo e quem está ao lado dele, empurrando todos 2 hexágonos.' },
};

/* ---------- ITENS ---------- */
const ITENS = {
  // Consumíveis: hp/mp fixos, hpPct/mpPct em fração do máximo
  pocao:       { nome: 'Poção de Cura',   tipo: 'consumivel', icone: '🧪', hp: 60,   preco: 20,  raridade: 'comum',    desc: 'Recupera 60 de vida.' },
  pocao_mana:  { nome: 'Poção de Mana',   tipo: 'consumivel', icone: '💧', mp: 30,   preco: 25,  raridade: 'comum',    desc: 'Recupera 30 de mana.' },
  hidromel:    { nome: 'Hidromel de Odin', tipo: 'consumivel', icone: '🍺', hp: 160,  preco: 55,  raridade: 'incomum',  desc: 'Recupera 160 de vida.' },
  ambrosia:    { nome: 'Ambrosia',        tipo: 'consumivel', icone: '🍯', hpPct: 0.5, mp: 40, preco: 140, raridade: 'raro',   desc: 'Recupera 50% da vida e 40 de mana.' },
  agua_nilo:   { nome: 'Água do Nilo Sagrado', tipo: 'consumivel', icone: '🌊', hpPct: 0.6, mpPct: 0.5, preco: 230, raridade: 'raro', desc: 'Recupera 60% da vida e 50% da mana.' },
  nectar:      { nome: 'Néctar Divino',   tipo: 'consumivel', icone: '🏺', hpPct: 1, mpPct: 1, preco: 380, raridade: 'epico',   desc: 'Recupera toda a vida e mana.' },

  // Relíquias dos chefes (amuletos únicos)
  presa_fenrir: { nome: 'Presa de Fenrir', tipo: 'amuleto', icone: '🦷', bonus: { FOR: 4, DES: 3 }, preco: 600,  raridade: 'lendario', desc: 'Ainda pulsa com a fome do lobo.' },
  elmo_ares:    { nome: 'Elmo de Ares',    tipo: 'amuleto', icone: '🪖', bonus: { FOR: 5, VIT: 5 }, preco: 1400, raridade: 'lendario', desc: 'O orgulho do deus da guerra.' },
  coroa_hades:  { nome: 'Coroa de Hades',  tipo: 'amuleto', icone: '👑', bonus: { INT: 6, VIT: 6, DES: 3 }, preco: 3000, raridade: 'lendario', desc: 'Pesa como mil almas.' },
  olho_set:     { nome: 'Olho de Set',     tipo: 'amuleto', icone: '🧿', bonus: { FOR: 7, DES: 7, INT: 7, VIT: 7 }, preco: 6000, raridade: 'lendario', desc: 'Vê o caos em todas as coisas.' },
};

// Equipamentos por tier (0 = inicial, 1 = Valhala, 2 = Olimpo, 3 = Inferno, 4 = Duat)
const TIER_ATK   = [6, 14, 26, 42, 62];
const TIER_DEF   = [3, 8, 15, 26, 40];
const TIER_PRECO_ARMA = [0, 160, 450, 1000, 2000];
const TIER_PRECO_ARM  = [0, 140, 400, 900, 1800];
const TIER_RARIDADE   = ['comum', 'incomum', 'raro', 'epico', 'lendario'];

const NOMES_ARMAS = {
  guerreiro: [['Espada de Ferro', '🗡️'], ['Machado Nórdico', '🪓'], ['Gládio de Ares', '⚔️'], ['Lâmina Infernal', '🔥'], ['Khopesh Dourado', '🌞']],
  cacador:   [['Arco de Freixo', '🏹'], ['Arco de Teixo', '🏹'], ['Arco de Ártemis', '🌙'], ['Arco Sombrio', '🦇'], ['Arco de Rá', '☀️']],
  oraculo:   [['Cajado de Carvalho', '🪄'], ['Cajado de Runas', '🔮'], ['Cajado de Apolo', '✨'], ['Cetro das Sombras', '💀'], ['Cajado de Thoth', '📜']],
};
const NOMES_ARMADURAS = [
  ['Túnica de Couro', '🥋'], ['Cota de Malha', '⛓️'], ['Peitoral de Bronze', '🛡️'], ['Couraça de Obsidiana', '🖤'], ['Manto Solar de Rá', '🌅'],
];
const NOMES_AMULETOS = ['Runa', 'Laurel', 'Selo Infernal', 'Escaravelho'];
const AMULETO_SUFIXO = { FOR: ['de Força', '💪'], DES: ['de Agilidade', '🪶'], INT: ['de Sabedoria', '📿'], VIT: ['de Vida', '❤️'] };
const AMULETO_PRECO = [150, 420, 950, 1900];

// Gera automaticamente armas, armaduras e amuletos a partir das tabelas acima
(function gerarEquipamentos() {
  for (const classe of Object.keys(NOMES_ARMAS)) {
    NOMES_ARMAS[classe].forEach(([nome, icone], t) => {
      ITENS[`${classe}_${t}`] = {
        nome, icone, tipo: 'arma', classe, atk: TIER_ATK[t], preco: TIER_PRECO_ARMA[t],
        raridade: TIER_RARIDADE[t], desc: `Ataque +${TIER_ATK[t]} (só ${CLASSES[classe].nome})`,
      };
    });
  }
  NOMES_ARMADURAS.forEach(([nome, icone], t) => {
    ITENS[`armadura_${t}`] = { nome, icone, tipo: 'armadura', def: TIER_DEF[t], preco: TIER_PRECO_ARM[t], raridade: TIER_RARIDADE[t], desc: `Defesa +${TIER_DEF[t]}` };
  });
  NOMES_AMULETOS.forEach((base, i) => {
    const valor = (i + 1) * 2;
    for (const a of ATRIBUTOS) {
      const [suf, icone] = AMULETO_SUFIXO[a];
      ITENS[`amuleto_${a}_${i + 1}`] = {
        nome: `${base} ${suf}`, icone, tipo: 'amuleto', bonus: { [a]: valor }, preco: AMULETO_PRECO[i],
        raridade: TIER_RARIDADE[i + 1], desc: `${ATRIBUTO_NOME[a]} +${valor}`,
      };
    }
  });
})();

/* ---------- INIMIGOS ----------
   especial: o chefe carrega um ataque forte a cada N turnos (o jogo avisa antes!) */
const INIMIGOS = {
  // --- Valhala ---
  draugr:      { nome: 'Draugr',              icone: '🧟', mov: 2, alc: 1, hp: 48,  atk: 14, def: 3,  xp: 18, gold: 9,  drops: [{ id: 'pocao', chance: 0.25 }] },
  lobo_gelo:   { nome: 'Lobo de Gelo',        icone: '🐺', mov: 4, alc: 1, hp: 42,  atk: 17, def: 2,  xp: 18, gold: 8,  drops: [{ id: 'pocao', chance: 0.2 }] },
  valquiria:   { nome: 'Valquíria Caída',     icone: '🧝‍♀️', mov: 2, alc: 3, hp: 58,  atk: 18, def: 5,  xp: 26, gold: 13, drops: [{ id: 'pocao_mana', chance: 0.25 }] },
  troll_gelo:  { nome: 'Troll de Gelo',       icone: '🧌', mov: 2, alc: 1, hp: 82,  atk: 20, def: 6,  xp: 32, gold: 17, drops: [{ id: 'hidromel', chance: 0.12 }, { id: 'pocao', chance: 0.3 }] },
  fenrir: {
    nome: 'Fenrir, o Lobo Devorador', icone: '🐺', mov: 4, alc: 1, chefe: true, hp: 290, atk: 27, def: 6, xp: 170, gold: 140,
    especial: { nome: 'Mordida do Ragnarök', mult: 1.9, cada: 3 },
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
  harpia:      { nome: 'Harpia',              icone: '🦅', mov: 4, alc: 1, hp: 95, atk: 27, def: 6,  xp: 55,  gold: 22, drops: [{ id: 'pocao_mana', chance: 0.25 }, { id: 'hidromel', chance: 0.15 }] },
  satiro:      { nome: 'Sátiro Furioso',      icone: '🐐', mov: 3, alc: 1, hp: 105, atk: 29, def: 5,  xp: 58,  gold: 24, drops: [{ id: 'hidromel', chance: 0.2 }] },
  ciclope:     { nome: 'Ciclope',             icone: '👁️', mov: 2, alc: 4, hp: 160, atk: 33, def: 10, xp: 82,  gold: 34, drops: [{ id: 'ambrosia', chance: 0.1 }, { id: 'hidromel', chance: 0.25 }] },
  minotauro:   { nome: 'Minotauro',           icone: '🐂', mov: 3, alc: 1, hp: 180, atk: 36, def: 12, xp: 96,  gold: 40, drops: [{ id: 'ambrosia', chance: 0.12 }] },
  ares: {
    nome: 'Ares, Deus da Guerra', icone: '🔱', mov: 3, alc: 1, chefe: true, hp: 540, atk: 52, def: 14, xp: 520, gold: 320,
    especial: { nome: 'Fúria de Ares', mult: 2.0, cada: 3 },
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
  alma_penada: { nome: 'Alma Penada',         icone: '👻', mov: 3, alc: 2, hp: 190, atk: 46, def: 10, xp: 125, gold: 52, drops: [{ id: 'pocao_mana', chance: 0.3 }] },
  diabrete:    { nome: 'Diabrete',            icone: '😈', mov: 3, alc: 3, hp: 185, atk: 50, def: 12, xp: 130, gold: 55, drops: [{ id: 'ambrosia', chance: 0.15 }] },
  cerbero:     { nome: 'Cérbero',             icone: '🐕‍🦺', mov: 4, alc: 1, hp: 250, atk: 54, def: 15, xp: 175, gold: 70, drops: [{ id: 'ambrosia', chance: 0.2 }, { id: 'nectar', chance: 0.05 }] },
  demonio:     { nome: 'Demônio Alado',       icone: '🦇', mov: 4, alc: 1, hp: 280, atk: 57, def: 17, xp: 195, gold: 80, drops: [{ id: 'ambrosia', chance: 0.2 }, { id: 'nectar', chance: 0.06 }] },
  hades: {
    nome: 'Hades, Senhor do Inferno', icone: '👑', mov: 2, alc: 3, chefe: true, hp: 860, atk: 72, def: 20, xp: 1100, gold: 650,
    especial: { nome: 'Toque da Morte', mult: 2.0, cada: 3 },
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
  escaravelho: { nome: 'Escaravelho Devorador', icone: '🪲', mov: 3, alc: 1, hp: 300, atk: 62, def: 16, xp: 215, gold: 90, drops: [{ id: 'agua_nilo', chance: 0.2 }] },
  mumia:       { nome: 'Múmia Amaldiçoada',   icone: '🪦', mov: 2, alc: 1, hp: 350, atk: 67, def: 20, xp: 250, gold: 105, drops: [{ id: 'agua_nilo', chance: 0.22 }, { id: 'nectar', chance: 0.06 }] },
  chacal:      { nome: 'Guardião Chacal',     icone: '🦊', mov: 4, alc: 1, hp: 380, atk: 72, def: 22, xp: 280, gold: 115, drops: [{ id: 'agua_nilo', chance: 0.25 }, { id: 'nectar', chance: 0.08 }] },
  serpente:    { nome: 'Serpente de Apófis',  icone: '🐍', mov: 3, alc: 3, hp: 430, atk: 77, def: 24, xp: 320, gold: 130, drops: [{ id: 'nectar', chance: 0.1 }] },
  set: {
    nome: 'Set, Deus do Caos', icone: '🦂', mov: 3, alc: 2, chefe: true, hp: 1240, atk: 96, def: 28, xp: 2200, gold: 1200,
    especial: { nome: 'Tempestade de Areia', mult: 2.0, cada: 3 },
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
    nome: 'Caos Primordial', icone: '🌌', mov: 4, alc: 5, chefe: true, hp: 1300, atk: 100, def: 30, xp: 0, gold: 0,
    especial: { nome: 'Colapso do Cosmos', mult: 2.2, cada: 3 },
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
const ESCALA_GRUPO = { 2: { stat: 0.72, xp: 0.6 }, 3: { stat: 0.6, xp: 0.42 }, 4: { stat: 0.5, xp: 0.32 } };
const ESCALA_ADD = { stat: 0.5, xp: 0.15 }; // capangas que acompanham um chefe
const ADDS_CHEFE = 2;

/* ---------- ARMADILHAS ----------
   Cada cenário tem a sua. Quem pisa nela (herói ou inimigo) dispara o efeito, e a armadilha some.
   pct   = parte da vida máxima de quem pisou (chefes sofrem só metade)
   turnos= quantas rodadas o efeito dura */
const ARMADILHAS = {
  gelo:   { nome: 'Armadilha de gelo',   icone: '❄️', cor: '#7fd4ff', turnos: 2, desc: 'Reduz 1 de movimento por 2 rodadas.' },
  raio:   { nome: 'Armadilha de raio',   icone: '⚡', cor: '#ffe14d', pct: 0.10, desc: 'Dá dano e paralisa: o movimento acaba aqui.' },
  fogo:   { nome: 'Armadilha de fogo',   icone: '🔥', cor: '#ff7a45', pct: 0.15, desc: 'Causa dano.' },
  veneno: { nome: 'Armadilha venenosa',  icone: '☠️', cor: '#7ddc4a', turnos: 3, pct: 0.05, desc: 'Causa dano por 3 rodadas.' },
  vazio:  { nome: 'Armadilha do vazio',  icone: '🌀', cor: '#c58bff', pct: 0.06, mana: 0.3, desc: 'Dá dano e drena 30% da mana.' },
};
const CHEFE_FATOR_ARM = 0.5;   // chefes sofrem metade do efeito das armadilhas
const RECUPERA_PORTA = 0.15;   // ao atravessar uma porta, você recupera esta parte da vida e da mana

/* ---------- DIFICULDADES ----------
   nivel      soma ao nível do cenário (que é metade do seu nível, arredondado para cima)
   stat       multiplica vida e ataque dos inimigos
   recompensa multiplica o XP e as moedas
   armadilha  multiplica o efeito das armadilhas
   porta      parte da vida e da mana que você recupera ao atravessar uma porta */
const DIFICULDADES = {
  facil:         { nome: 'Fácil',         icone: '🌱', nivel: -1, stat: 0.85, recompensa: 0.8, armadilha: 0.7, porta: 0.25 },
  intermediario: { nome: 'Intermediário', icone: '⚔️', nivel: 0,  stat: 1.0,  recompensa: 1.0, armadilha: 1.0, porta: 0.15 },
  dificil:       { nome: 'Difícil',       icone: '🔥', nivel: 1,  stat: 1.1,  recompensa: 1.2, armadilha: 1.3, porta: 0.10 },
  expert:        { nome: 'Expert',        icone: '💀', nivel: 2,  stat: 1.15,  recompensa: 1.5, armadilha: 1.6, porta: 0.05 },
};
const DIFICULDADE_PADRAO = 'intermediario';
/** Dois "botões" gerais de equilíbrio: forca multiplica vida e ataque de TODOS os inimigos; xp multiplica o XP ganho.
 *  (Para deixar o jogo mais fácil ou mais difícil de uma vez, mexa só aqui.) */
const BALANCO = { forca: 1.35, xp: 0.6 };
/** A cada nível do cenário acima do "nível-base" do reino, os inimigos ganham este tanto de vida/ataque (e o contrário abaixo). */
const FORCA_POR_NIVEL = 0.10;
const RECOMPENSA_POR_NIVEL = 0.05;

/* ---------- ESTRUTURAS A DESTRUIR (objetivo "destruir") ---------- */
const ESTRUTURAS = {
  valhala: { nome: 'Torre de gelo',          mini: 'torre_gelo',   hp: 70,  def: 6 },
  olimpo:  { nome: 'Altar de Zeus',          mini: 'altar',        hp: 120, def: 9 },
  inferno: { nome: 'Portal demoníaco',       mini: 'portal_fogo',  hp: 190, def: 12 },
  duat:    { nome: 'Estela amaldiçoada',     mini: 'estela',       hp: 260, def: 16 },
  caos:    { nome: 'Cristal do Caos',        mini: 'cristal_caos', hp: 340, def: 20 },
};

/* ---------- REINOS ---------- */
const REINOS = [
  {
    id: 'valhala', nivelBase: 2, armadilha: 'gelo', salas: ['v_salao', 'v_floresta'], arena: 'v_covil', nome: 'Valhala', icone: '🛡️', tier: 1, nivelRec: '1–4',
    intro: 'O grande salão dos guerreiros mortos está coberto de neve e silêncio. Os einherjar, antes honrados, vagam como draugr. No fundo do salão, algo uiva.',
    inimigos: ['draugr', 'lobo_gelo', 'valquiria', 'troll_gelo'], chefe: 'fenrir',
    mercador: { nome: 'Brokkr, o Ferreiro Anão', icone: '🧔', fala: 'Aço é aço, em qualquer reino! O que vai ser?' },
    consumiveis: ['pocao', 'pocao_mana', 'hidromel'], descanso: 15,
  },
  {
    id: 'olimpo', nivelBase: 4, armadilha: 'raio', salas: ['o_jardins', 'o_escadaria'], arena: 'o_arena', nome: 'Olimpo', icone: '🏛️', tier: 2, nivelRec: '5–8',
    intro: 'Colunas de mármore flutuam entre as nuvens. As harpias dominam os jardins dos deuses e o trovão de Zeus ecoa, sem dono, pelos corredores vazios.',
    inimigos: ['harpia', 'satiro', 'ciclope', 'minotauro'], chefe: 'ares',
    mercador: { nome: 'Hefesto, o Ferreiro Divino', icone: '🔥', fala: 'Forjado no Etna! Escolha com sabedoria, mortal.' },
    consumiveis: ['pocao_mana', 'hidromel', 'ambrosia'], descanso: 30,
  },
  {
    id: 'inferno', nivelBase: 6, armadilha: 'fogo', salas: ['i_flegetonte', 'i_dite'], arena: 'i_trono', nome: 'Inferno', icone: '🔥', tier: 3, nivelRec: '9–12',
    intro: 'Rios de fogo cortam um mundo sem céu. As almas condenadas gritam em coro e demônios patrulham as muralhas de Dite. Cada passo queima.',
    inimigos: ['alma_penada', 'diabrete', 'cerbero', 'demonio'], chefe: 'hades',
    mercador: { nome: 'Caronte, o Barqueiro', icone: '🛶', fala: 'Só aceito ouro. Ouro, e nunca perguntas.' },
    consumiveis: ['pocao_mana', 'ambrosia', 'nectar'], descanso: 60,
  },
  {
    id: 'duat', nivelBase: 8, armadilha: 'veneno', salas: ['d_osiris', 'd_dunas'], arena: 'd_piramide', nome: 'Duat', icone: '🏜️', tier: 4, nivelRec: '13–17',
    intro: 'O mundo dos mortos egípcio é um deserto infinito sob um sol negro. Pirâmides sussurram o nome de Set, e a Balança de Maat pende torta.',
    inimigos: ['escaravelho', 'mumia', 'chacal', 'serpente'], chefe: 'set',
    mercador: { nome: 'Khenti, o Embalsamador', icone: '🏺', fala: 'Tudo se conserva no Duat... menos a esperança.' },
    consumiveis: ['ambrosia', 'agua_nilo', 'nectar'], descanso: 100,
  },
  {
    id: 'caos', nivelBase: 9, armadilha: 'vazio', salas: ['c_ruinas', 'c_fenda'], arena: 'c_abismo', nome: 'Abismo do Caos', icone: '🌌', tier: 5, nivelRec: '17+', final: true,
    intro: 'Não há chão aqui. Os Fragmentos do Destino flutuam ao seu redor, formando uma escada de luz até a escuridão primordial.',
    inimigos: ['escaravelho', 'mumia', 'chacal', 'serpente'], // ecos do Duat que acompanham o Caos
    chefe: 'caos',
    mercador: { nome: 'Thot, o Escriba Perdido', icone: '📜', fala: 'Tudo o que existe está escrito, exceto o que vem a seguir. Compre depressa.' },
    consumiveis: ['ambrosia', 'agua_nilo', 'nectar'], descanso: 120,
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
