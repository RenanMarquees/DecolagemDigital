'use strict';
/* ============================================================
   BATALHA TÁTICA — mapa de hexágonos ao estilo Gloomhaven.
   Sem nada de tela aqui: só o estado do mapa e as regras.

   Uma rodada:
     1. Os inimigos mostram as cartas da rodada (o que cada TIPO vai fazer).
     2. Turno do herói: andar (até "mov" hexágonos) + 1 ação, em qualquer ordem.
     3. Os inimigos agem na ordem da iniciativa das cartas.
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

/** Linha de visão: nenhuma parede (nem vazio, nem porta fechada) entre os dois hexágonos. */
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
    if (tipo === '#' || tipo === ' ' || tipo === 'D') return false; // '~' (lava, fenda...) não bloqueia a visão
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

/* As 6 direções em coordenadas de cubo (usadas para empurrar e puxar em linha reta) */
const CUBO_DIRS = [[1, -1, 0], [1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1]];
function somaCubo(c, r, d) { const A = paraCubo(c, r); return doCubo(A.x + d[0], A.z + d[2]); }
/** Qual das 6 direções mais se parece com o caminho de `de` até `para`. */
function melhorDirecao(de, para) {
  const A = paraCubo(de.c, de.r), B = paraCubo(para.c, para.r);
  const v = [B.x - A.x, B.y - A.y, B.z - A.z];
  let melhor = 0, pontos = -Infinity;
  CUBO_DIRS.forEach((d, i) => { const s = d[0] * v[0] + d[1] * v[1] + d[2] * v[2]; if (s > pontos) { pontos = s; melhor = i; } });
  return melhor;
}

/* ---------- Níveis e dificuldade ---------- */
/** Nível do cenário: metade do nível do herói (arredondado para cima), mais o bônus da dificuldade. */
function nivelDoCenario(p, difId) {
  const dif = DIFICULDADES[difId] || DIFICULDADES[DIFICULDADE_PADRAO];
  return Math.max(1, Math.ceil(p.nivel / 2) + dif.nivel);
}
/** Resumo para mostrar antes de começar: nível do cenário e quanto os inimigos ficam mais fortes. */
function resumoCenario(cenario, p, difId) {
  const dif = DIFICULDADES[difId] || DIFICULDADES[DIFICULDADE_PADRAO];
  const reino = REINOS.find(r => r.id === cenario.reino);
  const nivel = nivelDoCenario(p, difId);
  const stat = Math.max(0.7, 1 + FORCA_POR_NIVEL * (nivel - reino.nivelBase)) * dif.stat * BALANCO.forca;
  const rec = Math.max(0.5, 1 + RECOMPENSA_POR_NIVEL * (nivel - reino.nivelBase)) * dif.recompensa;
  return { dif, nivel, stat, rec };
}

/* ---------- Criação da batalha ---------- */
function embaralhar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function criarInimigoT(id, esc, uid, pos, ehChefe, exp) {
  const b = INIMIGOS[id], f = esc.stat * exp.stat;
  const hp = Math.max(1, Math.round(b.hp * f));
  const atk = Math.max(1, Math.round(b.atk * (1 + (f - 1) * 0.6)));   // o ataque cresce mais devagar que a vida (números pequenos)
  const ganho = v => (v > 0 ? Math.max(1, Math.round(v * esc.xp * exp.rec * BALANCO.xp)) : 0);
  return {
    uid, id, tipo: id, nome: b.nome, icone: b.icone, chefe: ehChefe, estrutura: false,
    hp, hpMax: hp, atk, def: b.def,
    mov: b.mov || 2, alc: b.alc || 1,
    xp: ganho(b.xp), moedas: b.gold > 0 ? (ehChefe ? Math.max(2, Math.round(b.gold / 5)) : Math.max(1, Math.round(b.gold / 3))) : 0,   // quantas moedas ele solta
    drops: b.drops || [], reliquia: b.reliquia, fragmento: b.fragmento,
    c: pos.c, r: pos.r, vivo: true, efeitos: [], bonusAtq: 0, escudo: 0,
  };
}

function criarEstrutura(reinoId, uid, pos, exp) {
  const e = ESTRUTURAS[reinoId];
  const hp = Math.max(1, Math.round(e.hp * exp.stat));
  return {
    uid, id: e.mini, tipo: e.mini, nome: e.nome, icone: '🏗️', chefe: false, estrutura: true,
    hp, hpMax: hp, atk: 0, def: e.def, mov: 0, alc: 0,
    xp: Math.max(1, Math.round(2 * exp.rec * BALANCO.xp)), moedas: 0, drops: [],
    c: pos.c, r: pos.r, vivo: true, efeitos: [], bonusAtq: 0, escudo: 0,
  };
}

/** Prepara um cenário para jogar: nível, força dos inimigos e recompensas conforme herói e dificuldade. */
function criarExpedicao(cenario, p, difId = DIFICULDADE_PADRAO) {
  const resumo = resumoCenario(cenario, p, difId);
  return {
    cenario, reinoId: cenario.reino, difId, dif: resumo.dif, nivelCen: resumo.nivel,
    stat: resumo.stat, rec: resumo.rec, etapas: cenario.etapas, idx: 0,
    baralhos: { heroi: novoBaralhoMod(p.baralho), inim: novoBaralhoMod(baralhoInimigos(difId)) },   // a sorte dos ataques (o cenário todo usa os mesmos)
    moedasColetadas: 0,                                                                                // moedas saqueadas; viram ouro no fim do cenário
  };
}

/** Escolhe um hexágono livre do mapa (para o baú e as estruturas), longe do herói e dos outros. */
function escolherHex(T, { minDistHeroi = 6, minDistOutros = 3, evitar = [] } = {}) {
  const livres = [];
  for (let r = 0; r < T.g.rows; r++) {
    for (let c = 0; c < T.g.cols; c++) {
      if (T.g.cel[r][c] !== '.') continue;
      const pos = { c, r };
      if (dist(pos, T.heroi) < minDistHeroi) continue;
      if (T.armadilhas.has(chave(c, r))) continue;
      if (T.inim.some(e => dist(pos, e) < 2)) continue;
      if (evitar.some(o => dist(pos, o) < minDistOutros)) continue;
      livres.push(pos);
    }
  }
  return livres.length ? livres[Math.floor(Math.random() * livres.length)] : null;
}

/** Monta a etapa atual da expedição. `p` = o herói. */
function criarTatica(exp, p) {
  const reino = REINOS.find(r => r.id === exp.reinoId);
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
    lista.push({ id: reino.chefe, esc: { stat: 1, xp: 1 }, chefe: true });
    for (let i = 0; i < ADDS_CHEFE; i++) lista.push({ id: sorteio(), esc: ESCALA_ADD });
    spawns.sort((a, b) => dist(b, heroi) - dist(a, heroi)); // o chefe aparece no ponto mais distante
  } else {
    const n = etapa.n || Math.min(4, 2 + exp.idx + (reino.tier >= 3 ? 1 : 0));
    for (let i = 0; i < n; i++) lista.push({ id: sorteio(), esc: ESCALA_GRUPO[n] });
    spawns = embaralhar(spawns);
  }
  const inim = lista.map((e, i) => criarInimigoT(e.id, e.esc, i + 1, spawns[i], !!e.chefe, exp));

  const T = {
    g, nomeSala: sala.nome, idSala: etapa.mapa, parede: sala.parede, liquido: sala.liquido, reinoId: reino.id,
    exp, etapa: exp.idx + 1, totalEtapas: exp.etapas.length, ultimaEtapa: !temProxima,
    objetivo: temProxima ? 'limpar' : exp.cenario.objetivo, limpa: false, rapidoUsado: false,
    chefeId: ehChefe ? reino.chefe : null,
    tipoArm: reino.armadilha || null, armadilhas, porta, livre: false,
    moedas: new Map(), bau: null, objetivoCumprido: false,
    heroi, saida: { ...heroi }, inim, mortos: [],
    rodada: 1, fase: 'escolha', movRest: 0, acaoUsada: false, bonusItem: { atq: 0 }, efeitos: [],
    baralhos: {}, cartas: {}, fila: [], fim: null, log: [], fx: [], modFx: [],
    mao: null, descarte: null, cartaHeroi: null, escudoHeroi: 0, heroiJogou: false,
  };
  // as cartas do herói acompanham o cenário inteiro (a mão e o descarte passam de uma etapa para a outra)
  if (!exp.cartasHeroi) exp.cartasHeroi = { mao: maoDoHeroi(p.classe), descarte: [] };
  if (!exp.cartasHeroi.perdidas) exp.cartasHeroi.perdidas = [];
  T.mao = exp.cartasHeroi.mao; T.descarte = exp.cartasHeroi.descarte; T.perdidas = exp.cartasHeroi.perdidas;

  // estruturas a destruir (só na última etapa)
  if (!temProxima && exp.cenario.objetivo === 'destruir') {
    const n = etapa.estruturas || 3;
    const postas = [];
    for (let i = 0; i < n; i++) {
      const pos = escolherHex(T, { minDistHeroi: 5, minDistOutros: 3, evitar: postas });
      if (pos) { postas.push(pos); T.inim.push(criarEstrutura(reino.id, T.inim.length + 1, pos, exp)); }
    }
  }
  // um baú por cenário, na última etapa (em "bau" é o objetivo; nos outros é um bônus)
  if (!temProxima) {
    const pos = escolherHex(T, { minDistHeroi: 7 });
    if (pos) T.bau = { c: pos.c, r: pos.r, aberto: false };
  }

  const chefe = inim.find(e => e.chefe);
  logar(T, chefe ? `${chefe.icone} ${chefe.nome} bloqueia o caminho!` : `${inim.filter(e => !e.estrutura).map(e => e.icone).join(' ')} cercam você!`, 'info');
  if (armadilhas.size) { const def = ARMADILHAS[reino.armadilha]; logar(T, `${def.icone} Cuidado: ${armadilhas.size} armadilhas no chão (${def.nome.toLowerCase()}). ${def.desc}`, 'aviso'); }
  conferirExaustao(T);
  return T;                      // as cartas dos monstros só viram DEPOIS que você escolhe a sua (veja tEscolherCarta)
}

function logar(T, msg, cls = '') { T.log.push({ msg, cls }); }

/* ---------- Cartas dos inimigos ---------- */
/** Vira a carta do topo do baralho de cada tipo de inimigo vivo. Todos do mesmo tipo fazem a mesma coisa. */
function revelarCartas(T, soFaltantes = false) {
  if (!soFaltantes) T.cartas = {};   // soFaltantes: mantém cartas já viradas (os testes de regras escolhem cartas de propósito)
  for (const e of T.inim) {
    if (!e.vivo || e.estrutura || T.cartas[e.tipo]) continue;
    let b = T.baralhos[e.tipo];
    if (!b) b = T.baralhos[e.tipo] = { cartas: embaralhar(baralhoDe(e.tipo)), i: 0 };
    if (b.i >= b.cartas.length) { b.cartas = embaralhar(b.cartas); b.i = 0; } // acabou: embaralha de novo
    T.cartas[e.tipo] = b.cartas[b.i++];
  }
  for (const e of T.inim) {
    const c = T.cartas[e.tipo];
    if (e.vivo && e.chefe && c && c.atq >= 3) logar(T, `⚠️ ${e.nome} vai usar "${c.nome}" nesta rodada! Cuidado.`, 'aviso');
  }
}

/* ---------- Consultas ---------- */
function inimigoEm(T, c, r) { return T.inim.find(e => e.vivo && e.c === c && e.r === r) || null; }
function vivos(T) { return T.inim.filter(e => e.vivo); }
function combatentes(T) { return T.inim.filter(e => e.vivo && !e.estrutura); }
function adjacentes(T, pos) { return vivos(T).filter(e => dist(pos, e) === 1); }
function ocupado(T, c, r) { return (T.heroi.c === c && T.heroi.r === r) || !!inimigoEm(T, c, r); }

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
function cartaAtual(T) { return (T && !T.livre && T.cartaHeroi) || {}; }
/** Alcance do ataque da carta (1 = corpo a corpo). Armas de longo alcance somam quando a carta já é à distância. */
function alcanceDa(p, T) {
  const c = cartaAtual(T), base = c.alc || 1;
  return base > 1 ? base + derivados(p).alc : base;
}
/** Inimigos que o herói pode escolher como alvo da ação, a partir de onde está. */
function tAlvos(T, p) {
  const c = cartaAtual(T);
  if (!c.atq) return [];
  if (c.alvo === 'ao-redor') return adjacentes(T, T.heroi);
  return alvosEm(T, T.heroi, alcanceDa(p, T));
}
/** Dano que o ataque da carta causa: dano da carta + atributo + armas (+ pedra de amolar). */
function danoDoHeroi(T, p) { const c = cartaAtual(T); return (c.atq || 0) + derivados(p).dano + ((T.bonusItem && T.bonusItem.atq) || 0); }

/* ---------- Moedas e baú ---------- */
/** Quando um inimigo cai, deixa uma moeda no hexágono (o herói precisa PARAR lá para pegar). */
function soltarMoeda(T, e) {
  if (e.estrutura || !(e.moedas > 0)) return;
  const k = chave(e.c, e.r);
  const atual = T.moedas.get(k);
  T.moedas.set(k, { valor: (atual ? atual.valor : 0) + e.moedas });   // `valor` = quantas moedas (cada uma vale 2 de ouro até o cenário 10 e 3 depois, no fim do cenário)
}
/** Quanto ouro vale cada moeda no cenário: 2 até o cenário 10, 3 do 11 em diante. */
/** Vida que o descanso longo devolve. */
const DESCANSO_CURA = 3;
const valorDaMoeda = cenarioId => (cenarioId <= 10 ? 2 : 3);

function sortearEquipamento(reino, p) {
  const t = tierDaLoja(p);
  const pool = [`${p.classe}_${t}`, `cabeca_${t}`, `peito_${t}`, `pes_${t}`, `escudo_${t}`].filter(id => ITENS[id]);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Ao terminar o movimento em cima de moedas (ou do baú, na sala livre), pega o que estiver lá. */
function lootarAqui(T, p) {
  const k = chave(T.heroi.c, T.heroi.r);
  const m = T.moedas.get(k);
  if (m) {
    T.moedas.delete(k);
    T.exp.moedasColetadas += m.valor;
    T.fx.push({ alvo: 'heroi', v: 0, texto: `+${m.valor} 🪙`, cura: true });
    logar(T, `🪙 Você pega ${m.valor} ${m.valor > 1 ? 'moedas' : 'moeda'} (${T.exp.moedasColetadas} no total; viram ouro no fim do cenário).`, 'cura');
  }
  if (T.livre && T.bau && !T.bau.aberto && T.bau.c === T.heroi.c && T.bau.r === T.heroi.r) abrirBau(T, p);
}

function abrirBau(T, p) {
  const reino = REINOS.find(r => r.id === T.reinoId);
  const rec = T.exp.rec;
  const gold = Math.max(2, Math.round((4 + 3 * reino.tier) * rec));
  const itens = [reino.consumiveis[Math.floor(Math.random() * reino.consumiveis.length)]];
  if (Math.random() < 0.35) itens.push(sortearEquipamento(reino, p));
  ganharOuro(p, gold);
  p.stats.baus++;
  for (const id of itens) darItem(p, id);
  T.bau.aberto = true;
  T.bau.recompensa = { gold, itens };
  T.fx.push({ alvo: 'heroi', v: 0, texto: '🧰', cura: true });
  logar(T, `🧰 Você abre o baú! +${gold} de ouro e ${itens.map(id => ITENS[id].nome).join(', ')}.`, 'cura');
  checarFim(T);
}

/* ---------- Fim da etapa e objetivos ---------- */
/** Confere se o objetivo foi cumprido. Se sim, os inimigos que sobraram recuam (sem dar recompensa). */
function checarFim(T) {
  if (T.fim || T.limpa) return;
  const resto = combatentes(T), estruturas = T.inim.filter(e => e.vivo && e.estrutura);
  let cumprido;
  if (!T.ultimaEtapa) cumprido = resto.length === 0;                        // sala limpa: a porta vai abrir
  else if (T.objetivo === 'matar_todos') cumprido = resto.length === 0;
  else if (T.objetivo === 'chefe') cumprido = !T.inim.some(e => e.chefe && e.vivo);
  else if (T.objetivo === 'destruir') cumprido = estruturas.length === 0;
  else cumprido = !!(T.bau && T.bau.aberto);                                // 'bau'
  if (!cumprido) return;
  for (const e of T.inim) if (e.vivo) { e.vivo = false; e.recuou = true; }
  T.objetivoCumprido = true;
  T.limpa = true;                 // a sala está limpa, mas o jogo continua: você ainda usa as cartas para andar até a saída
  if (!T.ultimaEtapa && T.porta) { T.porta.acessivel = true; T.g.cel[T.porta.r][T.porta.c] = '.'; }   // a porta só abre quando você chega nela
  logar(T, T.ultimaEtapa ? '✅ Objetivo cumprido! Pegue o que ainda quiser e volte à entrada 🚪 para concluir. O que ficar para trás se perde!' : '✅ Sala limpa! Pegue as moedas e o baú e ande até a porta 🚪. O que ficar para trás se perde!', 'info');
}

function verificarMortes(T) {
  for (const e of T.inim) {
    if (e.vivo && e.hp <= 0) {
      e.vivo = false; T.mortos.push(e);
      soltarMoeda(T, e);
      logar(T, `${e.estrutura ? '💥' : e.icone} ${e.nome} foi ${e.estrutura ? 'destruído' : 'derrotado'}!`, 'info');
    }
  }
  checarFim(T);
}

/* ---------- Movimento forçado: empurrar e puxar ---------- */
/** Move `alvo` (um inimigo ou 'heroi') à força, em linha reta. 'empurrar' afasta de `origem`, 'puxar' aproxima.
 *  Para antes de obstáculos e de outras unidades. Pisar numa armadilha dispara. Chefes e estruturas resistem. */
function forcarMovimento(T, p, alvo, origem, n, modo) {
  const ehHeroi = alvo === 'heroi';
  if (!ehHeroi && (alvo.chefe || alvo.estrutura) && n > 0) {
    if (alvo.chefe) logar(T, `${alvo.nome} é grande demais e não sai do lugar.`, 'info');
    return 0;
  }
  let movidos = 0;
  for (let i = 0; i < n; i++) {
    const ref = ehHeroi ? T.heroi : alvo;
    const atual = { c: ref.c, r: ref.r };
    let d = melhorDirecao(origem, atual);          // direção que afasta da origem
    if (modo === 'puxar') {
      if (dist(atual, origem) <= 1) break;          // já está colado
      d = (d + 3) % 6;                              // direção contrária = em direção à origem
    }
    const prox = somaCubo(atual.c, atual.r, CUBO_DIRS[d]);
    if (celula(T.g, prox.c, prox.r) !== '.' || ocupado(T, prox.c, prox.r)) break;
    if (ehHeroi) T.heroi = { c: prox.c, r: prox.r }; else { alvo.c = prox.c; alvo.r = prox.r; }
    movidos++;
    const arm = dispararArmadilha(T, p, ehHeroi ? 'heroi' : alvo, prox.c, prox.r);
    if (T.fim || (!ehHeroi && !alvo.vivo)) break;
    if (arm && arm.parou) break;
  }
  if (movidos) {
    const quem = ehHeroi ? 'Você é' : `${alvo.nome} é`;
    logar(T, `${modo === 'puxar' ? '🧲' : '💨'} ${quem} ${modo === 'puxar' ? 'puxado' : 'empurrado'} ${movidos} hexágono${movidos > 1 ? 's' : ''}.`, 'info');
  }
  return movidos;
}

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
    const res = dispararArmadilha(T, p, 'heroi', passo.c, passo.r);
    if (T.fim) return true;       // morreu na armadilha
    if (res && res.parou) break;  // paralisado: o movimento acaba aqui
  }
  if (T.limpa && T.porta && T.porta.acessivel && T.heroi.c === T.porta.c && T.heroi.r === T.porta.r) {      // chegou na porta: ela se abre
    T.porta.aberta = true; T.fim = 'porta'; return true;
  }
  if (T.limpa && T.ultimaEtapa && T.heroi.c === T.saida.c && T.heroi.r === T.saida.r) {                       // voltou à entrada: o cenário termina
    T.fim = 'vitoria'; logar(T, '🏆 Você deixa a arena. Cenário concluído!', 'info'); return true;
  }
  lootarAqui(T, p);               // parou aqui: pega as moedas que estiverem no chão
  return true;
}

/** Baralho de modificadores de quem ataca ('heroi' ou 'inim') neste cenário. */
function baralhoMod(T, quem) {
  const exp = T.exp;
  if (!exp.baralhos) exp.baralhos = { heroi: novoBaralhoMod(BARALHO_BASE), inim: novoBaralhoMod(baralhoInimigos(exp.difId)) };
  return exp.baralhos[quem];
}
/** Vira a carta do ataque (sozinha, sem o jogador fazer nada), registra para a tela mostrar e devolve o golpe final (0 = falhou). */
function sacarParaAtaque(T, quem, base, nome) {
  const carta = sacarMod(baralhoMod(T, quem));
  const golpe = aplicarMod(base, carta);
  T.modFx.push({ quem, carta, base, golpe, nome, embaralhou: carta.embaralhou });
  if (SORTE.ativa) {
    logar(T, `🎴 ${quem === 'heroi' ? 'Carta do seu ataque' : `Carta de ${nome}`}: ${carta.rotulo} (${carta.tipo === 'bloqueio' ? 'bloqueio!' : resumoMod(carta, base, golpe)})${carta.embaralhou ? ' · 🔀 baralho embaralhado' : ''}`, carta.tipo === 'bloqueio' ? (quem === 'heroi' ? 'aviso' : 'info') : carta.tipo === 'x2' ? 'forte' : 'info');
  }
  return golpe;
}

/** Um golpe do herói: dano fixo menos a defesa e o escudo do alvo (sempre causa pelo menos 1). */
function golpeT(T, alvo, ataque) {
  const dano = Math.max(1, ataque - alvo.def - (alvo.escudo || 0));
  alvo.hp = Math.max(0, alvo.hp - dano);
  T.fx.push({ alvo: alvo.uid, v: dano });
  return dano;
}

function podeAgir(T) {
  if (T.fase !== 'heroi' || T.fim) return false;
  if (T.acaoUsada) { logar(T, 'Você já usou a ação neste turno.', 'erro'); return false; }
  return true;
}

/** Ataca com a carta da rodada. `uid` = alvo escolhido (não precisa nas cartas "ao redor"). */
function tAtacar(T, p, uid) {
  if (!podeAgir(T)) return false;
  const c = cartaAtual(T);
  if (!c.atq) { logar(T, 'A carta desta rodada não ataca.', 'erro'); return false; }
  const possiveis = tAlvos(T, p);
  let alvos;
  if (c.alvo === 'ao-redor') {
    alvos = possiveis;
    if (!alvos.length) { logar(T, 'Nenhum inimigo ao seu lado.', 'erro'); return false; }
  } else {
    const principal = possiveis.find(e => e.uid === uid);
    if (!principal) { logar(T, 'Esse inimigo está fora de alcance.', 'erro'); return false; }
    alvos = c.alvo === 'vizinhos' ? vivos(T).filter(e => e === principal || dist(e, principal) === 1) : [principal];
  }
  const ataque = sacarParaAtaque(T, 'heroi', danoDoHeroi(T, p), 'você');    // a carta de modificador vira sozinha
  if (ataque === 0) {                                                       // bloqueio: o ataque inteiro se perde
    T.acaoUsada = true;
    logar(T, `🚫 ${c.nome} falhou! Você perdeu o ataque.`, 'aviso');
    return true;
  }
  let total = 0;
  for (const alvo of alvos) total += golpeT(T, alvo, ataque);
  logar(T, `⚔️ ${c.nome}: ${total} de dano${alvos.length > 1 ? ` em ${alvos.length} inimigos` : ` em ${alvos[0].nome}`}.`, 'dano');
  T.acaoUsada = true;
  if (c.dreno && total > 0) {
    const cura = Math.min(derivados(p).hpMax - p.hp, Math.max(1, Math.floor(total / 2)));
    if (cura > 0) { p.hp += cura; logar(T, `🩸 Você rouba ${cura} de vida.`, 'cura'); T.fx.push({ alvo: 'heroi', v: cura, cura: true }); }
  }
  // empurrar / puxar quem sobreviveu (do mais perto para o mais longe, para um não bloquear o outro)
  if (c.empurrar || c.puxar) {
    const sobreviventes = alvos.filter(e => e.hp > 0).sort((a, b) => dist(a, T.heroi) - dist(b, T.heroi));
    for (const alvo of sobreviventes) {
      if (!alvo.vivo || T.fim) continue;
      if (c.empurrar) forcarMovimento(T, p, alvo, T.heroi, c.empurrar, 'empurrar');
      if (c.puxar) forcarMovimento(T, p, alvo, T.heroi, c.puxar, 'puxar');
    }
  }
  verificarMortes(T);
  return true;
}



/** Usa o item do lugar `i` da mochila. NÃO gasta a sua jogada (dá para usar vários, antes ou depois de agir). */
function tUsarItem(T, p, i) {
  if (T.fim || (T.fase !== 'heroi' && T.fase !== 'escolha' && !T.livre)) return false;
  const ef = usarMochila(p, i, T);
  if (!ef) { logar(T, 'Isso não teria efeito agora.', 'erro'); return false; }
  logar(T, ef.msg, 'cura');
  T.fx.push({ alvo: 'heroi', v: 0, cura: true, texto: '✚' });
  if (ef.buff) {
    if (ef.buff.atq) T.bonusItem.atq += ef.buff.atq;
    if (ef.buff.mov) T.movRest += ef.buff.mov;
    if (ef.buff.escudo) T.escudoHeroi += ef.buff.escudo;
  }
  return true;
}



/** Fugir só é possível em cima da saída 🚪 (onde você começou). Não vale na arena do chefe. */
function tFugir(T) {
  if (T.limpa) return false;      // objetivo cumprido: o caminho é a porta/saída, não fugir
  if ((T.fase !== 'heroi' && T.fase !== 'escolha') || T.fim) return false;
  if (T.chefeId) { logar(T, 'Não há como fugir de um deus!', 'erro'); return false; }
  if (T.heroi.c !== T.saida.c || T.heroi.r !== T.saida.r) { logar(T, 'Chegue até a saída 🚪 para fugir.', 'erro'); return false; }
  logar(T, 'Você escapou pela saída!', 'info');
  T.fim = 'fugiu';
  return true;
}

/* ---------- Armadilhas e efeitos ---------- */
const temEfeito = (lista, tipo) => lista.some(x => x.tipo === tipo);
/** Movimento do turno: movimento da carta + bônus (botas, destreza); o gelo tira 1, mas nunca fica abaixo de 1 se a carta anda. */
function movEfetivo(movCarta, bonus, efeitos) {
  if (!(movCarta > 0)) return 0;
  return Math.max(1, movCarta + bonus - (temEfeito(efeitos, 'gelo') ? 1 : 0));
}

/** Quem pisa (`quem` = 'heroi' ou um inimigo) dispara a armadilha do hexágono. Ela some depois de usada. */
function dispararArmadilha(T, p, quem, c, r) {
  const k = chave(c, r);
  const arm = T.armadilhas.get(k);
  if (!arm) return null;
  T.armadilhas.delete(k);
  const def = ARMADILHAS[arm.tipo];
  const heroi = quem === 'heroi';
  const nome = heroi ? 'Você pisa' : `${quem.nome} pisa`;
  const fator = (!heroi && quem.chefe ? CHEFE_FATOR_ARM : 1) * T.exp.dif.armadilha;
  const fxAlvo = heroi ? 'heroi' : quem.uid;
  const efeitos = heroi ? T.efeitos : quem.efeitos;
  const dano = def.dano ? Math.max(1, Math.round(def.dano * fator)) : 0;   // pontos de vida
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
      let perdeu = 0;
      if (heroi && T.mao) for (let n = 0; n < (def.descarta || 0) && T.mao.length; n++) { T.descarte.push(T.mao.splice(Math.floor(Math.random() * T.mao.length), 1)[0]); perdeu++; }
      logar(T, `${def.icone} ${nome} na ${def.nome}! ${dano} de dano${perdeu ? ` e perde ${perdeu} carta da mão (vai para o descarte)` : ''}.`, 'aviso');
      break;
    }
  }
  if (heroi) { if (p.hp <= 0) { T.fim = 'derrota'; logar(T, 'Sua visão escurece...', 'erro'); } }
  else verificarMortes(T);
  return { parou };
}

/** No fim de cada rodada: veneno causa dano e os efeitos perdem uma rodada. */
function passarEfeitos(T, p) {
  const tick = (efeitos, aplicar) => {
    for (const ef of efeitos) {
      if (ef.tipo === 'veneno') aplicar(ef.dano);
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

/* ---------- Turno dos inimigos ---------- */
/* ---------- Cartas de iniciativa e ordem da rodada ---------- */
/** A ordem da rodada: inimigos (pela carta deles) e o herói (pela carta dele), do menor número para o maior.
 *  Em empate o herói age primeiro. Antes de escolher a carta, `ini` do herói é null. */
function ordemDaRodada(T, iniPrevia = null) {   // iniPrevia: mostra onde o herói ficaria com uma carta ainda não jogada
  const itens = combatentes(T).filter(e => !e.parado && T.cartas[e.tipo]).map(e => ({ tipo: 'inimigo', uid: e.uid, ini: T.cartas[e.tipo].ini, dist: dist(e, T.heroi), e }));
  itens.sort((a, b) => (a.ini - b.ini) || (a.dist - b.dist) || a.uid - b.uid);
  const iniH = T.cartaHeroi ? T.cartaHeroi.ini : iniPrevia;
  if (iniH !== null && iniH !== undefined) {                   // o herói entra antes do primeiro inimigo com número igual ou MAIOR
    const pos = itens.findIndex(x => x.ini >= iniH);
    itens.splice(pos < 0 ? itens.length : pos, 0, { tipo: 'heroi', ini: iniH });
  }
  return itens;
}

/** O herói escolhe a carta da rodada (índice/ id da carta na mão, ou 'descanso'). Monta a fila e começa a rodada. */
function tEscolherCarta(T, p, id, perder) {
  if (T.fase !== 'escolha' || T.fim || T.livre) return false;
  let carta;
  if (id === 'descanso') {          // descanso LONGO: iniciativa 99, cura 3 e você escolhe qual carta usada se perde
    if (T.descarte.length < 2) { logar(T, 'Para descansar você precisa de pelo menos 2 cartas usadas.', 'erro'); return false; }
    if (!T.descarte.some(c => c.id === perder)) { logar(T, 'Escolha qual carta usada vai se perder.', 'erro'); return false; }
    carta = { ...CARTA_DESCANSO, id: 'descanso', perder };
  }
  else {
    const i = T.mao.findIndex(c => c.id === id);
    if (i < 0) { logar(T, 'Essa carta não está na sua mão.', 'erro'); return false; }
    carta = T.mao.splice(i, 1)[0];
    T.descarte.push(carta);
  }
  T.cartaHeroi = carta;
  T.escudoHeroi = (carta.escudo || 0) + (carta.descanso ? 0 : derivados(p).esc);
  logar(T, carta.descanso ? '💤 Você decide descansar (iniciativa 99).' : `🃏 Você joga "${carta.nome}" (iniciativa ${carta.ini}).`, 'info');
  revelarCartas(T, true);         // agora os monstros viram as cartas deles (você escolheu primeiro, às cegas)
  T.fila = ordemDaRodada(T).map(x => (x.tipo === 'heroi' ? 'heroi' : x.uid));
  continuarRodada(T, p);
  return true;
}

/** Segue a fila: se o próximo for o herói, começa o turno dele; senão, os inimigos agem. */
function continuarRodada(T, p) {
  if (T.fila[0] === 'heroi') { T.fila.shift(); iniciarTurnoHeroi(T, p); }
  else T.fase = 'inimigos';
}

/** Começa o turno do herói: aplica o que a carta manda (andar, curar, descansar). */
function iniciarTurnoHeroi(T, p) {
  const d = derivados(p), c = T.cartaHeroi || {};
  T.fase = 'heroi';
  T.acaoUsada = !c.atq && !c.descanso ? true : false;      // carta sem ataque: não há ação para usar
  T.bonusItem = { atq: 0 };
  T.movRest = movEfetivo(c.mov, d.mov, T.efeitos);
  if (c.descanso) {
    const hp0 = p.hp;
    p.hp = Math.min(d.hpMax, p.hp + DESCANSO_CURA);
    const i = T.descarte.findIndex(x => x.id === c.perder);
    const perdida = i >= 0 ? T.descarte.splice(i, 1)[0] : null;
    if (perdida) T.perdidas.push(perdida);                // a carta escolhida se perde (até o fim do cenário)
    T.mao.push(...T.descarte.splice(0));                  // as outras cartas usadas voltam para a mão
    T.movRest = 0; T.acaoUsada = true;
    logar(T, `💤 Você descansa: +${p.hp - hp0} vida. ${perdida ? `A carta "${perdida.nome}" se perdeu;` : ''} as outras cartas voltam para a mão.`, 'cura');
    T.fx.push({ alvo: 'heroi', v: p.hp - hp0, cura: true });
    return;
  }
  if (c.cura) {
    const v = Math.min(d.hpMax - p.hp, c.cura + d.cura);
    if (v > 0) { p.hp += v; logar(T, `✚ A carta cura ${v} de vida.`, 'cura'); T.fx.push({ alvo: 'heroi', v, cura: true }); }
  }
}

/** Descanso RÁPIDO (antes de escolher a carta): uma carta usada, sorteada, se perde; as outras voltam para a mão e você joga na mesma rodada. */
function tDescansoRapido(T, p) {
  if (T.fase !== 'escolha' || T.fim || T.livre) return null;
  if (T.rapidoUsado) { logar(T, 'Você já fez um descanso rápido nesta rodada.', 'erro'); return null; }
  if (T.descarte.length < 2) { logar(T, 'Para descansar você precisa de pelo menos 2 cartas usadas.', 'erro'); return null; }
  const perdida = T.descarte.splice(Math.floor(Math.random() * T.descarte.length), 1)[0];
  T.perdidas.push(perdida);
  T.mao.push(...T.descarte.splice(0));
  T.rapidoUsado = true;
  logar(T, `⚡ Descanso rápido: a carta "${perdida.nome}" se perdeu. As outras voltaram para a sua mão.`, 'aviso');
  return perdida;
}

/** A mão acabou? Então o herói só pode descansar. */
const maoVazia = T => !T.mao || T.mao.length === 0;

/* ---------- Turno dos inimigos ---------- */
/** Encerra o turno do herói. Se ele estiver parado em cima do baú, abre. Depois os inimigos que faltam agem, na ordem da iniciativa. */
function tEncerrarTurno(T, p) {
  if (T.fase !== 'heroi' || T.fim || T.livre) return false;
  if (T.bau && !T.bau.aberto && T.bau.c === T.heroi.c && T.bau.r === T.heroi.r) {
    abrirBau(T, p);                // ficou 1 turno em cima do baú
    if (T.fim) return true;
  }
  T.fase = 'inimigos';
  T.heroiJogou = true;
  T.fila = T.fila.filter(x => x === 'heroi' || (T.inim.find(e => e.uid === x) || {}).vivo);   // quem morreu no meio sai da fila
  return true;
}

function podeAtacarHeroi(T, e, pos, alc) {
  return dist(pos, T.heroi) <= alc && (alc <= 1 || linhaDeVisao(T.g, pos, T.heroi));
}

/** O inimigo anda até um lugar de onde possa atacar (usando `mov` e `alc` da carta). Devolve {parou, morreu}. */
function moverInimigo(T, p, e, mov, alc) {
  const ocupadoPorOutro = (c, r) => T.inim.some(x => x.vivo && x !== e && x.c === c && x.r === r);
  const ehHeroi = (c, r) => c === T.heroi.c && r === T.heroi.r;
  // inimigos atravessam uns aos outros, mas ninguém atravessa o herói; caminhos sem armadilha são preferidos
  const nos = bfs(T.g, e, 80, ehHeroi, (c, r) => temArmadilha(T, c, r));
  const lista = [...nos.values()]; // ordem de inserção = do mais perto para o mais longe
  let meta = null;
  for (const evitar of [true, false]) { // 1º: lugares sem armadilha; se não houver, aceita pisar numa
    for (const n of lista) {
      if (n.d === 0 || ocupadoPorOutro(n.c, n.r) || (evitar && temArmadilha(T, n.c, n.r))) continue;
      if (podeAtacarHeroi(T, e, n, alc)) { meta = n; break; }
    }
    if (meta) break;
  }
  let cam = [];
  if (meta) {
    cam = caminhoAte(meta).slice(0, mov);
  } else { // sem lugar livre para atacar: chega o mais perto possível
    let melhor = null;
    for (const n of lista) {
      if (n.d === 0 || n.d > mov || ocupadoPorOutro(n.c, n.r)) continue;
      const s = dist(n, T.heroi) + (temArmadilha(T, n.c, n.r) ? 0.5 : 0);
      if (!melhor || s < melhor.s || (s === melhor.s && n.d < melhor.n.d)) melhor = { n, s };
    }
    if (melhor) cam = caminhoAte(melhor.n).slice(0, mov);
  }
  // anda passo a passo (pode pisar em armadilhas pelo caminho)
  const res = { parou: false, morreu: false };
  let ultimoLivre = { c: e.c, r: e.r };
  for (const passo of cam) {
    e.c = passo.c; e.r = passo.r;
    if (!ocupadoPorOutro(e.c, e.r)) ultimoLivre = { c: e.c, r: e.r };
    const a = dispararArmadilha(T, p, e, e.c, e.r);
    if (!e.vivo) { res.morreu = true; return res; }
    if (a && a.parou) { res.parou = true; break; }
  }
  // não pode terminar em cima de outro inimigo
  if (ocupadoPorOutro(e.c, e.r)) { e.c = ultimoLivre.c; e.r = ultimoLivre.r; }
  return res;
}

function atacarHeroi(T, p, d, e, carta) {
  const mod = carta.atq + e.bonusAtq;
  const golpe = sacarParaAtaque(T, 'inim', Math.max(1, e.atk + mod), e.nome.split(',')[0]);   // carta de modificador do monstro
  if (golpe === 0) {
    logar(T, `💨 ${e.nome} errou o ataque!`, 'info');
    T.fx.push({ alvo: 'heroi', v: 0, texto: '✖ errou', esquiva: true, de: e.uid });
    return;
  }
  const dano = Math.max(0, golpe - T.escudoHeroi);              // o escudo (carta + equipamento) tira pontos de cada golpe
  p.hp = Math.max(0, p.hp - dano);
  const forte = mod >= 2 || golpe >= 2 * (e.atk + mod);
  if (dano === 0) {
    logar(T, `🛡️ Seu escudo bloqueia o ataque de ${e.nome}!`, 'info');
    T.fx.push({ alvo: 'heroi', v: 0, texto: '🛡️ 0', esquiva: false });
    return;
  }
  T.fx.push({ alvo: 'heroi', v: dano, forte, de: e.uid });
  logar(T, forte ? `💢 ${e.nome} usa ${carta.nome}: ${dano} de dano!` : `${e.nome} ataca (${carta.nome}): ${dano} de dano.`, forte ? 'forte' : 'inimigo');
  if (p.hp <= 0) return;
  if (carta.empurrarHeroi) forcarMovimento(T, p, 'heroi', e, carta.empurrarHeroi, 'empurrar');
  if (!T.fim && carta.puxarHeroi) forcarMovimento(T, p, 'heroi', e, carta.puxarHeroi, 'puxar');
}

/** Efeitos de apoio da carta: curar, fortalecer e escudo (em si mesmo e nos aliados ao lado). */
function apoioDaCarta(T, e, carta) {
  const grupo = [e, ...combatentes(T).filter(x => x !== e && dist(x, e) === 1)];
  if (carta.curar) {
    for (const a of grupo) {
      const cura = Math.min(a.hpMax - a.hp, carta.curar);   // pontos de vida
      if (cura > 0) { a.hp += cura; T.fx.push({ alvo: a.uid, v: cura, cura: true }); }
    }
    logar(T, `✚ ${e.nome} usa ${carta.nome}: cura ${grupo.length > 1 ? 'o grupo' : 'a si mesmo'}.`, 'inimigo');
  }
  if (carta.fortalecer) {
    for (const a of grupo) a.bonusAtq += carta.fortalecer;
    logar(T, `💪 ${e.nome} usa ${carta.nome}: aliados ao lado ficam mais fortes (+${carta.fortalecer} de ataque).`, 'inimigo');
  }
  if (carta.escudo) {
    for (const a of grupo) a.escudo += carta.escudo;
    logar(T, `🛡️ ${e.nome} usa ${carta.nome}: escudo ${carta.escudo} no grupo.`, 'inimigo');
  }
}

/** Faz um inimigo jogar a carta da rodada: apoio, depois andar, depois atacar. */
function agirInimigo(T, p, d, e) {
  const carta = T.cartas[e.tipo];
  apoioDaCarta(T, e, carta);
  const alc = Math.max(1, e.alc + (carta.alc || 0));
  let paralisado = false;
  if (carta.mov !== undefined) {
    const mov = Math.max(1, e.mov + carta.mov - (temEfeito(e.efeitos, 'gelo') ? 1 : 0));
    if (!podeAtacarHeroi(T, e, e, alc) || carta.atq === undefined) paralisado = moverInimigo(T, p, e, mov, alc).parou;
  }
  if (e.vivo && !paralisado && !T.fim && carta.atq !== undefined && podeAtacarHeroi(T, e, e, alc)) atacarHeroi(T, p, d, e, carta);
}

function finalizarRodada(T, p) {
  passarEfeitos(T, p);          // veneno e duração dos efeitos
  if (T.fim) return;            // morreu de veneno, ou o veneno cumpriu o objetivo
  T.rodada++;
  T.fase = 'escolha';           // nova rodada: primeiro você escolhe a sua carta de iniciativa
  T.cartaHeroi = null; T.escudoHeroi = 0; T.fila = []; T.heroiJogou = false; T.bonusItem = { atq: 0 };
  T.movRest = 0; T.acaoUsada = false;
  T.cartas = {}; T.rapidoUsado = false;     // as cartas dos monstros ficam ocultas até você escolher a sua
  for (const e of T.inim) { e.bonusAtq = 0; e.escudo = 0; }   // fortalecer e escudo duram só a rodada
  conferirExaustao(T);
}
/** Sem cartas na mão e com menos de 2 no descarte: não dá mais para jogar nem descansar. O herói desmaia. */
function conferirExaustao(T) {
  if (T.fim || T.fase !== 'escolha') return;
  if (T.mao.length === 0 && T.descarte.length < 2) {
    T.fim = 'derrota'; logar(T, '😵 Você ficou sem cartas e desmaia de exaustão!', 'erro');
  }
}

/** Faz UM inimigo agir. Quando o último termina, começa a próxima rodada. */
function tProximoInimigo(T, p) {
  if (T.fase !== 'inimigos' || T.fim) return null;
  T.fx = [];
  const d = derivados(p);
  let ator = null;
  while (T.fila.length && !ator) {
    if (T.fila[0] === 'heroi') { T.fila.shift(); iniciarTurnoHeroi(T, p); return null; }   // chegou a vez do herói
    const uid = T.fila.shift();
    const e = T.inim.find(x => x.uid === uid);
    if (!e || !e.vivo) continue;
    ator = e;
    agirInimigo(T, p, d, e);
    if (p.hp <= 0) { T.fim = 'derrota'; logar(T, 'Sua visão escurece...', 'erro'); }
    if (!T.fim && T.fila[0] === 'heroi') { T.fila.shift(); iniciarTurnoHeroi(T, p); }   // o próximo da fila é o herói: começa a vez dele já
  }
  if (!T.fim && T.fase === 'inimigos' && !T.fila.length) finalizarRodada(T, p);
  return ator;
}

/* ---------- Portas, etapas e sala livre ---------- */
function tModoLivre(T) {
  T.fim = null; T.livre = true; T.fase = 'heroi';
  T.movRest = 99; T.acaoUsada = false; T.bonusItem = { atq: 0 }; T.escudoHeroi = 0;
  for (const e of T.inim) if (e.vivo) e.vivo = false;
}

/** Sala limpa: a porta se abre e o herói anda livremente até ela. */
function tAbrirPorta(T) {
  if (!T.porta || T.porta.aberta) return false;
  T.porta.aberta = true;
  T.g.cel[T.porta.r][T.porta.c] = '.';
  tModoLivre(T);
  logar(T, '🚪 A porta se abriu! Vá até ela. Cuidado com as armadilhas no caminho.', 'info');
  return true;
}

/** Objetivo cumprido na última etapa: o herói pode saquear as moedas e o baú que sobraram antes de concluir. */
function tSaquear(T) {
  if (!T.ultimaEtapa) return false;
  tModoLivre(T);
  logar(T, '🪙 Objetivo cumprido! Saqueie o que sobrou e conclua o cenário quando quiser.', 'info');
  return true;
}

function tProximaEtapa(T, p) {
  const exp = T.exp;
  exp.idx++;
  const d = derivados(p);
  const hp0 = p.hp;
  p.hp = Math.min(d.hpMax, p.hp + Math.max(1, Math.round(d.hpMax * exp.dif.porta)));
  const N = criarTatica(exp, p);
  N.recuperou = { hp: p.hp - hp0 };
  if (N.recuperou.hp) logar(N, `Você recupera o fôlego: +${N.recuperou.hp} vida.`, 'cura');
  return N;
}

/* ---------- Recompensas ---------- */
/** Fim de uma etapa vencida: XP de quem caiu, itens que dropam e, na arena, relíquia e fragmento do chefe.
 *  (O ouro vem das MOEDAS no chão, que o herói precisa saquear.) */
function aplicarVitoriaT(T, p) {
  let xp = 0;
  const itens = [];
  for (const e of T.mortos) {
    xp += e.xp;
    for (const dr of e.drops) if (Math.random() < dr.chance) itens.push(dr.id);
  }
  let primeira = false;
  if (T.chefeId && T.mortos.some(e => e.chefe) && !p.derrotados[T.chefeId]) {
    primeira = true;
    p.derrotados[T.chefeId] = true;
    const b = INIMIGOS[T.chefeId];
    if (b.reliquia) itens.push(b.reliquia);
    if (b.fragmento) p.fragmentos.push(b.fragmento);
  }
  for (const id of itens) darItem(p, id);
  const abates = T.mortos.filter(e => !e.estrutura).length;
  p.kills += abates; p.stats.abates += abates;
  if (primeira) p.stats.chefes++;
  const subidas = ganharXp(p, xp);
  const marcos = verificarMarcos(p);
  const moedasNoChao = [...T.moedas.values()].reduce((a, m) => a + m.valor, 0);
  return { xp, gold: 0, itens, subidas, primeira, moedasNoChao, marcos, bauFechado: !!(T.bau && !T.bau.aberto) };
}

/** Conclusão do cenário: marca como feito e dá uma recompensa aleatória (ouro, XP ou um item). */
function concluirCenario(T, p) {
  const exp = T.exp, c = exp.cenario;
  const reino = REINOS.find(r => r.id === c.reino);
  const primeira = !p.cenarios[c.id];
  p.cenarios[c.id] = true;
  if (primeira) p.stats.cenarios++;
  // as moedas que o herói juntou viram ouro agora (2 por moeda até o cenário 10, 3 depois)
  const moedas = { n: exp.moedasColetadas, valor: valorDaMoeda(c.id) };
  moedas.ouro = moedas.n * moedas.valor;
  ganharOuro(p, moedas.ouro); exp.moedasColetadas = 0;
  const sorte = Math.random();
  let r;
  if (sorte < 0.4) {
    const gold = Math.max(3, Math.round((8 + 4 * reino.tier) * exp.rec));
    ganharOuro(p, gold); r = { tipo: 'gold', gold };
  } else if (sorte < 0.75) {
    const xp = Math.max(1, Math.round(xpParaProximo(p.nivel) * 0.4 * exp.rec * BALANCO.xp));
    r = { tipo: 'xp', xp, subidas: ganharXp(p, xp) };
  } else {
    const id = sortearEquipamento(reino, p);
    darItem(p, id); r = { tipo: 'item', id };
  }
  r.primeira = primeira; r.moedas = moedas;
  r.marcos = verificarMarcos(p);
  return r;
}
