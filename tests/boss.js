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

const ROBO = require('./robo');

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
    p.tutorial.off = true; p.nivel = 20; p.attr.FOR = 300; p.attr.VIT = 300; p.gold = 5000;
    const d = derivados(p); p.hp = d.hpMax;
    localStorage.setItem(SAVE_KEY, JSON.stringify(p));
  });
  await page.reload();
  await page.evaluate(ROBO);
  await page.evaluate(() => { BALANCO.forca = 0.15; });   // o teste confere o fluxo da campanha, não a dificuldade: inimigos fracos para o robô nunca cair
  const click = s => page.click(s);
  const estado = () => page.evaluate(() => JSON.parse(localStorage.getItem(SAVE_KEY)));
  const passarHistoria = async () => { let n = 0; while (await page.$('[data-a=hist-prox]')) { n++; await click('[data-a=hist-prox]'); } return n; };

  async function jogarCenario(cen) {
    if (await page.$('[data-a=mapa]')) await click('[data-a=mapa]');
    await click(`[data-a=reino][data-id=${cen.reino}]`);
    await passarHistoria();
    await click(`[data-a=cenario][data-id="${cen.id}"]`);
    await page.evaluate(() => { P.hp = derivados(P).hpMax; });   // o teste não passa pelo acampamento: começa cada cenário com a vida cheia
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
