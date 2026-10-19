'use strict';
/* ============================================================
   MAPAS — cada cenário tem salas com nome e visual próprios.
   Para criar uma sala nova, copie uma e mude o desenho (todas as linhas com o mesmo tamanho!).

   Legenda:
     .  chão                       ~  obstáculo baixo (lava, fenda, nuvem...): não dá para pisar, mas dá para atirar por cima
     #  obstáculo alto (árvore, coluna...): bloqueia passos e tiros
     (espaço) fora da sala         H  onde o herói começa (e a saída 🚪)
     D  porta para a próxima etapa: fica trancada até todos os inimigos morrerem (só nas salas, não nas arenas)
     A  armadilha do cenário (o tipo vem do reino: gelo, raio, fogo, veneno ou vazio). Dá para pisar; dispara uma vez
     E  onde os inimigos podem aparecer
   `parede` e `liquido` dizem como desenhar # e ~ nesta sala (veja minis.js).
   ============================================================ */
const MAPAS = {
  /* ---------------- Valhala ---------------- */
  v_salao: {
    nome: 'Salão dos Einherjar', parede: 'runa', liquido: 'fenda',
    mapa: [
      '  E.ED.E.E  ',
      ' .......... ',
      '..##..A.##..',
      '..........A.',
      'A.#.E..E.#..',
      '............',
      '..##....##..',
      '..........A.',
      ' ...#..#... ',
      ' ......A... ',
      'H...........'],
  },
  v_floresta: {
    nome: 'Floresta Gelada de Yggdrasil', parede: 'pinheiro', liquido: 'fenda',
    mapa: [
      ' E..#D.E.E. ',
      '...#...~~...',
      '.#.A..~~~#..',
      '....#..~....',
      '.E.#.A....#.',
      '...~~..#.A..',
      '.#..~~......',
      '......#..#..',
      ' .#.A...... ',
      ' ....#.A... ',
      'H...........'],
  },
  v_covil: {
    nome: 'Covil de Fenrir', parede: 'runa', liquido: 'fenda',
    mapa: [
      '   ......   ',
      '  E......E  ',
      ' ....##.... ',
      '...#....#..A',
      'A.E...A..E..',
      '...#.##.#...',
      '....A.......',
      ' ....##.... ',
      '............',
      '  ........  ',
      '   H.....   '],
  },

  /* ---------------- Olimpo ---------------- */
  o_jardins: {
    nome: 'Jardins de Hera', parede: 'arbusto', liquido: 'nuvem',
    mapa: [
      'E..##D.##..E',
      '............',
      '.#..~~~~..#.',
      '..E.~~~~.E..',
      '.#...A....#A',
      '........A...',
      '..##.##.##..',
      '............',
      '.#..~..~.A#.',
      '......A.....',
      'H...........'],
  },
  o_escadaria: {
    nome: 'Escadaria do Olimpo', parede: 'coluna', liquido: 'nuvem',
    mapa: [
      '  ~~ED.E~~  ',
      ' ~~......~~ ',
      '~~..#..#..~~',
      '~~..E..E.A~~',
      '~...#....#.~',
      '~~A..A....~~',
      '~~..#....#~~',
      ' ~.......A~ ',
      '  ~..#..#.~ ',
      '   ....A.   ',
      '   H.....   '],
  },
  o_arena: {
    nome: 'Arena de Ares', parede: 'coluna', liquido: 'nuvem',
    mapa: [
      '   ......   ',
      '  E......E  ',
      ' ..#....#.. ',
      '........A...',
      'A.#...A..#..',
      '..E......E..',
      '..#......#..',
      '.....A......',
      ' ..#....#.. ',
      '  ........  ',
      '   H.....   '],
  },

  /* ---------------- Inferno ---------------- */
  i_flegetonte: {
    nome: 'Rio Flegetonte', parede: 'espinho', liquido: 'lava',
    mapa: [
      ' E..ED.E..E ',
      '............',
      '.#......#...',
      '~~~~.A..~~~~',
      '~~~~....~~~~',
      'A.......A...',
      '.#..#....#..',
      '............',
      '..#...A..#..',
      '.........A..',
      'H...........'],
  },
  i_dite: {
    nome: 'Muralhas de Dite', parede: 'espinho', liquido: 'lava',
    mapa: [
      'E..E.D#..E.E',
      '...#..#.....',
      '.###..####..',
      '......A....A',
      '..#.####.#..',
      '..#A.....#..',
      '......##..A.',
      '.###......#.',
      '........A...',
      '..#..##..#..',
      'H...........'],
  },
  i_trono: {
    nome: 'Trono de Hades', parede: 'espinho', liquido: 'lava',
    mapa: [
      '   E....E   ',
      '  ........  ',
      ' ..~~.A~~.A ',
      '...~~..~~...',
      '..#......#..',
      '..E..A...E..',
      '............',
      ' ..#....#.. ',
      '.........A..',
      '  ........  ',
      '   H.....   '],
  },

  /* ---------------- Duat ---------------- */
  d_osiris: {
    nome: 'Salão de Osíris', parede: 'obelisco', liquido: 'areia',
    mapa: [
      'E.E.D##..E.E',
      '............',
      '.#..#..#..#.',
      '...........A',
      '.#..#..#..#.',
      '.A..........',
      '.#..#..#..#.',
      '...A........',
      ' .#..~~.A#. ',
      ' .........A ',
      'H...........'],
  },
  d_dunas: {
    nome: 'Dunas do Duat', parede: 'sarcofago', liquido: 'areia',
    mapa: [
      ' E.E.D..E.E ',
      '..~~....#...',
      '...~~...#...',
      'A#........A.',
      '..........~~',
      '.....#....~.',
      '..#..A...A..',
      '....~~...#..',
      '.#...~~.....',
      ' ....#....A ',
      'H...........'],
  },
  d_piramide: {
    nome: 'Pirâmide de Set', parede: 'obelisco', liquido: 'areia',
    mapa: [
      '   E....E   ',
      '  ........  ',
      ' .A#....#.. ',
      '...#.##.#..A',
      '..E......E..',
      '.....A......',
      '..#..~~..#..',
      '............',
      ' ..#....#A. ',
      '  ........  ',
      '   H.....   '],
  },

  /* ---------------- Abismo do Caos ---------------- */
  c_abismo: {
    nome: 'Abismo do Caos', parede: 'cristal', liquido: 'vazio',
    mapa: [
      'E..~~..~~..E',
      '...#....#...',
      '.~~......~~.',
      '.A#..~~A.#..',
      'E....~~....E',
      '..~~.##.~~..',
      '...#....#...',
      '.~~..~~..~~.',
      '..#A.....#..',
      '......A.....',
      'H...........'],
  },
};
