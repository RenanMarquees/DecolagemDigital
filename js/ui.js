'use strict';
/* ============================================================
   TELAS E TOQUES — desenha o jogo na página usando as regras de logic.js
   ============================================================ */

const SAVE_KEY = 'fio_do_destino_v1';
const app = document.getElementById('app');
const modal = document.getElementById('modal');

let P = null;          // jogador
let B = null;          // batalha atual
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
  REINO = null; B = null;
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
  REINO = null; B = null;
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

/* ---------- batalha ---------- */
function iniciarBatalha(idInimigo) {
  B = criarBatalha(idInimigo);
  RES = null; SUB = 'main';
  logar(B, `${B.inim.icone} ${B.inim.nome} aparece!`, 'info');
  if (B.inim.especial && B.inim.chefe) logar(B, `Cuidado: ele usa ${B.inim.especial.nome} a cada ${B.inim.especial.cada} turnos.`, 'aviso');
  telaBatalha();
}

function telaBatalha() {
  const d = derivados(P);
  const e = B.inim;
  const logHtml = B.log.slice(-7).map(l => `<p class="l-${l.cls}">${esc(l.msg)}</p>`).join('');
  app.innerHTML = `<div class="tela batalha reino-${REINO.id}">
    <div class="lado inim ${e.chefe ? 'chefe' : ''}">
      <div class="nome">${esc(e.nome)}</div>
      ${barra('hp inimigo', e.hp, e.hpMax)}
      <div class="sprite" id="sp-inim">${e.icone}</div>
    </div>
    <div class="log" id="log">${logHtml}</div>
    <div class="lado jog" id="lado-jog">
      <div class="nome">${CLASSES[P.classe].icone} ${esc(P.nome)} · Nv ${P.nivel} ${B.buff ? '<span class="buff">📣 +dano</span>' : ''}${B.defendendo ? '' : ''}</div>
      ${barra('hp', P.hp, d.hpMax, '❤️ ')}
      ${barra('mp', P.mp, d.mpMax, '💧 ')}
    </div>
    <div class="acoes" id="acoes">${acoesHtml(d)}</div>
  </div>`;
  const lg = document.getElementById('log');
  if (lg) lg.scrollTop = lg.scrollHeight;
  mostrarFx();
}

function acoesHtml(d) {
  if (B.fim === 'vitoria') return painelVitoria();
  if (B.fim === 'derrota') {
    return `<div class="fim"><h3>💀 Você caiu</h3><p>Os deuses te trazem de volta, mas perdem 20% do seu ouro.</p>
      <button class="btn grande" data-a="bat-fim">Despertar</button></div>`;
  }
  if (SUB === 'habs') {
    const habs = CLASSES[P.classe].habilidades.map(id => ({ id, ...HABILIDADES[id] }));
    return `<div class="sub-menu">${habs.map(h => {
      const bloq = h.nivel > P.nivel, semMp = P.mp < h.custo;
      return `<button class="btn hab" data-a="bat-hab" data-id="${h.id}" ${bloq || semMp ? 'disabled' : ''}>
        <span>${h.icone} ${h.nome}</span><small>${bloq ? `🔒 Nível ${h.nivel}` : `💧 ${h.custo} · ${h.desc}`}</small></button>`;
    }).join('')}<button class="btn link" data-a="bat-voltar">← Voltar</button></div>`;
  }
  if (SUB === 'itens') {
    const cons = Object.keys(P.inv).filter(id => ITENS[id].tipo === 'consumivel');
    return `<div class="sub-menu">${cons.length ? cons.map(id => {
      const it = ITENS[id];
      return `<button class="btn hab" data-a="bat-item" data-id="${id}"><span>${it.icone} ${it.nome} ×${qtd(P, id)}</span><small>${it.desc}</small></button>`;
    }).join('') : '<p class="vazio">Sem consumíveis.</p>'}<button class="btn link" data-a="bat-voltar">← Voltar</button></div>`;
  }
  return `<div class="grade-acoes">
    <button class="btn" data-a="bat-atacar">⚔️ Atacar</button>
    <button class="btn" data-a="bat-habs">✨ Habilidades</button>
    <button class="btn" data-a="bat-itens">🎒 Itens</button>
    <button class="btn" data-a="bat-defender">🛡️ Defender</button>
    <button class="btn sec span2" data-a="bat-fugir" ${B.inim.chefe ? 'disabled' : ''}>🏃 Fugir</button>
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

function mostrarFx() {
  if (!B || !B.fx) return;
  for (const f of B.fx) {
    const alvo = document.getElementById(f.alvo === 'inimigo' ? 'sp-inim' : 'lado-jog');
    if (!alvo) continue;
    const s = document.createElement('span');
    s.className = 'flutua' + (f.cura ? ' cura' : '') + (f.crit ? ' crit' : '') + (f.forte ? ' forte' : '');
    s.textContent = f.esquiva ? 'Esquivou!' : (f.cura ? '+' : '-') + f.v;
    alvo.appendChild(s);
    setTimeout(() => s.remove(), 1000);
    if (!f.cura && !f.esquiva) { alvo.classList.add('treme'); setTimeout(() => alvo.classList.remove('treme'), 350); }
  }
  B.fx = [];
}

function jogada(acao) {
  const r = jogarTurno(B, P, acao);
  if (r === 'invalido') { telaBatalha(); return; }
  SUB = 'main';
  if (r === 'vitoria') {
    RES = aplicarVitoria(B, P);
    logar(B, `${B.inim.nome} foi derrotado!`, 'info');
  }
  if (r === 'derrota') logar(B, 'Sua visão escurece...', 'erro');
  salvar();
  telaBatalha();
  if (r === 'fugiu') setTimeout(telaReino, 600);
}

function fimBatalha() {
  const b = B;
  if (b.fim === 'derrota') { penalidadeDerrota(P); salvar(); telaReino(); toast('Você acordou no acampamento.'); return; }
  if (b.fim !== 'vitoria') { telaReino(); return; }
  const e = b.inim;
  if (e.chefe && RES.primeira) {
    const ultimo = b.id === 'caos';
    historia(e.falaDepois.concat(RES.itens.includes(e.reliquia) ? [{ icone: ITENS[e.reliquia].icone, texto: `Você recebeu a relíquia lendária: ${ITENS[e.reliquia].nome}!` }] : []), () => {
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
  if (!B && P) { const t = app.querySelector('.topo'); if (t) t.outerHTML = statusTopo(); const bd = app.querySelector('.badge'); if (bd && P.pontos <= 0) bd.remove(); }
}

/* ---------- ações (toques) ---------- */
const ACOES = {
  novo() { if (carregar() && !confirm('Isso apaga o jogo salvo. Começar um novo?')) return; telaCriar(); },
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
  explorar() {
    const id = REINO.inimigos[Math.floor(Math.random() * REINO.inimigos.length)];
    iniciarBatalha(id);
  },
  chefe() {
    const e = INIMIGOS[REINO.chefe];
    if (P.hp < derivados(P).hpMax * 0.5 && !confirm('Sua vida está baixa. Desafiar mesmo assim?')) return;
    if (P.derrotados[REINO.chefe]) { iniciarBatalha(REINO.chefe); return; }
    historia(e.falaAntes, () => iniciarBatalha(REINO.chefe));
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

  // batalha
  'bat-atacar'() { jogada({ tipo: 'atacar' }); },
  'bat-defender'() { jogada({ tipo: 'defender' }); },
  'bat-fugir'() { jogada({ tipo: 'fugir' }); },
  'bat-habs'() { SUB = 'habs'; telaBatalha(); },
  'bat-itens'() { SUB = 'itens'; telaBatalha(); },
  'bat-voltar'() { SUB = 'main'; telaBatalha(); },
  'bat-hab'(el) { jogada({ tipo: 'habilidade', id: el.dataset.id }); },
  'bat-item'(el) { jogada({ tipo: 'item', id: el.dataset.id }); },
  'bat-fim'() { fimBatalha(); },

  // janelas
  personagem() { modalPersonagem(); },
  inventario() { modalInventario(); },
  fechar() { MODAL_ATUAL = null; fecharModal(); if (!B && REINO) telaReino(); else if (!B && P && !HIST) telaMapa(); },
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
