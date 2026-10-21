'use strict';
/* Teste do celular deitado (844×390) e em pé (390×780): o painel de ações fica no lugar certo, nada rola, e o herói
   aparece na parte livre do mapa (não escondido atrás dos painéis). Uso: node tests/paisagem.js  (precisa de playwright) */
const { chromium } = require(process.env.PW_PATH || 'playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  const f = q.url === '/' && process.env.PAGINA ? process.env.PAGINA : path.join(raiz, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'text/plain' }); r.end(d); } });
});
(async () => {
  await new Promise(ok => srv.listen(0, ok));
  const out = process.env.SHOTS || path.join(__dirname, 'shots');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [nome, vp, deitado] of [['retrato', { width: 390, height: 780 }, false], ['paisagem', { width: 844, height: 390 }, true]]) {
    const page = await (await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })).newPage();
    const erros = [];
    page.on('pageerror', e => erros.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url)) erros.push(m.text()); });
    await page.addInitScript('window.TESTE_RAPIDO = true;');
    await page.goto(`http://localhost:${srv.address().port}/`);
    await page.click('[data-a=novo]'); await page.fill('#nome', 'Astrid'); await page.click('[data-a=comecar]');
    while (await page.$('[data-a=hist-prox]')) await page.click('[data-a=hist-prox]');
    await page.click('[data-a=tut-pular]');
    await page.click('[data-a=reino][data-id=valhala]'); await page.click('[data-a=hist-prox]');
    await page.click('[data-a=cenario][data-id="1"]'); await page.click('[data-a=iniciar]');
    await page.waitForSelector('#cena3d canvas'); await page.waitForTimeout(1500);
    const medir = () => page.evaluate(() => {
      const r = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
      const palco = r('.palco'), dock = r('#dock'), h = Cena3D.telaDe(T.heroi.c, T.heroi.r), cv = r('#cena3d');
      return { palco, dock, heroi: h && { x: h.x - cv.left, y: h.y - cv.top }, rola: document.documentElement.scrollHeight > innerHeight + 2, mapaBtns: r('.mapa-botoes'), vp: { w: innerWidth, h: innerHeight } };
    });
    for (const fase of ['escolha', 'turno']) {
      if (fase === 'turno') { await page.click('.cartaH >> nth=0'); await page.click('.cartaH >> nth=1'); await page.click('[data-a=tat-jogar]'); await page.waitForFunction(() => T.fase === 'heroi' && !OCUPADO, null, { timeout: 20000 }); await page.waitForTimeout(400); }
      const m = await medir();
      await page.screenshot({ path: path.join(out, `${nome}-${fase}.png`) });
      if (m.rola) throw new Error(`${nome}/${fase}: a tela rola`);
      if (!m.heroi) throw new Error(`${nome}/${fase}: herói fora da câmera`);
      const livreDireita = deitado ? m.dock.left - 64 : m.palco.width - 64, livreBaixo = deitado ? m.palco.height : m.dock.top - m.palco.top;
      if (deitado && !(m.dock.left > m.palco.width * 0.4)) throw new Error(`${nome}: o painel deveria ficar à direita (dock.left=${m.dock.left})`);
      if (!deitado && !(m.dock.top > m.palco.top + m.palco.height * 0.4)) throw new Error(`${nome}: o painel deveria ficar embaixo`);
      if (m.heroi.x < 0 || m.heroi.x > livreDireita || m.heroi.y < 60 || m.heroi.y > livreBaixo) throw new Error(`${nome}/${fase}: herói escondido atrás dos painéis ${JSON.stringify(m.heroi)} livre x<${livreDireita} y<${livreBaixo}`);
      if (m.dock.bottom > m.vp.h + 1) throw new Error(`${nome}/${fase}: o painel passa da tela`);
    }
    if (erros.length) throw new Error(nome + ': ' + erros.join(' | '));
    await page.context().close();
  }
  await browser.close(); srv.close();
  console.log('OK: em pé e deitado, o painel fica no lugar certo, a tela não rola e o herói aparece no mapa.');
})().catch(e => { console.error(e); srv.close(); process.exit(1); });
