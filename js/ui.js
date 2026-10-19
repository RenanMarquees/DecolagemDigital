'use strict';
/* ============================================================
   TELAS E TOQUES — desenha o jogo na página usando as regras de logic.js e tatica.js.
   O mapa de batalha em 3D é desenhado por cena3d.js; aqui ficam os botões, painéis e textos.
   ============================================================ */

const SAVE_KEY = 'fio_do_destino_v1';
const app = document.getElementById('app');
const modal = document.getElementById('modal');

let P = null;          // jogador
let T = null;          // etapa de batalha atual
let MODO = null;       // ação à espera de alvo: {tipo:'atacar'} ou {tipo:'hab', id}
let OCUPADO = false;   // true enquanto os inimigos jogam
let RES = null;        // resultado da última etapa vencida
let REINO = null;      // reino aberto (objeto de REINOS)
let CEN = null;        // cenário aberto na tela de preparação
let HIST = null;       // história em andamento
let SUB = 'main';      // submenu da batalha: main | habs | itens
let LOJA_ABA = 'comprar';
let TOAST_T = null;
let ARM_AVISO = null;  // hexágono perigoso já avisado (o 2º toque confirma)
let ATOR_TIPO = null;  // tipo de inimigo que está agindo agora (destaca a carta dele)
const dormir = ms => new Promise(r => setTimeout(r, window.TESTE_RAPIDO ? 1 : ms));   // TESTE_RAPIDO: só os testes automáticos ligam

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
    return p && p.classe && CLASSES[p.classe] ? migrarSave(p) : null;
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

/** Os 4 botões de dificuldade (usados no mapa dos reinos e na preparação do cenário). */
function chipsDificuldade() {
  return `<div class="dificuldades">${Object.entries(DIFICULDADES).map(([id, d]) =>
    `<button class="chip-dif ${P.dificuldade === id ? 'on' : ''}" data-a="dif" data-id="${id}">${d.icone}<span>${d.nome}</span></button>`).join('')}</div>`;
}

/* ---------- história ---------- */
function historia(paginas, depois) {
  if (!paginas.length) { depois(); return; }
  HIST = { paginas, i: 0, depois };
  telaHistoria();
}
function telaHistoria() {
  Cena3D.destruir();
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
  Cena3D.destruir();
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
  Cena3D.destruir();
  REINO = null; T = null; CEN = null;
  salvar();
  app.innerHTML = `<div class="tela mapa">
    ${statusTopo()}
    <div class="corpo">
      <h2>Reinos dos Deuses</h2>
      <div class="fragmentos">${[0, 1, 2, 3].map(i => `<span class="${P.fragmentos[i] ? 'on' : ''}" title="${esc(P.fragmentos[i] || 'Fragmento ainda oculto')}">${P.fragmentos[i] ? '🔶' : '◇'}</span>`).join('')}<small>Fragmentos do Destino</small></div>
      <div class="rotulo-dif">Dificuldade</div>
      ${chipsDificuldade()}
      ${REINOS.map((r, i) => {
        const livre = reinoDesbloqueado(P, i);
        const lista = cenariosDoReino(r.id);
        const feitos = lista.filter(c => P.cenarios[c.id]).length;
        const dica = i > 0 ? `Conclua "${cenariosDoReino(REINOS[i - 1].id).slice(-1)[0].nome}" para abrir` : '';
        return `<button class="card-reino reino-${r.id}" data-a="reino" data-id="${r.id}" ${livre ? '' : 'disabled'}>
          <span class="ico-g">${livre ? r.icone : '🔒'}</span>
          <span class="txt"><b>${r.nome}</b><small>${livre ? `Cenários ${lista[0].id}–${lista[lista.length - 1].id} · concluídos ${feitos}/${lista.length}` : dica}</small></span>
          <span class="selo">${feitos === lista.length ? '✅' : ''}</span>
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

/* ---------- reino: lista de cenários ---------- */
function telaReino() {
  Cena3D.destruir();
  const r = REINO;
  T = null; CEN = null;
  salvar();
  app.innerHTML = `<div class="tela reino reino-${r.id}">
    ${statusTopo()}
    <div class="corpo">
      <div class="banner"><span>${r.icone}</span><h2>${r.nome}</h2></div>
      <p class="intro">${esc(r.intro)}</p>
      <div class="lista-cen">
        ${cenariosDoReino(r.id).map(c => {
          const liberado = cenarioDesbloqueado(P, c), feito = !!P.cenarios[c.id], o = OBJETIVOS[c.objetivo];
          return `<button class="card-cen ${feito ? 'feito' : ''}" data-a="cenario" data-id="${c.id}" ${liberado ? '' : 'disabled'}>
            <span class="num">${liberado ? c.id : '🔒'}</span>
            <span class="txt"><b>${esc(c.nome)}</b><small>${o.icone} ${o.nome} · ${c.etapas.length} etapas</small></span>
            <span class="selo">${feito ? '✅' : liberado ? '▶' : ''}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="acoes-reino">
        ${r.mercador ? `<button class="btn" data-a="loja">🛒 ${esc(r.mercador.nome.split(',')[0])}</button>` : ''}
        <button class="btn" data-a="acampar">🏕️ Acampar (🪙 ${r.descanso})</button>
        <button class="btn link" data-a="mapa">← Mapa dos reinos</button>
      </div>
    </div>
    ${rodapeNav()}
  </div>`;
}

/* ---------- preparação do cenário ---------- */
function telaBriefing() {
  Cena3D.destruir();
  const c = CEN, r = REINO, o = OBJETIVOS[c.objetivo];
  const res = resumoCenario(c, P, P.dificuldade);
  const d = derivados(P);
  const chefe = c.objetivo === 'chefe' ? INIMIGOS[r.chefe] : null;
  app.innerHTML = `<div class="tela reino reino-${r.id}">
    ${statusTopo()}
    <div class="corpo">
      <div class="cen-topo"><span class="num-g">${c.id}</span><div><small>Cenário ${c.id} de ${CENARIOS.length} · ${r.nome}</small><h2>${esc(c.nome)}</h2></div></div>
      <p class="intro">${esc(c.texto)}</p>
      <div class="caixa-obj"><span class="ico-g">${o.icone}</span><div><b>Objetivo: ${o.nome}</b><small>${esc(o.dica)}</small></div></div>
      <div class="detalhes-cen">
        <span>🚪 ${c.etapas.length} etapas</span>
        <span>🧰 1 baú</span>
        <span>${ARMADILHAS[r.armadilha].icone} ${ARMADILHAS[r.armadilha].nome.replace('Armadilha ', 'armadilhas ').replace('armadilhas de', 'armadilhas de').replace('armadilhas venenosa', 'armadilhas venenosas')}</span>
        ${chefe ? `<span>${chefe.icone} ${esc(chefe.nome.split(',')[0])}</span>` : ''}
      </div>
      <div class="rotulo-dif">Dificuldade</div>
      ${chipsDificuldade()}
      <div class="resumo-dif">
        <span>Nível do cenário <b>${res.nivel}</b></span>
        <span>Força dos inimigos <b>${Math.round(res.stat * 100)}%</b></span>
        <span>Recompensas <b>×${res.rec.toFixed(2)}</b></span>
        <span>Você <b>Nv ${P.nivel}</b> · ❤️ ${P.hp}/${d.hpMax}</span>
      </div>
      <p class="dica">O nível do cenário sobe a cada 2 níveis seus, e os inimigos ficam mais fortes junto.</p>
      <div class="acoes-reino">
        <button class="btn grande" data-a="iniciar">⚔️ Começar o cenário</button>
        <button class="btn link" data-a="voltar-reino">← Voltar</button>
      </div>
    </div>
  </div>`;
}

/* ---------- loja ---------- */
function telaLoja() {
  Cena3D.destruir();
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

/* ---------- batalha tática em 3D ---------- */
function iniciarBatalha() {
  const exp = criarExpedicao(CEN, P, P.dificuldade);
  T = criarTatica(exp, P);
  RES = null; SUB = 'main'; MODO = null; OCUPADO = false; ARM_AVISO = null; ATOR_TIPO = null;
  telaTatica();
}

function telaTatica() {
  app.innerHTML = `<div class="tela tatica reino-${T.reinoId}">
    <div class="tat-topo"><span class="tat-nome">📍 <b>${esc(T.nomeSala)}</b></span><span id="rod"></span></div>
    <div id="obj" class="obj"></div>
    <div class="tabuleiro">
      <div class="cena3d" id="cena3d"></div>
      <div class="mapa-botoes">
        <button class="btn-mapa" data-a="tat-zoom-mais" aria-label="Aproximar">＋</button>
        <button class="btn-mapa" data-a="tat-zoom-menos" aria-label="Afastar">－</button>
        <button class="btn-mapa" data-a="tat-girar" aria-label="Girar o mapa">↻</button>
        <button class="btn-mapa" data-a="tat-centro" aria-label="Centralizar no herói">🎯</button>
      </div>
    </div>
    <div id="hud"></div>
  </div>`;
  Cena3D.montar(document.getElementById('cena3d'), T, { onHex: (c, r) => ACOES.hex({ dataset: { c, r } }) });
  atualizarTudo();
}

function atualizarTudo() { atualizarTabuleiro(); atualizarHud(); }

/** Alvos possíveis do modo atual (para destacar em vermelho). */
function alvosDoModo() {
  if (!MODO) return [];
  return tAlvos(T, P, MODO.tipo === 'atacar' ? { tipo: 'atacar' } : { tipo: 'habilidade', id: MODO.id });
}

function atualizarTabuleiro() {
  if (!T) return;
  const alc = new Set(), alvos = new Set(), perigo = new Set();
  if (T.fase === 'heroi' && !T.fim && !OCUPADO) {
    if (MODO) alvosDoModo().forEach(e => alvos.add(chave(e.c, e.r)));
    else {
      if (T.movRest > 0) tAlcance(T).forEach(h => { alc.add(chave(h.c, h.r)); if (h.armadilhas > 0) perigo.add(chave(h.c, h.r)); });
      // sem ação pendente, os inimigos ao alcance do ataque básico também brilham
      if (!T.acaoUsada) tAlvos(T, P, { tipo: 'atacar' }).forEach(e => alvos.add(chave(e.c, e.r)));
    }
  }
  Cena3D.sincronizar(T, P, { alc, alvos, perigo });
}

function mostrarFxT() {
  if (!T || !T.fx.length) return;
  Cena3D.fx(T.fx);
  T.fx = [];
}
const centralizar = pos => Cena3D.centralizar(pos.c, pos.r);
const garantirVisivel = pos => Cena3D.garantirVisivel(pos.c, pos.r);

/** Texto do objetivo da etapa, com o andamento. */
function objetivoHtml() {
  const comb = combatentes(T).length, estr = T.inim.filter(e => e.vivo && e.estrutura).length;
  const total = T.inim.filter(e => e.estrutura).length;
  const moedas = [...T.moedas.values()].reduce((a, m) => a + m.valor, 0);
  let txt;
  if (T.objetivoCumprido && T.ultimaEtapa) txt = '✅ <b>Objetivo cumprido!</b> Saqueie o que sobrou e conclua o cenário.';
  else if (!T.ultimaEtapa) txt = T.livre ? '🚪 <b>Sala limpa:</b> vá até a porta.' : `🚪 <b>Limpe a sala</b> para abrir a porta · inimigos: ${comb}`;
  else if (T.objetivo === 'matar_todos') txt = `☠️ <b>Derrote todos os inimigos</b> · restam ${comb}`;
  else if (T.objetivo === 'bau') txt = T.bau && T.bau.aberto ? '🧰 <b>Baú aberto!</b>' : '🧰 <b>Abra o baú:</b> termine o turno parado em cima dele';
  else if (T.objetivo === 'destruir') txt = `🏗️ <b>Destrua as estruturas</b> · ${total - estr}/${total}`;
  else { const b = T.inim.find(e => e.chefe); txt = `👑 <b>Derrote ${esc(b ? b.nome.split(',')[0] : 'o chefe')}</b>${b && b.vivo ? ` · ❤️ ${Math.round(pct(b.hp, b.hpMax))}%` : ''}`; }
  const extras = [moedas ? `🪙 no chão: ${moedas}` : '', T.bau && !T.bau.aberto && T.objetivo !== 'bau' ? '🧰 baú no mapa' : ''].filter(Boolean).join(' · ');
  return `${txt}${extras ? `<small>${extras}</small>` : ''}`;
}

/** Cartas dos inimigos: uma por TIPO, mostrando o que ele vai fazer nesta rodada. */
function cartasHtml() {
  const tipos = [];
  for (const e of combatentes(T)) if (!tipos.includes(e.tipo)) tipos.push(e.tipo);
  const cartas = tipos.map(tipo => {
    const grupo = combatentes(T).filter(e => e.tipo === tipo), ref = grupo[0], c = T.cartas[tipo];
    if (!c) return '';
    const movEf = c.mov === undefined ? 0 : Math.max(1, ref.mov + c.mov), alcEf = Math.max(1, ref.alc + (c.alc || 0));
    const atqEf = c.atq === undefined ? null : Math.round(ref.atk * Math.max(0.3, 1 + 0.15 * c.atq));
    const numeros = [c.mov !== undefined ? `👣 ${movEf}` : '', atqEf !== null ? `⚔️ ${atqEf}` : '', atqEf !== null ? `🎯 ${alcEf}` : ''].filter(Boolean).join('  ');
    return `<div class="carta-inim ${ref.chefe ? 'chefe' : ''} ${ATOR_TIPO === tipo ? 'agindo' : ''}" style="--cor:${Cena3D.corDoTipo(tipo)}">
      <div class="carta-topo"><span class="ini" title="Iniciativa: quem tem número menor age primeiro">${c.ini}</span>${miniIcone(ref.id, 28)}<b>${esc(ref.nome.split(',')[0])}</b>${grupo.length > 1 ? `<em>×${grupo.length}</em>` : ''}</div>
      <div class="carta-nome">🃏 ${esc(c.nome)}</div>
      <ul class="efeitos">${descreverCarta(c).map(d => `<li>${d.icone} ${d.texto}</li>`).join('')}</ul>
      ${numeros ? `<div class="carta-num">${numeros}</div>` : ''}
      <div class="vidas">${grupo.map(e => `<div class="barra hp inimigo mini"><i style="width:${pct(e.hp, e.hpMax)}%"></i><span>${e.hp}/${e.hpMax}${e.efeitos.map(ef => (ef.tipo === 'gelo' ? '❄️' : '☠️')).join('')}</span></div>`).join('')}</div>
    </div>`;
  }).join('');
  const estr = T.inim.filter(e => e.vivo && e.estrutura);
  const estrHtml = estr.length ? `<div class="carta-inim estrutura" style="--cor:#8a8a99">
      <div class="carta-topo">${miniIcone(estr[0].id, 28)}<b>${esc(estr[0].nome)}</b><em>×${estr.length}</em></div>
      <div class="carta-nome">🏗️ Estrutura: não ataca nem anda</div>
      <div class="vidas">${estr.map(e => `<div class="barra hp inimigo mini"><i style="width:${pct(e.hp, e.hpMax)}%"></i><span>${e.hp}/${e.hpMax}</span></div>`).join('')}</div>
    </div>` : '';
  return cartas + estrHtml;
}

function hudHtml() {
  const d = derivados(P);
  const meuTurno = T.fase === 'heroi' && !T.fim && !OCUPADO;
  const etiquetas = [
    T.buff ? `<span class="tag ouro">📣 +dano (${T.buff.turnos})</span>` : '',
    T.defendendo ? '<span class="tag">🛡️ defendendo</span>' : '',
    ...T.efeitos.map(ef => `<span class="tag efeito">${ef.tipo === 'gelo' ? '❄️ gelo' : '☠️ veneno'} (${ef.turnos})</span>`),
  ].join('');
  const cartas = T.livre ? '' : cartasHtml();
  const defArm = T.tipoArm && T.armadilhas.size ? ARMADILHAS[T.tipoArm] : null;
  const log = T.log.slice(-3).map(l => `<p class="l-${l.cls}">${esc(l.msg)}</p>`).join('');
  return `<div class="hud-heroi">
      <div class="hud-linha">${miniIcone(P.classe, 30)}<b>${esc(P.nome)} · Nv ${P.nivel}</b>${etiquetas}<span class="cen-tag">${DIFICULDADES[T.exp.difId].icone} Nv do cenário ${T.exp.nivelCen}</span></div>
      ${barra('hp', P.hp, d.hpMax, '❤️ ')}${barra('mp', P.mp, d.mpMax, '💧 ')}
      <div class="hud-linha pontos-turno">${T.livre
        ? `<span class="on">${T.ultimaEtapa ? '🪙 Saqueie e conclua o cenário' : '🚪 Sala limpa: vá até a porta'}</span><span class="on">🪙 ${P.gold}</span>`
        : `<span class="${T.movRest > 0 ? 'on' : ''}">👣 Mover ${T.movRest}/${movEfetivo(d.mov, T.efeitos)}</span>
        <span class="${T.acaoUsada ? '' : 'on'}">${T.acaoUsada ? '⚔️ Ação usada' : '⚔️ Ação livre'}</span><span class="on">🪙 ${P.gold}</span>`}
      </div>
    </div>
    ${cartas ? `<div class="cartas-titulo">🃏 Cartas dos inimigos nesta rodada</div><div class="cartas">${cartas}</div>` : ''}
    ${defArm ? `<div class="dica-arm" style="--cor:${defArm.cor}">${defArm.icone} <b>${defArm.nome}</b> · ${defArm.desc} <small>(${T.armadilhas.size} no mapa)</small></div>` : ''}
    <div class="log" id="log">${log}</div>
    <div class="acoes" id="acoes">${acoesHtml(meuTurno)}</div>`;
}

function atualizarHud() {
  const hud = document.getElementById('hud');
  if (!hud || !T) return;
  hud.innerHTML = hudHtml();
  const obj = document.getElementById('obj');
  if (obj) obj.innerHTML = objetivoHtml();
  const rod = document.getElementById('rod');
  if (rod) rod.innerHTML = `Etapa ${T.etapa}/${T.totalEtapas} · ` + (T.livre ? '<b>Sala limpa</b>' : `Rodada ${T.rodada} · ${OCUPADO || T.fase === 'inimigos' ? '<b class="ini">Inimigos agindo…</b>' : '<b>Seu turno</b>'}`);
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
  if (T.livre) {
    return `<div class="grade-acoes">
      <button class="btn" data-a="tat-itens">🎒 Itens</button>
      ${T.ultimaEtapa ? '<button class="btn fim-turno" data-a="bat-fim">✅ Concluir cenário</button>' : '<button class="btn fim-turno" data-a="tat-porta">🚪 Ir até a porta</button>'}
      <button class="btn sec span2" data-a="tat-fugir" ${naSaida ? '' : 'disabled'}>↩️ Sair do cenário <small>(só na entrada)</small></button>
    </div>`;
  }
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
  const ultima = T.ultimaEtapa;
  const sobras = [r.moedasNoChao ? `🪙 ${r.moedasNoChao} moedas no chão` : '', r.bauFechado ? '🧰 o baú ainda está fechado' : ''].filter(Boolean).join(' · ');
  const botoes = ultima
    ? `${sobras ? '<button class="btn" data-a="tat-saquear">🪙 Saquear o que ficou</button>' : ''}<button class="btn grande" data-a="bat-fim">✅ Concluir cenário</button>`
    : '<button class="btn grande" data-a="tat-seguir">🚪 Abrir a porta</button>';
  return `<div class="fim"><h3>${ultima ? '🏆 Objetivo cumprido!' : `✅ Sala limpa! Etapa ${T.etapa}/${T.totalEtapas}`}</h3>
    <p>+${r.xp} XP</p>${itens ? `<p class="drops">${itens}</p>` : ''}${subidas}
    ${sobras ? `<p class="sobras">${sobras}${ultima ? '' : ' (pare em cima para pegar)'}</p>` : ''}
    ${botoes}</div>`;
}

/* Depois de qualquer ação: salva, mostra números flutuantes e confere se a etapa acabou. */
function depoisDaAcao(ok) {
  if (!ok && T.log.length) {
    const ult = T.log[T.log.length - 1];
    if (ult.cls === 'erro') toast(ult.msg);
  }
  if (T.fim === 'vitoria' && !RES) RES = aplicarVitoriaT(T, P);
  salvar();
  mostrarFxT();
  atualizarTudo();
  if (T.fim === 'porta') { entrarPorta(); return; }
  if (T.fim === 'fugiu') { toast('Você escapou! 🚪'); setTimeout(() => { if (T && T.fim === 'fugiu') { T = null; telaReino(); } }, 500); return; }
  conferirAutoFim();
}

/** Sem movimento e sem ação, não sobra nada a fazer: encerra o turno sozinho. */
function conferirAutoFim() {
  const t = T;
  if (t && t.fase === 'heroi' && !t.fim && !t.livre && !OCUPADO && t.acaoUsada && t.movRest === 0) {
    setTimeout(() => { if (T === t && t.fase === 'heroi' && !t.fim && !OCUPADO) encerrarTurno(); }, 600);
  }
}

/** Anda até o hexágono. Se o caminho pisa em armadilha, avisa primeiro (o 2º toque no mesmo lugar confirma). */
function irPara(c, r) {
  const info = tAlcance(T).find(h => h.c === c && h.r === r);
  if (!info) return false;
  const k = chave(c, r);
  if (info.armadilhas > 0 && ARM_AVISO !== k) {
    ARM_AVISO = k;
    const def = ARMADILHAS[T.tipoArm];
    toast(temArmadilha(T, c, r) ? `${def.icone} ${def.nome}: ${def.desc} Toque de novo para pisar.` : `⚠️ O caminho passa por uma armadilha (${def.nome.toLowerCase()}). Toque de novo para ir assim mesmo.`);
    return true;
  }
  ARM_AVISO = null;
  tMover(T, P, c, r);
  salvar(); mostrarFxT(); atualizarTudo();
  if (T.fim === 'porta') { entrarPorta(); return true; }
  garantirVisivel(T.heroi);
  if (T.fim) { depoisDaAcao(true); return true; }
  if (!T.livre && T.bau && !T.bau.aberto && T.bau.c === T.heroi.c && T.bau.r === T.heroi.r) toast('🧰 Termine o turno aqui para abrir o baú.');
  conferirAutoFim();
  return true;
}

/** O herói atravessou a porta: mostra a transição e começa a próxima etapa. */
function entrarPorta() {
  const t = document.getElementById('toast'); if (t) t.classList.remove('on');
  const prox = tProximaEtapa(T, P);
  salvar();
  T = null; MODO = null; OCUPADO = false;
  const rec = prox.recuperou;
  const folego = rec.hp || rec.mp ? ` Você recupera o fôlego (${[rec.hp ? `+${rec.hp} vida` : '', rec.mp ? `+${rec.mp} mana` : ''].filter(Boolean).join(', ')}).` : '';
  const paginas = [];
  if (prox.chefeId) {
    const b = INIMIGOS[prox.chefeId];
    paginas.push({ icone: '🚪', texto: `A porta se abre para a arena final: ${prox.nomeSala}.${folego}` });
    if (!P.derrotados[prox.chefeId]) for (const f of b.falaAntes) paginas.push(f);
    else paginas.push({ icone: b.icone, texto: `${b.nome} aguarda de novo!` });
  } else {
    paginas.push({ icone: '🚪', texto: `Você atravessa a porta. Etapa ${prox.etapa} de ${prox.totalEtapas}: ${prox.nomeSala}. ${combatentes(prox).length} inimigos!${folego}` });
  }
  historia(paginas, () => { T = prox; RES = null; SUB = 'main'; ARM_AVISO = null; ATOR_TIPO = null; telaTatica(); });
}

function executar(acao, uid) {
  let ok = false;
  const alvo = uid !== undefined ? T.inim.find(e => e.uid === uid) : null;
  if (acao.tipo === 'atacar') ok = tAtacar(T, P, uid);
  else if (acao.tipo === 'hab') ok = tHabilidade(T, P, acao.id, uid);
  else if (acao.tipo === 'item') ok = tUsarItem(T, P, acao.id);
  else if (acao.tipo === 'defender') ok = tDefender(T, P);
  if (ok && alvo && (acao.tipo === 'atacar' || acao.tipo === 'hab')) Cena3D.investir('heroi', alvo.c, alvo.r);
  MODO = null; SUB = 'main';
  depoisDaAcao(ok);
}

async function encerrarTurno() {
  const t = T;
  if (!t || OCUPADO || !tEncerrarTurno(t, P)) return;
  MODO = null; SUB = 'main'; OCUPADO = true;
  atualizarTudo();
  if (t.fim) { OCUPADO = false; depoisDaAcao(true); return; }   // abriu o baú e cumpriu o objetivo
  mostrarFxT();
  while (T === t && t.fase === 'inimigos' && !t.fim) {
    await dormir(380);
    if (T !== t) return;
    const ator = tProximoInimigo(t, P);
    ATOR_TIPO = ator ? ator.tipo : null;
    atualizarTabuleiro();       // o inimigo desliza até o novo lugar
    if (ator) garantirVisivel(ator);
    await dormir(380);
    if (T !== t) return;
    if (ator && t.fx.some(f => f.de === ator.uid)) Cena3D.investir(ator.uid, t.heroi.c, t.heroi.r);
    mostrarFxT(); atualizarHud();
    await dormir(420);
  }
  if (T !== t) return;
  ATOR_TIPO = null;
  OCUPADO = false;
  depoisDaAcao(true);
}

/** Fim do cenário: recompensa aleatória, história do chefe (na 1ª vez), relíquia e, no cenário 20, o final do jogo. */
function fimBatalha() {
  const t = T, res = RES;
  T = null; MODO = null;
  if (t.fim === 'derrota') { penalidadeDerrota(P); salvar(); telaReino(); toast('Você acordou no acampamento.'); return; }
  if (!(t.objetivoCumprido && t.ultimaEtapa)) { telaReino(); return; }   // saiu sem cumprir o objetivo
  const rec = concluirCenario(t, P);
  salvar();
  const c = t.exp.cenario;
  const paginas = [];
  const chefe = t.chefeId ? INIMIGOS[t.chefeId] : null;
  if (chefe && res && res.primeira) {
    for (const f of chefe.falaDepois) paginas.push(f);
    if (res.itens.includes(chefe.reliquia)) paginas.push({ icone: ITENS[chefe.reliquia].icone, texto: `Você recebeu a relíquia lendária: ${ITENS[chefe.reliquia].nome}!` });
  }
  const premio = rec.tipo === 'gold' ? `+${rec.gold} moedas de ouro` : rec.tipo === 'xp' ? `+${rec.xp} de XP${rec.subidas.length ? ` (você chegou ao nível ${rec.subidas[rec.subidas.length - 1].nivel}!)` : ''}` : `o item ${ITENS[rec.id].nome} ${ITENS[rec.id].icone}`;
  paginas.push({ icone: '🏆', texto: `Cenário concluído: ${c.nome}! Recompensa: ${premio}.${rec.primeira ? '' : ' (cenário já concluído antes)'}` });
  historia(paginas, () => {
    if (c.id === CENARIOS.length) { P.finalizado = true; salvar(); historia(HISTORIA_FINAL, telaTitulo); }
    else if (chefe && res && res.primeira && P.fragmentos.length >= 4) historia([{ icone: '🌌', texto: 'O Abismo do Caos está aberto. Volte ao mapa dos reinos quando estiver pronto para o confronto final.' }], telaReino);
    else telaReino();
  });
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
  cenario(el) { CEN = cenarioPorId(+el.dataset.id); REINO = reinoPorId(CEN.reino); telaBriefing(); },
  dif(el) {
    P.dificuldade = el.dataset.id; salvar();
    if (CEN) telaBriefing(); else telaMapa();
  },
  iniciar() {
    if (P.hp < derivados(P).hpMax * 0.5) confirmar('Sua vida está baixa. Começar o cenário mesmo assim?', iniciarBatalha);
    else iniciarBatalha();
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
    if (irPara(c, r)) return;
    if (T.porta && !T.porta.aberta && c === T.porta.c && r === T.porta.r) { toast('🚪 A porta está trancada. Derrote todos os inimigos da sala!'); return; }
    if (temArmadilha(T, c, r)) { const def = ARMADILHAS[T.tipoArm]; toast(`${def.icone} ${def.nome}: ${def.desc}`); return; }
    if (T.bau && T.bau.c === c && T.bau.r === r) toast(T.bau.aberto ? '🧰 O baú já foi aberto.' : '🧰 Baú do tesouro: termine o turno parado em cima dele.');
    else if (T.moedas.has(chave(c, r))) toast(`🪙 ${T.moedas.get(chave(c, r)).valor} moedas: pare em cima para saquear.`);
  },
  'tat-seguir'() {
    if (!T || T.fim !== 'vitoria' || T.ultimaEtapa) return;
    tAbrirPorta(T);
    RES = null; ARM_AVISO = null;
    atualizarTudo();
    centralizar(T.porta);
    toast('🚪 A porta se abriu! Vá até ela.');
  },
  'tat-saquear'() {
    if (!T || T.fim !== 'vitoria' || !T.ultimaEtapa) return;
    tSaquear(T);
    ARM_AVISO = null;
    atualizarTudo();
    toast('🪙 Pare em cima das moedas (e do baú) para pegar.');
  },
  'tat-porta'() { if (T && T.livre && T.porta) { if (!irPara(T.porta.c, T.porta.r)) toast('Não dá para chegar até a porta daqui.'); } },
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
  'tat-fim'() { return encerrarTurno(); },
  'tat-zoom-mais'() { Cena3D.zoom(1.25); },
  'tat-zoom-menos'() { Cena3D.zoom(1 / 1.25); },
  'tat-girar'() { Cena3D.girar(60); },
  'tat-centro'() { if (T) centralizar(T.heroi); },
  'bat-fim'() { fimBatalha(); },

  // janelas
  personagem() { modalPersonagem(); },
  inventario() { modalInventario(); },
  fechar() { MODAL_ATUAL = null; fecharModal(); if (!T && CEN) telaBriefing(); else if (!T && REINO) telaReino(); else if (!T && P && !HIST) telaMapa(); },
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
