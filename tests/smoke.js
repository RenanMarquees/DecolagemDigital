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
  // reforça o herói só para o teste terminar sempre em vitória (o fluxo é o que importa aqui)
  await page.evaluate(() => { P.nivel = 8; P.attr.FOR = 60; P.attr.VIT = 60; P.attr.INT = 40; const d = derivados(P); P.hp = d.hpMax; P.mp = d.mpMax; });

  // armadilhas e porta devem estar desenhadas no mapa
  if ((await page.$$('#c-arm .arm')).length < 4) throw new Error('faltam armadilhas desenhadas no mapa');
  if (!(await page.$('#porta.fechada'))) throw new Error('a porta fechada não apareceu');
  if (!/Etapa 1\/2/.test(await page.textContent('.tat-topo'))) throw new Error('faltou o indicador de etapa');
  await page.evaluate(() => ACOES.hex({ dataset: { c: T.porta.c, r: T.porta.r } }));
  if (!/trancada/.test(await page.textContent('#toast'))) throw new Error('tocar na porta fechada deveria avisar que está trancada');
  const inimigosEtapa1 = await page.evaluate(() => T.inim.length);

  // joga até a sala ficar limpa: ataca se houver alvo, senão anda (fugindo das armadilhas) na direção do inimigo mais próximo
  async function lutarEtapa() {
    for (let i = 0; i < 120; i++) {
      if (await page.$('[data-a=bat-fim]') || await page.$('[data-a=tat-seguir]')) return;
      if (await page.$('.tatica .vazio')) { await page.waitForTimeout(300); continue; } // inimigos agindo
      if (await page.$('.hex.alvo')) { await click('.hex.alvo'); await page.waitForTimeout(150); }
      else {
        const alvo = await page.evaluate(() => {
          const vs = vivos(T); if (!vs.length || T.movRest <= 0) return null;
          // distância a pé até o inimigo mais próximo (contorna rios de lava, muralhas e pedras)
          const campo = new Map(); const fila = [];
          for (const e of vs) { campo.set(chave(e.c, e.r), 0); fila.push({ c: e.c, r: e.r }); }
          while (fila.length) { const cur = fila.shift(); const d = campo.get(chave(cur.c, cur.r)); for (const v of vizinhos(T.g, cur.c, cur.r)) { const k = chave(v.c, v.r); if (!campo.has(k)) { campo.set(k, d + 1); fila.push(v); } } }
          const atual = campo.get(chave(T.heroi.c, T.heroi.r)) ?? 999;
          let melhor = null;
          for (const h of tAlcance(T)) { if (h.armadilhas > 0) continue; const d = campo.get(chave(h.c, h.r)) ?? 999; if (!melhor || d < melhor.d) melhor = { c: h.c, r: h.r, d }; }
          return melhor && melhor.d < atual ? melhor : null;
        });
        if (alvo) { await click(`.hex[data-c="${alvo.c}"][data-r="${alvo.r}"]`); await page.waitForTimeout(150); continue; }
      }
      if (await page.$('[data-a=tat-fim]')) await click('[data-a=tat-fim]');
      await page.waitForTimeout(250);
      if (i === 3) await shot('09-inimigos-agindo');
    }
    throw new Error('a etapa não terminou em 120 passos');
  }
  const inimigosAntes = await page.evaluate(() => T.inim.map(e => JSON.stringify([e.c, e.r])).join());
  await lutarEtapa();
  const inimigosDepois = await page.evaluate(() => T.inim.map(e => JSON.stringify([e.c, e.r])).join());
  await shot('10-sala-limpa');
  if (!(await page.$('[data-a=tat-seguir]'))) throw new Error('a primeira etapa deveria acabar na porta, não no fim da expedição');

  // abre a porta e atravessa
  await click('[data-a=tat-seguir]');
  await page.waitForSelector('#porta.aberta');
  await shot('11-porta-aberta');
  for (let i = 0; i < 4 && !(await page.$('.hist-texto')); i++) { await click('[data-a=tat-porta]'); await page.waitForTimeout(500); } // 2º toque confirma se houver armadilha
  if (!(await page.$('.hist-texto'))) throw new Error('não chegou à porta');
  await shot('12-transicao');
  await click('[data-a=hist-prox]');
  await page.waitForSelector('#tab .hex');
  if (!/Etapa 2\/2/.test(await page.textContent('.tat-topo'))) throw new Error('deveria estar na etapa 2');
  const inimigosEtapa2 = await page.evaluate(() => T.inim.length);
  if (inimigosEtapa2 <= inimigosEtapa1) throw new Error(`a etapa 2 deveria ter mais inimigos (${inimigosEtapa1} -> ${inimigosEtapa2})`);
  if (await page.$('#porta')) throw new Error('a última etapa não deveria ter porta');
  await shot('13-etapa2');
  await lutarEtapa();
  await shot('14-fim-expedicao');
  if (!(await page.$('[data-a=bat-fim]'))) throw new Error('a última etapa deveria terminar com "Continuar"');
  if (inimigosAntes === inimigosDepois) throw new Error('os inimigos não se moveram');
  await click('[data-a=bat-fim]');
  await click('[data-a=personagem]');
  await shot('15-personagem');
  await click('[data-a=fechar]');
  await click('[data-a=inventario]');
  await shot('16-inventario');
  await click('[data-a=fechar]');
  await click('[data-a=loja]');
  await shot('17-loja');
  await click('[data-a=voltar-reino]');
  // recarrega e continua
  await page.reload();
  await click('[data-a=continuar]');
  await shot('18-continuar');
  // chefe
  await click('[data-a=reino][data-id=valhala]');
  await click('[data-a=chefe]');
  if (await page.$('[data-a=conf-sim]')) { await shot('14a-confirma'); await click('[data-a=conf-sim]'); }
  await click('[data-a=hist-prox]');
  await page.waitForSelector('#tab .hex');
  const cheio = await page.evaluate(() => ({ etapa: T.etapa, total: T.totalEtapas, temChefe: T.inim.some(e => e.chefe) }));
  if (cheio.total !== 3 || cheio.etapa !== 1 || cheio.temChefe) throw new Error('o desafio do chefe deveria ter 3 etapas e começar sem o chefe: ' + JSON.stringify(cheio));
  await shot('19-chefe');
  await browser.close(); srv.close();
  if (erros.length) { console.error('ERROS:', erros); process.exit(1); }
  console.log('OK: sem erros de JavaScript. Capturas em', out);
})().catch(e => { console.error(e); srv.close(); process.exit(1); });
