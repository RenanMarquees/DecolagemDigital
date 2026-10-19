'use strict';
/* ============================================================
   TELAS E TOQUES — desenha o jogo na página usando as regras de logic.js
   ============================================================ */

const SAVE_KEY = 'fio_do_destino_v1';
const app = document.getElementById('app');
const modal = document.getElementById('modal');

let P = null;          // jogador
let T = null;          // batalha tática atual
let MODO = null;       // ação à espera de alvo: {tipo:'atacar'} ou {tipo:'hab', id}
let OCUPADO = false;   // true enquanto os inimigos jogam
let RES = null;        // resultado da última vitória
let REINO = null;      // reino aberto (objeto de REINOS)
let HIST = null;       // história em andamento
let SUB = 'main';      // submenu da batalha: main | habs | itens
let LOJA_ABA = 'comprar';
let TOAST_T = null;

/* ---------- utilidades ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (v, m) => Math.max(0, Math.min(100, (v / m) * 100));
const reinoPorId = id => REINOS.find(r => r.id === id);

function salvar() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(P)); } catch (e) { /* sem armazenamento */ } }
function carregar() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (!s) return null;
    const p = JSON.parse(s);
    return p && p.classe && CLASSES[p.classe] ? p : null;
  } catch (e) { return null; }
}

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on');
  clearTimeout(TOAST_T);
  TOAST_T = setTimeout(() => t.classList.remove('on'), 2200);
}

function barra(tipo, v, m, rotulo) {
  return `<div class="barra ${tipo}"><i style="width:${pct(v, m)}%"></i><span>${rotulo || ''}${Math.ceil(v)}/${m}</span></div>`;
}

function linhaItem(id, extra = '', botao = '') {
  const it = ITENS[id];
  return `<div class="linha-item">
    <div class="ico" style="border-color:${RARIDADE_COR[it.raridade]}">${it.icone}</div>
    <div class="info"><b style="color:${RARIDADE_COR[it.raridade]}">${esc(it.nome)}</b>${extra}<small>${esc(it.desc)}</small></div>
    ${botao}</div>`;
}

function statusTopo() {
  const d = derivados(P);
  return `<header class="topo">
    <div class="topo-nome"><b>${esc(P.nome)}</b> <span>${CLASSES[P.classe].icone} Nv ${P.nivel}</span><span class="ouro">🪙 ${P.gold}</span></div>
    ${barra('hp', P.hp, d.hpMax, '❤️ ')}
    ${barra('mp', P.mp, d.mpMax, '💧 ')}
    ${P.nivel < NIVEL_MAX ? `<div class="barra xp"><i style="width:${pct(P.xp, xpParaProximo(P.nivel))}%"></i><span>XP ${P.xp}/${xpParaProximo(P.nivel)}</span></div>` : ''}
  </header>`;
}

/* ---------- história ---------- */
function historia(paginas, depois) {
  if (!paginas.length) { depois(); return; }
  HIST = { paginas, i: 0, depois };
  telaHistoria();
}
function telaHistoria() {
  const pg = HIST.paginas[HIST.i];
  const ultimo = HIST.i === HIST.paginas.length - 1;
  const nome = P ? P.nome : '';
  app.innerHTML = `<div class="tela historia ${REINO ? 'reino-' + REINO.id : ''}">
    <div class="hist-icone">${pg.icone}</div>
    <p class="hist-texto">${esc(pg.texto).replace('{nome}', `<b>${esc(nome)}</b>`)}</p>
    <button class="btn grande" data-a="hist-prox">${ultimo ? 'Continuar' : 'Próximo ▶'}</button>
    <div class="pontos-pag">${HIST.paginas.map((_, k) => `<i class="${k === HIST.i ? 'on' : ''}"></i>`).join('')}</div>
  </div>`;
}

/* ---------- título e criação ---------- */
function telaTitulo() {
  REINO = null; T = null;
  const tem = !!carregar();
  app.innerHTML = `<div class="tela titulo">
    <div class="logo">🧶</div>
    <h1>Fio do Destino</h1>
    <p class="sub">O crepúsculo dos deuses antigos</p>
    <div class="menu-titulo">
      ${tem ? '<button class="btn grande" data-a="continuar">▶ Continuar</button>' : ''}
      <button class="btn grande ${tem ? 'sec' : ''}" data-a="novo">${tem ? 'Novo Jogo' : '⚔️ Novo Jogo'}</button>
    </div>
    <small class="rodape-titulo">Valhala · Olimpo · Inferno · Duat</small>
  </div>`;
}

let CRIAR = { classe: 'guerreiro' };
function telaCriar() {
  const nomeAtual = (document.getElementById('nome') || {}).value || '';
  app.innerHTML = `<div class="tela criar">
    <h2>Quem é o escolhido?</h2>
    <label class="campo">Seu nome
      <input id="nome" maxlength="14" placeholder="Ex.: Astrid" value="${esc(nomeAtual)}" autocomplete="off">
    </label>
    <div class="classes">
      ${Object.entries(CLASSES).map(([id, c]) => `
        <button class="card-classe ${CRIAR.classe === id ? 'sel' : ''}" data-a="classe" data-id="${id}">
          <span class="ico-g">${c.icone}</span>
          <b>${c.nome}</b>
          <small>${esc(c.desc)}</small>
          <div class="mini-attr">${ATRIBUTOS.map(a => `<span>${a} ${c.attr[a]}</span>`).join('')}</div>
        </button>`).join('')}
    </div>
    <button class="btn grande" data-a="comecar">Começar a jornada</button>
    <button class="btn link" data-a="titulo">← Voltar</button>
  </div>`;
}

/* ---------- mapa de reinos ---------- */
function telaMapa() {
  REINO = null; T = null;
  salvar();
  app.innerHTML = `<div class="tela mapa">
    ${statusTopo()}
    <div class="corpo">
      <h2>Reinos dos Deuses</h2>
      <div class="fragmentos">${[0, 1, 2, 3].map(i => `<span class="${P.fragmentos[i] ? 'on' : ''}" title="${esc(P.fragmentos[i] || 'Fragmento ainda oculto')}">${P.fragmentos[i] ? '🔶' : '◇'}</span>`).join('')}<small>Fragmentos do Destino</small></div>
      ${REINOS.map((r, i) => {
        const livre = reinoDesbloqueado(P, i);
        const feito = !!P.derrotados[r.chefe];
        const dica = r.final ? 'Reúna os 4 Fragmentos do Destino' : i > 0 ? `Derrote ${INIMIGOS[REINOS[i - 1].chefe].nome.split(',')[0]} para abrir` : '';
        return `<button class="card-reino reino-${r.id}" data-a="reino" data-id="${r.id}" ${livre ? '' : 'disabled'}>
          <span class="ico-g">${livre ? r.icone : '🔒'}</span>
          <span class="txt"><b>${r.nome}</b><small>${livre ? `Nível recomendado: ${r.nivelRec}` : dica}</small></span>
          <span class="selo">${feito ? '✅' : ''}</span>
        </button>`;
      }).join('')}
    </div>
    ${rodapeNav()}
  </div>`;
}

function rodapeNav() {
  return `<nav class="rodape">
    <button data-a="personagem">🧙 Personagem${P.pontos > 0 ? `<em class="badge">${P.pontos}</em>` : ''}</button>
    <button data-a="inventario">🎒 Inventário</button>
    <button data-a="titulo">☰ Menu</button>
  </nav>`;
}

/* ---------- reino ---------- */
function telaReino(primeira = false) {
  const r = REINO;
  salvar();
  const chefe = INIMIGOS[r.chefe];
  const feito = !!P.derrotados[r.chefe];
  app.innerHTML = `<div class="tela reino reino-${r.id}">
    ${statusTopo()}
    <div class="corpo">
      <div class="banner"><span>${r.icone}</span><h2>${r.nome}</h2></div>
      <p class="intro">${esc(r.intro)}</p>
      <div class="acoes-reino">
        ${r.final ? '' : '<button class="btn grande" data-a="explorar">🧭 Explorar</button>'}
        <button class="btn grande ${feito ? 'sec' : 'chefe'}" data-a="chefe">${chefe.icone} ${feito ? 'Revanche: ' : 'Desafiar '}${esc(chefe.nome.split(',')[0])}</button>
        ${r.mercador ? `<button class="btn" data-a="loja">🛒 ${esc(r.mercador.nome.split(',')[0])}</button>` : ''}
        ${r.final ? '' : `<button class="btn" data-a="acampar">🏕️ Acampar (🪙 ${r.descanso})</button>`}
        <button class="btn link" data-a="mapa">← Mapa dos reinos</button>
      </div>
    </div>
    ${rodapeNav()}
  </div>`;
}

/* ---------- loja ---------- */
function telaLoja() {
  const r = REINO;
  const lista = LOJA_ABA === 'comprar'
    ? estoqueLoja(P, r).filter(id => { const it = ITENS[id]; return !it.classe || it.classe === P.classe; })
    : Object.keys(P.inv).filter(id => ITENS[id].preco > 0);
  const linhas = lista.map(id => {
    const it = ITENS[id];
    let comp = '';
    if (it.tipo === 'arma' || it.tipo === 'armadura') {
      const atual = ITENS[P.equip[it.tipo]];
      const v = it.atk || it.def, vAtual = atual ? (atual.atk || atual.def) : 0;
      const dif = v - vAtual;
      comp = `<small class="${dif > 0 ? 'melhor' : 'pior'}">${dif > 0 ? '▲' : dif < 0 ? '▼' : '='} ${Math.abs(dif)} vs. equipado</small>`;
    }
    if (LOJA_ABA === 'comprar') {
      return linhaItem(id, comp, `<button class="btn peq" data-a="comprar" data-id="${id}" ${P.gold < it.preco ? 'disabled' : ''}>🪙 ${it.preco}</button>`);
    }
    return linhaItem(id, `<small>Você tem: ${qtd(P, id)}</small>`, `<button class="btn peq sec" data-a="vender" data-id="${id}">🪙 ${precoVenda(id)}</button>`);
  }).join('') || '<p class="vazio">Nada por aqui.</p>';
  app.innerHTML = `<div class="tela loja reino-${r.id}">
    ${statusTopo()}
    <div class="corpo">
      <div class="mercador"><span>${r.mercador.icone}</span><p><b>${esc(r.mercador.nome)}</b><br><i>"${esc(r.mercador.fala)}"</i></p></div>
      <div class="abas">
        <button class="${LOJA_ABA === 'comprar' ? 'on' : ''}" data-a="aba-loja" data-id="comprar">Comprar</button>
        <button class="${LOJA_ABA === 'vender' ? 'on' : ''}" data-a="aba-loja" data-id="vender">Vender</button>
      </div>
      <div class="lista">${linhas}</div>
      <button class="btn link" data-a="voltar-reino">← Sair da loja</button>
    </div>
  </div>`;
}

/* ---------- batalha tática (mapa de hexágonos) ---------- */
const HEX = 27;                 // tamanho de um hexágono (em unidades do SVG)
const RAIZ3 = Math.sqrt(3);
const NS = 'http://www.w3.org/2000/svg';
const dormir = ms => new Promise(r => setTimeout(r, ms));
let POLI = {};                  // "c,r" -> polígono do hexágono

function hexCentro(c, r) {
  return { x: RAIZ3 * HEX * (c + 0.5 * (r & 1)) + (RAIZ3 * HEX) / 2, y: 1.5 * HEX * r + HEX };
}
const HEX_PONTOS = [0, 1, 2, 3, 4, 5].map(i => {
  const a = ((60 * i - 30) * Math.PI) / 180;
  return `${(HEX * Math.cos(a)).toFixed(1)},${(HEX * Math.sin(a)).toFixed(1)}`;
}).join(' ');

function iniciarBatalha(chefeId) {
  T = criarTatica(REINO, chefeId, P);
  RES = null; SUB = 'main'; MODO = null; OCUPADO = false;
  telaTatica();
}

function telaTatica() {
  const g = T.g;
  const larg = RAIZ3 * HEX * (g.cols + 0.5);
  const alt = 1.5 * HEX * (g.rows - 1) + 2 * HEX;
  let tiles = '';
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const ch = g.cel[r][c];
      if (ch === ' ') continue;
      const { x, y } = hexCentro(c, r);
      if (ch === '#') {
        tiles += `<polygon class="hex-parede" points="${HEX_PONTOS}" transform="translate(${x} ${y})"/>
          <text class="parede-ico" x="${x}" y="${y + 8}">${REINO.parede}</text>`;
      } else {
        tiles += `<polygon class="hex" data-a="hex" data-c="${c}" data-r="${r}" points="${HEX_PONTOS}" transform="translate(${x} ${y})"/>`;
      }
    }
  }
  const sx = hexCentro(T.saida.c, T.saida.r);
  app.innerHTML = `<div class="tela tatica reino-${REINO.id}">
    <div class="tat-topo"><span>📍 <b>${esc(T.nomeSala)}</b></span><span id="rod"></span></div>
    <div class="tabuleiro">
      <svg id="tab" viewBox="0 0 ${larg.toFixed(1)} ${alt.toFixed(1)}" role="img" aria-label="Mapa da batalha">
        <g id="c-chao">${tiles}</g>
        <text class="saida-ico" x="${sx.x + HEX * 0.5}" y="${sx.y - HEX * 0.35}">🚪</text>
        <g id="c-unid"></g><g id="c-fx"></g>
      </svg>
    </div>
    <div id="hud"></div>
  </div>`;
  POLI = {};
  app.querySelectorAll('.hex').forEach(p => { POLI[chave(+p.dataset.c, +p.dataset.r)] = p; });
  atualizarTudo();
}

function atualizarTudo() { atualizarTabuleiro(); atualizarHud(); }

function noUnidade(id, cls, icone) {
  const g = document.createElementNS(NS, 'g');
  g.id = id; g.setAttribute('class', 'unid ' + cls);
  g.innerHTML = `<circle class="anel" r="${HEX * 0.78}"/>
    <text class="emoji" y="${HEX * 0.3}">${icone}</text>
    <rect class="hp-bg" x="${-HEX * 0.62}" y="${HEX * 0.66}" width="${HEX * 1.24}" height="5" rx="2"/>
    <rect class="hp-fg" x="${-HEX * 0.62}" y="${HEX * 0.66}" width="${HEX * 1.24}" height="5" rx="2"/>`;
  document.getElementById('c-unid').appendChild(g);
  return g;
}

function posicionar(g, pos, hp, hpMax) {
  const { x, y } = hexCentro(pos.c, pos.r);
  g.style.transform = `translate(${x}px, ${y}px)`;
  g.querySelector('.hp-fg').setAttribute('width', (HEX * 1.24 * Math.max(0, hp) / hpMax).toFixed(1));
}

/** Alvos possíveis do modo atual (para destacar em vermelho). */
function alvosDoModo() {
  if (!MODO) return [];
  return tAlvos(T, P, MODO.tipo === 'atacar' ? { tipo: 'atacar' } : { tipo: 'habilidade', id: MODO.id });
}

function atualizarTabuleiro() {
  if (!T || !document.getElementById('c-unid')) return;
  const alc = new Set(), alvos = new Set();
  if (T.fase === 'heroi' && !T.fim && !OCUPADO) {
    if (MODO) alvosDoModo().forEach(e => alvos.add(chave(e.c, e.r)));
    else {
      if (T.movRest > 0) tAlcance(T).forEach(h => alc.add(chave(h.c, h.r)));
      // sem ação pendente, os inimigos ao alcance do ataque básico também brilham
      if (!T.acaoUsada) tAlvos(T, P, { tipo: 'atacar' }).forEach(e => alvos.add(chave(e.c, e.r)));
    }
  }
  for (const [k, p] of Object.entries(POLI)) {
    p.classList.toggle('alcancavel', alc.has(k));
    p.classList.toggle('alvo', alvos.has(k));
  }
  // herói
  let gh = document.getElementById('u-heroi');
  if (!gh) gh = noUnidade('u-heroi', 'heroi', CLASSES[P.classe].icone);
  const d = derivados(P);
  posicionar(gh, T.heroi, P.hp, d.hpMax);
  gh.classList.toggle('buff', !!T.buff);
  gh.classList.toggle('defende', T.defendendo);
  // inimigos
  for (const e of T.inim) {
    const id = 'u-' + e.uid;
    let g = document.getElementById(id);
    if (!e.vivo) { if (g) { g.classList.add('morto'); g.id = ''; setTimeout(() => g.remove(), 450); } continue; }
    if (!g) g = noUnidade(id, 'inim' + (e.chefe ? ' chefe' : ''), e.icone);
    posicionar(g, e, e.hp, e.hpMax);
  }
}

function mostrarFxT() {
  if (!T || !T.fx.length) return;
  const camada = document.getElementById('c-fx');
  for (const f of T.fx) {
    const alvo = f.alvo === 'heroi' ? T.heroi : T.inim.find(e => e.uid === f.alvo);
    if (!alvo || !camada) continue;
    const { x, y } = hexCentro(alvo.c, alvo.r);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x); t.setAttribute('y', y - HEX * 0.3);
    t.setAttribute('class', 'flutua-s' + (f.cura ? ' cura' : '') + (f.crit ? ' crit' : '') + (f.forte ? ' forte' : '') + (f.esquiva ? ' esq' : ''));
    t.textContent = f.esquiva ? 'Esquivou!' : f.texto || ((f.cura ? '+' : '-') + f.v);
    camada.appendChild(t);
    setTimeout(() => t.remove(), 1000);
    const g = document.getElementById(f.alvo === 'heroi' ? 'u-heroi' : 'u-' + f.alvo);
    if (g && !f.cura && !f.esquiva) { g.classList.add('golpeado'); setTimeout(() => g.classList.remove('golpeado'), 350); }
  }
  T.fx = [];
}

function hudHtml() {
  const d = derivados(P);
  const meuTurno = T.fase === 'heroi' && !T.fim && !OCUPADO;
  const etiquetas = [
    T.buff ? `<span class="tag ouro">📣 +dano (${T.buff.turnos})</span>` : '',
    T.defendendo ? '<span class="tag">🛡️ defendendo</span>' : '',
  ].join('');
  const inimigos = T.inim.filter(e => e.vivo).map(e => `<div class="chip-inim ${e.chefe ? 'chefe' : ''}">
      <b>${e.icone} ${esc(e.nome.split(',')[0])}</b>
      <div class="barra hp inimigo mini"><i style="width:${pct(e.hp, e.hpMax)}%"></i><span>${e.hp}/${e.hpMax}</span></div>
      <small>👣${e.mov} 🎯${e.alc} ⚔️${e.atk}</small></div>`).join('');
  const log = T.log.slice(-3).map(l => `<p class="l-${l.cls}">${esc(l.msg)}</p>`).join('');
  return `<div class="hud-heroi">
      <div class="hud-linha"><b>${CLASSES[P.classe].icone} ${esc(P.nome)} · Nv ${P.nivel}</b>${etiquetas}</div>
      ${barra('hp', P.hp, d.hpMax, '❤️ ')}${barra('mp', P.mp, d.mpMax, '💧 ')}
      <div class="hud-linha pontos-turno">
        <span class="${T.movRest > 0 ? 'on' : ''}">👣 Mover ${T.movRest}/${d.mov}</span>
        <span class="${T.acaoUsada ? '' : 'on'}">${T.acaoUsada ? '⚔️ Ação usada' : '⚔️ Ação livre'}</span>
      </div>
    </div>
    <div class="inims">${inimigos}</div>
    <div class="log" id="log">${log}</div>
    <div class="acoes" id="acoes">${acoesHtml(meuTurno)}</div>`;
}

function atualizarHud() {
  const hud = document.getElementById('hud');
  if (!hud || !T) return;
  hud.innerHTML = hudHtml();
  const rod = document.getElementById('rod');
  if (rod) rod.innerHTML = `Rodada ${T.rodada} · ${OCUPADO || T.fase === 'inimigos' ? '<b class="ini">Inimigos agindo…</b>' : '<b>Seu turno</b>'}`;
}

function acoesHtml(meuTurno) {
  if (T.fim === 'vitoria') return RES ? painelVitoria() : '';
  if (T.fim === 'derrota') {
    return `<div class="fim"><h3>💀 Você caiu</h3><p>Os deuses te trazem de volta, mas perdem 20% do seu ouro.</p>
      <button class="btn grande" data-a="bat-fim">Despertar</button></div>`;
  }
  if (!meuTurno) return '<p class="vazio">Os inimigos estão se movendo…</p>';
  if (MODO) {
    return `<div class="fim"><p>🎯 Toque no inimigo destacado em vermelho.</p>
      <button class="btn" data-a="tat-cancelar">Cancelar</button></div>`;
  }
  if (SUB === 'habs') {
    const habs = CLASSES[P.classe].habilidades.map(id => ({ id, ...HABILIDADES[id] }));
    return `<div class="sub-menu">${habs.map(h => {
      const bloq = h.nivel > P.nivel, semMp = P.mp < h.custo;
      const alc = h.area === 'ao-redor' ? 'ao redor' : h.alcance === 0 ? 'você' : `alcance ${h.alcance}`;
      return `<button class="btn hab" data-a="tat-hab" data-id="${h.id}" ${bloq || semMp || T.acaoUsada ? 'disabled' : ''}>
        <span>${h.icone} ${h.nome}</span><small>${bloq ? `🔒 Nível ${h.nivel}` : `💧 ${h.custo} · ${alc} · ${h.desc}`}</small></button>`;
    }).join('')}<button class="btn link" data-a="tat-voltar">← Voltar</button></div>`;
  }
  if (SUB === 'itens') {
    const cons = Object.keys(P.inv).filter(id => ITENS[id].tipo === 'consumivel');
    return `<div class="sub-menu">${cons.length ? cons.map(id => {
      const it = ITENS[id];
      return `<button class="btn hab" data-a="tat-item" data-id="${id}" ${T.acaoUsada ? 'disabled' : ''}><span>${it.icone} ${it.nome} ×${qtd(P, id)}</span><small>${it.desc}</small></button>`;
    }).join('') : '<p class="vazio">Sem consumíveis.</p>'}<button class="btn link" data-a="tat-voltar">← Voltar</button></div>`;
  }
  const naSaida = T.heroi.c === T.saida.c && T.heroi.r === T.saida.r;
  return `<div class="grade-acoes">
    <button class="btn" data-a="tat-atacar" ${T.acaoUsada ? 'disabled' : ''}>⚔️ Atacar <small>alc ${CLASSES[P.classe].alcanceBasico}</small></button>
    <button class="btn" data-a="tat-habs" ${T.acaoUsada ? 'disabled' : ''}>✨ Habilidades</button>
    <button class="btn" data-a="tat-itens" ${T.acaoUsada ? 'disabled' : ''}>🎒 Itens</button>
    <button class="btn" data-a="tat-defender" ${T.acaoUsada ? 'disabled' : ''}>🛡️ Defender</button>
    <button class="btn fim-turno" data-a="tat-fim">⏭️ Encerrar turno</button>
    <button class="btn sec" data-a="tat-fugir" ${T.chefeId || !naSaida ? 'disabled' : ''}>🚪 Fugir ${T.chefeId ? '' : naSaida ? '' : '<small>(na saída)</small>'}</button>
  </div>`;
}

function painelVitoria() {
  const r = RES;
  const itens = r.itens.map(id => `<span class="drop" style="color:${RARIDADE_COR[ITENS[id].raridade]}">${ITENS[id].icone} ${esc(ITENS[id].nome)}</span>`).join('');
  const subidas = r.subidas.map(s => `<p class="nivelup">⭐ Nível ${s.nivel}! +${PONTOS_POR_NIVEL} pontos de atributo${s.novas.length ? ' · Nova habilidade: ' + s.novas.map(id => HABILIDADES[id].nome).join(', ') : ''}</p>`).join('');
  return `<div class="fim"><h3>🏆 Vitória!</h3>
    <p>+${r.xp} XP · +${r.gold} 🪙</p>${itens ? `<p class="drops">${itens}</p>` : ''}${subidas}
    <button class="btn grande" data-a="bat-fim">Continuar</button></div>`;
}

/* Depois de qualquer ação: salva, mostra números flutuantes e confere se a luta acabou. */
function depoisDaAcao(ok) {
  if (!ok && T.log.length) {
    const ult = T.log[T.log.length - 1];
    if (ult.cls === 'erro') toast(ult.msg);
  }
  if (T.fim === 'vitoria' && !RES) RES = aplicarVitoriaT(T, P);
  salvar();
  mostrarFxT();
  atualizarTudo();
  if (T.fim === 'fugiu') { toast('Você escapou! 🚪'); setTimeout(() => { if (T && T.fim === 'fugiu') { T = null; telaReino(); } }, 500); return; }
  conferirAutoFim();
}

/** Sem movimento e sem ação, não sobra nada a fazer: encerra o turno sozinho. */
function conferirAutoFim() {
  const t = T;
  if (t && t.fase === 'heroi' && !t.fim && !OCUPADO && t.acaoUsada && t.movRest === 0) {
    setTimeout(() => { if (T === t && t.fase === 'heroi' && !t.fim && !OCUPADO) encerrarTurno(); }, 600);
  }
}

function executar(acao, uid) {
  let ok = false;
  if (acao.tipo === 'atacar') ok = tAtacar(T, P, uid);
  else if (acao.tipo === 'hab') ok = tHabilidade(T, P, acao.id, uid);
  else if (acao.tipo === 'item') ok = tUsarItem(T, P, acao.id);
  else if (acao.tipo === 'defender') ok = tDefender(T, P);
  MODO = null; SUB = 'main';
  depoisDaAcao(ok);
}

async function encerrarTurno() {
  const t = T;
  if (!t || OCUPADO || !tEncerrarTurno(t)) return;
  MODO = null; SUB = 'main'; OCUPADO = true;
  atualizarTudo();
  while (T === t && t.fase === 'inimigos' && !t.fim) {
    await dormir(350);
    if (T !== t) return;
    tProximoInimigo(t, P);
    atualizarTabuleiro();      // o inimigo desliza até o novo lugar
    await dormir(320);
    if (T !== t) return;
    mostrarFxT(); atualizarHud();
    await dormir(380);
  }
  if (T !== t) return;
  OCUPADO = false;
  depoisDaAcao(true);
}

function fimBatalha() {
  const t = T;
  T = null; MODO = null;
  if (t.fim === 'derrota') { penalidadeDerrota(P); salvar(); telaReino(); toast('Você acordou no acampamento.'); return; }
  if (t.fim !== 'vitoria') { telaReino(); return; }
  const e = t.chefeId ? INIMIGOS[t.chefeId] : null;
  if (e && RES.primeira) {
    const ultimo = t.chefeId === 'caos';
    const paginas = e.falaDepois.concat(RES.itens.includes(e.reliquia) ? [{ icone: ITENS[e.reliquia].icone, texto: `Você recebeu a relíquia lendária: ${ITENS[e.reliquia].nome}!` }] : []);
    historia(paginas, () => {
      if (ultimo) { P.finalizado = true; salvar(); historia(HISTORIA_FINAL, telaTitulo); }
      else if (P.fragmentos.length >= 4) historia([{ icone: '🌌', texto: 'O Abismo do Caos está aberto. Volte ao mapa dos reinos quando estiver pronto para o confronto final.' }], telaReino);
      else telaReino();
    });
    return;
  }
  telaReino();
}

/* ---------- personagem e inventário (janelas) ---------- */
function abrirModal(html) { modal.innerHTML = `<div class="janela"><button class="fechar" data-a="fechar">✕</button>${html}</div>`; modal.classList.add('on'); }
function fecharModal() { modal.classList.remove('on'); modal.innerHTML = ''; }
let MODAL_ATUAL = null;

function modalPersonagem() {
  MODAL_ATUAL = 'personagem';
  const d = derivados(P);
  const c = CLASSES[P.classe];
  const attrs = ATRIBUTOS.map(a => `<div class="attr-linha">
    <div><b>${ATRIBUTO_NOME[a]}</b> <small>${ATRIBUTO_DESC[a]}</small></div>
    <div class="attr-val">${P.attr[a]}${d[a] > P.attr[a] ? `<em>+${d[a] - P.attr[a]}</em>` : ''}</div>
    <button class="btn peq" data-a="ponto" data-id="${a}" ${P.pontos > 0 ? '' : 'disabled'}>＋</button></div>`).join('');
  const habs = c.habilidades.map(id => { const h = HABILIDADES[id]; return `<li class="${h.nivel > P.nivel ? 'bloq' : ''}">${h.icone} <b>${h.nome}</b> <small>${h.nivel > P.nivel ? '🔒 Nv ' + h.nivel : '💧 ' + h.custo}</small></li>`; }).join('');
  const slot = (nome, s, ico) => {
    const id = P.equip[s];
    return id
      ? `<div class="slot">${linhaItem(id, '', `<button class="btn peq sec" data-a="desequipar" data-id="${s}">Tirar</button>`)}</div>`
      : `<div class="slot vazio-slot"><span>${ico}</span> ${nome}: vazio</div>`;
  };
  abrirModal(`<h2>${c.icone} ${esc(P.nome)} <small>${c.nome} · Nv ${P.nivel}</small></h2>
    <p class="pts">${P.pontos > 0 ? `✨ ${P.pontos} ponto(s) para distribuir!` : 'Sem pontos livres. Suba de nível para ganhar mais.'}</p>
    <div class="attrs">${attrs}</div>
    <div class="derivados">
      <span>❤️ Vida <b>${d.hpMax}</b></span><span>💧 Mana <b>${d.mpMax}</b></span>
      <span>⚔️ Ataque <b>+${d.atk}</b></span><span>🛡️ Defesa <b>${d.def}</b></span>
      <span>💥 Crítico <b>${Math.round(d.crit * 100)}%</b></span><span>💨 Esquiva <b>${Math.round(d.esquiva * 100)}%</b></span>
      <span>👣 Movimento <b>${d.mov}</b></span><span>🎯 Alcance <b>${c.alcanceBasico}</b></span>
    </div>
    <h3>Equipado</h3>
    ${slot('Arma', 'arma', '🗡️')}${slot('Armadura', 'armadura', '🛡️')}${slot('Amuleto', 'amuleto', '📿')}
    <h3>Habilidades</h3><ul class="habs">${habs}</ul>`);
}

function modalInventario() {
  MODAL_ATUAL = 'inventario';
  const ids = Object.keys(P.inv);
  const cons = ids.filter(id => ITENS[id].tipo === 'consumivel');
  const equip = ids.filter(id => ITENS[id].tipo !== 'consumivel');
  const linhaC = id => linhaItem(id, `<small>Quantidade: ${qtd(P, id)}</small>`, `<button class="btn peq" data-a="usar" data-id="${id}">Usar</button>`);
  const linhaE = id => {
    const ok = podeEquipar(P, id);
    return linhaItem(id, ok.ok ? '' : `<small class="pior">${ok.msg}</small>`, `<button class="btn peq" data-a="equipar" data-id="${id}" ${ok.ok ? '' : 'disabled'}>Equipar</button>`);
  };
  abrirModal(`<h2>🎒 Inventário <small>🪙 ${P.gold}</small></h2>
    <h3>Consumíveis</h3>${cons.map(linhaC).join('') || '<p class="vazio">Nenhum.</p>'}
    <h3>Equipamentos na mochila</h3>${equip.map(linhaE).join('') || '<p class="vazio">Nenhum. Compre ou ganhe itens para equipar.</p>'}
    <p class="dica">Para ver o que está equipado, abra 🧙 Personagem.</p>`);
}

function atualizarModal() {
  if (MODAL_ATUAL === 'personagem') modalPersonagem();
  else if (MODAL_ATUAL === 'inventario') modalInventario();
  // atualiza o topo da tela por trás
  if (!T && P) { const t = app.querySelector('.topo'); if (t) t.outerHTML = statusTopo(); const bd = app.querySelector('.badge'); if (bd && P.pontos <= 0) bd.remove(); }
}

/* ---------- confirmação dentro do jogo (confirm() do navegador não funciona em todo lugar) ---------- */
let CONFIRMA = null;
function confirmar(msg, aoConfirmar) {
  CONFIRMA = aoConfirmar;
  MODAL_ATUAL = null;
  modal.innerHTML = `<div class="janela"><p class="conf-msg">${esc(msg)}</p>
    <div class="conf-bts"><button class="btn sec" data-a="conf-nao">Cancelar</button><button class="btn grande" data-a="conf-sim">Continuar</button></div></div>`;
  modal.classList.add('on');
}

/* ---------- ações (toques) ---------- */
const ACOES = {
  novo() {
    if (carregar()) confirmar('Isso apaga o jogo salvo. Começar um novo?', telaCriar);
    else telaCriar();
  },
  'conf-sim'() { const f = CONFIRMA; CONFIRMA = null; fecharModal(); if (f) f(); },
  'conf-nao'() { CONFIRMA = null; fecharModal(); },
  continuar() { P = carregar(); if (P) telaMapa(); },
  titulo() { fecharModal(); telaTitulo(); },
  classe(el) { CRIAR.classe = el.dataset.id; telaCriar(); },
  comecar() {
    const nome = (document.getElementById('nome').value || '').trim() || 'Herói';
    P = novoJogador(nome, CRIAR.classe);
    salvar();
    historia(HISTORIA_PROLOGO, telaMapa);
  },
  'hist-prox'() {
    if (HIST.i < HIST.paginas.length - 1) { HIST.i++; telaHistoria(); }
    else { const f = HIST.depois; HIST = null; f(); }
  },
  mapa() { telaMapa(); },
  reino(el) {
    REINO = reinoPorId(el.dataset.id);
    if (!P.vistos[REINO.id]) {
      P.vistos[REINO.id] = true; salvar();
      historia([{ icone: REINO.icone, texto: REINO.intro }], telaReino);
    } else telaReino();
  },
  'voltar-reino'() { telaReino(); },
  explorar() { iniciarBatalha(null); },
  chefe() {
    const e = INIMIGOS[REINO.chefe];
    const iniciar = () => {
      if (P.derrotados[REINO.chefe]) iniciarBatalha(REINO.chefe);
      else historia(e.falaAntes, () => iniciarBatalha(REINO.chefe));
    };
    if (P.hp < derivados(P).hpMax * 0.5) confirmar('Sua vida está baixa. Desafiar mesmo assim?', iniciar);
    else iniciar();
  },
  acampar() {
    const d = derivados(P);
    if (P.hp >= d.hpMax && P.mp >= d.mpMax) { toast('Você já está descansado.'); return; }
    if (!descansar(P, REINO)) { toast('Ouro insuficiente para acampar.'); return; }
    salvar(); telaReino(); toast('Vida e mana restauradas. 🏕️');
  },
  loja() { LOJA_ABA = 'comprar'; telaLoja(); },
  'aba-loja'(el) { LOJA_ABA = el.dataset.id; telaLoja(); },
  comprar(el) { if (comprar(P, el.dataset.id)) { salvar(); telaLoja(); toast(`Comprou ${ITENS[el.dataset.id].nome}`); } },
  vender(el) { if (vender(P, el.dataset.id)) { salvar(); telaLoja(); } },

  // batalha tática
  hex(el) {
    if (!T || OCUPADO || T.fase !== 'heroi' || T.fim) return;
    const c = +el.dataset.c, r = +el.dataset.r;
    const e = inimigoEm(T, c, r);
    if (e) {
      if (MODO) { executar(MODO, e.uid); return; }
      if (T.acaoUsada) { toast('Você já agiu neste turno.'); return; }
      if (tAlvos(T, P, { tipo: 'atacar' }).some(x => x.uid === e.uid)) executar({ tipo: 'atacar' }, e.uid);
      else toast(`${e.nome.split(',')[0]} está fora de alcance. Aproxime-se!`);
      return;
    }
    if (MODO) { MODO = null; atualizarTudo(); return; }
    if (tMover(T, P, c, r)) { salvar(); atualizarTudo(); conferirAutoFim(); }
  },
  'tat-atacar'() {
    if (!T || OCUPADO || T.acaoUsada) return;
    if (!tAlvos(T, P, { tipo: 'atacar' }).length) { toast(`Nenhum inimigo ao alcance (${CLASSES[P.classe].alcanceBasico}). Mova-se!`); return; }
    MODO = { tipo: 'atacar' }; atualizarTudo();
  },
  'tat-habs'() { SUB = 'habs'; atualizarHud(); },
  'tat-itens'() { SUB = 'itens'; atualizarHud(); },
  'tat-voltar'() { SUB = 'main'; atualizarHud(); },
  'tat-cancelar'() { MODO = null; atualizarTudo(); },
  'tat-hab'(el) {
    if (!T || OCUPADO || T.acaoUsada) return;
    const id = el.dataset.id, h = HABILIDADES[id];
    if (h.tipo === 'buff' || h.tipo === 'cura' || h.area === 'ao-redor') { executar({ tipo: 'hab', id }); return; }
    if (!tAlvos(T, P, { tipo: 'habilidade', id }).length) { toast(`Nenhum inimigo ao alcance (${h.alcance}). Mova-se!`); return; }
    MODO = { tipo: 'hab', id }; SUB = 'main'; atualizarTudo();
  },
  'tat-item'(el) { if (T && !OCUPADO) executar({ tipo: 'item', id: el.dataset.id }); },
  'tat-defender'() { if (T && !OCUPADO) executar({ tipo: 'defender' }); },
  'tat-fugir'() { if (T && !OCUPADO) depoisDaAcao(tFugir(T)); },
  'tat-fim'() { encerrarTurno(); },
  'bat-fim'() { fimBatalha(); },

  // janelas
  personagem() { modalPersonagem(); },
  inventario() { modalInventario(); },
  fechar() { MODAL_ATUAL = null; fecharModal(); if (!T && REINO) telaReino(); else if (!T && P && !HIST) telaMapa(); },
  ponto(el) { if (distribuirPonto(P, el.dataset.id)) { salvar(); atualizarModal(); } },
  equipar(el) { const r = equipar(P, el.dataset.id); if (r.ok) { salvar(); atualizarModal(); } else toast(r.msg); },
  desequipar(el) { desequipar(P, el.dataset.id); salvar(); atualizarModal(); },
  usar(el) {
    const msg = usarConsumivel(P, el.dataset.id);
    if (msg) { salvar(); atualizarModal(); toast(msg); } else toast('Sem efeito agora.');
  },
};

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const f = ACOES[el.dataset.a];
  if (f) f(el);
});

document.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target && ev.target.id === 'nome') ACOES.comecar();
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline é opcional */ });
}

telaTitulo();
