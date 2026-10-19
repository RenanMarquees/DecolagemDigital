'use strict';
/* Simulação de equilíbrio: um jogador-robô joga os 20 cenários em ordem (cartas de iniciativa, itens, equipamentos por slot,
   mochila, moedas, baú e objetivos) numa dificuldade, várias vezes, para vermos se a curva de dificuldade faz sentido.
   Uso: node tests/sim.js [vezes] [classe|todas] [dificuldade]
   Ex.: node tests/sim.js 10 guerreiro expert      (sem classe/dificuldade: testa todas)
   Experimentos sem mexer no jogo:  BAL_FORCA=1.2 BAL_XP=0.8 node tests/sim.js ... */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({ Math, console });
for (const f of ['data.js', 'cartas.js', 'cenarios.js', 'logic.js', 'mapas.js', 'tatica.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
}
const FORTE = !!process.env.FORTE;   // FORTE=1: começa com o herói superforte do tests/boss.js

const robo = `(function () {
  const FORTE = ${FORTE};

  /* ---- o que o robô quer atacar / alcançar ---- */
  function alvosDoRobo(T) { const l = combatentes(T); return l.length ? l : vivos(T); }
  const querBau = (T, p) => T.objetivo === 'bau' && T.ultimaEtapa && T.bau && !T.bau.aberto && p.hp >= derivados(p).hpMax * 0.4;
  function menorDist(pos, lista) { return lista.length ? Math.min(...lista.map(e => dist(pos, e))) : 99; }

  // distância a pé até os alvos, contornando obstáculos
  function campo(T, alvos) {
    const m = new Map(), fila = [];
    for (const e of alvos) { m.set(chave(e.c, e.r), 0); fila.push({ c: e.c, r: e.r }); }
    while (fila.length) {
      const cur = fila.shift(), dc = m.get(chave(cur.c, cur.r));
      for (const v of vizinhos(T.g, cur.c, cur.r)) { const k = chave(v.c, v.r); if (!m.has(k)) { m.set(k, dc + 1); fila.push(v); } }
    }
    return m;
  }

  /* ---- escolha da carta da rodada ---- */
  function escolherCarta(T, p) {
    const d = derivados(p), quem = alvosDoRobo(T), frac = p.hp / d.hpMax;
    if (!T.mao.length) return 'descanso';
    if ((T.mao.length <= 2 && frac < 0.7) || (T.mao.length <= 3 && frac < 0.35)) return 'descanso';
    const perto = menorDist(T.heroi, quem), vizinhosN = quem.filter(e => dist(e, T.heroi) <= 2).length;
    const bau = querBau(T, p);
    let melhor = null;
    for (const c of T.mao) {
      let sc = Math.random() * 0.5;
      const mov = c.mov ? c.mov + d.mov : 0, alc = (c.alc || 1) + ((c.alc || 1) > 1 ? d.alc : 0);
      const podeAtacar = !bau && c.atq && perto <= mov + alc;
      if (c.atq) {
        const dano = c.atq + d.dano;
        if (podeAtacar) sc += dano * 2 * (c.alvo ? 1.25 : 1) + (c.empurrar || c.puxar ? 1.2 : 0) + (c.dreno ? 1.5 * (1 - frac) : 0);
      }
      if (!podeAtacar) sc += 2.4 * mov;
      sc += (c.escudo || 0) * (0.8 + (1 - frac) * 3) * (vizinhosN ? 1 : 0.4);
      sc += (c.cura || 0) * 4.5 * (1 - frac);
      sc -= c.ini * 0.01;
      if (!melhor || sc > melhor.sc) melhor = { c, sc };
    }
    return melhor.c.id;
  }

  /* ---- itens: usa poções quando está ferido (não gasta a jogada) ---- */
  function usarItens(T, p) {
    const d = derivados(p);
    for (let g = 0; g < 4 && p.hp <= d.hpMax * 0.45; g++) {
      const i = p.equip.mochila.findIndex(id => ITENS[id].heal);
      if (i < 0 || !tUsarItem(T, p, i)) break;
    }
    // escudo e pedra de amolar antes de lutar (se tiver sobrando)
    if (T.fase === 'heroi' && !T.livre && T.acaoUsada === false && alvosDoRobo(T).some(e => e.chefe) ) {
      for (const nome of ['pele_pedra', 'pedra_amolar']) { const i = p.equip.mochila.indexOf(nome); if (i >= 0) tUsarItem(T, p, i); }
    }
  }

  function melhorMovimento(T, p) {
    const c = cartaAtual(T), alc = alcanceDa(p, T);
    const bau = querBau(T, p);
    const alvos = bau ? [T.bau] : alvosDoRobo(T);
    const cp = campo(T, alvos);
    let melhor = null;
    for (const h of [{ c: T.heroi.c, r: T.heroi.r, custo: 0 }, ...tAlcance(T)]) {
      const md = menorDist(h, alvos), pd = cp.get(chave(h.c, h.r)) ?? 99;
      let score;
      if (bau) score = -pd * 10 - h.custo;
      else {
        const ataca = c.atq && (c.alvo === 'ao-redor' ? alvos.some(e => dist(h, e) <= 1) : alvos.some(e => dist(h, e) <= alc && (alc <= 1 || linhaDeVisao(T.g, h, e))));
        score = ataca ? 1000 + (alc > 1 ? md * 10 : 0) - h.custo : -pd * 10 - h.custo;
      }
      score -= (h.armadilhas || 0) * 60 + (temArmadilha(T, h.c, h.r) ? 60 : 0);
      if (!melhor || score > melhor.score) melhor = { h, score };
    }
    return melhor && (melhor.h.c !== T.heroi.c || melhor.h.r !== T.heroi.r) ? melhor.h : null;
  }

  function recuar(T) {
    const cp = campo(T, alvosDoRobo(T)), atual = cp.get(chave(T.heroi.c, T.heroi.r)) ?? 99;
    let melhor = null;
    for (const h of tAlcance(T)) {
      if (h.armadilhas > 0) continue;
      const md = cp.get(chave(h.c, h.r)) ?? 99;
      if (md > atual && (!melhor || md > melhor.md || (md === melhor.md && h.custo < melhor.h.custo))) melhor = { h, md };
    }
    return melhor ? melhor.h : null;
  }

  function atacarSePuder(T, p) {
    const c = cartaAtual(T);
    if (T.acaoUsada || !c.atq || querBau(T, p)) return false;
    const quem = alvosDoRobo(T), alvos = tAlvos(T, p);
    if (!alvos.length) return false;
    const alvo = alvos.filter(e => quem.includes(e)).sort((a, b) => a.hp - b.hp)[0] || alvos[0];
    return tAtacar(T, p, alvo.uid);
  }

  function turnoRobo(T, p) {
    if (T.fase === 'escolha') tEscolherCarta(T, p, escolherCarta(T, p));
    while (T.fase === 'inimigos' && !T.fim) tProximoInimigo(T, p);        // inimigos com iniciativa menor agem antes
    if (T.fim || T.fase !== 'heroi') return;
    usarItens(T, p);
    const alc = alcanceDa(p, T);
    let guard = 0;
    while (T.fase === 'heroi' && !T.fim && guard++ < 20) {
      if (querBau(T, p) && T.heroi.c === T.bau.c && T.heroi.r === T.bau.r) break;
      if (!querBau(T, p) && !T.acaoUsada && cartaAtual(T).atq) {
        // à distância: se estiver colado, tenta recuar antes de atirar
        if (alc > 1 && T.movRest > 0 && menorDist(T.heroi, alvosDoRobo(T)) <= 1) { const r = recuar(T); if (r && tMover(T, p, r.c, r.r)) continue; }
        if (atacarSePuder(T, p)) { usarItens(T, p); continue; }
      }
      const m = T.movRest > 0 ? melhorMovimento(T, p) : null;
      if (m && tMover(T, p, m.c, m.r)) continue;
      if (T.acaoUsada && alc > 1 && T.movRest > 0 && !querBau(T, p)) { const r = recuar(T); if (r && tMover(T, p, r.c, r.r)) continue; }
      break;
    }
    if (T.fim) return;
    usarItens(T, p);
    tEncerrarTurno(T, p);
    while (T.fase === 'inimigos' && !T.fim) tProximoInimigo(T, p);
  }

  /** Sala limpa: pega as moedas do chão (e o baú, se ainda estiver fechado) sem pisar em armadilhas. */
  function saquearTudo(T, p) {
    for (let g = 0; g < 30; g++) {
      const alvos = [...T.moedas.keys()].map(k => { const [c, r] = k.split(',').map(Number); return { c, r }; });
      if (T.bau && !T.bau.aberto) alvos.push({ c: T.bau.c, r: T.bau.r });
      const alc = tAlcance(T);
      const viaveis = alvos.filter(a => alc.some(h => h.c === a.c && h.r === a.r && !h.armadilhas));
      if (!viaveis.length) break;
      viaveis.sort((a, b) => dist(T.heroi, a) - dist(T.heroi, b));
      tMover(T, p, viaveis[0].c, viaveis[0].r);
    }
  }

  /** Um cenário inteiro: salas, portas e o objetivo final. */
  function jogarCenario(p, cenario, difId) {
    const exp = criarExpedicao(cenario, p, difId);
    let T = criarTatica(exp, p), rodadas = 0;
    for (;;) {
      let guard = 0;
      while (!T.fim && guard++ < 200) turnoRobo(T, p);
      rodadas += T.rodada;
      if (T.fim !== 'vitoria') { penalidadeDerrota(p); return { resultado: 'derrota', rodadas }; }
      aplicarVitoriaT(T, p);
      if (T.ultimaEtapa) { tSaquear(T); saquearTudo(T, p); concluirCenario(T, p); return { resultado: 'vitoria', rodadas }; }
      tAbrirPorta(T); saquearTudo(T, p);
      tMover(T, p, T.porta.c, T.porta.r);
      if (T.fim !== 'porta') { penalidadeDerrota(p); return { resultado: 'derrota', rodadas }; }
      T = tProximaEtapa(T, p);
    }
  }

  /* ---- preparação do herói entre cenários: pontos, equipamento, loja e mochila ---- */
  const valorItem = it => (it.hp || 0) * 1.6 + (it.atq || 0) * 3 + (it.esc || 0) * 3.2 + (it.mov || 0) * 2.5 + (it.alc || 0) * 1.5 + (it.cura || 0) * 1;
  function gastarPontos(p) { const principal = CLASSES[p.classe].basico; while (p.pontos > 0) distribuirPonto(p, p.pontos % 3 === 0 ? 'VIT' : principal); }

  function equiparMelhor(p) {
    for (const slot of ['cabeca', 'peito', 'pes']) {
      for (const id of Object.keys(p.inv)) {
        const it = ITENS[id];
        if (it.tipo !== slot || !podeEquipar(p, id).ok) continue;
        const atual = p.equip[slot] ? ITENS[p.equip[slot]] : null;
        if (valorItem(it) > (atual ? valorItem(atual) : -1)) equipar(p, id);
      }
    }
    // mãos: os dois melhores entre o que está vestido e o que está guardado
    const cand = [...p.equip.maos.filter(Boolean), ...Object.keys(p.inv).filter(id => ITENS[id].tipo === 'maos' && podeEquipar(p, id).ok)];
    const unicos = [...new Set(cand)].sort((a, b) => valorItem(ITENS[b]) - valorItem(ITENS[a])).slice(0, 2);
    for (const id of unicos) if (!p.equip.maos.includes(id) && qtd(p, id) > 0) equipar(p, id, p.equip.maos[0] && ITENS[p.equip.maos[0]] && valorItem(ITENS[p.equip.maos[0]]) < valorItem(ITENS[p.equip.maos[1]] || { }) ? 0 : (p.equip.maos[1] ? 0 : 1));
  }

  function comprarMelhorias(p, reino) {
    for (let rodada = 0; rodada < 12; rodada++) {
      let melhor = null;
      for (const id of estoqueLoja(p, reino)) {
        const it = ITENS[id];
        if (it.tipo === 'mochila' || it.preco > p.gold || !podeEquipar(p, id).ok) continue;
        let atual = 0;
        if (it.tipo === 'maos') { const maos = p.equip.maos.map(m => (m ? valorItem(ITENS[m]) : 0)); atual = Math.min(...maos); }
        else atual = p.equip[it.tipo] ? valorItem(ITENS[p.equip[it.tipo]]) : 0;
        const ganho = valorItem(it) - atual;
        if (ganho > 0.5 && (!melhor || ganho / Math.max(1, it.preco) > melhor.k)) melhor = { id, k: ganho / Math.max(1, it.preco) };
      }
      if (!melhor) break;
      comprar(p, melhor.id); equiparMelhor(p);
    }
  }

  function encherMochila(p, reino) {
    p.equip.mochila = p.equip.mochila.filter(Boolean);
    const cap = tamanhoMochila(p.nivel);
    const curas = reino.consumiveis.filter(id => ITENS[id].heal).sort((a, b) => ITENS[b].heal - ITENS[a].heal);
    while (p.equip.mochila.length < cap) {
      const guardado = Object.keys(p.inv).filter(id => ITENS[id].tipo === 'mochila');
      if (guardado.length) { levarNaMochila(p, guardado[0]); continue; }
      const id = curas.find(c => ITENS[c].preco <= p.gold) || 'pocao';
      if (ITENS[id].preco > p.gold || !comprar(p, id)) break;
    }
  }

  /* ---- a campanha ---- */
  return function (classe, difId) {
    const p = novoJogador('Robo', classe);
    if (FORTE) { p.nivel = 20; p.attr[CLASSES[classe].basico] = 30; p.attr.VIT = 30; p.gold = 500; p.equip.maos = [classe + '_4', 'escudo_4']; p.equip.peito = 'peito_4'; p.equip.cabeca = 'cabeca_4'; p.equip.pes = 'pes_4'; p.hp = derivados(p).hpMax; }
    const linhas = [];
    let lutas = 0;
    const preparar = reino => { gastarPontos(p); equiparMelhor(p); comprarMelhorias(p, reino); encherMochila(p, reino); };
    const repousar = reino => { const d = derivados(p); if (p.hp < d.hpMax * 0.6) { if (!descansar(p, reino)) p.hp = Math.max(p.hp, Math.ceil(d.hpMax * 0.6)); } };

    for (const cen of CENARIOS) {
      const reino = REINOS.find(r => r.id === cen.reino);
      const nivelIni = p.nivel;
      let derrotas = 0, venceu = false, rod = 0;
      while (!venceu && derrotas < 4 && lutas < 400) {
        preparar(reino); repousar(reino);
        const r = jogarCenario(p, cen, difId); lutas++;
        rod += r.rodadas;
        if (r.resultado === 'vitoria') venceu = true;
        else {
          derrotas++;
          // derrotado: treina em cenários antigos antes de tentar de novo
          const velhos = CENARIOS.filter(c => c.id < cen.id && p.cenarios[c.id]).slice(-3);
          for (const v of velhos) { const rv = REINOS.find(x => x.id === v.reino); preparar(rv); repousar(rv); jogarCenario(p, v, difId); lutas++; }
        }
      }
      linhas.push({ id: cen.id, obj: cen.objetivo, nivelIni, nivelFim: p.nivel, derrotas, venceu, rodadas: rod });
      if (!venceu) break;
    }
    return linhas;
  };
})()`;

// Experimentos de equilíbrio sem mexer nos arquivos do jogo
if (process.env.BAL_FORCA) vm.runInContext(`BALANCO.forca = ${+process.env.BAL_FORCA}`, ctx);
if (process.env.BAL_XP) vm.runInContext(`BALANCO.xp = ${+process.env.BAL_XP}`, ctx);
const fn = vm.runInContext(robo, ctx);
const N = parseInt(process.argv[2] || '10', 10);
const classes = process.argv[3] && process.argv[3] !== 'todas' ? [process.argv[3]] : ['guerreiro', 'cacador', 'oraculo'];
const difs = process.argv[4] ? [process.argv[4]] : Object.keys(vm.runInContext('DIFICULDADES', ctx));
const OBJ = { matar_todos: 'matar', bau: 'baú', destruir: 'destruir', chefe: 'CHEFE' };

for (const dif of difs) {
  for (const classe of classes) {
    const agg = {};
    let zerou = 0;
    for (let n = 0; n < N; n++) {
      const rel = fn(classe, dif);
      if (rel.length === 20 && rel[19].venceu) zerou++;
      for (const r of rel) {
        const a = (agg[r.id] ||= { obj: r.obj, n: 0, nivelIni: 0, nivelFim: 0, derrotas: 0, rod: 0, vitorias: 0, primeira: 0 });
        a.n++; a.nivelIni += r.nivelIni; a.nivelFim += r.nivelFim; a.derrotas += r.derrotas; a.rod += r.rodadas; a.vitorias += r.venceu ? 1 : 0; a.primeira += r.derrotas === 0 && r.venceu ? 1 : 0;
      }
    }
    console.log(`\n=== ${classe} · ${dif} (${N} jogos, zerou ${zerou}/${N}) ===`);
    console.log('cen  objetivo   nv_ini→fim  1ª tentativa  derrotas  rodadas');
    for (const [id, a] of Object.entries(agg)) {
      console.log(`${String(id).padStart(3)}  ${OBJ[a.obj].padEnd(9)}  ${(a.nivelIni / a.n).toFixed(1).padStart(4)}→${(a.nivelFim / a.n).toFixed(1).padEnd(5)}  ${String(a.primeira + '/' + a.n).padStart(8)}      ${(a.derrotas / a.n).toFixed(2).padStart(5)}    ${(a.rod / a.n).toFixed(0).padStart(5)}`);
    }
  }
}
