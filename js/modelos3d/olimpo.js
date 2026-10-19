'use strict';
/* Modelos 3D — olimpo. Miniaturas detalhadas: harpia, sátiro, ciclope, minotauro e Ares.
   Cada modelo é registrado com Modelos3D.registrar({ id: (B, R) => ({ altura, p, anim }) }).
   Veja as ferramentas no começo de js/modelos3d.js. As ajudas abaixo (penas, garras, correntes...) são locais deste arquivo. */
(() => {
  const PI = Math.PI, V3 = THREE.Vector3, Q = THREE.Quaternion;

  /* ---------- ajudas gerais ---------- */
  /** aleatório com semente (sempre o mesmo resultado) */
  const sem = s => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const mix = (a, b, t) => { const A = new THREE.Color(a), Bc = new THREE.Color(b); return A.lerp(Bc, t).getHex(); };
  const esc = (c, k) => { const C = new THREE.Color(c); C.multiplyScalar(k); return C.getHex(); };
  const v3 = a => (a instanceof V3 ? a.clone() : new V3(a[0], a[1], a[2]));

  /** contorno escuro de miniatura (cópia um pouco maior atrás da peça) */
  function contornoGeo(geo, esp = 0.02) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox, c = bb.getCenter(new V3()), s = bb.getSize(new V3());
    const k = e => Math.min(1.7, 1 + esp / Math.max(0.0001, e / 2));
    const g = geo.clone(); g.translate(-c.x, -c.y, -c.z); g.scale(k(s.x), k(s.y), k(s.z)); g.translate(c.x, c.y, c.z);
    return g;
  }
  /** malha própria (geometria qualquer) com material do construtor e contorno opcional */
  function mala(B, pai, geo, cor, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(geo, B.mat(cor, o));
    m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    if (o.sx || o.sy || o.sz) m.scale.set(o.sx || 1, o.sy || 1, o.sz || 1);
    if (o.linha !== false && !o.op) { const l = new THREE.Mesh(contornoGeo(geo, o.esp), B.linhaMat); l.userData.contorno = true; m.add(l); }
    pai.add(m);
    return m;
  }
  /** orienta uma malha: o eixo +Z dela passa a apontar para `dir` (com giro `roll` em volta dele) */
  function orienta(m, dir, roll = 0) {
    const q = new Q().setFromUnitVectors(new V3(0, 0, 1), v3(dir).normalize());
    if (roll) q.multiply(new Q().setFromAxisAngle(new V3(0, 0, 1), roll));
    m.quaternion.copy(q);
    return m;
  }
  /** esfera amassada com resolução automática pelo tamanho */
  function bl(B, pai, r, cor, x = 0, y = 0, z = 0, o = {}) {
    const seg = o.seg || (r >= 0.15 ? 12 : r >= 0.08 ? 10 : 8);
    return B.blob(pai, r, cor, x, y, z, { amp: 0.07, freq: 2.4, ...o, seg, linha: o.linha ?? (r > 0.085) });
  }
  /** tubo fino de detalhe (veia, corda, fio): sem contorno, poucos lados */
  function fio(B, pai, pts, r, cor, o = {}) {
    const raios = Array.isArray(r) ? r : [r, r];
    return B.tubo(pai, pts, raios, cor, { rad: Math.max(...raios) < 0.0085 ? 3 : 4, linha: false, pontas: false, rough: 0.6, ...o, seg: o.seg || Math.min(8, 2 + pts.length * 2) });
  }
  /** pontos aleatórios sobre um elipsóide, com normal: [{p:[x,y,z], n:[x,y,z]}] (filtra pela função f(normal)) */
  function sobre(cx, cy, cz, rx, ry, rz, n, semente, f = null, fator = 0.96) {
    const rnd = sem(semente), out = [];
    let tent = 0;
    while (out.length < n && tent++ < n * 60) {
      const u = rnd() * 2 - 1, a = rnd() * PI * 2, s = Math.sqrt(1 - u * u), N = new V3(s * Math.cos(a), u, s * Math.sin(a));
      if (f && !f(N)) continue;
      const nn = new V3(N.x / rx, N.y / ry, N.z / rz).normalize();
      out.push({ p: [cx + N.x * rx * fator, cy + N.y * ry * fator, cz + N.z * rz * fator], n: [nn.x, nn.y, nn.z] });
    }
    return out;
  }

  /* ---------- penas ---------- */
  const penaCache = new Map();
  /** geometria de uma pena: eixo ao longo de +Z, fina em Y (leve curvatura para baixo) */
  function penaGeo(c, l, curva = 0.12, esp = 0.012) {
    const k = [c, l, curva, esp].map(v => v.toFixed(3)).join('|');
    if (penaCache.has(k)) return penaCache.get(k);
    const n = c > 0.3 ? 4 : 3, pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {                       // anéis de 3 pontos: borda, nervura (levantada), borda
      const t = i / n, w = l * Math.sin(PI * Math.pow(t, 0.62)) * (i === n ? 0.02 : 1), y = -curva * c * t * t, z = t * c;
      pos.push(-w, y - esp * 0.3, z, 0, y + esp, z, w, y - esp * 0.3, z);
      uv.push(0, t, 0.5, t, 1, t);
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { const a = i * 3 + j, a2 = a + 3; idx.push(a, a2, a + 1, a + 1, a2, a2 + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    penaCache.set(k, g);
    return g;
  }
  /** põe uma pena em `pos`, apontando para `dir`. o: curva, esp, roll, linha */
  function pena(B, pai, pos, dir, c, l, cor, o = {}) {
    const m = mala(B, pai, penaGeo(c, l * (o.fino ?? 0.85), o.curva ?? 0.12, o.esp ?? 0.012), cor, pos[0], pos[1], pos[2], { tex: 'pelo', rep: 1, rough: 0.8, relevo: 0.015, dupla: true, linha: false, ...o });
    return orienta(m, dir, o.roll || 0);
  }

  /* ---------- garras, dedos, correntes ---------- */
  /** garra curva e afiada: parte de (x,y,z), vai na direção `dir`, curva para `curva` (padrão: para baixo) */
  function garra(B, pai, x, y, z, dir, comp, r, cor, o = {}) {
    const d = v3(dir).normalize(), cv = v3(o.curva || [0, -1, 0]), k = o.curv ?? 0.5, pts = [];
    for (let i = 0; i <= 3; i++) { const t = i / 3; pts.push([x + d.x * comp * t + cv.x * comp * k * t * t, y + d.y * comp * t + cv.y * comp * k * t * t, z + d.z * comp * t + cv.z * comp * k * t * t]); }
    return B.tubo(pai, pts, [r, r * 0.62, r * 0.28, 0.003], cor, { seg: 6, rad: 5, linha: false, pontas: false, rough: 0.4, tex: o.tex || 'osso', rep: 1 });
  }
  /** dedo com 3 juntas, que se curva (para baixo por padrão) e termina em garra. Devolve o ponto da ponta. */
  function dedo(B, pai, x, y, z, dir, comp, r, cor, corGarra, o = {}) {
    const d = v3(dir).normalize(), cv = v3(o.curva || [0, -1, 0]), k = o.curv ?? 0.6, pts = [];
    for (let i = 0; i <= 3; i++) { const t = i / 3; pts.push([x + d.x * comp * t + cv.x * comp * k * t * t, y + d.y * comp * t + cv.y * comp * k * t * t, z + d.z * comp * t + cv.z * comp * k * t * t]); }
    B.tubo(pai, pts, [r, r * 0.85, r * 0.7, r * 0.55], cor, { seg: 6, rad: 5, linha: false, pontas: false, tex: o.tex || 'pele', rep: 1, rough: o.rough ?? 0.7 });
    if (o.juntas) for (let i = 1; i < 3; i++) { const q = pts[i]; B.esf(pai, r * 0.95, cor, q[0], q[1], q[2], { seg: 6, linha: false, tex: o.tex || 'pele', rep: 1 }); }   // juntas
    const e = pts[3], t2 = v3(pts[3]).sub(v3(pts[2])).normalize();
    if (corGarra !== null) garra(B, pai, e[0], e[1], e[2], [t2.x, t2.y, t2.z], o.garra || comp * 0.7, r * 0.8, corGarra, { curv: 0.7, curva: o.curva });
    return e;
  }
  /** corrente: elos de metal ao longo de uma curva [[x,y,z],...] */
  function corrente(B, pai, pontos, n, r, cor, o = {}) {
    const curva = new THREE.CatmullRomCurve3(pontos.map(v3)), sz = o.tam ?? r * 3.2;
    const geo = new THREE.TorusGeometry(sz * 0.5, r, 4, 8); geo.scale(1.45, 1, 1);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, P = curva.getPointAt(t), T = curva.getTangentAt(t);
      const m = mala(B, pai, geo, cor, P.x, P.y, P.z, { metal: 0.7, rough: 0.4, tex: 'metal', linha: false, ...o.mat });
      const q = new Q().setFromUnitVectors(new V3(1, 0, 0), T);
      q.multiply(new Q().setFromAxisAngle(new V3(1, 0, 0), i % 2 ? PI / 2 : 0));
      m.quaternion.copy(q);
    }
  }
  /** fileira de rebites/pregos em arco */
  function rebites(B, pai, pontos, n, r, cor, o = {}) {
    const curva = new THREE.CatmullRomCurve3(pontos.map(v3));
    for (let i = 0; i < n; i++) { const P = curva.getPointAt(n === 1 ? 0.5 : i / (n - 1)); B.esf(pai, r, cor, P.x, P.y, P.z, { seg: 6, linha: false, metal: 0.6, rough: 0.35, ...o }); }
  }
  /** cicatriz: risca clara com pontos de sutura */
  function cicatriz(B, pai, pts, cor, r = 0.007, pontos = 0) {
    fio(B, pai, pts, [r, r * 1.1], cor, { rough: 0.5 });
    if (pontos) {
      const cv = new THREE.CatmullRomCurve3(pts.map(v3));
      for (let i = 0; i < pontos; i++) { const t = (i + 0.5) / pontos, P = cv.getPointAt(t), T = cv.getTangentAt(t); const perp = new V3(-T.y, T.x, 0).normalize().multiplyScalar(r * 2.6); fio(B, pai, [[P.x - perp.x, P.y - perp.y, P.z - perp.z + 0.002], [P.x + perp.x, P.y + perp.y, P.z + perp.z + 0.002]], r * 0.5, 0x2a1810, { seg: 1 }); }
    }
  }
  /** mecha de pelo/espinho: cone fino em `pos` apontando para `dir` */
  const conePool = new Map();
  function tufo(B, pai, pos, dir, comp, r, cor, o = {}) {
    const k = [comp, r, o.lados || 4].map(v => v.toFixed(3)).join('|');
    if (!conePool.has(k)) { const g = new THREE.ConeGeometry(r, comp, o.lados || 4, 1, true); g.translate(0, comp / 2, 0); g.rotateX(PI / 2); conePool.set(k, g); }
    const m = mala(B, pai, conePool.get(k), cor, pos[0], pos[1], pos[2], { tex: o.tex ?? 'pelo', rep: 1, linha: false, rough: 0.9, ...o });
    return orienta(m, dir);
  }

  /** pelagem: n mechas ao longo de uma curva (pontos + raios do volume), apontando no sentido da curva */
  function pelagem(B, pai, pts, raios, n, comp, cor, semente, o = {}) {
    const cv = new THREE.CatmullRomCurve3(pts.map(v3)), rnd = sem(semente);
    for (let i = 0; i < n; i++) {
      const t = (i + rnd() * 0.9) / n, P = cv.getPointAt(Math.min(1, t)), T = cv.getTangentAt(Math.min(1, t));
      const x = t * (raios.length - 1), j = Math.min(raios.length - 2, Math.floor(x)), r = (raios[j] + (raios[j + 1] - raios[j]) * (x - j)) * (o.fundo ?? 0.92);
      const up = Math.abs(T.y) > 0.9 ? new V3(1, 0, 0) : new V3(0, 1, 0), N1 = new V3().crossVectors(T, up).normalize(), N2 = new V3().crossVectors(T, N1);
      const a = (o.arco ? o.arco[0] + rnd() * (o.arco[1] - o.arco[0]) : rnd() * PI * 2), off = N1.clone().multiplyScalar(Math.cos(a)).add(N2.clone().multiplyScalar(Math.sin(a)));
      const pos = [P.x + off.x * r, P.y + off.y * r, P.z + off.z * r], sg = o.sentido ?? 1;
      const d = T.clone().multiplyScalar(sg * (o.seguir ?? 0.9)).add(off.multiplyScalar(o.solta ?? 0.5));
      d.y += o.cai ?? 0;
      tufo(B, pai, pos, [d.x, d.y, d.z], comp * (0.7 + rnd() * 0.6), o.larg ?? 0.014, Array.isArray(cor) ? cor[i % cor.length] : cor, o);
    }
  }
  /** espiral de chifre de carneiro (volta para trás, desce e volta para a frente). lado = -1/1 */
  function chifreCarneiro(B, pai, lado, x, y, z, R, voltas, r0, cor, o = {}) {
    const pts = [], raios = [], N = 14;
    for (let i = 0; i <= N; i++) {
      const t = i / N, ph = t * PI * voltas, Rr = R * (1 - t * 0.28);
      const dx = lado * ((o.flare ?? 0.1) * t + 0.035 * Math.sin(ph * 0.5)), dz = -Rr * Math.sin(ph), ga = (o.giro ?? 0) * lado, c = Math.cos(ga), sn = Math.sin(ga);
      pts.push([x + (dx * c + dz * sn * lado), y + Rr * Math.cos(ph) - R, z + (-dx * sn * lado + dz * c)]);
      raios.push(r0 * (1 - t * 0.9) + 0.003);
    }
    const g = B.tubo(pai, pts, raios, cor, { seg: o.seg || 26, rad: o.rad || 7, tex: 'osso', rep: 3, rough: 0.55, pontas: false, linha: o.linha });
    const cv = new THREE.CatmullRomCurve3(pts.map(v3));
    const ng = o.aneis ?? 7, geoR = new THREE.TorusGeometry(1, 0.2, 4, 7);
    for (let i = 0; i < ng; i++) {                                               // anéis de crescimento do chifre
      const t = 0.06 + (i / ng) * 0.7, P = cv.getPointAt(t), T = cv.getTangentAt(t), rr = (r0 * (1 - t * 0.9) + 0.003) * 1.08;
      const m = mala(B, pai, geoR, esc(cor, 0.75), P.x, P.y, P.z, { tex: 'osso', rep: 1, linha: false, sx: rr, sy: rr, sz: rr * 1.3 });
      orienta(m, [T.x, T.y, T.z]);
    }
    return g;
  }

  /** tubos sem tampas esféricas (poupa triângulos): chame no começo de cada modelo */
  function enxuto(B) {
    const t0 = B.tubo, n0 = B.torno;
    B.tubo = (p, pts, r, c, o = {}) => t0(p, pts, r, c, { pontas: false, linha: Math.max(...r) > 0.075, ...o, seg: Math.min(o.seg || 18, o.fino ? 24 : 9), rad: Math.min(o.rad || 9, 7) });
    B.torno = (p, perfil, c, x, y, z, o) => n0(p, perfil.slice().sort((a, b) => a[1] - b[1]), c, x, y, z, o);   // perfil sempre de baixo para cima (normais para fora)
    const e0 = B.esf, c0 = B.cone, l0 = B.cil;
    B.esf = (p, r, c, x, y, z, o = {}) => e0(p, r, c, x, y, z, { seg: r > 0.05 ? 10 : 7, ...o });
    B.cone = (p, r, h, c, x, y, z, o = {}) => c0(p, r, h, c, x, y, z, { seg: 6, ...o });
    B.cil = (p, rt, rb, h, c, x, y, z, o = {}) => l0(p, rt, rb, h, c, x, y, z, { seg: 8, ...o });
    return B;
  }

  /** anel/argola (toro enxuto): mesmos argumentos de B.tor, com menos triângulos */
  const toroCache = new Map();
  function ar(B, pai, Rr, r, cor, x = 0, y = 0, z = 0, o = {}) {
    const seg = Math.min(o.seg || 12, 14), rad = r > 0.02 ? 6 : 4, k = [Rr, r, seg, rad].join('|');
    if (!toroCache.has(k)) toroCache.set(k, new THREE.TorusGeometry(Rr, r, rad, seg));
    return mala(B, pai, toroCache.get(k), cor, x, y, z, { ...o, linha: o.linha ?? (r > 0.02) });
  }
  Modelos3D.registrar({

    /* ===== HARPIA: mulher-pássaro feroz, agachada nas garras, asas abertas ===== */
    harpia(B, R) {
      const pele = 0xbfa38c, peleEsc = 0x8a6a5c, veia = 0x7a6a92, marrom = 0x4a3022, bronze = 0x9a6a30, ouro = 0xd8a63a, creme = 0xe8d8b8, azul = 0x7aa4cc, bico = 0xe0b040, negro = 0x2a2018, escama = 0xc8a040;
      const mp = { tex: 'pele', rep: 2, rough: 0.8, relevo: 0.022 };
      enxuto(B);
      const rnd = sem(11);
      const K0 = B.grupo(R, 0, 0, 0); K0.scale.setScalar(1.12);
      const G = B.grupo(K0, 0, 0.78, 0); G.rotation.x = 0.32;      // tronco inclinado para a frente

      /* --- tronco magro --- */
      bl(B, G, 0.115, pele, 0, 0.0, 0, { ...mp, sx: 1.2, sy: 0.85, seed: 2 });                       // bacia
      B.tubo(G, [[0, 0.0, 0], [0, 0.17, 0.01], [0, 0.32, 0.0]], [0.1, 0.075, 0.1], pele, { ...mp, seg: 10, rad: 9 });    // cintura
      bl(B, G, 0.14, pele, 0, 0.42, 0, { ...mp, sx: 0.95, sy: 1.15, sz: 0.78, seed: 4, amp: 0.05 }); // caixa torácica
      for (const l of [-1, 1]) {                                                                      // omoplatas, clavículas, ombros
        bl(B, G, 0.05, peleEsc, l * 0.1, 0.46, -0.085, { ...mp, sx: 0.8, sy: 1.3, sz: 0.5, seed: 6 });
        fio(B, G, [[l * 0.03, 0.55, 0.05], [l * 0.1, 0.565, 0.035], [l * 0.17, 0.55, 0.0]], [0.011, 0.014], mix(pele, 0xffffff, 0.2));
        bl(B, G, 0.055, pele, l * 0.17, 0.51, 0, { ...mp, seed: 8 });
        for (let k = 0; k < 5; k++) {                                                                 // costelas aparentes
          const y = 0.3 + k * 0.045, w = 0.12 + 0.012 * Math.sin(k * 0.9);
          fio(B, G, [[l * 0.012, y + 0.02, -0.097], [l * w, y + 0.012, -0.065], [l * (w + 0.018), y, 0.02], [l * w * 0.7, y - 0.012, 0.095]], [0.0075, 0.0075], mix(pele, 0xfff2dd, 0.35));
        }
      }
      for (let k = 0; k < 9; k++) B.esf(G, 0.0125 - k * 0.0003, mix(pele, 0xfff2dd, 0.3), 0, 0.12 + k * 0.048, -0.105 + (k > 5 ? 0.005 : 0), { seg: 6, linha: false, ...mp });   // vértebras
      cicatriz(B, G, [[0.04, 0.5, -0.1], [0.08, 0.42, -0.09], [0.1, 0.34, -0.08]], 0xe8cdbb, 0.006, 3);   // cicatrizes nas costas
      cicatriz(B, G, [[-0.06, 0.28, -0.09], [-0.03, 0.2, -0.1]], 0xe8cdbb, 0.005, 2);
      fio(B, G, [[0.1, 0.35, 0.1], [0.12, 0.28, 0.06], [0.125, 0.2, 0.0]], 0.006, veia);               // veias
      fio(B, G, [[-0.1, 0.38, 0.1], [-0.125, 0.3, 0.07], [-0.13, 0.22, 0.02]], 0.006, veia);
      // peitoral de penas (cobre o peito e a barriga)
      sobre(0, 0.4, 0.02, 0.15, 0.2, 0.13, 40, 5, n => n.z > 0.15 && n.y > -0.75).forEach((s, i) => {
        const d = [s.n[0] * 0.7, -0.95 + s.n[1] * 0.2, s.n[2] * 0.45 + 0.1];
        pena(B, G, s.p, d, 0.13 + rnd() * 0.05, 0.034, [creme, bronze, mix(creme, bronze, 0.5), ouro][i % 4], { roll: s.n[0] * 0.4, curva: 0.18 });
      });
      sobre(0, 0.14, 0.0, 0.12, 0.12, 0.1, 14, 8, n => n.z > -0.1 && n.y < 0.3).forEach((s, i) => {   // saiote de penas na barriga
        pena(B, G, s.p, [s.n[0] * 0.6, -0.9, s.n[2] * 0.5 + 0.15], 0.17 + rnd() * 0.06, 0.04, [bronze, marrom, creme][i % 3], { curva: 0.2 });
      });
      // gola de penas em volta do pescoço
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * PI * 2, c = Math.cos(a), s = Math.sin(a);
        pena(B, G, [c * 0.075, 0.57, s * 0.07 + 0.02], [c * 0.8, 0.5, s * 0.8 - 0.1], 0.14 + rnd() * 0.05, 0.036, [ouro, bronze, creme, marrom][i % 4], { curva: 0.1, roll: a });
      }
      // colar de ouro (torque) com um pingente
      ar(B, G, 0.06, 0.012, ouro, 0, 0.6, 0.045, { rx: PI / 2 - 0.5, metal: 0.8, rough: 0.3, linha: false, seg: 14 });
      B.esf(G, 0.018, 0x6aa8e8, 0, 0.55, 0.095, { emissive: 0x3a78c8, brilho: 0.5, seg: 8, linha: false });

      /* --- pescoço e cabeça --- */
      B.tubo(G, [[0, 0.5, 0.0], [0, 0.6, 0.03], [0, 0.66, 0.09]], [0.052, 0.04, 0.042], pele, { ...mp, seg: 8, rad: 8 });
      const cab = B.grupo(G, 0, 0.67, 0.095); cab.rotation.x = -0.3;
      bl(B, cab, 0.115, pele, 0, 0.11, -0.012, { ...mp, sz: 1.05, seed: 3 });                         // crânio
      bl(B, cab, 0.08, pele, 0, 0.06, 0.055, { ...mp, sx: 1.1, sy: 0.9, seed: 9 });                   // maçãs do rosto
      for (const l of [-1, 1]) {
        fio(B, cab, [[l * 0.11, 0.16, 0.03], [l * 0.075, 0.137, 0.095], [l * 0.022, 0.108, 0.118]], [0.016, 0.024, 0.018], peleEsc, { seg: 6 });   // sobrancelha franzida
        B.esf(cab, 0.03, 0x1a1214, l * 0.063, 0.098, 0.084, { sz: 0.7, sy: 0.8, seg: 8, linha: false });
        B.olho(cab, 0.023, 0xffd830, l * 0.063, 0.096, 0.094, { brilho: 1.5, fenda: true });                         // olhos amarelos
        bl(B, cab, 0.03, peleEsc, l * 0.1, 0.05, 0.03, { ...mp, sz: 1.5, sy: 1.6, seed: 12 });          // orelha
        B.cone(cab, 0.022, 0.1, pele, l * 0.125, 0.09, 0.0, { rz: -l * 1.1, ry: l * 0.2, seg: 5, ...mp, linha: false });   // orelha pontuda
        fio(B, cab, [[l * 0.05, 0.03, 0.095], [l * 0.075, 0.0, 0.07], [l * 0.09, 0.0, 0.03]], 0.007, peleEsc);   // sulco do rosto
        for (let k = 0; k < 3; k++) pena(B, cab, [l * 0.115, 0.08 - k * 0.02, -0.01], [l * 1, -0.4 - k * 0.2, -0.6], 0.14 - k * 0.02, 0.025, [ouro, bronze, marrom][k], { roll: 1 });   // penas nas têmporas
      }
      // bico curvo + narinas
      const bico1 = B.tubo(cab, [[0, 0.09, 0.1], [0, 0.098, 0.17], [0, 0.082, 0.235], [0, 0.04, 0.268]], [0.036, 0.032, 0.021, 0.005], bico, { tex: 'osso', rep: 1, rough: 0.35, seg: 12, rad: 8 });
      bico1.scale.x = 0.75;
      B.tubo(cab, [[0, 0.058, 0.255], [0, 0.04, 0.275], [0, 0.015, 0.265]], [0.012, 0.009, 0.003], 0x3a2a1a, { seg: 6, rad: 5, linha: false, pontas: false });  // ponta em gancho
      for (const l of [-1, 1]) B.esf(cab, 0.007, 0x2a1a0a, l * 0.017, 0.105, 0.2, { seg: 5, linha: false });
      B.dentes(cab, 6, 0.075, 0.02, 0xf2ead2, 0, 0.044, 0.118, { presas: true });                    // dentes de cima
      // mandíbula (abre ao golpear)
      const mand = B.grupo(cab, 0, 0.035, 0.03);
      for (const l of [-1, 1]) fio(B, mand, [[l * 0.065, 0.0, 0.0], [l * 0.052, -0.02, 0.07], [l * 0.012, -0.034, 0.14]], [0.022, 0.018, 0.012], pele, { seg: 8, tex: 'pele', rep: 2 });
      bl(B, mand, 0.025, pele, 0, -0.03, 0.135, { ...mp, sz: 1.3, seed: 13 });
      B.tubo(mand, [[0, -0.032, 0.14], [0, -0.03, 0.19], [0, -0.012, 0.205]], [0.016, 0.01, 0.003], bico, { seg: 6, rad: 5, linha: false, pontas: false, tex: 'osso', rep: 1 });
      B.dentes(mand, 6, 0.07, 0.02, 0xf2ead2, 0, -0.012, 0.1, { rx: 0.0001, presas: true });
      B.esf(mand, 0.026, 0xa83a3a, 0, -0.018, 0.075, { sx: 1.2, sy: 0.5, sz: 1.8, seg: 7, linha: false });   // língua
      // cabelo de penas desgrenhadas
      for (let i = 0; i < 22; i++) {
        const a = -PI * 0.15 + (i / 21) * PI * 1.3 - PI * 0.5 + PI * 0.5, th = (rnd() - 0.5) * 1.6;
        const base = [Math.sin(th) * 0.09, 0.19 + rnd() * 0.02, -0.05 - Math.cos(th) * 0.04];
        pena(B, cab, base, [Math.sin(th) * 0.9, 0.35 + rnd() * 0.5, -1], 0.2 + rnd() * 0.14, 0.03 + rnd() * 0.012, [bronze, marrom, ouro, mix(bronze, azul, 0.35), creme][i % 5], { curva: 0.25 + rnd() * 0.3, roll: th * 0.5 });
      }
      for (let i = 0; i < 9; i++) {                                                                  // mechas finas
        const th = (rnd() - 0.5) * 1.6;
        fio(B, cab, [[Math.sin(th) * 0.08, 0.2, -0.06], [Math.sin(th) * 0.13, 0.17, -0.15], [Math.sin(th) * 0.2, 0.06 - rnd() * 0.08, -0.2 - rnd() * 0.06]], [0.008, 0.002], marrom, { seg: 6 });
      }
      for (let i = 0; i < 3; i++) pena(B, cab, [0, 0.215, 0.0], [(i - 1) * 0.35, 0.8, 0.45], 0.16 + (i === 1 ? 0.07 : 0), 0.03, [ouro, bronze, ouro][i], { curva: -0.15, roll: 0 });   // crista na testa

      /* --- braços com garras --- */
      const bracos = [-1, 1].map(l => {
        const b = B.grupo(G, l * 0.18, 0.5, 0); b.rotation.x = -0.75;
        B.tubo(b, [[0, 0, 0], [l * 0.01, -0.1, 0.02], [0, -0.2, 0.04]], [0.04, 0.036, 0.03], pele, { ...mp, seg: 8, rad: 7 });
        bl(B, b, 0.034, peleEsc, l * 0.012, -0.12, 0.03, { ...mp, seed: 4 });                           // bíceps
        B.tubo(b, [[0, -0.2, 0.04], [0, -0.3, 0.075], [0, -0.4, 0.08]], [0.03, 0.03, 0.021], pele, { ...mp, seg: 8, rad: 7 });
        fio(B, b, [[l * 0.026, -0.04, 0.02], [l * 0.032, -0.2, 0.05], [l * 0.022, -0.36, 0.08]], 0.005, veia);
        for (let k = 0; k < 6; k++) pena(B, b, [l * 0.01 * 0, -0.2 - k * 0.03, 0.04 + k * 0.012 - 0.022], [l * 0.55, -0.15, -1], 0.17 - k * 0.012, 0.03, [ouro, bronze, creme, marrom][k % 4], { curva: 0.1, roll: l * 0.6 });   // penas no antebraço
        const m = B.grupo(b, 0, -0.4, 0.08);
        bl(B, m, 0.04, pele, 0, -0.025, 0.012, { ...mp, sx: 0.9, sy: 1.1, seed: 5, linha: false });
        for (let k = 0; k < 4; k++) dedo(B, m, (k - 1.5) * 0.02, -0.04, 0.012, [(k - 1.5) * 0.12, -0.55, 0.9], 0.08, 0.0105, peleEsc, 0x2a2018, { curv: 0.8, garra: 0.06 });
        dedo(B, m, l * 0.04, -0.02, 0.0, [l * 0.9, -0.3, 0.6], 0.06, 0.011, peleEsc, 0x2a2018, { curv: 0.7, garra: 0.045 });
        ar(B, b, 0.036, 0.008, ouro, 0, -0.34, 0.078, { rx: PI / 2 + 0.2, metal: 0.8, rough: 0.3, linha: false, seg: 10 });   // pulseira
        return b;
      });
      // algema quebrada com corrente no pulso esquerdo
      corrente(B, bracos[0], [[-0.005, -0.35, 0.09], [-0.02, -0.42, 0.08], [-0.03, -0.5, 0.07], [-0.02, -0.56, 0.08]], 4, 0.0065, 0x8a7a60);

      /* --- asas grandes de penas --- */
      const asas = [-1, 1].map(l => {
        const piv = B.grupo(G, l * 0.09, 0.47, -0.1);
        const w = B.grupo(piv, 0, 0, 0); w.rotation.z = l * 0.28; w.rotation.y = l * 0.25; w.scale.setScalar(0.88);
        const X = (x, y, z) => [l * x, y, z];
        const S = [0, 0, 0], E = [0.27, 0.17, -0.1], Wr = [0.55, 0.36, 0.0], H = [0.76, 0.42, -0.1];
        B.tubo(w, [X(...S), X(...E), X(...Wr)], [0.04, 0.032, 0.026], mix(pele, bronze, 0.3), { ...mp, seg: 10, rad: 8 });
        B.tubo(w, [X(...Wr), X(...H)], [0.03, 0.012], peleEsc, { ...mp, seg: 6, rad: 6 });
        B.esf(w, 0.038, peleEsc, ...X(...Wr), { ...mp, seg: 8 });
        const lin = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        for (let i = 0; i < 16; i++) {                                                               // penugem de borda cobrindo o osso
          const t = i / 15, P = t < 0.5 ? lin(S, E, t * 2) : t < 0.8 ? lin(E, Wr, (t - 0.5) / 0.3) : lin(Wr, H, (t - 0.8) / 0.2), a = 0.9 - t * 0.4;
          pena(B, w, X(P[0], P[1] + 0.02, P[2] + 0.02), X(Math.cos(a) * 0.5, 0.75, 0.15), 0.17 + (i % 3) * 0.03, 0.05, [marrom, bronze, mix(bronze, ouro, 0.5)][i % 3], { curva: -0.1, esp: 0.016 });
        }
        // primárias (mais escuras, ponta dourada/azul)
        for (let i = 0; i < 9; i++) {
          const t = 1 - i / 8, P = lin(Wr, H, t), a = 1.25 - (1 - t) * 1.0 + (rnd() - 0.5) * 0.08, c = 0.66 - (1 - t) * 0.26 + (rnd() - 0.5) * 0.06;
          const d = X(Math.sin(a), 0.1 + t * 0.3, -Math.cos(a)), cor = i % 2 ? 0x4a3234 : 0x3a2830;
          pena(B, w, X(P[0], P[1] - 0.012, P[2]), d, c, 0.085, cor, { curva: 0.07, linha: i % 2 === 0 });
          pena(B, w, X(P[0] + 0, P[1] - 0.004, P[2]).map((v, k) => v + d[k] * c * 0.7), d, c * 0.3, 0.07, i % 3 === 0 ? azul : ouro, { curva: 0.1, esp: 0.014 });
        }
        // secundárias
        for (let i = 0; i < 10; i++) {
          const t = i / 9, P = i < 4 ? lin(E, Wr, 1 - i / 3 * 0.0 - (1 - i / 3) * 0.0) : lin(E, Wr, 0), s = i / 9;
          const Q0 = lin(Wr, E, s * 1.0), a = 0.18 + s * 0.15 + (rnd() - 0.5) * 0.05, c = 0.5 - s * 0.04 + (rnd() - 0.5) * 0.05;
          const d = X(Math.sin(a), 0.06, -Math.cos(a));
          pena(B, w, X(Q0[0], Q0[1] - 0.02, Q0[2]), d, c, 0.09, i % 2 ? mix(bronze, marrom, 0.4) : bronze, { curva: 0.1, roll: l * 0.1, linha: i % 3 === 0 });
          pena(B, w, X(Q0[0], Q0[1] - 0.012, Q0[2]).map((v, k) => v + d[k] * c * 0.72), d, c * 0.28, 0.07, i % 3 === 0 ? azul : ouro, { curva: 0.12 });
        }
        for (let i = 0; i < 6; i++) {                                                                // terciárias perto do corpo
          const s = i / 5, Q0 = lin(E, S, s), a = -0.1 + s * 0.2, d = X(Math.sin(a) * 0.5, -0.03, -1);
          pena(B, w, X(Q0[0], Q0[1] - 0.025, Q0[2]), d, 0.46 - s * 0.1, 0.085, mix(marrom, bronze, s), { curva: 0.18 });
        }
        // coberteiras (2 fileiras)
        for (let r = 0; r < 2; r++) for (let i = 0; i < 12; i++) {
          const t = i / 11, P = t < 0.5 ? lin(S, E, t * 2) : lin(E, Wr, (t - 0.5) * 2), a = 0.12 + t * 0.55 + (rnd() - 0.5) * 0.1;
          pena(B, w, X(P[0], P[1] + 0.012 + r * 0.012, P[2] + 0.01 - r * 0.02), X(Math.sin(a), 0.02, -Math.cos(a)), 0.26 + t * 0.04 - r * 0.07, 0.09, [r ? mix(bronze, ouro, 0.5) : bronze, marrom, creme][(i + r) % 3], { curva: 0.2 });
        }
        for (let i = 0; i < 4; i++) pena(B, w, X(0.55 + i * 0.012, 0.38, 0.03 + i * 0.015), X(0.5 + i * 0.25, 0, 0.9 - i * 0.2), 0.1, 0.02, [ouro, bronze][i % 2], { curva: 0.1 });   // álula
        garra(B, w, ...X(0.55, 0.4, 0.05), X(0.35, 0.4, 1), 0.11, 0.022, negro, { curva: [0, -1, 0] });                  // garra do polegar
        return piv;
      });

      /* --- cauda de penas --- */
      const cauda = B.grupo(G, 0, -0.02, -0.1);
      for (let i = 0; i < 9; i++) {
        const t = i / 8 - 0.5, a = t * 1.5;
        pena(B, cauda, [t * 0.04, 0.0, -0.02], [Math.sin(a), -0.42 + Math.abs(t) * 0.1, -Math.cos(a)], 0.62 - Math.abs(t) * 0.28, 0.066, [bronze, marrom, mix(bronze, ouro, 0.4)][i % 3], { curva: 0.26, linha: i % 2 === 0 });
        pena(B, cauda, [t * 0.04 + Math.sin(a) * 0.42, -0.2, -0.02 - Math.cos(a) * 0.4], [Math.sin(a), -0.35, -Math.cos(a)], 0.16, 0.055, i % 2 ? azul : ouro, { curva: 0.2 });
      }

      /* --- pernas de ave: coxa emplumada, "joelho" invertido, tarso escamoso e garras --- */
      const pernas = [-1, 1].map(l => {
        const p = B.grupo(K0, l * 0.11, 0.76, 0);
        bl(B, p, 0.085, pele, 0, -0.08, 0.04, { ...mp, sy: 1.5, seed: 21 });                           // coxa
        sobre(0, -0.1, 0.045, 0.1, 0.16, 0.1, 18, 30 + l, n => n.y > -0.5).forEach((s, i) => pena(B, p, s.p, [s.n[0] * 0.5, -1, s.n[2] * 0.3 + 0.1], 0.14 + rnd() * 0.05, 0.035, [bronze, marrom, creme][i % 3], { curva: 0.1, roll: l * 0.3 }));  // calça de penas
        B.tubo(p, [[0, -0.16, 0.08], [0, -0.3, 0.03], [0, -0.45, -0.05]], [0.05, 0.04, 0.032], escama, { tex: 'escamas', rep: 2, rough: 0.5, seg: 8, rad: 8 });
        B.esf(p, 0.04, escama, 0, -0.16, 0.085, { tex: 'escamas', seg: 8 });                            // joelho
        B.tubo(p, [[0, -0.45, -0.05], [0, -0.6, 0.0], [0, -0.7, 0.05]], [0.032, 0.028, 0.03], escama, { tex: 'escamas', rep: 3, rough: 0.5, seg: 8, rad: 7 });
        garra(B, p, 0, -0.46, -0.06, [0, -0.35, -1], 0.07, 0.014, negro, { curva: [0, 1, 0], curv: 0.3 });   // esporão no calcanhar
        const fy = -0.725;
        B.esf(p, 0.034, escama, 0, -0.69, 0.055, { tex: 'escamas', seg: 8, linha: false });
        for (let k = -1; k <= 1; k++) dedo(B, p, k * 0.012, fy + 0.04, 0.06, [k * 0.5, -0.12, 1], 0.22, 0.027, escama, negro, { curva: [0, -1, 0], curv: 0.25, tex: 'escamas', garra: 0.15 });
        dedo(B, p, 0, fy + 0.04, 0.04, [0, -0.1, -1], 0.14, 0.027, escama, negro, { curv: 0.25, tex: 'escamas', garra: 0.13 });
        return p;
      });
      // algema de bronze no tornozelo esquerdo
      ar(B, pernas[0], 0.04, 0.012, 0x8a6a30, 0, -0.56, 0.0, { rx: PI / 2 + 0.1, metal: 0.7, rough: 0.4, linha: false, seg: 10 });
      corrente(B, pernas[0], [[0.03, -0.58, 0.0], [0.06, -0.66, -0.04], [0.04, -0.72, -0.09], [0.0, -0.74, -0.14]], 4, 0.007, 0x8a7a60);

      return {
        altura: 1.75,
        p: { tronco: G, cabeca: cab, bracoE: bracos[0], bracoD: bracos[1], pernaE: pernas[0], pernaD: pernas[1], asaE: asas[0], asaD: asas[1], cauda, mandibula: { g: mand, fechada: 0.12, aberta: 0.55 } },
      };
    },

    /* ===== SÁTIRO: furioso, peludo, pernas de bode, chifres de carneiro, clava de raiz ===== */
    satiro(B, R) {
      const pele = 0xb98a60, peleEsc = 0x8a5e3e, pelo = 0x6a4020, pelo2 = 0x4a2a14, pelo3 = 0x8a5a2e, hoof = 0x1c1612, osso = 0xb8a070, couro = 0x4a2e1a, verde = 0x4a7a3a;
      const mp = { tex: 'pele', rep: 3, rough: 0.8, relevo: 0.014 }, mf = { tex: 'pelo', rep: 2, rough: 0.95 };
      const veia = 0x8a5a58, rnd = sem(23);
      enxuto(B);
      const K0 = B.grupo(R, 0, 0, 0); K0.scale.setScalar(1.05);
      const G = B.grupo(K0, 0, 0.74, 0); G.rotation.x = 0.24;

      /* --- tronco musculoso e peludo --- */
      bl(B, G, 0.14, pele, 0, 0.0, 0, { ...mp, sx: 1.2, sy: 0.85, seed: 2 });                              // bacia
      B.tubo(G, [[0, 0.0, 0], [0, 0.15, 0.015], [0, 0.3, 0.0]], [0.135, 0.12, 0.15], pele, { ...mp, seg: 10, rad: 10 });
      bl(B, G, 0.18, pele, 0, 0.42, -0.01, { ...mp, sx: 1.12, sy: 1.0, sz: 0.85, seed: 4, amp: 0.05 });     // caixa torácica
      for (const l of [-1, 1]) {
        bl(B, G, 0.095, mix(pele, peleEsc, 0.2), l * 0.085, 0.45, 0.095, { ...mp, sx: 1.1, sy: 0.85, sz: 0.7, seed: 5 });   // peitoral
        bl(B, G, 0.08, peleEsc, l * 0.12, 0.34, 0.065, { ...mp, sx: 0.9, sy: 1.0, sz: 0.7, seed: 6 });                        // serrátil
        bl(B, G, 0.105, pele, l * 0.21, 0.5, 0.0, { ...mp, seed: 7 });                                                         // deltoide
        bl(B, G, 0.09, peleEsc, l * 0.15, 0.5, -0.11, { ...mp, sx: 1.1, sy: 1.3, sz: 0.6, seed: 8 });                        // dorsal
        bl(B, G, 0.07, pele, l * 0.07, 0.58, -0.04, { ...mp, sx: 1.2, sy: 0.9, sz: 0.8, seed: 9 });                          // trapézio
        for (let k = 0; k < 3; k++) bl(B, G, 0.036, mix(pele, 0xffffff, 0.06), l * 0.04, 0.11 + k * 0.065, 0.135 - k * 0.006, { ...mp, sx: 1.2, sy: 0.9, sz: 0.7, seed: 10 + k });   // abdômen
        bl(B, G, 0.05, peleEsc, l * 0.13, 0.12, 0.08, { ...mp, sx: 0.8, sy: 1.4, sz: 0.7, seed: 14 });                       // oblíquo
        fio(B, G, [[l * 0.04, 0.38, 0.17], [l * 0.075, 0.33, 0.165], [l * 0.1, 0.3, 0.14]], 0.006, esc(peleEsc, 0.7));       // sulco do peitoral
        fio(B, G, [[l * 0.23, 0.5, 0.075], [l * 0.25, 0.42, 0.06], [l * 0.24, 0.33, 0.04]], 0.005, veia);
      }
      fio(B, G, [[0, 0.2, 0.15], [0, 0.3, 0.158], [0, 0.45, 0.155]], 0.006, esc(peleEsc, 0.7));                    // linha central
      fio(B, G, [[0, 0.58, -0.14], [0, 0.4, -0.185], [0, 0.2, -0.16], [0, 0.04, -0.12]], 0.008, esc(peleEsc, 0.65));   // coluna
      cicatriz(B, G, [[0.14, 0.52, 0.12], [0.1, 0.43, 0.17], [0.06, 0.36, 0.17]], 0xe0b898, 0.008, 4);              // cicatrizes
      cicatriz(B, G, [[-0.2, 0.3, 0.08], [-0.15, 0.24, 0.12]], 0xe0b898, 0.007, 3);
      // pelagem do peito, barriga e costas
      sobre(0, 0.42, 0.01, 0.18, 0.2, 0.17, 46, 3, n => n.z > 0.35 && n.y > -0.2).forEach(s => tufo(B, G, s.p, [s.n[0] * 0.6, -0.55 + s.n[1] * 0.2, s.n[2] * 0.6], 0.065 + rnd() * 0.04, 0.014, [pelo, pelo2, pelo3][Math.floor(rnd() * 3)]));
      sobre(0, 0.15, 0.0, 0.14, 0.2, 0.14, 24, 4, n => n.z > 0.2).forEach(s => tufo(B, G, s.p, [s.n[0] * 0.4, -0.8, s.n[2] * 0.4], 0.06 + rnd() * 0.04, 0.012, pelo2));
      sobre(0, 0.4, -0.02, 0.19, 0.22, 0.17, 30, 5, n => n.z < -0.4).forEach(s => tufo(B, G, s.p, [s.n[0] * 0.5, -0.5, s.n[2] * 0.7], 0.07 + rnd() * 0.05, 0.015, [pelo, pelo2][Math.floor(rnd() * 2)]));
      for (const l of [-1, 1]) sobre(l * 0.21, 0.54, 0, 0.11, 0.09, 0.1, 10, 6 + l, n => n.y > 0.1).forEach(s => tufo(B, G, s.p, [s.n[0] * 0.8, s.n[1] * 0.5, s.n[2] * 0.4], 0.07 + rnd() * 0.05, 0.015, pelo3));   // tufos nos ombros
      // cinto de couro, fivela de bronze, flauta de Pã e tanga de pelo
      B.torno(G, [[0.148, -0.045], [0.155, 0.0], [0.15, 0.05]], couro, 0, 0.0, 0, { tex: 'couro', rep: 2, seg: 16, linha: false });
      rebites(B, G, [[-0.14, 0.01, 0.07], [0, 0.01, 0.155], [0.14, 0.01, 0.07]], 7, 0.011, 0xd8a63a);
      B.cx(G, 0.07, 0.06, 0.02, 0xd8a63a, 0, 0.005, 0.158, { metal: 0.8, rough: 0.3 });
      B.esf(G, 0.015, 0xc83a2a, 0, 0.005, 0.172, { seg: 6, emissive: 0x802010, brilho: 0.4, linha: false });
      for (let i = 0; i < 12; i++) { const a = (i / 11 - 0.5) * 2.6; pelagem(B, G, [[Math.sin(a) * 0.15, -0.04, Math.cos(a) * 0.15 * (a > 0 ? 1 : 1)], [Math.sin(a) * 0.17, -0.14, Math.cos(a) * 0.16]], [0.01, 0.01], 3, 0.1, [pelo, pelo2][i % 2], 40 + i, { solta: 0.2, cai: -0.4, sentido: 1 }); }
      const flauta = B.grupo(G, -0.12, -0.02, 0.15); flauta.rotation.z = 0.5; flauta.rotation.x = 0.1;
      for (let i = 0; i < 7; i++) B.cil(flauta, 0.012, 0.012, 0.18 - i * 0.017, mix(0xd8c080, 0x9a7a3a, i / 7), i * 0.027 - 0.08, -0.1 - (0.18 - i * 0.017) / 2 + 0.1, 0, { seg: 6, linha: i % 2 === 0, tex: 'osso', rep: 1 });
      B.cx(flauta, 0.19, 0.012, 0.016, 0x4a2e1a, 0, -0.05, 0.0, { linha: false, tex: 'couro' }); B.cx(flauta, 0.17, 0.012, 0.016, 0x4a2e1a, 0, -0.13, 0.0, { linha: false, tex: 'couro' });
      fio(B, G, [[-0.1, 0.01, 0.15], [-0.11, -0.01, 0.15], [-0.12, -0.02, 0.155]], 0.007, couro);
      // cauda curta
      const cauda = B.grupo(G, 0, -0.02, -0.14);
      B.tubo(cauda, [[0, 0, 0], [0, 0.05, -0.1], [0, 0.02, -0.18]], [0.035, 0.03, 0.02], pelo, { ...mf, seg: 6, rad: 6, pontas: true });
      pelagem(B, cauda, [[0, 0.03, -0.12], [0, 0.03, -0.2]], [0.02, 0.02], 8, 0.08, pelo3, 77, { solta: 1.2, seguir: 0.6 });

      /* --- pescoço e cabeça selvagem --- */
      B.tubo(G, [[0, 0.52, -0.02], [0, 0.62, 0.02], [0, 0.69, 0.08]], [0.085, 0.07, 0.065], pele, { ...mp, seg: 8, rad: 9 });
      const cab = B.grupo(G, 0, 0.7, 0.08); cab.rotation.x = -0.18;
      bl(B, cab, 0.12, pele, 0, 0.12, -0.01, { ...mp, sz: 1.0, seed: 3, amp: 0.04 });                             // crânio
      bl(B, cab, 0.08, pele, 0, 0.065, 0.075, { ...mp, sx: 1.05, sy: 1.0, sz: 1.2, seed: 9 });                     // focinho
      bl(B, cab, 0.03, peleEsc, 0, 0.085, 0.165, { ...mp, sx: 1.4, sy: 0.8, sz: 1.0, seed: 11, linha: false });   // nariz
      for (const l of [-1, 1]) {
        bl(B, cab, 0.036, pele, l * 0.075, 0.085, 0.09, { ...mp, seed: 12, linha: false });                        // maçã do rosto
        fio(B, cab, [[l * 0.11, 0.17, 0.03], [l * 0.075, 0.15, 0.1], [l * 0.02, 0.118, 0.14]], [0.016, 0.022, 0.016], peleEsc, { seg: 6 });   // sobrancelha pesada
        B.esf(cab, 0.034, 0x1a0e0a, l * 0.062, 0.115, 0.09, { sz: 0.7, seg: 8, linha: false });
        B.esf(cab, 0.028, 0xffb020, l * 0.062, 0.113, 0.098, { emissive: 0xc86a10, brilho: 0.9, seg: 9, linha: false });   // olho
        B.cx(cab, 0.04, 0.0085, 0.01, 0x0a0606, l * 0.062, 0.113, 0.123, { linha: false });                       // pupila horizontal
        B.esf(cab, 0.01, 0x0a0606, l * 0.019, 0.075, 0.185, { seg: 5, linha: false });                              // narina
        // orelha pontuda de bode
        const m = pena(B, cab, [l * 0.11, 0.14, -0.005], [l * 1, 0.28, -0.35], 0.19, 0.055, pele, { tex: 'pele', rep: 1, curva: -0.1, esp: 0.016, linha: true });
        pena(B, cab, [l * 0.115, 0.138, 0.0], [l * 1, 0.28, -0.35], 0.15, 0.03, 0xc87a70, { tex: 'pele', rep: 1, curva: -0.1, esp: 0.02, roll: 0 });
        pelagem(B, cab, [[l * 0.11, 0.08, 0.01], [l * 0.14, 0.04, 0.02]], [0.01, 0.01], 4, 0.07, pelo, 90 + l, { solta: 1.0 });   // costeleta
        fio(B, cab, [[l * 0.04, 0.045, 0.14], [l * 0.075, 0.02, 0.12], [l * 0.075, -0.005, 0.1]], 0.006, esc(peleEsc, 0.8));  // sulco do focinho
      }
      // boca arreganhada: mandíbula que abre
      const mand = B.grupo(cab, 0, 0.03, 0.03);
      for (const l of [-1, 1]) fio(B, mand, [[l * 0.07, 0.0, 0.0], [l * 0.055, -0.02, 0.07], [l * 0.02, -0.03, 0.14]], [0.025, 0.02, 0.015], pele, { seg: 8, tex: 'pele', rep: 2 });
      bl(B, mand, 0.03, pele, 0, -0.03, 0.14, { ...mp, sx: 1.1, sz: 1.2, seed: 13 });
      B.dentes(cab, 8, 0.1, 0.022, 0xf0e8cc, 0, 0.032, 0.13, { presas: true });
      B.dentes(mand, 7, 0.09, 0.02, 0xe8dcc0, 0, -0.005, 0.12, { rx: 0.0001, presas: true });
      B.esf(mand, 0.03, 0xb04040, 0, -0.012, 0.08, { sx: 1.2, sy: 0.5, sz: 1.8, seg: 7, linha: false });             // língua
      // barba de bode e cabelo desgrenhado
      B.tubo(mand, [[0, -0.04, 0.14], [0, -0.1, 0.13], [0, -0.17, 0.115]], [0.03, 0.026, 0.008], pelo2, { ...mf, seg: 6, rad: 6, linha: false });
      pelagem(B, mand, [[0, -0.04, 0.14], [0, -0.1, 0.13], [0, -0.19, 0.11]], [0.03, 0.025, 0.01], 18, 0.09, [pelo2, pelo, pelo3], 61, { solta: 0.8, cai: -0.5, larg: 0.016 });
      pelagem(B, cab, [[-0.08, 0.04, 0.08], [0, 0.0, 0.1], [0.08, 0.04, 0.08]], [0.04, 0.04, 0.04], 10, 0.06, pelo, 62, { solta: 0.9, cai: -0.2 });   // bigode
      for (let i = 0; i < 4; i++) bl(B, cab, 0.06 - i * 0.004, [pelo, pelo2, pelo3, pelo][i], (i - 1.5) * 0.045, 0.2 - Math.abs(i - 1.5) * 0.015, -0.015 - i % 2 * 0.03, { ...mf, amp: 0.2, sy: 0.8, seed: 20 + i, seg: 9 });   // topete
      pelagem(B, cab, [[-0.1, 0.17, 0.0], [0, 0.23, 0.0], [0.1, 0.17, 0.0], [0.1, 0.1, -0.1], [0, 0.1, -0.13], [-0.1, 0.1, -0.1]], [0.1, 0.1, 0.1, 0.1, 0.1, 0.1], 40, 0.1, [pelo, pelo2, pelo3], 63, { solta: 1.0, cai: -0.1, larg: 0.018 });
      // chifres de carneiro retorcidos, com folhas e uvas
      for (const l of [-1, 1]) {
        chifreCarneiro(B, cab, l, l * 0.06, 0.24, -0.02, 0.16, 1.7, 0.04, osso, { aneis: 8, flare: 0.1, giro: 0.8 });
        const base = [l * 0.07, 0.2, -0.03];
        for (let k = 0; k < 3; k++) { pena(B, cab, [l * (0.1 + k * 0.03), 0.2 + k * 0.01, -0.05 - k * 0.06], [l * 0.5, 0.4, -0.6 + k * 0.4], 0.07, 0.03, verde, { tex: 'musgo', rep: 1, curva: 0.2, esp: 0.01 }); }
        for (let k = 0; k < 4; k++) B.esf(cab, 0.014, 0x5a2a6a, l * (0.1 + k * 0.012), 0.18 - k * 0.01, -0.05 - k * 0.02, { seg: 6, linha: false });
      }

      /* --- braços grossos com clava e punho fechado --- */
      const bracos = [-1, 1].map(l => {
        const b = B.grupo(G, l * 0.24, 0.52, 0); b.rotation.x = l > 0 ? -1.0 : -0.5;
        B.tubo(b, [[0, 0, 0], [l * 0.01, -0.13, 0.02], [0, -0.25, 0.05]], [0.085, 0.082, 0.062], pele, { ...mp, seg: 8, rad: 9 });
        bl(B, b, 0.062, peleEsc, l * 0.005, -0.1, 0.05, { ...mp, sz: 0.9, seed: 31 });                                   // bíceps
        bl(B, b, 0.06, pele, l * 0.01, -0.12, -0.04, { ...mp, seed: 32 });                                              // tríceps
        B.tubo(b, [[0, -0.25, 0.05], [0, -0.35, 0.09], [0, -0.46, 0.1]], [0.062, 0.058, 0.04], pele, { ...mp, seg: 8, rad: 8 });
        bl(B, b, 0.045, peleEsc, 0, -0.3, 0.08, { ...mp, sy: 1.4, seed: 33 });                                          // antebraço
        fio(B, b, [[l * 0.045, -0.06, 0.04], [l * 0.056, -0.2, 0.06], [l * 0.04, -0.34, 0.1], [l * 0.025, -0.44, 0.105]], 0.0065, veia);
        fio(B, b, [[l * 0.02, -0.08, 0.1], [l * 0.025, -0.16, 0.09]], 0.005, veia);
        pelagem(B, b, [[0, -0.27, 0.06], [0, -0.38, 0.1]], [0.05, 0.05], 8, 0.05, pelo, 80 + l, { solta: 0.8 });
        const m = B.grupo(b, 0, -0.47, 0.1);
        bl(B, m, 0.058, pele, 0, -0.03, 0.01, { ...mp, sx: 1.0, sy: 0.9, seed: 5, linha: false });
        for (let k = 0; k < 4; k++) dedo(B, m, (k - 1.5) * 0.026, -0.05, 0.035, [(k - 1.5) * 0.08, -0.35, 0.9], 0.07, 0.014, pele, 0x2a1a10, { curv: 1.1, garra: 0.035 });
        dedo(B, m, l * 0.055, -0.01, 0.02, [l * 0.6, -0.4, 0.8], 0.055, 0.015, pele, 0x2a1a10, { curv: 0.8, garra: 0.03 });
        B.torno(b, [[0.058, -0.36], [0.064, -0.4], [0.056, -0.47]], couro, 0, 0, 0.1, { tex: 'couro', rep: 2, seg: 10, linha: false, rx: 0.17 });
        b.userData.mao = m;
        return b;
      });
      // clava de raiz com espetos e anéis de ferro
      const cl = B.grupo(bracos[1].userData.mao, 0, -0.04, 0.045); cl.rotation.x = 1.0; cl.rotation.z = -0.55; cl.scale.setScalar(0.8);
      B.tubo(cl, [[0, -0.2, 0], [0.012, 0.0, 0.0], [0.0, 0.3, 0.01], [0.02, 0.55, 0], [0.0, 0.78, 0.01]], [0.032, 0.036, 0.05, 0.085, 0.1], 0x6a4426, { tex: 'couro', rep: 2, rough: 0.9, seg: 14, rad: 9, relevo: 0.03 });
      bl(B, cl, 0.12, 0x5a381e, 0, 0.8, 0.0, { tex: 'couro', rep: 2, rough: 0.95, relevo: 0.03, sy: 1.25, amp: 0.2, seed: 41, seg: 14 });
      for (let k = 0; k < 4; k++) bl(B, cl, 0.045, 0x4a2c16, ((k % 2) - 0.5) * 0.12, 0.1 + k * 0.1, 0.04 * (k % 3 - 1), { tex: 'couro', rep: 1, amp: 0.3, seed: 50 + k, seg: 8, linha: false });   // nós da madeira
      sobre(0, 0.8, 0, 0.12, 0.15, 0.12, 15, 71).forEach((s, i) => tufo(B, cl, s.p, s.n, 0.075, 0.022, 0x9a9aa0, { tex: 'metal', metal: 0.7, rough: 0.35, rep: 1 }));   // pregos
      ar(B, cl, 0.095, 0.014, 0x8a8a92, 0, 0.62, 0, { rx: PI / 2, metal: 0.7, rough: 0.4, linha: false, seg: 12 });
      ar(B, cl, 0.075, 0.012, 0x8a8a92, 0, 0.52, 0, { rx: PI / 2, metal: 0.7, rough: 0.4, linha: false, seg: 12 });
      corrente(B, cl, [[0, 0.0, 0.03], [0.04, -0.12, 0.08], [0.02, -0.22, 0.12]], 4, 0.006, 0x8a8a92);                  // corda/corrente de pulso

      /* --- pernas de bode: coxa peluda, jarrete invertido, casco partido --- */
      const pernas = [-1, 1].map(l => {
        const p = B.grupo(K0, l * 0.14, 0.72, -0.01);
        B.tubo(p, [[0, 0, 0], [0, -0.14, 0.06], [0, -0.26, 0.12]], [0.115, 0.11, 0.075], pelo, { ...mf, seg: 10, rad: 9 });
        bl(B, p, 0.1, pelo, l * 0.01, -0.1, 0.0, { ...mf, sy: 1.3, seed: 33 });                                       // coxa grossa
        bl(B, p, 0.065, pelo2, 0, -0.27, 0.12, { ...mf, seed: 34 });                                                 // joelho
        B.tubo(p, [[0, -0.27, 0.12], [0, -0.43, 0.02], [0, -0.52, -0.06]], [0.07, 0.055, 0.045], pelo, { ...mf, seg: 8, rad: 8 });
        B.tubo(p, [[0, -0.52, -0.06], [0, -0.64, 0.02], [0, -0.7, 0.07]], [0.045, 0.034, 0.034], pelo2, { ...mf, seg: 8, rad: 7 });
        bl(B, p, 0.045, pelo2, 0, -0.52, -0.065, { ...mf, seed: 35, linha: false });                                  // jarrete
        pelagem(B, p, [[0, 0, 0], [0, -0.14, 0.06], [0, -0.26, 0.12], [0, -0.43, 0.02], [0, -0.52, -0.06]], [0.11, 0.105, 0.075, 0.06, 0.05], 40, 0.12, [pelo, pelo2, pelo3], 100 + l, { solta: 0.25, larg: 0.009, cai: -0.1 });
        pelagem(B, p, [[0, -0.52, -0.06], [0, -0.64, 0.02], [0, -0.7, 0.07]], [0.045, 0.036, 0.034], 12, 0.08, pelo2, 120 + l, { solta: 0.9, seguir: 0.5 });   // tufo do boleto
        for (const q of [-1, 1]) {                                                                                    // casco partido
          bl(B, p, 0.04, hoof, q * 0.02, -0.735, 0.1, { tex: 'osso', rep: 1, sx: 0.55, sy: 0.7, sz: 1.7, seed: 36, seg: 8, rough: 0.35, linha: true });
          B.cone(p, 0.034, 0.07, hoof, q * 0.02, -0.72, 0.15, { rx: PI / 2 + 0.2, seg: 5, linha: false });
        }
        return p;
      });

      return {
        altura: 1.65,
        p: { tronco: G, cabeca: cab, bracoE: bracos[0], bracoD: bracos[1], pernaE: pernas[0], pernaD: pernas[1], cauda, mandibula: { g: mand, fechada: 0.1, aberta: 0.5 } },
      };
    },

    /* ===== CICLOPE: gigante curvado, barrigudo, um olho enorme, tronco de árvore e rocha ===== */
    ciclope(B, R) {
      const pele = 0x9c7a58, peleEsc = 0x735238, peleCl = 0xb8946c, couro = 0x5a3a22, couro2 = 0x3e2816, osso = 0xd8c8a0, pelo = 0x3a2a1e, ouro = 0xd8a63a;
      const mp = { tex: 'pele', rep: 3, rough: 0.85, relevo: 0.016 }, veia = 0x6a4a60, cic = 0xd8b8a0, rnd = sem(5);
      enxuto(B);
      const K0 = B.grupo(R, 0, 0, 0); K0.scale.setScalar(1.12);
      const G = B.grupo(K0, 0, 0.66, -0.04); G.rotation.x = 0.42;

      /* --- tronco: barrigão, peitoral enorme, corcunda --- */
      bl(B, G, 0.21, pele, 0, 0.0, 0, { ...mp, sx: 1.3, sy: 0.85, seed: 2 });                                // bacia
      bl(B, G, 0.28, pele, 0, 0.2, 0.1, { ...mp, sx: 1.12, sy: 1.0, sz: 1.0, seed: 3, amp: 0.05 });  // barriga
      bl(B, G, 0.14, peleCl, 0, 0.09, 0.28, { ...mp, sx: 1.4, sy: 0.7, sz: 0.7, seed: 4, linha: false });     // dobra da barriga
      bl(B, G, 0.3, pele, 0, 0.52, 0.0, { ...mp, sx: 1.12, sy: 0.9, sz: 0.88, seed: 5, amp: 0.05 }); // peito
      bl(B, G, 0.23, peleEsc, 0, 0.74, -0.14, { ...mp, sx: 1.3, sy: 0.75, sz: 0.9, seed: 6 });      // corcunda/trapézio
      B.esf(G, 0.022, 0x2a1810, 0, 0.17, 0.375, { sx: 1.3, sy: 0.8, sz: 0.5, seg: 6, linha: false });         // umbigo
      for (const l of [-1, 1]) {
        bl(B, G, 0.15, mix(pele, peleEsc, 0.2), l * 0.16, 0.57, 0.2, { ...mp, sx: 1.1, sy: 0.85, sz: 0.75, seed: 7 });    // peitoral
        bl(B, G, 0.18, pele, l * 0.38, 0.66, 0.0, { ...mp, seed: 8 });                                                    // ombro
        bl(B, G, 0.12, peleEsc, l * 0.24, 0.4, 0.2, { ...mp, sx: 0.9, sy: 1.1, sz: 0.8, seed: 9, linha: false });                      // costelas
        bl(B, G, 0.14, peleCl, l * 0.18, 0.06, 0.26, { ...mp, sx: 0.8, sy: 0.9, sz: 0.8, seed: 15, linha: false });      // pança lateral
        bl(B, G, 0.12, peleEsc, l * 0.27, 0.46, -0.12, { ...mp, sx: 1.0, sy: 1.3, sz: 0.7, seed: 10 });                 // dorsal
        fio(B, G, [[l * 0.3, 0.55, 0.16], [l * 0.37, 0.42, 0.15], [l * 0.36, 0.28, 0.1]], 0.008, veia);
        fio(B, G, [[l * 0.08, 0.3, 0.37], [l * 0.12, 0.2, 0.39], [l * 0.1, 0.1, 0.36]], 0.007, veia);
        for (let k = 0; k < 3; k++) fio(B, G, [[l * 0.06, 0.12 + k * 0.1, 0.375], [l * 0.17, 0.1 + k * 0.1, 0.34], [l * 0.27, 0.14 + k * 0.1, 0.25]], 0.006, esc(peleEsc, 0.75));   // estrias/dobras
      }
      cicatriz(B, G, [[0.28, 0.72, 0.18], [0.16, 0.58, 0.3], [0.04, 0.44, 0.34], [-0.08, 0.3, 0.37]], cic, 0.012, 7);   // cicatriz enorme no peito
      cicatriz(B, G, [[-0.3, 0.68, 0.14], [-0.26, 0.58, 0.2], [-0.2, 0.5, 0.24]], cic, 0.009, 4);
      cicatriz(B, G, [[0.2, 0.2, 0.32], [0.26, 0.12, 0.28]], cic, 0.008, 3);
      cicatriz(B, G, [[0.1, 0.8, -0.2], [0.18, 0.6, -0.3], [0.2, 0.4, -0.28]], cic, 0.01, 5);
      sobre(0, 0.5, 0.02, 0.32, 0.36, 0.3, 20, 4, n => n.z > 0.5 && n.y > 0).forEach(s => tufo(B, G, s.p, [s.n[0], -0.3, s.n[2]], 0.05 + rnd() * 0.04, 0.012, pelo));   // pelos do peito
      sobre(0, 0.8, -0.14, 0.3, 0.2, 0.25, 24, 8, n => n.y > 0.2).forEach(s => tufo(B, G, s.p, s.n, 0.06 + rnd() * 0.05, 0.014, pelo));                   // pelos nas costas
      sobre(0, 0.2, 0.1, 0.28, 0.28, 0.28, 12, 9, n => n.z > 0.5 && n.y < 0.2).forEach(s => tufo(B, G, s.p, [0, -0.5, 1], 0.05, 0.012, pelo));

      // tanga de couro remendado, cinto de corda com crânios de ovelha
      B.torno(G, [[0.25, -0.1], [0.28, 0.0], [0.27, 0.06]], couro2, 0, 0.02, 0.0, { tex: 'couro', rep: 2, seg: 16, linha: false, sx: 1.18, sz: 1.0 });
      const tanga = [[0, 0.28, 0, 0.25, 0.3, couro], [-0.18, 0.24, 0.1, 0.18, 0.26, couro2], [0.18, 0.22, 0.1, 0.18, 0.28, mix(couro, 0x8a6a3a, 0.4)]];
      tanga.forEach(([x, z, r, w, h, c], i) => {
        const pl = B.cx(G, w, h, 0.03, c, x, -0.2, 0.3 + (i ? -0.02 : 0), { tex: 'couro', rep: 1, linha: true, rx: -0.25 + i * 0.05, rz: x * 0.6, raio: 0.04 });
        fio(B, G, [[x - w * 0.4, -0.12 - i * 0.01, 0.31], [x - w * 0.4, -0.2, 0.31], [x - w * 0.4, -0.28, 0.3]], 0.006, osso);   // costura
        rebites(B, G, [[x - w * 0.45, -0.1, 0.32], [x + w * 0.45, -0.1, 0.32]], 3, 0.012, 0x8a6a3a);
      });
      B.cx(G, 0.4, 0.34, 0.03, couro2, 0, -0.1, -0.3, { tex: 'couro', rep: 1, rx: 0.3 });                       // tanga de trás
      ar(B, G, 0.28, 0.02, 0xa08a5a, 0, 0.02, 0.0, { rx: PI / 2 + 0.05, tex: 'tecido', linha: false, seg: 16, sx: 1.18 });   // corda
      for (const [x, ry] of [[-0.12, 0.3], [0.2, -0.2]]) {                                                         // crânios de ovelha pendurados
        const cr = B.grupo(G, x, -0.1, 0.34); cr.rotation.y = ry;
        bl(B, cr, 0.04, osso, 0, -0.04, 0, { tex: 'osso', rep: 1, sz: 1.2, seed: 70, linha: false });
        B.cone(cr, 0.02, 0.05, osso, 0, -0.07, 0.05, { rx: PI / 2, seg: 5, linha: false });
        for (const q of [-1, 1]) { B.esf(cr, 0.012, 0x1a1210, q * 0.02, -0.03, 0.035, { seg: 5, linha: false }); chifreCarneiro(B, cr, q, q * 0.03, -0.01, 0.0, 0.035, 1.2, 0.012, osso, { aneis: 0, linha: false, giro: 0.5, seg: 8, rad: 4 }); }
      }
      // colar de ossos e dentes
      const colar = [[-0.26, 0.74, 0.14], [-0.16, 0.62, 0.3], [0, 0.55, 0.36], [0.16, 0.62, 0.3], [0.26, 0.74, 0.14]];
      fio(B, G, colar, 0.006, couro2);
      const cc = new THREE.CatmullRomCurve3(colar.map(v3));
      for (let i = 0; i < 11; i++) { const P = cc.getPointAt((i + 0.5) / 11); const grande = i % 3 === 1; B.cone(G, grande ? 0.016 : 0.011, grande ? 0.09 : 0.06, osso, P.x, P.y - 0.04, P.z + 0.01, { rx: PI, seg: 5, linha: false }); }
      B.esf(G, 0.028, ouro, 0, 0.53, 0.37, { metal: 0.8, rough: 0.3, seg: 8, linha: false });

      /* --- cabeça com um olho gigante --- */
      bl(B, G, 0.13, pele, 0, 0.77, 0.12, { ...mp, seed: 11, linha: false });                                // pescoço grosso
      const cab = B.grupo(G, 0, 0.8, 0.16); cab.rotation.x = -0.55;
      bl(B, cab, 0.21, pele, 0, 0.13, -0.01, { ...mp, sy: 0.95, sz: 1.0, seed: 3, amp: 0.045, seg: 14 });                // crânio
      bl(B, cab, 0.12, pele, 0, 0.0, 0.1, { ...mp, sx: 1.1, sy: 0.9, sz: 1.0, seed: 12 });                                // bochechas
      fio(B, cab, [[-0.2, 0.25, 0.1], [-0.1, 0.275, 0.18], [0, 0.28, 0.2], [0.1, 0.275, 0.18], [0.2, 0.25, 0.1]], [0.04, 0.05, 0.055, 0.05, 0.04], peleEsc, { seg: 12 });   // sobrancelha única e pesada
      bl(B, cab, 0.05, peleEsc, -0.12, 0.25, 0.15, { ...mp, sx: 1.3, sy: 0.7, seed: 13, linha: false });
      bl(B, cab, 0.05, peleEsc, 0.12, 0.25, 0.15, { ...mp, sx: 1.3, sy: 0.7, seed: 14, linha: false });
      B.esf(cab, 0.108, 0x1a0e0e, 0, 0.15, 0.15, { sz: 0.8, seg: 12, linha: false });                              // órbita escura
      ar(B, cab, 0.105, 0.022, peleEsc, 0, 0.15, 0.175, { seg: 14, linha: false, tex: 'pele', rep: 1 });           // pálpebra/borda
      B.esf(cab, 0.094, 0xe8dcb0, 0, 0.15, 0.17, { seg: 14, linha: false });                                       // globo ocular
      B.esf(cab, 0.06, 0xffb830, 0, 0.15, 0.225, { sz: 0.45, emissive: 0xe08010, brilho: 1.3, seg: 12, linha: false });   // íris brilhante
      ar(B, cab, 0.058, 0.007, 0xb06010, 0, 0.15, 0.246, { seg: 14, linha: false });
      B.esf(cab, 0.03, 0x0a0606, 0, 0.15, 0.255, { sz: 0.5, seg: 10, linha: false });                              // pupila
      B.esf(cab, 0.011, 0xffffff, -0.02, 0.17, 0.265, { seg: 5, linha: false, emissive: 0xffffff });
      for (let i = 0; i < 12; i++) {                                                                               // veias vermelhas no olho
        const b = (i / 12) * PI * 2 + 0.2, pts = [];
        for (let k = 0; k < 4; k++) { const al = 0.62 + k * 0.2, w = 0.97 + (k % 2) * 0.012; pts.push([Math.sin(al) * Math.cos(b + k * 0.12) * 0.097 * w, 0.15 + Math.sin(al) * Math.sin(b + k * 0.12) * 0.097 * w, 0.17 + Math.cos(al) * 0.097 * w]); }
        fio(B, cab, pts, [0.004, 0.0025], 0xb02a2a, { seg: 6 });
      }
      bl(B, cab, 0.045, peleEsc, 0, -0.01, 0.2, { ...mp, sx: 1.3, sy: 0.9, sz: 1.1, seed: 15 });                      // nariz achatado
      for (const l of [-1, 1]) {
        B.esf(cab, 0.016, 0x140a08, l * 0.025, -0.02, 0.24, { seg: 5, linha: false });
        const orelha = bl(B, cab, 0.07, pele, l * 0.21, 0.08, -0.02, { ...mp, sx: 0.35, sy: 1.1, sz: 0.9, seed: 16 });
        B.esf(cab, 0.025, ouro, l * 0.23, 0.0, 0.0, { metal: 0.8, rough: 0.3, seg: 6, linha: false });               // brinco
        cicatriz(B, cab, [[l * 0.12, 0.28, 0.1], [l * 0.16, 0.2, 0.1], [l * 0.15, 0.1, 0.13]], cic, 0.007, 3);
        bl(B, cab, 0.015, peleCl, l * 0.1, 0.0, 0.2, { ...mp, seed: 17, linha: false });                              // verruga
      }
      bl(B, cab, 0.02, peleCl, -0.08, 0.31, 0.12, { ...mp, seed: 18, linha: false });
      // boca: mandíbula pesada com presas tortas e dentes irregulares
      const mand = B.grupo(cab, 0, -0.03, 0.04);
      B.tubo(mand, [[-0.14, 0.02, 0.0], [-0.1, -0.03, 0.12], [0, -0.06, 0.17], [0.1, -0.03, 0.12], [0.14, 0.02, 0.0]], [0.05, 0.05, 0.06, 0.05, 0.05], pele, { ...mp, seg: 10, rad: 8 });
      bl(B, mand, 0.05, peleEsc, 0, -0.08, 0.17, { ...mp, sx: 1.3, sz: 0.9, seed: 19 });
      for (let i = 0; i < 9; i++) { const t = i / 8 - 0.5, h = 0.025 + rnd() * 0.035; B.cone(mand, 0.014 + rnd() * 0.01, h, [0xd8c890, 0xb8a870, 0xe0d4a0][i % 3], t * 0.2, 0.0 + h / 2 + (i === 2 ? 0.02 : 0), 0.15 - Math.abs(t) * 0.1, { rx: (rnd() - 0.5) * 0.4, rz: (rnd() - 0.5) * 0.5, seg: 5, linha: false }); }
      for (const l of [-1, 1]) B.cone(mand, 0.02, 0.1, osso, l * 0.065, 0.03, 0.17, { rz: -l * 0.15, rx: -0.2, seg: 6, tex: 'osso', rep: 1 });   // presas
      B.esf(mand, 0.04, 0x8a3a3a, 0, 0.005, 0.1, { sx: 1.2, sy: 0.5, sz: 1.5, seg: 7, linha: false });
      for (let i = 0; i < 20; i++) { const t = rnd() * 2 - 1; tufo(B, mand, [t * 0.1, -0.07 - rnd() * 0.02, 0.1 + rnd() * 0.08], [0, -0.7, 0.4], 0.04, 0.008, pelo); }  // barba rala
      // cabelo ralo e desgrenhado
      pelagem(B, cab, [[-0.18, 0.2, -0.05], [-0.1, 0.3, -0.05], [0.1, 0.3, -0.05], [0.18, 0.2, -0.05], [0.16, 0.1, -0.15], [0, 0.18, -0.2], [-0.16, 0.1, -0.15]], [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2], 36, 0.16, [pelo, 0x2a1e16, 0x4a3828], 21, { solta: 0.6, cai: -0.6, larg: 0.014 });

      /* --- braços enormes --- */
      const bracos = [-1, 1].map(l => {
        const b = B.grupo(G, l * 0.38, 0.66, 0.02); b.rotation.x = l > 0 ? -0.8 : -1.2;
        if (l < 0) b.userData.fixo = -1.25;
        B.tubo(b, [[0, 0, 0], [l * 0.02, -0.15, 0.03], [0, -0.3, 0.06]], [0.17, 0.15, 0.11], pele, { ...mp, seg: 9, rad: 9 });
        bl(B, b, 0.12, peleEsc, l * 0.02, -0.12, 0.08, { ...mp, sy: 1.2, seed: 31 });                                // bíceps
        bl(B, b, 0.11, pele, l * 0.03, -0.14, -0.08, { ...mp, sy: 1.3, seed: 32 });                                  // tríceps
        B.tubo(b, [[0, -0.3, 0.06], [0, -0.45, 0.1], [0, -0.6, 0.12]], [0.115, 0.115, 0.08], pele, { ...mp, seg: 9, rad: 9 });
        bl(B, b, 0.09, peleEsc, 0, -0.42, 0.1, { ...mp, sy: 1.5, seed: 33 });                                        // antebraço
        fio(B, b, [[l * 0.13, -0.08, 0.06], [l * 0.15, -0.25, 0.08], [l * 0.1, -0.42, 0.12], [l * 0.06, -0.56, 0.13]], 0.009, veia);
        fio(B, b, [[l * 0.04, -0.1, 0.16], [l * 0.06, -0.22, 0.17], [l * 0.04, -0.34, 0.19]], 0.007, veia);
        cicatriz(B, b, [[l * 0.1, -0.35, 0.16], [l * 0.04, -0.45, 0.2], [0.0, -0.52, 0.19]], cic, 0.008, 4);
        pelagem(B, b, [[0, -0.32, 0.08], [0, -0.5, 0.12]], [0.11, 0.1], 8, 0.05, pelo, 80 + l, { solta: 0.8 });
        B.torno(b, [[0.1, -0.5], [0.115, -0.54], [0.1, -0.6]], l > 0 ? 0x8a6a3a : couro2, 0, 0, 0.12, { tex: l > 0 ? 'metal' : 'couro', rep: 2, metal: l > 0 ? 0.6 : 0, seg: 12, linha: false, rx: 0.1 });   // braçadeira
        const m = B.grupo(b, 0, -0.64, 0.13);
        bl(B, m, 0.11, pele, 0, -0.05, 0.02, { ...mp, sx: 1.0, sy: 0.9, seed: 5 });
        for (let k = 0; k < 4; k++) dedo(B, m, (k - 1.5) * 0.05, -0.1, 0.07, [(k - 1.5) * 0.12, -0.15, 0.9], 0.1, 0.027, pele, 0x4a3a28, { curv: 1.3, garra: 0.04 });
        dedo(B, m, l * 0.1, -0.03, 0.04, [l * 0.6, -0.25, 0.9], 0.08, 0.03, pele, 0x4a3a28, { curv: 1.0, garra: 0.035 });
        b.userData.mao = m;
        return b;
      });
      // tronco de árvore na mão direita (golpeia)
      const tr = B.grupo(bracos[1].userData.mao, 0, -0.06, 0.08); tr.rotation.x = 0.9; tr.rotation.z = -0.7;
      B.tubo(tr, [[0, -0.35, 0], [0.01, 0.0, 0.0], [0.03, 0.35, 0.02], [0.0, 0.7, 0.0], [0.04, 0.9, 0.03]], [0.055, 0.065, 0.1, 0.14, 0.17], 0x5a3e28, { tex: 'couro', rep: 3, rough: 0.95, relevo: 0.05, seg: 16, rad: 10 });
      bl(B, tr, 0.17, 0x4a3220, 0.04, 0.93, 0.03, { tex: 'couro', rep: 2, rough: 0.95, relevo: 0.04, amp: 0.2, seed: 41, seg: 12 });
      for (let k = 0; k < 4; k++) B.cone(tr, 0.04, 0.16, 0x6a4a30, (k % 2 ? 1 : -1) * 0.1, 0.45 + k * 0.17, (k - 1.5) * 0.08, { rz: (k % 2 ? -1 : 1) * 1.1, seg: 6, tex: 'couro', rep: 1, linha: false });   // tocos de galho
      for (let k = 0; k < 8; k++) tufo(B, tr, [Math.sin(k) * 0.14, 1.0 + (k % 3) * 0.05, Math.cos(k) * 0.14], [Math.sin(k), 0.5, Math.cos(k)], 0.12, 0.025, 0x5a3e28, { tex: 'couro', lados: 4 });   // lascas
      ar(B, tr, 0.14, 0.02, 0x7a7a82, 0, 0.7, 0, { rx: PI / 2, metal: 0.7, rough: 0.5, tex: 'metal', linha: false, seg: 12 });     // aro de ferro
      sobre(0, 0.92, 0.03, 0.2, 0.18, 0.2, 12, 77, n => n.y > -0.1).forEach(s => tufo(B, tr, s.p, s.n, 0.1, 0.02, 0x8a8a92, { tex: 'metal', metal: 0.6, rough: 0.4, rep: 1 }));   // pregos
      // rocha enorme na mão esquerda
      const rc = B.grupo(bracos[0].userData.mao, 0.0, -0.14, 0.1);
      bl(B, rc, 0.25, 0x7a7a82, 0, 0.12, 0.1, { tex: 'pedra', rep: 2, rough: 0.95, relevo: 0.1, amp: 0.3, freq: 1.6, seed: 9, seg: 14, sx: 1.05, sy: 0.9 });
      bl(B, rc, 0.12, 0x6a6a72, 0.1, 0.24, 0.14, { tex: 'pedra', rep: 1, relevo: 0.1, amp: 0.3, seed: 12, seg: 9, linha: true });
      sobre(0, 0.12, 0.1, 0.25, 0.22, 0.25, 4, 3, n => n.y > 0.3).forEach(s => bl(B, rc, 0.07, 0x4a6a3a, s.p[0], s.p[1], s.p[2], { tex: 'musgo', rep: 1, sy: 0.5, seed: 4, linha: false, seg: 8 }));      // musgo
      fio(B, rc, [[-0.15, 0.3, 0.3], [-0.08, 0.15, 0.37], [-0.12, 0.0, 0.34]], 0.007, 0x2a2a30);                                               // rachaduras
      fio(B, rc, [[0.1, 0.38, 0.22], [0.2, 0.25, 0.3], [0.24, 0.1, 0.28], [0.2, -0.02, 0.26]], 0.007, 0x2a2a30);
      fio(B, rc, [[-0.2, 0.2, 0.28], [-0.28, 0.12, 0.2]], 0.006, 0x2a2a30);

      /* --- pernas curtas, grossas e peludas --- */
      const pernas = [-1, 1].map(l => {
        const p = B.grupo(K0, l * 0.18, 0.64, 0.0);
        B.tubo(p, [[0, 0, 0], [0, -0.15, 0.03], [0, -0.3, 0.04]], [0.17, 0.15, 0.115], pele, { ...mp, seg: 9, rad: 9 });
        bl(B, p, 0.1, peleEsc, 0, -0.32, 0.07, { ...mp, seed: 41 });                                               // joelho
        B.tubo(p, [[0, -0.32, 0.04], [0, -0.45, 0.02], [0, -0.58, 0.03]], [0.115, 0.1, 0.09], pele, { ...mp, seg: 9, rad: 9 });
        bl(B, p, 0.085, peleEsc, 0, -0.42, -0.04, { ...mp, sy: 1.3, seed: 42 });                                   // panturrilha
        pelagem(B, p, [[0, -0.1, 0.03], [0, -0.3, 0.04], [0, -0.55, 0.03]], [0.15, 0.115, 0.09], 22, 0.08, pelo, 90 + l, { solta: 0.3, cai: -0.2, larg: 0.012 });
        bl(B, p, 0.12, pele, 0, -0.6, 0.1, { ...mp, sx: 1.0, sy: 0.55, sz: 1.5, seed: 43 });                        // pé
        for (let k = 0; k < 5; k++) {
          const x = (k - 2) * 0.05, f = k === 2 ? 1.15 : 1;
          bl(B, p, 0.036 * f, pele, x, -0.64, 0.24 - Math.abs(k - 2) * 0.02, { ...mp, sz: 1.2, seed: 44 + k, seg: 7, linha: false });
          B.cone(p, 0.022, 0.05, 0x8a7a50, x, -0.65, 0.29 - Math.abs(k - 2) * 0.025, { rx: PI / 2 - 0.2, seg: 5, linha: false, tex: 'osso', rep: 1 });   // unhas sujas
        }
        return p;
      });

      return {
        altura: 1.95,
        p: { tronco: G, cabeca: cab, bracoE: bracos[0], bracoD: bracos[1], pernaE: pernas[0], pernaD: pernas[1], mandibula: { g: mand, fechada: 0.05, aberta: 0.45 } },
      };
    },

    /* ===== MINOTAURO: touro-homem massivo, machado duplo de bronze, argola no focinho, vapor nas narinas ===== */
    minotauro(B, R) {
      const pele = 0x6a4028, peleEsc = 0x4a2a1a, peleCl = 0x8a5a3a, pelo = 0x2e1a10, pelo2 = 0x4a2c1a, focinho = 0xc09070, osso = 0xc4ae7a, couro = 0x4a2e1c, couro2 = 0x2e1c10, bronze = 0xb8862e, ferro = 0x7a7a84, hoof = 0x1a1410;
      const mp = { tex: 'pele', rep: 3, rough: 0.85, relevo: 0.014 }, mf = { tex: 'pelo', rep: 2, rough: 0.95 }, veia = 0x5a3040, cic = 0xc8a888, rnd = sem(41);
      enxuto(B);
      const K0 = B.grupo(R, 0, 0, 0); K0.scale.setScalar(1.1);
      const G = B.grupo(K0, 0, 0.72, -0.02); G.rotation.x = 0.3;

      /* --- tronco gigantesco --- */
      bl(B, G, 0.18, peleEsc, 0, 0, 0, { ...mp, sx: 1.3, sy: 0.85, seed: 2 });                                  // bacia
      B.tubo(G, [[0, 0, 0], [0, 0.17, 0.02], [0, 0.32, 0.0]], [0.16, 0.14, 0.2], pele, { ...mp, seg: 10, rad: 10 });
      bl(B, G, 0.24, pele, 0, 0.5, 0.0, { ...mp, sx: 1.3, sy: 0.95, sz: 0.88, seed: 4, amp: 0.05 });            // peito largo
      bl(B, G, 0.2, pele, 0, 0.74, -0.08, { ...mp, sx: 1.3, sy: 0.8, sz: 1.0, seed: 6 });                       // corcova de touro
      for (const l of [-1, 1]) {
        bl(B, G, 0.14, peleCl, l * 0.14, 0.55, 0.17, { ...mp, sx: 1.1, sy: 0.85, sz: 0.7, seed: 5 });           // peitoral
        bl(B, G, 0.15, peleEsc, l * 0.33, 0.7, 0.0, { ...mp, seed: 7 });                                        // deltoide
        bl(B, G, 0.11, peleEsc, l * 0.22, 0.38, 0.12, { ...mp, sx: 0.8, sy: 1.2, sz: 0.8, seed: 9, linha: false });
        bl(B, G, 0.12, peleEsc, l * 0.24, 0.5, -0.12, { ...mp, sx: 1.0, sy: 1.3, sz: 0.7, seed: 10 });          // dorsal
        for (let k = 0; k < 3; k++) bl(B, G, 0.044, mix(pele, peleCl, 0.3), l * 0.055, 0.1 + k * 0.08, 0.17 - k * 0.006, { ...mp, sx: 1.2, sy: 0.9, sz: 0.7, seed: 10 + k, linha: false });   // abdômen
        fio(B, G, [[l * 0.04, 0.45, 0.21], [l * 0.09, 0.4, 0.2], [l * 0.12, 0.36, 0.17]], 0.008, esc(peleEsc, 0.7));
        fio(B, G, [[l * 0.3, 0.55, 0.12], [l * 0.34, 0.44, 0.1], [l * 0.32, 0.34, 0.08]], 0.007, veia);
      }
      fio(B, G, [[0, 0.1, 0.19], [0, 0.3, 0.22], [0, 0.5, 0.22]], 0.007, esc(peleEsc, 0.7));
      fio(B, G, [[0, 0.8, -0.18], [0, 0.55, -0.22], [0, 0.3, -0.2], [0, 0.05, -0.15]], 0.01, esc(peleEsc, 0.65));
      cicatriz(B, G, [[0.2, 0.7, 0.14], [0.12, 0.58, 0.2], [0.05, 0.46, 0.23]], cic, 0.01, 5);              // cicatrizes de batalha
      cicatriz(B, G, [[-0.22, 0.5, 0.17], [-0.15, 0.4, 0.19]], cic, 0.008, 3);
      cicatriz(B, G, [[-0.16, 0.7, -0.15], [-0.1, 0.55, -0.22], [-0.05, 0.38, -0.22]], cic, 0.009, 4);
      // marcas de guerra pintadas de vermelho
      fio(B, G, [[-0.34, 0.74, 0.1], [-0.3, 0.66, 0.15], [-0.34, 0.6, 0.12]], 0.008, 0xa02020);
      fio(B, G, [[-0.2, 0.62, 0.2], [-0.16, 0.55, 0.22]], 0.008, 0xa02020);
      // pelagem: crina no pescoço/costas, peito
      sobre(0, 0.72, -0.08, 0.28, 0.24, 0.24, 36, 8, n => n.y > 0 && n.z < 0.6).forEach(s => tufo(B, G, s.p, [s.n[0] * 0.6, s.n[1] * 0.6, s.n[2] - 0.5], 0.09 + rnd() * 0.07, 0.018, [pelo, pelo2][Math.floor(rnd() * 2)]));
      sobre(0, 0.5, 0.0, 0.25, 0.26, 0.22, 24, 12, n => n.z > 0.45 && n.y > -0.1).forEach(s => tufo(B, G, s.p, [s.n[0] * 0.6, -0.5, s.n[2]], 0.06 + rnd() * 0.04, 0.014, pelo));
      sobre(0, 0.3, -0.05, 0.2, 0.3, 0.2, 14, 13, n => n.z < -0.3).forEach(s => tufo(B, G, s.p, [s.n[0], -0.7, s.n[2]], 0.07, 0.014, pelo));

      // saiote de tiras de couro, cinto com fivela de bronze e crânios
      B.torno(G, [[0.2, -0.06], [0.22, 0.0], [0.21, 0.06]], couro2, 0, 0.02, 0.0, { tex: 'couro', rep: 2, seg: 16, linha: false, sx: 1.2 });
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * PI * 2, c = Math.cos(a), s = Math.sin(a), h = 0.2 + rnd() * 0.1;
        B.cx(G, 0.1, h, 0.02, [couro, couro2, mix(couro, 0x8a6a3a, 0.3)][i % 3], s * 0.26 * 1.15, -0.1 - h / 2 + 0.02, c * 0.23, { tex: 'couro', rep: 1, ry: a, rx: -0.1, linha: i % 2 === 0 });
        B.esf(G, 0.01, bronze, s * 0.28 * 1.15, -0.04, c * 0.25, { seg: 5, linha: false, metal: 0.5 });
      }
      B.placa(G, 0.13, 0.1, 0.04, bronze, 0, 0.02, 0.24, { metal: 0.55, rough: 0.35, tex: 'metal', rep: 1, bisel: 0.012 });   // fivela
      B.esf(G, 0.025, 0xa02020, 0, 0.02, 0.275, { emissive: 0x802010, brilho: 0.5, seg: 6, linha: false });
      for (const x of [-0.22, 0.24]) {                                                                           // crânios pendurados no cinto
        const cr = B.grupo(G, x, -0.05, 0.2); cr.rotation.y = x > 0 ? 0.8 : -0.8;
        bl(B, cr, 0.035, osso, 0, -0.05, 0, { tex: 'osso', rep: 1, sz: 1.2, seed: 70, linha: false });
        for (const q of [-1, 1]) B.esf(cr, 0.01, 0x1a1210, q * 0.016, -0.04, 0.032, { seg: 5, linha: false });
        fio(B, cr, [[0, 0, 0], [0, -0.01, 0.0]], 0.006, couro);
      }
      // rabo com tufo
      const cauda = B.grupo(G, 0, 0.0, -0.17);
      B.tubo(cauda, [[0, 0, 0], [0, -0.1, -0.05], [0, -0.28, -0.04]], [0.03, 0.022, 0.012], pele, { ...mp, seg: 8, rad: 5 });
      for (let i = 0; i < 12; i++) tufo(B, cauda, [Math.sin(i) * 0.015, -0.3, -0.04 + Math.cos(i) * 0.015], [Math.sin(i) * 0.4, -1, Math.cos(i) * 0.4], 0.14, 0.03, pelo, { lados: 4 });

      /* --- pescoço grosso e cabeça de touro --- */
      B.tubo(G, [[0, 0.72, 0.0], [0, 0.82, 0.1], [0, 0.88, 0.2]], [0.15, 0.13, 0.12], pele, { ...mp, seg: 8, rad: 9 });
      const cab = B.grupo(G, 0, 0.88, 0.2); cab.rotation.x = -0.12;
      bl(B, cab, 0.17, pele, 0, 0.08, -0.01, { ...mp, sz: 1.05, seed: 3, amp: 0.04 });                                   // crânio
      bl(B, cab, 0.09, peleEsc, 0, 0.17, 0.08, { ...mp, sx: 1.7, sy: 0.7, sz: 0.9, seed: 4, linha: false });               // testa saliente
      B.tubo(cab, [[0, 0.08, 0.08], [0, 0.03, 0.2], [0, -0.01, 0.29]], [0.1, 0.085, 0.075], pele, { ...mp, seg: 10, rad: 9 });   // focinho
      bl(B, cab, 0.08, focinho, 0, -0.03, 0.31, { tex: 'pele', rep: 2, relevo: 0.02, sx: 1.2, sy: 0.85, sz: 0.85, seed: 5 });    // nariz úmido
      for (const l of [-1, 1]) {
        B.esf(cab, 0.016, 0x140806, l * 0.04, -0.015, 0.375, { seg: 6, linha: false, sz: 0.7 });                         // narinas
        fio(B, cab, [[l * 0.015, -0.015, 0.375], [l * 0.07, -0.04, 0.34]], 0.005, 0x4a2a20);
        fio(B, cab, [[l * 0.11, 0.22, 0.04], [l * 0.085, 0.19, 0.12], [l * 0.04, 0.16, 0.155]], [0.022, 0.026, 0.02], peleEsc, { seg: 6 });   // sobrancelha
        B.esf(cab, 0.034, 0x1a0806, l * 0.09, 0.13, 0.115, { sz: 0.7, seg: 8, linha: false });
        B.esf(cab, 0.028, 0xff2a10, l * 0.09, 0.13, 0.125, { emissive: 0xff2a10, brilho: 1.4, seg: 9, linha: false });       // olho vermelho
        B.esf(cab, 0.012, 0x0a0404, l * 0.09, 0.13, 0.15, { seg: 5, linha: false });
        const o1 = pena(B, cab, [l * 0.15, 0.13, -0.02], [l * 1, -0.35, -0.3], 0.2, 0.065, pele, { tex: 'pele', rep: 1, curva: 0.25, esp: 0.016, linha: true });   // orelha de touro
        pena(B, cab, [l * 0.155, 0.125, -0.01], [l * 1, -0.35, -0.3], 0.15, 0.04, 0xb87868, { tex: 'pele', rep: 1, curva: 0.25, esp: 0.02 });
        ar(B, cab, 0.012, 0.004, bronze, l * 0.3, 0.0, -0.1, { rz: PI / 2, ry: 0.5, metal: 0.55, linha: false, seg: 8 });   // argola de ouro na orelha
        cicatriz(B, cab, [[l * 0.04, 0.2, 0.12], [l * 0.075, 0.1, 0.17], [l * 0.06, 0.02, 0.2]], cic, 0.006, 3);
        pelagem(B, cab, [[l * 0.12, 0.1, 0.06], [l * 0.1, -0.02, 0.12]], [0.08, 0.07], 5, 0.06, pelo, 91 + l, { solta: 1.0 });   // bochechas
        // chifres gigantes: curvam para fora, para cima e para a frente
        const hx = l * 0.1;
        B.tubo(cab, [[hx, 0.2, 0.0], [l * 0.22, 0.22, -0.02], [l * 0.34, 0.3, 0.02], [l * 0.4, 0.45, 0.12], [l * 0.36, 0.6, 0.24]], [0.062, 0.056, 0.044, 0.03, 0.016], osso, { tex: 'osso', rep: 3, rough: 0.5, seg: 22, rad: 8, linha: true, fino: true });
        B.tubo(cab, [[l * 0.4, 0.45, 0.12], [l * 0.36, 0.6, 0.24], [l * 0.31, 0.69, 0.33]], [0.03, 0.018, 0.003], 0x1e1612, { tex: 'osso', rep: 1, seg: 8, rad: 6 });   // ponta escura
        for (let k = 0; k < 4; k++) {                                                                                       // anéis e rachaduras no chifre
          const t = 0.1 + k * 0.17, px = hx + (l * 0.4 - hx) * t * 1.1, py = 0.2 + t * 0.35, pz = 0.0 + t * 0.1;
          ar(B, cab, 0.055 - k * 0.006, 0.006, esc(osso, 0.7), l * (0.14 + k * 0.045), 0.21 + k * 0.04, -0.015 + k * 0.01, { ry: PI / 2 - l * 0.2, rz: l * 0.3, seg: 8, linha: false, tex: 'osso', rep: 1 });
        }
        ar(B, cab, 0.06, 0.016, bronze, l * 0.2, 0.215, -0.02, { ry: PI / 2 - l * 0.1, rz: l * 0.4, metal: 0.55, rough: 0.3, seg: 10, linha: false });   // bandas de bronze
        fio(B, cab, [[l * 0.3, 0.27, 0.0], [l * 0.34, 0.33, 0.05], [l * 0.37, 0.4, 0.09]], 0.004, 0x3a2a1a);
      }
      ar(B, cab, 0.055, 0.011, ferro, 0, -0.11, 0.35, { ry: PI / 2, metal: 0.55, rough: 0.4, tex: 'metal', seg: 14, linha: false });   // argola de ferro no focinho
      ar(B, cab, 0.04, 0.008, ferro, 0, -0.18, 0.35, { metal: 0.55, rough: 0.4, seg: 10, linha: false });
      // boca
      const mand = B.grupo(cab, 0, -0.02, 0.06);
      B.tubo(mand, [[-0.07, 0.0, 0.0], [-0.07, -0.03, 0.12], [0, -0.045, 0.22], [0.07, -0.03, 0.12], [0.07, 0.0, 0.0]], [0.04, 0.05, 0.055, 0.05, 0.04], pele, { ...mp, seg: 10, rad: 7 });
      bl(B, mand, 0.04, focinho, 0, -0.05, 0.23, { tex: 'pele', rep: 1, sx: 1.3, sz: 0.9, seed: 8, linha: false });
      B.dentes(mand, 7, 0.1, 0.022, 0xe0d4b0, 0, 0.0, 0.17, { rx: 0.0001 });
      B.dentes(cab, 7, 0.1, 0.022, 0xe0d4b0, 0, -0.005, 0.2, {});
      for (const l of [-1, 1]) B.cone(mand, 0.016, 0.07, osso, l * 0.05, 0.02, 0.2, { rx: -0.1, seg: 5, linha: false, tex: 'osso', rep: 1 });   // presas de baixo
      B.esf(mand, 0.04, 0xa03a3a, 0, -0.01, 0.12, { sx: 1.1, sy: 0.5, sz: 1.5, seg: 7, linha: false });
      // topete encaracolado entre os chifres
      for (let i = 0; i < 5; i++) bl(B, cab, 0.045, [pelo, pelo2][i % 2], (i - 2) * 0.04, 0.24 - Math.abs(i - 2) * 0.01, 0.0 - (i % 2) * 0.03, { ...mf, amp: 0.25, sy: 0.9, seed: 20 + i, seg: 8, linha: false });
      // vapor das narinas (partículas vivas)
      const vapor = [];
      for (const l of [-1, 1]) for (let k = 0; k < 3; k++) {
        const pf = B.vivo(B.esf(cab, 0.035, 0xe8ecf4, l * 0.04, -0.015, 0.38, { op: 0.3 + k * 0.01 + (l > 0 ? 0.001 : 0), seg: 7, linha: false, rough: 1 }));
        vapor.push({ m: pf, l, k });
      }

      /* --- braços colossais --- */
      const bracos = [-1, 1].map(l => {
        const b = B.grupo(G, l * 0.39, 0.7, 0.0); b.rotation.x = l > 0 ? -0.9 : -0.4;
        B.tubo(b, [[0, 0, 0], [l * 0.02, -0.14, 0.03], [0, -0.28, 0.06]], [0.15, 0.14, 0.1], pele, { ...mp, seg: 9, rad: 9 });
        bl(B, b, 0.11, peleEsc, l * 0.02, -0.1, 0.07, { ...mp, sy: 1.25, seed: 31 });
        bl(B, b, 0.1, pele, l * 0.03, -0.13, -0.07, { ...mp, sy: 1.3, seed: 32 });
        B.tubo(b, [[0, -0.28, 0.06], [0, -0.42, 0.1], [0, -0.55, 0.11]], [0.1, 0.1, 0.07], pele, { ...mp, seg: 9, rad: 8 });
        bl(B, b, 0.08, peleEsc, 0, -0.38, 0.1, { ...mp, sy: 1.5, seed: 33 });
        fio(B, b, [[l * 0.11, -0.06, 0.06], [l * 0.13, -0.22, 0.08], [l * 0.09, -0.38, 0.12], [l * 0.05, -0.5, 0.12]], 0.009, veia);
        fio(B, b, [[l * 0.03, -0.1, 0.14], [l * 0.05, -0.2, 0.15], [l * 0.03, -0.3, 0.17]], 0.007, veia);
        pelagem(B, b, [[0, -0.3, 0.07], [0, -0.5, 0.11]], [0.1, 0.08], 9, 0.06, pelo, 81 + l, { solta: 0.7 });
        // pulseira de couro e bronze
        B.torno(b, [[0.085, -0.43], [0.1, -0.48], [0.085, -0.56]], couro, 0, 0, 0.12, { tex: 'couro', rep: 2, seg: 12, linha: false, rx: 0.1 });
        B.torno(b, [[0.088, -0.47], [0.1, -0.5], [0.09, -0.53]], bronze, 0, 0, 0.12, { tex: 'metal', metal: 0.55, rough: 0.3, rep: 1, seg: 12, linha: false, rx: 0.1 });
        const m = B.grupo(b, 0, -0.6, 0.12);
        bl(B, m, 0.095, pele, 0, -0.05, 0.02, { ...mp, seed: 5 });
        for (let k = 0; k < 4; k++) dedo(B, m, (k - 1.5) * 0.045, -0.09, 0.06, [(k - 1.5) * 0.12, -0.15, 0.9], 0.09, 0.024, pele, 0x2a1a10, { curv: 1.3, garra: 0.035 });
        dedo(B, m, l * 0.09, -0.03, 0.04, [l * 0.6, -0.25, 0.9], 0.07, 0.027, pele, 0x2a1a10, { curv: 1.0, garra: 0.03 });
        b.userData.mao = m;
        return b;
      });
      // ombreira de couro e metal com espetos no ombro esquerdo
      const ombro = B.grupo(bracos[0], -0.02, 0.05, 0.0);
      B.torno(ombro, [[0.24, 0.0], [0.22, 0.09], [0.15, 0.15], [0.0, 0.17]], couro, 0, 0, 0, { tex: 'couro', rep: 2, seg: 14, rx: 0, rz: 0.35, sy: 0.85, dupla: false });
      ar(B, ombro, 0.2, 0.025, bronze, -0.04, 0.0, 0.0, { rx: PI / 2, rz: 0, metal: 0.55, rough: 0.3, tex: 'metal', seg: 14, sx: 1.0, sy: 1.0, linha: true });
      for (let i = 0; i < 5; i++) { const a = i * 0.5 - 1.0; B.cone(ombro, 0.035, 0.16, ferro, Math.sin(a) * 0.16 - 0.12, 0.17 + Math.cos(a) * 0.04, Math.cos(a) * 0.16, { rx: Math.cos(a) * 0.9, rz: 0.4 + Math.sin(a) * 0.6, seg: 6, metal: 0.5, tex: 'metal', rep: 1, linha: false }); }
      rebites(B, ombro, [[-0.2, 0.08, 0.0], [-0.12, 0.17, 0.06], [-0.04, 0.2, 0.0]], 4, 0.014, bronze);
      // corrente quebrada e grilhão no pulso esquerdo
      ar(B, bracos[0], 0.1, 0.02, ferro, 0, -0.58, 0.12, { rx: PI / 2 + 0.1, metal: 0.55, rough: 0.5, tex: 'metal', seg: 12, linha: false });
      corrente(B, bracos[0], [[-0.08, -0.62, 0.14], [-0.14, -0.72, 0.12], [-0.12, -0.84, 0.1], [-0.08, -0.94, 0.14]], 6, 0.011, ferro);

      // machado duplo gigante de bronze (labrys)
      const mx = B.grupo(bracos[1].userData.mao, 0, -0.05, 0.06); mx.rotation.x = 1.0; mx.rotation.z = -0.65; mx.scale.setScalar(0.82);
      B.tubo(mx, [[0, -0.4, 0], [0.003, 0, 0], [0.0, 0.5, 0.0], [0.0, 0.95, 0.0]], [0.032, 0.032, 0.032, 0.03], 0x6a4a2a, { tex: 'couro', rep: 3, rough: 0.9, seg: 10, rad: 7, linha: true });
      B.tubo(mx, [[0, -0.05, 0], [0, 0.18, 0]], [0.04, 0.04], couro2, { tex: 'couro', rep: 2, seg: 6, rad: 7, linha: false });   // empunhadura enrolada
      B.cone(mx, 0.03, 0.12, ferro, 0, -0.46, 0, { rx: PI, seg: 6, metal: 0.5, tex: 'metal', rep: 1 });                    // ponteira
      B.cone(mx, 0.035, 0.18, ferro, 0, 1.06, 0, { seg: 6, metal: 0.5, tex: 'metal', rep: 1 });                              // espeto no topo
      B.cil(mx, 0.05, 0.05, 0.1, bronze, 0, 0.95, 0, { metal: 0.55, rough: 0.35, tex: 'metal', rep: 1, seg: 10 });          // cubo da lâmina
      const lamina = (lado) => {
        const sh = new THREE.Shape();
        sh.moveTo(0.04, 0.09); sh.bezierCurveTo(0.14, 0.12, 0.26, 0.27, 0.42, 0.36); sh.quadraticCurveTo(0.3, 0.14, 0.31, 0.0);
        sh.quadraticCurveTo(0.3, -0.14, 0.42, -0.36); sh.bezierCurveTo(0.26, -0.27, 0.14, -0.12, 0.04, -0.09); sh.lineTo(0.04, 0.09);
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 1, curveSegments: 3 });
        g.translate(0, 0, -0.0225);
        if (lado < 0) {                               // espelha a lâmina e inverte o sentido das faces
          g.scale(-1, 1, 1);
          for (const nome of ['position', 'normal', 'uv']) { const a = g.attributes[nome], n = a.itemSize; for (let i = 0; i < a.count; i += 3) for (let k = 0; k < n; k++) { const x = a.array[(i + 1) * n + k]; a.array[(i + 1) * n + k] = a.array[(i + 2) * n + k]; a.array[(i + 2) * n + k] = x; } }
        }
        const gr = B.grupo(mx, 0, 0.95, 0), m = gr;
        mala(B, gr, g, bronze, 0, 0, 0, { metal: 0.55, rough: 0.35, tex: 'metal', rep: 1, relevo: 0.03, dupla: true });
        // fio de aço, gravuras e entalhes da lâmina
        fio(B, m, [[0.42 * lado, 0.36, 0.03], [0.31 * lado, 0.14, 0.03], [0.31 * lado, 0.0, 0.03], [0.31 * lado, -0.14, 0.03], [0.42 * lado, -0.36, 0.03]], 0.008, 0xd8dce4, { rough: 0.3, metal: 0.6 });
        fio(B, m, [[0.08 * lado, 0.0, 0.03], [0.2 * lado, 0.0, 0.03], [0.26 * lado, 0.0, 0.03]], 0.006, 0x4a3818);
        fio(B, m, [[0.1 * lado, 0.06, 0.03], [0.2 * lado, 0.12, 0.03], [0.27 * lado, 0.22, 0.03]], 0.005, 0x4a3818);
        fio(B, m, [[0.1 * lado, -0.06, 0.03], [0.2 * lado, -0.12, 0.03], [0.27 * lado, -0.22, 0.03]], 0.005, 0x4a3818);
        for (const y of [0.16, -0.16]) B.esf(m, 0.012, 0x3a2a14, 0.15 * lado, y * 0.5, 0.03, { seg: 5, linha: false });
        B.cone(m, 0.02, 0.05, 0x3a2a14, 0.31 * lado, 0.07, 0.0, { rz: -lado * PI / 2, seg: 4, linha: false });     // lasca na lâmina
        return m;
      };
      lamina(1); lamina(-1);
      ar(B, mx, 0.05, 0.012, 0xa02020, 0, 0.5, 0.0, { rx: PI / 2, seg: 8, linha: false });                                   // faixa vermelha
      corrente(B, mx, [[0.0, 0.45, 0.04], [0.06, 0.38, 0.08], [0.05, 0.28, 0.12]], 3, 0.007, ferro);
      B.tubo(mx, [[0, 0.52, 0], [0.04, 0.4, 0.0], [0.07, 0.3, 0.02]], [0.012, 0.01, 0.006], 0xa02020, { seg: 6, rad: 4, linha: false });   // fita

      /* --- pernas fortes de touro: coxas grossas, caneleiras de bronze, cascos --- */
      const pernas = [-1, 1].map(l => {
        const p = B.grupo(K0, l * 0.19, 0.7, 0.0);
        B.tubo(p, [[0, 0, 0], [0, -0.15, 0.04], [0, -0.3, 0.07]], [0.16, 0.14, 0.1], pele, { ...mp, seg: 9, rad: 9 });
        bl(B, p, 0.12, peleEsc, 0, -0.1, 0.01, { ...mp, sy: 1.3, seed: 33 });
        bl(B, p, 0.08, peleEsc, 0, -0.32, 0.09, { ...mp, seed: 34 });
        B.tubo(p, [[0, -0.32, 0.07], [0, -0.46, 0.0], [0, -0.55, -0.04]], [0.1, 0.075, 0.055], pele, { ...mp, seg: 8, rad: 8 });
        B.tubo(p, [[0, -0.55, -0.04], [0, -0.64, 0.02], [0, -0.7, 0.06]], [0.055, 0.04, 0.04], peleEsc, { ...mp, seg: 8, rad: 7 });
        pelagem(B, p, [[0, 0, 0], [0, -0.15, 0.04], [0, -0.3, 0.07], [0, -0.46, 0.0], [0, -0.58, -0.02]], [0.15, 0.14, 0.1, 0.08, 0.06], 28, 0.1, [pelo, pelo2], 100 + l, { solta: 0.3, cai: -0.1, larg: 0.012 });
        // caneleira de bronze com rebites
        B.torno(p, [[0.075, -0.42], [0.095, -0.46], [0.085, -0.52], [0.065, -0.58]], bronze, 0, 0, 0.0, { tex: 'metal', metal: 0.55, rough: 0.35, rep: 1, seg: 10, rz: 0, rx: 0.0, linha: true });
        rebites(B, p, [[-0.07, -0.46, 0.08], [0, -0.46, 0.1], [0.07, -0.46, 0.08]], 3, 0.01, 0xd8a63a);
        for (const q of [-1, 1]) {
          bl(B, p, 0.055, hoof, q * 0.03, -0.75, 0.1, { tex: 'osso', rep: 1, sx: 0.6, sy: 0.7, sz: 1.7, seed: 36, seg: 8, rough: 0.35, linha: true });
          B.cone(p, 0.04, 0.08, hoof, q * 0.03, -0.72, 0.17, { rx: PI / 2 + 0.2, seg: 5, linha: false });
        }
        return p;
      });

      return {
        altura: 1.95,
        p: { tronco: G, cabeca: cab, bracoE: bracos[0], bracoD: bracos[1], pernaE: pernas[0], pernaD: pernas[1], cauda, mandibula: { g: mand, fechada: 0.04, aberta: 0.5 } },
        // vapor: bolinhas que sobem das narinas e somem
        anim: (t) => {
          vapor.forEach(({ m, l, k }) => {
            const u = ((t * 0.5 + k / 3) % 1), e = Math.sin(u * PI);
            m.position.set(l * 0.04 + l * u * 0.03, -0.015 + u * 0.1 - u * u * 0.03, 0.38 + u * 0.22);
            m.scale.setScalar(0.3 + e * 0.6 + u * 0.5);
            m.visible = e > 0.08;
          });
        },
      };
    },

    /* ===== ARES (CHEFE): deus da guerra, armadura de bronze e vermelho com espinhos, elmo de crista alta, capa, espada e escudo, aura rubra ===== */
    ares(B, R) {
      const bronze = 0x9a642a, bronzeEsc = 0x6a3e16, ouro = 0xd8a63a, laca = 0x8e1814, verm = 0x9a1c18, vermEsc = 0x5a0e0c, aco = 0xc4c8d4, couro = 0x4a2418, osso = 0xd8c8a0, brasa = 0xff4a1a, pano = 0x2a1418;
      const mt = { tex: 'metal', rep: 1, metal: 0.42, rough: 0.48, relevo: 0.025 }, mv = { tex: 'tecido', rep: 2, rough: 0.9 }, ml = { tex: 'couro', rep: 1, rough: 0.8 };
      const rnd = sem(77);
      enxuto(B);
      const K0 = B.grupo(R, 0, 0, 0); K0.scale.setScalar(1.12);
      const G = B.grupo(K0, 0, 0.82, 0); G.rotation.x = 0.1;

      /* --- tronco: couraça musculosa de bronze --- */
      B.tubo(G, [[0, 0, 0], [0, 0.18, 0], [0, 0.36, 0]], [0.17, 0.16, 0.2], pano, { ...mv, seg: 8, rad: 10 });
      bl(B, G, 0.17, pano, 0, 0.0, 0, { ...mv, sx: 1.25, sy: 0.8, seed: 2 });
      B.torno(G, [[0.2, 0.0], [0.235, 0.12], [0.3, 0.3], [0.31, 0.46], [0.24, 0.56], [0.12, 0.58]], laca, 0, 0.0, 0, { ...mt, seg: 16, sx: 1.12, sz: 0.82 });   // couraça
      for (const l of [-1, 1]) {
        bl(B, G, 0.13, mix(laca, bronze, 0.25), l * 0.125, 0.4, 0.2, { ...mt, sx: 1.05, sy: 0.9, sz: 0.55, seed: 5, seg: 10 });               // peitoral esculpido
        for (let k = 0; k < 3; k++) bl(B, G, 0.05, mix(laca, bronze, 0.4), l * 0.055, 0.1 + k * 0.09, 0.2 - k * 0.003, { ...mt, sx: 1.2, sy: 0.9, sz: 0.5, seed: 10 + k, linha: false, seg: 8 });   // abdômen de bronze
        fio(B, G, [[l * 0.05, 0.5, 0.215], [l * 0.17, 0.5, 0.2], [l * 0.26, 0.46, 0.14]], 0.006, bronzeEsc);
        fio(B, G, [[l * 0.3, 0.5, 0.1], [l * 0.31, 0.35, 0.08], [l * 0.27, 0.2, 0.08]], [0.012, 0.012], ouro, { metal: 0.6 });  // filete de ouro
        rebites(B, G, [[l * 0.27, 0.54, 0.05], [l * 0.29, 0.42, 0.08], [l * 0.26, 0.28, 0.1]], 3, 0.012, ouro);
      }
      fio(B, G, [[0, 0.08, 0.255], [0, 0.3, 0.26], [0, 0.5, 0.235]], 0.01, bronzeEsc);
      // medalhão com a cabeça do lobo da guerra
      ar(B, G, 0.07, 0.014, ouro, 0, 0.34, 0.265, { metal: 0.6, rough: 0.35, seg: 14, linha: false });
      B.esf(G, 0.06, verm, 0, 0.34, 0.25, { sz: 0.4, seg: 10, emissive: 0x600808, brilho: 0.5, linha: false });
      for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; B.cone(G, 0.014, 0.06, ouro, Math.sin(a) * 0.09, 0.34 + Math.cos(a) * 0.09, 0.265, { rz: -a, seg: 4, metal: 0.6, linha: false }); }
      // gola de espinhos e proteção do pescoço
      B.torno(G, [[0.13, 0.54], [0.14, 0.6], [0.11, 0.68]], bronze, 0, 0, 0, { ...mt, seg: 12, sz: 0.9 });
      for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2; B.cone(G, 0.02, 0.1, bronzeEsc, Math.sin(a) * 0.15, 0.62, Math.cos(a) * 0.13, { rx: Math.cos(a) * 0.5, rz: -Math.sin(a) * 0.5, seg: 5, metal: 0.5, linha: false }); }
      B.tubo(G, [[0, 0.58, 0], [0, 0.65, 0.02], [0, 0.72, 0.04]], [0.07, 0.065, 0.06], 0xc89a78, { tex: 'pele', rep: 2, relevo: 0.01, seg: 6, rad: 7 });   // pescoço

      // cinto, pteruges (tiras de couro vermelho com ponteiras de bronze), crânios e correntes
      B.torno(G, [[0.2, -0.045], [0.225, 0.0], [0.215, 0.05]], vermEsc, 0, 0.02, 0, { ...ml, seg: 14, sx: 1.1, sz: 0.9 });
      B.cx(G, 0.15, 0.1, 0.05, ouro, 0, 0.02, 0.215, { ...mt, bisel: 0.012 });
      bl(B, G, 0.035, osso, 0, 0.02, 0.255, { tex: 'osso', rep: 1, sz: 0.8, seed: 70, linha: false, seg: 8 });
      for (const l of [-1, 1]) B.esf(G, 0.01, 0x100808, l * 0.014, 0.025, 0.285, { seg: 5, linha: false });
      for (let r = 0; r < 2; r++) for (let i = 0; i < 12; i++) {
        const a = (i / 12) * PI * 2 + r * 0.26, c = Math.cos(a), s = Math.sin(a), h = 0.2 + r * 0.04 + rnd() * 0.04, rad = 0.255 + r * 0.02;
        const g = B.grupo(G, s * rad * 1.06, -0.04 - r * 0.03, c * rad * 0.9); g.rotation.y = a; g.rotation.x = -0.18 - r * 0.05;
        B.cx(g, 0.1, h, 0.018, r ? vermEsc : verm, 0, -h / 2, 0, { ...ml, linha: i % 2 === 0 });
        B.cx(g, 0.1, 0.03, 0.026, bronze, 0, -h, 0, { ...mt, linha: false });                              // ponteira de bronze
        B.esf(g, 0.011, ouro, 0, -0.05, 0.013, { seg: 5, linha: false });
      }
      corrente(B, G, [[-0.2, 0.0, 0.2], [-0.24, -0.1, 0.22], [-0.2, -0.18, 0.2]], 4, 0.007, aco, { mat: { metal: 0.5 } });
      bl(B, G, 0.03, osso, -0.2, -0.22, 0.2, { tex: 'osso', rep: 1, sz: 1.1, seed: 71, linha: false, seg: 7 });

      /* --- cabeça: elmo de crista alta com viseira e olhos em chamas --- */
      const cab = B.grupo(G, 0, 0.72, 0.04);
      bl(B, cab, 0.15, 0xc89a78, 0, 0.1, 0.0, { tex: 'pele', rep: 2, relevo: 0.01, sx: 0.9, seed: 3, linha: false, seg: 9 });   // rosto sob o elmo
      bl(B, cab, 0.185, bronze, 0, 0.16, -0.015, { ...mt, sy: 1.08, sz: 1.08, seed: 8, amp: 0.025, seg: 12 });               // calota do elmo
      B.cx(cab, 0.3, 0.07, 0.26, bronzeEsc, 0, 0.0, 0.0, { ...mt, linha: false, rx: 0 });
      B.cx(cab, 0.26, 0.05, 0.1, 0x120808, 0, 0.14, 0.15, { linha: false, rough: 0.9 });                                       // fenda da viseira
      for (const l of [-1, 1]) {
        B.esf(cab, 0.026, 0xffd060, l * 0.06, 0.14, 0.16, { sz: 0.7, emissive: brasa, brilho: 2.0, seg: 8, linha: false });  // olhos em chamas
        B.cx(cab, 0.07, 0.2, 0.025, bronze, l * 0.16, 0.06, 0.06, { ...mt, ry: l * 0.7, raio: 0.03, bisel: 0.01 });           // guarda das bochechas
        B.cone(cab, 0.03, 0.14, bronzeEsc, l * 0.195, 0.05, 0.02, { rz: -l * 1.2, seg: 5, metal: 0.5, linha: false });          // espinho lateral
        for (let k = 0; k < 4; k++) pena(B, cab, [l * 0.17, 0.2 + k * 0.012, -0.02], [l * 1.0, 0.3 + k * 0.3, -0.5 - k * 0.2], 0.2 + k * 0.03, 0.04, k % 2 ? bronze : ouro, { tex: 'metal', rep: 1, metal: 0.4, rough: 0.4, curva: -0.2, esp: 0.012, linha: false });   // asas do elmo
      }
      B.cx(cab, 0.03, 0.2, 0.05, bronze, 0, 0.08, 0.17, { ...mt, linha: true });                                               // protetor do nariz
      for (let k = 0; k < 5; k++) B.cx(cab, 0.012, 0.09, 0.012, 0x120808, (k - 2) * 0.035, -0.02, 0.15, { linha: false });         // grelha da boca
      B.cx(cab, 0.2, 0.06, 0.04, bronzeEsc, 0, -0.07, 0.12, { ...mt, bisel: 0.012, rx: 0.3, linha: false });                 // queixo
      // crista alta de crina vermelha + espinho
      B.tubo(cab, [[0, 0.3, 0.14], [0, 0.4, 0.04], [0, 0.4, -0.1], [0, 0.3, -0.19]], [0.02, 0.02, 0.02, 0.02], bronzeEsc, { ...mt, seg: 10, rad: 5, linha: false });
      for (let i = 0; i < 26; i++) {
        const t = i / 25, a = PI * (0.12 + t * 0.78);
        const px = 0, py = 0.22 + Math.sin(a) * 0.22, pz = 0.17 - t * 0.38;
        pena(B, cab, [px, py, pz], [0, Math.cos(a * 0.8) * 0.7 + 0.8, -Math.sin(a * 0.6) * 0.5 - 0.15], 0.2 + Math.sin(t * PI) * 0.16 + rnd() * 0.04, 0.032, [verm, vermEsc, 0xb82a20][i % 3], { tex: 'pelo', rep: 1, curva: 0.35, roll: (rnd() - 0.5) * 0.4 });
      }
      for (let i = 0; i < 10; i++) pena(B, cab, [(rnd() - 0.5) * 0.04, 0.24, -0.15 - i * 0.012], [(rnd() - 0.5) * 0.4, -0.25 - i * 0.05, -0.8], 0.26 + rnd() * 0.12, 0.03, [verm, vermEsc][i % 2], { tex: 'pelo', rep: 1, curva: 0.4 });   // rabo de cavalo caindo
      // chamas dos olhos (partículas vivas)
      const chamas = [];
      for (const l of [-1, 1]) for (let k = 0; k < 2; k++) {
        const c = B.vivo(B.cone(cab, 0.03, 0.11, 0xff7a20, l * 0.06, 0.2, 0.15, { op: 0.5 + k * 0.01 + (l > 0 ? 0.001 : 0), emissive: brasa, brilho: 1.5, seg: 5, linha: false }));
        chamas.push({ m: c, l, k });
      }

      /* --- braços blindados --- */
      const bracos = [-1, 1].map(l => {
        const b = B.grupo(G, l * 0.42, 0.5, 0.0); b.rotation.x = l > 0 ? -0.6 : -0.3;
        B.tubo(b, [[0, 0, 0], [0, -0.14, 0.01], [0, -0.28, 0.03]], [0.085, 0.08, 0.07], pano, { ...mv, seg: 7, rad: 8 });
        B.torno(b, [[0.1, -0.24], [0.105, -0.12], [0.095, -0.02]], bronze, 0, 0, 0.0, { ...mt, seg: 10, linha: true });         // braçal
        B.esf(b, 0.075, bronze, 0, -0.3, 0.04, { ...mt, seg: 9 });                                                              // cotoveleira
        B.cone(b, 0.032, 0.16, bronzeEsc, l * 0.04, -0.31, -0.07, { rx: -PI / 2 - 0.2, seg: 5, metal: 0.5, linha: false });     // espinho do cotovelo
        B.tubo(b, [[0, -0.3, 0.04], [0, -0.42, 0.07], [0, -0.54, 0.08]], [0.07, 0.065, 0.055], pano, { ...mv, seg: 7, rad: 8 });
        B.torno(b, [[0.052, -0.56], [0.075, -0.46], [0.085, -0.34]], bronze, 0, 0, 0.065 * 0 + 0.045, { ...mt, seg: 10, rx: 0.13 });   // manopla do antebraço
        for (let k = 0; k < 2; k++) ar(B, b, 0.08 - k * 0.008, 0.008, ouro, 0, -0.38 - k * 0.07, 0.06 + k * 0.012, { rx: PI / 2 + 0.13, metal: 0.6, seg: 10, linha: false });
        const m = B.grupo(b, 0, -0.58, 0.085);
        bl(B, m, 0.06, bronze, 0, -0.04, 0.01, { ...mt, sx: 1.0, sy: 0.9, seed: 5, seg: 8 });
        for (let k = 0; k < 4; k++) { B.cx(m, 0.03, 0.06, 0.03, bronzeEsc, (k - 1.5) * 0.034, -0.09, 0.03, { ...mt, rx: -0.5, linha: false }); B.cone(m, 0.012, 0.045, aco, (k - 1.5) * 0.034, -0.14, 0.055, { rx: PI / 2 - 0.5, seg: 4, metal: 0.6, linha: false }); }   // dedos de aço com garras
        for (let k = 0; k < 3; k++) B.cone(m, 0.014, 0.05, bronzeEsc, (k - 1) * 0.04, -0.03, 0.08, { rx: PI / 2, seg: 4, metal: 0.5, linha: false });   // espinhos nos nós dos dedos
        b.userData.mao = m;
        return b;
      });
      // ombreiras gigantes com lâminas sobrepostas e espinhos
      for (const [i, l] of [[0, -1], [1, 1]]) {
        const b = bracos[i], o = B.grupo(b, l * 0.02, 0.03, 0.0);
        B.torno(o, [[0.27, 0.0], [0.25, 0.08], [0.18, 0.15], [0.07, 0.19], [0.0, 0.2]], laca, 0, 0.0, 0, { ...mt, seg: 12, sy: 0.9, rz: l * 0.25 });
        for (let k = 0; k < 3; k++) B.torno(o, [[0.25 - k * 0.02, -0.04 - k * 0.07], [0.27 - k * 0.02, -0.01 - k * 0.07], [0.23 - k * 0.02, 0.03 - k * 0.07]], k % 2 ? bronze : laca, 0, 0, 0, { ...mt, seg: 12, rz: l * 0.25, linha: true });   // lâminas
        ar(B, o, 0.24, 0.022, ouro, 0, 0.0, 0, { rx: PI / 2, rz: 0, metal: 0.6, seg: 14, linha: false, ry: 0 }).rotation.z = l * 0.25;
        for (let k = 0; k < 4; k++) { const a = k * 0.7 - 1.0; B.cone(o, 0.045 - k * 0.003, 0.26 - Math.abs(k - 1.5) * 0.04, k % 2 ? bronzeEsc : bronze, l * (0.1 + Math.cos(a) * 0.06), 0.2, Math.sin(a) * 0.15, { rz: -l * (0.5 + Math.abs(a) * 0.3), rx: Math.sin(a) * 0.5, seg: 6, metal: 0.5, tex: 'metal', rep: 1 }); }   // espinhos gigantes
        rebites(B, o, [[l * 0.2, 0.08, 0.12], [l * 0.12, 0.15, 0.1], [l * 0.04, 0.18, 0.06]], 3, 0.015, ouro);
        bl(B, o, 0.045, osso, l * 0.15, 0.17, 0.2, { tex: 'osso', rep: 1, sz: 1.1, seed: 72, linha: false, seg: 7 });          // crânio troféu
        for (const q of [-1, 1]) B.esf(o, 0.012, 0xff2a10, l * 0.15 + q * 0.016, 0.175, 0.235, { seg: 5, linha: false, emissive: 0xff2a10, brilho: 1.5 });
      }
      // capa vermelha esfarrapada (as tiras balançam)
      const tiras = [];
      for (let i = 0; i < 6; i++) {
        const x = (i - 2.5) * 0.12, comp = 1.15 - Math.abs(i - 2.5) * 0.08 + rnd() * 0.08, w = 0.15;
        const g = B.grupo(G, x, 0.58, -0.2); g.rotation.x = 0.1;
        const geo = new THREE.PlaneGeometry(w, comp, 2, 5); geo.translate(0, -comp / 2, 0);
        const p = geo.attributes.position;
        for (let k = 0; k < p.count; k++) {
          const px = p.getX(k), py = p.getY(k), tt = -py / comp;
          p.setZ(k, -Math.sin(px * 24 + i) * 0.015 * (0.5 + tt) - tt * tt * 0.12);                    // dobras e caimento
          if (tt > 0.99) p.setY(k, py + (Math.abs(px) < 0.01 ? rnd() * 0.1 : -rnd() * 0.04 + Math.sign(px) * 0.03));   // barra rasgada
        }
        geo.computeVertexNormals();
        mala(B, g, geo, i % 2 ? verm : 0xb02420, 0, 0, 0, { ...mv, dupla: true, linha: false, relevo: 0.02 });
        fio(B, g, [[-w / 2, -0.02, 0.0], [0, -0.02, -0.005], [w / 2, -0.02, 0.0]], 0.008, ouro, { metal: 0.5 });          // barra dourada no alto
        tiras.push({ g, amp: 0.1 + (i % 3) * 0.04, vel: 1.6 + i * 0.25, fase: i * 0.9 });
      }
      B.tubo(G, [[-0.34, 0.6, -0.16], [-0.17, 0.6, -0.22], [0, 0.6, -0.24], [0.17, 0.6, -0.22], [0.34, 0.6, -0.16]], [0.025, 0.025, 0.025, 0.025, 0.025], ouro, { ...mt, seg: 8, rad: 5, linha: false });   // barra da capa

      /* --- espada colossal na mão direita --- */
      const es = B.grupo(bracos[1].userData.mao, 0, -0.05, 0.05); es.rotation.x = 1.0; es.rotation.z = -0.75;
      B.tubo(es, [[0, -0.14, 0], [0, 0.0, 0], [0, 0.12, 0]], [0.026, 0.026, 0.026], couro, { ...ml, seg: 8, rad: 7, linha: true });
      for (let k = 0; k < 4; k++) ar(B, es, 0.028, 0.006, ouro, 0, -0.1 + k * 0.07, 0, { rx: PI / 2, metal: 0.6, seg: 8, linha: false });
      bl(B, es, 0.05, bronzeEsc, 0, -0.18, 0, { ...mt, seed: 9, seg: 8, linha: true });                                       // pomo
      B.cone(es, 0.025, 0.1, bronzeEsc, 0, -0.26, 0, { rx: PI, seg: 5, metal: 0.5 });
      B.cx(es, 0.4, 0.04, 0.05, bronze, 0, 0.14, 0, { ...mt });                                                                // guarda
      for (const l of [-1, 1]) { B.cone(es, 0.04, 0.2, bronzeEsc, l * 0.22, 0.18, 0, { rz: -l * PI / 2 + l * 0.9, seg: 5, metal: 0.5, tex: 'metal', rep: 1 }); B.esf(es, 0.03, bronze, l * 0.2, 0.14, 0, { ...mt, seg: 8, linha: false }); }
      B.esf(es, 0.04, 0xff2010, 0, 0.14, 0.03, { emissive: 0xff2010, brilho: 1.3, seg: 8, linha: false });
      const shL = new THREE.Shape();                                                                                           // lâmina serrilhada
      shL.moveTo(-0.09, 0); shL.lineTo(0.09, 0); shL.lineTo(0.1, 0.5); shL.lineTo(0.125, 0.56); shL.lineTo(0.095, 0.63); shL.lineTo(0.11, 0.9); shL.lineTo(0.0, 1.25); shL.lineTo(-0.11, 0.9); shL.lineTo(-0.095, 0.63); shL.lineTo(-0.125, 0.56); shL.lineTo(-0.1, 0.5); shL.lineTo(-0.09, 0);
      const gl = new THREE.ExtrudeGeometry(shL, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 1, curveSegments: 2 });
      gl.translate(0, 0, -0.01);
      mala(B, es, gl, aco, 0, 0.16, 0, { metal: 0.45, rough: 0.35, tex: 'metal', rep: 1, relevo: 0.02, linha: true });
      fio(B, es, [[0, 0.22, 0.03], [0, 0.6, 0.03], [0, 1.0, 0.03]], 0.008, 0x4a4a58, { metal: 0.5 });                          // canal central
      fio(B, es, [[0.09, 0.3, 0.03], [0.1, 0.7, 0.03], [0.1, 0.9, 0.03]], 0.006, 0xff3a10, { emissive: 0xff3a10, brilho: 1.2 });   // fio em brasa
      fio(B, es, [[-0.09, 0.3, 0.03], [-0.1, 0.7, 0.03], [-0.1, 0.9, 0.03]], 0.006, 0xff3a10, { emissive: 0xff3a10, brilho: 1.2 });
      for (const y of [0.4, 0.62]) B.cone(es, 0.012, 0.04, 0x3a3a46, 0.07, y + 0.16, 0.0, { rz: -PI / 2, seg: 4, linha: false });   // lascas

      /* --- escudo redondo de bronze com espinhos --- */
      const esc2 = B.grupo(bracos[0], -0.02, -0.4, 0.18); esc2.rotation.x = 0.3; esc2.rotation.y = -0.4;
      bracos[0].userData.fixo = -0.95;
      B.torno(esc2, [[0.34, 0.0], [0.33, 0.03], [0.26, 0.07], [0.12, 0.1], [0.0, 0.11]], bronze, 0, 0, 0, { ...mt, seg: 20, rx: PI / 2 });
      B.torno(esc2, [[0.27, 0.04], [0.26, 0.07], [0.12, 0.1], [0.0, 0.12]], verm, 0, 0, 0.015, { ...mv, seg: 18, rx: PI / 2, linha: false, rough: 0.7 });   // campo vermelho
      ar(B, esc2, 0.335, 0.03, bronzeEsc, 0, 0, 0.0, { ...mt, seg: 20, linha: true });
      for (const [r, c] of [[0.2, ouro], [0.14, ouro]]) ar(B, esc2, r, 0.01, c, 0, 0, 0.1, { metal: 0.6, seg: 18, linha: false });
      bl(B, esc2, 0.07, bronze, 0, 0, 0.12, { ...mt, sz: 0.8, seed: 3, seg: 9 });
      B.cone(esc2, 0.05, 0.2, bronzeEsc, 0, 0, 0.26, { rx: PI / 2, seg: 6, metal: 0.5, tex: 'metal', rep: 1 });                // espinho central
      for (let i = 0; i < 14; i++) { const a = (i / 14) * PI * 2; B.cone(esc2, 0.025, 0.1, i % 2 ? bronzeEsc : bronze, Math.sin(a) * 0.33, Math.cos(a) * 0.33, 0.02, { rx: PI / 2 - 0.4, ry: 0, rz: -a, seg: 4, metal: 0.5, linha: false }).rotation.set(-Math.cos(a) * 0.9 + 0, Math.sin(a) * 0.9, 0); }   // espetos na borda
      for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3; fio(B, esc2, [[Math.sin(a) * 0.1, Math.cos(a) * 0.1, 0.1], [Math.sin(a) * 0.17, Math.cos(a) * 0.17, 0.085], [Math.sin(a) * 0.24, Math.cos(a) * 0.24, 0.06]], 0.008, 0xd8a040, { metal: 0.5 }); }   // raios do emblema
      for (const [a, d] of [[0.8, 0.25], [2.4, 0.2], [4.1, 0.28]]) fio(B, esc2, [[Math.sin(a) * d, Math.cos(a) * d, 0.07], [Math.sin(a + 0.25) * (d - 0.07), Math.cos(a + 0.25) * (d - 0.07), 0.07]], 0.006, 0x2a1008);   // arranhões de batalha
      B.cx(esc2, 0.04, 0.5, 0.03, couro, 0, 0, -0.04, { ...ml, linha: false });

      /* --- pernas com grevas e botas de ponta --- */
      const pernas = [-1, 1].map(l => {
        const p = B.grupo(K0, l * 0.17, 0.82, 0.0);
        B.tubo(p, [[0, 0, 0], [0, -0.2, 0.02], [0, -0.38, 0.04]], [0.12, 0.1, 0.08], pano, { ...mv, seg: 7, rad: 8 });
        B.torno(p, [[0.1, -0.34], [0.125, -0.2], [0.13, -0.02]], bronze, 0, 0, 0.015, { ...mt, seg: 10 });                   // coxote
        B.esf(p, 0.085, bronze, 0, -0.4, 0.06, { ...mt, seg: 9 });
        B.cone(p, 0.04, 0.17, bronzeEsc, 0, -0.4, 0.15, { rx: PI / 2, seg: 6, metal: 0.5, tex: 'metal', rep: 1 });             // espinho no joelho
        B.tubo(p, [[0, -0.4, 0.04], [0, -0.56, 0.02], [0, -0.72, 0.03]], [0.075, 0.065, 0.06], pano, { ...mv, seg: 7, rad: 8 });
        B.torno(p, [[0.056, -0.74], [0.075, -0.6], [0.09, -0.48]], bronze, 0, 0, 0.03, { ...mt, seg: 10 });                  // greva
        fio(B, p, [[0, -0.48, 0.12], [0, -0.62, 0.1], [0, -0.74, 0.1]], [0.012, 0.01, 0.01], ouro, { metal: 0.6 });
        for (let k = 0; k < 2; k++) ar(B, p, 0.07 - k * 0.006, 0.007, ouro, 0, -0.52 - k * 0.07, 0.03, { rx: PI / 2, metal: 0.6, seg: 10, linha: false });
        bl(B, p, 0.075, bronze, 0, -0.77, 0.1, { ...mt, sx: 0.95, sy: 0.55, sz: 1.7, seed: 21, seg: 9 });                     // bota
        B.cone(p, 0.05, 0.15, bronzeEsc, 0, -0.77, 0.27, { rx: PI / 2, seg: 6, metal: 0.5, tex: 'metal', rep: 1 });           // ponta da bota
        B.cx(p, 0.14, 0.03, 0.18, bronzeEsc, 0, -0.8, 0.1, { ...mt, linha: false });
        return p;
      });

      /* --- aura rubra, brasas e chamas (vivas) --- */
      const aura = [];
      const anel = B.vivo(ar(B, R, 0.62, 0.025, 0xff3010, 0, 0.1, 0, { rx: PI / 2, op: 0.5, emissive: 0xff2008, brilho: 1.3, seg: 28, linha: false }));
      const anel2 = B.vivo(ar(B, R, 0.46, 0.018, 0xff6020, 0, 0.12, 0, { rx: PI / 2, op: 0.4, emissive: 0xff4010, brilho: 1.3, seg: 24, linha: false }));
      for (let i = 0; i < 10; i++) {
        const c = B.vivo(B.cone(R, 0.07, 0.36, 0xb01808, 0, 0.2, 0, { op: 0.3 + i * 0.002, emissive: 0xff2000, brilho: 1.2, seg: 5, linha: false }));
        aura.push({ m: c, a: (i / 10) * PI * 2, r: 0.5 + (i % 3) * 0.07, f: i * 1.3 });
      }
      const brasas = [];
      for (let i = 0; i < 12; i++) brasas.push({ m: B.vivo(B.esf(R, 0.016, 0xff8a30, 0, 0, 0, { op: 0.9 - i * 0.003, emissive: 0xff5a10, brilho: 1.8, seg: 5, linha: false })), a: rnd() * 6.28, r: 0.35 + rnd() * 0.4, v: 0.25 + rnd() * 0.3, f: rnd() });

      return {
        altura: 2.1,
        p: { tronco: G, cabeca: cab, bracoE: bracos[0], bracoD: bracos[1], pernaE: pernas[0], pernaD: pernas[1], balancos: tiras.map(t => ({ g: t.g, amp: t.amp, vel: t.vel, eixo: 'x', fase: t.fase })) },
        anim: (t) => {
          anel.scale.setScalar(1 + Math.sin(t * 2) * 0.04); anel2.scale.setScalar(1 + Math.sin(t * 2.6 + 1) * 0.05);
          aura.forEach(({ m, a, r, f }) => { const fl = 0.7 + Math.sin(t * 7 + f) * 0.3; m.position.set(Math.sin(a + t * 0.4) * r, 0.2 + fl * 0.18, Math.cos(a + t * 0.4) * r); m.scale.set(0.8 + fl * 0.3, 0.6 + fl * 1.0, 0.8 + fl * 0.3); });
          brasas.forEach(b => { const u = (t * b.v + b.f) % 1; b.m.position.set(Math.sin(b.a + u * 2) * b.r, 0.2 + u * 1.8, Math.cos(b.a + u * 2) * b.r); b.m.scale.setScalar(1.2 - u); });
          chamas.forEach(({ m, l, k }) => { const fl = 0.6 + Math.sin(t * 11 + k * 2 + l) * 0.4; m.position.set(l * 0.06, 0.2 + fl * 0.03, 0.15 + k * 0.01); m.scale.set(0.7 + fl * 0.4, 0.6 + fl * 1.1, 0.7 + fl * 0.4); });
        },
      };
    },
  });
})();
