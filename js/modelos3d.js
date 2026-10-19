'use strict';
/* ============================================================
   MINIATURAS 3D — cada herói, inimigo, chefe e estrutura é "esculpido" aqui, como uma miniatura pintada de mesa.

   Como funciona (para quem está começando):
   - cada modelo é uma função `(B, R) => ({ altura, p, anim })` que monta as peças dentro de `R`
     e devolve os "pivôs" que se mexem (braços, pernas, asas...) em `p`;
   - `B` é a caixa de ferramentas: formas básicas (cil, esf, cx, cone, tor), formas orgânicas (blob, tubo, chifre, torno,
     placa), detalhes (olho, dentes, garras) e materiais com textura (couro, escamas, pelo, pedra, osso, metal...);
   - `Modelos3D.criar(id)` monta o modelo; `Modelos3D.animar(...)` o faz respirar, andar e golpear;
   - o desenho olha para +Z ("a frente"). O mapa gira o modelo para encarar o alvo;
   - as peças são fundidas em poucas malhas (para o celular aguentar). Se você anima uma peça direto
     (ex.: uma chama que pulsa), marque-a com `B.vivo(peça)` para ela NÃO ser fundida.
   Os modelos de cada reino ficam em js/modelos3d/*.js e podem ser trocados por arquivos .glb prontos (veja docs/MINIATURAS.md).
   ============================================================ */
const Modelos3D = (() => {
  const PI = Math.PI;
  const FEITOS = {};                               // id -> função que monta o modelo
  const glbs = new Map();                          // id -> modelo .glb já carregado (se existir em modelos/)

  /* ---------- Ruído e texturas pintadas por código ---------- */
  // as texturas são em tons de cinza: multiplicam a cor do material (cor = tinta, textura = relevo/sujeira)
  const hash2 = (x, y, s) => { const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); };
  const hash3 = (x, y, z, s) => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.19) * 43758.5453; return h - Math.floor(h); };
  const suave = t => t * t * (3 - 2 * t);
  /** ruído de valor 2D que "emenda" (px, py = período), para a textura repetir sem costura */
  function rn(x, y, px, py, s) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = suave(x - xi), fy = suave(y - yi);
    const mx = n => ((n % px) + px) % px, my = n => ((n % py) + py) % py;
    const a = hash2(mx(xi), my(yi), s), b = hash2(mx(xi + 1), my(yi), s), c = hash2(mx(xi), my(yi + 1), s), d = hash2(mx(xi + 1), my(yi + 1), s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(u, v, fx, fy, s, oit = 4) {
    let t = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oit; i++) { t += a * rn(u * fx * f, v * fy * f, fx * f, fy * f, s + i * 7); n += a; a *= 0.5; f *= 2; }
    return t / n;
  }
  /** ruído de valor 3D (para amassar as formas orgânicas) */
  function rn3(x, y, z, s) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = suave(x - xi), fy = suave(y - yi), fz = suave(z - zi);
    const h = (a, b, c) => hash3(xi + a, yi + b, zi + c, s), l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(0, 0, 0), h(1, 0, 0), fx), l(h(0, 1, 0), h(1, 1, 0), fx), fy), l(l(h(0, 0, 1), h(1, 0, 1), fx), l(h(0, 1, 1), h(1, 1, 1), fx), fy), fz);
  }
  /** células (Voronoi) para escamas, rachaduras de pedra etc.: devolve [distância ao ponto mais próximo, ao 2º mais próximo] */
  function celulas(u, v, n, s) {
    const x = u * n, y = v * n, xi = Math.floor(x), yi = Math.floor(y);
    let f1 = 9, f2 = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = xi + i, cy = yi + j, wx = ((cx % n) + n) % n, wy = ((cy % n) + n) % n;
      const px = cx + hash2(wx, wy, s), py = cy + hash2(wx, wy, s + 5);
      const d = Math.hypot(x - px, y - py);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    return [f1, f2];
  }
  const PADROES = {
    // cada função devolve 0..1 (claro = alto) para o ponto (u, v) da textura
    pele: (u, v) => 0.25 + fbm(u, v, 4, 4, 1) * 0.65 + (hash2(Math.floor(u * 90), Math.floor(v * 90), 3) < 0.05 ? -0.2 : 0),
    couro: (u, v) => { const r = 1 - Math.abs(fbm(u, v, 6, 6, 9) * 2 - 1); return 0.3 + r * 0.45 + fbm(u, v, 14, 14, 4, 2) * 0.25; },
    escamas: (u, v) => { const [f1, f2] = celulas(u, v, 9, 11); return 0.25 + Math.min(1, (f2 - f1) * 3.2) * 0.45 + (1 - Math.min(1, f1 * 1.5)) * 0.3; },
    pelo: (u, v) => 0.3 + rn(u * 24, v * 3, 24, 3, 2) * 0.4 + fbm(u, v, 8, 4, 6) * 0.3,
    pedra: (u, v) => { const [f1, f2] = celulas(u, v, 5, 21); return 0.2 + fbm(u, v, 5, 5, 31) * 0.5 + Math.min(1, (f2 - f1) * 5) * 0.3; },
    osso: (u, v) => 0.5 + fbm(u, v, 3, 3, 41) * 0.4 + (hash2(Math.floor(u * 40), Math.floor(v * 40), 8) < 0.03 ? -0.35 : 0),
    tecido: (u, v) => 0.35 + fbm(u, v, 6, 6, 51, 3) * 0.55 + Math.sin(u * PI * 2 * 24) * Math.sin(v * PI * 2 * 24) * 0.05,
    metal: (u, v) => 0.55 + rn(u * 3, v * 32, 3, 32, 61) * 0.25 + fbm(u, v, 4, 4, 62, 3) * 0.2,
    carne: (u, v) => { const r = 1 - Math.abs(fbm(u, v, 5, 5, 71) * 2 - 1); return 0.35 + fbm(u, v, 3, 3, 72) * 0.35 + r * 0.3; },
    cristal: (u, v) => 0.6 + fbm(u, v, 3, 3, 81, 2) * 0.25 + Math.abs(Math.sin((u + v) * PI * 6)) * 0.15,
    musgo: (u, v) => 0.3 + fbm(u, v, 7, 7, 91, 5) * 0.7,
  };
  const texBase = new Map(), texRep = new Map();
  /** Devolve { map, bump } da textura `nome` repetida `rep` vezes (as texturas são criadas só quando usadas). */
  function textura(nome, rep = 1) {
    if (!PADROES[nome] || typeof document === 'undefined') return null;
    const k = nome + '|' + rep;
    if (texRep.has(k)) return texRep.get(k);
    if (!texBase.has(nome)) {
      const N = 128, f = PADROES[nome];
      const cm = document.createElement('canvas'); cm.width = cm.height = N;
      const cb = document.createElement('canvas'); cb.width = cb.height = N;
      const gm = cm.getContext('2d'), gb = cb.getContext('2d'), im = gm.createImageData(N, N), ib = gb.createImageData(N, N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const v = Math.max(0, Math.min(1, f(i / N, j / N))), o = (j * N + i) * 4;
        const m = Math.round(185 + v * 70), b = Math.round(v * 255);
        im.data[o] = im.data[o + 1] = im.data[o + 2] = m; im.data[o + 3] = 255;
        ib.data[o] = ib.data[o + 1] = ib.data[o + 2] = b; ib.data[o + 3] = 255;
      }
      gm.putImageData(im, 0, 0); gb.putImageData(ib, 0, 0);
      texBase.set(nome, { cm, cb });
    }
    const { cm, cb } = texBase.get(nome);
    const mk = c => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 4; return t; };
    const r = { map: mk(cm), bump: mk(cb) };
    texRep.set(k, r);
    return r;
  }

  /* ---------- Geometrias orgânicas ---------- */
  /** Tubo que acompanha uma curva (lista de pontos [x,y,z]) com espessura variável (lista de raios, do começo ao fim). */
  function tuboGeo(pontos, raios, seg = 18, rad = 9) {
    const curva = new THREE.CatmullRomCurve3(pontos.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    const fr = curva.computeFrenetFrames(seg, false);
    const raio = t => { const x = t * (raios.length - 1), i = Math.min(raios.length - 2, Math.floor(x)); return raios[i] + (raios[i + 1] - raios[i]) * (x - i); };
    const pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, P = curva.getPointAt(t), r = raio(t), N = fr.normals[i], Bn = fr.binormals[i];
      for (let j = 0; j <= rad; j++) {
        const a = (j / rad) * PI * 2, c = Math.cos(a), s = Math.sin(a);
        const nx = c * N.x + s * Bn.x, ny = c * N.y + s * Bn.y, nz = c * N.z + s * Bn.z;
        pos.push(P.x + r * nx, P.y + r * ny, P.z + r * nz); nor.push(nx, ny, nz); uv.push(t * 2, j / rad);
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j, b = a + rad + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }
  /** Esfera "amassada" por ruído: serve para corpos, rochas, cabeças e cogumelos que não parecem uma bola perfeita. */
  function blobGeo(r, amp = 0.1, freq = 2, seed = 1, seg = 22) {
    const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75));
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = v.clone().normalize(), d = (rn3(n.x * freq + 5, n.y * freq + 5, n.z * freq + 5, seed) - 0.5) * 2 * amp * r;
      p.setXYZ(i, v.x + n.x * d, v.y + n.y * d, v.z + n.z * d);
    }
    g.computeVertexNormals();
    return g;
  }
  /** Contorno de miniatura: cópia levemente maior (espessura fixa em volta), pintada de escuro por trás. */
  function contornoGeo(geo, esp = 0.022) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
    const k = e => Math.min(1.6, 1 + esp / Math.max(0.0001, e / 2));
    const g = geo.clone(); g.translate(-c.x, -c.y, -c.z); g.scale(k(s.x), k(s.y), k(s.z)); g.translate(c.x, c.y, c.z);
    return g;
  }
  function placaGeo(w, h, d, raio = 0.04, bisel = 0.02) {
    const sh = new THREE.Shape(), x = -w / 2, y = -h / 2, r = Math.min(raio, w / 2.2, h / 2.2);
    sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r);
    sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h); sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r);
    sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 2, curveSegments: 5 });
    g.translate(0, 0, -d / 2);
    return g;
  }
  /** junta várias geometrias numa só (todas viram "sem índice" e com position/normal/uv) */
  function unir(geos) {
    const ng = geos.map(g => (g.index ? g.toNonIndexed() : g));
    let n = 0; ng.forEach(g => (n += g.attributes.position.count));
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    for (const g of ng) {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      o += c;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return out;
  }

  /* ---------- Ferramentas de montagem ---------- */
  /** Cria um "construtor": guarda os materiais deste modelo (cada miniatura tem os seus, para piscar/sumir sozinha). */
  function construtor() {
    const mats = new Map(), todos = [];
    const linhaMat = new THREE.MeshBasicMaterial({ color: 0x0b0912, side: THREE.BackSide });
    todos.push(linhaMat);
    /** Material. Opções: rough, metal, emissive (cor que brilha), brilho (força), op (transparência), dupla (2 lados),
     *  tex ('pele','couro','escamas','pelo','pedra','osso','tecido','metal','carne','cristal','musgo'), rep (repetição), relevo (força). */
    function mat(cor, o = {}) {
      const k = [cor, o.emissive || 0, o.op || 1, o.metal || 0, o.rough ?? '', o.tex || '', o.rep || 1, o.relevo || '', o.dupla ? 1 : 0, o.brilho || ''].join('|');
      if (!mats.has(k)) {
        const t = o.tex ? textura(o.tex, o.rep || 1) : null;
        const m = new THREE.MeshStandardMaterial({
          color: cor, roughness: o.rough ?? 0.7, metalness: o.metal || 0, envMapIntensity: o.metal ? 0.9 : 0.3,
          emissive: o.emissive || 0x000000, emissiveIntensity: o.emissive ? (o.brilho ?? 0.9) : 0,
          transparent: (o.op || 1) < 1, opacity: o.op || 1, side: o.dupla ? THREE.DoubleSide : THREE.FrontSide,
        });
        if (t) { m.map = t.map; m.bumpMap = t.bump; m.bumpScale = o.relevo ?? 0.06; }
        m.userData.emBase = new THREE.Color(o.emissive || 0x000000); m.userData.opBase = o.op || 1; m.userData.intBase = m.emissiveIntensity;
        mats.set(k, m); todos.push(m);
      }
      return mats.get(k);
    }
    /** Põe uma peça no `pai`. Opções: rx/ry/rz (giro), sx/sy/sz (esticar), linha (contorno), + as do material (mat). */
    function peca(pai, geo, cor, x, y, z, o = {}, tam = 1) {
      const m = new THREE.Mesh(geo, mat(cor, o));
      m.position.set(x, y, z);
      if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
      if (o.sx || o.sy || o.sz) m.scale.set(o.sx || 1, o.sy || 1, o.sz || 1);
      if (o.linha !== false && tam > 0.1 && !o.op) { const l = new THREE.Mesh(contornoGeo(geo), linhaMat); l.userData.contorno = true; m.add(l); }
      pai.add(m);
      return m;
    }
    const api = {
      mat, todos, linhaMat,
      /** marca uma peça que você anima direto (ela não é fundida com as outras) */
      vivo(m) { m.userData.vivo = true; return m; },
      grupo(pai, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); pai.add(g); return g; },
      /* -- formas básicas -- */
      cil(pai, rt, rb, h, cor, x = 0, y = 0, z = 0, o = {}) { return peca(pai, new THREE.CylinderGeometry(rt, rb, h, o.seg || 12), cor, x, y, z, o, Math.max(rt, rb, h / 2)); },
      cone(pai, r, h, cor, x = 0, y = 0, z = 0, o = {}) { return peca(pai, new THREE.CylinderGeometry(0, r, h, o.seg || 10), cor, x, y, z, o, Math.max(r, h / 2)); },
      esf(pai, r, cor, x = 0, y = 0, z = 0, o = {}) { return peca(pai, new THREE.SphereGeometry(r, o.seg || 16, o.seg ? Math.max(4, o.seg - 4) : 12), cor, x, y, z, o, r); },
      cx(pai, w, h, d, cor, x = 0, y = 0, z = 0, o = {}) { return peca(pai, new THREE.BoxGeometry(w, h, d), cor, x, y, z, o, Math.max(w, h, d) / 1.6); },
      tor(pai, R, r, cor, x = 0, y = 0, z = 0, o = {}) { return peca(pai, new THREE.TorusGeometry(R, r, 8, o.seg || 20, o.arco || PI * 2), cor, x, y, z, o, R); },
      octa(pai, r, cor, x = 0, y = 0, z = 0, o = {}) { return peca(pai, new THREE.OctahedronGeometry(r, o.detalhe || 0), cor, x, y, z, o, r); },
      /* -- formas orgânicas -- */
      /** esfera amassada por ruído (opções: amp = quanto amassa, freq = tamanho das amassadas, seed) */
      blob(pai, r, cor, x = 0, y = 0, z = 0, o = {}) { return peca(pai, blobGeo(r, o.amp ?? 0.12, o.freq ?? 2, o.seed ?? 1, o.seg || 22), cor, x, y, z, o, r); },
      /** tubo afilado seguindo pontos [[x,y,z],...] com raios [r0, r1, ...]. Serve para cauda, pescoço, tentáculo, braço, chifre. */
      tubo(pai, pontos, raios, cor, o = {}) {
        const g = new THREE.Group(); pai.add(g);
        const corpo = peca(g, tuboGeo(pontos, raios, o.seg || 18, o.rad || 9), cor, 0, 0, 0, { ...o, linha: false }, 0);
        if (o.linha !== false && !o.op && Math.max(...raios) > 0.03) {   // contorno certo: o mesmo tubo, um pouco mais grosso
          const l = new THREE.Mesh(tuboGeo(pontos, raios.map(r => r + 0.016), o.seg || 18, o.rad || 9), linhaMat); l.userData.contorno = true; corpo.add(l);
        }
        if (o.pontas !== false) {
          const a = pontos[0], z = pontos[pontos.length - 1];
          if (raios[0] > 0.012) peca(g, new THREE.SphereGeometry(raios[0], 10, 8), cor, a[0], a[1], a[2], { ...o, linha: false }, 0);
          if (raios[raios.length - 1] > 0.012) peca(g, new THREE.SphereGeometry(raios[raios.length - 1], 10, 8), cor, z[0], z[1], z[2], { ...o, linha: false }, 0);
        }
        if (o.x || o.y || o.z) g.position.set(o.x || 0, o.y || 0, o.z || 0);
        if (o.rx) g.rotation.x = o.rx; if (o.ry) g.rotation.y = o.ry; if (o.rz) g.rotation.z = o.rz;
        return g;
      },
      /** chifre curvo e afilado. curva: -1 (para trás/fora) .. 1 (para a frente). Opções: rx/ry/rz para orientar. */
      chifre(pai, comp, r, cor, x = 0, y = 0, z = 0, o = {}) {
        const c = (o.curva ?? 0.6) * comp, a = o.espiral ? 0.12 * comp : 0;
        return api.tubo(pai, [[0, 0, 0], [c * 0.1 + a, comp * 0.34, a], [c * 0.4, comp * 0.68, -a], [c * 0.95, comp * 0.97, 0]], [r, r * 0.72, r * 0.38, 0.004], cor, { ...o, x, y, z, pontas: false });
      },
      /** peça de revolução (robes, troncos, frascos): perfil = [[raio, altura], ...] de baixo para cima */
      torno(pai, perfil, cor, x = 0, y = 0, z = 0, o = {}) {
        const pts = perfil.map(p => new THREE.Vector2(p[0], p[1]));
        return peca(pai, new THREE.LatheGeometry(pts, o.seg || 20), cor, x, y, z, o, Math.max(...perfil.map(p => p[0]), 0.2));
      },
      /** placa de armadura (retângulo de cantos redondos com bisel) */
      placa(pai, w, h, d, cor, x = 0, y = 0, z = 0, o = {}) { return peca(pai, placaGeo(w, h, d, o.raio ?? 0.04, o.bisel ?? 0.02), cor, x, y, z, o, Math.max(w, h) / 1.6); },
      /* -- detalhes -- */
      /** olho brilhante. fenda: pupila vertical (olho de réptil/demônio) */
      olho(pai, r, cor, x = 0, y = 0, z = 0, o = {}) {
        const e = peca(pai, new THREE.SphereGeometry(r, 10, 8), o.esclera ?? cor, x, y, z, { emissive: cor, brilho: o.brilho ?? 1.1, linha: false });
        if (o.fenda) peca(pai, new THREE.BoxGeometry(r * 0.28, r * 1.5, r * 0.5), 0x0a0608, x, y, z + r * 0.78, { linha: false });
        else if (o.pupila !== false) peca(pai, new THREE.SphereGeometry(r * 0.45, 8, 6), 0x0a0608, x, y, z + r * 0.72, { linha: false });
        return e;
      },
      /** fileira de dentes/presas ao longo do eixo X. Apontam para baixo (use rx = PI para cima). */
      dentes(pai, n, largura, tam, cor, x = 0, y = 0, z = 0, o = {}) {
        const g = api.grupo(pai, x, y, z);
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0 : i / (n - 1) - 0.5, grande = o.presas && (i === 0 || i === n - 1);
          peca(g, new THREE.CylinderGeometry(0, tam * (grande ? 0.5 : 0.28), tam * (grande ? 2 : 1), 6), cor, t * largura, 0, 0, { rx: o.rx || PI, linha: false }, 0);
        }
        return g;
      },
      /** garras: n cones curtos em leque */
      garras(pai, n, abertura, comp, cor, x = 0, y = 0, z = 0, o = {}) {
        const g = api.grupo(pai, x, y, z);
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0 : i / (n - 1) - 0.5;
          const c = peca(g, new THREE.CylinderGeometry(0, comp * 0.14, comp, 6), cor, t * abertura, 0, comp * 0.35, { rx: PI / 2 + 0.25, rz: -t * 0.5, linha: false }, 0);
        }
        return g;
      },
      /** fileira de espinhos ao longo de uma curva [[x,y,z],...]: n espinhos de tamanho tam */
      espinhos(pai, pontos, n, tam, cor, o = {}) {
        const curva = new THREE.CatmullRomCurve3(pontos.map(p => new THREE.Vector3(p[0], p[1], p[2]))), g = api.grupo(pai, 0, 0, 0);
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0.5 : i / (n - 1), P = curva.getPointAt(t), T = curva.getTangentAt(t);
          const esp = peca(g, new THREE.CylinderGeometry(0, tam * (o.larg || 0.28) * (1 - t * 0.35), tam * (1 - t * 0.4 + (i % 2) * 0.2), 6), cor, P.x, P.y + tam * 0.4, P.z, { linha: false, ...o }, 0);
          esp.rotation.z = (o.inclina ?? 0.2) * (i % 2 ? 1 : -1); esp.rotation.x = -0.3 * (T.z > 0 ? 1 : -1) * 0.3;
        }
        return g;
      },
      /** asa de verdade (membrana plana com ossos). forma 'pena' ou 'morcego'. lado = -1 / 1 */
      asa(pai, lado, comp, larg, cor, x = 0, y = 0, z = 0, o = {}) {
        const g = api.grupo(pai, x, y, z), sh = new THREE.Shape();
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
        g.add(m);
        if (o.ossos !== false) {   // osso da frente e "dedos" que seguram a membrana
          const osso = o.osso ?? 0x2a1a20, s = lado < 0 ? -1 : 1;
          api.tubo(g, [[0, 0.02, 0.0], [s * comp * 0.5, 0.03, larg * 0.5], [s * comp, 0.02, larg * 0.28]], [0.03, 0.022, 0.008], osso, { linha: false, pontas: false });
          const pontasDedos = o.forma === 'morcego' ? [[0.82, -0.05], [0.55, -0.12], [0.42, -0.7]] : [[0.96, -0.1], [0.76, -0.4]];
          for (const [a, b] of pontasDedos) api.tubo(g, [[s * comp * 0.5, 0.03, larg * 0.5], [s * comp * (a + 0.5) / 2, 0.02, larg * (b + 0.5) / 2], [s * comp * a, 0.015, larg * b]], [0.016, 0.01, 0.005], osso, { linha: false, pontas: false });
        }
        return m;
      },
    };
    return api;
  }

  /** Funde as peças fixas de cada pivô em poucas malhas (uma por material) para o celular aguentar. */
  function fundir(no) {
    const porMat = new Map(), contornos = [];
    no.updateMatrix();
    for (const ch of [...no.children]) {
      if (ch.isMesh && !ch.userData.vivo && ch.visible && ch.geometry && ch.geometry.attributes.position) {
        ch.updateMatrix();
        const g = ch.geometry.clone(); g.applyMatrix4(ch.matrix);
        if (!porMat.has(ch.material)) porMat.set(ch.material, []);
        porMat.get(ch.material).push(g);
        for (const oc of ch.children) if (oc.isMesh && oc.userData.contorno) { const og = oc.geometry.clone(); og.applyMatrix4(oc.matrix); og.applyMatrix4(ch.matrix); contornos.push(og); }
        no.remove(ch);
      } else if (ch.isMesh && !ch.visible && !ch.userData.vivo) {
        no.remove(ch);
      } else if (ch.children && ch.children.length) fundir(ch);
    }
    for (const [m, gs] of porMat) { const me = new THREE.Mesh(unir(gs), m); me.userData.fundida = true; no.add(me); }
    if (contornos.length && no.userData.linha) { const me = new THREE.Mesh(unir(contornos), no.userData.linha); no.add(me); }
    else if (contornos.length) { const me = new THREE.Mesh(unir(contornos), fundir.linhaMat); no.add(me); }
  }

  /* ---------- Peças prontas ---------- */
  /** Humanoide (juntas, músculos, rosto, mãos). Devolve pivôs de braços/pernas/cabeça e as "mãos" onde se penduram as armas.
   *  Opções: s (altura), larg (largura/músculos), cabeca (tamanho), corcunda (inclina o tronco, em radianos), bracoLongo,
   *          pele, corpo, manga, calca, bota, olhos, olhoBrilho, texPele, texCorpo, texBota ('pele','couro','escamas','pelo','pedra','osso','tecido','metal'),
   *          rosto ('humano'|'orc'|'caveira'), cabelo (cor), ombreira (cor da ombreira), ombreiraEspinho, garras (cor das garras), semPernas, cinto. */
  function humano(B, raiz, o = {}) {
    const s = o.s || 1, w = o.larg || 1, pele = o.pele ?? 0xf0c9a0, corpo = o.corpo ?? 0x6a6f86, calca = o.calca ?? 0x3a3d4a, bota = o.bota ?? 0x2a2420;
    const mp = { tex: o.texPele ?? 'pele', rep: 2 }, mc = { tex: o.texCorpo ?? 'tecido', rep: 2 }, mb = { tex: o.texBota ?? 'couro', rep: 1 };
    const quadril = 0.52 * s, bl = o.bracoLongo || 1;
    const tronco = B.grupo(raiz, 0, quadril, 0);
    if (o.corcunda) tronco.rotation.x = o.corcunda;
    const pernas = [-1, 1].map(lado => {
      const p = B.grupo(raiz, lado * 0.12 * w * s, quadril, 0);
      if (!o.semPernas) {
        B.cil(p, 0.088 * w * s, 0.07 * w * s, 0.27 * s, calca, 0, -0.13 * s, 0, mc);
        B.esf(p, 0.07 * w * s, calca, 0, -0.27 * s, 0.01 * s, { ...mc, linha: false });
        B.cil(p, 0.068 * w * s, 0.055 * w * s, 0.24 * s, calca, 0, -0.38 * s, 0, mc);
        B.cil(p, 0.075 * w * s, 0.085 * w * s, 0.11 * s, bota, 0, -0.44 * s, 0, mb);
        B.cx(p, 0.13 * w * s, 0.06 * s, 0.25 * s, bota, 0, -0.49 * s, 0.06 * s, { ...mb, linha: false });
      }
      return p;
    });
    // tronco: peito largo que afina na cintura
    B.torno(tronco, [[0.14 * w * s, 0], [0.17 * w * s, 0.08 * s], [0.22 * w * s, 0.28 * s], [0.24 * w * s, 0.4 * s], [0.18 * w * s, 0.5 * s]], corpo, 0, 0, 0, { ...mc, seg: 18 });
    B.esf(tronco, 0.13 * w * s, corpo, 0, 0.03 * s, 0, { ...mc, linha: false });
    if (o.cinto !== false) B.cil(tronco, 0.165 * w * s, 0.165 * w * s, 0.06 * s, o.corCinto ?? 0x3a2a1a, 0, 0.03 * s, 0, { tex: 'couro', linha: false });
    // cabeça
    const cabeca = B.grupo(tronco, 0, 0.5 * s, 0), cr = (o.cabeca || 0.17) * s;
    B.cil(cabeca, 0.065 * s, 0.075 * s, 0.09 * s, pele, 0, 0.03 * s, 0, { ...mp, linha: false });
    B.blob(cabeca, cr, pele, 0, 0.2 * s, 0, { ...mp, amp: 0.04, seed: 3 });
    const rosto = o.rosto || 'humano', olhos = o.olhos ?? 0x1a1a22, ec = o.olhoBrilho ? olhos : 0x15121a;
    [-1, 1].forEach(l => {
      if (rosto === 'caveira') B.esf(cabeca, 0.045 * s, 0x08060a, l * 0.07 * s, 0.23 * s, 0.14 * s, { linha: false });
      else B.olho(cabeca, 0.026 * s, o.olhoBrilho ? olhos : 0xf5efe0, l * 0.068 * s, 0.225 * s, 0.14 * s, { pupila: !o.olhoBrilho });
      if (o.olhoBrilho && rosto === 'caveira') B.esf(cabeca, 0.02 * s, olhos, l * 0.07 * s, 0.23 * s, 0.16 * s, { emissive: olhos, linha: false });
    });
    B.cx(cabeca, 0.2 * s, 0.035 * s, 0.07 * s, pele, 0, 0.265 * s, 0.12 * s, { ...mp, linha: false });                       // sobrancelha
    if (rosto === 'humano') {
      B.cone(cabeca, 0.032 * s, 0.07 * s, pele, 0, 0.19 * s, 0.17 * s, { rx: PI / 2 + 0.3, linha: false, ...mp });
      B.cx(cabeca, 0.07 * s, 0.015 * s, 0.03 * s, 0x6a2a2a, 0, 0.13 * s, 0.15 * s, { linha: false });
    } else if (rosto === 'orc') {
      B.cx(cabeca, 0.17 * s, 0.07 * s, 0.1 * s, pele, 0, 0.12 * s, 0.1 * s, { ...mp });
      [-1, 1].forEach(l => B.cone(cabeca, 0.022 * s, 0.09 * s, 0xe8e0c8, l * 0.07 * s, 0.17 * s, 0.17 * s, { linha: false }));
      B.cone(cabeca, 0.04 * s, 0.07 * s, pele, 0, 0.19 * s, 0.17 * s, { rx: PI / 2, linha: false, ...mp });
    } else if (rosto === 'caveira') {
      B.cone(cabeca, 0.02 * s, 0.05 * s, 0x08060a, 0, 0.18 * s, 0.17 * s, { rx: PI / 2, linha: false });
      B.dentes(cabeca, 7, 0.12 * s, 0.03 * s, 0xe8e0c8, 0, 0.115 * s, 0.14 * s, {});
    }
    if (o.cabelo !== undefined) B.blob(cabeca, cr * 1.06, o.cabelo, 0, 0.23 * s, -0.025 * s, { tex: 'pelo', rep: 2, amp: 0.12, sy: 0.85, seed: 5 });
    // braços com cotovelo, mão fechada e garras opcionais
    const bracos = [-1, 1].map(lado => {
      const b = B.grupo(tronco, lado * 0.27 * w * s, 0.45 * s, 0);
      B.esf(b, 0.09 * w * s, o.manga ?? corpo, 0, 0, 0, { ...mc, linha: false });
      if (o.ombreira !== undefined) {
        B.esf(b, 0.115 * w * s, o.ombreira, lado * 0.01 * s, 0.025 * s, 0, { tex: 'metal', metal: 0.5, rough: 0.4, sy: 0.7 });
        if (o.ombreiraEspinho) B.cone(b, 0.035 * s, 0.14 * s, o.ombreira, lado * 0.04 * s, 0.1 * s, 0, { rz: -lado * 0.5, linha: false, metal: 0.5 });
      }
      B.cil(b, 0.064 * w * s, 0.05 * w * s, 0.2 * s * bl, o.manga ?? pele, 0, -0.11 * s * bl, 0, o.manga !== undefined ? mc : mp);
      B.esf(b, 0.052 * w * s, o.manga ?? pele, 0, -0.22 * s * bl, 0, { ...(o.manga !== undefined ? mc : mp), linha: false });
      B.cil(b, 0.052 * w * s, 0.042 * w * s, 0.19 * s * bl, pele, 0, -0.32 * s * bl, 0, mp);
      const mao = B.grupo(b, 0, -0.42 * s * bl, 0);
      B.blob(mao, 0.065 * s, pele, 0, -0.01 * s, 0, { ...mp, amp: 0.08, sx: 0.95, sy: 1.1, seed: 7, linha: false });
      B.esf(mao, 0.026 * s, pele, lado * 0.055 * s, 0.01 * s, 0.03 * s, { ...mp, linha: false, seg: 8 });
      if (o.garras !== undefined) B.garras(mao, 4, 0.09 * s, 0.1 * s, o.garras, 0, -0.04 * s, 0.04 * s, {});
      b.userData.mao = mao;
      return b;
    });
    return { tronco, cabeca, bracoE: bracos[0], bracoD: bracos[1], pernaE: pernas[0], pernaD: pernas[1], maoE: bracos[0].userData.mao, maoD: bracos[1].userData.mao, s, w };
  }

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
      const orbe = B.vivo(B.esf(g, 0.1, o.orbe ?? 0x8fd0ff, 0, 0.98, 0, { emissive: o.orbe ?? 0x8fd0ff, brilho: 1.2, linha: false }));
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
  registrar({   // modelos-base (ficam como reserva; js/modelos3d/*.js substituem por versões mais detalhadas)
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
      const fogo = B.vivo(B.esf(h.maoD, 0.1, 0xff9a2a, 0, 0.1, 0.12, { emissive: 0xff6a10, brilho: 1.3, linha: false }));
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
      const aura = B.vivo(B.esf(R, 0.55, 0x4a7aff, 0, 0.75, 0, { op: 0.13, emissive: 0x4a7aff, brilho: 0.6, linha: false }));
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
      const nucleo = B.vivo(B.esf(c, 0.45, 0x4a1d96, 0, 0, 0, { emissive: 0x7a3ae0, brilho: 0.9, metal: 0.3, rough: 0.3 }));
      B.esf(c, 0.2, 0xffffff, 0, 0, 0, { emissive: 0xe0c8ff, brilho: 1.4, linha: false });
      const aneis = [0, 1, 2].map(i => { const a = B.vivo(B.tor(c, 0.7 + i * 0.12, 0.035, [0x9a6bf0, 0x7a3ae0, 0xc8a0ff][i], 0, 0, 0, { rx: i * 1.0, ry: i * 0.6, emissive: 0x5a2ab0, linha: false, seg: 24 })); return a; });
      const frags = [];
      for (let i = 0; i < 6; i++) { const f = B.vivo(B.octa(c, 0.11 + (i % 3) * 0.03, 0xb890ff, 0, 0, 0, { emissive: 0x7a3ae0, linha: false })); f.userData.i = i; frags.push(f); }
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
      const f = B.vivo(B.cone(R, 0.17, 0.55, 0xff9a2a, 0, 1.08, 0, { emissive: 0xff6a10, brilho: 1.2, linha: false, seg: 6 }));
      return { altura: 1.5, p: {}, estrutura: true, anim: t => { f.scale.set(1 + Math.sin(t * 8) * 0.12, 1 + Math.sin(t * 6 + 1) * 0.18, 1 + Math.sin(t * 7) * 0.12); } };
    },
    portal_fogo(B, R) {
      B.cx(R, 1.0, 0.18, 0.5, 0x2a1a1a, 0, 0.09, 0);
      const aro = B.tor(R, 0.62, 0.12, 0x3a2220, 0, 0.88, 0, { seg: 18 });
      [0, 1, 2, 3, 4, 5].forEach(i => { const a = i / 6 * PI * 2; B.cone(R, 0.06, 0.2, 0xff5a1a, Math.cos(a) * 0.7, 0.88 + Math.sin(a) * 0.7, 0, { rz: a - PI / 2, emissive: 0xff3a00, linha: false, seg: 4 }); });
      const interior = B.vivo(B.cil(R, 0.55, 0.55, 0.04, 0xff7a2a, 0, 0.88, 0, { rx: PI / 2, emissive: 0xff5a10, brilho: 1.1, seg: 20, linha: false }));
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
        B.vivo(B.cil(R, 0, r, hh, cor, x, 0.16 + hh / 2, z, { seg: 6, emissive: 0x5a2ab0, brilho: 0.8, rx: i ? (i % 2 ? 0.15 : -0.12) : 0 })));
      const an = B.vivo(B.tor(R, 0.62, 0.025, 0xc8a0ff, 0, 1.0, 0, { rx: PI / 2, emissive: 0x7a3ae0, linha: false, seg: 24 }));
      return { altura: 2.1, p: {}, estrutura: true, anim: t => { an.rotation.z = t * 0.8; an.position.y = 1.0 + Math.sin(t * 1.6) * 0.12; cs[0].material.emissiveIntensity = 0.8 + Math.sin(t * 2) * 0.3; } };
    },
  });


  /** Ambiente de reflexo para os materiais metálicos/brilhantes (um "estúdio" pintado: céu, chão e 2 luzes de caixa). */
  function ambiente(renderer, cena) {
    if (!THREE.PMREMGenerator) return;
    const c = document.createElement('canvas'); c.width = 8; c.height = 128;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#dfe8ff'); gr.addColorStop(0.45, '#8f94a8'); gr.addColorStop(0.55, '#4a4650'); gr.addColorStop(1, '#16141c');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
    const es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 16), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.BackSide })));
    [[-8, 9, 8, 6], [9, 5, -7, 4]].forEach(([x, y, z, t]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(t, t), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); });
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(es, 0.03);
    cena.environment = rt.texture;
    pm.dispose();
  }

  /* ---------- Registro, criação e animação ---------- */
  /** Cada arquivo de js/modelos3d/*.js registra seus modelos aqui (um modelo registrado substitui o de mesmo id). */
  function registrar(obj) { Object.assign(FEITOS, obj); }
  const kit = { humano, quadrupede, ARMAS, tuboGeo, blobGeo, textura, rn3, fbm, hash2 };

  /** Monta o modelo de `id` (o mesmo id dos inimigos/classes). Devolve null se não existir. */
  function criar(id) {
    if (glbs.has(id)) return criarGlb(id);
    const f = FEITOS[id];
    if (!f) return null;
    const B = construtor();
    const raiz = new THREE.Group();               // gira para encarar o alvo
    const corpo = new THREE.Group();              // inclina e balança
    raiz.add(corpo);
    const r = f(B, corpo) || {};
    const p = r.p || {};
    for (const k of ['bracoD', 'bracoE']) if (p[k]) p[k].userData.rx0 = p[k].rotation.x;
    fundir.linhaMat = B.linhaMat;
    fundir(raiz);
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
    if (m.mixer) return animarGlb(m, o, golpe);
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
    // grupos que balançam sozinhos (tentáculos, mantos, caudas extras): p.balancos = [{ g, amp, vel, eixo: 'x'|'y'|'z', fase }]
    if (p.balancos) for (const b of p.balancos) b.g.rotation[b.eixo || 'z'] = Math.sin(t * (b.vel || 2) + (b.fase || 0)) * (b.amp || 0.2);
    // mandíbula: p.mandibula = { g, aberta (radianos) } abre ao golpear
    if (p.mandibula) p.mandibula.g.rotation.x = (p.mandibula.fechada || 0) + golpe * (p.mandibula.aberta || 0.6) + Math.max(0, Math.sin(t * 1.3)) * 0.04;
    if (m.anim) m.anim(t, o.dt, { andando: o.andando, golpe });
  }

  /* ---------- Modelos prontos em arquivo (.glb) ---------- */
  // Se existir modelos/<id>.glb, ele substitui o modelo desenhado por código. Veja docs/MINIATURAS.md.
  function normalizarGlb(cena, altura) {
    const caixa = new THREE.Box3().setFromObject(cena), tam = caixa.getSize(new THREE.Vector3()), c = caixa.getCenter(new THREE.Vector3());
    const k = altura / Math.max(0.01, tam.y);
    const pivo = new THREE.Group(); pivo.add(cena);
    cena.position.set(-c.x, -caixa.min.y, -c.z); pivo.scale.setScalar(k);
    const fora = new THREE.Group(); fora.add(pivo);
    return fora;
  }
  function criarGlb(id) {
    const g = glbs.get(id), clone = (THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(g.cena) : g.cena.clone(true));
    const raiz = new THREE.Group(), corpo = new THREE.Group(); raiz.add(corpo);
    const mats = [];
    clone.traverse(o => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(x => x.clone()) : o.material.clone(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(x => { if (x.emissive) { x.userData.emBase = x.emissive.clone(); x.userData.intBase = x.emissiveIntensity || 0; x.userData.opBase = x.opacity; mats.push(x); } }); } });
    corpo.add(normalizarGlb(clone, g.altura));
    const m = { raiz, corpo, partes: {}, altura: g.altura, mats, anim: null, flutua: false, estrutura: !!g.estrutura, fase: Math.random() * 6.28, yaw: 0, alvoYaw: 0, glb: true };
    if (g.animacoes && g.animacoes.length) {
      m.mixer = new THREE.AnimationMixer(clone); m.acoes = {};
      const acha = re => g.animacoes.find(a => re.test(a.name));
      for (const [k, re] of [['parado', /idle|stand|parado/i], ['andar', /walk|run|andar|move/i], ['golpe', /attack|hit|strike|golpe|ataque/i]]) { const a = acha(re); if (a) m.acoes[k] = m.mixer.clipAction(a); }
      if (!m.acoes.parado) m.acoes.parado = m.mixer.clipAction(g.animacoes[0]);
      m.acoes.parado.play(); m.atual = 'parado';
    }
    return m;
  }
  function animarGlb(m, o, golpe) {
    const t = o.tempo + m.fase;
    const quer = golpe > 0.02 && m.acoes.golpe ? 'golpe' : (o.andando && m.acoes.andar ? 'andar' : 'parado');
    if (quer !== m.atual) { const de = m.acoes[m.atual], para = m.acoes[quer]; para.reset().fadeIn(0.15).play(); if (de) de.fadeOut(0.15); m.atual = quer; }
    m.mixer.update(o.dt);
    m.corpo.rotation.x = golpe * 0.2;
    if (!m.acoes.parado || m.acoes.parado.getClip().duration < 0.05) m.corpo.position.y = Math.sin(t * 2.2) * 0.02;
  }
  /** Tenta carregar modelos/<id>.glb para cada id (os que não existirem são ignorados). Chame uma vez ao abrir o jogo. */
  function carregarGlbs(ids, pasta = 'modelos/') {
    if (typeof fetch === 'undefined' || !THREE.GLTFLoader || location.protocol === 'file:') return Promise.resolve([]);
    const loader = new THREE.GLTFLoader();
    return Promise.all(ids.map(id => fetch(pasta + id + '.glb', { method: 'HEAD' }).then(r => {
      if (!r.ok) return null;
      return new Promise(ok => loader.load(pasta + id + '.glb', gltf => {
        const altura = (FEITOS[id] ? (FEITOS[id]({ ...construtor(), grupo: () => new THREE.Group() }, new THREE.Group()) || {}).altura : 0) || 1.6;
        glbs.set(id, { cena: gltf.scene, animacoes: gltf.animations || [], altura, estrutura: false }); ok(id);
      }, undefined, () => ok(null)));
    }).catch(() => null))).then(l => l.filter(Boolean));
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
    for (const mt of m.mats) { mt.transparent = true; mt.opacity = (mt.userData.opBase ?? 1) * (1 - k); }
  }
  function liberar(m) { m.raiz.traverse(o => { if (o.geometry) o.geometry.dispose(); }); m.mats.forEach(x => x.dispose()); }

  return { criar, animar, brilho, esmaecer, liberar, registrar, ambiente, kit, carregarGlbs, existe: id => !!FEITOS[id] || glbs.has(id), ids: () => Object.keys(FEITOS), glbIds: () => [...glbs.keys()] };
})();
