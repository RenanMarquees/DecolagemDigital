'use strict';
/* Modelos 3D — estruturas (as 5 que o jogador precisa destruir). Cada modelo é registrado com
   Modelos3D.registrar({ id: (B, R) => ({ altura, p, estrutura: true, anim }) }).
   Veja as ferramentas no começo de js/modelos3d.js. As peças auxiliares (cristais facetados, rochas lascadas, runas)
   ficam dentro deste arquivo, em funções locais. */
(() => {
  const PI = Math.PI, K = Modelos3D.kit;

  /* ---------- Ajudantes locais ---------- */
  /** gerador de números aleatórios com semente (o modelo sai sempre igual) */
  const rng = semente => { let s = semente | 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const lerp = (a, b, t) => a + (b - a) * t;
  /** contorno escuro de miniatura (cópia um pouco maior, vista por dentro) */
  function contorno(geo, esp = 0.02) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
    const k = e => Math.min(1.7, 1 + esp / Math.max(0.0001, e / 2));
    const g = geo.clone(); g.translate(-c.x, -c.y, -c.z); g.scale(k(s.x), k(s.y), k(s.z)); g.translate(c.x, c.y, c.z);
    return g;
  }
  /** coloca uma geometria própria no modelo (com material do construtor e contorno) */
  function malha(B, pai, geo, cor, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(geo, B.mat(cor, o));
    m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    if (o.sx || o.sy || o.sz) m.scale.set(o.sx || 1, o.sy || 1, o.sz || 1);
    if (o.linha !== false && !o.op) { const l = new THREE.Mesh(contorno(geo, o.esp), B.linhaMat); l.userData.contorno = true; m.add(l); }
    pai.add(m);
    return m;
  }
  /** monta uma geometria "sem índice" com normais chatas (facetas) a partir de uma lista de triângulos [[x,y,z]×3] */
  function facetas(tris, ref, e = 1) {
    const pos = [], nor = [], uv = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < tris.length; i += 3) {
      let [p, q, r] = [tris[i], tris[i + 1], tris[i + 2]];
      a.set(...p); b.set(...q); c.set(...r);
      n.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
      const cx = (p[0] + q[0] + r[0]) / 3 - ref[0], cy = (p[1] + q[1] + r[1]) / 3 - ref[1], cz = (p[2] + q[2] + r[2]) / 3 - ref[2];
      if (n.x * cx + n.y * cy + n.z * cz < 0) { [q, r] = [r, q]; n.negate(); }
      for (const v of [p, q, r]) { pos.push(v[0], v[1], v[2]); nor.push(n.x, n.y, n.z); uv.push((v[0] * 1.6 + v[2] * 1.1) * e, (v[1] * 1.8 + v[2] * 0.7) * e); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }
  /** cristal facetado e irregular: prisma torto com ponta. r = raio, h = altura. o: n (lados), ponta (fração da ponta), afina, seed, dupla (ponta também embaixo) */
  function geoCristal(r, h, o = {}) {
    const n = o.n || 6, s = rng(o.seed || 1), ponta = o.ponta ?? 0.3, afina = o.afina ?? 0.88, sk = o.skew ?? 0.15;
    const skx = (s() - 0.5) * 2 * sk * r, skz = (s() - 0.5) * 2 * sk * r, yo = h * (1 - ponta);
    const base = [], ombro = [];
    for (let i = 0; i < n; i++) {
      const a = (i + (s() - 0.5) * 0.55) / n * PI * 2, rr = r * (0.8 + s() * 0.4), rs = rr * afina * (0.9 + s() * 0.2);
      base.push([Math.cos(a) * rr, 0, Math.sin(a) * rr]);
      ombro.push([Math.cos(a) * rs + skx, yo * (0.88 + s() * 0.22), Math.sin(a) * rs + skz]);
    }
    const apice = [skx * 2.4 + (s() - 0.5) * r * 0.4, h, skz * 2.4 + (s() - 0.5) * r * 0.4], T = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      T.push(base[i], base[j], ombro[j], base[i], ombro[j], ombro[i], ombro[i], ombro[j], apice);
      if (o.dupla) T.push(base[j], base[i], [0, -h * o.dupla, 0]);
      else if (o.tapa) T.push(base[j], base[i], [0, 0, 0]);
    }
    return facetas(T, [0, o.dupla ? 0 : h * 0.3, 0], o.uv ?? 0.45);
  }
  /** rocha lascada (icosaedro amassado, com facetas e fundo achatado). o: det, amp, seed, chao (fração do fundo cortado) */
  function geoRocha(r, o = {}) {
    const g = new THREE.IcosahedronGeometry(r, o.det ?? 1), p = g.attributes.position, v = new THREE.Vector3(), amp = o.amp ?? 0.25, f = o.freq ?? 1.6, sd = o.seed || 1;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); const n = v.clone().normalize();
      const d = 1 + (K.rn3(n.x * f + 7, n.y * f + 7, n.z * f + 7, sd) - 0.5) * 2 * amp + (K.hash2(Math.round(n.x * 997 + n.z * 31), Math.round(n.y * 991), sd) - 0.5) * amp * 0.9;
      v.multiplyScalar(d);
      if (o.chao !== undefined && v.y < -r * o.chao) v.y = -r * o.chao;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }
  /** bloco de pedra lavrada (caixa de quinas arredondadas e levemente torta): barato e sem cara de "tijolo perfeito" */
  function geoBloco(w, h, d, b = 0.025, seed = 1) {
    const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2), p = g.attributes.position, v = new THREE.Vector3(), q = new THREE.Vector3();
    const ix = Math.max(0.001, w / 2 - b), iy = Math.max(0.001, h / 2 - b), iz = Math.max(0.001, d / 2 - b);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      q.set(Math.max(-ix, Math.min(ix, v.x)), Math.max(-iy, Math.min(iy, v.y)), Math.max(-iz, Math.min(iz, v.z)));
      v.sub(q); if (v.lengthSq() > 0) v.normalize().multiplyScalar(b); v.add(q);
      const j = (K.rn3(v.x * 9 + 3, v.y * 9 + 3, v.z * 9 + 3, seed) - 0.5) * b * 1.1;
      p.setXYZ(i, v.x + j, v.y + j * 0.7, v.z + j);
    }
    g.computeVertexNormals();
    return g;
  }
  const bloco = (B, pai, w, h, d, cor, x, y, z, o = {}) => malha(B, pai, geoBloco(w, h, d, o.b ?? 0.025, o.seed || 1), cor, x, y, z, { tex: 'pedra', rep: 1, ...o });
  const rocha = (B, pai, r, cor, x, y, z, o = {}) => malha(B, pai, geoRocha(r, o), cor, x, y, z, { tex: 'pedra', rep: 1, relevo: 0.04, ...o });
  /** cristal pronto: base em (x,y,z), inclinado `t` rad para a direção `a` (rad, 0 = +Z) */
  function cristal(B, pai, x, y, z, r, h, cor, a = 0, t = 0, o = {}) {
    return malha(B, pai, geoCristal(r, h, o), cor, x, y, z, { rx: Math.cos(a) * t, rz: -Math.sin(a) * t, tex: 'cristal', rough: 0.2, relevo: 0.02, ...o });
  }

  /* ---------- Runas e glifos (traços finos que brilham) ---------- */
  // cada glifo = lista de traços [x1, y1, x2, y2] numa caixa de 0.7 de largura por 2 de altura
  const RUNAS = {
    f: [[0, 0, 0, 2], [0, 1.4, 0.7, 2], [0, 0.8, 0.7, 1.4]],
    u: [[0, 0, 0, 2], [0, 2, 0.7, 1.5], [0.7, 1.5, 0.7, 0]],
    th: [[0, 0, 0, 2], [0, 1.5, 0.7, 1.0], [0.7, 1.0, 0, 0.5]],
    a: [[0, 0, 0, 2], [0, 2, 0.7, 1.5], [0, 1.4, 0.7, 0.9]],
    r: [[0, 0, 0, 2], [0, 2, 0.7, 1.5], [0.7, 1.5, 0, 1.0], [0, 1.0, 0.7, 0]],
    k: [[0.7, 1.8, 0, 1.0], [0, 1.0, 0.7, 0.2]],
    g: [[0, 0, 0.8, 2], [0, 2, 0.8, 0]],
    h: [[0, 0, 0, 2], [0.7, 0, 0.7, 2], [0, 0.7, 0.7, 1.3]],
    n: [[0.35, 0, 0.35, 2], [0, 1.4, 0.7, 0.8]],
    i: [[0.35, 0, 0.35, 2]],
    z: [[0.35, 0, 0.35, 2], [0.35, 1, 0, 2], [0.35, 1, 0.7, 2]],
    s: [[0.5, 2, 0, 1.3], [0, 1.3, 0.7, 0.7], [0.7, 0.7, 0.2, 0]],
    t: [[0.35, 0, 0.35, 2], [0.35, 2, 0, 1.4], [0.35, 2, 0.7, 1.4]],
    b: [[0, 0, 0, 2], [0, 2, 0.65, 1.5], [0.65, 1.5, 0, 1.0], [0, 1.0, 0.65, 0.5], [0.65, 0.5, 0, 0]],
    e: [[0, 0, 0, 2], [0.7, 0, 0.7, 2], [0, 2, 0.35, 1.4], [0.35, 1.4, 0.7, 2]],
    l: [[0, 0, 0, 2], [0, 2, 0.6, 1.5]],
    d: [[0, 0, 0, 2], [0.8, 0, 0.8, 2], [0, 2, 0.8, 0], [0, 0, 0.8, 2]],
    o: [[0.35, 2, 0, 1.4], [0.35, 2, 0.7, 1.4], [0, 1.4, 0.7, 0], [0.7, 1.4, 0, 0]],
  };
  /** desenha glifos (traços finos de caixa) dentro do grupo `g`, olhando para +Z. glifos = lista de listas de traços; devolve o 1º traço (para animar o material) */
  function trace(B, g, glifos, esc, cor, ox, oy, oz, o = {}) {
    const th = o.esp ?? Math.max(0.011, esc * 0.2), dep = o.prof ?? 0.014;
    let primeiro = null;
    for (const segs of glifos) for (const [x1, y1, x2, y2] of segs) {
      const dx = (x2 - x1) * esc, dy = (y2 - y1) * esc, L = Math.hypot(dx, dy) + th * 0.8;
      const m = B.cx(g, L, th, dep, cor, ox + (x1 + x2) / 2 * esc, oy + (y1 + y2) / 2 * esc, oz, { rz: Math.atan2(dy, dx), emissive: cor, brilho: o.brilho ?? 1.2, linha: false, rough: 0.3 });
      primeiro = primeiro || m;
    }
    return primeiro;
  }
  /** fileira de runas: letras = ['f','u',...]; vert = empilhadas */
  function runas(B, g, letras, esc, cor, ox, oy, oz, o = {}) {
    let primeiro = null;
    const passo = esc * (o.vert ? 2.6 : 1.3);
    letras.forEach((l, i) => {
      const t = i - (letras.length - 1) / 2, m = trace(B, g, [RUNAS[l]], esc, cor, o.vert ? ox - 0.35 * esc : ox + t * passo - 0.35 * esc, o.vert ? oy - t * passo - esc : oy - esc, oz, o);
      primeiro = primeiro || m;
    });
    return primeiro;
  }

  /* ===== Valhala: torre de cristais de gelo sobre rocha rachada ===== */
  Modelos3D.registrar({
    torre_gelo(B, R) {
      const s = rng(11), NEVE = 0xeef7ff, OSSO = 0xe2dcc4, RUNA = 0x3fd0ff;
      const neve = (x, y, z, r, o = {}) => rocha(B, R, r, NEVE, x, y, z, { sy: 0.38, amp: 0.2, seed: 5 + (Math.abs((x * 91) | 0) % 7), tex: 'pele', rep: 2, rough: 0.85, chao: 0.5, ...o });
      // --- base de rocha rachada coberta de neve ---
      rocha(B, R, 0.56, 0x39435e, 0, 0.1, 0, { sy: 0.4, amp: 0.24, seed: 3, det: 2, rep: 2, chao: 0.35 });
      rocha(B, R, 0.36, 0x465169, 0, 0.3, 0, { sy: 0.8, amp: 0.3, seed: 8, det: 2, rep: 2 });
      neve(0.04, 0.5, 0.02, 0.27, { sy: 0.45, det: 2 });
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * PI * 2 + (s() - 0.5) * 0.4, d = 0.38 + s() * 0.14, r = 0.09 + s() * 0.1, x = Math.sin(a) * d, z = Math.cos(a) * d;
        rocha(B, R, r, [0x3a4358, 0x4c566e, 0x333c52][i % 3], x, r * 0.45, z, { sy: 0.8, amp: 0.3, seed: 20 + i, det: 1, chao: 0.4 });
        if (i % 2 === 0) neve(x, r * 0.95, z, r * 0.85, { sy: 0.5 });
      }
      // rachaduras com luz azul saindo das rochas
      [[0.3, 0.12, 0.34, 0.5, 0.26, 0.2], [-0.32, 0.14, 0.3, -0.18, 0.27, 0.12], [-0.12, 0.13, -0.4, 0.02, 0.28, -0.22]].forEach(c => {
        const [x1, y1, z1, x2, y2, z2] = c;
        B.tubo(R, [[x1, y1, z1], [(x1 + x2) / 2 + 0.03, (y1 + y2) / 2 + 0.01, (z1 + z2) / 2 - 0.02], [x2, y2, z2]], [0.012, 0.009, 0.004], 0x8fe8ff, { emissive: 0x6ad0ff, brilho: 1.4, seg: 6, rad: 4, linha: false, pontas: false });
      });
      // --- aglomerado de cristais ---
      const AZ = [0xbfeaff, 0x78c8f6, 0x4a9aea, 0xe4f6ff, 0x9fdcff];
      const gl = { emissive: 0x2f93e0, brilho: 0.5, op: 0.92 };
      cristal(B, R, 0, 0.4, 0, 0.17, 1.62, 0xa8e4ff, 0, 0.04, { seed: 4, ponta: 0.34, ...gl, op: 0.78 });
      cristal(B, R, -0.14, 0.38, 0.04, 0.12, 1.15, 0x78c8f6, -1.5, 0.3, { seed: 7, ...gl });
      cristal(B, R, 0.13, 0.38, -0.02, 0.11, 1.0, 0xcfeeff, 1.6, 0.28, { seed: 9, ...gl });
      cristal(B, R, 0.02, 0.38, 0.15, 0.1, 0.8, 0x4a9aea, 0, 0.36, { seed: 12, ...gl });
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * PI * 2 + s() * 0.4, d = 0.14 + s() * 0.08, h = 0.4 + s() * 0.35;
        cristal(B, R, Math.sin(a) * d, 0.38, Math.cos(a) * d, 0.055 + s() * 0.035, h, AZ[i % 5], a, 0.4 + s() * 0.4, { seed: 30 + i, ...gl });
      }
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * PI * 2 + s() * 0.5, d = 0.33 + s() * 0.14, h = 0.16 + s() * 0.16;
        cristal(B, R, Math.sin(a) * d, 0.12, Math.cos(a) * d, 0.035 + s() * 0.025, h, AZ[(i + 2) % 5], a, 0.5 + s() * 0.5, { seed: 50 + i, ...gl });
      }
      // gelo escorrido com pingentes (estalactites)
      rocha(B, R, 0.31, 0xcdeeff, 0, 0.6, 0, { sy: 0.3, amp: 0.28, seed: 15, det: 2, tex: 'cristal', rough: 0.25, emissive: 0x2f93e0, brilho: 0.3, op: 0.94, chao: 0.6 });
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * PI * 2 + s() * 0.25, d = 0.22 + s() * 0.1, h = 0.08 + s() * 0.2;
        cristal(B, R, Math.sin(a) * d, 0.57 - h, Math.cos(a) * d, 0.018 + s() * 0.014, h, 0xe4f6ff, 0, 0, { seed: 70 + i, n: 5, ponta: 0.85, rx: PI, emissive: 0x2f93e0, brilho: 0.4 });
      }
      // poças de gelo liso entre as rochas
      [[0.3, 0.28, 0.2], [-0.28, 0.3, 0.17], [0.08, -0.36, 0.17]].forEach(([x, z, r]) => rocha(B, R, r, 0xa8dcf5, x, 0.17, z, { sy: 0.1, amp: 0.15, seed: 9, det: 1, tex: 'cristal', rough: 0.15, op: 0.7, emissive: 0x2f93e0, brilho: 0.3, chao: 0 }));
      // --- pedras rúnicas ao redor ---
      const pedras = [];
      [[0.55, 0.52, 0.2], [2.0, 0.5, -0.12], [3.55, 0.5, 0.15], [5.1, 0.5, -0.18]].forEach(([a, d, tl], i) => {
        const x = Math.sin(a) * d, z = Math.cos(a) * d, g = B.grupo(R, x, 0.2, z); g.rotation.y = a; g.rotation.x = tl * 0.6; g.rotation.z = tl * 0.5;
        B.placa(g, 0.2, 0.4, 0.07, 0x4d5772, 0, 0.18, 0, { tex: 'pedra', rep: 1, raio: 0.06, bisel: 0.018 });
        B.esf(g, 0.05, NEVE, 0.03, 0.4, 0, { sy: 0.45, sx: 1.6, tex: 'pele', linha: false, seg: 8 });
        pedras.push(runas(B, g, [['th', 'r'], ['s', 'u'], ['t', 'k'], ['o', 'f']][i], 0.05, RUNA, 0, 0.2, 0.062, { vert: true }));
      });
      // --- ossos e armas congelados ---
      // caveira presa no gelo (frente)
      const cv = B.grupo(R, 0.18, 0.22, 0.5); cv.rotation.set(-0.15, -0.3, 0.1);
      B.blob(cv, 0.1, OSSO, 0, 0.02, 0, { tex: 'osso', amp: 0.06, sy: 0.92, seed: 4, seg: 12 });
      B.cx(cv, 0.1, 0.05, 0.07, OSSO, 0, -0.07, 0.04, { tex: 'osso', linha: false });
      B.esf(cv, 0.026, 0x0a0c12, -0.04, 0.02, 0.085, { linha: false, seg: 6 }); B.esf(cv, 0.026, 0x0a0c12, 0.04, 0.02, 0.085, { linha: false, seg: 6 });
      B.dentes(cv, 6, 0.07, 0.022, 0xf2eedc, 0, -0.085, 0.075, { rx: PI * 0.0 });
      B.blob(cv, 0.15, 0xbfe8ff, 0, -0.01, 0, { op: 0.4, amp: 0.18, seed: 2, emissive: 0x3a90d0, brilho: 0.3, seg: 10 });
      // espada cravada no gelo
      const es = B.grupo(R, -0.4, 0.2, 0.34); es.rotation.set(-0.15, 0.7, 0.42);
      B.cx(es, 0.055, 0.62, 0.012, 0xc9d6e6, 0, 0.4, 0, { metal: 0.6, rough: 0.3 });
      B.cone(es, 0.0275, 0.1, 0xc9d6e6, 0, 0.76, 0, { seg: 4, sz: 0.25, metal: 0.55, rough: 0.3 });
      B.cx(es, 0.2, 0.035, 0.04, 0x8a6a34, 0, 0.09, 0, { metal: 0.4 });
      B.cil(es, 0.017, 0.017, 0.12, 0x4a2a14, 0, 0.0, 0, { tex: 'couro', seg: 6, linha: false });
      B.esf(es, 0.028, 0x8a6a34, 0, -0.07, 0, { metal: 0.4, linha: false, seg: 8 });
      B.cx(es, 0.3, 0.14, 0.07, NEVE, 0, 0.1, 0, { linha: false, sy: 0.3, tex: 'pele' });
      // machado de guerra
      const ma = B.grupo(R, 0.46, 0.18, 0.18); ma.rotation.set(0.1, 0.3, -0.5);
      B.cil(ma, 0.016, 0.02, 0.6, 0x6a4a2a, 0, 0.3, 0, { tex: 'couro', seg: 6 });
      B.cx(ma, 0.2, 0.17, 0.025, 0x9aa4b6, 0.1, 0.52, 0, { metal: 0.6, rough: 0.3 });
      B.cone(ma, 0.04, 0.07, 0x9aa4b6, 0, 0.64, 0, { seg: 4, metal: 0.5, linha: false });
      // costelas que saem da neve
      for (let i = 0; i < 4; i++) {
        const x = -0.26 - i * 0.045, z = -0.34 + i * 0.07;
        B.tubo(R, [[x, 0.1, z], [x - 0.08, 0.28 + (i % 2) * 0.03, z - 0.03], [x - 0.04, 0.4 - i * 0.02, z - 0.07], [x + 0.05, 0.38 - i * 0.03, z - 0.08]], [0.016, 0.014, 0.01, 0.005], OSSO, { tex: 'osso', seg: 8, rad: 5, linha: false });
      }
      // fêmur
      B.tubo(R, [[0.42, 0.12, -0.3], [0.5, 0.17, -0.2], [0.55, 0.2, -0.12]], [0.018, 0.016, 0.018], OSSO, { tex: 'osso', seg: 6, rad: 5, linha: false });
      B.esf(R, 0.03, OSSO, 0.42, 0.12, -0.3, { tex: 'osso', linha: false, seg: 6 });
      // --- fumaça fria ---
      const fumo = [];
      for (let i = 0; i < 6; i++) fumo.push(B.vivo(B.blob(R, 0.08 + (i % 3) * 0.02, 0xd6ecff, 0, 0.1, 0, { op: 0.17 + i * 0.002, amp: 0.35, seg: 9, linha: false, rough: 1, emissive: 0x6aa8d8, brilho: 0.35 })));
      // pontinhos de gelo flutuando
      const motes = [];
      for (let i = 0; i < 6; i++) motes.push(B.vivo(B.octa(R, 0.022 + (i % 2) * 0.008, 0xbfeaff, 0, 1, 0, { sy: 1.9, emissive: 0x9fe6ff, brilho: 1.2, linha: false })));
      const nucleo = B.vivo(B.esf(R, 0.1, 0xcff4ff, 0, 0.98, 0, { sy: 4, emissive: 0x9fe6ff, brilho: 1.6, linha: false, seg: 10 }));
      return {
        altura: 2.0, p: {}, estrutura: true,
        anim: t => {
          nucleo.scale.set(1 + Math.sin(t * 2) * 0.12, 4 + Math.sin(t * 2.6) * 0.5, 1 + Math.sin(t * 2) * 0.12);
          pedras.forEach(m => { m.material.emissiveIntensity = 1.0 + Math.sin(t * 2.2) * 0.45; });
          fumo.forEach((f, i) => {
            const u = (t * 0.1 + i / fumo.length) % 1, a = i * 2.4 + t * 0.15, d = 0.46 + u * 0.12;
            f.position.set(Math.sin(a) * d, 0.08 + u * 0.4, Math.cos(a) * d); f.scale.setScalar(Math.sin(u * PI) * (0.9 + u * 1.2) + 0.05);
          });
          motes.forEach((m, i) => { const a = t * (0.5 + i * 0.07) + i * 1.1; m.position.set(Math.sin(a) * (0.42 + (i % 3) * 0.06), 0.9 + (i % 4) * 0.28 + Math.sin(t * 1.5 + i) * 0.06, Math.cos(a) * (0.42 + (i % 3) * 0.06)); m.rotation.set(t, t * 1.3 + i, 0); });
        },
      };
    },
  });

  /* ===== Olimpo: altar de mármore corrompido, com chama sagrada violenta ===== */
  /** fuste de coluna com caneluras (estrias) */
  function fuste(rt, rb, h, seg = 24, flautas = 4) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg, 6), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
      if (r < 0.0001) continue;
      const k = 1 - 0.075 * Math.abs(Math.sin(Math.atan2(z, x) * flautas));
      p.setXYZ(i, x * k, p.getY(i), z * k);
    }
    g.computeVertexNormals();
    return g;
  }
  /** raio em zigue-zague entre dois pontos (tubo fino que brilha) */
  function raioEnergia(B, pai, a, b, s, grosso = 0.01, cor = 0xfff2b0, em = 0xffd84a) {
    const n = 6, pts = [a];
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz), j = d * 0.13;
    for (let i = 1; i < n; i++) { const t = i / n; pts.push([a[0] + dx * t + (s() - 0.5) * j, a[1] + dy * t + (s() - 0.5) * j, a[2] + dz * t + (s() - 0.5) * j]); }
    pts.push(b);
    return B.tubo(pai, pts, [grosso, grosso * 0.7, grosso * 0.9, grosso * 0.6, grosso * 0.8, grosso * 0.5, grosso * 0.3, grosso * 0.2].slice(0, 8), cor, { emissive: em, brilho: 1.7, seg: 12, rad: 4, linha: false, pontas: false });
  }
  /** pedaço de coluna: base, fuste canelado, anéis dourados, capitel com volutas. quebrada = altura em que o fuste parte */
  function coluna(B, pai, x, z, h, mar, ouro, o = {}) {
    const g = B.grupo(pai, x, 0.1, z); g.rotation.y = o.ry || 0; if (o.tomba) g.rotation.z = o.tomba;
    B.torno(g, [[0.001, 0], [0.13, 0], [0.135, 0.03], [0.115, 0.06], [0.1, 0.1], [0.001, 0.1]], mar, 0, 0, 0, { tex: 'musgo', rep: 2, relevo: 0.02, seg: 14 });
    malha(B, g, fuste(0.082, 0.098, h, 20, 4), mar, 0, 0.1 + h / 2, 0, { tex: 'musgo', rep: 2, relevo: 0.02 });
    B.tor(g, 0.1, 0.014, ouro, 0, 0.16, 0, { rx: PI / 2, metal: 0.7, rough: 0.35, seg: 12, linha: false });
    if (!o.quebrada) {
      const y = 0.1 + h;
      B.torno(g, [[0.085, y - 0.02], [0.095, y], [0.12, y + 0.03], [0.15, y + 0.07], [0.15, y + 0.1], [0.001, y + 0.1]], mar, 0, 0, 0, { tex: 'musgo', rep: 2, relevo: 0.02, seg: 14 });
      B.cx(g, 0.34, 0.035, 0.34, mar, 0, y + 0.115, 0, { tex: 'musgo', rep: 2, relevo: 0.02 });
      B.tor(g, 0.085, 0.018, mar, 0.1, y + 0.045, 0.0, { ry: PI / 2, tex: 'pedra', seg: 10, linha: false });
      B.tor(g, 0.085, 0.018, mar, -0.1, y + 0.045, 0.0, { ry: PI / 2, tex: 'pedra', seg: 10, linha: false });
      B.tor(g, 0.1, 0.014, ouro, 0, y - 0.01, 0, { rx: PI / 2, metal: 0.7, rough: 0.35, seg: 12, linha: false });
    } else {
      // topo partido: dentes de pedra
      rocha(B, g, 0.1, mar, 0, 0.1 + h, 0, { sy: 0.55, amp: 0.4, seed: 4 + ((x * 50) | 0), det: 1, tex: 'musgo', rep: 2, relevo: 0.02 });
      cristal(B, g, 0.02, 0.1 + h, 0.02, 0.05, 0.14, mar, 0.4, 0.2, { seed: 3, n: 5, ponta: 0.7, tex: 'musgo' });
    }
    return g;
  }

  Modelos3D.registrar({
    altar(B, R) {
      const s = rng(21), MAR = 0xe2d4b8, MAR2 = 0xcfc0a2, OURO = 0xe8b43a, OURO_L = 0xffc94a;
      // --- degraus rachados ---
      const t1 = B.placa(R, 1.0, 0.1, 1.0, MAR2, 0, 0.05, 0, { tex: 'musgo', rep: 3, relevo: 0.02, raio: 0.05, bisel: 0.02 });
      const t2 = B.placa(R, 0.76, 0.1, 0.76, MAR, 0, 0.15, 0, { tex: 'musgo', rep: 2, relevo: 0.02, raio: 0.04, bisel: 0.02, ry: 0.07 });
      const t3 = B.placa(R, 0.56, 0.1, 0.56, MAR, 0, 0.25, 0, { tex: 'musgo', rep: 2, relevo: 0.02, raio: 0.04, bisel: 0.02, ry: -0.05, rx: 0.02 });
      // escombros de mármore pelo chão
      for (let i = 0; i < 11; i++) {
        const a = i / 11 * PI * 2 + s() * 0.4, d = 0.46 + s() * 0.14, r = 0.035 + s() * 0.05;
        rocha(B, R, r, i % 3 ? MAR : MAR2, Math.sin(a) * d, r * 0.5 + 0.06, Math.cos(a) * d, { sy: 0.8, amp: 0.35, seed: 30 + i, det: 1, chao: 0.3 });
      }
      // pedestal do altar (com molduras)
      B.cx(R, 0.66, 0.07, 0.66, MAR2, 0, 0.335, 0, { tex: 'musgo', rep: 2, relevo: 0.02 });
      B.placa(R, 0.52, 0.46, 0.52, MAR, 0, 0.6, 0, { tex: 'musgo', rep: 2, relevo: 0.02, raio: 0.03, bisel: 0.015 });
      B.cx(R, 0.66, 0.06, 0.66, MAR2, 0, 0.865, 0, { tex: 'musgo', rep: 2, relevo: 0.02 });
      B.cx(R, 0.7, 0.03, 0.7, OURO, 0, 0.91, 0, { metal: 0.7, rough: 0.35 });
      // decoração dourada nas 4 faces: grega (meandro) e símbolos
      const GREGA = [[0, 0, 0, 1], [0, 1, 0.8, 1], [0.8, 1, 0.8, 0.3], [0.8, 0.3, 0.3, 0.3], [0.3, 0.3, 0.3, 0.7]];
      const RAIO = [[0.55, 2, 0, 1.05], [0, 1.05, 0.5, 1.05], [0.5, 1.05, 0.05, 0]];
      const SOL = [[0, 0.5, 1, 0.5], [0.5, 0, 0.5, 1], [0.15, 0.15, 0.85, 0.85], [0.15, 0.85, 0.85, 0.15]];
      const faces = [];
      for (let k = 0; k < 4; k++) {
        const g = B.grupo(R, 0, 0.6, 0); g.rotation.y = k * PI / 2;
        const z = 0.26 + 0.015 + 0.006;
        const meandro = []; for (let i = 0; i < 5; i++) meandro.push(GREGA.map(([a, b, c, d]) => [a + i, b, c + i, d]));
        faces.push(trace(B, g, meandro, 0.06, OURO_L, -0.15, -0.2, z, { brilho: 0.9, esp: 0.012 }));
        trace(B, g, [k % 2 ? SOL : RAIO], k % 2 ? 0.13 : 0.1, OURO_L, k % 2 ? -0.065 : -0.04, k % 2 ? -0.05 : -0.1, z, { brilho: 1.2, esp: 0.018 });
        B.tor(g, 0.1, 0.008, OURO_L, 0, 0.03, z, { emissive: OURO_L, brilho: 0.8, seg: 20, linha: false });
      }
      // rachaduras douradas brilhando
      const rach = (pts, r = 0.011) => B.tubo(R, pts, pts.map((_, i) => r * (1 - i / pts.length * 0.6)), OURO_L, { emissive: 0xffb830, brilho: 1.6, seg: pts.length * 3, rad: 4, linha: false, pontas: false });
      rach([[0.22, 0.83, 0.275], [0.17, 0.72, 0.282], [0.2, 0.6, 0.28], [0.12, 0.5, 0.282], [0.14, 0.4, 0.28]]);
      rach([[-0.27, 0.8, 0.12], [-0.282, 0.68, 0.06], [-0.28, 0.56, 0.1], [-0.282, 0.45, 0.0]]);
      rach([[0.3, 0.1, 0.3], [0.28, 0.1, 0.18], [0.34, 0.1, 0.05]], 0.01);
      rach([[-0.1, 0.2, 0.4], [-0.08, 0.2, 0.3], [-0.14, 0.2, 0.28]], 0.009);
      // --- colunas: 2 altas ao fundo (uma com o lintel quebrado), 1 coto na frente, 1 tombada ---
      const cE = coluna(B, R, -0.44, -0.32, 1.25, MAR, OURO, { ry: 0.3 });
      const cD = coluna(B, R, 0.42, -0.34, 0.62, MAR, OURO, { quebrada: true, ry: -0.2 });
      coluna(B, R, -0.45, 0.34, 0.3, MAR2, OURO, { quebrada: true, ry: 0.5 });
      // arquitrave quebrada que se apoia na coluna alta e tomba para o altar
      const lin = B.grupo(R, -0.34, 1.56, -0.32); lin.rotation.z = -0.32; lin.rotation.y = 0.15;
      B.placa(lin, 0.5, 0.1, 0.17, MAR, 0.16, 0, 0, { tex: 'musgo', rep: 2, relevo: 0.02, raio: 0.02, bisel: 0.015 });
      B.cx(lin, 0.5, 0.025, 0.19, OURO, 0.16, -0.065, 0, { metal: 0.6, rough: 0.4, linha: false });
      cristal(B, lin, 0.42, -0.06, 0, 0.08, 0.1, MAR, 1.4, 0.4, { seed: 8, n: 5, ponta: 0.8, tex: 'pedra', rx: -PI / 2 + 0.3 });
      // tambor de coluna caído e pedaço da arquitrave no chão
      malha(B, R, fuste(0.08, 0.09, 0.3, 16, 4), MAR, 0.3, 0.1 + 0.08, 0.44, { tex: 'musgo', rep: 2, relevo: 0.02, rz: PI / 2, ry: 0.4 });
      B.placa(R, 0.3, 0.09, 0.15, MAR2, -0.18, 0.13, 0.5, { tex: 'musgo', rep: 2, relevo: 0.02, ry: 0.5, rz: 0.1 });
      // --- busto quebrado num coto de coluna (frente, à direita) ---
      const bu = B.grupo(R, 0.34, 0.1, 0.36); bu.rotation.y = -0.5;
      B.cil(bu, 0.1, 0.12, 0.22, MAR2, 0, 0.11, 0, { tex: 'musgo', rep: 2, relevo: 0.02, seg: 10 });
      B.cx(bu, 0.25, 0.03, 0.25, MAR, 0, 0.235, 0, { tex: 'musgo', relevo: 0.02 });
      B.torno(bu, [[0.001, 0.25], [0.12, 0.25], [0.12, 0.3], [0.08, 0.36], [0.05, 0.4], [0.05, 0.43]], MAR, 0, 0, 0, { tex: 'musgo', rep: 2, relevo: 0.02, seg: 12 });
      B.blob(bu, 0.09, MAR, 0, 0.52, 0, { tex: 'musgo', rep: 2, relevo: 0.02, amp: 0.05, sy: 1.1, seed: 5, seg: 14 });
      B.cone(bu, 0.016, 0.045, MAR, 0, 0.51, 0.085, { rx: PI / 2 + 0.2, linha: false, seg: 6, tex: 'musgo' });
      [-1, 1].forEach(l => B.esf(bu, 0.014, OURO_L, l * 0.035, 0.545, 0.075, { emissive: OURO_L, brilho: 1.4, linha: false, seg: 6 }));
      B.cx(bu, 0.12, 0.018, 0.04, MAR2, 0, 0.575, 0.06, { linha: false, tex: 'musgo' });
      B.tor(bu, 0.088, 0.011, OURO, 0, 0.6, 0, { rx: PI / 2 - 0.15, metal: 0.7, rough: 0.35, seg: 14, linha: false });   // coroa de louros
      for (let i = 0; i < 6; i++) B.esf(bu, 0.03, MAR, Math.cos(i * 1.1) * 0.075, 0.5 + (i % 3) * 0.04, -0.045 - Math.sin(i * 1.1) * 0.03, { tex: 'musgo', linha: false, seg: 6 });
      B.cx(bu, 0.05, 0.12, 0.04, 0x0a0710, -0.03, 0.55, 0.08, { linha: false, rz: 0.3 });   // lasca que falta no rosto
      B.tubo(bu, [[-0.04, 0.6, 0.085], [-0.02, 0.55, 0.09], [-0.045, 0.5, 0.082], [-0.02, 0.45, 0.07]], [0.007, 0.007, 0.005, 0.003], OURO_L, { emissive: 0xffb830, brilho: 1.7, seg: 8, rad: 4, linha: false, pontas: false });
      // --- corrupção: cristais negro-violeta nascendo das rachaduras ---
      for (let i = 0; i < 9; i++) {
        const a = (i < 5 ? 0.5 + i * 0.55 : 3.5 + (i - 5) * 0.5), d = 0.48 + s() * 0.08;
        cristal(B, R, Math.sin(a) * d, 0.08, Math.cos(a) * d, 0.035 + s() * 0.03, 0.18 + s() * 0.3, i % 2 ? 0x2a1448 : 0x3a1c60, a, 0.45 + s() * 0.4, { seed: 60 + i, emissive: 0x7a2ad8, brilho: 0.7 });
      }
      // veias de corrupção subindo pelo altar
      [[0.26, 0.13, 0.38], [0.24, 0.3, 0.34], [0.14, 0.43, 0.3]].forEach((p, i, arr) => { if (i) B.tubo(R, [arr[i - 1], [(arr[i - 1][0] + p[0]) / 2 + 0.03, (arr[i - 1][1] + p[1]) / 2, 0.36], p], [0.014, 0.012, 0.008], 0x2a1448, { emissive: 0x7a2ad8, brilho: 0.8, seg: 6, rad: 5, linha: false, pontas: false }); });
      // --- brasseiro dourado e chama sagrada ---
      B.torno(R, [[0.001, 0.925], [0.1, 0.925], [0.13, 0.96], [0.11, 1.0], [0.19, 1.1], [0.23, 1.17], [0.21, 1.18], [0.17, 1.13], [0.001, 1.08]], OURO, 0, 0, 0, { metal: 0.75, rough: 0.3, seg: 18 });
      B.tor(R, 0.225, 0.012, OURO_L, 0, 1.175, 0, { rx: PI / 2, metal: 0.7, rough: 0.3, seg: 18, linha: false });
      for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3; B.cone(R, 0.025, 0.1, OURO, Math.sin(a) * 0.12, 1.0, Math.cos(a) * 0.12, { rz: Math.cos(a) * 0.35, rx: Math.sin(a) * 0.35, seg: 5, metal: 0.7, linha: false }); }
      B.cil(R, 0.18, 0.18, 0.02, 0xff6a10, 0, 1.15, 0, { emissive: 0xff7a1a, brilho: 1.4, seg: 14, linha: false });
      const FL = [[0.001, 0], [0.085, 0.05], [0.12, 0.17], [0.09, 0.34], [0.05, 0.52], [0.001, 0.7]];
      const chamas = [];
      const lingua = (x, z, esc, cor, em, op, fase) => { const m = B.vivo(B.torno(R, FL, cor, x, 1.16, z, { emissive: em, brilho: 1.5, op, linha: false, seg: 8 })); m.scale.setScalar(esc); m.userData.f = fase; m.userData.e = esc; m.userData.x = x; m.userData.z = z; chamas.push(m); return m; };
      lingua(0, 0, 1.25, 0xff7a10, 0xff8a10, 0.9, 0);
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; lingua(Math.sin(a) * 0.12, Math.cos(a) * 0.12, 0.7 + (i % 2) * 0.2, i % 2 ? 0xffb020 : 0xff7a10, i % 2 ? 0xffb020 : 0xff6a10, 0.88, i * 1.3); }
      lingua(0, 0, 0.85, 0xfff0b0, 0xffe9a0, 0.92, 2);
      const halo = B.vivo(B.esf(R, 0.01, 0xffd060, 0, 1.4, 0, { op: 0.06, linha: false, seg: 4 }));
      const faiscas = []; for (let i = 0; i < 9; i++) faiscas.push(B.vivo(B.octa(R, 0.014 + (i % 3) * 0.005, 0xffe9a0, 0, 1.4, 0, { emissive: 0xffd84a, brilho: 1.6, linha: false })));
      // --- raios de energia entre a chama e as colunas ---
      const nos = [[-0.42, 1.0 + 1.35, -0.36], [0.42, 1.0 + 0.0, -0.34]];
      const topoE = [-0.44, 0.1 + 1.25 + 0.28, -0.32], topoD = [0.42, 0.1 + 0.62 + 0.12, -0.34];
      const bolt = [];
      for (let i = 0; i < 3; i++) bolt.push(raioEnergia(B, R, [0, 1.35 + i * 0.1, 0], [topoE, topoD, [0.34, 0.65, 0.36]][i], s, 0.015));
      bolt.push(raioEnergia(B, R, [0, 1.5, 0], [-0.3, 1.55, -0.1], s, 0.009), raioEnergia(B, R, [0.05, 1.6, 0], [0.32, 1.35, 0.15], s, 0.009));
      const orbes = [topoE, topoD].map(p => B.vivo(B.esf(R, 0.04, 0xfff2b0, p[0], p[1], p[2], { emissive: 0xffd84a, brilho: 1.7, linha: false, seg: 8 })));
      return {
        altura: 1.95, p: {}, estrutura: true,
        anim: t => {
          chamas.forEach((c, i) => {
            const f = c.userData.f, e = c.userData.e, w = 1 + Math.sin(t * 9 + f) * 0.14 + Math.sin(t * 15.3 + f * 2) * 0.07;
            c.scale.set(e * w * 1.35, e * (1 + Math.sin(t * 7 + f * 1.7) * 0.2 + Math.sin(t * 12 + f) * 0.1), e * w * 1.35);
            c.rotation.z = Math.sin(t * 4 + f) * 0.14; c.rotation.x = Math.cos(t * 3.3 + f) * 0.14; c.rotation.y = t * (1.5 + f * 0.2);
          });
          halo.scale.setScalar(1 + Math.sin(t * 6) * 0.08); halo.material.emissiveIntensity = 0.55 + Math.sin(t * 5.3) * 0.2;
          faiscas.forEach((m, i) => { const u = (t * 0.45 + i / faiscas.length) % 1, a = i * 2.4 + t; m.position.set(Math.sin(a) * (0.1 + u * 0.3), 1.35 + u * 0.7, Math.cos(a) * (0.1 + u * 0.3)); m.scale.setScalar(1 - u); m.rotation.set(t * 3, t * 2, 0); });
          bolt.forEach((b, i) => { b.visible = Math.sin(t * (11 + i * 2.7) + i * 5) + Math.sin(t * 6.1 + i * 2) > 0.9; });
          orbes.forEach((o, i) => o.scale.setScalar(1 + Math.sin(t * 7 + i * 3) * 0.3));
          faces.forEach(m => { m.material.emissiveIntensity = 0.8 + Math.sin(t * 4) * 0.3; });
        },
      };
    },
  });

  /* ===== Inferno: portal demoníaco de pedra negra, com vórtice de fogo ===== */
  /** fita em espiral (braço do vórtice), no plano XY, afunilando para dentro (z) */
  function geoEspiral(r0, r1, giros, l0, l1, fundo, seg = 26) {
    const pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, r = lerp(r0, r1, t), a = t * giros * PI * 2, w = lerp(l0, l1, t) / 2, z = -fundo * (1 - t), c = Math.cos(a), s = Math.sin(a);
      pos.push(c * (r - w), s * (r - w), z, c * (r + w), s * (r + w), z); nor.push(0, 0, 1, 0, 0, 1); uv.push(t, 0, t, 1);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }
  /** corrente: elos de argola alternados ao longo de uma curva (pontos [x,y,z]); os elos são peças soltas e se fundem */
  function corrente(B, pai, pontos, n, cor, r = 0.02) {
    const c = new THREE.CatmullRomCurve3(pontos.map(p => new THREE.Vector3(...p))), UP = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, P = c.getPointAt(t), T = c.getTangentAt(t);
      const m = B.tor(pai, r, r * 0.3, cor, P.x, P.y, P.z, { sy: 1.45, seg: 6, metal: 0.6, rough: 0.45, linha: false });
      m.quaternion.setFromUnitVectors(UP, T).multiply(new THREE.Quaternion().setFromAxisAngle(UP, (i % 2) * PI / 2));
    }
  }
  /** caveira de miniatura (osso, órbitas fundas, nariz, dentes, mandíbula). brilho = cor dos olhos acesos (opcional) */
  function caveira(B, pai, x, y, z, r, ry, rx = 0, brilho) {
    const g = B.grupo(pai, x, y, z); g.rotation.set(rx, ry, 0);
    const OS = 0xe6dcc0;
    B.blob(g, r, OS, 0, 0, 0, { tex: 'osso', rep: 1, amp: 0.07, sy: 0.95, seed: 4, seg: 10 });
    B.cx(g, r * 1.05, r * 0.5, r * 0.8, OS, 0, -r * 0.62, r * 0.28, { tex: 'osso', linha: false });
    [-1, 1].forEach(l => {
      B.esf(g, r * 0.27, 0x0a0608, l * r * 0.38, r * 0.05, r * 0.78, { linha: false, seg: 6 });
      if (brilho) B.esf(g, r * 0.1, brilho, l * r * 0.38, r * 0.05, r * 0.92, { emissive: brilho, brilho: 1.4, linha: false, seg: 5 });
    });
    B.cone(g, r * 0.1, r * 0.22, 0x0a0608, 0, -r * 0.25, r * 0.92, { rx: PI / 2, linha: false, seg: 4 });
    B.dentes(g, 6, r * 0.7, r * 0.17, 0xf2ecd8, 0, -r * 0.5, r * 0.92, {});
    return g;
  }
  const PERFIL_CHAMA = [[0.001, 0], [0.085, 0.05], [0.12, 0.17], [0.09, 0.34], [0.05, 0.52], [0.001, 0.7]];

  Modelos3D.registrar({
    portal_fogo(B, R) {
      const s = rng(31), PRETO = 0x1f181a, PRETO2 = 0x2c2024, BRASA = 0xff6a10, CY = 0.86;
      // --- base: pedra negra rachada com rios de lava ---
      rocha(B, R, 0.56, 0x241a1c, 0, 0.08, 0, { sy: 0.38, amp: 0.25, seed: 5, det: 1, rep: 2, chao: 0.4 });
      [-1, 1].forEach((l, i) => {
        rocha(B, R, 0.16, PRETO, l * 0.36, 0.22, -0.02, { sy: 1.5, sx: 0.9, amp: 0.3, seed: 8 + i, det: 1, rep: 2 });
        rocha(B, R, 0.13, PRETO2, l * 0.4, 0.14, 0.14, { sy: 0.9, amp: 0.3, seed: 12 + i, det: 1, rep: 2 });
      });
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * PI * 2 + s() * 0.4, d = 0.42 + s() * 0.12, r = 0.05 + s() * 0.07;
        rocha(B, R, r, [PRETO, PRETO2][i % 2], Math.sin(a) * d, r * 0.45 + 0.04, Math.cos(a) * d, { sy: 0.8, amp: 0.3, seed: 20 + i, det: 1, chao: 0.4 });
      }
      // lava nas rachaduras do chão
      [[[0.0, 0.14, 0.2], [0.12, 0.14, 0.36], [0.05, 0.14, 0.5]], [[-0.15, 0.14, 0.22], [-0.3, 0.14, 0.3], [-0.4, 0.14, 0.2]], [[0.2, 0.14, 0.15], [0.36, 0.14, 0.25], [0.46, 0.14, 0.12]], [[0.1, 0.14, -0.3], [0.0, 0.14, -0.42], [-0.12, 0.14, -0.4]]].forEach(p =>
        B.tubo(R, p, [0.018, 0.022, 0.012], BRASA, { emissive: 0xff5a10, brilho: 1.5, seg: 8, rad: 5, linha: false, pontas: false }));
      // --- arco: anel de blocos de pedra negra com runas ---
      const N = 14, ABERTO = 1.0, A0 = -PI / 2 + ABERTO / 2, PASSO = (PI * 2 - ABERTO) / (N - 1), sigilos = [];
      for (let i = 0; i < N; i++) {
        const th = A0 + i * PASSO, rm = 0.46 + (i % 2) * 0.015, x = Math.cos(th) * rm, y = CY + Math.sin(th) * rm;
        const w = 0.19 + (i % 3) * 0.02, h = 0.11 + ((i * 7) % 3) * 0.025, d = 0.13 + ((i * 5) % 4) * 0.02;
        const rz = th - PI / 2 + (s() - 0.5) * 0.06, cz = Math.cos(rz), sz = Math.sin(rz);
        bloco(B, R, w, h, d, i % 2 ? PRETO : PRETO2, x, y, (s() - 0.5) * 0.03, { b: 0.03, seed: i + 1, rz });
        if (i % 3 === 1 && Math.abs(th - PI / 2) > 0.5) { const g = B.grupo(R, x, y, 0); g.rotation.z = rz; sigilos.push(trace(B, g, [RUNAS[['f', 'k', 'z', 'g', 'o'][i % 5]]], 0.045, 0xff7a20, -0.015, -0.045, d / 2 + 0.024, { brilho: 1.3 })); }
        if (i % 4 === 0) rocha(B, R, 0.045, PRETO2, x + (cz * 0.05 - sz * h * 0.5), y + (sz * 0.05 + cz * h * 0.5), 0.03, { sy: 0.7, amp: 0.4, seed: 40 + i, det: 1 });
      }
      // aro de lava no interior do arco
      B.tor(R, 0.39, 0.02, 0xff5a10, 0, CY, 0, { emissive: 0xff4a08, brilho: 1.3, seg: 28, arco: PI * 2 - ABERTO + 0.2, rz: A0 - 0.1, linha: false });
      // --- espinhos ao redor do arco ---
      for (let i = 0; i < 12; i++) {
        const th = A0 + 0.2 + i * (PI * 2 - ABERTO - 0.4) / 11, lado = Math.abs(Math.cos(th)), topo = Math.max(0, Math.sin(th)), L = 0.16 + topo * 0.14 + (i % 2) * 0.08;
        if (Math.abs(th - PI / 2) < 0.3) continue;
        const rr = 0.56;
        cristal(B, R, Math.cos(th) * rr, CY + Math.sin(th) * rr, (s() - 0.5) * 0.04, 0.045, L, i % 2 ? 0x15101a : 0x241a1c, 0, 0, { n: 4, ponta: 0.65, seed: 80 + i, tex: 'pedra', rz: th - PI / 2, rx: (s() - 0.5) * 0.3, emissive: 0x501008, brilho: 0.5 });
      }
      // --- chifres grandes saindo do topo ---
      [-1, 1].forEach((l, i) => {
        B.chifre(R, 0.7, 0.075, 0x2a1c1c, l * 0.2, CY + 0.5, -0.02, { curva: l * 0.75, rz: -l * 0.18, espiral: true, tex: 'couro', rep: 2, seg: 14, rad: 7 });
        B.chifre(R, 0.3, 0.045, 0x3a2420, l * 0.46, CY + 0.34, -0.02, { curva: l * 0.9, rz: -l * 0.7, tex: 'couro', seg: 8, rad: 6 });
      });
      // --- rosto de demônio entalhado no topo (chave do arco) ---
      const f = B.grupo(R, 0, CY + 0.54, 0.06);
      B.placa(f, 0.36, 0.32, 0.17, 0x2c2024, 0, 0, 0, { tex: 'pedra', rep: 1, raio: 0.06, bisel: 0.025 });
      [-1, 1].forEach(l => {
        B.cx(f, 0.17, 0.045, 0.07, 0x15101a, l * 0.09, 0.075, 0.1, { rz: -l * 0.4, linha: false });       // sobrancelhas furiosas
        B.olho(f, 0.032, 0xffa020, l * 0.085, 0.04, 0.095, { fenda: true, brilho: 1.6 });
        B.cone(f, 0.028, 0.1, 0x15101a, l * 0.205, -0.04, 0.05, { rz: l * PI / 2 + l * 0.3, seg: 4, linha: false });   // maçãs do rosto
        B.cone(f, 0.02, 0.07, 0x15101a, l * 0.11, -0.02, 0.1, { rx: PI / 2, seg: 4, linha: false });
      });
      B.cone(f, 0.04, 0.09, 0x1c1418, 0, 0.0, 0.11, { rx: PI / 2 - 0.3, seg: 4 });
      B.cx(f, 0.24, 0.07, 0.04, 0xff4a08, 0, -0.095, 0.085, { emissive: 0xff4a08, brilho: 1.2, linha: false });        // boca incandescente
      B.dentes(f, 7, 0.2, 0.04, 0xe9dcc0, 0, -0.07, 0.1, { presas: true });
      B.dentes(f, 6, 0.17, 0.034, 0xe9dcc0, 0, -0.125, 0.1, { rx: 0 });
      [-1, 1].forEach(l => { B.chifre(f, 0.2, 0.035, 0x3a2420, l * 0.14, 0.15, 0, { curva: l * 0.8, rz: -l * 0.3, seg: 8, rad: 6 }); });
      B.cone(f, 0.03, 0.11, 0x15101a, 0, 0.19, 0.0, { seg: 4 });
      // --- correntes que pendem dos chifres e do arco ---
      corrente(B, R, [[-0.3, CY + 0.58, 0.05], [-0.38, CY + 0.2, 0.18], [-0.5, CY - 0.1, 0.12], [-0.46, CY - 0.38, 0.1]], 9, 0x4a4650, 0.028);
      corrente(B, R, [[0.3, CY + 0.58, 0.05], [0.38, CY + 0.25, 0.2], [0.5, CY - 0.05, 0.13]], 8, 0x4a4650, 0.028);
      corrente(B, R, [[-0.44, CY + 0.08, 0.1], [-0.2, CY - 0.02, 0.28], [0.1, CY - 0.1, 0.3], [0.38, CY - 0.02, 0.18]], 11, 0x3a3640, 0.024);
      B.tor(R, 0.04, 0.012, 0x4a4650, -0.46, CY - 0.4, 0.1, { rx: PI / 2, metal: 0.6, seg: 8, linha: false });
      // --- caveiras e ossos na base ---
      caveira(B, R, -0.18, 0.13, 0.5, 0.075, 0.5, -0.1, 0xff6a10);
      caveira(B, R, 0.1, 0.12, 0.52, 0.07, -0.4, 0, 0xff6a10);
      caveira(B, R, 0.38, 0.12, 0.38, 0.065, -0.9, 0.1);
      caveira(B, R, -0.42, 0.12, 0.34, 0.07, 1.0, 0.1);
      caveira(B, R, 0.02, 0.08, 0.42, 0.055, 0.2, 0.3);
      caveira(B, R, 0.48, 0.2, -0.08, 0.06, -1.5, 0);
      caveira(B, R, -0.5, 0.24, -0.12, 0.06, 1.7, 0.2, 0xff6a10);
      for (let i = 0; i < 4; i++) {
        const x = -0.34 + i * 0.22, a = s() * 3;
        B.tubo(R, [[x - 0.08, 0.1, 0.46 + s() * 0.05], [x, 0.12, 0.48], [x + 0.08, 0.1, 0.46 + s() * 0.05]], [0.014, 0.012, 0.014], 0xe6dcc0, { tex: 'osso', seg: 6, rad: 5, linha: false });
        B.esf(R, 0.022, 0xe6dcc0, x + 0.08, 0.1, 0.5, { tex: 'osso', linha: false, seg: 6 });
      }
      // --- vórtice de fogo (animado) ---
      B.cil(R, 0.4, 0.4, 0.02, 0x701000, 0, CY, -0.05, { rx: PI / 2, emissive: 0xc02800, brilho: 1.0, seg: 24, linha: false });
      const bracos = (r1, n, giros, l0, l1, fundo, cor, em, z, brilho) => {
        const g = B.grupo(R, 0, CY, z);
        for (let k = 0; k < n; k++) { const m = malha(B, g, geoEspiral(0.04, r1, giros, l0, l1, fundo), cor, 0, 0, 0, { emissive: em, brilho, dupla: true, linha: false }); m.rotation.z = k * PI * 2 / n; }
        return g;
      };
      const vA = bracos(0.39, 4, 0.7, 0.22, 0.05, 0.14, 0xff5a10, 0xff4a08, 0.0, 1.2);
      const vB = bracos(0.3, 3, -0.9, 0.17, 0.04, 0.11, 0xffb02a, 0xffa020, 0.03, 1.4);
      const vC = bracos(0.17, 3, 0.8, 0.11, 0.03, 0.09, 0xfff0b0, 0xffe090, 0.05, 1.6);
      const nucleo = B.vivo(B.esf(R, 0.06, 0xffffe0, 0, CY, 0.03, { emissive: 0xfff4c0, brilho: 1.8, linha: false, seg: 10 }));
      // línguas de fogo escapando pelo arco
      const chamas = [];
      [[-0.28, 0.32, 0.55, 0], [-0.12, 0.3, 0.8, 1], [0.05, 0.3, 0.95, 0], [0.2, 0.3, 0.7, 1], [0.33, 0.33, 0.55, 0], [-0.4, 0.5, 0.4, 1], [0.42, 0.52, 0.42, 0]].forEach(([x, y, e, c], i) => {
        const m = B.vivo(B.torno(R, PERFIL_CHAMA, c ? 0xff5a10 : 0xff7a18, x, y, 0.14, { emissive: c ? 0xff3a08 : 0xff5a10, brilho: 1.1, op: 0.92, linha: false, seg: 8 }));
        m.userData.e = e; m.userData.f = i * 1.7; chamas.push(m);
      });
      // brasas subindo e fumaça escura
      const brasas = []; for (let i = 0; i < 12; i++) brasas.push(B.vivo(B.octa(R, 0.013 + (i % 3) * 0.005, 0xffb040, 0, 1, 0, { emissive: 0xff8a20, brilho: 1.6, linha: false })));
      const fumo = []; for (let i = 0; i < 6; i++) fumo.push(B.vivo(B.blob(R, 0.09 + (i % 3) * 0.02, 0x2a2226, 0, 1.5, 0, { op: 0.2 + i * 0.002, amp: 0.2, seg: 10, linha: false, rough: 1 })));
      return {
        altura: 2.05, p: {}, estrutura: true,
        anim: t => {
          vA.rotation.z = -t * 1.4; vB.rotation.z = t * 2.0; vC.rotation.z = -t * 2.8;
          nucleo.scale.setScalar(1 + Math.sin(t * 7) * 0.25);
          sigilos.forEach(m => { m.material.emissiveIntensity = 1.0 + Math.sin(t * 3) * 0.4; });
          chamas.forEach(c => {
            const f = c.userData.f, e = c.userData.e, w = 1 + Math.sin(t * 9 + f) * 0.14 + Math.sin(t * 15 + f * 2) * 0.06;
            c.scale.set(e * w * 0.9, e * (1 + Math.sin(t * 7 + f * 1.7) * 0.2 + Math.sin(t * 12 + f) * 0.1), e * w * 0.9);
            c.rotation.z = Math.sin(t * 4 + f) * 0.16; c.rotation.y = t * 1.5;
          });
          brasas.forEach((b, i) => { const u = (t * 0.28 + i / brasas.length) % 1, a = i * 2.1 + t * 0.8; b.position.set(Math.sin(a) * 0.3 * (0.4 + u), CY - 0.3 + u * 1.0, 0.1 + Math.cos(a) * 0.12); b.scale.setScalar(1 - u * 0.9); b.rotation.set(t * 3, t * 2, 0); });
          fumo.forEach((f, i) => { const u = (t * 0.1 + i / fumo.length) % 1, a = i * 2.4; f.position.set(Math.sin(a) * 0.3 + Math.sin(t * 0.7 + i) * 0.05, 1.45 + u * 0.5, -0.05); f.scale.setScalar(Math.sin(u * PI) * (0.9 + u * 1.3) + 0.05); });
        },
      };
    },
  });

  /* ===== Duat: estela egípcia amaldiçoada ===== */
  /** laje alta de topo arredondado, com bisel e superfície levemente irregular */
  function geoLaje(w, hc, d, bisel = 0.03) {
    const sh = new THREE.Shape(), r = w / 2;
    sh.moveTo(-r, 0); sh.lineTo(r, 0); sh.lineTo(r, hc); sh.absarc(0, hc, r, 0, PI, false); sh.lineTo(-r, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 2, curveSegments: 14 });
    g.translate(0, 0, -d / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = 7;
      p.setXYZ(i, x + (K.rn3(x * f, y * f, z * f, 3) - 0.5) * 0.014, y + (K.rn3(x * f, y * f, z * f, 8) - 0.5) * 0.014, z + (K.rn3(x * f, y * f, z * f, 5) - 0.5) * 0.014);
    }
    g.computeVertexNormals();
    return g;
  }
  // hieróglifos (caixa de 1 de largura por 1.4 de altura)
  const HIERO = {
    ankh: [[.5, 1.4, .8, 1.2], [.8, 1.2, .8, .95], [.8, .95, .5, .75], [.5, .75, .2, .95], [.2, .95, .2, 1.2], [.2, 1.2, .5, 1.4], [.5, .75, .5, 0], [.1, .55, .9, .55]],
    agua: [[0, 1.1, .25, 1.3], [.25, 1.3, .5, 1.1], [.5, 1.1, .75, 1.3], [.75, 1.3, 1, 1.1], [0, .7, .25, .9], [.25, .9, .5, .7], [.5, .7, .75, .9], [.75, .9, 1, .7], [0, .3, .25, .5], [.25, .5, .5, .3], [.5, .3, .75, .5], [.75, .5, 1, .3]],
    was: [[.5, 0, .5, 1.3], [.5, 1.3, .85, 1.4], [.5, 0, .3, 0], [.5, 0, .7, 0], [.5, .1, .25, .0]],
    djed: [[.5, 0, .5, 1.4], [.2, 1.4, .8, 1.4], [.25, 1.1, .75, 1.1], [.3, .8, .7, .8], [.2, 1.4, .2, 1.1]],
    pena: [[.5, 0, .5, 1.4], [.5, 1.4, .85, 1.0], [.85, 1.0, .5, .6], [.5, .95, .15, .5], [.5, .55, .8, .3]],
    ave: [[.1, .3, .5, .9], [.5, .9, .9, .5], [.9, .5, .5, .3], [.5, .3, .1, .3], [.5, .9, .5, 1.2], [.5, 1.2, .75, 1.35], [.3, 0, .3, .3], [.7, 0, .7, .4]],
    sol: [[.5, 1.4, .85, 1.2], [.85, 1.2, .85, .8], [.85, .8, .5, .6], [.5, .6, .15, .8], [.15, .8, .15, 1.2], [.15, 1.2, .5, 1.4], [.4, 1.0, .6, 1.0]],
    escaravelho: [[.2, .5, .5, 1.0], [.5, 1.0, .8, .5], [.8, .5, .5, .1], [.5, .1, .2, .5], [.5, .1, .5, 1.0], [.05, .3, .2, .5], [.95, .3, .8, .5], [.1, .8, .25, .65]],
    junco: [[.5, 0, .5, 1.3], [.5, .8, .2, 1.2], [.5, .6, .8, 1.1], [.5, .3, .25, .6]],
    cobra: [[.1, .2, .4, .5], [.4, .5, .2, .8], [.2, .8, .6, 1.1], [.6, 1.1, .85, 1.35], [.85, 1.35, .95, 1.2]],
    olho: [[.05, .6, .5, .95], [.5, .95, .95, .6], [.95, .6, .5, .3], [.5, .3, .05, .6], [.45, .6, .55, .62]],
    casa: [[.1, 0, .1, 1.0], [.1, 1.0, .9, 1.0], [.9, 1.0, .9, 0], [.1, 0, .9, 0], [.3, .5, .7, .5]],
  };
  const WEDJAT = [[0, .62, .35, .74], [.35, .74, .75, .7], [.75, .7, 1, .55], [.05, .3, .3, .5], [.3, .5, .6, .5], [.6, .5, .9, .32], [.05, .3, .35, .15], [.35, .15, .65, .17], [.9, .32, .65, .17], [.45, .15, .4, -.1], [.4, -.1, .3, -.2], [.7, .17, .85, -.05], [.85, -.05, .95, -.2], [.95, -.2, .85, -.28]];
  /** escaravelho de miniatura (carapaça lustrosa, cabeça, patas) */
  function escaravelho(B, pai, x, y, z, ry, esc, cor, brilho) {
    const g = B.grupo(pai, x, y, z); g.rotation.y = ry; g.scale.setScalar(esc);
    B.blob(g, 0.05, cor, 0, 0.02, 0, { sy: 0.6, sz: 1.3, amp: 0.05, seed: 3, seg: 8, metal: 0.5, rough: 0.35, emissive: brilho || 0, brilho: 0.5, linha: false });
    B.esf(g, 0.028, 0x14282c, 0, 0.018, 0.075, { sy: 0.7, seg: 6, linha: false, metal: 0.4 });
    B.cx(g, 0.006, 0.01, 0.1, 0x081014, 0, 0.052, -0.005, { linha: false });
    for (let i = 0; i < 3; i++) [-1, 1].forEach(l => B.cil(g, 0.004, 0.003, 0.05, 0x0a1418, l * 0.055, 0.005, (i - 1) * 0.035, { rz: l * 1.2, ry: (i - 1) * 0.5 * l, seg: 4, linha: false }));
    return g;
  }

  Modelos3D.registrar({
    estela(B, R) {
      const s = rng(41), AREIA = 0xc29a5c, AREIA2 = 0xa8824c, OURO = 0xf0b83a, TURQ = 0x2af0c0, VERDE = 0x1a8a78;
      // --- base: degraus de arenito e dunas de areia ---
      bloco(B, R, 0.86, 0.14, 0.52, AREIA2, 0, 0.07, 0, { b: 0.035, seed: 3, tex: 'pedra', rep: 2 });
      bloco(B, R, 0.74, 0.1, 0.4, AREIA, 0, 0.19, 0, { b: 0.03, seed: 5, tex: 'pedra', rep: 2, ry: 0.03 });
      [[0.02, 0.5, 0.1, 0.3, 0], [0.4, 0.34, 0.09, 0.2, 1], [-0.42, 0.34, 0.09, 0.2, 2], [0.1, -0.42, 0.09, 0.22, 3], [-0.34, -0.3, 0.08, 0.16, 4], [0.5, -0.05, 0.08, 0.16, 5]].forEach(([x, z, h, r, i]) =>
        rocha(B, R, r, 0xd2ac66, x, 0.03, z, { sy: h / r, amp: 0.15, seed: 60 + i, det: 1, linha: false, tex: 'musgo', rep: 2, rough: 1, chao: 0.3, relevo: 0.03 }));
      // pedras partidas e rachadas no chão
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * PI * 2 + s() * 0.5, d = 0.42 + s() * 0.13, r = 0.035 + s() * 0.05;
        rocha(B, R, r, i % 2 ? AREIA : AREIA2, Math.sin(a) * d, r * 0.4 + 0.03, Math.cos(a) * d, { sy: 0.7, amp: 0.35, seed: 70 + i, det: 1, chao: 0.3 });
      }
      // --- a laje ---
      const laje = malha(B, R, geoLaje(0.62, 1.28, 0.2, 0.03), AREIA, 0, 0.24, 0, { tex: 'musgo', rep: 1.5, relevo: 0.06, rz: 0.02 });
      const F = 0.2 / 2 + 0.03 + 0.006;   // z da frente da laje
      const dec = B.grupo(R, 0, 0.24, 0); dec.rotation.z = 0.02;
      // disco solar alado (ouro) e cobras no topo
      B.cil(dec, 0.065, 0.065, 0.03, OURO, 0, 1.48, F - 0.01, { rx: PI / 2, seg: 16, metal: 0.7, rough: 0.3, emissive: 0xe08a10, brilho: 0.5, linha: false });
      B.tor(dec, 0.065, 0.008, 0xffd84a, 0, 1.48, F + 0.01, { seg: 16, emissive: 0xffc83a, brilho: 0.8, linha: false });
      const asas = [[[.6, 0, 2.5, .25], [.6, -.35, 2.3, -.05], [.6, -.7, 2.0, -.45], [1.0, 0, 1.0, -.7], [1.5, .1, 1.45, -.65], [2.0, .2, 1.95, -.55]]];
      const asaD = asas[0], asaE = asaD.map(([a, b, c, d]) => [-a, b, -c, d]);
      const disco = trace(B, dec, [asaD, asaE], 0.085, OURO, 0, 1.54, F, { brilho: 0.9, esp: 0.012 });
      // olho de Hórus que brilha
      const olho = trace(B, dec, [WEDJAT], 0.3, TURQ, -0.15, 1.2, F, { brilho: 1.4, esp: 0.017 });
      B.esf(dec, 0.032, 0xffe27a, -0.0, 1.245, F, { emissive: 0xffd84a, brilho: 1.6, linha: false, seg: 8, sz: 0.4 });
      B.tor(dec, 0.045, 0.006, TURQ, 0.0, 1.245, F, { emissive: TURQ, brilho: 1.4, linha: false, seg: 12 });
      const aura = B.vivo(B.esf(dec, 0.16, TURQ, 0, 1.23, F - 0.02, { sy: 0.55, sz: 0.2, op: 0.2, emissive: TURQ, brilho: 0.8, linha: false, seg: 12 }));
      // faixas douradas que separam os registros
      [1.07, 0.27].forEach(y => B.cx(dec, 0.5, 0.012, 0.014, OURO, 0, y, F, { metal: 0.7, rough: 0.3, emissive: 0xc08010, brilho: 0.5, linha: false }));
      // colunas de hieróglifos
      const lista = ['ankh', 'agua', 'was', 'ave', 'sol', 'pena', 'djed', 'escaravelho', 'junco', 'cobra', 'olho', 'casa'];
      const glifos = [];
      for (let c = 0; c < 2; c++) for (let r = 0; r < 6; r++) for (let k = 0; k < 2; k++) {
        const nome = lista[Math.floor(s() * lista.length)], esc = 0.06;
        const m = trace(B, dec, [HIERO[nome]], esc, TURQ, (c ? 0.08 : -0.27) + k * 0.1, 0.94 - r * 0.125, F, { brilho: 1.1, esp: 0.011, prof: 0.012 });
        if (m) glifos.push(m);
      }
      // cobra dourada entalhada (relevo) no centro
      const cb = B.grupo(dec, 0, 0, F + 0.01);
      B.tubo(cb, [[0.0, 0.1, 0], [0.07, 0.22, 0.0], [-0.06, 0.38, 0.005], [0.06, 0.55, 0.005], [-0.02, 0.7, 0.01], [0.0, 0.8, 0.02]], [0.034, 0.03, 0.028, 0.026, 0.024, 0.02], OURO, { metal: 0.65, rough: 0.35, seg: 22, rad: 7, tex: 'escamas', rep: 1, relevo: 0.04, linha: false });
      B.blob(cb, 0.075, OURO, 0, 0.9, 0.0, { sz: 0.38, sy: 1.5, amp: 0.05, seed: 6, seg: 12, metal: 0.65, rough: 0.35, tex: 'escamas', linha: false });
      B.blob(cb, 0.04, OURO, 0, 1.0, 0.04, { sy: 0.9, sz: 0.9, amp: 0.05, seed: 2, seg: 10, metal: 0.65, rough: 0.3, linha: false });
      [-1, 1].forEach(l => B.esf(cb, 0.011, TURQ, l * 0.024, 1.01, 0.075, { emissive: TURQ, brilho: 1.6, linha: false, seg: 5 }));
      B.cx(cb, 0.1, 0.006, 0.004, 0x105a4a, 0, 0.88, 0.03, { linha: false, emissive: TURQ, brilho: 1.0 });
      // rachaduras com luz turquesa
      const rach = (pts, r = 0.011) => B.tubo(R, pts, pts.map((_, i) => r * (1 - i / pts.length * 0.5)), TURQ, { emissive: 0x20d8a8, brilho: 1.5, seg: pts.length * 3, rad: 4, linha: false, pontas: false });
      rach([[0.2, 1.72, F + 0.005], [0.12, 1.55, F + 0.005], [0.2, 1.42, F + 0.005], [0.15, 1.33, F + 0.005]], 0.009);
      rach([[-0.27, 0.62, F + 0.005], [-0.18, 0.5, F + 0.005], [-0.26, 0.4, F + 0.005], [-0.2, 0.3, F + 0.005]], 0.008);
      rach([[0.3, 0.8, F + 0.005], [0.22, 0.7, F + 0.005], [0.28, 0.58, F + 0.005]], 0.008);
      // quebraduras: lascas de pedra em volta do topo e canto partido
      rocha(B, R, 0.08, AREIA2, 0.2, 1.74, F - 0.04, { sy: 0.6, amp: 0.4, seed: 90, det: 1 });
      // costas: ainda mais hieróglifos e olho de Set
      const costas = B.grupo(R, 0, 0.24, 0); costas.rotation.y = PI;
      for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) trace(B, costas, [HIERO[lista[Math.floor(s() * lista.length)]]], 0.06, TURQ, -0.2 + k * 0.1, 1.0 - r * 0.15, F, { brilho: 0.9, esp: 0.011 });
      trace(B, costas, [WEDJAT], 0.26, 0xff5a3a, -0.13, 1.2, F, { brilho: 1.2, esp: 0.016 });
      // laterais: uma coluna de hieróglifos em cada lado
      [-1, 1].forEach(l => {
        const lat = B.grupo(R, 0, 0.24, 0); lat.rotation.y = l * PI / 2;
        for (let r = 0; r < 8; r++) trace(B, lat, [HIERO[lista[Math.floor(s() * lista.length)]]], 0.05, TURQ, -0.025, 1.3 - r * 0.11, 0.31 + 0.036, { brilho: 0.9, esp: 0.009 });
      });
      // --- ankhs de ouro, vaso quebrado e escaravelhos ---
      [[-0.44, 0.2, 0.3, -0.3, 0.4], [0.44, 0.2, 0.28, 0.25, -0.3]].forEach(([x, y, z, rz, ry]) => {
        const g = B.grupo(R, x, y, z); g.rotation.set(0.1, ry, rz);
        B.tor(g, 0.045, 0.011, OURO, 0, 0.19, 0, { metal: 0.7, rough: 0.3, sy: 1.25, seg: 12, linha: false });
        B.cil(g, 0.011, 0.011, 0.17, OURO, 0, 0.07, 0, { metal: 0.7, rough: 0.3, seg: 6, linha: false });
        B.cx(g, 0.11, 0.022, 0.022, OURO, 0, 0.12, 0, { metal: 0.7, rough: 0.3, linha: false });
      });
      const E = [[0.22, 0.2, 0.48, 0.5, 1.0, 0x1a5a58, TURQ], [-0.15, 0.2, 0.5, -0.4, 0.9, 0x1a4a60, 0], [0.5, 0.06, 0.34, 1.2, 0.9, 0x1a5a58, 0], [-0.52, 0.06, 0.2, -1.0, 1.0, 0x14486a, TURQ], [0.0, 0.04, 0.56, 3.0, 0.8, 0x1a5a58, 0], [-0.36, 0.14, 0.4, 0.8, 0.85, 0x1a5a58, 0], [0.4, 0.2, -0.36, 2.2, 0.9, 0x14486a, 0], [-0.4, 0.17, -0.3, 4.0, 1.0, 0x1a5a58, TURQ]];
      const brilhantes = []; E.forEach(([x, y, z, ry, e, cor, br]) => { const g = escaravelho(B, R, x, y, z, ry, e, cor, br); });
      const mist = []; for (let i = 0; i < 0; i++) mist.push(B.vivo(B.blob(R, 0.09 + (i % 3) * 0.02, 0xdcc080, 0, 0.1, 0, { op: 0.14 + i * 0.002, amp: 0.3, sy: 0.45, seg: 9, linha: false, rough: 1 })));
      const motes = []; for (let i = 0; i < 8; i++) motes.push(B.vivo(B.octa(R, 0.014 + (i % 2) * 0.006, 0x7affdc, 0, 1, 0, { sy: 1.8, emissive: TURQ, brilho: 1.6, linha: false })));
      return {
        altura: 1.95, p: {}, estrutura: true,
        anim: t => {
          const k = 1 + Math.sin(t * 2.4) * 0.3;
          glifos[0].material.emissiveIntensity = 0.9 + Math.sin(t * 2.0) * 0.35;
          olho.material.emissiveIntensity = 1.3 + Math.sin(t * 3) * 0.5;
          aura.scale.set(1 + Math.sin(t * 3) * 0.12, 1 + Math.sin(t * 3) * 0.2, 1); aura.material.emissiveIntensity = 0.7 + Math.sin(t * 3) * 0.3;
          mist.forEach((m, i) => { const u = (t * 0.1 + i / mist.length) % 1, a = i * 2.4 + t * 0.2, d = 0.5 + u * 0.1; m.position.set(Math.sin(a) * d, 0.08 + u * 0.3, Math.cos(a) * d * 0.8); m.scale.setScalar(Math.sin(u * PI) * (0.9 + u) + 0.05); });
          motes.forEach((m, i) => { const u = (t * 0.2 + i / motes.length) % 1, a = i * 1.9 + t * 0.6; m.position.set(Math.sin(a) * (0.12 + u * 0.15), 1.1 + u * 0.8, 0.17 + Math.cos(a) * 0.05); m.scale.setScalar(1 - u); m.rotation.set(t, t * 1.3, 0); });
        },
      };
    },
  });

  /* ===== Caos: cristais violeta flutuando sobre rocha partida, com anéis rúnicos ===== */
  /** glifos desenhados no plano XY de um anel (normal = z), de pé em volta do anel, voltados para fora */
  function runasDeAnel(B, g, raio, n, esc, cor, brilho = 1.3) {
    const UPZ = new THREE.Vector3(0, 0, 1), letras = Object.keys(RUNAS); let primeiro = null;
    for (let i = 0; i < n; i++) {
      const a = i / n * PI * 2, rad = new THREE.Vector3(Math.cos(a), Math.sin(a), 0), tan = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(tan, UPZ, rad));
      const segs = RUNAS[letras[(i * 5 + 3) % letras.length]];
      for (const [x1, y1, x2, y2] of segs) {
        const dx = (x2 - x1) * esc, dy = (y2 - y1) * esc, L = Math.hypot(dx, dy) + 0.014, th = 0.012;
        const cx = (x1 + x2) / 2 * esc - 0.35 * esc, cy = (y1 + y2) / 2 * esc - esc;
        const P = rad.clone().multiplyScalar(raio + 0.003).addScaledVector(tan, cx).addScaledVector(UPZ, cy);
        const m = B.cx(g, L, th, 0.012, cor, P.x, P.y, P.z, { emissive: cor, brilho, linha: false, rough: 0.3 });
        m.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(dy, dx)));
        primeiro = primeiro || m;
      }
    }
    return primeiro;
  }

  Modelos3D.registrar({
    cristal_caos(B, R) {
      const s = rng(51), UP = new THREE.Vector3(0, 1, 0), CY = 1.0;
      const VIO = [0x8a4af0, 0xb07aff, 0x6a2ad0, 0xd8b8ff, 0xc04af0, 0x4a1a9a], ROCHA = [0x2c2240, 0x382a50, 0x241a38];
      const gl = { emissive: 0x6a2ad8, brilho: 0.6, op: 0.88 };
      // --- base: rocha partida ao meio, com luz violeta saindo da fenda ---
      rocha(B, R, 0.34, ROCHA[0], -0.27, 0.14, 0.0, { sy: 0.8, amp: 0.32, seed: 3, det: 2, rep: 2, chao: 0.4, rz: 0.2 });
      rocha(B, R, 0.33, ROCHA[1], 0.27, 0.13, -0.02, { sy: 0.75, amp: 0.32, seed: 7, det: 2, rep: 2, chao: 0.4, rz: -0.22 });
      rocha(B, R, 0.2, ROCHA[2], 0.0, 0.07, 0.34, { sy: 0.6, amp: 0.3, seed: 12, det: 1, rep: 2, chao: 0.4 });
      rocha(B, R, 0.18, ROCHA[0], 0.04, 0.06, -0.34, { sy: 0.6, amp: 0.3, seed: 14, det: 1, rep: 2, chao: 0.4 });
      rocha(B, R, 0.2, 0xd8b8ff, 0, 0.1, 0, { sy: 0.4, sx: 0.5, amp: 0.2, seed: 5, det: 1, emissive: 0xb070ff, brilho: 1.5, linha: false, chao: 0 });
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * PI * 2 + s() * 0.4, d = 0.42 + s() * 0.12, r = 0.04 + s() * 0.06;
        rocha(B, R, r, ROCHA[i % 3], Math.sin(a) * d, r * 0.45 + 0.02, Math.cos(a) * d, { sy: 0.8, amp: 0.3, seed: 20 + i, det: 1, chao: 0.4 });
      }
      // cristais menores brotando das lascas
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * PI * 2 + s() * 0.3, d = 0.3 + s() * 0.2, h = 0.14 + s() * 0.24;
        cristal(B, R, Math.sin(a) * d, 0.1 + s() * 0.06, Math.cos(a) * d, 0.03 + s() * 0.03, h, VIO[i % 6], a, 0.2 + s() * 0.5, { seed: 100 + i, ...gl });
      }
      // veios de energia nas rachaduras da rocha
      [[[-0.3, 0.3, 0.1], [-0.2, 0.34, 0.0], [-0.12, 0.3, -0.12]], [[0.14, 0.28, 0.12], [0.24, 0.32, 0.0], [0.32, 0.26, -0.1]], [[-0.38, 0.14, 0.2], [-0.3, 0.2, 0.3], [-0.2, 0.16, 0.38]]].forEach(p =>
        B.tubo(R, p, [0.013, 0.015, 0.008], 0xe4d0ff, { emissive: 0xc090ff, brilho: 1.5, seg: 8, rad: 4, linha: false, pontas: false }));
      // --- montagem flutuante: núcleo de rocha cravejado de cristais ---
      const fl = B.grupo(R, 0, CY, 0);
      rocha(B, fl, 0.27, 0x1c1428, 0, 0, 0, { sy: 0.9, amp: 0.4, seed: 9, det: 2, rep: 2, emissive: 0x3a1a70, brilho: 0.4 });
      const espeto = (az, el, dist, r, h, cor, o = {}) => {
        const d = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
        const m = malha(B, fl, geoCristal(r * 1.15, h * 1.2, { seed: Math.floor(az * 10 + el * 7 + 5), ...o }), cor, d.x * dist, d.y * dist, d.z * dist, { tex: 'cristal', rough: 0.2, relevo: 0.02, ...gl, ...o });
        m.quaternion.setFromUnitVectors(UP, d).multiply(new THREE.Quaternion().setFromAxisAngle(UP, s() * 6));
        return m;
      };
      espeto(0.3, 1.5, 0.15, 0.19, 0.85, 0xb890ff, { op: 0.8, ponta: 0.36 });          // o grande, no topo
      for (let i = 0; i < 6; i++) espeto(i / 6 * PI * 2 + 0.3, 0.75 + (i % 2) * 0.25, 0.18, 0.09 + s() * 0.04, 0.55 + s() * 0.25, VIO[i % 6]);
      for (let i = 0; i < 7; i++) espeto(i / 7 * PI * 2 + 0.7, 0.05 + s() * 0.25, 0.2, 0.07 + s() * 0.04, 0.42 + s() * 0.18, VIO[(i + 2) % 6]);
      for (let i = 0; i < 4; i++) espeto(i / 4 * PI * 2 + 0.2, -0.8 - s() * 0.3, 0.2, 0.06 + s() * 0.03, 0.25 + s() * 0.12, VIO[(i + 4) % 6]);
      // núcleo branco-violeta pulsando (aparece pelas fendas)
      const nucleo = B.vivo(B.esf(fl, 0.16, 0xf4e8ff, 0, 0.06, 0, { sy: 1.5, emissive: 0xe8d0ff, brilho: 1.9, linha: false, seg: 12 }));
      // --- anéis rúnicos orbitando ---
      const mkAnel = (raio, rx, rz, cor, n) => {
        const t = B.grupo(fl, 0, 0, 0); t.rotation.set(rx, 0, rz);
        const sp = B.grupo(t, 0, 0, 0);
        B.tor(sp, raio, 0.022, 0x7a3ae0, 0, 0, 0, { sz: 0.7, seg: 40, emissive: 0x5a2ab0, brilho: 0.8, metal: 0.4, rough: 0.35, linha: false });
        B.tor(sp, raio - 0.075, 0.012, cor, 0, 0, 0, { seg: 40, emissive: cor, brilho: 1.0, linha: false });
        B.tor(sp, raio + 0.07, 0.012, 0x6a2ad0, 0, 0, 0, { seg: 40, emissive: 0x5a2ab0, brilho: 0.6, linha: false });
        const m = runasDeAnel(B, sp, raio, n, 0.07, cor, 1.0);
        for (let i = 0; i < 4; i++) { const a = i * PI / 2 + 0.4; B.octa(sp, 0.035, 0xe4d0ff, Math.cos(a) * raio, Math.sin(a) * raio, 0, { sz: 1.3, emissive: 0xb080ff, brilho: 1.1, linha: false }); }
        return { sp, m };
      };
      const A1 = mkAnel(0.66, 1.25, 0.25, 0xb888ff, 12), A2 = mkAnel(0.52, 0.55, -0.7, 0xa070ff, 10);
      // --- fragmentos soltos em órbita ---
      const frags = [];
      for (let i = 0; i < 9; i++) {
        const cor = i % 3 === 2 ? ROCHA[1] : VIO[i % 6];
        const m = i % 3 === 2 ? rocha(B, R, 0.045 + (i % 2) * 0.02, cor, 0, CY, 0, { sy: 0.8, amp: 0.4, seed: 30 + i, det: 1 })
          : malha(B, R, geoCristal(0.03 + (i % 3) * 0.01, 0.16 + (i % 2) * 0.06, { dupla: 0.5, seed: 40 + i }), cor, 0, CY, 0, { tex: 'cristal', emissive: 0x6a2ad8, brilho: 0.8, op: 0.9 });
        B.vivo(m); m.userData.i = i; frags.push(m);
      }
      // feixe de luz subindo da fenda e partículas de energia
      const feixe = B.vivo(B.cil(R, 0.1, 0.2, 0.7, 0xb070ff, 0, 0.45, 0, { op: 0.12, emissive: 0xa060ff, brilho: 0.7, seg: 12, linha: false }));
      const motes = []; for (let i = 0; i < 10; i++) motes.push(B.vivo(B.octa(R, 0.014 + (i % 3) * 0.005, 0xe4d0ff, 0, 0.3, 0, { sy: 1.6, emissive: 0xc090ff, brilho: 1.7, linha: false })));
      return {
        altura: 2.1, p: {}, estrutura: true,
        anim: t => {
          fl.position.y = CY + Math.sin(t * 1.5) * 0.045; fl.rotation.y = t * 0.12;
          A1.sp.rotation.z = t * 0.7; A2.sp.rotation.z = -t * 0.95;
          nucleo.scale.set(1 + Math.sin(t * 2.4) * 0.14, 1.5 + Math.sin(t * 2.4) * 0.2, 1 + Math.sin(t * 2.4) * 0.14);
          A1.m.material.emissiveIntensity = 1.1 + Math.sin(t * 2.2) * 0.4;
          frags.forEach(f => {
            const i = f.userData.i, a = t * (0.5 + (i % 4) * 0.12) * (i % 2 ? 1 : -1) + i * 0.7, r = 0.78 + (i % 3) * 0.1;
            f.position.set(Math.cos(a) * r, CY + Math.sin(a * 1.3 + i) * 0.5 + 0.1, Math.sin(a) * r); f.rotation.set(t * 0.8 + i, t * 1.1, i);
          });
          feixe.scale.set(1 + Math.sin(t * 3) * 0.1, 1, 1 + Math.sin(t * 3) * 0.1);
          motes.forEach((m, i) => { const u = (t * 0.25 + i / motes.length) % 1, a = i * 2.3 + t; m.position.set(Math.sin(a) * 0.1 * (1 - u), 0.2 + u * 0.75, Math.cos(a) * 0.1 * (1 - u)); m.scale.setScalar(1 - u * 0.7); m.rotation.y = t * 2; });
        },
      };
    },
  });
})();
