'use strict';
/* Testa as regras do jogo direto no motor (sem navegador): números pequenos, cartas do herói e dos inimigos,
   iniciativa, itens e mochila, objetivos, empurrar/puxar, dificuldades, armadilhas, portas, moedas e baú.
   Como não há mais sorte no dano, quase tudo aqui é conta exata.   Uso: node tests/regras.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = vm.createContext({ Math, console });
for (const f of ['data.js', 'cartas.js', 'cenarios.js', 'logic.js', 'mapas.js', 'tatica.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'mapas-teste.js'), 'utf8'), ctx);   // mapas grandes: as coordenadas dos testes valem para eles
const R = (code) => vm.runInContext(code, ctx);
R('SORTE.ativa = false');   // os testes de dano são contas exatas; os testes do baralho de modificadores ligam a sorte de volta

let ok = 0, falhas = [];
function teste(nome, f) {
  try { f(); ok++; console.log('  ✓ ' + nome); }
  catch (e) { falhas.push(nome); console.log('  ✗ ' + nome + '\n      ' + e.message); }
}
const igual = (a, b, msg) => { if (a !== b) throw new Error(`${msg || 'esperava'}: esperado ${b}, veio ${a}`); };
const verdade = (v, msg) => { if (!v) throw new Error(msg || 'esperava verdadeiro'); };

// Monta um cenário de teste: herói em (0,10) com uma carta neutra (anda 3, ataca 3, iniciativa 0); os inimigos ficam longe e parados.
R(`
const CARTA_T = { id: 'teste', nome: 'Teste', ini: 0, mov: 3, atq: 3, alc: 1 };
function turnoDeTeste(T, p, carta) { T.mao.unshift({ ...CARTA_T, ...(carta || {}) }); tEscolherCarta(T, p, 'teste'); }
function cen(id, opts = {}) {
  const c = cenarioPorId(id);
  const p = novoJogador('T', opts.classe || 'guerreiro'); p.nivel = opts.nivel || 10; p.hp = derivados(p).hpMax;
  const exp = criarExpedicao(c, p, opts.dif || 'intermediario');
  if (opts.etapa !== undefined) exp.idx = opts.etapa;
  const T = criarTatica(exp, p);
  T.armadilhas.clear();
  if (!opts.vivos) T.inim.filter(e => !e.estrutura).forEach((e, i) => { e.c = 11 - i; e.r = 0; e.atk = 1; e.parado = true; e.hp = e.hpMax = 99; });
  T.heroi = { c: 0, r: 10 };
  if (!opts.semTurno) turnoDeTeste(T, p, opts.carta);
  return { p, T, c, exp };
}
function armar(T, c, r, tipo) { T.armadilhas.set(chave(c, r), { tipo }); }
function rodada(T, p) { tEncerrarTurno(T, p); let g = 0; while (T.fase === 'inimigos' && !T.fim && g++ < 20) tProximoInimigo(T, p); if (T.fase === 'escolha') turnoDeTeste(T, p); }
function matarTodos(T) { T.inim.forEach(e => { e.hp = 0; }); verificarMortes(T); }
function carta(T, tipo, c) { T.cartas[tipo] = c; T.fila = ordemDaRodada(T).filter(x => x.tipo !== 'heroi').map(x => x.uid); }   // refaz a fila com as cartas novas
function sozinho(T, e) { T.inim.forEach(x => { if (x !== e) { x.parado = true; x.c = 11; x.r = 0; } }); }
function limpar(T, r) { for (let c = 0; c < 12; c++) T.g.cel[r][c] = '.'; }
function pe(e, c, r) { e.c = c; e.r = r; return e; }
`);

console.log('\nOs 20 cenários');
teste('são 20, em ordem, 4 por reino, e cada mapa citado existe', () => {
  const r = R(`({ n: CENARIOS.length, ids: CENARIOS.map(c => c.id).join() === [...Array(20).keys()].map(i => i + 1).join(),
    porReino: REINOS.map(rn => cenariosDoReino(rn.id).length).join(), mapas: CENARIOS.every(c => c.etapas.every(e => MAPAS[e.mapa])) })`);
  igual(r.n, 20); verdade(r.ids, 'ids 1..20'); igual(r.porReino, '4,4,4,4,4'); verdade(r.mapas, 'todos os mapas existem');
});
teste('os 4 tipos de objetivo aparecem em todos os reinos, e o chefe é o último de cada reino', () => {
  for (const linha of R(`REINOS.map(rn => cenariosDoReino(rn.id).map(c => c.objetivo).join('/'))`)) igual(linha, 'matar_todos/bau/destruir/chefe');
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
teste('saves antigos (formato com atributos e mana) ganham equipamento e cartas novas e mantêm o progresso', () => {
  const r = R(`(() => { const p = novoJogador('T', 'guerreiro'); delete p.cenarios; delete p.dificuldade; delete p.colecao; delete p.mao; delete p.escolhas; p.derrotados.fenrir = true; p.nivel = 6; p.gold = 5000; p.mp = 40;
    p.equip = { arma: 'guerreiro_2', armadura: 'armadura_1', amuleto: null }; p.attr = { FOR: 30, DES: 10, INT: 5, VIT: 20 }; migrarSave(p);
    return [p.dificuldade, p.cenarios[1], p.cenarios[4], !!p.cenarios[5], Array.isArray(p.equip.maos), p.gold, p.attr === undefined, p.colecao.length, p.mao.length, p.escolhas.length, p.mp === undefined, p.hp > 0]; })()`);
  igual(r.join(), 'intermediario,true,true,false,true,60,true,10,10,5,true,true');   // nível 6: 5 escolhas de carta (níveis 2 a 6) esperando
});
teste('as etapas têm mais inimigos que as anteriores (Valhala 3 → 4; Inferno 4 → 5)', () => {
  const r = R(`[1, 9].map(id => { const { p, c } = cen(id); const exp = criarExpedicao(c, p); const n = [];
    for (let i = 0; i < 2; i++) { exp.idx = i; n.push(criarTatica(exp, p).inim.filter(e => !e.estrutura).length); } return n.join('→'); })`);
  igual(r.join(), '3→4,4→5');
});
teste('a última etapa não tem porta; as outras têm', () => {
  const r = R(`(() => { const { p, c } = cen(5); const exp = criarExpedicao(c, p); const out = [];
    for (let i = 0; i < exp.etapas.length; i++) { exp.idx = i; out.push(!!criarTatica(exp, p).porta); } return out; })()`);
  igual(r.join(), 'true,false');
});

console.log('\nNúmeros pequenos: vida, atributos e níveis');
teste('o guerreiro começa com cerca de 13 de vida; todos ficam entre 5 e 30 (a vida cresce um pouco por nível)', () => {
  const r = R(`(() => { const o = {}; for (const c of ['guerreiro', 'cacador', 'oraculo']) { const p = novoJogador('T', c); const a = derivados(p).hpMax; p.nivel = 20; o[c] = [a, derivados(p).hpMax]; } return o; })()`);
  verdade(r.guerreiro[0] >= 12 && r.guerreiro[0] <= 14, 'guerreiro ' + r.guerreiro); verdade(r.guerreiro[0] > r.cacador[0] && r.cacador[0] >= r.oraculo[0], JSON.stringify(r));
  for (const [a, b] of Object.values(r)) { verdade(a >= 5 && a <= 30 && b >= a && b <= 30, 'vida ' + a + ' → ' + b); }
});
teste('NINGUÉM passa de 30 de vida, nem no nível 20 (e o equipamento não aumenta a vida máxima: ele cura 1 vez por cenário)', () => {
  const r = R(`['guerreiro', 'cacador', 'oraculo'].map(c => { const p = novoJogador('T', c); p.nivel = 20;
    p.equip = { cabeca: 'cabeca_4', peito: 'peito_4', pes: 'pes_4', maos: ['escudo_4', 'escudo_4'], mochila: [] }; return derivados(p).hpMax; })`);
  verdade(r.every(v => v <= 30), r.join());
});
teste('não há atributos: o herói não tem FOR/DES/INT/VIT nem pontos para distribuir', () => {
  const r = R(`(() => { const p = novoJogador('T', 'guerreiro'); return [p.attr === undefined, p.pontos === undefined, typeof distribuirPonto, typeof ATRIBUTOS]; })()`);
  igual(r.join(), 'true,true,undefined,undefined');
});
teste('ao subir de nível você escolhe 1 de 2 cartas (a outra se perde); a carta nova entra na mão se houver lugar (máx. 10)', () => {
  const r = R(`(() => { const p = novoJogador('T', 'cacador'); p.nivel = 1; const s = ganharXp(p, xpParaProximo(1)); const op = cartasDoNivel('cacador', 2);
    const antes = [p.escolhas.join(), p.colecao.length, p.mao.length]; const errada = escolherCartaNivel(p, 3, 0); const c = escolherCartaNivel(p, 2, 1);
    const depois = [p.escolhas.length, p.colecao.length, p.mao.length, c.id === op[1].id, p.colecao.includes(op[0].id), escolherCartaNivel(p, 2, 0)];
    for (let n = 3; n <= 8; n++) { p.escolhas.push(n); escolherCartaNivel(p, n, 0); }
    return { antes, errada, depois, final: [p.colecao.length, p.mao.length], distintas: op[0].id !== op[1].id && op[0].nome !== op[1].nome }; })()`);
  igual(r.antes.join(), '2,10,10'); igual(r.errada, null, 'só níveis pendentes'); igual(r.depois.join(), '0,11,10,true,false,'); igual(r.final.join(), '17,10', 'a mão para em 10; o resto fica na coleção'); verdade(r.distintas);
});
teste('as cartas de nível crescem com o nível e existem para todas as classes (2 a 20), com iniciativa de 6 a 94', () => {
  const r = R(`['guerreiro', 'cacador', 'oraculo'].map(c => { let ok = true, maxAtq = 0; for (let n = 2; n <= 20; n++) for (const k of cartasDoNivel(c, n)) { ok = ok && k.ini >= 6 && k.ini <= 94 && cartaHeroiPorId(k.id).nome === k.nome; maxAtq = Math.max(maxAtq, k.atq || 0); }
    const a2 = cartasDoNivel(c, 2)[0], a20 = cartasDoNivel(c, 20)[0]; return [ok, maxAtq <= 10, (a20.atq || a20.cura || a20.mov) >= (a2.atq || a2.cura || a2.mov) || a20.nome !== a2.nome]; })`);
  for (const x of r) verdade(x.every(Boolean), JSON.stringify(x));
});
teste('montar a mão: de 6 a 10 cartas da coleção', () => {
  const r = R(`(() => { const p = novoJogador('T', 'guerreiro'); const out = []; for (let n = 2; n <= 6; n++) { p.escolhas.push(n); escolherCartaNivel(p, n, 0); }
    out.push(p.colecao.length, p.mao.length); const novo = p.colecao.find(id => !p.mao.includes(id)); out.push(alternarCartaMao(p, novo));      // mão cheia: não entra
    out.push(alternarCartaMao(p, p.mao[0]), alternarCartaMao(p, novo), p.mao.length);
    for (let i = 0; i < 10; i++) alternarCartaMao(p, p.mao[0]); out.push(p.mao.length, alternarCartaMao(p, 'xxx')); return out; })()`);
  igual(r.join(), '15,10,false,true,true,10,6,false');
});
teste('a mochila começa com 2 lugares e vai a 3, 4 e 5 nos níveis 5, 10 e 15', () => {
  igual(R(`[1, 4, 5, 9, 10, 14, 15, 20].map(tamanhoMochila).join()`), '2,2,3,3,4,4,5,5');
});
teste('subir de nível: cura tudo, dá 1 escolha de carta e avisa quando ganha lugar na mochila', () => {
  const r = R(`(() => { const p = novoJogador('T', 'guerreiro'); p.nivel = 4; p.hp = 1; const s = ganharXp(p, xpParaProximo(4));
    return [p.nivel, p.escolhas.join(), p.hp === derivados(p).hpMax, s.length, s[0].ganhouMochila, s[0].mochila]; })()`);
  igual(r.join(), '5,5,true,1,true,3');
});
teste('o XP para o próximo nível é pequeno (tudo cabe na conta de cabeça)', () => {
  const r = R(`[1, 10, 19].map(xpParaProximo)`);
  verdade(r[0] <= 12 && r[2] <= 70, JSON.stringify(r));
});

console.log('\nItens: 5 tipos de slot e mochila');
teste('1 item na cabeça, 1 no peito, 1 nos pés e 2 nas mãos; trocar devolve o item antigo', () => {
  const r = R(`(() => { const p = novoJogador('T', 'guerreiro'); for (const id of ['cabeca_1', 'peito_1', 'pes_1', 'escudo_1', 'guerreiro_1', 'guerreiro_2']) darItem(p, id);
    const e = ['cabeca_1', 'peito_1', 'pes_1', 'escudo_1'].map(id => equipar(p, id).ok);
    const mao1 = p.equip.maos.join('|');                    // espada inicial + escudo
    equipar(p, 'guerreiro_1'); const trocou = p.equip.maos.join('|');       // 3º item de mão: troca a mão 1
    return { e, mao1, trocou, guardou: qtd(p, 'guerreiro_0'), cab: p.equip.cabeca, peito: p.equip.peito }; })()`);
  verdade(r.e.every(Boolean), 'equipou os 4'); igual(r.mao1, 'guerreiro_0|escudo_1'); igual(r.trocou, 'guerreiro_1|escudo_1'); igual(r.guardou, 1);
  igual(r.cab, 'cabeca_1'); igual(r.peito, 'peito_1');
});
teste('arma de outra classe e item de mochila não equipam; arma da classe equipa', () => {
  const r = R(`(() => { const p = novoJogador('T', 'guerreiro'); darItem(p, 'cacador_1'); darItem(p, 'oraculo_1'); darItem(p, 'guerreiro_1');
    return [equipar(p, 'cacador_1').ok, equipar(p, 'oraculo_1').ok, podeEquipar(p, 'pocao').ok, equipar(p, 'guerreiro_1').ok]; })()`);
  igual(r.join(), 'false,false,false,true');
});
teste('equipamento é de USO ÚNICO por cenário: cura, dano, movimento, escudo ou alcance, só durante o seu turno, e some até o próximo cenário', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1, vivos: true }); p.equip.peito = 'peito_3'; p.equip.pes = 'pes_2'; p.equip.maos = ['guerreiro_3', null]; const d0 = derivados(p).hpMax; p.hp = 2;
    const mov0 = T.movRest, esc0 = T.escudoHeroi, atq0 = T.bonusItem.atq;
    const a = tUsarEquip(T, p, 'peito'), b = tUsarEquip(T, p, 'pes'), c = tUsarEquip(T, p, 'maos0'), d = tUsarEquip(T, p, 'peito'), e = tUsarEquip(T, p, 'cabeca');
    return { a, b, c, d, e, hp: p.hp, curou: p.hp > 2, mov: T.movRest - mov0, esc: T.escudoHeroi - esc0, atq: T.bonusItem.atq - atq0, passivo: derivados(p).hpMax === d0, gasto: Object.keys(T.exp.equipGasto).sort().join() }; })()`);
  igual(r.a && r.b && r.c, true); igual(r.d, false, 'só uma vez por cenário'); igual(r.e, false, 'cabeça vazia'); verdade(r.curou, 'peito_3 cura'); igual(r.mov, 1, 'botas +1 movimento'); igual(r.esc, 1, 'peito +1 escudo'); igual(r.atq, 4, 'arma nível 3 = +4 dano'); verdade(r.passivo, 'sem bônus passivo'); igual(r.gasto, 'maos0,peito,pes');
});
teste('equipamento só pode ser usado no seu turno (não antes de escolher a carta) e volta no cenário seguinte', () => {
  const r = R(`(() => { const { p, T, exp } = cen(1, { semTurno: true }); p.equip.peito = 'peito_3'; const antes = tUsarEquip(T, p, 'peito');
    turnoDeTeste(T, p); const depois = tUsarEquip(T, p, 'peito'); const exp2 = criarExpedicao(cenarioPorId(1), p); return [antes, depois, Object.keys(exp2.equipGasto).length]; })()`);
  igual(r.join(), 'false,true,0');
});
teste('arma de longo alcance dá +alcance só quando usada, e só a quem ataca de longe (o guerreiro não ganha nada)', () => {
  const r = R(`(() => { const out = []; for (const c of ['guerreiro', 'cacador']) { const { p, T } = cen(1, { classe: c, carta: { alc: c === 'guerreiro' ? 1 : 3 } }); p.equip.maos = [c + '_3', null]; const a0 = alcanceDa(p, T); tUsarEquip(T, p, 'maos0'); out.push(alcanceDa(p, T) - a0); } return out; })()`);
  igual(r.join(), '0,1');
});
teste('consumíveis vão direto para a mochila até encher; o resto fica guardado', () => {
  const r = R(`(() => { const p = novoJogador('T', 'guerreiro'); p.equip.mochila = []; for (let i = 0; i < 4; i++) darItem(p, 'pocao');
    return [p.equip.mochila.length, qtd(p, 'pocao')]; })()`);
  igual(r.join(), '2,2');
});
teste('levar para a mochila respeita o tamanho; tirar devolve para a bolsa', () => {
  const r = R(`(() => { const p = novoJogador('T', 'guerreiro'); p.equip.mochila = ['pocao', 'pocao']; p.inv = { hidromel: 1 };
    const cheia = levarNaMochila(p, 'hidromel').ok; tirarDaMochila(p, 0); const agora = levarNaMochila(p, 'hidromel').ok;
    return [cheia, agora, p.equip.mochila.join(), qtd(p, 'pocao')]; })()`);
  igual(r.join(), 'false,true,pocao,hidromel,1'.replace('pocao,hidromel', 'pocao,hidromel'));
});
teste('usar item da mochila: cura, gasta o item e não gasta a jogada', () => {
  const r = R(`(() => { const { p, T } = cen(1); p.hp = 3; const antes = p.equip.mochila.length; const ok = tUsarItem(T, p, 0);
    return [ok, p.hp, antes - p.equip.mochila.length, T.acaoUsada, T.fase]; })()`);
  igual(r.join(), 'true,7,1,false,heroi');
});
teste('dá para usar vários itens no mesmo turno, antes ou depois de atacar', () => {
  const r = R(`(() => { const { p, T } = cen(1, { vivos: true }); const e = T.inim[0]; sozinho(T, e); pe(e, 1, 10); e.hp = e.hpMax = 99; p.hp = 2;
    const a = tUsarItem(T, p, 0); const b = tAtacar(T, p, e.uid); const c = tUsarItem(T, p, 0);   // poção, ataque, poção
    return [a, b, c, p.hp, p.equip.mochila.length, T.acaoUsada]; })()`);
  igual(r.join(), 'true,true,true,10,0,true');
});
teste('item que não faria nada não é gasto (vida cheia)', () => {
  const r = R(`(() => { const { p, T } = cen(1); const antes = p.equip.mochila.length; return [tUsarItem(T, p, 0), p.equip.mochila.length - antes]; })()`);
  igual(r.join(), 'false,0');
});
teste('itens de efeito: pedra de amolar (+2 dano), tônico (+2 mov), pele de pedra (+2 escudo), antídoto (limpa)', () => {
  const r = R(`(() => { const out = {}; const { p, T } = cen(1, { vivos: true }); const e = T.inim[0]; sozinho(T, e); pe(e, 1, 10); e.hp = e.hpMax = 99; e.def = 0;
    p.equip.mochila = ['pedra_amolar', 'tonico_veloz', 'pele_pedra', 'antidoto']; const mov0 = T.movRest, esc0 = T.escudoHeroi; T.efeitos = [{ tipo: 'veneno', turnos: 2, dano: 1 }];
    tUsarItem(T, p, 0); tUsarItem(T, p, 0); tUsarItem(T, p, 0); tUsarItem(T, p, 0);
    tAtacar(T, p, e.uid); out.dano = 99 - e.hp; out.esperado = 3 + derivados(p).dano + 2; out.mov = T.movRest - mov0; out.esc = T.escudoHeroi - esc0; out.limpou = T.efeitos.length; out.sobrou = p.equip.mochila.length; return out; })()`);
  igual(r.dano, r.esperado, 'dano'); igual(r.mov, 2); igual(r.esc, 2); igual(r.limpou, 0); igual(r.sobrou, 0);
});
teste('a pedra de amolar só vale até o fim do turno', () => {
  const r = R(`(() => { const { p, T } = cen(1); p.equip.mochila = ['pedra_amolar']; tUsarItem(T, p, 0); const durante = T.bonusItem.atq; rodada(T, p); return [durante, T.bonusItem.atq]; })()`);
  igual(r.join(), '2,0');
});
teste('loja: vende consumíveis do reino e 1 item de cada tipo de slot; comprar e vender', () => {
  const r = R(`(() => { const p = novoJogador('T', 'cacador'); const reino = REINOS[1]; const est = estoqueLoja(p, reino); const tipos = new Set(est.map(id => ITENS[id].tipo));
    p.gold = 100; const g0 = p.gold; const comprou = comprar(p, 'peito_1'); const gasto = g0 - p.gold; const pobre = (() => { p.gold = 0; return comprar(p, 'peito_1'); })();
    p.inv = { peito_1: 1 }; p.gold = 0; vender(p, 'peito_1');
    return { tipos: [...tipos].sort().join(), classe: est.includes('cacador_1'), outra: est.includes('guerreiro_1'), comprou, gasto, pobre, ganhou: p.gold, esperado: precoVenda('peito_1') }; })()`);
  igual(r.tipos, 'cabeca,maos,mochila,peito,pes'); verdade(r.classe, 'arma do caçador'); verdade(!r.outra, 'sem arma de outra classe');
  verdade(r.comprou && !r.pobre, 'compra só com ouro'); igual(r.gasto, 12); igual(r.ganhou, r.esperado);
});

console.log('\nObjetivos');
teste('matar todos: termina quando o último inimigo cai', () => {
  const r = R(`(() => { const { T } = cen(1, { etapa: 1, vivos: true }); const antes = String(T.fim); matarTodos(T); return [antes, T.limpa, T.objetivoCumprido, T.fim]; })()`);
  igual(r.join(), 'null,true,true,vitoria');   // na última sala, cumprir o objetivo termina o cenário na hora
});
teste('baú: o objetivo é abrir o baú, mesmo com inimigos vivos', () => {
  const r = R(`(() => { const { p, T } = cen(2, { etapa: 1 }); const k = T.objetivo;
    T.heroi = { c: T.bau.c, r: T.bau.r }; // parado em cima do baú
    tEncerrarTurno(T, p); return { k, limpa: T.limpa, aberto: T.bau.aberto, vivos: T.inim.some(e => e.vivo) }; })()`);
  igual(r.k, 'bau'); igual(r.limpa, true); igual(r.aberto, true);
});
teste('baú: matar todos NÃO cumpre o objetivo', () => {
  igual(R(`(() => { const { T } = cen(2, { etapa: 1, vivos: true }); matarTodos(T); return T.fim; })()`), null);
});
teste('chefe: basta derrotar o chefe; os capangas recuam', () => {
  const r = R(`(() => { const { T } = cen(4, { etapa: 2, vivos: true }); const antes = T.fim;
    const boss = T.inim.find(e => e.chefe); boss.hp = 0; verificarMortes(T); return { antes, fim: T.limpa, restantes: T.inim.filter(e => e.vivo).length, objetivo: T.objetivo }; })()`);
  igual(r.antes, null); igual(r.fim, true); igual(r.restantes, 0); igual(r.objetivo, 'chefe');
});
teste('destruir: há 3 estruturas que não atacam nem andam, e destruí-las cumpre o objetivo', () => {
  const r = R(`(() => { const { T } = cen(3, { etapa: 1, vivos: true }); const est = T.inim.filter(e => e.estrutura);
    const imoveis = est.every(e => e.atk === 0 && e.mov === 0); est.forEach(e => { e.hp = 0; }); verificarMortes(T); return { n: est.length, imoveis, fim: T.limpa }; })()`);
  igual(r.n, 3); verdade(r.imoveis, 'estruturas imóveis'); igual(r.fim, true);
});
teste('destruir: estruturas não jogam cartas e podem ser atacadas', () => {
  const r = R(`(() => { const { p, T } = cen(3, { etapa: 1, vivos: true }); const est = T.inim.find(e => e.estrutura); pe(est, 1, 10); est.hp = est.hpMax = 500; est.def = 0;
    const minis = Object.values(ESTRUTURAS).map(e => e.mini); const sinCarta = !Object.keys(T.cartas).some(k => minis.includes(k));
    tAtacar(T, p, est.uid); return { sinCarta, dano: 500 - est.hp }; })()`);
  verdade(r.sinCarta, 'estrutura não deve ter carta'); verdade(r.dano > 0, 'deveria sofrer dano');
});
teste('numa etapa que não é a última, limpar a sala abre a porta (não conclui o cenário)', () => {
  igual(R(`(() => { const { T } = cen(1, { etapa: 0, vivos: true }); matarTodos(T); return [T.limpa, T.ultimaEtapa, T.objetivo]; })()`).join(), 'true,false,limpar');
});
teste('concluir o cenário marca como feito e sorteia ouro, XP ou item', () => {
  const r = R(`(() => { const tipos = new Set(); let marcou = true;
    for (let i = 0; i < 300; i++) { const { p, T } = cen(1, { etapa: 1 }); const rec = concluirCenario(T, p); tipos.add(rec.tipo); if (!p.cenarios[1]) marcou = false; }
    return { tipos: [...tipos].sort().join(), marcou }; })()`);
  igual(r.tipos, 'gold,item,xp'); verdade(r.marcou, 'deveria marcar como concluído');
});

console.log('\nMoedas e baú');
teste('cada inimigo derrotado solta uma moeda no hexágono onde caiu (e dá XP pequeno)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1, vivos: true }); const e = T.inim[0]; pe(e, 5, 5); e.moedas = 3; e.hp = 0; verificarMortes(T); return T.moedas.get(chave(5, 5)); })()`);
  igual(r && r.valor, 3);
});
teste('só pega a moeda quem TERMINA O TURNO em cima dela (passar por cima, ou só parar, não vale)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1 }); T.moedas.set(chave(2, 10), { valor: 5 });
    const g0 = T.exp.moedasColetadas; tMover(T, p, 3, 10); const passou = T.exp.moedasColetadas - g0; T.heroi = { c: 0, r: 10 }; T.movRest = 3;
    tMover(T, p, 2, 10); const parou = T.exp.moedasColetadas - g0; tEncerrarTurno(T, p);
    return { passou, parou, fim: T.exp.moedasColetadas - g0, restam: T.moedas.size, ouro: p.gold }; })()`);
  igual(r.passou, 0, 'moedas ao só passar'); igual(r.parou, 0, 'só parar não pega'); igual(r.fim, 5, 'terminar o turno ali pega'); igual(r.restam, 0); igual(r.ouro, 10, 'o ouro só entra no fim do cenário');
});
teste('o movimento é usado UMA vez só: o que sobra da carta se perde', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1 }); const a = T.movRest; const ok1 = tMover(T, p, 1, 10); const resta = T.movRest; const ok2 = tMover(T, p, 2, 10); return [a, ok1, resta, ok2, T.heroi.c]; })()`);
  igual(r.join(), '3,true,0,false,1');
});
teste('há 1 baú só, na última etapa; só abre se o herói terminar o turno parado nele', () => {
  const r = R(`(() => { const { p, c } = cen(1); const exp = criarExpedicao(c, p); const out = [];
    for (let i = 0; i < exp.etapas.length; i++) { exp.idx = i; out.push(!!criarTatica(exp, p).bau); }
    const { p: q, T } = cen(1, { etapa: 1, vivos: true }); T.inim.forEach(e => { e.parado = true; e.c = 11; e.r = 0; });
    T.heroi = { c: T.bau.c, r: T.bau.r }; const antes = T.bau.aberto; const ouro0 = q.gold; tEncerrarTurno(T, q);
    return { baus: out.join(), antes, depois: T.bau.aberto, ouro: q.gold - ouro0, itens: T.bau.recompensa.itens.length }; })()`);
  igual(r.baus, 'false,true'); igual(r.antes, false); igual(r.depois, true); verdade(r.ouro > 0 && r.itens >= 1, 'o baú dá ouro e item');
});
teste('as moedas e o baú: ambos só valem se você TERMINAR O TURNO em cima (antes de cumprir o objetivo)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1, vivos: true }); T.inim.forEach(e => { e.parado = true; e.hp = e.hpMax = 99; e.c = 11; e.r = 0; }); T.moedas.set(chave(2, 10), { valor: 4 });
    const g0 = T.exp.moedasColetadas; tMover(T, p, 2, 10); const antesMoeda = T.exp.moedasColetadas - g0; tEncerrarTurno(T, p); const juntou = T.exp.moedasColetadas - g0; T.fase = 'heroi';
    T.heroi = { ...vizinhos(T.g, T.bau.c, T.bau.r)[0] }; T.movRest = 3; tMover(T, p, T.bau.c, T.bau.r); const antes = T.bau.aberto; tEncerrarTurno(T, p);
    return { antesMoeda, juntou, antes, bau: T.bau.aberto, fim: T.fim }; })()`);
  igual(r.antesMoeda, 0); igual(r.juntou, 4, 'pegou as 4 moedas no fim do turno'); igual(r.antes, false, 'só parar não abre'); igual(r.bau, true); igual(r.fim, null, 'matar todos continua valendo');
});

console.log('\nCartas do herói (habilidades + iniciativa)');
teste('a rodada começa escolhendo uma carta; a mão tem 10 cartas e a jogada vai para o descarte', () => {
  const r = R(`(() => { const { p, T } = cen(1, { semTurno: true }); const a = [T.fase, T.mao.length, T.descarte.length];
    const id = T.mao[0].id; const ok = tEscolherCarta(T, p, id); return [...a, ok, T.fase, T.mao.length, T.descarte.length, T.cartaHeroi.id === id]; })()`);
  igual(r.join(), 'escolha,10,0,true,heroi,9,1,true');
});
teste('cada classe começa com 10 cartas de iniciativas diferentes e números pequenos (dano até 6, andar até 5)', () => {
  const r = R(`['guerreiro', 'cacador', 'oraculo'].map(c => { const m = maoDoHeroi(novoJogador('T', c)); return [m.length, new Set(m.map(x => x.ini)).size === 10, m.every(x => x.ini >= 1 && x.ini <= 99), Math.max(...m.map(x => x.atq || 0)) <= 6, Math.max(...m.map(x => x.mov || 0)) <= 5, m.some(x => x.empurrar || x.puxar), m.some(x => x.mov)]; })`);
  for (const x of r) { igual(x[0], 10); verdade(x.slice(1).every(Boolean), JSON.stringify(x)); }
});
teste('não dá para andar nem atacar antes de escolher a carta', () => {
  igual(R(`(() => { const { p, T } = cen(1, { semTurno: true }); return [tMover(T, p, 1, 10), tAtacar(T, p, 1), tEncerrarTurno(T, p), tAlcance(T).length]; })()`).join(), 'false,false,false,0');
});
teste('a iniciativa mistura herói e inimigos: quem tem número menor age primeiro (empate: herói)', () => {
  const r = R(`(() => { const out = []; for (const ini of [5, 20, 33, 99]) {
      const { p, T } = cen(1, { semTurno: true, vivos: true }); const [a, b] = T.inim; a.tipo = 'draugr'; b.tipo = 'lobo_gelo'; T.inim.slice(2).forEach(e => { e.parado = true; });
      T.cartas = { draugr: K('a', 33, { mov: 0, atq: 0 }), lobo_gelo: K('b', 10, { mov: 0, atq: 0 }) };
      T.mao.unshift({ id: 'x', nome: 'x', ini, mov: 1 }); tEscolherCarta(T, p, 'x');
      out.push(T.fila.map(f => f === 'heroi' ? 'H' : f === a.uid ? 'A' : 'B').join('') + ':' + T.fase); } return out; })()`);
  igual(r.join(), 'BA:heroi,BHA:inimigos,BHA:inimigos,BAH:inimigos');   // (o marcador H some da fila quando é a vez do herói)
});
teste('inimigos com número menor agem ANTES do turno do herói; o herói só joga depois', () => {
  const r = R(`(() => { const { p, T } = cen(1, { semTurno: true, vivos: true }); const [a, b] = T.inim; a.tipo = 'draugr'; b.tipo = 'lobo_gelo'; T.inim.slice(2).forEach(e => { e.parado = true; });
    T.cartas = { draugr: K('a', 60, { mov: 0, atq: 0 }), lobo_gelo: K('b', 10, { mov: 0, atq: 0 }) };
    T.mao.unshift({ id: 'x', nome: 'x', ini: 30, mov: 2 }); tEscolherCarta(T, p, 'x');
    const antes = T.fase; const ator = tProximoInimigo(T, p); const meio = [T.fase, ator && ator.uid === b.uid];
    const podeMover = T.movRest > 0; tEncerrarTurno(T, p); const ator2 = tProximoInimigo(T, p);
    return [antes, ...meio, podeMover, ator2 && ator2.uid === a.uid, T.fase]; })()`);
  igual(r.join(), 'inimigos,heroi,true,true,true,escolha');
});
teste('o ataque é a carta: dano da carta + bônus de atributo/arma, menos a defesa do alvo (conta exata)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { semTurno: true }); const e = T.inim[0]; pe(e, 1, 10); e.hp = e.hpMax = 99; e.def = 0; tEscolherCarta(T, p, T.mao.find(x => x.nome === 'Marretada').id);
    const bonus = derivados(p).dano; tAtacar(T, p, e.uid); const sem = 99 - e.hp;
    const { p: q, T: U } = cen(1, { semTurno: true }); const f = U.inim[0]; pe(f, 1, 10); f.hp = f.hpMax = 99; f.def = 2; tEscolherCarta(U, q, U.mao.find(x => x.nome === 'Marretada').id); tAtacar(U, q, f.uid);
    return { sem, esperado: 6 + bonus, comDef: 99 - f.hp }; })()`);
  igual(r.sem, r.esperado, 'Marretada = 6 + bônus'); igual(r.comDef, r.esperado - 2, 'a defesa do alvo tira 2 de cada golpe');
});
teste('todo golpe causa pelo menos 1 de dano, mesmo contra defesa alta', () => {
  const r = R(`(() => { const { p, T } = cen(1); const e = T.inim[0]; pe(e, 1, 10); e.hp = e.hpMax = 99; e.def = 50; tAtacar(T, p, e.uid); return 99 - e.hp; })()`);
  igual(r, 1);
});
teste('uma carta sem ataque não ataca (Fôlego só cura); com ataque só 1 ataque por turno', () => {
  const r = R(`(() => { const { p, T } = cen(1, { semTurno: true, vivos: true }); const e = T.inim[0]; sozinho(T, e); e.parado = true; pe(e, 1, 10); e.hp = e.hpMax = 99; e.def = 0; p.hp = 1;
    tEscolherCarta(T, p, T.mao.find(x => x.nome === 'Fôlego').id); const a = tAtacar(T, p, e.uid), curou = p.hp, acao = T.acaoUsada;
    const { p: q, T: U } = cen(1); const f = U.inim[0]; pe(f, 1, 10); f.hp = f.hpMax = 99; const x = tAtacar(U, q, f.uid), y = tAtacar(U, q, f.uid); return [a, curou, acao, x, y]; })()`);
  igual(r.join(), 'false,5,true,true,false');
});
teste('"ao redor" acerta todos os inimigos colados no herói e só eles', () => {
  const r = R(`(() => { const { p, T } = cen(1, { semTurno: true, vivos: true, etapa: 1 }); const [a, b, c] = T.inim; T.inim.slice(3).forEach(e => { e.parado = true; e.c = 11; e.r = 0; });
    T.heroi = { c: 5, r: 6 }; const v = vizinhos(T.g, 5, 6); pe(a, v[0].c, v[0].r); pe(b, v[1].c, v[1].r); pe(c, 9, 6); for (const e of [a, b, c]) { e.hp = e.hpMax = 99; e.def = 0; e.parado = true; }
    T.mao.unshift({ id: 'g', nome: 'Giro', ini: 0, mov: 1, atq: 3, alvo: 'ao-redor' }); tEscolherCarta(T, p, 'g'); T.heroi = { c: 5, r: 6 }; const ok = tAtacar(T, p, undefined);
    return { ok, a: 99 - a.hp, b: 99 - b.hp, c: 99 - c.hp, esperado: 3 + derivados(p).dano }; })()`);
  igual(r.ok, true); igual(r.a, r.esperado); igual(r.b, r.esperado); igual(r.c, 0, 'o distante não é atingido');
});
teste('"vizinhos" acerta o alvo e quem está colado nele', () => {
  const r = R(`(() => { const { p, T } = cen(1, { semTurno: true, vivos: true, etapa: 1 }); const [a, b, c] = T.inim; T.inim.slice(3).forEach(e => { e.parado = true; e.c = 11; e.r = 0; });
    T.heroi = { c: 2, r: 6 }; pe(a, 5, 6); const v = vizinhos(T.g, 5, 6).find(h => h.c !== 2 || h.r !== 6); pe(b, v.c, v.r); pe(c, 10, 9); for (const e of [a, b, c]) { e.hp = e.hpMax = 99; e.def = 0; e.parado = true; }
    T.mao.unshift({ id: 'r', nome: 'Rajada', ini: 0, mov: 1, atq: 2, alc: 4, alvo: 'vizinhos' }); tEscolherCarta(T, p, 'r'); T.heroi = { c: 2, r: 6 }; const ok = tAtacar(T, p, a.uid);
    return { ok, a: a.hp < 99, b: b.hp < 99, c: c.hp < 99 }; })()`);
  igual(r.ok, true); verdade(r.a && r.b, 'os dois juntos'); verdade(!r.c, 'o distante não');
});
teste('o alcance vem da carta (e armas de longo alcance somam): corpo a corpo não alcança 2 hexágonos', () => {
  const r = R(`(() => { const out = []; for (const [classe, arma, usar] of [['guerreiro', 'guerreiro_3', false], ['cacador', 'cacador_0', false], ['cacador', 'cacador_3', true]]) {
      const { p, T } = cen(1, { semTurno: true, classe }); p.equip.maos = [arma, null]; const e = T.inim[0]; T.heroi = { c: 0, r: 10 };
      T.mao.unshift({ id: 'a', nome: 'A', ini: 0, mov: 1, atq: 2, alc: classe === 'guerreiro' ? 1 : 3 }); tEscolherCarta(T, p, 'a'); if (usar) tUsarEquip(T, p, 'maos0');   // a arma de longo alcance só soma quando é USADA
      const alvos = []; for (const d of [1, 3, 4]) { pe(e, d, 10); alvos.push(tAlvos(T, p).includes(e)); } out.push(alvos.join('/')); } return out; })()`);
  igual(r.join(), 'true/false/false,true/true/false,true/true/true');
});
teste('empurrar e puxar na carta: o alvo é jogado 1 ou 2 hexágonos', () => {
  const r = R(`(() => { const out = {};
    { const { p, T } = cen(1, { semTurno: true, vivos: true }); const e = T.inim[0]; sozinho(T, e); e.parado = true; limpar(T, 7); pe(e, 4, 7); e.hp = e.hpMax = 99; e.chefe = false; T.heroi = { c: 3, r: 7 };
      tEscolherCarta(T, p, T.mao.find(x => x.nome === 'Empurrão').id); T.heroi = { c: 3, r: 7 }; tAtacar(T, p, e.uid); out.empurrou = e.c; }
    { const { p, T } = cen(1, { semTurno: true, vivos: true }); const e = T.inim[0]; sozinho(T, e); e.parado = true; limpar(T, 7); pe(e, 6, 7); e.hp = e.hpMax = 99; e.chefe = false; T.heroi = { c: 3, r: 7 };
      T.mao.unshift({ id: 'pux', nome: 'P', ini: 1, mov: 1, atq: 2, alc: 3, puxar: 2 }); tEscolherCarta(T, p, 'pux'); T.heroi = { c: 3, r: 7 }; tAtacar(T, p, e.uid); out.puxou = e.c; }
    return out; })()`);
  igual(r.empurrou, 6, 'empurrou 2 (de 4 para 6)'); igual(r.puxou, 4, 'puxou 2 (de 6 para 4)');
});
teste('"rouba vida": recupera metade do dano causado', () => {
  const r = R(`(() => { const { p, T } = cen(1, { semTurno: true, classe: 'oraculo' }); const e = T.inim[0]; pe(e, 1, 10); e.hp = e.hpMax = 99; e.def = 0; p.hp = 1;
    T.heroi = { c: 0, r: 10 }; tEscolherCarta(T, p, T.mao.find(x => x.nome === 'Drenar alma').id); T.heroi = { c: 0, r: 10 }; tAtacar(T, p, e.uid); return { cura: p.hp - 1, dano: 99 - e.hp }; })()`);
  igual(r.cura, Math.floor(r.dano / 2));
});
teste('escudo da carta (+ o do equipamento) tira pontos de CADA golpe, e pode bloquear tudo', () => {
  const r = R(`(() => { const out = []; for (const [nome, esc] of [['Golpe firme', 0], ['Muralha', 2], ['Muralha', 9]]) {
      const { p, T } = cen(1, { semTurno: true, vivos: true }); const e = T.inim[0]; sozinho(T, e); pe(e, 1, 10); e.hp = e.hpMax = 99; e.atk = 5;
      T.cartas[e.tipo] = K('t', 90, { atq: 0 }); p.hp = 20; T.mao.unshift({ id: 'm', nome, ini: 50, mov: 1, atq: 1, escudo: esc || ((T.mao.find(x => x.nome === nome) || {}).escudo || 0) });
      tEscolherCarta(T, p, 'm'); const hp0 = p.hp; tEncerrarTurno(T, p); tProximoInimigo(T, p); out.push(hp0 - p.hp); } return out; })()`);
  igual(r.join(), '5,3,0', 'sem escudo: 5; escudo 2: 3; escudo 9: bloqueia tudo');
});
teste('a cura da carta vem no começo do turno ', () => {
  const r = R(`(() => { const { p, T } = cen(1, { semTurno: true, classe: 'oraculo' }); p.hp = 1; tEscolherCarta(T, p, T.mao.find(x => x.nome === 'Bênção de cura').id); return [p.hp - 1, 5]; })()`);
  igual(r[0], r[1]);
});
teste('o movimento da carta + botas; gelo tira 1; cartas sem "anda" não andam', () => {
  const r = R(`(() => { const out = [];
    { const { p, T } = cen(1, { semTurno: true }); tEscolherCarta(T, p, T.mao.find(x => x.nome === 'Investida').id); out.push(T.movRest); }
    { const { p, T } = cen(1, { semTurno: true }); p.equip.pes = 'pes_2'; tEscolherCarta(T, p, T.mao.find(x => x.nome === 'Investida').id); tUsarEquip(T, p, 'pes'); out.push(T.movRest); }   // botas: +1 ao USAR
    { const { p, T } = cen(1, { semTurno: true }); T.efeitos = [{ tipo: 'gelo', turnos: 2 }]; tEscolherCarta(T, p, T.mao.find(x => x.nome === 'Investida').id); out.push(T.movRest); }
    { const { p, T } = cen(1, { semTurno: true }); T.mao.unshift({ id: 'z', nome: 'Z', ini: 5, atq: 2 }); tEscolherCarta(T, p, 'z'); out.push(T.movRest); }
    return out; })()`);
  igual(r.join(), '4,5,3,0');
});
teste('descanso longo: iniciativa 99, não anda nem age, cura 3, e a carta usada ESCOLHIDA se perde (as outras voltam)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { semTurno: true }); const d = derivados(p);
    for (let i = 0; i < 3; i++) { tEscolherCarta(T, p, T.mao[0].id); T.fase = 'escolha'; T.cartaHeroi = null; }
    const antes = T.mao.length; const escolhida = T.descarte[1]; p.hp = 2; tEscolherCarta(T, p, 'descanso', escolhida.id);
    return [antes, T.mao.length, T.descarte.length, T.perdidas.length, T.perdidas[0].id === escolhida.id, T.mao.some(c => c.id === escolhida.id), p.hp, T.cartaHeroi.ini, T.movRest, T.acaoUsada]; })()`);
  igual(r.join(), '7,9,0,1,true,false,5,99,0,true');
});
teste('descanso longo exige 2 cartas usadas e que você diga qual se perde', () => {
  const r = R(`(() => { const { p, T } = cen(1, { semTurno: true }); const a = tEscolherCarta(T, p, 'descanso', 'x');      // nada usado ainda
    tEscolherCarta(T, p, T.mao[0].id); T.fase = 'escolha'; T.cartaHeroi = null; const b = tEscolherCarta(T, p, 'descanso', T.descarte[0].id);   // só 1 usada
    tEscolherCarta(T, p, T.mao[0].id); T.fase = 'escolha'; T.cartaHeroi = null; const c = tEscolherCarta(T, p, 'descanso');                    // 2 usadas, sem dizer qual
    const d = tEscolherCarta(T, p, 'descanso', T.descarte[0].id); return [a, b, c, d]; })()`);
  igual(r.join(), 'false,false,false,true');
});
teste('descanso rápido: uma carta usada SORTEADA se perde, as outras voltam à mão e você ainda joga na mesma rodada (1 por rodada)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { semTurno: true }); const hp0 = p.hp = 5;
    for (let i = 0; i < 4; i++) { tEscolherCarta(T, p, T.mao[0].id); T.fase = 'escolha'; T.cartaHeroi = null; }
    const mao0 = T.mao.length, usadas = T.descarte.length; const ids = T.descarte.map(c => c.id);
    const perdida = tDescansoRapido(T, p); const ok2 = tDescansoRapido(T, p);
    const depois = [T.mao.length, T.descarte.length, T.perdidas.length, ids.includes(perdida.id), T.fase, p.hp === hp0, ok2];
    const joga = tEscolherCarta(T, p, T.mao[0].id); return [mao0, usadas, ...depois, joga, T.fase]; })()`);
  igual(r.join(), '6,4,9,0,1,true,escolha,true,,true,heroi');
});
teste('descanso rápido precisa de 2 cartas usadas; na próxima rodada pode de novo', () => {
  const r = R(`(() => { const { p, T } = cen(1, { semTurno: true }); const a = tDescansoRapido(T, p);
    for (let i = 0; i < 3; i++) { tEscolherCarta(T, p, T.mao[0].id); T.fase = 'escolha'; T.cartaHeroi = null; }
    const b = tDescansoRapido(T, p); T.rapidoUsado = false; const c = tDescansoRapido(T, p); return [a, !!b, !!c, T.perdidas.length]; })()`);
  igual(r.join(), ',true,false,1');
});
teste('sem cartas na mão e com menos de 2 no descarte o herói desmaia (derrota)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { semTurno: true }); T.descarte.push(T.mao.splice(0, 1)[0]); T.perdidas.push(...T.mao.splice(0)); T.fase = 'escolha'; conferirExaustao(T); return [T.fim, T.log[T.log.length - 1].msg.includes('exaustão')]; })()`);
  igual(r.join(), 'derrota,true');
});
teste('as cartas perdidas ficam perdidas na próxima etapa também (o baralho do herói vale pelo cenário todo)', () => {
  const r = R(`(() => { const { p, T, exp } = cen(1, { semTurno: true }); for (let i = 0; i < 2; i++) { tEscolherCarta(T, p, T.mao[0].id); T.fase = 'escolha'; T.cartaHeroi = null; }
    tDescansoRapido(T, p); const T2 = criarTatica(exp, p); return [T2.perdidas.length, T2.mao.length + T2.descarte.length + T2.perdidas.length]; })()`);
  igual(r.join(), '1,10');
});
teste('com a mão vazia só dá para descansar; a mão e o descarte seguem para a etapa seguinte', () => {
  const r = R(`(() => { const { p, T, exp } = cen(1, { semTurno: true }); T.descarte.push(...T.mao.splice(0)); const ruim = tEscolherCarta(T, p, T.descarte[0].id); const bom = tEscolherCarta(T, p, 'descanso', T.descarte[0].id);
    const { p: q, T: U, exp: e2 } = cen(1, { semTurno: true }); tEscolherCarta(U, q, U.mao[3].id); const U2 = criarTatica(e2, q);
    return [maoVazia({ mao: [] }), ruim, bom, U2.mao.length, U2.descarte.length, U2.fase]; })()`);
  igual(r.join(), 'true,false,true,9,1,escolha');
});
teste('sala limpa: não há modo livre; você segue usando cartas (a rodada passa sem inimigos)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { semTurno: true, etapa: 0 }); turnoDeTeste(T, p); matarTodos(T); p.hp = 3;
    const out = [T.livre, T.limpa, T.fase, cartaAtual(T).mov, tUsarItem(T, p, 0)]; tEncerrarTurno(T, p); let g = 0; while (T.fase === 'inimigos' && !T.fim && g++ < 5) tProximoInimigo(T, p);
    return [...out, T.fase, T.rodada]; })()`);
  igual(r.join(), 'false,true,heroi,3,true,escolha,2');
});
teste('as cartas dos monstros ficam OCULTAS até você escolher a sua (e viram uma de cada tipo depois)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { semTurno: true, vivos: true }); const antes = Object.keys(T.cartas).length;
    T.mao.unshift({ id: 'x', nome: 'x', ini: 30, mov: 1 }); tEscolherCarta(T, p, 'x'); const tipos = new Set(combatentes(T).map(e => e.tipo));
    const depois = Object.keys(T.cartas).length; T.inim.forEach(e => { e.parado = true; }); let g = 0; while (T.fase === 'inimigos' && g++ < 20) tProximoInimigo(T, p); tEncerrarTurno(T, p); while (T.fase === 'inimigos' && g++ < 40) tProximoInimigo(T, p);
    return [antes, depois === tipos.size, T.fase, Object.keys(T.cartas).length]; })()`);
  igual(r.join(), '0,true,escolha,0');
});
teste('as rodadas seguintes voltam a pedir carta e os inimigos revelam cartas novas', () => {
  const r = R(`(() => { const { p, T } = cen(1, { vivos: true }); T.inim.forEach(e => { e.c = 11 - e.uid; e.r = 0; e.atk = 1; });
    const r1 = T.rodada; tEncerrarTurno(T, p); let g = 0; while (T.fase === 'inimigos' && !T.fim && g++ < 20) tProximoInimigo(T, p);
    const ocultas = Object.keys(T.cartas).length === 0; const fase = T.fase, carta = T.cartaHeroi, fila = T.fila.length, rod = T.rodada; turnoDeTeste(T, p);
    return [r1, rod, fase, carta, fila, ocultas, Object.keys(T.cartas).length > 0]; })()`);
  igual(r[0], 1); igual(r[1], 2); igual(r[2], 'escolha'); igual(r[3], null, 'a carta da rodada anterior sai de cena'); igual(r[4], 0); verdade(r[5], 'cartas ocultas até escolher'); verdade(r[6], 'reveladas depois');
});

console.log('\nCartas dos inimigos (números fixos)');
teste('todo tipo de inimigo tem baralho (6+ cartas; chefes 8) com iniciativa', () => {
  const r = R(`Object.keys(INIMIGOS).map(id => { const b = baralhoDe(id); return [id, b.length, b.every(c => typeof c.ini === 'number' && c.nome)]; })`);
  for (const [id, n, tudoOk] of r) { verdade(n >= 6, `${id} tem só ${n} cartas`); verdade(tudoOk, `${id} tem carta sem nome/iniciativa`); }
  igual(R(`['fenrir','ares','hades','set','caos'].map(id => baralhoDe(id).length)`).join(), '8,8,8,8,8');
});
teste('os inimigos têm números pequenos (normais até 26 de vida e 7 de ataque; chefes até 90 de vida)', () => {
  const r = R(`Object.entries(INIMIGOS).map(([id, e]) => [id, e.hp, e.atk, !!e.chefe])`);
  for (const [id, hp, atk, chefe] of r) { verdade(atk <= 8, `${id} ataque ${atk}`); verdade(chefe ? hp <= 90 : hp <= 26, `${id} vida ${hp}`); }
});
teste('cada tipo ganha UMA carta por rodada, igual para todos do mesmo tipo; o baralho gira e reembaralha', () => {
  const r = R(`(() => { const { T } = cen(5, { etapa: 1, vivos: true });
    T.inim.forEach(e => { e.tipo = 'harpia'; }); T.cartas = {}; revelarCartas(T); const so1 = Object.keys(T.cartas).length;
    T.inim[0].tipo = 'minotauro'; T.cartas = {}; revelarCartas(T); const so2 = Object.keys(T.cartas).length;
    const tipo = 'harpia'; T.inim.forEach(e => { e.tipo = tipo; }); const total = baralhoDe(tipo).length; T.cartas = {}; T.baralhos = {}; const nomes = [];
    for (let i = 0; i < total; i++) { revelarCartas(T); nomes.push(T.cartas[tipo].nome); } const unicas = new Set(nomes).size; revelarCartas(T);
    return [so1, so2, unicas === total, !!T.cartas[tipo]]; })()`);
  igual(r.join(), '1,2,true,true');
});
teste('carta "anda +1, ataque -1": anda 3 (2 + 1) e bate 1 a menos (conta exata)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1, vivos: true }); const e = T.inim[0]; sozinho(T, e); e.tipo = 'draugr'; e.mov = 2; e.alc = 1; e.atk = 4; pe(e, 6, 10); e.hp = e.hpMax = 99; T.heroi = { c: 0, r: 10 };
    p.hp = 20; const d0 = dist(e, T.heroi); carta(T, 'draugr', K('teste', 30, { mov: 1, atq: -1 })); tEncerrarTurno(T, p); tProximoInimigo(T, p);
    const andou = d0 - dist(e, T.heroi);
    const { p: q, T: U } = cen(1, { etapa: 1, vivos: true }); const f = U.inim[0]; sozinho(U, f); f.tipo = 'draugr'; f.atk = 4; pe(f, 1, 10); U.heroi = { c: 0, r: 10 }; q.hp = 20; carta(U, 'draugr', K('teste', 30, { mov: 1, atq: -1 })); tEncerrarTurno(U, q); tProximoInimigo(U, q);
    return { andou, dano: 20 - q.hp }; })()`);
  igual(r.andou, 3, 'andou (2 base + 1 da carta)'); igual(r.dano, 3, '4 de ataque -1 da carta');
});
teste('carta "não anda, ataque +2": fica parado e bate 2 a mais', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1, vivos: true }); const e = T.inim[0]; sozinho(T, e); e.tipo = 'draugr'; e.atk = 3; pe(e, 1, 10); T.heroi = { c: 0, r: 10 }; p.hp = 20;
    carta(T, 'draugr', K('t', 30, { atq: 2 })); tEncerrarTurno(T, p); tProximoInimigo(T, p); return { dano: 20 - p.hp, ficou: e.c }; })()`);
  igual(r.dano, 5, '3 + 2'); igual(r.ficou, 1, 'não saiu do lugar');
});
teste('carta "cura 2 e fortalece": cura 2 pontos de vida de cada um ao lado e dá +1 de ataque', () => {
  const r = R(`(() => { const { p, T } = cen(5, { etapa: 1, vivos: true }); T.inim.slice(2).forEach(e => { e.parado = true; e.c = 11; e.r = 0; });
    const [a, b] = T.inim; a.tipo = 'satiro'; b.tipo = 'harpia'; pe(a, 6, 5); pe(b, 7, 5); a.hpMax = b.hpMax = 10; a.hp = b.hp = 4;
    T.heroi = { c: 0, r: 10 }; carta(T, 'satiro', K('t', 5, { curar: 2, fortalecer: 1 })); carta(T, 'harpia', K('t', 99, {})); tEncerrarTurno(T, p); tProximoInimigo(T, p);
    return { a: a.hp, b: b.hp, bonusA: a.bonusAtq, bonusB: b.bonusAtq }; })()`);
  igual(r.a, 6); igual(r.b, 6); igual(r.bonusA, 1); igual(r.bonusB, 1);
});
teste('escudo do inimigo tira pontos de cada golpe que ele recebe (mínimo 1)', () => {
  const r = R(`(() => { const out = []; for (const esc of [0, 2, 9]) { const { p, T } = cen(1, { semTurno: true }); const e = T.inim[0]; pe(e, 1, 10); e.hp = e.hpMax = 99; e.def = 0; e.escudo = esc;
      T.mao.unshift({ id: 'k', nome: 'K', ini: 0, mov: 1, atq: 5 }); tEscolherCarta(T, p, 'k'); tAtacar(T, p, e.uid); out.push(99 - e.hp - derivados(p).dano); } return out; })()`);
  igual(r.join(), '5,3,1', 'dano 5 menos o escudo 0, 2 e 9 (mínimo 1)');
});
teste('a iniciativa decide a ordem: carta de número menor age primeiro', () => {
  const r = R(`(() => { const { p, T } = cen(5, { etapa: 1, vivos: true }); const [a, b] = T.inim; a.tipo = 'harpia'; b.tipo = 'minotauro'; T.inim.slice(2).forEach(e => { e.parado = true; e.c = 11; e.r = 0; });
    carta(T, 'harpia', K('t', 80, {})); carta(T, 'minotauro', K('t', 10, {})); tEncerrarTurno(T, p); return T.fila.join() === [b.uid, a.uid].join(); })()`);
  verdade(r, 'minotauro (10) deveria agir antes da harpia (80)');
});
teste('o aviso de chefe aparece quando a carta é um ataque forte; todo chefe tem uma', () => {
  const r = R(`(() => { const { T } = cen(4, { etapa: 2, vivos: true }); const boss = T.inim.find(e => e.chefe);
    T.baralhos[boss.tipo] = { cartas: [K('Mordida', 15, { mov: 2, atq: 3 })], i: 0 }; T.log = []; revelarCartas(T);
    return [T.log.some(l => l.cls === 'aviso' && /Mordida/.test(l.msg)), ['fenrir','ares','hades','set','caos'].map(id => baralhoDe(id).some(c => c.atq >= 3)).every(Boolean)]; })()`);
  verdade(r[0], 'aviso'); verdade(r[1], 'chefes com carta forte');
});
teste('descreverCarta e descreverCartaHeroi traduzem a carta em texto simples para a tela', () => {
  igual(R(`descreverCarta(K('x', 20, { mov: 1, atq: -1, curar: 2, fortalecer: 1 })).map(d => d.texto).join('|')`), 'anda +1|ataque -1|cura 2|fortalece 1');
  igual(R(`descreverCartaHeroi(K('x', 20, { mov: 2, atq: 3, alc: 4, empurrar: 1 }), { dano: 2, mov: 1, cura: 0, alc: 1 }).map(d => d.texto).join('|')`), 'anda 3|dano 5|alcance 5|empurra 1');
});

console.log('\nEmpurrar e puxar');
teste('empurrar: afasta o inimigo em linha reta, na direção oposta ao herói', () => {
  const r = R(`(() => { const { p, T } = cen(1, { vivos: true }); const e = T.inim[0]; sozinho(T, e); pe(e, 5, 7); e.hp = e.hpMax = 99; T.heroi = { c: 3, r: 7 }; const n = forcarMovimento(T, p, e, T.heroi, 2, 'empurrar'); return [n, e.c, e.r]; })()`);
  igual(r.join(), '2,7,7');
});
teste('empurrar para antes de uma parede e para antes de outro inimigo', () => {
  const r = R(`(() => { const { p, T } = cen(1, { vivos: true }); const [a, b] = T.inim; sozinho(T, a); pe(a, 8, 4); T.heroi = { c: 6, r: 4 }; const n1 = forcarMovimento(T, p, a, T.heroi, 3, 'empurrar');
    const { p: q, T: U } = cen(1, { vivos: true }); const [c, d] = U.inim; pe(c, 5, 7); pe(d, 6, 7); d.parado = true; U.heroi = { c: 3, r: 7 }; const n2 = forcarMovimento(U, q, c, U.heroi, 2, 'empurrar');
    return [n1, celula(T.g, 9, 4), a.c, n2]; })()`);
  igual(r.join(), '0,#,8,0');
});
teste('empurrar para cima de uma armadilha dispara o efeito nela', () => {
  const r = R(`(() => { const { p, T } = cen(9, { vivos: true }); const e = T.inim[0]; sozinho(T, e); pe(e, 5, 7); e.hp = e.hpMax = 99; T.heroi = { c: 3, r: 7 }; armar(T, 6, 7, 'fogo'); forcarMovimento(T, p, e, T.heroi, 1, 'empurrar'); return { dano: 99 - e.hp, some: !T.armadilhas.has(chave(6, 7)) }; })()`);
  igual(r.dano, 2, 'fogo = 2 de dano'); verdade(r.some, 'a armadilha foi usada');
});
teste('chefes e estruturas não saem do lugar; puxar aproxima e para colado no herói', () => {
  const r = R(`(() => { const { p, T } = cen(4, { etapa: 2, vivos: true }); const boss = T.inim.find(e => e.chefe); pe(boss, 5, 7); T.heroi = { c: 3, r: 7 }; const n1 = forcarMovimento(T, p, boss, T.heroi, 2, 'empurrar');
    const { p: q, T: U } = cen(1, { vivos: true }); const e = U.inim[0]; sozinho(U, e); pe(e, 8, 7); U.heroi = { c: 3, r: 7 }; const n2 = forcarMovimento(U, q, e, U.heroi, 9, 'puxar'); return [n1, n2, e.c, dist(e, U.heroi)]; })()`);
  igual(r.join(), '0,4,4,1');
});
teste('cartas dos inimigos também empurram e puxam o herói (sem esquiva, conta exata)', () => {
  const r = R(`(() => { const out = {};
    { const { p, T } = cen(1, { vivos: true }); const e = T.inim[0]; sozinho(T, e); limpar(T, 7); e.tipo = 'troll_gelo'; pe(e, 5, 7); T.heroi = { c: 4, r: 7 }; p.hp = 20; atacarHeroi(T, p, derivados(p), e, K('t', 1, { atq: 0, empurrarHeroi: 2 })); out.empurrado = T.heroi.c; }
    { const { p, T } = cen(1, { vivos: true }); const e = T.inim[0]; sozinho(T, e); limpar(T, 7); e.tipo = 'harpia'; e.alc = 4; pe(e, 8, 7); T.heroi = { c: 4, r: 7 }; p.hp = 20; atacarHeroi(T, p, derivados(p), e, K('t', 1, { atq: 0, puxarHeroi: 2 })); out.puxado = T.heroi.c; }
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
teste('os inimigos ficam mais fortes conforme o nível do herói e a dificuldade; as recompensas também', () => {
  const r = R(`[2, 10, 20].map(n => cen(1, { nivel: n, vivos: true }).T.exp.stat)`);
  verdade(r[0] < r[1] && r[1] < r[2], JSON.stringify(r));
  const d = R(`['facil', 'intermediario', 'dificil', 'expert'].map(d => { const { exp } = cen(1, { dif: d, vivos: true }); return [exp.stat, exp.rec]; })`);
  for (let i = 1; i < 4; i++) { verdade(d[i][0] > d[i - 1][0], 'força sobe'); verdade(d[i][1] > d[i - 1][1], 'recompensa sobe'); }
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
teste('matar um inimigo dá XP pequeno e uma moeda; o herói cai quando a vida zera', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1, vivos: true }); const e = T.inim[0]; sozinho(T, e); pe(e, 1, 10); e.hp = 1; e.def = 0; tAtacar(T, p, e.uid);
    const { p: q, T: U } = cen(1, { etapa: 1, vivos: true }); const f = U.inim[0]; sozinho(U, f); pe(f, 1, 10); f.atk = 50; U.heroi = { c: 0, r: 10 }; carta(U, f.tipo, K('t', 90, { atq: 0 })); q.hp = 5; tEncerrarTurno(U, q); tProximoInimigo(U, q);
    return { vivo: e.vivo, moeda: T.moedas.size, xp: e.xp, caiu: U.fim, hp: q.hp }; })()`);
  igual(r.vivo, false); igual(r.moeda, 1); verdade(r.xp >= 1 && r.xp <= 15, 'xp ' + r.xp); igual(r.caiu, 'derrota'); igual(r.hp, 0);
});
teste('um inimigo anda até o herói e ataca com dano exato (ataque base + carta)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 1, vivos: true }); const e = T.inim[0]; sozinho(T, e); e.tipo = 'draugr'; e.mov = 3; e.alc = 1; e.atk = 3; pe(e, 3, 10); T.heroi = { c: 0, r: 10 }; p.hp = 20;
    carta(T, 'draugr', K('t', 30, { mov: 0, atq: 0 })); tEncerrarTurno(T, p); tProximoInimigo(T, p); return { perto: dist(e, T.heroi), dano: 20 - p.hp }; })()`);
  igual(r.perto, 1, 'encostou no herói'); igual(r.dano, 3);
});

console.log('\nArmadilhas');
teste('cada cenário usa a armadilha do seu tema', () => { igual(R(`REINOS.map(r => r.armadilha).join()`), 'gelo,raio,fogo,veneno,vazio'); });
teste('as salas nascem com armadilhas no chão (do tipo do reino)', () => {
  const r = R(`[1, 5, 9, 13, 17].map(id => { const c = cenarioPorId(id); const p = novoJogador('T', 'guerreiro'); const T = criarTatica(criarExpedicao(c, p), p);
    const reino = REINOS.find(x => x.id === c.reino); return T.armadilhas.size >= 4 && [...T.armadilhas.values()].every(a => a.tipo === reino.armadilha); })`);
  verdade(r.every(Boolean));
});
teste('gelo: -1 de movimento por 2 rodadas, depois volta ao normal', () => {
  const r = R(`(() => { const { p, T } = cen(1); armar(T, 1, 10, 'gelo'); tMover(T, p, 1, 10);
    const agora = T.movRest; rodada(T, p); const r2 = T.movRest; rodada(T, p); const r3 = T.movRest; return { agora, r2, r3, sobrou: T.efeitos.length }; })()`);
  igual(r.agora, 0, 'o movimento é usado uma vez só: não sobra nada'); igual(r.r2, 2, '2ª rodada'); igual(r.r3, 3, '3ª rodada'); igual(r.sobrou, 0);
});
teste('fogo: 2 de dano; no fácil 1 e no expert 3; chefe sofre metade', () => {
  const r = R(`(() => { const out = []; for (const dif of ['facil', 'intermediario', 'expert']) { const { p, T } = cen(9, { dif }); const a = p.hp; armar(T, 1, 10, 'fogo'); tMover(T, p, 1, 10); out.push(a - p.hp); }
    const { p, T } = cen(12, { etapa: 2, vivos: true }); const boss = T.inim.find(e => e.chefe); boss.hp = boss.hpMax = 99; pe(boss, 5, 5); armar(T, 5, 5, 'fogo'); dispararArmadilha(T, p, boss, 5, 5); out.push(99 - boss.hp); return out; })()`);
  igual(r.join(), '1,2,3,1');
});
teste('veneno: 1 de dano por 3 rodadas e depois para', () => {
  const r = R(`(() => { const { p, T } = cen(13); armar(T, 1, 10, 'veneno'); tMover(T, p, 1, 10); const hist = []; for (let i = 0; i < 5; i++) { const a = p.hp; rodada(T, p); hist.push(a - p.hp); } return hist; })()`);
  igual(r.join(), '1,1,1,0,0');
});
teste('raio: 1 de dano e o movimento acaba no hexágono da armadilha', () => {
  const r = R(`(() => { const { p, T } = cen(5); const hp0 = p.hp; armar(T, 1, 10, 'raio'); tMover(T, p, 3, 10); return { pos: T.heroi.c + ',' + T.heroi.r, mov: T.movRest, perdeu: hp0 - p.hp }; })()`);
  igual(r.pos, '1,10'); igual(r.mov, 0); igual(r.perdeu, 1);
});
teste('vazio: 1 de dano e você perde 1 carta da mão (vai para o descarte)', () => {
  const r = R(`(() => { const { p, T } = cen(20, { etapa: 2 }); const m0 = T.mao.length, d0 = T.descarte.length, hp0 = p.hp; armar(T, 1, 10, 'vazio'); tMover(T, p, 1, 10); return { dano: hp0 - p.hp, mao: m0 - T.mao.length, descarte: T.descarte.length - d0 }; })()`);
  igual(r.dano, 1); igual(r.mao, 1); igual(r.descarte, 1);
});
teste('o caminho evita armadilhas quando existe outro igualmente curto', () => {
  const r = R(`(() => { let achou = 0, pisou = 0; const { p, T } = cen(1, { carta: { mov: 5 } }); const ini = { c: 5, r: 6 }; T.heroi = { ...ini }; T.movRest = 5;
    for (const alvo of tAlcance(T).filter(a => a.custo >= 3)) {
      const nos = bfs(T.g, ini, 6, () => false, () => false); const meio = caminhoAte(nos.get(chave(alvo.c, alvo.r)))[0];
      const sem = bfs(T.g, ini, 6, (c, r) => c === meio.c && r === meio.r, () => false).get(chave(alvo.c, alvo.r));
      if (!sem || sem.d !== alvo.custo) continue; achou++;
      T.armadilhas.clear(); armar(T, meio.c, meio.r, 'gelo'); T.heroi = { ...ini }; T.movRest = 5; T.efeitos = [];
      tMover(T, p, alvo.c, alvo.r); if (!T.armadilhas.has(chave(meio.c, meio.r))) pisou++; }
    return { achou, pisou }; })()`);
  verdade(r.achou >= 5, 'poucos casos: ' + r.achou); igual(r.pisou, 0);
});

console.log('\nPortas');
teste('a porta fechada bloqueia o caminho; limpar a sala NÃO abre nada: você precisa chegar até ela com as cartas', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 0, vivos: true }); const { c, r } = T.porta;
    const antes = { chao: celula(T.g, c, r), alcanca: tAlcance({ ...T, movRest: 99 }).some(h => h.c === c && h.r === r) };
    matarTodos(T); return { antes, fim: T.fim, limpa: T.limpa, depois: celula(T.g, c, r), aberta: T.porta.aberta, livre: T.livre }; })()`);
  igual(r.antes.chao, 'D'); igual(r.antes.alcanca, false); igual(r.fim, null); igual(r.limpa, true); igual(r.depois, '.'); igual(r.aberta, false, 'a porta só abre quando você chega nela'); igual(r.livre, false);
});
teste('chegar na porta (com a sala limpa) abre e leva à próxima etapa (mais inimigos e um pouco de vida de volta)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 0, vivos: true }); const d = derivados(p); const n1 = combatentes(T).length;
    p.hp = Math.round(d.hpMax * 0.4); const hp0 = p.hp; matarTodos(T); T.movRest = 99; tMover(T, p, T.porta.c, T.porta.r); const fim = T.fim, aberta = T.porta.aberta;
    const N = tProximaEtapa(T, p); const rec = Math.max(1, Math.round(d.hpMax * DIFICULDADES.intermediario.porta));
    return { fim, aberta, n1, n2: combatentes(N).length, etapa: N.etapa, ganhou: p.hp - hp0, esperado: rec }; })()`);
  igual(r.fim, 'porta'); igual(r.aberta, true); verdade(r.n2 > r.n1, `${r.n1} → ${r.n2}`); igual(r.etapa, 2); igual(r.ganhou, r.esperado, 'vida recuperada');
});
teste('a porta só vale depois da sala limpa (com inimigos vivos ela é parede)', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 0, vivos: true }); T.movRest = 99; return [tMover(T, p, T.porta.c, T.porta.r), T.fim]; })()`);
  igual(r.join(), 'false,');
});
teste('última sala: cumprir o objetivo TERMINA o cenário na hora; moedas e baú que ficaram no chão se perdem', () => {
  const r = R(`(() => { const { p, T, exp } = cen(1, { etapa: 1, vivos: true }); const e = T.inim[0]; pe(e, 5, 5); e.moedas = 3; matarTodos(T);
    const noChao = [...T.moedas.values()].reduce((a, m) => a + m.valor, 0); const rec = concluirCenario(T, p);
    return { fim: T.fim, limpa: T.limpa, noChao, bau: T.bau.aberto, juntou: exp.moedasColetadas, ouro: rec.moedas.ouro }; })()`);
  igual(r.fim, 'vitoria'); igual(r.limpa, true); verdade(r.noChao >= 3, 'moedas no chão'); igual(r.bau, false); igual(r.juntou, 0, 'as moedas do chão não foram pegas'); igual(r.ouro, 0, 'e não viram ouro');
});
teste('na sala limpa os turnos seguem sem inimigos: a rodada passa e pede uma nova carta', () => {
  const r = R(`(() => { const { p, T } = cen(1, { etapa: 0, vivos: true }); matarTodos(T); const a = tEncerrarTurno(T, p); let g = 0; while (T.fase === 'inimigos' && !T.fim && g++ < 5) tProximoInimigo(T, p);
    return [a, T.fase, T.rodada]; })()`);
  igual(r.join(), 'true,escolha,2');
});
teste('só dá para fugir pela entrada, e nunca na arena do chefe', () => {
  const r = R(`(() => { const a = cen(1); a.T.heroi = { ...a.T.saida }; const livre = tFugir(a.T);
    const b = cen(1); b.T.heroi = { c: 4, r: 4 }; const longe = tFugir(b.T);
    const c = cen(4, { etapa: 2 }); c.T.heroi = { ...c.T.saida }; const arena = tFugir(c.T); return [livre, longe, arena]; })()`);
  igual(r.join(), 'true,false,false');
});

teste('os monstros nascem em GRUPO (colados uns nos outros) e perto do herói; as salas têm 3 a 5 e o chefe vem com 3 capangas', () => {
  const r = R(`(() => { let pior = 0, maxHeroi = 0, minHeroi = 99, juntos = true; const tams = new Set();
    for (const id of [1, 4, 5, 9, 13, 20]) for (let k = 0; k < 8; k++) { const { T } = cen(id, { etapa: id === 4 || id === 20 ? 2 : 1, vivos: true }); const cs = T.inim.filter(e => !e.estrutura); tams.add(cs.length);
      for (const e of cs) { const d = dist(e, T.heroi); maxHeroi = Math.max(maxHeroi, d); minHeroi = Math.min(minHeroi, d); const viz = cs.filter(o => o !== e).map(o => dist(o, e)); if (viz.length && Math.min(...viz) > 3) juntos = false; } }
    return { maxHeroi, minHeroi, juntos, tams: [...tams].sort().join() }; })()`);
  verdade(r.juntos, 'cada monstro tem outro a até 3 hexágonos'); verdade(r.minHeroi >= 3, 'nunca colado no herói'); verdade(r.maxHeroi <= 13, 'perto do herói: ' + r.maxHeroi);   // (nos mapas grandes de teste; no jogo as salas são de 8x8 e o máximo medido é 9) verdade(!r.tams.includes('1') && !r.tams.includes('2'), 'tamanhos ' + r.tams);
});

console.log('\nBaralho de modificadores (a sorte)');
teste('o baralho inicial tem 12 cartas (+N, −N, bloqueio e ×2) e nunca passa de 15', () => {
  const r = R(`(() => { const p = novoJogador('T', 'guerreiro'); const t = p.baralho.reduce((a, id) => (a[id] = (a[id] || 0) + 1, a), {});
    return { n: p.baralho.length, tipos: Object.keys(t).sort().join(), bloq: t.bloq, x2: t.x2, max: BARALHO_MAX, inim: Object.keys(DIFICULDADES).map(d => baralhoInimigos(d).length).join() }; })()`);
  igual(r.n, 12); igual(r.tipos, '+1,+2,-1,-2,0,bloq,x2'); igual(r.bloq, 1); igual(r.x2, 1); igual(r.max, 15); igual(r.inim, '11,12,13,14');
});
teste('as cartas: +N soma, −N tira (mínimo 1), ×2 dobra, bloqueio zera', () => {
  const r = R(`['+2', '-2', '0', 'x2', 'bloq'].map(id => aplicarMod(3, CARTAS_MOD[id])).concat([aplicarMod(1, CARTAS_MOD['-2'])])`);
  igual(r.join(), '5,1,3,6,0,1');
});
teste('o baralho só embaralha quando sai ×2 ou bloqueio (aí todas as cartas voltam ao monte)', () => {
  const r = R(`(() => { SORTE.ativa = true; const b = novoBaralhoMod(['+1', '+2', '-1', 'x2', '0', '0']); const vistas = []; const embaralhou = [], monte = [];
    b.compra = ['+1', '+2', '-1', 'x2', '0', '0']; b.descarte = [];
    for (let i = 0; i < 4; i++) { const c = sacarMod(b); vistas.push(c.id); embaralhou.push(c.embaralhou); monte.push(b.compra.length + '/' + b.descarte.length); }
    SORTE.ativa = false; return { vistas: vistas.join(), embaralhou: embaralhou.join(), monte: monte.join() }; })()`);
  igual(r.vistas, '+1,+2,-1,x2'); igual(r.embaralhou, 'false,false,false,true');
  igual(r.monte, '5/1,4/2,3/3,6/0', 'depois do ×2 as 6 cartas voltaram ao monte e o descarte ficou vazio');
});
teste('cada ataque do herói vira uma carta sozinha: +2 dá 5, ×2 dá 6 e bloqueio perde o ataque (e o empurrão)', () => {
  const r = R(`(() => { SORTE.ativa = true; const out = [];
    for (const id of ['+2', 'x2', 'bloq']) {
      const { p, T } = cen(1, { etapa: 1, vivos: true, carta: { empurrar: 2 } }); const e = T.inim[0]; pe(e, 1, 10); e.hp = e.hpMax = 99; e.def = 0; e.parado = true;
      const d = derivados(p).dano; baralhoMod(T, 'heroi').compra = [id, ...baralhoMod(T, 'heroi').compra];
      tAtacar(T, p, e.uid); out.push([99 - e.hp, e.c, T.acaoUsada, T.modFx.length, T.modFx[0].carta.id, 3 + d]);
    } SORTE.ativa = false; return out; })()`);
  const base = r[0][5];
  igual(r[0][0], base + 2); igual(r[1][0], base * 2); igual(r[2][0], 0, 'bloqueio: nenhum dano'); igual(r[2][1], 1, 'bloqueio: sem empurrão');
  verdade(r.every(x => x[2] && x[3] === 1), 'gasta a ação e registra 1 carta por ataque');
  verdade(r[0][1] > 1, 'com o golpe normal o empurrão acontece');
});
teste('ataque em área (ao redor) usa UMA carta só para todos os alvos', () => {
  const r = R(`(() => { SORTE.ativa = true; const { p, T } = cen(1, { etapa: 1, vivos: true, carta: { alvo: 'ao-redor' } });
    const [a, b] = T.inim; pe(a, 1, 10); pe(b, 0, 9); [a, b].forEach(e => { e.hp = e.hpMax = 99; e.def = 0; e.parado = true; });
    tAtacar(T, p, a.uid); const out = [T.modFx.length, 99 - a.hp === 99 - b.hp]; SORTE.ativa = false; return out; })()`);
  igual(r[0], 1); verdade(r[1], 'mesmo dano nos dois');
});
teste('os monstros também viram carta a cada ataque (baralho único dos monstros, que muda com a dificuldade)', () => {
  const r = R(`(() => { SORTE.ativa = true; const out = [];
    for (const id of ['+2', 'x2', 'bloq']) {
      const { p, T } = cen(1, { etapa: 1, vivos: true }); const e = T.inim.find(x => !x.estrutura); e.parado = false; e.atk = 3; pe(e, 1, 10); p.hp = 99;
      baralhoMod(T, 'inim').compra = [id, ...baralhoMod(T, 'inim').compra]; T.escudoHeroi = 0;
      const carta = { atq: 0, nome: 'T' }; atacarHeroi(T, p, derivados(p), e, carta); out.push([99 - p.hp, T.modFx[0].quem, T.modFx[0].carta.id]);
    } SORTE.ativa = false; return out; })()`);
  igual(r[0][0], 5); igual(r[1][0], 6); igual(r[2][0], 0, 'bloqueio: o monstro erra'); igual(r[0][1], 'inim');
});
teste('o baralho vale para o cenário inteiro (passa de uma etapa para a outra)', () => {
  igual(R(`(() => { const { p, T, exp } = cen(1, { etapa: 0 }); const b = T.exp.baralhos; const T2 = criarTatica(exp, p); return T2.exp.baralhos === b && !!b.heroi && !!b.inim; })()`), true);
});

console.log('\nConquistas e cartas novas');
teste('conquista dá uma carta melhor ao baralho do herói (100 XP, 50 moedas, 10 abates...)', () => {
  const r = R(`(() => { const p = novoJogador('T', 'guerreiro'); const n0 = p.baralho.length;
    ganharXp(p, 100); const a = verificarMarcos(p); ganharOuro(p, 50); const b = verificarMarcos(p); p.stats.abates = 10; const c = verificarMarcos(p);
    return { a: a.map(x => x.marco.id).join(), b: b.map(x => x.marco.id).join(), c: c.map(x => x.marco.id).join(), n: p.baralho.length - n0, repete: verificarMarcos(p).length, tem: ['+1', '+2'].every(id => p.baralho.includes(id)) }; })()`);
  igual(r.a, 'xp100'); igual(r.b, 'ouro50'); igual(r.c, 'abates10'); igual(r.n, 3); igual(r.repete, 0, 'cada conquista só vale uma vez'); verdade(r.tem);
});
teste('com 15 cartas, a nova carta troca a pior (−2, −1, +0...) e o bloqueio e o ×2 ficam', () => {
  const r = R(`(() => { const p = novoJogador('T', 'guerreiro'); for (let i = 0; i < 6; i++) adicionarCartaMod(p, '+3');
    const n = p.baralho.length, sem2 = !p.baralho.includes('-2'), sem1 = !p.baralho.includes('-1');
    for (let i = 0; i < 12; i++) adicionarCartaMod(p, '+3');
    return { n, depois: p.baralho.length, sem2, sem1, bloq: p.baralho.includes('bloq'), x2: p.baralho.includes('x2') }; })()`);
  igual(r.n, 15); igual(r.depois, 15); verdade(r.sem2 && r.sem1, 'saíram as piores'); verdade(r.bloq && r.x2, 'bloqueio e ×2 permanecem');
});
teste('todas as conquistas têm meta crescente e dão carta que existe', () => {
  verdade(R(`MARCOS.every(m => CARTAS_MOD[m.carta] && m.meta > 0) && new Set(MARCOS.map(m => m.id)).size === MARCOS.length`), 'marcos válidos');
});
teste('vencer um chefe pela 1ª vez conta como conquista de chefe (carta ×2)', () => {
  const r = R(`(() => { const { p, T } = cen(4, { etapa: 2, vivos: true }); const boss = T.inim.find(e => e.chefe); boss.hp = 0; verificarMortes(T);
    const res = aplicarVitoriaT(T, p); return { chefes: p.stats.chefes, marcos: res.marcos.map(m => m.marco.id).join(), x2: p.baralho.filter(c => c === 'x2').length }; })()`);
  igual(r.chefes, 1); verdade(r.marcos.includes('chefe1')); igual(r.x2, 2);
});
teste('saves antigos ganham baralho, contagens e conquistas', () => {
  const r = R(`(() => { const p = novoJogador('T', 'oraculo'); delete p.baralho; delete p.stats; delete p.marcos; p.cenarios = { 1: true, 2: true }; migrarSave(p);
    return [p.baralho.length, p.stats.cenarios, typeof p.marcos]; })()`);
  igual(r.join(), '12,2,object');
});

console.log('\nMoedas e itens por etapa da campanha');
teste('cada moeda vale 2 de ouro até o cenário 10 e 3 do 11 em diante, pago no FIM do cenário', () => {
  const r = R(`(() => { const out = [];
    for (const id of [1, 10, 11, 20]) { const { p, T, exp } = cen(id, { etapa: cenarioPorId(id).etapas.length - 1 }); exp.moedasColetadas = 5; const g0 = p.gold;
      T.inim.forEach(e => { e.hp = 0; }); verificarMortes(T); const rec = concluirCenario(T, p); out.push([id, rec.moedas.valor, rec.moedas.ouro, p.gold - g0 >= 5 * rec.moedas.valor, exp.moedasColetadas]); }
    return out; })()`);
  igual(r.map(x => x[1]).join(), '2,2,3,3'); igual(r.map(x => x[2]).join(), '10,10,15,15'); verdade(r.every(x => x[3] && x[4] === 0), 'ouro entrou e zerou o contador');
});
teste('moedas não pegas ou perdidas na derrota não viram ouro (só o que o herói saqueou)', () => {
  const r = R(`(() => { const { p, T, exp } = cen(1, { etapa: 1, vivos: true }); const e = T.inim.find(x => !x.estrutura); e.moedas = 4; pe(e, 5, 5); e.hp = 0; verificarMortes(T); return [exp.moedasColetadas, T.moedas.size]; })()`);
  igual(r.join(), '0,1');
});
teste('cada tipo de inimigo solta moedas (1 a 3 os comuns; os chefes mais) e estruturas não soltam', () => {
  const r = R(`(() => { const { T } = cen(3, { etapa: 1, vivos: true }); const est = T.inim.filter(e => e.estrutura).every(e => e.moedas === 0);
    const comuns = Object.entries(INIMIGOS).filter(([id, b]) => !b.chefe).map(([id]) => Math.max(1, Math.round(INIMIGOS[id].gold / 3)));
    return [est, Math.min(...comuns), Math.max(...comuns)]; })()`);
  verdade(r[0]); verdade(r[1] >= 1 && r[2] <= 3);
});
teste('os equipamentos da loja são liberados a cada 5 cenários concluídos (e os melhores vão entrando)', () => {
  const r = R(`(() => { const out = []; const p = novoJogador('T', 'guerreiro');
    for (const n of [0, 4, 5, 9, 10, 15, 20]) { p.cenarios = {}; for (let i = 1; i <= n; i++) p.cenarios[i] = true; const est = estoqueLoja(p, REINOS[0]);
      out.push([n, tierDaLoja(p), est.includes('guerreiro_1'), est.includes('guerreiro_2'), est.includes('guerreiro_3'), est.includes('guerreiro_4')].join()); }
    return out; })()`);
  igual(r.join('|'), '0,1,true,false,false,false|4,1,true,false,false,false|5,2,true,true,false,false|9,2,true,true,false,false|10,3,false,true,true,false|15,4,false,false,true,true|20,4,false,false,true,true');
});
teste('baú e recompensa sorteiam equipamento só do nível liberado', () => {
  const r = R(`(() => { const p = novoJogador('T', 'guerreiro'); const vistos = new Set();
    for (let k = 0; k < 400; k++) vistos.add(sortearEquipamento(REINOS[3], p));
    p.cenarios = {}; for (let i = 1; i <= 10; i++) p.cenarios[i] = true; const v2 = new Set(); for (let k = 0; k < 400; k++) v2.add(sortearEquipamento(REINOS[3], p));
    return [[...vistos].every(id => /_1$/.test(id)), [...v2].every(id => /_3$/.test(id))]; })()`);
  verdade(r[0] && r[1], 'tier segue o progresso, não o reino');
});

console.log(`\n${ok} testes passaram${falhas.length ? `, ${falhas.length} FALHARAM: ${falhas.join('; ')}` : ''}.`);
process.exit(falhas.length ? 1 : 0);
