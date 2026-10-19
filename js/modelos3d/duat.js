'use strict';
/* Modelos 3D — reino Duat (Egito): escaravelho, múmia, chacal, serpente de Apófis e Set.
   Cada modelo é registrado com Modelos3D.registrar({ id: (B, R) => ({ altura, p, anim }) }).
   Veja as ferramentas no começo de js/modelos3d.js. */
(() => {
  const PI = Math.PI;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // paleta do Duat
  const OURO = 0xe0a82a, OURO_ESC = 0xa8761c, OURO_CLARO = 0xf5d36a, TURQ = 0x1fb3a6, TURQ_ESC = 0x0f6f78, LAPIS = 0x1c3f9c, LAPIS_ESC = 0x0f2260;
  const OBS = 0x14121a, AREIA = 0xd9bf86, AREIA_ESC = 0xa88b56, OSSO = 0xe8dfc4, SETE = 0xb02a22;

  /** mistura duas cores (t = 0..1) */
  const mez = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
  /** ponto e direção (tangente) ao longo de uma curva de pontos [[x,y,z]...] — mesma curva do B.tubo */
  const curvaDe = pts => new THREE.CatmullRomCurve3(pts.map(p => V(p[0], p[1], p[2])));
  /** cone com a base em `b` apontando na direção `d` (espinho, dente, garra) */
  function ponta(B, pai, b, d, len, r, cor, o = {}) {
    const m = B.cone(pai, r, len, cor, 0, 0, 0, { linha: false, seg: 6, ...o });
    const dir = V(d[0], d[1], d[2]).normalize();
    m.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
    m.position.set(b[0] + dir.x * len / 2, b[1] + dir.y * len / 2, b[2] + dir.z * len / 2);
    return m;
  }
  /** espinhos ao longo de um tubo: n pontas perpendiculares à curva, do lado `cima` (vetor), de tamanho tam */
  function espinhosAo(B, pai, pts, n, tam, r, cor, cima = [0, 1, 0], o = {}) {
    const c = curvaDe(pts), up = V(cima[0], cima[1], cima[2]);
    for (let i = 0; i < n; i++) {
      const t = o.t0 !== undefined ? o.t0 + (o.t1 - o.t0) * (n === 1 ? 0.5 : i / (n - 1)) : (i + 0.5) / n;
      const P = c.getPointAt(t), T = c.getTangentAt(t);
      const d = up.clone().sub(T.clone().multiplyScalar(up.dot(T))).normalize();
      d.add(T.clone().multiplyScalar(o.incl ?? 0.35));
      if (o.lado) d.z += (i % 2 ? 1 : -1) * o.lado;
      const f = 1 - t * 0.35;
      ponta(B, pai, [P.x, P.y, P.z], [d.x, d.y, d.z], tam * f * (1 + (i % 2) * 0.3), r * f, cor, { seg: 5 });
    }
  }
  /** ponto na superfície de um elipsoide (centro c, raios rx,ry,rz): a = 0 (frente) .. PI (trás); phi = ângulo no plano XY (0 = lado +x, PI/2 = cima) */
  function sup(c, rx, ry, rz, a, phi, k = 1) {
    return [c[0] + rx * k * Math.sin(a) * Math.cos(phi), c[1] + ry * k * Math.sin(a) * Math.sin(phi), c[2] + rz * k * Math.cos(a)];
  }


  /** gerador pseudo-aleatório com semente (resultado sempre igual) */
  const sem = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
  /** anel (bandagem/bracelete) ao redor de um ponto P, perpendicular à direção T, com leve inclinação aleatória */
  function anel(B, pai, P, T, r, esp, cor, rnd, o = {}) {
    const m = B.tor(pai, r, esp, cor, 0, 0, 0, { linha: false, seg: o.seg || 8, tex: o.tex ?? 'tecido', rep: 1, rough: 0.95, ...o });
    const d = V(T[0] + (rnd() - 0.5) * (o.tilt ?? 0.5), T[1] + (rnd() - 0.5) * (o.tilt ?? 0.5), T[2] + (rnd() - 0.5) * (o.tilt ?? 0.5)).normalize();
    m.quaternion.setFromUnitVectors(V(0, 0, 1), d);
    m.position.set(P[0], P[1], P[2]);
    return m;
  }
  /** enrola faixas ao longo de um membro (pontos + raios, como o B.tubo): n anéis entre t0 e t1 */
  function enrolar(B, pai, pts, raios, n, cores, rnd, o = {}) {
    const c = curvaDe(pts), t0 = o.t0 ?? 0.05, t1 = o.t1 ?? 0.95;
    for (let i = 0; i < n; i++) {
      const t = t0 + (t1 - t0) * (n === 1 ? 0.5 : i / (n - 1)) + (rnd() - 0.5) * 0.02, P = c.getPointAt(t), T = c.getTangentAt(t);
      const x = t * (raios.length - 1), k = Math.min(raios.length - 2, Math.floor(x)), r = raios[k] + (raios[k + 1] - raios[k]) * (x - k);
      anel(B, pai, [P.x, P.y, P.z], [T.x, T.y, T.z], r * (o.k ?? 1.04), o.esp ?? (0.013 + rnd() * 0.012), cores[Math.floor(rnd() * cores.length)], rnd, { tilt: o.tilt });
    }
  }
  /** faixa solta pendurada (tubo achatado em fita) dentro de um grupo que balança; devolve o grupo */
  function fita(B, pai, x, y, z, pts, larg, cor, ry = 0, o = {}) {
    const g = B.grupo(pai, x, y, z); g.rotation.y = ry;
    const t = B.tubo(g, pts, pts.map((_, i) => larg * (1 - i * 0.12 / pts.length)), cor, { seg: o.seg || 8, rad: 6, tex: 'tecido', rep: 1, rough: 0.95, linha: false, pontas: false });
    t.scale.x = 0.25;
    return g;
  }

  /** tubo longo com a textura esticada certa (o B.tubo repete a textura só 2x ao longo de tudo): serve para corpo de cobra */
  function tuboLongo(B, pai, pts, raios, cor, o = {}) {
    const kit = Modelos3D.kit, seg = o.seg || 100, rad = o.rad || 10, L = curvaDe(pts).getLength();
    const g = kit.tuboGeo(pts, raios, seg, rad), uv = g.attributes.uv, k = L / ((o.tile || 0.41) * 2 * (o.rep || 1));
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * k);
    const m = new THREE.Mesh(g, B.mat(cor, o)); pai.add(m);
    if (o.linha !== false) { const l = new THREE.Mesh(kit.tuboGeo(pts, raios.map(r => r + 0.016), seg, rad), B.linhaMat); l.userData.contorno = true; m.add(l); }
    const a = pts[0], z = pts[pts.length - 1];
    if (raios[0] > 0.012) B.esf(pai, raios[0], cor, a[0], a[1], a[2], { ...o, linha: false, seg: 8 });
    if (raios[raios.length - 1] > 0.012) B.esf(pai, raios[raios.length - 1], cor, z[0], z[1], z[2], { ...o, linha: false, seg: 8 });
    return m;
  }
  /** orienta uma peça: eixo X local = lado, Y = normal (para fora), Z = tangente */
  function orientar(m, P, T, N) {
    const t = V(T[0], T[1], T[2]).normalize(), n = V(N[0], N[1], N[2]);
    n.sub(t.clone().multiplyScalar(n.dot(t))).normalize();
    const sd = new THREE.Vector3().crossVectors(n, t);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(sd, n, t));
    m.position.set(P[0], P[1], P[2]);
    return m;
  }

  /** corpo humanoide muito musculoso (chacal, Set): peitoral, abdômen, deltoides, bíceps, veias, mãos com garras.
   *  Devolve os pivôs (tr, cab, bracoD/E, pernaD/E, maoD/E). Opções: s, w, pele, esc, claro, tex, bota, garras, seed */
  function titan(B, R, o) {
    const s = o.s || 1, w = o.w || 1, pele = o.pele, esc = o.esc ?? mez(pele, 0x000000, 0.4), claro = o.claro ?? mez(pele, 0xffffff, 0.16);
    const T = { tex: o.tex || 'pele', rep: 1, relevo: 0.018, rough: 0.55 };
    const E = a => a.map(p => [p[0] * s * (o.wx || 1), p[1] * s, p[2] * s]), Rr = (a, k = 1) => a.map(r => r * s * k);
    const rnd = sem(o.seed || 5), hip = 0.93 * s;
    // pernas
    const pernas = [-1, 1].map(l => {
      const p = B.grupo(R, l * 0.15 * w * s, hip, 0);
      const co = E([[0, 0, 0], [0, -0.22, 0.03], [0, -0.45, 0]]), pa = E([[0, -0.45, 0], [0, -0.62, -0.03], [0, -0.88, 0]]);
      B.tubo(p, co, Rr([0.145 * w, 0.125 * w, 0.088 * w]), pele, { ...T, seg: 8, rad: 8, pontas: false });
      B.blob(p, 0.1 * s * w, claro, 0, -0.2 * s, 0.07 * s, { ...T, sy: 1.6, sz: 0.8, amp: 0.05, seg: 9, linha: false });
      B.esf(p, 0.09 * s * w, esc, 0, -0.45 * s, 0.01 * s, { ...T, seg: 8, linha: false });
      B.tubo(p, pa, Rr([0.088 * w, 0.09 * w, 0.05]), pele, { ...T, seg: 8, rad: 8, pontas: false });
      B.blob(p, 0.075 * s * w, claro, 0, -0.6 * s, -0.06 * s, { ...T, sy: 1.6, sz: 0.85, amp: 0.05, seg: 8, linha: false });
      B.blob(p, 0.078 * s, o.bota ?? esc, 0, -0.88 * s, 0.07 * s, { tex: 'couro', rep: 1, sx: 1, sy: 0.5, sz: 1.9, amp: 0.04, seg: 10 });
      for (let i = 0; i < 3; i++) ponta(B, p, [(i - 1) * 0.04 * s, -0.9 * s, 0.2 * s], [0, -0.1, 1], 0.07 * s, 0.014 * s, o.garras ?? OSSO, { seg: 4 });
      return p;
    });
    B.blob(R, 0.18 * s, esc, 0, hip, 0, { ...T, sx: 1.25 * w, sy: 0.8, sz: 0.9, amp: 0.05, seg: 10 });
    // tronco
    const tr = B.grupo(R, 0, hip, 0);
    B.blob(tr, 0.17 * s, pele, 0, 0.17 * s, 0, { ...T, sx: w, sy: 1.15, sz: 0.85, amp: 0.04, seg: 10 });
    for (let r = 0; r < 3; r++) [-1, 1].forEach(l => B.blob(tr, 0.05 * s, claro, l * 0.05 * s * w, (0.1 + r * 0.075) * s, 0.14 * s, { ...T, sy: 0.85, sz: 0.55, amp: 0.05, seg: 8, linha: false }));
    B.blob(tr, 0.27 * s, pele, 0, 0.46 * s, 0, { ...T, sx: 1.25 * w, sy: 1.0, sz: 0.82, amp: 0.04, seg: 10 });
    [-1, 1].forEach(l => {
      B.blob(tr, 0.135 * s, claro, l * 0.145 * s * w, 0.47 * s, 0.15 * s, { ...T, sx: 1.2, sy: 0.85, sz: 0.62, amp: 0.05, seg: 9, linha: false });   // peitoral
      B.blob(tr, 0.12 * s, esc, l * 0.25 * s * w, 0.38 * s, -0.06 * s, { ...T, sx: 0.6, sy: 1.5, sz: 0.7, amp: 0.05, seg: 8, linha: false });             // dorsal
      B.esf(tr, 0.02 * s, esc, l * 0.15 * s * w, 0.46 * s, 0.215 * s, { seg: 6, linha: false });
    });
    B.blob(tr, 0.15 * s, pele, 0, 0.64 * s, -0.04 * s, { ...T, sx: 1.7 * w, sy: 0.6, sz: 0.8, amp: 0.05, seg: 9, linha: false });                     // trapézio
    // cicatrizes no peito
    [[-0.2, 0.55, 0.23, 0.05, 0.3, 0.2], [-0.05, 0.4, 0.26, 0.17, 0.52, 0.2]].forEach(([x0, y0, z0, x1, y1, z1]) => B.tubo(tr, E([[x0 * w, y0, z0 * 0.9], [(x0 + x1) / 2 * w, (y0 + y1) / 2, z1 * 1.05], [x1 * w, y1, z1 * 0.95]]), Rr([0.004, 0.007, 0.004]), 0xcfa090, { seg: 6, rad: 4, linha: false, pontas: false }));
    // braços
    const bracos = [-1, 1].map(l => {
      const b = B.grupo(tr, l * 0.39 * s * w, 0.58 * s, 0);
      B.blob(b, 0.125 * s * w, pele, 0, 0, 0, { ...T, sy: 0.95, amp: 0.05, seg: 10 });
      const ub = E([[0, 0, 0], [0, -0.14, 0.0], [0, -0.28, 0.01]]), fa = E([[0, -0.28, 0.01], [0, -0.4, 0.05], [0, -0.52, 0.06]]);
      B.tubo(b, ub, Rr([0.09 * w, 0.088 * w, 0.062 * w]), pele, { ...T, seg: 8, rad: 8, pontas: false });
      B.blob(b, 0.07 * s * w, claro, 0, -0.14 * s, 0.055 * s, { ...T, sy: 1.5, sz: 0.85, amp: 0.05, seg: 8, linha: false });
      B.blob(b, 0.062 * s * w, esc, 0, -0.15 * s, -0.05 * s, { ...T, sy: 1.6, sz: 0.8, amp: 0.05, seg: 8, linha: false });
      B.esf(b, 0.062 * s * w, esc, 0, -0.28 * s, 0.01 * s, { ...T, seg: 9, linha: false });
      B.tubo(b, fa, Rr([0.062 * w, 0.064 * w, 0.042]), pele, { ...T, seg: 8, rad: 8, pontas: false });
      B.blob(b, 0.055 * s * w, claro, 0, -0.38 * s, 0.03 * s, { ...T, sy: 1.7, amp: 0.05, seg: 9, linha: false });
      // veias saltadas
      for (let i = 0; i < 2; i++) B.tubo(b, E([[l * (0.03 + i * 0.03) * w, -0.1, 0.1 - i * 0.02], [l * (0.05 + i * 0.02) * w, -0.22, 0.108], [l * (0.02 + i * 0.03) * w, -0.33, 0.1], [l * 0.0, -0.46, 0.09 + i * 0.01]]), Rr([0.006, 0.008, 0.007, 0.004]), esc, { seg: 8, rad: 4, linha: false, pontas: false });
      const mao = B.grupo(b, 0, -0.58 * s, 0.07 * s);
      B.blob(mao, 0.05 * s, pele, 0, -0.01 * s, 0.01 * s, { ...T, sx: 1.05, sy: 1.0, sz: 1.15, amp: 0.06, seg: 8, linha: false });
      for (let i = 0; i < 4; i++) { B.esf(mao, 0.019 * s, claro, (i - 1.5) * 0.028 * s, -0.04 * s, 0.045 * s, { ...T, seg: 6, linha: false }); ponta(B, mao, [(i - 1.5) * 0.028 * s, -0.05 * s, 0.05 * s], [0, -0.7, 0.5], 0.065 * s, 0.01 * s, o.garras ?? OSSO, { seg: 4 }); }
      b.userData.mao = mao;
      return b;
    });
    const cab = B.grupo(tr, 0, 0.66 * s, 0.02 * s);
    B.tubo(cab, E([[0, -0.07, -0.01], [0, 0.04, 0.01], [0, 0.11, 0.04]]), Rr([0.095 * w, 0.078 * w, 0.066]), pele, { ...T, seg: 6, rad: 8, linha: false });
    return { tr, cab, bracoD: bracos[1], bracoE: bracos[0], pernaD: pernas[1], pernaE: pernas[0], maoD: bracos[1].userData.mao, maoE: bracos[0].userData.mao, s, w, T, E, Rr };
  }

  Modelos3D.registrar({
    /* ================= ESCARAVELHO DEVORADOR ================= */
    escaravelho(B, R) {
      R.scale.setScalar(0.8);
      const c = B.grupo(R, 0, 0, -0.2);
      const ESC = { tex: 'cristal', rep: 2, metal: 0.55, rough: 0.28, relevo: 0.03 };
      const QUIT = { tex: 'escamas', rep: 2, metal: 0.3, rough: 0.4 };
      // barriga e abdômen (aparece sob os élitros erguidos)
      B.blob(c, 0.3, 0x0a1a3a, 0, 0.3, -0.05, { ...QUIT, sx: 1.55, sy: 0.7, sz: 2.1, amp: 0.05, seed: 3, seg: 18 });
      B.blob(c, 0.26, LAPIS_ESC, 0, 0.42, -0.5, { ...QUIT, sx: 1.45, sy: 0.85, sz: 1.5, amp: 0.05, seed: 4, linha: false, seg: 10 });
      for (let i = 0; i < 4; i++) B.tor(c, 0.34 - i * 0.014, 0.014, OURO_ESC, 0, 0.42, -0.36 - i * 0.12, { sx: 1.18, sy: 0.88, linha: false, seg: 12, metal: 0.5 });
      // asas membranosas sob os élitros (entreabertas)
      const asas = [-1, 1].map(l => {
        const a = B.grupo(c, l * 0.12, 0.43, 0.1); a.rotation.y = l * 0.95; a.rotation.x = 0.02;
        B.asa(a, l, 0.95, 0.5, 0xc9984a, 0, 0, 0, { forma: 'pena', op: 0.78, ossos: false });
        B.tubo(a, [[0, 0.02, 0], [l * 0.45, 0.03, -0.2], [l * 0.9, 0.02, -0.12]], [0.025, 0.015, 0.006], 0x3a2410, { seg: 6, rad: 4, linha: false, pontas: false });
        return a;
      });
      // élitros (carapaça): lapis na borda, turquesa metálico no dorso, veios dourados
      const elitros = [-1, 1].map(l => {
        const hx = l * 0.12, hy = 0.5, hz = 0.24;
        const e = B.grupo(c, hx, hy, hz);
        e.rotation.x = 0.07; e.rotation.y = -l * 0.1;
        const cx = l * 0.2 - hx, cy = 0.47 - hy, cz = -0.2 - hz;
        B.esf(e, 0.3, TURQ, cx, cy, cz, { tex: 'pele', rep: 3, relevo: 0.015, metal: 0.55, rough: 0.25, sx: 1.2, sy: 0.95, sz: 2.05, seg: 22 });
        const rx = 0.36, ry = 0.285, rz = 0.615, cc = [cx, cy, cz];
        // veios dourados (meridianos) alternados com faixas de lápis-lazúli
        [[0.1, 0], [0.32, 1], [0.54, 0], [0.76, 1], [0.98, 0], [1.2, 1], [1.4, 0]].forEach(([ph, lap], k) => {
          const phi = l > 0 ? ph : PI - ph, pts = [];
          for (let i = 0; i <= 7; i++) pts.push(sup(cc, rx, ry, rz, 0.22 + i * 0.4, phi, 1.0));
          B.tubo(e, pts, lap ? [0.004, 0.016, 0.017, 0.016, 0.015, 0.012, 0.008, 0.003] : [0.004, 0.011, 0.012, 0.012, 0.011, 0.009, 0.006, 0.003], lap ? LAPIS : (k % 4 ? OURO : OURO_CLARO), { seg: 10, rad: 4, metal: lap ? 0.4 : 0.8, rough: 0.3, linha: false, pontas: false });
        });
        // veios transversais curtos e rebites dourados na borda
        for (let i = 0; i < 4; i++) {
          const a = 1.1 + i * 0.5, pts = [];
          for (let j = 0; j <= 5; j++) pts.push(sup(cc, rx, ry, rz, a, l > 0 ? 0.1 + j * 0.26 : PI - 0.1 - j * 0.26, 1.0));
          B.tubo(e, pts, [0.005, 0.008, 0.008, 0.008, 0.008, 0.004], OURO, { seg: 8, rad: 4, metal: 0.8, linha: false, pontas: false });
        }
        for (let i = 0; i < 9; i++) { const p = sup(cc, rx, ry, rz, 0.5 + i * 0.28, l > 0 ? -0.05 : PI + 0.05, 1.0); B.esf(e, 0.02, OURO_CLARO, p[0], p[1], p[2], { seg: 6, metal: 0.8, linha: false }); }
        return e;
      });
      // costura central dourada entre os élitros
      B.tubo(c, [[0, 0.62, 0.0], [0, 0.69, -0.3], [0, 0.69, -0.65], [0, 0.55, -0.95]], [0.02, 0.026, 0.024, 0.006], OURO_ESC, { seg: 14, rad: 6, metal: 0.7, linha: false, pontas: false });
      // pronoto (escudo atrás da cabeça), com disco solar
      B.blob(c, 0.3, mez(LAPIS_ESC, TURQ_ESC, 0.35), 0, 0.46, 0.4, { tex: 'pele', rep: 3, relevo: 0.03, metal: 0.5, rough: 0.3, sx: 1.45, sy: 0.72, sz: 0.85, amp: 0.04, seed: 21 });
      B.tor(c, 0.29, 0.02, OURO, 0, 0.5, 0.4, { sx: 1.45, sy: 0.9, rx: PI / 2 - 0.1, seg: 22, metal: 0.8, linha: false });
      B.tor(c, 0.12, 0.022, OURO_CLARO, 0, 0.665, 0.37, { rx: PI / 2 - 0.12, seg: 16, metal: 0.8, linha: false });
      B.esf(c, 0.06, OURO, 0, 0.67, 0.37, { seg: 10, metal: 0.8, linha: false, emissive: OURO_ESC, brilho: 0.5 });
      [-1, 1].forEach(l => espinhosAo(B, c, [[l * 0.4, 0.5, 0.62], [l * 0.45, 0.5, 0.4], [l * 0.4, 0.48, 0.15]], 4, 0.13, 0.03, OURO_CLARO, [l, 0.5, 0], { incl: 0.1 }));
      // chifres laterais do pronoto (estilo besouro-hércules)
      [-1, 1].forEach(l => {
        const pts = [[l * 0.3, 0.6, 0.45], [l * 0.45, 0.72, 0.62], [l * 0.52, 0.74, 0.85], [l * 0.4, 0.7, 1.02]];
        B.tubo(c, pts, [0.08, 0.06, 0.04, 0.006], OURO_ESC, { seg: 12, rad: 7, tex: 'metal', rep: 1, metal: 0.7, rough: 0.35, pontas: false });
        espinhosAo(B, c, pts, 3, 0.09, 0.025, OURO_CLARO, [l * 0.3, 0.2, 0.5], { t0: 0.3, t1: 0.8, incl: 0.4 });
      });
      // cabeça achatada com escudo dentado
      const cab = B.grupo(c, 0, 0.38, 0.72);
      B.blob(cab, 0.22, mez(LAPIS_ESC, 0x000000, 0.2), 0, 0, 0.04, { ...QUIT, sx: 1.3, sy: 0.65, sz: 1.0, amp: 0.05, seed: 31 });
      B.cx(cab, 0.4, 0.05, 0.14, TURQ_ESC, 0, 0.0, 0.26, { ...ESC, rx: 0.1, linha: false });
      for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.085; ponta(B, cab, [x, 0.0, 0.31], [x * 1.4, 0.15, 1], 0.12 - Math.abs(i - 2) * 0.012, 0.03, OURO_CLARO, { seg: 5, metal: 0.7 }); }
      B.chifre(cab, 0.28, 0.035, OURO, 0, 0.1, 0.12, { curva: 0.8, rx: 1.1, metal: 0.7, tex: 'metal' });
      [-1, 1].forEach(l => {
        // olhos compostos dourados
        B.olho(cab, 0.07, 0xffc830, l * 0.2, 0.06, 0.1, { pupila: false, brilho: 1.3 });
        B.esf(cab, 0.045, 0xfff0a0, l * 0.22, 0.09, 0.14, { emissive: 0xffe070, brilho: 1.2, seg: 6, linha: false });
        B.esf(cab, 0.025, 0x1a0a00, l * 0.235, 0.1, 0.17, { seg: 5, linha: false });
      });
      // mandíbulas gigantes em pinça (com serrilha interna)
      const mand = [-1, 1].map(l => {
        const m = B.grupo(cab, l * 0.15, -0.02, 0.28);
        const pts = [[0, 0, 0], [l * 0.2, 0.0, 0.14], [l * 0.27, 0.0, 0.34], [l * 0.1, 0.0, 0.56]];
        B.tubo(m, pts, [0.115, 0.1, 0.065, 0.006], mez(OBS, LAPIS_ESC, 0.5), { seg: 12, rad: 7, tex: 'escamas', rep: 1, metal: 0.4, rough: 0.35, pontas: false });
        B.tubo(m, [[l * 0.02, 0.07, 0.02], [l * 0.14, 0.085, 0.2], [l * 0.16, 0.08, 0.38]], [0.02, 0.02, 0.01], OURO, { seg: 8, rad: 5, metal: 0.8, linha: false, pontas: false });
        const cv = curvaDe(pts);
        for (let i = 0; i < 6; i++) { const t = 0.3 + i * 0.12, P = cv.getPointAt(t); ponta(B, m, [P.x - l * 0.05, P.y, P.z], [-l, 0.1, 0.5], 0.11, 0.028, OSSO, { seg: 5 }); }
        B.esf(m, 0.045, OURO, 0, 0, 0.0, { metal: 0.8, seg: 8, linha: false });
        return m;
      });
      // antenas com clavas lamelares
      const ant = [-1, 1].map((l, k) => {
        const a = B.grupo(cab, l * 0.1, 0.07, 0.24);
        B.tubo(a, [[0, 0, 0], [l * 0.1, 0.1, 0.12], [l * 0.18, 0.2, 0.2], [l * 0.22, 0.3, 0.22]], [0.016, 0.012, 0.01, 0.008], OURO_ESC, { seg: 10, rad: 5, linha: false, pontas: false });
        for (let i = 0; i < 4; i++) B.blob(a, 0.04, OURO, l * (0.22 + i * 0.012), 0.33 + i * 0.01, 0.22 + (i - 1.5) * 0.035, { sx: 0.35, sy: 1.6, sz: 1.0, amp: 0.05, seg: 8, linha: false, metal: 0.6 });
        return a;
      });
      // pernas articuladas com espinhos: [x, z do quadril, giro-base]
      const pernas = [];
      [[0.34, 0.45, -0.7], [0.4, 0.0, -0.1], [0.34, -0.45, 0.65]].forEach(([lx, lz, ry0], r) => [-1, 1].forEach(l => {
        const p = B.grupo(c, l * lx * 0.72, 0.3, lz + 0.1); p.rotation.y = -l * ry0;
        const fem = [[0, 0, 0], [l * 0.16, 0.16, 0], [l * 0.34, 0.24, 0]], tib = [[l * 0.34, 0.24, 0], [l * 0.46, 0.05, 0], [l * 0.56, -0.16, 0], [l * 0.6, -0.3, 0]];
        B.tubo(p, fem, [0.095, 0.08, 0.06], mez(LAPIS_ESC, OBS, 0.4), { seg: 8, rad: 6, tex: 'escamas', rep: 1, metal: 0.35, rough: 0.4 });
        B.tubo(p, tib, [0.062, 0.05, 0.04, 0.014], mez(LAPIS_ESC, OBS, 0.2), { seg: 10, rad: 6, tex: 'escamas', rep: 1, metal: 0.35, rough: 0.4, pontas: false });
        B.esf(p, 0.07, OURO, l * 0.34, 0.24, 0, { metal: 0.8, seg: 8, linha: false });
        ponta(B, p, [l * 0.34, 0.28, 0], [l * 0.5, 1, 0], 0.16, 0.04, OURO_CLARO, { seg: 5, metal: 0.7 });
        espinhosAo(B, p, tib, 4, 0.1, 0.022, OURO_CLARO, [l * 0.6, 0.8, 0], { lado: 0.5, t0: 0.15, t1: 0.8, incl: 0.2 });
        [-0.03, 0.03].forEach(dz => ponta(B, p, [l * 0.6, -0.28, dz], [l * 0.6, -0.5, dz * 8], 0.07, 0.016, OSSO, { seg: 4 }));
        p.userData.fase = (r + (l > 0 ? 0 : 1)) % 2;
        p.userData.ry0 = -l * ry0; p.userData.l = l;
        pernas.push(p);
      }));
      return {
        altura: 1.1, p: { tronco: c, balancos: ant.map((g, i) => ({ g, amp: 0.2, vel: 2.6, eixo: 'z', fase: i * 1.7 })) },
        anim: (t, dt, e) => {
          const andando = e && e.andando, golpe = (e && e.golpe) || 0;
          pernas.forEach(p => {
            const s = Math.sin(t * 13 + p.userData.fase * PI), l = p.userData.l;
            p.rotation.y = p.userData.ry0 + (andando ? s * 0.32 : Math.sin(t * 1.5 + p.userData.fase) * 0.025);
            p.rotation.z = l * (andando ? Math.max(0, Math.cos(t * 13 + p.userData.fase * PI)) * 0.3 : 0) + (golpe ? l * golpe * 0.2 : 0);
          });
          mand.forEach((m, i) => { const l = i ? 1 : -1; m.rotation.y = l * (0.12 + golpe * 0.75 + Math.sin(t * 2) * 0.04); });
          elitros.forEach((e2, i) => { const l = i ? 1 : -1; e2.rotation.y = -l * (0.1 + golpe * 0.18 + Math.max(0, Math.sin(t * 1.3)) * 0.03); e2.rotation.x = 0.07 + golpe * 0.12; });
          asas.forEach((a, i) => { const l = i ? 1 : -1; a.rotation.z = l * (andando ? Math.sin(t * 20) * 0.05 : 0); });
        },
      };
    },

    /* ================= MÚMIA AMALDIÇOADA ================= */
    mumia(B, R) {
      const rnd = sem(77);
      const LIN = [0xb8a67c, 0xa4926a, 0x94835c, 0xc4b58c, 0x7c6c48, 0xa38f60];
      const BAND = { tex: 'couro', rep: 1, relevo: 0.05, rough: 0.95 };
      const CARNE = 0x4a3022, OSSOC = 0xdcd0ae, VERDE = 0x22e86a;
      const OSSOM = { tex: 'osso', rep: 1, rough: 0.8 };
      // pelve
      B.blob(R, 0.17, LIN[1], 0, 0.84, -0.01, { ...BAND, sx: 1.25, sy: 0.8, sz: 0.95, amp: 0.06, seed: 2, seg: 16 });
      // pernas rígidas, enfaixadas (a esquerda com a canela de fora)
      const pernas = [-1, 1].map(l => {
        const p = B.grupo(R, l * 0.14, 0.84, 0);
        const co = [[0, 0, 0], [0, -0.2, 0.025], [0, -0.4, 0.005]], ro = [0.115, 0.1, 0.078];
        const sh = [[0, -0.4, 0.005], [0, -0.6, 0.035], [0, -0.78, 0.0]], rs = [0.072, 0.06, 0.048];
        B.tubo(p, co, ro, LIN[l > 0 ? 0 : 3], { ...BAND, seg: 6, rad: 8, pontas: false });
        enrolar(B, p, co, ro, 5, LIN, rnd, { t0: 0.04, t1: 0.97 });
        B.esf(p, 0.08, l > 0 ? LIN[2] : CARNE, 0, -0.4, 0.02, { ...BAND, seg: 10, linha: false });
        if (l > 0) {
          B.tubo(p, sh, rs, LIN[1], { ...BAND, seg: 8, rad: 7, pontas: false });
          enrolar(B, p, sh, rs, 5, LIN, rnd, { t0: 0.05, t1: 0.98 });
        } else {
          // canela sem faixas: carne seca e osso à mostra
          B.tubo(p, sh, [0.058, 0.05, 0.042], CARNE, { tex: 'carne', rep: 1, seg: 8, rad: 7, pontas: false });
          B.tubo(p, [[0.01, -0.5, 0.06], [0.015, -0.62, 0.07], [0, -0.76, 0.03]], [0.022, 0.02, 0.018], OSSOC, { ...OSSOM, seg: 6, rad: 5, linha: false });
          enrolar(B, p, sh, rs, 3, LIN, rnd, { t0: 0.03, t1: 0.25 });
          for (let i = 0; i < 3; i++) fita(B, p, 0.04 * (i - 1), -0.52, 0.04, [[0, 0, 0], [0.01, -0.1, 0.03], [0.0, -0.2 - i * 0.03, 0.1 + i * 0.02]], 0.035, LIN[i], i);
        }
        // pé enfaixado com dedos de osso
        B.blob(p, 0.1, l > 0 ? LIN[3] : LIN[1], 0, -0.77, 0.1, { ...BAND, sx: 0.95, sy: 0.5, sz: 1.9, amp: 0.05, seed: 5 + l, seg: 12 });
        anel(B, p, [0, -0.77, 0.14], [0, 0.1, 1], 0.1, 0.016, LIN[2], rnd, { tilt: 0.3, sx: 1, sy: 0.55 });
        for (let i = 0; i < 3; i++) ponta(B, p, [(i - 1) * 0.045, -0.79, 0.27], [0, 0, 1], 0.08, 0.02, OSSOC, { seg: 5 });
        return p;
      });
      // tronco curvado para a frente
      const tr = B.grupo(R, 0, 0.84, 0); tr.rotation.x = 0.34;
      B.blob(tr, 0.2, LIN[2], 0, 0.14, 0, { ...BAND, sx: 1.05, sy: 1.15, sz: 0.85, amp: 0.06, seed: 9, seg: 14 });
      B.blob(tr, 0.28, LIN[0], 0, 0.42, -0.01, { ...BAND, sx: 1.2, sy: 1.0, sz: 0.82, amp: 0.05, seed: 10, seg: 16 });
      B.blob(tr, 0.14, LIN[1], 0, 0.6, -0.08, { ...BAND, sx: 1.2, sy: 0.9, sz: 0.9, amp: 0.1, seed: 12, seg: 12, linha: false });  // corcunda
      // faixas do tronco
      const tp = [[0, 0.0, 0], [0, 0.28, 0.0], [0, 0.55, 0.0]], tro = [0.21, 0.255, 0.3];
      for (let i = 0; i < 9; i++) {
        const y = 0.04 + i * 0.06, r = 0.2 + Math.sin(Math.min(1, y / 0.55) * 1.5) * 0.09;
        anel(B, tr, [0, y, -0.01], [0, 1, 0], r, 0.012 + rnd() * 0.012, LIN[Math.floor(rnd() * 6)], rnd, { tilt: 0.45, sx: 1.08 + y * 0.2, sy: 0.82, seg: 10 });
      }
      // peito rasgado: carne seca, costelas e coluna à mostra
      B.blob(tr, 0.12, CARNE, 0.1, 0.38, 0.17, { tex: 'carne', rep: 1, sx: 1.2, sy: 1.15, sz: 0.5, amp: 0.1, seed: 14, seg: 12, linha: false });
      for (let i = 0; i < 4; i++) B.tubo(tr, [[-0.02, 0.3 + i * 0.058, 0.2], [0.1, 0.32 + i * 0.058, 0.235], [0.22, 0.3 + i * 0.058, 0.17]], [0.014, 0.017, 0.012], OSSOC, { ...OSSOM, seg: 8, rad: 5, linha: false, pontas: false });
      for (let i = 0; i < 7; i++) B.esf(tr, 0.026 - i * 0.001, OSSOC, 0, 0.1 + i * 0.075, -0.205 - (i > 4 ? 0.01 : 0), { ...OSSOM, seg: 7, linha: false });
      B.blob(tr, 0.06, CARNE, 0, 0.35, -0.2, { tex: 'carne', sx: 0.9, sy: 3.4, sz: 0.5, amp: 0.1, seg: 8, linha: false });   // rasgo nas costas
      // ombros
      [-1, 1].forEach(l => B.blob(tr, 0.12, LIN[l > 0 ? 3 : 1], l * 0.34, 0.52, 0.0, { ...BAND, sy: 0.9, amp: 0.08, seed: 20 + l, seg: 12 }));
      // colar usekh de ouro com contas de lápis e turquesa
      B.tor(tr, 0.27, 0.022, OURO, 0, 0.6, 0.02, { rx: PI / 2 - 0.12, sx: 1.12, sy: 0.9, seg: 18, metal: 0.8, rough: 0.3, linha: false });
      B.tor(tr, 0.3, 0.014, LAPIS, 0, 0.58, 0.03, { rx: PI / 2 - 0.12, sx: 1.12, sy: 0.9, seg: 18, metal: 0.4, linha: false });
      B.tor(tr, 0.33, 0.016, TURQ, 0, 0.56, 0.035, { rx: PI / 2 - 0.12, sx: 1.12, sy: 0.9, seg: 18, metal: 0.4, linha: false });
      for (let i = 0; i < 9; i++) { const a = PI * (0.12 + i * 0.095), x = Math.cos(a) * 0.36 * 1.12, z = Math.sin(a) * 0.36 * 0.9; B.esf(tr, 0.022, i % 2 ? OURO : OURO_CLARO, -x * 0.95, 0.53, z + 0.02, { seg: 6, metal: 0.8, linha: false }); }
      // amuleto: escaravelho de ouro
      B.esf(tr, 0.05, OURO, -0.04, 0.42, 0.24, { sy: 0.8, sz: 0.55, metal: 0.8, rough: 0.3, seg: 10 });
      B.esf(tr, 0.03, TURQ, -0.04, 0.42, 0.27, { sy: 0.7, sz: 0.5, seg: 8, linha: false, metal: 0.4 });
      B.tubo(tr, [[-0.04, 0.46, 0.22], [-0.04, 0.55, 0.26]], [0.006, 0.006], OURO, { seg: 4, rad: 4, linha: false, pontas: false });
      [-1, 1].forEach(l => B.tubo(tr, [[-0.04 + l * 0.02, 0.43, 0.26], [-0.04 + l * 0.09, 0.47, 0.24], [-0.04 + l * 0.12, 0.43, 0.22]], [0.012, 0.01, 0.004], OURO, { seg: 6, rad: 4, metal: 0.8, linha: false, pontas: false }));
      // faixas soltas penduradas no tronco (balançam)
      const fitas = [];
      [[0.18, 0.14, 0.17, 0], [-0.1, 0.1, 0.2, 1.2], [0.05, 0.06, -0.2, 3.1], [-0.2, 0.2, -0.12, 2.2], [0.24, 0.3, -0.05, 1.7]].forEach(([x, y, z, ry], i) => {
        const g = fita(B, tr, x, y, z, [[0, 0, 0], [0.02, -0.14, 0.04], [0.0, -0.3, 0.1], [-0.03, -0.46 - i * 0.03, 0.12]], 0.045, LIN[i % 6], ry);
        fitas.push({ g, amp: 0.14, vel: 1.4 + i * 0.3, eixo: 'x', fase: i * 1.3 });
      });
      // cabeça
      const cab = B.grupo(tr, 0, 0.6, 0.08); cab.rotation.x = -0.12;
      B.tubo(cab, [[0, -0.06, -0.06], [0, 0.04, 0.0], [0, 0.12, 0.06]], [0.075, 0.062, 0.06], CARNE, { tex: 'carne', seg: 6, rad: 7, linha: false });
      B.blob(cab, 0.19, LIN[3], 0, 0.28, 0.0, { ...BAND, sx: 0.95, sy: 1.1, sz: 1.06, amp: 0.04, seed: 31, seg: 16 });
      B.blob(cab, 0.13, 0x6a4630, 0, 0.21, 0.11, { tex: 'carne', rep: 1, sx: 1.05, sy: 1.1, sz: 0.62, amp: 0.05, seed: 33, seg: 14, linha: false });   // face descoberta
      [-1, 1].forEach(l => {
        B.blob(cab, 0.055, 0x0a0806, l * 0.068, 0.255, 0.18, { amp: 0.04, seg: 8, linha: false, sz: 0.8 });                  // órbita
        B.olho(cab, 0.036, VERDE, l * 0.068, 0.258, 0.2, { pupila: false, brilho: 1.0 });
        B.blob(cab, 0.04, OSSOC, l * 0.1, 0.19, 0.12, { ...OSSOM, sx: 0.8, sz: 0.8, amp: 0.1, seg: 8, linha: false });      // maçã do rosto
      });
      ponta(B, cab, [0, 0.185, 0.2], [0, -0.3, 1], 0.04, 0.025, 0x1a0e0a, { seg: 4 });   // nariz
      B.dentes(cab, 8, 0.15, 0.03, 0xd8c98a, 0, 0.14, 0.175, {});
      const jaw = B.grupo(cab, 0, 0.14, 0.02);
      B.blob(jaw, 0.075, CARNE, 0, -0.045, 0.1, { tex: 'carne', sx: 1.15, sy: 0.7, sz: 1.2, amp: 0.06, seed: 36, seg: 12 });
      B.blob(jaw, 0.035, 0x6a1f1a, 0, -0.01, 0.12, { sx: 1.4, sy: 0.5, sz: 1.2, seg: 8, linha: false });   // língua seca
      B.dentes(jaw, 7, 0.12, 0.028, 0xd0c080, 0, -0.012, 0.175, { rx: 0 });
      anel(B, jaw, [0, -0.04, 0.09], [0, 1, 0.1], 0.07, 0.012, LIN[4], rnd, { tilt: 0.3, sx: 1.1, sy: 0.9 });
      // faixas da cabeça (arcos que envolvem crânio, deixando o rosto livre)
      for (let i = 0; i < 5; i++) B.tor(cab, 0.185 - Math.abs(i - 2) * 0.012, 0.014 + rnd() * 0.008, LIN[i], 0, 0.14 + i * 0.05, -0.01, { rx: PI / 2 + (rnd() - 0.5) * 0.5, rz: PI / 2 + 0.7 + rnd() * 0.3, arco: PI * 2 - 1.5, seg: 12, linha: false, tex: 'tecido', rough: 0.95, sx: 0.98 });
      // diadema de ouro quebrado com cobra
      B.tor(cab, 0.172, 0.012, OURO, 0, 0.37, 0.0, { rx: PI / 2 + 0.2, rz: PI / 2 + 0.9, arco: PI * 2 - 1.8, seg: 14, metal: 0.8, linha: false });
      B.tubo(cab, [[0, 0.36, 0.17], [0, 0.4, 0.2], [0, 0.46, 0.2], [0, 0.5, 0.18]], [0.014, 0.012, 0.012, 0.01], OURO, { seg: 8, rad: 5, metal: 0.8, linha: false });
      B.esf(cab, 0.016, OURO, 0, 0.5, 0.19, { seg: 6, metal: 0.8, linha: false });
      // cabelo ressecado e faixas penduradas na cabeça
      for (let i = 0; i < 6; i++) B.tubo(cab, [[(i - 2.5) * 0.04, 0.4, -0.08], [(i - 2.5) * 0.06, 0.33, -0.17], [(i - 2.5) * 0.07, 0.2 - i % 2 * 0.04, -0.2]], [0.008, 0.007, 0.002], 0x5a5048, { seg: 6, rad: 4, linha: false, pontas: false });
      const fc = fita(B, cab, 0.15, 0.3, 0.05, [[0, 0, 0], [0.04, -0.12, 0.0], [0.07, -0.26, -0.04], [0.05, -0.4, -0.02]], 0.04, LIN[0], 0.3);
      fitas.push({ g: fc, amp: 0.18, vel: 1.9, eixo: 'z', fase: 0.7 });
      // braços estendidos com mãos ossudas
      const bracos = [-1, 1].map(l => {
        const b = B.grupo(tr, l * 0.36, 0.52, 0.0);
        const ub = [[0, 0, 0], [0, -0.15, 0.0], [0, -0.3, 0.0]], ru = [0.07, 0.06, 0.052];
        const fa = [[0, -0.3, 0], [0, -0.43, 0.01], [0, -0.56, 0]], rf = [0.048, 0.044, 0.036];
        B.tubo(b, ub, ru, LIN[l > 0 ? 1 : 0], { ...BAND, seg: 8, rad: 7, pontas: false });
        enrolar(B, b, ub, ru, 4, LIN, rnd, { t0: 0.05, t1: 0.97 });
        if (l > 0) {
          B.tubo(b, fa, rf, LIN[2], { ...BAND, seg: 8, rad: 7, pontas: false });
          enrolar(B, b, fa, rf, 3, LIN, rnd, { t0: 0.05, t1: 0.9 });
        } else {
          B.tubo(b, fa, [0.04, 0.036, 0.03], CARNE, { tex: 'carne', seg: 8, rad: 7, pontas: false });
          B.tubo(b, [[0.0, -0.38, 0.045], [0, -0.46, 0.05], [0, -0.55, 0.035]], [0.014, 0.014, 0.012], OSSOC, { ...OSSOM, seg: 6, rad: 5, linha: false, pontas: false });
          enrolar(B, b, fa, rf, 2, LIN, rnd, { t0: 0.02, t1: 0.12 });
        }
        B.esf(b, 0.056, LIN[3], 0, -0.3, 0, { ...BAND, seg: 10, linha: false });
        B.tor(b, 0.046, 0.014, OURO, 0, -0.5, 0, { rx: PI / 2, seg: 12, metal: 0.8, linha: false });      // bracelete
        B.tor(b, 0.05, 0.01, TURQ, 0, -0.46, 0, { rx: PI / 2, seg: 12, linha: false });
        const mao = B.grupo(b, 0, -0.58, 0);
        B.blob(mao, 0.05, LIN[3], 0, -0.03, 0, { ...BAND, sx: 1.0, sy: 1.0, sz: 0.55, amp: 0.05, seg: 10, linha: false });
        for (let i = 0; i < 4; i++) {
          const x = (i - 1.5) * 0.026, f = 1 + (i === 1 || i === 2 ? 0.2 : 0);
          B.tubo(mao, [[x, -0.05, 0], [x * 1.3, -0.11 * f, 0.0], [x * 1.5, -0.17 * f, -0.03], [x * 1.4, -0.215 * f, -0.07]], [0.012, 0.01, 0.008, 0.005], OSSOC, { ...OSSOM, seg: 6, rad: 4, linha: false, pontas: false });
          ponta(B, mao, [x * 1.4, -0.215 * f, -0.07], [0.0, -0.4, -1], 0.05, 0.007, 0x3a2e20, { seg: 4 });
        }
        B.tubo(mao, [[-l * 0.035, -0.03, 0], [-l * 0.075, -0.07, 0.0], [-l * 0.09, -0.1, -0.04]], [0.014, 0.01, 0.006], OSSOC, { ...OSSOM, seg: 6, rad: 4, linha: false, pontas: false });
        if (l > 0) B.tor(mao, 0.012, 0.004, OURO, 0.013 * 1.5 * 2.2, -0.095, 0, { rx: PI / 2, seg: 6, metal: 0.8, linha: false });
        // faixas penduradas nos antebraços (o "baixo" fica em -z por causa do braço estendido)
        const g1 = fita(B, b, l * 0.03, -0.28, 0, [[0, 0, 0], [0.0, -0.04, -0.12], [l * 0.02, -0.07, -0.26], [l * 0.03, -0.1, -0.42]], 0.05, LIN[l > 0 ? 4 : 0], 0);
        const g2 = fita(B, b, -l * 0.03, -0.45, 0, [[0, 0, 0], [0.0, -0.03, -0.1], [-l * 0.02, -0.06, -0.22]], 0.04, LIN[5], 0.4);
        fitas.push({ g: g1, amp: 0.25, vel: 2.2, eixo: 'x', fase: l }, { g: g2, amp: 0.3, vel: 2.8, eixo: 'x', fase: 2 + l });
        b.userData.fixo = -1.7;
        return b;
      });
      // faixas arrastando dos pés
      [[-1, 0], [1, 1]].forEach(([l, i]) => {
        const g = fita(B, R, l * 0.14, 0.06, -0.06, [[0, 0, 0], [0, -0.02, -0.14], [l * 0.04, -0.045, -0.32], [l * 0.08, -0.058, -0.5]], 0.05, LIN[i * 2], 0.1);
        fitas.push({ g, amp: 0.12, vel: 1.2, eixo: 'y', fase: i * 2 });
      });
      return {
        altura: 1.65,
        p: { tronco: tr, cabeca: cab, bracoE: bracos[0], bracoD: bracos[1], pernaE: pernas[0], pernaD: pernas[1], mandibula: { g: jaw, aberta: 0.3, fechada: 0.32 }, balancos: fitas },
        anim: (t, dt, e) => {
          const golpe = (e && e.golpe) || 0, bal = e && e.andando ? Math.sin(t * 13) : 0;
          bracos[1].rotation.x = -1.7 - golpe * 0.7 + bal * 0.12 + Math.sin(t * 2.2) * 0.04;
          bracos[0].rotation.x = -1.7 + golpe * 0.15 - bal * 0.12 - Math.sin(t * 2.2) * 0.04;
          bracos[0].rotation.z = -0.05 - Math.sin(t * 1.1) * 0.03; bracos[1].rotation.z = 0.05 + Math.sin(t * 1.1) * 0.03;
        },
      };
    },

    /* ================= CHACAL GUARDIÃO ================= */
    chacal(B, R) {
      R.scale.setScalar(0.84);
      const PRETO = 0x1c1a22, h = titan(B, R, { s: 1.0, w: 1.0, pele: 0x2c2836, esc: 0x181520, claro: 0x433d52, tex: 'pele', bota: OURO_ESC, garras: OURO_CLARO, seed: 3 });
      const rnd = sem(9), hd = B.grupo(h.cab, 0, 0.03, 0.0); hd.scale.setScalar(1.3); const cab = hd;
      const PEL = { tex: 'pelo', rep: 1, relevo: 0.05, rough: 0.5 };
      // cabeça de chacal: crânio, focinho longo, nariz úmido, orelhas altas
      B.blob(cab, 0.125, PRETO, 0, 0.17, 0.01, { ...PEL, sx: 0.92, sy: 1.0, sz: 1.1, amp: 0.04, seg: 16 });
      B.tubo(cab, [[0, 0.17, 0.08], [0, 0.15, 0.22], [0, 0.125, 0.38]], [0.085, 0.062, 0.04], PRETO, { ...PEL, seg: 10, rad: 9 });
      B.blob(cab, 0.045, PRETO, 0, 0.17, 0.2, { ...PEL, sx: 1.0, sy: 0.7, sz: 1.5, amp: 0.05, seg: 8, linha: false });   // cume do focinho
      B.blob(cab, 0.034, 0x08080c, 0, 0.13, 0.41, { sx: 1.25, sy: 0.9, sz: 0.9, amp: 0.05, seg: 10, rough: 0.2, metal: 0.2 });   // nariz
      B.tubo(cab, [[0.0, 0.1, 0.1], [0.0, 0.08, 0.22], [0, 0.07, 0.36]], [0.07, 0.055, 0.03], 0x2a2630, { ...PEL, seg: 8, rad: 7, linha: false });
      // mandíbula (abre ao golpear)
      const jaw = B.grupo(cab, 0, 0.09, 0.07);
      B.tubo(jaw, [[0, -0.02, 0.0], [0, -0.035, 0.14], [0, -0.04, 0.3]], [0.06, 0.044, 0.024], 0x2a2630, { ...PEL, seg: 8, rad: 7 });
      B.dentes(jaw, 6, 0.07, 0.03, 0xf0e8d0, 0, 0.0, 0.21, { rx: 0 });
      B.blob(jaw, 0.025, 0x8a2a30, 0, 0.0, 0.14, { sx: 1.4, sy: 0.5, sz: 1.8, seg: 8, linha: false });
      // presas e dentes de cima
      B.dentes(cab, 6, 0.1, 0.028, 0xf0e8d0, 0, 0.1, 0.29, { presas: true });
      [-1, 1].forEach(l => {
        // olhos dourados com kohl
        B.blob(cab, 0.034, 0x050508, l * 0.075, 0.2, 0.1, { sx: 1.3, sy: 0.8, sz: 0.6, seg: 8, linha: false });
        B.olho(cab, 0.024, 0xffc21a, l * 0.075, 0.2, 0.12, { brilho: 1.2 });
        B.tubo(cab, [[l * 0.1, 0.205, 0.1], [l * 0.14, 0.2, 0.06], [l * 0.17, 0.19, 0.0]], [0.007, 0.006, 0.003], 0x050508, { seg: 6, rad: 4, linha: false, pontas: false });   // traço do kohl
        B.blob(cab, 0.03, PRETO, l * 0.07, 0.235, 0.12, { sx: 1.5, sy: 0.55, sz: 1, seg: 8, linha: false, ...PEL });   // sobrancelha
        // orelhas altas e finas, forradas de ouro
        const pts = [[l * 0.07, 0.26, -0.03], [l * 0.1, 0.36, -0.04], [l * 0.115, 0.48, -0.065], [l * 0.1, 0.57, -0.08]];
        const o2 = B.tubo(cab, pts, [0.052, 0.046, 0.03, 0.005], PRETO, { ...PEL, seg: 10, rad: 7, pontas: false });
        o2.scale.z = 0.35;
        const o3 = B.tubo(cab, [[l * 0.07, 0.27, -0.012], [l * 0.095, 0.38, -0.014], [l * 0.108, 0.5, -0.04]], [0.03, 0.026, 0.004], OURO_ESC, { seg: 8, rad: 6, metal: 0.7, rough: 0.4, linha: false, pontas: false });
        o3.scale.z = 0.35;
        B.tor(cab, 0.012, 0.005, OURO, l * 0.1, 0.5, -0.05, { ry: PI / 2, seg: 8, metal: 0.8, linha: false });
        B.cil(cab, 0.012, 0.012, 0.03, OURO, l * 0.085, 0.29, 0.02, { seg: 6, metal: 0.8, linha: false });
      });
      // lenço (nemes) azul listrado com lapelas sobre o peito
      [-1, 1].forEach(l => {
        const g = B.grupo(cab, l * 0.13, 0.18, -0.05);
        const lap = B.tubo(g, [[0, 0, 0], [l * 0.04, -0.15, 0.0], [l * 0.07, -0.3, 0.06], [l * 0.06, -0.45, 0.14]], [0.06, 0.06, 0.055, 0.05], LAPIS_ESC, { tex: 'tecido', rep: 1, seg: 10, rad: 6, pontas: false, linha: false });
        lap.scale.x = 0.45;
        for (let i = 0; i < 5; i++) B.tor(g, 0.045, 0.008, OURO, l * (0.012 + i * 0.012), -0.05 - i * 0.075, 0.0 + i * 0.016, { rx: PI / 2 - 0.1, seg: 8, metal: 0.8, linha: false, sx: 0.55 });
      });
      B.tor(cab, 0.125, 0.014, OURO, 0, 0.27, 0.0, { rx: PI / 2 + 0.1, seg: 16, metal: 0.8, linha: false });
      // colar usekh largo (ouro, lápis e turquesa)
      const tr = h.tr;
      [[0.2, 0.03, OURO, 0.68], [0.245, 0.024, LAPIS, 0.66], [0.285, 0.026, TURQ, 0.64], [0.325, 0.02, OURO_CLARO, 0.62]].forEach(([r, e, c, y]) => B.tor(tr, r, e, c, 0, y, 0.04, { rx: PI / 2 - 0.2, sx: 1.18, sy: 0.9, seg: 14, metal: c === LAPIS ? 0.3 : 0.8, rough: 0.35, linha: false }));
      for (let i = 0; i < 11; i++) { const a = PI * (0.08 + i * 0.084); B.cone(tr, 0.014, 0.05, i % 2 ? TURQ : LAPIS, Math.cos(a) * 0.37 * 1.18 * 0.98, 0.6, Math.sin(a) * 0.37 * 0.9 * 0.98 + 0.07, { rx: PI + 0.1, seg: 5, linha: false }); }
      // saiote shendyt: linho branco com pregas, cinto e avental de ouro
      B.torno(R, [[0.3, 0.5], [0.285, 0.6], [0.245, 0.78], [0.2, 0.93]], 0xe8dcb8, 0, 0, 0, { tex: 'tecido', rep: 1, relevo: 0.04, seg: 16 });
      for (let i = 0; i < 11; i++) { const a = -PI * 0.85 + i * PI * 0.17; B.cx(R, 0.085, 0.42, 0.02, i % 2 ? 0xd8c9a0 : 0xf6eed6, Math.sin(a) * 0.275, 0.71, Math.cos(a) * 0.275, { ry: a, rx: 0.14, linha: false }); }
      B.tor(R, 0.3, 0.012, OURO, 0, 0.53, 0, { rx: PI / 2, seg: 20, metal: 0.8, linha: false });
      B.tor(R, 0.205, 0.035, OURO, 0, 0.93, 0, { rx: PI / 2, sx: 1.12, sy: 0.92, seg: 14, metal: 0.8, rough: 0.3 });
      B.cone(R, 0.13, 0.42, OURO, 0, 0.72, 0.29, { rx: PI - 0.1, sz: 0.18, seg: 4, ry: PI / 4, metal: 0.8, rough: 0.3 });
      for (let i = 0; i < 3; i++) B.cx(R, 0.12 - i * 0.035, 0.014, 0.025, i % 2 ? TURQ : LAPIS, 0, 0.85 - i * 0.09, 0.32, { rx: -0.1, linha: false });
      B.esf(R, 0.026, 0xd83030, 0, 0.93, 0.235, { emissive: 0x802020, brilho: 0.5, seg: 8, linha: false });
      // braçadeiras e munhequeiras de ouro; caneleiras
      [h.bracoE, h.bracoD].forEach((b, i) => {
        const l = i ? 1 : -1;
        B.tor(b, 0.095, 0.022, OURO, 0, -0.17, 0.0, { rx: PI / 2, seg: 14, metal: 0.8, rough: 0.3, linha: false });
        B.esf(b, 0.022, TURQ, l * 0.0, -0.17, 0.097, { seg: 7, linha: false });
        B.tor(b, 0.058, 0.02, OURO, 0, -0.5, 0.05, { rx: PI / 2 - 0.1, seg: 12, metal: 0.8, linha: false });
        B.tor(b, 0.062, 0.01, LAPIS, 0, -0.45, 0.045, { rx: PI / 2 - 0.1, seg: 10, linha: false });
      });
      [h.pernaE, h.pernaD].forEach(p => { B.tubo(p, [[0, -0.55, 0.035], [0, -0.7, 0.03], [0, -0.85, 0.015]], [0.07, 0.078, 0.052], OURO_ESC, { metal: 0.7, rough: 0.35, seg: 8, rad: 8, linha: false, tex: 'metal' }); B.tor(p, 0.082, 0.014, OURO, 0, -0.5, 0.0, { rx: PI / 2, seg: 10, metal: 0.8, linha: false }); });
      // lança sagrada, vertical na mão direita (golpeia ao atacar)
      const mao = h.maoD, lan = B.grupo(mao, 0, 0, 0.01);
      lan.rotation.x = 0.25;
      B.cil(lan, 0.019, 0.022, 1.9, mez(0x5a3a1a, OBS, 0.2), 0, 0.4, 0, { seg: 8, tex: 'couro', rep: 1 });
      for (let i = 0; i < 4; i++) B.cil(lan, 0.027, 0.027, 0.03, i % 2 ? TURQ : OURO, 0, 0.0 + i * 0.5, 0, { seg: 8, metal: 0.7, linha: false });
      B.cil(lan, 0.035, 0.02, 0.1, OURO, 0, 1.38, 0, { seg: 8, metal: 0.8, linha: false });
      B.blob(lan, 0.1, OURO_CLARO, 0, 1.56, 0, { sx: 0.5, sy: 1.9, sz: 0.2, amp: 0.02, seg: 12, metal: 0.8, rough: 0.28 });
      B.cx(lan, 0.012, 0.28, 0.026, OURO_ESC, 0, 1.56, 0, { linha: false, metal: 0.7 });
      B.cil(lan, 0.02, 0.026, 0.1, OURO, 0, -0.6, 0, { seg: 8, metal: 0.8, linha: false });
      const bor = [0, 1, 2].map(i => fita(B, lan, 0, 1.34, 0.02, [[0, 0, 0], [0.03 * (i - 1), -0.08, 0.02], [0.05 * (i - 1), -0.2, 0.05]], 0.016, [SETE, OURO, TURQ][i], i * 2));
      return {
        altura: 1.95,
        p: { tronco: h.tr, cabeca: h.cab, bracoD: h.bracoD, bracoE: h.bracoE, pernaD: h.pernaD, pernaE: h.pernaE, mandibula: { g: jaw, aberta: 0.5, fechada: 0.04 }, balancos: bor.map((g, i) => ({ g, amp: 0.3, vel: 2.5 + i, eixo: 'x', fase: i })) },
        anim: (t, dt, e) => { const bal = e && e.andando ? Math.sin(t * 13) : 0; h.bracoE.rotation.x = -0.55 + bal * 0.3 + Math.sin(t * 2.2) * 0.03; h.bracoE.rotation.z = 0.28; h.bracoD.rotation.z = -0.03; },
      };
    },

    /* ================= SERPENTE DE APÓFIS ================= */
    serpente(B, R) {
      R.scale.setScalar(0.85);
      const VERDE_ESC = 0x1d4a2c, VERDE = 0x2c6a38, CREME = 0xe6d79c;
      const ESCM = { tex: 'escamas', rep: 2, rough: 0.45, relevo: 0.07, metal: 0.15 };
      const c = B.grupo(R, 0, 0, 0);
      // corpo enrolado em espirais grossas, da ponta da cauda até a base do pescoço
      const N = 60, pts = [], rr = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, ang = PI + (u - 1) * PI * 4.1, rad = 0.82 - u * 0.52 + Math.sin(u * 5) * 0.03, y = 0.04 + Math.pow(u, 0.85) * 0.68;
        pts.push([Math.sin(ang) * rad, y + (u < 0.1 ? u * 0.5 : 0.05) * 0.5 + 0.0, Math.cos(ang) * rad]);
        rr.push(Math.min(1, 0.06 + u * 4.2) * 0.04 + (1 - Math.exp(-u * 7)) * 0.115 * (1 + u * 0.1));
      }
      rr[0] = 0.008;
      tuboLongo(B, c, pts, rr, VERDE_ESC, { ...ESCM, seg: 150, rad: 10 });
      const cv = curvaDe(pts);
      // losangos dorsais dourados e escuros ao longo das espirais
      for (let i = 0; i < 46; i++) {
        const t = 0.1 + i * 0.0195, P = cv.getPointAt(Math.min(1, t)), T = cv.getTangentAt(Math.min(1, t)), r = rr[Math.min(N, Math.round(t * N))];
        const N0 = V(0, 1, 0), N1 = N0.sub(T.clone().multiplyScalar(N0.dot(T))).normalize();
        const m = B.esf(c, 1, i % 2 ? OURO_ESC : mez(OURO_ESC, VERDE_ESC, 0.55), 0, 0, 0, { seg: 6, linha: false, metal: 0.5, rough: 0.4, sx: r * 0.6, sy: r * 0.2, sz: r * 1.15 });
        orientar(m, [P.x + N1.x * r * 0.9, P.y + N1.y * r * 0.9, P.z + N1.z * r * 0.9], [T.x, T.y, T.z], [N1.x, N1.y, N1.z]);
        // pontinhos turquesa nos flancos
        const S = new THREE.Vector3().crossVectors(N1, T);
        [-1, 1].forEach(l => B.esf(c, r * 0.14, TURQ, P.x + S.x * l * r * 0.95 + N1.x * r * 0.2, P.y + S.y * l * r * 0.95 + N1.y * r * 0.2, P.z + S.z * l * r * 0.95 + N1.z * r * 0.2, { seg: 5, linha: false }));
      }
      // pontas de espinho e anéis dourados na cauda
      for (let i = 0; i < 4; i++) { const t = 0.03 + i * 0.03, P = cv.getPointAt(t), T = cv.getTangentAt(t); anel(B, c, [P.x, P.y, P.z], [T.x, T.y, T.z], rr[Math.round(t * N)] * 1.08, 0.012, OURO, sem(i + 1), { tex: undefined, metal: 0.8, tilt: 0, seg: 8 }); }
      // pescoço erguido (pivô na base): curva em S, barriga clara na frente
      const last = pts[N], neck = B.grupo(c, last[0], last[1], last[2]);
      const np = [[0, 0, 0], [0, 0.22, 0.06], [0, 0.45, 0.04], [0, 0.68, -0.08], [0, 0.88, -0.04], [0, 1.0, 0.14]], nr = [0.15, 0.145, 0.13, 0.115, 0.1, 0.092];
      tuboLongo(B, neck, np, nr, VERDE, { ...ESCM, seg: 44, rad: 10, rep: 2, tile: 0.41 });
      const nc = curvaDe(np);
      for (let i = 0; i < 13; i++) {   // placas ventrais claras
        const t = 0.05 + i * 0.075, P = nc.getPointAt(t), T = nc.getTangentAt(t), r = nr[Math.min(5, Math.round(t * 5))];
        const m = B.esf(neck, 1, i % 3 ? CREME : 0xc9b878, 0, 0, 0, { seg: 6, linha: false, rough: 0.55, sx: r * 0.8, sy: r * 0.28, sz: r * 0.62 });
        orientar(m, [P.x, P.y, P.z + r * 0.88], [T.x, T.y, T.z], [0, 0, 1]);
      }
      for (let i = 0; i < 11; i++) {   // losangos dorsais do pescoço
        const t = 0.06 + i * 0.085, P = nc.getPointAt(t), T = nc.getTangentAt(t), r = nr[Math.min(5, Math.round(t * 5))];
        const m = B.esf(neck, 1, i % 2 ? OURO : mez(OURO_ESC, VERDE_ESC, 0.4), 0, 0, 0, { seg: 6, linha: false, metal: 0.5, rough: 0.4, sx: r * 0.8, sy: r * 0.25, sz: r * 1.5 });
        orientar(m, [P.x, P.y, P.z - r * 0.88], [T.x, T.y, T.z], [0, 0, -1]);
      }
      // capuz aberto: verso verde com marcas de olho dourado, frente clara com nervuras
      const cap = B.grupo(neck, 0, 0.8, -0.03); cap.rotation.x = -0.12; cap.scale.set(1.3, 1.3, 1);
      B.blob(cap, 0.3, VERDE_ESC, 0, 0.1, -0.03, { ...ESCM, sx: 1.05, sy: 0.95, sz: 0.1, amp: 0.03, seg: 18 });
      B.blob(cap, 0.2, VERDE_ESC, 0, -0.1, -0.03, { ...ESCM, sx: 0.85, sy: 1.2, sz: 0.12, amp: 0.03, seg: 14, linha: false });
      B.blob(cap, 0.28, CREME, 0, 0.1, 0.04, { tex: 'pele', rep: 1, relevo: 0.02, rough: 0.6, sx: 1.0, sy: 0.9, sz: 0.1, amp: 0.02, seg: 16, linha: false });
      B.blob(cap, 0.18, CREME, 0, -0.1, 0.04, { tex: 'pele', rep: 1, relevo: 0.02, sx: 0.8, sy: 1.15, sz: 0.12, amp: 0.02, seg: 12, linha: false });
      for (let i = 0; i < 9; i++) {   // nervuras (costelas do capuz) em leque
        const a = -PI * 0.5 + (i - 4) * 0.34 + PI * 0.5, dx = Math.cos(a - PI / 2) * 0.0;
        const ang = (i - 4) * 0.36, ex = Math.sin(ang) * 0.34, ey = 0.1 + Math.cos(ang) * 0.3 * (Math.abs(ang) > 1 ? 0.3 : 1) - 0.05;
        B.tubo(cap, [[0, -0.15, 0.1], [ex * 0.5, (ey - 0.15) * 0.5, 0.112], [ex, ey, 0.09]], [0.01, 0.012, 0.006], i % 2 ? 0x3a3a24 : OURO_ESC, { seg: 8, rad: 4, linha: false, pontas: false });
      }
      [-1, 1].forEach(l => {   // marcas de óculos no verso
        B.tor(cap, 0.085, 0.012, OURO, l * 0.14, 0.14, -0.14, { ry: PI, seg: 14, metal: 0.8, linha: false });
        B.esf(cap, 0.05, 0x0a0a0a, l * 0.14, 0.14, -0.13, { seg: 8, sz: 0.4, linha: false });
        B.esf(cap, 0.02, 0xffc21a, l * 0.14, 0.14, -0.15, { seg: 6, linha: false, emissive: 0xffc21a, brilho: 0.8 });
      });
      B.tubo(cap, [[-0.28, 0.0, -0.01], [-0.2, 0.23, -0.01], [0, 0.34, -0.01], [0.2, 0.23, -0.01], [0.28, 0.0, -0.01]], [0.012, 0.016, 0.018, 0.016, 0.012], OURO, { seg: 16, rad: 5, metal: 0.8, linha: false, pontas: false });   // borda de ouro
      // cabeça de naja: focinho largo, olhos de fenda, presas, língua bifurcada
      const hd = B.grupo(neck, 0, 1.0, 0.14); hd.rotation.x = 0.35; hd.scale.setScalar(1.3);
      B.blob(hd, 0.12, VERDE, 0, 0.0, 0.06, { ...ESCM, sx: 1.1, sy: 0.7, sz: 1.3, amp: 0.03, seg: 16 });
      B.tubo(hd, [[0, -0.005, 0.12], [0, -0.015, 0.22], [0, -0.025, 0.3]], [0.082, 0.066, 0.05], VERDE, { ...ESCM, seg: 8, rad: 9 });
      B.blob(hd, 0.05, VERDE_ESC, 0, 0.0, 0.3, { sx: 1.3, sy: 0.8, sz: 0.9, seg: 8, linha: false, ...ESCM });
      [-1, 1].forEach(l => {
        B.blob(hd, 0.04, VERDE_ESC, l * 0.075, 0.075, 0.12, { sx: 1.3, sy: 0.6, sz: 1.5, amp: 0.05, seg: 8, linha: false, tex: 'escamas' });  // sobrancelha
        B.olho(hd, 0.03, 0xffd21a, l * 0.088, 0.045, 0.15, { fenda: true, brilho: 1.3 });
        B.esf(hd, 0.01, 0x050505, l * 0.04, -0.01, 0.35, { seg: 4, linha: false });
        ponta(B, hd, [l * 0.035, -0.045, 0.27], [l * 0.1, -1, -0.3], 0.13, 0.014, 0xf6f0d8, { seg: 5 });   // presa
        B.esf(hd, 0.014, 0x9aff6a, l * 0.04, -0.17, 0.25, { seg: 5, linha: false, emissive: 0x6aff3a, brilho: 0.8 });
      });
      B.dentes(hd, 9, 0.12, 0.02, 0xece4c4, 0, -0.04, 0.2, { rx: PI });
      const jaw = B.grupo(hd, 0, -0.05, 0.03);
      B.tubo(jaw, [[0, -0.015, 0.0], [0, -0.03, 0.14], [0, -0.025, 0.29]], [0.062, 0.05, 0.034], CREME, { tex: 'escamas', rep: 1, seg: 8, rad: 8 });
      B.blob(jaw, 0.03, 0x8a2530, 0, 0.0, 0.14, { sx: 1.5, sy: 0.4, sz: 2.4, seg: 8, linha: false });
      B.dentes(jaw, 8, 0.1, 0.018, 0xece4c4, 0, 0.0, 0.2, { rx: 0 });
      const lin = B.grupo(jaw, 0, 0.0, 0.2);
      B.tubo(lin, [[0, 0, 0], [0, -0.01, 0.12], [0, -0.01, 0.22]], [0.01, 0.008, 0.006], 0xc02030, { seg: 8, rad: 4, linha: false, pontas: false });
      [-1, 1].forEach(l => B.tubo(lin, [[0, -0.01, 0.22], [l * 0.025, -0.01, 0.28], [l * 0.05, -0.01, 0.31]], [0.006, 0.005, 0.002], 0xc02030, { seg: 6, rad: 4, linha: false, pontas: false }));
      return {
        altura: 1.8,
        p: { tronco: c, cabeca: neck, mandibula: { g: jaw, aberta: 0.7, fechada: 0.18 }, balancos: [{ g: lin, amp: 0.5, vel: 9, eixo: 'y', fase: 0 }] },
        anim: (t, dt, e) => {
          const golpe = (e && e.golpe) || 0;
          neck.rotation.z = Math.sin(t * 1.3) * 0.07; neck.rotation.x = Math.sin(t * 0.9) * 0.04 + golpe * 0.4 + (e && e.andando ? Math.sin(t * 6) * 0.05 : 0);
          hd.rotation.x = 0.35 + Math.sin(t * 1.7) * 0.05 - golpe * 0.2;
          cap.scale.x = 1.3 + Math.sin(t * 2.1) * 0.03 + golpe * 0.1;
        },
      };
    },

    /* ================= SET, DEUS DO CAOS (CHEFE) ================= */
    set(B, R) {
      const VERM = 0x9a2a20, VERM_ESC = 0x4f1410, VERM_CL = 0xbf4a38; R.scale.setScalar(0.72);
      const h = titan(B, R, { s: 1.12, w: 1.2, wx: 1.0, pele: VERM, esc: VERM_ESC, claro: VERM_CL, tex: 'pele', bota: 0x2a1418, garras: 0xe8dcc0, seed: 8 });
      const tr = h.tr, rnd = sem(21);
      const PEL = { tex: 'pele', rep: 1, relevo: 0.03, rough: 0.55 };
      // ----- cabeça do animal de Set -----
      const hd = B.grupo(h.cab, 0, 0.06, 0.02); hd.scale.setScalar(1.5); hd.rotation.x = -0.28;
      B.blob(hd, 0.145, VERM, 0, 0.2, 0.0, { ...PEL, sx: 0.95, sy: 1.0, sz: 1.1, amp: 0.04, seg: 16 });
      const focinho = [[0, 0.2, 0.08], [0, 0.215, 0.26], [0, 0.2, 0.44], [0, 0.13, 0.58]];
      B.tubo(hd, focinho, [0.105, 0.082, 0.064, 0.05], VERM, { ...PEL, seg: 12, rad: 9, pontas: false });
      B.blob(hd, 0.05, VERM_ESC, 0, 0.115, 0.6, { sx: 1.2, sy: 0.9, sz: 1.0, amp: 0.06, seg: 10, rough: 0.35 });   // ponta do focinho caída
      [-1, 1].forEach(l => {
        B.esf(hd, 0.012, 0x120505, l * 0.025, 0.09, 0.645, { seg: 5, linha: false });
        B.blob(hd, 0.035, VERM_CL, l * 0.06, 0.1, 0.5, { sx: 0.9, sy: 0.8, sz: 1.5, amp: 0.1, seg: 8, linha: false, ...PEL });  // bochecha/rugas
        B.blob(hd, 0.045, VERM_ESC, l * 0.075, 0.275, 0.12, { sx: 1.5, sy: 0.55, sz: 1.0, amp: 0.06, seg: 8, linha: false, rz: l * -0.35, ...PEL });   // sobrancelha raivosa
        B.olho(hd, 0.03, 0xffd21a, l * 0.082, 0.24, 0.14, { brilho: 1.4 });
        // orelhas largas, retas e quadradas
        const e1 = B.placa(hd, 0.17, 0.46, 0.03, VERM, l * 0.19, 0.46, -0.04, { raio: 0.01, bisel: 0.012, rz: -l * 0.32, ry: l * 0.2, ...PEL });
        B.placa(hd, 0.1, 0.34, 0.02, VERM_ESC, l * 0.2, 0.46, -0.01, { raio: 0.01, bisel: 0.008, rz: -l * 0.32, ry: l * 0.2, linha: false });
        B.tor(hd, 0.014, 0.006, OURO, l * 0.26, 0.3, -0.04, { ry: PI / 2, seg: 8, metal: 0.8, linha: false });
      });
      B.cx(hd, 0.02, 0.0, 0.0, VERM, 0, 0, 0, { visible: false });
      // cicatriz sobre o olho esquerdo e rugas
      B.tubo(hd, [[-0.1, 0.32, 0.12], [-0.085, 0.26, 0.15], [-0.07, 0.19, 0.16]], [0.004, 0.006, 0.004], 0xe8b8a0, { seg: 8, rad: 4, linha: false, pontas: false });
      // mandíbula e presas
      const jaw = B.grupo(hd, 0, 0.12, 0.08);
      B.tubo(jaw, [[0, -0.01, 0.0], [0, -0.03, 0.18], [0, -0.07, 0.36], [0, -0.1, 0.46]], [0.075, 0.058, 0.04, 0.03], VERM_ESC, { ...PEL, seg: 10, rad: 8, pontas: false });
      B.dentes(jaw, 7, 0.09, 0.035, 0xf0e6c8, 0, -0.045, 0.34, { rx: 0 });
      B.blob(jaw, 0.035, 0x7a1c22, 0, -0.035, 0.22, { sx: 1.3, sy: 0.4, sz: 2.8, seg: 8, linha: false });
      B.dentes(hd, 7, 0.12, 0.04, 0xf0e6c8, 0, 0.13, 0.4, { presas: true });
      // coroa dupla (pschent): base vermelha com espiral e coroa branca por dentro
      const cor = B.grupo(hd, 0, 0.33, 0.0); cor.scale.setScalar(0.8);
      B.torno(cor, [[0.15, 0], [0.165, 0.05], [0.15, 0.14], [0.13, 0.15]], 0xb03028, 0, 0, 0, { seg: 12, metal: 0.2, rough: 0.5, tex: 'couro' });
      B.placa(cor, 0.14, 0.26, 0.03, 0xb03028, 0, 0.2, -0.13, { rx: 0.1, raio: 0.02, bisel: 0.015, tex: 'couro' });
      B.tubo(cor, [[0, 0.1, 0.16], [0, 0.22, 0.2], [0, 0.34, 0.14], [0.0, 0.4, 0.07], [0, 0.34, 0.04]], [0.014, 0.014, 0.012, 0.011, 0.01], 0xb03028, { seg: 14, rad: 5, linha: false, pontas: false });
      B.torno(cor, [[0.12, 0.1], [0.115, 0.22], [0.1, 0.34], [0.075, 0.46], [0.05, 0.54], [0.022, 0.58], [0.001, 0.59]], 0xf4eedc, 0, 0.03, 0.0, { seg: 16, rough: 0.45 });
      B.tor(cor, 0.158, 0.012, OURO, 0, 0.11, 0, { rx: PI / 2, seg: 12, metal: 0.8, linha: false });
      B.tubo(cor, [[0, 0.2, 0.2], [0, 0.26, 0.21], [0, 0.34, 0.19]], [0.014, 0.012, 0.01], OURO, { seg: 6, rad: 5, metal: 0.8, linha: false, pontas: false });  // uraeus
      B.esf(cor, 0.02, OURO, 0, 0.36, 0.19, { seg: 6, metal: 0.8, linha: false });
      // ----- colar usekh, ombreiras de espinhos, braçadeiras -----
      [[0.22, 0.034, OURO, 0.7], [0.27, 0.026, 0xb02a22, 0.68], [0.315, 0.028, TURQ, 0.66], [0.36, 0.022, OURO_CLARO, 0.64]].forEach(([r, e, c, y]) => B.tor(tr, r * 1.12, e, c, 0, y * 1.12, 0.04, { rx: PI / 2 - 0.2, sx: 1.3, sy: 0.9, seg: 12, metal: c === 0xb02a22 ? 0.3 : 0.8, rough: 0.35, linha: false }));
      for (let i = 0; i < 11; i++) { const a = PI * (0.08 + i * 0.084); B.cone(tr, 0.016, 0.06, i % 2 ? TURQ : 0x1c3f9c, Math.cos(a) * 0.42 * 1.3, 0.69, Math.sin(a) * 0.42 * 0.9 + 0.09, { rx: PI + 0.1, seg: 5, linha: false }); }
      [h.bracoE, h.bracoD].forEach((b, i) => {
        const l = i ? 1 : -1, k = 1.12;
        B.blob(b, 0.15 * k, OURO_ESC, l * 0.02, 0.04, 0, { sx: 1.1, sy: 0.7, amp: 0.04, seg: 12, tex: 'metal', metal: 0.7, rough: 0.35 });   // ombreira
        for (let j = 0; j < 3; j++) ponta(B, b, [l * (0.06 + j * 0.05), 0.09, (j - 1) * 0.06], [l * (0.8 + j * 0.3), 1, (j - 1) * 0.3], 0.17 - j * 0.03, 0.04, OURO_CLARO, { seg: 6, metal: 0.8, linha: false });
        B.tor(b, 0.11 * k, 0.026, OURO, 0, -0.2 * k, 0.0, { rx: PI / 2, seg: 12, metal: 0.8, rough: 0.3, linha: false });
        B.esf(b, 0.026, 0xc02020, 0, -0.2 * k, 0.12 * k, { seg: 7, emissive: 0x801010, brilho: 0.6, linha: false });
        B.tor(b, 0.07 * k, 0.024, OURO, 0, -0.52 * k, 0.06 * k, { rx: PI / 2 - 0.1, seg: 12, metal: 0.8, linha: false });
        for (let j = 0; j < 3; j++) B.cone(b, 0.016, 0.07, OURO_CLARO, l * 0.07 * k, (-0.5 - j * 0.0) * k, (0.02 + (j - 1) * 0.05) * k + 0.05, { rz: -l * PI / 2 + l * 0.2, seg: 5, metal: 0.8, linha: false });   // espinhos do bracelete
      });
      // faixa de correntes cruzando o peito (contas de ouro)
      const peito = [[-0.3, 0.68, 0.18], [-0.12, 0.5, 0.3], [0.08, 0.34, 0.33], [0.28, 0.18, 0.27]].map(p => [p[0] * 1.12, p[1] * 1.12, p[2] * 1.12]);
      B.tubo(tr, peito, [0.012, 0.012, 0.012, 0.012], OURO_ESC, { seg: 14, rad: 5, metal: 0.8, linha: false, pontas: false });
      const pc = curvaDe(peito);
      for (let i = 0; i < 9; i++) { const P = pc.getPointAt((i + 0.5) / 9); B.esf(tr, 0.02, i % 3 ? OURO : 0xc02020, P.x, P.y, P.z, { seg: 6, metal: 0.8, linha: false }); }
      B.esf(tr, 0.05, OURO, 0.0, 0.52, 0.32, { sy: 0.8, sz: 0.5, metal: 0.8, seg: 10 });  // medalhão
      B.esf(tr, 0.025, 0xc02020, 0.0, 0.52, 0.345, { seg: 7, emissive: 0x801010, brilho: 0.7, linha: false });
      // ----- saiote negro com borda de ouro, cinto e correntes -----
      B.torno(R, [[0.4, 0.5], [0.375, 0.62], [0.345, 0.8], [0.31, 0.97]], 0x24141a, 0, 0, 0, { tex: 'tecido', rep: 1, relevo: 0.04, seg: 18 });
      B.tor(R, 0.4, 0.016, OURO, 0, 0.51, 0, { rx: PI / 2, seg: 14, metal: 0.8, linha: false });
      for (let i = 0; i < 11; i++) { const a = -PI * 0.85 + i * PI * 0.17; B.cx(R, 0.08, 0.42, 0.02, i % 2 ? 0x3a1c24 : 0x2a1218, Math.sin(a) * 0.36, 0.74, Math.cos(a) * 0.36, { ry: a, rx: 0.14, linha: false }); }
      B.tor(R, 0.33, 0.04, OURO, 0, 0.97, 0, { rx: PI / 2, sx: 1.0, sy: 0.92, seg: 12, metal: 0.8, rough: 0.3 });
      B.cone(R, 0.14, 0.46, OURO, 0, 0.75, 0.4, { rx: PI - 0.1, sz: 0.18, seg: 4, ry: PI / 4, metal: 0.8, rough: 0.3 });
      B.esf(R, 0.04, 0xc02020, 0, 0.97, 0.33, { seg: 8, emissive: 0x801010, brilho: 0.7, linha: false });
      // ----- capa rasgada (tiras que balançam) -----
      const bal = [];
      for (let i = 0; i < 9; i++) {
        const x = (i - 4) * 0.115 * 1.1, comp = 0.85 + (i % 3) * 0.18 + (Math.abs(i - 4) < 2 ? 0.1 : 0);
        const g = B.grupo(tr, x, 0.72, -0.2 - Math.cos((i - 4) * 0.4) * 0.03); g.rotation.y = (i - 4) * 0.12;
        const t = B.tubo(g, [[0, 0, 0], [0, -0.4, -0.05], [0, -comp * 0.7, -0.09 - (i % 2) * 0.02], [0.02 * ((i % 2) * 2 - 1), -comp - 0.4 * 0.0, -0.1]], [0.07, 0.068, 0.062, 0.02], i % 2 ? 0x5a0f16 : 0x7a1a1a, { tex: 'tecido', rep: 1, relevo: 0.04, seg: 10, rad: 6, linha: false, pontas: false });
        t.scale.x = 0.22;
        bal.push({ g, amp: 0.06 + (i % 3) * 0.02, vel: 1.6 + (i % 4) * 0.3, eixo: 'x', fase: i * 0.8 });
      }
      B.tor(tr, 0.3, 0.014, OURO, 0, 0.74, -0.16, { rx: PI / 2 - 0.1, sx: 1.55, sy: 0.55, seg: 12, metal: 0.8, linha: false });
      // ----- cauda bifurcada de Set -----
      const cauda = B.grupo(R, 0, 0.98, -0.2);
      const cp = [[0, 0, 0], [0, -0.08, -0.3], [0, 0.1, -0.55], [0, 0.4, -0.62], [0, 0.72, -0.58]];
      B.tubo(cauda, cp, [0.07, 0.06, 0.048, 0.04, 0.034], VERM_ESC, { ...PEL, seg: 14, rad: 7, pontas: false });
      [-1, 1].forEach(l => B.tubo(cauda, [[0, 0.72, -0.58], [l * 0.05, 0.84, -0.58], [l * 0.1, 0.98, -0.56]], [0.034, 0.026, 0.004], VERM_ESC, { seg: 8, rad: 6, pontas: false }));
      // ----- cetro uas gigante na mão direita -----
      const lan = B.grupo(h.maoD, 0, 0, 0.02); lan.rotation.x = 0.2;
      B.cil(lan, 0.032, 0.036, 2.2, mez(0x6a5420, OBS, 0.1), 0, 0.5, 0, { seg: 8, tex: 'metal', rep: 1, metal: 0.5, rough: 0.4 });
      for (let i = 0; i < 6; i++) B.cil(lan, 0.046, 0.046, 0.04, i % 2 ? TURQ : OURO, 0, -0.5 + i * 0.5, 0, { seg: 8, metal: 0.7, linha: false });
      [-1, 1].forEach(l => B.tubo(lan, [[0, -0.75, 0], [l * 0.05, -0.85, 0.0], [l * 0.12, -0.99, 0], [l * 0.14, -1.06, 0]], [0.035, 0.03, 0.02, 0.004], OURO, { seg: 8, rad: 6, metal: 0.8, linha: false, pontas: false }));   // pé bifurcado
      const cab2 = B.grupo(lan, 0, 1.6, 0);
      B.blob(cab2, 0.09, OURO, 0, 0.0, 0.0, { sx: 0.95, amp: 0.03, seg: 12, metal: 0.8, rough: 0.3 });
      B.tubo(cab2, [[0, 0.01, 0.05], [0, 0.015, 0.16], [0, -0.01, 0.28], [0, -0.1, 0.36]], [0.065, 0.05, 0.04, 0.03], OURO, { seg: 10, rad: 8, metal: 0.8, rough: 0.3 });
      [-1, 1].forEach(l => { B.placa(cab2, 0.09, 0.22, 0.02, OURO, l * 0.06, 0.2, -0.03, { raio: 0.01, bisel: 0.008, rz: -l * 0.15, metal: 0.8, rough: 0.3, linha: false }); });
      const olhoC = B.vivo(B.esf(cab2, 0.025, 0xff3a1a, 0.06, 0.05, 0.05, { emissive: 0xff3a1a, brilho: 1.4, linha: false, seg: 8 }));
      B.cil(cab2, 0.045, 0.036, 0.1, OURO, 0, -0.1, 0, { seg: 8, metal: 0.8, linha: false });
      // ----- mão esquerda com tempestade de areia -----
      const orbe = B.vivo(B.esf(h.maoE, 0.1, 0xff6a2a, 0, -0.2, 0.0, { emissive: 0xff5a1a, brilho: 1.3, linha: false, seg: 12 }));
      const aneis = [0, 1].map(i => B.vivo(B.tor(h.maoE, 0.13 + i * 0.05, 0.01, i ? OURO : 0xff9a4a, 0, -0.2, 0.0, { emissive: 0xaa4010, brilho: 0.6, linha: false, seg: 18 })));
      // ----- aura de areia (partículas que giram e funil translúcido) -----
      const sand = [];
      for (let i = 0; i < 26; i++) {
        const m = B.vivo(B.esf(R, 0.025 + rnd() * 0.04, mez(0xf0c060, 0xb87a30, rnd()), 0, 0, 0, { op: 0.6, seg: 5, linha: false, rough: 1, emissive: 0xaa7020, brilho: 0.8 }));
        m.userData.a = rnd() * PI * 2; m.userData.r = 0.7 + rnd() * 0.4; m.userData.y = 0.1 + rnd() * 1.9; m.userData.v = 0.5 + rnd() * 0.9;
        sand.push(m);
      }
      const funil = B.vivo(B.cone(R, 0.95, 1.8, AREIA, 0, 0.9, 0, { rx: PI, op: 0.12, seg: 18, linha: false, rough: 1, emissive: 0x6a4a1a, brilho: 0.3 }));
      return {
        altura: 2.15,
        p: { tronco: tr, cabeca: h.cab, bracoD: h.bracoD, bracoE: h.bracoE, pernaD: h.pernaD, pernaE: h.pernaE, cauda, mandibula: { g: jaw, aberta: 0.45, fechada: 0.05 }, balancos: bal },
        anim: (t, dt, e) => {
          const b = e && e.andando ? Math.sin(t * 13) : 0, golpe = (e && e.golpe) || 0;
          h.bracoE.rotation.x = -0.75 + b * 0.15 + Math.sin(t * 2) * 0.05 - golpe * 0.4; h.bracoE.rotation.z = 0.2;
          h.bracoD.rotation.z = -0.04;
          orbe.scale.setScalar(1 + Math.sin(t * 5) * 0.12 + golpe * 0.3);
          aneis.forEach((a, i) => { a.rotation.x = t * (1.4 + i * 0.6); a.rotation.y = t * (0.8 - i * 1.1); });
          olhoC.material.emissiveIntensity = 1.2 + Math.sin(t * 4) * 0.4;
          sand.forEach(m => { const u = m.userData, a = u.a + t * u.v; m.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 1.3 + u.a) * 0.08, Math.sin(a) * u.r); });
          funil.rotation.y = t * 0.6;
        },
      };
    },
  });
})();
