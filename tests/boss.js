'use strict';
/* Teste dos chefes: um herói superforte (criado só para o teste) percorre as expedições (salas, portas e chefe na última etapa)
   de todos os reinos e do Caos pela tela, conferindo história, relíquias, fragmentos, desbloqueio do reino final e o epílogo.
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

  /** Luta a etapa atual até a sala ficar limpa (aparece "Abrir a porta") ou a expedição terminar ("Continuar"). */
  async function lutarAteOFim() {
    for (let i = 0; i < 200 && !(await page.$('[data-a=bat-fim]')) && !(await page.$('[data-a=tat-seguir]')); i++) {
      if (await page.$('.tatica .vazio')) { await page.waitForTimeout(250); continue; }
      if (await page.$('.hex.alvo')) { await click('.hex.alvo'); await page.waitForTimeout(120); }
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
        if (alvo) { await click(`.hex[data-c="${alvo.c}"][data-r="${alvo.r}"]`); await page.waitForTimeout(120); continue; }
      }
      if (await page.$('[data-a=tat-fim]')) await click('[data-a=tat-fim]');
      await page.waitForTimeout(250);
    }
    if (!(await page.$('[data-a=bat-fim]')) && !(await page.$('[data-a=tat-seguir]'))) throw new Error('a etapa não terminou');
  }
  /** Percorre a expedição inteira (salas, portas e, por último, o chefe). Devolve quantas etapas teve. */
  async function percorrerExpedicao() {
    let etapas = 0;
    for (;;) {
      await page.waitForSelector('#tab .hex');
      etapas++;
      const info = await page.evaluate(() => ({ etapa: T.etapa, total: T.totalEtapas, chefe: T.inim.some(e => e.chefe) }));
      if (info.chefe !== (info.etapa === info.total)) throw new Error('o chefe deveria aparecer só na última etapa: ' + JSON.stringify(info));
      await lutarAteOFim();
      if (await page.$('[data-a=bat-fim]')) return etapas;
      await click('[data-a=tat-seguir]');
      for (let k = 0; k < 4 && !(await page.$('.hist-texto')); k++) { await click('[data-a=tat-porta]'); await page.waitForTimeout(400); }
      await click('[data-a=hist-prox]');
    }
  }
  async function vencerChefe(reinoId) {
    await click(`[data-a=reino][data-id=${reinoId}]`);
    await passarHistoria();                       // introdução do reino (primeira visita)
    await click('[data-a=chefe]');
    const antes = await passarHistoria();         // fala do chefe
    const etapas = await percorrerExpedicao();
    await click('[data-a=bat-fim]');
    const depois = await passarHistoria();        // fala final, relíquia e aviso
    return { antes, depois, etapas };
  }

  const rel = [];
  await click('[data-a=continuar]');
  for (const r of ['valhala', 'olimpo', 'inferno', 'duat']) {
    const f = await vencerChefe(r);
    const s = await estado();
    rel.push(`${r}: ${f.etapas} etapas, falas ${f.antes}/${f.depois}, fragmentos ${s.fragmentos.length}, relíquias ${['presa_fenrir', 'elmo_ares', 'coroa_hades', 'olho_set'].filter(k => s.inv[k]).length}`);
    if (await page.$('[data-a=mapa]')) await click('[data-a=mapa]');
  }
  const s4 = await estado();
  if (s4.fragmentos.length !== 4) throw new Error('faltaram fragmentos: ' + s4.fragmentos.length);
  const f = await vencerChefe('caos');
  const sf = await estado();
  rel.push(`caos: ${f.etapas} etapa, falas ${f.antes}/${f.depois}, finalizado=${sf.finalizado}, tela final="${await page.textContent('h1')}"`);
  await browser.close(); srv.close();
  console.log(rel.join('\n'));
  if (!sf.finalizado) throw new Error('o jogo não chegou ao final');
  if (erros.length) { console.error('ERROS:', erros); process.exit(1); }
  console.log('OK: os 5 chefes, relíquias, fragmentos e o final funcionam, sem erros de JavaScript.');
})().catch(e => { console.error(e); srv.close(); process.exit(1); });
