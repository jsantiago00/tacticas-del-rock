/* Tácticas del Rock — STAGE3D: escenario de recital en three.js (r128).
 * REGLA DE ORO: esta capa solo LEE. Dibuja lo que le pasan (tablero/banco o un combate
 * que la UI va simulando con SIM.stepCombat) y decora los eventos. Nunca toca el estado.
 *
 * API:
 *   const st = STAGE3D.create({ canvas, overlay, onFrame(now), onFps(fps, level) })
 *   st.setPlanning({ board:[{uid,unitId,star,idx}], bench:[{uid,unitId,star,idx}], selected })
 *   st.startCombat(cs, flip)  st.combatEvents(events)  st.setAlpha(alpha)  st.celebrate(team)  st.stopCombat()
 *   st.pick(x, y) -> {kind:'unit',uid} | {kind:'cunit',cid} | {kind:'board',idx} | {kind:'bench',idx} | null
 *   st.dragTo(uid, x, y)  st.dragEnd()  st.highlight(target|null)  st.setQuality('auto'|'alta'|'media'|'baja')
 */
'use strict';
const STAGE3D = (() => {
  const COST = { 0: '#7b8296', 1: '#9aa0a8', 2: '#3fae67', 3: '#4a8ef0', 4: '#b26ae6', 5: '#f0b429' };
  const ROWS = 4, COLS = 7;
  const HEXR = 1, W = Math.sqrt(3) * HEXR;
  const cellWorld = (R, C) => ({ x: (C - 3) * W + (R & 1 ? W / 2 : 0) - W / 4, z: (R - 3.5) * 1.5 + (R >= 4 ? 0.25 : -0.25) });
  const benchWorld = i => ({ x: (i - 4) * 1.55, z: 9.3 });
  const STAR_SCALE = [1, 1.12, 1.25];

  function create({ canvas, overlay, onFrame, onFps }) {
    const T = window.THREE;
    if (!T) throw new Error('No cargó three.js');
    const renderer = new T.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputEncoding = T.sRGBEncoding;
    const scene = new T.Scene();
    scene.background = new T.Color(0x0d1526);
    scene.fog = new T.FogExp2(0x0d1526, 0.026);
    const camera = new T.PerspectiveCamera(38, 1, 0.1, 200);
    const V = new T.Vector3(), V2 = new T.Vector3(), V3 = new T.Vector3(); // temporales reutilizados

    // ---------- luces ----------
    scene.add(new T.HemisphereLight(0x8fa6d6, 0x2a1a10, 0.4));
    const coneGeo = new T.ConeGeometry(2.6, 14, 24, 1, true);
    function spot(color, x, y, z, intensity, shadow) {
      const l = new T.SpotLight(color, intensity, 60, Math.PI / 7, 0.5, 1.2);
      l.position.set(x, y, z); l.castShadow = !!shadow;
      if (shadow) { l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.0004; }
      scene.add(l); scene.add(l.target);
      const cone = new T.Mesh(coneGeo, new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.06, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      scene.add(cone);
      return { l, cone };
    }
    const spots = [spot(0xffd27a, 0, 13, 9, 1.6, true), spot(0x6f8cff, -8, 12, -2, 1.1, false), spot(0xff6fa8, 8, 12, -2, 0.9, false)];
    const DOWN = new T.Vector3(0, -1, 0);
    function aimCone(s) {
      const from = s.l.position, to = s.l.target.position;
      V.subVectors(to, from); const len = V.length();
      s.cone.scale.set(1, len / 14, 1);
      s.cone.position.copy(from).addScaledVector(V, 0.5);
      s.cone.quaternion.setFromUnitVectors(DOWN, V.normalize());
    }

    // ---------- escenario ----------
    const wood = new T.MeshStandardMaterial({ color: 0x4a321e, roughness: 0.85 });
    const stage = new T.Mesh(new T.BoxGeometry(17, 0.8, 17), wood);
    stage.position.set(0, -0.46, -0.3); stage.receiveShadow = true; scene.add(stage);
    const lip = new T.Mesh(new T.BoxGeometry(17, 0.8, 0.3), new T.MeshStandardMaterial({ color: 0x2c1d11 }));
    lip.position.set(0, -0.46, 8.25); scene.add(lip);
    const spkMat = new T.MeshStandardMaterial({ color: 0x151a22, roughness: 0.6 }), woofMat = new T.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.4 });
    const woofGeo = new T.CylinderGeometry(0.62, 0.62, 0.08, 28);
    for (const side of [-1, 1]) {
      const sp = new T.Mesh(new T.BoxGeometry(2, 4.4, 1.8), spkMat);
      sp.position.set(side * 9.6, 2.2, 1.5); sp.castShadow = true; scene.add(sp);
      for (const y of [1.2, 3.2]) { const c = new T.Mesh(woofGeo, woofMat); c.rotation.x = Math.PI / 2; c.position.set(side * 9.6, y, 2.42); scene.add(c); }
    }
    const truss = new T.Mesh(new T.BoxGeometry(22, 0.35, 0.35), new T.MeshStandardMaterial({ color: 0x8a8f98, metalness: 0.6, roughness: 0.4 }));
    truss.position.set(0, 12.6, -2); scene.add(truss);
    // polvo (posiciones iniciales decorativas: Math.random está bien acá, no es SIM)
    const dustN = 260, dustPos = new Float32Array(dustN * 3);
    for (let i = 0; i < dustN; i++) { dustPos[i * 3] = (Math.random() - 0.5) * 18; dustPos[i * 3 + 1] = Math.random() * 10; dustPos[i * 3 + 2] = (Math.random() - 0.5) * 16; }
    const dustGeo = new T.BufferGeometry(); dustGeo.setAttribute('position', new T.BufferAttribute(dustPos, 3));
    const dust = new T.Points(dustGeo, new T.PointsMaterial({ color: 0xffe2b0, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false }));
    scene.add(dust);

    // ---------- grilla hexagonal (8x7) y backstage ----------
    const hexGeo = new T.CylinderGeometry(HEXR * 0.94, HEXR * 0.94, 0.1, 6);
    const HM = {
      a: new T.MeshStandardMaterial({ color: 0x7a5534, roughness: 0.8 }), b: new T.MeshStandardMaterial({ color: 0x6a4a2d, roughness: 0.8 }),
      foe: new T.MeshStandardMaterial({ color: 0x3b2a1a, roughness: 0.8 }), spy: new T.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 0.8 }),
      hover: new T.MeshStandardMaterial({ color: 0xc98a12, roughness: 0.6, emissive: 0x3a2400 }),
      // al levantar un músico: todos los lugares a donde puede ir
      avail: new T.MeshStandardMaterial({ color: 0x4d8fb0, roughness: 0.6, emissive: 0x0d3550 }),
      availB: new T.MeshStandardMaterial({ color: 0x5aa0c8, roughness: 0.6, emissive: 0x103a58 }),
    };
    const hexes = [];
    for (let R = 0; R < ROWS * 2; R++) for (let C = 0; C < COLS; C++) {
      const p = cellWorld(R, C), mine = R >= ROWS;
      const h = new T.Mesh(hexGeo, mine ? ((R + C) % 2 ? HM.b : HM.a) : HM.foe);
      h.position.set(p.x, 0.02, p.z); h.receiveShadow = true;
      h.userData = { R, C, base: h.material, idx: mine ? (R - ROWS) * COLS + C : -1 };
      scene.add(h); hexes.push(h);
    }
    const pit = new T.Mesh(new T.BoxGeometry(15.4, 0.5, 2.2), new T.MeshStandardMaterial({ color: 0x1a2338, roughness: 0.8 }));
    pit.position.set(0, -0.3, 9.3); pit.receiveShadow = true; scene.add(pit);
    const slotGeo = new T.CylinderGeometry(0.64, 0.64, 0.06, 28), slotMat = new T.MeshStandardMaterial({ color: 0x2c3f63, roughness: 0.6 });
    const benchSlots = [];
    for (let i = 0; i < 9; i++) {
      const m = new T.Mesh(slotGeo, slotMat), p = benchWorld(i);
      m.position.set(p.x, -0.02, p.z); m.receiveShadow = true; m.userData = { bench: i, base: slotMat };
      scene.add(m); benchSlots.push(m);
    }

    // ---------- muñequitos por piezas (geometrías y materiales compartidos) ----------
    const G = {
      leg: new T.CylinderGeometry(0.11, 0.1, 0.42, 10), shoe: new T.BoxGeometry(0.17, 0.09, 0.26),
      torso: new T.CylinderGeometry(0.25, 0.3, 0.56, 16), arm: new T.CylinderGeometry(0.075, 0.065, 0.4, 10),
      hand: new T.SphereGeometry(0.08, 10, 8), head: new T.SphereGeometry(0.4, 24, 18), eye: new T.SphereGeometry(0.045, 8, 6),
      cap: new T.SphereGeometry(0.43, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2.1), ball: new T.SphereGeometry(1, 14, 10),
      box: new T.BoxGeometry(1, 1, 1), cyl: new T.CylinderGeometry(1, 1, 1, 18), cone: new T.ConeGeometry(1, 1, 8),
      torus: new T.TorusGeometry(1, 0.12, 8, 24), ringSmall: new T.TorusGeometry(0.075, 0.016, 6, 16),
      base: new T.CylinderGeometry(0.5, 0.56, 0.08, 28), starRing: new T.TorusGeometry(0.62, 0.05, 8, 40),
      selRing: new T.TorusGeometry(0.7, 0.05, 8, 40), hitBox: new T.BoxGeometry(1.0, 2.1, 1.0),
    };
    const matCache = {};
    const M = color => matCache[color] || (matCache[color] = new T.MeshToonMaterial({ color }));
    const mesh = (geo, color, sx, sy, sz) => { const m = new T.Mesh(geo, M(color)); if (sx) m.scale.set(sx, sy, sz); m.castShadow = true; return m; };
    const baseMats = {}; const baseMat = c => baseMats[c] || (baseMats[c] = new T.MeshStandardMaterial({ color: COST[c], roughness: 0.5, metalness: 0.2 }));
    const starRingMats = { 2: new T.MeshStandardMaterial({ color: 0xd8dde6, metalness: 0.8, roughness: 0.25 }), 3: new T.MeshStandardMaterial({ color: 0xf0b429, metalness: 0.8, roughness: 0.25, emissive: 0x3a2400 }) };
    const selMat = new T.MeshBasicMaterial({ color: 0xf2a541 });
    const hitMat = new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

    function addHair(head, L) {
      const c = L.hairCol, h = L.hair;
      if (h === 'bald') return;
      if (h === 'baldSides') { for (const sd of [-1, 1]) { const b = mesh(G.ball, c, 0.14, 0.2, 0.26); b.position.set(sd * 0.36, 0, -0.05); head.add(b); } return; }
      const tight = h === 'buzz';
      if (!['afro', 'afroSmall'].includes(h)) { const cap = mesh(G.cap, c); cap.position.y = 0.04; cap.rotation.x = -0.28; if (tight) cap.scale.set(0.97, 0.9, 0.97); head.add(cap); }
      if (h === 'medium') { const b = mesh(G.ball, c, 0.42, 0.34, 0.28); b.position.set(0, -0.08, -0.2); head.add(b); }
      if (h === 'long') {
        const b = mesh(G.box, c, 0.8, 0.8, 0.28); b.position.set(0, -0.32, -0.2); head.add(b);
        for (const sd of [-1, 1]) { const s = mesh(G.box, c, 0.12, 0.62, 0.34); s.position.set(sd * 0.38, -0.22, -0.02); head.add(s); }
      }
      if (h === 'curlyLong') {
        [[0.34, -0.05, -0.1], [-0.34, -0.05, -0.1], [0.3, -0.35, -0.12], [-0.3, -0.35, -0.12], [0, -0.3, -0.32], [0.18, 0.1, -0.3], [-0.18, 0.1, -0.3], [0, -0.55, -0.22]]
          .forEach(p => { const b = mesh(G.ball, c, 0.2, 0.2, 0.2); b.position.set(p[0], p[1], p[2]); head.add(b); });
      }
      if (h === 'afro' || h === 'afroSmall') {
        const k = h === 'afro' ? 1 : 0.8;
        [[0, 0.42, -0.02], [0.3, 0.32, -0.08], [-0.3, 0.32, -0.08], [0.42, 0.06, -0.12], [-0.42, 0.06, -0.12], [0, 0.22, -0.34], [0.26, -0.14, -0.24], [-0.26, -0.14, -0.24], [0, -0.1, -0.4]]
          .forEach(p => { const b = mesh(G.ball, c, 0.3 * k, 0.3 * k, 0.3 * k); b.position.set(p[0] * k, p[1] * k + (1 - k) * 0.08, p[2] * k); head.add(b); });
      }
      if (h === 'rasta') {
        for (let k = 0; k < 9; k++) { const a = -2.4 + k * 0.6, d = mesh(G.cyl, c, 0.05, 0.62, 0.05); d.position.set(Math.sin(a) * 0.36, -0.3, -Math.abs(Math.cos(a)) * 0.3 - 0.05); head.add(d); }
      }
      if (h === 'messy') {
        [[0, 0.44, 0, 0], [0.2, 0.38, 0.05, -0.6], [-0.2, 0.38, 0.05, 0.6], [0.12, 0.4, -0.2, -0.3], [-0.14, 0.4, -0.18, 0.4], [0.32, 0.2, -0.1, -1]]
          .forEach(p => { const s = mesh(G.cone, c, 0.1, 0.24, 0.1); s.position.set(p[0], p[1], p[2]); s.rotation.z = p[3]; head.add(s); });
      }
      if (h === 'pompadour') { const p = mesh(G.ball, c, 0.26, 0.2, 0.3); p.position.set(0, 0.4, 0.14); p.rotation.x = -0.4; head.add(p); }
      if (h === 'mop' || h === 'longBangs') {
        const bang = mesh(G.box, c, 0.7, 0.14, 0.12); bang.position.set(0, 0.22, 0.32); bang.rotation.x = 0.3; head.add(bang);
        const back = mesh(G.ball, c, 0.44, h === 'mop' ? 0.3 : 0.4, 0.3); back.position.set(0, -0.06, -0.18); head.add(back);
        if (h === 'longBangs') { const b2 = mesh(G.box, c, 0.18, 0.3, 0.06); b2.position.set(0.12, 0.08, 0.38); head.add(b2); }
      }
      if (h === 'sidecut') { const s = mesh(G.box, c, 0.2, 0.7, 0.36); s.position.set(-0.32, -0.12, 0); s.rotation.z = 0.15; head.add(s); }
    }
    function addHat(head, L) {
      const c = L.hatCol || '#1d1d1d', hat = L.hat;
      if (hat === 'cap') {
        const top = mesh(G.cap, c); top.scale.set(1.06, 0.8, 1.06); top.position.y = 0.1; head.add(top);
        const visor = mesh(G.box, c, 0.4, 0.04, 0.3); visor.position.set(0, 0.12, 0.42); head.add(visor);
      }
      if (hat === 'fedora' || hat === 'tophat') {
        const tall = hat === 'tophat';
        const brim = mesh(G.cyl, c, 0.58, 0.03, 0.58); brim.position.y = 0.28; head.add(brim);
        const crown = mesh(G.cyl, c, tall ? 0.3 : 0.32, tall ? 0.6 : 0.26, tall ? 0.3 : 0.32); crown.position.y = tall ? 0.6 : 0.42; head.add(crown);
        const band = mesh(G.cyl, '#7a1f1f', 0.33, 0.05, 0.33); band.position.y = 0.33; head.add(band);
      }
      if (hat === 'crown') {
        const ring = mesh(G.cyl, c, 0.3, 0.12, 0.3); ring.position.y = 0.44; head.add(ring);
        for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, s = mesh(G.cone, c, 0.06, 0.16, 0.06); s.position.set(Math.cos(a) * 0.26, 0.58, Math.sin(a) * 0.26); head.add(s); }
      }
      if (hat === 'beanie') { const b = mesh(G.cap, c); b.scale.set(1.08, 1.15, 1.08); b.position.y = 0.08; head.add(b); const f = mesh(G.cyl, c, 0.45, 0.1, 0.45); f.position.y = 0.12; head.add(f); }
      if (hat === 'headband') { const t = mesh(G.torus, c, 0.4, 0.4, 0.5); t.rotation.x = Math.PI / 2; t.position.y = 0.18; head.add(t); }
      if (hat === 'headphones') {
        const arc = mesh(G.torus, c, 0.44, 0.44, 0.6); arc.position.y = 0.05; head.add(arc);
        for (const sd of [-1, 1]) { const cup = mesh(G.cyl, '#2a2a2e', 0.14, 0.1, 0.14); cup.rotation.z = Math.PI / 2; cup.position.set(sd * 0.42, 0, 0); head.add(cup); }
      }
    }
    function addInstrument(L, torso, armR, armL, root) {
      const kind = L.inst;
      if (kind === 'guitar' || kind === 'bass' || kind === 'acoustic') {
        const g = new T.Group(), col = kind === 'acoustic' ? '#c98b3a' : L.instCol, k = kind === 'acoustic' ? 1.15 : 1;
        const lobe1 = mesh(G.cyl, col, 0.25 * k, 0.07, 0.25 * k); lobe1.rotation.x = Math.PI / 2; g.add(lobe1);
        const lobe2 = mesh(G.cyl, col, 0.19 * k, 0.07, 0.19 * k); lobe2.rotation.x = Math.PI / 2; lobe2.position.y = 0.22 * k; g.add(lobe2);
        if (kind === 'acoustic') { const hole = mesh(G.cyl, '#1b1b1f', 0.07, 0.075, 0.07); hole.rotation.x = Math.PI / 2; hole.position.set(0, 0.12, 0.01); g.add(hole); }
        const len = kind === 'bass' ? 0.9 : 0.68;
        const neck = mesh(G.box, '#5a3b22', 0.07, len, 0.04); neck.position.set(0, 0.3 + len / 2, 0.02); g.add(neck);
        const hs = mesh(G.box, '#1b1b1f', 0.11, 0.16, 0.05); hs.position.set(0, 0.32 + len, 0.02); g.add(hs);
        if (kind !== 'acoustic') { const pick = mesh(G.box, '#111', 0.14, 0.05, 0.02); pick.position.set(0, 0.05, 0.05); g.add(pick); }
        g.position.set(-0.04, 0.2, 0.34); g.rotation.z = -1.05; torso.add(g); return g;
      }
      if (kind === 'mic') {
        const g = new T.Group();
        g.add(mesh(G.cyl, '#2a2a2e', 0.035, 0.24, 0.035));
        const top = mesh(G.ball, '#b9bcc4', 0.075, 0.075, 0.075); top.position.y = 0.15; g.add(top);
        g.position.set(0, -0.48, 0.06); g.rotation.x = -0.4; armR.add(g); return g;
      }
      if (kind === 'sticks') {
        for (const arm of [armR, armL]) { const st = mesh(G.cyl, '#d9b98a', 0.02, 0.5, 0.02); st.position.set(0, -0.44, 0.2); st.rotation.x = Math.PI / 2.4; arm.add(st); }
        return null;
      }
      if (kind === 'keytar') {
        const g = new T.Group();
        g.add(mesh(G.box, '#f2f2f2', 0.8, 0.22, 0.08));
        const keys = mesh(G.box, '#1b1b1f', 0.6, 0.06, 0.09); keys.position.y = 0.04; g.add(keys);
        const neckK = mesh(G.box, '#d13a3a', 0.32, 0.08, 0.06); neckK.position.set(0.52, 0.04, 0); g.add(neckK);
        g.position.set(0, 0.2, 0.36); g.rotation.z = -0.35; torso.add(g); return g;
      }
      if (kind === 'dj') { // controlador sobre un pie, adelante del muñeco
        const g = new T.Group();
        const leg = mesh(G.cyl, '#2a2a2e', 0.05, 0.75, 0.05); leg.position.y = 0.38; g.add(leg);
        const deck = mesh(G.box, '#1b1b1f', 0.8, 0.08, 0.42); deck.position.y = 0.78; g.add(deck);
        for (const sd of [-1, 1]) { const disc = mesh(G.cyl, '#3a86e0', 0.14, 0.03, 0.14); disc.position.set(sd * 0.22, 0.83, 0); g.add(disc); }
        g.position.set(0, 0, 0.55); root.add(g); return g;
      }
      return null;
    }
    function buildFigure(L) {
      const root = new T.Group(), body = new T.Group(); root.add(body);
      const w = L.big ? 1.14 : 1; body.scale.set(w, 1, w);
      const legs = [];
      for (const sd of [-1, 1]) {
        const hip = new T.Group(); hip.position.set(sd * 0.12, 0.5, 0); body.add(hip);
        const leg = mesh(G.leg, L.pants); leg.position.y = -0.21; hip.add(leg);
        const shoe = mesh(G.shoe, '#1b1b1f'); shoe.position.set(0, -0.44, 0.04); hip.add(shoe);
        legs.push(hip);
      }
      const torso = new T.Group(); torso.position.y = 0.5; body.add(torso);
      const chest = mesh(G.torso, L.shirt); chest.position.y = 0.28; torso.add(chest);
      if (L.tunic) { const t = mesh(G.cyl, L.shirt, 0.3, 0.4, 0.3); t.position.y = -0.12; torso.add(t); }
      const head = new T.Group(); head.position.y = 0.92; torso.add(head);
      head.add(mesh(G.head, L.skin, 1, 1.04, 1));
      if (L.glasses === 'round') {
        for (const sd of [-1, 1]) { const r = mesh(G.ringSmall, '#1b1b1f'); r.position.set(sd * 0.13, 0.05, 0.38); head.add(r); }
      } else if (L.glasses) {
        const gl = mesh(G.box, '#0e0f12', 0.52, 0.12, 0.06); gl.position.set(0, 0.05, 0.38); head.add(gl);
      } else {
        for (const sd of [-1, 1]) { const e = mesh(G.eye, '#151515'); e.position.set(sd * 0.13, 0.05, 0.37); head.add(e); }
      }
      const nose = mesh(G.ball, L.skin, 0.05, 0.06, 0.05); nose.position.set(0, -0.05, 0.41); head.add(nose);
      if (L.beard) { const b = mesh(G.ball, L.hairCol, 0.3, 0.2, 0.2); b.position.set(0, -0.27, 0.25); head.add(b); }
      if (L.mustache === 'bicolor') {
        const a = mesh(G.box, '#f2f2f2', 0.13, 0.05, 0.05); a.position.set(-0.07, -0.13, 0.39); head.add(a);
        const b = mesh(G.box, '#3a2a1a', 0.13, 0.05, 0.05); b.position.set(0.07, -0.13, 0.39); head.add(b);
      } else if (L.mustache) { const m = mesh(G.box, L.hairCol, 0.26, 0.05, 0.05); m.position.set(0, -0.13, 0.39); head.add(m); }
      addHair(head, L);
      if (L.hat) addHat(head, L);
      const arms = [];
      for (const sd of [-1, 1]) {
        const sh = new T.Group(); sh.position.set(sd * 0.33, 0.5, 0); torso.add(sh);
        const arm = mesh(G.arm, L.tank ? L.skin : L.shirt); arm.position.y = -0.2; sh.add(arm);
        const hand = mesh(G.hand, L.skin); hand.position.y = -0.42; sh.add(hand);
        arms.push(sh);
      }
      addInstrument(L, torso, arms[0], arms[1], root);
      return { root, body, torso, head, armR: arms[0], armL: arms[1], legs };
    }
    // Pose por instrumento. a = avance del ataque (0..1 o -1), c = avance de la habilidad (0..1 o -1).
    function pose(f, L, t, a, c) {
      const beat = Math.sin(t * 2.6), k = a >= 0 ? Math.sin(a * Math.PI) : 0, q = c >= 0 ? Math.sin(c * Math.PI) : 0;
      f.head.rotation.x = beat * 0.07 + (L.inst === 'mic' ? -k * 0.25 : k * 0.15) - q * 0.35;
      f.torso.rotation.x = 0; f.torso.scale.y = 1 + beat * 0.015;
      const inst = L.inst;
      if (inst === 'guitar' || inst === 'bass' || inst === 'acoustic') {
        f.armL.rotation.set(-1.15 - q * 0.8, 0, 0.3);
        f.armR.rotation.set(-0.7 + Math.sin(t * 9) * 0.05 - k * 0.9 - q * Math.abs(Math.sin(c * 12)) * 1.6, 0, 0.75);
        f.torso.rotation.x = -k * 0.18 - q * 0.4;
      } else if (inst === 'mic') {
        f.armR.rotation.set(-2.25 - k * 0.3 - q * 0.6, 0, 0.45);
        f.armL.rotation.set(-0.25 - k * 1.4 - q * 2.4, 0, -0.35 - k * 0.4 - q * 0.3);
        f.torso.rotation.x = k * 0.25 - q * 0.3;
      } else if (inst === 'sticks') {
        const hit = c >= 0 ? Math.sin(c * Math.PI * 10) * 1.1 : a >= 0 ? Math.sin(a * Math.PI * 3) * 0.75 : Math.sin(t * 5) * 0.15;
        f.armR.rotation.set(-0.95 - hit - q * 0.6, 0, 0.2);
        f.armL.rotation.set(-0.95 + hit - q * 0.6, 0, -0.2);
      } else if (inst === 'keytar') {
        f.armR.rotation.set(-1.0 - k * 0.4 - q * Math.abs(Math.sin(c * 14)) * 0.8, 0, 0.5);
        f.armL.rotation.set(-1.05 - q * 0.7, 0, -0.5);
        f.torso.rotation.x = -k * 0.12 - q * 0.35;
      } else if (inst === 'dj') {
        f.armR.rotation.set(-1.25 + Math.sin(t * 7) * 0.12 - k * 0.5 - q * 1.8, 0, 0.25);
        f.armL.rotation.set(-1.25 - q * 1.8, 0, -0.25 + k * 0.4);
      } else { // sin instrumento (patovica): piña
        f.armR.rotation.set(-0.3 - k * 1.5, 0, 0.3); f.armL.rotation.set(-0.3, 0, -0.3);
      }
      f.legs[0].rotation.x = 0; f.legs[1].rotation.x = 0;
    }

    // sprites compartidos
    const texCache = {};
    function textTex(key, draw, w = 128, h = 40) {
      if (texCache[key]) return texCache[key];
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      draw(cv.getContext('2d'), w, h);
      return (texCache[key] = new T.CanvasTexture(cv));
    }
    const starMats = [1, 2, 3].map(s => new T.SpriteMaterial({ depthWrite: false, map: textTex('st' + s, (g, w, h) => {
      g.fillStyle = '#f0b429'; g.font = 'bold 32px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#000'; g.shadowBlur = 4; g.fillText('★'.repeat(s), w / 2, h / 2 + 2);
    }) }));
    const iconMat = {};
    for (const [k, ch] of Object.entries({ stun: '💫', silence: '🔇', confuse: '😵', control: '💻', slow: '❄️' }))
      iconMat[k] = new T.SpriteMaterial({ depthWrite: false, map: textTex('ic' + k, (g, w, h) => { g.font = '44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, w / 2, h / 2 + 2); }, 64, 64) });
    const barMat = { bg: new T.SpriteMaterial({ color: 0x0c1424 }), mine: new T.SpriteMaterial({ color: 0x7ee08f }), foe: new T.SpriteMaterial({ color: 0xff7a63 }),
      shield: new T.SpriteMaterial({ color: 0xe8e8e8 }), mana: new T.SpriteMaterial({ color: 0x4aa3ff }) };
    // Las barras se dibujan siempre arriba de todo y en orden fijo (fondo → vida/maná → escudo): si no,
    // al ser sprites a la misma distancia el fondo oscuro a veces tapaba la vida.
    for (const m of Object.values(barMat)) { m.depthTest = false; m.depthWrite = false; m.transparent = true; }
    const focusMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const glowMat = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      return new T.SpriteMaterial({ map: new T.CanvasTexture(c), color: 0x58a6ff, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false });
    })();

    // ---------- muñecos ----------
    const dolls = new Map(); // clave: 'u<uid>' (planificación) o 'c<cid>' (combate)
    function makeDoll(key, unitId, star) {
      const d = SIM.def(unitId), L = LOOKS.of(unitId, d);
      const f = buildFigure(L), grp = f.root;
      const base = new T.Mesh(G.base, baseMat(d.cost || 0)); base.position.y = 0.06; base.receiveShadow = true; grp.add(base);
      const ring = new T.Mesh(G.starRing, starRingMats[2]); ring.rotation.x = Math.PI / 2; ring.position.y = 0.12; grp.add(ring);
      const sel = new T.Mesh(G.selRing, selMat); sel.rotation.x = Math.PI / 2; sel.position.y = 0.14; sel.visible = false; grp.add(sel);
      const stars = new T.Sprite(starMats[0]); stars.scale.set(0.9, 0.28, 1); stars.position.y = 2.35; grp.add(stars);
      const hpBg = new T.Sprite(barMat.bg); hpBg.scale.set(1.1, 0.14, 1); hpBg.position.y = 2.62;
      const hpFg = new T.Sprite(barMat.mine); hpFg.position.set(0, 2.62, 0.001);
      const shFg = new T.Sprite(barMat.shield); shFg.position.set(0, 2.62, 0.002);
      const mpFg = new T.Sprite(barMat.mana); mpFg.position.set(0, 2.5, 0.001);
      const mpBg = new T.Sprite(barMat.bg); mpBg.scale.set(1.1, 0.07, 1); mpBg.position.y = 2.5;
      const icon = new T.Sprite(iconMat.stun); icon.scale.set(0.5, 0.5, 1); icon.position.y = 2.95; icon.visible = false;
      const gear = [0, 1, 2].map(i => { const g = new T.Sprite(iconMat.stun); g.scale.set(0.34, 0.34, 1); g.position.set((i - 1) * 0.36, 2.08, 0); g.visible = false; grp.add(g); return g; });
      for (const s of [hpBg, hpFg, shFg, mpBg, mpFg]) { s.visible = false; grp.add(s); }
      hpBg.renderOrder = mpBg.renderOrder = 50; hpFg.renderOrder = mpFg.renderOrder = 51; shFg.renderOrder = 52;
      const focus = new T.Mesh(G.selRing, focusMat); focus.rotation.x = Math.PI / 2; focus.position.y = 0.16; focus.scale.setScalar(1.12); focus.visible = false; grp.add(focus);
      const glow = new T.Sprite(glowMat); glow.scale.set(2.1, 2.7, 1); glow.position.y = 1.15; glow.visible = false; grp.add(glow);
      grp.add(icon);
      const hit = new T.Mesh(G.hitBox, hitMat); hit.position.y = 1.05; hit.userData.key = key; grp.add(hit);
      scene.add(grp);
      const doll = { key, unitId, star: 0, L, f, grp, base, ring, sel, focus, glow, stars, hpBg, hpFg, shFg, mpBg, mpFg, icon, hit, gear, items: '',
        phase: (key.charCodeAt(1) * 7 + key.length * 13) % 60 / 10, atk: -1, cast: -1, hitT: 0, dead: 0, alive: true, celeb: 0,
        home: new T.Vector3(), moving: 0, lunge: 0, facing: null, cid: -1 };
      setStar(doll, star, false);
      dolls.set(key, doll);
      return doll;
    }
    function setStar(doll, star, flash) {
      if (doll.star === star) return;
      const up = star > doll.star && doll.star > 0;
      doll.star = star;
      doll.stars.material = starMats[star - 1];
      doll.ring.visible = star >= 2;
      if (star >= 2) doll.ring.material = starRingMats[star];
      doll.scale = STAR_SCALE[star - 1] * (doll.inBench ? 0.85 : 1);
      doll.grp.scale.setScalar(doll.scale);
      if (up && flash) burst(doll.grp.position, star === 3 ? 0xf0b429 : 0xd8dde6, 1.8, 0.7);
    }
    // Íconos del equipo (texturas cacheadas por ítem).
    const gearMat = {};
    function gearMaterial(id) {
      if (gearMat[id]) return gearMat[id];
      const d = SIM.itemDef(id), ch = d.icon || (d.emblem ? DATA.TRAITS[d.emblem].icon : d.boardSlots ? '🎟️' : SIM.itemDef(d.from[0]).icon);
      const full = !d.icon;
      return (gearMat[id] = new T.SpriteMaterial({ depthWrite: false, map: textTex('gear' + id, (g, w, h) => {
        g.fillStyle = full ? '#f0b429' : '#24365a'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); g.fill();
        g.font = '36px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, w / 2, h / 2 + 2);
      }, 64, 64) }));
    }
    function setGear(doll, items) {
      const key = (items || []).join(',');
      if (doll.items === key) return;
      doll.items = key;
      doll.gear.forEach((g, i) => { const id = items && items[i]; g.visible = !!id; if (id) g.material = gearMaterial(id); });
    }
    function removeDoll(key) {
      const d = dolls.get(key);
      if (!d) return;
      scene.remove(d.grp);
      dolls.delete(key);
    }

    // ---------- efectos (pools: nada nuevo por cuadro) ----------
    const noteTex = side => textTex('note' + side, (g, w, h) => { g.fillStyle = side ? '#ff8a6a' : '#ffe08a'; g.font = 'bold 52px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = g.fillStyle; g.shadowBlur = 10; g.fillText('♪', w / 2, h / 2 + 2); }, 64, 64);
    const noteMats = [new T.SpriteMaterial({ map: noteTex(0), depthWrite: false, blending: T.AdditiveBlending }), new T.SpriteMaterial({ map: noteTex(1), depthWrite: false, blending: T.AdditiveBlending })];
    const shots = [];
    for (let i = 0; i < 48; i++) { const s = new T.Sprite(noteMats[0]); s.scale.set(0.5, 0.5, 1); s.visible = false; scene.add(s); shots.push({ s, from: new T.Vector3(), to: null, t: 1 }); }
    function fire(from, toDoll, side) {
      const sh = shots.find(x => x.t >= 1);
      if (!sh) return;
      sh.s.material = noteMats[side]; sh.from.copy(from); sh.from.y = 1.2; sh.to = toDoll; sh.t = 0; sh.s.visible = true;
    }
    const bursts = [];
    const burstMats = {};
    const burstMat = c => burstMats[c] || (burstMats[c] = new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false }));
    for (let i = 0; i < 24; i++) { const m = new T.Mesh(G.torus, burstMat(0xffffff)); m.rotation.x = Math.PI / 2; m.visible = false; scene.add(m); bursts.push({ m, t: 1, size: 1, dur: 0.5 }); }
    function burst(pos, color, size, dur) {
      const b = bursts.find(x => x.t >= 1);
      if (!b) return;
      b.m.material = burstMat(color); b.m.position.set(pos.x, 0.3, pos.z); b.t = 0; b.size = size; b.dur = dur; b.m.visible = true;
    }
    // haces de luz y íconos que suben (cuando un músico activa una sinergia)
    const beamGeo = new T.CylinderGeometry(0.55, 0.75, 7, 20, 1, true);
    const beams = [];
    for (let i = 0; i < 12; i++) { const m = new T.Mesh(beamGeo, burstMat(0xffffff)); m.visible = false; scene.add(m); beams.push({ m, t: 1, doll: null }); }
    const floatIcons = [];
    for (let i = 0; i < 12; i++) { const sp = new T.Sprite(starMats[0]); sp.scale.set(0.7, 0.7, 1); sp.visible = false; scene.add(sp); floatIcons.push({ sp, t: 1, doll: null }); }
    const emojiMats = {};
    const emojiMat = ch => emojiMats[ch] || (emojiMats[ch] = new T.SpriteMaterial({ depthWrite: false, map: textTex('em' + ch, (g, w, h) => { g.font = '48px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#000'; g.shadowBlur = 6; g.fillText(ch, w / 2, h / 2 + 2); }, 64, 64) }));
    function traitPulse(uids, color, emoji) {
      for (const uid of uids) {
        const d = dolls.get('u' + uid); if (!d || !d.grp.visible) continue;
        const b = beams.find(x => x.t >= 1), f = floatIcons.find(x => x.t >= 1);
        if (b) { b.m.material = burstMat(color); b.doll = d; b.t = 0; b.m.visible = true; }
        if (f && emoji) { f.sp.material = emojiMat(emoji); f.doll = d; f.t = 0; f.sp.visible = true; }
        burst(d.home, color, 1.5, 0.6); // en su lugar de destino (puede estar todavía en camino)
        d.cast = 0; // un saltito de festejo
      }
    }
    // Resalta a los músicos propios indicados (pasar el mouse por una sinergia del setlist).
    let focused = new Set();
    function focusUnits(uids, color) {
      const next = new Set((uids || []).map(u => 'u' + u));
      for (const k of focused) if (!next.has(k)) { const d = dolls.get(k); if (d) d.focus.visible = false; }
      if (color != null) focusMat.color.setHex(color);
      for (const k of next) { const d = dolls.get(k); if (!d) continue; d.focus.visible = true; if (!focused.has(k)) d.cast = 0; }
      focused = next;
    }
    // números de daño: divs reciclados sobre el canvas
    const nums = [];
    for (let i = 0; i < 40; i++) { const el = document.createElement('div'); el.className = 'dmg'; el.style.display = 'none'; overlay.appendChild(el); nums.push({ el, t: 1, doll: null, off: 0 }); }
    function popNumber(doll, text, cls) {
      const n = nums.find(x => x.t >= 1);
      if (!n || !doll) return;
      n.el.textContent = text; n.el.className = 'dmg ' + (cls || ''); n.el.style.display = 'block';
      n.t = 0; n.doll = doll; n.off = ((nums.indexOf(n) * 37) % 9 - 4) * 4;
    }
    function projectToScreen(v) {
      V3.copy(v).project(camera);
      return { x: (V3.x + 1) / 2 * canvas.clientWidth, y: (1 - V3.y) / 2 * canvas.clientHeight };
    }

    // ---------- planificación ----------
    let mode = 'planning', planKeys = new Set(), dragKey = null, hovered = null, combat = null, alpha = 0;
    let selKey = null, hoverKey = null, spyView = false; // músico elegido (se levanta) y el que está bajo el mouse (brilla)
    // Casilleros: el que está bajo el puntero en dorado; si hay un músico levantado o arrastrado, todos los
    // lugares disponibles en azul (en la pelea, solo el backstage).
    function paintZones() {
      const lifting = !spyView && !!(selKey || dragKey);
      if (mode === 'planning') for (const h of hexes) if (h.userData.R >= ROWS) h.material = hovered === h ? HM.hover : spyView ? HM.spy : lifting ? HM.avail : h.userData.base;
      benchSlots.forEach((sl, i) => (sl.material = hoveredSlot === i ? HM.hover : lifting ? HM.availB : slotMat));
    }
    let hoveredSlot = -1;
    function hoverUnit(uid) {
      const k = uid == null ? null : 'u' + uid;
      if (k === hoverKey) return;
      const old = hoverKey && dolls.get(hoverKey); if (old) old.glow.visible = false;
      hoverKey = k;
      const d = k && dolls.get(k); if (d) d.glow.visible = true;
    }
    // Durante la pelea solo se actualiza el backstage (se puede comprar y acomodar); los del escenario
    // quedan ocultos hasta que termine (los que pelean son los muñecos de combate).
    function setPlanning({ board, bench, selected, spy }) {
      const inCombat = mode !== 'planning';
      const keep = new Set();
      const place = (e, inBench) => {
        const key = 'u' + e.uid;
        keep.add(key);
        let d = dolls.get(key);
        const fresh = !d;
        if (!d) d = makeDoll(key, e.unitId, e.star);
        d.inBench = inBench;
        const p = inBench ? benchWorld(e.idx) : cellWorld(ROWS + Math.floor(e.idx / COLS), e.idx % COLS);
        d.home.set(p.x, 0, p.z);
        if (fresh) { d.grp.position.copy(d.home); d.grp.position.y = 3; d.moving = 1; d.landing = true; }
        else if (d.grp.position.distanceTo(d.home) > 0.05 && dragKey !== key) { d.moving = 1; d.landing = true; }
        setStar(d, e.star, true);
        d.scale = STAR_SCALE[e.star - 1] * (inBench ? 0.85 : 1);
        d.grp.scale.setScalar(d.scale);
        d.sel.visible = selected === e.uid;
        d.glow.visible = hoverKey === key;
        setGear(d, e.items);
        d.alive = true; d.dead = 0; d.grp.visible = true;
      };
      board.forEach(e => { if (!inCombat) place(e, false); else { const k = 'u' + e.uid, d = dolls.get(k); if (d) { keep.add(k); d.grp.visible = false; setStar(d, e.star, true); setGear(d, e.items); } } });
      bench.forEach(e => place(e, true));
      for (const k of planKeys) if (!keep.has(k)) removeDoll(k);
      planKeys = keep;
      selKey = selected != null && keep.has('u' + selected) ? 'u' + selected : null; spyView = !!spy;
      if (ring) for (const k of keep) { const d = dolls.get(k); if (d) d.grp.visible = false; }
      if (hoverKey && !keep.has(hoverKey)) hoverKey = null;
      paintZones();
    }

    // ---------- combate ----------
    function startCombat(cs, flip) {
      mode = 'combat';
      for (const k of planKeys) { const d = dolls.get(k); if (d && !d.inBench) d.grp.visible = false; } // el backstage sigue a mano
      for (const h of hexes) h.material = h.userData.R >= ROWS ? h.userData.base : HM.foe;
      hoverUnit(null);
      combat = { cs, flip, mySide: flip ? 1 : 0, keys: [] };
      for (const u of cs.units) {
        const d = makeDoll('c' + u.cid, u.unitId, u.star);
        d.cid = u.cid; d.inBench = false; d.scale = STAR_SCALE[u.star - 1]; d.grp.scale.setScalar(d.scale);
        for (const s of [d.hpBg, d.hpFg, d.mpBg]) s.visible = true;
        d.mpFg.visible = u.maxMana > 0; d.mpBg.visible = u.maxMana > 0;
        combat.keys.push(d.key);
        setGear(d, u.items);
        placeCombat(d, u, 0);
        d.grp.rotation.y = (u.side === combat.mySide) ? Math.PI : 0;
      }
    }
    function combatPos(u, a) {
      const cs = combat.cs, tnow = cs.tick + a, span = u.moveEnd - u.moveStart;
      const k = span > 0 ? Math.max(0, Math.min(1, (tnow - u.moveStart) / span)) : 1;
      const R1 = combat.flip ? 7 - u.fromR : u.fromR, C1 = combat.flip ? 6 - u.fromC : u.fromC;
      const R2 = combat.flip ? 7 - u.r : u.r, C2 = combat.flip ? 6 - u.c : u.c;
      const p1 = cellWorld(R1, C1), p2 = cellWorld(R2, C2);
      return { x: p1.x + (p2.x - p1.x) * k, z: p1.z + (p2.z - p1.z) * k, moving: k < 1 };
    }
    function placeCombat(d, u, a) {
      const p = combatPos(u, a);
      d.grp.position.set(p.x, d.grp.position.y, p.z);
      d.moving = p.moving ? 1 : 0;
    }
    const dollOf = cid => combat && dolls.get('c' + cid);
    function combatEvents(events) {
      if (!combat) return;
      const cs = combat.cs;
      for (const ev of events) {
        if (ev.t === 'atk') {
          const a = dollOf(ev.s), b = dollOf(ev.d), u = cs.units[ev.s];
          if (!a || !b) continue;
          a.atk = 0;
          if (u.range > 1) fire(a.grp.position, b, u.side === combat.mySide ? 0 : 1); else a.lunge = 1;
        } else if (ev.t === 'cast') {
          const a = dollOf(ev.s); if (!a) continue;
          a.cast = 0;
          const tr = DATA.TRAITS[(SIM.def(a.unitId).classes || [])[0]];
          burst(a.grp.position, tr ? new T.Color(tr.color).getHex() : 0xf2a541, 1.6, 0.55);
        } else if (ev.t === 'dmg') {
          const b = dollOf(ev.d); if (!b) continue;
          b.hitT = 0.15;
          if (ev.k === 'magic') burst(b.grp.position, 0xb05ae0, 0.9, 0.35);
          popNumber(b, ev.a, ev.c ? 'crit' : ev.k === 'magic' ? 'magic' : '');
        } else if (ev.t === 'heal') { const b = dollOf(ev.d); if (b && ev.a >= 20) popNumber(b, '+' + ev.a, 'heal'); }
        else if (ev.t === 'miss') { const b = dollOf(ev.d); if (b) popNumber(b, 'esquiva', 'miss'); }
        else if (ev.t === 'die') { const b = dollOf(ev.d); if (b) { b.alive = false; b.dead = 0.001; } }
        else if (ev.t === 'revive') { const b = dollOf(ev.d); if (b) { b.alive = true; b.dead = 0; burst(b.grp.position, 0xf0b429, 2, 0.8); } }
        else if (ev.t === 'push') { const b = dollOf(ev.d); if (b) b.hitT = 0.25; }
        else if (ev.t === 'legacy') { const a = dollOf(ev.s); if (a) burst(a.grp.position, 0xf0b429, 3, 1); }
        else if (ev.t === 'control') { const b = dollOf(ev.d); if (b) burst(b.grp.position, 0x3cd6d6, 1.4, 0.6); }
      }
    }
    function setAlpha(a) { alpha = a; }
    function celebrate(team) {
      if (!combat) return;
      for (const u of combat.cs.units) if (u.alive && u.team === team) { const d = dollOf(u.cid); if (d) d.celeb = 2.5; }
    }
    function stopCombat() {
      if (combat) for (const k of combat.keys) removeDoll(k);
      combat = null; mode = 'planning';
      for (const k of planKeys) { const d = dolls.get(k); if (d) d.grp.visible = true; }
      for (const h of hexes) if (h.userData.R < ROWS) h.material = HM.foe;
    }

    // ---------- elegir y arrastrar ----------
    const ray = new T.Raycaster(), ndc = new T.Vector2(), ground = new T.Plane(new T.Vector3(0, 1, 0), 0);
    function setRay(x, y) {
      const r = canvas.getBoundingClientRect();
      ndc.x = (x - r.left) / r.width * 2 - 1; ndc.y = -(y - r.top) / r.height * 2 + 1;
      ray.setFromCamera(ndc, camera);
    }
    function pick(x, y, { unitsOnly = false } = {}) {
      setRay(x, y);
      const hitboxes = [];
      for (const d of dolls.values()) if (d.grp.visible && d.alive && d.key !== dragKey) hitboxes.push(d.hit);
      const hu = ray.intersectObjects(hitboxes)[0];
      if (hu) { const k = hu.object.userData.key; return k[0] === 'u' ? { kind: 'unit', uid: +k.slice(1) } : { kind: 'cunit', cid: +k.slice(1) }; }
      if (unitsOnly) return null;
      const hh = ray.intersectObjects(myDropZones())[0];
      if (!hh) return null;
      const ud = hh.object.userData;
      return ud.bench !== undefined ? { kind: 'bench', idx: ud.bench } : { kind: 'board', idx: ud.idx };
    }
    // En la pelea solo el backstage: el escenario está ocupado.
    const myDropZones = () => (mode === 'planning' ? hexes.filter(h => h.userData.R >= ROWS).concat(benchSlots) : benchSlots);
    // Lo que hay abajo del puntero para soltar (casillero, aunque haya un muñeco encima).
    function dropTarget(x, y) {
      setRay(x, y);
      const hh = ray.intersectObjects(myDropZones())[0];
      if (hh) { const ud = hh.object.userData; return ud.bench !== undefined ? { kind: 'bench', idx: ud.bench } : { kind: 'board', idx: ud.idx }; }
      // si no hay casillero exacto, el más cercano al punto del piso
      if (!ray.ray.intersectPlane(ground, V)) return null;
      let best = null, bd = 1.2;
      if (mode === 'planning') for (const h of hexes) if (h.userData.R >= ROWS) { const dd = Math.hypot(h.position.x - V.x, h.position.z - V.z); if (dd < bd) { bd = dd; best = { kind: 'board', idx: h.userData.idx }; } }
      for (const s of benchSlots) { const dd = Math.hypot(s.position.x - V.x, s.position.z - V.z); if (dd < bd) { bd = dd; best = { kind: 'bench', idx: s.userData.bench }; } }
      return best;
    }
    function dragTo(uid, x, y) {
      const d = dolls.get('u' + uid); if (!d) return;
      if (dragKey !== d.key) { dragKey = d.key; d.glow.visible = false; paintZones(); }
      setRay(x, y);
      if (ray.ray.intersectPlane(ground, V)) { d.grp.position.set(V.x, 0.9, V.z); d.moving = 0; }
    }
    function dragEnd() { const d = dragKey && dolls.get(dragKey); if (d) d.moving = 1; dragKey = null; paintZones(); }
    function highlight(t) {
      hovered = null; hoveredSlot = -1;
      if (t && t.kind === 'board' && mode === 'planning') hovered = hexes.find(h => h.userData.idx === t.idx && h.userData.R >= ROWS) || null;
      if (t && t.kind === 'bench') hoveredSlot = t.idx;
      paintZones();
    }

    // ---------- personajitos (cada jugador tiene uno, customizable) ----------
    const avatars = new Map(); // id -> { grp, f, L, lk, target, phase, label }
    const AV_SCALE = 0.62, AV_SPEED = 4.2;
    const avRingMine = new T.MeshBasicMaterial({ color: 0xf2a541 }), avRingOther = new T.MeshBasicMaterial({ color: 0x7fb3ff });
    const avatarL = look => ({ hair: 'short', hairCol: '#4a3020', skin: '#e2b48c', shirt: '#c0392b', pants: '#222226', instCol: '#2b2b30', ...(look || {}), inst: 'none' });
    function nameMat(text, mine) {
      return new T.SpriteMaterial({ depthWrite: false, depthTest: false, map: textTex('nm' + (mine ? 1 : 0) + text, (g, w, h) => {
        g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(9,14,28,.75)'; const tw = Math.min(w - 4, g.measureText(text).width + 24); g.fillRect((w - tw) / 2, 4, tw, h - 8);
        g.fillStyle = mine ? '#f2a541' : '#e8ecf4'; g.fillText(text, w / 2, h / 2 + 1);
      }, 256, 48) });
    }
    // list: [{ id, look, name, x, z, mine, hidden }]: x/z es a dónde camina
    function setAvatars(list) {
      const keep = new Set();
      for (const a of list) {
        keep.add(a.id);
        let av = avatars.get(a.id);
        const lk = JSON.stringify(a.look || {}) + '|' + a.name + '|' + !!a.mine;
        if (av && av.lk !== lk) { scene.remove(av.grp); avatars.delete(a.id); av = null; }
        if (!av) {
          const L = avatarL(a.look), f = buildFigure(L);
          const grp = new T.Group(); f.root.scale.setScalar(AV_SCALE); grp.add(f.root);
          const ring = new T.Mesh(G.selRing, a.mine ? avRingMine : avRingOther); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; ring.scale.setScalar(0.55); grp.add(ring);
          const label = new T.Sprite(nameMat(a.name || '', a.mine)); label.scale.set(1.9, 0.36, 1); label.position.y = 1.75; label.renderOrder = 60; grp.add(label);
          grp.position.set(a.x || 0, 0, a.z || 0);
          scene.add(grp);
          av = { grp, f, L, lk, target: new T.Vector3(a.x || 0, 0, a.z || 0), phase: Math.random() * 6 };
          avatars.set(a.id, av);
        }
        if (a.x != null && a.z != null) av.target.set(a.x, 0, a.z);
        if (a.snap) av.grp.position.copy(av.target);
        av.grp.visible = !a.hidden;
      }
      for (const [id, av] of avatars) if (!keep.has(id)) { scene.remove(av.grp); avatars.delete(id); }
    }
    function avatarPos(id) { const av = avatars.get(id); return av ? { x: av.grp.position.x, z: av.grp.position.z, walking: av.grp.position.distanceTo(av.target) > 0.05 } : null; }
    function moveAvatar(id, x, z) { const av = avatars.get(id); if (av) av.target.set(x, 0, z); }
    function stepAvatars(dt, t) {
      for (const av of avatars.values()) {
        if (!av.grp.visible) continue;
        V.subVectors(av.target, av.grp.position); V.y = 0;
        const dist = V.length(), walking = dist > 0.04;
        if (walking) {
          av.grp.position.addScaledVector(V, Math.min(1, AV_SPEED * dt / dist));
          const want = Math.atan2(V.x, V.z); let dA = want - av.f.root.rotation.y; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
          av.f.root.rotation.y += dA * Math.min(1, dt * 10);
        } else {
          const want = Math.atan2(camera.position.x - av.grp.position.x, camera.position.z - av.grp.position.z);
          let dA = want - av.f.root.rotation.y; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); av.f.root.rotation.y += dA * Math.min(1, dt * 3);
        }
        pose(av.f, av.L, t + av.phase, -1, -1);
        av.f.body.position.y = walking ? Math.abs(Math.sin(t * 13 + av.phase)) * 0.22 : 0;
        if (walking) { const sw = Math.sin(t * 13 + av.phase) * 0.6; av.f.legs[0].rotation.x = sw; av.f.legs[1].rotation.x = -sw; av.f.armR.rotation.x = -sw * 0.7; av.f.armL.rotation.x = sw * 0.7; }
      }
    }

    // ---------- firma de autógrafos: ronda de músicos girando en el centro ----------
    let ring = null; // { list: [{ grp, f, L, icon, taken, angle0 }], t0 }
    const RING_R = 2.7, RING_SPEED = 0.28;
    function startCarousel(offers) {
      stopCarousel();
      ring = { list: [], t0: elapsed };
      offers.forEach((o, i) => {
        const L = o.unitId ? LOOKS.of(o.unitId, SIM.def(o.unitId)) : avatarL({ hair: 'buzz', shirt: '#555' });
        const f = buildFigure(L), grp = new T.Group(); grp.add(f.root); f.root.scale.setScalar(0.85);
        const base = new T.Mesh(G.base, baseMat(o.unitId ? DATA.UNITS[o.unitId].cost : 0)); base.position.y = 0.06; grp.add(base);
        const icon = new T.Sprite(o.itemIcon ? emojiMat(o.itemIcon) : iconMat.stun); icon.scale.set(0.7, 0.7, 1); icon.position.y = 2.25; grp.add(icon);
        grp.visible = !o.taken;
        scene.add(grp);
        ring.list.push({ grp, f, L, taken: !!o.taken, angle0: (i / offers.length) * Math.PI * 2 });
      });
      for (const k of planKeys) { const d = dolls.get(k); if (d) d.grp.visible = false; }
    }
    function ringPos(i) {
      if (!ring || !ring.list[i]) return null;
      const a = ring.list[i].angle0 + (elapsed - ring.t0) * RING_SPEED;
      return { x: Math.cos(a) * RING_R, z: Math.sin(a) * RING_R };
    }
    function carouselTake(i) { const it = ring && ring.list[i]; if (it && !it.taken) { it.taken = true; it.grp.visible = false; burst(it.grp.position, 0xf0b429, 1.6, 0.6); } }
    function stopCarousel() {
      if (!ring) return;
      for (const it of ring.list) scene.remove(it.grp);
      ring = null;
      for (const k of planKeys) { const d = dolls.get(k); if (d) d.grp.visible = true; }
    }
    function stepCarousel(t) {
      if (!ring) return;
      ring.list.forEach((it, i) => {
        if (it.taken) return;
        const p = ringPos(i); it.grp.position.set(p.x, 0, p.z);
        it.f.root.rotation.y = Math.atan2(p.x, p.z); // mirando hacia afuera, a los que vienen
        pose(it.f, it.L, t + i, -1, -1);
      });
    }
    // punto del piso bajo el puntero
    function groundAt(x, y) { setRay(x, y); return ray.ray.intersectPlane(ground, V) ? { x: V.x, z: V.z } : null; }

    // ---------- retrato del muñeco (plan B de tools/retratos: músicos sin foto libre) ----------
    let pr = null;
    function portrait(unitId, size = 512, bg = '#5a6070') {
      if (!pr) {
        const cv = document.createElement('canvas');
        const r = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
        r.outputEncoding = T.sRGBEncoding;
        const sc = new T.Scene();
        sc.add(new T.HemisphereLight(0xffffff, 0x404050, 0.45));
        const key = new T.DirectionalLight(0xffffff, 0.6); key.position.set(1.5, 2.5, 4); sc.add(key);
        pr = { cv, r, sc, cam: new T.PerspectiveCamera(26, 1, 0.1, 50) };
      }
      pr.r.setSize(size, size, false); pr.sc.background = new T.Color(bg);
      const f = buildFigure(typeof unitId === 'object' ? avatarL(unitId) : LOOKS.of(unitId, SIM.def(unitId)));
      pr.sc.add(f.root); f.root.updateMatrixWorld(true);
      const h = f.head.getWorldPosition(new T.Vector3());
      const far = typeof unitId === "object" ? 3.6 : 2.9; // el personajito: un poco más lejos (sombreros altos)
      pr.cam.position.set(h.x + 0.35, h.y + 0.25, h.z + far); pr.cam.lookAt(h.x, h.y + (typeof unitId === "object" ? 0.1 : -0.02), h.z);
      pr.r.render(pr.sc, pr.cam);
      const url = pr.cv.toDataURL('image/png');
      pr.sc.remove(f.root);
      return url;
    }

    // ---------- cámara ----------
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      // encuadre: escenario completo y el backstage por encima del HUD de abajo.
      // En pantallas angostas (celular vertical) la cámara es más cenital para usar la altura.
      const narrow = camera.aspect < 1.1, portrait = camera.aspect < 0.75;
      if (portrait) { camera.fov = 58; baseCam.pos.set(0, 30, 12.5); baseCam.look.set(0, 0, 2.6); }
      else if (narrow) { camera.fov = 52; baseCam.pos.set(0, 22, 21); baseCam.look.set(0, 0, 5.2); }
      else { camera.fov = 38; baseCam.pos.set(0, 18.5, 20.5); baseCam.look.set(0, 0, 5.4); }
      camera.updateProjectionMatrix();
      applyView();
    }
    // Vista del jugador: zoom (rueda / pellizco) y paneo (arrastrar el piso) sobre el encuadre base.
    const baseCam = { pos: new T.Vector3(), look: new T.Vector3() }, view = { zoom: 1, x: 0, z: 0 }, VL = new T.Vector3();
    function applyView() {
      view.zoom = Math.max(0.55, Math.min(2.4, view.zoom));
      view.x = Math.max(-9, Math.min(9, view.x)); view.z = Math.max(-10, Math.min(8, view.z));
      VL.set(baseCam.look.x + view.x, 0, baseCam.look.z + view.z);
      camera.position.copy(baseCam.pos).sub(baseCam.look).multiplyScalar(1 / view.zoom).add(VL);
      camera.lookAt(VL);
    }
    function panBy(dx, dy) { // píxeles de pantalla → unidades del piso
      const dist = camera.position.distanceTo(VL), k = 2 * dist * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, canvas.clientHeight);
      view.x -= dx * k; view.z -= dy * k * 1.3; applyView();
    }
    function zoomBy(f) { view.zoom *= f; applyView(); }
    function resetView() { view.zoom = 1; view.x = 0; view.z = 0; applyView(); }
    window.addEventListener('resize', resize);

    // ---------- calidad ----------
    const LEVELS = {
      alta: { pr: Math.min(window.devicePixelRatio || 1, 2), shadows: true, map: 1024, cones: true, dust: true },
      media: { pr: Math.min(window.devicePixelRatio || 1, 1.25), shadows: true, map: 512, cones: true, dust: false },
      baja: { pr: 1, shadows: false, map: 512, cones: false, dust: false },
    };
    const ORDER = ['alta', 'media', 'baja'];
    let qMode = 'auto', qLevel = 'alta';
    function applyQuality(level) {
      qLevel = level; const L = LEVELS[level];
      renderer.setPixelRatio(L.pr);
      renderer.shadowMap.enabled = L.shadows; spots[0].l.castShadow = L.shadows;
      if (L.shadows) { spots[0].l.shadow.mapSize.set(L.map, L.map); if (spots[0].l.shadow.map) { spots[0].l.shadow.map.dispose(); spots[0].l.shadow.map = null; } }
      spots.forEach(sp => (sp.cone.visible = L.cones)); dust.visible = L.dust;
      scene.traverse(o => { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
      resize();
    }
    function setQuality(m) { qMode = m; applyQuality(m === 'auto' ? 'alta' : m); lowTime = 0; }
    let frames = 0, acc = 0, lowTime = 0, lastFps = 0;
    function measure(dt) {
      frames++; acc += dt;
      if (acc < 0.5) return;
      lastFps = frames / acc; frames = 0; acc = 0;
      if (qMode === 'auto') {
        lowTime = lastFps < 45 ? lowTime + 0.5 : 0;
        const i = ORDER.indexOf(qLevel);
        if (lowTime >= 2 && i < ORDER.length - 1) { applyQuality(ORDER[i + 1]); lowTime = 0; }
      }
      if (onFps) onFps(Math.round(lastFps), qMode === 'auto' ? `auto (${qLevel})` : qLevel);
    }

    // ---------- loop (tope 60 fps; se frena con la pestaña oculta) ----------
    let last = performance.now(), lastDraw = 0, elapsed = 0;
    const MIN_FRAME = 1000 / 60 - 1.5;
    function loop(now) {
      requestAnimationFrame(loop);
      if (document.hidden) { last = now; return; }
      if (now - lastDraw < MIN_FRAME) return;
      lastDraw = now;
      const dtRaw = (now - last) / 1000, dt = Math.min(dtRaw, 0.05); last = now; elapsed += dt;
      measure(dtRaw);
      if (onFrame) onFrame(now);
      const t = elapsed;
      spots[0].l.target.position.set(Math.sin(t * 0.35) * 3, 0, 2);
      spots[1].l.target.position.set(Math.sin(t * 0.5 + 1) * 5, 0, Math.cos(t * 0.4) * 4);
      spots[2].l.target.position.set(Math.sin(t * 0.45 + 3) * 5, 0, Math.cos(t * 0.3 + 2) * 4);
      spots.forEach(aimCone);
      if (dust.visible) { const p = dust.geometry.attributes.position; for (let i = 0; i < dustN; i++) { let y = p.getY(i) + dt * 0.15; if (y > 10) y = 0; p.setY(i, y); } p.needsUpdate = true; }

      stepAvatars(dt, t); stepCarousel(t);
      for (const d of dolls.values()) {
        if (!d.grp.visible) continue;
        if (d.focus.visible) d.focus.scale.setScalar(1.15 + 0.12 * Math.sin(t * 6)); // resaltado por sinergia: late
        const u = combat && d.cid >= 0 ? combat.cs.units[d.cid] : null;
        if (u) placeCombat(d, u, alpha);
        // hacia dónde mira
        let look = null;
        if (u && u.alive && u.target >= 0) { const td = dollOf(u.target); if (td) look = td.grp.position; }
        const want = look ? Math.atan2(look.x - d.grp.position.x, look.z - d.grp.position.z) : (u ? (u.side === combat.mySide ? Math.PI : 0) : Math.atan2(camera.position.x - d.grp.position.x, camera.position.z - d.grp.position.z));
        let dA = want - d.grp.rotation.y; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
        if (d.alive) d.grp.rotation.y += dA * Math.min(1, dt * 8);
        if (d.atk >= 0) { d.atk += dt / 0.35; if (d.atk >= 1) d.atk = -1; }
        if (d.cast >= 0) { d.cast += dt / 0.7; if (d.cast >= 1) d.cast = -1; }
        if (d.alive) pose(d.f, d.L, t + d.phase, d.atk, d.cast);
        // cuerpo: saltito al moverse, salto al lanzar, golpe, festejo, embestida
        let y = 0;
        if (d.cast >= 0) y += Math.sin(d.cast * Math.PI) * 0.45;
        if (d.celeb > 0) { d.celeb -= dt; y += Math.abs(Math.sin(t * 7 + d.phase)) * 0.5; d.f.armR.rotation.set(-2.8, 0, 0.3); d.f.armL.rotation.set(-2.8, 0, -0.3); }
        if (d.moving && !u) {
          V.subVectors(d.home, d.grp.position); const dist = V.length();
          if (dist < 0.05) { d.grp.position.copy(d.home); d.moving = 0; if (d.landing) { d.landing = false; burst(d.home, 0xd9b98a, 0.9, 0.35); } }
          else { d.grp.position.addScaledVector(V, Math.min(1, dt * 8)); y += Math.min(0.45, dist * 0.35); }
        } else if (u && d.moving) y += Math.abs(Math.sin(t * 12 + d.phase)) * 0.18;
        if (d.lunge > 0) { d.lunge = Math.max(0, d.lunge - dt * 4); d.f.body.position.z = Math.sin(d.lunge * Math.PI) * 0.35; } else d.f.body.position.z = 0;
        if (dragKey !== d.key && !(d.moving && !u)) d.grp.position.y = 0;
        if (!u && d.key === selKey && dragKey !== d.key) y += 0.55 + Math.sin(t * 3) * 0.07; // elegido: levantado, flotando
        d.f.body.position.y = y;
        if (d.hitT > 0) { d.hitT -= dt; d.f.body.scale.y = 1 - 0.12 * Math.max(0, d.hitT / 0.15); d.f.body.rotation.x = -0.15 * Math.max(0, d.hitT / 0.15); } else { d.f.body.scale.y = 1; if (d.alive) d.f.body.rotation.x = 0; }
        if (!d.alive && d.dead > 0) { d.dead = Math.min(1, d.dead + dt * 2.5); d.f.body.rotation.x = -Math.PI / 2 * d.dead; d.f.body.position.y = -0.2 * d.dead; if (d.dead >= 1) d.grp.visible = false; }
        // barras y estados (solo combate)
        if (u) {
          const hp = Math.max(0, u.hp / u.maxHp), sh = Math.min(1 - hp, u.shield / u.maxHp);
          d.hpFg.material = u.side === combat.mySide ? barMat.mine : barMat.foe;
          d.hpFg.scale.set(1.06 * Math.max(0.0001, hp), 0.09, 1); d.hpFg.position.x = -0.53 * (1 - hp);
          d.shFg.visible = sh > 0.005; if (d.shFg.visible) { d.shFg.scale.set(1.06 * sh, 0.09, 1); d.shFg.position.x = -0.53 + 1.06 * hp + 0.53 * sh; }
          if (u.maxMana > 0) { const mp = u.mana / u.maxMana; d.mpFg.scale.set(1.06 * Math.max(0.0001, mp), 0.05, 1); d.mpFg.position.x = -0.53 * (1 - mp); }
          const tk = combat.cs.tick;
          const st = u.controlledUntil > tk ? 'control' : u.stunUntil > tk ? 'stun' : u.confusedUntil > tk ? 'confuse' : u.silencedUntil > tk ? 'silence' : u.asBuffs.some(b => b.slow) ? 'slow' : null;
          d.icon.visible = !!st && u.alive; if (st) d.icon.material = iconMat[st];
          for (const s of [d.hpBg, d.hpFg, d.mpBg, d.mpFg]) s.visible = u.alive && (s !== d.mpFg && s !== d.mpBg || u.maxMana > 0);
        }
      }
      for (const sh of shots) {
        if (sh.t >= 1) continue;
        sh.t += dt * 3.2;
        if (!sh.to || !sh.to.grp.visible) { sh.t = 1; sh.s.visible = false; continue; }
        V2.copy(sh.to.grp.position); V2.y = 1.2;
        sh.s.position.lerpVectors(sh.from, V2, Math.min(1, sh.t)); sh.s.position.y += Math.sin(Math.min(1, sh.t) * Math.PI) * 0.8;
        if (sh.t >= 1) sh.s.visible = false;
      }
      for (const b of bursts) {
        if (b.t >= 1) continue;
        b.t += dt / b.dur;
        const s = b.size * (0.3 + b.t);
        b.m.scale.set(s, s, s); b.m.material.opacity = 0.8 * (1 - b.t);
        if (b.t >= 1) b.m.visible = false;
      }
      for (const b of beams) {
        if (b.t >= 1) continue;
        b.t += dt / 1.1;
        if (b.doll) b.m.position.set(b.doll.grp.position.x, 3.5, b.doll.grp.position.z);
        b.m.material.opacity = 0.55 * Math.sin(Math.min(1, b.t) * Math.PI);
        b.m.scale.set(1 + b.t * 0.3, 1, 1 + b.t * 0.3);
        if (b.t >= 1) { b.m.visible = false; b.doll = null; }
      }
      for (const f of floatIcons) {
        if (f.t >= 1) continue;
        f.t += dt / 1.4;
        if (f.doll) f.sp.position.set(f.doll.grp.position.x, 2.6 + f.t * 1.6, f.doll.grp.position.z);
        f.sp.material.opacity = 1 - f.t * f.t;
        if (f.t >= 1) { f.sp.visible = false; f.doll = null; f.sp.material.opacity = 1; }
      }
      for (const n of nums) {
        if (n.t >= 1) continue;
        n.t += dt / 0.8;
        if (!n.doll) { n.t = 1; }
        else {
          V.copy(n.doll.grp.position); V.y += 2.4;
          const p = projectToScreen(V);
          n.el.style.transform = `translate(${p.x + n.off}px, ${p.y - n.t * 46}px) translate(-50%,-50%)`;
          n.el.style.opacity = String(1 - n.t * n.t);
        }
        if (n.t >= 1) { n.el.style.display = 'none'; n.doll = null; }
      }
      renderer.render(scene, camera);
    }
    resize();
    requestAnimationFrame(loop);

    return {
      setPlanning, startCombat, combatEvents, setAlpha, celebrate, stopCombat, traitPulse,
      pick, dropTarget, dragTo, dragEnd, highlight, setQuality, focusUnits, panBy, zoomBy, resetView, portrait, hoverUnit,
      setAvatars, avatarPos, moveAvatar, startCarousel, stopCarousel, ringPos, carouselTake, groundAt,
      get carouselOn() { return !!ring; },
      get viewChanged() { return view.zoom !== 1 || view.x !== 0 || view.z !== 0; },
      get fps() { return lastFps; }, get quality() { return qLevel; },
      get gpu() { try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) { return ''; } },
      // para pruebas: punto del mundo -> coordenadas de pantalla
      _project(x, y, z) { const r = canvas.getBoundingClientRect(), p = projectToScreen(V.set(x, y, z)); return { x: r.left + p.x, y: r.top + p.y }; },
      // para pruebas: cuántos objetos hay en la escena
      get stats() { return { dolls: dolls.size, objects: scene.children.length, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; },
    };
  }
  return { create, cellWorld, benchWorld };
})();
