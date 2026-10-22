'use strict';
/* Robô jogador usado pelos testes de tela (boss.js e tutorial.js): roda DENTRO da página, com os mesmos toques do jogador. */
/** Robô que roda DENTRO da página, usando os mesmos toques do jogador (ACOES.hex e botões). Devolve como a etapa terminou. */
module.exports = `window.robo = async function (maxIter = 400) {
  const campoAte = alvos => {
    const campo = new Map(), fila = [];
    for (const a of alvos) { campo.set(chave(a.c, a.r), 0); fila.push({ c: a.c, r: a.r }); }
    while (fila.length) { const cur = fila.shift(), d = campo.get(chave(cur.c, cur.r)); for (const v of vizinhos(T.g, cur.c, cur.r)) { const k = chave(v.c, v.r); if (!campo.has(k)) { campo.set(k, d + 1); fila.push(v); } } }
    return campo;
  };
  const fim = () => ACOES['tat-fim']();
  for (let i = 0; i < maxIter; i++) {
    if (!T) return 'sem etapa';
    if (T.fim) return T.fim;
    if (T.fase === 'escolha' && !OCUPADO) {      // escolhe a carta da rodada: a que anda e ataca (na sala limpa: a que mais anda)
      if (window.ROBO_INVENCIVEL && P.hp < derivados(P).hpMax) P.hp = derivados(P).hpMax;
      if (window.ROBO_INVENCIVEL && T.perdidas.length >= 4) T.mao.push(...T.perdidas.splice(0));   // idem para as cartas: só o fluxo importa   // só nos testes de fluxo (boss.js): o robô não precisa sobreviver, só andar pela campanha
      if (T.descarte.length >= 2 && !T.rapidoUsado && (T.mao.length <= 1 || (!window.ROBO_INVENCIVEL && P.hp < derivados(P).hpMax * 0.4))) ACOES['tat-rapido']();   // descanso rápido: a mão acabando
      const mao = [...T.mao];
      if (!mao.length) { await new Promise(r => setTimeout(r, 5)); continue; }
      const m = c => metadesDaCarta(c), usa = (c, f) => (c ? f(m(c)) : 0);
      const pontosAtq = c => usa(c, x => (x.topo && x.topo.atq) || 0) * 3 + (c.queima ? -2 : 0), pontosMov = c => usa(c, x => (x.base && x.base.mov) || 0);
      const porAtq = [...mao].sort((a, b) => pontosAtq(b) - pontosAtq(a) || a.ini - b.ini);
      const porMov = [...mao].sort((a, b) => pontosMov(b) - pontosMov(a) || a.ini - b.ini);
      const precisa = T.limpa ? 1 : Math.min(2, mao.length);
      let a = T.limpa ? porMov[0] : porAtq[0], b = (T.limpa ? porMov : porMov).find(c => c !== a);
      if (precisa === 2 && !b) b = mao.find(c => c !== a);
      ACOES['tat-carta']({ dataset: { id: a.id } });
      if (precisa === 2) ACOES['tat-carta']({ dataset: { id: b.id } });
      ACOES['tat-jogar']();
      continue;
    }
    if (T.fase !== 'heroi' || OCUPADO) { await new Promise(r => setTimeout(r, 5)); continue; }
    if (T.modo2 && T.pendentes.length && T.acaoUsada && T.movRest === 0 && !T.forcaFila.length) {          // duas cartas: escolhe a próxima metade a usar
      const estrs = T.objetivo === 'destruir' && T.ultimaEtapa ? vivos(T).filter(e => e.estrutura) : [];
      const alvosVivos = estrs.length ? estrs : (combatentes(T).length ? combatentes(T) : vivos(T));
      let melhor = null;
      for (const c of T.pendentes) {
        const mm = metadesDaCarta(c);
        const perto = mm.topo && mm.topo.atq && alvosVivos.some(e => dist(e, T.heroi) <= (mm.topo.alc || 1));
        const nota = T.limpa ? ((mm.base && mm.base.mov) || 0) : perto ? 100 + mm.topo.atq : ((mm.base && mm.base.mov) || 0) * 2 + (mm.topo && mm.topo.cura && P.hp < derivados(P).hpMax * 0.6 ? 30 : 0);
        const q = T.limpa ? 'base' : perto ? 'topo' : ((mm.base && mm.base.mov) ? 'base' : (mm.topo ? 'topo' : 'base'));
        if ((q === 'base' ? mm.base : mm.topo) && metadePermitida(T, c, q) && (!melhor || nota > melhor.nota)) melhor = { c, q, nota };
      }
      if (!melhor) { await fim(); continue; }
      ACOES['tat-metade']({ dataset: { id: melhor.c.id, q: melhor.q } });
      continue;
    }
    const pf = pendenciaForca(T);       // empurrar/puxar: escolhe o melhor lugar (como o jogador faria)
    if (pf) { const op = melhorOpcaoForca(T, pf.opcoes, pf.alvo, T.heroi, pf.modo); ACOES.hex({ dataset: { c: op.c, r: op.r } }); continue; }
    if (T.limpa) {      // sala limpa: pega as moedas e o baú (sem pisar em armadilhas) e vai à porta (ou à entrada, na última sala)
      if ((T.bau && !T.bau.aberto && T.heroi.c === T.bau.c && T.heroi.r === T.bau.r) || (T.chave && !T.chave.pega && T.heroi.c === T.chave.c && T.heroi.r === T.chave.r)) { await fim(); continue; }
      const loot = [...T.moedas.keys()].map(k => { const [c, r] = k.split(',').map(Number); return { c, r }; }).filter(a => !T.armadilhas.has(chave(a.c, a.r)));
      if (T.bau && !T.bau.aberto) loot.push({ c: T.bau.c, r: T.bau.r });
      if (T.chave && !T.chave.pega) loot.push({ c: T.chave.c, r: T.chave.r });
      const meta = loot.length ? loot : [T.ultimaEtapa ? T.saida : T.porta];
      const campo = campoAte(meta), atual = campo.get(chave(T.heroi.c, T.heroi.r)) ?? 999;
      let melhor = null;
      for (const evita of [true, false]) {
        for (const h of tAlcance(T)) { if (evita && h.armadilhas > 0) continue; const d = campo.get(chave(h.c, h.r)) ?? 999; if (d < atual && (!melhor || d < melhor.d)) melhor = { c: h.c, r: h.r, d, arm: h.armadilhas > 0 }; }
        if (melhor) break;
      }
      if (melhor && T.movRest > 0) { ACOES.hex({ dataset: { c: melhor.c, r: melhor.r } }); if (melhor.arm) ACOES.hex({ dataset: { c: melhor.c, r: melhor.r } }); continue; }
      await fim(); continue;
    }
    const fraco = P.hp < derivados(P).hpMax * 0.5 && combatentes(T).length > 0;   // machucado: luta antes de correr para o baú
    const alvoObj = alvoDeObjetivo(T), irBau = !!alvoObj && !fraco;
    if (irBau && T.heroi.c === alvoObj.c && T.heroi.r === alvoObj.r) { await fim(); continue; }
    let alvos;
    if (irBau) alvos = [alvoObj];
    else {
      const prefere = T.objetivo === 'destruir' && T.ultimaEtapa ? vivos(T).filter(e => e.estrutura) : combatentes(T);
      alvos = prefere.length ? prefere : vivos(T);
    }
    if (!irBau && !T.acaoUsada && !temCond(T.efeitos, 'desarmado')) {
      const na = tAlvos(T, P, { tipo: 'atacar' }).find(e => alvos.includes(e)) || tAlvos(T, P, { tipo: 'atacar' })[0];
      if (na) { ACOES.hex({ dataset: { c: na.c, r: na.r } }); continue; }
    }
    if (T.movRest > 0) {
      const campo = campoAte(alvos), atual = campo.get(chave(T.heroi.c, T.heroi.r)) ?? 999;
      let melhor = null;
      // 1º tenta um caminho sem armadilhas; se não houver, atravessa uma (o jogo pede um 2º toque para confirmar)
      for (const evita of [true, false]) {
        for (const h of tAlcance(T)) { if (evita && h.armadilhas > 0) continue; const d = campo.get(chave(h.c, h.r)) ?? 999; if (!melhor || d < melhor.d) melhor = { c: h.c, r: h.r, d, arm: h.armadilhas > 0 }; }
        if (melhor && melhor.d < atual) break;
        melhor = null;
      }
      if (melhor) { ACOES.hex({ dataset: { c: melhor.c, r: melhor.r } }); if (melhor.arm) ACOES.hex({ dataset: { c: melhor.c, r: melhor.r } }); continue; }
    }
    if (!T.acaoUsada && !temCond(T.efeitos, 'desarmado')) { const na = tAlvos(T, P)[0]; if (na) { ACOES.hex({ dataset: { c: na.c, r: na.r } }); continue; } }   // caminho bloqueado por um inimigo: ataca em vez de ficar parado
    await fim();
  }
  return maxIter < 400 ? 'seguindo' : 'travou';
};`;
