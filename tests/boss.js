'use strict';
/* Teste da campanha: um herói superforte (criado só para o teste) joga os 20 cenários pela tela — objetivos, portas, moedas,
   baú, chefes, relíquias, fragmentos, recompensa aleatória e o epílogo do jogo.
   Uso: node tests/boss.js  (precisa de playwright) */
const { chromium } = require(process.env.PW_PATH || 'playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  const f = q.url === '/' && process.env.PAGINA ? process.env.PAGINA : path.join(raiz, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'text/plain' }); r.end(d); } });
});

/** Robô que roda DENTRO da página, usando os mesmos toques do jogador (ACOES.hex e botões). Devolve como a etapa terminou. */
const ROBO = `window.robo = async function () {
  const campoAte = alvos => {
    const campo = new Map(), fila = [];
    for (const a of alvos) { campo.set(chave(a.c, a.r), 0); fila.push({ c: a.c, r: a.r }); }
    while (fila.length) { const cur = fila.shift(), d = campo.get(chave(cur.c, cur.r)); for (const v of vizinhos(T.g, cur.c, cur.r)) { const k = chave(v.c, v.r); if (!campo.has(k)) { campo.set(k, d + 1); fila.push(v); } } }
    return campo;
  };
  const fim = () => ACOES['tat-fim']();
  for (let i = 0; i < 400; i++) {
    if (!T) return 'sem etapa';
    if (T.fim) return T.fim;
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
  return 'travou';
};`;

(async () => {
  await new Promise(ok => srv.listen(0, ok));
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true })).newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await page.addInitScript('window.TESTE_RAPIDO = true;');
  await page.goto(`http://localhost:${srv.address().port}/`);
  await page.evaluate(() => {
    const p = novoJogador('Teste', 'guerreiro');
    p.nivel = 20; p.attr.FOR = 300; p.attr.VIT = 300; p.gold = 5000;
    const d = derivados(p); p.hp = d.hpMax; p.mp = d.mpMax;
    localStorage.setItem(SAVE_KEY, JSON.stringify(p));
  });
  await page.reload();
  await page.evaluate(ROBO);
  const click = s => page.click(s);
  const estado = () => page.evaluate(() => JSON.parse(localStorage.getItem(SAVE_KEY)));
  const passarHistoria = async () => { let n = 0; while (await page.$('[data-a=hist-prox]')) { n++; await click('[data-a=hist-prox]'); } return n; };

  async function jogarCenario(cen) {
    if (await page.$('[data-a=mapa]')) await click('[data-a=mapa]');
    await click(`[data-a=reino][data-id=${cen.reino}]`);
    await passarHistoria();
    await click(`[data-a=cenario][data-id="${cen.id}"]`);
    await click('[data-a=iniciar]');
    if (await page.$('[data-a=conf-sim]')) await click('[data-a=conf-sim]');
    let etapas = 0, falas = 0;
    for (;;) {
      await page.waitForSelector('#cena3d canvas');
      etapas++;
      const info = await page.evaluate(() => ({ etapa: T.etapa, total: T.totalEtapas, chefe: T.inim.some(e => e.chefe), obj: T.objetivo, ultima: T.ultimaEtapa }));
      if (info.chefe !== (info.etapa === info.total && cen.objetivo === 'chefe')) throw new Error(`cenário ${cen.id}: o chefe deveria aparecer só na última etapa ${JSON.stringify(info)}`);
      const r = await page.evaluate(() => robo());
      if (r !== 'vitoria') {
        const diag = await page.evaluate(() => T && ({ rodada: T.rodada, hp: P.hp, heroi: T.heroi, inim: T.inim.filter(e => e.vivo).map(e => [e.nome, e.hp, e.c, e.r]), log: T.log.slice(-8).map(l => l.msg) }));
        throw new Error(`cenário ${cen.id} etapa ${etapas}: terminou com "${r}" ${JSON.stringify(diag)}`);
      }
      if (await page.$('[data-a=bat-fim]')) {
        if (await page.$('[data-a=tat-saquear]')) { await click('[data-a=tat-saquear]'); await page.evaluate(() => { const m = [...T.moedas.values()][0]; if (m) { ACOES.hex({ dataset: { c: m.c, r: m.r } }); } }); }
        await click('[data-a=bat-fim]');
        falas += await passarHistoria();
        return { etapas, falas };
      }
      await click('[data-a=tat-seguir]');
      for (let k = 0; k < 6 && !(await page.$('.hist-texto')); k++) { await click('[data-a=tat-porta]'); await page.waitForTimeout(150); }
      await click('[data-a=hist-prox]');
      falas += await passarHistoria();
    }
  }

  const cenarios = await page.evaluate(() => CENARIOS.map(c => ({ id: c.id, reino: c.reino, objetivo: c.objetivo, nome: c.nome })));
  const linhas = [];
  await click('[data-a=continuar]');
  for (const cen of cenarios) {
    const antes = await estado();
    const r = await jogarCenario(cen);
    const s = await estado();
    if (!s.cenarios[cen.id]) throw new Error(`cenário ${cen.id} não ficou marcado como concluído`);
    if (cen.objetivo === 'chefe' && cen.id < 20 && s.fragmentos.length <= antes.fragmentos.length) throw new Error(`cenário ${cen.id}: faltou o fragmento do chefe`);
    linhas.push(`#${cen.id} ${cen.nome} (${cen.objetivo}): ${r.etapas} etapas, ${r.falas} páginas de história, nv ${s.nivel}, ouro ${s.gold}`);
  }
  const sf = await estado();
  const titulo = await page.textContent('h1').catch(() => '');
  await browser.close(); srv.close();
  console.log(linhas.join('\n'));
  if (!sf.finalizado) throw new Error('o jogo não chegou ao final');
  if (erros.length) { console.error('ERROS:', erros); process.exit(1); }
  console.log(`OK: os 20 cenários, objetivos, chefes, fragmentos e o final funcionam (tela final: "${titulo}"), sem erros de JavaScript.`);
})().catch(e => { console.error(e); srv.close(); process.exit(1); });
