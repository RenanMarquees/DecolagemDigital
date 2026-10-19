'use strict';
/* Folha de miniaturas: desenha os modelos 3D lado a lado, de vários ângulos, e salva uma imagem.
   Uso:  node tools/folha-miniaturas.js <ids separados por vírgula | todos> <saida.png> [tres|um] [parado|andando|golpe]
   Ex.:  node tools/folha-miniaturas.js fenrir,draugr /tmp/valhala.png tres golpe
   (tres = 4 ângulos: como no jogo, frente, lado, costas; um = só a frente)
   Precisa do Playwright (PW_PATH) e do Chromium (CHROME), como os testes.
   MODELOS_EXTRA=/caminho/a.js,/caminho/b.js  carrega esses arquivos de modelos DEPOIS dos do jogo (para testar sem mexer no jogo). */
const { chromium } = require(process.env.PW_PATH || 'playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const ids = process.argv[2] || 'todos', saida = process.argv[3] || 'folha.png', modo = process.argv[4] || 'tres', pose = process.argv[5] || 'parado';
const extras = (process.env.MODELOS_EXTRA || '').split(',').filter(Boolean);   // arquivos de modelos em teste (valem mais que os do jogo)
const scripts = ['js/vendor/three.min.js', 'js/modelos3d.js', ...fs.existsSync(path.join(raiz, 'js/modelos3d')) ? fs.readdirSync(path.join(raiz, 'js/modelos3d')).filter(f => f.endsWith('.js')).sort().map(f => 'js/modelos3d/' + f) : [], ...extras.map((f, i) => 'extra/' + i + '.js')];
const pagina = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#1a1d2e"><canvas id=c></canvas>
${scripts.map(s => `<script src="/${s}"></script>`).join('\n')}
<script>
const todos = Modelos3D.ids(), pedidos = ${JSON.stringify(ids)} === 'todos' ? todos : ${JSON.stringify(ids)}.split(',').filter(i => Modelos3D.existe(i));
const W = 1800, LIN = 330, H = Math.max(1, pedidos.length) * LIN;
const cv = document.getElementById('c'); cv.width = W; cv.height = H; cv.style.width = W + 'px'; cv.style.height = H + 'px';
const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); r.setSize(W, H, false); r.setClearColor(0x16203a); r.setScissorTest(true);
const cena = new THREE.Scene(); cena.fog = new THREE.Fog(0x16203a, 25, 60);
cena.add(new THREE.HemisphereLight(0xbcd4ff, 0x16203a, 0.95));
const sol = new THREE.DirectionalLight(0xffffff, 0.8); sol.position.set(-5, 11, 7); cena.add(sol);
const rim = new THREE.DirectionalLight(0x9ab8ff, 0.5); rim.position.set(6, 5, -8); cena.add(rim);
Modelos3D.ambiente(r, cena);
const chao = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.2, 6), new THREE.MeshLambertMaterial({ color: 0x2f4a78 })); chao.position.y = -0.1; cena.add(chao);
const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.14, 24), new THREE.MeshLambertMaterial({ color: 0xe0454b })); base.position.y = 0.07; cena.add(base);
const info = [];
let atual = null;
const vistas = [ // [x0, largura, posição da câmera relativa ao modelo, alvo y, fov, yaw do modelo]
  { x: 0, w: 450, cam: [0, 8.2, 5.8], y: 1.0, fov: 38, yaw: 0.3 },       // como no jogo
  { x: 450, w: 450, cam: [1.5, 1.7, 3.6], y: 0.95, fov: 36, yaw: 0.0 },   // de frente (3/4)
  { x: 900, w: 450, cam: [3.6, 1.9, 0.6], y: 0.95, fov: 36, yaw: 0.0 },   // de lado
  { x: 1350, w: 450, cam: [-2.4, 2.0, -3.4], y: 0.95, fov: 36, yaw: 0.0 },// de costas
];
const usadas = '${modo}' === 'um' ? [vistas[1]] : vistas;
window.desenhar = (t, andando, golpe) => {
  r.setScissor(0, 0, W, H); r.setViewport(0, 0, W, H); r.clear();
  pedidos.forEach((id, i) => {
    if (!info[i]) info[i] = Modelos3D.criar(id);
    const m = info[i]; if (!m) return;
    Modelos3D.animar(m, { tempo: t, dt: 0.016, andando, golpe });
    cena.add(m.raiz); m.raiz.position.y = 0.15;
    vistas.forEach((v, k) => {
      if (usadas.indexOf(v) < 0) return;
      m.alvoYaw = m.yaw = v.yaw; m.raiz.rotation.y = v.yaw;
      const cam = new THREE.PerspectiveCamera(v.fov, v.w / LIN, 0.1, 100);
      cam.position.set(v.cam[0] * (0.6 + m.altura * 0.25), v.cam[1] * (0.6 + m.altura * 0.25), v.cam[2] * (0.6 + m.altura * 0.25)); cam.lookAt(0, v.y * (0.5 + m.altura * 0.28), 0);
      const y0 = H - (i + 1) * LIN;
      r.setViewport(v.x, y0, v.w, LIN); r.setScissor(v.x, y0, v.w, LIN); r.render(cena, cam);
    });
    cena.remove(m.raiz);
  });
};
window.pronto = true; window.nomes = pedidos;
</script>`;
const srv = http.createServer((q, res) => {
  const u = q.url.split('?')[0];
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(pagina); return; }
  const mx = u.match(/^\/extra\/(\d+)\.js$/);
  fs.readFile(mx ? extras[+mx[1]] : path.join(raiz, u), (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(d); } });
});
(async () => {
  await new Promise(ok => srv.listen(0, ok));
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1800, height: 900 } });
  const erros = [];
  p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url)) erros.push(m.text()); });
  await p.goto(`http://localhost:${srv.address().port}/`);
  await p.waitForFunction(() => window.pronto);
  const n = await p.evaluate(() => window.nomes);
  await p.evaluate(po => window.desenhar(0.6, po === 'andando', po === 'golpe' ? 0.5 : null), pose);
  await p.locator('#c').screenshot({ path: saida });
  console.log('modelos:', n.join(', '));
  if (erros.length) console.log('ERROS:', erros);
  await b.close(); srv.close();
})();
