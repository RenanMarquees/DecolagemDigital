'use strict';
/* ============================================================
   BATALHA TÁTICA — mapa de hexágonos ao estilo Gloomhaven.
   Sem nada de tela aqui: só o estado do mapa e as regras.
   Fluxo de uma rodada:
     1. turno do herói: andar (até "mov" hexágonos) + 1 ação, em qualquer ordem
     2. cada inimigo, um por vez: anda até você e ataca
   ============================================================ */

/* ---------- Geometria hexagonal ----------
   Guardamos cada posição como {c: coluna, r: linha}. As linhas ímpares ficam
   deslocadas meio hexágono para a direita ("odd-r"). */
const DIRS_PAR = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const DIRS_IMPAR = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
const chave = (c, r) => c + ',' + r;

function celula(g, c, r) {
  if (r < 0 || r >= g.rows || c < 0 || c >= g.cols) return ' ';
  return g.cel[r][c];
}

/** Hexágonos vizinhos que são chão (sem parede e sem vazio). */
function vizinhos(g, c, r) {
  const dirs = (r & 1) ? DIRS_IMPAR : DIRS_PAR;
  const out = [];
  for (const [dc, dr] of dirs) {
    const nc = c + dc, nr = r + dr;
    if (celula(g, nc, nr) === '.') out.push({ c: nc, r: nr });
  }
  return out;
}

function paraCubo(c, r) { const x = c - (r - (r & 1)) / 2; return { x, y: -x - r, z: r }; }
function doCubo(x, z) { return { c: x + (z - (z & 1)) / 2, r: z }; }
/** Distância em hexágonos entre duas posições. */
function dist(a, b) {
  const A = paraCubo(a.c, a.r), B = paraCubo(b.c, b.r);
  return Math.max(Math.abs(A.x - B.x), Math.abs(A.y - B.y), Math.abs(A.z - B.z));
}

function arredondaCubo(x, y, z) {
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { x: rx, y: ry, z: rz };
}

/** Linha de visão: nenhuma parede (nem vazio) entre os dois hexágonos. */
function linhaDeVisao(g, a, b) {
  const n = dist(a, b);
  if (n <= 1) return true;
  const A = paraCubo(a.c, a.r), B = paraCubo(b.c, b.r);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    // pequenos desvios evitam empates exatamente na borda entre dois hexágonos
    const p = arredondaCubo(A.x + (B.x - A.x) * t + 1e-6, A.y + (B.y - A.y) * t + 2e-6, A.z + (B.z - A.z) * t - 3e-6);
    const h = doCubo(p.x, p.z);
    if (celula(g, h.c, h.r) !== '.') return false;
  }
  return true;
}

/** Busca em largura: acha tudo que dá para alcançar andando. `bloqueia(c, r)` impede de entrar. */
function bfs(g, origem, maxDist, bloqueia) {
  const nos = new Map();
  nos.set(chave(origem.c, origem.r), { c: origem.c, r: origem.r, d: 0, de: null });
  const fila = [origem];
  while (fila.length) {
    const cur = fila.shift();
    const no = nos.get(chave(cur.c, cur.r));
    if (no.d >= maxDist) continue;
    for (const v of vizinhos(g, cur.c, cur.r)) {
      const k = chave(v.c, v.r);
      if (nos.has(k) || bloqueia(v.c, v.r)) continue;
      nos.set(k, { c: v.c, r: v.r, d: no.d + 1, de: no });
      fila.push(v);
    }
  }
  return nos;
}
/** Lista dos hexágonos do caminho, do primeiro passo até o destino. */
function caminhoAte(no) {
  const cam = [];
  for (let n = no; n && n.de; n = n.de) cam.unshift(n);
  return cam;
}

/* ---------- Salas ----------
   . chão   # pedra   (espaço) vazio   H herói e saída   E onde os inimigos podem aparecer */
const SALAS = [
  { nome: 'Salão de Pedra', mapa: [
    '..E..E..',
    '.#....#.',
    '..E..E..',
    '...##...',
    '........',
    '.#....#.',
    'H.......'] },
  { nome: 'A Ponte Estreita', mapa: [
    'E.E..E.E',
    '........',
    '###..###',
    '###..###',
    '........',
    '........',
    'H.......'] },
  { nome: 'Pilares Quebrados', mapa: [
    '..E..E..',
    '.E....E.',
    '.#.##.#.',
    '........',
    '.#.##.#.',
    '........',
    'H.......'] },
  { nome: 'Cripta Antiga', mapa: [
    '  E..E  ',
    ' E....E ',
    '..#..#..',
    '........',
    '..#..#..',
    ' ...... ',
    '  H...  '] },
  { nome: 'O Anel', mapa: [
    'E......E',
    '.E....E.',
    '..####..',
    '..#..#..',
    '..#..#..',
    '........',
    'H.......'] },
];

/* ---------- Criação da batalha ---------- */
function embaralhar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function criarInimigoT(id, esc, uid, pos, ehChefe) {
  const b = INIMIGOS[id], f = esc.stat;
  const hp = Math.max(1, Math.round(b.hp * f));
  return {
    uid, id, nome: b.nome, icone: b.icone, chefe: ehChefe,
    hp, hpMax: hp, atk: Math.max(1, Math.round(b.atk * f)), def: b.def,
    mov: b.mov || 2, alc: b.alc || 1,
    xp: Math.round(b.xp * esc.xp), gold: Math.round(b.gold * esc.xp),
    drops: b.drops || [], especial: b.especial, reliquia: b.reliquia, fragmento: b.fragmento,
    c: pos.c, r: pos.r, vivo: true,
  };
}

/** Monta uma batalha no reino. `chefeId` = id do chefe, ou null para um encontro comum. `p` = o herói. */
function criarTatica(reino, chefeId, p) {
  const sala = SALAS[Math.floor(Math.random() * SALAS.length)];
  const g = { cols: sala.mapa[0].length, rows: sala.mapa.length, cel: [] };
  let heroi = null;
  let spawns = [];
  sala.mapa.forEach((linha, r) => {
    g.cel.push([]);
    [...linha].forEach((ch, c) => {
      if (ch === 'H') { heroi = { c, r }; ch = '.'; }
      else if (ch === 'E') { spawns.push({ c, r }); ch = '.'; }
      g.cel[r].push(ch);
    });
  });

  const pool = reino.inimigos;
  const sorteio = () => pool[Math.floor(Math.random() * pool.length)];
  const lista = [];
  if (chefeId) {
    lista.push({ id: chefeId, esc: { stat: 1, xp: 1 }, chefe: true });
    for (let i = 0; i < ADDS_CHEFE; i++) lista.push({ id: sorteio(), esc: ESCALA_ADD });
    spawns.sort((a, b) => dist(b, heroi) - dist(a, heroi)); // o chefe aparece no ponto mais distante
  } else {
    const n = 2 + (reino.tier >= 2 && Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) lista.push({ id: sorteio(), esc: ESCALA_GRUPO[n] });
    spawns = embaralhar(spawns);
  }
  const inim = lista.map((e, i) => criarInimigoT(e.id, e.esc, i + 1, spawns[i], !!e.chefe));

  const T = {
    g, nomeSala: sala.nome, reinoId: reino.id, chefeId: chefeId || null,
    heroi, saida: { ...heroi }, inim, mortos: [],
    rodada: 1, fase: 'heroi', movRest: derivados(p).mov, acaoUsada: false, defendendo: false, buff: null,
    fila: [], fim: null, log: [], fx: [],
  };
  const chefe = inim.find(e => e.chefe);
  logar(T, chefe ? `${chefe.icone} ${chefe.nome} bloqueia o caminho!` : `${inim.map(e => e.icone).join(' ')} cercam você!`, 'info');
  avisarEspecial(T);
  return T;
}

function logar(T, msg, cls = '') { T.log.push({ msg, cls }); }

function avisarEspecial(T) {
  for (const e of T.inim) {
    if (e.vivo && e.especial && T.rodada % e.especial.cada === 0) {
      logar(T, `⚠️ ${e.nome} vai usar ${e.especial.nome} neste turno! Afaste-se ou defenda-se.`, 'aviso');
    }
  }
}

/* ---------- Consultas ---------- */
function inimigoEm(T, c, r) { return T.inim.find(e => e.vivo && e.c === c && e.r === r) || null; }
function vivos(T) { return T.inim.filter(e => e.vivo); }
function adjacentes(T, pos) { return vivos(T).filter(e => dist(pos, e) === 1); }

/** Hexágonos aonde o herói pode andar agora (não atravessa inimigos). */
function tAlcance(T) {
  if (T.fase !== 'heroi' || T.fim) return [];
  const nos = bfs(T.g, T.heroi, T.movRest, (c, r) => !!inimigoEm(T, c, r));
  return [...nos.values()].filter(n => n.d > 0).map(n => ({ c: n.c, r: n.r, custo: n.d }));
}

function alvosEm(T, origem, alcance) {
  return vivos(T).filter(e => dist(origem, e) <= alcance && (alcance <= 1 || linhaDeVisao(T.g, origem, e)));
}
function alcanceDa(p, acao) {
  return acao.tipo === 'atacar' ? CLASSES[p.classe].alcanceBasico : HABILIDADES[acao.id].alcance;
}
/** Inimigos que o herói pode escolher como alvo da ação, a partir de onde está. */
function tAlvos(T, p, acao) { return alvosEm(T, T.heroi, alcanceDa(p, acao)); }

/* ---------- Ações do herói ---------- */
function tMover(T, p, c, r) {
  if (T.fase !== 'heroi' || T.fim) return false;
  const alvo = tAlcance(T).find(h => h.c === c && h.r === r);
  if (!alvo) return false;
  T.movRest -= alvo.custo;
  T.heroi = { c, r };
  return true;
}

function golpeT(T, d, alvo, ataque, bonusCrit = 0) {
  const mult = T.buff ? T.buff.mult : 1;
  let dano = ataque * mult * d.danoMult * rand(0.9, 1.1) * reducaoDefesa(alvo.def);
  const crit = Math.random() < d.crit + bonusCrit;
  if (crit) dano *= 1.75;
  dano = Math.max(1, Math.round(dano));
  alvo.hp = Math.max(0, alvo.hp - dano);
  T.fx.push({ alvo: alvo.uid, v: dano, crit });
  return { dano, crit };
}

function verificarMortes(T) {
  for (const e of T.inim) {
    if (e.vivo && e.hp <= 0) {
      e.vivo = false; T.mortos.push(e);
      logar(T, `${e.icone} ${e.nome} foi derrotado!`, 'info');
    }
  }
  if (T.inim.every(e => !e.vivo)) T.fim = 'vitoria';
}

function podeAgir(T) {
  if (T.fase !== 'heroi' || T.fim) return false;
  if (T.acaoUsada) { logar(T, 'Você já usou a ação neste turno.', 'erro'); return false; }
  return true;
}

function tAtacar(T, p, uid) {
  if (!podeAgir(T)) return false;
  const d = derivados(p);
  const alvo = tAlvos(T, p, { tipo: 'atacar' }).find(e => e.uid === uid);
  if (!alvo) { logar(T, 'Esse inimigo está fora de alcance.', 'erro'); return false; }
  const r = golpeT(T, d, alvo, d[CLASSES[p.classe].basico] * 1.5 + d.atk);
  logar(T, `Você ataca ${alvo.nome}: ${r.dano} de dano${r.crit ? ' (CRÍTICO!)' : ''}.`, r.crit ? 'crit' : 'dano');
  T.acaoUsada = true;
  verificarMortes(T);
  return true;
}

function tHabilidade(T, p, id, uid) {
  if (!podeAgir(T)) return false;
  const h = HABILIDADES[id];
  if (!h || h.nivel > p.nivel) return false;
  if (p.mp < h.custo) { logar(T, 'Mana insuficiente!', 'erro'); return false; }
  const d = derivados(p);

  if (h.tipo === 'buff') {
    p.mp -= h.custo;
    T.buff = { mult: h.mult, turnos: h.turnos };
    logar(T, `${h.icone} ${h.nome}! Seu dano aumenta por ${h.turnos} rodadas.`, 'cura');
  } else if (h.tipo === 'cura') {
    p.mp -= h.custo;
    const cura = Math.min(d.hpMax - p.hp, Math.round(d.hpMax * 0.15 + d[h.stat] * h.mult * 0.7));
    p.hp += cura;
    logar(T, `${h.icone} ${h.nome}: você recupera ${cura} de vida.`, 'cura');
    T.fx.push({ alvo: 'heroi', v: cura, cura: true });
  } else { // dano ou dreno
    let alvos;
    if (h.area === 'ao-redor') {
      alvos = adjacentes(T, T.heroi);
      if (!alvos.length) { logar(T, 'Nenhum inimigo ao seu lado.', 'erro'); return false; }
    } else {
      const principal = tAlvos(T, p, { tipo: 'habilidade', id }).find(e => e.uid === uid);
      if (!principal) { logar(T, 'Esse inimigo está fora de alcance.', 'erro'); return false; }
      alvos = h.area === 'alvo+vizinhos' ? vivos(T).filter(e => e === principal || dist(e, principal) === 1) : [principal];
    }
    p.mp -= h.custo;
    let total = 0, algumCrit = false;
    for (const alvo of alvos) {
      for (let i = 0; i < (h.golpes || 1); i++) {
        const r = golpeT(T, d, alvo, d[h.stat] * h.mult + d.atk, h.critBonus || 0);
        total += r.dano; algumCrit = algumCrit || r.crit;
      }
    }
    logar(T, `${h.icone} ${h.nome}: ${total} de dano${alvos.length > 1 ? ` em ${alvos.length} inimigos` : ''}${algumCrit ? ' (CRÍTICO!)' : ''}.`, algumCrit ? 'crit' : 'dano');
    if (h.tipo === 'dreno') {
      const cura = Math.min(d.hpMax - p.hp, Math.round(total / 2));
      p.hp += cura;
      if (cura > 0) { logar(T, `Você drena ${cura} de vida.`, 'cura'); T.fx.push({ alvo: 'heroi', v: cura, cura: true }); }
    }
  }
  T.acaoUsada = true;
  verificarMortes(T);
  return true;
}

function tUsarItem(T, p, id) {
  if (!podeAgir(T)) return false;
  const msg = usarConsumivel(p, id);
  if (!msg) { logar(T, 'Isso não teria efeito agora.', 'erro'); return false; }
  logar(T, msg, 'cura');
  T.fx.push({ alvo: 'heroi', v: 0, cura: true, texto: '✚' });
  T.acaoUsada = true;
  return true;
}

function tDefender(T, p) {
  if (!podeAgir(T)) return false;
  const d = derivados(p);
  T.defendendo = true;
  p.mp = Math.min(d.mpMax, p.mp + Math.round(d.mpMax * 0.1));
  logar(T, '🛡️ Você se protege (dano pela metade até o fim da rodada) e recupera o fôlego (+mana).', 'info');
  T.acaoUsada = true;
  return true;
}

/** Fugir só é possível em cima da saída 🚪 (onde você começou). Não vale contra chefes. */
function tFugir(T) {
  if (T.fase !== 'heroi' || T.fim) return false;
  if (T.chefeId) { logar(T, 'Não há como fugir de um deus!', 'erro'); return false; }
  if (T.heroi.c !== T.saida.c || T.heroi.r !== T.saida.r) { logar(T, 'Chegue até a saída 🚪 para fugir.', 'erro'); return false; }
  logar(T, 'Você escapou pela saída!', 'info');
  T.fim = 'fugiu';
  return true;
}

/* ---------- Turno dos inimigos ---------- */
function tEncerrarTurno(T) {
  if (T.fase !== 'heroi' || T.fim) return false;
  T.fase = 'inimigos';
  // quem está mais perto age primeiro, para não se atrapalharem
  T.fila = vivos(T).sort((a, b) => dist(a, T.heroi) - dist(b, T.heroi) || a.uid - b.uid).map(e => e.uid);
  return true;
}

function podeAtacarHeroi(T, e, pos) {
  return dist(pos, T.heroi) <= e.alc && (e.alc <= 1 || linhaDeVisao(T.g, pos, T.heroi));
}

function moverInimigo(T, e) {
  const ocupado = (c, r) => T.inim.some(x => x.vivo && x !== e && x.c === c && x.r === r);
  const ehHeroi = (c, r) => c === T.heroi.c && r === T.heroi.r;
  // inimigos atravessam uns aos outros, mas ninguém atravessa o herói
  const nos = bfs(T.g, e, 80, ehHeroi);
  let meta = null;
  for (const n of nos.values()) { // ordem de inserção = do mais perto para o mais longe
    if (n.d === 0 || ocupado(n.c, n.r)) continue;
    if (podeAtacarHeroi(T, e, n)) { meta = n; break; }
  }
  let destino = null;
  if (meta) {
    const cam = caminhoAte(meta);
    let passos = Math.min(e.mov, cam.length);
    while (passos > 0 && ocupado(cam[passos - 1].c, cam[passos - 1].r)) passos--;
    destino = passos > 0 ? cam[passos - 1] : null;
  } else { // sem lugar livre para atacar: chega o mais perto possível
    let melhor = null;
    for (const n of nos.values()) {
      if (n.d === 0 || n.d > e.mov || ocupado(n.c, n.r)) continue;
      const s = dist(n, T.heroi);
      if (!melhor || s < melhor.s || (s === melhor.s && n.d < melhor.n.d)) melhor = { n, s };
    }
    destino = melhor ? melhor.n : null;
  }
  if (destino) { e.c = destino.c; e.r = destino.r; }
}

function atacarHeroi(T, p, d, e) {
  const esp = e.especial;
  const especial = !!esp && T.rodada % esp.cada === 0;
  if (!especial && Math.random() < d.esquiva) {
    logar(T, `Você esquiva do ataque de ${e.nome}!`, 'info');
    T.fx.push({ alvo: 'heroi', v: 0, esquiva: true });
    return;
  }
  let dano = e.atk * (especial ? esp.mult : 1) * rand(0.9, 1.1) * reducaoDefesa(d.def);
  if (T.defendendo) dano *= 0.5;
  dano = Math.max(1, Math.round(dano * d.danoRecebido));
  p.hp = Math.max(0, p.hp - dano);
  T.fx.push({ alvo: 'heroi', v: dano, forte: especial, de: e.uid });
  logar(T, especial ? `💢 ${e.nome} usa ${esp.nome}: ${dano} de dano!` : `${e.nome} ataca: ${dano} de dano.`, especial ? 'forte' : 'inimigo');
}

function finalizarRodada(T, p) {
  const d = derivados(p);
  if (T.buff && --T.buff.turnos <= 0) T.buff = null;
  p.mp = Math.min(d.mpMax, p.mp + d.regenMp);
  T.rodada++;
  T.defendendo = false;
  T.fase = 'heroi';
  T.movRest = d.mov;
  T.acaoUsada = false;
  avisarEspecial(T);
}

/** Faz UM inimigo agir (andar e atacar). Quando o último termina, começa a próxima rodada. */
function tProximoInimigo(T, p) {
  if (T.fase !== 'inimigos' || T.fim) return null;
  T.fx = [];
  const d = derivados(p);
  let ator = null;
  while (T.fila.length && !ator) {
    const uid = T.fila.shift();
    const e = T.inim.find(x => x.uid === uid);
    if (!e || !e.vivo) continue;
    ator = e;
    if (!podeAtacarHeroi(T, e, e)) moverInimigo(T, e);
    if (podeAtacarHeroi(T, e, e)) atacarHeroi(T, p, d, e);
    if (p.hp <= 0) { T.fim = 'derrota'; logar(T, 'Sua visão escurece...', 'erro'); }
  }
  if (!T.fim && !T.fila.length) finalizarRodada(T, p);
  return ator;
}

/* ---------- Fim da batalha ---------- */
function aplicarVitoriaT(T, p) {
  let xp = 0, gold = 0;
  const itens = [];
  for (const e of T.mortos) {
    xp += e.xp;
    gold += Math.round(e.gold * rand(0.8, 1.2));
    for (const dr of e.drops) if (Math.random() < dr.chance) itens.push(dr.id);
  }
  let primeira = false;
  if (T.chefeId && !p.derrotados[T.chefeId]) {
    primeira = true;
    p.derrotados[T.chefeId] = true;
    const b = INIMIGOS[T.chefeId];
    if (b.reliquia) itens.push(b.reliquia);
    if (b.fragmento) p.fragmentos.push(b.fragmento);
  }
  for (const id of itens) darItem(p, id);
  p.gold += gold;
  p.kills += T.mortos.length;
  const subidas = ganharXp(p, xp);
  return { xp, gold, itens, subidas, primeira };
}
