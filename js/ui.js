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
          <div class="mini-attr"><span>❤️ vida ${c.hpBase}</span><span>🃏 ${MAO_INICIAL} cartas</span></div>
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
      <button class="btn link" data-a="tut-reiniciar">❔ Rever o tutorial</button>
    </div>
    ${rodapeNav()}
  </div>`;
  Tutorial.checar('mapa');
  abrirEscolhaPendente();
}

/** Se o herói subiu de nível e ainda não escolheu a carta nova, abre a janela de escolha sozinha. */
function abrirEscolhaPendente() { if (P && P.escolhas.length && !modal.classList.contains('on')) modalCartaNivel(); }

function rodapeNav() {
  return `<nav class="rodape">
    <button data-a="personagem">🧙 Personagem${P.escolhas.length > 0 ? `<em class="badge">${P.escolhas.length}</em>` : ''}</button>
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
  Tutorial.checar('reino');
  abrirEscolhaPendente();
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
  Tutorial.checar('briefing');
}

/* ---------- loja ---------- */
/** Compara um item da loja com o que o herói usa no mesmo lugar: "▲ +1 vida, +2 dano" ou "▼ ...". */
function compararItem(id) {
  const it = ITENS[id];
  if (it.tipo === 'mochila') return '';
  return `<small class="melhor">${esc(descreverBonus(it) || 'sem efeito')} <i>(uso único por cenário)</i></small>`;
}

function telaLoja() {
  Cena3D.destruir();
  const r = REINO;
  const lista = LOJA_ABA === 'comprar'
    ? estoqueLoja(P, r).filter(id => { const it = ITENS[id]; return !it.classe || it.classe === P.classe; })
    : Object.keys(P.inv).filter(id => ITENS[id].preco > 0);
  const linhas = lista.map(id => {
    const it = ITENS[id];
    const etiqueta = `<small class="slot-etq">${SLOTS[it.tipo]}</small>`;
    if (LOJA_ABA === 'comprar') {
      return linhaItem(id, etiqueta + compararItem(id), `<button class="btn peq" data-a="comprar" data-id="${id}" ${P.gold < it.preco ? 'disabled' : ''}>🪙 ${it.preco}</button>`);
    }
    return linhaItem(id, etiqueta + `<small>Você tem: ${qtd(P, id)}</small>`, `<button class="btn peq sec" data-a="vender" data-id="${id}">🪙 ${precoVenda(id)}</button>`);
  }).join('') || '<p class="vazio">Nada por aqui.</p>';
  app.innerHTML = `<div class="tela loja reino-${r.id}">
    ${statusTopo()}
    <div class="corpo">
      <div class="mercador"><span>${r.mercador.icone}</span><p><b>${esc(r.mercador.nome)}</b><br><i>"${esc(r.mercador.fala)}"</i></p></div>
      <div class="abas">
        <button class="${LOJA_ABA === 'comprar' ? 'on' : ''}" data-a="aba-loja" data-id="comprar">Comprar</button>
        <button class="${LOJA_ABA === 'vender' ? 'on' : ''}" data-a="aba-loja" data-id="vender">Vender</button>
      </div>
      <p class="dica">Você leva: 1 na cabeça, 1 no peito, 1 nos pés, 2 nas mãos e ${tamanhoMochila(P.nivel)} na mochila. Compras de mochila entram sozinhas, se houver lugar.</p>
      <p class="dica">🛒 Equipamentos de nível ${tierDaLoja(P)} liberados. ${tierDaLoja(P) < 4 ? `Os melhores chegam em ${5 - (Object.keys(P.cenarios).length % 5)} cenário(s) concluído(s).` : 'Você já vê o melhor que os mercadores têm!'}</p>
      <div class="lista">${linhas}</div>
      <button class="btn link" data-a="voltar-reino">← Sair da loja</button>
    </div>
  </div>`;
  Tutorial.checar('loja');
}

/* ---------- batalha tática em 3D ---------- */
function iniciarBatalha() {
  const exp = criarExpedicao(CEN, P, P.dificuldade);
  T = criarTatica(exp, P);
  RES = null; SUB = 'main'; MODO = null; OCUPADO = false; ARM_AVISO = null; ATOR_TIPO = null;
  telaTatica();
}

let CARTA_SEL = null;   // carta de iniciativa tocada na mão (ainda não jogada)
let GAVETA = false;
let ESCOLHENDO_PERDA = false;   // janela para escolher qual carta se perde no descanso longo

function telaTatica() {
  T.escolhaForca = true;        // empurrar/puxar: o jogador escolhe para onde o inimigo vai
  CARTA_SEL = null; GAVETA = false; ESCOLHENDO_PERDA = false;
  app.innerHTML = `<div class="tela tatica reino-${T.reinoId}">
    <div class="tat-topo"><span class="tat-nome">📍 <b>${esc(T.nomeSala)}</b></span><span id="rod"></span></div>
    <div class="palco">
      <div class="cena3d" id="cena3d"></div>
      <div class="sobre-topo"><div id="iniciativa" class="ini-faixa"></div><div id="obj" class="obj"></div></div>
      <div class="mapa-botoes">
        <button class="btn-mapa" data-a="tat-zoom-mais" aria-label="Aproximar">＋</button>
        <button class="btn-mapa" data-a="tat-zoom-menos" aria-label="Afastar">－</button>
        <button class="btn-mapa" data-a="tat-girar" aria-label="Girar o mapa">↻</button>
        <button class="btn-mapa" data-a="tat-centro" aria-label="Centralizar no herói">🎯</button>
        <button class="btn-mapa" data-a="tat-gaveta" aria-label="Detalhes">📋</button>
      </div>
      <div id="dock" class="dock"></div>
      <div id="gaveta" class="gaveta"></div>
      <div id="modcarta" class="modcarta"></div>
      <div id="centro" class="centro"></div>
    </div>
  </div>`;
  Cena3D.montar(document.getElementById('cena3d'), T, { onHex: (c, r) => ACOES.hex({ dataset: { c, r } }) });
  atualizarTudo();
  ajustarMargens(true);
}

/** Joga a carta escolhida (ou o descanso longo, com a carta perdida) e segue a rodada. */
function jogarCartaEscolhida(id, perder) {
  CARTA_SEL = null; SUB = 'main'; MODO = null;
  if (!tEscolherCarta(T, P, id, perder)) { atualizarHud(); return; }
  Tutorial.evento('carta');
  if (T.fase === 'inimigos') rodarInimigos();      // alguém tem iniciativa menor que a sua
  else { mostrarFxT(); depoisDaAcao(true); }       // você é o primeiro
}

function atualizarTudo() { atualizarTabuleiro(); atualizarHud(); }

/** Diz ao mapa 3D quanto da tela está coberto pelos painéis (para o herói e os inimigos nunca ficarem escondidos). */
function ajustarMargens(reenquadrar) {
  const palco = document.querySelector('.palco'), dock = document.getElementById('dock'), topo = document.querySelector('.sobre-topo');
  if (!palco || !dock || !Cena3D.ativa()) return;
  const pr = palco.getBoundingClientRect(), dr = dock.getBoundingClientRect(), tr = topo.getBoundingClientRect();
  const lateral = dr.left > pr.left + pr.width * 0.4;                // paisagem: o painel fica na direita
  Cena3D.margens(Math.max(0, tr.bottom - pr.top), lateral ? 0 : Math.max(0, pr.bottom - dr.top), lateral ? Math.max(0, pr.right - dr.left) : 0, reenquadrar);
}
window.addEventListener('resize', () => { clearTimeout(ajustarMargens.t); ajustarMargens.t = setTimeout(() => { if (T && Cena3D.ativa()) ajustarMargens(true); }, 250); });

function alvosDoModo() { return MODO ? tAlvos(T, P) : []; }

function atualizarTabuleiro() {
  if (!T) return;
  const alc = new Set(), alvos = new Set(), perigo = new Set();
  const pend = T.fase === 'heroi' && !T.fim && !OCUPADO ? pendenciaForca(T) : null;
  if (pend) { pend.opcoes.forEach(o => alc.add(chave(o.c, o.r))); alvos.add(chave(pend.alvo.c, pend.alvo.r)); }   // escolher o lugar do empurrão/puxão
  else if (T.fase === 'heroi' && !T.fim && !OCUPADO) {
    if (MODO) alvosDoModo().forEach(e => alvos.add(chave(e.c, e.r)));
    else {
      if (T.movRest > 0) tAlcance(T).forEach(h => { alc.add(chave(h.c, h.r)); if (h.armadilhas > 0) perigo.add(chave(h.c, h.r)); });
      // sem ação pendente, os inimigos ao alcance do ataque básico também brilham
      if (!T.acaoUsada) tAlvos(T, P).forEach(e => alvos.add(chave(e.c, e.r)));
    }
  }
  Cena3D.sincronizar(T, P, { alc, alvos, perigo });
}

function mostrarFxT() {
  if (!T) return;
  if (T.modFx.length) { FILA_MOD.push(...T.modFx); T.modFx = []; proximaCartaMod(); }
  if (!T.fx.length) return;
  Cena3D.fx(T.fx);
  T.fx = [];
}

/* A carta de modificador de cada ataque aparece sozinha no meio do mapa (uma depois da outra) e some; o jogo não espera por ela. */
const FILA_MOD = [];
let CARTA_MOD_NA_TELA = false;
function proximaCartaMod() {
  const alvo = document.getElementById('modcarta');
  if (CARTA_MOD_NA_TELA || !alvo || !FILA_MOD.length) return;
  const m = FILA_MOD.shift(), c = m.carta;
  CARTA_MOD_NA_TELA = true;
  const resumo = c.tipo === 'bloqueio' ? (m.quem === 'heroi' ? 'Seu ataque falhou!' : `${esc(m.nome)} errou!`) : `${m.base} ${c.tipo === 'x2' ? '×2' : c.rotulo.replace('−', '−')} = <b>${m.golpe}</b>`;
  alvo.innerHTML = `<div class="modcarta-cx ${c.tipo} ${c.tipo === 'valor' ? (c.v > 0 ? 'bom' : c.v < 0 ? 'ruim' : 'neutro') : ''} ${m.quem}">
    <span class="mc-quem">${m.quem === 'heroi' ? '🎴 Seu ataque' : `🎴 ${esc(m.nome)}`}</span>
    <div class="mc-carta"><b>${c.rotulo}</b><small>${c.nome}</small></div>
    <span class="mc-res">${resumo}</span>${m.embaralhou ? '<span class="mc-emb">🔀 baralho embaralhado</span>' : ''}</div>`;
  setTimeout(() => { alvo.innerHTML = ''; CARTA_MOD_NA_TELA = false; proximaCartaMod(); }, FILA_MOD.length ? 900 : 1500);
}
/** Baralho de modificadores como fileira de cartinhas: as já viradas ficam apagadas até o próximo embaralhamento. */
function baralhoChips(b, ids) {
  const ordem = ['bloq', '-2', '-1', '0', '+1', '+2', '+3', '+4', 'x2'];
  const total = {}, resta = {};
  for (const id of (b ? b.todas : ids)) total[id] = (total[id] || 0) + 1;
  if (b) for (const id of b.compra) resta[id] = (resta[id] || 0) + 1;
  return `<div class="mods">${ordem.filter(id => total[id]).map(id => {
    const c = CARTAS_MOD[id], n = total[id], r = b ? (resta[id] || 0) : n;
    return `<span class="mod ${c.tipo} ${c.tipo === 'valor' ? (c.v > 0 ? 'bom' : c.v < 0 ? 'ruim' : 'neutro') : ''} ${r === 0 ? 'gasta' : ''}" title="${c.nome}"><b>${c.rotulo}</b>${n > 1 || b ? `<i>${b ? `${r}/${n}` : `×${n}`}</i>` : ''}</span>`;
  }).join('')}</div>`;
}
const centralizar = pos => Cena3D.centralizar(pos.c, pos.r);
const garantirVisivel = pos => Cena3D.garantirVisivel(pos.c, pos.r);

/** Texto do objetivo da etapa, com o andamento. */
function objetivoHtml() {
  const comb = combatentes(T).length, estr = T.inim.filter(e => e.vivo && e.estrutura).length;
  const total = T.inim.filter(e => e.estrutura).length;
  const moedas = [...T.moedas.values()].reduce((a, m) => a + m.valor, 0);
  let txt;
  if (T.limpa) txt = T.ultimaEtapa ? '✅ <b>Objetivo cumprido!</b> Pegue o que quiser e volte à entrada 🚪' : '✅ <b>Sala limpa:</b> pegue o que quiser e chegue até a porta 🚪';
  else if (!T.ultimaEtapa) txt = `🚪 <b>Limpe a sala</b> para poder chegar à porta · inimigos: ${comb}`;
  else if (T.objetivo === 'matar_todos') txt = `☠️ <b>Derrote todos os inimigos</b> · restam ${comb}`;
  else if (T.objetivo === 'bau') txt = T.bau && T.bau.aberto ? '🧰 <b>Baú aberto!</b>' : '🧰 <b>Abra o baú:</b> termine o turno parado em cima dele';
  else if (T.objetivo === 'destruir') txt = `🏗️ <b>Destrua as estruturas</b> · ${total - estr}/${total}`;
  else { const b = T.inim.find(e => e.chefe); txt = `👑 <b>Derrote ${esc(b ? b.nome.split(',')[0] : 'o chefe')}</b>${b && b.vivo ? ` · ❤️ ${Math.round(pct(b.hp, b.hpMax))}%` : ''}`; }
  const aviso = T.limpa && (moedas || (T.bau && !T.bau.aberto)) ? '⚠️ o que ficar para trás se perde' : '';
  const extras = [moedas ? `🪙 no chão: ${moedas}` : '', T.bau && !T.bau.aberto && T.objetivo !== 'bau' ? '🧰 baú no mapa' : '', aviso].filter(Boolean).join(' · ');
  return `${txt}${extras ? ` <small>· ${extras}</small>` : ''}`;
}

const sinalN = n => (n > 0 ? '+' + n : String(n));
/** Resumo em ícones de uma carta de inimigo (para a faixa de iniciativa). */
function resumoCarta(c, ref) {
  const mov = Math.max(1, ref.mov + (c.mov || 0)), atq = Math.max(0, ref.atk + (c.atq || 0) + (ref.bonusAtq || 0));
  const o = [c.mov === undefined ? '👣✕' : `👣${mov}`, c.atq === undefined ? '⚔️✕' : `⚔️${atq}`];
  if (c.atq !== undefined) o.push('🎯' + Math.max(1, ref.alc + (c.alc || 0)));
  if (c.curar) o.push('✚' + c.curar); if (c.fortalecer) o.push('💪'); if (c.escudo) o.push('🛡️');
  if (c.empurrarHeroi) o.push('💨'); if (c.puxarHeroi) o.push('🧲');
  return o.join(' ');
}

/** Faixa de iniciativa (estilo Gloomhaven): quem joga primeiro, da esquerda para a direita. Cada inimigo mostra a carta da rodada. */
function iniciativaHtml() {
  // antes de você escolher a sua carta, as dos monstros ficam OCULTAS: aparece só "?" (não dá para planejar em cima delas)
  if (T.fase === 'escolha' && !T.limpa) {
    const tipos = new Map();
    for (const e of combatentes(T)) { if (tipos.has(e.tipo)) tipos.get(e.tipo).n++; else tipos.set(e.tipo, { ref: e, n: 1 }); }
    const ocultos = [...tipos.entries()].map(([tipo, g]) => `<button class="ini-chip oculta ${g.ref.chefe ? 'chefe' : ''}" data-a="tat-gaveta" style="--cor:${Cena3D.corDoTipo(tipo)}" title="Carta oculta até você escolher a sua">
      <i class="n">?</i>${miniIcone(g.ref.id, 22)}<span class="ef">🂠</span>${g.n > 1 ? `<em>×${g.n}</em>` : ''}</button>`);
    const estr = T.inim.filter(e => e.vivo && e.estrutura);
    if (estr.length) ocultos.push(`<button class="ini-chip" data-a="tat-gaveta" style="--cor:#8a8a99">${miniIcone(estr[0].id, 22)}<span class="ef">×${estr.length}</span></button>`);
    return `<div class="ini-chip heroi pendente" title="Você"><i class="n">?</i>${miniIcone(P.classe, 22)}<span class="ef">Você</span></div>${ocultos.join('')}`;
  }
  const ordem = ordemDaRodada(T, null);
  const grupos = [], vistos = new Map();
  for (const it of ordem) {
    if (it.tipo === 'heroi') { grupos.push({ heroi: true, ini: it.ini }); continue; }
    const e = it.e;
    if (vistos.has(e.tipo)) { vistos.get(e.tipo).n++; continue; }
    const g = { heroi: false, tipo: e.tipo, ref: e, ini: it.ini, n: 1 }; vistos.set(e.tipo, g); grupos.push(g);
  }
  if (!grupos.some(g => g.heroi)) grupos.push({ heroi: true, ini: null, pendente: true });
  const emFila = new Set(T.fila.filter(x => x !== 'heroi'));
  const chips = grupos.map(g => {
    if (g.heroi) {
      const ativo = T.fase === 'heroi' && !T.fim, feito = T.heroiJogou;
      return `<div class="ini-chip heroi ${ativo ? 'ativo' : ''} ${feito ? 'feito' : ''} ${g.pendente ? 'pendente' : ''}" title="Você"><i class="n">${g.ini === null ? '?' : g.ini}</i>${miniIcone(P.classe, 22)}<span class="ef">Você</span></div>`;
    }
    const restam = T.inim.some(e => e.vivo && e.tipo === g.tipo && emFila.has(e.uid));
    const feito = T.fase !== 'escolha' && !restam, ativo = OCUPADO && ATOR_TIPO === g.tipo;
    return `<button class="ini-chip ${feito ? 'feito' : ''} ${ativo ? 'ativo' : ''} ${g.ref.chefe ? 'chefe' : ''}" data-a="tat-gaveta" data-tipo="${g.tipo}" style="--cor:${Cena3D.corDoTipo(g.tipo)}" title="${esc(T.cartas[g.tipo].nome)}">
      <i class="n">${g.ini}</i>${miniIcone(g.ref.id, 22)}<span class="ef">${resumoCarta(T.cartas[g.tipo], g.ref)}</span>${g.n > 1 ? `<em>×${g.n}</em>` : ''}</button>`;
  });
  const arm = T.tipoArm && T.armadilhas.size ? ARMADILHAS[T.tipoArm] : null;
  if (arm) chips.push(`<button class="ini-chip chip-arm" data-a="tat-gaveta" style="--cor:${arm.cor}" title="${esc(arm.nome)}"><span class="ef">${arm.icone} ×${T.armadilhas.size}</span></button>`);
  const estr = T.inim.filter(e => e.vivo && e.estrutura);
  if (estr.length) chips.push(`<button class="ini-chip" data-a="tat-gaveta" style="--cor:#8a8a99">${miniIcone(estr[0].id, 22)}<span class="ef">×${estr.length}</span></button>`);
  return chips.join('');
}

/** Cartas completas dos inimigos (com vida de cada um), para o painel de detalhes. */
function cartasHtml() {
  const tipos = [];
  for (const e of combatentes(T)) if (!tipos.includes(e.tipo)) tipos.push(e.tipo);
  const cartas = tipos.map(tipo => {
    const grupo = combatentes(T).filter(e => e.tipo === tipo), ref = grupo[0], c = T.cartas[tipo];
    if (!c) return `<div class="carta-inim oculta" style="--cor:${Cena3D.corDoTipo(tipo)}">
      <div class="carta-topo"><span class="ini">?</span>${miniIcone(ref.id, 28)}<b>${esc(ref.nome.split(',')[0])}</b>${grupo.length > 1 ? `<em>×${grupo.length}</em>` : ''}</div>
      <div class="carta-nome">🂠 Carta oculta</div><small>Revelada quando você escolher a sua.</small>
      <div class="vidas">${grupo.map(e => `<div class="barra hp inimigo mini"><i style="width:${pct(e.hp, e.hpMax)}%"></i><span>${e.hp}/${e.hpMax}${e.efeitos.map(ef => (ef.tipo === 'gelo' ? '❄️' : '☠️')).join('')}</span></div>`).join('')}</div></div>`;
    const movEf = c.mov === undefined ? 0 : Math.max(1, ref.mov + c.mov), alcEf = Math.max(1, ref.alc + (c.alc || 0));
    const atqEf = c.atq === undefined ? null : Math.max(0, ref.atk + c.atq + (ref.bonusAtq || 0));   // dano exato desta rodada
    const numeros = [c.mov !== undefined ? `👣 ${movEf}` : '', atqEf !== null ? `⚔️ ${atqEf} de dano` : '', atqEf !== null ? `🎯 alcance ${alcEf}` : ''].filter(Boolean).join('  ');
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

/** Painel de detalhes (abre pelo botão 📋 ou tocando numa carta da faixa): cartas dos inimigos, armadilhas e histórico. */
function gavetaHtml() {
  const defArm = T.tipoArm && T.armadilhas.size ? ARMADILHAS[T.tipoArm] : null;
  const log = T.log.slice(-8).map(l => `<p class="l-${l.cls}">${esc(l.msg)}</p>`).join('');
  const naSaida = T.heroi.c === T.saida.c && T.heroi.r === T.saida.r;
  return `<div class="gaveta-cab"><b>📋 Detalhes da batalha</b><button class="btn-x" data-a="tat-gaveta" aria-label="Fechar">✕</button></div>
    ${T.limpa ? '' : `<div class="cartas-titulo">🃏 Cartas dos inimigos ${T.fase === 'escolha' ? '(ocultas até você escolher a sua)' : 'nesta rodada'}</div><div class="cartas">${cartasHtml()}</div>`}
    ${defArm ? `<div class="dica-arm" style="--cor:${defArm.cor}">${defArm.icone} <b>${defArm.nome}</b> · ${defArm.desc} <small>(${T.armadilhas.size} no mapa)</small></div>` : ''}
    <div class="cartas-titulo">🎴 Baralhos de ataque (a sorte)</div>
    <div class="baralhos"><div><small>Seu baralho · ${T.exp.baralhos.heroi.compra.length} no monte</small>${baralhoChips(T.exp.baralhos.heroi)}</div>
      ${T.limpa ? '' : `<div><small>Baralho dos monstros · ${T.exp.baralhos.inim.compra.length} no monte</small>${baralhoChips(T.exp.baralhos.inim)}</div>`}
      <small class="dica-mod">Cada ataque vira uma carta sozinha. Só quando sai ×2 ou ✖ o baralho é embaralhado de novo.</small></div>
    <div class="cartas-titulo">Histórico</div><div class="log">${log}</div>
    ${!T.limpa && !T.chefeId ? `<button class="btn sec" data-a="tat-fugir" ${naSaida && (T.fase === 'heroi' || T.fase === 'escolha') && !OCUPADO ? '' : 'disabled'}>🚪 Fugir do cenário <small>${naSaida ? '' : '(só na entrada)'}</small></button>` : ''}`;
}

/** Uma carta da mão do herói. */
function cartaMaoHtml(c, sel, desabilitada = false, acao = 'tat-carta') {
  const efs = c.descanso
    ? `<span>✚ cura ${DESCANSO_CURA}</span><span>🗑️ perde 1 carta usada (você escolhe)</span>`
    : descreverCartaHeroi(c, derivados(P)).map(d => `<span>${d.icone} ${d.texto}</span>`).join('');
  return `<button class="cartaH ${sel ? 'sel' : ''} ${c.descanso ? 'desc' : ''}" data-a="${acao}" data-id="${c.id}" ${desabilitada ? 'disabled' : ''}>
    <i class="ini">${c.ini}</i><b>${esc(c.nome)}</b>
    <span class="efs">${efs}</span></button>`;
}
function maoHtml() {
  const ordenada = [...T.mao].sort((a, b) => a.ini - b.ini);
  const sel = CARTA_SEL === 'descanso' ? CARTA_DESCANSO : T.mao.find(c => c.id === CARTA_SEL);
  const naSaida = T.heroi.c === T.saida.c && T.heroi.r === T.saida.r;
  const podeDescansar = T.descarte.length >= 2;
  const longo = { ...CARTA_DESCANSO, id: 'descanso', nome: 'Descanso longo' };
  return `<div class="mao-topo"><span>🃏 ${T.mao.length} na mão · ${T.descarte.length} usadas · ${T.perdidas.length} perdidas</span>
      <span class="mao-bts"><button class="btn link peq" data-a="tat-itens">🎒 ${P.equip.mochila.length}</button><button class="btn peq sec" data-a="tat-rapido" ${podeDescansar && !T.rapidoUsado ? '' : 'disabled'} title="Perde 1 carta usada ao acaso; as outras voltam para a mão e você joga nesta rodada">⚡ Descanso rápido</button>${sel ? `<button class="btn jogar" data-a="tat-jogar">▶ ${CARTA_SEL === 'descanso' ? 'Descansar' : 'Jogar'} (ini ${sel.ini})</button>` : (naSaida && !T.chefeId && !T.limpa ? '<button class="btn link peq" data-a="tat-fugir">🚪 Fugir</button>' : '')}</span></div>
    <div class="mao">${ordenada.map(c => cartaMaoHtml(c, c.id === CARTA_SEL)).join('')}${cartaMaoHtml(longo, CARTA_SEL === 'descanso', !podeDescansar)}</div>`;
}

/** Janela para escolher qual carta usada se perde no descanso longo. */
function perdaHtml() {
  return `<div class="fim perda"><h3>💤 Descanso longo</h3>
    <p>Iniciativa 99 · você recupera ${DESCANSO_CURA} de vida e as cartas usadas voltam para a mão, menos <b>uma</b>, que se perde até o fim do cenário. Qual?</p>
    <div class="mao perda-lista">${T.descarte.map(c => cartaMaoHtml(c, false, false, 'tat-perder')).join('')}</div>
    <button class="btn link" data-a="tat-perder-cancelar">← Cancelar</button></div>`;
}

/** Barra de baixo: vida e, conforme a fase, a mão de cartas ou os atalhos de ação. */
function dockHtml() {
  const d = derivados(P), c = cartaAtual(T);
  const etiquetas = [
    T.bonusItem && T.bonusItem.atq ? `<span class="tag ouro">🪨 +${T.bonusItem.atq} dano</span>` : '',
    T.escudoHeroi ? `<span class="tag">🛡️ escudo ${T.escudoHeroi}</span>` : '',
    ...T.efeitos.map(ef => `<span class="tag efeito">${ef.tipo === 'gelo' ? '❄️ gelo' : '☠️ veneno'} (${ef.turnos})</span>`),
  ].join('');
  const ult = T.log[T.log.length - 1];
  const barras = `<div class="hud-heroi">
      <div class="hh-barras">${miniIcone(P.classe, 26)}${barra('hp', P.hp, d.hpMax, '❤️ ')}<span class="ouro-mini">🪙 ${P.gold}</span></div>
      <div class="pips">${(T.fase === 'heroi' ? `<span class="${T.movRest > 0 ? 'on' : ''}">👣 ${T.movRest}</span><span class="${T.acaoUsada || !c.atq ? '' : 'on'}">${!c.atq ? '⚔️ sem ataque' : T.acaoUsada ? '⚔️ ataque usado' : `⚔️ dano ${danoDoHeroi(T, P)}`}</span>` : '')}${T.cartaHeroi ? `<span class="on carta-atual">🃏 ${esc(T.cartaHeroi.nome)}</span>` : ''}${etiquetas}<button class="tag baralho-tag" data-a="tat-gaveta" title="Seu baralho de modificadores">🎴 ${T.exp.baralhos.heroi.compra.length}/${T.exp.baralhos.heroi.todas.length}</button>
        <span class="cen-tag">${DIFICULDADES[T.exp.difId].icone} Nv ${T.exp.nivelCen}</span></div>
    </div>`;
  const tick = ult ? `<div class="tick l-${ult.cls}">${esc(ult.msg)}</div>` : '';
  if (T.fim === 'vitoria' || T.fim === 'porta') return tick + barras;
  const pendF = pendenciaForca(T);
  if (pendF && !OCUPADO) return tick + barras + `<div class="alvo-msg forca"><span>${pendF.modo === 'puxar' ? '🧲' : '💨'} <b>Escolha para onde ${pendF.modo === 'puxar' ? 'puxar' : 'empurrar'} ${esc(pendF.alvo.nome.split(',')[0])}</b> (até ${pendF.n}): toque num hexágono destacado</span><button class="btn peq" data-a="tat-forca-pular">Deixar onde está</button></div>`;
  if (T.fim === 'derrota') return tick + barras;
  if (OCUPADO || T.fase === 'inimigos') return tick + barras + '<div class="aguarde">⏳ Os inimigos estão agindo…</div>';
  if (T.fase === 'escolha') return tick + barras + (SUB === 'itens' ? acoesHtml() : maoHtml());
  return tick + barras + acoesHtml();
}

function acoesHtml() {
  if (MODO) {
    return `<div class="alvo-msg"><span>🎯 Toque no inimigo destacado em vermelho</span><button class="btn peq" data-a="tat-cancelar">Cancelar</button></div>`;
  }
  const bt = (a, ic, txt, extra = '', cls = '') => `<button class="ac ${cls}" data-a="${a}" ${extra}><b>${ic}</b><span>${txt}</span></button>`;
  if (SUB === 'itens') {
    const m = P.equip.mochila, heroi = T.fase === 'heroi' && !T.fim;
    const equips = equipamentosUsaveis(P).map(q => {
      const it = ITENS[q.id], gasto = !!T.exp.equipGasto[q.chave];
      return `<button class="btn hab" data-a="tat-equip" data-k="${q.chave}" ${gasto || !heroi ? 'disabled' : ''}><span>${it.icone} ${it.nome} ${gasto ? '<small>✔ usado</small>' : ''}</span><small>${esc(descreverBonus(it))} · uso único por cenário${heroi ? '' : ' (só no seu turno)'}</small></button>`;
    }).join('');
    return `<div class="submenu"><p class="dica-sub">🛡️ Equipamento · cada peça pode ser usada <b>1 vez por cenário</b> (de graça, no seu turno)</p>${equips || '<p class="vazio">Nenhum equipamento vestido.</p>'}
      <p class="dica-sub">🎒 Mochila (${m.length}/${tamanhoMochila(P.nivel)}) · usar um item <b>não gasta</b> a sua jogada</p>${m.length ? m.map((id, i) => {
      const it = ITENS[id], vazio = !!(it.heal && !it.limpa && P.hp >= derivados(P).hpMax);
      return `<button class="btn hab" data-a="tat-item" data-i="${i}" ${vazio ? 'disabled' : ''}><span>${it.icone} ${it.nome}</span><small>${it.desc}</small></button>`;
    }).join('') : '<p class="vazio">Mochila vazia.</p>'}<button class="btn link peq" data-a="tat-voltar">← Voltar</button></div>`;
  }
  if (T.limpa) return `<div class="acoes-linha">${bt('tat-itens', '🎒', `Itens ${P.equip.mochila.length + equipamentosUsaveis(P).filter(q => !T.exp.equipGasto[q.chave]).length}`)}${bt('tat-fim', '⏭️', 'Encerrar', '', 'fim-turno')}</div>`;
  const c = cartaAtual(T);
  const podeAtacar = !!c.atq && !T.acaoUsada;
  return `<div class="acoes-linha">${bt('tat-atacar', '⚔️', c.atq ? `Atacar ${danoDoHeroi(T, P)}` : 'Sem ataque', podeAtacar ? '' : 'disabled')}${bt('tat-itens', '🎒', `Itens ${P.equip.mochila.length + equipamentosUsaveis(P).filter(q => !T.exp.equipGasto[q.chave]).length}`)}${bt('tat-fim', '⏭️', 'Encerrar', '', 'fim-turno')}</div>`;
}

function atualizarHud() {
  const dock = document.getElementById('dock');
  if (!dock || !T) return;
  dock.innerHTML = dockHtml();
  const ini = document.getElementById('iniciativa'); if (ini) ini.innerHTML = iniciativaHtml();
  const obj = document.getElementById('obj'); if (obj) obj.innerHTML = objetivoHtml();
  const gv = document.getElementById('gaveta'); if (gv) { gv.innerHTML = GAVETA ? gavetaHtml() : ''; gv.classList.toggle('aberta', GAVETA); }
  const centro = document.getElementById('centro');
  if (centro) {
    const painel = T.fim === 'vitoria' && RES ? painelVitoria() : (T.fim === 'derrota' ? derrotaHtml() : (ESCOLHENDO_PERDA ? perdaHtml() : (T.limpa && RES && !RES.visto && !T.fim ? painelVitoria() : '')));
    centro.innerHTML = painel; centro.classList.toggle('on', !!painel);
  }
  const rod = document.getElementById('rod');
  if (rod) rod.innerHTML = `Etapa ${T.etapa}/${T.totalEtapas} · ` + `Rodada ${T.rodada} · ${OCUPADO || T.fase === 'inimigos' ? '<b class="ini">Inimigos agindo</b>' : T.fase === 'escolha' ? '<b>Escolha a carta</b>' : '<b>Seu turno</b>'}${T.limpa ? ' · <b>sala limpa</b>' : ''}`;
  ajustarMargens('offset');
  Tutorial.checar('batalha');
}

function derrotaHtml() {
  const perdidas = T.exp.moedasColetadas;
  return `<div class="fim"><h3>💀 Você caiu</h3><p>Os deuses te trazem de volta, mas perdem 20% do seu ouro.${perdidas ? ` As ${perdidas} moedas que você carregava ficaram para trás.` : ''}</p>
    <button class="btn grande" data-a="bat-fim">Despertar</button></div>`;
}

function painelVitoria() {
  const r = RES;
  const itens = r.itens.map(id => `<span class="drop" style="color:${RARIDADE_COR[ITENS[id].raridade]}">${ITENS[id].icone} ${esc(ITENS[id].nome)}</span>`).join('');
  const subidas = r.subidas.map(s => `<p class="nivelup">⭐ Nível ${s.nivel}! Uma carta nova espera por você (escolha 1 de 2 no reino)${s.ganhouMochila ? ` · A mochila agora tem ${s.mochila} lugares!` : ''}</p>`).join('');
  const ultima = T.ultimaEtapa;
  const noChao = [...T.moedas.values()].reduce((a, m) => a + m.valor, 0), baus = T.bau && !T.bau.aberto;
  const sobras = [noChao ? `🪙 ${noChao} ${noChao > 1 ? 'moedas' : 'moeda'} no chão` : '', baus ? '🧰 o baú ainda está fechado' : ''].filter(Boolean).join(' · ');
  const guardadas = T.exp.moedasColetadas, vm = valorDaMoeda(T.exp.cenario.id);
  const carregando = guardadas ? `<p class="moedas-carga">🪙 Você carrega ${guardadas} ${guardadas > 1 ? 'moedas' : 'moeda'} <small>(valem ${vm} de ouro cada, pagas no fim do cenário)</small></p>` : '';
  const marcos = (r.marcos || []).map(m => `<p class="marco">🎴 <b>Conquista!</b> ${esc(m.marco.nome)} → carta <b>${CARTAS_MOD[m.marco.carta].rotulo}</b> no seu baralho${m.trocou ? ` <small>(saiu a ${CARTAS_MOD[m.trocou].rotulo})</small>` : ''}</p>`).join('');
  if (T.fim === 'vitoria') {       // chegou à saída: o cenário acaba aqui
    return `<div class="fim"><h3>🏆 Cenário concluído!</h3>
      <p>+${r.xp} XP</p>${itens ? `<p class="drops">${itens}</p>` : ''}${subidas}${marcos}${carregando}
      ${sobras ? `<p class="sobras">Ficou para trás (perdido): ${sobras}</p>` : ''}
      <button class="btn grande" data-a="bat-fim">✅ Concluir cenário</button></div>`;
  }
  return `<div class="fim"><h3>${ultima ? '🏆 Objetivo cumprido!' : `✅ Sala limpa! Etapa ${T.etapa}/${T.totalEtapas}`}</h3>
    <p>+${r.xp} XP</p>${itens ? `<p class="drops">${itens}</p>` : ''}${subidas}${marcos}
    <p class="regra-limpa">${ultima ? 'Agora use suas cartas para <b>voltar à entrada 🚪</b>' : 'Agora use suas cartas para <b>chegar até a porta 🚪</b>'}: ela só abre quando você chega nela. <b>Pegue as moedas e o baú antes</b>: o que ficar para trás se perde!</p>
    ${sobras ? `<p class="sobras">${sobras}</p>` : ''}${carregando}
    <button class="btn grande" data-a="tat-limpa-ok">👍 Entendi</button></div>`;
}

/* Depois de qualquer ação: salva, mostra números flutuantes e confere se a etapa acabou. */
function depoisDaAcao(ok) {
  if (!ok && T.log.length) {
    const ult = T.log[T.log.length - 1];
    if (ult.cls === 'erro') toast(ult.msg);
  }
  if ((T.limpa || T.fim === 'vitoria') && !RES) RES = aplicarVitoriaT(T, P);     // objetivo cumprido: XP e drops entram agora
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
  if (t && t.fase === 'heroi' && !t.fim && !OCUPADO && (t.acaoUsada || t.limpa) && t.movRest === 0) {
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
  if (T.bau && !T.bau.aberto && T.bau.c === T.heroi.c && T.bau.r === T.heroi.r) toast('🧰 Termine o turno aqui para abrir o baú.');
  else if (T.moedas.has(chave(T.heroi.c, T.heroi.r))) toast('🪙 Termine o turno aqui (⏭️ Encerrar) para pegar as moedas.');
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
  const folego = rec.hp ? ` Você recupera o fôlego (+${rec.hp} vida).` : '';
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
  if (acao.tipo === 'atacar') {
    const alvo = uid !== undefined ? T.inim.find(e => e.uid === uid) : tAlvos(T, P)[0];
    ok = tAtacar(T, P, uid);
    if (ok && alvo) Cena3D.investir('heroi', alvo.c, alvo.r);
  } else if (acao.tipo === 'item') { ok = tUsarItem(T, P, acao.i); if (ok) Tutorial.evento('item'); }
  MODO = null; if (acao.tipo !== 'item') SUB = 'main';
  depoisDaAcao(ok);
}

/** Os inimigos jogam, um por vez, até chegar a vez do herói (ou acabar a rodada). */
async function rodarInimigos() {
  const t = T;
  OCUPADO = true; ATOR_TIPO = null;
  atualizarTudo();
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

async function encerrarTurno() {
  const t = T;
  if (!t || OCUPADO || !tEncerrarTurno(t, P)) return;
  MODO = null; SUB = 'main';
  if (t.fim) { depoisDaAcao(true); return; }   // abriu o baú e cumpriu o objetivo
  await rodarInimigos();
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
  if (rec.moedas && rec.moedas.n) paginas.push({ icone: '🪙', texto: `Moedas que você juntou: ${rec.moedas.n} × ${rec.moedas.valor} = ${rec.moedas.ouro} de ouro!` });
  for (const m of rec.marcos || []) paginas.push({ icone: '🎴', texto: `Conquista: ${m.marco.nome}! A carta ${CARTAS_MOD[m.marco.carta].rotulo} (${CARTAS_MOD[m.marco.carta].nome}) entrou no seu baralho de ataque${m.trocou ? `, no lugar de uma carta ${CARTAS_MOD[m.trocou].rotulo}` : ''}.` });
  const feitos = Object.keys(P.cenarios).length;
  if (rec.primeira && feitos % 5 === 0 && feitos < 20) paginas.push({ icone: '🛒', texto: `Os mercadores receberam equipamentos melhores (nível ${tierDaLoja(P)})! Visite a loja de qualquer reino.` });
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

/** Uma linha de equipamento vestido (ou "vazio"), com o botão de tirar. */
function slotHtml(rotulo, ico, id, slot, lugar) {
  return id
    ? `<div class="slot"><span class="slot-nome">${ico} ${rotulo}</span>${linhaItem(id, `<small>${esc(descreverBonus(ITENS[id]) || 'sem bônus')}</small>`, `<button class="btn peq sec" data-a="desequipar" data-id="${slot}" data-lugar="${lugar}">Tirar</button>`)}</div>`
    : `<div class="slot vazio-slot"><span>${ico}</span> ${rotulo}: vazio</div>`;
}

function modalPersonagem() {
  MODAL_ATUAL = 'personagem';
  const d = derivados(P), c = CLASSES[P.classe], e = P.equip;
  const mochila = Array.from({ length: tamanhoMochila(P.nivel) }, (_, i) => {
    const id = e.mochila[i];
    return id ? `<div class="slot">${linhaItem(id, '', `<span class="bts"><button class="btn peq" data-a="mochila-usar" data-i="${i}">Usar</button><button class="btn peq sec" data-a="mochila-tirar" data-i="${i}">Tirar</button></span>`)}</div>`
      : '<div class="slot vazio-slot"><span>🎒</span> lugar vazio</div>';
  }).join('');
  const colecao = P.colecao.map(cartaHeroiPorId).filter(Boolean).sort((x, y) => x.ini - y.ini);
  const cartas = colecao.map(k => cartaMaoHtml(k, P.mao.includes(k.id), false, 'mao-alternar')).join('');
  abrirModal(`<h2>${c.icone} ${esc(P.nome)} <small>${c.nome} · Nv ${P.nivel}</small></h2>
    <p class="pts">❤️ Vida <b>${P.hp}/${d.hpMax}</b> · você melhora ganhando <b>cartas</b> (1 a cada nível) e equipamentos.</p>
    ${P.escolhas.length ? `<button class="btn grande" data-a="abrir-escolha">🎁 Nova carta! Escolha 1 de 2 (nível ${P.escolhas[0]})</button>` : ''}
    <h3>Equipado <small>uso único por cenário</small></h3>
    ${slotHtml('Cabeça', '🪖', e.cabeca, 'cabeca', 0)}${slotHtml('Peito', '🥋', e.peito, 'peito', 0)}${slotHtml('Pés', '🥾', e.pes, 'pes', 0)}
    ${slotHtml('Mão 1', '🗡️', e.maos[0], 'maos', 0)}${slotHtml('Mão 2', '🛡️', e.maos[1], 'maos', 1)}
    <h3>Mochila (${e.mochila.length}/${tamanhoMochila(P.nivel)}) <small>cresce nos níveis 5, 10 e 15</small></h3>${mochila}
    <h3>🃏 Sua mão <small>${P.mao.length}/${MAO_MAX} cartas · você tem ${P.colecao.length}</small></h3>
    <p class="dica-mod">Toque numa carta para pôr ou tirar da mão que você leva aos cenários (de ${MAO_MIN} a ${MAO_MAX} cartas). As cartas de nível que você escolhe ficam na coleção.</p>
    <div class="mao colecao">${cartas}</div>
    <h3>🎴 Baralho de ataque <small>${P.baralho.length}/${BARALHO_MAX} cartas</small></h3>
    <p class="dica-mod">Cada ataque seu vira uma destas cartas, sozinha: +N soma dano, −N tira, ×2 dobra, ✖ falha. Só quando sai ×2 ou ✖ o baralho é embaralhado de novo. Conquistas colocam cartas melhores aqui (com 15 cartas, a nova toma o lugar da pior).</p>
    ${baralhoChips(null, P.baralho)}
    <h3>🏅 Conquistas <small>${MARCOS.filter(m => P.marcos[m.id]).length}/${MARCOS.length}</small></h3>
    <ul class="marcos">${MARCOS.map(m => { const feito = !!P.marcos[m.id], v = Math.min(m.meta, P.stats[m.stat] || 0); return `<li class="${feito ? 'feito' : ''}"><span>${feito ? '✅' : '⬜'} ${esc(m.nome)}</span><b class="mod-pq ${CARTAS_MOD[m.carta].tipo}">${CARTAS_MOD[m.carta].rotulo}</b><small>${feito ? 'recebida' : `${v}/${m.meta}`}</small></li>`; }).join('')}</ul>`);
}

/** Ao subir de nível: escolha 1 carta entre 2. A que não for escolhida se perde para sempre. */
function modalCartaNivel() {
  const n = P.escolhas[0];
  if (!n) return;
  MODAL_ATUAL = 'carta-nivel';
  const opcoes = cartasDoNivel(P.classe, n);
  abrirModal(`<h2>⭐ Nível ${n}!</h2>
    <p class="pts">Escolha <b>uma</b> carta nova para a sua coleção. <b>A outra se perde para sempre.</b>${P.escolhas.length > 1 ? ` <small>(mais ${P.escolhas.length - 1} escolha(s) esperando)</small>` : ''}</p>
    <div class="mao escolha-cartas">${opcoes.map(c => cartaMaoHtml(c, false, false, 'carta-nivel')).join('')}</div>
    <p class="dica-mod">${P.mao.length < MAO_MAX ? 'A carta já entra na sua mão.' : `Sua mão já tem ${MAO_MAX} cartas: depois, em 🧙 Personagem, troque as cartas da mão.`}</p>`);
}

function modalInventario() {
  MODAL_ATUAL = 'inventario';
  const ids = Object.keys(P.inv);
  const cons = ids.filter(id => ITENS[id].tipo === 'mochila');
  const equip = ids.filter(id => ITENS[id].tipo !== 'mochila');
  const cheia = P.equip.mochila.length >= tamanhoMochila(P.nivel);
  const linhaC = id => linhaItem(id, `<small>Guardado: ${qtd(P, id)}</small>`, `<button class="btn peq" data-a="levar" data-id="${id}" ${cheia ? 'disabled' : ''}>Levar</button>`);
  const linhaE = id => {
    const ok = podeEquipar(P, id), it = ITENS[id];
    const bts = !ok.ok ? `<button class="btn peq" disabled>Equipar</button>`
      : it.tipo === 'maos' && P.equip.maos[0] && P.equip.maos[1]
        ? `<span class="bts"><button class="btn peq" data-a="equipar" data-id="${id}" data-lugar="0">Mão 1</button><button class="btn peq" data-a="equipar" data-id="${id}" data-lugar="1">Mão 2</button></span>`
        : `<button class="btn peq" data-a="equipar" data-id="${id}">Equipar</button>`;
    return linhaItem(id, `<small class="slot-etq">${SLOTS[it.tipo]}</small>${ok.ok ? compararItem(id) : `<small class="pior">${ok.msg}</small>`}`, bts);
  };
  abrirModal(`<h2>🎒 Inventário <small>🪙 ${P.gold}</small></h2>
    <p class="dica">Mochila: ${P.equip.mochila.length}/${tamanhoMochila(P.nivel)} lugares (veja e use em 🧙 Personagem). Usar itens da mochila na batalha <b>não gasta a sua jogada</b>.</p>
    <h3>Equipamentos guardados</h3>${equip.map(linhaE).join('') || '<p class="vazio">Nenhum. Compre ou ganhe itens para equipar.</p>'}
    <h3>Consumíveis guardados</h3>${cons.map(linhaC).join('') || '<p class="vazio">Nenhum. (Os que cabem vão direto para a mochila.)</p>'}`);
}

function atualizarModal() {
  if (MODAL_ATUAL === 'personagem') modalPersonagem();
  else if (MODAL_ATUAL === 'inventario') modalInventario();
  // atualiza o topo da tela por trás
  if (!T && P) { const t = app.querySelector('.topo'); if (t) t.outerHTML = statusTopo(); const bd = app.querySelector('.badge'); if (bd && P.escolhas.length <= 0) bd.remove(); }
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
    P.dificuldade = 'facil';   // o tutorial começa na dificuldade Fácil (dá para trocar no mapa)
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
    Tutorial.evento('reino');
    if (!P.vistos[REINO.id]) {
      P.vistos[REINO.id] = true; salvar();
      historia([{ icone: REINO.icone, texto: REINO.intro }], telaReino);
    } else telaReino();
  },
  'voltar-reino'() { if (app.querySelector('.tela.loja')) Tutorial.evento('saiuloja'); telaReino(); },
  cenario(el) { CEN = cenarioPorId(+el.dataset.id); REINO = reinoPorId(CEN.reino); Tutorial.evento('cenario' + CEN.id); telaBriefing(); },
  dif(el) {
    P.dificuldade = el.dataset.id; salvar();
    if (CEN) telaBriefing(); else telaMapa();
  },
  iniciar() {
    Tutorial.evento('iniciou' + CEN.id);
    if (P.hp < derivados(P).hpMax * 0.5) confirmar('Sua vida está baixa. Começar o cenário mesmo assim?', iniciarBatalha);
    else iniciarBatalha();
  },
  acampar() {
    const d = derivados(P);
    if (P.hp >= d.hpMax) { toast('Você já está com a vida cheia.'); return; }
    if (!descansar(P, REINO)) { toast('Ouro insuficiente para acampar.'); return; }
    salvar(); telaReino(); toast('Vida restaurada. 🏕️');
  },
  loja() { LOJA_ABA = 'comprar'; Tutorial.evento('loja'); telaLoja(); },
  'aba-loja'(el) { LOJA_ABA = el.dataset.id; telaLoja(); },
  comprar(el) { if (comprar(P, el.dataset.id)) { Tutorial.evento('comprou'); salvar(); telaLoja(); toast(`Comprou ${ITENS[el.dataset.id].nome}`); } },
  vender(el) { if (vender(P, el.dataset.id)) { salvar(); telaLoja(); } },

  // batalha tática
  hex(el) {
    if (!T || OCUPADO || T.fase !== 'heroi' || T.fim) return;
    const c = +el.dataset.c, r = +el.dataset.r;
    if (pendenciaForca(T)) {                               // escolhendo para onde o inimigo vai
      if (tResolverForca(T, P, c, r)) { Cena3D.investir('heroi', c, r); depoisDaAcao(true); }
      else toast('Toque num dos hexágonos destacados (ou em "Deixar onde está").');
      return;
    }
    const e = inimigoEm(T, c, r);
    if (e) {
      if (MODO) { executar(MODO, e.uid); return; }
      if (T.acaoUsada) { toast('Você já agiu neste turno.'); return; }
      if (tAlvos(T, P).some(x => x.uid === e.uid)) executar({ tipo: 'atacar' }, e.uid);
      else toast(`${e.nome.split(',')[0]} está fora de alcance. Aproxime-se!`);
      return;
    }
    if (MODO) { MODO = null; atualizarTudo(); return; }
    if (irPara(c, r)) return;
    if (T.porta && !T.porta.aberta && c === T.porta.c && r === T.porta.r) { toast(T.limpa ? '🚪 A porta está longe: use uma carta com mais movimento ou ande por etapas.' : '🚪 A porta está trancada. Derrote todos os inimigos da sala!'); return; }
    if (temArmadilha(T, c, r)) { const def = ARMADILHAS[T.tipoArm]; toast(`${def.icone} ${def.nome}: ${def.desc}`); return; }
    if (T.bau && T.bau.c === c && T.bau.r === r) toast(T.bau.aberto ? '🧰 O baú já foi aberto.' : '🧰 Baú do tesouro: termine o turno parado em cima dele.');
    else if (T.moedas.has(chave(c, r))) toast(`🪙 ${T.moedas.get(chave(c, r)).valor} moedas: termine o turno em cima para pegar.`);
  },
  'tat-limpa-ok'() { if (RES) RES.visto = true; atualizarHud(); },
  'tat-atacar'() {
    if (!T || OCUPADO || T.acaoUsada) return;
    const c = cartaAtual(T);
    if (!c.atq) { toast('A carta desta rodada não ataca.'); return; }
    if (!tAlvos(T, P).length) { toast(c.alvo === 'ao-redor' ? 'Nenhum inimigo ao seu lado. Mova-se!' : `Nenhum inimigo ao alcance (${alcanceDa(P, T)}). Mova-se!`); return; }
    if (c.alvo === 'ao-redor') { executar({ tipo: 'atacar' }); return; }
    MODO = { tipo: 'atacar' }; atualizarTudo();
  },
  'tat-carta'(el) {
    if (!T || OCUPADO || T.fase !== 'escolha') return;
    CARTA_SEL = CARTA_SEL === el.dataset.id ? null : el.dataset.id;     // 2º toque na mesma carta desmarca
    atualizarHud();
  },
  'tat-jogar'() {
    if (!T || OCUPADO || T.fase !== 'escolha' || !CARTA_SEL) return;
    if (CARTA_SEL === 'descanso') {                  // descanso longo: primeiro você escolhe qual carta usada se perde
      if (T.descarte.length < 2) { toast('Para descansar você precisa de pelo menos 2 cartas usadas.'); return; }
      ESCOLHENDO_PERDA = true; atualizarHud(); return;
    }
    jogarCartaEscolhida(CARTA_SEL);
  },
  'tat-perder'(el) { if (ESCOLHENDO_PERDA) { ESCOLHENDO_PERDA = false; jogarCartaEscolhida('descanso', el.dataset.id); } },
  'tat-perder-cancelar'() { ESCOLHENDO_PERDA = false; atualizarHud(); },
  'tat-rapido'() {
    if (!T || OCUPADO || T.fase !== 'escolha') return;
    const perdida = tDescansoRapido(T, P);
    if (!perdida) { toast(T.log[T.log.length - 1].msg); return; }
    CARTA_SEL = null; toast(`⚡ A carta "${perdida.nome}" se perdeu. As outras voltaram para a sua mão: escolha a carta da rodada!`);
    salvar(); atualizarTudo();
  },
  'tat-gaveta'() { GAVETA = !GAVETA; atualizarHud(); },
  'tat-forca-pular'() { if (T && !OCUPADO && tResolverForca(T, P, null)) depoisDaAcao(true); },
  'tat-itens'() { SUB = 'itens'; atualizarHud(); },
  'tat-voltar'() { SUB = 'main'; atualizarHud(); },
  'tat-cancelar'() { MODO = null; atualizarTudo(); },
  'tat-equip'(el) { if (T && !OCUPADO) { const ok = tUsarEquip(T, P, el.dataset.k); if (ok) { SUB = 'main'; Tutorial.evento('equip'); } depoisDaAcao(ok); } },
  'tat-item'(el) { if (T && !OCUPADO) executar({ tipo: 'item', i: +el.dataset.i }); },
  'tat-fugir'() { if (T && !OCUPADO) depoisDaAcao(tFugir(T)); },
  'tat-fim'() { return encerrarTurno(); },
  'tat-zoom-mais'() { Cena3D.zoom(1.25); },
  'tat-zoom-menos'() { Cena3D.zoom(1 / 1.25); },
  'tat-girar'() { Cena3D.girar(60); },
  'tat-centro'() { if (T) centralizar(T.heroi); },
  'bat-fim'() { fimBatalha(); },

  // tutorial
  'tut-ok'() { Tutorial.concluirAtual(); Tutorial.checar(); },
  'tut-passo'() { Tutorial.concluirAtual(); Tutorial.checar(); },
  'tut-pular'() { Tutorial.pular(); toast('Tutorial desligado. Dá para rever pelo mapa dos reinos.'); },
  'tut-reiniciar'() { Tutorial.reiniciar(); telaMapa(); },

  // janelas
  personagem() { Tutorial.evento('personagem'); modalPersonagem(); },
  inventario() { Tutorial.evento('inventario'); modalInventario(); },
  fechar() { MODAL_ATUAL = null; fecharModal(); if (!T && CEN) telaBriefing(); else if (!T && REINO) telaReino(); else if (!T && P && !HIST) telaMapa(); },
  'abrir-escolha'() { modalCartaNivel(); },
  'carta-nivel'(el) {
    const m = /_n(\d+)([ab])$/.exec(el.dataset.id);
    const c = m && escolherCartaNivel(P, +m[1], m[2] === 'a' ? 0 : 1);
    if (!c) return;
    salvar(); toast(`🃏 "${c.nome}" entrou na sua coleção!`);
    if (P.escolhas.length) modalCartaNivel(); else ACOES.fechar();
  },
  'mao-alternar'(el) {
    if (alternarCartaMao(P, el.dataset.id)) { salvar(); atualizarModal(); }
    else toast(P.mao.includes(el.dataset.id) ? `A mão precisa de pelo menos ${MAO_MIN} cartas.` : `A mão já tem ${MAO_MAX} cartas: tire uma antes.`);
  },
  equipar(el) { const r = equipar(P, el.dataset.id, el.dataset.lugar !== undefined ? +el.dataset.lugar : undefined); if (r.ok) { salvar(); atualizarModal(); } else toast(r.msg); },
  desequipar(el) { desequipar(P, el.dataset.id, +(el.dataset.lugar || 0)); salvar(); atualizarModal(); },
  levar(el) { const r = levarNaMochila(P, el.dataset.id); if (r.ok) { salvar(); atualizarModal(); } else toast(r.msg); },
  'mochila-tirar'(el) { tirarDaMochila(P, +el.dataset.i); salvar(); atualizarModal(); },
  'mochila-usar'(el) {
    const ef = usarMochila(P, +el.dataset.i, null);
    if (ef) { salvar(); atualizarModal(); toast(ef.msg); } else toast('Sem efeito agora.');
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

// modelos .glb prontos (opcional, veja docs/MINIATURAS.md): só baixa o leitor de .glb se houver algum na lista
if (MODELOS_GLB.length) {
  const carregar = src => new Promise(ok => { const s = document.createElement('script'); s.src = src; s.onload = s.onerror = ok; document.head.appendChild(s); });
  carregar('js/vendor/GLTFLoader.js').then(() => carregar('js/vendor/SkeletonUtils.js')).then(() => Modelos3D.carregarGlbs(MODELOS_GLB)).catch(() => { /* o modelo de código continua valendo */ });
}
telaTitulo();
