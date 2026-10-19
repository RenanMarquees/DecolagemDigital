'use strict';
/* ============================================================
   REGRAS DO JOGO — sem nada de tela aqui, só matemática e estado.
   (Por isso dá para testar tudo no Node, veja tests/sim.js)
   ============================================================ */

/** XP para subir de nível: bem pequeno, igual aos números do resto do jogo. */
function xpParaProximo(nivel) { return Math.round(6 + 3 * nivel); }

/** Quantos itens cabem na mochila: começa com 2 e cresce com o nível, até 5. */
function tamanhoMochila(nivel) { return nivel >= 15 ? 5 : nivel >= 10 ? 4 : nivel >= 5 ? 3 : 2; }

/** Equipamento inicial de cada classe: arma na mão, túnica no peito e duas poções na mochila. */
function equipInicial(classe) {
  return { cabeca: null, peito: 'peito_0', pes: null, maos: [`${classe}_0`, null], mochila: ['pocao', 'pocao'] };
}

/* ---------- Personagem ---------- */
function novoJogador(nome, classe) {
  const c = CLASSES[classe];
  const p = {
    nome, classe, nivel: 1, xp: 0, pontos: 0,
    attr: { ...c.attr }, gold: 10,
    inv: {},                            // itens guardados (fora do corpo e da mochila)
    equip: equipInicial(classe),        // cabeça, peito, pés, 2 mãos e mochila
    hp: 0,
    derrotados: {}, fragmentos: [], vistos: {}, kills: 0, finalizado: false,
    cenarios: {},                       // cenários concluídos: { 1: true, 2: true... }
    dificuldade: DIFICULDADE_PADRAO,
    tutorial: { off: false, feitos: {} },   // passos do tutorial já vistos (js/tutorial.js)
  };
  p.hp = derivados(p).hpMax;
  return p;
}

/** Itens que dão bônus (tudo menos a mochila): cabeça, peito, pés e as duas mãos. */
function itensVestidos(p) {
  const e = p.equip, ids = [e.cabeca, e.peito, e.pes, ...(e.maos || [])];
  return ids.filter(Boolean).map(id => ITENS[id]).filter(Boolean);
}

function bonusEquip(p) {
  const b = { hp: 0, atq: 0, esc: 0, mov: 0, alc: 0, cura: 0 };
  for (const it of itensVestidos(p)) for (const k of Object.keys(b)) b[k] += it[k] || 0;
  return b;
}

/** Valores finais do herói (atributos + equipamento). Tudo em números pequenos:
 *  vida (máx. 30), dano extra, movimento extra, cura extra, escudo e alcance extra. */
function derivados(p) {
  const b = bonusEquip(p), A = p.attr, c = CLASSES[p.classe];
  return {
    ...A,
    hpMax: Math.min(VIDA_MAX_JOGO, c.hpBase + Math.round(p.nivel * c.hpNivel) + Math.floor(A.VIT / BONUS_ATRIBUTO.vida) + b.hp),
    dano: Math.floor(A[c.basico] / BONUS_ATRIBUTO.dano) + b.atq,     // somado ao dano da carta
    mov: Math.floor(A.DES / BONUS_ATRIBUTO.mov) + b.mov,             // somado ao movimento da carta
    cura: Math.floor(A.INT / BONUS_ATRIBUTO.cura) + b.cura,          // somada à cura da carta
    esc: b.esc,                                                      // reduz cada golpe recebido
    alc: b.alc,                                                      // somado ao alcance da carta (só ataques à distância)
  };
}

function ajustarVida(p) { p.hp = Math.min(p.hp, derivados(p).hpMax); }

function ganharXp(p, xp) {
  const subidas = [];
  if (p.nivel >= NIVEL_MAX) return subidas;
  p.xp += xp;
  while (p.nivel < NIVEL_MAX && p.xp >= xpParaProximo(p.nivel)) {
    p.xp -= xpParaProximo(p.nivel);
    p.nivel++;
    p.pontos += PONTOS_POR_NIVEL;
    subidas.push({ nivel: p.nivel, mochila: tamanhoMochila(p.nivel), ganhouMochila: tamanhoMochila(p.nivel) > tamanhoMochila(p.nivel - 1) });
    p.hp = derivados(p).hpMax;       // subir de nível cura tudo
  }
  if (p.nivel >= NIVEL_MAX) p.xp = 0;
  return subidas;
}

function distribuirPonto(p, attr) {
  if (p.pontos <= 0) return false;
  p.attr[attr]++;
  p.pontos--;
  ajustarVida(p);
  return true;
}

/* ---------- Inventário, equipamentos e mochila ---------- */
function qtd(p, id) { return p.inv[id] || 0; }
/** Ganha um item. Consumíveis vão direto para a mochila se houver lugar; o resto fica guardado. */
function darItem(p, id, n = 1) {
  for (let i = 0; i < n; i++) {
    if (ITENS[id].tipo === 'mochila' && p.equip.mochila.length < tamanhoMochila(p.nivel)) p.equip.mochila.push(id);
    else p.inv[id] = qtd(p, id) + 1;
  }
}
function tirarItem(p, id, n = 1) {
  if (qtd(p, id) < n) return false;
  p.inv[id] -= n;
  if (p.inv[id] <= 0) delete p.inv[id];
  return true;
}

const SLOTS_VESTIVEIS = ['cabeca', 'peito', 'pes', 'maos'];
function podeEquipar(p, id) {
  const it = ITENS[id];
  if (!it || !SLOTS_VESTIVEIS.includes(it.tipo)) return { ok: false, msg: it && it.tipo === 'mochila' ? 'Itens de mochila vão para a mochila.' : 'Não é equipável.' };
  if (it.classe && it.classe !== p.classe) return { ok: false, msg: `Só para ${CLASSES[it.classe].nome}.` };
  return { ok: true };
}

/** Equipa um item guardado. Nas mãos usa o primeiro lugar vazio (ou troca a mão 1, ou a mão `lugar` escolhida). */
function equipar(p, id, lugar) {
  const r = podeEquipar(p, id);
  if (!r.ok) return r;
  if (qtd(p, id) < 1) return { ok: false, msg: 'Você não tem este item.' };
  const slot = ITENS[id].tipo;
  tirarItem(p, id);
  if (slot === 'maos') {
    const i = lugar !== undefined ? lugar : (p.equip.maos[0] ? (p.equip.maos[1] ? 0 : 1) : 0);
    if (p.equip.maos[i]) darItem(p, p.equip.maos[i]);
    p.equip.maos[i] = id;
  } else {
    if (p.equip[slot]) darItem(p, p.equip[slot]);
    p.equip[slot] = id;
  }
  ajustarVida(p);
  return { ok: true };
}

function desequipar(p, slot, lugar = 0) {
  if (slot === 'maos') {
    if (!p.equip.maos[lugar]) return false;
    const id = p.equip.maos[lugar]; p.equip.maos[lugar] = null; p.inv[id] = qtd(p, id) + 1;
  } else {
    if (!p.equip[slot]) return false;
    const id = p.equip[slot]; p.equip[slot] = null; p.inv[id] = qtd(p, id) + 1;
  }
  ajustarVida(p);
  return true;
}

/** Põe um consumível guardado na mochila (se houver lugar) ou devolve para a bolsa de itens. */
function levarNaMochila(p, id) {
  if (!ITENS[id] || ITENS[id].tipo !== 'mochila' || qtd(p, id) < 1) return { ok: false, msg: 'Não dá para levar isso.' };
  if (p.equip.mochila.length >= tamanhoMochila(p.nivel)) return { ok: false, msg: `A mochila está cheia (${tamanhoMochila(p.nivel)} lugares).` };
  tirarItem(p, id); p.equip.mochila.push(id);
  return { ok: true };
}
function tirarDaMochila(p, i) {
  if (i < 0 || i >= p.equip.mochila.length) return false;
  const id = p.equip.mochila.splice(i, 1)[0]; p.inv[id] = qtd(p, id) + 1;
  return true;
}

/** Usa o consumível do lugar `i` da mochila. Devolve {msg, buff} ou null se não faria nada. (Não gasta a jogada.) */
function usarMochila(p, i, T) {
  const id = p.equip.mochila[i], it = ITENS[id];
  if (!it) return null;
  const d = derivados(p), msgs = [];
  const efeito = { buff: null, limpa: false };
  if (it.heal) {
    const ganho = Math.min(d.hpMax - p.hp, it.heal);
    if (ganho > 0) { p.hp += ganho; msgs.push(`+${ganho} vida`); }
  }
  if (it.limpa && T && (T.efeitos.length)) { T.efeitos = []; efeito.limpa = true; msgs.push('veneno e gelo removidos'); }
  if (it.buff) {
    if (!T) return null;
    efeito.buff = it.buff;
    msgs.push(Object.entries(it.buff).map(([k, v]) => `+${v} ${{ atq: 'dano', mov: 'movimento', escudo: 'escudo' }[k]}`).join(', '));
  }
  if (!msgs.length) return null;
  p.equip.mochila.splice(i, 1);
  efeito.msg = `${it.icone} ${it.nome}: ${msgs.join(', ')}`;
  return efeito;
}

/* ---------- Loja ---------- */
function estoqueLoja(p, reino) {
  const t = Math.min(reino.tier, 4);   // o Abismo do Caos (nível 5) vende o melhor equipamento comum (nível 4)
  const ids = [...reino.consumiveis, `${p.classe}_${t}`, `cabeca_${t}`, `peito_${t}`, `pes_${t}`, `escudo_${t}`];
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
/** Saves antigos: completa o que faltar. Os saves da versão com números grandes (e mana) ganham o equipamento e os atributos novos. */
function migrarSave(p) {
  p.cenarios = p.cenarios || {};
  p.dificuldade = DIFICULDADES[p.dificuldade] ? p.dificuldade : DIFICULDADE_PADRAO;
  if (!p.tutorial) p.tutorial = { off: !!p.cenarios[1], feitos: {} };   // quem já passou do cenário 1 não precisa do tutorial
  if (!p.equip || !Array.isArray(p.equip.maos)) {                       // formato antigo
    p.equip = equipInicial(p.classe); p.inv = {};
    p.attr = { ...CLASSES[p.classe].attr }; p.pontos = Math.max(0, (p.nivel || 1) - 1) * PONTOS_POR_NIVEL; p.xp = 0;
    p.gold = Math.min(p.gold || 0, 60);
  }
  delete p.mp;
  REINOS.forEach((r, i) => {
    if (p.derrotados && p.derrotados[r.chefe]) for (let k = 0; k <= i; k++) for (const c of cenariosDoReino(REINOS[k].id)) p.cenarios[c.id] = true;
  });
  ajustarVida(p); if (!(p.hp > 0)) p.hp = derivados(p).hpMax;
  return p;
}

/** Acampar: recupera toda a vida (custa um pouco de ouro). */
function descansar(p, reino) {
  if (p.gold < reino.descanso) return false;
  p.gold -= reino.descanso;
  p.hp = derivados(p).hpMax;
  return true;
}

function penalidadeDerrota(p) {
  p.gold = Math.floor(p.gold * 0.8);
  p.hp = Math.ceil(derivados(p).hpMax / 2);
}

/* ---------- Sorteio e fórmulas usadas na batalha (o motor está em tatica.js) ---------- */
function rand(min, max) { return min + Math.random() * (max - min); }
