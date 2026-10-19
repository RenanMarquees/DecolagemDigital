'use strict';
/* Testa as regras do jogo direto no motor (sem navegador): cenários e objetivos, cartas dos inimigos,
   empurrar/puxar, dificuldades, armadilhas, portas, moedas e baú.
   Uso: node tests/regras.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = vm.createContext({ Math, console });
for (const f of ['data.js', 'cartas.js', 'cenarios.js', 'logic.js', 'mapas.js', 'tatica.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx);
const R = (code) => vm.runInContext(code, ctx);

let ok = 0, falhas = [];
function teste(nome, f) {
  try { f(); ok++; console.log('  ✓ ' + nome); }
  catch (e) { falhas.push(nome); console.log('  ✗ ' + nome + '\n      ' + e.message); }
}
const igual = (a, b, msg) => { if (a !== b) throw new Error(`${msg || 'esperava'}: esperado ${b}, veio ${a}`); };
const verdade = (v, msg) => { if (!v) throw new Error(msg || 'esperava verdadeiro'); };
const perto = (a, b, tol, msg) => { if (Math.abs(a - b) > tol) throw new Error(`${msg || 'esperava'}: ${a} deveria estar perto de ${b} (±${tol})`); };

// Monta um cenário de teste: herói forte em (0,10); os inimigos ficam longe, parados e fracos.
R(`
function cen(id, opts = {}) {
  const c = cenarioPorId(id);
  const p = novoJogador('T', opts.classe || 'guerreiro'); p.nivel = opts.nivel || 10;
  { const d = derivados(p); p.hp = d.hpMax; p.mp = d.mpMax; }
  const exp = criarExpedicao(c, p, opts.dif || 'intermediario');
  if (opts.etapa !== undefined) exp.idx = opts.etapa;
  const T = criarTatica(exp, p);
  T.armadilhas.clear();
  if (!opts.vivos) {      // inimigos longe, parados e inofensivos (menos nos testes que querem lutar)
    T.inim.filter(e => !e.estrutura).forEach((e, i) => { e.c = 11 - i; e.r = 0; e.atk = 1; e.parado = true; e.hp = e.hpMax = 9999; });
  }
  T.heroi = { c: 0, r: 10 };
  T.movRest = derivados(p).mov;
  return { p, T, c, exp };
}
function armar(T, c, r, tipo) { T.armadilhas.set(chave(c, r), { tipo }); }
function rodada(T, p) { tEncerrarTurno(T, p); let g = 0; while (T.fase === 'inimigos' && !T.fim && g++ < 20) tProximoInimigo(T, p); }
function matarTodos(T) { T.inim.forEach(e => { e.hp = 0; }); verificarMortes(T); }
function carta(T, tipo, c) { T.cartas[tipo] = c; }
`);

console.log('\nOs 20 cenários');
teste('são 20, em ordem, 4 por reino, e cada mapa citado existe', () => {
  const r = R(`({ n: CENARIOS.length, ids: CENARIOS.map(c => c.id).join() === [...Array(20).keys()].map(i => i + 1).join(),
    porReino: REINOS.map(rn => cenariosDoReino(rn.id).length).join(), mapas: CENARIOS.every(c => c.etapas.every(e => MAPAS[e.mapa])) })`);
  igual(r.n, 20); verdade(r.ids, 'ids 1..20'); igual(r.porReino, '4,4,4,4,4'); verdade(r.mapas, 'todos os mapas existem');
});
teste('os 4 tipos de objetivo aparecem em todos os reinos, e o chefe é o último de cada reino', () => {
  const r = R(`REINOS.map(rn => cenariosDoReino(rn.id).map(c => c.objetivo).join('/'))`);
  for (const linha of r) igual(linha, 'matar_todos/bau/destruir/chefe');
});
teste('o chefe fica sempre (e só) na última etapa dos cenários de chefe; os outros não têm chefe', () => {
  const r = R(`CENARIOS.map(c => { const e = c.etapas; const ch = e.map((x, i) => !!x.chefe);
    return c.objetivo === 'chefe' ? (ch[e.length - 1] && ch.filter(Boolean).length === 1) : !ch.some(Boolean); })`);
  verdade(r.every(Boolean), JSON.stringify(r));
});
teste('cada cenário só abre depois de concluir o anterior', () => {
  const r = R(`(() => { const p = novoJogador('T', 'guerreiro');
    const antes = [cenarioDesbloqueado(p, cenarioPorId(1)), cenarioDesbloqueado(p, cenarioPorId(2)), reinoDesbloqueado(p, 1)];
    p.cenarios[1] = true; const dep = cenarioDesbloqueado(p, cenarioPorId(2));
    for (let i = 1; i <= 4; i++) p.cenarios[i] = true; const reino2 = reinoDesbloqueado(p, 1), cen5 = cenarioDesbloqueado(p, cenarioPorId(5));
    return [...antes, dep, reino2, cen5]; })()`);
  igual(r.join(), 'true,false,false,true,true,true');
});
teste('saves antigos (sem cenários) são migrados pelos chefes já vencidos', () => {
  const r = R(`(() => { const p = novoJogador('T', 'guerreiro'); delete p.cenarios; delete p.dificuldade; p.derrotados.fenrir = true; migrarSave(p);
    return [p.dificuldade, p.cenarios[1], p.cenarios[4], !!p.cenarios[5]]; })()`);
  igual(r.join(), 'intermediario,true,true,false');
});
teste('as etapas têm mais inimigos que as anteriores (Valhala 2 → 3; Inferno 3 → 4)', () => {
  const r = R(`[1, 9].map(id => { const { p, c } = cen(id); const exp = criarExpedicao(c, p); const n = [];
    for (let i = 0; i < 2; i++) { exp.idx = i; n.push(criarTatica(exp, p).inim.filter(e => !e.estrutura).length); } return n.join('→'); })`);
  igual(r.join(), '2→3,3→4');
});
teste('a última etapa não tem porta; as outras têm', () => {
  const r = R(`(() => { const { p, c } = cen(5); const exp = criarExpedicao(c, p); const out = [];
    for (let i = 0; i < exp.etapas.length; i++) { exp.idx = i; out.push(!!criarTatica(exp, p).porta); } return out; })()`);
  igual(r.join(), 'true,false');
});

console.log('\nObjetivos');
teste('matar todos: termina quando o último inimigo cai', () => {
  const r = R(`(() => { const { T } = cen(1, { etapa: 1, vivos: true }); const antes = String(T.fim); matarTodos(T); return [antes, T.fim, T.objetivoCumprido]; })()`);
  igual(r.join(), 'null,vitoria,true');
});
teste('baú: o objetivo é abrir o baú, mesmo com inimigos vivos', () => {
  const r = R(`(() => { const { p, T } = cen(2, { etapa: 1 }); const k = T.objetivo;
    T.heroi = { c: T.bau.c, r: T.bau.r }; // parado em cima do baú
    tEncerrarTurno(T, p); return { k, fim: T.fim, aberto: T.bau.aberto, vivos: T.inim.some(e => e.vivo) }; })()`);
  igual(r.k, 'bau'); igual(r.fim, 'vitoria'); igual(r.aberto, true);
});
teste('baú: matar todos NÃO cumpre o objetivo', () => {
  const r = R(`(() => { const { T } = cen(2, { etapa: 1, vivos: true }); matarTodos(T); return T.fim; })()`);
  igual(r, null);
});
teste('chefe: basta derrotar o chefe; os capangas recuam', () => {
  const r = R(`(() => { const { T } = cen(4, { etapa: 2, vivos: true }); const antes = T.fim;
    const boss = T.inim.find(e => e.chefe); boss.hp = 0; verificarMortes(T); return { antes, fim: T.fim, restantes: T.inim.filter(e => e.vivo).length, objetivo: T.objetivo }; })()`);
  igual(r.antes, null); igual(r.fim, 'vitoria'); igual(r.restantes, 0); igual(r.objetivo, 'chefe');
});
teste('destruir: há 3 estruturas que não atacam nem andam, e destruí-las cumpre o objetivo', () => {
  const r = R(`(() => { const { p, T } = cen(3, { etapa: 1, vivos: true });
    const est = T.inim.filter(e => e.estrutura);
    const imoveis = est.every(e => e.atk === 0 && e.mov === 0);
    est.forEach(e => { e.hp = 0; }); verificarMortes(T);
    return { n: est.length, imoveis, fim: T.fim, deviamSobrar: T.inim.some(e => !e.estrutura) }; })()`);
  igual(r.n, 3); verdade(r.imoveis, 'estruturas imóveis'); igual(r.fim, 'vitoria');
});
teste('destruir: estruturas não jogam cartas e podem ser atacadas', () => {
  const r = R(`(() => { const { p, T } = cen(3, { etapa: 1, vivos: true });
    const est = T.inim.find(e => e.estrutura); est.c = 1; est.r = 10; est.hp = est.hpMax = 500; T.heroi = { c: 0, r: 10 };
    const minis = Object.values(ESTRUTURAS).map(e => e.mini);
    const sinCarta = !Object.keys(T.cartas).some(k => minis.includes(k));
    tAtacar(T, p, est.uid); return { sinCarta, dano: 500 - est.hp }; })()`);
  verdade(r.sinCarta, 'estrutura não deve ter carta'); verdade(r.dano > 0, 'deveria sofrer dano');
});
teste('numa etapa que não é a última, limpar a sala abre a porta (não conclui o cenário)', () => {
  const r = R(`(() => { const { T } = cen(1, { etapa: 0, vivos: true }); matarTodos(T); return [T.fim, T.ultimaEtapa, T.objetivo]; })()`);
  igual(r.join(), 'vitoria,false,limpar');
});
teste('concluir o cenário marca como feito e sorteia ouro, XP ou item', () => {
  const r = R(`(() => { const tipos = new Set(); let todasPrimeira = true;
    for (let i = 0; i < 300; i++) { const { p, T } = cen(1, { etapa: 1 }); const rec = concluirCenario(T, p); tipos.add(rec.tipo); if (!p.cenarios[1]) todasPrimeira = false; }
    return { tipos: [...tipos].sort().join(), marcou: todasPrimeira }; })()`);
  igual(r.tipos, 'gold,item,xp'); verdade(r.marcou, 'deveria marcar como concluído');
});

console.log('\nMoedas e baú');
teste('cada inimigo derrotado solta uma moeda no hexágono onde caiu', () => {
  const r = R(`(() => { const { T } = cen(1, { etapa: 1, vivos: true }); const e = T.inim[0]; e.c = 5; e.r = 5; e.gold = 17; e.hp = 0;
    verificarMortes(T); return T.moedas.get(chave(5, 5)); })()`);
  igual(r && r.valor, 17);
});
teste('só pega a moeda quem PARA em cima dela (passar por cima não vale)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1 }); T.moedas.set(chave(2, 10), { valor: 25 });
    const g0 = p.gold; tMover(T, p, 4, 10);                  // passa pelo (2,10), mas termina no (4,10)
    const passou = p.gold - g0; T.heroi = { c: 0, r: 10 }; T.movRest = 4;
    tMover(T, p, 2, 10); return { passou, parou: p.gold - g0, restam: T.moedas.size }; })()`);
  igual(r.passou, 0, 'ouro ao só passar'); igual(r.parou, 25, 'ouro ao parar'); igual(r.restam, 0);
});
teste('as moedas valem ouro de verdade (usado no mercado)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1 }); T.moedas.set(chave(1, 10), { valor: 60 }); p.gold = 0; tMover(T, p, 1, 10); return p.gold; })()`);
  igual(r, 60);
});
teste('há 1 baú só, na última etapa', () => {
  const r = R(`(() => { const { p, c } = cen(1); const exp = criarExpedicao(c, p); const out = [];
    for (let i = 0; i < exp.etapas.length; i++) { exp.idx = i; out.push(!!criarTatica(exp, p).bau); } return out; })()`);
  igual(r.join(), 'false,true');
});
teste('o baú só abre se o herói terminar o turno parado nele (passar não vale)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1, vivos: true }); T.inim.forEach(e => { e.parado = true; e.c = 11; e.r = 0; });
    const b = { c: T.bau.c, r: T.bau.r }; T.heroi = { c: b.c, r: b.r }; T.fase = 'heroi';
    const antes = T.bau.aberto; const ouro0 = p.gold;
    tEncerrarTurno(T, p); return { antes, depois: T.bau.aberto, ouro: p.gold - ouro0, itens: T.bau.recompensa && T.bau.recompensa.itens.length }; })()`);
  igual(r.antes, false); igual(r.depois, true); verdade(r.ouro > 0, 'baú dá ouro'); verdade(r.itens >= 1, 'baú dá item');
});
teste('com a sala livre, parar no baú abre na hora (não há turnos)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1 }); matarTodos(T); tSaquear(T);
    const vizinho = vizinhos(T.g, T.bau.c, T.bau.r)[0]; T.heroi = { ...vizinho };
    tMover(T, p, T.bau.c, T.bau.r); return T.bau.aberto; })()`);
  igual(r, true);
});
teste('depois do objetivo, "saquear" deixa pegar o que sobrou antes de concluir', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1, vivos: true }); const e = T.inim[0]; e.c = 5; e.r = 7; e.gold = 40; matarTodos(T);
    const antes = T.fim; tSaquear(T); T.heroi = { c: 4, r: 7 }; const g0 = p.gold; tMover(T, p, 5, 7);
    return { antes, livre: T.livre, ganhou: p.gold - g0 }; })()`);
  igual(r.antes, 'vitoria'); igual(r.livre, true); verdade(r.ganhou >= 40, 'saqueou a moeda');
});

console.log('\nCartas dos inimigos');
teste('todo tipo de inimigo tem baralho (6+ cartas; chefes 8) com iniciativa', () => {
  const r = R(`Object.keys(INIMIGOS).filter(id => id !== 'caos_x').map(id => { const b = baralhoDe(id); return [id, b.length, b.every(c => typeof c.ini === 'number' && c.nome)]; })`);
  for (const [id, n, tudoOk] of r) { verdade(n >= 6, `${id} tem só ${n} cartas`); verdade(tudoOk, `${id} tem carta sem nome/iniciativa`); }
  const chefes = R(`['fenrir','ares','hades','set','caos'].map(id => baralhoDe(id).length)`);
  igual(chefes.join(), '8,8,8,8,8');
});
teste('cada tipo ganha UMA carta por rodada, igual para todos do mesmo tipo', () => {
  const r = R(`(() => { const { T } = cen(5, { etapa: 1, vivos: true });
    T.inim.forEach(e => { e.tipo = 'harpia'; }); T.cartas = {}; revelarCartas(T); const so1 = Object.keys(T.cartas).length;
    T.inim[0].tipo = 'minotauro'; T.cartas = {}; revelarCartas(T); const so2 = Object.keys(T.cartas).length;
    return [so1, so2]; })()`);
  igual(r.join(), '1,2');
});
teste('o baralho gira: em 7 rodadas aparecem 7 cartas diferentes e depois embaralha de novo', () => {
  const r = R(`(() => { const { T } = cen(1, { etapa: 1, vivos: true }); const tipo = T.inim[0].tipo; const nomes = [];
    T.inim.forEach(e => { e.tipo = tipo; });
    const total = baralhoDe(tipo).length;
    T.cartas = {}; T.baralhos = {};
    for (let i = 0; i < total; i++) { revelarCartas(T); nomes.push(T.cartas[tipo].nome); }
    const unicas = new Set(nomes).size; revelarCartas(T);          // a de número total+1 reembaralha
    return { total, unicas, proxima: !!T.cartas[tipo] }; })()`);
  igual(r.unicas, r.total, 'cartas diferentes no ciclo'); verdade(r.proxima, 'continua sorteando');
});
teste('carta "anda +1, ataque -1": anda 1 a mais que o normal e ataca mais fraco', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1, vivos: true }); T.inim.slice(1).forEach(e => { e.parado = true; e.c = 11; e.r = 0; });
    const e = T.inim[0]; e.tipo = 'draugr'; e.mov = 2; e.alc = 1; e.c = 6; e.r = 10; e.hp = e.hpMax = 9999; T.heroi = { c: 0, r: 10 };
    const d0 = dist(e, T.heroi); carta(T, 'draugr', K('teste', 30, { mov: 1, atq: -1 })); tEncerrarTurno(T, p); tProximoInimigo(T, p);
    return { andou: d0 - dist(e, T.heroi) }; })()`);
  igual(r.andou, 3, 'andou (2 base + 1 da carta)');
});
teste('carta "não anda, ataque +2": fica parado e bate mais forte que o normal', () => {
  const r = R(`(() => { const out = {}; for (const mod of [0, 2]) { let soma = 0, n = 0, moveu = false;
    for (let i = 0; i < 200; i++) { const { p, T } = cen(1, { etapa: 1, vivos: true }); T.inim.slice(1).forEach(e => { e.parado = true; e.c = 11; e.r = 0; });
      const e = T.inim[0]; e.tipo = 'draugr'; e.atk = 100; e.c = 1; e.r = 10; T.heroi = { c: 0, r: 10 }; p.hp = 99999; const a0 = { c: e.c, r: e.r };
      carta(T, 'draugr', mod ? K('t', 30, { atq: mod }) : K('t', 30, { mov: 0, atq: 0 })); const hp0 = p.hp; T.defendendo = false;
      tEncerrarTurno(T, p); tProximoInimigo(T, p); if (e.c !== a0.c || e.r !== a0.r) moveu = true; if (p.hp < hp0) { soma += hp0 - p.hp; n++; } }
    out[mod] = { media: soma / Math.max(1, n), moveu }; } return out; })()`);
  perto(r['2'].media / r['0'].media, 1.3 / 1.0, 0.08, 'razão do dano (+2 ≈ +30%)'); igual(r['2'].moveu, false, 'carta sem andar');
});
teste('carta sem "ataque" não bate, mesmo ao lado do herói', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1, vivos: true }); T.inim.slice(1).forEach(e => { e.parado = true; e.c = 11; e.r = 0; });
    const e = T.inim[0]; e.tipo = 'draugr'; e.c = 1; e.r = 10; T.heroi = { c: 0, r: 10 }; const hp0 = p.hp;
    carta(T, 'draugr', K('t', 30, { escudo: 1 })); tEncerrarTurno(T, p); tProximoInimigo(T, p); return hp0 - p.hp; })()`);
  igual(r, 0);
});
teste('carta "cura 2 e fortalece": cura os aliados ao lado e dá +1 de ataque', () => {
  const r = R(`(() => { const { p, T } = cen(5, { etapa: 1, vivos: true }); T.inim.slice(2).forEach(e => { e.parado = true; e.c = 11; e.r = 0; });
    const [a, b] = T.inim; a.tipo = 'satiro'; b.tipo = 'harpia'; a.c = 6; a.r = 5; b.c = 7; b.r = 5; a.hpMax = b.hpMax = 100; a.hp = 50; b.hp = 50;
    T.heroi = { c: 0, r: 10 }; carta(T, 'satiro', K('t', 5, { curar: 2, fortalecer: 1 }));
    carta(T, 'harpia', K('t', 99, {})); tEncerrarTurno(T, p); tProximoInimigo(T, p);       // o sátiro age primeiro (iniciativa 5)
    return { a: a.hp, b: b.hp, bonusA: a.bonusAtq, bonusB: b.bonusAtq }; })()`);
  igual(r.a, 62, 'curou a si (2 × 6% de 100)'); igual(r.b, 62, 'curou o aliado ao lado'); igual(r.bonusA, 1); igual(r.bonusB, 1);
});
teste('escudo reduz 20% do dano por ponto', () => {
  const r = R(`(() => { const out = {}; for (const esc of [0, 2]) { let soma = 0;
    for (let i = 0; i < 300; i++) { const { p, T } = cen(1, { etapa: 1, vivos: true }); const e = T.inim[0]; e.c = 1; e.r = 10; e.hp = e.hpMax = 99999; e.def = 0; e.escudo = esc; T.heroi = { c: 0, r: 10 };
      const hp0 = e.hp; golpeT(T, derivados(p), e, 100); soma += hp0 - e.hp; } out[esc] = soma / 300; } return out; })()`);
  perto(r['2'] / r['0'], 0.6, 0.05, 'razão do dano com escudo 2');
});
teste('a iniciativa decide a ordem: carta de número menor age primeiro', () => {
  const r = R(`(() => { const { p, T } = cen(5, { etapa: 1, vivos: true }); const [a, b] = T.inim; a.tipo = 'harpia'; b.tipo = 'minotauro'; T.inim.slice(2).forEach(e => { e.parado = true; e.c = 11; e.r = 0; });
    carta(T, 'harpia', K('t', 80, {})); carta(T, 'minotauro', K('t', 10, {})); tEncerrarTurno(T, p); return T.fila.join() === [b.uid, a.uid].join(); })()`);
  verdade(r, 'minotauro (10) deveria agir antes da harpia (80)');
});
teste('o aviso de chefe aparece quando a carta é um ataque forte', () => {
  const r = R(`(() => { const { T } = cen(4, { etapa: 2, vivos: true }); const boss = T.inim.find(e => e.chefe);
    T.baralhos[boss.tipo] = { cartas: [K('Mordida', 15, { mov: 2, atq: 4 })], i: 0 }; T.log = []; revelarCartas(T);
    return T.log.some(l => l.cls === 'aviso' && /Mordida/.test(l.msg)); })()`);
  verdade(r);
});
teste('todo chefe tem ao menos uma carta de ataque muito forte e o alerta mostra qual', () => {
  const r = R(`['fenrir','ares','hades','set','caos'].map(id => baralhoDe(id).some(c => c.atq >= 4))`);
  verdade(r.every(Boolean));
});
teste('descreverCarta traduz a carta em texto simples para a tela', () => {
  const r = R(`descreverCarta(K('x', 20, { mov: 1, atq: -1, curar: 2, fortalecer: 1 })).map(d => d.texto).join('|')`);
  igual(r, 'anda +1|ataque -1|cura 2|fortalece 1');
});

console.log('\nEmpurrar e puxar');
teste('empurrar: afasta o inimigo em linha reta, na direção oposta ao herói', () => {
  const r = R(`(() => { const { p, T } = cen(1, { vivos: true }); const e = T.inim[0]; T.inim.slice(1).forEach(x => { x.parado = true; x.c = 11; x.r = 0; });
    e.c = 5; e.r = 7; e.hp = e.hpMax = 9999; T.heroi = { c: 3, r: 7 }; const n = forcarMovimento(T, p, e, T.heroi, 2, 'empurrar'); return [n, e.c, e.r]; })()`);
  igual(r.join(), '2,7,7');
});
teste('empurrar para antes de uma parede', () => {
  const r = R(`(() => { const { p, T } = cen(1, { vivos: true }); const e = T.inim[0]; T.inim.slice(1).forEach(x => { x.parado = true; x.c = 11; x.r = 0; });
    e.c = 8; e.r = 4; T.heroi = { c: 6, r: 4 }; const n = forcarMovimento(T, p, e, T.heroi, 3, 'empurrar'); return [n, celula(T.g, 9, 4), e.c]; })()`);
  igual(r.join(), '0,#,8');
});
teste('empurrar para antes de outro inimigo', () => {
  const r = R(`(() => { const { p, T } = cen(1, { vivos: true }); const [a, b] = T.inim;
    a.c = 5; a.r = 7; b.c = 6; b.r = 7; b.parado = true; T.heroi = { c: 3, r: 7 }; return forcarMovimento(T, p, a, T.heroi, 2, 'empurrar'); })()`);
  igual(r, 0);
});
teste('empurrar para cima de uma armadilha dispara o efeito nela', () => {
  const r = R(`(() => { const { p, T } = cen(9, { vivos: true }); const e = T.inim[0]; T.inim.slice(1).forEach(x => { x.parado = true; x.c = 11; x.r = 0; });
    e.c = 5; e.r = 7; e.hp = e.hpMax = 1000; T.heroi = { c: 3, r: 7 }; armar(T, 6, 7, 'fogo'); forcarMovimento(T, p, e, T.heroi, 1, 'empurrar'); return { hp: e.hp, some: !T.armadilhas.has(chave(6, 7)) }; })()`);
  verdade(r.hp < 1000, 'sofreu o dano da armadilha'); verdade(r.some, 'a armadilha foi usada');
});
teste('chefes e estruturas não saem do lugar', () => {
  const r = R(`(() => { const { p, T } = cen(4, { etapa: 2, vivos: true }); const boss = T.inim.find(e => e.chefe); boss.c = 5; boss.r = 7; T.heroi = { c: 3, r: 7 };
    return forcarMovimento(T, p, boss, T.heroi, 2, 'empurrar'); })()`);
  igual(r, 0);
});
teste('puxar: aproxima do herói e para colado nele', () => {
  const r = R(`(() => { const { p, T } = cen(1, { vivos: true }); const e = T.inim[0]; T.inim.slice(1).forEach(x => { x.parado = true; x.c = 11; x.r = 0; });
    e.c = 8; e.r = 7; T.heroi = { c: 3, r: 7 }; const n = forcarMovimento(T, p, e, T.heroi, 9, 'puxar'); return [n, e.c, dist(e, T.heroi)]; })()`);
  igual(r.join(), '4,4,1');
});
teste('a habilidade Golpe Poderoso empurra 1 e a Fúria de Thor puxa 2', () => {
  const r = R(`(() => { const out = {};
    { const { p, T } = cen(1, { vivos: true }); const e = T.inim[0]; T.inim.slice(1).forEach(x => { x.parado = true; x.c = 11; x.r = 0; }); e.c = 4; e.r = 7; e.hp = e.hpMax = 9999; T.heroi = { c: 3, r: 7 };
      tHabilidade(T, p, 'golpe_poderoso', e.uid); out.empurrou = e.c; }
    { const { p, T } = cen(1, { vivos: true }); p.nivel = 12; const e = T.inim[0]; T.inim.slice(1).forEach(x => { x.parado = true; x.c = 11; x.r = 0; }); e.c = 6; e.r = 7; e.hp = e.hpMax = 9999; T.heroi = { c: 3, r: 7 };
      tHabilidade(T, p, 'furia_tor', e.uid); out.puxou = e.c; }
    return out; })()`);
  igual(r.empurrou, 5, 'empurrou 1'); igual(r.puxou, 4, 'puxou 2');
});
teste('habilidades em área empurram todos os atingidos', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1, vivos: true }); const [a, b] = T.inim; T.inim.slice(2).forEach(x => { x.parado = true; x.c = 11; x.r = 0; });
    a.c = 4; a.r = 7; b.c = 3; b.r = 6; a.hp = a.hpMax = b.hp = b.hpMax = 9999; T.heroi = { c: 3, r: 7 };
    tHabilidade(T, p, 'martelo_titas'); return [dist(a, T.heroi), dist(b, T.heroi)]; })()`);
  igual(r.join(), '2,2');
});
teste('cartas dos inimigos também empurram e puxam o herói', () => {
  const r = R(`(() => { const out = {};
    { const { p, T } = cen(1, { vivos: true }); const e = T.inim[0]; T.inim.slice(1).forEach(x => { x.parado = true; x.c = 11; x.r = 0; });
      e.tipo = 'troll_gelo'; e.c = 5; e.r = 7; T.heroi = { c: 4, r: 7 }; p.hp = 99999; atacarHeroi(T, p, derivados(p), e, K('t', 1, { atq: 0, empurrarHeroi: 2 })); out.empurrado = T.heroi.c; }
    { const { p, T } = cen(1, { vivos: true }); const e = T.inim[0]; T.inim.slice(1).forEach(x => { x.parado = true; x.c = 11; x.r = 0; });
      e.tipo = 'harpia'; e.alc = 4; e.c = 8; e.r = 7; T.heroi = { c: 4, r: 7 }; p.hp = 99999; atacarHeroi(T, p, derivados(p), e, K('t', 1, { atq: 0, puxarHeroi: 2 })); out.puxado = T.heroi.c; }
    return out; })()`);
  igual(r.empurrado, 2, 'empurrado 2 para longe do inimigo'); igual(r.puxado, 6, 'puxado 2 em direção ao inimigo');
});

console.log('\nNíveis e dificuldades');
teste('existem 4 dificuldades, do mais fácil ao mais difícil', () => {
  igual(R(`Object.keys(DIFICULDADES).join()`), 'facil,intermediario,dificil,expert');
  const r = R(`Object.values(DIFICULDADES).map(d => d.stat)`);
  verdade(r.every((v, i) => i === 0 || v > r[i - 1]), 'os inimigos devem ficar mais fortes a cada dificuldade');
});
teste('o nível do cenário sobe com o nível do herói e com a dificuldade', () => {
  const r = R(`(() => { const p = novoJogador('T', 'guerreiro'); const out = [];
    for (const n of [1, 6, 20]) { p.nivel = n; out.push(['facil', 'intermediario', 'dificil', 'expert'].map(d => nivelDoCenario(p, d)).join('/')); } return out; })()`);
  igual(r.join(' '), '1/1/2/3 2/3/4/5 9/10/11/12');
});
teste('os inimigos ficam mais fortes conforme o nível do herói sobe', () => {
  const r = R(`[2, 10, 20].map(n => { const { T } = cen(1, { nivel: n, vivos: true }); return T.inim[0].hpMax * 100 + T.inim[0].atk; })`);
  verdade(r[0] < r[1] && r[1] < r[2], JSON.stringify(r));
});
teste('quanto mais difícil, mais fortes os inimigos e maiores as recompensas', () => {
  // (compara a vida em relação à vida-base do tipo sorteado, para o sorteio de inimigos não atrapalhar)
  const r = R(`['facil', 'intermediario', 'dificil', 'expert'].map(d => { const { T, exp } = cen(1, { dif: d, vivos: true }); const e = T.inim[0]; return { forca: e.hpMax / INIMIGOS[e.id].hp / ESCALA_GRUPO[2].stat, rec: exp.rec }; })`);
  for (let i = 1; i < 4; i++) { verdade(r[i].forca > r[i - 1].forca, 'vida sobe'); verdade(r[i].rec > r[i - 1].rec, 'recompensa sobe'); }
});
teste('a dificuldade muda a força das armadilhas e a recuperação nas portas', () => {
  const r = R(`['facil', 'expert'].map(d => { const { p, T } = cen(9, { dif: d }); const antes = p.hp; armar(T, 1, 10, 'fogo'); tMover(T, p, 1, 10); return { dano: antes - p.hp, porta: DIFICULDADES[d].porta }; })`);
  verdade(r[1].dano > r[0].dano, 'armadilha mais forte no expert'); verdade(r[0].porta > r[1].porta, 'porta recupera mais no fácil');
});
teste('o resumo do cenário (tela de preparação) bate com o que será criado', () => {
  const r = R(`(() => { const { p, c } = cen(5, { nivel: 9 }); const res = resumoCenario(c, p, 'dificil'); const exp = criarExpedicao(c, p, 'dificil'); return [res.nivel, exp.nivelCen, res.stat === exp.stat]; })()`);
  igual(r.join(), '6,6,true');
});

console.log('\nCombate (para não esquecer o básico)');
teste('atacar e usar habilidade causam dano e podem derrotar', () => {
  const r = R(`(() => { const { p, T } = cen(1, { vivos: true }); T.inim.slice(1).forEach(x => { x.parado = true; x.c = 11; x.r = 0; });
    const e = T.inim[0]; e.c = 1; e.r = 10; e.hp = e.hpMax = 100; T.heroi = { c: 0, r: 10 };
    const a = tAtacar(T, p, e.uid); const dano1 = 100 - e.hp;
    T.acaoUsada = false; e.hp = 5; const b = tHabilidade(T, p, 'golpe_poderoso', e.uid);
    return { a, b, dano1, vivo: e.vivo }; })()`);
  igual(r.a, true); verdade(r.dano1 > 0, 'o ataque deveria causar dano'); igual(r.b, true); igual(r.vivo, false, 'inimigo derrotado');
});
teste('habilidade em área atinge o alvo e quem está ao lado', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1, vivos: true }); p.nivel = 12; p.classe = 'oraculo'; p.mp = 999;
    T.inim.push({ ...T.inim[0], uid: 99, efeitos: [] });
    const [a, b, c] = T.inim; a.c = 6; a.r = 7; b.c = 7; b.r = 7; c.c = 11; c.r = 0; a.parado = b.parado = c.parado = true;
    a.hp = a.hpMax = b.hp = b.hpMax = c.hp = c.hpMax = 5000; T.heroi = { c: 3, r: 7 };
    const ok = tHabilidade(T, p, 'julgamento_deuses', a.uid); return { ok, a: a.hp < 5000, b: b.hp < 5000, c: c.hp < 5000 }; })()`);
  igual(r.ok, true); igual(r.a && r.b, true, 'os dois juntos'); igual(r.c, false, 'o distante não é atingido');
});

console.log('\nArmadilhas');
teste('cada cenário usa a armadilha do seu tema', () => {
  igual(R(`REINOS.map(r => r.armadilha).join()`), 'gelo,raio,fogo,veneno,vazio');
});
teste('as salas nascem com armadilhas no chão (do tipo do reino)', () => {
  const r = R(`[1, 5, 9, 13, 17].map(id => { const c = cenarioPorId(id); const p = novoJogador('T', 'guerreiro'); const T = criarTatica(criarExpedicao(c, p), p);
    const reino = REINOS.find(x => x.id === c.reino); return T.armadilhas.size >= 4 && [...T.armadilhas.values()].every(a => a.tipo === reino.armadilha); })`);
  verdade(r.every(Boolean));
});
teste('gelo: -1 de movimento por 2 rodadas, depois volta ao normal', () => {
  const r = R(`(() => { const { p, T } = cen(1); const mov = derivados(p).mov;
    armar(T, 1, 10, 'gelo'); tMover(T, p, 1, 10);
    const agora = T.movRest; rodada(T, p); const r2 = T.movRest; rodada(T, p); const r3 = T.movRest;
    return { mov, agora, r2, r3, sobrou: T.efeitos.length }; })()`);
  igual(r.agora, r.mov - 2, 'movimento logo após pisar'); igual(r.r2, r.mov - 1, '2ª rodada'); igual(r.r3, r.mov, '3ª rodada'); igual(r.sobrou, 0);
});
teste('fogo: dano de 15% da vida máxima (intermediário)', () => {
  const r = R(`(() => { const { p, T } = cen(9); const d = derivados(p); const antes = p.hp; armar(T, 1, 10, 'fogo'); tMover(T, p, 1, 10); return { perdeu: antes - p.hp, esperado: Math.round(d.hpMax * 0.15) }; })()`);
  igual(r.perdeu, r.esperado);
});
teste('veneno: dano por 3 rodadas e depois para', () => {
  const r = R(`(() => { const { p, T } = cen(13); const d = derivados(p); armar(T, 1, 10, 'veneno'); tMover(T, p, 1, 10);
    const hist = []; for (let i = 0; i < 5; i++) { const a = p.hp; rodada(T, p); hist.push(a - p.hp); } return { hist, tick: Math.round(d.hpMax * 0.05) }; })()`);
  igual(r.hist.join(), [r.tick, r.tick, r.tick, 0, 0].join());
});
teste('raio: dano e o movimento acaba no hexágono da armadilha', () => {
  const r = R(`(() => { const { p, T } = cen(5); const d = derivados(p); armar(T, 1, 10, 'raio'); tMover(T, p, 3, 10);
    return { pos: T.heroi.c + ',' + T.heroi.r, mov: T.movRest, perdeu: d.hpMax - p.hp, esperado: Math.round(d.hpMax * 0.10) }; })()`);
  igual(r.pos, '1,10'); igual(r.mov, 0); igual(r.perdeu, r.esperado);
});
teste('vazio: dano e drena 30% da mana', () => {
  const r = R(`(() => { const { p, T } = cen(20, { etapa: 2 }); const d = derivados(p); armar(T, 1, 10, 'vazio'); tMover(T, p, 1, 10); return { mana: d.mpMax - p.mp, esperado: Math.round(d.mpMax * 0.3), dano: d.hpMax - p.hp }; })()`);
  igual(r.mana, r.esperado); verdade(r.dano > 0);
});
teste('o caminho evita armadilhas quando existe outro igualmente curto', () => {
  const r = R(`(() => { let achou = 0, pisou = 0; const { p, T } = cen(1); const ini = { c: 5, r: 6 }; T.heroi = { ...ini }; T.movRest = 5;
    for (const alvo of tAlcance(T).filter(a => a.custo >= 3)) {
      const nos = bfs(T.g, ini, 6, () => false, () => false); const meio = caminhoAte(nos.get(chave(alvo.c, alvo.r)))[0];
      const sem = bfs(T.g, ini, 6, (c, r) => c === meio.c && r === meio.r, () => false).get(chave(alvo.c, alvo.r));
      if (!sem || sem.d !== alvo.custo) continue; achou++;
      T.armadilhas.clear(); armar(T, meio.c, meio.r, 'gelo'); T.heroi = { ...ini }; T.movRest = 5; T.efeitos = [];
      tMover(T, p, alvo.c, alvo.r); if (!T.armadilhas.has(chave(meio.c, meio.r))) pisou++; }
    return { achou, pisou }; })()`);
  verdade(r.achou >= 5, 'poucos casos: ' + r.achou); igual(r.pisou, 0);
});
teste('inimigo que pisa em armadilha sofre o efeito; chefe sofre só metade', () => {
  const r = R(`(() => { const { p, T } = cen(12, { etapa: 2, vivos: true }); const boss = T.inim.find(e => e.chefe); boss.hp = boss.hpMax = 1000; boss.c = 5; boss.r = 5;
    armar(T, 5, 5, 'fogo'); dispararArmadilha(T, p, boss, 5, 5); return 1000 - boss.hp; })()`);
  igual(r, Math.round(1000 * 0.15 * 0.5));
});

console.log('\nPortas');
teste('a porta fechada bloqueia o caminho e a visão; abre quando a sala é limpa', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 0, vivos: true }); const { c, r } = T.porta;
    const antes = { chao: celula(T.g, c, r), alcanca: tAlcance({ ...T, movRest: 99 }).some(h => h.c === c && h.r === r) };
    matarTodos(T); const fim = T.fim; tAbrirPorta(T); return { antes, fim, depois: celula(T.g, c, r), livre: T.livre }; })()`);
  igual(r.antes.chao, 'D'); igual(r.antes.alcanca, false); igual(r.fim, 'vitoria'); igual(r.depois, '.'); igual(r.livre, true);
});
teste('com a porta aberta, andar até ela leva à próxima etapa (com mais inimigos e vida/mana de volta)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 0, vivos: true }); const d = derivados(p); const n1 = combatentes(T).length;
    p.hp = Math.round(d.hpMax * 0.4); p.mp = 0; matarTodos(T); tAbrirPorta(T); tMover(T, p, T.porta.c, T.porta.r); const fim = T.fim;
    const N = tProximaEtapa(T, p); const rec = DIFICULDADES.intermediario.porta;
    return { fim, n1, n2: combatentes(N).length, etapa: N.etapa, hp: p.hp, hpEsp: Math.round(d.hpMax * 0.4) + Math.round(d.hpMax * rec), mp: p.mp, mpEsp: Math.round(d.mpMax * rec) }; })()`);
  igual(r.fim, 'porta'); verdade(r.n2 > r.n1, `${r.n1} → ${r.n2}`); igual(r.etapa, 2); igual(r.hp, r.hpEsp, 'vida'); igual(r.mp, r.mpEsp, 'mana');
});
teste('na sala livre não há turno dos inimigos', () => {
  igual(R(`(() => { const { p, T } = cen(1, { etapa: 0, vivos: true }); matarTodos(T); tAbrirPorta(T); return tEncerrarTurno(T, p); })()`), false);
});
teste('só dá para fugir pela entrada, e nunca na arena do chefe', () => {
  const r = R(`(() => { const a = cen(1); a.T.heroi = { ...a.T.saida }; const livre = tFugir(a.T);
    const b = cen(1); b.T.heroi = { c: 4, r: 4 }; const longe = tFugir(b.T);
    const c = cen(4, { etapa: 2 }); c.T.heroi = { ...c.T.saida }; const arena = tFugir(c.T); return [livre, longe, arena]; })()`);
  igual(r.join(), 'true,false,false');
});

console.log(`\n${ok} testes passaram${falhas.length ? `, ${falhas.length} FALHARAM: ${falhas.join('; ')}` : ''}.`);
process.exit(falhas.length ? 1 : 0);
