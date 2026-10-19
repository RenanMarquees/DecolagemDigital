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
    if (T.fase === 'escolha' && !OCUPADO) {      // escolhe a carta da rodada: a que anda e ataca, senão qualquer uma, senão descansa
      const mao = [...T.mao].sort((a, b) => ((b.atq ? 2 : 0) + (b.mov ? 1 : 0)) - ((a.atq ? 2 : 0) + (a.mov ? 1 : 0)) || a.ini - b.ini);
      const machucado = P.hp < derivados(P).hpMax * 0.5 && combatentes(T).length > 0;   // vida baixa: descansa (cura e devolve as cartas)
      ACOES['tat-carta']({ dataset: { id: mao.length && !machucado ? mao[0].id : 'descanso' } });
      ACOES['tat-jogar']();
      continue;
    }
    if (T.fase !== 'heroi' || OCUPADO) { await new Promise(r => setTimeout(r, 5)); continue; }
    const fraco = P.hp < derivados(P).hpMax * 0.5 && combatentes(T).length > 0;   // machucado: luta antes de correr para o baú
    const irBau = T.objetivo === 'bau' && T.ultimaEtapa && T.bau && !T.bau.aberto && !fraco;
    if (irBau && T.heroi.c === T.bau.c && T.heroi.r === T.bau.r) { await fim(); continue; }
    let alvos;
    if (irBau) alvos = [T.bau];
    else {
      const prefere = T.objetivo === 'destruir' && T.ultimaEtapa ? vivos(T).filter(e => e.estrutura) : combatentes(T);
      alvos = prefere.length ? prefere : vivos(T);
    }
    if (!irBau && !T.acaoUsada) {
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
    await fim();
  }
  return maxIter < 400 ? 'seguindo' : 'travou';
};`;
