'use strict';
/* Simulação de balanceamento: um jogador-robô joga o jogo inteiro (com o mapa tático!)
   várias vezes para vermos se a dificuldade faz sentido.
   Uso: node tests/sim.js [vezes] [classe]  */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({ Math, console, TRACE: !!process.env.TRACE, TRACELONG: !!process.env.TRACELONG });
for (const f of ['data.js', 'logic.js', 'mapas.js', 'tatica.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
}

const robo = `(function () {
  const HAB = id => HABILIDADES[id];

  /* ---- decisões do robô durante UM turno ---- */
  function menorDistInimigo(T, pos) { return Math.min(...vivos(T).map(e => dist(pos, e))); }

  // melhor ataque possível a partir de onde o herói está agora
  function melhorAtaque(T, p) {
    const d = derivados(p);
    const stat = CLASSES[p.classe].basico;
    const temChefe = vivos(T).some(e => e.chefe);
    const opcoes = [];
    const basicoAlvos = tAlvos(T, p, { tipo: 'atacar' });
    if (basicoAlvos.length) {
      const alvo = basicoAlvos.sort((a, b) => a.hp - b.hp)[0];
      opcoes.push({ tipo: 'atacar', uid: alvo.uid, valor: (d[stat] * 1.5 + d.atk) });
    }
    for (const id of CLASSES[p.classe].habilidades) {
      const h = HAB(id);
      if (h.nivel > p.nivel || p.mp < h.custo || !['dano', 'dreno'].includes(h.tipo)) continue;
      if (h.area === 'ao-redor') {
        const n = adjacentes(T, T.heroi).length;
        if (n) opcoes.push({ tipo: 'hab', id, valor: (d[h.stat] * h.mult + d.atk) * n });
        continue;
      }
      const alvos = tAlvos(T, p, { tipo: 'habilidade', id });
      if (!alvos.length) continue;
      // área: escolhe o alvo com mais vizinhos
      const escolhido = alvos.map(a => ({ a, n: h.area ? vivos(T).filter(x => x === a || dist(x, a) === 1).length : 1 }))
        .sort((x, y) => y.n - x.n || x.a.hp - y.a.hp)[0];
      opcoes.push({ tipo: 'hab', id, uid: escolhido.a.uid, valor: (d[h.stat] * h.mult * (h.golpes || 1) + d.atk) * escolhido.n });
    }
    if (!opcoes.length) return null;
    const hab = opcoes.filter(o => o.tipo === 'hab').sort((a, b) => b.valor - a.valor)[0];
    const alvoRef = vivos(T).sort((a, b) => b.hp - a.hp)[0];
    if (hab && (temChefe || alvoRef.hp > d[stat] * 3)) return hab;
    return opcoes.find(o => o.tipo === 'atacar') || hab;
  }

  // distância a pé até o inimigo mais próximo, contornando obstáculos (busca em largura a partir dos inimigos)
  function campo(T) {
    const d = new Map(); const fila = [];
    for (const e of vivos(T)) { d.set(chave(e.c, e.r), 0); fila.push({ c: e.c, r: e.r }); }
    while (fila.length) {
      const cur = fila.shift(); const dc = d.get(chave(cur.c, cur.r));
      for (const v of vizinhos(T.g, cur.c, cur.r)) { const k = chave(v.c, v.r); if (!d.has(k)) { d.set(k, dc + 1); fila.push(v); } }
    }
    return d;
  }

  // para onde andar: melhor lugar de onde dá para atacar (ranged fica longe; melee fica perto)
  function melhorMovimento(T, p) {
    const alc = CLASSES[p.classe].alcanceBasico;
    const cand = [{ c: T.heroi.c, r: T.heroi.r, custo: 0 }, ...tAlcance(T)];
    let melhor = null;
    const cp = campo(T);
    for (const h of cand) {
      const vs = vivos(T);
      const podeAtacar = vs.some(e => dist(h, e) <= alc && (alc <= 1 || linhaDeVisao(T.g, h, e)));
      const md = Math.min(...vs.map(e => dist(h, e)));
      const pd = cp.get(chave(h.c, h.r)) ?? 99; // caminho a pé até o inimigo mais próximo
      let score;
      if (podeAtacar) score = 1000 + (alc > 1 ? md * 10 : 0) - h.custo; // ranged: mais longe é melhor
      else score = -pd * 10 - h.custo;
      if (!melhor || score > melhor.score) melhor = { h, score };
    }
    return melhor && (melhor.h.c !== T.heroi.c || melhor.h.r !== T.heroi.r) ? melhor.h : null;
  }

  function recuar(T, p) { // depois de atacar, o arqueiro/mago se afasta
    const cand = tAlcance(T);
    const cp = campo(T);
    const atual = cp.get(chave(T.heroi.c, T.heroi.r)) ?? 99;
    let melhor = null;
    for (const h of cand) {
      const md = cp.get(chave(h.c, h.r)) ?? 99;
      if (md > atual && (!melhor || md > melhor.md || (md === melhor.md && h.custo < melhor.h.custo))) melhor = { h, md };
    }
    return melhor ? melhor.h : null;
  }

  function turnoRobo(T, p) {
    const cls = p.classe;
    const alc = CLASSES[cls].alcanceBasico;
    let guard = 0;
    while (T.fase === 'heroi' && !T.fim && guard++ < 30) {
      const d = derivados(p);
      // 0) chefe vai soltar o ataque especial e está ao alcance: defender
      if (!T.acaoUsada && p.hp < derivados(p).hpMax * 0.6 && vivos(T).some(e => e.especial && T.rodada % e.especial.cada === 0 && dist(e, T.heroi) <= e.mov + e.alc)) {
        if (tDefender(T, p)) continue;
      }
      // 1) curar se estiver muito ferido
      if (!T.acaoUsada && p.hp < d.hpMax * 0.4) {
        const pot = ['nectar', 'agua_nilo', 'ambrosia', 'hidromel', 'pocao'].find(x => qtd(p, x) > 0);
        if (pot && tUsarItem(T, p, pot)) continue;
        if (cls === 'oraculo' && p.nivel >= 3 && p.mp >= HAB('bencao_apolo').custo && tHabilidade(T, p, 'bencao_apolo')) continue;
      }
      // 2) buff do guerreiro contra chefes
      if (!T.acaoUsada && !T.buff && cls === 'guerreiro' && p.nivel >= 3 && p.mp >= HAB('grito_guerra').custo
          && vivos(T).some(e => e.chefe) && menorDistInimigo(T, T.heroi) <= 4) {
        if (tHabilidade(T, p, 'grito_guerra')) continue;
      }
      if (!T.acaoUsada) {
        const a = melhorAtaque(T, p);
        // melee: se já está encostado, ataca; ranged: se estiver muito perto, tenta recuar antes
        if (alc > 1 && T.movRest > 0 && menorDistInimigo(T, T.heroi) <= 1) {
          const r = recuar(T, p);
          if (r && tMover(T, p, r.c, r.r)) continue;
        }
        if (a) {
          const ok = a.tipo === 'atacar' ? tAtacar(T, p, a.uid) : tHabilidade(T, p, a.id, a.uid);
          if (ok) continue;
        }
        const m = T.movRest > 0 ? melhorMovimento(T, p) : null;
        if (m && tMover(T, p, m.c, m.r)) continue;
        break;
      }
      // ação já usada: arqueiro/mago se afasta com o movimento que sobrou
      if (alc > 1 && T.movRest > 0) {
        const r = recuar(T, p);
        if (r && tMover(T, p, r.c, r.r)) continue;
      }
      break;
    }
    if (T.fim) return;
    // defender quando o chefe vai usar o ataque especial e ainda não agimos
    tEncerrarTurno(T);
    while (T.fase === 'inimigos' && !T.fim) tProximoInimigo(T, p);
  }

  function lutar(p, reino, chefeId, stats) {
    const T = criarTatica(reino, chefeId, p);
    let guard = 0;
    while (!T.fim && guard++ < 120) turnoRobo(T, p);
    if (T.fim !== 'vitoria' && typeof TRACE !== 'undefined' && TRACE && !globalThis.__traced) {
      globalThis.__traced = true;
      console.log('--- TRACE derrota: ' + p.classe + ' nv' + p.nivel + ' hp/mp ' + p.hp + '/' + p.mp + ' | ' + T.inim.map(e => e.nome + ' ' + e.hp + '/' + e.hpMax + ' atk' + e.atk + ' mov' + e.mov + ' alc' + e.alc).join(' ; '));
      T.log.slice(-28).forEach(l => console.log('   ' + l.msg));
    }
    if (typeof TRACELONG !== 'undefined' && TRACELONG && T.rodada > 40 && !globalThis.__tl) {
      globalThis.__tl = true;
      console.log('--- TRACE luta longa: ' + p.classe + ' nv' + p.nivel + ' rodadas ' + T.rodada + ' fim=' + T.fim + ' | ' + T.inim.map(e => e.nome + ' ' + e.hp + '/' + e.hpMax + (e.vivo ? '' : ' (morto)')).join(' ; '));
      T.log.slice(-14).forEach(l => console.log('   ' + l.msg));
    }
    if (T.fim === 'vitoria') aplicarVitoriaT(T, p);
    else if (T.fim === 'derrota') penalidadeDerrota(p);
    else if (!T.fim) { penalidadeDerrota(p); T.fim = 'derrota'; } // empate: conta como derrota
    stats.rodadas += T.rodada;
    return T.fim;
  }

  /* ---- jogo completo ---- */
  return function (classe) {
    const p = novoJogador('Robo', classe);
    const principal = CLASSES[classe].basico;
    const rel = [];
    let derrotas = 0, batalhas = 0;
    const stats = { rodadas: 0 };

    function gastarPontos() {
      while (p.pontos > 0) distribuirPonto(p, p.pontos % 3 === 0 ? 'VIT' : principal);
      ajustarVidaMana(p);
    }
    function comprarEquip(reino) {
      for (const id of estoqueLoja(p, reino)) {
        const it = ITENS[id];
        if (!['arma', 'armadura'].includes(it.tipo)) continue;
        const atual = ITENS[p.equip[it.tipo]];
        const melhor = it.tipo === 'arma' ? it.atk > atual.atk : it.def > atual.def;
        if (melhor && p.gold >= it.preco) { comprar(p, id); equipar(p, id); }
      }
      const alvo = reino.consumiveis[reino.consumiveis.length - 1];
      while (p.gold > 250 && qtd(p, alvo) < 3) { if (!comprar(p, alvo)) break; }
      while (qtd(p, 'pocao') < 3 && p.gold >= 20 && reino.tier === 1) comprar(p, 'pocao');
    }
    function descansarSeFalta(reino) {
      const d = derivados(p);
      if (p.hp < d.hpMax * 0.5 || p.mp < d.mpMax * 0.2) descansar(p, reino);
    }
    function lutaBot(reino, chefeId) {
      batalhas++;
      const r = lutar(p, reino, chefeId, stats);
      if (r === 'derrota') derrotas++;
      gastarPontos();
      return r;
    }

    for (let i = 0; i < REINOS.length; i++) {
      const reino = REINOS[i];
      const inicio = { nivel: p.nivel, batalhas, derrotas, rodadas: stats.rodadas };
      if (!reino.final) {
        const metaNivel = [4, 8, 12, 16][i];
        let cont = 0;
        comprarEquip(reino);
        while (p.nivel < metaNivel && cont++ < 80) {
          descansarSeFalta(reino);
          lutaBot(reino, null);
          comprarEquip(reino);
        }
      }
      let venceu = false, tent = 0;
      while (!venceu && tent++ < 3) {
        if (!descansar(p, reino)) { const d = derivados(p); p.hp = d.hpMax; p.mp = d.mpMax; }
        venceu = lutaBot(reino, reino.chefe) === 'vitoria';
        if (!venceu) for (let k = 0; k < 4; k++) { descansarSeFalta(reino); if (!reino.final) lutaBot(reino, null); }
      }
      rel.push({ reino: reino.id, nivelSaida: p.nivel, batalhas: batalhas - inicio.batalhas, derrotas: derrotas - inicio.derrotas,
        tentativasChefe: tent, venceuChefe: venceu, rodadas: stats.rodadas - inicio.rodadas });
      if (!venceu) break;
    }
    return rel;
  };
})()`;
const fn = vm.runInContext(robo, ctx);
const N = parseInt(process.argv[2] || '20', 10);
const classes = process.argv[3] ? [process.argv[3]] : ['guerreiro', 'cacador', 'oraculo'];
for (const classe of classes) {
  const agg = {};
  let zerou = 0;
  for (let n = 0; n < N; n++) {
    const rel = fn(classe);
    if (rel.length === 5 && rel[4].venceuChefe) zerou++;
    for (const r of rel) {
      const a = (agg[r.reino] ||= { n: 0, nivelSaida: 0, batalhas: 0, derrotas: 0, tent: 0, vitorias: 0, rodadas: 0 });
      a.n++; a.nivelSaida += r.nivelSaida; a.batalhas += r.batalhas; a.derrotas += r.derrotas; a.tent += r.tentativasChefe;
      a.vitorias += r.venceuChefe ? 1 : 0; a.rodadas += r.rodadas;
    }
  }
  console.log(`\n=== ${classe} (${N} jogos, zerou ${zerou}/${N}) ===`);
  for (const [k, a] of Object.entries(agg)) {
    console.log(`${k.padEnd(8)} nv_saida=${(a.nivelSaida / a.n).toFixed(1)}  lutas=${(a.batalhas / a.n).toFixed(1)}  rodadas/luta=${(a.rodadas / a.batalhas).toFixed(1)}  derrotas=${(a.derrotas / a.n).toFixed(1)}  tent_chefe=${(a.tent / a.n).toFixed(2)}  chefe_venceu=${a.vitorias}/${a.n}`);
  }
}
