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
    nome, classe, nivel: 1, xp: 0, gold: 10,
    colecao: idsMaoInicial(classe), mao: idsMaoInicial(classe), escolhas: [],   // cartas do herói: todas as que tem, as 10 que leva, e os níveis esperando escolha de carta
    inv: {},                            // itens guardados (fora do corpo e da mochila)
    equip: equipInicial(classe),        // cabeça, peito, pés, 2 mãos e mochila
    hp: 0,
    derrotados: {}, fragmentos: [], vistos: {}, kills: 0, finalizado: false,
    cenarios: {},                       // cenários concluídos: { 1: true, 2: true... }
    dificuldade: DIFICULDADE_PADRAO,
    tutorial: { off: false, feitos: {} },   // passos do tutorial já vistos (js/tutorial.js)
    baralho: BARALHO_BASE.slice(),          // cartas de modificador do herói (a sorte dos ataques; melhora com as conquistas)
    stats: { xp: 0, ouro: 0, abates: 0, baus: 0, cenarios: 0, chefes: 0 },   // contagens da campanha para as conquistas
    marcos: {},                             // conquistas já recebidas
    flags: {},                              // escolhas da história (confiança em Munin/Hugin, pacto...) e coisas já vistas
    eventosVistos: {},                      // eventos de história já mostrados
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

/** Valores finais do herói. Não há atributos nem bônus fixos de equipamento: o equipamento é de USO ÚNICO por cenário
 *  (veja efeitoEquip). A vida cresce um pouco por nível (máx. 30); o resto vem das cartas. */
function derivados(p) {
  const c = CLASSES[p.classe];
  return { hpMax: Math.min(VIDA_MAX_JOGO, c.hpBase + Math.round(p.nivel * c.hpNivel)), dano: 0, mov: 0, cura: 0, esc: 0, alc: 0 };
}

/** O que um equipamento faz quando você o USA (1 vez por cenário, de graça, no seu turno): cura, dano, movimento, escudo, alcance. */
function efeitoEquip(it) {
  return { cura: (it.hp || 0) + (it.cura || 0), atq: it.atq || 0, mov: it.mov || 0, esc: it.esc || 0, alc: it.alc || 0 };
}
const textoEfeitoEquip = descreverBonus;
/** Os equipamentos vestidos, cada um com a sua chave de uso (ex.: 'peito', 'maos0'). */
function equipamentosUsaveis(p) {
  const e = p.equip, lista = [];
  for (const slot of ['cabeca', 'peito', 'pes']) if (e[slot]) lista.push({ chave: slot, id: e[slot] });
  (e.maos || []).forEach((id, i) => { if (id) lista.push({ chave: 'maos' + i, id }); });
  return lista;
}

function ajustarVida(p) { p.hp = Math.min(p.hp, derivados(p).hpMax); }

function ganharXp(p, xp) {
  const subidas = [];
  p.stats.xp += xp;
  if (p.nivel >= NIVEL_MAX) return subidas;
  p.xp += xp;
  while (p.nivel < NIVEL_MAX && p.xp >= xpParaProximo(p.nivel)) {
    p.xp -= xpParaProximo(p.nivel);
    p.nivel++;
    p.escolhas.push(p.nivel);          // a cada nível: escolher 1 carta entre 2
    subidas.push({ nivel: p.nivel, mochila: tamanhoMochila(p.nivel), ganhouMochila: tamanhoMochila(p.nivel) > tamanhoMochila(p.nivel - 1) });
    p.hp = derivados(p).hpMax;       // subir de nível cura tudo
  }
  if (p.nivel >= NIVEL_MAX) p.xp = 0;
  return subidas;
}

/** Ouro que entra (moedas, baú, recompensa): também conta para as conquistas. */
function ganharOuro(p, n) { p.gold += n; p.stats.ouro += n; }

/** Escolhe a carta do nível `nivel` (opção 0 ou 1). A outra se perde para sempre. Se a mão tem lugar, a nova carta já entra nela. */
function escolherCartaNivel(p, nivel, opcao) {
  const i = p.escolhas.indexOf(nivel);
  if (i < 0 || (opcao !== 0 && opcao !== 1)) return null;
  const carta = cartasDoNivel(p.classe, nivel)[opcao];
  p.escolhas.splice(i, 1);
  p.colecao.push(carta.id);
  if (p.mao.length < MAO_MAX) p.mao.push(carta.id);
  return carta;
}
/** Põe ou tira uma carta da mão que você leva aos cenários (de 6 a 10 cartas). */
function alternarCartaMao(p, id) {
  if (!p.colecao.includes(id)) return false;
  const i = p.mao.indexOf(id);
  if (i >= 0) { if (p.mao.length <= MAO_MIN) return false; p.mao.splice(i, 1); return true; }
  if (p.mao.length >= MAO_MAX) return false;
  p.mao.push(id); return true;
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
/** Melhor nível de equipamento liberado: começa no 1 e sobe 1 a cada 5 cenários concluídos (até o 4). */
function tierDaLoja(p) { return Math.min(4, 1 + Math.floor(Object.keys(p.cenarios).length / 5)); }
/** O mercador vende os consumíveis do reino e os equipamentos do nível liberado (e do anterior, mais baratos). */
function estoqueLoja(p, reino) {
  const t = tierDaLoja(p), tiers = t > 1 ? [t - 1, t] : [t];
  const equip = [];
  for (const k of tiers) equip.push(`${p.classe}_${k}`, `cabeca_${k}`, `peito_${k}`, `pes_${k}`, `escudo_${k}`);
  return [...reino.consumiveis, ...equip].filter(id => ITENS[id]);
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
/** Valhala segue a ordem (o tutorial depende disso). Nos outros reinos você escolhe a ORDEM dos três primeiros cenários; o do chefe só abre depois deles. */
function cenarioDesbloqueado(p, c) {
  if (c.id === 1) return true;
  const ri = REINOS.findIndex(r => r.id === c.reino), lista = cenariosDoReino(c.reino), pos = lista.indexOf(c);
  if (ri <= 0) return !!p.cenarios[c.id - 1];
  if (!reinoDesbloqueado(p, ri)) return false;
  return pos < lista.length - 1 || lista.slice(0, pos).every(x => !!p.cenarios[x.id]);
}
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
    p.equip = equipInicial(p.classe); p.inv = {}; p.xp = 0;
    p.gold = Math.min(p.gold || 0, 60);
  }
  delete p.attr; delete p.pontos;                                        // não há mais atributos: o herói melhora por cartas
  if (!Array.isArray(p.colecao)) { p.colecao = idsMaoInicial(p.classe); p.mao = idsMaoInicial(p.classe); p.escolhas = []; for (let n = 2; n <= (p.nivel || 1); n++) p.escolhas.push(n); }
  delete p.mp;
  if (!Array.isArray(p.baralho)) p.baralho = BARALHO_BASE.slice();
  if (!p.stats) p.stats = { xp: 0, ouro: 0, abates: 0, baus: 0, cenarios: Object.keys(p.cenarios).length, chefes: Object.keys(p.derrotados || {}).length };
  if (!p.marcos) p.marcos = {};
  if (!p.flags) p.flags = {};
  if (!p.eventosVistos) p.eventosVistos = {};
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


/* ---------- Eventos de história (js/eventos.js) ---------- */
/** O evento que aparece depois de concluir o cenário `cenarioId` (e ainda não foi visto), ou null. */
function eventoDoCenario(p, cenarioId) {
  if (typeof EVENTOS === 'undefined') return null;
  return EVENTOS.find(e => e.depoisDe === cenarioId && !p.eventosVistos[e.id]) || null;
}
/** Aplica a opção `i` do evento: ouro, vida (nunca mata), XP, carta de modificador, item, flags da história e consequência no próximo cenário.
 *  Devolve um resumo para mostrar na tela: { linhas: [...texto], subidas }. */
function aplicarEvento(p, ev, i) {
  const op = ev.opcoes[i];
  if (!op) return null;
  const e = op.efeitos || {}, linhas = [];
  let subidas = [];
  p.eventosVistos[ev.id] = i + 1;
  if (e.ouro) { const v = e.ouro > 0 ? e.ouro : -Math.min(p.gold, -e.ouro); ganharOuro(p, v); p.stats.ouro = Math.max(0, p.stats.ouro); linhas.push(`${v > 0 ? '+' : ''}${v} 🪙`); }
  if (e.vida) {
    const max = derivados(p).hpMax, novo = Math.max(1, Math.min(max, p.hp + e.vida));
    linhas.push(`${novo - p.hp > 0 ? '+' : ''}${novo - p.hp} ❤️`); p.hp = novo;
  }
  if (e.xp) { subidas = ganharXp(p, e.xp); linhas.push(`+${e.xp} XP`); }
  if (e.carta) { const r = adicionarCartaMod(p, e.carta); if (r.ok) linhas.push(`🎴 carta ${CARTAS_MOD[e.carta].rotulo} no seu baralho de ataque`); }
  if (e.item && ITENS[e.item]) { darItem(p, e.item); linhas.push(`${ITENS[e.item].icone} ${ITENS[e.item].nome}`); }
  if (e.flags) for (const [k, v] of Object.entries(e.flags)) p.flags[k] = typeof v === 'number' ? (p.flags[k] || 0) + v : v;
  if (e.proximoCenario) {
    p.proxEfeito = { ...(p.proxEfeito || {}) };
    for (const [k, v] of Object.entries(e.proximoCenario)) p.proxEfeito[k] = (p.proxEfeito[k] || 0) + v;
    const pe = e.proximoCenario;
    linhas.push(`⚠️ no próximo cenário: ${[pe.vidaInicial ? `${pe.vidaInicial} de vida ao começar` : '', pe.armadilhas ? `+${pe.armadilhas} armadilhas` : '', pe.inimigosExtra ? `+${pe.inimigosExtra} inimigo(s)` : ''].filter(Boolean).join(', ')}`);
  }
  return { linhas, subidas };
}
/** Texto da consequência pendente para o próximo cenário (ou ''). */
function textoProxEfeito(p) {
  const pe = p.proxEfeito;
  if (!pe) return '';
  return [pe.vidaInicial ? `você começa com ${-pe.vidaInicial} de vida a menos` : '', pe.armadilhas ? `+${pe.armadilhas} armadilhas no chão` : '', pe.inimigosExtra ? `+${pe.inimigosExtra} inimigo(s) a mais` : ''].filter(Boolean).join(' · ');
}
/** Aplica (e apaga) a consequência pendente numa batalha que acabou de começar. */
function aplicarProxEfeito(T, p) {
  const pe = p.proxEfeito;
  if (!pe) return;
  delete p.proxEfeito;
  if (pe.armadilhas && T.tipoArm) racharChao(T, pe.armadilhas);
  if (pe.inimigosExtra) chamarOnda(T, pe.inimigosExtra, '⚠️ Sua escolha trouxe mais inimigos!');
}
