'use strict';
/* ============================================================
   CENA 3D (usa a biblioteca three.js, guardada em js/vendor/)

   O tabuleiro de hexágonos vira um cenário em relevo:
     - hexágonos "de pedra" com altura, cores e detalhes de cada reino
     - árvores, colunas, cristais... feitos de formas 3D
     - miniaturas em pé sobre bases coloridas, com animação (respirar, andar, golpear, apanhar)
     - armadilhas, moedas, baú e porta no chão
   Controles: arrastar = mover a câmera · pinça (dois dedos) = zoom · girar dois dedos = girar · tocar = escolher hexágono

   Este arquivo só DESENHA. As regras ficam em tatica.js, e a ui.js manda o estado para cá.
   ============================================================ */
const Cena3D = (() => {
  const S = 1;                               // raio de um hexágono no mundo 3D
  const W = Math.sqrt(3) * S;                // largura de um hexágono
  const pos3d = (c, r) => ({ x: W * (c + 0.5 * (r & 1)), z: 1.5 * S * r });
  const hashHex = (c, r) => (Math.imul(c + 1, 73856093) ^ Math.imul(r + 1, 19349663)) >>> 0;

  /* ---------- Aparência de cada reino ---------- */
  const TEMAS = {
    valhala: { fundo: 0x0d1830, ceu: 0xbcd4ff, solo: 0x16203a, topo: ['#2f4a78', '#36547f', '#2a4068'], lado: 0x1c2c4a, base: 0x101a30 },
    olimpo:  { fundo: 0x2a3760, ceu: 0xffffff, solo: 0x3a4670, topo: ['#6a79ac', '#7685b8', '#5f6ea0'], lado: 0x4a5887, base: 0x343f66 },
    inferno: { fundo: 0x1a0707, ceu: 0xffa070, solo: 0x180606, topo: ['#4a1f22', '#55262a', '#411b1e'], lado: 0x2a1012, base: 0x1a0a0c },
    duat:    { fundo: 0x2a1f0c, ceu: 0xffe2a0, solo: 0x261b0a, topo: ['#7a6232', '#85693a', '#705a2c'], lado: 0x4a3a18, base: 0x33260e },
    caos:    { fundo: 0x0a0418, ceu: 0xc8a0ff, solo: 0x080312, topo: ['#2c1752', '#351c62', '#25133f'], lado: 0x180a30, base: 0x10061e },
  };
  const CORES_BASE = ['#e0454b', '#f08a24', '#4fae4a', '#9a6bdc', '#3aa0a0', '#d65aa8'];
  const COR_HEROI = '#3aa0ff', COR_CHEFE = '#ffd34d', COR_ESTRUTURA = '#8a8a99';

  let THREE_OK = typeof THREE !== 'undefined';
  let E = null;                              // a cena atual (só existe uma por vez)
  const cacheTex = new Map();
  const cacheMat = new Map();

  /* ---------- Utilidades de desenho ---------- */
  function mat(cor, extra = {}) {
    const k = cor + JSON.stringify(extra);
    if (!cacheMat.has(k)) cacheMat.set(k, new THREE.MeshLambertMaterial({ color: cor, ...extra }));
    return cacheMat.get(k);
  }

  /** Transforma um desenho SVG (da minis.js) em textura 3D. Carrega em segundo plano e atualiza sozinha. */
  function texSvg(chave, interno, vb, w, h) {
    if (cacheTex.has(chave)) return cacheTex.get(chave);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}"><defs><radialGradient id="gcaos"><stop offset="0" stop-color="#2a0e55"/><stop offset=".7" stop-color="#4b1d96"/><stop offset="1" stop-color="#0d0618"/></radialGradient></defs>${interno}</svg>`;
    const img = new Image();
    img.onload = () => { cv.getContext('2d').drawImage(img, 0, 0, w, h); tex.needsUpdate = true; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    cacheTex.set(chave, tex);
    return tex;
  }
  const texMini = id => texSvg('mini:' + id, miniatura(id), '-22 -31 44 46', 220, 230);

  function texEmoji(emoji) {
    const k = 'emoji:' + emoji;
    if (cacheTex.has(k)) return cacheTex.get(k);
    const cv = document.createElement('canvas'); cv.width = cv.height = 96;
    const g = cv.getContext('2d'); g.font = '64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, 48, 54);
    const tex = new THREE.CanvasTexture(cv); cacheTex.set(k, tex); return tex;
  }

  /** Chão de cada reino: cor base + detalhes (neve, rachaduras, areia, estrelas...). Há 3 variações por reino. */
  function texChao(reinoId, v) {
    const k = `chao:${reinoId}:${v}`;
    if (cacheTex.has(k)) return cacheTex.get(k);
    const n = 160, cv = document.createElement('canvas'); cv.width = cv.height = n;
    const g = cv.getContext('2d');
    const tema = TEMAS[reinoId];
    g.fillStyle = tema.topo[v]; g.fillRect(0, 0, n, n);
    let seed = (v + 1) * 9301 + reinoId.length * 49297;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    // manchas suaves de cor
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '0,0,0'},${0.03 + rnd() * 0.05})`; g.beginPath(); g.arc(rnd() * n, rnd() * n, 6 + rnd() * 18, 0, 7); g.fill(); }
    g.lineWidth = 2;
    if (reinoId === 'valhala') {
      g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(rnd() * n, rnd() * n, 1.5 + rnd() * 2.2, 0, 7); g.fill(); }
    } else if (reinoId === 'olimpo') {
      g.strokeStyle = 'rgba(255,255,255,.28)'; for (let i = 0; i < 5; i++) { g.beginPath(); const y = rnd() * n; g.moveTo(0, y); g.bezierCurveTo(n * .3, y - 20 + rnd() * 40, n * .6, y - 20 + rnd() * 40, n, y + rnd() * 20 - 10); g.stroke(); }
    } else if (reinoId === 'inferno') {
      g.strokeStyle = 'rgba(255,120,60,.55)'; for (let i = 0; i < 4; i++) { g.beginPath(); let x = rnd() * n, y = rnd() * n; g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (rnd() - .5) * 50; y += (rnd() - .5) * 50; g.lineTo(x, y); } g.stroke(); }
      g.fillStyle = 'rgba(255,180,60,.8)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(rnd() * n, rnd() * n, 1.6, 0, 7); g.fill(); }
    } else if (reinoId === 'duat') {
      g.strokeStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 7; i++) { g.beginPath(); const y = rnd() * n; g.moveTo(0, y); for (let x = 0; x <= n; x += 20) g.lineTo(x, y + Math.sin(x * .05 + i) * 4); g.stroke(); }
      if (v === 1) { g.strokeStyle = 'rgba(232,184,74,.45)'; g.beginPath(); g.moveTo(60, 70); g.lineTo(90, 70); g.moveTo(75, 58); g.lineTo(75, 90); g.moveTo(62, 90); g.lineTo(88, 90); g.stroke(); }
    } else {
      g.fillStyle = 'rgba(224,200,255,.85)'; for (let i = 0; i < 22; i++) { g.beginPath(); g.arc(rnd() * n, rnd() * n, 0.8 + rnd() * 1.8, 0, 7); g.fill(); }
    }
    const tex = new THREE.CanvasTexture(cv); cacheTex.set(k, tex); return tex;
  }

  /** Textura de um líquido (lava, fenda, nuvem, areia movediça, vazio). */
  function texLiquido(tipo) {
    const k = 'liq:' + tipo;
    if (cacheTex.has(k)) return cacheTex.get(k);
    const n = 160, cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d');
    const base = { lava: '#d8531d', fenda: '#0b1325', nuvem: '#bcd0f0', areia: '#4a3a18', vazio: '#09030f' }[tipo];
    g.fillStyle = base; g.fillRect(0, 0, n, n);
    g.lineWidth = 3;
    if (tipo === 'lava') { g.strokeStyle = 'rgba(255,230,120,.8)'; for (let i = 0; i < 5; i++) { g.beginPath(); const y = 20 + i * 30; g.moveTo(0, y); for (let x = 0; x <= n; x += 16) g.lineTo(x, y + Math.sin(x * .09 + i * 2) * 6); g.stroke(); } }
    else if (tipo === 'fenda') { g.strokeStyle = 'rgba(160,200,235,.35)'; for (let i = 0; i < 4; i++) { g.beginPath(); let x = 20 + i * 35, y = 10; g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (j % 2 ? 14 : -14); y += 30; g.lineTo(x, y); } g.stroke(); } }
    else if (tipo === 'nuvem') { g.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(30 + (i * 37) % 120, 40 + (i * 53) % 90, 22 + (i % 3) * 6, 0, 7); g.fill(); } }
    else if (tipo === 'areia') { g.strokeStyle = 'rgba(232,201,122,.4)'; for (let i = 0; i < 6; i++) { g.beginPath(); const y = 15 + i * 26; g.moveTo(0, y); for (let x = 0; x <= n; x += 18) g.lineTo(x, y + Math.sin(x * .07 + i) * 5); g.stroke(); } }
    else { g.fillStyle = '#fff'; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc((i * 61) % n, (i * 37) % n, 0.8 + (i % 3) * .6, 0, 7); g.fill(); } }
    const tex = new THREE.CanvasTexture(cv); cacheTex.set(k, tex); return tex;
  }

  /* ---------- Cenário feito de formas 3D (altura ~1,5) ---------- */
  const cil = (rt, rb, h, cor, seg = 8, extra) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(cor, extra));
  const caixa = (w, h, d, cor, extra) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(cor, extra));
  const esfera = (r, cor, extra) => new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat(cor, extra));
  const em = (m, x, y, z) => { m.position.set(x, y, z); return m; };

  const PROPS3D = {
    pinheiro() {
      const g = new THREE.Group();
      g.add(em(cil(0.1, 0.15, 0.45, 0x5a3d22, 6), 0, 0.22, 0));
      [[0.62, 0.7, 0.72], [0.5, 0.62, 1.12], [0.36, 0.56, 1.46]].forEach(([r, h, y]) => {
        g.add(em(cil(0, r, h, 0x2f6b4a, 7), 0, y, 0));
        g.add(em(cil(0, r * 0.62, h * 0.55, 0xf3f8ff, 7), 0, y + h * 0.18, 0));
      });
      return g;
    },
    runa() {
      const g = new THREE.Group();
      g.add(em(cil(0.3, 0.46, 1.35, 0x7d8798, 5), 0, 0.68, 0));
      const runa = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.62), new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.9 }));
      runa.position.set(0, 0.72, 0.4); g.add(runa);
      g.add(em(caixa(0.07, 0.5, 0.02, 0x15213a), 0, 0.72, 0.415));
      g.add(em(caixa(0.3, 0.07, 0.02, 0x15213a), 0, 0.82, 0.416));
      return g;
    },
    coluna() {
      const g = new THREE.Group();
      g.add(em(caixa(0.95, 0.16, 0.95, 0xd8d2c2), 0, 0.08, 0));
      g.add(em(cil(0.3, 0.34, 1.35, 0xece6d6, 14), 0, 0.84, 0));
      g.add(em(caixa(0.85, 0.16, 0.85, 0xf5f0e2), 0, 1.6, 0));
      return g;
    },
    arbusto() {
      const g = new THREE.Group();
      [[-0.32, 0.38, 0.1, 0.42], [0.34, 0.36, -0.05, 0.4], [0, 0.62, 0, 0.5]].forEach(([x, y, z, r]) => g.add(em(esfera(r, 0x2f7a3a), x, y, z)));
      [[0.1, 0.95, 0.2, 0xffd34d], [-0.4, 0.6, 0.35, 0xff8aa0], [0.45, 0.55, 0.2, 0xffd34d]].forEach(([x, y, z, c]) => g.add(em(esfera(0.07, c), x, y, z)));
      return g;
    },
    espinho() {
      const g = new THREE.Group();
      [[-0.38, 0.5, 0.08, 0.22, 1.0], [0.05, 0.9, -0.05, 0.28, 1.8], [0.4, 0.45, 0.1, 0.2, 0.95]].forEach(([x, y, z, r, h]) => {
        g.add(em(cil(0, r, h, 0x4a343c, 5), x, h / 2, z));
        g.add(em(cil(0, r * 0.4, h * 0.3, 0xff7a45, 5, { emissive: 0xff4a10 }), x, h * 0.88, z));
      });
      return g;
    },
    obelisco() {
      const g = new THREE.Group();
      g.add(em(caixa(0.9, 0.14, 0.9, 0xa9884a), 0, 0.07, 0));
      const fuste = cil(0.16, 0.32, 1.9, 0xc9a86a, 4); fuste.rotation.y = Math.PI / 4; g.add(em(fuste, 0, 1.1, 0));
      const topo = cil(0, 0.2, 0.34, 0xe8b84a, 4, { emissive: 0x6a4a08 }); topo.rotation.y = Math.PI / 4; g.add(em(topo, 0, 2.2, 0));
      for (let i = 0; i < 4; i++) g.add(em(caixa(0.13, 0.03, 0.02, 0x6b4a1a), 0, 0.7 + i * 0.35, 0.28 - i * 0.03));
      return g;
    },
    sarcofago() {
      const g = new THREE.Group();
      g.add(em(caixa(0.8, 0.5, 1.3, 0xd4a93a), 0, 0.25, 0));
      const tampa = cil(0.4, 0.4, 1.3, 0xe0b94a, 12); tampa.rotation.x = Math.PI / 2; tampa.scale.set(1, 1, 0.5); g.add(em(tampa, 0, 0.55, 0));
      g.add(em(caixa(0.34, 0.1, 0.34, 0x2a8a83), 0, 0.9, 0.4));
      g.add(em(esfera(0.17, 0xf0cfa4), 0, 0.88, 0.45));
      return g;
    },
    cristal() {
      const g = new THREE.Group();
      [[-0.4, 0.3, 0.1, 0.22, 1.0, 0x7a4bd0], [0.05, 0.7, -0.05, 0.3, 1.9, 0x9a6bf0], [0.42, 0.45, 0.12, 0.2, 1.1, 0x7a4bd0]].forEach(([x, y, z, r, h, c]) => {
        g.add(em(cil(0, r, h, c, 6, { emissive: 0x3a1a7a }), x, h / 2, z));
        g.add(em(cil(r * 0.5, r, h * 0.2, c, 6, { emissive: 0x3a1a7a }), x, h * 0.1, z));
      });
      return g;
    },
  };

  /* ---------- Criação da cena ---------- */
  function montar(cont, T, opcoes = {}) {
    destruir();
    if (!THREE_OK) { cont.innerHTML = '<p class="vazio">Seu aparelho não conseguiu iniciar o modo 3D.</p>'; return false; }
    const tema = TEMAS[T.reinoId];
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch (err) { cont.innerHTML = '<p class="vazio">Seu aparelho não conseguiu iniciar o modo 3D.</p>'; return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(tema.fundo);
    const w = Math.max(100, cont.clientWidth), h = Math.max(100, cont.clientHeight);
    renderer.setSize(w, h, false);
    const cv = renderer.domElement;
    cv.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;outline:none';
    cv.setAttribute('aria-label', 'Mapa 3D: ' + T.nomeSala);
    cont.insertBefore(cv, cont.firstChild);

    const cena = new THREE.Scene();
    cena.background = new THREE.Color(tema.fundo);
    cena.fog = new THREE.Fog(tema.fundo, 20, 52);
    cena.add(new THREE.HemisphereLight(tema.ceu, tema.solo, 0.95));
    const sol = new THREE.DirectionalLight(0xffffff, 0.8); sol.position.set(-5, 11, 7); cena.add(sol);
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 90);

    const g = T.g;
    E = {
      cont, T, renderer, cena, camera, tema, cv, quadros: 0, relogio: new THREE.Clock(), tempo: 0,
      onHex: opcoes.onHex || (() => {}),
      tiles: new Map(), ov: new Map(), unid: new Map(), arm: new Map(), moedas: new Map(), saindo: [],
      pick: [], cores: new Map(), porta: null, bau: null, saida: null,
      cam: { x: 0, z: 0, dist: 15, yaw: 0, elev: 0.95, alvoX: 0, alvoZ: 0, alvoDist: 15, alvoYaw: 0 },
      limites: { x0: 0, x1: 0, z0: 0, z1: 0 },
      mats: { alc: null, alvo: null, perigo: null, porta: null }, fxCamada: null, ro: null, ponteiros: new Map(),
      toque: null, ultimoSync: null,
    };

    // overlay para os números flutuantes
    E.fxCamada = document.createElement('div'); E.fxCamada.className = 'fx3d'; cont.appendChild(E.fxCamada);

    // materiais dos realces (pintados por cima dos hexágonos)
    const mb = (cor, op) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, depthWrite: false });
    E.mats = { alc: mb(0x4a86f0, 0.5), alvo: mb(0xf0434a, 0.62), perigo: mb(0xffa21e, 0.55), porta: mb(0xffe08a, 0.6) };

    // geometria compartilhada
    const geoHex = new THREE.CylinderGeometry(S * 0.985, S * 0.985, 1, 6);
    const geoOv = new THREE.CylinderGeometry(S * 0.92, S * 0.92, 0.03, 6);
    const lado = mat(tema.lado), fundo = mat(tema.base);
    const topos = [0, 1, 2].map(v => new THREE.MeshLambertMaterial({ map: texChao(T.reinoId, v) }));
    const liqMat = new THREE.MeshLambertMaterial({ map: texLiquido(T.liquido), emissive: T.liquido === 'lava' ? 0x6a2a08 : 0x000000 });
    E.liqMat = liqMat;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;

    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const ch = g.cel[r][c];
        if (ch === ' ') continue;
        const p = pos3d(c, r), hh = hashHex(c, r);
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
        let alt = 0.3 + ((hh % 7) - 3) * 0.008, topoMat = topos[hh % 3];
        if (ch === '~') { alt = 0.14; topoMat = liqMat; }
        if (ch === '#') alt = 0.36;
        const m = new THREE.Mesh(geoHex, [lado, topoMat, fundo]);
        m.scale.y = alt; m.position.set(p.x, alt / 2, p.z);
        cena.add(m);
        E.tiles.set(chave(c, r), { mesh: m, topo: alt, c, r, tipo: ch });
        if (ch === '.' || ch === 'D') {
          m.userData.hex = { c, r }; E.pick.push(m);
          const o = new THREE.Mesh(geoOv, E.mats.alc); o.position.set(p.x, alt + 0.025, p.z); o.visible = false; o.renderOrder = 2; cena.add(o);
          E.ov.set(chave(c, r), o);
        }
        if (ch === '#') {
          const prop = PROPS3D[T.parede]();
          prop.position.set(p.x, alt, p.z); prop.rotation.y = (hh % 628) / 100;
          cena.add(prop);
        }
      }
    }
    E.limites = { x0: x0 - 1, x1: x1 + 1, z0: z0 - 1, z1: z1 + 1 };

    // saída (porta de entrada) e porta da próxima etapa
    const ps = pos3d(T.saida.c, T.saida.r), ts = E.tiles.get(chave(T.saida.c, T.saida.r));
    const marca = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
    marca.rotation.x = -Math.PI / 2; marca.rotation.z = Math.PI / 6; marca.position.set(ps.x, ts.topo + 0.04, ps.z); cena.add(marca);
    if (T.porta) {
      const pp = pos3d(T.porta.c, T.porta.r), tp = E.tiles.get(chave(T.porta.c, T.porta.r));
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texSvg(`porta:${T.reinoId}:0`, portaSvg(T.reinoId, false), '-18 -26 36 44', 180, 220), transparent: true, alphaTest: 0.08 }));
      sp.center.set(0.5, 0.1); sp.scale.set(1.5, 1.83, 1); sp.position.set(pp.x, tp.topo, pp.z); cena.add(sp);
      E.porta = { sprite: sp, aberta: false };
    }
    if (T.bau) {
      const pb = pos3d(T.bau.c, T.bau.r), tb = E.tiles.get(chave(T.bau.c, T.bau.r));
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texSvg('bau:0', bauSvg(false), '-18 -22 36 38', 180, 190), transparent: true, alphaTest: 0.08 }));
      sp.center.set(0.5, 0.08); sp.scale.set(1.2, 1.27, 1); sp.position.set(pb.x, tb.topo, pb.z); cena.add(sp);
      const anel = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 6), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      anel.rotation.x = -Math.PI / 2; anel.rotation.z = Math.PI / 6; anel.position.set(pb.x, tb.topo + 0.04, pb.z); cena.add(anel);
      E.bau = { sprite: sp, anel, aberto: false };
    }

    // cores das bases: cada TIPO de inimigo tem a sua (as cartas na tela usam as mesmas)
    let i = 0;
    for (const e of T.inim) {
      if (e.estrutura || E.cores.has(e.tipo)) continue;
      E.cores.set(e.tipo, e.chefe ? COR_CHEFE : CORES_BASE[i++ % CORES_BASE.length]);
    }

    // câmera inicial: no meio entre o herói e os inimigos
    const vs = T.inim.filter(e => e.vivo);
    const mc = vs.length ? vs.reduce((a, e) => a + e.c, 0) / vs.length : T.heroi.c, mr = vs.length ? vs.reduce((a, e) => a + e.r, 0) / vs.length : T.heroi.r;
    const ini = pos3d((T.heroi.c + mc) / 2, (T.heroi.r + mr) / 2);
    // afasta o bastante para o herói e os inimigos aparecerem juntos na tela
    const pts = [T.heroi, ...vs].map(u => pos3d(u.c, u.r));
    const vao = Math.max(Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x)), 1.2 * (Math.max(...pts.map(p => p.z)) - Math.min(...pts.map(p => p.z))));
    const dist = Math.min(24, Math.max(11, 7 + vao * 0.85));
    Object.assign(E.cam, { x: ini.x, z: ini.z, alvoX: ini.x, alvoZ: ini.z, dist, alvoDist: dist });
    ajustarLimites(); posicionarCamera();

    ligarControles();
    E.ro = new ResizeObserver(() => redimensionar());
    E.ro.observe(cont);
    renderer.setAnimationLoop(quadro);
    return true;
  }

  function redimensionar() {
    if (!E) return;
    const w = Math.max(100, E.cont.clientWidth), h = Math.max(100, E.cont.clientHeight);
    E.renderer.setSize(w, h, false);
    E.camera.aspect = w / h; E.camera.updateProjectionMatrix();
  }

  /* ---------- Câmera ---------- */
  function ajustarLimites() {
    const c = E.cam, l = E.limites;
    c.alvoX = Math.min(l.x1, Math.max(l.x0, c.alvoX)); c.alvoZ = Math.min(l.z1, Math.max(l.z0, c.alvoZ));
    c.alvoDist = Math.min(26, Math.max(6, c.alvoDist));
  }
  function posicionarCamera() {
    const c = E.cam, cosE = Math.cos(c.elev);
    E.camera.position.set(c.x + Math.sin(c.yaw) * cosE * c.dist, Math.sin(c.elev) * c.dist, c.z + Math.cos(c.yaw) * cosE * c.dist);
    E.camera.lookAt(c.x, 0.3, c.z);
  }
  function suavizarCamera(dt) {
    const c = E.cam, k = 1 - Math.pow(0.0008, dt);       // aproxima aos poucos (movimento suave)
    c.x += (c.alvoX - c.x) * k; c.z += (c.alvoZ - c.z) * k;
    c.dist += (c.alvoDist - c.dist) * k; c.yaw += (c.alvoYaw - c.yaw) * k;
    posicionarCamera();
  }
  /** Quantos metros do mundo cabem em um pixel na altura do alvo (para o arrastar acompanhar o dedo). */
  function metrosPorPixel() { return 2 * E.cam.alvoDist * Math.tan((E.camera.fov * Math.PI) / 360) / Math.max(1, E.cont.clientHeight); }

  function arrastar(dx, dy) {
    const c = E.cam, k = metrosPorPixel();
    const rx = Math.cos(c.alvoYaw), rz = -Math.sin(c.alvoYaw);          // direita da câmera no chão
    const fx = -Math.sin(c.alvoYaw), fz = -Math.cos(c.alvoYaw);         // frente da câmera no chão
    c.alvoX += -rx * dx * k + fx * dy * k / Math.sin(c.elev);
    c.alvoZ += -rz * dx * k + fz * dy * k / Math.sin(c.elev);
    ajustarLimites();
  }
  function zoomPor(fator) { E.cam.alvoDist /= fator; ajustarLimites(); }

  function centralizar(c, r, suave = true) {
    if (!E) return;
    const p = pos3d(c, r);
    E.cam.alvoX = p.x; E.cam.alvoZ = p.z; ajustarLimites();
    if (!suave) { E.cam.x = E.cam.alvoX; E.cam.z = E.cam.alvoZ; posicionarCamera(); }
  }
  /** Só mexe a câmera se o hexágono estiver perto da borda da tela. */
  function garantirVisivel(c, r) {
    if (!E) return;
    const t = telaDe(c, r), rect = E.cv.getBoundingClientRect(), m = 70;
    if (!t || t.x < rect.left + m || t.x > rect.right - m || t.y < rect.top + m || t.y > rect.bottom - m) centralizar(c, r);
  }

  /* ---------- Toques: arrastar, pinça, girar e tocar ---------- */
  function ligarControles() {
    const cv = E.cv, pts = E.ponteiros;
    const dist2 = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    const ang2 = () => { const [a, b] = [...pts.values()]; return Math.atan2(b.y - a.y, b.x - a.x); };
    const meio2 = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
    let ref = null;

    cv.addEventListener('pointerdown', ev => {
      cv.setPointerCapture(ev.pointerId);
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pts.size === 1) E.toque = { x: ev.clientX, y: ev.clientY, t: performance.now(), moveu: false };
      else { if (E.toque) E.toque.moveu = true; ref = { d: dist2(), a: ang2(), m: meio2() }; }
    });
    cv.addEventListener('pointermove', ev => {
      const p = pts.get(ev.pointerId); if (!p) return;
      const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
      p.x = ev.clientX; p.y = ev.clientY;
      if (pts.size === 1) {
        if (E.toque && !E.toque.moveu && Math.hypot(ev.clientX - E.toque.x, ev.clientY - E.toque.y) > 8) E.toque.moveu = true;
        if (E.toque && E.toque.moveu) arrastar(dx, dy);
      } else if (pts.size === 2 && ref) {
        const d = dist2(), a = ang2(), m = meio2();
        if (ref.d > 0) zoomPor(d / ref.d);                        // pinça = zoom
        let da = a - ref.a; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
        E.cam.alvoYaw -= da;                                       // girar dois dedos = girar o mapa
        arrastar(m.x - ref.m.x, m.y - ref.m.y);
        ref = { d, a, m };
      }
    });
    const soltar = ev => {
      const era1 = pts.size === 1;
      pts.delete(ev.pointerId); ref = null;
      if (era1 && E.toque && !E.toque.moveu && performance.now() - E.toque.t < 600) tocarEm(ev.clientX, ev.clientY);
      if (pts.size === 0) E.toque = null;
    };
    cv.addEventListener('pointerup', soltar);
    cv.addEventListener('pointercancel', ev => { pts.delete(ev.pointerId); ref = null; E.toque = null; });
    cv.addEventListener('wheel', ev => { ev.preventDefault(); zoomPor(ev.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  }

  /** Descobre qual hexágono foi tocado (acertando a miniatura ou o chão). */
  function hexEm(clientX, clientY) {
    const rect = E.cv.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, E.camera);
    const alvos = [...E.pick];
    for (const u of E.unid.values()) if (!u.morrendo) alvos.push(u.sprite);
    const hits = rc.intersectObjects(alvos, false);
    for (const h of hits) {
      if (h.object.userData.hex) return h.object.userData.hex;
      if (h.object.userData.uid !== undefined) { const u = E.unid.get(h.object.userData.uid); if (u) return { c: u.c, r: u.r }; }
    }
    return null;
  }
  function tocarEm(x, y) { const h = hexEm(x, y); if (h) E.onHex(h.c, h.r); }

  /** Posição na tela (em pixels da página) do centro de um hexágono. */
  function telaDe(c, r) {
    if (!E) return null;
    const t = E.tiles.get(chave(c, r)), p = pos3d(c, r);
    const v = new THREE.Vector3(p.x, t ? t.topo : 0.3, p.z).project(E.camera);
    const rect = E.cv.getBoundingClientRect();
    return { x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (-v.y * 0.5 + 0.5) * rect.height };
  }

  /* ---------- Miniaturas ---------- */
  function criarUnid(chaveU, miniId, corBase, opc) {
    const grupo = new THREE.Group();
    const esc = opc.chefe ? 1.28 : 1;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62 * esc, 0.68 * esc, 0.14, 24), mat(new THREE.Color(corBase).getHex()));
    base.position.y = 0.07; grupo.add(base);
    const aro = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * esc, 0.5 * esc, 0.16, 24), mat(0x15121c));
    aro.position.y = 0.075; grupo.add(aro);
    const musgo = new THREE.Mesh(new THREE.CylinderGeometry(0.48 * esc, 0.48 * esc, 0.17, 24), mat(opc.estrutura ? 0x5a5a66 : 0x3a3a46));
    musgo.position.y = 0.08; grupo.add(musgo);
    const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.75 * esc, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.01; grupo.add(sombra);

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texMini(miniId), transparent: true, alphaTest: 0.08 }));
    sprite.center.set(0.5, 0.11);
    const alt = 1.7 * esc; sprite.scale.set(alt * 44 / 46, alt, 1); sprite.position.y = 0.15;
    sprite.userData.uid = chaveU;
    grupo.add(sprite);

    // barra de vida
    const mk = (cor, op) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: cor, transparent: true, opacity: op, depthTest: false })); s.renderOrder = 10; return s; };
    const fundoB = mk(0x000000, 0.75), frente = mk(opc.heroi ? 0x5fd068 : 0xe0575c, 1);
    const larg = 1.0 * Math.max(1, esc * 0.85);
    fundoB.scale.set(larg + 0.06, 0.15, 1); frente.scale.set(larg, 0.1, 1); frente.center.set(0, 0.5);
    const yBarra = alt + 0.28;
    fundoB.position.set(0, yBarra, 0); frente.position.set(-larg / 2, yBarra, 0.001);
    grupo.add(fundoB); grupo.add(frente);
    const status = new THREE.Group(); status.position.set(0, yBarra + 0.26, 0); grupo.add(status);

    E.cena.add(grupo);
    return { grupo, sprite, base, frente, larg, status, statusTxt: '', esc, alt, cor: corBase,
      x: 0, z: 0, de: null, para: null, t: 1, dur: 0.4, fase: Math.random() * 6.28, flash: 0, lunge: null, morrendo: 0, hpFrac: 1, heroi: !!opc.heroi, c: 0, r: 0 };
  }

  function moverUnid(u, c, r, imediato) {
    const p = pos3d(c, r), t = E.tiles.get(chave(c, r));
    u.c = c; u.r = r; u.y = t ? t.topo : 0.3;
    if (imediato || u.para === null) { u.x = p.x; u.z = p.z; u.para = p; u.de = p; u.t = 1; u.grupo.position.set(p.x, u.y, p.z); return; }
    if (Math.abs(u.para.x - p.x) < 0.01 && Math.abs(u.para.z - p.z) < 0.01) return;
    u.de = { x: u.x, z: u.z }; u.para = p; u.t = 0;
    const d = Math.hypot(p.x - u.x, p.z - u.z);
    u.dur = Math.min(0.9, 0.22 + d * 0.13);
  }

  function atualizarStatus(u, icones) {
    const txt = icones.join('');
    if (u.statusTxt === txt) return;
    u.statusTxt = txt;
    while (u.status.children.length) u.status.remove(u.status.children[0]);
    icones.forEach((ic, i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texEmoji(ic), transparent: true, depthTest: false }));
      s.scale.set(0.34, 0.34, 1); s.position.x = (i - (icones.length - 1) / 2) * 0.36; s.renderOrder = 11; u.status.add(s);
    });
  }

  /* ---------- Sincronizar com o estado do jogo ---------- */
  /** `ctx` = { alc, alvos, perigo } (conjuntos de "c,r") e `P` = o herói. Chamada depois de qualquer mudança. */
  function sincronizar(T, P, ctx = {}) {
    if (!E) return;
    E.T = T; E.ultimoSync = ctx;
    // realces dos hexágonos
    for (const [k, o] of E.ov) {
      const t = E.tiles.get(k);
      let m = null;
      if (ctx.alvos && ctx.alvos.has(k)) m = E.mats.alvo;
      else if (ctx.perigo && ctx.perigo.has(k)) m = E.mats.perigo;
      else if (ctx.alc && ctx.alc.has(k)) m = (T.porta && T.porta.aberta && k === chave(T.porta.c, T.porta.r)) ? E.mats.porta : E.mats.alc;
      else if (T.porta && T.porta.aberta && k === chave(T.porta.c, T.porta.r)) m = E.mats.porta;
      o.visible = !!m; if (m) o.material = m;
    }
    // porta
    if (E.porta && T.porta && E.porta.aberta !== T.porta.aberta) {
      E.porta.aberta = T.porta.aberta;
      E.porta.sprite.material.map = texSvg(`porta:${T.reinoId}:${T.porta.aberta ? 1 : 0}`, portaSvg(T.reinoId, T.porta.aberta), '-18 -26 36 44', 180, 220);
      E.porta.sprite.material.needsUpdate = true;
    }
    // baú
    if (E.bau && T.bau && E.bau.aberto !== T.bau.aberto) {
      E.bau.aberto = T.bau.aberto;
      E.bau.sprite.material.map = texSvg('bau:1', bauSvg(true), '-18 -22 36 38', 180, 190); E.bau.sprite.material.needsUpdate = true;
      E.bau.anel.visible = false;
    }
    // armadilhas
    for (const [k, a] of E.arm) if (!T.armadilhas.has(k)) { E.saindo.push({ obj: a, t: 0, tipo: 'arm' }); E.arm.delete(k); }
    for (const [k, a] of T.armadilhas) {
      if (E.arm.has(k)) continue;
      const [c, r] = k.split(',').map(Number), p = pos3d(c, r), t = E.tiles.get(k);
      const plano = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: texSvg('arm:' + a.tipo, ARM_SVG[a.tipo](), '-20 -16 40 34', 200, 170), transparent: true, depthWrite: false }));
      plano.rotation.x = -Math.PI / 2 + 0.0; plano.position.set(p.x, t.topo + 0.035, p.z); plano.renderOrder = 1;
      E.cena.add(plano); E.arm.set(k, plano);
    }
    // moedas
    for (const [k, m] of E.moedas) if (!T.moedas.has(k)) { E.saindo.push({ obj: m, t: 0, tipo: 'moeda' }); E.moedas.delete(k); }
    for (const [k] of T.moedas) {
      if (E.moedas.has(k)) continue;
      const [c, r] = k.split(',').map(Number), p = pos3d(c, r), t = E.tiles.get(k);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texSvg('moeda', moedaSvg(), '-14 -14 28 28', 128, 128), transparent: true, alphaTest: 0.08 }));
      sp.scale.set(0.62, 0.62, 1); sp.position.set(p.x, t.topo + 0.45, p.z); sp.userData.base = t.topo + 0.45; sp.userData.fase = Math.random() * 6;
      E.cena.add(sp); E.moedas.set(k, sp);
    }
    // unidades
    const heroiId = 'heroi';
    let uh = E.unid.get(heroiId);
    if (!uh) { uh = criarUnid(heroiId, P.classe, COR_HEROI, { heroi: true }); E.unid.set(heroiId, uh); moverUnid(uh, T.heroi.c, T.heroi.r, true); }
    else moverUnid(uh, T.heroi.c, T.heroi.r, false);
    const dh = derivados(P);
    uh.hpFrac = Math.max(0, P.hp / dh.hpMax);
    atualizarStatus(uh, [...(T.buff ? ['📣'] : []), ...(T.defendendo ? ['🛡️'] : []), ...T.efeitos.map(ef => (ef.tipo === 'gelo' ? '❄️' : '☠️'))]);
    for (const e of T.inim) {
      let u = E.unid.get(e.uid);
      if (!e.vivo) { if (u && !u.morrendo) u.morrendo = e.recuou ? 0.01 : 0.001; continue; }
      if (!u) {
        const cor = e.estrutura ? COR_ESTRUTURA : (E.cores.get(e.tipo) || CORES_BASE[0]);
        u = criarUnid(e.uid, e.id, cor, { chefe: e.chefe, estrutura: e.estrutura });
        E.unid.set(e.uid, u); moverUnid(u, e.c, e.r, true);
      } else moverUnid(u, e.c, e.r, false);
      u.hpFrac = Math.max(0, e.hp / e.hpMax);
      atualizarStatus(u, [...e.efeitos.map(ef => (ef.tipo === 'gelo' ? '❄️' : '☠️')), ...(e.bonusAtq > 0 ? ['💪'] : []), ...(e.escudo > 0 ? ['🛡️'] : [])]);
    }
  }

  /* ---------- Efeitos: números flutuantes, golpes, brilhos ---------- */
  function fx(lista) {
    if (!E) return;
    for (const f of lista) {
      const u = E.unid.get(f.alvo);
      if (!u) continue;
      const v = new THREE.Vector3(u.grupo.position.x, u.y + u.alt * 0.85, u.grupo.position.z).project(E.camera);
      const el = document.createElement('div');
      el.className = 'fx3d-num' + (f.cura ? ' cura' : '') + (f.crit ? ' crit' : '') + (f.forte ? ' forte' : '') + (f.esquiva ? ' esq' : '');
      el.textContent = f.esquiva ? 'Esquivou!' : (f.texto || ((f.cura ? '+' : '-') + f.v));
      el.style.left = ((v.x * 0.5 + 0.5) * 100) + '%'; el.style.top = ((-v.y * 0.5 + 0.5) * 100) + '%';
      E.fxCamada.appendChild(el); setTimeout(() => el.remove(), 1100);
      if (!f.cura && !f.esquiva) u.flash = 0.35;
      else if (f.cura) u.brilho = 0.5;
    }
  }
  /** Faz a miniatura "investir" em direção a outra posição (animação de ataque). */
  function investir(id, c, r) {
    if (!E) return;
    const u = E.unid.get(id); if (!u) return;
    const p = pos3d(c, r), dx = p.x - u.x, dz = p.z - u.z, n = Math.hypot(dx, dz) || 1;
    u.lunge = { dx: dx / n, dz: dz / n, t: 0 };
  }

  /* ---------- Quadro a quadro ---------- */
  function quadro() {
    if (!E) return;
    if (!E.cont.isConnected) { destruir(); return; }
    const dt = Math.min(0.05, E.relogio.getDelta());
    E.tempo += dt; E.quadros++;
    suavizarCamera(dt);

    for (const [id, u] of E.unid) {
      // andar (com pulinho)
      if (u.t < 1 && u.de) {
        u.t = Math.min(1, u.t + dt / u.dur);
        const e = u.t * u.t * (3 - 2 * u.t);
        u.x = u.de.x + (u.para.x - u.de.x) * e; u.z = u.de.z + (u.para.z - u.de.z) * e;
      }
      const hop = u.t < 1 ? Math.sin(u.t * Math.PI) * 0.35 : 0;
      let ox = 0, oz = 0;
      if (u.lunge) { u.lunge.t += dt / 0.32; const s = Math.sin(Math.min(1, u.lunge.t) * Math.PI) * 0.55; ox = u.lunge.dx * s; oz = u.lunge.dz * s; if (u.lunge.t >= 1) u.lunge = null; }
      u.grupo.position.set(u.x + ox, u.y + hop, u.z + oz);
      // respirar
      const resp = 1 + Math.sin(E.tempo * 2.2 + u.fase) * 0.025;
      u.sprite.scale.y = u.alt * resp; u.sprite.scale.x = (u.alt * 44 / 46) * (2 - resp);
      // piscar de dano / brilho de cura
      if (u.flash > 0) { u.flash -= dt; u.sprite.material.color.setRGB(1, 0.35 + 0.65 * (1 - u.flash / 0.35), 0.35 + 0.65 * (1 - u.flash / 0.35)); if (u.flash <= 0) u.sprite.material.color.setRGB(1, 1, 1); }
      if (u.brilho > 0) { u.brilho -= dt; u.sprite.material.color.setRGB(0.6 + 0.4 * (1 - u.brilho / 0.5), 1, 0.6 + 0.4 * (1 - u.brilho / 0.5)); if (u.brilho <= 0) u.sprite.material.color.setRGB(1, 1, 1); }
      // vida
      const alvoF = u.hpFrac, atual = u.frente.scale.x / u.larg;
      u.frente.scale.x = Math.max(0.0001, (atual + (alvoF - atual) * Math.min(1, dt * 8))) * u.larg;
      // morte: cai e some
      if (u.morrendo) {
        u.morrendo += dt;
        const k = Math.min(1, u.morrendo / 0.7);
        u.sprite.material.opacity = 1 - k; u.sprite.position.y = 0.15 - k * 0.3; u.grupo.scale.setScalar(1 - k * 0.25);
        u.frente.visible = false; u.status.visible = false;
        if (k >= 1) { E.cena.remove(u.grupo); E.unid.delete(id); }
      }
    }
    // armadilhas pulsam, moedas giram, lava brilha
    for (const [, a] of E.arm) { const s = 1 + Math.sin(E.tempo * 3) * 0.04; a.scale.set(s, s, 1); a.material.opacity = 0.85 + Math.sin(E.tempo * 3) * 0.15; }
    for (const [, m] of E.moedas) { m.position.y = m.userData.base + Math.sin(E.tempo * 2.4 + m.userData.fase) * 0.08; m.scale.x = 0.62 * Math.max(0.25, Math.abs(Math.cos(E.tempo * 2 + m.userData.fase))); }
    if (E.liqMat && E.T && E.T.liquido === 'lava') E.liqMat.emissive.setRGB(0.3 + Math.sin(E.tempo * 2) * 0.1, 0.12, 0.03);
    E.mats.alvo.opacity = 0.5 + Math.sin(E.tempo * 6) * 0.14;
    if (E.mats.porta) E.mats.porta.opacity = 0.5 + Math.sin(E.tempo * 4) * 0.15;
    if (E.bau && !E.bau.aberto) { E.bau.sprite.position.y += (Math.sin(E.tempo * 2) * 0.0015); E.bau.anel.rotation.z += dt * 0.6; }
    for (let i = E.saindo.length - 1; i >= 0; i--) {
      const s = E.saindo[i]; s.t += dt / 0.35;
      const k = Math.min(1, s.t);
      if (s.tipo === 'arm') { s.obj.material.opacity = 1 - k; s.obj.scale.set(1 + k * 0.6, 1 + k * 0.6, 1); }
      else { s.obj.position.y += dt * 2; s.obj.material.opacity = 1 - k; }
      if (k >= 1) { E.cena.remove(s.obj); E.saindo.splice(i, 1); }
    }
    E.renderer.render(E.cena, E.camera);
  }

  /* ---------- Fim ---------- */
  function destruir() {
    if (!E) return;
    const e = E; E = null;
    try { e.renderer.setAnimationLoop(null); } catch (x) { /* ok */ }
    if (e.ro) e.ro.disconnect();
    try { e.renderer.dispose(); if (e.renderer.forceContextLoss) e.renderer.forceContextLoss(); } catch (x) { /* ok */ }
    if (e.cv && e.cv.parentNode) e.cv.parentNode.removeChild(e.cv);
    if (e.fxCamada && e.fxCamada.parentNode) e.fxCamada.parentNode.removeChild(e.fxCamada);
  }

  return {
    montar, sincronizar, fx, investir, centralizar, garantirVisivel, destruir, telaDe, hexEm,
    zoom: f => { if (E) zoomPor(f); },
    girar: graus => { if (E) E.cam.alvoYaw += (graus * Math.PI) / 180; },
    corDoTipo: tipo => (E && E.cores.get(tipo)) || '#888',
    ativa: () => !!E,
    estado: () => (E ? { quadros: E.quadros, tiles: E.tiles.size, unidades: E.unid.size, armadilhas: E.arm.size, moedas: E.moedas.size, dist: E.cam.dist, yaw: E.cam.yaw } : null),
  };
})();
