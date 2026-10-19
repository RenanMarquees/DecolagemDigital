'use strict';
/* Teste de fumaça: abre o jogo num "celular" virtual, joga o começo e
   falha se houver erro de JavaScript. Uso: node tests/smoke.js  (precisa de playwright) */
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
  const url = `http://localhost:${srv.address().port}/`;
  const out = process.env.SHOTS || path.join(__dirname, 'shots');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('dialog', d => d.accept());
  const shot = n => page.screenshot({ path: path.join(out, n + '.png') });
  const click = sel => page.click(sel);

  await page.goto(url);
  await shot('01-titulo');
  await click('[data-a=novo]');
  await page.fill('#nome', 'Astrid');
  await click('[data-id=oraculo]');
  await shot('02-criar');
  await click('[data-a=comecar]');
  for (let i = 0; i < 3; i++) { await shot('03-historia' + i); await click('[data-a=hist-prox]'); }
  await shot('04-mapa');
  await click('[data-a=reino][data-id=valhala]');
  await click('[data-a=hist-prox]');            // intro do reino
  await shot('05-reino');
  await click('[data-a=explorar]');
  await page.waitForSelector('#tab .hex');
  await shot('06-mapa');
  // clicar num hexágono azul move o herói
  const antes = await page.evaluate(() => JSON.stringify(T.heroi));
  await click('.hex.alcancavel');
  const depois = await page.evaluate(() => JSON.stringify(T.heroi));
  if (antes === depois) throw new Error('o herói não se moveu ao tocar num hexágono alcançável');
  await shot('07-moveu');
  await click('[data-a=tat-habs]');
  await shot('08-habilidades');
  await click('[data-a=tat-voltar]');
  // joga até acabar: ataca se houver alvo, senão anda na direção do inimigo mais próximo
  const inimigosAntes = await page.evaluate(() => T.inim.map(e => JSON.stringify([e.c, e.r])).join());
  let moveram = false;
  for (let i = 0; i < 90; i++) {
    if (await page.$('[data-a=bat-fim]')) break;
    if (await page.$('.tatica .vazio')) { await page.waitForTimeout(300); continue; } // inimigos agindo
    if (await page.$('.hex.alvo')) { await click('.hex.alvo'); await page.waitForTimeout(150); }
    else {
      const alvo = await page.evaluate(() => {
        const vs = vivos(T); if (!vs.length || T.movRest <= 0) return null;
        let melhor = null;
        for (const h of tAlcance(T)) { const d = Math.min(...vs.map(e => dist(h, e))); if (!melhor || d < melhor.d) melhor = { c: h.c, r: h.r, d }; }
        return melhor && melhor.d < Math.min(...vs.map(e => dist(T.heroi, e))) ? melhor : null;
      });
      if (alvo) { await click(`.hex[data-c="${alvo.c}"][data-r="${alvo.r}"]`); await page.waitForTimeout(150); continue; }
    }
    if (await page.$('[data-a=tat-fim]')) await click('[data-a=tat-fim]');
    await page.waitForTimeout(250);
    if (i === 3) await shot('09-inimigos-agindo');
  }
  const inimigosDepois = await page.evaluate(() => (T ? T.inim.map(e => JSON.stringify([e.c, e.r])).join() : ''));
  if (inimigosAntes !== inimigosDepois) moveram = true;
  if (!moveram && !(await page.$('[data-a=bat-fim]'))) throw new Error('os inimigos não se moveram');
  await shot('10-fim-batalha');
  if (!(await page.$('[data-a=bat-fim]'))) throw new Error('a batalha não terminou em 90 passos');
  await click('[data-a=bat-fim]');
  await click('[data-a=personagem]');
  await shot('11-personagem');
  await click('[data-a=fechar]');
  await click('[data-a=inventario]');
  await shot('12-inventario');
  await click('[data-a=fechar]');
  await click('[data-a=loja]');
  await shot('13-loja');
  await click('[data-a=voltar-reino]');
  // recarrega e continua
  await page.reload();
  await click('[data-a=continuar]');
  await shot('14-continuar');
  // chefe
  await click('[data-a=reino][data-id=valhala]');
  await click('[data-a=chefe]');
  if (await page.$('[data-a=conf-sim]')) { await shot('14a-confirma'); await click('[data-a=conf-sim]'); }
  await click('[data-a=hist-prox]');
  await page.waitForSelector('#tab .hex');
  if ((await page.$$('.unid.inim')).length < 2) throw new Error('chefe deveria vir com capangas');
  await shot('15-chefe');
  await browser.close(); srv.close();
  if (erros.length) { console.error('ERROS:', erros); process.exit(1); }
  console.log('OK: sem erros de JavaScript. Capturas em', out);
})().catch(e => { console.error(e); srv.close(); process.exit(1); });
