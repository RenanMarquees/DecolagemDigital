'use strict';
/* Modelos 3D — INFERNO: alma_penada, diabrete, cerbero, demonio, hades.
   Cada modelo é esculpido do zero com blob/tubo/chifre/torno (nada de blocos), com texturas, veias de lava,
   dentes, garras, correntes e olhos em brasa. Veja as ferramentas no começo de js/modelos3d.js. */
(() => {
  const PI = Math.PI, M = {};
  const rnd = s => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };   // sorteio repetível

  /* ---------- Paleta do Inferno ---------- */
  const COR = {
    sangue: 0x8a1c1c, sangueEsc: 0x4a0e12, carvao: 0x17100f, preto: 0x0c0809, osso: 0xd9cfae, ossoVelho: 0xb7a98a,
    brasa: 0xff6a1a, lava: 0xff9a2a, fogoAmar: 0xffd25a, roxo: 0x2a1030, ferro: 0x2c2a30, ferroVel: 0x4a4650,
    alma: 0x4fe6d0, almaAzul: 0x5ab8ff, almaClara: 0xbff8ff,
  };

  /* ---------- Ajudantes locais ---------- */
  const K = Modelos3D.kit;
  /** Tubo afilado sem grupo extra (as peças ficam coladas ao pivô e são fundidas juntas: menos malhas).
   *  Opções: x,y,z (deslocamento), rx/ry/rz (giro), seg, rad, pontas (tampas redondas), linha (contorno), + as do material. */
  function tb(B, pai, pts, raios, cor, o = {}) {
    const { rx, ry, rz, x = 0, y = 0, z = 0, seg = 8, rad = 6 } = o;
    const P = pts.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    if (rx || ry || rz) { const e = new THREE.Euler(rx || 0, ry || 0, rz || 0); P.forEach(v => v.applyEuler(e)); }
    const Q = P.map(v => [v.x + x, v.y + y, v.z + z]), mt = B.mat(cor, o);
    const geo = K.tuboGeo(Q, raios, seg, rad), uv = geo.attributes.uv;   // troca u<->v: a textura corre ao longo do tubo
    for (let i = 0; i < uv.count; i++) { const a = uv.getX(i); uv.setX(i, uv.getY(i)); uv.setY(i, a); }
    const m = new THREE.Mesh(geo, mt); pai.add(m);
    if (o.linha !== false && !o.op && Math.max(...raios) > 0.045) {
      const l = new THREE.Mesh(K.tuboGeo(Q, raios.map(r => r + 0.016), seg, rad), B.linhaMat); l.userData.contorno = true; m.add(l);
    }
    if (o.pontas !== false) [0, Q.length - 1].forEach((k, n) => {
      const r = raios[n ? raios.length - 1 : 0];
      if (r > 0.012) { const c = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), mt); c.position.set(Q[k][0], Q[k][1], Q[k][2]); pai.add(c); }
    });
    return m;
  }
  /** chifre/espinho com anéis (nervuras) e curva. pts = eixo; r0 = raio da base */
  function corno(B, pai, pts, r0, cor, o = {}) {
    const n = o.aneis ?? 9, raios = [];
    for (let i = 0; i < n; i++) { const t = i / (n - 1); raios.push(Math.max(0.002, r0 * (1 - t * 0.93) * (1 + (i % 2 ? 0.13 : -0.04)))); }
    return tb(B, pai, pts, raios, cor, { seg: n * 2, rad: 7, pontas: false, rough: 0.55, ...o });
  }
  /** anel (coleira, pulseira) com espetos para fora. c = centro, R = raio, rot = [rx,ry,rz] (o anel fica horizontal sem giro) */
  function anelEsp(B, pai, c, R, r, rot, n, comp, cor, o = {}) {
    const e = new THREE.Euler(rot[0], rot[1], rot[2]);
    B.tor(pai, R, r, o.corAnel ?? cor, c[0], c[1], c[2], { rx: PI / 2, seg: o.seg || 12, metal: 0.55, rough: 0.5, linha: false, ...(o.anel || {}) }).rotation.setFromQuaternion(new THREE.Quaternion().setFromEuler(e).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(PI / 2, 0, 0))));
    for (let i = 0; i < n; i++) {
      const a = i / n * PI * 2 + (o.fase || 0), d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).applyEuler(e);
      const m = B.cone(pai, o.rad || 0.025, comp, cor, c[0] + d.x * R, c[1] + d.y * R, c[2] + d.z * R, { seg: 5, metal: 0.6, rough: 0.4, linha: false });
      aponta(m, [d.x, d.y, d.z]); m.translateY(comp * 0.4);
    }
  }
  /** blob com menos segmentos (a miniatura é pequena: poupa triângulos) */
  const bl = (B, pai, r, cor, x, y, z, o = {}) => B.blob(pai, r, cor, x, y, z, { seg: 12, ...o });
  /** aponta uma peça (cone etc., que "aponta" para +Y) na direção dir=[x,y,z] */
  function aponta(m, dir) {
    const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    return m;
  }
  /** ponto na superfície de um elipsoide: c = centro, r = raios, u = azimute (0 = +Z), v = elevação */
  function sup(c, r, u, v, k = 1) {
    return [c[0] + r[0] * k * Math.cos(v) * Math.sin(u), c[1] + r[1] * k * Math.sin(v), c[2] + r[2] * k * Math.cos(v) * Math.cos(u)];
  }
  /** veia/rachadura de lava: tubo fino brilhante que passa pela superfície (trilha = [[u,v],...]) */
  function veia(B, pai, c, r, trilha, esp, cor = COR.brasa, k = 1.0) {
    const pts = trilha.map(([u, v]) => sup(c, r, u, v, k));
    const raios = pts.map((_, i) => esp * (0.5 + 0.5 * Math.sin(PI * (i + 0.5) / pts.length)));
    return tb(B, pai, pts, raios, cor, { emissive: cor, brilho: 0.85, linha: false, seg: Math.max(4, pts.length * 2), rad: 4, pontas: false });
  }
  /** rachadura que serpenteia a partir de (u0, v0) com n passos; semente s */
  function rachadura(B, pai, c, r, u0, v0, n, passo, s, esp, cor, k = 1.0) {
    const R = rnd(s), tr = [[u0, v0]];
    let u = u0, v = v0, du = (R() - 0.5) * passo, dv = (R() - 0.2) * passo;
    for (let i = 0; i < n; i++) { u += du; v += dv; du += (R() - 0.5) * passo * 0.8; dv += (R() - 0.5) * passo * 0.8; tr.push([u, v]); }
    return veia(B, pai, c, r, tr, esp, cor, k);
  }
  /** cone-espeto na superfície do elipsoide, apontando para fora (+ viés dir) */
  function espeto(B, pai, c, r, u, v, comp, rad, cor, o = {}) {
    const p = sup(c, r, u, v, 0.97), n = sup([0, 0, 0], r, u, v, 1);
    const nn = [n[0] / (r[0] * r[0]), n[1] / (r[1] * r[1]), n[2] / (r[2] * r[2])];
    const b = o.vies || [0, 0, 0];
    const m = B.cone(pai, rad, comp, cor, p[0], p[1], p[2], { seg: o.seg || 5, linha: false, ...o });
    aponta(m, [nn[0] + b[0], nn[1] + b[1], nn[2] + b[2]]);
    m.translateY(comp * 0.4);
    return m;
  }
  /** presa/dente curvo (tubo curtinho afilado). Aponta para -Y e curva para +Z. */
  function presa(B, pai, x, y, z, comp, r, cor = COR.osso, curva = 0.25, o = {}) {
    return tb(B, pai, [[0, 0, 0], [0, -comp * 0.55, comp * curva * 0.4], [0, -comp, comp * curva]], [r, r * 0.65, 0.002], cor, { x, y, z, seg: 3, rad: 4, linha: false, pontas: false, rough: 0.4, ...o });
  }
  /** garra curva: aponta para +Z e curva para baixo. */
  function garra(B, pai, x, y, z, comp, r, cor = 0x1a1210, o = {}) {
    const cv = o.cv ?? -0.22;
    return tb(B, pai, [[0, 0, 0], [0, comp * 0.05, comp * 0.5], [0, comp * cv, comp]], [r, r * 0.6, 0.003], cor, { x, y, z, seg: 4, rad: 4, linha: false, pontas: false, rough: 0.35, ...o });
  }
  /** corrente: elos ao longo de uma curva (pts), n elos de tamanho tam */
  function corrente(B, pai, pts, n, tam, cor = COR.ferroVel, o = {}) {
    const curva = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    const g = pai;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1), P = curva.getPointAt(t), T = curva.getTangentAt(t);
      const m = B.tor(g, tam * 0.5, tam * 0.13, cor, P.x, P.y, P.z, { seg: 8, linha: false, metal: 0.6, rough: 0.45, sx: 0.75, ...o });
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), T);
      // o elo (torus) fica no plano XY; o eixo longo vira Y (sy), depois alinha com a tangente e gira 90 graus a cada elo
      m.scale.set(0.7, 1.15, 1);
      const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i % 2) * PI / 2);
      m.quaternion.copy(q).multiply(roll);
    }
    return g;
  }
  /** chama: 3 línguas curvas translúcidas (e um miolo claro). Devolve o grupo (anime a escala dele). */
  function chama(B, pai, x, y, z, h, r, cor = COR.brasa, cor2 = COR.fogoAmar) {
    const g = B.grupo(pai, x, y, z);
    [[0.6, 1, 0.2], [-1, 0.62, 0.5], [1, 0.5, -0.5]].forEach(([dx, k, dz], i) => {
      const hh = h * k, rr = r * (i ? 0.7 : 1);
      tb(B, g, [[0, 0, 0], [dx * hh * 0.12, hh * 0.35, dz * hh * 0.08], [-dx * hh * 0.16, hh * 0.7, 0], [dx * hh * 0.26, hh * 1.0, 0]], [rr * 0.9, rr * 0.8, rr * 0.4, 0.003], cor,
        { emissive: cor, brilho: 0.95, op: 0.85, linha: false, seg: 9, rad: 6, pontas: false });
    });
    tb(B, g, [[0, 0, 0.01], [0, h * 0.28, 0.01], [r * 0.25, h * 0.55, 0.01]], [r * 0.5, r * 0.38, 0.003], cor2, { emissive: cor2, brilho: 1.0, op: 0.9, linha: false, seg: 6, rad: 5, pontas: false });
    return g;
  }
  /** contorno escuro para uma geometria própria (cópia um pouco maior, de costas) */
  function contorno(m, B, esp = 0.02) {
    const geo = m.geometry.clone(); geo.computeBoundingBox();
    const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3()), t = bb.getSize(new THREE.Vector3());
    const k = e => Math.min(1.6, 1 + esp / Math.max(0.0001, e / 2));
    geo.translate(-c.x, -c.y, -c.z); geo.scale(k(t.x), k(t.y), k(t.z)); geo.translate(c.x, c.y, c.z);
    const l = new THREE.Mesh(geo, B.linhaMat); l.userData.contorno = true; m.add(l);
  }
  /** peça plana recortada (lâmina, flecha, pano) a partir de um contorno 2D [[x,y],...], com espessura prof */
  function forma(B, pai, pts, prof, cor, x = 0, y = 0, z = 0, o = {}) {
    const sh = new THREE.Shape(); pts.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
    const bis = o.bisel ?? 0.006;
    const geo = new THREE.ExtrudeGeometry(sh, { depth: prof, bevelEnabled: bis > 0, bevelThickness: bis, bevelSize: bis, bevelSegments: 1 });
    geo.translate(0, 0, -prof / 2);
    const m = new THREE.Mesh(geo, B.mat(cor, o)); m.position.set(x, y, z);
    m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); pai.add(m);
    if (o.linha !== false && !o.op) contorno(m, B, o.esp || 0.016);
    return m;
  }
  /** asa de morcego de verdade: braço, dedos de osso e membrana em leque (com recortes). lado = -1/1.
   *  Pontos no plano da asa (x para fora, y para cima, z para trás). */
  function asaMorcego(B, pai, lado, esc, corMemb, corOsso, o = {}) {
    const s = lado, P = ([x, y, z]) => new THREE.Vector3(s * x * esc, y * esc, z * esc);
    const S = P([0, 0, 0]), E = P([0.34, 0.46, -0.1]), W = P([0.72, 0.84, -0.2]);
    const F = (o.dedos || [[1.3, 1.22, -0.5], [1.55, 0.62, -0.62], [1.38, 0.0, -0.5], [0.9, -0.42, -0.32]]).map(P);
    const A = P(o.fim || [0.14, -0.5, -0.1]);
    const pos = [], tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    const pul = (a, b, k) => a.clone().lerp(b, 0.5).lerp(W, k);
    for (let i = 0; i < F.length - 1; i++) { const m = pul(F[i], F[i + 1], o.recorte ?? 0.24); tri(W, F[i], m); tri(W, m, F[i + 1]); }
    const mf = pul(F[F.length - 1], A, (o.recorte ?? 0.24) * 0.8); tri(W, F[F.length - 1], mf); tri(W, mf, A); tri(W, A, S);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 1.2, pos[i + 1] * 1.2);
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
    const memb = new THREE.Mesh(geo, B.mat(corMemb, { dupla: true, tex: 'couro', rep: 1, rough: 0.8, emissive: o.brilho ?? 0x2a0610, brilho: 0.5 }));
    pai.add(memb);
    const v = a => [a.x, a.y, a.z];
    tb(B, pai, [v(S), v(E), v(W)], [0.045 * esc, 0.034 * esc, 0.026 * esc], corOsso, { seg: 8, rad: 6, tex: 'osso', linha: false });
    F.forEach((f, i) => {
      const mid = W.clone().lerp(f, 0.5); mid.y += 0.04 * esc; mid.z -= 0.03 * esc;
      tb(B, pai, [v(W), v(mid), v(f)], [0.02 * esc, 0.014 * esc, 0.004], corOsso, { seg: 6, rad: 5, linha: false, pontas: false });
    });
    // garra do polegar
    const g = garra(B, pai, W.x, W.y, W.z, 0.16 * esc, 0.02 * esc, COR.ossoVelho, { rx: -0.9, ry: -s * 0.5, cv: -0.22 });
    // veias de brasa na membrana
    if (o.veias !== false) F.forEach(f => { const m = pul(f, F[Math.min(F.length - 1, F.indexOf(f) + 1)], 0.5); tb(B, pai, [v(W.clone().lerp(m, 0.15)), v(W.clone().lerp(m, 0.55)), v(W.clone().lerp(m, 0.85))], [0.006 * esc, 0.007 * esc, 0.003], COR.brasa, { emissive: COR.brasa, brilho: 0.7, linha: false, seg: 4, rad: 4, pontas: false, op: 0.9 }); });
    return memb;
  }
  /** manto de revolução com a barra rasgada em pontas e dobras. perfil = [[raio, altura],...] de baixo para cima */
  function mantoGeo(perfil, N, o = {}) {
    const R2 = rnd(o.seed || 5), pos = [], uv = [], idx = [], sorte = [];
    for (let i = 0; i < N; i++) sorte.push(R2());
    for (let j = 0; j < perfil.length; j++) for (let i = 0; i <= N; i++) {
      const ii = i % N, a = i / N * PI * 2;
      let r = perfil[j][0] * (1 + (o.dobras ?? 0.06) * Math.sin(a * (o.nd || 7) + j * 0.8) * (1 - j / perfil.length) + 0.025 * Math.sin(a * 13 + j));
      let y = perfil[j][1];
      if (j === 0) { y -= (o.rasgo ?? 0.18) * (ii % 2 ? 1 : 0.15) * (0.5 + sorte[ii]); r *= 1 + (ii % 2) * 0.05; }
      else if (j === 1) y -= (o.rasgo ?? 0.18) * 0.25 * sorte[ii];
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r); uv.push(i / N * 3, j / (perfil.length - 1) * 2);
    }
    for (let j = 0; j < perfil.length - 1; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + N + 1; idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  /** pano pendurado (capa, estandarte): largura wT no topo, wB embaixo, altura h; curva para trás, ondas e barra rasgada */
  function panoGeo(wT, wB, h, nx, ny, o = {}) {
    const R2 = rnd(o.seed || 9), pos = [], uv = [], idx = [], sorte = [];
    for (let i = 0; i <= nx; i++) sorte.push(R2());
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const u = i / nx - 0.5, v = j / ny, w = wT + (wB - wT) * Math.pow(v, 1.1);
      let y = -v * h, z = -(o.curva ?? 0.3) * v + u * u * (o.enrola ?? 0.5) * v + Math.sin(u * 9 + v * 2.5) * (o.onda ?? 0.04) * v;
      if (j === ny) y -= (o.rasgo ?? 0.15) * (i % 2 ? 1 : 0.2) * (0.4 + sorte[i]);
      pos.push(u * w, y, z); uv.push(i / nx * 2, v * 2);
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  /** materiais translúcidos não escrevem profundidade (evita falhas quando várias camadas de névoa se sobrepõem) */
  function finalizar(B) { B.todos.forEach(m => { if (m.transparent) m.depthWrite = false; }); }

  /* ============================================================
     CERBERO — cão de três cabeças
     ============================================================ */
  /** cabeça de cão infernal. Origem = nuca; olha para +Z. Devolve { g, mand, lingua } */
  function cabecaCao(B, pai, e, o = {}) {
    const pelo = o.pelo ?? 0x2a1c17, claro = o.claro ?? 0x4a3228, g = B.grupo(pai, 0, 0, 0);
    const mp = { tex: 'pelo', rep: 2, rough: 0.9 }, E = v => v * e;
    // crânio, focinho comprido e testa pesada
    bl(B, g, E(0.19), pelo, 0, E(0.03), E(0.1), { ...mp, amp: 0.1, sz: 1.1, seed: 3, seg: 11 });
    bl(B, g, E(0.115), claro, 0, E(-0.03), E(0.34), { ...mp, amp: 0.06, sz: 1.8, sy: 0.82, seed: 5, seg: 10 });
    bl(B, g, E(0.085), pelo, 0, E(0.04), E(0.47), { ...mp, amp: 0.08, sz: 1.3, sy: 0.7, seed: 8, seg: 10, linha: false });
    bl(B, g, E(0.036), 0x070405, 0, E(0.01), E(0.62), { rough: 0.25, amp: 0.05, sx: 1.4, sy: 0.8, seed: 2, seg: 8, linha: false });  // nariz úmido
    // rugas do rosnado no dorso do focinho
    [0.4, 0.46, 0.52].forEach((z, i) => tb(B, g, [[E(-0.07 + i * 0.01), E(0.052 - i * 0.004), E(z)], [0, E(0.098 - i * 0.012), E(z + 0.01)], [E(0.07 - i * 0.01), E(0.052 - i * 0.004), E(z)]], [E(0.007), E(0.011), E(0.007)], 0x120b0a, { seg: 6, rad: 4, linha: false, pontas: false }));
    [-1, 1].forEach(l => {
      // sobrancelha furiosa (a ponta de dentro desce)
      tb(B, g, [[l * E(0.03), E(0.125), E(0.275)], [l * E(0.09), E(0.15), E(0.245)], [l * E(0.16), E(0.17), E(0.19)]], [E(0.03), E(0.036), E(0.024)], pelo, { ...mp, seg: 6, rad: 6, linha: false });
      bl(B, g, E(0.075), pelo, l * E(0.135), E(-0.03), E(0.06), { ...mp, sz: 1.3, seed: 12 + l, seg: 10, linha: false });           // músculo da mandíbula
      // olhos de fogo no fundo da órbita
      B.esf(g, E(0.05), 0x0a0405, l * E(0.1), E(0.075), E(0.215), { seg: 8, linha: false });
      B.olho(g, E(0.04), o.olho ?? COR.lava, l * E(0.1), E(0.075), E(0.228), { fenda: !!o.fenda, brilho: 1.2 });
      B.esf(g, E(0.065), COR.brasa, l * E(0.1), E(0.075), E(0.24), { op: 0.28, emissive: COR.brasa, brilho: 0.9, seg: 7, linha: false });
      // orelhas pontudas, rasgadas e viradas para trás
      tb(B, g, [[l * E(0.1), E(0.12), E(-0.02)], [l * E(0.17), E(0.23), E(-0.1)], [l * E(0.22), E(0.3), E(-0.22)]], [E(0.07), E(0.05), 0.003], pelo, { ...mp, seg: 6, rad: 5, linha: false, pontas: false });
      tb(B, g, [[l * E(0.11), E(0.14), E(-0.03)], [l * E(0.17), E(0.225), E(-0.1)], [l * E(0.2), E(0.27), E(-0.19)]], [E(0.035), E(0.022), 0.003], 0x6a1a1a, { seg: 4, rad: 5, linha: false, pontas: false, emissive: 0x300808, brilho: 0.4 });
      // espinhos de osso nas bochechas
      B.cone(g, E(0.018), E(0.13), COR.ossoVelho, l * E(0.16), E(-0.05), E(0.0), { rz: -l * 1.2, rx: 0.3, seg: 5, linha: false });
      B.cone(g, E(0.013), E(0.09), COR.ossoVelho, l * E(0.15), E(-0.1), E(0.07), { rz: -l * 1.35, rx: 0.3, seg: 5, linha: false });
      // dentes de cima + presa enorme
      for (let i = 0; i < 3; i++) presa(B, g, l * E(0.088 - i * 0.004), E(-0.09), E(0.25 + i * 0.09), E(0.04), E(0.01), COR.osso, 0.1);
      presa(B, g, l * E(0.08), E(-0.085), E(0.51), E(0.15), E(0.022), COR.osso, 0.18);
    });
    // gengiva à mostra
    tb(B, g, [[E(-0.098), E(-0.085), E(0.2)], [E(-0.085), E(-0.09), E(0.4)], [0, E(-0.078), E(0.55)], [E(0.085), E(-0.09), E(0.4)], [E(0.098), E(-0.085), E(0.2)]],
      [E(0.02), E(0.022), E(0.02), E(0.022), E(0.02)], 0x8a1a20, { tex: 'carne', seg: 10, rad: 5, linha: false, pontas: false });
    // cicatriz cortando o olho
    if (o.cicatriz) tb(B, g, [[E(-0.07), E(0.17), E(0.3)], [E(-0.105), E(0.09), E(0.25)], [E(-0.135), E(0.0), E(0.2)]], [E(0.007), E(0.01), E(0.006)], 0x8a4a40, { seg: 5, rad: 4, linha: false, pontas: false });
    // interior da boca em brasa
    bl(B, g, E(0.07), 0x3a0808, 0, E(-0.075), E(0.3), { emissive: 0xff3a0a, brilho: 0.8, sz: 2.1, sy: 0.6, seed: 4, linha: false, seg: 8 });
    // mandíbula (pivô na articulação)
    const mand = B.grupo(g, 0, E(-0.075), E(0.07));
    bl(B, mand, E(0.08), pelo, 0, E(-0.03), E(0.19), { ...mp, sz: 2.0, sy: 0.55, sx: 0.95, amp: 0.07, seed: 14, linha: false });
    bl(B, mand, E(0.05), claro, 0, E(-0.045), E(0.4), { ...mp, sz: 1.3, sy: 0.7, seed: 15, seg: 8, linha: false });
    [-1, 1].forEach(l => {
      for (let i = 0; i < 3; i++) presa(B, mand, l * E(0.058), E(0.025), E(0.16 + i * 0.09), E(0.035), E(0.009), COR.osso, -0.1, { rx: PI });
      presa(B, mand, l * E(0.05), E(0.025), E(0.4), E(0.11), E(0.018), COR.osso, -0.1, { rx: PI });
    });
    // língua que pende
    tb(B, mand, [[0, E(0.0), E(0.12)], [E(0.02), E(-0.02), E(0.25)], [E(0.07), E(-0.07), E(0.33)], [E(0.1), E(-0.17), E(0.33)]], [E(0.03), E(0.028), E(0.022), E(0.012)], 0xa02830, { tex: 'carne', seg: 8, rad: 5, linha: false, emissive: 0x501008, brilho: 0.4 });
    // crista de espinhos na nuca
    for (let i = 0; i < 5; i++) B.cone(g, E(0.034 * (1 - i * 0.1)), E(0.19 * (1 - i * 0.08)), i % 2 ? COR.ferro : 0x4a3a40, 0, E(0.17 - i * 0.015), E(-0.02 - i * 0.075), { rx: -0.5 - i * 0.12, seg: 5, linha: false, metal: 0.4, rough: 0.5 });
    return { g, mand };
  }

  M.cerbero = (B, R) => {
    const R2 = rnd(21), tronco = B.grupo(R, 0, 0, 0), mp = { tex: 'pelo', rep: 3, rough: 0.95 };
    const pelo = 0x2a1c17, clara = 0x4a3228, brasa = 0xff5a14;
    // massas do corpo: peito imenso, cintura apertada, anca forte
    const PEITO = [[0, 0.84, 0.22], [0.4, 0.44, 0.42]], CINT = [[0, 0.74, -0.15], [0.27, 0.28, 0.3]], ANCA = [[0, 0.76, -0.45], [0.32, 0.33, 0.32]];
    const el = (c, v, cor, seed, seg = 14, o = {}) => bl(B, tronco, 1, cor, ...c[0], { ...mp, sx: c[1][0], sy: c[1][1], sz: c[1][2], amp: 0.08, seed, seg, ...o });
    el(PEITO, 0, pelo, 1, 12); el(CINT, 0, clara, 2, 10); el(ANCA, 0, pelo, 3, 12);
    bl(B, tronco, 0.2, clara, 0, 0.74, 0.55, { ...mp, sx: 1.3, sy: 1.2, sz: 0.7, amp: 0.1, seed: 4, linha: false });   // peitoral claro
    [-1, 1].forEach(l => {
      bl(B, tronco, 0.2, pelo, l * 0.28, 1.0, 0.18, { ...mp, sz: 1.2, amp: 0.1, seed: 5 + l, seg: 10, linha: false });   // ombro/trapézio
      tb(B, tronco, [[l * 0.12, 0.66, 0.62], [l * 0.22, 0.75, 0.55], [l * 0.33, 0.83, 0.44]], [0.01, 0.012, 0.006], 0x8a4a40, { seg: 4, rad: 4, linha: false, pontas: false });   // cicatriz
    });
    // costelas expostas nos flancos (osso gasto)
    [-1, 1].forEach(l => {
      for (let i = 0; i < 3; i++) {
        const z = -0.28 + i * 0.1;
        tb(B, tronco, [[l * 0.1, 1.0, z], [l * 0.25, 0.94, z], [l * 0.3, 0.78, z - 0.02], [l * 0.23, 0.6, z - 0.04]], [0.011, 0.013, 0.011, 0.006], 0x9a8a6a, { tex: 'osso', seg: 8, rad: 4, linha: false, pontas: false });
      }
    });
    // rachaduras de lava nos flancos, anca e peito
    [[0.8, -0.15], [2.2, 0.2], [-0.8, 0.2], [-2.3, 0.3]].forEach(([u, v], i) => rachadura(B, tronco, ANCA[0], ANCA[1], u, v, 5, 0.55, 30 + i, 0.007, brasa, 1.0));
    [[1.0, 0.1], [-1.0, 0.1], [-1.5, -0.2]].forEach(([u, v], i) => rachadura(B, tronco, PEITO[0], PEITO[1], u, v, 4, 0.5, 50 + i, 0.007, brasa, 1.0));
    // brasas espalhadas no pelo
    for (let i = 0; i < 10; i++) {
      const alvo = [PEITO, CINT, ANCA][i % 3], u = (R2() - 0.5) * PI * 2, v = (R2() - 0.2) * 1.2, p = sup(alvo[0], alvo[1], u, v, 1.03);
      B.esf(tronco, 0.009 + R2() * 0.01, i % 4 ? brasa : COR.fogoAmar, p[0], p[1], p[2], { emissive: i % 4 ? brasa : COR.fogoAmar, brilho: 1.3, seg: 5, linha: false });
    }
    // tufos arrepiados no dorso e ombros (alguns com ponta em brasa)
    for (let i = 0; i < 17; i++) {
      const alvo = [PEITO, CINT, ANCA][i % 3], u = (R2() - 0.5) * PI * 2, v = 0.25 + R2() * 1.0;
      espeto(B, tronco, alvo[0], alvo[1], u, v, 0.1 + R2() * 0.1, 0.03, i % 3 ? pelo : clara, { ...mp, vies: [0, 0.2, -0.5], seg: 4 });
    }
    // espinhos de obsidiana ao longo da coluna, com ponta em brasa
    for (let i = 0; i < 9; i++) {
      const z = 0.5 - i * 0.14, y = 1.2 - Math.abs(i - 1) * 0.02 - i * 0.026, tam = 0.22 - i * 0.012;
      B.cone(tronco, 0.045, tam, i % 2 ? 0x241c20 : 0x372a30, 0, y, z, { seg: 5, rough: 0.3, linha: false }).rotation.x = -0.35;
      B.cone(tronco, 0.013, 0.06, brasa, 0, y + tam * 0.45, z - tam * 0.2, { seg: 4, linha: false, emissive: brasa, brilho: 1.2 }).rotation.x = -0.35;
    }
    // ---- pescoços e cabeças ----
    const defs = [
      { x: 0, y: 1.22, z: 0.7, e: 1.12, yaw: 0, pit: 0.22, fase: 0, olho: COR.lava, cic: true, ab: 0.22 },
      { x: -0.46, y: 1.1, z: 0.5, e: 0.96, yaw: -0.5, pit: 0.3, fase: 2.1, olho: COR.brasa, cic: false, ab: 0.4 },
      { x: 0.46, y: 1.1, z: 0.5, e: 0.96, yaw: 0.5, pit: 0.3, fase: 4.2, olho: 0xff9a20, cic: false, ab: 0.35 },
    ];
    const cabs = defs.map(d => {
      const sx = Math.sign(d.x) * 0.2;
      tb(B, tronco, [[sx, 0.92, 0.3], [d.x * 0.6 + sx * 0.4, 1.0, 0.4], [d.x * 0.92, d.y - 0.07, d.z - 0.1], [d.x, d.y - 0.02, d.z]], [0.21, 0.18, 0.15 * d.e, 0.13 * d.e], pelo, { ...mp, seg: 8, rad: 7 });
      const pv = B.grupo(tronco, d.x, d.y, d.z); pv.rotation.set(d.pit, d.yaw, 0);
      const h = cabecaCao(B, pv, d.e, { olho: d.olho, cicatriz: d.cic });
      // coleira de espinhos com argola e corrente partida
      const cc = [d.x * 0.93, d.y - 0.11 * d.e, d.z - 0.12], rot = [0.9 - d.pit * 0.8, d.yaw * 0.5, 0];
      anelEsp(B, tronco, cc, 0.17 * d.e, 0.032, rot, 9, 0.1, COR.ferroVel, { corAnel: 0x3a2e2a, anel: { tex: 'couro', rep: 2, metal: 0.2 } });
      const fr = new THREE.Vector3(0, -0.05, 0.19 * d.e).applyEuler(new THREE.Euler(rot[0], rot[1], rot[2])), a = [cc[0] + fr.x, cc[1] + fr.y, cc[2] + fr.z];
      B.tor(tronco, 0.04, 0.012, COR.ferroVel, a[0], a[1], a[2], { metal: 0.7, seg: 8, linha: false });
      corrente(B, tronco, [[a[0], a[1] - 0.04, a[2]], [a[0] + 0.03, a[1] - 0.14, a[2] + 0.04], [a[0] - 0.01, a[1] - 0.27, a[2] + 0.02]], 3, 0.065, COR.ferroVel);
      return { ...h, d, pv };
    });
    // ---- pernas: 0,1 frente; 2,3 trás ----
    function pata(x, y, z, frente, lado) {
      const p = B.grupo(R, x, y, z);
      if (frente) {
        bl(B, p, 0.18, pelo, 0, 0.0, -0.01, { ...mp, sy: 1.25, sx: 0.95, seed: 20 + lado, seg: 10, linha: false });
        tb(B, p, [[0, 0, 0], [0, -0.2, 0.03], [0, -0.36, -0.01]], [0.15, 0.13, 0.095], pelo, { ...mp, seg: 8, rad: 7 });
        tb(B, p, [[0, -0.36, -0.01], [0, -0.52, 0.0], [0, -0.66, 0.03]], [0.09, 0.075, 0.078], clara, { ...mp, seg: 6, rad: 7 });
      } else {
        bl(B, p, 0.21, pelo, 0, -0.06, -0.02, { ...mp, sy: 1.3, sx: 0.85, sz: 1.15, seed: 24 + lado, seg: 10, linha: false });
        tb(B, p, [[0, -0.08, 0], [0, -0.3, -0.13], [0, -0.5, -0.03], [0, -0.66, 0.05]], [0.15, 0.095, 0.065, 0.072], clara, { ...mp, seg: 8, rad: 7 });
        B.cone(p, 0.04, 0.12, COR.ossoVelho, 0, -0.3, -0.2, { rx: -2.0, seg: 5, linha: false });     // esporão no jarrete
      }
      // pata larga com dedos e garras grandes
      bl(B, p, 0.095, clara, 0, -0.67, 0.07, { ...mp, sz: 1.35, sy: 0.65, seed: 27, seg: 10, linha: false });
      [-1, 0, 1].forEach(i => {
        bl(B, p, 0.04, pelo, i * 0.058, -0.685, 0.15, { ...mp, sz: 1.2, sy: 0.8, seed: 28 + i, seg: 6, linha: false });
        garra(B, p, i * 0.062, -0.68, 0.17, 0.13, 0.017, 0x1c1412, { ry: i * 0.12 });
      });
      anelEsp(B, p, [0, frente ? -0.5 : -0.46, 0], 0.085, 0.03, [0, 0, 0], 5, 0.06, COR.ferroVel, { corAnel: COR.ferro, rad: 0.016 });   // pulseira de ferro com espinhos
      return p;
    }
    const pernas = [pata(-0.26, 0.76, 0.28, true, -1), pata(0.26, 0.76, 0.28, true, 1), pata(-0.27, 0.74, -0.46, false, -1), pata(0.27, 0.74, -0.46, false, 1)];
    // ---- cauda de serpente ----
    const cauda = B.grupo(R, 0, 0.82, -0.74);
    const trilha = [[0, 0, 0], [0, 0.1, -0.16], [0, 0.3, -0.3], [0, 0.54, -0.27], [0, 0.66, -0.1]];
    tb(B, cauda, trilha, [0.075, 0.062, 0.05, 0.04, 0.032], 0x35502a, { tex: 'escamas', rep: 3, seg: 14, rad: 8 });
    tb(B, cauda, trilha.slice(0, 4), [0.045, 0.036, 0.03, 0.024], 0xc8b070, { tex: 'escamas', rep: 3, seg: 10, rad: 5, linha: false, pontas: false, z: 0.025, y: -0.01 });   // barriga clara
    const cs = B.grupo(cauda, 0, 0.67, -0.07); cs.rotation.x = -0.75;
    bl(B, cs, 0.062, 0x35502a, 0, 0, 0.03, { tex: 'escamas', rep: 2, sz: 1.3, sy: 0.85, seed: 33, seg: 10 });
    bl(B, cs, 0.04, 0x35502a, 0, -0.005, 0.1, { tex: 'escamas', rep: 2, sz: 1.3, sy: 0.7, seed: 34, seg: 8, linha: false });
    [-1, 1].forEach(l => {
      B.olho(cs, 0.017, 0xffe14d, l * 0.04, 0.03, 0.05, { fenda: true });
      presa(B, cs, l * 0.02, -0.03, 0.1, 0.05, 0.008, COR.osso, 0.2);
      B.cone(cs, 0.012, 0.05, 0x1c2a14, l * 0.045, 0.045, 0.0, { rz: -l * 0.7, seg: 4, linha: false });
    });
    tb(B, cs, [[0, -0.03, 0.1], [0, -0.05, 0.19], [0.015, -0.05, 0.25]], [0.006, 0.005, 0.003], 0xc02a20, { seg: 4, rad: 4, linha: false, pontas: false, emissive: 0x601008 });
    // ---- brasas que sobem das bocas ----
    const parts = [];
    for (let i = 0; i < 12; i++) {
      const m = B.vivo(B.esf(R, 0.013, i % 3 ? COR.brasa : COR.fogoAmar, 0, 0, 0, { seg: 5, linha: false, emissive: COR.lava, brilho: 1.5 }));
      m.userData.ci = i; parts.push(m);
    }
    finalizar(B);
    return {
      altura: 1.5, p: { tronco, pernas, cauda },
      anim: (t, dt, st) => {
        const golpe = st && st.golpe ? Math.sin(Math.min(1, st.golpe) * PI) : 0;
        cabs.forEach((c, i) => {
          const d = c.d, ph = t * 1.3 + d.fase;
          c.pv.rotation.y = d.yaw + Math.sin(ph) * 0.2;
          c.pv.rotation.x = d.pit + Math.sin(ph * 1.7) * 0.07 + golpe * 0.3;
          c.mand.rotation.x = d.ab + Math.max(0, Math.sin(ph * 2.3)) * 0.2 + golpe * 0.5;
        });
        parts.forEach(m => {
          const i = m.userData.ci, cab = cabs[i % 3], ciclo = (t * 0.35 + i * 0.173) % 1;
          m.position.set(cab.d.x * 1.15 + Math.sin(i * 2.1 + t) * 0.07, cab.d.y - 0.05 + ciclo * 0.5, cab.d.z + 0.35 + Math.cos(i * 1.7) * 0.05);
          m.scale.setScalar(Math.max(0.01, 1 - ciclo));
        });
      },
    };
  };

  /* ============================================================
     DIABRETE — demoniozinho corcunda com tridente e bola de fogo
     ============================================================ */
  M.diabrete = (B, R) => {
    const pele = 0xc23a24, escura = 0x86201a, clara = 0xdb6a40, osso = COR.osso;
    const mp = { tex: 'pele', rep: 2, rough: 0.7 };
    const tronco = B.grupo(R, 0, 0.52, 0); tronco.rotation.x = 0.42;
    // ---- corpo: pelve, barriga de pança, peito magro e corcunda ----
    bl(B, tronco, 0.14, escura, 0, -0.02, 0, { ...mp, sx: 1.1, seed: 1, seg: 11 });
    bl(B, tronco, 0.19, clara, 0, 0.2, 0.05, { ...mp, sz: 1.05, sy: 1.1, amp: 0.07, seed: 2, seg: 12 });             // barriga
    bl(B, tronco, 0.17, pele, 0, 0.44, 0.0, { ...mp, sx: 1.05, sy: 0.95, seed: 3, seg: 12 });                        // peito
    bl(B, tronco, 0.13, escura, 0, 0.55, -0.11, { ...mp, sy: 1.1, amp: 0.15, seed: 4, seg: 10 });                    // corcunda
    for (let i = 0; i < 6; i++) B.cone(tronco, 0.028 - i * 0.002, 0.13 - i * 0.01, i % 2 ? COR.ossoVelho : 0x3a1410, 0, 0.62 - i * 0.12, -0.2 + i * 0.012, { seg: 5, rx: -1.0, linha: false });
    [-1, 1].forEach(l => {
      // costelas à mostra, verrugas
      for (let i = 0; i < 3; i++) tb(B, tronco, [[l * 0.1, 0.5 - i * 0.06, 0.12], [l * 0.17, 0.48 - i * 0.06, 0.07], [l * 0.18, 0.46 - i * 0.06, -0.02]], [0.007, 0.009, 0.006], osso, { seg: 5, rad: 4, linha: false, pontas: false });
      bl(B, tronco, 0.022, 0x5a1812, l * 0.1, 0.32, 0.2, { seg: 6, linha: false, amp: 0.2, seed: 5 });
    });
    bl(B, tronco, 0.018, 0x5a1812, -0.04, 0.5, 0.15, { seg: 6, linha: false, amp: 0.2, seed: 6 });
    tb(B, tronco, [[-0.1, 0.38, 0.18], [0.0, 0.3, 0.22], [0.12, 0.22, 0.2]], [0.006, 0.009, 0.006], 0xf0b090, { seg: 6, rad: 4, linha: false, pontas: false });          // cicatriz na barriga
    B.esf(tronco, 0.016, 0x7a2018, 0, 0.17, 0.235, { seg: 6, linha: false });                                       // umbigo
    // cinto de osso com dentes e trapo
    tb(B, tronco, [[-0.16, 0.06, 0.05], [0, 0.04, 0.17], [0.16, 0.06, 0.05]], [0.018, 0.02, 0.018], 0x3a2418, { tex: 'couro', seg: 8, rad: 5, linha: false });
    for (let i = 0; i < 5; i++) presa(B, tronco, (i - 2) * 0.05, 0.04, 0.165 - Math.abs(i - 2) * 0.012, 0.045, 0.01, osso, 0.1);
    forma(B, tronco, [[-0.08, 0], [0.08, 0], [0.06, -0.14], [0.0, -0.2], [-0.07, -0.12]], 0.01, 0x3a1410, 0, 0.05, 0.17, { tex: 'tecido', dupla: true, linha: false, bisel: 0, rx: -0.2 });
    // colar de dentes
    tb(B, tronco, [[-0.12, 0.62, 0.1], [0, 0.56, 0.2], [0.12, 0.62, 0.1]], [0.01, 0.01, 0.01], 0x3a2418, { seg: 8, rad: 4, linha: false });
    for (let i = 0; i < 5; i++) presa(B, tronco, (i - 2) * 0.045, 0.565 + Math.abs(i - 2) * 0.012, 0.19 - Math.abs(i - 2) * 0.03, 0.04, 0.008, osso, 0.1);
    // ---- cabeça grande e maldosa ----
    tb(B, tronco, [[0, 0.58, 0.0], [0, 0.66, 0.06]], [0.09, 0.08], pele, { ...mp, seg: 3, rad: 7, linha: false });
    const cabeca = B.grupo(tronco, 0, 0.7, 0.07); cabeca.rotation.x = -0.55;
    bl(B, cabeca, 0.2, pele, 0, 0.1, 0, { ...mp, sx: 1.08, sy: 0.95, amp: 0.04, seed: 11, seg: 14 });
    bl(B, cabeca, 0.075, pele, 0, 0.07, 0.19, { ...mp, sz: 0.9, sy: 0.8, seed: 12, seg: 9, linha: false });               // focinho/nariz
    bl(B, cabeca, 0.035, escura, 0, 0.1, 0.25, { seg: 8, sx: 1.2, sy: 0.9, linha: false, rough: 0.4, seed: 13 });         // ponta do nariz
    // boca enorme sorrindo, cheia de dentes
    bl(B, cabeca, 0.11, 0x2a0608, 0, 0.0, 0.12, { emissive: 0x401008, brilho: 0.5, sx: 1.2, sy: 0.5, sz: 0.9, linha: false, seg: 9 });
    const mand = B.grupo(cabeca, 0, 0.0, 0.0);
    bl(B, mand, 0.075, pele, 0, -0.045, 0.12, { ...mp, sx: 1.45, sy: 0.55, sz: 1.0, seed: 14, seg: 10 });
    tb(B, cabeca, [[-0.16, 0.0, 0.06], [-0.14, 0.04, 0.12], [-0.1, 0.06, 0.18]], [0.02, 0.02, 0.016], escura, { seg: 5, rad: 5, linha: false, pontas: false });   // covinha do sorriso
    tb(B, cabeca, [[0.16, 0.0, 0.06], [0.14, 0.04, 0.12], [0.1, 0.06, 0.18]], [0.02, 0.02, 0.016], escura, { seg: 5, rad: 5, linha: false, pontas: false });
    for (let i = 0; i < 9; i++) {
      const a = (i / 8 - 0.5) * 2.3, x = Math.sin(a) * 0.15, z = 0.09 + Math.cos(a) * 0.1, g = i === 2 || i === 6;
      presa(B, cabeca, x, 0.03, z, g ? 0.07 : 0.045, g ? 0.012 : 0.009, osso, 0.1);
      presa(B, mand, x * 0.9, -0.022, z - 0.01, g ? 0.055 : 0.04, 0.009, osso, -0.1, { rx: PI });
    }
    bl(B, mand, 0.03, 0xa02830, 0, -0.03, 0.14, { tex: 'carne', sy: 0.5, sz: 1.5, linha: false, seg: 7, seed: 15 });      // língua
    [-1, 1].forEach(l => {
      // olhos amarelos de fenda e sobrancelhas
      B.esf(cabeca, 0.052, 0x1a0505, l * 0.09, 0.17, 0.15, { seg: 8, linha: false });
      B.olho(cabeca, 0.042, 0xffe030, l * 0.092, 0.17, 0.165, { fenda: true, brilho: 1.2 });
      tb(B, cabeca, [[l * 0.02, 0.23, 0.18], [l * 0.08, 0.255, 0.16], [l * 0.17, 0.27, 0.1]], [0.022, 0.025, 0.018], escura, { ...mp, seg: 6, rad: 5, linha: false });
      // orelhas enormes e pontudas (balançam)
      const o = B.grupo(cabeca, l * 0.17, 0.15, -0.02);
      tb(B, o, [[0, 0, 0], [l * 0.14, 0.07, -0.04], [l * 0.3, 0.2, -0.08], [l * 0.42, 0.33, -0.12]], [0.075, 0.06, 0.035, 0.003], pele, { ...mp, seg: 8, rad: 6, linha: false });
      tb(B, o, [[0, 0.005, 0.01], [l * 0.13, 0.075, -0.03], [l * 0.28, 0.2, -0.07], [l * 0.37, 0.3, -0.1]], [0.04, 0.032, 0.018, 0.003], 0xe08a70, { seg: 6, rad: 5, linha: false, pontas: false });
      cabeca.userData['o' + l] = o;
      // chifrinhos curvos
      corno(B, cabeca, [[l * 0.09, 0.27, 0.04], [l * 0.14, 0.36, 0.02], [l * 0.12, 0.46, -0.04], [l * 0.06, 0.52, -0.04]], 0.04, 0x2a1410, { aneis: 8, tex: 'osso', linha: false });
      bl(B, cabeca, 0.045, pele, l * 0.14, 0.04, 0.1, { ...mp, seg: 8, linha: false });                               // bochecha
    });
    B.cone(cabeca, 0.03, 0.12, 0x2a1410, 0, -0.07, 0.17, { rx: 2.2, seg: 5, linha: false });                          // cavanhaque
    // ---- braços longos e magros ----
    function braco(lado) {
      const b = B.grupo(tronco, lado * 0.22, 0.5, 0.02), s = lado;
      bl(B, b, 0.075, pele, 0, 0, 0, { ...mp, seg: 8, linha: false, seed: 20 });
      tb(B, b, [[0, 0, 0], [s * 0.02, -0.1, 0.02], [s * 0.03, -0.21, 0.0]], [0.062, 0.055, 0.042], pele, { ...mp, seg: 5, rad: 6, linha: false });
      tb(B, b, [[s * 0.03, -0.21, 0.0], [s * 0.03, -0.32, 0.04], [s * 0.02, -0.43, 0.08]], [0.042, 0.04, 0.036], escura, { ...mp, seg: 5, rad: 6, linha: false });
      B.cone(b, 0.016, 0.07, osso, s * 0.06, -0.22, -0.03, { rz: -s * 1.2, seg: 5, linha: false });
      const mao = B.grupo(b, s * 0.02, -0.46, 0.08);
      bl(B, mao, 0.05, escura, 0, -0.02, 0, { ...mp, seg: 8, linha: false, seed: 21 });
      for (let i = 0; i < 3; i++) garra(B, mao, (i - 1) * 0.028, -0.06, 0.02, 0.09, 0.01, 0x1a0a08, { rx: PI / 2, cv: 0.25, ry: PI });
      garra(B, mao, s * 0.045, -0.02, 0.03, 0.06, 0.009, 0x1a0a08, { rx: PI / 2, rz: s * 0.8, cv: 0.25 });
      b.userData.mao = mao;
      return b;
    }
    const bracoE = braco(-1), bracoD = braco(1);
    // tridente (mão direita)
    bracoD.rotation.set(-0.35, 0, 0.35);
    const tri = B.grupo(bracoD.userData.mao, 0, -0.03, 0.03); tri.rotation.set(0.5, 0, -0.7);
    B.cil(tri, 0.016, 0.018, 0.9, 0x3a2418, 0, 0.28, 0, { seg: 6, tex: 'couro', linha: false });
    B.esf(tri, 0.03, COR.ferro, 0, -0.18, 0, { metal: 0.5, seg: 6, linha: false });
    B.cil(tri, 0.03, 0.026, 0.05, COR.ferroVel, 0, 0.72, 0, { seg: 8, metal: 0.6, linha: false });
    [-1, 0, 1].forEach(l => {
      const h = l ? 0.17 : 0.26;
      tb(B, tri, [[0, 0.74, 0], [l * 0.045, 0.78, 0], [l * 0.085, 0.8 + h * 0.5, 0], [l * (l ? 0.07 : 0), 0.78 + h, 0]], [0.014, 0.012, 0.011, 0.003], COR.ferroVel, { metal: 0.7, rough: 0.3, seg: 6, rad: 5, linha: false, pontas: false });
      if (l) B.cone(tri, 0.012, 0.045, COR.ferroVel, l * 0.1, 0.84, 0, { rz: l * 1.9, seg: 4, linha: false, metal: 0.7 });  // farpa
    });
    tb(B, tri, [[-0.02, 0.8, 0], [0, 0.82, 0], [0.02, 0.8, 0]], [0.009, 0.01, 0.009], COR.brasa, { emissive: COR.brasa, brilho: 0.8, seg: 3, rad: 4, linha: false, pontas: false });
    // bola de fogo (mão esquerda levantada)
    bracoE.userData.fixo = -1.95;
    const fb = B.grupo(bracoE.userData.mao, 0, -0.1, 0.02);
    const nucleo = B.vivo(B.esf(fb, 0.07, COR.lava, 0, 0, 0, { emissive: COR.lava, brilho: 1.0, seg: 10, linha: false }));
    const miolo = B.vivo(B.esf(fb, 0.1, COR.brasa, 0, 0, 0, { emissive: COR.brasa, brilho: 1.0, op: 0.7, seg: 10, linha: false }));
    const chamas = [0, 1, 2, 3, 4].map(i => { const a = i / 5 * PI * 2; const c = chama(B, fb, Math.cos(a) * 0.07, Math.sin(a) * 0.05 + 0.03, Math.sin(a) * 0.07, 0.17, 0.035, COR.brasa, COR.lava); aponta(c, [Math.cos(a), 0.9, Math.sin(a)]); return c; });
    // ---- pernas curtas com joelho invertido e pés de garras ----
    function perna(lado) {
      const p = B.grupo(R, lado * 0.1, 0.52, 0), s = lado;
      bl(B, p, 0.09, pele, 0, -0.04, 0.02, { ...mp, sy: 1.2, seg: 8, linha: false, seed: 30 });
      tb(B, p, [[0, 0, 0], [0, -0.09, 0.08], [0, -0.18, 0.13]], [0.08, 0.065, 0.052], pele, { ...mp, seg: 5, rad: 6, linha: false });
      tb(B, p, [[0, -0.18, 0.13], [0, -0.3, 0.07], [0, -0.4, 0.03]], [0.052, 0.04, 0.034], escura, { ...mp, seg: 5, rad: 6, linha: false });
      tb(B, p, [[0, -0.4, 0.03], [0, -0.46, 0.07], [0, -0.5, 0.13]], [0.034, 0.03, 0.03], escura, { seg: 3, rad: 5, linha: false });
      for (let i = -1; i <= 1; i++) { bl(B, p, 0.022, escura, i * 0.03, -0.5, 0.16, { seg: 6, linha: false, sz: 1.2 }); garra(B, p, i * 0.03, -0.5, 0.17, 0.07, 0.011, 0x1a0a08, { ry: i * 0.18 }); }
      B.cone(p, 0.015, 0.06, 0x1a0a08, 0, -0.41, -0.02, { rx: -2.3, seg: 4, linha: false });
      return p;
    }
    const pernaE = perna(-1), pernaD = perna(1);
    // ---- cauda longa com ponta de flecha ----
    const cauda = B.grupo(R, 0, 0.5, -0.16);
    tb(B, cauda, [[0, 0, 0], [0, -0.1, -0.22], [0.08, -0.12, -0.45], [-0.08, -0.02, -0.65], [0, 0.14, -0.78], [0.06, 0.28, -0.74]], [0.055, 0.045, 0.034, 0.026, 0.02, 0.014], pele, { ...mp, seg: 16, rad: 5, linha: false });
    for (let i = 0; i < 5; i++) B.cone(cauda, 0.014, 0.05, 0x3a1410, 0, -0.07 + i * 0.01, -0.12 - i * 0.12, { seg: 4, linha: false });
    const seta = B.grupo(cauda, 0.06, 0.28, -0.74); seta.rotation.x = -0.2;
    forma(B, seta, [[0, 0.17], [0.075, 0.0], [0.022, -0.02], [0, -0.07], [-0.022, -0.02], [-0.075, 0.0]], 0.026, 0x2a1410, 0, 0.0, 0, { metal: 0.5, rough: 0.4 });
    // ---- asinhas de morcego (batem) ----
    function asa(l) { const a = B.grupo(tronco, l * 0.08, 0.5, -0.14); a.rotation.y = l * 0.35; asaMorcego(B, a, l, 0.42, 0x8a2a30, 0x3a1410, { brilho: 0x401008 }); return a; }
    const asaE = asa(-1), asaD = asa(1);
    finalizar(B);
    const orelhas = [cabeca.userData['o-1'], cabeca.userData['o1']];
    return {
      altura: 1.2,
      p: { tronco, cabeca, bracoD, bracoE, pernaD, pernaE, asaD, asaE, cauda, mandibula: { g: mand, aberta: 0.6, fechada: 0.12 }, balancos: [{ g: orelhas[0], amp: 0.12, vel: 3, eixo: 'z' }, { g: orelhas[1], amp: 0.12, vel: 3.3, eixo: 'z', fase: 1.5 }] },
      anim: (t) => {
        const k = 1 + Math.sin(t * 9) * 0.13;
        nucleo.scale.setScalar(k); miolo.scale.setScalar(1 + Math.sin(t * 7 + 1) * 0.12);
        chamas.forEach((c, i) => { const q = 1 + Math.sin(t * 12 + i * 1.7) * 0.25; c.scale.set(q, 1 + Math.sin(t * 10 + i) * 0.3, q); });
      },
    };
  };

  /* ============================================================
     DEMONIO — demônio alado musculoso, espada flamejante
     ============================================================ */
  M.demonio = (B, R) => {
    const pele = 0x6e211d, escura = 0x45130f, lava = COR.brasa, osso = COR.osso, ferro = COR.ferro;
    const mp = { tex: 'pele', rep: 2, rough: 0.75 };
    const raiz = B.grupo(R, 0, 0, 0); raiz.scale.setScalar(0.82);
    const tronco = B.grupo(raiz, 0, 0.86, 0); tronco.rotation.x = 0.2;
    // ---- tronco: pelve, abdômen em gomos, peitoral largo ----
    bl(B, tronco, 0.25, escura, 0, 0.0, 0, { ...mp, sx: 1.15, sy: 0.9, seed: 1, seg: 12 });
    bl(B, tronco, 0.18, pele, 0, 0.3, 0.02, { ...mp, sy: 1.3, sx: 0.95, seed: 2, seg: 12 });
    const PEITO = [[0, 0.68, 0.03], [0.38, 0.31, 0.3]];
    bl(B, tronco, 1, pele, ...PEITO[0], { ...mp, sx: PEITO[1][0], sy: PEITO[1][1], sz: PEITO[1][2], amp: 0.06, seed: 3, seg: 16 });
    [-1, 1].forEach(l => {
      bl(B, tronco, 0.17, pele, l * 0.17, 0.7, 0.2, { ...mp, sx: 1.15, sy: 0.85, sz: 0.8, amp: 0.07, seed: 4 + l, seg: 12, linha: false });   // peitoral
      bl(B, tronco, 0.19, escura, l * 0.34, 0.95, -0.04, { ...mp, sx: 1.1, sy: 0.85, seed: 7 + l, seg: 10, linha: false });                    // trapézio
      for (let i = 0; i < 3; i++) bl(B, tronco, 0.065, pele, l * 0.075, 0.14 + i * 0.11, 0.185 - i * 0.012, { ...mp, sy: 0.75, sz: 0.7, amp: 0.1, seed: 10 + i, seg: 8, linha: false });   // abdômen
      // costelas salientes nos flancos
      for (let i = 0; i < 3; i++) tb(B, tronco, [[l * 0.3, 0.45 + i * 0.07, 0.06], [l * 0.33, 0.43 + i * 0.07, -0.02], [l * 0.3, 0.42 + i * 0.07, -0.12]], [0.012, 0.014, 0.01], osso, { seg: 5, rad: 4, linha: false, pontas: false, tex: 'osso' });
    });
    // veias de lava: esterno, peito, abdômen
    tb(B, tronco, [[0, 0.93, 0.27], [0.03, 0.82, 0.31], [-0.03, 0.7, 0.32], [0.03, 0.56, 0.31], [-0.02, 0.42, 0.24], [0.03, 0.28, 0.2], [0, 0.14, 0.19]], [0.008, 0.012, 0.01, 0.012, 0.01, 0.01, 0.006], lava, { emissive: lava, brilho: 0.9, linha: false, seg: 14, rad: 4, pontas: false });
    [[0.6, 0.5], [0.9, 0.25], [-0.6, 0.5], [-0.9, 0.2], [1.3, 0.1], [-1.3, 0.0]].forEach(([u, v], i) => rachadura(B, tronco, PEITO[0], PEITO[1], u, v, 4, 0.4, 70 + i, 0.008, lava, 1.01));
    // cicatrizes
    tb(B, tronco, [[0.1, 0.9, 0.3], [0.25, 0.75, 0.3], [0.33, 0.6, 0.2]], [0.007, 0.01, 0.006], 0xa05a4a, { seg: 5, rad: 4, linha: false, pontas: false });
    // espinhos de osso nas costas
    for (let i = 0; i < 7; i++) { const y = 0.95 - i * 0.14, tam = 0.17 - i * 0.012; B.cone(tronco, 0.035, tam, i % 2 ? osso : COR.ossoVelho, 0, y, -0.3 + i * 0.012, { seg: 5, rx: -1.1, linha: false, tex: 'osso' }); }
    // cinto de ferro com caveira e corrente
    B.cil(tronco, 0.27, 0.27, 0.07, ferro, 0, 0.12, 0, { seg: 14, metal: 0.5, rough: 0.5, tex: 'metal', linha: false });
    bl(B, tronco, 0.065, osso, 0, 0.12, 0.27, { tex: 'osso', sy: 1.1, seed: 9, seg: 9 });
    [-1, 1].forEach(l => { B.esf(tronco, 0.016, 0x050304, l * 0.025, 0.13, 0.33, { seg: 5, linha: false }); presa(B, tronco, l * 0.02, 0.09, 0.325, 0.03, 0.006, osso, 0.1); });
    corrente(B, tronco, [[0.1, 0.1, 0.27], [0.2, 0.0, 0.24], [0.25, -0.12, 0.18]], 5, 0.06, COR.ferroVel);
    // tanga esfarrapada (frente e trás)
    [[-0.17, 0.3], [-0.06, 0.42], [0.06, 0.36], [0.17, 0.28]].forEach(([x, h], i) => {
      forma(B, tronco, [[-0.045, 0], [0.045, 0], [0.05, -h * 0.6], [0.0, -h], [-0.05, -h * 0.7]], 0.012, i % 2 ? 0x3a1018 : 0x52161c, x, 0.09, 0.26 - Math.abs(x) * 0.25, { tex: 'tecido', rep: 1, dupla: true, rx: -0.12, rz: x * 0.6, linha: false, bisel: 0 });
    });
    [-0.13, 0, 0.13].forEach((x, i) => forma(B, tronco, [[-0.06, 0], [0.06, 0], [0.04, -0.3 - i % 2 * 0.1], [-0.01, -0.4], [-0.05, -0.25]], 0.012, 0x3a1018, x, 0.09, -0.24, { tex: 'tecido', dupla: true, rx: 0.2, linha: false, bisel: 0 }));
    // ---- pescoço e cabeça ----
    tb(B, tronco, [[0, 0.92, 0.0], [0, 1.02, 0.07], [0, 1.1, 0.14]], [0.15, 0.12, 0.1], pele, { ...mp, seg: 6, rad: 8 });
    const cabeca = B.grupo(tronco, 0, 1.17, 0.15); cabeca.rotation.x = -0.15;
    bl(B, cabeca, 0.18, pele, 0, 0.12, -0.02, { ...mp, sz: 1.0, sy: 1.0, amp: 0.04, seed: 11, seg: 14 });
    bl(B, cabeca, 0.095, escura, 0, 0.06, 0.15, { ...mp, sz: 1.3, sy: 0.8, amp: 0.04, seed: 12, seg: 10 });                    // focinho
    [-1, 1].forEach(l => {
      // sobrancelha pesada e olho de brasa
      tb(B, cabeca, [[l * 0.02, 0.165, 0.195], [l * 0.08, 0.2, 0.175], [l * 0.15, 0.23, 0.12]], [0.03, 0.034, 0.026], escura, { ...mp, seg: 6, rad: 6, linha: false });
      B.esf(cabeca, 0.04, 0x120404, l * 0.075, 0.15, 0.165, { seg: 8, linha: false });
      B.olho(cabeca, 0.03, 0xffa020, l * 0.077, 0.15, 0.18, { pupila: false, brilho: 1.5 });
      B.esf(cabeca, 0.05, COR.brasa, l * 0.077, 0.15, 0.185, { op: 0.3, emissive: COR.brasa, brilho: 0.9, seg: 7, linha: false });
      // narinas, bochecha, orelha pontuda
      B.esf(cabeca, 0.011, 0x0a0202, l * 0.03, 0.075, 0.27, { seg: 5, linha: false });
      bl(B, cabeca, 0.045, pele, l * 0.12, 0.05, 0.05, { ...mp, sz: 1.3, seg: 8, linha: false });
      tb(B, cabeca, [[l * 0.15, 0.13, -0.03], [l * 0.26, 0.2, -0.08], [l * 0.34, 0.27, -0.14]], [0.04, 0.03, 0.003], escura, { seg: 5, rad: 5, linha: false, pontas: false });
      // GRANDES chifres de carneiro: saem das têmporas, curvam para trás e para cima
      corno(B, cabeca, [[l * 0.12, 0.24, -0.02], [l * 0.28, 0.28, -0.12], [l * 0.36, 0.46, -0.2], [l * 0.3, 0.7, -0.22], [l * 0.17, 0.88, -0.12]], 0.05, 0x2a1c1c, { aneis: 13, tex: 'osso', rep: 2 });
      corno(B, cabeca, [[l * 0.06, 0.24, 0.07], [l * 0.1, 0.34, 0.1], [l * 0.1, 0.46, 0.06]], 0.028, 0x2a1c1c, { aneis: 6, tex: 'osso', linha: false });   // chifrinho da testa
      // presas e espinhos do queixo
      presa(B, cabeca, l * 0.05, 0.02, 0.2, 0.09, 0.016, osso, 0.2, { rx: PI });
    });
    // mandíbula com presas para cima e boca em brasa
    bl(B, cabeca, 0.07, 0x3a0808, 0, 0.0, 0.1, { emissive: 0xff3a0a, brilho: 0.8, sz: 1.5, sy: 0.6, linha: false, seg: 8 });
    const mand = B.grupo(cabeca, 0, 0.03, 0.02);
    bl(B, mand, 0.075, escura, 0, -0.03, 0.12, { ...mp, sz: 1.6, sy: 0.6, amp: 0.05, seed: 13, seg: 10 });
    bl(B, mand, 0.045, pele, 0, -0.07, 0.24, { ...mp, sz: 1.0, sy: 0.9, seed: 14, seg: 8, linha: false });
    [-1, 1].forEach(l => {
      for (let i = 0; i < 4; i++) presa(B, mand, l * 0.05, 0.0, 0.1 + i * 0.045, 0.03, 0.008, osso, -0.1, { rx: PI });
      presa(B, mand, l * 0.055, 0.0, 0.23, 0.11, 0.017, osso, -0.3, { rx: PI });
    });
    for (let i = 0; i < 4; i++) B.cone(mand, 0.018 - i * 0.003, 0.1 - i * 0.015, COR.ossoVelho, 0, -0.1 - i * 0.014, 0.25 - i * 0.04, { rx: 2.3, seg: 5, linha: false });   // barba de espinhos
    // coroa de espinhos na nuca
    for (let i = 0; i < 4; i++) B.cone(cabeca, 0.03, 0.14 - i * 0.02, osso, 0, 0.24 - i * 0.015, -0.1 - i * 0.04, { rx: -0.7 - i * 0.12, seg: 5, linha: false });
    // ---- braços (pivôs no ombro) ----
    function braco(lado) {
      const b = B.grupo(tronco, lado * 0.5, 0.95, 0), s = lado;
      bl(B, b, 0.17, pele, 0, 0, 0, { ...mp, seg: 10, amp: 0.06, seed: 20, linha: false });
      tb(B, b, [[0, 0, 0], [s * 0.04, -0.16, 0.03], [s * 0.05, -0.32, 0.0]], [0.15, 0.15, 0.1], pele, { ...mp, seg: 8, rad: 8 });
      bl(B, b, 0.13, pele, s * 0.02, -0.14, 0.07, { ...mp, sy: 1.2, seg: 9, seed: 25, linha: false });
      tb(B, b, [[s * 0.05, -0.32, 0.0], [s * 0.05, -0.47, 0.06], [s * 0.04, -0.62, 0.1]], [0.11, 0.1, 0.08], escura, { ...mp, seg: 6, rad: 8 });
      B.cone(b, 0.032, 0.16, osso, s * 0.1, -0.33, -0.07, { rz: -s * 1.2, rx: -0.5, seg: 5, linha: false, tex: 'osso' });   // espinho do cotovelo
      // braçadeira de ferro com espetos
      anelEsp(B, b, [s * 0.045, -0.5, 0.07], 0.095, 0.035, [0.15, 0, -s * 0.05], 6, 0.07, COR.ferroVel, { corAnel: ferro, rad: 0.02 });
      // veias de lava no antebraço
      tb(B, b, [[s * 0.075, -0.38, 0.1], [s * 0.1, -0.5, 0.12], [s * 0.09, -0.6, 0.15]], [0.006, 0.008, 0.005], lava, { emissive: lava, brilho: 0.9, linha: false, seg: 4, rad: 4, pontas: false });
      // ombreira: placas de ferro sobrepostas com espinhos de osso
      const om = B.grupo(b, s * 0.04, 0.1, 0); om.rotation.z = -s * 0.5;
      bl(B, om, 0.19, ferro, 0, 0.02, 0, { tex: 'metal', metal: 0.55, rough: 0.4, sy: 0.6, sx: 1.05, amp: 0.04, seed: 21, seg: 12 });
      bl(B, om, 0.16, COR.ferroVel, 0, -0.06, 0, { tex: 'metal', metal: 0.55, rough: 0.4, sy: 0.5, sx: 1.1, amp: 0.04, seed: 23, seg: 10, linha: false });
      for (let i = 0; i < 3; i++) { const a = -0.9 + i * 0.9; B.cone(om, 0.034, 0.17 + (i === 1 ? 0.1 : 0), osso, Math.sin(a) * 0.1, 0.1, Math.cos(a) * 0.1, { rz: -s * 0.2 - Math.sin(a) * 0.4, rx: Math.cos(a) * 0.1 - 0.4 * (i - 1), seg: 5, linha: false, tex: 'osso' }); }
      // mão grande com garras
      const mao = B.grupo(b, s * 0.04, -0.66, 0.1);
      bl(B, mao, 0.09, escura, 0, -0.03, 0.0, { ...mp, sx: 0.95, sy: 1.0, sz: 0.9, seed: 22, seg: 9, linha: false });
      for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 0.04; bl(B, mao, 0.026, escura, x, -0.1, 0.03, { ...mp, sy: 1.5, seg: 6, linha: false }); garra(B, mao, x, -0.14, 0.035, 0.15, 0.014, 0x15100d, { rx: PI / 2, cv: 0.25, ry: PI }); }
      garra(B, mao, s * 0.08, -0.02, 0.05, 0.1, 0.014, 0x15100d, { rx: PI / 2, rz: s * 0.7, cv: 0.25 });
      b.userData.mao = mao;
      return b;
    }
    const bracoE = braco(-1), bracoD = braco(1);
    // ---- espada flamejante na mão direita ----
    bracoD.rotation.x = -0.3; bracoD.rotation.z = 0.55;
    const esp = B.grupo(bracoD.userData.mao, 0, -0.04, 0.05); esp.rotation.set(0.45, 0, -1.15);
    B.cil(esp, 0.026, 0.026, 0.28, 0x1a1210, 0, 0.0, 0, { seg: 8, tex: 'couro', linha: false });
    B.esf(esp, 0.045, ferro, 0, -0.16, 0, { metal: 0.5, seg: 8, linha: false });
    B.cx(esp, 0.36, 0.04, 0.05, ferro, 0, 0.17, 0, { metal: 0.5, rough: 0.4, linha: false });
    [-1, 1].forEach(l => B.cone(esp, 0.022, 0.12, osso, l * 0.21, 0.17, 0, { rz: -l * PI / 2 - l * 0.4, seg: 5, linha: false, tex: 'osso' }));
    forma(B, esp, [[-0.075, 0], [0.075, 0], [0.09, 0.3], [0.065, 0.45], [0.095, 0.62], [0.07, 0.8], [0.095, 0.98], [0.0, 1.22], [-0.095, 0.95], [-0.065, 0.8], [-0.095, 0.6], [-0.06, 0.4], [-0.09, 0.25]], 0.03, 0x241a1e, 0, 0.2, 0, { metal: 0.7, rough: 0.3 });
    forma(B, esp, [[-0.022, 0.05], [0.022, 0.05], [0.026, 0.95], [0, 1.12], [-0.026, 0.95]], 0.036, COR.lava, 0, 0.2, 0, { emissive: COR.lava, brilho: 1.3, linha: false, bisel: 0.002 });
    const fogos = [[0.1, 0.3, 0.26], [-0.1, 0.6, 0.24], [0.1, 0.9, 0.22], [0, 1.2, 0.3]].map(([x, y, h]) => chama(B, esp, x, 0.2 + y, 0.0, h, 0.06, COR.brasa, COR.fogoAmar));
    // ---- asas de morcego (batem em Z) ----
    function asa(lado) {
      const a = B.grupo(tronco, lado * 0.16, 0.9, -0.2);
      a.rotation.y = lado * 0.25;
      asaMorcego(B, a, lado, 0.9, 0x3e1028, 0x2c1a1c, {});
      return a;
    }
    const asaE = asa(-1), asaD = asa(1);
    // ---- pernas de pata de bode (joelho invertido) ----
    function perna(lado) {
      const p = B.grupo(raiz, lado * 0.2, 0.86, 0), s = lado;
      bl(B, p, 0.2, pele, 0, -0.1, 0.03, { ...mp, sy: 1.4, sx: 0.9, seed: 30 + lado, seg: 11, linha: false });
      tb(B, p, [[0, -0.02, 0], [s * 0.01, -0.14, 0.12], [0, -0.3, 0.2]], [0.19, 0.16, 0.115], pele, { ...mp, seg: 8, rad: 8 });
      B.cone(p, 0.04, 0.12, osso, 0, -0.3, 0.28, { rx: PI / 2 - 0.2, seg: 5, linha: false, tex: 'osso' });                // joelho
      tb(B, p, [[0, -0.3, 0.2], [0, -0.44, 0.13], [0, -0.58, 0.04]], [0.12, 0.1, 0.07], escura, { ...mp, seg: 6, rad: 7 });
      B.placa(p, 0.13, 0.2, 0.03, ferro, 0, -0.42, 0.2, { rx: 0.5, metal: 0.5, rough: 0.45, tex: 'metal', linha: false });  // caneleira
      tb(B, p, [[0, -0.58, 0.04], [0, -0.72, 0.07], [0, -0.82, 0.16]], [0.06, 0.05, 0.05], escura, { ...mp, seg: 5, rad: 6 });
      B.cone(p, 0.03, 0.1, osso, 0, -0.6, -0.04, { rx: -2.3, seg: 5, linha: false });   // esporão do calcanhar
      bl(B, p, 0.065, escura, 0, -0.83, 0.2, { ...mp, sz: 1.5, sy: 0.55, seed: 34, seg: 8, linha: false });
      for (let i = -1; i <= 1; i++) garra(B, p, i * 0.05, -0.84, 0.25, 0.14, 0.018, 0x15100d, { ry: i * 0.15 });
      return p;
    }
    const pernaE = perna(-1), pernaD = perna(1);
    // ---- cauda com ponta de lança ----
    const cauda = B.grupo(raiz, 0, 0.84, -0.22);
    tb(B, cauda, [[0, 0, 0], [0, -0.12, -0.25], [0, -0.2, -0.52], [0, -0.04, -0.8], [0, 0.14, -0.92]], [0.075, 0.06, 0.045, 0.03, 0.02], pele, { ...mp, seg: 14, rad: 6 });
    forma(B, cauda, [[0, 0.16], [0.07, 0.0], [0.03, -0.03], [0.0, -0.1], [-0.03, -0.03], [-0.07, 0.0]], 0.03, 0x2a1c1c, 0, 0.14, -0.92, { rx: 0, ry: PI / 2, tex: 'metal', metal: 0.5, linha: false }).rotation.set(-0.3, 0, 0);
    finalizar(B);
    return {
      altura: 1.95,
      p: { tronco, cabeca, bracoD, bracoE, pernaD, pernaE, asaD, asaE, cauda, mandibula: { g: mand, aberta: 0.5, fechada: 0.05 } },
      anim: (t, dt, st) => {
        fogos.forEach((f, i) => { const k = 1 + Math.sin(t * 11 + i * 2) * 0.16; f.scale.set(k, 1 + Math.sin(t * 9 + i) * 0.22, k); });
      },
    };
  };

  /* ============================================================
     ALMA_PENADA — espectro que se afina numa cauda de névoa
     ============================================================ */
  M.alma_penada = (B, R) => {
    const TEAL = COR.alma, BONE = 0xd4f0ea, FERRO = 0x2a3032;
    const nevoa = (op, b = 0.55, cor = TEAL) => ({ op, emissive: cor, brilho: b, linha: false });
    const corpo = B.grupo(R, 0, 0, 0);
    // ---- manto de névoa em 3 camadas: miolo, corpo e aura ----
    const espinha = [[0, 1.06, 0], [0, 0.86, -0.02], [0, 0.62, -0.09], [0.04, 0.42, -0.2], [0.1, 0.27, -0.36], [0.2, 0.2, -0.52]];
    tb(B, corpo, espinha, [0.17, 0.15, 0.115, 0.075, 0.035, 0.008], 0xa8fff0, { ...nevoa(0.7, 0.8), seg: 22, rad: 10, pontas: false });
    tb(B, corpo, espinha, [0.23, 0.215, 0.17, 0.115, 0.06, 0.012], TEAL, { ...nevoa(0.45, 0.6), seg: 22, rad: 10, pontas: false });
    tb(B, corpo, espinha, [0.3, 0.29, 0.23, 0.16, 0.085, 0.02], 0x2fb8c8, { ...nevoa(0.2, 0.4, 0x2fd0e0), seg: 18, rad: 9, pontas: false, tex: 'musgo', rep: 2 });
    // ombros esfarrapados e caimento do pano
    [-1, 1].forEach(l => tb(B, corpo, [[l * 0.1, 1.12, 0], [l * 0.24, 1.08, -0.02], [l * 0.3, 0.95, -0.04], [l * 0.28, 0.8, -0.1]], [0.09, 0.085, 0.06, 0.005], TEAL, { ...nevoa(0.4, 0.55), seg: 8, rad: 7, pontas: false }));
    // caixa torácica e coluna visíveis por dentro (osso fantasma)
    for (let i = 0; i < 5; i++) [-1, 1].forEach(l => tb(B, corpo, [[l * 0.015, 1.02 - i * 0.06, -0.08], [l * 0.1, 1.0 - i * 0.06, 0.0], [l * 0.12, 0.97 - i * 0.06, 0.09], [l * 0.04, 0.95 - i * 0.065, 0.14]], [0.009, 0.009, 0.008, 0.006], BONE, { op: 0.85, emissive: 0x7affe8, brilho: 0.5, linha: false, seg: 6, rad: 4, pontas: false }));
    for (let i = 0; i < 7; i++) B.esf(corpo, 0.017, BONE, 0, 1.06 - i * 0.065, -0.09 - i * 0.004, { op: 0.85, emissive: 0x7affe8, brilho: 0.5, linha: false, seg: 6 });
    // ---- tentáculos de névoa que balançam ----
    const bal = [];
    [[-0.14, 0.52, 0.0, 1], [0.15, 0.48, 0.02, 2], [-0.08, 0.4, -0.16, 3], [0.1, 0.36, -0.12, 4], [0.0, 0.62, 0.08, 5], [-0.18, 0.7, -0.05, 6], [0.18, 0.72, -0.04, 7]].forEach(([x, y, z, k]) => {
      const g = B.grupo(corpo, x, y, z), d = Math.sign(x || 1), c = k % 2 ? 0x6fffe0 : 0x7ad4ff;
      tb(B, g, [[0, 0, 0], [d * 0.1, -0.14, 0.04], [d * 0.05, -0.3, -0.04 - k * 0.012], [d * 0.14, -0.45, -0.1]], [0.04, 0.034, 0.02, 0.003], c, { ...nevoa(0.4, 0.7, c), seg: 9, rad: 5, pontas: false });
      bal.push({ g, amp: 0.2, vel: 1.6 + k * 0.25, eixo: k % 2 ? 'z' : 'x', fase: k * 1.3 });
    });
    // ---- braços longos e esqueléticos, esticados ----
    function braco(l) {
      const b = B.grupo(corpo, l * 0.22, 1.05, 0.02), s = l;
      const osso = { op: 0.92, emissive: 0x6af0dc, brilho: 0.35, linha: false };
      tb(B, b, [[0, 0, 0], [s * 0.03, -0.15, 0.0], [s * 0.05, -0.3, 0.0]], [0.036, 0.028, 0.026], BONE, { ...osso, seg: 6, rad: 5 });
      tb(B, b, [[s * 0.05, -0.3, 0.0], [s * 0.05, -0.45, 0.02], [s * 0.04, -0.58, 0.04]], [0.026, 0.02, 0.018], BONE, { ...osso, seg: 6, rad: 5 });
      B.esf(b, 0.034, BONE, s * 0.05, -0.3, 0.0, { ...osso, seg: 7 });                                  // cotovelo ossudo
      tb(B, b, [[0, 0, 0], [s * 0.07, -0.2, -0.05], [s * 0.1, -0.45, -0.08], [s * 0.15, -0.72, -0.1]], [0.09, 0.12, 0.1, 0.01], TEAL, { ...nevoa(0.32, 0.5), seg: 8, rad: 7, pontas: false });   // manga rasgada
      // algema e corrente partida
      B.tor(b, 0.03, 0.009, FERRO, s * 0.045, -0.57, 0.04, { rx: PI / 2, seg: 8, metal: 0.6, linha: false });
      corrente(B, b, [[s * 0.045, -0.57, 0.07], [s * 0.1, -0.58, 0.14], [s * 0.15, -0.62, 0.2]], 4, 0.045, FERRO);
      const mao = B.grupo(b, s * 0.04, -0.6, 0.04);
      B.esf(mao, 0.03, BONE, 0, 0, 0, { ...osso, seg: 7, sy: 0.7 });
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 0.017, dx = (i - 1.5) * 0.012;
        tb(B, mao, [[x, -0.01, 0.0], [x + dx * 0.5, -0.09, 0.01], [x + dx, -0.17, 0.03], [x + dx * 1.2, -0.23, 0.07]], [0.009, 0.007, 0.006, 0.003], BONE, { ...osso, seg: 6, rad: 4, pontas: false });
        B.esf(mao, 0.009, BONE, x + dx * 0.5, -0.09, 0.01, { ...osso, seg: 4 });
      }
      tb(B, mao, [[s * 0.025, 0.0, 0.01], [s * 0.06, -0.06, 0.04], [s * 0.07, -0.12, 0.09]], [0.01, 0.007, 0.003], BONE, { ...osso, seg: 5, rad: 4, pontas: false });
      return b;
    }
    const bracoE = braco(-1), bracoD = braco(1);
    bracoE.rotation.set(-1.15, 0, 0.1); bracoD.rotation.set(-1.35, 0, -0.1);
    // ---- corrente que cruza o peito, com ponta partida ----
    corrente(B, corpo, [[-0.2, 1.12, 0.05], [-0.1, 0.99, 0.19], [0.08, 0.88, 0.21], [0.2, 0.78, 0.12], [0.24, 0.64, 0.05], [0.27, 0.52, 0.0]], 11, 0.052, FERRO);
    corrente(B, corpo, [[0.2, 1.12, 0.05], [0.12, 1.0, 0.19], [-0.02, 0.92, 0.21]], 5, 0.052, FERRO);
    B.tor(corpo, 0.045, 0.012, FERRO, -0.2, 1.12, 0.05, { seg: 8, metal: 0.6, linha: false });
    // ---- cabeça: caveira esticada gritando ----
    const cabeca = B.grupo(corpo, 0, 1.25, 0.03);
    const pele = { op: 0.9, emissive: 0x7afff0, brilho: 0.3, linha: false };
    bl(B, cabeca, 0.15, 0xc9ebe5, 0, 0.0, 0, { ...pele, sy: 1.18, sz: 0.95, amp: 0.05, seed: 3, seg: 14 });
    [-1, 1].forEach(l => {
      bl(B, cabeca, 0.05, 0xb8e0da, l * 0.1, -0.03, 0.08, { ...pele, seg: 8, sz: 0.7 });                                      // maçã do rosto
      bl(B, cabeca, 0.055, 0x020807, l * 0.065, 0.03, 0.115, { seg: 9, sy: 1.5, sx: 0.85, sz: 0.6, linha: false });           // órbita funda
      B.esf(cabeca, 0.016, 0xaffff4, l * 0.065, 0.02, 0.135, { emissive: 0xaffff4, brilho: 1.8, seg: 6, linha: false });       // brilho no fundo do olho
      tb(B, cabeca, [[l * 0.025, 0.1, 0.12], [l * 0.07, 0.115, 0.115], [l * 0.12, 0.09, 0.09]], [0.012, 0.014, 0.01], 0x020807, { seg: 5, rad: 4, linha: false, pontas: false });   // sobrancelha torcida de dor
      // mechas de névoa saindo da cabeça
      tb(B, cabeca, [[l * 0.1, 0.1, -0.06], [l * 0.18, 0.05, -0.2], [l * 0.22, -0.1, -0.34]], [0.05, 0.035, 0.003], TEAL, { ...nevoa(0.4, 0.6), seg: 8, rad: 5, pontas: false });
    });
    B.esf(cabeca, 0.018, 0x020807, 0, -0.01, 0.145, { seg: 6, sy: 1.5, linha: false });                                             // nariz
    const mand = B.grupo(cabeca, 0, -0.07, 0.04);
    bl(B, cabeca, 0.075, 0x010504, 0, -0.1, 0.1, { seg: 10, sy: 1.75, sx: 1.0, sz: 0.6, linha: false });                             // boca escancarada
    bl(B, mand, 0.07, 0xc9ebe5, 0, -0.1, 0.03, { ...pele, sx: 0.9, sy: 0.9, sz: 0.9, seg: 9 });                                      // queixo caído
    for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.026; presa(B, cabeca, x, -0.06, 0.135 - Math.abs(i - 2) * 0.012, 0.03, 0.007, BONE, 0.1, { op: 0.9, emissive: 0x7affe8, brilho: 0.3 }); presa(B, mand, x * 0.9, -0.03, 0.09 - Math.abs(i - 2) * 0.012, 0.025, 0.006, BONE, 0.1, { rx: PI, op: 0.9, emissive: 0x7affe8, brilho: 0.3 }); }
    // chamas azuis na cabeça e nos ombros
    const chamas = [[0, 0.16, -0.02, 0.26], [-0.08, 0.13, -0.03, 0.18], [0.08, 0.13, -0.03, 0.2], [-0.15, 0.06, -0.05, 0.14], [0.15, 0.06, -0.05, 0.15]].map(([x, y, z, h]) => chama(B, cabeca, x, y, z, h, 0.045, 0x34d8ff, 0xc8fcff));
    [[-0.3, 1.1, -0.02], [0.3, 1.1, -0.02]].forEach(([x, y, z]) => chamas.push(chama(B, corpo, x, y, z, 0.2, 0.05, 0x34d8ff, 0xc8fcff)));
    // fagulhas de alma que circulam
    const faiscas = [];
    for (let i = 0; i < 9; i++) faiscas.push(B.vivo(B.esf(corpo, 0.016 + (i % 3) * 0.006, 0xbffcff, 0, 0, 0, { emissive: 0x6af0ff, brilho: 1.6, seg: 5, linha: false })));
    finalizar(B);
    return {
      altura: 1.6, flutua: true,
      p: { tronco: corpo, cabeca, bracoD, bracoE, balancos: bal, mandibula: { g: mand, aberta: 0.55, fechada: 0.1 } },
      anim: (t) => {
        chamas.forEach((c, i) => { const q = 1 + Math.sin(t * 11 + i * 1.9) * 0.2; c.scale.set(q, 1 + Math.sin(t * 8 + i) * 0.3, q); });
        faiscas.forEach((m, i) => { const a = t * (0.5 + (i % 3) * 0.15) + i * 0.7, r = 0.38 + (i % 4) * 0.06; m.position.set(Math.cos(a) * r, 0.35 + ((t * 0.12 + i * 0.11) % 1) * 1.1, Math.sin(a) * r); });
      },
    };
  };

  /* ============================================================
     HADES — senhor do Inferno (chefe)
     ============================================================ */
  M.hades = (B, R) => {
    const PANO = 0x17121f, PANO2 = 0x4a0e1c, FERRO = 0x1d1b24, FERRO2 = 0x35323e, PELE = 0xa7adbd, AZUL = 0x4ab8ff, AZULC = 0xc8f0ff, osso = COR.osso;
    const mp = { tex: 'pele', rep: 2, rough: 0.7 }, tec = { tex: 'tecido', rep: 2, rough: 0.9 };
    const corpo = B.grupo(R, 0, 0, 0);
    const chamas = [];
    const fogo = (pai, x, y, z, h, r, dir) => { const c = chama(B, pai, x, y, z, h, r, AZUL, AZULC); if (dir) aponta(c, dir); chamas.push(c); return c; };
    // ---- manto longo (duas camadas) com barra rasgada ----
    const manto = (perfil, cor, N, o, ex = {}) => { const m = new THREE.Mesh(mantoGeo(perfil, N, o), B.mat(cor, { dupla: true, ...tec, ...ex })); corpo.add(m); return m; };
    manto([[0.6, 0.12], [0.5, 0.4], [0.38, 0.75], [0.27, 1.0], [0.3, 1.2], [0.27, 1.42], [0.16, 1.54]], PANO, 30, { seed: 4, rasgo: 0.22 });
    manto([[0.5, 0.2], [0.42, 0.45], [0.31, 0.78], [0.23, 1.0], [0.26, 1.15]], PANO2, 24, { seed: 8, rasgo: 0.16, dobras: 0.09, nd: 5 }, { emissive: 0x200408, brilho: 0.3 });
    // fendas do manto: faixas rasgadas penduradas na barra (balançam)
    const bal = [];
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * PI * 2 + 0.2, g = B.grupo(corpo, Math.cos(a) * 0.5, 0.45, Math.sin(a) * 0.5); g.rotation.y = -a + PI / 2;
      forma(B, g, [[-0.07, 0], [0.07, 0], [0.09, -0.22], [0.02, -0.4 - (k % 3) * 0.08], [-0.06, -0.26]], 0.008, k % 2 ? PANO : 0x2a0e1c, 0, 0, 0, { ...tec, dupla: true, linha: false, bisel: 0 });
      bal.push({ g, amp: 0.14, vel: 1.4 + (k % 3) * 0.3, eixo: 'x', fase: k });
    }
    // ---- capa atrás, com gola alta pontuda ----
    const capa = B.grupo(corpo, 0, 1.56, -0.2);
    const pan = (cor, o, ex = {}) => { const m = new THREE.Mesh(panoGeo(0.55, 1.5, 1.4, 12, 8, o), B.mat(cor, { dupla: true, ...tec, ...ex })); capa.add(m); return m; };
    pan(0x2a2040, { seed: 3, curva: 0.38, rasgo: 0.24, onda: 0.06 });
    pan(PANO2, { seed: 6, curva: 0.35, rasgo: 0.18, onda: 0.05 }, { emissive: 0x200408, brilho: 0.3 }).position.z = 0.025;
    bal.push({ g: capa, amp: 0.07, vel: 1.1, eixo: 'x', fase: 0.5 });
    [-1, 1].forEach(l => {
      forma(B, corpo, [[0, 0], [0.16, 0], [0.12, 0.3], [0.2, 0.55], [0.0, 0.42], [-0.04, 0.22]], 0.02, FERRO, l * 0.24, 1.5, -0.12, { metal: 0.5, rough: 0.4, ry: l * 0.5, rz: -l * 0.28, scale: 1 });   // gola: placa alta e pontuda
      B.cone(corpo, 0.03, 0.22, osso, l * 0.34, 1.78, -0.16, { rz: -l * 0.4, seg: 5, linha: false, tex: 'osso' });
    });
    // ---- tronco: peitoral de ferro com costelas de osso e caveira ----
    bl(B, corpo, 1, FERRO, 0, 1.28, 0.02, { sx: 0.3, sy: 0.27, sz: 0.22, tex: 'metal', metal: 0.5, rough: 0.4, amp: 0.05, seed: 2, seg: 14 });
    for (let i = 0; i < 4; i++) [-1, 1].forEach(l => tb(B, corpo, [[l * 0.03, 1.4 - i * 0.065, 0.2], [l * 0.12, 1.38 - i * 0.065, 0.17], [l * 0.22, 1.36 - i * 0.07, 0.08], [l * 0.27, 1.33 - i * 0.07, -0.02]], [0.012, 0.013, 0.012, 0.008], osso, { tex: 'osso', seg: 7, rad: 4, linha: false, pontas: false }));
    bl(B, corpo, 0.05, osso, 0, 1.4, 0.215, { tex: 'osso', sy: 1.1, seg: 9, seed: 7 });                           // caveira do peito
    [-1, 1].forEach(l => { B.esf(corpo, 0.013, 0x020406, l * 0.02, 1.41, 0.255, { seg: 5, linha: false }); });
    B.esf(corpo, 0.02, AZUL, 0, 1.2, 0.235, { emissive: AZUL, brilho: 1.6, seg: 7, linha: false });                 // gema de alma
    // gorjal (colar) e cinto
    B.tor(corpo, 0.2, 0.04, FERRO2, 0, 1.52, 0.0, { rx: PI / 2, seg: 14, metal: 0.5, rough: 0.4, linha: false });
    for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2; if (Math.sin(a) < -0.5) continue; const m = B.cone(corpo, 0.022, 0.09, osso, Math.cos(a) * 0.2, 1.54, Math.sin(a) * 0.2, { seg: 5, linha: false }); aponta(m, [Math.cos(a), 0.5, Math.sin(a)]); }
    B.cil(corpo, 0.3, 0.3, 0.09, FERRO, 0, 0.98, 0, { seg: 16, metal: 0.5, rough: 0.45, tex: 'metal', linha: false });
    bl(B, corpo, 0.07, osso, 0, 0.98, 0.3, { tex: 'osso', sy: 1.1, seg: 9, seed: 3 });                           // caveira da fivela
    [-1, 1].forEach(l => { B.esf(corpo, 0.017, 0x020406, l * 0.03, 0.99, 0.36, { seg: 5, linha: false }); presa(B, corpo, l * 0.02, 0.94, 0.36, 0.04, 0.008, osso, 0.1); });
    corrente(B, corpo, [[0.2, 0.96, 0.22], [0.3, 0.8, 0.26], [0.34, 0.6, 0.2]], 6, 0.06, COR.ferroVel);
    corrente(B, corpo, [[-0.22, 0.96, 0.22], [-0.32, 0.82, 0.25], [-0.36, 0.64, 0.18]], 5, 0.06, COR.ferroVel);
    // ---- cabeça: rosto cinzento, descarnado, olhos de chama azul ----
    const cabeca = B.grupo(corpo, 0, 1.7, 0.03); cabeca.scale.setScalar(1.22);
    tb(B, corpo, [[0, 1.5, 0], [0, 1.58, 0.02]], [0.075, 0.07], PELE, { ...mp, seg: 3, rad: 7, linha: false });
    bl(B, cabeca, 0.155, PELE, 0, 0.0, 0, { ...mp, relevo: 0.015, sx: 0.88, sy: 1.32, sz: 1.0, amp: 0.04, seed: 5, seg: 14 });
    bl(B, cabeca, 0.065, 0x8d93a6, 0, -0.14, 0.07, { ...mp, relevo: 0.01, sy: 1.3, sz: 0.9, seg: 9, linha: false });                    // queixo pontudo
    bl(B, cabeca, 0.03, PELE, 0, -0.02, 0.15, { ...mp, relevo: 0.01, sy: 1.8, sz: 0.9, seg: 8, linha: false });                       // nariz longo e fino
    tb(B, cabeca, [[-0.05, -0.112, 0.125], [0, -0.1, 0.14], [0.05, -0.112, 0.125]], [0.007, 0.008, 0.007], 0x120a12, { seg: 6, rad: 4, linha: false, pontas: false });   // boca fina e cruel
    [-1, 1].forEach(l => {
      bl(B, cabeca, 0.045, 0x727890, l * 0.085, -0.06, 0.09, { rough: 0.8, sy: 1.5, seg: 8, linha: false });                           // bochecha oca (sombra)
      bl(B, cabeca, 0.052, 0x0a0710, l * 0.062, 0.035, 0.112, { seg: 9, sy: 0.8, sx: 1.15, sz: 0.6, linha: false });     // órbita funda
      B.esf(cabeca, 0.024, AZUL, l * 0.062, 0.035, 0.13, { emissive: AZUL, brilho: 2.2, seg: 7, linha: false });
      B.esf(cabeca, 0.045, AZUL, l * 0.062, 0.035, 0.135, { op: 0.3, emissive: AZUL, brilho: 1.0, seg: 7, linha: false });        // olho
      tb(B, cabeca, [[l * 0.02, 0.085, 0.125], [l * 0.07, 0.1, 0.12], [l * 0.13, 0.115, 0.095]], [0.016, 0.02, 0.014], 0x14101c, { seg: 5, rad: 4, linha: false, pontas: false });   // sobrancelha em V
      fogo(cabeca, l * 0.062, 0.07, 0.1, 0.15, 0.028, [l * 0.4, 1, -0.4]);                                                // chama que sobe dos olhos
      B.cone(cabeca, 0.03, 0.12, 0x8d93a6, l * 0.155, 0.02, -0.01, { rz: -l * 1.3, seg: 5, linha: false });             // orelhas pontudas
    });
    // barba pontuda e cabelo escorrido
    [[0, -0.14, 0.09, 0.26], [-0.03, -0.12, 0.08, 0.16], [0.03, -0.12, 0.08, 0.16]].forEach(([x, y, z, h]) => tb(B, cabeca, [[x, y, z], [x * 1.3, y - h * 0.5, z + 0.03], [x * 2, y - h, z + 0.02]], [0.018, 0.012, 0.002], 0x15101c, { seg: 5, rad: 4, linha: false, pontas: false }));
    [-1, 1].forEach(l => {
      const g = B.grupo(cabeca, l * 0.1, 0.06, -0.08);
      tb(B, g, [[0, 0, 0], [l * 0.04, -0.2, -0.1], [l * 0.06, -0.45, -0.18], [l * 0.04, -0.7, -0.22]], [0.04, 0.045, 0.035, 0.004], 0x15101c, { tex: 'pelo', rep: 2, seg: 10, rad: 6, linha: false, pontas: false });
      bal.push({ g, amp: 0.1, vel: 1.7, eixo: 'x', fase: l });
    });
    tb(B, cabeca, [[0, 0.14, -0.06], [0, 0.0, -0.17], [0, -0.3, -0.24], [0, -0.58, -0.26]], [0.075, 0.08, 0.06, 0.004], 0x15101c, { tex: 'pelo', rep: 2, seg: 10, rad: 7, linha: false, pontas: false });
    // coroa de espinhos com chamas azuis
    B.tor(cabeca, 0.16, 0.022, FERRO2, 0, 0.17, -0.01, { rx: PI / 2, seg: 14, metal: 0.55, rough: 0.4 });
    for (let i = 0; i < 11; i++) {
      const a = i / 11 * PI * 2 + 0.3, ca = Math.cos(a), sa = Math.sin(a), alto = i % 2 === 0, h = alto ? 0.3 : 0.16;
      corno(B, cabeca, [[ca * 0.16, 0.17, sa * 0.16 - 0.01], [ca * 0.2, 0.17 + h * 0.5, sa * 0.2 - 0.01], [ca * 0.22, 0.17 + h, sa * 0.22 - 0.01]], 0.022, alto ? FERRO : osso, { aneis: 4, linha: false, metal: 0.4 });
      if (alto && sa > -0.7) fogo(cabeca, ca * 0.22, 0.17 + h, sa * 0.22 - 0.01, 0.2, 0.05);
    }
    // ---- braços: mangas escuras, braçadeiras de espinhos, mãos pálidas de dedos longos ----
    function braco(l) {
      const b = B.grupo(corpo, l * 0.37, 1.43, 0), s = l;
      bl(B, b, 0.1, FERRO, 0, 0, 0, { seg: 9, tex: 'metal', metal: 0.4, linha: false, seed: 31 });
      tb(B, b, [[0, 0, 0], [s * 0.04, -0.17, 0.02], [s * 0.05, -0.33, 0.0]], [0.085, 0.075, 0.062], PANO, { ...tec, seg: 6, rad: 8 });
      tb(B, b, [[s * 0.05, -0.33, 0.0], [s * 0.05, -0.5, 0.06], [s * 0.04, -0.62, 0.1]], [0.062, 0.058, 0.05], FERRO, { tex: 'metal', metal: 0.5, rough: 0.45, seg: 5, rad: 8 });
      anelEsp(B, b, [s * 0.05, -0.48, 0.055], 0.065, 0.025, [0.2, 0, 0], 6, 0.07, osso, { corAnel: FERRO2, rad: 0.014 });
      // manga larga rasgada
      forma(B, b, [[-0.09, 0], [0.09, 0], [0.13, -0.35], [0.04, -0.52], [-0.02, -0.38], [-0.1, -0.5], [-0.12, -0.3]], 0.01, PANO, s * 0.12, -0.1, -0.02, { ...tec, dupla: true, linha: false, bisel: 0, rz: -s * 0.12, ry: PI / 2 });
      // ombreira de ferro com espinhos e chifres de osso
      const om = B.grupo(b, s * 0.03, 0.07, 0); om.rotation.z = -s * 0.45; om.scale.setScalar(1.25);
      bl(B, om, 0.17, FERRO, 0, 0.0, 0, { tex: 'metal', metal: 0.55, rough: 0.4, sy: 0.65, sx: 1.1, amp: 0.04, seed: 21, seg: 12 });
      bl(B, om, 0.14, FERRO2, 0, -0.07, 0, { tex: 'metal', metal: 0.55, rough: 0.4, sy: 0.5, sx: 1.1, seed: 23, seg: 10, linha: false });
      for (let i = 0; i < 3; i++) { const a = -0.9 + i * 0.9; corno(B, om, [[Math.sin(a) * 0.09, 0.07, Math.cos(a) * 0.09], [Math.sin(a) * 0.12, 0.17 + i % 2 * 0.06, Math.cos(a) * 0.12], [Math.sin(a) * 0.1, 0.28 + (i === 1 ? 0.1 : 0), Math.cos(a) * 0.1]], 0.03, osso, { aneis: 5, linha: false, tex: 'osso' }); }
      // mão pálida com dedos longos e garras negras
      const mao = B.grupo(b, s * 0.04, -0.66, 0.1);
      bl(B, mao, 0.05, PELE, 0, -0.02, 0, { ...mp, seg: 8, sy: 1.0, linha: false, seed: 41 });
      for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 0.026; tb(B, mao, [[x, -0.04, 0.0], [x * 1.1, -0.12, 0.02], [x * 1.2, -0.19, 0.05]], [0.012, 0.01, 0.008], PELE, { ...mp, seg: 5, rad: 4, linha: false }); garra(B, mao, x * 1.2, -0.19, 0.05, 0.07, 0.008, 0x0a0710, { rx: PI / 2, cv: 0.25, ry: PI }); }
      tb(B, mao, [[s * 0.04, -0.01, 0.01], [s * 0.08, -0.07, 0.05], [s * 0.08, -0.12, 0.09]], [0.013, 0.01, 0.008], PELE, { ...mp, seg: 4, rad: 4, linha: false });
      b.userData.mao = mao;
      return b;
    }
    const bracoE = braco(-1), bracoD = braco(1);
    bracoD.rotation.set(-0.25, 0, 0.15); bracoE.rotation.set(-1.2, 0, -0.15);
    // ---- bidente enorme na mão direita ----
    const bid = B.grupo(bracoD.userData.mao, 0, -0.1, 0.0); bid.rotation.set(0.35, 0, -0.3);
    B.cil(bid, 0.03, 0.034, 2.1, 0x2a2733, 0, 0.52, 0, { seg: 8, metal: 0.5, rough: 0.4, linha: false });
    for (let i = 0; i < 6; i++) B.tor(bid, 0.03, 0.01, i % 2 ? osso : FERRO2, 0, -0.3 + i * 0.36, 0, { rx: PI / 2, seg: 8, metal: 0.4, linha: false });
    B.cil(bid, 0.034, 0.034, 0.3, 0x3a2418, 0, 0.0, 0, { seg: 8, tex: 'couro', linha: false });
    B.cone(bid, 0.03, 0.18, FERRO2, 0, -0.62, 0, { rx: PI, seg: 6, metal: 0.6, linha: false });                      // ponteira
    B.cil(bid, 0.05, 0.04, 0.1, FERRO2, 0, 1.6, 0, { seg: 8, metal: 0.6, rough: 0.35, linha: false });
    bl(B, bid, 0.07, osso, 0, 1.66, 0.0, { tex: 'osso', sy: 1.1, seg: 9, seed: 12 });                                   // caveira no encaixe
    [-1, 1].forEach(l => { B.esf(bid, 0.016, 0x020406, l * 0.025, 1.68, 0.06, { seg: 5, linha: false }); });
    [-1, 1].forEach(l => {
      tb(B, bid, [[l * 0.02, 1.68, 0], [l * 0.14, 1.72, 0], [l * 0.22, 1.9, 0], [l * 0.17, 2.14, 0], [l * 0.1, 2.3, 0]], [0.042, 0.038, 0.03, 0.02, 0.005], FERRO2, { metal: 0.65, rough: 0.3, seg: 14, rad: 6, pontas: false });
      B.cone(bid, 0.02, 0.1, FERRO2, l * 0.2, 1.98, 0, { rz: l * 2.2, seg: 4, linha: false, metal: 0.6 });                   // farpas
      B.cone(bid, 0.018, 0.09, FERRO2, l * 0.23, 1.84, 0, { rz: l * 2.3, seg: 4, linha: false, metal: 0.6 });
      fogo(bid, l * 0.1, 2.3, 0, 0.2, 0.04);
    });
    tb(B, bid, [[0, 1.7, 0], [0, 1.95, 0], [0, 2.2, 0]], [0.036, 0.026, 0.004], FERRO2, { metal: 0.65, rough: 0.3, seg: 8, rad: 6, pontas: false });   // dente do meio
    fogo(bid, 0, 2.2, 0, 0.26, 0.045);
    B.esf(bid, 0.025, AZUL, 0, 1.6, 0.05, { emissive: AZUL, brilho: 1.8, seg: 7, linha: false });
    // ---- orbe de almas presas na mão esquerda ----
    const orbe = B.grupo(bracoE.userData.mao, 0, -0.2, 0.06);
    const nucleo = B.vivo(B.esf(orbe, 0.075, AZULC, 0, 0, 0, { emissive: AZUL, brilho: 1.5, seg: 10, linha: false }));
    const halo = B.vivo(B.esf(orbe, 0.12, AZUL, 0, 0, 0, { emissive: AZUL, brilho: 0.9, op: 0.35, seg: 10, linha: false }));
    for (let i = 0; i < 3; i++) fogo(orbe, Math.cos(i * 2.1) * 0.07, 0.05, Math.sin(i * 2.1) * 0.07, 0.17, 0.035, [Math.cos(i * 2.1), 1.2, Math.sin(i * 2.1)]);
    // ---- anel de runas no chão ----
    B.tor(corpo, 0.7, 0.012, AZUL, 0, 0.05, 0, { rx: PI / 2, seg: 36, emissive: AZUL, brilho: 1.0, op: 0.7, linha: false });
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; B.cx(corpo, 0.03, 0.01, 0.07, AZUL, Math.cos(a) * 0.66, 0.05, Math.sin(a) * 0.66, { ry: -a, emissive: AZUL, brilho: 1.0, op: 0.7, linha: false }); }
    // ---- almas presas orbitando ----
    const almas = [];
    for (let i = 0; i < 6; i++) {
      const g = B.grupo(corpo, 0, 0, 0), cor = i % 2 ? 0x8fe8ff : 0x7ad4ff, f = { op: 0.8, emissive: 0x4ab8ff, brilho: 0.7, linha: false };
      bl(B, g, 0.06, cor, 0, 0, 0, { ...f, seg: 8, sy: 1.1, sz: 0.9 });
      tb(B, g, [[0, 0, -0.03], [0.02, 0.01, -0.16], [-0.02, 0, -0.3], [0.02, -0.01, -0.46]], [0.05, 0.036, 0.02, 0.003], cor, { ...f, seg: 8, rad: 6, pontas: false });
      [-1, 1].forEach(l => B.esf(g, 0.014, 0x020406, l * 0.025, 0.015, 0.048, { seg: 5, linha: false }));
      bl(B, g, 0.02, 0x020406, 0, -0.03, 0.05, { seg: 6, sy: 1.6, linha: false });
      almas.push({ g, r: 0.85 + (i % 3) * 0.12, y: 0.55 + (i * 0.2) % 1.5, v: (i % 2 ? 1 : -1) * (0.55 + (i % 3) * 0.1), a0: i * 1.05 });
    }
    finalizar(B);
    const rest = { x: -0.25 };
    return {
      altura: 2.2, flutua: true,
      p: { tronco: corpo, cabeca, bracoD, bracoE, balancos: bal },
      anim: (t, dt, st) => {
        const golpe = st && st.golpe ? Math.sin(Math.min(1, st.golpe) * PI) : 0;
        if (golpe) { bracoD.rotation.x = rest.x - golpe * 0.9; bracoD.userData.mao.rotation.x = golpe * 1.5; } else bracoD.userData.mao.rotation.x = 0;
        bracoE.rotation.x = -1.2 - Math.sin(t * 1.8) * 0.06;
        chamas.forEach((c, i) => { const q = 1 + Math.sin(t * 10 + i * 1.7) * 0.2; c.scale.set(q, 1 + Math.sin(t * 8 + i) * 0.3, q); });
        nucleo.scale.setScalar(1 + Math.sin(t * 6) * 0.12); halo.scale.setScalar(1 + Math.sin(t * 4 + 1) * 0.15);
        almas.forEach(s => {
          const a = s.a0 + t * s.v, x = Math.cos(a) * s.r, z = Math.sin(a) * s.r;
          s.g.position.set(x, s.y + Math.sin(t * 1.5 + s.a0) * 0.1, z);
          s.g.rotation.y = Math.atan2(-Math.sin(a) * Math.sign(s.v), Math.cos(a) * Math.sign(s.v));
        });
      },
    };
  };

  Modelos3D.registrar(M);
})();
