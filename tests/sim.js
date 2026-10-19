'use strict';
/* Simulação de equilíbrio: um jogador-robô joga os 20 cenários em ordem (com mapa, cartas dos inimigos, moedas, baú e objetivos)
   numa dificuldade, várias vezes, para vermos se a curva de dificuldade faz sentido.
   Uso: node tests/sim.js [vezes] [classe] [dificuldade]
   Ex.: node tests/sim.js 10 guerreiro expert      (sem classe/dificuldade: testa todas) */
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
  const HAB = id => HABILIDADES[id];
  const POCOES = ['nectar', 'agua_nilo', 'ambrosia', 'hidromel', 'pocao'];

  /* ---- o que o robô quer atacar / alcançar ---- */
  function alvosDoRobo(T) {
    const lutadores = combatentes(T);
    if (lutadores.length) return lutadores;
    return vivos(T);                                   // sobraram só as estruturas
  }
  const querBau = (T, p) => T.objetivo === 'bau' && T.ultimaEtapa && T.bau && !T.bau.aberto && p.hp >= derivados(p).hpMax * 0.4;

  function menorDist(pos, lista) { return lista.length ? Math.min(...lista.map(e => dist(pos, e))) : 99; }

  function melhorAtaque(T, p) {
    const d = derivados(p), stat = CLASSES[p.classe].basico;
    const quem = alvosDoRobo(T), temChefe = quem.some(e => e.chefe);
    const filtra = lista => lista.filter(a => quem.includes(a));
    const opcoes = [];
    const basicos = filtra(tAlvos(T, p, { tipo: 'atacar' }));
    if (basicos.length) opcoes.push({ tipo: 'atacar', uid: basicos.sort((a, b) => a.hp - b.hp)[0].uid, valor: d[stat] * 1.5 + d.atk });
    for (const id of CLASSES[p.classe].habilidades) {
      const h = HAB(id);
      if (h.nivel > p.nivel || p.mp < h.custo || !['dano', 'dreno'].includes(h.tipo)) continue;
      if (h.area === 'ao-redor') {
        const n = filtra(adjacentes(T, T.heroi)).length;
        if (n) opcoes.push({ tipo: 'hab', id, valor: (d[h.stat] * h.mult + d.atk) * n });
        continue;
      }
      const alvos = filtra(tAlvos(T, p, { tipo: 'habilidade', id }));
      if (!alvos.length) continue;
      const esc = alvos.map(a => ({ a, n: h.area ? quem.filter(x => x === a || dist(x, a) === 1).length : 1 })).sort((x, y) => y.n - x.n || x.a.hp - y.a.hp)[0];
      opcoes.push({ tipo: 'hab', id, uid: esc.a.uid, valor: (d[h.stat] * h.mult * (h.golpes || 1) + d.atk) * esc.n });
    }
    if (!opcoes.length) return null;
    const hab = opcoes.filter(o => o.tipo === 'hab').sort((a, b) => b.valor - a.valor)[0];
    const ref = quem.slice().sort((a, b) => b.hp - a.hp)[0];
    if (hab && (temChefe || ref.hp > d[stat] * 3)) return hab;
    return opcoes.find(o => o.tipo === 'atacar') || hab;
  }

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

  function melhorMovimento(T, p) {
    const alc = CLASSES[p.classe].alcanceBasico;
    const bau = querBau(T, p);
    const alvos = bau ? [T.bau] : alvosDoRobo(T);
    const cp = campo(T, alvos);
    let melhor = null;
    for (const h of [{ c: T.heroi.c, r: T.heroi.r, custo: 0 }, ...tAlcance(T)]) {
      const md = menorDist(h, alvos);
      const pd = cp.get(chave(h.c, h.r)) ?? 99;
      let score;
      if (bau) score = -pd * 10 - h.custo;
      else {
        const podeAtacar = alvos.some(e => dist(h, e) <= alc && (alc <= 1 || linhaDeVisao(T.g, h, e)));
        score = podeAtacar ? 1000 + (alc > 1 ? md * 10 : 0) - h.custo : -pd * 10 - h.custo;
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

  function turnoRobo(T, p) {
    const cls = p.classe, alc = CLASSES[cls].alcanceBasico;
    let guard = 0;
    while (T.fase === 'heroi' && !T.fim && guard++ < 30) {
      const d = derivados(p), quem = alvosDoRobo(T);
      // no baú: basta parar aqui e encerrar o turno
      if (querBau(T, p) && T.heroi.c === T.bau.c && T.heroi.r === T.bau.r) break;
      // chefe vai usar o golpe forte e estamos feridos: defender
      if (!T.acaoUsada && p.hp < d.hpMax * 0.6 && quem.some(e => e.especial && T.rodada % e.especial.cada === 0 && dist(e, T.heroi) <= e.mov + e.alc)) { if (tDefender(T, p)) continue; }
      if (!T.acaoUsada && p.hp < d.hpMax * 0.4) {
        const pot = POCOES.find(x => qtd(p, x) > 0);
        if (pot && tUsarItem(T, p, pot)) continue;
        if (cls === 'oraculo' && p.nivel >= 3 && p.mp >= HAB('bencao_apolo').custo && tHabilidade(T, p, 'bencao_apolo')) continue;
      }
      if (!T.acaoUsada && !T.buff && cls === 'guerreiro' && p.nivel >= 3 && p.mp >= HAB('grito_guerra').custo && quem.some(e => e.chefe) && menorDist(T.heroi, quem) <= 4) {
        if (tHabilidade(T, p, 'grito_guerra')) continue;
      }
      if (!T.acaoUsada && !querBau(T, p)) {
        const a = melhorAtaque(T, p);
        if (alc > 1 && T.movRest > 0 && menorDist(T.heroi, quem) <= 1) { const r = recuar(T); if (r && tMover(T, p, r.c, r.r)) continue; }
        if (a) { if (a.tipo === 'atacar' ? tAtacar(T, p, a.uid) : tHabilidade(T, p, a.id, a.uid)) continue; }
      }
      const m = T.movRest > 0 ? melhorMovimento(T, p) : null;
      if (m && tMover(T, p, m.c, m.r)) continue;
      if (T.acaoUsada && alc > 1 && T.movRest > 0 && !querBau(T, p)) { const r = recuar(T); if (r && tMover(T, p, r.c, r.r)) continue; }
      break;
    }
    if (T.fim) return;
    tEncerrarTurno(T, p);
    while (T.fase === 'inimigos' && !T.fim) tProximoInimigo(T, p);
  }

  /** Sala limpa: usa poções, pega as moedas do chão (e o baú, se ainda estiver fechado) sem pisar em armadilhas. */
  function saquearTudo(T, p) {
    const d = derivados(p);
    for (let g = 0; p.hp < d.hpMax * 0.6 && g < 6; g++) { const pot = POCOES.find(x => qtd(p, x) > 0); if (!pot || !tUsarItem(T, p, pot)) break; }
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

  /** Um cenário inteiro: salas, portas e o objetivo final. Devolve {resultado, rodadas, recompensa}. */
  function jogarCenario(p, cenario, difId) {
    const exp = criarExpedicao(cenario, p, difId);
    let T = criarTatica(exp, p), rodadas = 0;
    for (;;) {
      let guard = 0;
      while (!T.fim && guard++ < 150) turnoRobo(T, p);
      rodadas += T.rodada;
      if (T.fim !== 'vitoria') { penalidadeDerrota(p); return { resultado: 'derrota', rodadas }; }
      aplicarVitoriaT(T, p);
      if (T.ultimaEtapa) {
        tSaquear(T); saquearTudo(T, p);
        concluirCenario(T, p);
        return { resultado: 'vitoria', rodadas };
      }
      tAbrirPorta(T); saquearTudo(T, p);
      tMover(T, p, T.porta.c, T.porta.r);
      if (T.fim !== 'porta') { penalidadeDerrota(p); return { resultado: 'derrota', rodadas }; }
      T = tProximaEtapa(T, p);
    }
  }

  /* ---- a campanha ---- */
  return function (classe, difId) {
    const p = novoJogador('Robo', classe);
    if (FORTE) { p.nivel = 20; p.attr.FOR = 300; p.attr.VIT = 300; p.gold = 5000; ajustarVidaMana(p); }   // mesmo herói do teste da campanha
    const principal = CLASSES[classe].basico;
    const linhas = [];
    let lutas = 0;
    const gastarPontos = () => { while (p.pontos > 0) distribuirPonto(p, p.pontos % 3 === 0 ? 'VIT' : principal); ajustarVidaMana(p); };
    function comprarEquip(reino) {
      for (const id of estoqueLoja(p, reino)) {
        const it = ITENS[id];
        if (!['arma', 'armadura'].includes(it.tipo) || (it.classe && it.classe !== p.classe)) continue;
        const atual = ITENS[p.equip[it.tipo]];
        const melhor = it.tipo === 'arma' ? it.atk > (atual ? atual.atk : 0) : it.def > (atual ? atual.def : 0);
        if (melhor && p.gold >= it.preco) { comprar(p, id); equipar(p, id); }
      }
      // itens que o robô achou na mochila (baús, drops, recompensas)
      for (const id of Object.keys(p.inv)) {
        const it = ITENS[id];
        if (!it || !['arma', 'armadura', 'amuleto'].includes(it.tipo) || !podeEquipar(p, id).ok) continue;
        const atual = ITENS[p.equip[it.tipo]];
        const valor = x => (x ? (x.atk || 0) + (x.def || 0) + (x.bonus ? 4 : 0) + (x.raridade === 'lendario' ? 20 : 0) : 0);
        if (valor(it) > valor(atual)) equipar(p, id);
      }
      const alvo = reino.consumiveis[reino.consumiveis.length - 1];
      while (p.gold > 250 && qtd(p, alvo) < 3) { if (!comprar(p, alvo)) break; }
      while (qtd(p, 'pocao') < 3 && p.gold >= 20 && reino.tier === 1) comprar(p, 'pocao');
    }
    const repousar = reino => { const d = derivados(p); if (p.hp < d.hpMax * 0.6 || p.mp < d.mpMax * 0.3) { if (!descansar(p, reino)) { p.hp = Math.max(p.hp, d.hpMax * 0.6); p.mp = Math.max(p.mp, d.mpMax * 0.3); } } };

    for (const cen of CENARIOS) {
      const reino = REINOS.find(r => r.id === cen.reino);
      const nivelIni = p.nivel;
      let derrotas = 0, venceu = false, rod = 0;
      while (!venceu && derrotas < 4 && lutas < 400) {
        comprarEquip(reino); repousar(reino);
        const r = jogarCenario(p, cen, difId); lutas++;
        rod += r.rodadas; gastarPontos();
        if (r.resultado === 'vitoria') venceu = true;
        else {
          derrotas++;
          // derrotado: treina em cenários antigos (do mesmo reino ou anteriores) antes de tentar de novo
          const velhos = CENARIOS.filter(c => c.id < cen.id && p.cenarios[c.id]).slice(-3);
          for (const v of velhos) { repousar(REINOS.find(x => x.id === v.reino)); jogarCenario(p, v, difId); lutas++; gastarPontos(); }
        }
      }
      linhas.push({ id: cen.id, obj: cen.objetivo, nivelIni, nivelFim: p.nivel, derrotas, venceu, rodadas: rod });
      if (!venceu) break;
    }
    return linhas;
  };
})()`;

// Experimentos de equilíbrio sem mexer nos arquivos do jogo:  BAL_FORCA=1.3 BAL_XP=0.6 node tests/sim.js ...
if (process.env.BAL_FORCA) vm.runInContext(`BALANCO.forca = ${+process.env.BAL_FORCA}`, ctx);
if (process.env.BAL_XP) vm.runInContext(`BALANCO.xp = ${+process.env.BAL_XP}`, ctx);
if (process.env.BAL_EXPERT) vm.runInContext(`DIFICULDADES.expert.stat = ${+process.env.BAL_EXPERT}`, ctx);
if (process.env.BAL_CAOS_HP) vm.runInContext(`INIMIGOS.caos.hp = ${+process.env.BAL_CAOS_HP}`, ctx);
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
