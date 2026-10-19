'use strict';
/* ============================================================
   MINIATURAS 3D — cada herói, inimigo, chefe e estrutura é "esculpido" aqui com formas simples
   (esferas, cilindros, cones, caixas), como uma miniatura pintada de mesa.

   Como funciona (para quem está começando):
   - cada modelo é uma função que monta as peças e devolve os "pivôs" que mexem (braços, pernas, asas...);
   - `Modelos3D.criar(id)` devolve o modelo pronto; `Modelos3D.animar(...)` o faz respirar, andar e golpear;
   - o desenho olha para +Z ("a frente"). O mapa gira o modelo para encarar o alvo.
   Para mudar a aparência de um monstro, edite a função dele em FEITOS (as cores estão logo no começo).
   ============================================================ */
const Modelos3D = (() => {
  const PI = Math.PI;

  /* ---------- Ferramentas de montagem ---------- */
  /** Cria um "construtor": guarda os materiais deste modelo (cada miniatura tem os seus, para piscar/sumir sozinha). */
  function construtor() {
    const mats = new Map(), todos = [];
    const linhaMat = new THREE.MeshBasicMaterial({ color: 0x0b0912, side: THREE.BackSide });
    todos.push(linhaMat);
    function mat(cor, o = {}) {
      const k = cor + '|' + (o.emissive || 0) + '|' + (o.op || 1) + '|' + (o.metal || 0) + '|' + (o.rough || 0);
      if (!mats.has(k)) {
        const m = new THREE.MeshStandardMaterial({
          color: cor, roughness: o.rough ?? 0.72, metalness: o.metal || 0,
          emissive: o.emissive || 0x000000, emissiveIntensity: o.emissive ? (o.brilho ?? 0.9) : 0,
          transparent: (o.op || 1) < 1, opacity: o.op || 1, side: o.dupla ? THREE.DoubleSide : THREE.FrontSide,
        });
        m.userData.emBase = new THREE.Color(o.emissive || 0x000000); m.userData.opBase = o.op || 1; m.userData.intBase = m.emissiveIntensity;
        mats.set(k, m); todos.push(m);
      }
      return mats.get(k);
    }
    /** Põe uma peça no `pai`. Opções: rx/ry/rz (giro), sx/sy/sz (esticar), emissive, op (transparência), linha (contorno). */
    function peca(pai, geo, cor, x, y, z, o = {}, tam = 1) {
      const m = new THREE.Mesh(geo, mat(cor, o));
      m.position.set(x, y, z);
      if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
      if (o.sx || o.sy || o.sz) m.scale.set(o.sx || 1, o.sy || 1, o.sz || 1);
      if (o.linha !== false && tam > 0.16 && !o.op) {
        const l = new THREE.Mesh(geo, linhaMat); l.scale.setScalar(1.09); m.add(l);
      }
      pai.add(m);
      return m;
    }
    const api = {
      mat, todos,
      grupo(pai, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); pai.add(g); return g; },
      cil(pai, rt, rb, h, cor, x = 0, y = 0, z = 0, o = {}) { return peca(pai, new THREE.CylinderGeometry(rt, rb, h, o.seg || 10), cor, x, y, z, o, Math.max(rt, rb, h / 2)); },
      cone(pai, r, h, cor, x = 0, y = 0, z = 0, o = {}) { return peca(pai, new THREE.CylinderGeometry(0, r, h, o.seg || 8), cor, x, y, z, o, Math.max(r, h / 2)); },
      esf(pai, r, cor, x = 0, y = 0, z = 0, o = {}) { return peca(pai, new THREE.SphereGeometry(r, o.seg || 12, o.seg ? o.seg - 3 : 9), cor, x, y, z, o, r); },
      cx(pai, w, h, d, cor, x = 0, y = 0, z = 0, o = {}) { return peca(pai, new THREE.BoxGeometry(w, h, d), cor, x, y, z, o, Math.max(w, h, d) / 1.6); },
      tor(pai, R, r, cor, x = 0, y = 0, z = 0, o = {}) { return peca(pai, new THREE.TorusGeometry(R, r, 7, o.seg || 16, o.arco || PI * 2), cor, x, y, z, o, R); },
      /** Asa de verdade (plana, aberta para o lado). forma 'pena' = pontas arredondadas; 'morcego' = dedos pontudos. */
      asa(pai, lado, comp, larg, cor, x = 0, y = 0, z = 0, o = {}) {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0.04);
        if (o.forma === 'morcego') {
          sh.lineTo(comp * 0.55, larg * 0.55); sh.lineTo(comp, larg * 0.3); sh.lineTo(comp * 0.8, -larg * 0.05);
          sh.lineTo(comp * 0.82, -larg * 0.55); sh.lineTo(comp * 0.55, -larg * 0.12); sh.lineTo(comp * 0.42, -larg * 0.7);
          sh.lineTo(comp * 0.22, -larg * 0.15); sh.lineTo(0, -larg * 0.3);
        } else {
          sh.lineTo(comp * 0.5, larg * 0.5); sh.lineTo(comp, larg * 0.28); sh.lineTo(comp * 0.96, -larg * 0.1);
          sh.lineTo(comp * 0.76, -larg * 0.4); sh.lineTo(comp * 0.52, -larg * 0.18); sh.lineTo(comp * 0.32, -larg * 0.55); sh.lineTo(0, -larg * 0.35);
        }
        const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat(cor, { ...o, dupla: true }));
        m.rotation.x = -PI / 2; if (lado < 0) m.scale.x = -1;
        m.position.set(x, y, z);
        pai.add(m); return m;
      },
      octa(pai, r, cor, x = 0, y = 0, z = 0, o = {}) { return peca(pai, new THREE.OctahedronGeometry(r, 0), cor, x, y, z, o, r); },
    };
    return api;
  }

  /* ---------- Peças prontas ---------- */
  /** Humanoide: devolve pivôs de braços/pernas/cabeça e as "mãos" onde se penduram as armas. */
  function humano(B, raiz, o = {}) {
    const s = o.s || 1, w = o.larg || 1, pele = o.pele ?? 0xf0c9a0, corpo = o.corpo ?? 0x6a6f86, calca = o.calca ?? 0x3a3d4a, bota = o.bota ?? 0x2a2420;
    const quadril = 0.5 * s;
    const tronco = B.grupo(raiz, 0, quadril, 0);
    const pernas = [-1, 1].map(lado => {
      const p = B.grupo(raiz, lado * 0.11 * w * s, quadril, 0);
      if (!o.semPernas) {
        B.cil(p, 0.075 * w * s, 0.065 * w * s, 0.34 * s, calca, 0, -0.17 * s, 0);
        B.cil(p, 0.085 * w * s, 0.085 * w * s, 0.1 * s, bota, 0, -0.45 * s, 0.025 * s);
        B.cx(p, 0.14 * w * s, 0.06 * s, 0.22 * s, bota, 0, -0.5 * s, 0.07 * s, { linha: false });
      }
      return p;
    });
    B.cil(tronco, 0.2 * w * s, 0.16 * w * s, 0.5 * s, corpo, 0, 0.25 * s, 0);
    if (o.cinto !== false) B.cil(tronco, 0.17 * w * s, 0.17 * w * s, 0.06 * s, o.corCinto ?? 0x3a2a1a, 0, 0.03 * s, 0, { linha: false });
    const cabeca = B.grupo(tronco, 0, 0.5 * s, 0);
    B.cil(cabeca, 0.06 * s, 0.07 * s, 0.07 * s, pele, 0, 0.02 * s, 0, { linha: false });
    B.esf(cabeca, (o.cabeca || 0.17) * s, pele, 0, 0.2 * s, 0);
    const olhos = o.olhos ?? 0x1a1a22;
    [-1, 1].forEach(l => B.esf(cabeca, 0.025 * s, olhos, l * 0.065 * s, 0.22 * s, 0.15 * s, { linha: false, emissive: o.olhoBrilho ? olhos : 0, seg: 6 }));
    const bracos = [-1, 1].map(lado => {
      const b = B.grupo(tronco, lado * 0.26 * w * s, 0.44 * s, 0);
      B.esf(b, 0.085 * w * s, corpo, 0, 0, 0, { linha: false });
      B.cil(b, 0.06 * w * s, 0.05 * w * s, 0.36 * s, o.manga ?? pele, 0, -0.19 * s, 0);
      const mao = B.grupo(b, 0, -0.38 * s, 0);
      B.esf(mao, 0.06 * s, pele, 0, 0, 0, { linha: false });
      b.userData.mao = mao;
      return b;
    });
    return { tronco, cabeca, bracoE: bracos[0], bracoD: bracos[1], pernaE: pernas[0], pernaD: pernas[1], maoE: bracos[0].userData.mao, maoD: bracos[1].userData.mao, s, w };
  }

  /** Armas e objetos que se seguram (apontam para a frente/cima da mão). */
  const ARMAS = {
    espada(B, mao, o = {}) {
      const g = B.grupo(mao, 0, 0, 0.02); g.rotation.x = -1.35;
      B.cx(g, 0.05, 0.55 * (o.c || 1), 0.012, o.lamina ?? 0xdfe6f2, 0, 0.35, 0, { metal: 0.5, rough: 0.35, emissive: o.brilho || 0 });
      B.cx(g, 0.2, 0.04, 0.05, o.guarda ?? 0xd8a63a, 0, 0.07, 0);
      B.cil(g, 0.025, 0.025, 0.12, 0x4a2a14, 0, 0, 0, { linha: false });
      return g;
    },
    machado(B, mao, o = {}) {
      const g = B.grupo(mao, 0, 0, 0.02); g.rotation.x = -1.2;
      B.cil(g, 0.03, 0.03, 0.8 * (o.c || 1), 0x5a3a20, 0, 0.3, 0);
      B.cx(g, 0.3 * (o.l || 1), 0.24 * (o.l || 1), 0.045, o.lamina ?? 0x9aa4b4, 0.13, 0.62, 0, { metal: 0.4 });
      if (o.duplo) B.cx(g, 0.3 * (o.l || 1), 0.24 * (o.l || 1), 0.045, o.lamina ?? 0x9aa4b4, -0.13, 0.62, 0, { metal: 0.4 });
      return g;
    },
    martelo(B, mao, o = {}) {
      const g = B.grupo(mao, 0, 0, 0.02); g.rotation.x = -1.2;
      B.cil(g, 0.035, 0.035, 0.7, 0x5a3a20, 0, 0.28, 0);
      B.cx(g, 0.34, 0.2, 0.2, o.cabeca ?? 0x8a93a3, 0, 0.66, 0, { metal: 0.4 });
      return g;
    },
    clava(B, mao, o = {}) {
      const g = B.grupo(mao, 0, 0, 0.02); g.rotation.x = -1.15;
      B.cil(g, 0.05 * (o.g || 1), 0.03, 0.8 * (o.c || 1), o.cor ?? 0x7a5230, 0, 0.35, 0);
      B.esf(g, 0.13 * (o.g || 1), o.cor ?? 0x7a5230, 0, 0.78 * (o.c || 1), 0, { emissive: o.brilho || 0 });
      return g;
    },
    lanca(B, mao, o = {}) {
      const g = B.grupo(mao, 0, 0, 0.02); g.rotation.x = -1.4;
      B.cil(g, 0.022, 0.022, 1.15, 0x7a5230, 0, 0.35, 0, { seg: 6 });
      B.cone(g, 0.06, 0.24, o.ponta ?? 0xdfe6f2, 0, 1.05, 0, { seg: 6, metal: 0.4 });
      return g;
    },
    cajado(B, mao, o = {}) {
      const g = B.grupo(mao, 0, 0, 0); g.rotation.x = -0.25;
      B.cil(g, 0.025, 0.03, 1.25, 0x6a4a2a, 0, 0.3, 0, { seg: 6 });
      const orbe = B.esf(g, 0.1, o.orbe ?? 0x8fd0ff, 0, 0.98, 0, { emissive: o.orbe ?? 0x8fd0ff, brilho: 1.2, linha: false });
      B.tor(g, 0.11, 0.02, 0xd8a63a, 0, 0.98, 0, { rx: PI / 2, linha: false });
      g.userData.orbe = orbe;
      return g;
    },
    escudo(B, braco, o = {}) {
      const g = B.grupo(braco, o.x ?? -0.08, -0.22, 0.12);
      g.rotation.y = -PI / 2;
      B.cil(g, 0.24, 0.24, 0.05, o.cor ?? 0x4a70b8, 0, 0, 0, { rx: PI / 2, seg: 16, metal: 0.2 }).rotation.x = PI / 2;
      B.esf(g, 0.06, 0xd8a63a, 0, 0, 0.04, { linha: false });
      return g;
    },
    arco(B, mao, o = {}) {
      const g = B.grupo(mao, 0, 0, 0.03);
      B.tor(g, 0.4, 0.025, o.cor ?? 0x6a4a2a, 0, 0.1, 0, { arco: PI, rz: -PI / 2, seg: 14, linha: false });
      B.cil(g, 0.006, 0.006, 0.8, 0xe8e0c8, -0.0, 0.1, 0, { seg: 4, linha: false });
      g.rotation.y = PI / 2; g.rotation.z = 0.2;
      return g;
    },
  };

  /** Quadrúpede (lobo, cão...). Frente = +Z. */
  function quadrupede(B, raiz, o = {}) {
    const s = o.s || 1, cor = o.cor, clara = o.clara ?? cor, alt = (o.alt || 0.5) * s, comp = (o.comp || 0.9) * s;
    const corpo = B.grupo(raiz, 0, 0, 0);
    B.esf(corpo, 0.3 * s, cor, 0, alt + 0.12 * s, -comp * 0.18, { sx: 0.95, sy: 0.9, sz: comp * 1.7 / s });
    B.esf(corpo, 0.27 * s, clara, 0, alt + 0.14 * s, comp * 0.28, { sx: 0.95, sy: 1, sz: 1.1 });
    const pernas = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([lx, fz]) => {
      const p = B.grupo(raiz, lx * 0.17 * s, alt, fz * comp * 0.34);
      B.cil(p, 0.07 * s, 0.05 * s, alt * 0.9, cor, 0, -alt * 0.45, 0);
      B.cx(p, 0.1 * s, 0.05 * s, 0.14 * s, clara, 0, -alt * 0.95, 0.03 * s, { linha: false });
      return p;
    });
    const cabeca = B.grupo(corpo, 0, alt + 0.3 * s, comp * 0.52);
    B.esf(cabeca, 0.2 * s, cor, 0, 0, 0);
    B.cone(cabeca, 0.11 * s, 0.3 * s, clara, 0, -0.04 * s, 0.22 * s, { rx: PI / 2, seg: 7 });
    B.esf(cabeca, 0.035 * s, 0x14100c, 0, -0.04 * s, 0.37 * s, { linha: false, seg: 6 });
    [-1, 1].forEach(l => {
      B.cone(cabeca, 0.07 * s, 0.2 * s, cor, l * 0.12 * s, 0.2 * s, -0.04 * s, { seg: 4 });
      B.esf(cabeca, 0.032 * s, o.olho ?? 0xffe14d, l * 0.09 * s, 0.05 * s, 0.17 * s, { linha: false, emissive: o.olho ?? 0xffe14d, seg: 6 });
    });
    const cauda = B.grupo(corpo, 0, alt + 0.2 * s, -comp * 0.55);
    B.cone(cauda, 0.07 * s, 0.4 * s, clara, 0, 0.05 * s, -0.14 * s, { rx: -2.0, seg: 6 });
    return { tronco: corpo, cabeca, pernas, cauda, s };
  }

  /* ---------- Os modelos ---------- */
  const FEITOS = {
    /* ===== Heróis ===== */
    guerreiro(B, R) {
      const h = humano(B, R, { corpo: 0x7d8da8, manga: 0x7d8da8, calca: 0x3a4660, bota: 0x3a2e24, pele: 0xf0c9a0 });
      B.cil(h.tronco, 0.21, 0.17, 0.3, 0x9aa8c2, 0, 0.3, 0, { metal: 0.35, rough: 0.45 });
      B.esf(h.cabeca, 0.2, 0xaab6cc, 0, 0.21, 0, { sy: 0.95, metal: 0.4, rough: 0.4 });
      B.cx(h.cabeca, 0.08, 0.05, 0.05, 0x1a1a22, 0, 0.19, 0.19, { linha: false });
      B.cx(h.cabeca, 0.04, 0.16, 0.28, 0xd8363c, 0, 0.42, -0.02, { linha: false });
      const capa = B.cx(h.tronco, 0.38, 0.55, 0.04, 0x3a68c8, 0, 0.22, -0.17, { rx: 0.1 });
      ARMAS.espada(B, h.maoD); ARMAS.escudo(B, h.bracoE, { cor: 0x3a68c8 });
      return { altura: 1.5, p: h };
    },
    cacador(B, R) {
      const h = humano(B, R, { corpo: 0x6a8a4a, manga: 0x6a8a4a, calca: 0x5a4a30, bota: 0x3a2a1a, s: 0.97 });
      B.cone(h.cabeca, 0.24, 0.34, 0x3e6a34, 0, 0.27, -0.03, { seg: 8 });
      B.cil(h.cabeca, 0.2, 0.22, 0.12, 0x3e6a34, 0, 0.12, 0, { linha: false });
      B.cx(h.tronco, 0.14, 0.4, 0.1, 0x6a4a2a, 0.08, 0.28, -0.2, { rx: 0.2, rz: 0.2 });
      [0, 1, 2].forEach(i => B.cil(h.tronco, 0.01, 0.01, 0.16, 0xdfe6f2, 0.04 + i * 0.04, 0.5, -0.2, { rx: 0.2, rz: 0.2, linha: false, seg: 4 }));
      ARMAS.arco(B, h.maoE);
      return { altura: 1.5, p: h };
    },
    oraculo(B, R) {
      const h = humano(B, R, { corpo: 0x7a52c8, manga: 0x7a52c8, semPernas: true, s: 0.98 });
      B.cil(R, 0.17, 0.34, 0.55, 0x7a52c8, 0, 0.27, 0);
      B.cil(R, 0.18, 0.2, 0.05, 0xd8a63a, 0, 0.5, 0, { linha: false });
      B.cil(h.cabeca, 0.19, 0.2, 0.06, 0xf0e6ff, 0, 0.24, 0, { linha: false });
      B.tor(h.cabeca, 0.17, 0.02, 0xd8a63a, 0, 0.3, 0, { rx: PI / 2, linha: false });
      B.esf(h.cabeca, 0.03, 0x8fd0ff, 0, 0.3, 0.17, { emissive: 0x8fd0ff, linha: false, seg: 6 });
      B.cx(h.tronco, 0.4, 0.3, 0.03, 0xf0e6ff, 0, 0.12, 0.17, { linha: false });
      const c = ARMAS.cajado(B, h.maoD);
      return { altura: 1.5, p: h, anim: t => { c.userData.orbe.material.emissiveIntensity = 1 + Math.sin(t * 3) * 0.35; } };
    },

    /* ===== Valhala ===== */
    draugr(B, R) {
      const h = humano(B, R, { pele: 0x8aa4b0, corpo: 0x4a5a64, manga: 0x8aa4b0, calca: 0x3a4650, olhos: 0x7fe0ff, olhoBrilho: true });
      B.esf(h.cabeca, 0.2, 0x7c8590, 0, 0.21, 0, { sy: 0.8, metal: 0.4 });
      [-1, 1].forEach(l => B.cone(h.cabeca, 0.045, 0.22, 0xe8e0c8, l * 0.2, 0.3, 0, { rz: -l * 0.7, seg: 5 }));
      B.cx(h.tronco, 0.36, 0.1, 0.06, 0x2a3038, 0, 0.1, 0.17, { rz: 0.1, linha: false });
      ARMAS.machado(B, h.maoD, { duplo: false });
      return { altura: 1.5, p: h };
    },
    lobo_gelo(B, R) {
      const q = quadrupede(B, R, { cor: 0xc9e2f5, clara: 0xeaf5fc, olho: 0x4ab0ff, s: 1 });
      B.cone(q.tronco, 0.06, 0.22, 0x8fd0ff, 0, 0.9, -0.05, { seg: 4, emissive: 0x2a70c0, op: 0.9 });
      return { altura: 1.05, p: q };
    },
    valquiria(B, R) {
      const h = humano(B, R, { corpo: 0xe8eef8, manga: 0xe8eef8, calca: 0x5a6a88, pele: 0xf4d6bb, bota: 0xd8a63a });
      B.cil(h.tronco, 0.21, 0.17, 0.3, 0xc8d4ea, 0, 0.3, 0, { metal: 0.3 });
      B.esf(h.cabeca, 0.19, 0xd8a63a, 0, 0.23, -0.01, { sy: 0.85, metal: 0.4 });
      B.cx(h.cabeca, 0.5, 0.05, 0.07, 0xf5f8ff, 0, 0.3, 0, { linha: false });
      B.cx(h.cabeca, 0.1, 0.34, 0.06, 0xf4d85a, 0, 0.1, -0.15, { linha: false });
      const asas = [-1, 1].map(l => {
        const a = B.grupo(h.tronco, l * 0.12, 0.45, -0.18);
        const aa = B.grupo(a, 0, 0, 0); aa.rotation.z = l * 0.45;
        B.asa(aa, l, 0.75, 0.5, 0xf5f8ff, 0, 0.1, 0);
        B.asa(aa, l, 0.55, 0.36, 0xdfe8f5, 0, 0.02, 0);
        return a;
      });
      ARMAS.lanca(B, h.maoD); ARMAS.escudo(B, h.bracoE, { cor: 0xd8a63a });
      return { altura: 1.55, p: Object.assign(h, { asaE: asas[0], asaD: asas[1] }) };
    },
    troll_gelo(B, R) {
      const h = humano(B, R, { s: 1.12, larg: 1.55, pele: 0xcfe2ee, corpo: 0xb4cde0, manga: 0xcfe2ee, calca: 0x7a96b0, bota: 0x6a86a0, cabeca: 0.2, olhos: 0x2a70c0, olhoBrilho: true, cinto: false });
      h.tronco.rotation.x = 0.28;
      [[-0.12, 0.62, -0.1], [0.1, 0.7, -0.16], [0.02, 0.5, -0.2]].forEach(([x, y, z], i) => B.cone(h.tronco, 0.07, 0.34 - i * 0.04, 0x8fd0ff, x, y, z, { rx: -0.5, seg: 5, emissive: 0x2a70c0, op: 0.92 }));
      B.cx(h.cabeca, 0.22, 0.06, 0.05, 0x7a96b0, 0, 0.1, 0.17, { linha: false });
      ARMAS.clava(B, h.maoD, { cor: 0x9fd0f0, g: 1.4, c: 1.1, brilho: 0x2a70c0 });
      return { altura: 1.7, p: h };
    },
    fenrir(B, R) {
      const q = quadrupede(B, R, { cor: 0x3a3f52, clara: 0x59607a, olho: 0xff3b3b, s: 1.45, comp: 1.0 });
      for (let i = 0; i < 5; i++) B.cone(q.tronco, 0.06, 0.2, 0x262a38, 0, 0.85 + i * 0.01, 0.3 - i * 0.2, { seg: 4, rx: 0.3, linha: false });
      [-1, 1].forEach(l => B.cone(q.cabeca, 0.025, 0.14, 0xf5f0e0, l * 0.07, -0.18, 0.4, { rx: PI, seg: 4, linha: false }));
      B.cil(q.tronco, 0.02, 0.02, 0.18, 0xd8a63a, 0, 0.64, 0.78, { linha: false });
      return { altura: 1.5, p: q, escala: 1.0 };
    },

    /* ===== Olimpo ===== */
    harpia(B, R) {
      const h = humano(B, R, { s: 0.9, corpo: 0x8a5a3a, manga: 0x8a5a3a, calca: 0xd6a04a, bota: 0xd6a04a, pele: 0xe8c8a8 });
      B.esf(h.cabeca, 0.19, 0x5a3a24, 0, 0.23, -0.02, { sy: 0.8 });
      B.cone(h.cabeca, 0.04, 0.12, 0xe8b84a, 0, 0.17, 0.2, { rx: PI / 2, seg: 4, linha: false });
      const asas = [-1, 1].map(l => {
        const a = B.grupo(h.tronco, l * 0.16, 0.42, -0.1);
        const aa = B.grupo(a, 0, 0, 0); aa.rotation.z = l * 0.3;
        B.asa(aa, l, 1.0, 0.7, 0x7a4a2a, 0, 0.05, 0);
        B.asa(aa, l, 0.7, 0.5, 0xa0703c, 0, 0.1, 0);
        return a;
      });
      return { altura: 1.35, p: Object.assign(h, { asaE: asas[0], asaD: asas[1] }) };
    },
    satiro(B, R) {
      const h = humano(B, R, { corpo: 0x9a6a3a, manga: 0xe0b890, calca: 0x6a4020, bota: 0x2a1a10, pele: 0xe0b890, cinto: false, s: 1.0 });
      [-1, 1].forEach(l => {
        B.cone(h.cabeca, 0.07, 0.34, 0xe8e0c8, l * 0.1, 0.38, 0, { rz: -l * 0.5, seg: 6 });
        B.cone(h.cabeca, 0.05, 0.14, 0xe0b890, l * 0.2, 0.22, 0, { rz: -l * 1.4, seg: 4, linha: false });
      });
      B.cone(h.cabeca, 0.04, 0.14, 0x6a4020, 0, 0.0, 0.14, { rx: PI, seg: 5, linha: false });
      B.cil(h.tronco, 0.18, 0.2, 0.12, 0x6a4020, 0, 0.0, 0, { linha: false });
      ARMAS.clava(B, h.maoD, { cor: 0x7a5230, g: 1.1 });
      return { altura: 1.5, p: h };
    },
    ciclope(B, R) {
      const h = humano(B, R, { s: 1.15, larg: 1.4, pele: 0xd6a878, corpo: 0xa8845a, manga: 0xd6a878, calca: 0x7a5a38, bota: 0x4a3420, cabeca: 0.21, cinto: true });
      h.cabeca.children.filter(c => c.isMesh && c.geometry.type === 'SphereGeometry' && c.position.z > 0.1).forEach(c => (c.visible = false));
      B.esf(h.cabeca, 0.075, 0xf8f4ea, 0, 0.24, 0.17, { linha: false });
      B.esf(h.cabeca, 0.04, 0x2a8a50, 0, 0.24, 0.235, { linha: false, emissive: 0x2a8a50, seg: 6 });
      B.cx(h.cabeca, 0.22, 0.04, 0.05, 0x3a2a1a, 0, 0.33, 0.17, { rz: 0.1, linha: false });
      const pedra = B.esf(h.maoD, 0.14, 0x8a8a92, 0, 0.05, 0.1, { seg: 7 });
      return { altura: 1.75, p: h };
    },
    minotauro(B, R) {
      const h = humano(B, R, { s: 1.15, larg: 1.4, pele: 0x7a4a2a, corpo: 0x7a4a2a, manga: 0x7a4a2a, calca: 0x4a2a18, bota: 0x2a1a10, cinto: true, corCinto: 0xd8a63a });
      h.cabeca.children.forEach(c => { if (c.isMesh && c.geometry.type === 'SphereGeometry') c.visible = false; });
      B.esf(h.cabeca, 0.19, 0x5a3418, 0, 0.21, 0, { sz: 1.15 });
      B.cil(h.cabeca, 0.1, 0.12, 0.2, 0xe0c0a0, 0, 0.16, 0.22, { rx: PI / 2, seg: 8 });
      B.esf(h.cabeca, 0.03, 0x14100c, 0.04, 0.17, 0.33, { linha: false, seg: 6 }); B.esf(h.cabeca, 0.03, 0x14100c, -0.04, 0.17, 0.33, { linha: false, seg: 6 });
      [-1, 1].forEach(l => {
        B.cone(h.cabeca, 0.06, 0.38, 0xf0e6c8, l * 0.28, 0.36, 0, { rz: -l * 1.1, seg: 6 });
        B.cone(h.cabeca, 0.07, 0.14, 0x5a3418, l * 0.2, 0.3, -0.08, { rz: -l * 1.2, linha: false, seg: 4 });
        B.esf(h.cabeca, 0.03, 0xff4a2a, l * 0.09, 0.25, 0.17, { emissive: 0xff4a2a, linha: false, seg: 6 });
      });
      B.tor(h.cabeca, 0.07, 0.015, 0xd8a63a, 0, 0.1, 0.32, { linha: false });
      ARMAS.machado(B, h.maoD, { duplo: true, l: 1.5, c: 1.2 });
      return { altura: 1.8, p: h };
    },
    ares(B, R) {
      const h = humano(B, R, { s: 1.12, larg: 1.35, corpo: 0xa83a2a, manga: 0xb8862e, calca: 0x6a2018, bota: 0x3a2018, corCinto: 0xd8a63a });
      B.cil(h.tronco, 0.24, 0.19, 0.34, 0xc79a3a, 0, 0.3, 0, { metal: 0.5, rough: 0.35 });
      B.esf(h.tronco, 0.12, 0xc79a3a, -0.28, 0.46, 0, { metal: 0.5 }); B.esf(h.tronco, 0.12, 0xc79a3a, 0.28, 0.46, 0, { metal: 0.5 });
      B.esf(h.cabeca, 0.2, 0xc79a3a, 0, 0.21, 0, { sy: 0.95, metal: 0.5, rough: 0.35 });
      B.cx(h.cabeca, 0.1, 0.04, 0.05, 0x1a1a22, 0, 0.2, 0.19, { linha: false });
      B.cx(h.cabeca, 0.06, 0.18, 0.4, 0xc02a2a, 0, 0.45, -0.02, { linha: false });
      B.cx(h.tronco, 0.46, 0.7, 0.04, 0xa01818, 0, 0.1, -0.2, { rx: 0.08 });
      ARMAS.espada(B, h.maoD, { c: 1.3, lamina: 0xe8c8a0, guarda: 0xc79a3a }); ARMAS.escudo(B, h.bracoE, { cor: 0xa83a2a });
      return { altura: 1.75, p: h };
    },

    /* ===== Inferno ===== */
    alma_penada(B, R) {
      const corpo = B.grupo(R, 0, 0.3, 0);
      B.cone(corpo, 0.34, 1.0, 0x9ae0ff, 0, 0.45, 0, { op: 0.7, emissive: 0x4ab0ff, brilho: 0.5, seg: 12 });
      B.esf(corpo, 0.2, 0xd8f4ff, 0, 0.95, 0, { op: 0.85, emissive: 0x8fd0ff, brilho: 0.6 });
      [-1, 1].forEach(l => {
        B.esf(corpo, 0.04, 0x0a1a2a, l * 0.08, 1.0, 0.17, { linha: false, seg: 6 });
        const b = B.grupo(corpo, l * 0.22, 0.75, 0);
        B.cone(b, 0.06, 0.4, 0x9ae0ff, l * 0.05, -0.15, 0.05, { rx: -0.6, rz: l * 0.4, op: 0.6, emissive: 0x4ab0ff });
      });
      B.esf(corpo, 0.07, 0x0a1a2a, 0, 0.86, 0.19, { linha: false, sy: 1.5, seg: 6 });
      return { altura: 1.5, p: { flutua: corpo, tronco: corpo }, flutua: true };
    },
    diabrete(B, R) {
      const h = humano(B, R, { s: 0.78, pele: 0xd0402a, corpo: 0xd0402a, manga: 0xd0402a, calca: 0x8a2018, bota: 0x4a1410, olhos: 0xffe14d, olhoBrilho: true, cabeca: 0.2, cinto: false });
      [-1, 1].forEach(l => {
        B.cone(h.cabeca, 0.05, 0.22, 0x2a1410, l * 0.1, 0.4, 0.02, { rz: -l * 0.3, seg: 5 });
        B.cone(h.cabeca, 0.06, 0.2, 0xd0402a, l * 0.21, 0.24, 0, { rz: -l * 1.3, linha: false, seg: 4 });
      });
      const cauda = B.grupo(h.tronco, 0, 0.05, -0.15);
      B.cil(cauda, 0.025, 0.04, 0.5, 0xd0402a, 0, -0.1, -0.12, { rx: -0.8, seg: 5 });
      B.cone(cauda, 0.07, 0.16, 0x2a1410, 0, 0.12, -0.3, { rx: -1.1, seg: 4, linha: false });
      const fogo = B.esf(h.maoD, 0.1, 0xff9a2a, 0, 0.1, 0.12, { emissive: 0xff6a10, brilho: 1.3, linha: false });
      return { altura: 1.2, p: Object.assign(h, { cauda }), anim: t => { fogo.scale.setScalar(1 + Math.sin(t * 9) * 0.18); } };
    },
    cerbero(B, R) {
      const q = quadrupede(B, R, { cor: 0x2a1c18, clara: 0x4a342a, olho: 0xff7a2a, s: 1.15, comp: 1.0 });
      // as duas cabeças extras
      [-1, 1].forEach(l => {
        const c = B.grupo(q.tronco, l * 0.3, 0.72, 0.6);
        B.esf(c, 0.17, 0x2a1c18, 0, 0, 0);
        B.cone(c, 0.1, 0.26, 0x4a342a, 0, -0.03, 0.2, { rx: PI / 2, seg: 7 });
        B.cone(c, 0.06, 0.16, 0x2a1c18, l * 0.1, 0.17, -0.03, { seg: 4 });
        B.esf(c, 0.028, 0xff7a2a, l * 0.07, 0.04, 0.14, { emissive: 0xff7a2a, linha: false, seg: 6 });
        B.esf(c, 0.028, 0xff7a2a, -l * 0.0, 0.04, 0.15, { emissive: 0xff7a2a, linha: false, seg: 6 });
        c.rotation.z = -l * 0.25; c.rotation.y = l * 0.25;
      });
      B.cil(q.cauda, 0.03, 0.04, 0.5, 0x4a8a3a, 0, 0.1, -0.2, { rx: -1.0, seg: 5 });
      return { altura: 1.3, p: q };
    },
    demonio(B, R) {
      const h = humano(B, R, { pele: 0x8a2a5a, corpo: 0x8a2a5a, manga: 0x8a2a5a, calca: 0x4a1030, bota: 0x2a0a1a, olhos: 0xffe14d, olhoBrilho: true, larg: 1.15 });
      [-1, 1].forEach(l => B.cone(h.cabeca, 0.05, 0.3, 0x2a1410, l * 0.1, 0.4, 0.0, { rz: -l * 0.4, seg: 5 }));
      const asas = [-1, 1].map(l => {
        const a = B.grupo(h.tronco, l * 0.1, 0.44, -0.16);
        const aa = B.grupo(a, 0, 0, 0); aa.rotation.z = l * 0.5;
        B.asa(aa, l, 1.0, 0.75, 0x5a1a40, 0, 0.05, 0, { forma: 'morcego' });
        return a;
      });
      ARMAS.espada(B, h.maoD, { lamina: 0xff8a2a, brilho: 0xff5a10, c: 1.2 });
      return { altura: 1.6, p: Object.assign(h, { asaE: asas[0], asaD: asas[1] }) };
    },
    hades(B, R) {
      const h = humano(B, R, { s: 1.12, larg: 1.2, corpo: 0x1a1a2e, manga: 0x1a1a2e, calca: 0x12121f, pele: 0xb0b8d0, bota: 0x12121f, olhos: 0x4ab0ff, olhoBrilho: true });
      B.cil(R, 0.2, 0.36, 0.6, 0x1a1a2e, 0, 0.3, 0);
      B.cil(h.tronco, 0.22, 0.22, 0.12, 0x3a3a6a, 0, 0.5, 0, { linha: false });
      B.cx(h.tronco, 0.5, 0.75, 0.04, 0x20204a, 0, 0.08, -0.2, { rx: 0.08 });
      for (let i = 0; i < 5; i++) B.cone(h.cabeca, 0.035, 0.16 + (i % 2) * 0.06, 0xd8a63a, (i - 2) * 0.07, 0.4, 0, { seg: 4, linha: false });
      B.tor(h.cabeca, 0.18, 0.025, 0xd8a63a, 0, 0.36, 0, { rx: PI / 2, linha: false });
      const aura = B.esf(R, 0.55, 0x4a7aff, 0, 0.75, 0, { op: 0.13, emissive: 0x4a7aff, brilho: 0.6, linha: false });
      const bid = B.grupo(h.maoD, 0, 0, 0); bid.rotation.x = -0.3;
      B.cil(bid, 0.025, 0.025, 1.4, 0x3a3a50, 0, 0.35, 0, { seg: 6 });
      [-1, 0, 1].forEach(l => B.cone(bid, 0.04, 0.25, 0xa8c0ff, l * 0.1, 1.15, 0, { seg: 4, emissive: 0x4a7aff, linha: false }));
      B.cx(bid, 0.24, 0.03, 0.03, 0xa8c0ff, 0, 1.05, 0, { linha: false });
      return { altura: 1.85, p: h, anim: t => { aura.scale.setScalar(1 + Math.sin(t * 2) * 0.08); } };
    },

    /* ===== Duat ===== */
    escaravelho(B, R) {
      const c = B.grupo(R, 0, 0, 0);
      B.esf(c, 0.38, 0x1f6a7a, 0, 0.36, -0.05, { sx: 1.0, sy: 0.75, sz: 1.3, metal: 0.4, rough: 0.35 });
      B.cx(c, 0.012, 0.35, 0.6, 0x0f3a46, 0, 0.5, -0.05, { rx: 0.18, linha: false });
      B.esf(c, 0.2, 0x153f4a, 0, 0.33, 0.42, { sy: 0.85 });
      B.esf(c, 0.04, 0xffd34d, 0.08, 0.38, 0.58, { emissive: 0xffd34d, linha: false, seg: 6 }); B.esf(c, 0.04, 0xffd34d, -0.08, 0.38, 0.58, { emissive: 0xffd34d, linha: false, seg: 6 });
      [-1, 1].forEach(l => {
        B.cone(c, 0.04, 0.26, 0xd8a63a, l * 0.14, 0.3, 0.64, { rx: PI / 2, rz: l * 0.5, seg: 4 });
        [0.25, 0, -0.25].forEach(z => B.cil(c, 0.025, 0.02, 0.4, 0x153f4a, l * 0.42, 0.18, z, { rz: l * 1.0, seg: 5, linha: false }));
      });
      return { altura: 0.9, p: { tronco: c, balanca: c } };
    },
    mumia(B, R) {
      const h = humano(B, R, { pele: 0xe0d2aa, corpo: 0xe0d2aa, manga: 0xe0d2aa, calca: 0xd8c898, bota: 0xd8c898, olhos: 0x6aff9a, olhoBrilho: true, cinto: false });
      for (let i = 0; i < 4; i++) B.tor(h.tronco, 0.2 - i * 0.008, 0.022, 0xc8b88a, 0, 0.1 + i * 0.12, 0, { rx: PI / 2, rz: 0.3, linha: false, seg: 12 });
      B.esf(h.cabeca, 0.18, 0xe0d2aa, 0, 0.2, 0, { linha: false });
      B.tor(h.cabeca, 0.17, 0.02, 0xc8b88a, 0, 0.2, 0, { rx: PI / 2 + 0.3, linha: false, seg: 12 });
      B.tor(h.cabeca, 0.17, 0.02, 0xc8b88a, 0, 0.14, 0, { rx: PI / 2 - 0.3, linha: false, seg: 12 });
      B.cx(h.tronco, 0.05, 0.3, 0.02, 0xd8c898, 0.2, 0.0, 0.1, { rz: 0.1, linha: false });
      h.bracoE.rotation.x = -1.0; h.bracoD.rotation.x = -1.0; h.bracoE.userData.fixo = h.bracoD.userData.fixo = -1.0;
      return { altura: 1.5, p: h };
    },
    chacal(B, R) {
      const h = humano(B, R, { pele: 0x2a2a30, corpo: 0xd8a63a, manga: 0x2a2a30, calca: 0xe8d8a8, bota: 0xd8a63a, corCinto: 0xd8a63a, larg: 1.1 });
      h.cabeca.children.forEach(c => { if (c.isMesh && c.geometry.type === 'SphereGeometry') c.visible = false; });
      B.esf(h.cabeca, 0.15, 0x2a2a30, 0, 0.2, 0, {});
      B.cone(h.cabeca, 0.09, 0.34, 0x2a2a30, 0, 0.17, 0.2, { rx: PI / 2, seg: 6 });
      [-1, 1].forEach(l => { B.cone(h.cabeca, 0.06, 0.36, 0x2a2a30, l * 0.1, 0.45, -0.04, { seg: 4, rz: -l * 0.1 }); B.esf(h.cabeca, 0.03, 0xffd34d, l * 0.07, 0.25, 0.12, { emissive: 0xffd34d, linha: false, seg: 6 }); });
      B.cil(h.tronco, 0.22, 0.22, 0.08, 0xd8a63a, 0, 0.45, 0, { linha: false });
      B.cil(h.tronco, 0.16, 0.2, 0.1, 0xe8d8a8, 0, -0.02, 0, { linha: false });
      ARMAS.lanca(B, h.maoD, { ponta: 0xd8a63a });
      return { altura: 1.6, p: h };
    },
    serpente(B, R) {
      const c = B.grupo(R, 0, 0, 0);
      [[0.42, 0.13, 0x3a6a2a], [0.34, 0.31, 0x4a8a3a], [0.26, 0.47, 0x3a6a2a]].forEach(([r, y, cor]) => B.tor(c, r, 0.14, cor, 0, y, 0, { rx: PI / 2, seg: 18 }));
      B.cil(c, 0.2, 0.2, 0.1, 0xe8d890, 0, 0.1, 0.0, { linha: false, op: 1 }).visible = false;
      B.cil(c, 0.14, 0.17, 0.5, 0x4a8a3a, 0, 0.72, 0, { seg: 10 });
      const cab = B.grupo(c, 0, 1.0, 0.04);
      B.esf(cab, 0.2, 0x4a8a3a, 0, 0, 0, { sx: 1.35, sz: 0.55 });
      B.esf(cab, 0.14, 0x3a6a2a, 0, 0, 0.1, { sx: 1.0, sy: 0.9, sz: 1.2 });
      [-1, 1].forEach(l => { B.esf(cab, 0.035, 0xffd34d, l * 0.07, 0.05, 0.2, { emissive: 0xffd34d, linha: false, seg: 6 }); B.cone(cab, 0.022, 0.12, 0xf5f0e0, l * 0.04, -0.1, 0.2, { rx: PI, seg: 4, linha: false }); });
      B.cx(cab, 0.03, 0.02, 0.16, 0xd8363c, 0, -0.07, 0.3, { linha: false });
      B.cone(c, 0.07, 0.4, 0x4a8a3a, 0.45, 0.09, -0.3, { rz: -PI / 2 + 0.2, rx: 0.5, seg: 6 });
      return { altura: 1.3, p: { tronco: c, balanca: c, cabeca: cab } };
    },
    set(B, R) {
      const h = humano(B, R, { s: 1.15, larg: 1.3, pele: 0x9a2a2a, corpo: 0x7a1a1a, manga: 0x9a2a2a, calca: 0xd8a63a, bota: 0x3a1a1a, corCinto: 0xd8a63a, olhos: 0xffe14d, olhoBrilho: true });
      h.cabeca.children.forEach(c => { if (c.isMesh && c.geometry.type === 'SphereGeometry') c.visible = false; });
      B.esf(h.cabeca, 0.17, 0x9a2a2a, 0, 0.2, 0, {});
      B.cone(h.cabeca, 0.07, 0.4, 0x9a2a2a, 0, 0.16, 0.26, { rx: PI / 2 + 0.35, seg: 6 });
      [-1, 1].forEach(l => { B.cx(h.cabeca, 0.07, 0.34, 0.03, 0x9a2a2a, l * 0.12, 0.42, -0.06, { rz: -l * 0.2 }); B.esf(h.cabeca, 0.03, 0xffe14d, l * 0.08, 0.25, 0.13, { emissive: 0xffe14d, linha: false, seg: 6 }); });
      B.cil(h.tronco, 0.24, 0.2, 0.1, 0xd8a63a, 0, 0.44, 0, { linha: false });
      B.cx(h.tronco, 0.5, 0.7, 0.04, 0x5a1010, 0, 0.1, -0.2, { rx: 0.08 });
      const cet = ARMAS.cajado(B, h.maoD, { orbe: 0xff6a2a });
      B.cx(cet, 0.2, 0.05, 0.05, 0xd8a63a, 0.08, 1.08, 0, { linha: false });
      return { altura: 1.8, p: h, anim: t => { cet.userData.orbe.material.emissiveIntensity = 1 + Math.sin(t * 4) * 0.4; } };
    },

    /* ===== Caos ===== */
    caos(B, R) {
      const c = B.grupo(R, 0, 1.0, 0);
      const nucleo = B.esf(c, 0.45, 0x4a1d96, 0, 0, 0, { emissive: 0x7a3ae0, brilho: 0.9, metal: 0.3, rough: 0.3 });
      B.esf(c, 0.2, 0xffffff, 0, 0, 0, { emissive: 0xe0c8ff, brilho: 1.4, linha: false });
      const aneis = [0, 1, 2].map(i => { const a = B.tor(c, 0.7 + i * 0.12, 0.035, [0x9a6bf0, 0x7a3ae0, 0xc8a0ff][i], 0, 0, 0, { rx: i * 1.0, ry: i * 0.6, emissive: 0x5a2ab0, linha: false, seg: 24 }); return a; });
      const frags = [];
      for (let i = 0; i < 6; i++) { const f = B.octa(c, 0.11 + (i % 3) * 0.03, 0xb890ff, 0, 0, 0, { emissive: 0x7a3ae0, linha: false }); f.userData.i = i; frags.push(f); }
      const chao = B.cone(R, 0.5, 0.5, 0x1a0a30, 0, 0.22, 0, { rx: PI, op: 0.55, emissive: 0x5a2ab0, brilho: 0.4, linha: false });
      return { altura: 2.1, p: { flutua: c, tronco: c }, flutua: true,
        anim: t => { aneis.forEach((a, i) => { a.rotation.x = i + t * (0.5 + i * 0.25); a.rotation.y = i * 0.6 + t * 0.4; }); frags.forEach(f => { const a = t * 0.9 + f.userData.i * 1.05; const r = 0.95 + (f.userData.i % 2) * 0.2; f.position.set(Math.cos(a) * r, Math.sin(a * 1.3) * 0.5, Math.sin(a) * r); f.rotation.x = t; f.rotation.y = t * 1.3; }); nucleo.scale.setScalar(1 + Math.sin(t * 2.4) * 0.06); } };
    },

    /* ===== Estruturas ===== */
    torre_gelo(B, R) {
      B.cil(R, 0.45, 0.5, 0.2, 0x8a9ab0, 0, 0.1, 0, { seg: 8 });
      [[0, 0.2, 0, 0.3, 1.55], [0.28, 0.2, 0.1, 0.18, 0.95], [-0.26, 0.2, -0.08, 0.2, 1.05], [0.05, 0.2, -0.3, 0.14, 0.7]].forEach(([x, y, z, r, hh]) => {
        B.cil(R, 0, r, hh, 0xa8e0ff, x, y + hh / 2, z, { seg: 6, emissive: 0x3a90d0, brilho: 0.55, op: 0.92 });
      });
      return { altura: 1.7, p: {}, estrutura: true };
    },
    altar(B, R) {
      B.cx(R, 0.95, 0.18, 0.95, 0xcfc8b4, 0, 0.09, 0);
      B.cx(R, 0.75, 0.45, 0.75, 0xe8e2d0, 0, 0.4, 0);
      B.cx(R, 0.9, 0.1, 0.9, 0xf5f0e2, 0, 0.7, 0);
      [-1, 1].forEach(l => [-1, 1].forEach(m => B.cil(R, 0.07, 0.08, 0.5, 0xe8e2d0, l * 0.36, 0.95, m * 0.36)));
      B.cx(R, 0.2, 0.05, 0.2, 0xd8a63a, 0, 0.78, 0);
      const f = B.cone(R, 0.17, 0.55, 0xff9a2a, 0, 1.08, 0, { emissive: 0xff6a10, brilho: 1.2, linha: false, seg: 6 });
      return { altura: 1.5, p: {}, estrutura: true, anim: t => { f.scale.set(1 + Math.sin(t * 8) * 0.12, 1 + Math.sin(t * 6 + 1) * 0.18, 1 + Math.sin(t * 7) * 0.12); } };
    },
    portal_fogo(B, R) {
      B.cx(R, 1.0, 0.18, 0.5, 0x2a1a1a, 0, 0.09, 0);
      const aro = B.tor(R, 0.62, 0.12, 0x3a2220, 0, 0.88, 0, { seg: 18 });
      [0, 1, 2, 3, 4, 5].forEach(i => { const a = i / 6 * PI * 2; B.cone(R, 0.06, 0.2, 0xff5a1a, Math.cos(a) * 0.7, 0.88 + Math.sin(a) * 0.7, 0, { rz: a - PI / 2, emissive: 0xff3a00, linha: false, seg: 4 }); });
      const interior = B.cil(R, 0.55, 0.55, 0.04, 0xff7a2a, 0, 0.88, 0, { rx: PI / 2, emissive: 0xff5a10, brilho: 1.1, seg: 20, linha: false });
      return { altura: 1.7, p: {}, estrutura: true, anim: t => { interior.material.emissiveIntensity = 0.9 + Math.sin(t * 5) * 0.3; interior.rotation.y = t; } };
    },
    estela(B, R) {
      B.cx(R, 0.85, 0.16, 0.5, 0x8a7a50, 0, 0.08, 0);
      B.cx(R, 0.6, 1.4, 0.24, 0xc9a86a, 0, 0.86, 0);
      B.cil(R, 0.3, 0.3, 0.24, 0xc9a86a, 0, 1.56, 0, { rx: PI / 2, seg: 14 });
      [[0, 0.5], [0.12, 0.8], [-0.12, 1.05], [0, 1.3]].forEach(([x, y]) => B.cx(R, 0.14, 0.14, 0.02, 0x2a8a83, x, y, 0.13, { emissive: 0x2a8a83, brilho: 0.8, linha: false }));
      B.esf(R, 0.08, 0xffd34d, 0, 1.56, 0.14, { emissive: 0xffd34d, linha: false });
      return { altura: 1.9, p: {}, estrutura: true };
    },
    cristal_caos(B, R) {
      B.cil(R, 0.5, 0.55, 0.16, 0x1a0a30, 0, 0.08, 0, { seg: 8 });
      const cs = [[0, 1.0, 0, 0.3, 1.9, 0x9a6bf0], [0.32, 0.5, 0.1, 0.2, 1.1, 0x7a4bd0], [-0.3, 0.55, -0.1, 0.22, 1.2, 0x7a4bd0], [0.05, 0.4, 0.3, 0.16, 0.8, 0xb890ff]].map(([x, y, z, r, hh, cor], i) =>
        B.cil(R, 0, r, hh, cor, x, 0.16 + hh / 2, z, { seg: 6, emissive: 0x5a2ab0, brilho: 0.8, rx: i ? (i % 2 ? 0.15 : -0.12) : 0 }));
      const an = B.tor(R, 0.62, 0.025, 0xc8a0ff, 0, 1.0, 0, { rx: PI / 2, emissive: 0x7a3ae0, linha: false, seg: 24 });
      return { altura: 2.1, p: {}, estrutura: true, anim: t => { an.rotation.z = t * 0.8; an.position.y = 1.0 + Math.sin(t * 1.6) * 0.12; cs[0].material.emissiveIntensity = 0.8 + Math.sin(t * 2) * 0.3; } };
    },
  };

  /* ---------- Criar e animar ---------- */
  /** Monta o modelo de `id` (o mesmo id dos inimigos/classes). Devolve null se não existir. */
  function criar(id) {
    const f = FEITOS[id];
    if (!f) return null;
    const B = construtor();
    const raiz = new THREE.Group();               // gira para encarar o alvo
    const corpo = new THREE.Group();              // inclina e balança
    raiz.add(corpo);
    const r = f(B, corpo) || {};
    const p = r.p || {};
    for (const k of ['bracoD', 'bracoE']) if (p[k]) p[k].userData.rx0 = p[k].rotation.x;
    return { raiz, corpo, partes: p, altura: r.altura || 1.5, mats: B.todos, anim: r.anim || null, flutua: !!r.flutua, estrutura: !!r.estrutura, fase: Math.random() * 6.28, yaw: 0, alvoYaw: 0 };
  }

  /** Um quadro de animação. `o`: { andando, golpe (0..1 ou null), tempo, dt }. */
  function animar(m, o) {
    const t = o.tempo + m.fase, p = m.partes;
    const resp = Math.sin(t * 2.2);
    // olhar para o alvo (gira pelo caminho mais curto)
    let d = m.alvoYaw - m.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    m.yaw += d * Math.min(1, o.dt * 10);
    m.raiz.rotation.y = m.yaw;
    const golpe = o.golpe != null ? Math.sin(Math.min(1, o.golpe) * PI) : 0;
    m.corpo.rotation.x = golpe * 0.28;
    if (m.estrutura) { if (m.anim) m.anim(t, o.dt); return; }
    m.corpo.position.y = m.flutua ? 0.12 + Math.sin(t * 1.6) * 0.07 : 0;
    if (p.tronco && !m.flutua) p.tronco.scale.y = 1 + resp * 0.018;
    const bal = o.andando ? Math.sin(t * 13) : 0;
    if (p.pernaD) { p.pernaD.rotation.x = bal * 0.7; p.pernaE.rotation.x = -bal * 0.7; }
    if (p.pernas) p.pernas.forEach((pe, i) => { pe.rotation.x = bal * 0.6 * (i === 0 || i === 3 ? 1 : -1); });
    if (p.bracoD) {
      const b0 = p.bracoD.userData.rx0 || 0;
      p.bracoD.rotation.x = p.bracoD.userData.fixo !== undefined ? p.bracoD.userData.fixo : b0 - bal * 0.5 - golpe * 2.1 + resp * 0.03;
      p.bracoE.rotation.x = p.bracoE.userData.fixo !== undefined ? p.bracoE.userData.fixo : (p.bracoE.userData.rx0 || 0) + bal * 0.5 - resp * 0.03 - golpe * 0.5;
    }
    if (p.asaD) { const f = Math.sin(t * (o.andando ? 12 : 4.5)) * 0.35; p.asaD.rotation.z = -0.15 - f; p.asaE.rotation.z = 0.15 + f; }
    if (p.cauda) p.cauda.rotation.y = Math.sin(t * 3.2) * 0.35;
    if (p.balanca) p.balanca.rotation.y = Math.sin(t * (o.andando ? 8 : 1.4)) * 0.25;
    if (p.cabeca && p.cabeca.rotation) p.cabeca.rotation.y = Math.sin(t * 0.8) * 0.12;
    if (m.anim) m.anim(t, o.dt);
  }

  /** Pisca a miniatura de uma cor (dano = vermelho, cura = verde). k de 0 a 1. */
  function brilho(m, r, g, b, k) {
    for (const mt of m.mats) {
      if (!mt.emissive || !mt.userData.emBase) continue;
      if (k <= 0) { mt.emissive.copy(mt.userData.emBase); mt.emissiveIntensity = mt.userData.intBase; }
      else { mt.emissive.setRGB(r, g, b); mt.emissiveIntensity = Math.max(mt.userData.intBase, k * 1.4); }
    }
  }
  /** Some aos poucos (k de 0 = inteira a 1 = invisível). */
  function esmaecer(m, k) {
    for (const mt of m.mats) { mt.transparent = true; mt.opacity = (mt.userData.opBase ?? 1) * (1 - k); mt.needsUpdate = false; }
  }
  function liberar(m) { m.raiz.traverse(o => { if (o.geometry && !o.geometry.userData.compartilhada) o.geometry.dispose(); }); m.mats.forEach(x => x.dispose()); }

  return { criar, animar, brilho, esmaecer, liberar, existe: id => !!FEITOS[id], ids: () => Object.keys(FEITOS) };
})();
