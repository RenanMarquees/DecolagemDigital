'use strict';
/* Teste do tutorial: um jogador NOVO segue os cartões dos cenários 1, 2 e 3 (mapa, objetivo, cartas, loja, inventário, baú, estruturas)
   e confere que cada passo aparece e se conclui. Uso: node tests/tutorial.js  (precisa de playwright) */
const { chromium } = require(process.env.PW_PATH || 'playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROBO = require('./robo');
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
  const page = await (await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })).newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url)) erros.push(m.text()); });
  await page.addInitScript('window.TESTE_RAPIDO = true;');
  await page.goto(`http://localhost:${srv.address().port}/`);
  await page.evaluate(ROBO);
  const click = s => page.click(s);
  const cartao = () => page.evaluate(() => { const c = document.getElementById('tut'); return c ? { id: c.dataset.passo, ok: !!c.querySelector('[data-a=tut-ok]'), alto: c.getBoundingClientRect().height } : null; });
  const visto = new Set();
  const shot = async id => { if (!visto.has(id)) { visto.add(id); await page.screenshot({ path: path.join(out, `tut-${String(visto.size).padStart(2, '0')}-${id}.png`) }); } };
  const esperarCartao = async id => { try { await page.waitForFunction(i => { const c = document.getElementById('tut'); return c && c.dataset.passo === i; }, id, { timeout: 4000 }); } catch (e) { throw new Error(`o cartão "${id}" não apareceu (apareceu: ${JSON.stringify(await cartao())}; ${JSON.stringify(await page.evaluate(() => ({ cenarios: P.cenarios, off: P.tutorial.off, tela: document.querySelector('#app .tela') && document.querySelector('#app .tela').className, feitos: Object.keys(P.tutorial.feitos).filter(k => !k.startsWith('ev_')).length })))})`); } await shot(id); };
  const passarHistoria = async () => { while (await page.$('[data-a=hist-prox]')) await click('[data-a=hist-prox]'); };
  /** Se há um cartão com botão "Entendi", clica nele. Devolve o id (ou null). */
  async function lerCartao() { const c = await cartao(); if (!c) return null; await shot(c.id); if (c.ok) { await click('[data-a=tut-ok]'); await page.waitForTimeout(30); } return c; }

  /** Subiu de nível? O cartão pede para abrir o Personagem (onde se gastam os pontos). */
  async function tratarPontos() { const c = await cartao(); if (c && c.id === 'r_pontos') { await shot('r_pontos'); await click('[data-a=personagem]'); await click('[data-a=fechar]'); } }

  /** Toca em Começar (e confirma o aviso de "vida baixa", se aparecer). */
  async function iniciar() { await click('[data-a=iniciar]'); if (await page.$('[data-a=conf-sim]')) await click('[data-a=conf-sim]'); await page.waitForSelector('#cena3d canvas'); }

  /* ---- começo: mapa, reino, cenário 1 ---- */
  await click('[data-a=novo]');
  await page.fill('#nome', 'Astrid');
  await click('[data-a=comecar]');
  await passarHistoria();
  await esperarCartao('m_bemvindo');
  if (await page.evaluate(() => P.dificuldade) !== 'facil') throw new Error('o jogo novo deveria começar no Fácil');
  await click('[data-a=reino][data-id=valhala]');
  await passarHistoria();
  await esperarCartao('r_cen1');
  await click('[data-a=cenario][data-id="1"]');
  await esperarCartao('br1');
  await iniciar();

  /* ---- uma batalha seguindo os cartões; devolve quando o cenário termina ---- */
  async function jogarCenario(id) {
    let hab = false;
    for (let i = 0; i < 900; i++) {
      if (await page.$('[data-a=bat-fim]')) {
        if (await page.evaluate(() => T.fim === 'derrota')) { await click('[data-a=bat-fim]'); return false; }   // caiu: volta ao reino
        await lerCartao();                                   // "objetivo cumprido"
        if (await page.$('[data-a=tat-saquear]')) { await click('[data-a=tat-saquear]'); await page.waitForTimeout(30); }
        await click('[data-a=bat-fim]'); await passarHistoria();
        return true;
      }
      if (await page.$('[data-a=tat-seguir]')) {
        const c = await lerCartao();
        if (id === 1 && !(c && c.id === 'b_salalimpa') && !visto.has('b_salalimpa')) await esperarCartao('b_salalimpa');
        await click('[data-a=tat-seguir]');
        await lerCartao();                                   // "rumo à porta"
        for (let k = 0; k < 8 && !(await page.$('.hist-texto')); k++) { await click('[data-a=tat-porta]'); await page.waitForTimeout(120); }
        await click('[data-a=hist-prox]'); await passarHistoria();
        continue;
      }
      const c = await cartao();
      if (c && c.ok) { await lerCartao(); continue; }
      if (c) await shot(c.id);
      // no cenário 2 o cartão pede uma habilidade: o teste usa uma de verdade
      if (c && c.id === 'b2_hab' && !hab) {
        const feito = await page.evaluate(() => {
          const h = CLASSES[P.classe].habilidades.map(x => ({ id: x, ...HABILIDADES[x] })).find(x => x.nivel <= P.nivel && P.mp >= x.custo && x.tipo === 'dano' && tAlvos(T, P, { tipo: 'habilidade', id: x.id }).length);
          if (!h || T.acaoUsada || T.fase !== 'heroi' || OCUPADO) return false;
          ACOES['tat-habs'](); ACOES['tat-hab']({ dataset: { id: h.id } });
          const alvo = tAlvos(T, P, { tipo: 'habilidade', id: h.id })[0];
          ACOES.hex({ dataset: { c: alvo.c, r: alvo.r } });
          return true;
        });
        if (feito) { hab = true; continue; }
      }
      await page.evaluate(() => robo(2));
    }
    throw new Error('o cenário não terminou');
  }

  /** Joga o cenário até vencer (se perder, tenta de novo, como um jogador). */
  async function vencer(id) {
    for (let t = 0; t < 5; t++) {
      if (await jogarCenario(id)) return;
      await click(`[data-a=cenario][data-id="${id}"]`); await iniciar();
    }
    throw new Error('o robô não conseguiu vencer o cenário ' + id);
  }
  await vencer(1);
  /* ---- depois do cenário 1: loja, inventário, pontos ---- */
  await esperarCartao('r_loja');
  await click('[data-a=loja]');
  await esperarCartao('l_loja');
  const comprou = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-a=comprar]')].find(x => !x.disabled); if (!b) return false; b.click(); return true; });
  if (!comprou) throw new Error('não deu para comprar nada na loja (ouro: ' + await page.evaluate(() => P.gold) + ')');
  await esperarCartao('l_voltar');
  await click('[data-a=voltar-reino]');
  await esperarCartao('r_inv');
  await click('[data-a=inventario]'); await click('[data-a=fechar]');
  await tratarPontos();
  await esperarCartao('r_cen2');
  await click('[data-a=cenario][data-id="2"]');
  await esperarCartao('br2');
  await iniciar();
  await vencer(2);
  await tratarPontos();
  await esperarCartao('r_cen3');
  await click('[data-a=cenario][data-id="3"]');
  await esperarCartao('br3');
  await iniciar();
  await vencer(3);
  await tratarPontos();
  await esperarCartao('r_fim');
  await click('[data-a=tut-ok]');
  if (await cartao()) throw new Error('depois do último passo não deveria sobrar cartão');

  /* ---- conferência final ---- */
  const feitos = await page.evaluate(() => P.tutorial.feitos);
  const obrigatorios = ['m_bemvindo', 'r_cen1', 'br1', 'b_mapa', 'b_objetivo', 'b_mover', 'b_cartas', 'b_atacar', 'b_fimturno', 'b_salalimpa', 'b_porta', 'b_ultima', 'b_vitoria1', 'r_loja', 'l_loja', 'l_voltar', 'r_inv', 'r_cen2', 'br2', 'b2_bau', 'b2_vitoria', 'r_cen3', 'br3', 'b3_estrutura', 'r_fim'];
  const faltou = obrigatorios.filter(i => !feitos[i]);
  const todos = await page.evaluate(() => Tutorial.passos());
  const opcionais = todos.filter(i => !obrigatorios.includes(i) && !feitos[i]);
  // pular tutorial: some o cartão e não volta
  await page.evaluate(() => Tutorial.reiniciar()); await click('[data-a=mapa]').catch(() => {});
  await page.evaluate(() => telaMapa());
  await esperarCartao('m_bemvindo');
  await click('[data-a=tut-pular]');
  if (await cartao()) throw new Error('"Pular tutorial" não escondeu o cartão');
  await browser.close(); srv.close();
  console.log(`passos vistos: ${Object.keys(feitos).filter(k => !k.startsWith('ev_')).length}/${todos.length}` + (opcionais.length ? ` (não apareceram, dependem da situação: ${opcionais.join(', ')})` : ''));
  if (faltou.length) throw new Error('passos que deveriam ter sido concluídos: ' + faltou.join(', '));
  if (erros.length) { console.error('ERROS:', erros); process.exit(1); }
  console.log('OK: o tutorial guia os cenários 1, 2 e 3 (mapa, objetivo, cartas, loja, inventário, baú e estruturas), sem erros de JavaScript.');
})().catch(e => { console.error(e); srv.close(); process.exit(1); });
