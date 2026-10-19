'use strict';
/* Modelos 3D — Valhala (draugr, lobo_gelo, valquiria, troll_gelo, fenrir). Miniaturas esculpidas com blob/tubo + ferramentas locais. */
(() => {
  const PI = Math.PI;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const Va = a => new THREE.Vector3(a[0], a[1], a[2]);
  /** gerador pseudo-aleatório com semente (o mesmo modelo sai sempre igual) */
  const sem = s => { let a = (s * 2654435761) >>> 0 || 1; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; };
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Geometrias locais ---------- */
  /** monta uma geometria "sem índice" (facetada) a partir de uma lista de posições */
  function geoDePos(pos) {
    const g = new THREE.BufferGeometry(), uv = new Float32Array(pos.length / 3 * 2);
    for (let i = 0; i < pos.length / 3; i++) { uv[i * 2] = pos[i * 3] * 2 + pos[i * 3 + 2] * 1.3; uv[i * 2 + 1] = pos[i * 3 + 1] * 2; }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }
  /** muitos espinhos/tufos/cristais numa geometria só. itens: {p, d, l, r, b?, tw?}; perfil: [[t, fatorRaio]...] até a ponta */
  function espiGeo(itens, lados = 4, perfil = [[0, 1], [0.5, 0.6]]) {
    const pos = [];
    const tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (const it of itens) {
      const d = Va(it.d).normalize();
      const u = (Math.abs(d.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)).cross(d).normalize(), v = d.clone().cross(u);
      const p0 = Va(it.p), bd = it.b ? Va(it.b) : null;
      const aneis = perfil.map(([t, rf]) => {
        const c = p0.clone().addScaledVector(d, it.l * t); if (bd) c.addScaledVector(bd, t * t);
        const r = it.r * rf, ring = [];
        for (let i = 0; i < lados; i++) { const a = i / lados * PI * 2 + (it.tw || 0); ring.push(c.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r)); }
        return ring;
      });
      const tip = p0.clone().addScaledVector(d, it.l); if (bd) tip.add(bd);
      for (let k = 0; k < aneis.length - 1; k++) for (let i = 0; i < lados; i++) {
        const j = (i + 1) % lados, a = aneis[k][i], b = aneis[k][j], c = aneis[k + 1][i], e = aneis[k + 1][j];
        tri(a, b, c); tri(b, e, c);
      }
      const ul = aneis[aneis.length - 1];
      for (let i = 0; i < lados; i++) tri(ul[i], ul[(i + 1) % lados], tip);
    }
    return geoDePos(pos);
  }
  /** fita que segue uma curva, com largura variável (panos, cabelo, penas). lado = direção "da largura" */
  function tiraGeo(pts, anchos, seg = 6, o = {}) {
    const curva = new THREE.CatmullRomCurve3(pts.map(Va)), l0 = Va(o.lado || [1, 0, 0]);
    const larg = t => { const x = t * (anchos.length - 1), i = Math.min(anchos.length - 2, Math.floor(x)); return anchos[i] + (anchos[i + 1] - anchos[i]) * (x - i); };
    const pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, P = curva.getPointAt(t), T = curva.getTangentAt(t);
      const s = l0.clone().addScaledVector(T, -l0.dot(T)); if (s.lengthSq() < 1e-6) s.set(0, 0, 1); s.normalize();
      const n = T.clone().cross(s).normalize();
      let w = larg(t) / 2; if (o.serra && i > 0 && i < seg) w *= 1 + (i % 2 ? 0.35 : -0.3) * o.serra;
      const ax = o.assim ? (i % 2 ? 1 : -0.4) * o.assim * w : 0;     // lado direito mais curto/longo: bordas rasgadas
      pos.push(P.x - s.x * w, P.y - s.y * w, P.z - s.z * w, P.x + s.x * (w + ax), P.y + s.y * (w + ax), P.z + s.z * (w + ax));
      nor.push(n.x, n.y, n.z, n.x, n.y, n.z); uv.push(0, t * 3, 1, t * 3);
      if (i < seg) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  /** contorno de miniatura para peças próprias (mesma ideia do núcleo) */
  function contornoDe(geo, esp = 0.02) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox, c = bb.getCenter(V(0, 0, 0)), s = bb.getSize(V(0, 0, 0));
    const k = e => Math.min(1.6, 1 + esp / Math.max(0.0001, e / 2));
    const g = geo.clone(); g.translate(-c.x, -c.y, -c.z); g.scale(k(s.x), k(s.y), k(s.z)); g.translate(c.x, c.y, c.z);
    return g;
  }

  /** caixa de ferramentas local (precisa do B do modelo) */
  function ferr(B) {
    const F = {};
    /** põe uma malha própria em `pai`. o: rx,ry,rz, sx,sy,sz, linha(true = contorno), + opções de material */
    F.malha = (pai, geo, cor, x = 0, y = 0, z = 0, o = {}) => {
      const m = new THREE.Mesh(geo, B.mat(cor, o));
      m.position.set(x, y, z);
      if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
      if (o.sx || o.sy || o.sz) m.scale.set(o.sx || 1, o.sy || 1, o.sz || 1);
      if (o.linha) { const l = new THREE.Mesh(contornoDe(geo, o.linha === true ? 0.02 : o.linha), B.linhaMat); l.userData.contorno = true; m.add(l); }
      pai.add(m);
      return m;
    };
    /** espalha n pontos na superfície de um elipsóide (c = centro, r = raios) e devolve itens para espiGeo.
     *  o: filtro(x,y,z) na esfera unitária, bias [x,y,z] (direção de "penteado"), bw (peso), l:[min,max], rad:[min,max], curva (quanto o bico dobra), dentro (quanto afunda) */
    F.espalhar = (n, seed, o) => {
      const rnd = sem(seed), out = [], c = o.c || [0, 0, 0], [rx, ry, rz] = o.r, bias = o.bias || [0, 0, 0], bw = o.bw ?? 0.8;
      const [l0, l1] = o.l || [0.06, 0.12], [r0, r1] = o.rad || [0.02, 0.035];
      let tent = 0;
      while (out.length < n && tent++ < n * 60) {
        const x = rnd() * 2 - 1, y = rnd() * 2 - 1, z = rnd() * 2 - 1, m = Math.hypot(x, y, z);
        if (m > 1 || m < 0.05) continue;
        const ux = x / m, uy = y / m, uz = z / m;
        if (o.filtro && !o.filtro(ux, uy, uz, rnd)) continue;
        let nx = ux / rx, ny = uy / ry, nz = uz / rz; const nm = Math.hypot(nx, ny, nz); nx /= nm; ny /= nm; nz /= nm;
        const dx = nx + bias[0] * bw + (rnd() - 0.5) * 0.35, dy = ny + bias[1] * bw + (rnd() - 0.5) * 0.35, dz = nz + bias[2] * bw + (rnd() - 0.5) * 0.35;
        const dm = Math.hypot(dx, dy, dz), k = 1 - (o.dentro ?? 0.07), l = lerp(l0, l1, rnd());
        const cv = (o.curva ?? 0.3) * l;
        out.push({ p: [c[0] + ux * rx * k, c[1] + uy * ry * k, c[2] + uz * rz * k], d: [dx / dm, dy / dm, dz / dm], l, r: lerp(r0, r1, rnd()),
          b: [bias[0] * cv, bias[1] * cv, bias[2] * cv], tw: rnd() * 3 });
      }
      return out;
    };
    /** tufos/espinhos prontos como malha. perfil e lados: veja espiGeo */
    F.espinhos = (pai, itens, cor, o = {}) => F.malha(pai, espiGeo(itens, o.lados || 4, o.perfil || [[0, 1], [0.5, 0.6]]), cor, 0, 0, 0, o);
    F.cristais = (pai, itens, cor, o = {}) => F.malha(pai, espiGeo(itens, 6, [[0, 1], [0.6, 0.92]]), cor, 0, 0, 0, { rough: 0.18, metal: 0.15, emissive: 0x2a78d0, brilho: 0.5, ...o });
    /** fita de pano/cabelo/pena (dupla face) */
    F.tira = (pai, pts, anchos, cor, o = {}) => F.malha(pai, tiraGeo(pts, anchos, o.seg || 6, o), cor, 0, 0, 0, { dupla: true, ...o });
    /** anel fino (argola, bandagem, aro) — eixo vertical por padrão */
    F.anel = (pai, R, r, cor, x = 0, y = 0, z = 0, o = {}) => F.malha(pai, new THREE.TorusGeometry(R, r, o.rad || 4, o.seg || 10), cor, x, y, z, { rx: PI / 2, ...o });
    /** fio fino (veia, rachadura, cicatriz, osso fino): tubo sem contorno */
    F.fio = (pai, pts, r, cor, o = {}) => B.tubo(pai, pts, Array.isArray(r) ? r : pts.map(() => r), cor, { linha: false, rad: 4, seg: Math.max(3, pts.length * 3), pontas: false, ...o });
    /** polígono extrudado (lâmina de machado, escudo, placa de ombro). pts = [[x,y],...] */
    F.extruir = (pai, pts, prof, cor, x = 0, y = 0, z = 0, o = {}) => {
      const sh = new THREE.Shape(); pts.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
      if (o.furo) { const h = new THREE.Path(); const [hx, hy, hr] = o.furo; for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; i ? h.lineTo(hx + Math.cos(a) * hr, hy + Math.sin(a) * hr) : h.moveTo(hx + hr, hy); } sh.holes.push(h); }
      const g = new THREE.ExtrudeGeometry(sh, { depth: prof, bevelEnabled: true, bevelThickness: o.bisel ?? prof * 0.3, bevelSize: o.bisel ?? prof * 0.3, bevelSegments: 1, curveSegments: 4 });
      g.translate(0, 0, -prof / 2);
      return F.malha(pai, g, cor, x, y, z, o);
    };
    /** corrente: n elos ao longo de uma curva */
    F.corrente = (pai, pts, n, R, r, cor, o = {}) => {
      const curva = new THREE.CatmullRomCurve3(pts.map(Va)), g = B.grupo(pai, 0, 0, 0), geo = new THREE.TorusGeometry(R, r, 4, 8);
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1), P = curva.getPointAt(t), T = curva.getTangentAt(t).normalize();
        const a = (Math.abs(T.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)), s = a.clone().cross(T).normalize(), w = T.clone().cross(s).normalize();
        const m = F.malha(g, geo, cor, P.x, P.y, P.z, { metal: 0.6, rough: 0.45, ...o });
        const [b1, b2] = i % 2 ? [s, w] : [w, s];
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(T, b1, b2));
        m.scale.set(1.35, 1, 1);
      }
      return g;
    };
    /** osso/ossinho com juntas nas pontas */
    F.osso = (pai, a, b, r, cor, o = {}) => {
      const g = B.grupo(pai, 0, 0, 0);
      B.tubo(g, [a, [(a[0] + b[0]) / 2 + (o.cx || 0), (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 + (o.cz || 0)], b], [r, r * 0.7, r], cor, { tex: 'osso', linha: false, rad: 5, seg: 4, pontas: false });
      B.esf(g, r * 1.3, cor, a[0], a[1], a[2], { tex: 'osso', linha: false, seg: 6 }); B.esf(g, r * 1.3, cor, b[0], b[1], b[2], { tex: 'osso', linha: false, seg: 6 });
      return g;
    };
    /** olho brilhante dentro de uma órbita escura */
    F.olhoFundo = (pai, r, cor, x, y, z, o = {}) => {
      B.esf(pai, r * 1.55, o.orbita ?? 0x0a0c14, x, y, z - r * 0.15, { linha: false, seg: 8, sy: o.sy || 1 });
      return B.olho(pai, r, cor, x, y, z + r * 0.35, { pupila: false, fenda: o.fenda, brilho: o.brilho ?? 1.4 });
    };
    return F;
  }
  /** gira uma lista de pontos [x,y,z] em torno de Y/X (para montar peças simétricas) */
  const espelha = pts => pts.map(p => [-p[0], p[1], p[2]]);
  /** versão "econômica" do B: blob e tubo com menos segmentos por padrão (orçamento mobile) */
  const econ = (B0, sg = 12) => {
    const B = Object.assign({}, B0);
    B.blob = (p, r, c, x, y, z, o = {}) => B0.blob(p, r, c, x, y, z, { seg: sg, ...o });
    B.tubo = (p, pts, rad, c, o = {}) => {   // pontas em esferas leves (as originais são muito pesadas)
      const g = B0.tubo(p, pts, rad, c, { seg: Math.max(6, pts.length * 3), rad: 6, ...o, pontas: false });
      if (o.pontas !== false) {
        const a = pts[0], z = pts[pts.length - 1], mo = { linha: false, seg: 7, tex: o.tex, rep: o.rep, rough: o.rough, metal: o.metal, relevo: o.relevo };
        if (rad[0] > 0.012) B0.esf(g, rad[0], c, a[0], a[1], a[2], mo);
        if (rad[rad.length - 1] > 0.012) B0.esf(g, rad[rad.length - 1], c, z[0], z[1], z[2], mo);
      }
      return g;
    };
    return B;
  };
  /** corpo de lobo compartilhado (lobo de gelo e Fenrir). c: { cor, esc, tufos, cabeca, espinha(ctx), mand:{aberta,fechada}, vapor } */
  function construirLobo(B0, R, c) {
    const B = econ(B0), F = ferr(B), rnd = sem(c.seed || 23);
    const { BASE, MEIO, CLARO, ESCURO, NARIZ, OSSO, GELO, OLHO } = c.cor;
    const G = B.grupo(R, 0, 0, 0); G.scale.setScalar(c.esc || 1);
    const mf = { tex: 'pelo', rep: 2, rough: 0.95 };
    const pelo = (pai, n, seed, c0, r, o, cor = CLARO) => {   // tufos largos, "penteados" ao longo do corpo
      const it = F.espalhar(Math.round(n * 1.4 * (c.tufos || 1)), seed, { c: c0, r, bw: c.bw || 2.4, ...o, l: [o.l[0] * 0.95, o.l[1] * 0.95], rad: [o.rad[0] * 1.7, o.rad[1] * 1.7] });
      return F.espinhos(pai, it, cor, { rough: 0.9, lados: 3, perfil: [[0, 1], [0.4, 0.85], [0.75, 0.45]] });
    };
      /* --- corpo: peito largo, cintura fina, quadris fortes --- */
      const tronco = B.grupo(G, 0, 0, 0);
      B.blob(tronco, 0.3, BASE, 0, 0.64, 0.26, { tex: 'pele', rep: 1, sx: 0.88, sy: 1.0, sz: 1.2, amp: 0.1, seed: 2 });      // peito
      B.blob(tronco, 0.24, BASE, 0, 0.58, -0.1, { ...mf, sx: 0.82, sy: 0.95, sz: 1.3, amp: 0.1, seed: 5 });     // barriga
      B.blob(tronco, 0.27, BASE, 0, 0.62, -0.4, { ...mf, sx: 0.92, sy: 0.98, sz: 1.05, amp: 0.1, seed: 8 });    // quadris
      B.blob(tronco, 0.2, ESCURO, 0, 0.82, 0.3, { ...mf, sx: 1.0, sy: 0.65, sz: 1.2, amp: 0.15, seed: 11 });    // cernelha (corcova)
      B.blob(tronco, 0.18, MEIO, 0, 0.5, 0.52, { ...mf, sx: 0.9, sy: 1.1, sz: 0.8, amp: 0.2, seed: 14 });       // peitoral peludo
      // tufos de pelagem por camadas (claros por cima, escuros no fundo)
      const costas = (x, y, z) => y > -0.3;
      pelo(tronco, 44, 31, [0, 0.64, 0.26], [0.3, 0.33, 0.37], { filtro: costas, bias: [0, -0.2, -1], l: [0.1, 0.2], rad: [0.035, 0.055], curva: 0.7 }, MEIO);
      pelo(tronco, 44, 32, [0, 0.6, -0.1], [0.23, 0.26, 0.4], { filtro: costas, bias: [0, -0.3, -1], l: [0.1, 0.19], rad: [0.035, 0.05], curva: 0.7 }, CLARO);
      pelo(tronco, 40, 33, [0, 0.62, -0.4], [0.27, 0.28, 0.3], { filtro: costas, bias: [0, -0.5, -1], l: [0.1, 0.2], rad: [0.035, 0.055], curva: 0.8 }, MEIO);
      pelo(tronco, 26, 34, [0, 0.5, 0.5], [0.17, 0.2, 0.17], { filtro: (x, y, z) => z > -0.2, bias: [0, -1, -0.2], bw: 1, l: [0.12, 0.24], rad: [0.03, 0.05], curva: 0.3 }, CLARO);   // juba do peito
      pelo(tronco, 24, 35, [0, 0.82, 0.32], [0.2, 0.14, 0.24], { filtro: (x, y) => y > 0.2, bias: [0, 0.3, -1], l: [0.12, 0.22], rad: [0.03, 0.045], curva: 0.9 }, ESCURO);  // crina escura
      c.espinha({ F, B, tronco, rnd, cor: c.cor });
      // cicatrizes e veias congeladas
      F.fio(tronco, [[0.28, 0.75, 0.15], [0.3, 0.62, 0.1], [0.28, 0.5, 0.05]], 0.007, 0xd8e6f2);
      F.fio(tronco, [[-0.27, 0.6, -0.3], [-0.3, 0.52, -0.38], [-0.27, 0.42, -0.42]], 0.007, 0x2a3b52);
      F.fio(tronco, [[0.2, 0.4, 0.35], [0.26, 0.55, 0.28], [0.22, 0.7, 0.25]], 0.005, GELO, { emissive: GELO, brilho: 0.6 });

      /* --- pernas (pivôs: ombros e quadris) --- */
      const perna = (x, z, tras) => {
        const p = B.grupo(G, x, 0.62, z);
        const l = x > 0 ? 1 : -1;
        if (!tras) {
          B.tubo(p, [[0, 0, 0], [0, -0.17, 0.02], [0, -0.36, -0.01], [0, -0.52, 0.04]], [0.12, 0.085, 0.055, 0.045], BASE, { tex: 'pele' });
          B.blob(p, 0.08, MEIO, 0, -0.02, 0.02, { ...mf, amp: 0.2, seg: 10, linha: false });
          B.blob(p, 0.065, CLARO, 0, -0.58, 0.1, { ...mf, sx: 0.95, sy: 0.65, sz: 1.5, amp: 0.1, seg: 10 });     // pata
          pelo(p, 9, 41 + l, [0, -0.22, 0.0], [0.09, 0.2, 0.09], { bias: [0, -1, -0.3], l: [0.06, 0.12], rad: [0.025, 0.04] }, CLARO);
        } else {
          B.blob(p, 0.17, BASE, 0, -0.05, -0.02, { ...mf, sx: 0.85, sy: 1.25, sz: 1.0, amp: 0.1, seg: 12 });       // coxa grande
          B.tubo(p, [[0, -0.12, 0.0], [0, -0.28, 0.12], [0, -0.4, 0.0], [0, -0.56, 0.03]], [0.1, 0.07, 0.05, 0.042], BASE, { tex: 'pele' });
          B.blob(p, 0.065, CLARO, 0, -0.6, 0.1, { ...mf, sx: 0.95, sy: 0.65, sz: 1.5, amp: 0.1, seg: 10 });
          pelo(p, 14, 51 + l, [0, -0.1, -0.02], [0.17, 0.24, 0.16], { bias: [0, -0.8, -0.8], l: [0.07, 0.14], rad: [0.03, 0.045] }, MEIO);
        }
        const py = tras ? -0.62 : -0.6;
        for (let i = -1; i <= 1; i++) {   // garras de gelo
          F.espinhos(p, [{ p: [i * 0.032, py, 0.19], d: [i * 0.1, -0.3, 1], l: 0.085 * (c.garraL || 1), r: 0.018 * (c.garraL || 1), b: [0, -0.02, 0.02] }], c.garra || 0xd6e8f4, { lados: 4, rough: 0.3 });
        }
        F.cristais(p, [{ p: [l * 0.05, tras ? -0.3 : -0.2, 0], d: [l * 1, 0.2, -0.3], l: 0.1, r: 0.02 }], GELO);
        return p;
      };
      const pernas = [perna(-0.17, 0.32, false), perna(0.17, 0.32, false), perna(-0.19, -0.42, true), perna(0.19, -0.42, true)];

      /* --- pescoço e cabeça (baixa, rosnando) --- */
      B.tubo(tronco, [[0, 0.72, 0.38], [0, 0.82, 0.6], [0, 0.82, 0.76]], [0.2, 0.17, 0.15], BASE, { tex: 'pele' });
      pelo(tronco, 30, 61, [0, 0.8, 0.58], [0.19, 0.2, 0.24], { filtro: (x, y, z) => z > -0.6, bias: [0, -0.4, -1], l: [0.1, 0.2], rad: [0.03, 0.05], curva: 0.7 }, CLARO);
      const cabeca = B.grupo(tronco, 0, 0.82, 0.8); cabeca.rotation.x = 0.1; cabeca.scale.setScalar(1.3 * (c.cabeca || 1));
      B.blob(cabeca, 0.16, MEIO, 0, 0, 0.0, { ...mf, sx: 0.92, sy: 0.95, sz: 1.1, amp: 0.06, seed: 3 });
      B.tubo(cabeca, [[0, 0.0, 0.08], [0, -0.03, 0.22], [0, -0.05, 0.36]], [0.11, 0.085, 0.065], MEIO, { tex: 'pele' });             // focinho
      B.blob(cabeca, 0.06, NARIZ, 0, -0.025, 0.4, { sx: 1.1, sy: 0.8, seg: 8, linha: false });                         // nariz
            [-1, 1].forEach(l => {
        // olho com testa baixa (ar de fúria)
        B.blob(cabeca, 0.04, ESCURO, l * 0.08, 0.085, 0.12, { sx: 1.6, sy: 0.5, sz: 1.2, rz: -l * 0.45, seg: 8, linha: false });
        B.olho(cabeca, 0.028, OLHO, l * 0.082, 0.045, 0.165, { pupila: false, brilho: c.olhoBr || 1.3 });
        B.cone(cabeca, 0.075, 0.26, MEIO, l * 0.1, 0.2, -0.07, { ...mf, rz: -l * 0.18, rx: -0.25, seg: 5, sz: 0.45 });             // orelha
        B.cone(cabeca, 0.04, 0.17, c.cor.ORELHA || 0x2a3850, l * 0.1, 0.18, -0.045, { rz: -l * 0.18, rx: -0.25, seg: 4, sz: 0.4, linha: false });
        B.dentes(cabeca, 1, 0, 0.04, OSSO, l * 0.062, -0.095, 0.33, { presas: true });                                   // presa grande
        pelo(cabeca, 6, 71 + l, [l * 0.12, -0.02, -0.02], [0.07, 0.1, 0.1], { filtro: (x) => x * l > 0.1, bias: [l, -0.3, -0.7], l: [0.08, 0.15], rad: [0.02, 0.035] }, CLARO);   // costeletas
        F.fio(cabeca, [[l * 0.1, 0.1, 0.04], [l * 0.115, 0.04, 0.09], [l * 0.1, -0.01, 0.12]], 0.004, 0x233349);          // cicatriz no rosto
      });
      B.dentes(cabeca, 6, 0.1, 0.03, OSSO, 0, -0.1, 0.33, {});
      if (c.cristais !== false) F.espinhos(cabeca, [{ p: [0.0, 0.11, -0.03], d: [0, 1, -0.4], l: 0.11, r: 0.03 }, { p: [0.0, 0.05, -0.1], d: [0, 0.6, -1], l: 0.12, r: 0.032 }], GELO, { rough: 0.2 });
      if (c.cristais !== false) F.cristais(cabeca, [{ p: [0.0, 0.1, 0.0], d: [0, 1, 0.3], l: 0.14, r: 0.026 }, { p: [0.05, 0.1, -0.03], d: [0.5, 1, -0.2], l: 0.1, r: 0.02 }], 0xdff4ff);
      // mandíbula móvel
      const mandib = B.grupo(cabeca, 0, -0.07, 0.04);
      B.tubo(mandib, [[0, -0.01, 0.06], [0, -0.03, 0.2], [0, -0.035, 0.33]], [0.08, 0.06, 0.045], CLARO, { tex: 'pele' });
      B.dentes(mandib, 6, 0.09, 0.03, OSSO, 0, 0.0, 0.3, { rx: 0 });
      [-1, 1].forEach(l => B.dentes(mandib, 1, 0, 0.034, OSSO, l * 0.04, 0.0, 0.3, { presas: true, rx: 0 }));
      B.blob(mandib, 0.04, 0xc0586a, 0, -0.01, 0.16, { sx: 1.3, sy: 0.4, sz: 2.2, seg: 8, linha: false });             // língua
      mandib.rotation.x = (c.mand || { fechada: 0.5 }).fechada;
      F.espinhos(mandib, F.espalhar(8, 81, { c: [0, -0.04, 0.12], r: [0.07, 0.05, 0.12], filtro: (x, y) => y < 0.1, bias: [0, -1, 0], l: [0.05, 0.1], rad: [0.02, 0.03] }), CLARO, {});

      /* --- cauda cheia, balança --- */
      const cauda = B.grupo(G, 0, 0.7, -0.62);
      B.tubo(cauda, [[0, 0, 0], [0, 0.08, -0.2], [0, 0.02, -0.4], [0, -0.1, -0.55]], [0.06, 0.1, 0.105, 0.04], BASE, { tex: 'pele' });
      pelo(cauda, 28, 91, [0, 0.0, -0.3], [0.1, 0.12, 0.28], { bias: [0, -0.3, -1], l: [0.1, 0.22], rad: [0.03, 0.05], curva: 0.8 }, CLARO);
      if (c.cristais !== false) F.cristais(cauda, [{ p: [0, 0.1, -0.15], d: [0, 1, -0.5], l: 0.15, r: 0.025 }, { p: [0, 0.07, -0.35], d: [0.2, 1, -0.6], l: 0.12, r: 0.022 }], GELO);

      /* --- vapor gelado saindo do focinho --- */
      const vapor = [0, 1, 2].map(i => B.vivo(B.esf(cabeca, 0.04, c.vapor || 0xdff0ff, 0, -0.04, 0.5, { op: 0.3, linha: false, seg: 8, emissive: c.vaporEm || 0x6aa8e0, brilho: 0.2 })));
      return { B, F, G, tronco, cabeca, mandib, pernas, cauda, vapor, rnd, pelo, c };
  }
Modelos3D.registrar({
    /* ===== DRAUGR: morto-vivo viking, curvado, machado enorme ===== */
    draugr(B0, R) {
      const B = econ(B0, 10), F = ferr(B), rnd = sem(7);
      const PELE = 0x7f98a8, PELE_E = 0x536878, PELE_C = 0xaabfcb, FERRO = 0x56505a, FERRO_E = 0x2e2d34, FERRUGEM = 0x8f5532;
      const GELO = 0xe4f3ff, GELO_A = 0x9fd2ee, PANO = 0x2a3340, PANO_C = 0x435368, OSSO = 0xd8d0b8, COURO = 0x3a2d26, MADEIRA = 0x4d3a2a, BRILHO = 0x6fe0ff;
      const mp = { tex: 'pele', rep: 2 }, mm = { tex: 'escamas', metal: 0.55, rough: 0.55, rep: 5 }, ml = { tex: 'couro', rep: 2 };

      /* --- pernas (pivô no quadril) --- */
      const pernas = [-1, 1].map(l => {
        const p = B.grupo(R, l * 0.15, 0.82, 0);
        B.tubo(p, [[0, 0, 0], [0, -0.2, 0.05], [0, -0.4, 0.12]], [0.105, 0.085, 0.07], PANO, { tex: 'tecido', rep: 2 });
        B.tubo(p, [[0, -0.4, 0.12], [0, -0.58, 0.075], [0, -0.77, 0.03]], [0.07, 0.058, 0.045], PELE_E, mp);
        B.esf(p, 0.075, OSSO, 0, -0.4, 0.16, { tex: 'osso', seg: 8, sy: 0.9 });                       // joelho ósseo
        B.tubo(p, [[0, -0.5, 0.1], [0, -0.78, 0.04]], [0.085, 0.07], COURO, { ...ml, seg: 6 });         // bota
        F.espinhos(p, F.espalhar(14, 11 + l, { c: [0, -0.5, 0.1], r: [0.09, 0.05, 0.09], filtro: (x, y) => y > -0.3, bias: [0, 0.6, 0], l: [0.04, 0.08], rad: [0.018, 0.03], curva: 0.5 }), 0xaab4bb, { tex: 'pelo', rough: 1 });
        B.blob(p, 0.1, COURO, 0, -0.79, 0.12, { ...ml, sx: 0.85, sy: 0.5, sz: 1.7, amp: 0.08, seg: 12 });  // pé
        B.cone(p, 0.05, 0.1, FERRO_E, 0, -0.8, 0.27, { rx: PI / 2, seg: 5, ...mm, linha: false });         // biqueira
        for (let i = 0; i < 3; i++) F.anel(p, 0.088 - i * 0.008, 0.012, 0x5a6678, 0, -0.1 - i * 0.07, 0.025 + i * 0.01, { tex: 'tecido', rx: PI / 2 + 0.2 * l });
        // retalhos pendurados
        F.tira(p, [[0.05 * l, 0.0, 0.1], [0.09 * l, -0.2, 0.13], [0.08 * l, -0.38, 0.14]], [0.07, 0.06, 0], PANO_C, { tex: 'tecido', lado: [1, 0, 0], serra: 0.5 });
        return p;
      });
      // pélvis e cinto
      B.blob(R, 0.2, PANO, 0, 0.82, 0, { tex: 'tecido', sx: 1.15, sy: 0.7, sz: 0.9, amp: 0.1 });
      F.tira(R, [[0, 0.85, 0.2], [0, 0.6, 0.25], [0.02, 0.38, 0.22]], [0.2, 0.2, 0.02], 0x3f2f2a, { tex: 'couro', lado: [1, 0, 0], serra: 0.6 });
      F.tira(R, [[0, 0.85, -0.2], [0, 0.55, -0.26], [0, 0.35, -0.24]], [0.2, 0.2, 0.0], PANO_C, { tex: 'tecido', lado: [1, 0, 0], serra: 0.8 });

      /* --- tronco curvado --- */
      const tronco = B.grupo(R, 0, 0.82, 0); tronco.rotation.x = 0.42;
      B.blob(tronco, 0.17, PELE_E, 0, 0.13, 0.02, { ...mp, sy: 1.35, sz: 0.85, amp: 0.1, seed: 4 });             // barriga oca
      B.blob(tronco, 0.25, PELE, 0, 0.42, 0.02, { ...mp, sx: 1.15, sy: 1.05, sz: 0.9, amp: 0.07, seed: 2 });     // peito
      // cota de malha rasgada
      B.torno(tronco, [[0.2, 0.0], [0.235, 0.1], [0.28, 0.3], [0.32, 0.46], [0.3, 0.58], [0.18, 0.66]], FERRO, 0, 0, 0.02, { ...mm, sx: 1.1, sz: 0.88, seg: 18 });
      for (let i = 0; i < 9; i++) {   // barra esfarrapada da cota
        const a = i / 9 * PI * 2 + 0.3, x = Math.sin(a) * 0.23, z = Math.cos(a) * 0.19 + 0.02;
        F.tira(tronco, [[x, 0.04, z], [x * 1.08, -0.07, z * 1.08], [x * 1.1, -0.15 - rnd() * 0.1, z * 1.1]], [0.07, 0.065, 0], i % 2 ? FERRO : FERRO_E, { ...mm, lado: [Math.cos(a), 0, -Math.sin(a)], serra: 0.5 });
      }
      // buracos na cota: carne e costelas aparecendo
      [[-0.2, 0.34, 0.2, 0.09], [0.12, 0.5, 0.2, 0.07], [0.24, 0.26, 0.04, 0.08]].forEach(([x, y, z, r], i) => {
        B.blob(tronco, r, PELE_E, x, y, z, { ...mp, sx: 1.2, sy: 1.4, sz: 0.5, amp: 0.15, seed: 9 + i, seg: 10 });
        for (let k = -1; k <= 1; k++) F.fio(tronco, [[x - r * 0.9, y + k * r * 0.6, z + r * 0.35], [x, y + k * r * 0.6 - 0.01, z + r * 0.55], [x + r * 0.9, y + k * r * 0.6 + 0.02, z + r * 0.4]], 0.011, OSSO, { tex: 'osso' });
      });
      // coluna, corcunda e flecha cravada
      B.blob(tronco, 0.2, PELE_E, 0, 0.55, -0.15, { ...mp, sx: 1.2, sy: 0.9, sz: 0.9, amp: 0.15, seed: 6 });
      for (let i = 0; i < 8; i++) B.esf(tronco, 0.026 - i * 0.001, OSSO, 0, 0.72 - i * 0.075, -0.3 + i * 0.012, { tex: 'osso', seg: 6, linha: false, sy: 1.2 });
      F.fio(tronco, [[0.1, 0.62, -0.28], [0.17, 0.8, -0.4], [0.22, 0.95, -0.5]], 0.012, MADEIRA, { tex: 'couro' });
      [0, 1, 2].forEach(i => F.tira(tronco, [[0.22, 0.95 - i * 0.03, -0.5 - i * 0.012], [0.235, 1.0 - i * 0.03, -0.53], [0.25, 1.04 - i * 0.03, -0.54]], [0.035, 0.03, 0], i === 1 ? GELO : 0x9aa8b4, { lado: [0.2, 0, 1], serra: 0.3 }));
      // pelego de ombro e cristais de gelo nas costas
      [-1, 1].forEach(l => {
        B.blob(tronco, 0.15, 0x8a97a2, l * 0.28, 0.58, -0.02, { tex: 'pelo', rep: 2, sx: 1.25, sy: 0.65, sz: 1.15, amp: 0.2, seed: 12 + l });
        F.espinhos(tronco, F.espalhar(22, 21 + l, { c: [l * 0.28, 0.6, -0.02], r: [0.19, 0.09, 0.17], filtro: (x, y) => y > -0.1, bias: [l * 0.4, -0.5, -0.3], l: [0.07, 0.16], rad: [0.025, 0.04], curva: 0.6 }), 0xc5d3dd, { tex: 'pelo', rough: 1 });
      });
      F.cristais(tronco, F.espalhar(9, 33, { c: [0.0, 0.62, -0.2], r: [0.2, 0.18, 0.13], filtro: (x, y, z) => z < -0.1 && y > -0.2, bias: [0, 0.5, -0.2], l: [0.08, 0.2], rad: [0.018, 0.035], curva: 0.1, dentro: 0.15 }), GELO_A);
      // ombreira de ferro com espinho (só no lado do machado)
      B.blob(tronco, 0.14, FERRO, 0.32, 0.6, 0.0, { ...mm, sx: 1.1, sy: 0.55, sz: 1.2, amp: 0.1, seed: 5 });
      B.cone(tronco, 0.04, 0.15, FERRO_E, 0.36, 0.7, -0.01, { rz: -0.4, seg: 5, ...mm });
      for (let i = 0; i < 5; i++) B.esf(tronco, 0.01, FERRUGEM, 0.32 + Math.cos(i) * 0.1, 0.67, Math.sin(i) * 0.1, { seg: 4, linha: false });
      // corrente cruzando o peito
      F.corrente(tronco, [[-0.27, 0.64, 0.06], [-0.1, 0.4, 0.24], [0.1, 0.22, 0.24], [0.28, 0.1, 0.12]], 14, 0.022, 0.006, FERRO_E);
      F.corrente(tronco, [[0.1, 0.05, 0.2], [0.14, -0.1, 0.22], [0.12, -0.24, 0.2]], 5, 0.02, 0.005, FERRO_E);
      // cinto
      B.tubo(tronco, [[-0.2, 0.01, 0.1], [0, 0.02, 0.2], [0.2, 0.01, 0.1]], [0.03, 0.03, 0.03], COURO, { ...ml, seg: 6, pontas: false });
      B.cx(tronco, 0.07, 0.06, 0.02, FERRUGEM, 0, 0.02, 0.215, { ...mm, linha: false });

      /* --- cabeça (focinho para a frente, elmo de chifres quebrado) --- */
      const cabeca = B.grupo(tronco, 0, 0.64, 0.05); cabeca.rotation.x = -0.4;
      B.tubo(cabeca, [[0, -0.1, -0.05], [0, 0.0, 0.0], [0, 0.07, 0.04]], [0.065, 0.055, 0.05], PELE_E, mp);
      B.blob(cabeca, 0.125, PELE, 0, 0.16, 0.06, { ...mp, sy: 1.08, sz: 1.05, amp: 0.05, seed: 3 });
      B.blob(cabeca, 0.085, PELE, 0, 0.055, 0.1, { ...mp, sx: 0.95, sy: 0.7, sz: 1.05, amp: 0.06, seed: 8 });   // maxilar
      [-1, 1].forEach(l => {
        B.blob(cabeca, 0.034, PELE_C, l * 0.062, 0.2, 0.15, { ...mp, sx: 1.7, sy: 0.6, amp: 0.1, linha: false, seg: 8 }); // sobrancelha
        B.blob(cabeca, 0.03, PELE_C, l * 0.075, 0.11, 0.14, { ...mp, linha: false, seg: 8 });                            // maçã do rosto
        F.olhoFundo(cabeca, 0.024, BRILHO, l * 0.05, 0.155, 0.17, { brilho: 2 });
      });
      B.cone(cabeca, 0.022, 0.05, 0x0a0c14, 0, 0.095, 0.185, { rx: PI / 2, seg: 4, linha: false });                      // nariz comido
      B.esf(cabeca, 0.045, 0x0a0c14, 0, 0.045, 0.15, { sx: 1.5, sy: 0.55, sz: 0.7, linha: false, seg: 8 });             // boca
      B.dentes(cabeca, 8, 0.095, 0.022, OSSO, 0, 0.065, 0.168, { presas: true });
      B.dentes(cabeca, 7, 0.08, 0.018, 0xb8b090, 0, 0.022, 0.163, { rx: 0 });
      F.fio(cabeca, [[-0.04, 0.2, 0.17], [-0.02, 0.17, 0.18], [-0.05, 0.125, 0.19]], 0.004, 0x1c2630);            // rachaduras / cicatrizes
      F.fio(cabeca, [[0.08, 0.14, 0.12], [0.1, 0.09, 0.14], [0.085, 0.05, 0.14]], 0.004, 0x1c2630);
      F.fio(cabeca, [[0.02, 0.27, 0.1], [0.05, 0.24, 0.13], [0.04, 0.21, 0.15]], 0.005, BRILHO, { emissive: BRILHO, brilho: 0.8 });
      // elmo
      B.torno(cabeca, [[0.148, 0.0], [0.155, 0.04], [0.145, 0.1], [0.115, 0.17], [0.06, 0.22], [0.0, 0.248]], FERRO, 0, 0.175, 0.045, { ...mm, sz: 1.05, seg: 14 });
      F.anel(cabeca, 0.157, 0.017, FERRO_E, 0, 0.185, 0.045, { ...mm, sz: 1.05, rad: 5, seg: 14, linha: false });
      [0, PI / 2].forEach(ry => F.malha(cabeca, new THREE.TorusGeometry(0.15, 0.011, 4, 12, PI), FERRO_E, 0, 0.18, 0.045, { ry, sy: 1.5, ...mm }));
      B.cx(cabeca, 0.028, 0.1, 0.012, FERRO_E, 0, 0.14, 0.2, { ...mm, linha: false });                                // nasal
      B.cx(cabeca, 0.02, 0.04, 0.012, FERRUGEM, 0.012, 0.075, 0.2, { rz: 0.5, ...mm, linha: false });
      for (let i = 0; i < 7; i++) B.esf(cabeca, 0.008, FERRUGEM, Math.sin(i / 7 * PI * 2) * 0.157, 0.185, 0.045 + Math.cos(i / 7 * PI * 2) * 0.16, { seg: 4, linha: false });
      // chifre esquerdo inteiro, direito quebrado
      B.chifre(cabeca, 0.36, 0.034, OSSO, -0.15, 0.24, 0.04, { curva: -0.5, rz: 1.0, tex: 'osso', seg: 10, rad: 6 });
      B.cil(cabeca, 0.045, 0.04, 0.04, FERRO_E, -0.15, 0.24, 0.04, { rz: 1.0, seg: 8, ...mm, linha: false });
      B.cil(cabeca, 0.04, 0.045, 0.1, OSSO, 0.15, 0.25, 0.04, { rz: -1.0, seg: 7, tex: 'osso' });
      F.espinhos(cabeca, [{ p: [0.2, 0.3, 0.04], d: [0.5, 0.8, 0.2], l: 0.07, r: 0.03 }, { p: [0.19, 0.29, 0.06], d: [0.7, 0.5, -0.3], l: 0.05, r: 0.022 }, { p: [0.2, 0.3, 0.02], d: [0.3, 0.9, 0.3], l: 0.09, r: 0.018 }], OSSO, { tex: 'osso', lados: 4 });
      B.cil(cabeca, 0.048, 0.044, 0.04, FERRO_E, 0.15, 0.245, 0.04, { rz: -1.0, seg: 8, ...mm, linha: false });
      // cabelo e barba congelados
      [[-0.14, 0.12, 0.0], [-0.12, 0.12, -0.08], [-0.06, 0.14, -0.14], [0.0, 0.14, -0.16], [0.06, 0.14, -0.14], [0.12, 0.12, -0.08], [0.14, 0.12, 0.0], [-0.1, 0.12, -0.12], [0.09, 0.12, -0.12]].forEach(([x, y, z], i) =>
        F.tira(cabeca, [[x, y, z], [x * 1.15, y - 0.12, z - 0.04 - rnd() * 0.03], [x * 1.25 + (rnd() - 0.5) * 0.04, y - 0.26 - rnd() * 0.1, z - 0.04 + (rnd() - 0.5) * 0.04]], [0.045, 0.04, 0], i % 3 ? 0xa9bccb : GELO, { lado: [Math.cos(i), 0, Math.sin(i)], seg: 4 }));
      F.espinhos(cabeca, F.espalhar(26, 5, { c: [0, 0.03, 0.1], r: [0.09, 0.08, 0.085], filtro: (x, y, z) => y < 0.2 && z > -0.25, bias: [0, -1, 0.15], bw: 1.1, l: [0.05, 0.16], rad: [0.014, 0.026], curva: 0.1 }), GELO, { rough: 0.5 });
      [-0.04, 0, 0.045].forEach((x, i) => {   // tranças com contas de ferro
        F.fio(cabeca, [[x, 0.02, 0.17], [x * 1.4, -0.08, 0.185], [x * 1.6, -0.2, 0.18], [x * 1.5, -0.3, 0.17]], [0.016, 0.014, 0.012, 0.004], 0xb4c6d4, { rad: 5 });
        B.cil(cabeca, 0.02, 0.02, 0.02, FERRUGEM, x * 1.5, -0.2, 0.18, { seg: 5, ...mm, linha: false });
      });
      F.espinhos(cabeca, [{ p: [0.03, -0.2, 0.18], d: [0, -1, 0], l: 0.14, r: 0.014 }, { p: [-0.06, -0.12, 0.17], d: [0, -1, 0], l: 0.1, r: 0.012 }], GELO_A, { rough: 0.2 });

      /* --- braços longos --- */
      const mao = (pai, l, garra = true) => {
        const m = B.grupo(pai, 0, 0, 0);
        B.blob(m, 0.062, PELE, 0, 0, 0, { ...mp, sx: 0.9, sy: 1.05, sz: 1.0, amp: 0.1, seed: 14, seg: 12 });
        for (let f = 0; f < 4; f++) {
          const fx = (f - 1.5) * 0.026, c = garra ? 0 : 0;
          F.fio(m, [[fx, -0.03, 0.01], [fx, -0.075, 0.04 - f * 0.004], [fx * 1.1, -0.12, 0.03 + (f % 2) * 0.02]], [0.017, 0.013, 0.008], PELE_E, { rad: 5 });
          F.espinhos(m, [{ p: [fx * 1.1, -0.12, 0.03 + (f % 2) * 0.02], d: [0, -0.7, 0.7], l: 0.065, r: 0.011, b: [0, 0.01, 0.03] }], 0x2a2a30, { lados: 4 });
        }
        F.fio(m, [[l * 0.04, 0.0, 0.02], [l * 0.075, -0.04, 0.06], [l * 0.05, -0.07, 0.08]], [0.02, 0.016, 0.01], PELE_E, { rad: 5 });
        return m;
      };
      const braco = l => {
        const b = B.grupo(tronco, l * 0.33, 0.52, -0.02);
        B.esf(b, 0.085, PELE_E, 0, 0, 0, { ...mp, seg: 10, linha: false });
        B.tubo(b, [[0, 0, 0], [l * 0.03, -0.17, 0.03], [l * 0.04, -0.34, 0.07]], [0.075, 0.058, 0.05], PELE, mp);
        B.tubo(b, [[l * 0.04, -0.34, 0.07], [l * 0.04, -0.5, 0.13], [l * 0.025, -0.68, 0.14]], [0.05, 0.043, 0.034], PELE_E, mp);
        B.esf(b, 0.05, OSSO, l * 0.04, -0.34, 0.04, { tex: 'osso', seg: 8, linha: false });
        F.fio(b, [[l * 0.02, -0.08, 0.06], [l * 0.08, -0.2, 0.08], [l * 0.03, -0.3, 0.1], [l * 0.07, -0.42, 0.17]], 0.007, BRILHO, { emissive: BRILHO, brilho: 0.7 });
        F.fio(b, [[-l * 0.03, -0.1, 0.06], [-l * 0.02, -0.22, 0.09], [-l * 0.04, -0.33, 0.11]], 0.012, PELE_C);
        for (let i = 0; i < 4; i++) F.anel(b, 0.052 - i * 0.003, 0.011, PANO_C, l * 0.04, -0.52 - i * 0.045, 0.135 - i * 0.004, { tex: 'tecido', rx: PI / 2 - 0.2 });
        const mm2 = B.grupo(b, l * 0.025, -0.74, 0.14);
        mao(mm2, l);
        b.userData.mao = mm2;
        return b;
      };
      const bracoD = braco(1), bracoE = braco(-1);
      bracoD.rotation.x = -0.25; bracoE.rotation.x = 0.15; bracoE.rotation.z = 0.12;
      // escudo quebrado no braço esquerdo
      const esc = B.grupo(bracoE, -0.14, -0.5, 0.13); esc.rotation.set(0.1, 0, -0.1);
      const disco = []; for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, r = (i >= 2 && i <= 4) ? 0.17 + (i % 2) * 0.05 : (i === 11 ? 0.2 : 0.3); disco.push([Math.cos(a) * r, Math.sin(a) * r]); }
      F.extruir(esc, disco, 0.04, 0x4a3828, 0, 0, 0, { ry: PI / 2, tex: 'couro', rep: 2, linha: true });
      B.esf(esc, 0.07, FERRO, -0.045, 0, 0, { ...mm, sx: 0.5, seg: 10 });
      F.anel(esc, 0.3, 0.012, FERRO_E, -0.01, 0, 0, { ...mm, rz: PI / 2, rx: 0, ry: 0, seg: 16 }).rotation.set(0, PI / 2, 0);
      for (let i = -1; i <= 1; i++) F.fio(esc, [[-0.046, -0.28, i * 0.1], [-0.048, 0, i * 0.1 + 0.01], [-0.046, 0.26, i * 0.1 - 0.01]], 0.005, 0x1c1410);
      F.cristais(esc, F.espalhar(5, 45, { c: [-0.03, 0.15, -0.05], r: [0.03, 0.18, 0.2], filtro: (x, y) => y > 0.2, bias: [-1, 0.5, 0], l: [0.06, 0.12], rad: [0.015, 0.025], curva: 0 }), GELO_A);
      // algema com corrente solta no pulso esquerdo
      const pulsoE = bracoE.userData.mao;
      B.tor(pulsoE, 0.05, 0.014, FERRO_E, 0, 0.02, 0, { rx: PI / 2, seg: 10, ...mm, linha: false });
      F.corrente(pulsoE, [[0.0, 0.0, 0.05], [0.0, -0.08, 0.07], [-0.02, -0.17, 0.05], [-0.04, -0.24, 0.07]], 5, 0.02, 0.005, FERRO_E);

      /* --- machado enorme (pivô próprio dentro da mão para girar no golpe) --- */
      const arma = B.grupo(bracoD.userData.mao, 0, 0, 0); arma.rotation.x = 0.55; arma.rotation.z = -0.1;
      B.tubo(arma, [[0, -0.5, 0], [0, 0.2, 0.01], [0, 1.0, 0]], [0.03, 0.028, 0.03], MADEIRA, { tex: 'couro', rep: 3, seg: 8, rad: 6 });
      for (let i = 0; i < 4; i++) F.anel(arma, 0.034, 0.01, COURO, 0, -0.06 + i * 0.05, 0, { tex: 'couro' });
      B.cone(arma, 0.04, 0.12, FERRO_E, 0, -0.54, 0, { rx: PI, seg: 6, ...mm, linha: false });
      B.cil(arma, 0.045, 0.045, 0.14, FERRO_E, 0, 0.9, 0, { seg: 8, ...mm });
      const lamina = [[0.03, -0.1], [0.12, -0.24], [0.28, -0.34], [0.4, -0.3], [0.37, -0.2], [0.4, -0.12], [0.36, 0.0], [0.385, 0.1], [0.35, 0.2], [0.43, 0.3], [0.31, 0.33], [0.17, 0.25], [0.04, 0.17]].map(q => [q[0] * 0.8, q[1] * 0.8]);
      const hd = F.extruir(arma, lamina, 0.03, 0x8a8e98, 0, 0.9, 0.0, { ry: -PI / 2, tex: 'metal', rep: 3, metal: 0.55, rough: 0.4, linha: true, furo: [0.14, 0.0, 0.04] });
      F.fio(arma, [[0.03, 0.9, 0.4], [0.03, 0.92, 0.3], [0.03, 0.88, 0.2]], 0.005, BRILHO, { emissive: BRILHO, brilho: 1 });   // runa
      F.fio(arma, [[0.03, 0.97, 0.33], [0.03, 0.99, 0.22]], 0.005, BRILHO, { emissive: BRILHO, brilho: 1 });
      B.cx(arma, 0.03, 0.14, 0.012, FERRUGEM, 0.0, 0.8, 0.06, { ...mm, linha: false });
      F.cristais(arma, [{ p: [0.0, 1.0, 0.03], d: [0, 1, 0.2], l: 0.12, r: 0.025 }, { p: [0.0, 1.0, -0.02], d: [0.2, 0.8, -0.5], l: 0.08, r: 0.018 }, { p: [0, 0.95, 0.07], d: [-0.3, 0.5, 0.8], l: 0.07, r: 0.016 }], GELO_A);
      F.espinhos(arma, F.espalhar(10, 3, { c: [0.0, 0.5, 0.0], r: [0.04, 0.3, 0.04], bias: [0, -1, 0], l: [0.04, 0.08], rad: [0.01, 0.018] }), GELO, { rough: 0.4 });
      // a mão aperta o cabo
      arma.position.set(0, 0, 0.0);

      /* --- capa esfarrapada (balança sozinha) --- */
      const capa = B.grupo(R, 0, 1.37, -0.12);
      for (let i = 0; i < 9; i++) {
        const x = (i - 4) * 0.075, len = 0.75 + rnd() * 0.35 + (i === 2 || i === 6 ? 0.1 : 0);
        F.tira(capa, [[x, 0, 0], [x * 1.1, -len * 0.35, -0.1 - Math.abs(i - 4) * 0.01], [x * 1.25, -len * 0.7, -0.12], [x * 1.3 + (rnd() - 0.5) * 0.06, -len, -0.07]], [0.09, 0.085, 0.08, 0.0], i % 2 ? PANO : PANO_C, { tex: 'tecido', rep: 2, lado: [1, 0, 0], serra: 0.35, assim: 0.4, seg: 6 });
      }
      F.espinhos(capa, F.espalhar(14, 71, { c: [0, 0.02, -0.02], r: [0.34, 0.05, 0.13], filtro: (x, y, z) => y > -0.3 && z < 0.3, bias: [0, 0.2, -0.5], l: [0.05, 0.12], rad: [0.025, 0.04] }), 0x7c8a96, { tex: 'pelo' });

      return {
        altura: 1.75, p: { tronco, cabeca, bracoD, bracoE, pernaD: pernas[1], pernaE: pernas[0], balancos: [{ g: capa, amp: 0.08, vel: 1.7, eixo: 'x', fase: 0 }] },
        anim: (t, dt, e) => { arma.rotation.x = 0.55 + e.golpe * 3.2; },
      };
    },
    /* ===== LOBO DE GELO: pelagem em tufos, cristais nas costas, presas longas ===== */
    lobo_gelo(B0, R) {
      const cor = { BASE: 0x6f8cab, MEIO: 0xa9c4dc, CLARO: 0xe3f1fb, ESCURO: 0x3d546e, NARIZ: 0x151b27, OSSO: 0xf0ecdc, GELO: 0xa8dcff, OLHO: 0x2fa8ff };
      const L = construirLobo(B0, R, { cor, seed: 23, mand: { aberta: 0.7, fechada: 0.5 },
        espinha: ({ F, tronco, rnd, cor: C }) => {
          const GELO = C.GELO, F_ = F;
      // cristais de gelo na espinha
      const cs = [];
      for (let i = 0; i < 11; i++) {
        const t = i / 10, z = 0.55 - t * 1.15, y = 0.9 - Math.abs(t - 0.3) * 0.12 - t * 0.12, s = 1 - Math.abs(t - 0.35) * 0.8;
        cs.push({ p: [0, y - 0.04, z], d: [(rnd() - 0.5) * 0.3, 1, -0.35 + (rnd() - 0.5) * 0.3], l: 0.12 + s * 0.2 + rnd() * 0.06, r: 0.03 + s * 0.025, tw: rnd() });
        if (i % 2) cs.push({ p: [(i % 4 === 1 ? 0.07 : -0.07), y - 0.05, z + 0.04], d: [(i % 4 === 1 ? 0.7 : -0.7), 0.8, -0.3], l: 0.08 + rnd() * 0.07, r: 0.022 });
      }
      F_.cristais(tronco, cs, GELO);
      F_.cristais(tronco, [{ p: [0.22, 0.78, 0.35], d: [0.6, 0.7, -0.2], l: 0.18, r: 0.03 }, { p: [-0.22, 0.78, 0.35], d: [-0.6, 0.7, -0.2], l: 0.16, r: 0.028 }, { p: [0.27, 0.65, -0.35], d: [0.9, 0.4, -0.2], l: 0.1, r: 0.025 }, { p: [-0.27, 0.65, -0.35], d: [-0.9, 0.4, -0.2], l: 0.12, r: 0.025 }], 0xdff4ff);
        } });
      const { cabeca, mandib, pernas, cauda, tronco, vapor } = L;
      return {
        altura: 1.05, p: { tronco, cabeca, pernas, cauda, mandibula: { g: mandib, aberta: 0.7, fechada: 0.5 } },
        anim: (t, dt, e) => vapor.forEach((v, i) => { const k = ((t * 0.5 + i / 3) % 1); v.position.set(Math.sin(k * 5 + i) * 0.03, -0.04 + k * 0.12, 0.45 + k * 0.28); v.scale.setScalar(0.5 + k * 1.2 + (e.golpe || 0)); }),
      };
    },
    /* ===== VALQUÍRIA CAÍDA: armadura de prata rachada, asas esfarrapadas, lança longa ===== */
    valquiria(B0, R) {
      const B = econ(B0), F = ferr(B), rnd = sem(41);
      const PRATA = 0xb4bccb, PRATA_E = 0x575c6b, PRATA_C = 0xdde3ee, PELE = 0xcfc6ca, PELE_E = 0x8e8590, ROXO = 0x1d1f30, ROXO_C = 0x33385a;
      const PRETA = 0x1d1b26, BRANCA = 0xe9eef6, CINZA = 0x8d93a6, VERM = 0xff2a3a, COURO = 0x3a2b30, OURO = 0x9a8a5a, MADEIRA = 0x4a3b36, SANGUE = 0x4a1820;
      const ma = { tex: 'pele', rep: 2, relevo: 0.025, metal: 0.8, rough: 0.32 }, mt = { tex: 'tecido', rep: 2 }, mp = { tex: 'pele', rep: 2 }, ml = { tex: 'couro', rep: 2 };
      const rach = (pai, pts, vm = true) => F.fio(pai, pts, 0.0045, vm ? 0x1c1e28 : 0x1c1e28);       // rachadura escura na armadura
      const brasa = (pai, pts) => F.fio(pai, pts, 0.004, VERM, { emissive: VERM, brilho: 0.8 });       // rachadura com brasa

      /* --- pernas com grevas de prata --- */
      const pernas = [-1, 1].map(l => {
        const p = B.grupo(R, l * 0.11, 0.86, 0);
        B.tubo(p, [[0, 0, 0], [0, -0.22, 0.03], [0, -0.42, 0.05]], [0.1, 0.082, 0.068], ROXO, mt);
        B.tubo(p, [[0, -0.02, 0.01], [0, -0.2, 0.035], [0, -0.38, 0.05]], [0.108, 0.09, 0.075], PRATA, { ...ma, seg: 6 });   // coxote
        B.blob(p, 0.062, PRATA, 0, -0.43, 0.09, { ...ma, sx: 0.9, sy: 0.9, sz: 1.1, amp: 0.08, seg: 10 });                  // joelheira
        B.cone(p, 0.03, 0.08, PRATA_E, 0, -0.43, 0.15, { rx: PI / 2, seg: 5, ...ma, linha: false });
        B.tubo(p, [[0, -0.43, 0.05], [0, -0.62, 0.02], [0, -0.8, -0.01]], [0.07, 0.058, 0.046], PRATA, { ...ma, seg: 6 });     // greva
        for (let i = 0; i < 3; i++) F.anel(p, 0.056 - i * 0.006, 0.009, PRATA_C, 0, -0.52 - i * 0.09, 0.03 - i * 0.015, { ...ma, rx: PI / 2 + 0.1 });
        B.blob(p, 0.07, PRATA_E, 0, -0.83, 0.07, { ...ma, sx: 0.9, sy: 0.55, sz: 1.7, amp: 0.07, seg: 10 });                // sabatão
        B.cone(p, 0.035, 0.1, PRATA, 0, -0.83, 0.22, { rx: PI / 2, seg: 5, ...ma, linha: false });
        rach(p, [[0.03, -0.55, 0.06], [0.05, -0.62, 0.05], [0.03, -0.7, 0.03]]);
        return p;
      });
      // quadril e saia: placas e trapos
      B.blob(R, 0.17, ROXO, 0, 0.87, 0, { ...mt, sx: 1.2, sy: 0.65, sz: 0.9 });
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * PI * 2, x = Math.sin(a) * 0.2, z = Math.cos(a) * 0.17, len = 0.3 + rnd() * 0.22;
        F.tira(R, [[x, 0.88, z], [x * 1.12, 0.88 - len * 0.5, z * 1.12], [x * 1.2, 0.88 - len, z * 1.2]], [0.095, 0.09, 0.0], i % 2 ? ROXO : ROXO_C, { ...mt, lado: [Math.cos(a), 0, -Math.sin(a)], serra: 0.6, assim: 0.3 });
      }
      for (let i = 0; i < 9; i++) {   // escamas da saia (placas de prata)
        const a = i / 9 * PI * 2 + 0.2, x = Math.sin(a) * 0.205, z = Math.cos(a) * 0.18, h = 0.2 + (i % 3) * 0.03;
        const pl = F.extruir(R, [[-0.045, 0], [0.045, 0], [0.04, -h], [0, -h - 0.04], [-0.04, -h + 0.01]], 0.012, i % 4 === 3 ? PRATA_E : PRATA, x, 0.9, z, { ry: a, rx: -0.2, ...ma, bisel: 0.006 });
      }

      /* --- tronco: peitoral rachado --- */
      const tronco = B.grupo(R, 0, 0.9, 0); tronco.rotation.x = -0.04;
      B.blob(tronco, 0.12, ROXO, 0, 0.08, 0, { ...mt, sx: 1.1, sz: 0.85 });
      B.torno(tronco, [[0.14, 0.02], [0.12, 0.1], [0.15, 0.2], [0.2, 0.32], [0.21, 0.42], [0.17, 0.52], [0.1, 0.58]], PRATA, 0, 0, 0, { ...ma, sx: 1.0, sz: 0.82, seg: 16 });
      [-1, 1].forEach(l => B.blob(tronco, 0.1, PRATA_C, l * 0.09, 0.38, 0.13, { ...ma, sx: 1.0, sy: 0.9, sz: 0.8, amp: 0.05, seg: 10, linha: false }));   // seios da couraça
      F.anel(tronco, 0.125, 0.012, PRATA_E, 0, 0.11, 0, { ...ma, sx: 1.1, sz: 0.85, seg: 14 });
      F.anel(tronco, 0.14, 0.012, PRATA_E, 0, 0.17, 0, { ...ma, sx: 1.1, sz: 0.85, seg: 14 });
      F.fio(tronco, [[0, 0.1, 0.12], [0, 0.3, 0.17], [0, 0.5, 0.12]], 0.012, PRATA_C, ma);          // quilha central
      rach(tronco, [[-0.08, 0.26, 0.16], [-0.04, 0.34, 0.185], [-0.07, 0.42, 0.18], [-0.02, 0.5, 0.15]]);
      brasa(tronco, [[0.1, 0.22, 0.15], [0.07, 0.3, 0.18], [0.12, 0.38, 0.17]]);
      rach(tronco, [[0.14, 0.38, 0.14], [0.17, 0.3, 0.1], [0.2, 0.25, 0.04]]);
      B.blob(tronco, 0.035, SANGUE, -0.12, 0.2, 0.15, { sx: 1.5, sy: 0.4, sz: 0.3, seg: 6, linha: false });   // mancha escura
      // emblema de asas no peito
      [-1, 1].forEach(l => F.tira(tronco, [[l * 0.015, 0.33, 0.19], [l * 0.07, 0.36, 0.2], [l * 0.12, 0.34, 0.18]], [0.02, 0.025, 0.0], OURO, { ...ma, lado: [0, 1, 0] }));
      // ombreiras em camadas
      const ombro = l => {
        const o = B.grupo(tronco, l * 0.26, 0.5, 0);
        [[0.14, 0.04, 0.5], [0.125, -0.01, 0.38], [0.11, -0.06, 0.28]].forEach(([r, y, rz], i) => {
          B.torno(o, [[r, 0], [r * 1.02, 0.035], [r * 0.85, 0.08], [r * 0.5, 0.115], [0, 0.13]], i === 2 ? PRATA_E : PRATA, 0, y, 0, { ...ma, rz: -l * rz, seg: 12, sy: 0.7 });
        });
        B.cone(o, 0.03, 0.14, PRATA_C, l * 0.13, 0.12, 0, { rz: -l * 1.1, seg: 5, ...ma, linha: false });
        return o;
      };
      ombro(-1); ombro(1);
      // gola e pescoço
      B.torno(tronco, [[0.1, 0.55], [0.11, 0.6], [0.09, 0.66], [0.075, 0.68]], PRATA_E, 0, 0, 0, { ...ma, seg: 12, linha: false });

      /* --- cabeça: elmo alado, olhos vermelhos --- */
      const cabeca = B.grupo(tronco, 0, 0.68, 0.0);
      B.tubo(cabeca, [[0, -0.03, 0], [0, 0.04, 0.01]], [0.05, 0.045], PELE_E, mp);
      B.blob(cabeca, 0.113, PELE, 0, 0.16, 0.02, { ...mp, sy: 1.1, sz: 1.02, amp: 0.03, seed: 5 });
      B.blob(cabeca, 0.07, PELE, 0, 0.075, 0.05, { ...mp, sx: 1.05, sy: 0.75, sz: 1.0, amp: 0.04, seed: 9, linha: false });
      [-1, 1].forEach(l => {
        B.blob(cabeca, 0.035, PELE_E, l * 0.06, 0.145, 0.095, { sx: 1.3, sy: 0.6, seg: 8, linha: false });                // olheira
        B.cx(cabeca, 0.058, 0.014, 0.025, 0x241c28, l * 0.058, 0.19, 0.105, { rz: -l * 0.35, linha: false });            // sobrancelha dura
        B.olho(cabeca, 0.02, VERM, l * 0.055, 0.16, 0.112, { pupila: false, brilho: 1.4 });
        B.blob(cabeca, 0.026, PELE, l * 0.065, 0.1, 0.09, { ...mp, linha: false, seg: 8 });                               // maçã do rosto
      });
      B.cone(cabeca, 0.016, 0.05, PELE, 0, 0.12, 0.125, { rx: PI / 2 + 0.2, seg: 5, linha: false });
      B.cx(cabeca, 0.05, 0.008, 0.01, 0x3a1a24, 0, 0.065, 0.118, { linha: false });                                       // boca dura
      F.fio(cabeca, [[0.07, 0.22, 0.09], [0.06, 0.16, 0.115], [0.075, 0.1, 0.1]], 0.004, 0x6a2a38);                    // cicatriz sobre o olho
      B.torno(cabeca, [[0.143, 0.0], [0.15, 0.05], [0.135, 0.12], [0.09, 0.18], [0.03, 0.215], [0, 0.222]], PRATA, 0, 0.185, -0.015, { ...ma, seg: 14 });
      F.anel(cabeca, 0.152, 0.014, PRATA_E, 0, 0.19, -0.015, { ...ma, seg: 14, rad: 5, linha: false });
      F.malha(cabeca, new THREE.TorusGeometry(0.145, 0.01, 4, 12, PI), PRATA_C, 0, 0.19, -0.015, { ry: PI / 2, sy: 1.45, ...ma });   // crista
      B.cx(cabeca, 0.02, 0.1, 0.012, PRATA_E, 0, 0.14, 0.14, { ...ma, linha: false });                                  // nasal
      [-1, 1].forEach(l => {
        F.extruir(cabeca, [[0, 0], [0.04, -0.02], [0.045, -0.1], [0.01, -0.13], [-0.02, -0.06]], 0.012, PRATA_E, l * 0.133, 0.19, 0.02, { ry: l * 0.9, ...ma, bisel: 0.005 });   // bochecha
        // asas do elmo: penas brancas e pretas
        for (let i = 0; i < 6; i++) {
          const s = 1 - i * 0.08, a = 0.15 + i * 0.2, cor = i % 2 ? BRANCA : (i === 4 ? CINZA : PRETA);
          if (l === 1 && i === 5) continue;                                                                               // pena quebrada
          F.tira(cabeca, [[l * 0.135, 0.22 - i * 0.012, 0], [l * (0.25 + i * 0.01), 0.24 + a * 0.05, -0.06 - i * 0.02], [l * (0.42 * s + 0.06), 0.25 + a * 0.1, -0.16 - i * 0.05], [l * (0.52 * s + 0.1), 0.2 + a * 0.12 - i * 0.02, -0.28 - i * 0.07]],
            [0.03, 0.055, 0.045, 0.0], cor, { lado: [0, 1, 0.3], seg: 5 });
        }
      });
      // cabelo ao vento
      for (let i = 0; i < 14; i++) {
        const x = (i - 6.5) * 0.017, y = 0.27 - Math.abs(i - 6.5) * 0.006, w = 0.22 + rnd() * 0.2;
        F.tira(cabeca, [[x, y - 0.02, -0.07], [x * 1.5 + 0.03, y - 0.05, -0.16], [x * 2 + 0.12 + w * 0.3, y - 0.1, -0.28 - w * 0.2], [x * 2.5 + 0.28 + w * 0.5, y - 0.2 + rnd() * 0.05, -0.38 - w * 0.4]], [0.035, 0.04, 0.025, 0.0], i % 3 ? 0x17141f : 0x2a2638, { lado: [0, 1, 0], seg: 5, rough: 0.5 });
      }
      F.fio(cabeca, [[-0.06, 0.17, -0.09], [-0.12, 0.0, -0.13], [-0.1, -0.15, -0.1], [-0.12, -0.3, -0.09]], [0.022, 0.018, 0.015, 0.006], 0x17141f, { rad: 5 });   // trança

      /* --- braços blindados --- */
      const braco = l => {
        const b = B.grupo(tronco, l * 0.26, 0.49, 0);
        B.esf(b, 0.06, ROXO, 0, 0, 0, { ...mt, seg: 8, linha: false });
        B.tubo(b, [[0, 0, 0], [l * 0.03, -0.15, 0.01], [l * 0.04, -0.29, 0.04]], [0.058, 0.05, 0.045], ROXO, mt);
        B.blob(b, 0.05, PRATA, l * 0.04, -0.3, 0.02, { ...ma, sz: 1.1, seg: 8 });
        B.tubo(b, [[l * 0.04, -0.3, 0.04], [l * 0.04, -0.43, 0.08], [l * 0.03, -0.58, 0.09]], [0.05, 0.046, 0.038], PRATA, { ...ma, seg: 6 });
        for (let i = 0; i < 3; i++) F.anel(b, 0.05 - i * 0.004, 0.008, PRATA_C, l * 0.04, -0.4 - i * 0.07, 0.08 + i * 0.002, { ...ma, rx: PI / 2 - 0.2 });
        const mao = B.grupo(b, l * 0.03, -0.64, 0.09);
        B.blob(mao, 0.05, PRATA_E, 0, 0, 0, { ...ma, sx: 0.9, sy: 1.05, amp: 0.05, seg: 10 });
        for (let f = 0; f < 4; f++) F.fio(mao, [[(f - 1.5) * 0.02, -0.02, 0.02], [(f - 1.5) * 0.02, -0.055, 0.045], [(f - 1.5) * 0.02, -0.085, 0.03]], 0.012, PRATA_E, ma);
        b.userData.mao = mao;
        return b;
      };
      const bracoD = braco(1), bracoE = braco(-1);
      bracoD.rotation.x = -0.15; bracoE.rotation.x = -0.35; bracoE.rotation.z = 0.15;

      // lança longa (gira na mão no golpe)
      const arma = B.grupo(bracoD.userData.mao, 0, 0, 0.0); arma.rotation.x = 0.12;
      B.tubo(arma, [[0, -0.55, 0], [0, 0.6, 0], [0, 1.4, 0]], [0.021, 0.021, 0.021], MADEIRA, { ...ml, seg: 6, rad: 6 });
      B.cone(arma, 0.03, 0.1, PRATA_E, 0, -0.58, 0, { rx: PI, seg: 5, ...ma, linha: false });
      const folha = [[0, 0], [0.05, 0.05], [0.07, 0.17], [0.045, 0.34], [0, 0.5], [-0.045, 0.34], [-0.07, 0.17], [-0.05, 0.05]];
      F.extruir(arma, folha, 0.012, PRATA_C, 0, 1.38, 0, { ...ma, linha: true, bisel: 0.005, furo: [0, 0.2, 0.014] });
      B.cil(arma, 0.032, 0.026, 0.1, PRATA_E, 0, 1.36, 0, { seg: 8, ...ma });
      [-1, 1].forEach(l => {   // asinhas e trapos amarrados abaixo da lâmina
        F.tira(arma, [[l * 0.02, 1.34, 0], [l * 0.1, 1.3, -0.01], [l * 0.17, 1.22, -0.02]], [0.04, 0.05, 0.0], BRANCA, { lado: [0, 1, 0], seg: 4 });
        F.tira(arma, [[l * 0.02, 1.32, 0], [l * 0.08, 1.2, 0.02], [l * 0.1, 1.05, 0.03]], [0.035, 0.03, 0.0], PRETA, { lado: [1, 0, 0], seg: 4 });
      });
      F.tira(arma, [[0, 1.3, 0.02], [0.05, 1.1, 0.07], [0.02, 0.88, 0.1]], [0.05, 0.045, 0.0], 0x5a1a28, { ...mt, lado: [1, 0, 0], serra: 0.5 });
      F.cristais(arma, [{ p: [0.0, 1.0, 0.0], d: [0.6, 0.8, 0.2], l: 0.1, r: 0.016 }], 0xa8dcff);

      // escudo redondo rachado
      const esc = B.grupo(bracoE, -0.14, -0.4, 0.17); esc.rotation.set(0.1, -0.9, 0.1); esc.scale.setScalar(0.82);
      const disco = []; for (let i = 0; i < 20; i++) { const a = i / 20 * PI * 2, r = (i >= 6 && i <= 8) ? 0.25 + (i % 2) * 0.03 : 0.33; disco.push([Math.cos(a) * r, Math.sin(a) * r]); }
      F.extruir(esc, disco, 0.04, PRATA, 0, 0, 0, { ...ma, linha: true });
      F.anel(esc, 0.3, 0.018, PRATA_E, 0, 0, 0.03, { ...ma, rx: 0, seg: 20 });
      B.esf(esc, 0.07, PRATA_C, 0, 0, 0.05, { ...ma, sz: 0.6, seg: 10 });
      for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; F.tira(esc, [[Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0.035], [Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0.037], [Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0.035]], [0.07, 0.05, 0.0], i % 2 ? PRETA : 0x6a1a2a, { lado: [-Math.sin(a), Math.cos(a), 0], seg: 3, metal: 0.3 }); }
      rach(esc, [[0.2, 0.2, 0.045], [0.1, 0.05, 0.05], [0.14, -0.1, 0.048], [0.04, -0.26, 0.045]]);
      brasa(esc, [[0.05, 0.12, 0.052], [0.12, 0.05, 0.052]]);

      /* --- asas grandes e esfarrapadas --- */
      const asaFeita = l => {
        const a = B.grupo(tronco, l * 0.1, 0.46, -0.15);
        const sh = [0, 0, 0], co = [l * 0.38, 0.42, -0.12], pu = [l * 0.8, 0.68, -0.1], pt = [l * 1.14, 0.4, -0.2];
        F.fio(a, [sh, [l * 0.2, 0.24, -0.06], co], [0.035, 0.03, 0.026], PRATA_E, { rad: 5 });
        F.fio(a, [co, [l * 0.58, 0.58, -0.11], pu], [0.026, 0.022, 0.018], PRATA_E, { rad: 5 });
        F.fio(a, [pu, [l * 0.98, 0.6, -0.14], pt], [0.018, 0.014, 0.006], PRATA_E, { rad: 5 });
        B.esf(a, 0.035, PRATA_C, co[0], co[1], co[2], { ...ma, seg: 6, linha: false }); B.esf(a, 0.03, PRATA_C, pu[0], pu[1], pu[2], { ...ma, seg: 6, linha: false });
        const lerpP = (A, Bp, t) => [lerp(A[0], Bp[0], t), lerp(A[1], Bp[1], t), lerp(A[2], Bp[2], t)];
        const pena = (P, len, w, cor, ang, z = 0, quebra = false) => {
          const L = quebra ? len * 0.6 : len, d = [Math.sin(ang) * l, -Math.cos(ang), -0.12];
          const pts = [[P[0], P[1], P[2] + z], [P[0] + d[0] * L * 0.4, P[1] + d[1] * L * 0.4, P[2] + z - 0.03], [P[0] + d[0] * L * 0.8 + l * 0.02, P[1] + d[1] * L * 0.8, P[2] + z - 0.07], [P[0] + d[0] * L + l * 0.05, P[1] + d[1] * L - 0.02, P[2] + z - 0.1]];
          F.tira(a, pts, quebra ? [w * 0.7, w, w * 0.9, w * 0.5] : [w * 0.55, w, w * 0.85, 0.0], cor, { lado: [Math.cos(ang), Math.sin(ang) * l, 0], seg: 4, serra: quebra ? 0.6 : 0.05 });
        };
        // primárias (pretas, longas, algumas partidas)
        for (let i = 0; i < 9; i++) { const t = i / 8, P = lerpP(pu, pt, t * 0.9); pena(P, 0.78 - t * 0.3 + rnd() * 0.08, 0.09, PRETA, 0.15 + t * 0.6 - 0.1, 0, i === 3 || i === 7); }
        for (let i = 0; i < 8; i++) { const t = i / 7, P = lerpP(pu, pt, t * 0.9); pena(P, 0.66 - t * 0.25, 0.08, i % 2 ? BRANCA : CINZA, 0.12 + t * 0.6, 0.012); }
        // secundárias (alternando preto e branco)
        for (let i = 0; i < 10; i++) { const t = i / 9, P = lerpP(co, pu, t), q = i === 2 || i === 6; pena(P, 0.5 + rnd() * 0.12 - (q ? 0.15 : 0), 0.095, i % 3 === 0 ? PRETA : BRANCA, 0.1 + (0.5 - Math.abs(t - 0.5)) * 0.15 - t * 0.1, 0.01, q); }
        // coberteiras e terciárias
        for (let i = 0; i < 9; i++) { const t = i / 8, P = lerpP(sh, co, t); pena(P, 0.4 - t * 0.05 + rnd() * 0.07, 0.075, i % 2 ? BRANCA : PRETA, -0.1 + t * 0.2, 0.0, i === 4); }
        for (let i = 0; i < 10; i++) { const t = i / 9, P = lerpP(co, pu, t); pena(P, 0.25 + rnd() * 0.05, 0.065, i % 3 === 1 ? CINZA : BRANCA, 0.1 + t * 0.15, 0.025); }
        for (let i = 0; i < 6; i++) { const t = i / 5, P = lerpP(pu, pt, t * 0.8); pena(P, 0.2 + rnd() * 0.04, 0.05, BRANCA, 0.3 + t * 0.4, 0.04); }
        a.rotation.z = l * 0.12;
        return a;
      };
      const asaE = asaFeita(-1), asaD = asaFeita(1);

      return {
        altura: 1.75, p: { tronco, cabeca, bracoD, bracoE, pernaD: pernas[1], pernaE: pernas[0], asaD, asaE },
        anim: (t, dt, e) => { arma.rotation.x = 0.12 + e.golpe * 3.4; },
      };
    },
    /* ===== TROLL DE GELO: corcunda enorme, pele de pedra-gelo, braços longos, clava ===== */
    troll_gelo(B0, R) {
      const B = econ(B0), F = ferr(B), rnd = sem(57);
      const PELE = 0x8499ae, PELE_E = 0x566a82, PELE_C = 0xa9bdd0, CROSTA = 0xdcebf5, GELO = 0x9fd8ff, OSSO = 0xe6dfc8, PELO = 0x7d8a96, COURO = 0x3a3036, AZUL = 0x3ab8ff, BOCA = 0x2a1a24, PEDRA = 0x6a7280;
      const mp = { tex: 'pedra', rep: 2, rough: 0.9 }, mc = { tex: 'cristal', rep: 2, rough: 0.35 }, mt = { tex: 'pelo', rep: 2, rough: 1 };
      const crostas = (pai, n, seed, c, r, o = {}, cor = CROSTA) => F.espinhos(pai, F.espalhar(n, seed, { c, r, l: [0.05, 0.1], rad: [0.045, 0.075], curva: 0.1, bw: 0.2, ...o }), cor, { lados: 5, perfil: [[0, 1], [0.55, 0.8]], rough: 0.45 });
      const veia = (pai, pts) => F.fio(pai, pts, 0.008, AZUL, { emissive: AZUL, brilho: 0.9 });

      /* --- pernas curtas e grossas, pés enormes --- */
      const pernas = [-1, 1].map(l => {
        const p = B.grupo(R, l * 0.27, 0.85, -0.04);
        B.tubo(p, [[0, 0, 0], [l * 0.01, -0.25, 0.08], [l * 0.02, -0.5, 0.1]], [0.2, 0.17, 0.14], PELE, mp);
        B.tubo(p, [[l * 0.02, -0.5, 0.1], [l * 0.02, -0.65, 0.09], [l * 0.01, -0.76, 0.1]], [0.14, 0.12, 0.11], PELE_E, mp);
        B.blob(p, 0.13, CROSTA, l * 0.03, -0.47, 0.2, { ...mc, sx: 1.0, sy: 0.9, sz: 0.8, amp: 0.22, seed: 3 + l, seg: 10 });   // joelho de gelo
        B.blob(p, 0.2, PELE, 0, -0.8, 0.2, { ...mp, sx: 1.0, sy: 0.5, sz: 1.5, amp: 0.1, seed: 12, seg: 12 });                      // pé
        [-1, 0, 1].forEach(i => {
          B.blob(p, 0.07, PELE_C, i * 0.1, -0.82, 0.42, { ...mp, sy: 0.75, sz: 1.1, amp: 0.1, seg: 8 });
          F.espinhos(p, [{ p: [i * 0.1, -0.83, 0.48], d: [i * 0.1, 0.1, 1], l: 0.08, r: 0.035, b: [0, -0.02, 0.02] }], 0x2a2c34, { lados: 5 });
        });
        crostas(p, 8, 5 + l, [0, -0.78, 0.2], [0.18, 0.08, 0.3], { filtro: (x, y) => y > 0.2 }, PELE_C);
        F.cristais(p, [{ p: [l * 0.14, -0.3, 0.0], d: [l, 0.4, -0.2], l: 0.18, r: 0.04 }, { p: [l * 0.12, -0.38, -0.05], d: [l, 0.1, -0.5], l: 0.12, r: 0.03 }], GELO);
        veia(p, [[l * 0.1, -0.1, 0.15], [l * 0.12, -0.25, 0.2], [l * 0.08, -0.4, 0.22]]);
        return p;
      });
      // pélvis com pele e tangas
      B.blob(R, 0.3, PELE_E, 0, 0.86, -0.02, { ...mp, sx: 1.25, sy: 0.7, sz: 1.0, amp: 0.1, seed: 6 });
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * PI * 2, x = Math.sin(a) * 0.32, z = Math.cos(a) * 0.26;
        F.tira(R, [[x, 0.9, z], [x * 1.1, 0.7, z * 1.1], [x * 1.12, 0.52 - rnd() * 0.1, z * 1.12]], [0.14, 0.13, 0.0], i % 2 ? PELO : COURO, { ...mt, lado: [Math.cos(a), 0, -Math.sin(a)], serra: 0.6 });
      }
      B.tubo(R, [[-0.3, 0.92, 0.18], [0, 0.94, 0.34], [0.3, 0.92, 0.18]], [0.035, 0.035, 0.035], COURO, { tex: 'couro', seg: 6, pontas: false });
      [-0.15, 0.06, 0.2].forEach((x, i) => B.blob(R, 0.05, OSSO, x, 0.84 - (i % 2) * 0.03, 0.35, { tex: 'osso', sx: 0.9, sy: 1.1, seg: 8, linha: false }));   // trofeus de osso

      /* --- tronco corcunda --- */
      const tronco = B.grupo(R, 0, 0.88, 0); tronco.rotation.x = 0.6;
      B.blob(tronco, 0.33, PELE, 0, 0.26, 0.04, { ...mp, sx: 1.15, sy: 1.0, sz: 0.9, amp: 0.1, seed: 2 });                // barrigão
      B.blob(tronco, 0.45, PELE, 0, 0.66, -0.02, { ...mp, sx: 1.25, sy: 0.95, sz: 0.95, amp: 0.1, seed: 4 });                // peito
      B.blob(tronco, 0.34, PELE_E, 0, 0.98, -0.2, { ...mp, sx: 1.3, sy: 0.85, sz: 1.0, amp: 0.14, seed: 8 });             // corcova
      crostas(tronco, 40, 11, [0, 0.9, -0.2], [0.42, 0.34, 0.34], { filtro: (x, y, z) => y > -0.1 && z < 0.4 }, CROSTA);          // crostas de gelo nas costas
      crostas(tronco, 22, 12, [0, 0.62, 0.05], [0.5, 0.42, 0.44], { filtro: (x, y, z) => z > 0.35 && y > -0.2 }, PELE_C);        // calos no peito
      const gs = [];
      for (let i = 0; i < 9; i++) {
        const a = i / 8 * PI * 2.2 - 0.4, rx = 0.22 + rnd() * 0.2;
        gs.push({ p: [Math.sin(a) * rx, 0.95 + rnd() * 0.2, -0.3 - Math.cos(a) * 0.1], d: [Math.sin(a) * 0.7, 1, -0.5 + rnd() * 0.3], l: 0.22 + rnd() * 0.28, r: 0.05 + rnd() * 0.04, tw: rnd() });
      }
      F.cristais(tronco, gs, GELO, { sx: 1, brilho: 0.55 });
      F.cristais(tronco, [{ p: [0.0, 1.12, -0.28], d: [0, 1, -0.3], l: 0.36, r: 0.075 }, { p: [0.18, 1.08, -0.25], d: [0.4, 1, -0.4], l: 0.28, r: 0.055 }], 0xc8ecff);
      [-1, 1].forEach(l => {   // placas de gelo nos ombros
        B.blob(tronco, 0.2, CROSTA, l * 0.55, 0.88, -0.02, { ...mc, sx: 1.1, sy: 0.7, sz: 1.1, amp: 0.18, seed: 15 + l });
        F.cristais(tronco, [{ p: [l * 0.6, 0.98, -0.02], d: [l * 0.4, 1, 0], l: 0.3, r: 0.06 }, { p: [l * 0.54, 0.98, 0.1], d: [l * 0.2, 1, 0.5], l: 0.2, r: 0.045 }, { p: [l * 0.62, 0.92, -0.12], d: [l * 0.6, 0.8, -0.5], l: 0.22, r: 0.05 }], GELO);
      });
      // rachaduras brilhantes e cicatrizes
      veia(tronco, [[-0.15, 0.9, 0.38], [-0.2, 0.72, 0.43], [-0.12, 0.55, 0.45], [-0.2, 0.4, 0.4]]);
      veia(tronco, [[0.1, 0.85, 0.4], [0.18, 0.68, 0.43], [0.14, 0.5, 0.44]]);
      F.fio(tronco, [[0.28, 0.5, 0.36], [0.2, 0.35, 0.42], [0.3, 0.22, 0.38]], 0.009, 0x2a3646);
      F.fio(tronco, [[-0.3, 0.3, 0.38], [-0.2, 0.18, 0.43]], 0.009, 0x2a3646);

      /* --- cabeça pequena, mandíbula pesada, presas --- */
      const cabeca = B.grupo(tronco, 0, 0.92, 0.3); cabeca.rotation.x = -0.75; cabeca.scale.setScalar(1.25);
      B.blob(cabeca, 0.17, PELE, 0, 0.08, 0.04, { ...mp, sx: 1.05, sy: 0.9, sz: 1.05, amp: 0.08, seed: 21 });
      B.blob(cabeca, 0.12, PELE_E, 0, -0.03, 0.12, { ...mp, sx: 1.25, sy: 0.7, sz: 1.0, amp: 0.1, seed: 22 });             // mandíbula
      B.blob(cabeca, 0.045, PELE_C, 0, 0.04, 0.2, { ...mp, sx: 1.2, sy: 1.0, sz: 1.2, amp: 0.1, seg: 8, linha: false });  // nariz bulboso
      [-1, 1].forEach(l => {
        B.blob(cabeca, 0.06, PELE_E, l * 0.075, 0.155, 0.16, { ...mp, sx: 1.5, sy: 0.6, amp: 0.12, seg: 8, linha: false });          // sobrancelha
        F.olhoFundo(cabeca, 0.03, AZUL, l * 0.07, 0.1, 0.205, { brilho: 1.6 });
        F.cristais(cabeca, [{ p: [l * 0.15, 0.1, -0.02], d: [l, 0.8, -0.2], l: 0.1, r: 0.022 }], GELO);
        B.cone(cabeca, 0.05, 0.1, PELE, l * 0.17, 0.1, -0.02, { rz: -l * 1.1, seg: 5, linha: false });                              // orelha pontuda
        B.cone(cabeca, 0.034, 0.22, OSSO, l * 0.07, -0.05, 0.2, { rx: -0.3, rz: l * 0.15, seg: 6, tex: 'osso', linha: false });     // presa
        F.espinhos(cabeca, [{ p: [l * 0.075, 0.0, 0.205], d: [l * 0.2, 1, 0.5], l: 0.19, r: 0.032, b: [l * 0.02, 0.01, 0.07] }], OSSO, { tex: 'osso', lados: 5 });
      });
      B.esf(cabeca, 0.07, BOCA, 0, -0.02, 0.19, { sx: 1.5, sy: 0.4, sz: 0.5, linha: false, seg: 8 });
      B.dentes(cabeca, 6, 0.1, 0.022, OSSO, 0, 0.0, 0.2, { rx: 0 });
      F.cristais(cabeca, [{ p: [0, 0.22, 0.0], d: [0, 1, 0.1], l: 0.22, r: 0.04 }, { p: [0.05, 0.2, -0.05], d: [0.4, 1, -0.3], l: 0.15, r: 0.03 }, { p: [-0.05, 0.2, 0.0], d: [-0.4, 1, 0.1], l: 0.17, r: 0.032 }], 0xc8ecff);
      F.espinhos(cabeca, F.espalhar(14, 31, { c: [0, -0.06, 0.1], r: [0.1, 0.1, 0.12], filtro: (x, y) => y < -0.2, bias: [0, -1, 0.1], bw: 1.2, l: [0.06, 0.16], rad: [0.015, 0.03] }), CROSTA, { rough: 0.4 });   // barba de gelo
      F.fio(cabeca, [[0.1, 0.18, 0.1], [0.12, 0.1, 0.14], [0.1, 0.03, 0.15]], 0.006, 0x2a3646);

      /* --- braços longos e grossos --- */
      const mao = (pai, l) => {
        const m = B.grupo(pai, 0, 0, 0);
        B.blob(m, 0.17, PELE, 0, -0.04, 0.03, { ...mp, sx: 1.0, sy: 0.9, sz: 1.0, amp: 0.1, seed: 31, seg: 12 });
        for (let i = 0; i < 4; i++) {
          B.blob(m, 0.05, PELE_C, (i - 1.5) * 0.065, -0.09, 0.12, { ...mp, sy: 0.9, sz: 1.2, seg: 8, amp: 0.1 });
          F.espinhos(m, [{ p: [(i - 1.5) * 0.065, -0.12, 0.16], d: [0, -0.5, 1], l: 0.09, r: 0.026, b: [0, -0.02, 0.01] }], 0x2a2c34, { lados: 5 });
        }
        return m;
      };
      const braco = l => {
        const b = B.grupo(tronco, l * 0.58, 0.84, 0.0);
        B.blob(b, 0.2, PELE, 0, 0, 0, { ...mp, amp: 0.1, seed: 40, seg: 12, linha: false });
        B.tubo(b, [[0, 0, 0], [l * 0.05, -0.26, 0.04], [l * 0.08, -0.5, 0.08]], [0.21, 0.17, 0.15], PELE, mp);
        B.tubo(b, [[l * 0.08, -0.5, 0.08], [l * 0.08, -0.72, 0.24], [l * 0.05, -0.92, 0.3]], [0.15, 0.165, 0.14], PELE_E, mp);
        B.blob(b, 0.13, CROSTA, l * 0.1, -0.5, 0.0, { ...mc, sx: 1, sy: 0.9, sz: 0.9, amp: 0.2, seed: 41 + l, seg: 10 });          // cotovelo de gelo
        F.cristais(b, [{ p: [l * 0.16, -0.5, -0.04], d: [l, 0.5, -0.3], l: 0.2, r: 0.04 }, { p: [l * 0.14, -0.46, 0.04], d: [l * 0.6, 0.6, 0.6], l: 0.12, r: 0.03 }], GELO);
        crostas(b, 12, 45 + l, [l * 0.07, -0.72, 0.24], [0.17, 0.26, 0.15], { bias: [0, 0, -0.3] }, CROSTA);
        veia(b, [[l * 0.12, -0.1, 0.1], [l * 0.16, -0.26, 0.14], [l * 0.13, -0.42, 0.16]]);
        veia(b, [[l * 0.08, -0.62, 0.36], [l * 0.12, -0.78, 0.42], [l * 0.07, -0.92, 0.42]]);
        const m = B.grupo(b, l * 0.05, -1.02, 0.31);
        mao(m, l);
        b.userData.mao = m;
        return b;
      };
      const bracoD = braco(1), bracoE = braco(-1);
      bracoD.rotation.x = -0.3; bracoE.rotation.x = -0.1; bracoE.rotation.z = 0.08;

      /* --- clava de gelo e pedra --- */
      const arma = B.grupo(bracoD.userData.mao, 0, 0, 0.0); arma.rotation.x = 0.0;
      B.tubo(arma, [[0, -0.3, 0], [0, 0.4, 0.0], [0, 0.95, 0]], [0.055, 0.065, 0.09], 0x4a3a30, { tex: 'couro', rep: 2, seg: 6, rad: 6 });
      B.blob(arma, 0.27, PEDRA, 0, 1.12, 0, { ...mp, sx: 0.95, sy: 1.25, sz: 0.95, amp: 0.2, seed: 61 });
      B.blob(arma, 0.18, CROSTA, 0.07, 1.22, 0.12, { ...mc, amp: 0.25, seed: 62, seg: 10 });
      F.cristais(arma, [{ p: [0, 1.32, 0], d: [0, 1, 0], l: 0.3, r: 0.07 }, { p: [0.15, 1.2, 0.05], d: [1, 0.5, 0.2], l: 0.22, r: 0.05 }, { p: [-0.15, 1.15, -0.05], d: [-1, 0.5, -0.1], l: 0.2, r: 0.05 }, { p: [0.05, 1.1, 0.2], d: [0.2, 0.3, 1], l: 0.2, r: 0.045 }, { p: [-0.05, 1.05, -0.2], d: [-0.1, 0.4, -1], l: 0.2, r: 0.045 }], GELO);
      crostas(arma, 12, 63, [0, 1.12, 0], [0.27, 0.34, 0.27], {}, PEDRA);
      for (let i = 0; i < 3; i++) F.anel(arma, 0.095, 0.014, COURO, 0, 0.78 + i * 0.07, 0, { tex: 'couro' });
      F.corrente(arma, [[0.05, 0.85, 0.08], [0.2, 0.7, 0.14], [0.2, 0.5, 0.1]], 5, 0.03, 0.008, 0x3a3a44);
      veia(arma, [[0.0, 1.0, 0.25], [0.1, 1.15, 0.22], [0.05, 1.3, 0.18]]);

      return {
        altura: 1.9, p: { tronco, cabeca, bracoD, bracoE, pernaD: pernas[1], pernaE: pernas[0] },
        anim: (t, dt, e) => { arma.rotation.x = 0.0 + e.golpe * 3.9; },
      };
    },
    /* ===== FENRIR (chefe): lobo colossal, pelagem negra espetada, corrente quebrada ===== */
    fenrir(B0, R) {
      const cor = { BASE: 0x161c2c, MEIO: 0x222c44, CLARO: 0x38496a, ESCURO: 0x0a0d16, NARIZ: 0x07090e, OSSO: 0xd9d4c2, GELO: 0x8fb4d8, OLHO: 0xff1208, ORELHA: 0x5a1a26 };
      const FERRO = 0x4a4a54, FERRUGEM = 0x7a4a32, CICATRIZ = 0x6c7690;
      const L = construirLobo(B0, R, {
        cor, seed: 77, esc: 1.45, tufos: 0.95, olhoBr: 0.8, cabeca: 1.35, bw: 1.5, cristais: false, garra: 0xcfc9b4, garraL: 1.6, vapor: 0x7a86a8, vaporEm: 0x601828,
        mand: { aberta: 0.75, fechada: 0.4 },
        espinha: ({ F, tronco, rnd }) => {   // espinhos negros na coluna, pontas pálidas
          const it = [];
          for (let i = 0; i < 13; i++) {
            const t = i / 12, z = 0.6 - t * 1.2, y = 0.92 - Math.abs(t - 0.3) * 0.1 - t * 0.1, s = 1 - Math.abs(t - 0.3) * 0.7;
            it.push({ p: [0, y - 0.05, z], d: [(rnd() - 0.5) * 0.3, 1, -0.55 + (rnd() - 0.5) * 0.25], l: 0.18 + s * 0.22 + rnd() * 0.06, r: 0.04 + s * 0.02, b: [0, -0.03, -0.07], tw: rnd() });
          }
          F.espinhos(tronco, it, 0x0a0d16, { lados: 4, rough: 0.6 });
          F.espinhos(tronco, it.map(q => ({ p: [q.p[0] + q.d[0] * q.l * 0.62 + q.b[0] * 0.38, q.p[1] + q.d[1] * q.l * 0.62 + q.b[1] * 0.38, q.p[2] + q.d[2] * q.l * 0.62 + q.b[2] * 0.38], d: q.d, l: q.l * 0.42, r: q.r * 0.42, b: [0, 0, -0.03] })), 0x9aa6c0, { lados: 4, rough: 0.35 });
        },
      });
      const { B, F, G, tronco, cabeca, mandib, pernas, cauda, vapor, rnd, pelo } = L;
      const OSSO = cor.OSSO, ESCURO = cor.ESCURO;
      // ombros mais altos e juba arrepiada
      B.blob(tronco, 0.27, ESCURO, 0, 0.88, 0.28, { tex: 'pelo', rep: 2, sx: 1.05, sy: 0.7, sz: 1.2, amp: 0.2, seed: 19 });
      pelo(tronco, 34, 101, [0, 0.9, 0.3], [0.26, 0.2, 0.3], { filtro: (x, y) => y > 0.1, bias: [0, 0.5, -1], bw: 1.2, l: [0.18, 0.32], rad: [0.035, 0.05], curva: 0.9 }, cor.CLARO);
      pelo(tronco, 22, 102, [0, 0.72, 0.62], [0.2, 0.26, 0.16], { filtro: (x, y, z) => z > 0, bias: [0, -1, -0.3], bw: 1.2, l: [0.14, 0.28], rad: [0.03, 0.05] }, cor.MEIO);
      // cicatrizes brancas
      [[0.29, 0.78, 0.0], [0.3, 0.7, -0.02], [0.31, 0.62, -0.03]].forEach(([x, y, z], i) => F.fio(tronco, [[x, y, z + 0.18], [x + 0.02, y - 0.1, z + 0.05], [x + 0.01, y - 0.2, z - 0.1]], 0.009, CICATRIZ));
      F.fio(tronco, [[-0.28, 0.82, 0.5], [-0.31, 0.7, 0.42], [-0.3, 0.55, 0.38]], 0.009, CICATRIZ);
      F.fio(tronco, [[-0.27, 0.7, -0.2], [-0.3, 0.6, -0.3], [-0.26, 0.5, -0.4]], 0.009, CICATRIZ);
      [-1, 1].forEach(l => F.fio(cabeca, [[l * 0.11, 0.12, 0.0], [l * 0.12, 0.03, 0.08], [l * 0.1, -0.03, 0.14]], 0.004, CICATRIZ));
      F.fio(cabeca, [[0.04, 0.1, 0.15], [0.08, 0.05, 0.2], [0.1, -0.02, 0.18]], 0.005, CICATRIZ);   // cicatriz atravessando o olho
      // presas enormes e chamas nos olhos
      [-1, 1].forEach(l => {
        B.dentes(cabeca, 1, 0, 0.06, OSSO, l * 0.066, -0.1, 0.34, { presas: true });
        B.dentes(mandib, 1, 0, 0.05, OSSO, l * 0.05, 0.0, 0.31, { presas: true, rx: 0 });
        B.blob(cabeca, 0.05, 0x3a0c16, l * 0.055, -0.09, 0.3, { sx: 1.1, sy: 0.4, sz: 2.0, seg: 8, linha: false });
        F.espinhos(cabeca, [{ p: [l * 0.13, 0.1, -0.03], d: [l * 0.5, 0.9, -0.5], l: 0.18, r: 0.035 }], 0x0a0d16, { lados: 4 });   // chifres de pelo
      });
      const chamas = [-1, 1].map(l => B.vivo(B.cone(cabeca, 0.02, 0.09, 0xff5a2a, l * 0.095, 0.13, 0.1, { emissive: 0xff2a10, brilho: 1.5, linha: false, seg: 5, op: 0.9, rx: -0.7, sx: 0.7 })));
      pernas.forEach(p => p.scale.set(1.35, 1, 1.35));
      // coleira de ferro, corrente quebrada e algema
      F.anel(tronco, 0.205, 0.04, FERRO, 0, 0.8, 0.56, { tex: 'metal', metal: 0.55, rough: 0.55, rx: -0.4, rad: 5, seg: 14 });
      F.anel(tronco, 0.205, 0.012, FERRUGEM, 0, 0.83, 0.54, { rx: -0.4, seg: 14, rough: 0.9 });
      B.cx(tronco, 0.13, 0.11, 0.07, FERRO, 0, 0.62, 0.66, { tex: 'metal', metal: 0.5, rough: 0.55, rx: -0.2 });
      B.tor(tronco, 0.045, 0.014, FERRUGEM, 0, 0.55, 0.69, { seg: 8, linha: false });
      F.corrente(tronco, [[0, 0.52, 0.69], [0.03, 0.4, 0.76], [0.07, 0.25, 0.78], [0.12, 0.1, 0.72], [0.18, 0.04, 0.64]], 14, 0.036, 0.01, FERRO);
      F.malha(tronco, new THREE.TorusGeometry(0.036, 0.01, 4, 8, PI * 1.5), FERRUGEM, 0.2, 0.035, 0.6, { rx: 0.4, rz: 0.8, metal: 0.5, rough: 0.6 });   // elo partido
      // algema com corrente curta numa pata dianteira
      const pe = pernas[0];
      F.anel(pe, 0.075, 0.022, FERRO, 0, -0.38, 0.02, { tex: 'metal', metal: 0.5, rough: 0.55, rad: 5, seg: 10 });
      F.corrente(pe, [[-0.07, -0.38, 0.02], [-0.1, -0.46, 0.0], [-0.12, -0.55, -0.02]], 4, 0.028, 0.008, FERRO);
      // fumaça vermelha-escura da boca no golpe
      return {
        altura: 1.95, p: { tronco, cabeca, pernas, cauda, mandibula: { g: mandib, aberta: 0.75, fechada: 0.4 } },
        anim: (t, dt, e) => {
          vapor.forEach((v, i) => { const k = ((t * 0.6 + i / 3) % 1); v.position.set(Math.sin(k * 5 + i) * 0.03, -0.04 + k * 0.14, 0.45 + k * 0.3); v.scale.setScalar(0.4 + k * 0.9 + (e.golpe || 0) * 0.8); });
          chamas.forEach((f, i) => { f.scale.set(1 + Math.sin(t * 13 + i * 2) * 0.2, 1 + Math.sin(t * 9 + i) * 0.35, 1); });
        },
      };
    },
});
})();
