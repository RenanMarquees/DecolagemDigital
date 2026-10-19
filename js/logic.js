'use strict';
/* ============================================================
   REGRAS DO JOGO — sem nada de tela aqui, só matemática e estado.
   (Por isso dá para testar tudo no Node, veja tests/sim.js)
   ============================================================ */

function xpParaProximo(nivel) { return Math.round(25 * Math.pow(nivel, 1.3)); }

/* ---------- Personagem ---------- */
function novoJogador(nome, classe) {
  const c = CLASSES[classe];
  const p = {
    nome, classe, nivel: 1, xp: 0, pontos: 0,
    attr: { ...c.attr }, gold: 30,
    inv: { pocao: 3 },
    equip: { arma: `${classe}_0`, armadura: 'armadura_0', amuleto: null },
    hp: 0, mp: 0,
    derrotados: {}, fragmentos: [], vistos: {}, kills: 0, finalizado: false,
    cenarios: {},                       // cenários concluídos: { 1: true, 2: true... }
    dificuldade: DIFICULDADE_PADRAO,
    tutorial: { off: false, feitos: {} },   // passos do tutorial já vistos (js/tutorial.js)
  };
  const d = derivados(p);
  p.hp = d.hpMax; p.mp = d.mpMax;
  return p;
}

function bonusEquip(p) {
  const b = { FOR: 0, DES: 0, INT: 0, VIT: 0, atk: 0, def: 0 };
  for (const slot of Object.keys(p.equip)) {
    const it = ITENS[p.equip[slot]];
    if (!it) continue;
    b.atk += it.atk || 0;
    b.def += it.def || 0;
    for (const a of ATRIBUTOS) b[a] += (it.bonus && it.bonus[a]) || 0;
  }
  return b;
}

/** Atributos finais (base + equipamento) e valores calculados a partir deles. */
function derivados(p) {
  const b = bonusEquip(p);
  const A = {};
  for (const a of ATRIBUTOS) A[a] = p.attr[a] + b[a];
  return {
    ...A,
    atk: b.atk,
    def: Math.round(A.VIT * 0.6 + b.def),
    hpMax: Math.round((40 + A.VIT * 6 + (p.nivel - 1) * 8) * CLASSES[p.classe].hpMult),
    mpMax: 20 + A.INT * 3 + p.nivel * 3,
    crit: Math.min(0.6, 0.05 + A.DES * 0.008),
    esquiva: Math.min(0.35, A.DES * 0.005),
    danoMult: CLASSES[p.classe].danoMult,
    danoRecebido: CLASSES[p.classe].danoRecebido,
    mov: CLASSES[p.classe].mov + Math.floor(A.DES / 15),
    regenMp: CLASSES[p.classe].regenMp + Math.floor(A.INT / 10),
  };
}

function ajustarVidaMana(p) {
  const d = derivados(p);
  p.hp = Math.min(p.hp, d.hpMax);
  p.mp = Math.min(p.mp, d.mpMax);
}

function ganharXp(p, xp) {
  const subidas = [];
  if (p.nivel >= NIVEL_MAX) return subidas;
  p.xp += xp;
  while (p.nivel < NIVEL_MAX && p.xp >= xpParaProximo(p.nivel)) {
    p.xp -= xpParaProximo(p.nivel);
    p.nivel++;
    p.pontos += PONTOS_POR_NIVEL;
    const novas = CLASSES[p.classe].habilidades.filter(id => HABILIDADES[id].nivel === p.nivel);
    subidas.push({ nivel: p.nivel, novas });
    const d = derivados(p);
    p.hp = d.hpMax; p.mp = d.mpMax; // subir de nível cura tudo
  }
  if (p.nivel >= NIVEL_MAX) p.xp = 0;
  return subidas;
}

function distribuirPonto(p, attr) {
  if (p.pontos <= 0) return false;
  p.attr[attr]++;
  p.pontos--;
  return true;
}

/* ---------- Inventário e equipamentos ---------- */
function qtd(p, id) { return p.inv[id] || 0; }
function darItem(p, id, n = 1) { p.inv[id] = qtd(p, id) + n; }
function tirarItem(p, id, n = 1) {
  if (qtd(p, id) < n) return false;
  p.inv[id] -= n;
  if (p.inv[id] <= 0) delete p.inv[id];
  return true;
}

function podeEquipar(p, id) {
  const it = ITENS[id];
  if (!it || !['arma', 'armadura', 'amuleto'].includes(it.tipo)) return { ok: false, msg: 'Não é equipável.' };
  if (it.classe && it.classe !== p.classe) return { ok: false, msg: `Só para ${CLASSES[it.classe].nome}.` };
  return { ok: true };
}

function equipar(p, id) {
  const r = podeEquipar(p, id);
  if (!r.ok || !tirarItem(p, id)) return r.ok ? { ok: false, msg: 'Você não tem este item.' } : r;
  const slot = ITENS[id].tipo;
  if (p.equip[slot]) darItem(p, p.equip[slot]);
  p.equip[slot] = id;
  ajustarVidaMana(p);
  return { ok: true };
}

function desequipar(p, slot) {
  if (!p.equip[slot]) return false;
  darItem(p, p.equip[slot]);
  p.equip[slot] = null;
  ajustarVidaMana(p);
  return true;
}

/** Usa um consumível. Retorna mensagem de efeito, ou null se não fez nada. */
function usarConsumivel(p, id) {
  const it = ITENS[id];
  if (!it || it.tipo !== 'consumivel' || qtd(p, id) < 1) return null;
  const d = derivados(p);
  const ganhoHp = Math.min(d.hpMax - p.hp, Math.round((it.hp || 0) + (it.hpPct || 0) * d.hpMax));
  const ganhoMp = Math.min(d.mpMax - p.mp, Math.round((it.mp || 0) + (it.mpPct || 0) * d.mpMax));
  if (ganhoHp <= 0 && ganhoMp <= 0) return null;
  tirarItem(p, id);
  p.hp += ganhoHp; p.mp += ganhoMp;
  const partes = [];
  if (ganhoHp > 0) partes.push(`+${ganhoHp} vida`);
  if (ganhoMp > 0) partes.push(`+${ganhoMp} mana`);
  return `${it.icone} ${it.nome}: ${partes.join(', ')}`;
}

/* ---------- Loja ---------- */
function estoqueLoja(p, reino) {
  const t = Math.min(reino.tier, 4);   // o Abismo do Caos (nível 5) vende o melhor equipamento comum (nível 4)
  const ids = [...reino.consumiveis, `${p.classe}_${t}`, `armadura_${t}`];
  for (const a of ATRIBUTOS) ids.push(`amuleto_${a}_${t}`);
  return ids.filter(id => ITENS[id]);
}
function precoVenda(id) { return Math.max(1, Math.floor(ITENS[id].preco * 0.4)); }

function comprar(p, id) {
  const it = ITENS[id];
  if (p.gold < it.preco) return false;
  p.gold -= it.preco;
  darItem(p, id);
  return true;
}
function vender(p, id) {
  if (!tirarItem(p, id)) return false;
  p.gold += precoVenda(id);
  return true;
}

/* ---------- Progresso ---------- */
/** Um cenário abre quando o anterior foi concluído (o primeiro já nasce aberto). */
function cenarioDesbloqueado(p, c) { return c.id === 1 || !!p.cenarios[c.id - 1]; }
/** Um reino abre quando o último cenário do reino anterior foi concluído. */
function reinoDesbloqueado(p, i) {
  if (i === 0) return true;
  const anterior = cenariosDoReino(REINOS[i - 1].id);
  return !!p.cenarios[anterior[anterior.length - 1].id];
}
/** Saves antigos não tinham cenários nem dificuldade: completa o que faltar (e conta os chefes já vencidos). */
function migrarSave(p) {
  p.cenarios = p.cenarios || {};
  p.dificuldade = DIFICULDADES[p.dificuldade] ? p.dificuldade : DIFICULDADE_PADRAO;
  if (!p.tutorial) p.tutorial = { off: !!p.cenarios[1], feitos: {} };   // quem já passou do cenário 1 não precisa do tutorial
  REINOS.forEach((r, i) => {
    if (p.derrotados && p.derrotados[r.chefe]) for (let k = 0; k <= i; k++) for (const c of cenariosDoReino(REINOS[k].id)) p.cenarios[c.id] = true;
  });
  return p;
}

function descansar(p, reino) {
  if (p.gold < reino.descanso) return false;
  p.gold -= reino.descanso;
  const d = derivados(p);
  p.hp = d.hpMax; p.mp = d.mpMax;
  return true;
}

function penalidadeDerrota(p) {
  p.gold = Math.floor(p.gold * 0.8);
  const d = derivados(p);
  p.hp = Math.ceil(d.hpMax / 2);
  p.mp = Math.ceil(d.mpMax / 2);
}

/* ---------- Sorteio e fórmulas usadas na batalha (o motor está em tatica.js) ---------- */
function rand(min, max) { return min + Math.random() * (max - min); }
function reducaoDefesa(def) { return 50 / (50 + def); }
