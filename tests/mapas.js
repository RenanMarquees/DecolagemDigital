'use strict';
/* Confere todos os mapas: linhas do mesmo tamanho, um (e só um) H, inimigos suficientes (E),
   e caminho a pé entre o herói e cada ponto de inimigo. Uso: node tests/mapas.js [--ver] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = vm.createContext({ Math, console });
for (const f of ['data.js', 'logic.js', 'mapas.js', 'tatica.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx);
const ver = process.argv.includes('--ver');
const r = vm.runInContext(`(function () {
  const out = []; let erros = 0;
  const usados = new Set(REINOS.flatMap(x => [...x.salas, x.arena]));
  for (const id of Object.keys(MAPAS)) {
    const m = MAPAS[id], rows = m.mapa;
    const problemas = [];
    if (!usados.has(id)) problemas.push('nenhum reino usa este mapa');
    if (new Set(rows.map(l => l.length)).size !== 1) problemas.push('linhas com tamanhos diferentes');
    if (/[^.#~ HE]/.test(rows.join(''))) problemas.push('símbolo desconhecido');
    const g = { cols: rows[0].length, rows: rows.length, cel: [] };
    let H = []; const E = [];
    rows.forEach((l, r) => { g.cel.push([]); [...l].forEach((ch, c) => { if (ch === 'H') H.push({ c, r }); if (ch === 'E') E.push({ c, r }); g.cel[r].push(ch === 'H' || ch === 'E' ? '.' : ch); }); });
    if (H.length !== 1) problemas.push('precisa de exatamente 1 H (tem ' + H.length + ')');
    if (E.length < 4) problemas.push('precisa de ao menos 4 E (tem ' + E.length + ')');
    let alc = 0, chao = 0;
    if (H.length === 1) {
      const nos = bfs(g, H[0], 99, () => false);
      chao = g.cel.flat().filter(x => x === '.').length; alc = nos.size;
      for (const e of E) if (!nos.has(chave(e.c, e.r))) problemas.push('E em ' + e.c + ',' + e.r + ' sem caminho até o herói');
      if (alc < chao) problemas.push((chao - alc) + ' hexágono(s) de chão isolado(s)');
      if (!['pinheiro','runa','coluna','arbusto','espinho','obelisco','sarcofago','cristal'].includes(m.parede)) problemas.push('parede desconhecida: ' + m.parede);
      if (!['fenda','nuvem','lava','areia','vazio'].includes(m.liquido)) problemas.push('líquido desconhecido: ' + m.liquido);
    }
    erros += problemas.length;
    out.push({ id, nome: m.nome, tam: g.cols + 'x' + g.rows, chao, E: E.length, problemas, rows });
  }
  return { out, erros };
})()`, ctx);
for (const m of r.out) {
  console.log(`${m.problemas.length ? '✗' : '✓'} ${m.id.padEnd(13)} ${m.nome.padEnd(30)} ${m.tam}  chão ${String(m.chao).padStart(3)}  inimigos ${m.E}${m.problemas.length ? '  → ' + m.problemas.join('; ') : ''}`);
  if (ver) console.log(m.rows.map((l, i) => (i & 1 ? '  ' : '') + [...l].join(' ')).join('\n') + '\n');
}
if (r.erros) { console.error(`\n${r.erros} problema(s) nos mapas.`); process.exit(1); }
console.log(`\nOK: ${r.out.length} mapas válidos.`);
