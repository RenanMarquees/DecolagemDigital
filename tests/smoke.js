'use strict';
/* Teste de fumaça: abre o jogo num "celular" virtual, joga o começo (menus, cenário, mapa 3D, toque, pinça, cartas dos inimigos)
   e falha se houver erro de JavaScript. Uso: node tests/smoke.js  (precisa de playwright) */
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
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url)) erros.push(m.text()); });   // a página única não tem ícone: ignora o 404 dele
  page.on('dialog', d => d.accept());
  const shot = n => page.screenshot({ path: path.join(out, n + '.png') });
  const click = sel => page.click(sel);

  await page.addInitScript('window.TESTE_RAPIDO = true;');
  await page.goto(url);
  await shot('01-titulo');
  await click('[data-a=novo]');
  await page.fill('#nome', 'Astrid');
  await click('[data-id=oraculo]');
  await shot('02-criar');
  await click('[data-a=comecar]');
  for (let i = 0; i < 3; i++) await click('[data-a=hist-prox]');
  if (!(await page.$('#tut'))) throw new Error('o tutorial deveria aparecer no mapa do jogo novo');
  await shot('03-mapa');
  await click('[data-a=tut-pular]');                      // o tutorial tem teste próprio (tests/tutorial.js)
  if (await page.$('#tut')) throw new Error('Pular tutorial não escondeu o cartão');
  if ((await page.$$('.chip-dif')).length !== 4) throw new Error('faltam as 4 dificuldades no mapa');
  await click('[data-a=reino][data-id=valhala]');
  await click('[data-a=hist-prox]');                     // introdução do reino
  const cartoes = await page.$$('.card-cen');
  if (cartoes.length !== 4) throw new Error('o reino deveria listar 4 cenários, listou ' + cartoes.length);
  if ((await page.$$('.card-cen:disabled')).length !== 3) throw new Error('só o 1º cenário deveria estar liberado');
  await shot('04-reino');
  await click('[data-a=cenario][data-id="1"]');
  await click('[data-a=dif][data-id=expert]');            // troca de dificuldade
  const nivelExpert = await page.evaluate(() => resumoCenario(CEN, P, P.dificuldade).nivel);
  await shot('05-briefing');
  await click('[data-a=dif][data-id=intermediario]');
  await click('[data-a=iniciar]');
  await page.waitForSelector('#cena3d canvas');
  await page.waitForTimeout(1500);
  await shot('06-batalha');
  const e0 = await page.evaluate(() => Cena3D.estado());
  if (!e0 || e0.quadros < 5 || e0.unidades < 3) throw new Error('o mapa 3D não desenhou: ' + JSON.stringify(e0));
  if (!(await page.$('.carta-inim'))) throw new Error('as cartas dos inimigos não aparecem na tela');
  if (!/Limpe a sala/.test(await page.textContent('#obj'))) throw new Error('o objetivo não aparece');
  if ((await page.$$('.carta-inim .efeitos li')).length < 2) throw new Error('a carta deveria listar os efeitos');

  // zoom com os botões
  const d0 = (await page.evaluate(() => Cena3D.estado())).dist;
  await click('[data-a=tat-zoom-mais]'); await page.waitForTimeout(700);
  const d1 = (await page.evaluate(() => Cena3D.estado())).dist;
  if (!(d1 < d0)) throw new Error(`o botão + deveria aproximar (${d0} -> ${d1})`);

  // pinça com dois dedos (afastar os dedos aproxima a câmera)
  const cdp = await page.context().newCDPSession(page);
  const caixa = await (await page.$('#cena3d')).boundingBox();
  const cx = caixa.x + caixa.width / 2, cy = caixa.y + caixa.height / 2;
  const dedos = (a) => [{ x: cx - a, y: cy, id: 1 }, { x: cx + a, y: cy, id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: dedos(30) });
  for (const a of [45, 60, 80, 100]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: dedos(a) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(800);
  const d2 = (await page.evaluate(() => Cena3D.estado())).dist;
  if (!(d2 < d1)) throw new Error(`a pinça de afastar os dedos deveria aproximar (${d1} -> ${d2})`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: dedos(100) });
  for (const a of [80, 60, 40, 25]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: dedos(a) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(800);
  const d3 = (await page.evaluate(() => Cena3D.estado())).dist;
  if (!(d3 > d2)) throw new Error(`a pinça de juntar os dedos deveria afastar (${d2} -> ${d3})`);
  await click('[data-a=tat-centro]'); await page.waitForTimeout(900);
  await shot('07-zoom');

  // toque real num hexágono azul: o herói anda
  const alvo = await page.evaluate(() => {
    const campo = tAlcance(T).filter(h => !h.armadilhas && !(h.c === T.heroi.c && h.r === T.heroi.r));
    const r = document.getElementById('cena3d').getBoundingClientRect();
    for (const h of campo.sort((a, b) => dist(T.heroi, b) - dist(T.heroi, a))) {
      const t = Cena3D.telaDe(h.c, h.r);
      if (t && t.x > r.left + 20 && t.x < r.right - 70 && t.y > r.top + 20 && t.y < r.bottom - 20) return { c: h.c, r: h.r, x: t.x, y: t.y };
    }
    return null;
  });
  if (!alvo) throw new Error('nenhum hexágono alcançável visível para tocar');
  const antes = await page.evaluate(() => JSON.stringify(T.heroi));
  await page.touchscreen.tap(alvo.x, alvo.y);
  await page.waitForTimeout(500);
  const depois = await page.evaluate(() => JSON.stringify(T.heroi));
  if (antes === depois) throw new Error('o herói não se moveu ao tocar num hexágono do mapa 3D');
  await shot('08-moveu');

  await click('[data-a=tat-habs]');
  await shot('09-habilidades');
  await click('[data-a=tat-voltar]');
  // encerra o turno: os inimigos jogam e a rodada avança
  await click('[data-a=tat-fim]');
  await page.waitForFunction(() => T && T.rodada >= 2 && !OCUPADO, null, { timeout: 15000 });
  await shot('10-rodada2');
  if (!(await page.$('.carta-inim'))) throw new Error('as cartas da rodada 2 deveriam aparecer');

  // janelas, loja e salvar/continuar
  await page.evaluate(() => { P.nivel = 8; P.attr.FOR = 60; P.attr.VIT = 60; const d = derivados(P); P.hp = d.hpMax; P.mp = d.mpMax; salvar(); });
  await page.reload();
  await click('[data-a=continuar]');
  await click('[data-a=personagem]'); await shot('11-personagem'); await click('[data-a=fechar]');
  await click('[data-a=inventario]'); await shot('12-inventario'); await click('[data-a=fechar]');
  await click('[data-a=reino][data-id=valhala]');
  await click('[data-a=loja]'); await shot('13-loja');
  await click('[data-a=voltar-reino]');
  await browser.close(); srv.close();
  if (nivelExpert < 1) throw new Error('o nível do cenário no expert deveria ser pelo menos 1');
  if (erros.length) { console.error('ERROS:', erros); process.exit(1); }
  console.log('OK: menus, cenário, mapa 3D, toque, pinça, cartas dos inimigos e rodadas funcionam, sem erros de JavaScript. Capturas em', out);
})().catch(e => { console.error(e); srv.close(); process.exit(1); });
