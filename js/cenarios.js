'use strict';
/* ============================================================
   OS 20 CENÁRIOS — 4 por reino, em sequência (terminar um destrava o próximo).
   Cada cenário tem um OBJETIVO e é dividido em etapas por portas.

   objetivo:
     matar_todos  derrote todos os inimigos da última etapa
     bau          abra o baú do tesouro (pare 1 turno em cima dele)
     destruir     destrua todas as estruturas da última etapa
     chefe        derrote o chefe (ele fica na última etapa, na arena dele)

   etapas: lista de salas (veja mapas.js).  n = quantos inimigos na sala.
           Sem n, o jogo usa: 2 na 1ª sala, 3 na 2ª (e +1 nos reinos mais avançados).
           chefe:true = arena do chefe.   estruturas:N = quantas estruturas a destruir.
   ============================================================ */
const OBJETIVOS = {
  matar_todos: { icone: '☠️', nome: 'Derrotar todos os inimigos', dica: 'Mate todos os inimigos da última sala.' },
  bau:         { icone: '🧰', nome: 'Abrir o baú do tesouro',      dica: 'Fique parado 1 turno em cima do baú para abri-lo. Os inimigos podem ser ignorados!' },
  destruir:    { icone: '🏗️', nome: 'Destruir as estruturas',      dica: 'Ataque e destrua todas as estruturas da última sala.' },
  chefe:       { icone: '👑', nome: 'Derrotar o chefe',            dica: 'Atravesse as salas e derrote o chefe na arena final.' },
};

const CENARIOS = [
  /* ---------------- Valhala ---------------- */
  { id: 1, reino: 'valhala', nome: 'Os Portões de Valhala', objetivo: 'matar_todos',
    etapas: [{ mapa: 'v_salao' }, { mapa: 'v_floresta' }],
    texto: 'Os mortos guardam o salão dos guerreiros. Limpe o caminho até o fundo de Valhala.' },
  { id: 2, reino: 'valhala', nome: 'O Tesouro de Brokkr', objetivo: 'bau',
    etapas: [{ mapa: 'v_floresta' }, { mapa: 'v_salao' }],
    texto: 'O ferreiro anão escondeu um baú no gelo. Chegue até ele antes que os draugr te cerquem.' },
  { id: 3, reino: 'valhala', nome: 'As Torres de Gelo', objetivo: 'destruir',
    etapas: [{ mapa: 'v_salao' }, { mapa: 'v_floresta', n: 3, estruturas: 3 }],
    texto: 'Torres de gelo mantêm o inverno eterno. Destrua todas elas para quebrar a maldição.' },
  { id: 4, reino: 'valhala', nome: 'O Covil de Fenrir', objetivo: 'chefe',
    etapas: [{ mapa: 'v_floresta' }, { mapa: 'v_salao' }, { mapa: 'v_covil', chefe: true }],
    texto: 'Fenrir uiva no fim da caverna. Derrote o lobo e tome o primeiro Fragmento do Destino.' },

  /* ---------------- Olimpo ---------------- */
  { id: 5, reino: 'olimpo', nome: 'Os Jardins de Hera', objetivo: 'matar_todos',
    etapas: [{ mapa: 'o_jardins' }, { mapa: 'o_escadaria' }],
    texto: 'Harpias e sátiros tomaram os jardins sagrados. Expulse todos eles.' },
  { id: 6, reino: 'olimpo', nome: 'O Cofre de Hermes', objetivo: 'bau',
    etapas: [{ mapa: 'o_escadaria' }, { mapa: 'o_jardins' }],
    texto: 'O mensageiro dos deuses deixou um cofre nos jardins. Seja mais rápido que os monstros.' },
  { id: 7, reino: 'olimpo', nome: 'Os Altares de Zeus', objetivo: 'destruir',
    etapas: [{ mapa: 'o_jardins' }, { mapa: 'o_escadaria', n: 3, estruturas: 3 }],
    texto: 'Altares corrompidos alimentam os monstros. Destrua todos para limpar o Olimpo.' },
  { id: 8, reino: 'olimpo', nome: 'A Arena de Ares', objetivo: 'chefe',
    etapas: [{ mapa: 'o_escadaria' }, { mapa: 'o_jardins' }, { mapa: 'o_arena', chefe: true }],
    texto: 'O deus da guerra espera na arena. Vença-o e leve o segundo Fragmento do Destino.' },

  /* ---------------- Inferno ---------------- */
  { id: 9, reino: 'inferno', nome: 'O Rio Flegetonte', objetivo: 'matar_todos',
    etapas: [{ mapa: 'i_flegetonte' }, { mapa: 'i_dite' }],
    texto: 'O rio de fogo separa os mundos. Derrote os demônios que o vigiam.' },
  { id: 10, reino: 'inferno', nome: 'O Ouro de Caronte', objetivo: 'bau',
    etapas: [{ mapa: 'i_dite' }, { mapa: 'i_flegetonte' }],
    texto: 'O barqueiro guarda um baú de ouro roubado. Pegue-o antes que o Inferno te engula.' },
  { id: 11, reino: 'inferno', nome: 'Os Portais Demoníacos', objetivo: 'destruir',
    etapas: [{ mapa: 'i_flegetonte' }, { mapa: 'i_dite', n: 4, estruturas: 3 }],
    texto: 'Portais despejam demônios sem parar. Feche todos destruindo-os.' },
  { id: 12, reino: 'inferno', nome: 'O Trono de Hades', objetivo: 'chefe',
    etapas: [{ mapa: 'i_dite' }, { mapa: 'i_flegetonte' }, { mapa: 'i_trono', chefe: true }],
    texto: 'Hades guarda o terceiro Fragmento. Enfrente o Senhor do Inferno.' },

  /* ---------------- Duat ---------------- */
  { id: 13, reino: 'duat', nome: 'O Salão de Osíris', objetivo: 'matar_todos',
    etapas: [{ mapa: 'd_osiris' }, { mapa: 'd_dunas' }],
    texto: 'Múmias e escaravelhos profanam o salão do julgamento. Destrua todos.' },
  { id: 14, reino: 'duat', nome: 'O Sarcófago Dourado', objetivo: 'bau',
    etapas: [{ mapa: 'd_dunas' }, { mapa: 'd_osiris' }],
    texto: 'Um faraó esquecido guarda um tesouro. Cuidado com o veneno das armadilhas.' },
  { id: 15, reino: 'duat', nome: 'As Estelas Malditas', objetivo: 'destruir',
    etapas: [{ mapa: 'd_osiris' }, { mapa: 'd_dunas', n: 4, estruturas: 3 }],
    texto: 'Estelas gravadas com a maldição de Set. Quebre todas elas.' },
  { id: 16, reino: 'duat', nome: 'A Pirâmide de Set', objetivo: 'chefe',
    etapas: [{ mapa: 'd_dunas' }, { mapa: 'd_osiris' }, { mapa: 'd_piramide', chefe: true }],
    texto: 'Set cortou o Fio do Destino. Derrote-o e reúna o último Fragmento.' },

  /* ---------------- Abismo do Caos ---------------- */
  { id: 17, reino: 'caos', nome: 'As Ruínas Flutuantes', objetivo: 'matar_todos',
    etapas: [{ mapa: 'c_ruinas' }, { mapa: 'c_fenda' }],
    texto: 'Ecos do Duat vagam entre pedaços de mundos quebrados. Elimine todos.' },
  { id: 18, reino: 'caos', nome: 'O Cofre do Vazio', objetivo: 'bau',
    etapas: [{ mapa: 'c_fenda' }, { mapa: 'c_ruinas' }],
    texto: 'Um baú flutua além da fenda. O vazio puxa a sua mana a cada passo em falso.' },
  { id: 19, reino: 'caos', nome: 'Os Cristais do Caos', objetivo: 'destruir',
    etapas: [{ mapa: 'c_ruinas' }, { mapa: 'c_fenda', n: 4, estruturas: 3 }],
    texto: 'Cristais sussurram o nome do Caos. Destrua-os antes que ele desperte por completo.' },
  { id: 20, reino: 'caos', nome: 'O Caos Primordial', objetivo: 'chefe',
    etapas: [{ mapa: 'c_ruinas' }, { mapa: 'c_fenda' }, { mapa: 'c_abismo', chefe: true }],
    texto: 'Os quatro Fragmentos brilham. Reúna a coragem e enfrente o que existia antes do Fio.' },
];

const cenarioPorId = id => CENARIOS.find(c => c.id === id);
const cenariosDoReino = reinoId => CENARIOS.filter(c => c.reino === reinoId);
