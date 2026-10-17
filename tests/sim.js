'use strict';
/* Simulação de balanceamento: um jogador-robô joga o jogo inteiro N vezes
   para vermos se a dificuldade faz sentido.
   Uso: node tests/sim.js [vezes]  */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({ Math, console });
for (const f of ['data.js', 'logic.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
}
const run = (code) => vm.runInContext(code, ctx);

const robo = `(function (classe, rodadas) {
  const p = novoJogador('Robo', classe);
  const principal = CLASSES[classe].basico;
  const rel = [];
  let derrotas = 0, batalhas = 0;

  function gastarPontos() {
    while (p.pontos > 0) {
      distribuirPonto(p, p.pontos % 3 === 0 ? 'VIT' : principal);
    }
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
    while (p.gold >= ITENS.hidromel.preco * 1 && qtd(p, reino.consumiveis.includes('ambrosia') ? 'ambrosia' : 'hidromel') < 3 && p.gold > 200) {
      const alvo = reino.consumiveis[reino.consumiveis.length - 1];
      if (!comprar(p, alvo)) break;
    }
    while (qtd(p, 'pocao') < 3 && p.gold >= 20 && reino.tier === 1) comprar(p, 'pocao');
  }
  function lutar(id) {
    const b = criarBatalha(id);
    batalhas++;
    let r = 'continua', guard = 0;
    while (r === 'continua' && guard++ < 200) {
      const d = derivados(p);
      let acao = { tipo: 'atacar' };
      const hs = CLASSES[classe].habilidades.map(h => HABILIDADES[h]).filter(h => h.nivel <= p.nivel);
      const ids = CLASSES[classe].habilidades.filter(h => HABILIDADES[h].nivel <= p.nivel);
      // cura / poção se vida baixa
      if (p.hp < d.hpMax * 0.35) {
        const pot = ['nectar', 'agua_nilo', 'ambrosia', 'hidromel', 'pocao'].find(x => qtd(p, x) > 0);
        if (pot) acao = { tipo: 'item', id: pot };
        else if (classe === 'oraculo' && p.mp >= HABILIDADES.bencao_apolo.custo && p.nivel >= 3) acao = { tipo: 'habilidade', id: 'bencao_apolo' };
      } else if (b.inim.especial && (b.turno + 1) % b.inim.especial.cada === 0) {
        acao = { tipo: 'defender' };
      }
      if (acao.tipo === 'atacar') {
        // melhor habilidade de dano que a mana permitir
        const dano = ids.filter(i => ['dano', 'dreno'].includes(HABILIDADES[i].tipo) && HABILIDADES[i].custo <= p.mp)
          .sort((a, c) => HABILIDADES[c].mult * (HABILIDADES[c].golpes || 1) - HABILIDADES[a].mult * (HABILIDADES[a].golpes || 1));
        if (dano.length && (b.inim.chefe || b.inim.hp > derivados(p)[principal] * 3)) acao = { tipo: 'habilidade', id: dano[0] };
        if (!b.buff && ids.includes('grito_guerra') && p.mp >= 8 && b.inim.chefe) acao = { tipo: 'habilidade', id: 'grito_guerra' };
      }
      r = jogarTurno(b, p, acao);
      if (r === 'invalido') r = jogarTurno(b, p, { tipo: 'atacar' });
    }
    if (r === 'vitoria') aplicarVitoria(b, p);
    else if (r === 'derrota') { penalidadeDerrota(p); derrotas++; }
    gastarPontos();
    return r;
  }
  function descansarSeFalta(reino) {
    const d = derivados(p);
    if (p.hp < d.hpMax * 0.5 || p.mp < d.mpMax * 0.2) descansar(p, reino);
  }

  for (let i = 0; i < REINOS.length; i++) {
    const reino = REINOS[i];
    const inicio = { nivel: p.nivel, batalhas, derrotas };
    if (!reino.final) {
      const metaNivel = [4, 8, 12, 16][i];
      let cont = 0;
      comprarEquip(reino);
      while (p.nivel < metaNivel && cont++ < 60) {
        descansarSeFalta(reino);
        const id = reino.inimigos[Math.floor(Math.random() * reino.inimigos.length)];
        lutar(id);
        comprarEquip(reino);
      }
    }
    // chefe: até 3 tentativas
    let venceu = false, tent = 0;
    while (!venceu && tent++ < 3) {
      descansar(p, reino) || (p.hp = derivados(p).hpMax, p.mp = derivados(p).mpMax);
      venceu = lutar(reino.chefe) === 'vitoria';
      if (!venceu) { for (let k = 0; k < 4; k++) lutar(reino.inimigos[0] || 'draugr'); }
    }
    rel.push({ reino: reino.id, nivelEntrada: inicio.nivel, nivelSaida: p.nivel, batalhas: batalhas - inicio.batalhas, derrotas: derrotas - inicio.derrotas, tentativasChefe: tent, venceuChefe: venceu, gold: p.gold });
    if (!venceu) break;
  }
  return rel;
})`;
const fn = run(robo);
const N = parseInt(process.argv[2] || '20', 10);
for (const classe of ['guerreiro', 'cacador', 'oraculo']) {
  const agg = {};
  let zerou = 0;
  for (let n = 0; n < N; n++) {
    const rel = fn(classe);
    if (rel.length === 5 && rel[4].venceuChefe) zerou++;
    for (const r of rel) {
      const a = (agg[r.reino] ||= { n: 0, nivelSaida: 0, batalhas: 0, derrotas: 0, tent: 0, vitorias: 0 });
      a.n++; a.nivelSaida += r.nivelSaida; a.batalhas += r.batalhas; a.derrotas += r.derrotas; a.tent += r.tentativasChefe; a.vitorias += r.venceuChefe ? 1 : 0;
    }
  }
  console.log(`\n=== ${classe} (${N} jogos, zerou ${zerou}/${N}) ===`);
  for (const [k, a] of Object.entries(agg)) {
    console.log(`${k.padEnd(8)} nv_saida=${(a.nivelSaida / a.n).toFixed(1)}  lutas=${(a.batalhas / a.n).toFixed(1)}  derrotas=${(a.derrotas / a.n).toFixed(1)}  tent_chefe=${(a.tent / a.n).toFixed(2)}  chefe_venceu=${a.vitorias}/${a.n}`);
  }
}
