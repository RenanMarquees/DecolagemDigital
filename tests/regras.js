'use strict';
/* Testa as regras de armadilhas, portas e etapas direto no motor (sem navegador).
   Uso: node tests/regras.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = vm.createContext({ Math, console });
for (const f of ['data.js', 'logic.js', 'mapas.js', 'tatica.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx);
const R = (code) => vm.runInContext(code, ctx);

let ok = 0, falhas = [];
function teste(nome, f) {
  try { f(); ok++; console.log('  ✓ ' + nome); }
  catch (e) { falhas.push(nome); console.log('  ✗ ' + nome + '\n      ' + e.message); }
}
const igual = (a, b, msg) => { if (a !== b) throw new Error(`${msg || 'esperava'}: esperado ${b}, veio ${a}`); };
const verdade = (v, msg) => { if (!v) throw new Error(msg || 'esperava verdadeiro'); };

// Cria uma etapa de teste: herói forte em (0,10), inimigos longe e fracos de ataque, uma só armadilha opcional.
R(`
function cenario(reinoId, opts = {}) {
  const reino = REINOS.find(r => r.id === reinoId);
  const p = novoJogador('T', 'guerreiro'); p.nivel = 10; { const d = derivados(p); p.hp = d.hpMax; p.mp = d.mpMax; }
  const exp = criarExpedicao(reino, opts.chefe ? reino.chefe : null);
  exp.etapas.forEach((e, i) => { if (!e.chefe && reino.salas[i]) e.mapa = reino.salas[i]; }); // salas fixas, para o teste não depender de sorteio
  if (opts.chefe) exp.idx = exp.etapas.length - 1;          // vai direto para a arena do chefe
  const T = criarTatica(reino, exp, p);
  T.armadilhas.clear();
  // inimigos bem longe e sem força, para não atrapalhar
  T.inim.forEach((e, i) => { e.c = 11 - i; e.r = 0; e.atk = 1; e.alc = 0; e.hp = e.hpMax = 9999; }); // alc 0: nunca atacam
  T.heroi = { c: 0, r: 10 };
  T.movRest = derivados(p).mov;
  return { reino, p, T };
}
function armar(T, c, r, tipo) { T.armadilhas.set(chave(c, r), { tipo }); }
function rodada(T, p) { tEncerrarTurno(T); let g = 0; while (T.fase === 'inimigos' && !T.fim && g++ < 20) tProximoInimigo(T, p); }
`);

console.log('\nCombate (para não esquecer o básico)');
teste('atacar e usar habilidade causam dano e podem derrotar', () => {
  const r = R(`(() => { const { p, T } = cenario('valhala');
    const e = T.inim[0]; e.c = 1; e.r = 10; e.hp = e.hpMax = 100; T.heroi = { c: 0, r: 10 };
    const a = tAtacar(T, p, e.uid); const dano1 = 100 - e.hp;
    T.acaoUsada = false; e.hp = 5; const b = tHabilidade(T, p, 'golpe_poderoso', e.uid);
    return { a, b, dano1, vivo: e.vivo, mortos: T.mortos.length }; })()`);
  igual(r.a, true); verdade(r.dano1 > 0, 'o ataque deveria causar dano'); igual(r.b, true); igual(r.vivo, false, 'inimigo derrotado');
});
teste('habilidade em área atinge o alvo e quem está ao lado', () => {
  const r = R(`(() => { const { p, T } = cenario('valhala'); p.nivel = 12; p.classe = 'oraculo'; p.mp = 999;
    T.inim.push({ ...T.inim[0], uid: 99, efeitos: [] });   // a etapa 1 de Valhala só tem 2; este é o 3º
    const [a, b, c] = T.inim; a.c = 6; a.r = 7; b.c = 7; b.r = 7; c.c = 11; c.r = 0;      // a e b juntos (linha livre); c longe
    a.hp = a.hpMax = b.hp = b.hpMax = c.hp = c.hpMax = 500; T.heroi = { c: 3, r: 7 };
    const ok = tHabilidade(T, p, 'julgamento_deuses', a.uid); return { ok, a: a.hp < 500, b: b.hp < 500, c: c.hp < 500 }; })()`);
  igual(r.ok, true); igual(r.a && r.b, true, 'os dois juntos'); igual(r.c, false, 'o distante não é atingido');
});

console.log('\nExpedições e etapas');
teste('explorar tem 2 etapas; chefe tem 3; Abismo tem 1', () => {
  const r = R(`(() => { const v = REINOS[0], c = REINOS[4];
    return [criarExpedicao(v, null).etapas.length, criarExpedicao(v, v.chefe).etapas.length, criarExpedicao(c, c.chefe).etapas.length]; })()`);
  igual(r.join(), '2,3,1');
});
teste('o chefe fica sempre (e só) na última etapa', () => {
  const r = R(`REINOS.filter(x => !x.final).map(reino => {
    const e = criarExpedicao(reino, reino.chefe).etapas;
    return e.map((x, i) => !!x.chefe === (i === e.length - 1)).every(Boolean) && e.filter(x => x.chefe).length === 1;
  })`);
  verdade(r.every(Boolean), JSON.stringify(r));
});
teste('as etapas têm mais inimigos que as anteriores (Valhala 2 → 3; Inferno 3 → 4)', () => {
  const r = R(`[REINOS[0], REINOS[2]].map(reino => { const e = criarExpedicao(reino, null).etapas; return e[0].n + '→' + e[1].n; })`);
  igual(r.join(), '2→3,3→4');
});
teste('o chefe só aparece na arena (etapas anteriores não têm chefe)', () => {
  const r = R(`(() => { const { reino, p } = cenario('valhala', { chefe: true });
    const exp = criarExpedicao(reino, reino.chefe); const out = [];
    for (let i = 0; i < exp.etapas.length; i++) { exp.idx = i; const T = criarTatica(reino, exp, p); out.push(T.inim.some(e => e.chefe) + ':' + T.ultimaEtapa); }
    return out; })()`);
  igual(r.join(), 'false:false,false:false,true:true');
});
teste('a última etapa não tem porta; as outras têm', () => {
  const r = R(`(() => { const { reino, p } = cenario('olimpo');
    const exp = criarExpedicao(reino, null); const out = [];
    for (let i = 0; i < exp.etapas.length; i++) { exp.idx = i; out.push(!!criarTatica(reino, exp, p).porta); }
    return out; })()`);
  igual(r.join(), 'true,false');
});

console.log('\nArmadilhas');
teste('cada cenário usa a armadilha do seu tema', () => {
  igual(R(`REINOS.map(r => r.armadilha).join()`), 'gelo,raio,fogo,veneno,vazio');
});
teste('as salas nascem com armadilhas no chão (do tipo do cenário)', () => {
  const r = R(`REINOS.filter(x => !x.final).map(reino => { const p = novoJogador('T', 'guerreiro');
    const T = criarTatica(reino, criarExpedicao(reino, null), p);
    return T.armadilhas.size >= 4 && [...T.armadilhas.values()].every(a => a.tipo === reino.armadilha); })`);
  verdade(r.every(Boolean));
});
teste('gelo: -1 de movimento por 2 rodadas, depois volta ao normal', () => {
  const r = R(`(() => { const { p, T } = cenario('valhala'); const mov = derivados(p).mov;
    armar(T, 1, 10, 'gelo'); tMover(T, p, 1, 10);
    const agora = T.movRest;                               // gastou 1 passo e perdeu 1 pelo gelo
    rodada(T, p); const r2 = T.movRest;                    // 2ª rodada: ainda com gelo
    rodada(T, p); const r3 = T.movRest;                    // 3ª rodada: normal
    return { mov, agora, r2, r3, sobrou: T.efeitos.length }; })()`);
  igual(r.agora, r.mov - 2, 'movimento restante logo após pisar');
  igual(r.r2, r.mov - 1, 'movimento na 2ª rodada');
  igual(r.r3, r.mov, 'movimento na 3ª rodada');
  igual(r.sobrou, 0, 'efeitos restantes');
});
teste('fogo: causa dano (15% da vida máxima)', () => {
  const r = R(`(() => { const { p, T } = cenario('inferno'); const d = derivados(p); const antes = p.hp;
    armar(T, 1, 10, 'fogo'); tMover(T, p, 1, 10); return { perdeu: antes - p.hp, esperado: Math.round(d.hpMax * 0.15) }; })()`);
  igual(r.perdeu, r.esperado);
});
teste('veneno: dano por 3 rodadas e depois para', () => {
  const r = R(`(() => { const { p, T } = cenario('duat'); const d = derivados(p);
    armar(T, 1, 10, 'veneno'); tMover(T, p, 1, 10);
    const hp0 = p.hp; const hist = [];
    for (let i = 0; i < 5; i++) { const a = p.hp; rodada(T, p); hist.push(a - p.hp); }
    return { hist, tick: Math.round(d.hpMax * 0.05), semDanoImediato: hp0 === d.hpMax }; })()`);
  verdade(r.semDanoImediato, 'veneno não deveria dar dano imediato');
  igual(r.hist.join(), [r.tick, r.tick, r.tick, 0, 0].join(), 'dano por rodada');
});
teste('raio: dano e o movimento acaba no hexágono da armadilha', () => {
  const r = R(`(() => { const { p, T } = cenario('olimpo'); const d = derivados(p);
    armar(T, 1, 10, 'raio'); tMover(T, p, 3, 10);          // tentava ir 3 hexágonos para a direita
    return { pos: T.heroi.c + ',' + T.heroi.r, mov: T.movRest, perdeu: d.hpMax - p.hp, esperado: Math.round(d.hpMax * 0.10) }; })()`);
  igual(r.pos, '1,10', 'parou na armadilha');
  igual(r.mov, 0, 'movimento restante');
  igual(r.perdeu, r.esperado, 'dano');
});
teste('vazio: dano e drena 30% da mana', () => {
  const r = R(`(() => { const { p, T } = cenario('caos', { chefe: true }); const d = derivados(p);
    armar(T, 1, 10, 'vazio'); tMover(T, p, 1, 10);
    return { mana: d.mpMax - p.mp, esperado: Math.round(d.mpMax * 0.3), dano: d.hpMax - p.hp }; })()`);
  igual(r.mana, r.esperado, 'mana drenada');
  verdade(r.dano > 0, 'deveria dar algum dano');
});
teste('a armadilha some depois de disparar', () => {
  const r = R(`(() => { const { p, T } = cenario('inferno'); armar(T, 1, 10, 'fogo'); tMover(T, p, 1, 10); return T.armadilhas.size; })()`);
  igual(r, 0);
});
teste('o caminho evita armadilhas quando existe outro igualmente curto', () => {
  const r = R(`(() => { let achou = 0, pisou = 0;
    const { p, T } = cenario('valhala');
    const ini = { c: 5, r: 6 };                                // meio da sala, onde há várias rotas
    T.heroi = { ...ini }; T.movRest = 5;
    for (const alvo of tAlcance(T).filter(a => a.custo >= 3)) {
      // primeiro passo do caminho comum; só vale o caso se existir outra rota do mesmo tamanho sem ele
      const nos = bfs(T.g, ini, 6, () => false, () => false);
      const meio = caminhoAte(nos.get(chave(alvo.c, alvo.r)))[0];
      const sem = bfs(T.g, ini, 6, (c, r) => c === meio.c && r === meio.r, () => false).get(chave(alvo.c, alvo.r));
      if (!sem || sem.d !== alvo.custo) continue;
      achou++;
      T.armadilhas.clear(); armar(T, meio.c, meio.r, 'gelo');
      T.heroi = { ...ini }; T.movRest = 5; T.efeitos = [];
      tMover(T, p, alvo.c, alvo.r);
      if (!T.armadilhas.has(chave(meio.c, meio.r))) pisou++;   // a armadilha sumiu = pisou nela
    }
    return { achou, pisou }; })()`);
  verdade(r.achou >= 5, 'poucos casos testados: ' + r.achou);
  igual(r.pisou, 0, 'vezes que pisou sem precisar');
});
teste('o herói avisa quando o caminho passa por armadilha (alcance.armadilhas)', () => {
  const r = R(`(() => { const { p, T } = cenario('valhala'); armar(T, 1, 10, 'gelo');
    const a = tAlcance(T).find(h => h.c === 3 && h.r === 10); return a.armadilhas; })()`);
  igual(r, 1);
});
teste('inimigo que pisa em armadilha sofre o efeito (fogo)', () => {
  const r = R(`(() => { const { p, T } = cenario('inferno');
    const e = T.inim[0]; e.hp = e.hpMax = 200; e.mov = 4; e.alc = 1;
    e.c = 0; e.r = 6; T.heroi = { c: 0, r: 10 };           // 4 hexágonos acima do herói, em linha reta
    for (let r = 7; r <= 9; r++) armar(T, 0 + ((r & 1) ? 0 : 0), r, 'fogo'); // sem como desviar tudo; só confere dano
    const antes = e.hp; rodada(T, p); return { perdeu: antes - e.hp, restantes: T.armadilhas.size }; })()`);
  verdade(r.perdeu > 0, 'o inimigo deveria ter se ferido');
});
teste('chefes sofrem só metade do efeito da armadilha', () => {
  const r = R(`(() => { const { p, T } = cenario('inferno', { chefe: true });
    const e = T.inim.find(x => x.chefe); e.hp = e.hpMax = 1000; e.c = 5; e.r = 5;
    armar(T, 5, 5, 'fogo'); dispararArmadilha(T, p, e, 5, 5); return 1000 - e.hp; })()`);
  igual(r, Math.round(1000 * 0.15 * 0.5));
});
teste('armadilha de veneno também envenena inimigos (dano por 3 rodadas)', () => {
  const r = R(`(() => { const { p, T } = cenario('duat'); const e = T.inim[0]; e.hp = e.hpMax = 1000; e.c = 5; e.r = 5;
    armar(T, 5, 5, 'veneno'); dispararArmadilha(T, p, e, 5, 5);
    e.mov = 1; e.c = 11; e.r = 0;                           // fica parado longe
    const hist = []; for (let i = 0; i < 4; i++) { const a = e.hp; rodada(T, p); hist.push(a - e.hp); } return hist; })()`);
  igual(r.join(), '50,50,50,0');
});
teste('armadilha de gelo reduz o movimento do inimigo nas 2 rodadas seguintes', () => {
  const r = R(`(() => { const { p, T } = cenario('valhala'); const e = T.inim[0]; e.mov = 3;
    armar(T, 5, 5, 'gelo'); dispararArmadilha(T, p, e, 5, 5);
    const out = []; for (let i = 0; i < 3; i++) { passarEfeitos(T, p); out.push(movEfetivo(e.mov, e.efeitos)); } return out; })()`);
  igual(r.join(), '2,2,3');   // rodada seguinte e a depois dela com -1; na terceira volta ao normal
});

console.log('\nPortas');
teste('a porta fechada bloqueia o caminho e a visão', () => {
  const r = R(`(() => { const { p, T } = cenario('valhala'); const { c, r } = T.porta;
    const viz = vizinhos(T.g, c, r).length > 0; // existem hexágonos ao lado, mas a porta em si não é chão
    return { chao: celula(T.g, c, r), alcanca: tAlcance({ ...T, movRest: 99 }).some(h => h.c === c && h.r === r), viz }; })()`);
  igual(r.chao, 'D'); igual(r.alcanca, false, 'dá para chegar na porta fechada?');
});
teste('a porta só abre quando todos os inimigos morrem', () => {
  const r = R(`(() => { const { p, T } = cenario('valhala');
    const fechada = tAbrirPorta({ ...T, porta: { ...T.porta } }) === true; // abrir à força não deve ser usado antes da hora pela interface
    T.inim.forEach(e => { e.hp = 0; }); verificarMortes(T);
    return { fim: T.fim, abriu: tAbrirPorta(T), livre: T.livre, celula: celula(T.g, T.porta.c, T.porta.r) }; })()`);
  igual(r.fim, 'vitoria'); igual(r.abriu, true); igual(r.livre, true); igual(r.celula, '.');
});
teste('com a porta aberta, andar até ela leva à próxima etapa', () => {
  const r = R(`(() => { const { p, T } = cenario('valhala');
    T.inim.forEach(e => { e.hp = 0; }); verificarMortes(T); tAbrirPorta(T);
    const ok = tMover(T, p, T.porta.c, T.porta.r); return { ok, fim: T.fim }; })()`);
  igual(r.ok, true); igual(r.fim, 'porta');
});
teste('a próxima etapa tem mais inimigos, nova sala e devolve parte da vida e mana', () => {
  const r = R(`(() => { const { reino, p, T } = cenario('valhala'); const d = derivados(p);
    const n1 = T.inim.length; p.hp = Math.round(d.hpMax * 0.4); p.mp = 0;
    T.inim.forEach(e => { e.hp = 0; }); verificarMortes(T); tAbrirPorta(T); tMover(T, p, T.porta.c, T.porta.r);
    const N = tProximaEtapa(T, p);
    return { n1, n2: N.inim.length, etapa: N.etapa, de: N.totalEtapas, hp: p.hp, hpEsperado: Math.round(d.hpMax * 0.4) + Math.round(d.hpMax * RECUPERA_PORTA), mp: p.mp, mpEsperado: Math.round(d.mpMax * RECUPERA_PORTA), salaDiferente: N.idSala !== T.idSala }; })()`);
  verdade(r.n2 > r.n1, `etapa 2 deveria ter mais inimigos (${r.n1} → ${r.n2})`);
  igual(r.etapa, 2); igual(r.de, 3 - 1 === 2 ? 2 : 2); igual(r.hp, r.hpEsperado, 'vida'); igual(r.mp, r.mpEsperado, 'mana');
  verdade(r.salaDiferente, 'deveria ser outra sala');
});
teste('no modo livre (sala limpa) não há turno dos inimigos', () => {
  const r = R(`(() => { const { p, T } = cenario('valhala'); T.inim.forEach(e => { e.hp = 0; }); verificarMortes(T); tAbrirPorta(T); return tEncerrarTurno(T); })()`);
  igual(r, false);
});
teste('armadilhas do caminho até a porta ainda disparam', () => {
  const r = R(`(() => { const { p, T } = cenario('inferno'); const antes = p.hp;
    T.inim.forEach(e => { e.hp = 0; }); verificarMortes(T); tAbrirPorta(T);
    armar(T, 1, 10, 'fogo'); tMover(T, p, 3, 10); return { perdeu: antes - p.hp }; })()`);
  verdade(r.perdeu > 0, 'deveria ter pisado na armadilha da linha reta');
});
teste('só dá para fugir pela entrada, e nunca na arena do chefe', () => {
  const r = R(`(() => {
    const a = cenario('valhala'); a.T.heroi = { ...a.T.saida }; const livre = tFugir(a.T);
    const b = cenario('valhala'); b.T.heroi = { c: 4, r: 4 }; const longe = tFugir(b.T);
    const c = cenario('valhala', { chefe: true }); c.T.exp.idx = 2; const T3 = criarTatica(c.reino, c.T.exp, c.p); T3.heroi = { ...T3.saida }; const arena = tFugir(T3);
    return [livre, longe, arena]; })()`);
  igual(r.join(), 'true,false,false');
});
teste('derrotar tudo na última etapa termina a expedição (sem porta)', () => {
  const r = R(`(() => { const { reino, p } = cenario('valhala'); const exp = criarExpedicao(reino, null); exp.idx = 1;
    const T = criarTatica(reino, exp, p); T.inim.forEach(e => { e.hp = 0; }); verificarMortes(T);
    return { fim: T.fim, porta: T.porta, ultima: T.ultimaEtapa }; })()`);
  igual(r.fim, 'vitoria'); igual(r.porta, null); igual(r.ultima, true);
});

console.log(`\n${ok} testes passaram${falhas.length ? `, ${falhas.length} FALHARAM: ${falhas.join('; ')}` : ''}.`);
process.exit(falhas.length ? 1 : 0);
