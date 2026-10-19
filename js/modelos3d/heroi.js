'use strict';
/* Heróis (guerreiro, caçador, oráculo) e o chefe final (caos): miniaturas detalhadas, pintadas à mão.
   Tudo aqui dentro é privado (IIFE) para não colidir com os outros arquivos de modelos. */
(() => {
  const PI = Math.PI, T2 = PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const kit = Modelos3D.kit;

  /* ================= geometrias próprias ================= */
  /** contorno por normais (formas lisas: esferas, tornos, panos) */
  function contornoN(geo, esp) {
    const g = geo.clone(), p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * esp, p.getY(i) + n.getY(i) * esp, p.getZ(i) + n.getZ(i) * esp);
    return g;
  }
  /** contorno por escala da caixa (formas facetadas: placas, lâminas) */
  function contornoC(geo, esp) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
    const k = e => Math.min(1.8, 1 + esp / Math.max(0.0001, e / 2));
    const g = geo.clone(); g.translate(-c.x, -c.y, -c.z); g.scale(k(s.x), k(s.y), k(s.z)); g.translate(c.x, c.y, c.z);
    return g;
  }
  /** peça com geometria própria + contorno de miniatura. o: rx ry rz sx sy sz, linha, esp, caixa (contorno por caixa) + opções do material */
  function meu(B, pai, geo, cor, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(geo, B.mat(cor, o));
    m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    if (o.sx || o.sy || o.sz) m.scale.set(o.sx || 1, o.sy || 1, o.sz || 1);
    if (o.linha !== false && !o.op) {
      const l = new THREE.Mesh(o.caixa ? contornoC(geo, o.esp || 0.014) : contornoN(geo, o.esp || 0.013), B.linhaMat);
      l.userData.contorno = true; m.add(l);
    }
    pai.add(m);
    return m;
  }
  /** lâmina de armadura facetada: topo w0, base w1, altura h, espessura e, curv (dobra em volta do corpo), punta (ponta embaixo) */
  function lamGeo(w0, w1, h, e = 0.02, curv = 1.5, punta = 0, nx = 4, ny = 1) {
    const F = [], K = [], pos = [];
    for (let j = 0; j <= ny; j++) {
      const v = j / ny, w = lerp(w0, w1, v); F[j] = []; K[j] = [];
      for (let i = 0; i <= nx; i++) {
        const u = i / nx - 0.5, x = u * w, y = -v * h - punta * (1 - Math.abs(u * 2)) * (j === ny ? 1 : 0), z = -curv * x * x;
        F[j][i] = [x, y, z + e / 2]; K[j][i] = [x, y, z - e / 2];
      }
    }
    const tri = (a, b, c, hx, hy, hz) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nxx = uy * vz - uz * vy, nyy = uz * vx - ux * vz, nzz = ux * vy - uy * vx;
      if (nxx * hx + nyy * hy + nzz * hz < 0) pos.push(...a, ...c, ...b); else pos.push(...a, ...b, ...c);
    };
    const quad = (a, b, c, d, hx, hy, hz) => { tri(a, b, c, hx, hy, hz); tri(a, c, d, hx, hy, hz); };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      quad(F[j][i], F[j + 1][i], F[j + 1][i + 1], F[j][i + 1], 0, 0, 1);
      quad(K[j][i], K[j + 1][i], K[j + 1][i + 1], K[j][i + 1], 0, 0, -1);
    }
    for (let i = 0; i < nx; i++) {
      quad(F[0][i], F[0][i + 1], K[0][i + 1], K[0][i], 0, 1, 0);
      quad(F[ny][i], F[ny][i + 1], K[ny][i + 1], K[ny][i], 0, -1, 0);
    }
    for (let j = 0; j < ny; j++) {
      quad(F[j][0], F[j + 1][0], K[j + 1][0], K[j][0], -1, 0, 0);
      quad(F[j][nx], F[j + 1][nx], K[j + 1][nx], K[j][nx], 1, 0, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2).map((_, i) => (i % 2 ? pos[(i >> 1) * 3 + 1] : pos[(i >> 1) * 3]) * 4), 2));
    g.computeVertexNormals();
    return g;
  }
  const lam = (B, pai, w0, w1, h, cor, x, y, z, o = {}) => meu(B, pai, lamGeo(w0, w1, h, o.e ?? 0.02, o.curv ?? 1.5, o.punta ?? 0, o.nx ?? 4, o.ny ?? 1), cor, x, y, z, { caixa: true, ...o });
  /** casca (calota de esfera): r, theta0, theta1 (do topo), phi0/phi1 opcionais; fica dupla-face */
  function casca(B, pai, r, t0, t1, cor, x, y, z, o = {}) {
    const g = new THREE.SphereGeometry(r, o.seg || 12, o.segV || 5, o.phi0 ?? 0, o.phi1 ?? T2, t0, t1 - t0);
    return meu(B, pai, g, cor, x, y, z, { dupla: true, ...o });
  }
  /** pano: tira de tecido que pende (origem no topo). w0 topo, w1 base, h; dobras; fz(u,v) = recuo; barra serrilhada */
  function panoGeo(w0, w1, h, o = {}) {
    const nx = o.nx || 8, ny = o.ny || 5, dob = o.dobras ?? 3, amp = o.amp ?? 0.03, pos = [], uv = [], idx = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const u = i / nx, v = j / ny, w = lerp(w0, w1, v), x = (u - 0.5) * w;
      let y = -v * h - (o.rasgo && j >= ny - 1 ? Math.abs((Math.sin(i * 12.9898 + j * 78.233 + (o.fase || 0)) * 43758.5453) % 1) * o.rasgo * (j === ny ? 1 : 0.35) : 0) + (o.barra && j === ny ? Math.sin(u * T2 * (o.barra)) * 0.03 + (Math.abs(u - 0.5) > 0.3 ? 0.03 : 0) : 0);
      const z = (o.fz ? o.fz(u, v, x) : 0) + Math.sin(u * T2 * dob + (o.fase || 0)) * amp * v;
      pos.push(x, y, z); uv.push(u * 2, v * 2);
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  const pano = (B, pai, w0, w1, h, cor, x, y, z, o = {}) => meu(B, pai, panoGeo(w0, w1, h, o), cor, x, y, z, { dupla: true, tex: 'tecido', rep: 2, relevo: 0.03, rough: 0.9, ...o, linha: o.linha ?? true, esp: 0.012 });
  /** como `meu`, mas pinta cada vértice com fcor(x,y,z) -> cor hex (gradientes de tinta). Não é fundida (vivo). */
  function meuV(B, pai, geo, fcor, x = 0, y = 0, z = 0, o = {}) {
    const p = geo.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
    for (let i = 0; i < p.count; i++) { col.set(fcor(p.getX(i), p.getY(i), p.getZ(i))); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const m = meu(B, pai, geo, 0xffffff, x, y, z, o);
    const mt = m.material.clone(); mt.vertexColors = true;
    mt.userData = { emBase: mt.emissive.clone(), opBase: mt.opacity, intBase: mt.emissiveIntensity }; B.todos.push(mt); m.material = mt;
    return B.vivo(m);
  }
  const mixCor = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t))).getHex();
  /** forma extrudada a partir de pontos [[x,y],...] */
  function formaGeo(pts, prof, bisel = 0.006) {
    const sh = new THREE.Shape(); pts.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
    const g = new THREE.ExtrudeGeometry(sh, { depth: prof, bevelEnabled: bisel > 0, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 1 });
    g.translate(0, 0, -prof / 2); return g;
  }
  /** estrela de n pontas (raio externo R, interno r) */
  const estrelaPts = (n, R, r) => { const a = []; for (let i = 0; i < n * 2; i++) { const t = i / (n * 2) * T2 + PI / 2, k = i % 2 ? r : R; a.push([Math.cos(t) * k, Math.sin(t) * k]); } return a; };
  /** peça de revolução com dobras (robes): perfil [[raio, y],...] de baixo p/ cima; dobras = nº de pregas, amp = fundo das pregas */
  function tornoDobras(perfil, seg = 28, dobras = 7, amp = 0.05, fase = 0, hem = 0.015) {
    const g = new THREE.LatheGeometry(perfil.map(p => new THREE.Vector2(p[0], p[1])), seg), p = g.attributes.position, y0 = perfil[0][1], y1 = perfil[perfil.length - 1][1];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(x, z), k = 1 - (y - y0) / (y1 - y0);
      const f = 1 + Math.sin(a * dobras + fase) * amp * k * k + Math.sin(a * dobras * 2 + fase * 2) * amp * 0.3 * k * k;
      p.setXYZ(i, x * f, y + (y - y0 < 0.01 ? Math.sin(a * dobras * 1.5) * hem : 0), z * f);
    }
    g.computeVertexNormals();
    return g;
  }
  /** runas (polígonos) para os anéis mágicos */
  const RUNAS = [
    [[0, 0.5], [0.3, -0.5], [-0.3, -0.5]], [[0, 0.55], [0.3, 0], [0, -0.55], [-0.3, 0]], [[-0.08, 0.5], [0.08, 0.5], [0.08, 0.1], [0.3, 0.3], [0.3, 0.42], [0.08, 0.2], [0.08, -0.5], [-0.08, -0.5]],
    [[-0.3, 0.5], [0.3, 0.5], [0.05, 0], [0.3, -0.5], [-0.3, -0.5], [-0.05, 0]], [[-0.07, 0.5], [0.07, 0.5], [0.07, 0.07], [0.3, 0.07], [0.3, -0.07], [0.07, -0.07], [0.07, -0.5], [-0.07, -0.5], [-0.07, -0.07], [-0.3, -0.07], [-0.3, 0.07], [-0.07, 0.07]],
    [[-0.28, 0.5], [-0.12, 0.5], [0.1, -0.1], [0.28, 0.5], [0.12, -0.5], [-0.1, -0.5]],
  ];
  const runaGeo = (i, tam) => formaGeo(RUNAS[i % RUNAS.length].map(p => [p[0] * tam, p[1] * tam]), tam * 0.18, tam * 0.03);
  /** tubo sem as esferas das pontas (poupa triângulos) */
  const tb = (B, pai, pts, raios, cor, o = {}) => B.tubo(pai, pts, raios, cor, { pontas: false, ...o });
  /** rebites: pequenas esferas nos pontos [[x,y,z],...] */
  const rebites = (B, pai, pts, r, cor, o = {}) => pts.forEach(p => B.esf(pai, r, cor, p[0], p[1], p[2], { seg: 6, linha: false, metal: 0.7, rough: 0.3, ...o }));
  /** anel de rebites/pequenos itens em volta (eixo Y): n itens, raio, y, fator de achatamento em z */
  const volta = (n, rad, y, fz = 1, a0 = 0, a1 = T2) => { const a = []; for (let i = 0; i < n; i++) { const t = lerp(a0, a1, n === 1 ? 0.5 : i / (n - (a1 - a0 >= T2 - 0.01 ? 0 : 1))); a.push([Math.sin(t) * rad, y, Math.cos(t) * rad * fz, t]); } return a; };

  /* ================= esqueleto humanoide próprio (membros lisos em tubo) ================= */
  /** devolve os pivôs que o motor anima. quad = altura do quadril. Membros em tubo, rosto com olhos, mãos. */
  function esqueleto(B, R, o = {}) {
    const s = o.s || 1, w = o.w || 1, pele = o.pele ?? 0xe6b48e, tec = o.tec ?? 0x2a3a66, calca = o.calca ?? tec, bota = o.bota ?? 0x3a281a, luva = o.luva ?? pele;
    const mt = { tex: 'tecido', rep: 2, relevo: 0.012, rough: 0.9 }, mp = { tex: 'pele', rep: 1, relevo: 0.006, rough: 0.8 }, mb = { tex: 'couro', rep: 1, relevo: 0.03, rough: 0.7 };
    const quad = 0.56 * s;
    const pernas = [-1, 1].map(l => {
      const p = B.grupo(R, l * 0.105 * w * s, quad, 0);
      tb(B, p, [[0, 0, 0], [0, -0.27 * s, 0.012 * s], [0, -0.5 * s, 0]], [0.088 * w * s, 0.062 * s, 0.05 * s], calca, { ...mt, seg: 7, rad: 8 });
      if (!o.semBota) {
        tb(B, p, [[0, -0.33 * s, 0.005], [0, -0.45 * s, 0.003], [0, -0.52 * s, 0]], [0.066 * s, 0.062 * s, 0.056 * s], bota, { ...mb, seg: 4, rad: 8 });
        B.blob(p, 0.088 * s, bota, 0, -0.535 * s, 0.05 * s, { ...mb, sx: 0.78, sy: 0.55, sz: 1.5, amp: 0.05, seg: 12 });
        B.tor(p, 0.066 * s, 0.014 * s, bota, 0, -0.335 * s, 0.004, { rx: PI / 2, seg: 10, ...mb, linha: false });
      }
      return p;
    });
    const tronco = B.grupo(R, 0, quad, 0);
    const per = (o.perfil ?? [[0.14, 0], [0.125, 0.11], [0.175, 0.3], [0.19, 0.4], [0.1, 0.48]]).map(([r, y]) => [r * w * s, y * s]);
    B.torno(tronco, per, o.tecTronco ?? tec, 0, 0, 0, { ...mt, seg: 14, sz: 0.82 });
    tb(B, tronco, [[0, 0.44 * s, 0], [0, 0.56 * s, 0.015 * s]], [0.062 * s, 0.056 * s], pele, { ...mp, seg: 3, rad: 8, linha: false });
    const cabeca = B.grupo(tronco, 0, 0.66 * s, 0.015 * s);
    B.blob(cabeca, 0.135 * s, pele, 0, 0, 0, { ...mp, amp: 0.025, sy: 1.04, seed: 3, seg: 14 });
    B.blob(cabeca, 0.095 * s, pele, 0, -0.065 * s, 0.045 * s, { ...mp, amp: 0.02, sx: 0.95, sy: 0.9, seed: 4, seg: 10, linha: false });   // queixo
    [-1, 1].forEach(l => {
      B.olho(cabeca, 0.022 * s, o.olhos ?? 0xf4efe6, l * 0.05 * s, 0.012 * s, 0.112 * s, { pupila: false });
      B.esf(cabeca, 0.013 * s, o.iris ?? 0x3a6ab8, l * 0.05 * s, 0.012 * s, 0.13 * s, { seg: 6, linha: false, emissive: o.irisBrilho ?? 0, brilho: 1.2 });
      B.esf(cabeca, 0.006 * s, 0x0a0608, l * 0.05 * s, 0.012 * s, 0.138 * s, { seg: 4, linha: false });
      B.blob(cabeca, 0.03 * s, pele, l * 0.138 * s, -0.01 * s, -0.005 * s, { ...mp, sx: 0.4, sy: 1.2, seg: 6, linha: false });                    // orelhas
      B.cx(cabeca, 0.06 * s, 0.014 * s, 0.02 * s, o.sobrancelha ?? 0x3a2412, l * 0.052 * s, 0.05 * s, 0.12 * s, { rz: -l * 0.18, rx: -0.2, linha: false });
    });
    B.cone(cabeca, 0.02 * s, 0.05 * s, pele, 0, -0.02 * s, 0.13 * s, { rx: PI / 2 + 0.25, seg: 6, linha: false, ...mp });
    if (!o.semBoca) B.cx(cabeca, 0.05 * s, 0.01 * s, 0.015 * s, 0x8a3a3a, 0, -0.07 * s, 0.123 * s, { linha: false });
    // braços (tubo com cotovelo dobrado para a frente) + mão
    const braco = lado => {
      const b = B.grupo(tronco, lado * 0.255 * w * s, 0.43 * s, 0);
      const mc = o.manga ?? tec, ac = o.antebraco ?? mc;
      tb(B, b, [[0, 0, 0], [lado * 0.02 * s, -0.1 * s, -0.005 * s], [lado * 0.03 * s, -0.2 * s, -0.01 * s]], [0.07 * w * s, 0.06 * s, 0.05 * s], mc, { ...mt, seg: 4, rad: 8 });
      tb(B, b, [[lado * 0.03 * s, -0.2 * s, -0.01 * s], [lado * 0.025 * s, -0.28 * s, 0.04 * s], [lado * 0.015 * s, -0.33 * s, 0.1 * s]], [0.05 * s, 0.044 * s, 0.036 * s], ac, { ...(o.antebraco !== undefined && o.antebraco === pele ? mp : mt), seg: 4, rad: 8 });
      const mao = B.grupo(b, lado * 0.015 * s, -0.34 * s, 0.105 * s);
      B.blob(mao, 0.05 * s, luva, 0, -0.03 * s, 0.015 * s, { ...(luva === pele ? mp : mb), amp: 0.06, sx: 0.95, sy: 1.1, sz: 1.05, seed: 7, seg: 9 });
      B.esf(mao, 0.02 * s, luva, lado * -0.03 * s, -0.01 * s, 0.045 * s, { seg: 6, linha: false });
      b.userData.mao = mao;
      return b;
    };
    const bracoE = braco(-1), bracoD = braco(1);
    return { tronco, cabeca, bracoE, bracoD, pernaE: pernas[0], pernaD: pernas[1], maoE: bracoE.userData.mao, maoD: bracoD.userData.mao, s, w, quad };
  }

  /* ================= GUERREIRO ================= */
  function guerreiro(B, R) {
    const AZ = 0x3f6fbd, AZE = 0x274a94, PRA = 0xd2dae8, OURO = 0xe6b13a, MARINHO = 0x1b2b5c, VERM = 0xc4222f, COURO = 0x5a3a22, CREME = 0xe6e0d0;
    const mA = { tex: 'metal', rep: 1, relevo: 0.008, metal: 0.5, rough: 0.42 }, mP = { tex: 'metal', rep: 1, relevo: 0.008, metal: 0.7, rough: 0.3 }, mO = { metal: 0.85, rough: 0.3 };
    const mC = { tex: 'couro', rep: 1, relevo: 0.03, rough: 0.7 }, mT = { tex: 'tecido', rep: 1, relevo: 0.01, rough: 0.9 };
    const h = esqueleto(B, R, { tec: MARINHO, calca: MARINHO, manga: MARINHO, semBota: true, w: 1.08, perfil: [[0.15, 0], [0.13, 0.11], [0.17, 0.3], [0.185, 0.4], [0.1, 0.48]] });
    const { tronco, cabeca } = h;

    /* --- pernas: coxotes, joelheiras, grevas, botas e sabatons --- */
    [h.pernaE, h.pernaD].forEach((p, i) => {
      tb(B, p, [[0, -0.02, 0], [0, -0.14, 0.01], [0, -0.25, 0.015]], [0.1, 0.082, 0.068], AZ, { ...mA, seg: 4, rad: 8 });                // coxote
      tb(B, p, [[0, -0.285, 0.012], [0, -0.4, 0.012], [0, -0.5, 0.005]], [0.066, 0.064, 0.055], AZ, { ...mA, seg: 4, rad: 8 });           // greva
      tb(B, p, [[0, -0.3, 0.066], [0, -0.42, 0.066], [0, -0.5, 0.05]], [0.011, 0.013, 0.01], PRA, { ...mP, seg: 3, rad: 4, linha: false }); // crista da greva
      casca(B, p, 0.078, 0, 1.45, PRA, 0, -0.265, 0.04, { ...mP, rx: PI / 2 - 0.15, sz: 0.65, seg: 9, segV: 3 });                         // joelheira
      B.cone(p, 0.022, 0.06, OURO, 0, -0.265, 0.1, { rx: PI / 2, seg: 5, ...mO, linha: false });
      B.cil(p, 0.062, 0.072, 0.06, COURO, 0, -0.5, 0.0, { ...mC, seg: 8 });                                                              // cano da bota
      B.tor(p, 0.07, 0.009, OURO, 0, -0.475, 0.0, { rx: PI / 2, seg: 9, ...mO, linha: false });
      B.blob(p, 0.078, AZ, 0, -0.545, 0.05, { ...mA, sx: 0.78, sy: 0.5, sz: 1.6, amp: 0.02, seg: 9 });                                    // sabaton
      B.cone(p, 0.034, 0.08, PRA, 0, -0.545, 0.155, { rx: PI / 2, seg: 5, ...mP, linha: false });
      B.cx(p, 0.1, 0.018, 0.04, OURO, 0, -0.51, 0.065, { ...mO, linha: false });
    });

    /* --- peitoral, abdômen em lâminas, gorjal --- */
    const peit = [[0.168, 0.1], [0.185, 0.2], [0.215, 0.32], [0.22, 0.4], [0.19, 0.455], [0.1, 0.48]].map(([r, y]) => [r * 1.08, y]);
    B.torno(tronco, peit, AZ, 0, 0, 0, { ...mA, sz: 0.86, seg: 14 });
    [0, 1, 2].forEach(i => B.cil(tronco, 0.165 + i * 0.012, 0.19 + i * 0.01, 0.07, i % 2 ? AZ : AZE, 0, 0.06 + i * 0.05, 0, { ...mA, sz: 0.86, seg: 14, linha: i === 0 }));
    B.tor(tronco, 0.2, 0.011, OURO, 0, 0.1, 0.0, { rx: PI / 2, sy: 0.86, seg: 14, ...mO, linha: false });
    B.tor(tronco, 0.235, 0.012, OURO, 0, 0.36, 0, { rx: PI / 2, sy: 0.86, seg: 14, ...mO, linha: false });
    tb(B, tronco, [[-0.085, 0.45, 0.145], [-0.06, 0.38, 0.18], [0, 0.26, 0.2]], [0.011, 0.011, 0.011], OURO, { ...mO, seg: 5, rad: 5, linha: false });   // frisos em V
    tb(B, tronco, [[0.085, 0.45, 0.145], [0.06, 0.38, 0.18], [0, 0.26, 0.2]], [0.011, 0.011, 0.011], OURO, { ...mO, seg: 5, rad: 5, linha: false });
    tb(B, tronco, [[0, 0.26, 0.2], [0, 0.15, 0.2]], [0.012, 0.012], PRA, { ...mP, seg: 2, rad: 5, linha: false });
    B.esf(tronco, 0.036, OURO, 0, 0.33, 0.19, { ...mO, seg: 8, sz: 0.5 });                                                              // medalhão com gema
    B.esf(tronco, 0.021, 0x7ad0ff, 0, 0.33, 0.205, { emissive: 0x3a9aff, brilho: 0.9, seg: 8, linha: false, sz: 0.6 });
    [0, 1].forEach(i => B.cil(tronco, 0.085 + i * 0.03, 0.115 + i * 0.03, 0.045, i ? AZ : PRA, 0, 0.48 - i * 0.025, 0.005, { ...(i ? mA : mP), seg: 10 }));   // gorjal
    B.tor(tronco, 0.1, 0.011, OURO, 0, 0.5, 0.005, { rx: PI / 2, seg: 10, ...mO, linha: false });
    B.cx(tronco, 0.2, 0.22, 0.03, AZE, 0, 0.3, -0.165, { ...mA, linha: false });                                                         // dorsal
    rebites(B, tronco, [[-0.07, 0.37, -0.185], [0.07, 0.37, -0.185], [-0.07, 0.24, -0.185], [0.07, 0.24, -0.185]], 0.012, PRA);

    /* --- escarcela (saiote de placas), tassetes, tabardo, cinto --- */
    volta(9, 0.185, 0.0, 0.88).forEach(([x, y, z, t], i) => {
      const g = B.grupo(tronco, x, 0.02, z); g.rotation.y = t;
      lam(B, g, 0.115, 0.1, 0.17, i % 2 ? AZ : AZE, 0, 0, 0.0, { ...mA, curv: 2, punta: 0.025, rx: 0.2 });
      B.esf(g, 0.009, OURO, 0, -0.12, 0.012, { seg: 5, linha: false, ...mO });
    });
    volta(9, 0.205, -0.07, 0.9).forEach(([x, y, z, t], i) => {
      if (i % 2) return;
      const g = B.grupo(tronco, x, -0.04, z); g.rotation.y = t;
      lam(B, g, 0.1, 0.085, 0.13, AZ, 0, 0, 0, { ...mA, curv: 2, punta: 0.03, rx: 0.3 });
    });
    const tab = B.grupo(tronco, 0, 0.03, 0.2);
    pano(B, tab, 0.15, 0.17, 0.3, CREME, 0, 0, 0.02, { ...mT, dobras: 2, amp: 0.012, ny: 3, nx: 4, barra: 3, fz: (u, v) => v * 0.07 });
    pano(B, tab, 0.17, 0.17, 0.04, OURO, 0, -0.27, 0.02, { ...mT, metal: 0.5, rough: 0.5, nx: 4, ny: 1, linha: false, dobras: 2, amp: 0.012, fz: (u, v) => 0.07 + 0.004 });
    meu(B, tab, formaGeo(estrelaPts(6, 0.05, 0.022), 0.01, 0.004), AZ, 0, -0.1, 0.085, { ...mA, rx: 0.3, caixa: true, linha: false });
    B.torno(tronco, [[0.185, 0.0], [0.19, 0.035], [0.186, 0.07]], COURO, 0, 0.03, 0, { ...mC, sz: 0.86, seg: 14 });
    lam(B, tronco, 0.07, 0.07, 0.055, OURO, 0, 0.08, 0.19, { ...mO, e: 0.02, curv: 0, linha: true });
    B.esf(tronco, 0.015, 0xc4222f, 0, 0.055, 0.215, { emissive: 0x801018, seg: 6, linha: false });
    [-1, 1].forEach(l => {
      const bo = B.grupo(tronco, l * 0.165, 0.0, 0.07);
      B.blob(bo, 0.045, COURO, 0, -0.04, 0, { ...mC, sx: 0.8, sz: 0.9, amp: 0.05, seg: 8 });
      B.cx(bo, 0.075, 0.03, 0.075, 0x6a4628, l * 0.005, -0.02, 0, { ...mC, linha: false });
      B.esf(bo, 0.01, OURO, l * 0.04, -0.035, 0.0, { seg: 5, linha: false, ...mO });
    });
    B.cx(tronco, 0.03, 0.14, 0.03, 0x3a2a1a, 0.0, 0.06, -0.2, { ...mC, rz: 1.2, linha: false });                                       // adaga atrás
    B.cx(tronco, 0.05, 0.02, 0.02, OURO, -0.04, 0.0, -0.2, { ...mO, linha: false });

    /* --- ombreiras de lâminas, braços e manoplas --- */
    [h.bracoE, h.bracoD].forEach((b, i) => {
      const l = i ? 1 : -1;
      [[0.13, 0, 1.05, 0.0, 0, AZ], [0.15, 0.5, 1.25, -0.04, 0.02, AZE], [0.165, 0.6, 1.3, -0.085, 0.04, AZ]].forEach(([r, t0, t1, dy, dx, cor], k) => {
        const g = B.grupo(b, l * (0.015 + dx), 0.04 + dy, 0); g.rotation.z = -l * (0.35 + k * 0.1);
        casca(B, g, r, t0, t1, cor, 0, 0, 0, { ...mA, seg: 10, segV: 2, sz: 0.95 });
        B.tor(g, Math.sin(t1) * r, 0.009, OURO, 0, Math.cos(t1) * r, 0, { rx: PI / 2, seg: 10, ...mO, linha: false });
      });
      const top = B.grupo(b, l * 0.015, 0.1, 0); top.rotation.z = -l * 0.35;
      B.cone(top, 0.026, 0.09, PRA, 0, 0.04, 0, { seg: 6, ...mP });                                                                      // espigão
      B.tor(top, 0.04, 0.012, OURO, 0, 0.005, 0, { rx: PI / 2, seg: 8, ...mO, linha: false });
      rebites(B, b, [[l * 0.11, -0.01, 0.07], [l * 0.11, -0.01, -0.07], [l * 0.125, -0.045, 0.0]], 0.01, OURO, { metal: 0.85 });
      tb(B, b, [[l * 0.005, -0.075, 0], [l * 0.015, -0.14, -0.004]], [0.066, 0.062], AZ, { ...mA, seg: 2, rad: 8, linha: false });      // braçal
      B.esf(b, 0.056, PRA, l * 0.035, -0.21, -0.012, { ...mP, seg: 8, sz: 0.9 });                                                         // cotoveleira
      B.cone(b, 0.02, 0.06, OURO, l * 0.075, -0.21, -0.012, { rz: -l * PI / 2, seg: 5, ...mO, linha: false });
      tb(B, b, [[l * 0.03, -0.235, 0.005], [l * 0.025, -0.285, 0.04], [l * 0.017, -0.32, 0.092]], [0.054, 0.049, 0.044], PRA, { ...mP, seg: 3, rad: 8 });  // antebraço
      B.tor(b, 0.05, 0.01, OURO, l * 0.02, -0.31, 0.083, { rx: PI / 2 + 0.9, seg: 8, ...mO, linha: false });
      const m = b.userData.mao;
      B.blob(m, 0.056, AZ, 0, -0.03, 0.015, { ...mA, sx: 0.95, sy: 1.1, amp: 0.03, seg: 8 });                                             // manopla
      [-1.5, -0.5, 0.5, 1.5].forEach(k => B.cx(m, 0.022, 0.012, 0.03, PRA, k * 0.021, -0.01, 0.055, { ...mP, linha: false }));
    });

    /* --- elmo aberto, crista e plumas --- */
    casca(B, cabeca, 0.15, 0, 1.12, AZ, 0, 0.012, -0.006, { ...mA, seg: 12, segV: 4 });                                                  // calota
    casca(B, cabeca, 0.154, 1.1, 2.05, AZ, 0, 0.012, -0.006, { ...mA, phi0: PI / 2 + 1.05, phi1: T2 - 2.1, seg: 12, segV: 3 });          // nuca e laterais
    B.tor(cabeca, 0.136, 0.013, PRA, 0, 0.074, -0.006, { rx: PI / 2, seg: 14, ...mP, linha: false });                                      // aro prateado
    B.tor(cabeca, 0.14, 0.008, OURO, 0, 0.056, -0.006, { rx: PI / 2, seg: 14, ...mO, linha: false });
    lam(B, cabeca, 0.024, 0.02, 0.115, PRA, 0, 0.065, 0.142, { ...mP, curv: 0, e: 0.016, punta: 0.01, nx: 1 });                          // nasal
    [-1, 1].forEach(l => {
      lam(B, cabeca, 0.07, 0.055, 0.11, AZ, l * 0.138, 0.0, 0.03, { ...mA, curv: 0, ry: l * (PI / 2 - 0.15), e: 0.016, punta: 0.02 });   // bochechas
      B.esf(cabeca, 0.01, OURO, l * 0.148, -0.025, 0.045, { seg: 5, linha: false, ...mO });
      B.cone(cabeca, 0.03, 0.09, PRA, l * 0.15, 0.085, -0.02, { rz: -l * (PI / 2 - 0.2), rx: -0.15, seg: 5, ...mP, linha: false });        // asinhas laterais
    });
    lam(B, cabeca, 0.2, 0.17, 0.085, PRA, 0, 0.145, 0.07, { ...mP, curv: 7, rx: -0.75, e: 0.016, punta: 0.03, nx: 6 });                 // viseira levantada
    B.esf(cabeca, 0.014, OURO, 0, 0.11, 0.132, { seg: 6, linha: false, ...mO });
    tb(B, cabeca, [[0, 0.13, 0.095], [0, 0.185, 0.04], [0, 0.19, -0.07], [0, 0.13, -0.15]], [0.026, 0.03, 0.03, 0.022], PRA, { ...mP, seg: 8, rad: 6 });   // espinha da crista
    const crista = B.grupo(cabeca, 0, 0.19, 0);
    for (let i = 0; i < 9; i++) {
      const t = i / 8, a = lerp(1.1, -0.9, t), y = Math.cos(a) * 0.07 + 0.005, z = Math.sin(a) * 0.15 - 0.0 - (i === 8 ? 0.02 : 0);
      B.cone(crista, 0.034 - t * 0.008, 0.11 - Math.abs(t - 0.45) * 0.07, VERM, 0, y, z, { rx: -a + 0.0, seg: 5, tex: 'pelo', rep: 1, rough: 0.9, linha: i % 3 === 0 });
    }
    const pluma = B.grupo(cabeca, 0, 0.17, -0.12);
    tb(B, pluma, [[0, 0.02, 0.02], [0, 0.07, -0.07], [0, -0.03, -0.16], [0, -0.17, -0.19], [0, -0.32, -0.17]], [0.032, 0.042, 0.04, 0.028, 0.006], VERM, { tex: 'pelo', rep: 2, seg: 9, rad: 6, rough: 0.9 });
    // rosto: barba curta, cicatriz
    B.blob(cabeca, 0.075, 0x4a2a14, 0, -0.092, 0.06, { tex: 'pelo', rep: 1, sx: 1.05, sy: 0.55, sz: 0.85, amp: 0.1, seg: 8, seed: 11, linha: false });

    /* --- capa azul com gola de pele --- */
    const capaPivo = B.grupo(tronco, 0, 0.47, -0.12);
    const capa = B.grupo(capaPivo, 0, 0, 0);
    const fzc = (u, v, x) => -v * 0.22 + Math.abs(x) * Math.abs(x) * 0.9 * (1 - v * 0.4);
    meuV(B, capa, panoGeo(0.38, 0.74, 0.95, { dobras: 4.5, amp: 0.05, nx: 14, ny: 6, barra: 5, fz: fzc }), (x, y) => mixCor(0x3b70cf, 0x17306e, -y / 0.95 * 1.1), 0, 0, -0.06, { ...mT, dupla: true, esp: 0.012 });
    pano(B, capa, 0.72, 0.74, 0.07, OURO, 0, -0.88, -0.06, { ...mT, dobras: 4.5, amp: 0.05, nx: 14, ny: 1, linha: false, metal: 0.4, rough: 0.5, fz: (u, v, x) => fzc(u, 0.94, x) - 0.002 });
    meu(B, capa, formaGeo(estrelaPts(8, 0.13, 0.05), 0.008, 0.003), OURO, 0, -0.43, -0.178, { ...mO, caixa: true, linha: false, ry: PI, rz: 0.2 });   // emblema bordado nas costas
    B.tor(capa, 0.085, 0.008, OURO, 0, -0.43, -0.178, { ...mO, linha: false, seg: 14 });
    B.torno(tronco, [[0.12, 0.43], [0.19, 0.46], [0.235, 0.49], [0.2, 0.52], [0.14, 0.52]], CREME, 0, 0, 0, { tex: 'pelo', rep: 2, relevo: 0.03, rough: 0.95, sz: 0.85, seg: 12 });   // gola de pele
    [-1, 1].forEach(l => {
      B.esf(tronco, 0.03, OURO, l * 0.1, 0.45, 0.14, { ...mO, seg: 8, sz: 0.6 });
      B.esf(tronco, 0.015, 0xff5a6a, l * 0.1, 0.45, 0.158, { emissive: 0x901020, seg: 6, linha: false });
    });
    tb(B, tronco, [[-0.1, 0.45, 0.15], [-0.05, 0.4, 0.2], [0.05, 0.4, 0.2], [0.1, 0.45, 0.15]], [0.007, 0.007, 0.007, 0.007], OURO, { ...mO, seg: 6, rad: 4, linha: false });

    /* --- espada longa --- */
    const esp = B.grupo(h.maoD, 0, -0.01, 0.02); esp.rotation.x = -0.95;
    B.cil(esp, 0.016, 0.018, 0.13, 0x2a1810, 0, 0.0, 0, { ...mC, seg: 7, linha: false });
    [-0.045, -0.015, 0.015, 0.045].forEach(y => B.tor(esp, 0.019, 0.004, OURO, 0, y, 0, { rx: PI / 2, seg: 7, ...mO, linha: false }));
    B.esf(esp, 0.032, OURO, 0, -0.085, 0, { ...mO, seg: 9 });
    B.esf(esp, 0.016, 0x7ad0ff, 0, -0.085, 0.022, { emissive: 0x3a9aff, seg: 6, linha: false });
    const gua = B.grupo(esp, 0, 0.08, 0);
    tb(B, gua, [[-0.14, -0.04, 0], [-0.07, 0.012, 0], [0, 0.02, 0], [0.07, 0.012, 0], [0.14, -0.04, 0]], [0.014, 0.016, 0.02, 0.016, 0.014], OURO, { ...mO, seg: 10, rad: 6 });
    [-1, 1].forEach(l => { B.esf(gua, 0.02, OURO, l * 0.145, -0.045, 0, { ...mO, seg: 7 }); B.cone(gua, 0.014, 0.05, OURO, l * 0.15, -0.07, 0, { rx: PI, seg: 5, linha: false, ...mO }); });
    B.esf(gua, 0.022, 0xc4222f, 0, 0.02, 0.014, { emissive: 0xa01020, seg: 8, linha: false });
    B.cx(gua, 0.045, 0.045, 0.04, OURO, 0, 0.0, 0, { ...mO });
    meu(B, esp, formaGeo([[-0.036, 0], [0.036, 0], [0.034, 0.5], [0.0, 0.64], [-0.034, 0.5]], 0.012, 0.005), 0xe6edf8, 0, 0.11, 0, { metal: 0.9, rough: 0.18, caixa: true, emissive: 0x2a3a5a, brilho: 0.35 });
    B.cx(esp, 0.012, 0.44, 0.018, 0x8a9ab8, 0, 0.36, 0, { metal: 0.9, rough: 0.3, linha: false });

    /* --- escudo redondo com sol de 8 pontas --- */
    const esc = B.grupo(h.bracoE, -0.1, -0.27, 0.07); esc.rotation.y = -PI / 2 + 0.7; esc.rotation.z = 0.08;
    B.torno(esc, [[0.0, -0.035], [0.26, -0.045], [0.28, -0.04], [0.27, -0.02], [0.2, 0.0], [0.1, 0.025], [0.0, 0.035]], AZ, 0, 0, 0, { ...mA, rx: PI / 2, seg: 18 });
    B.tor(esc, 0.272, 0.022, PRA, 0, 0, -0.02, { seg: 20, ...mP, sz: 1.2 });
    B.tor(esc, 0.19, 0.012, OURO, 0, 0, 0.012, { seg: 18, ...mO, linha: false });
    B.tor(esc, 0.11, 0.01, PRA, 0, 0, 0.026, { seg: 14, ...mP, linha: false });
    B.esf(esc, 0.07, PRA, 0, 0, 0.02, { ...mP, seg: 10, sz: 0.55 });
    meu(B, esc, formaGeo(estrelaPts(8, 0.2, 0.075), 0.012, 0.004), OURO, 0, 0, 0.022, { ...mO, caixa: true, linha: false, rz: 0.2 });
    B.esf(esc, 0.045, PRA, 0, 0, 0.034, { ...mP, seg: 8, sz: 0.6 });
    B.esf(esc, 0.022, 0xc4222f, 0, 0, 0.05, { emissive: 0xa01020, brilho: 0.8, seg: 8, linha: false });
    rebites(B, esc, volta(10, 0.235, 0, 1).map(a => [a[0], a[2], 0.005]), 0.012, OURO, { metal: 0.85 });
    B.cx(esc, 0.03, 0.16, 0.02, COURO, 0, 0, -0.05, { ...mC, linha: false });

    return {
      altura: 1.62, p: { ...h, balancos: [{ g: capaPivo, amp: 0.07, vel: 1.7, eixo: 'x', fase: 0 }, { g: capa, amp: 0.05, vel: 2.3, eixo: 'z', fase: 1 }, { g: pluma, amp: 0.1, vel: 2.1, eixo: 'x', fase: 2 }] },
    };
  }

  /* ================= CAÇADOR ================= */
  function cacador(B, R) {
    const VE = 0x2e4a2c, VM = 0x46683b, CO = 0x7a5230, COE = 0x4a2e18, OV = 0xc2a050, LEN = 0x8a3030, PELE = 0xdba878, CALCA = 0x4d4632;
    const mC = { tex: 'couro', rep: 1, relevo: 0.03, rough: 0.75 }, mT = { tex: 'tecido', rep: 1, relevo: 0.01, rough: 0.92 }, mO = { metal: 0.7, rough: 0.4 };
    const h = esqueleto(B, R, { s: 0.97, w: 0.92, pele: PELE, tec: CALCA, calca: CALCA, manga: VM, antebraco: COE, luva: COE, semBota: true, iris: 0x7aff8a, irisBrilho: 0.6, perfil: [[0.14, 0], [0.12, 0.11], [0.155, 0.3], [0.17, 0.4], [0.1, 0.48]], sobrancelha: 0x2a1a0a });
    const { tronco, cabeca } = h; tronco.rotation.x = 0.07;

    /* --- pernas: calça, joelheiras de pano, botas altas com fivelas --- */
    [h.pernaE, h.pernaD].forEach((p, i) => {
      const l = i ? 1 : -1;
      tb(B, p, [[0, -0.2, 0.008], [0, -0.36, 0.008], [0, -0.52, 0.0]], [0.074, 0.066, 0.056], COE, { ...mC, seg: 3, rad: 8 });
      B.tor(p, 0.078, 0.02, CO, 0, -0.205, 0.008, { rx: PI / 2, seg: 9, ...mC });                                                        // cano dobrado
      B.blob(p, 0.085, COE, 0, -0.545, 0.055, { ...mC, sx: 0.76, sy: 0.5, sz: 1.55, amp: 0.04, seg: 9 });
      B.cone(p, 0.04, 0.07, COE, 0, -0.545, 0.155, { rx: PI / 2, seg: 5, ...mC, linha: false });
      [-0.3, -0.42].forEach(y => { B.tor(p, 0.068, 0.009, CO, 0, y, 0.0, { rx: PI / 2, seg: 8, ...mC, linha: false }); B.cx(p, 0.026, 0.026, 0.012, OV, l * 0.0, y, 0.066, { ...mO, linha: false }); });
      B.tor(p, 0.076, 0.012, 0xb09a6a, 0, -0.275, 0.014, { rx: PI / 2, seg: 8, ...mT, linha: false });                                  // faixa no joelho
      B.cx(p, 0.03, 0.05, 0.016, COE, l * 0.07, -0.41, 0.0, { ...mC, linha: false });                                                    // faca na bota
    });

    /* --- gibão de couro, tiras, fivelas, laços, pteruges --- */
    B.torno(tronco, [[0.158, 0.02], [0.145, 0.11], [0.173, 0.3], [0.19, 0.4], [0.115, 0.455], [0.095, 0.47]], CO, 0, 0, 0, { ...mC, sz: 0.84, seg: 14 });
    [0.18, 0.26, 0.34].forEach(y => B.tor(tronco, 0.152 + y * 0.12, 0.007, COE, 0, y, 0, { rx: PI / 2, sy: 0.84, seg: 14, ...mC, linha: false }));   // costuras
    for (let k = 0; k < 6; k++) B.cx(tronco, 0.045, 0.008, 0.008, 0xd8c9a0, (k % 2 ? 0.02 : -0.02) * 1, 0.4 - k * 0.04, 0.175, { rz: k % 2 ? 0.6 : -0.6, linha: false });   // cadarço
    tb(B, tronco, [[-0.15, 0.435, 0.125], [-0.08, 0.34, 0.17], [0.03, 0.22, 0.19], [0.12, 0.12, 0.17], [0.17, 0.06, 0.12]], [0.018, 0.018, 0.018, 0.018, 0.018], COE, { ...mC, seg: 8, rad: 5 });    // tira peito
    [[-0.08, 0.34, 0.185], [0.03, 0.22, 0.205]].forEach(([x, y, z]) => B.cx(tronco, 0.03, 0.03, 0.012, OV, x, y, z, { ...mO, rz: -0.6 }));
    tb(B, tronco, [[0.15, 0.435, 0.125], [0.1, 0.36, -0.1], [-0.02, 0.22, -0.18], [-0.1, 0.1, -0.15]], [0.016, 0.016, 0.016, 0.016], COE, { ...mC, seg: 8, rad: 5 });   // tira da aljava
    B.torno(tronco, [[0.18, 0.0], [0.19, 0.04], [0.18, 0.07]], COE, 0, 0.03, 0, { ...mC, sz: 0.84, seg: 14 });                            // cinto largo
    B.cx(tronco, 0.045, 0.055, 0.016, OV, 0, 0.065, 0.165, { ...mO });
    volta(10, 0.17, 0.0, 0.86).forEach(([x, y, z, t], i) => { const g = B.grupo(tronco, x, 0.01, z); g.rotation.y = t; lam(B, g, 0.08, 0.06, 0.1 + (i % 2) * 0.03, i % 2 ? CO : COE, 0, 0, 0, { ...mC, curv: 2.5, punta: 0.02, rx: 0.25 }); });  // pteruges
    // adagas gêmeas e bolsa
    [-1, 1].forEach(l => {
      const ad = B.grupo(tronco, l * 0.15, 0.04, 0.1); ad.rotation.z = l * 0.9; ad.rotation.x = -0.2;
      B.cil(ad, 0.014, 0.016, 0.07, COE, 0, 0, 0, { ...mC, seg: 6, linha: false });
      B.esf(ad, 0.016, OV, 0, 0.04, 0, { seg: 6, ...mO, linha: false });
      B.cx(ad, 0.07, 0.014, 0.014, OV, 0, -0.04, 0, { ...mO, linha: false });
      B.cx(ad, 0.03, 0.17, 0.016, 0x7a5a3a, 0, -0.14, 0, { ...mC });                                                                     // bainha
      B.cone(ad, 0.016, 0.04, OV, 0, -0.25, 0, { rx: PI, seg: 5, ...mO, linha: false });
    });
    const bolsa = B.grupo(tronco, 0.0, 0.0, -0.17);
    B.blob(bolsa, 0.06, CO, 0, -0.03, 0, { ...mC, sx: 1.3, sy: 0.9, sz: 0.7, amp: 0.05, seg: 8 });
    B.cx(bolsa, 0.12, 0.03, 0.07, COE, 0, 0.0, 0, { ...mC, linha: false });

    /* --- ombreira de couro, braçadeiras, luvas --- */
    [h.bracoE, h.bracoD].forEach((b, i) => {
      const l = i ? 1 : -1;
      tb(B, b, [[l * 0.03, -0.215, -0.005], [l * 0.025, -0.28, 0.04], [l * 0.016, -0.325, 0.095]], [0.057, 0.052, 0.046], CO, { ...mC, seg: 3, rad: 8 });    // braçadeira
      [-0.255, -0.3].forEach((y, k) => B.tor(b, 0.055 - k * 0.004, 0.007, COE, l * (0.026 - k * 0.006), y, 0.034 + k * 0.034, { rx: PI / 2 + 0.7, seg: 8, ...mC, linha: false }));
      rebites(B, b, [[l * 0.05, -0.25, 0.03], [l * 0.045, -0.29, 0.058]], 0.007, OV);
      B.cx(b, 0.026, 0.026, 0.012, OV, l * 0.045, -0.275, 0.05, { ...mO, linha: false });
      B.tor(b, 0.066, 0.012, 0xb09a6a, l * 0.02, -0.07, 0, { rx: PI / 2, seg: 8, ...mT, linha: false });
    });
    const sp = B.grupo(h.bracoE, -0.01, 0.045, 0); sp.rotation.z = 0.5;                                                                     // ombreira esquerda (couro e tachas)
    casca(B, sp, 0.125, 0, 1.2, CO, 0, 0, 0, { ...mC, seg: 10, segV: 3, sz: 1.0 });
    casca(B, sp, 0.14, 0.7, 1.35, COE, 0, -0.03, 0, { ...mC, seg: 10, segV: 2 });
    rebites(B, sp, volta(6, 0.1, 0.06, 1, 0, T2).map(a => [a[0], 0.07, a[2]]), 0.009, OV);

    /* --- capuz, máscara, cabelo --- */
    casca(B, cabeca, 0.18, 0, 2.1, VE, 0, 0.02, -0.014, { ...mT, phi0: PI / 2 + 0.7, phi1: T2 - 1.4, seg: 12, segV: 5, dupla: true });    // capuz
    casca(B, cabeca, 0.18, 0, 1.25, VE, 0, 0.02, -0.014, { ...mT, seg: 10, segV: 3, dupla: true });                                         // topo fechado
    lam(B, cabeca, 0.2, 0.17, 0.07, VE, 0, 0.115, 0.1, { ...mT, curv: 6, rx: -0.9, e: 0.014, nx: 6, punta: 0.03, dupla: true });                        // aba do capuz
    tb(B, cabeca, [[0.13, 0.08, -0.05], [0.2, 0.14, -0.14], [0.26, 0.08, -0.26], [0.27, -0.06, -0.3]], [0.008, 0.012, 0.01, 0.003], 0xe8e0d0, { seg: 8, rad: 4, linha: false });   // pena
    tb(B, cabeca, [[0.2, 0.14, -0.14], [0.26, 0.08, -0.26], [0.27, -0.06, -0.3]], [0.028, 0.03, 0.004], LEN, { seg: 6, rad: 5, linha: false, tex: 'pelo', rep: 1 });
    B.cone(cabeca, 0.12, 0.26, VE, 0, 0.0, -0.17, { ...mT, rx: -PI / 2 - 0.9, seg: 8 });                                                    // ponta do capuz
    B.tor(cabeca, 0.15, 0.016, VM, 0, 0.0, 0.0, { rx: PI / 2 - 0.4, ...mT, seg: 12, arco: 4.8, rz: PI / 2 + 0.7, linha: false });              // bainha do capuz
    casca(B, cabeca, 0.143, 1.62, 2.55, LEN, 0, 0.0, 0.0, { ...mT, phi0: PI / 2 - 1.0, phi1: 2.0, seg: 10, segV: 3 });                        // lenço/máscara
    B.cone(cabeca, 0.04, 0.05, LEN, 0, -0.01, 0.13, { rx: PI / 2 + 0.3, seg: 6, ...mT, linha: false });
    B.cx(cabeca, 0.1, 0.012, 0.01, 0x5a1c1c, 0, -0.025, 0.138, { rz: 0, linha: false });
    [-1, 1].forEach(l => { B.cx(cabeca, 0.05, 0.016, 0.02, 0x1c1208, l * 0.05, 0.05, 0.123, { rz: -l * 0.3, rx: -0.2, linha: false }); });
    tb(B, cabeca, [[0.06, -0.09, 0.1], [0.12, -0.12, 0.02], [0.14, -0.2, -0.1]], [0.015, 0.02, 0.012], LEN, { ...mT, seg: 5, rad: 5, linha: false });      // ponta do lenço
    const tira = B.grupo(cabeca, 0.0, -0.1, -0.15);
    tb(B, tira, [[0.0, 0, 0], [0.02, -0.08, -0.04], [-0.02, -0.17, -0.02]], [0.02, 0.02, 0.006], LEN, { ...mT, seg: 5, rad: 5, linha: false });

    /* --- capa de viagem esfarrapada --- */
    const capaPivo = B.grupo(tronco, 0, 0.45, -0.1);
    const capa = B.grupo(capaPivo, 0, 0, 0);
    const fzc = (u, v, x) => -v * 0.25 + Math.abs(x) * Math.abs(x) * 0.8 * (1 - v * 0.4);
    meuV(B, capa, panoGeo(0.4, 0.8, 0.88, { dobras: 5.5, amp: 0.06, nx: 16, ny: 6, barra: 7, rasgo: 0.16, fz: fzc }), (x, y, z) => mixCor(0x4c7440, 0x1c3220, -y / 0.9 + Math.sin(x * 60) * 0.1), 0, 0, -0.06, { ...mT, dupla: true, esp: 0.012 });
    B.torno(tronco, [[0.225, 0.34], [0.215, 0.39], [0.17, 0.44], [0.115, 0.465]], VM, 0, 0, 0, { ...mT, sz: 0.88, seg: 12, dupla: true });             // pelerine
    B.tor(tronco, 0.12, 0.022, VE, 0, 0.465, 0.005, { rx: PI / 2, sy: 0.9, seg: 10, ...mT, linha: false });
    B.esf(tronco, 0.026, OV, 0.0, 0.43, 0.17, { ...mO, seg: 7, sz: 0.5 });                                                                  // broche

    /* --- aljava com flechas --- */
    const alj = B.grupo(tronco, 0.07, 0.27, -0.2); alj.rotation.z = -0.32; alj.rotation.x = -0.2;
    B.torno(alj, [[0.052, -0.22], [0.062, -0.1], [0.07, 0.1], [0.075, 0.22]], CO, 0, 0, 0, { ...mC, seg: 10 });
    B.tor(alj, 0.075, 0.01, OV, 0, 0.215, 0, { rx: PI / 2, seg: 10, ...mO, linha: false });
    B.tor(alj, 0.054, 0.01, OV, 0, -0.2, 0, { rx: PI / 2, seg: 10, ...mO, linha: false });
    B.cil(alj, 0.07, 0.07, 0.01, 0x1a0e06, 0, 0.215, 0, { seg: 10, linha: false });
    B.esf(alj, 0.022, OV, 0, 0.0, -0.07, { ...mO, seg: 7, sz: 0.4, linha: false });
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * T2, rr = 0.032, x = Math.cos(a) * rr, z = Math.sin(a) * rr, alt = 0.1 + (k % 3) * 0.04, g = B.grupo(alj, x, 0.2, z);
      g.rotation.z = -x * 2.2; g.rotation.x = z * 2.2;
      B.cil(g, 0.005, 0.005, alt + 0.1, 0xcaa56a, 0, alt / 2, 0, { seg: 4, linha: false });
      const cor = k % 2 ? 0xe8e0d0 : LEN;
      for (let f = 0; f < 3; f++) { const fg = B.grupo(g, 0, alt - 0.01, 0); fg.rotation.y = f * T2 / 3; lam(B, fg, 0.026, 0.03, 0.07, cor, 0.013, 0, 0, { curv: 0, e: 0.004, linha: false, nx: 1, ry: PI / 2, rz: 0.08 }); }
    }

    /* --- arco longo recurvado com corda --- */
    const arco = B.grupo(h.maoE, 0, -0.02, 0.0); arco.rotation.x = -0.12; arco.rotation.z = -0.1; arco.rotation.y = -0.85;
    const pts = [[0, -0.72, 0.0], [0, -0.64, -0.06], [0, -0.45, 0.0], [0, -0.22, 0.09], [0, 0, 0.105], [0, 0.22, 0.09], [0, 0.45, 0.0], [0, 0.64, -0.06], [0, 0.72, 0.0]];
    tb(B, arco, pts, [0.01, 0.018, 0.026, 0.03, 0.034, 0.03, 0.026, 0.018, 0.01], 0x6a3f1e, { tex: 'couro', rep: 1, relevo: 0.03, seg: 22, rad: 6 });
    tb(B, arco, [[0, -0.715, 0.0], [0, 0, 0.0], [0, 0.715, 0.0]], [0.0045, 0.0045, 0.0045], 0xe8e0c8, { seg: 2, rad: 3, linha: false });   // corda
    B.cil(arco, 0.034, 0.034, 0.13, COE, 0, 0, 0.095, { ...mC, seg: 8 });                                                                    // empunhadura
    [-0.05, 0.05].forEach(y => B.tor(arco, 0.036, 0.006, OV, 0, y, 0.095, { rx: PI / 2, seg: 8, ...mO, linha: false }));
    [-1, 1].forEach(l => { B.esf(arco, 0.016, OV, 0, l * 0.72, 0.0, { ...mO, seg: 6, linha: false }); B.tor(arco, 0.02, 0.005, OV, 0, l * 0.3, 0.07, { rx: PI / 2, seg: 6, ...mO, linha: false }); });
    B.cx(arco, 0.045, 0.09, 0.012, 0xc2a050, 0, 0.1, 0.12, { ...mO, linha: false });

    return { altura: 1.55, p: { ...h, balancos: [{ g: capaPivo, amp: 0.06, vel: 1.9, eixo: 'x', fase: 0.5 }, { g: capa, amp: 0.05, vel: 2.6, eixo: 'z', fase: 0 }, { g: tira, amp: 0.25, vel: 3.2, eixo: 'x', fase: 1 }] } };
  }

  /* ================= ORÁCULO ================= */
  function oraculo(B, R) {
    const RX = 0x6c40b8, RXE = 0x3a2080, BR = 0xf2ecff, OURO = 0xe6b13a, CIANO = 0x9ae6ff, PELE = 0xe9bf9a;
    const mT = { tex: 'tecido', rep: 1, relevo: 0.008, rough: 0.85 }, mO = { metal: 0.85, rough: 0.28 }, mC = { tex: 'couro', rep: 1, relevo: 0.03, rough: 0.7 };
    const RUNA = 0x55c8ff;
    const brilha = { emissive: CIANO, brilho: 1.2, linha: false };
    const h = esqueleto(B, R, { s: 0.98, w: 0.9, pele: PELE, tec: RX, calca: RXE, manga: RX, antebraco: PELE, olhos: 0xc8f6ff, iris: 0x4ac8ff, irisBrilho: 1.6, sobrancelha: 0xe8e8f0, perfil: [[0.14, 0], [0.12, 0.11], [0.16, 0.3], [0.175, 0.4], [0.1, 0.48]] });
    const { tronco, cabeca } = h;

    /* --- robe longo com pregas e barra dourada --- */
    const perfil = [[0.4, 0.03], [0.365, 0.12], [0.31, 0.3], [0.245, 0.5], [0.2, 0.66], [0.19, 0.8], [0.2, 0.92], [0.185, 1.0], [0.11, 1.04]];
    meuV(B, R, tornoDobras(perfil, 40, 9, 0.07, 0.4, 0.02), (x, y, z) => mixCor(RXE, 0x8a5ad8, (y - 0.0) / 1.0 * 1.15 + Math.sin(Math.atan2(x, z) * 9 + 0.4) * 0.12), 0, 0, 0, { ...mT, sz: 0.92 });
    meuV(B, R, tornoDobras([[0.402, 0.03], [0.394, 0.07], [0.375, 0.12]], 40, 9, 0.07, 0.4, 0.02), () => 0xf0c24a, 0, 0, 0, { ...mO, sz: 0.92, linha: false, dupla: true });   // barra dourada
    const rr = y => { for (let i = 1; i < perfil.length; i++) if (y <= perfil[i][1]) return lerp(perfil[i - 1][0], perfil[i][0], (y - perfil[i - 1][1]) / (perfil[i][1] - perfil[i - 1][1])); return 0.1; };
    meuV(B, R, panoGeo(0.17, 0.27, 0.92, { dobras: 2, amp: 0.012, nx: 6, ny: 8, fz: (u, v, x) => rr(0.97 - v * 0.92) * 0.92 + 0.02 - x * x * 1.2 }), (x, y) => mixCor(0xffffff, 0xd8cff2, -y / 0.92), 0, 0.97, 0, { ...mT, dupla: true, esp: 0.01 });   // faixa branca frontal
    pano(B, R, 0.275, 0.275, 0.025, OURO, 0, 0.07, 0.0, { ...mO, nx: 6, ny: 1, linha: false, fz: (u, v, x) => rr(0.07) * 0.92 + 0.035 - x * x * 1.2, tex: undefined });
    [0.1, 0.28, 0.46, 0.64, 0.82].forEach((y, i) => meu(B, R, runaGeo(i + 1, 0.085), OURO, 0, y, rr(y) * 0.92 + 0.032, { ...mO, linha: false, caixa: true }));   // runas bordadas
    [-1, 1].forEach(l => tb(B, R, [[l * 0.07, 0.95, rr(0.95) * 0.92 + 0.03], [l * 0.1, 0.6, rr(0.6) * 0.92 + 0.03], [l * 0.14, 0.1, rr(0.1) * 0.92 + 0.035]], [0.006, 0.006, 0.006], OURO, { ...mO, seg: 8, rad: 4, linha: false }));

    /* --- cinto de corda dourada, livro, pergaminho, amuleto --- */
    B.tor(tronco, 0.18, 0.02, OURO, 0, 0.05, 0, { rx: PI / 2, sy: 0.92, seg: 14, ...mO });
    tb(B, tronco, [[0.08, 0.05, 0.17], [0.1, -0.1, 0.19], [0.09, -0.25, 0.2]], [0.012, 0.012, 0.01], OURO, { ...mO, seg: 5, rad: 5, linha: false });
    B.cone(tronco, 0.03, 0.08, OURO, 0.09, -0.3, 0.2, { rx: PI, seg: 6, ...mO, linha: false });
    const livro = B.grupo(tronco, -0.17, -0.02, 0.1); livro.rotation.y = -0.8; livro.rotation.z = 0.1;
    B.cx(livro, 0.14, 0.18, 0.045, 0x4a2a8a, 0, 0, 0, { ...mC, tex: 'couro' });
    B.cx(livro, 0.125, 0.165, 0.035, 0xf0e6c8, 0.008, 0, 0.0, { linha: false });
    B.cx(livro, 0.145, 0.185, 0.012, 0x3a2070, 0, 0, 0.026, { ...mC, linha: false });
    B.esf(livro, 0.02, CIANO, 0, 0, 0.04, { emissive: CIANO, seg: 6, linha: false });
    [-1, 1].forEach(l => B.cx(livro, 0.03, 0.03, 0.014, OURO, l * 0.07, l * 0.09, 0.028, { ...mO, linha: false }));
    const perg = B.grupo(tronco, 0.14, 0.0, -0.15); perg.rotation.z = 1.2; perg.rotation.x = 0.2;
    B.cil(perg, 0.03, 0.03, 0.2, 0xe8d8a8, 0, 0, 0, { ...mT, seg: 8 });
    [-1, 1].forEach(l => B.cil(perg, 0.036, 0.036, 0.02, OURO, 0, l * 0.1, 0, { ...mO, seg: 8, linha: false }));
    tb(B, tronco, [[-0.09, 0.47, 0.14], [-0.06, 0.37, 0.19], [0, 0.31, 0.21], [0.06, 0.37, 0.19], [0.09, 0.47, 0.14]], [0.006, 0.006, 0.006, 0.006, 0.006], OURO, { ...mO, seg: 8, rad: 4, linha: false });
    B.octa(tronco, 0.035, CIANO, 0, 0.27, 0.215, { emissive: CIANO, brilho: 1.0, sz: 0.6, linha: false });
    B.tor(tronco, 0.05, 0.01, OURO, 0, 0.27, 0.212, { seg: 10, ...mO, linha: false });

    /* --- ombros, mantos, mangas largas --- */
    B.torno(tronco, [[0.23, 0.34], [0.225, 0.4], [0.18, 0.45], [0.11, 0.47]], BR, 0, 0, 0, { ...mT, sz: 0.88, seg: 14, dupla: true });
    B.tor(tronco, 0.225, 0.014, OURO, 0, 0.345, 0, { rx: PI / 2, sy: 0.88, seg: 14, ...mO, linha: false });
    [h.bracoE, h.bracoD].forEach((b, i) => {
      const l = i ? 1 : -1;
      const m = B.grupo(b, l * 0.03, -0.19, -0.01); m.rotation.x = -0.7; m.rotation.z = -l * 0.1;
      meuV(B, m, tornoDobras([[0.16, -0.2], [0.13, -0.12], [0.085, -0.04], [0.065, 0.0]], 14, 5, 0.09, i, 0.0), (x, y) => mixCor(0xb89aea, RX, (y + 0.2) / 0.2 * 0.9), 0, 0, 0, { ...mT, dupla: true });
      B.tor(m, 0.158, 0.012, OURO, 0, -0.2, 0, { rx: PI / 2, seg: 12, ...mO, linha: false });
      B.tor(m, 0.15, 0.022, BR, 0, -0.185, 0, { rx: PI / 2, seg: 12, ...mT, linha: false });
      rebites(B, m, [[0.05, 0, 0.1]], 0.001, OURO);
      B.esf(b, 0.1, RX, l * 0.005, 0.0, 0, { ...mT, sy: 0.85, seg: 9 });                                                                  // ombro redondo
    });

    /* --- cabeça: diadema com gema, cabelo e barba ao vento --- */
    casca(B, cabeca, 0.152, 0, 1.9, BR, 0, 0.014, -0.012, { tex: 'pelo', rep: 1, relevo: 0.02, rough: 0.95, phi0: PI / 2 + 1.15, phi1: T2 - 2.3, seg: 12, segV: 5 });
    casca(B, cabeca, 0.15, 0, 1.0, BR, 0, 0.02, -0.01, { tex: 'pelo', rep: 1, relevo: 0.02, rough: 0.95, seg: 10, segV: 3, phi0: PI / 2 + 0.6, phi1: T2 - 1.2 });
    B.tor(cabeca, 0.14, 0.012, OURO, 0, 0.075, 0.0, { rx: PI / 2 - 0.12, seg: 14, ...mO, linha: false });                                   // diadema
    B.octa(cabeca, 0.032, 0x7ad0ff, 0, 0.085, 0.145, { emissive: 0x3ac0ff, brilho: 1.4, sz: 0.7, linha: false });
    B.cone(cabeca, 0.02, 0.05, OURO, 0, 0.125, 0.14, { seg: 4, ...mO, linha: false });
    [-1, 1].forEach(l => { B.cone(cabeca, 0.016, 0.07, OURO, l * 0.07, 0.115, 0.125, { rz: -l * 0.4, seg: 4, ...mO, linha: false }); B.cx(cabeca, 0.07, 0.02, 0.02, 0xe8e8f0, l * 0.052, 0.052, 0.126, { rz: -l * 0.25, linha: false }); });
    const cab = B.grupo(cabeca, 0, 0.0, -0.1);
    [[0.08, 0], [-0.08, 0], [0.0, 0.03], [0.04, -0.03]].forEach(([x, y], i) => tb(B, cab, [[x, 0.06 + y, 0.0], [x * 1.3, -0.08, -0.07], [x * 1.6, -0.25, -0.1 - i * 0.015], [x * 1.5, -0.4, -0.06 - i * 0.02]], [0.045, 0.04, 0.03, 0.006], i % 2 ? 0xe4e0f4 : BR, { seg: 8, rad: 6, rough: 0.8, linha: i < 2 }));
    const barba = B.grupo(cabeca, 0, -0.08, 0.1);
    B.blob(barba, 0.08, BR, 0, -0.02, 0.0, { rough: 0.8, sx: 1.0, sy: 1.0, sz: 0.8, amp: 0.1, seg: 8, seed: 5 });
    [0, 1, 2].forEach(i => tb(B, barba, [[(i - 1) * 0.03, -0.04, 0.03], [(i - 1) * 0.045, -0.15, 0.06], [(i - 1) * 0.02, -0.28 + (i === 1 ? -0.06 : 0), 0.06]], [0.05 - i % 2 * 0.01, 0.04, 0.004], i % 2 ? 0xe4e0f4 : BR, { seg: 6, rad: 6, rough: 0.8, linha: i === 1 }));
    B.cx(cabeca, 0.1, 0.02, 0.025, BR, 0, -0.05, 0.128, { linha: false });                                                     // bigode

    /* --- manto curto de costas --- */
    const mantoP = B.grupo(tronco, 0, 0.46, -0.12), manto = B.grupo(mantoP, 0, 0, 0);
    const fzm = (u, v, x) => -v * 0.18 + x * x * 0.8;
    meuV(B, manto, panoGeo(0.36, 0.6, 0.82, { dobras: 3.5, amp: 0.04, nx: 12, ny: 6, barra: 5, fz: fzm }), (x, y) => mixCor(0xf4f0ff, 0x9a78e0, -y / 0.82 * 1.1), 0, 0, -0.06, { ...mT, dupla: true, esp: 0.012 });
    meuV(B, manto, panoGeo(0.585, 0.6, 0.05, { dobras: 3.5, amp: 0.04, nx: 12, ny: 1, fz: (u, v, x) => fzm(u, 0.94, x) - 0.002 }), () => 0xf0c24a, 0, -0.77, -0.06, { ...mO, dupla: true, linha: false });

    /* --- cajado alto com orbe e crescente --- */
    const caj = B.grupo(h.maoD, 0, -0.03, 0.02); caj.rotation.x = -0.1;
    tb(B, caj, [[0, -0.66, 0], [0, 0.0, 0.0], [0, 0.5, 0.01], [0, 0.78, 0.0]], [0.026, 0.03, 0.026, 0.024], 0x6a4a2a, { tex: 'couro', rep: 1, relevo: 0.04, seg: 10, rad: 7 });
    [-0.3, 0.0, 0.25, 0.5, 0.74].forEach((y, i) => B.tor(caj, 0.034, 0.008, OURO, 0, y, 0, { rx: PI / 2, seg: 8, ...mO, linha: false }));
    B.cone(caj, 0.03, 0.08, OURO, 0, -0.7, 0, { rx: PI, seg: 6, ...mO, linha: false });
    const topo = B.grupo(caj, 0, 0.78, 0);
    tb(B, topo, [[-0.02, 0.0, 0], [-0.1, 0.1, 0], [-0.13, 0.24, 0], [-0.06, 0.34, 0]], [0.026, 0.02, 0.017, 0.008], OURO, { ...mO, seg: 10, rad: 6 });
    tb(B, topo, [[0.02, 0.0, 0], [0.1, 0.1, 0], [0.13, 0.24, 0], [0.06, 0.34, 0]], [0.026, 0.02, 0.017, 0.008], OURO, { ...mO, seg: 10, rad: 6 });
    B.octa(topo, 0.035, OURO, 0, 0.0, 0, { ...mO, sy: 1.4, linha: false });
    const orbe = B.vivo(B.esf(topo, 0.085, CIANO, 0, 0.2, 0, { emissive: CIANO, brilho: 1.3, seg: 14, linha: false }));
    const nuc = B.vivo(B.esf(topo, 0.04, 0xffffff, 0, 0.2, 0, { emissive: 0xffffff, brilho: 1.6, seg: 8, linha: false }));
    const halo = B.vivo(B.esf(topo, 0.14, CIANO, 0, 0.2, 0, { emissive: CIANO, op: 0.16, brilho: 0.8, seg: 12, linha: false }));
    const aneisT = [0, 1].map(i => { const a = B.grupo(topo, 0, 0.2, 0), g = B.grupo(a, 0, 0, 0); a.rotation.x = 1.0 * i - 0.2; a.rotation.z = i * 0.7; B.tor(g, 0.16 + i * 0.03, 0.007, OURO, 0, 0, 0, { seg: 18, ...mO, linha: false });
      for (let k = 0; k < 4; k++) { const t = k * T2 / 4; meu(B, g, runaGeo(k + i, 0.04), CIANO, Math.cos(t) * (0.16 + i * 0.03), 0, Math.sin(t) * (0.16 + i * 0.03), { ...brilha, ry: -t + PI / 2, caixa: true }); }
      return g; });
    [-1, 1].forEach(l => B.tubo(topo, [[l * 0.04, 0.0, 0], [l * 0.05, -0.1, 0.01], [l * 0.04, -0.2, 0]], [0.004, 0.004, 0.002], 0xe8e0d0, { seg: 4, rad: 3, linha: false, pontas: false }));

    /* --- orbe flutuando na mão esquerda e anéis rúnicos em volta --- */
    const faisca = B.vivo(B.esf(h.maoE, 0.04, CIANO, 0, 0.06, 0.1, { emissive: CIANO, brilho: 1.4, seg: 8, linha: false }));
    const mkAnel = (raio, y, incl, n, tam) => {
      const a = B.grupo(R, 0, y, 0), g = B.grupo(a, 0, 0, 0); a.rotation.x = incl;
      B.tor(g, raio, 0.008, RUNA, 0, 0, 0, { rx: PI / 2, seg: 30, emissive: RUNA, brilho: 0.9, linha: false, op: 0.8 });
      for (let k = 0; k < n; k++) { const t = k * T2 / n; meu(B, g, runaGeo(k, tam), RUNA, Math.sin(t) * raio, 0.0, Math.cos(t) * raio, { emissive: RUNA, brilho: 1.2, linha: false, ry: t, caixa: true }); }
      return g;
    };
    const an1 = mkAnel(0.44, 1.5, 0.35, 7, 0.13), an2 = mkAnel(0.56, 0.82, -0.28, 8, 0.13), an3 = mkAnel(0.64, 0.3, 0.1, 9, 0.12);

    return {
      altura: 1.7, p: { ...h, balancos: [{ g: mantoP, amp: 0.06, vel: 1.8, eixo: 'x', fase: 0 }, { g: manto, amp: 0.05, vel: 2.4, eixo: 'z', fase: 1 }, { g: cab, amp: 0.18, vel: 2.2, eixo: 'x', fase: 0.3 }, { g: barba, amp: 0.1, vel: 2.6, eixo: 'x', fase: 1.2 }] },
      anim: (t) => {
        an1.rotation.y = t * 0.9; an2.rotation.y = -t * 1.1; an3.rotation.y = t * 0.6;
        aneisT[0].rotation.y = t * 1.6; aneisT[1].rotation.y = -t * 1.2;
        const p = 1 + Math.sin(t * 3) * 0.12; orbe.scale.setScalar(p); halo.scale.setScalar(1 + Math.sin(t * 2.3) * 0.15); nuc.scale.setScalar(1 + Math.sin(t * 5) * 0.2);
        orbe.material.emissiveIntensity = 1.2 + Math.sin(t * 3) * 0.35;
        faisca.position.y = 0.06 + Math.sin(t * 2.6) * 0.03; faisca.scale.setScalar(1 + Math.sin(t * 4) * 0.2);
      },
    };
  }

  /* ================= CAOS PRIMORDIAL (chefe final) ================= */
  const orienta = (g, dx, dy, dz, roll = 0) => {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(dx, dy, dz).normalize());
    g.quaternion.copy(q); if (roll) g.rotateZ(roll); return g;
  };
  /** boca elíptica (rx, ry) cheia de dentes: duas fileiras apontando para o centro. Devolve [grupo, mandíbula] */
  function boca(B, pai, x, y, z, rx, ry, dx, dy, dz, o = {}) {
    const g = B.grupo(pai, x, y, z); orienta(g, dx, dy, dz, o.roll || 0);
    B.esf(g, 1, 0x12040e, 0, 0, -0.02, { sx: rx, sy: ry, sz: 0.1, emissive: o.fundo ?? 0xff2a6a, brilho: 0.55, seg: 10, linha: true });                              // garganta que brilha
    B.tor(g, 1, 0.02, 0x3a1060, 0, 0, 0.0, { sx: rx * 1.08, sy: ry * 1.12, seg: 16, tex: 'carne', linha: false });
    const n = o.n || 10, dente = 0xece4d2, mand = B.grupo(g, 0, 0, 0);
    for (let i = 0; i < n; i++) for (let lado = 0; lado < 2; lado++) {
      const t = (i + 0.5) / n, a = lado ? PI + 0.25 + t * (PI - 0.5) : 0.25 + t * (PI - 0.5), tam = (o.tam || 0.07) * (0.7 + Math.sin(t * PI) * 0.6 + (i % 2) * 0.25);
      const d = B.cone(lado ? mand : g, tam * 0.34, tam * 1.5, dente, Math.cos(a) * rx * 0.97, Math.sin(a) * ry * 0.97, 0.01, { rz: a + PI / 2, rx: 0.15, seg: 5, tex: 'osso', linha: false, rough: 0.5 });
    }
    return [g, mand];
  }

  function caos(B, R) {
    const ESC = 0x2a1254, VIO = 0xb48aff, BRANCO = 0xf4ecff, MAG = 0xff4adf, CIANO = 0x6ae8ff;
    const mCarne = { tex: 'carne', rep: 1, relevo: 0.05, rough: 0.55 };
    const c = B.grupo(R, 0, 1.12, 0);
    const corpoC = B.grupo(c, 0, 0, 0);

    /* --- massa de energia: carne escura com veias que brilham --- */
    B.blob(corpoC, 0.62, ESC, 0, 0, 0, { ...mCarne, amp: 0.12, freq: 2.2, seed: 4, seg: 18, sy: 0.95, emissive: 0x3a1070, brilho: 0.4 });
    [[-0.45, 0.35, -0.2, 0.3], [0.5, 0.3, -0.25, 0.32], [0.0, 0.58, -0.1, 0.24], [-0.4, -0.3, -0.35, 0.3], [0.1, 0.0, -0.62, 0.32]].forEach(([x, y, z, r], i) =>
      B.blob(corpoC, r, i % 2 ? 0x34186a : ESC, x, y, z, { ...mCarne, amp: 0.2, seed: i + 7, seg: 9, emissive: 0x3a1070, brilho: 0.35, linha: false }));
    B.esf(corpoC, 0.76, VIO, 0, 0, 0, { op: 0.13, emissive: VIO, brilho: 0.5, seg: 16, linha: false });                                            // membrana
    for (let k = 0; k < 7; k++) {
      const pts = [];
      for (let i = 0; i < 7; i++) { const t = i / 6, a = k * 0.9 + t * 2.3 + Math.sin(k * 5.1 + i) * 0.3, b = lerp(-0.9, 0.9, t) + Math.sin(k * 3.3) * 0.5, r = 0.635; pts.push([Math.cos(b) * Math.sin(a) * r, Math.sin(b) * r * 0.95, Math.cos(b) * Math.cos(a) * r]); }
      tb(B, corpoC, pts, [0.006, 0.014, 0.018, 0.014, 0.018, 0.012, 0.005], k % 2 ? MAG : VIO, { seg: 14, rad: 4, emissive: k % 2 ? MAG : VIO, brilho: 1.1, linha: false });
    }
    // cristais saindo das costas e do topo
    const cores = [VIO, CIANO, MAG, BRANCO];
    for (let i = 0; i < 13; i++) {
      const a = i * 2.4, b = lerp(-0.2, 1.2, (i * 0.37) % 1), dx = Math.sin(a) * Math.cos(b), dy = Math.sin(b), dz = Math.cos(a) * Math.cos(b) - 0.25;
      if (dz > 0.35 && dy < 0.5) continue;
      const g = B.grupo(corpoC, dx * 0.58, dy * 0.55, dz * 0.58); orienta(g, dx, dy, dz);
      const L = 0.2 + ((i * 7) % 5) * 0.07, cor = cores[i % 4];
      B.cil(g, 0.0, 0.05 + (i % 3) * 0.015, L, cor, 0, 0, L / 2, { rx: PI / 2, seg: 6, tex: 'cristal', emissive: cor, brilho: 0.8, metal: 0.2, rough: 0.2, linha: i % 2 === 0 });
      B.cil(g, 0.0, 0.03, L * 0.6, cor, 0.05, 0, L * 0.3 + 0.03, { rx: PI / 2, rz: 0.4, seg: 5, emissive: cor, brilho: 0.6, linha: false });
    }

    /* --- vórtice roxo-branco na frente (o "olho" do caos) --- */
    const vz = B.grupo(corpoC, 0, 0.2, 0.5); vz.scale.setScalar(0.88); vz.rotation.x = -0.18;
    B.esf(vz, 0.4, 0x0a0218, 0, 0, 0.0, { sz: 0.35, emissive: 0x2a0a60, brilho: 0.5, seg: 12, linha: true });                                     // vazio escuro
    B.tor(vz, 0.4, 0.045, 0x4a1a90, 0, 0, 0.02, { seg: 20, emissive: MAG, brilho: 0.7, tex: 'cristal', linha: false });                                 // aro
    const vort = B.grupo(vz, 0, 0, 0.1);
    for (let k = 0; k < 5; k++) {
      const pts = [], k0 = k / 5 * T2;
      for (let i = 0; i <= 8; i++) { const t = i / 8, r = 0.05 + t * 0.34, a = k0 + t * 2.6; pts.push([Math.cos(a) * r, Math.sin(a) * r, 0.02 + t * 0.03]); }
      tb(B, vort, pts, [0.004, 0.03, 0.036, 0.03, 0.022, 0.016, 0.012, 0.008, 0.003], k % 2 ? VIO : BRANCO, { seg: 12, rad: 5, emissive: k % 2 ? 0x9a60ff : BRANCO, brilho: 0.9, linha: false });
    }
    const nucleo = B.vivo(B.esf(vz, 0.12, BRANCO, 0, 0, 0.1, { emissive: BRANCO, brilho: 1.7, seg: 12, linha: false }));
    const halo = B.vivo(B.esf(vz, 0.2, VIO, 0, 0, 0.1, { emissive: VIO, op: 0.3, brilho: 1.0, seg: 12, linha: false }));

    /* --- olhos (vários, de tamanhos e cores diferentes) --- */
    const olhos = [[-0.52, -0.05, 0.4, 0.085, MAG], [0.54, -0.02, 0.38, 0.075, CIANO], [-0.38, 0.42, 0.34, 0.06, BRANCO], [0.35, 0.44, 0.36, 0.07, MAG], [-0.62, 0.22, 0.05, 0.1, CIANO], [0.6, 0.25, 0.0, 0.09, BRANCO],
      [-0.3, 0.1, -0.55, 0.09, MAG], [0.28, 0.22, -0.56, 0.11, CIANO], [0.0, 0.5, -0.38, 0.07, BRANCO], [-0.55, -0.3, -0.2, 0.07, VIO], [0.52, -0.35, -0.2, 0.08, MAG], [0.0, 0.62, 0.1, 0.06, CIANO]];
    olhos.forEach(([x, y, z, r0, cor], i) => {
      const r = r0 * 1.3, g = B.grupo(corpoC, x, y, z), d = new THREE.Vector3(x, y, z).normalize(); orienta(g, d.x, d.y, d.z, i * 0.9);
      B.tor(g, r * 1.15, r * 0.25, 0x3a1060, 0, 0, -r * 0.2, { seg: 8, tex: 'carne', linha: false });
      B.esf(g, r, cor === BRANCO ? 0xfff0ff : cor, 0, 0, 0, { emissive: cor, brilho: 1.0, seg: 8, linha: false });
      if (i % 3 !== 1) B.cx(g, r * 0.3, r * 1.6, r * 0.5, 0x0a0608, 0, 0, r * 0.8, { linha: false }); else B.esf(g, r * 0.45, 0x0a0608, 0, 0, r * 0.75, { seg: 6, linha: false });
      B.cone(g, r * 0.25, r * 0.9, 0x4a1a80, r * 0.5, r * 1.0, -r * 0.1, { rz: -0.5, seg: 4, linha: false });
    });

    /* --- bocas e fendas com dentes --- */
    const [b1, mand] = boca(B, corpoC, 0, -0.34, 0.5, 0.36, 0.15, 0, -0.5, 1, { n: 11, tam: 0.085 });
    boca(B, corpoC, -0.62, -0.1, 0.16, 0.22, 0.06, -1, -0.1, 0.25, { n: 7, tam: 0.07, roll: PI / 2 + 0.2, fundo: 0x8a40ff });
    boca(B, corpoC, 0.62, 0.0, 0.14, 0.22, 0.06, 1, 0.0, 0.25, { n: 7, tam: 0.07, roll: PI / 2 - 0.2, fundo: 0x8a40ff });
    boca(B, corpoC, 0, -0.15, -0.6, 0.28, 0.1, 0, -0.15, -1, { n: 9, tam: 0.065, fundo: 0xff2a9a });

    /* --- tentáculos de névoa e cristal --- */
    const tent = [], tg = [];
    const mkTent = (bx, by, bz, ang, comp, grosso, curva, cima) => {
      const piv = B.grupo(corpoC, bx, by, bz); piv.rotation.y = ang;
      const s = cima ? 1 : -1, pts = [[0, 0, 0], [0.04, s * comp * 0.2, comp * 0.18], [0.0, s * comp * 0.5, comp * 0.34], [-curva * 0.2, s * comp * 0.82, comp * 0.42 + curva * 0.2], [-curva * 0.4, s * comp * 0.9 + (cima ? 0.1 : 0.2), comp * 0.22 + curva * 0.4]];
      const geo = kit.tuboGeo(pts, [grosso, grosso * 0.8, grosso * 0.55, grosso * 0.3, 0.006], 12, 6);
      const L = comp * 1.1;
      const m = meuV(B, piv, geo, (x, y, z) => { const d = Math.min(1, Math.hypot(x, y, z) / L); return mixCor(d < 0.55 ? 0x2a1050 : 0x6a2ab0, d < 0.55 ? 0x6a2ab0 : 0xe0c0ff, (d < 0.55 ? d / 0.55 : (d - 0.55) / 0.45)); }, 0, 0, 0, { ...mCarne, emissive: 0x4a1a90, brilho: 0.6, linha: true });
      const ponta = pts[pts.length - 1];
      B.cone(piv, 0.03, 0.12, MAG, ponta[0], ponta[1] + (cima ? 0.05 : -0.04), ponta[2], { rx: cima ? 0 : PI, emissive: MAG, brilho: 1.2, seg: 5, linha: false });
      [0.35, 0.6, 0.8].forEach((t, i) => { const q = pts[Math.round(t * 4)]; B.esf(piv, grosso * 0.35, i % 2 ? CIANO : VIO, q[0], q[1], q[2] + grosso * 0.7, { emissive: i % 2 ? CIANO : VIO, brilho: 1.2, seg: 5, linha: false }); });
      tent.push({ g: piv, amp: 0.16 + (tent.length % 3) * 0.05, vel: 0.9 + (tent.length % 4) * 0.25, eixo: 'x', fase: tent.length * 1.3 });
    };
    for (let i = 0; i < 9; i++) { const a = i / 9 * T2 + Math.sin(i * 2.1) * 0.15; mkTent(Math.sin(a) * 0.4, -0.38 + Math.sin(i * 3.7) * 0.08, Math.cos(a) * 0.4, a, 0.62 + ((i * 5) % 4) * 0.1, 0.06 + (i % 3) * 0.02, Math.sin(i * 1.7) * 0.4, false); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * T2 + 0.8; mkTent(Math.sin(a) * 0.35, 0.42, Math.cos(a) * 0.35 - 0.1, a, 0.52, 0.05, 0.15, true); }
    [0, 1, 2, 3].forEach(i => {   // fiapos de névoa translúcidos
      const a = i / 4 * T2 + 0.4, piv = B.grupo(corpoC, Math.sin(a) * 0.5, -0.2, Math.cos(a) * 0.5); piv.rotation.y = a;
      tb(B, piv, [[0, 0, 0], [0.08, -0.25, 0.25], [-0.05, -0.55, 0.45], [0.1, -0.85, 0.5]], [0.05, 0.04, 0.025, 0.004], VIO, { seg: 8, rad: 5, op: 0.32, emissive: VIO, brilho: 0.6, linha: false });
      tent.push({ g: piv, amp: 0.2, vel: 1.2 + i * 0.15, eixo: 'x', fase: i * 0.9 });
    });

    /* --- anéis rúnicos e mundos em órbita --- */
    const RUNA = 0xa874ff;
    const mkAnel = (raio, incl, inclz, n, tam, cor = RUNA) => {
      const a = B.grupo(c, 0, 0, 0), g = B.grupo(a, 0, 0, 0); a.rotation.x = incl; a.rotation.z = inclz;
      B.tor(g, raio, 0.013, cor, 0, 0, 0, { rx: PI / 2, seg: 26, emissive: cor, brilho: 0.7, linha: false });
      for (let k = 0; k < n; k++) { const t = k * T2 / n; meu(B, g, runaGeo(k + n, tam), cor, Math.sin(t) * raio, 0, Math.cos(t) * raio, { emissive: cor, brilho: 0.9, linha: false, ry: t, caixa: true }); }
      return g;
    };
    const an = [mkAnel(0.9, 0.5, 0.15, 9, 0.2), mkAnel(0.78, -0.9, 0.4, 8, 0.17, 0x4ad8ff), mkAnel(1.0, 1.35, -0.3, 9, 0.2, 0xff5ae0)];
    const frag = [];
    for (let i = 0; i < 9; i++) {
      const g = B.grupo(c, 0, 0, 0), r = 0.12 + (i % 3) * 0.025;
      if (i % 3 === 0) {          // pedaço de mundo: rocha com relva e uma torrezinha
        B.blob(g, r, 0x6a5a4a, 0, 0, 0, { tex: 'pedra', rep: 1, amp: 0.25, seed: i, seg: 7, rough: 0.9, sy: 0.8 });
        B.blob(g, r * 0.9, 0x4a8a3a, 0, r * 0.35, 0, { tex: 'musgo', rep: 1, amp: 0.2, seed: i + 3, seg: 7, sy: 0.35, linha: false });
        B.cil(g, r * 0.2, r * 0.25, r * 0.7, 0xb8a888, 0.01, r * 0.8, 0, { seg: 5 }); B.cone(g, r * 0.3, r * 0.3, 0xa03030, 0.01, r * 1.3, 0, { seg: 5, linha: false });
        B.cone(g, r * 0.6, r * 0.8, 0x4a3a30, 0, -r * 0.8, 0, { rx: PI, seg: 6, tex: 'pedra' });
      } else if (i % 3 === 1) {   // pedaço de lava/mundo em chamas
        B.blob(g, r, 0x3a2a2a, 0, 0, 0, { tex: 'pedra', rep: 1, amp: 0.3, seed: i, seg: 7, emissive: 0xff5a1a, brilho: 0.5 });
        B.cone(g, r * 0.5, r * 1.1, 0xff7a2a, 0, r * 0.4, 0, { emissive: 0xff5a1a, seg: 5, linha: false });
      } else {                    // cristal solto
        B.octa(g, r * 0.8, [0x9a5aff, 0x3ac0ff, 0xff3ad0][(i >> 1) % 3], 0, 0, 0, { sy: 1.5, emissive: [0x6a2ac0, 0x1a80c0, 0xc01a90][(i >> 1) % 3], brilho: 0.7, tex: 'cristal', linha: false });
      }
      frag.push({ g, i });
    }
    const piso = B.grupo(R, 0, 0.03, 0);
    const pisoG = B.grupo(piso, 0, 0, 0);
    B.tor(pisoG, 0.62, 0.015, VIO, 0, 0, 0, { rx: PI / 2, seg: 24, emissive: VIO, brilho: 0.9, linha: false, op: 0.8 });
    for (let k = 0; k < 8; k++) { const t = k * T2 / 8; meu(B, pisoG, runaGeo(k, 0.11), VIO, Math.sin(t) * 0.52, 0, Math.cos(t) * 0.52, { emissive: VIO, brilho: 1.0, linha: false, rx: -PI / 2, rz: -t, caixa: true }); }
    B.cone(R, 0.5, 0.4, 0x1a0a30, 0, 0.22, 0, { rx: PI, op: 0.4, emissive: 0x5a2ab0, brilho: 0.4, linha: false, seg: 14 });

    return {
      altura: 2.2, flutua: true,
      p: { tronco: c, balancos: tent, mandibula: { g: mand, aberta: 0.5 } },
      anim: (t, dt, st) => {
        an[0].rotation.y = t * 0.5; an[1].rotation.y = -t * 0.7; an[2].rotation.y = t * 0.35;
        vort.rotation.z = -t * 1.1; pisoG.rotation.y = t * 0.4;
        const k = 1 + Math.sin(t * 2.2) * 0.025; corpoC.scale.set(k, 1 / k, k);
        nucleo.scale.setScalar(1 + Math.sin(t * 4.5) * 0.15); halo.scale.setScalar(1 + Math.sin(t * 2.4) * 0.2);
        nucleo.material.emissiveIntensity = 1.6 + Math.sin(t * 4.5) * 0.4;
        frag.forEach(f => { const a = t * (0.55 + (f.i % 3) * 0.12) * (f.i % 2 ? 1 : -1) + f.i * 0.7, r = 0.95 + (f.i % 3) * 0.08, inc = 0.3 + (f.i % 4) * 0.28; f.g.position.set(Math.cos(a) * r, Math.sin(a) * r * Math.sin(inc) + Math.sin(f.i) * 0.2, Math.sin(a) * r * Math.cos(inc)); f.g.rotation.set(t * 0.6 + f.i, t * 0.9, f.i); });
      },
    };
  }

  const todos = {};
  todos.guerreiro = guerreiro;
  todos.cacador = cacador;
  todos.oraculo = oraculo;
  todos.caos = caos;
  Modelos3D.registrar(todos);
})();
