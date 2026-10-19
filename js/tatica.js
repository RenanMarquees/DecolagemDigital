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

/** Hexágonos vizinhos onde dá para pisar (só chão: sem parede, sem lava/fenda, sem vazio). */
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
    const tipo = celula(g, h.c, h.r);
    if (tipo === '#' || tipo === ' ' || tipo === 'D') return false; // '~' (lava, fenda...) não bloqueia a visão; porta fechada bloqueia
  }
  return true;
}

/** Busca em largura: acha tudo que dá para alcançar andando. `bloqueia(c, r)` impede de entrar.
 *  `ehArm(c, r)` (opcional) diz onde há armadilha: entre caminhos do mesmo tamanho, escolhemos o que pisa em menos delas.
 *  Cada nó guarda: d = passos, tr = armadilhas no caminho, de = nó anterior. */
function bfs(g, origem, maxDist, bloqueia, ehArm) {
  const nos = new Map();
  nos.set(chave(origem.c, origem.r), { c: origem.c, r: origem.r, d: 0, tr: 0, de: null });
  const fila = [origem];
  while (fila.length) {
    const cur = fila.shift();
    const no = nos.get(chave(cur.c, cur.r));
    if (no.d >= maxDist) continue;
    for (const v of vizinhos(g, cur.c, cur.r)) {
      if (bloqueia(v.c, v.r)) continue;
      const k = chave(v.c, v.r);
      const tr = no.tr + (ehArm && ehArm(v.c, v.r) ? 1 : 0);
      const ja = nos.get(k);
      if (!ja) { nos.set(k, { c: v.c, r: v.r, d: no.d + 1, tr, de: no }); fila.push(v); }
      else if (ja.d === no.d + 1 && tr < ja.tr) { ja.tr = tr; ja.de = no; } // mesmo tamanho, menos armadilhas
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
    c: pos.c, r: pos.r, vivo: true, efeitos: [],
  };
}

/** Uma expedição = o cenário dividido em etapas por portas. Cada etapa é uma sala com mais inimigos que a anterior.
 *  Com `chefeId`, a última etapa é a arena do chefe (o chefe SEMPRE fica na última). */
function criarExpedicao(reino, chefeId) {
  const salas = embaralhar(reino.salas);
  const etapas = [];
  for (let i = 0; i < (reino.salas.length ? 2 : 0); i++) {
    etapas.push({ mapa: salas[i % salas.length], n: Math.min(4, 2 + i + (reino.tier >= 3 ? 1 : 0)) });
  }
  if (chefeId) etapas.push({ mapa: reino.arena, chefe: true });
  return { reinoId: reino.id, chefeId: chefeId || null, etapas, idx: 0 };
}

/** Monta a etapa atual da expedição `exp`. `p` = o herói. */
function criarTatica(reino, exp, p) {
  const etapa = exp.etapas[exp.idx];
  const ehChefe = !!etapa.chefe;
  const temProxima = exp.idx < exp.etapas.length - 1;
  const sala = MAPAS[etapa.mapa];
  const g = { cols: sala.mapa[0].length, rows: sala.mapa.length, cel: [] };
  let heroi = null, porta = null;
  let spawns = [];
  const armadilhas = new Map();
  sala.mapa.forEach((linha, r) => {
    g.cel.push([]);
    [...linha].forEach((ch, c) => {
      if (ch === 'H') { heroi = { c, r }; ch = '.'; }
      else if (ch === 'E') { spawns.push({ c, r }); ch = '.'; }
      else if (ch === 'A') { if (reino.armadilha) armadilhas.set(chave(c, r), { tipo: reino.armadilha }); ch = '.'; }
      else if (ch === 'D') { if (temProxima) porta = { c, r, aberta: false }; else ch = '.'; } // a última etapa não tem porta
      g.cel[r].push(ch);
    });
  });

  const pool = reino.inimigos;
  const sorteio = () => pool[Math.floor(Math.random() * pool.length)];
  const lista = [];
  if (ehChefe) {
    lista.push({ id: exp.chefeId, esc: { stat: 1, xp: 1 }, chefe: true });
    for (let i = 0; i < ADDS_CHEFE; i++) lista.push({ id: sorteio(), esc: ESCALA_ADD });
    spawns.sort((a, b) => dist(b, heroi) - dist(a, heroi)); // o chefe aparece no ponto mais distante
  } else {
    const n = etapa.n;
    for (let i = 0; i < n; i++) lista.push({ id: sorteio(), esc: ESCALA_GRUPO[n] });
    spawns = embaralhar(spawns);
  }
  const inim = lista.map((e, i) => criarInimigoT(e.id, e.esc, i + 1, spawns[i], !!e.chefe));

  const T = {
    g, nomeSala: sala.nome, idSala: etapa.mapa, parede: sala.parede, liquido: sala.liquido, reinoId: reino.id,
    exp, etapa: exp.idx + 1, totalEtapas: exp.etapas.length, ultimaEtapa: !temProxima,
    chefeId: ehChefe ? exp.chefeId : null,
    tipoArm: reino.armadilha || null, armadilhas, porta, livre: false,
    heroi, saida: { ...heroi }, inim, mortos: [],
    rodada: 1, fase: 'heroi', movRest: derivados(p).mov, acaoUsada: false, defendendo: false, buff: null, efeitos: [],
    fila: [], fim: null, log: [], fx: [],
  };
  const chefe = inim.find(e => e.chefe);
  logar(T, chefe ? `${chefe.icone} ${chefe.nome} bloqueia o caminho!` : `${inim.map(e => e.icone).join(' ')} cercam você!`, 'info');
  if (armadilhas.size) { const def = ARMADILHAS[reino.armadilha]; logar(T, `${def.icone} Cuidado: ${armadilhas.size} armadilhas no chão (${def.nome.toLowerCase()}). ${def.desc}`, 'aviso'); }
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

const temArmadilha = (T, c, r) => T.armadilhas.has(chave(c, r));

/** Hexágonos aonde o herói pode andar agora (não atravessa inimigos).
 *  `armadilhas` = quantas armadilhas o caminho mais seguro até lá pisa. */
function tAlcance(T) {
  if (T.fase !== 'heroi' || T.fim) return [];
  const nos = bfs(T.g, T.heroi, T.movRest, (c, r) => !!inimigoEm(T, c, r), (c, r) => temArmadilha(T, c, r));
  return [...nos.values()].filter(n => n.d > 0).map(n => ({ c: n.c, r: n.r, custo: n.d, armadilhas: n.tr }));
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
/** Anda pelo caminho mais curto (e mais seguro) até o hexágono. Armadilhas pelo caminho disparam; a porta aberta leva à próxima etapa. */
function tMover(T, p, c, r) {
  if (T.fase !== 'heroi' || T.fim) return false;
  const nos = bfs(T.g, T.heroi, T.movRest, (cc, rr) => !!inimigoEm(T, cc, rr), (cc, rr) => temArmadilha(T, cc, rr));
  const alvo = nos.get(chave(c, r));
  if (!alvo || alvo.d === 0) return false;
  for (const passo of caminhoAte(alvo)) {
    T.heroi = { c: passo.c, r: passo.r };
    T.movRest -= 1;
    if (T.porta && T.porta.aberta && passo.c === T.porta.c && passo.r === T.porta.r) { T.fim = 'porta'; return true; }
    const res = dispararArmadilha(T, p, 'heroi', passo.c, passo.r);
    if (T.fim) return true;       // morreu na armadilha
    if (res && res.parou) break;  // paralisado: o movimento acaba aqui
  }
  return true;
}

/* ---------- Armadilhas e efeitos ---------- */
const temEfeito = (lista, tipo) => lista.some(x => x.tipo === tipo);
/** Movimento que uma unidade realmente tem (gelo tira 1, mas nunca fica abaixo de 1). */
function movEfetivo(base, efeitos) { return Math.max(1, base - (temEfeito(efeitos, 'gelo') ? 1 : 0)); }

/** Quem pisa (`quem` = 'heroi' ou um inimigo) dispara a armadilha do hexágono. Ela some depois de usada. */
function dispararArmadilha(T, p, quem, c, r) {
  const k = chave(c, r);
  const arm = T.armadilhas.get(k);
  if (!arm) return null;
  T.armadilhas.delete(k);
  const def = ARMADILHAS[arm.tipo];
  const heroi = quem === 'heroi';
  const nome = heroi ? 'Você pisa' : `${quem.nome} pisa`;
  const hpMax = heroi ? derivados(p).hpMax : quem.hpMax;
  const fator = !heroi && quem.chefe ? CHEFE_FATOR_ARM : 1;
  const fxAlvo = heroi ? 'heroi' : quem.uid;
  const efeitos = heroi ? T.efeitos : quem.efeitos;
  const dano = def.pct ? Math.max(1, Math.round(hpMax * def.pct * fator)) : 0;
  let parou = false;
  const feri = (v) => {
    if (heroi) p.hp = Math.max(0, p.hp - v); else quem.hp = Math.max(0, quem.hp - v);
    T.fx.push({ alvo: fxAlvo, v, forte: true });
  };

  switch (arm.tipo) {
    case 'gelo':
      efeitos.push({ tipo: 'gelo', turnos: heroi ? def.turnos : def.turnos + 1 }); // inimigos agem depois, então ganham 1 a mais
      if (heroi) T.movRest = Math.max(0, T.movRest - 1);
      T.fx.push({ alvo: fxAlvo, v: 0, texto: '❄️ -1 👣', forte: true });
      logar(T, `${def.icone} ${nome} na ${def.nome}! Movimento -1 por ${def.turnos} rodadas.`, 'aviso');
      break;
    case 'raio':
      feri(dano); parou = true;
      if (heroi) T.movRest = 0;
      logar(T, `${def.icone} ${nome} na ${def.nome}! ${dano} de dano e fica paralisado.`, 'aviso');
      break;
    case 'fogo':
      feri(dano);
      logar(T, `${def.icone} ${nome} na ${def.nome}! ${dano} de dano.`, 'aviso');
      break;
    case 'veneno':
      efeitos.push({ tipo: 'veneno', turnos: def.turnos, dano });
      T.fx.push({ alvo: fxAlvo, v: 0, texto: '☠️', forte: true });
      logar(T, `${def.icone} ${nome} na ${def.nome}! Envenenado: ${dano} de dano por ${def.turnos} rodadas.`, 'aviso');
      break;
    case 'vazio': {
      feri(dano);
      let drenou = 0;
      if (heroi) { drenou = Math.min(p.mp, Math.round(derivados(p).mpMax * def.mana)); p.mp -= drenou; }
      logar(T, `${def.icone} ${nome} na ${def.nome}! ${dano} de dano${drenou ? ` e perde ${drenou} de mana` : ''}.`, 'aviso');
      break;
    }
  }
  if (heroi) { if (p.hp <= 0) { T.fim = 'derrota'; logar(T, 'Sua visão escurece...', 'erro'); } }
  else verificarMortes(T);
  return { parou };
}

/** No fim de cada rodada: veneno causa dano e os efeitos perdem uma rodada. */
function passarEfeitos(T, p) {
  const tick = (efeitos, aplicar, nome) => {
    for (const ef of efeitos) {
      if (ef.tipo === 'veneno') aplicar(ef.dano, nome);
      ef.turnos--;
    }
    return efeitos.filter(ef => ef.turnos > 0);
  };
  T.efeitos = tick(T.efeitos, (v) => {
    p.hp = Math.max(0, p.hp - v);
    T.fx.push({ alvo: 'heroi', v, forte: true });
    logar(T, `☠️ O veneno causa ${v} de dano em você.`, 'inimigo');
  });
  if (p.hp <= 0) { T.fim = 'derrota'; logar(T, 'Sua visão escurece...', 'erro'); return; }
  for (const e of vivos(T)) {
    e.efeitos = tick(e.efeitos, (v) => {
      e.hp = Math.max(0, e.hp - v);
      T.fx.push({ alvo: e.uid, v, forte: true });
      logar(T, `☠️ O veneno causa ${v} de dano em ${e.nome}.`, 'dano');
    });
  }
  verificarMortes(T);
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
  T.acaoUsada = !T.livre; // na sala limpa, usar item não gasta nada
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
  if (T.fase !== 'heroi' || T.fim || T.livre) return false;
  T.fase = 'inimigos';
  // quem está mais perto age primeiro, para não se atrapalharem
  T.fila = vivos(T).sort((a, b) => dist(a, T.heroi) - dist(b, T.heroi) || a.uid - b.uid).map(e => e.uid);
  return true;
}

function podeAtacarHeroi(T, e, pos) {
  return dist(pos, T.heroi) <= e.alc && (e.alc <= 1 || linhaDeVisao(T.g, pos, T.heroi));
}

/** O inimigo anda até um lugar de onde possa atacar. Devolve {parou, morreu} se pisou numa armadilha. */
function moverInimigo(T, p, e) {
  const ocupado = (c, r) => T.inim.some(x => x.vivo && x !== e && x.c === c && x.r === r);
  const ehHeroi = (c, r) => c === T.heroi.c && r === T.heroi.r;
  const mov = movEfetivo(e.mov, e.efeitos);
  // inimigos atravessam uns aos outros, mas ninguém atravessa o herói; caminhos sem armadilha são preferidos
  const nos = bfs(T.g, e, 80, ehHeroi, (c, r) => temArmadilha(T, c, r));
  const lista = [...nos.values()]; // ordem de inserção = do mais perto para o mais longe
  let meta = null;
  for (const evitar of [true, false]) { // 1º: lugares sem armadilha; se não houver, aceita pisar numa
    for (const n of lista) {
      if (n.d === 0 || ocupado(n.c, n.r) || (evitar && temArmadilha(T, n.c, n.r))) continue;
      if (podeAtacarHeroi(T, e, n)) { meta = n; break; }
    }
    if (meta) break;
  }
  let cam = [];
  if (meta) {
    cam = caminhoAte(meta).slice(0, mov);
  } else { // sem lugar livre para atacar: chega o mais perto possível
    let melhor = null;
    for (const n of lista) {
      if (n.d === 0 || n.d > mov || ocupado(n.c, n.r)) continue;
      const s = dist(n, T.heroi) + (temArmadilha(T, n.c, n.r) ? 0.5 : 0);
      if (!melhor || s < melhor.s || (s === melhor.s && n.d < melhor.n.d)) melhor = { n, s };
    }
    if (melhor) cam = caminhoAte(melhor.n);
  }
  // anda passo a passo (pode pisar em armadilhas pelo caminho)
  let res = { parou: false, morreu: false };
  let ultimoLivre = { c: e.c, r: e.r };
  for (const passo of cam) {
    e.c = passo.c; e.r = passo.r;
    if (!ocupado(e.c, e.r)) ultimoLivre = { c: e.c, r: e.r };
    const a = dispararArmadilha(T, p, e, e.c, e.r);
    if (!e.vivo) { res.morreu = true; return res; }
    if (a && a.parou) { res.parou = true; break; }
  }
  // não pode terminar em cima de outro inimigo
  if (ocupado(e.c, e.r)) { e.c = ultimoLivre.c; e.r = ultimoLivre.r; }
  return res;
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
  passarEfeitos(T, p);          // veneno e duração dos efeitos
  if (T.fim) return;            // morreu de veneno, ou o veneno matou o último inimigo
  if (T.buff && --T.buff.turnos <= 0) T.buff = null;
  p.mp = Math.min(d.mpMax, p.mp + d.regenMp);
  T.rodada++;
  T.defendendo = false;
  T.fase = 'heroi';
  T.movRest = movEfetivo(d.mov, T.efeitos);
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
    let paralisado = false;
    if (!podeAtacarHeroi(T, e, e)) paralisado = moverInimigo(T, p, e).parou;
    if (e.vivo && !paralisado && !T.fim && podeAtacarHeroi(T, e, e)) atacarHeroi(T, p, d, e);
    if (p.hp <= 0) { T.fim = 'derrota'; logar(T, 'Sua visão escurece...', 'erro'); }
  }
  if (!T.fim && !T.fila.length) finalizarRodada(T, p);
  return ator;
}

/* ---------- Portas e etapas ---------- */
/** Sala limpa: a porta se abre e o herói anda livremente (sem turnos) até ela. */
function tAbrirPorta(T) {
  if (!T.porta || T.porta.aberta) return false;
  T.porta.aberta = true;
  T.g.cel[T.porta.r][T.porta.c] = '.';
  T.fim = null; T.livre = true; T.fase = 'heroi';
  T.movRest = 99; T.acaoUsada = false; T.defendendo = false; T.buff = null;
  logar(T, '🚪 A porta se abriu! Vá até ela. Cuidado com as armadilhas no caminho.', 'info');
  return true;
}

/** O herói atravessou a porta: monta a próxima etapa. Ele recupera um pouco de vida e mana. */
function tProximaEtapa(T, p) {
  const exp = T.exp;
  exp.idx++;
  const d = derivados(p);
  const hp0 = p.hp, mp0 = p.mp;
  p.hp = Math.min(d.hpMax, p.hp + Math.round(d.hpMax * RECUPERA_PORTA));
  p.mp = Math.min(d.mpMax, p.mp + Math.round(d.mpMax * RECUPERA_PORTA));
  const reino = REINOS.find(r => r.id === exp.reinoId);
  const N = criarTatica(reino, exp, p);
  N.recuperou = { hp: p.hp - hp0, mp: p.mp - mp0 };
  if (N.recuperou.hp || N.recuperou.mp) logar(N, `Você recupera o fôlego: +${N.recuperou.hp} vida, +${N.recuperou.mp} mana.`, 'cura');
  return N;
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
