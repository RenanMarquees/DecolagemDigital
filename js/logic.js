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
  const t = reino.tier;
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
function reinoDesbloqueado(p, i) {
  if (i === 0) return true;
  if (REINOS[i].final) return p.fragmentos.length >= 4;
  return !!p.derrotados[REINOS[i - 1].chefe];
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

/* ---------- Batalha ---------- */
function rand(min, max) { return min + Math.random() * (max - min); }
function reducaoDefesa(def) { return 50 / (50 + def); }

function criarBatalha(idInimigo) {
  const base = INIMIGOS[idInimigo];
  return {
    id: idInimigo, inim: { ...base, hpMax: base.hp },
    turno: 0, defendendo: false, buff: null, fim: null,
    log: [], fx: [], inicioLog: 0,
  };
}

function logar(b, msg, cls = '') { b.log.push({ msg, cls }); }

function golpe(b, d, ataque, bonusCrit = 0) {
  const mult = b.buff ? b.buff.mult : 1;
  let dano = ataque * mult * d.danoMult * rand(0.9, 1.1) * reducaoDefesa(b.inim.def);
  const crit = Math.random() < d.crit + bonusCrit;
  if (crit) dano *= 1.75;
  dano = Math.max(1, Math.round(dano));
  b.inim.hp = Math.max(0, b.inim.hp - dano);
  b.fx.push({ alvo: 'inimigo', v: dano, crit });
  return { dano, crit };
}

function executarAcao(b, p, d, acao) {
  const nomeI = b.inim.nome;
  switch (acao.tipo) {
    case 'atacar': {
      const stat = d[CLASSES[p.classe].basico];
      const r = golpe(b, d, stat * 1.5 + d.atk);
      logar(b, `Você ataca ${nomeI}: ${r.dano} de dano${r.crit ? ' (CRÍTICO!)' : ''}.`, r.crit ? 'crit' : 'dano');
      return true;
    }
    case 'habilidade': {
      const h = HABILIDADES[acao.id];
      if (!h || h.nivel > p.nivel) return false;
      if (p.mp < h.custo) { logar(b, 'Mana insuficiente!', 'erro'); return false; }
      p.mp -= h.custo;
      if (h.tipo === 'dano' || h.tipo === 'dreno') {
        let total = 0, algumCrit = false;
        for (let i = 0; i < (h.golpes || 1); i++) {
          const r = golpe(b, d, d[h.stat] * h.mult + d.atk, h.critBonus || 0);
          total += r.dano; algumCrit = algumCrit || r.crit;
        }
        logar(b, `${h.icone} ${h.nome}: ${total} de dano${algumCrit ? ' (CRÍTICO!)' : ''}.`, algumCrit ? 'crit' : 'dano');
        if (h.tipo === 'dreno') {
          const cura = Math.min(d.hpMax - p.hp, Math.round(total / 2));
          p.hp += cura;
          if (cura > 0) { logar(b, `Você drena ${cura} de vida.`, 'cura'); b.fx.push({ alvo: 'jogador', v: cura, cura: true }); }
        }
      } else if (h.tipo === 'cura') {
        const cura = Math.min(d.hpMax - p.hp, Math.round(d.hpMax * 0.15 + d[h.stat] * h.mult * 0.7));
        p.hp += cura;
        logar(b, `${h.icone} ${h.nome}: você recupera ${cura} de vida.`, 'cura');
        b.fx.push({ alvo: 'jogador', v: cura, cura: true });
      } else if (h.tipo === 'buff') {
        b.buff = { mult: h.mult, turnos: h.turnos + 1 };
        logar(b, `${h.icone} ${h.nome}! Seu dano aumenta por ${h.turnos} turnos.`, 'cura');
      }
      return true;
    }
    case 'item': {
      const msg = usarConsumivel(p, acao.id);
      if (!msg) { logar(b, 'Isso não teria efeito agora.', 'erro'); return false; }
      logar(b, msg, 'cura');
      return true;
    }
    case 'defender':
      b.defendendo = true;
      p.mp = Math.min(d.mpMax, p.mp + Math.round(d.mpMax * 0.1));
      logar(b, '🛡️ Você se protege (dano pela metade) e recupera o fôlego (+mana).', 'info');
      return true;
    case 'fugir':
      if (b.inim.chefe) { logar(b, 'Não há como fugir de um deus!', 'erro'); return false; }
      if (Math.random() < 0.6) { logar(b, 'Você escapou!', 'info'); b.fim = 'fugiu'; }
      else logar(b, 'Você tentou fugir, mas não conseguiu!', 'erro');
      return true;
  }
  return false;
}

function turnoInimigo(b, p, d) {
  const e = b.inim;
  b.turno++;
  const esp = e.especial;
  const ehEspecial = esp && b.turno % esp.cada === 0;
  if (!ehEspecial && Math.random() < d.esquiva) {
    logar(b, `Você esquiva do ataque de ${e.nome}!`, 'info');
    b.fx.push({ alvo: 'jogador', v: 0, esquiva: true });
  } else {
    let dano = e.atk * (ehEspecial ? esp.mult : 1) * rand(0.9, 1.1) * reducaoDefesa(d.def);
    if (b.defendendo) dano *= 0.5;
    dano = Math.max(1, Math.round(dano));
    p.hp = Math.max(0, p.hp - dano);
    b.fx.push({ alvo: 'jogador', v: dano, forte: ehEspecial });
    logar(b, ehEspecial ? `💢 ${e.nome} usa ${esp.nome}: ${dano} de dano!` : `${e.nome} ataca: ${dano} de dano.`, ehEspecial ? 'forte' : 'inimigo');
  }
  b.defendendo = false;
}

function fimDeTurno(b, p, d) {
  if (b.buff && --b.buff.turnos <= 0) b.buff = null;
  p.mp = Math.min(d.mpMax, p.mp + d.regenMp);
  const esp = b.inim.especial;
  if (esp && (b.turno + 1) % esp.cada === 0) {
    logar(b, `⚠️ ${b.inim.nome} está carregando ${esp.nome}! Defenda-se!`, 'aviso');
  }
}

/**
 * Executa um turno completo (ação do jogador + resposta do inimigo).
 * Retorna: 'invalido' | 'continua' | 'vitoria' | 'derrota' | 'fugiu'
 */
function jogarTurno(b, p, acao) {
  b.fx = [];
  b.inicioLog = b.log.length;
  const d = derivados(p);
  if (!executarAcao(b, p, d, acao)) return 'invalido';
  if (b.fim) return b.fim;
  if (b.inim.hp <= 0) { b.fim = 'vitoria'; return b.fim; }
  turnoInimigo(b, p, d);
  if (p.hp <= 0) { b.fim = 'derrota'; return b.fim; }
  fimDeTurno(b, p, d);
  return 'continua';
}

/** Aplica recompensas da vitória. */
function aplicarVitoria(b, p) {
  const e = b.inim;
  const gold = Math.round(e.gold * rand(0.8, 1.2));
  const itens = [];
  for (const dr of e.drops || []) if (Math.random() < dr.chance) itens.push(dr.id);
  const primeira = e.chefe && !p.derrotados[b.id];
  if (primeira) {
    p.derrotados[b.id] = true;
    if (e.reliquia) itens.push(e.reliquia);
    if (e.fragmento) p.fragmentos.push(e.fragmento);
  }
  for (const id of itens) darItem(p, id);
  p.gold += gold;
  p.kills++;
  const subidas = ganharXp(p, e.xp);
  return { xp: e.xp, gold, itens, subidas, primeira };
}
