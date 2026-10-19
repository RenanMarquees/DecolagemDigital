'use strict';
/* Teste dos chefes: um herói superforte (criado só para o teste) vence os 4 chefes e o Caos pela tela,
   conferindo história, relíquias, fragmentos, desbloqueio do reino final e o epílogo.
   Uso: node tests/boss.js  (precisa de playwright) */
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
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true })).newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  await page.goto(`http://localhost:${srv.address().port}/`);
  await page.evaluate(() => {
    const p = novoJogador('Teste', 'guerreiro');
    p.nivel = 20; p.attr.FOR = 300; p.attr.VIT = 300; p.gold = 5000;
    const d = derivados(p); p.hp = d.hpMax; p.mp = d.mpMax;
    localStorage.setItem(SAVE_KEY, JSON.stringify(p));
  });
  await page.reload();
  const click = s => page.click(s);
  const estado = () => page.evaluate(() => JSON.parse(localStorage.getItem(SAVE_KEY)));
  const passarHistoria = async () => { const falas = []; while (await page.$('[data-a=hist-prox]')) { falas.push(1); await click('[data-a=hist-prox]'); } return falas.length; };

  async function lutarAteOFim() {
    for (let i = 0; i < 150 && !(await page.$('[data-a=bat-fim]')); i++) {
      if (await page.$('.tatica .vazio')) { await page.waitForTimeout(250); continue; }
      if (await page.$('.hex.alvo')) { await click('.hex.alvo'); await page.waitForTimeout(120); }
      else {
        const alvo = await page.evaluate(() => {
          const vs = vivos(T); if (!vs.length || T.movRest <= 0) return null;
          const atual = Math.min(...vs.map(e => dist(T.heroi, e)));
          let melhor = null;
          for (const h of tAlcance(T)) { const d = Math.min(...vs.map(e => dist(h, e))); if (!melhor || d < melhor.d) melhor = { c: h.c, r: h.r, d }; }
          return melhor && melhor.d < atual ? melhor : null;
        });
        if (alvo) { await click(`.hex[data-c="${alvo.c}"][data-r="${alvo.r}"]`); await page.waitForTimeout(120); continue; }
      }
      if (await page.$('[data-a=tat-fim]')) await click('[data-a=tat-fim]');
      await page.waitForTimeout(250);
    }
    if (!(await page.$('[data-a=bat-fim]'))) throw new Error('a batalha não terminou');
  }
  async function vencerChefe(reinoId) {
    await click(`[data-a=reino][data-id=${reinoId}]`);
    await passarHistoria();                       // introdução do reino (primeira visita)
    await click('[data-a=chefe]');
    const antes = await passarHistoria();         // fala do chefe
    await page.waitForSelector('#tab .hex');
    await lutarAteOFim();
    await click('[data-a=bat-fim]');
    const depois = await passarHistoria();        // fala final, relíquia e aviso
    return { antes, depois };
  }

  const rel = [];
  await click('[data-a=continuar]');
  for (const r of ['valhala', 'olimpo', 'inferno', 'duat']) {
    const f = await vencerChefe(r);
    const s = await estado();
    rel.push(`${r}: falas ${f.antes}/${f.depois}, fragmentos ${s.fragmentos.length}, relíquias ${['presa_fenrir', 'elmo_ares', 'coroa_hades', 'olho_set'].filter(k => s.inv[k]).length}`);
    if (await page.$('[data-a=mapa]')) await click('[data-a=mapa]');
  }
  const s4 = await estado();
  if (s4.fragmentos.length !== 4) throw new Error('faltaram fragmentos: ' + s4.fragmentos.length);
  const f = await vencerChefe('caos');
  const sf = await estado();
  rel.push(`caos: falas ${f.antes}/${f.depois}, finalizado=${sf.finalizado}, tela final="${await page.textContent('h1')}"`);
  await browser.close(); srv.close();
  console.log(rel.join('\n'));
  if (!sf.finalizado) throw new Error('o jogo não chegou ao final');
  if (erros.length) { console.error('ERROS:', erros); process.exit(1); }
  console.log('OK: os 5 chefes, relíquias, fragmentos e o final funcionam, sem erros de JavaScript.');
})().catch(e => { console.error(e); srv.close(); process.exit(1); });
