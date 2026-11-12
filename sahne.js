// =============================================================
// Kule Savaşları - 3B sahne (Three.js)
// Her oyuncunun bir "kulvarı" var (yan yana, aralarında boşluk). Ekran bölünür:
// kendi kulen büyük, rakiplerin küçük pencerelerde. Hepsi aynı sahneden farklı kameralarla.
// =============================================================

const Sahne = (() => {
  const ARA = 60;              // kulvarlar arası mesafe
  const DERIN = 1;             // parça kalınlığı
  let renderer, scene, kulvarlar = [], tuval;
  const geoOnbellek = new Map();
  const mat = {};

  // ---------- Dokular ----------
  function doku(w, h, ciz) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    ciz(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  const ton = (hex, k) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return '#' + c.getHexString(); };
  function tugla(renk) {
    return doku(128, 128, (g, w, h) => {
      g.fillStyle = '#d9cdb4'; g.fillRect(0, 0, w, h);
      const sira = 4, bh = h / sira;
      for (let r = 0; r < sira; r++) {
        const kay = r % 2 ? -w / 4 : 0;
        for (let k = -1; k < 3; k++) {
          const x = kay + k * (w / 2) + 3, y = r * bh + 3, bw = w / 2 - 6, hh = bh - 6;
          g.fillStyle = ton(renk, (Math.random() - 0.5) * 0.08); g.fillRect(x, y, bw, hh);
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y, bw, 3);
          g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y + hh - 3, bw, 3);
        }
      }
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
    });
  }
  const celik = () => doku(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffd23a'); gr.addColorStop(1, '#e09a00');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 12, w, 4);
    [[22, 30], [w - 22, 30], [22, h - 30], [w - 22, h - 30]].forEach(([x, y]) => {
      g.fillStyle = '#8a5a00'; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill();
      g.fillStyle = '#ffe58a'; g.beginPath(); g.arc(x - 2, y - 2, 4, 0, 7); g.fill();
    });
    g.strokeStyle = 'rgba(80,50,0,0.6)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
  });
  const kasa = () => doku(128, 128, (g, w, h) => {
    g.fillStyle = '#b07a3e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) { g.fillStyle = ton('#b07a3e', (i % 2 ? 0.04 : -0.03)); g.fillRect(0, i * h / 5, w, h / 5 - 2); }
    g.fillStyle = '#7a4f22'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14); g.fillRect(0, 0, 14, h); g.fillRect(w - 14, 0, 14, h);
    g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 4); g.fillRect(-90, -8, 180, 16); g.restore();
    g.fillStyle = '#3a2a1a'; [[7, 7], [w - 7, 7], [7, h - 7], [w - 7, h - 7]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); });
  });
  const beton = () => doku(128, 128, (g, w, h) => {
    g.fillStyle = '#9a9a96'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.15})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 5; g.strokeRect(2, 2, w - 4, h - 4);
  });
  const tahta = () => doku(512, 52, (g, w, h) => {
    g.fillStyle = '#c99a5a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(110,70,30,${0.2 + Math.random() * 0.3})`; g.lineWidth = 1.5; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w / 3, y + 6, (2 * w) / 3, y - 6, w, y + 2); g.stroke(); }
    g.strokeStyle = 'rgba(70,40,10,0.6)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
    g.fillStyle = '#5a3a1a'; [[18, h / 2], [w - 18, h / 2]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); });
  });
  const buzDoku = () => doku(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e8fbff'); gr.addColorStop(1, '#8fd3f2');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3;
    for (let i = 0; i < 5; i++) { g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + 20 - Math.random() * 40, y + 20 - Math.random() * 40); g.stroke(); }
    g.strokeStyle = 'rgba(60,140,190,0.6)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
  });
  const uyari = () => doku(256, 32, (g, w, h) => {
    g.fillStyle = '#ffc400'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a1a1a';
    for (let x = -h; x < w + h; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill(); }
  });
  const kafes = () => {
    const t = doku(64, 64, (g, w, h) => {
      g.fillStyle = '#e8a800'; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
      g.strokeStyle = '#e8a800'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
      g.fillRect(0, 0, w, 5);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  };
  const damali = () => doku(256, 32, (g, w, h) => {
    for (let x = 0; x < w / 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); }
  });
  const tas = () => doku(128, 128, (g, w, h) => {
    g.fillStyle = '#7d7f86'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.18})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(30,30,35,0.6)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += 20 - Math.random() * 40; y += 20 - Math.random() * 40; g.lineTo(x, y); } g.stroke(); }
  });
  const varilDoku = () => doku(256, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#c42a1e'); gr.addColorStop(0.5, '#e8452f'); gr.addColorStop(1, '#a0201a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a3a40'; [0.18, 0.5, 0.82].forEach(f => g.fillRect(0, h * f - 6, w, 12));
    g.fillStyle = '#ffd23a'; g.font = '900 34px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('☢', w * 0.25, h * 0.34); g.fillText('☢', w * 0.75, h * 0.66);
  });
  const varilKapak = () => doku(128, 128, (g, w, h) => {
    g.fillStyle = '#9a1e16'; g.beginPath(); g.arc(64, 64, 64, 0, 7); g.fill();
    g.strokeStyle = '#3a3a40'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.stroke();
    g.fillStyle = '#3a3a40'; g.beginPath(); g.arc(88, 50, 9, 0, 7); g.fill();
  });
  const sarmasikDoku = () => doku(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#2f7a2a'; g.lineWidth = 5; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      g.beginPath(); let x = Math.random() * w, y = 0; g.moveTo(x, y);
      while (y < h) { const nx = x + 30 - Math.random() * 60, ny = y + 25; g.quadraticCurveTo(x + 25 - Math.random() * 50, y + 12, nx, ny); x = nx; y = ny; }
      g.stroke();
    }
    for (let i = 0; i < 22; i++) {
      const x = Math.random() * w, y = Math.random() * h, a = Math.random() * 6.3;
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = Math.random() < 0.5 ? '#3fae3a' : '#5cc94f';
      g.beginPath(); g.ellipse(0, 0, 10, 5.5, 0, 0, 7); g.fill(); g.restore();
    }
  });
  const gokyuzu = () => doku(4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#2a6fd6'); gr.addColorStop(0.55, '#7fc0f0'); gr.addColorStop(0.85, '#ffd9a8'); gr.addColorStop(1, '#ffb27a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const sehir = () => doku(1024, 256, (g, w, h) => {
    let x = 0;
    while (x < w) {
      const bw = 30 + Math.random() * 70, bh = 60 + Math.random() * 170;
      g.fillStyle = `rgba(60,80,120,${0.55 + Math.random() * 0.25})`; g.fillRect(x, h - bh, bw, bh);
      g.fillStyle = 'rgba(255,230,150,0.35)';
      for (let yy = h - bh + 10; yy < h - 8; yy += 14) for (let xx = x + 6; xx < x + bw - 8; xx += 12) if (Math.random() < 0.4) g.fillRect(xx, yy, 5, 7);
      x += bw + 4;
    }
  });
  const bulut = () => doku(256, 128, (g, w, h) => {
    g.fillStyle = 'rgba(255,255,255,0.9)';
    [[70, 80, 40], [120, 60, 50], [175, 78, 38], [100, 90, 35], [150, 92, 32]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
  });
  const cetvel = () => {
    const t = doku(64, 64, (g, w, h) => {
      g.fillStyle = 'rgba(255,255,255,0.0)'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, h - 4, w, 4); g.fillRect(0, h / 2 - 1, w / 2, 2);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  };
  function yaziDoku(metin, renk = '#fff') {
    return doku(128, 64, (g, w, h) => {
      g.font = '900 44px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeText(metin, w / 2, h / 2 + 2);
      g.fillStyle = renk; g.fillText(metin, w / 2, h / 2 + 2);
    });
  }

  // ---------- Kurulum ----------
  function kur(canvas) {
    tuval = canvas;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.autoClear = false;
    scene = new THREE.Scene();
    scene.background = gokyuzu();
    scene.add(new THREE.HemisphereLight(0xdfefff, 0x6a5a48, 1.15));
    const gunes = new THREE.DirectionalLight(0xfff1dc, 1.5); gunes.position.set(-6, 10, 12); scene.add(gunes);
    const ren = (hex, map) => new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness: 0.85, metalness: 0.0 });
    mat.T = ren(0, tugla('#c8452f')); mat.L = ren(0, tugla('#e0842a')); mat.J = ren(0, tugla('#4f78c4'));
    mat.S = ren(0, tugla('#4a9e48')); mat.Z = ren(0, tugla('#a8489c'));
    mat.I = new THREE.MeshStandardMaterial({ map: celik(), roughness: 0.45, metalness: 0.35 });
    mat.O = ren(0, kasa()); mat.K1 = ren(0, beton()); mat.K2 = mat.K1; mat.KALAS = ren(0, tahta());
    mat.buz = new THREE.MeshStandardMaterial({ map: buzDoku(), roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85, emissive: 0x2a6a8a, emissiveIntensity: 0.25 });
    mat.sabitRenk = new THREE.Color(0x8fa3c0);
    mat.UCGEN = new THREE.MeshStandardMaterial({ map: tas(), roughness: 0.95 });
    mat.VARIL = [new THREE.MeshStandardMaterial({ map: varilDoku(), roughness: 0.5, metalness: 0.3 }), new THREE.MeshStandardMaterial({ map: varilKapak(), roughness: 0.5, metalness: 0.3 })];
    mat.sarmasik = new THREE.MeshStandardMaterial({ map: sarmasikDoku(), transparent: true, alphaTest: 0.2, roughness: 0.8, side: THREE.DoubleSide });
    mat.uyari = new THREE.MeshStandardMaterial({ map: uyari(), roughness: 0.7 });
    mat.betonP = new THREE.MeshStandardMaterial({ map: beton(), roughness: 0.9 });
    mat.kafes = new THREE.MeshStandardMaterial({ map: kafes(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 });
    mat.sari = new THREE.MeshStandardMaterial({ color: 0xffb800, roughness: 0.5, metalness: 0.3 });
    mat.koyu = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.6, metalness: 0.5 });
    mat.damali = new THREE.MeshBasicMaterial({ map: damali(), transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    mat.sehir = new THREE.MeshBasicMaterial({ map: sehir(), transparent: true, depthWrite: false });
    mat.bulut = new THREE.MeshBasicMaterial({ map: bulut(), transparent: true, depthWrite: false, opacity: 0.85 });
    mat.isik = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending });
    mat.lazer = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    mat.lazerParilti = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
    mat.ruzgar = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
    mat.cetvel = new THREE.MeshBasicMaterial({ map: cetvel(), transparent: true, depthWrite: false });
    boyutla();
    window.addEventListener('resize', boyutla);
  }
  function boyutla() {
    if (!renderer) return;
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  // ---------- Parça ----------
  function geo(w, h) {
    const k = `${w.toFixed(3)}x${h.toFixed(3)}`;
    if (!geoOnbellek.has(k)) geoOnbellek.set(k, new THREE.BoxGeometry(w, h, DERIN));
    return geoOnbellek.get(k);
  }
  function parcaYap(p) {
    const g = new THREE.Group();
    const m = p.buz ? mat.buz : mat[p.tip];
    Fizik.SEKIL[p.tip].forEach(r => {
      let mesh;
      if (r.ucgen) {
        const sh = new THREE.Shape(Fizik.UCGEN_KOSE.map(([x, y]) => new THREE.Vector2(x * p.olcek * 0.975, y * p.olcek * 0.975)));
        const gg = new THREE.ExtrudeGeometry(sh, { depth: DERIN, bevelEnabled: false }); gg.translate(0, 0, -DERIN / 2);
        // dokuyu yüze yay
        const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.2 + 0.5, uv.getY(i) / 1.6 + 0.5);
        mesh = new THREE.Mesh(gg, p.buz ? mat.buz : mat.UCGEN);
      } else if (r.daire) {
        const rr = (r.w / 2) * p.olcek * 0.975;
        const gg = new THREE.CylinderGeometry(rr, rr, DERIN, 28); gg.rotateX(Math.PI / 2);
        mesh = new THREE.Mesh(gg, p.buz ? mat.buz : [mat.VARIL[0], mat.VARIL[1], mat.VARIL[1]]);
      } else {
        mesh = new THREE.Mesh(geo(r.w * p.olcek * 0.975, r.h * p.olcek * 0.975), m);
        mesh.position.set(r.x * p.olcek, r.y * p.olcek, 0);
      }
      mesh.userData.govde = true;
      g.add(mesh);
    });
    g.userData = { sabit: false, tip: p.tip, buz: p.buz, sarmasik: false };
    return g;
  }
  // Balon parçası: üstünde iple bağlı kırmızı balon
  function balonYap(g) {
    if (g.userData.balon) return;
    g.userData.balon = true;
    const kutu = new THREE.Box3().setFromObject(g), ust = kutu.max.y - g.position.y;
    const ip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4), mat.koyu); ip.position.set(0, ust + 0.4, 0); g.add(ip);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff3d5a, roughness: 0.25, emissive: 0x401018 }));
    b.scale.y = 1.15; b.position.set(0, ust + 1.15, 0); g.add(b);
    g.children.filter(m => m.userData.govde && !Array.isArray(m.material)).forEach(m => { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.75; });
  }
  // Mıknatıslı parça: kırmızı-gri parıltı
  function miknatisYap(g) {
    if (g.userData.miknatis) return;
    g.userData.miknatis = true;
    g.children.filter(m => m.userData.govde && !Array.isArray(m.material)).forEach(m => { m.material = m.material.clone(); m.material.emissive = new THREE.Color(0xc02020); m.material.emissiveIntensity = 0.35; });
  }
  // Sarmaşık sarılı parça: önüne ve arkasına yapraklı sarmaşık katmanı
  function sarmasikYap(g, p) {
    if (g.userData.sarmasik) return;
    g.userData.sarmasik = true;
    Fizik.SEKIL[p.tip].forEach(r => {
      const w = r.w * p.olcek * (r.ucgen ? 0.6 : 1), h = r.h * p.olcek * (r.ucgen ? 0.6 : 1);
      [1, -1].forEach(yon => {
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat.sarmasik);
        pl.position.set(r.ucgen ? 0 : r.x * p.olcek, r.ucgen ? -0.1 : r.y * p.olcek, yon * (DERIN / 2 + 0.03));
        g.add(pl);
      });
    });
  }
  function sabitYap(g) {
    if (g.userData.sabit) return;
    g.userData.sabit = true;
    g.children.filter(m => m.userData.govde && !Array.isArray(m.material)).forEach(m => { m.material = m.material.clone(); m.material.color.copy(mat.sabitRenk); m.material.emissive = new THREE.Color(0x203048); m.material.emissiveIntensity = 0.4; });
    // zımba telleri
    const tel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.06), mat.koyu);
    tel.position.z = DERIN / 2 + 0.03; g.children[0].add(tel);
  }

  // ---------- Kulvar ----------
  function kulvarYap(i, mod, hedef) {
    const x0 = i * ARA;
    const grup = new THREE.Group(); grup.position.x = x0; scene.add(grup);
    const P = Fizik.PLATFORM;
    // platform + ayak
    const plat = new THREE.Mesh(new THREE.BoxGeometry(P, 1, 2.4), mat.betonP); plat.position.y = -0.5; grup.add(plat);
    const serit = new THREE.Mesh(new THREE.BoxGeometry(P + 0.02, 0.22, 0.05), mat.uyari); serit.position.set(0, -0.14, 1.22); grup.add(serit);
    const ayakGeo = new THREE.BoxGeometry(1.8, 60, 1.8);
    const ayakMat = mat.kafes.clone(); ayakMat.map = mat.kafes.map.clone(); ayakMat.map.repeat.set(1, 33); ayakMat.map.needsUpdate = true;
    const ayak = new THREE.Mesh(ayakGeo, ayakMat); ayak.position.y = -31; grup.add(ayak);
    // uzak şehir ve bulutlar (yükseldikçe aşağıda kalır)
    const sehir = new THREE.Mesh(new THREE.PlaneGeometry(120, 30), mat.sehir); sehir.position.set(0, -12, -40); grup.add(sehir);
    for (let k = 0; k < 9; k++) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), mat.bulut);
      b.position.set((k % 2 ? -1 : 1) * (8 + Math.random() * 14), 8 + k * 7 + Math.random() * 4, -25 - Math.random() * 8); grup.add(b);
    }
    // yükseklik cetveli
    const cetM = mat.cetvel.clone(); cetM.map = mat.cetvel.map.clone(); cetM.map.repeat.set(1, 80); cetM.map.needsUpdate = true;
    const cet = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 80), cetM); cet.position.set(-6.2, 40, -2); grup.add(cet);
    for (let h = 5; h <= 75; h += 5) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: yaziDoku(`${h}`), depthWrite: false })); s.scale.set(1.2, 0.6, 1); s.position.set(-6.9, h, -2); grup.add(s);
    }
    // mod işaretleri
    if (mod === 'yaris') {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(13, 0.5), mat.damali); s.position.set(0, hedef, -1.2); grup.add(s);
      [-6.5, 6.5].forEach(x => {
        const dir = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8), mat.koyu); dir.position.set(x, hedef + 0.55, -1.2); grup.add(dir);
        const bay = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), mat.damali); bay.position.set(x + (x < 0 ? 0.45 : -0.45), hedef + 1.05, -1.2); grup.add(bay);
      });
    } else if (mod === 'bulmaca') {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 15, 8), mat.lazer); l.rotation.z = Math.PI / 2; l.position.set(0, hedef, 0); grup.add(l);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(15, 0.7), mat.lazerParilti); p.position.set(0, hedef, 0.05); grup.add(p);
      [-7.6, 7.6].forEach(x => { const k = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.8), mat.koyu); k.position.set(x, hedef, 0); grup.add(k); });
    }
    // vinç
    const vinc = new THREE.Group(); grup.add(vinc);
    const kiris = new THREE.Mesh(new THREE.BoxGeometry(18, 0.45, 0.45), mat.sari); vinc.add(kiris);
    const kirisK = new THREE.Mesh(new THREE.PlaneGeometry(18, 0.45), (() => { const m2 = mat.kafes.clone(); m2.map = mat.kafes.map.clone(); m2.map.repeat.set(40, 1); m2.map.needsUpdate = true; return m2; })());
    kirisK.position.z = 0.24; vinc.add(kirisK);
    const araba = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.8), mat.koyu); araba.position.y = -0.4; vinc.add(araba);
    const halat = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), mat.koyu); vinc.add(halat);
    const kanca = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 12, Math.PI * 1.4), mat.koyu); vinc.add(kanca);
    // düşme rehberi (ışık sütunu)
    const isik = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat.isik); isik.visible = false; grup.add(isik);
    // rüzgâr çizgileri
    const ruz = [];
    for (let k = 0; k < 14; k++) { const r = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + Math.random() * 1.6, 0.05), mat.ruzgar); r.visible = false; r.userData = { hiz: 14 + Math.random() * 10, y: Math.random() }; grup.add(r); ruz.push(r); }

    const kamera = new THREE.PerspectiveCamera(40, 1, 0.5, 200);
    return { i, x0, grup, kamera, parca: new Map(), hedefler: new Map(), kamY: 5, vincY: 11, vinc, araba, halat, kanca, isik, ruz, ust: 0, rz: 0, yerel: false };
  }

  function oyunKur(sayi, mod, hedef) {
    temizle();
    for (let i = 0; i < sayi; i++) kulvarlar.push(kulvarYap(i, mod, hedef));
  }
  function temizle() {
    kulvarlar.forEach(k => scene.remove(k.grup));
    kulvarlar = [];
  }

  // Kulvarın parçalarını güncelle. liste: [{id,tip,x,y,a,olcek,buz,sabit,aktif}], yerel: doğrudan (yumuşatmasız)
  function guncelle(i, liste, durum, yerel) {
    const k = kulvarlar[i]; if (!k) return;
    k.yerel = yerel; k.ust = durum.ust || 0; k.rz = durum.rz || 0;
    const gorulen = new Set();
    liste.forEach(p => {
      gorulen.add(p.id);
      let g = k.parca.get(p.id);
      if (!g) { g = parcaYap(p); g.position.set(p.x, p.y, 0); g.rotation.z = p.a; k.grup.add(g); k.parca.set(p.id, g); }
      if (p.sabit) sabitYap(g);
      if (p.sarmasik) sarmasikYap(g, p);
      if (p.balon) balonYap(g);
      if (p.miknatis) miknatisYap(g);
      g.userData.aktif = p.aktif;
      k.hedefler.set(p.id, p);
      if (yerel) { g.position.set(p.x, p.y, 0); g.rotation.z = p.a; }
    });
    k.parca.forEach((g, id) => { if (!gorulen.has(id)) { k.grup.remove(g); k.parca.delete(id); k.hedefler.delete(id); } });
  }

  // Her kare: yumuşatma, vinç, kamera hedefleri
  function ilerlet(dt) {
    const f = 1 - Math.exp(-dt * 14);
    kulvarlar.forEach(k => {
      let aktif = null;
      k.parca.forEach((g, id) => {
        const h = k.hedefler.get(id);
        if (!k.yerel && h) {
          g.position.x += (h.x - g.position.x) * f; g.position.y += (h.y - g.position.y) * f;
          let da = h.a - g.rotation.z; da = Math.atan2(Math.sin(da), Math.cos(da)); g.rotation.z += da * f;
        }
        if (g.userData.aktif) aktif = g;
      });
      // vinç
      const vHedef = Math.max(k.ust, 0) + 12;
      k.vincY += (vHedef - k.vincY) * Math.min(1, dt * 2);
      k.vinc.position.y = k.vincY;
      if (aktif) {
        const kutu = new THREE.Box3().setFromObject(aktif);
        const ax = aktif.position.x;
        k.araba.position.x += (ax - k.araba.position.x) * Math.min(1, dt * 20);
        const ust = kutu.max.y - k.vincY, alt = -0.65;
        const boy = Math.max(0.05, alt - ust);
        k.halat.visible = true; k.halat.scale.y = boy; k.halat.position.set(k.araba.position.x, alt - boy / 2, 0);
        k.kanca.position.set(k.araba.position.x, ust + 0.1, 0); k.kanca.rotation.z = Math.PI * 0.8;
        // düşme rehberi
        const genis = kutu.max.x - kutu.min.x, alty = kutu.min.y;
        k.isik.visible = true; k.isik.scale.set(genis, Math.max(0.1, alty + 0.0), 1);
        k.isik.position.set((kutu.min.x + kutu.max.x) / 2 - k.x0, alty / 2, -0.55);
      } else {
        k.halat.visible = true; k.halat.scale.y = 0.6; k.halat.position.set(k.araba.position.x, -0.95, 0);
        k.kanca.position.set(k.araba.position.x, -1.3, 0);
        k.isik.visible = false;
      }
      // rüzgâr
      k.ruz.forEach(r => {
        r.visible = !!k.rz;
        if (!k.rz) return;
        r.position.x += k.rz * r.userData.hiz * dt;
        if (Math.abs(r.position.x) > 10 || r.position.y === 0) { r.position.x = -k.rz * (8 + Math.random() * 2); r.position.y = Math.max(k.ust, 0) - 2 + Math.random() * 12; r.position.z = 1.5; }
      });
      // kamera yüksekliği
      const kHedef = Math.max(0, k.ust + 2.5);
      k.kamY += (kHedef - k.kamY) * Math.min(1, dt * 1.8);
    });
  }

  // alanlar: [{i, x, y, w, h, ana}] (CSS piksel, sol üstten)
  function ciz(dt, alanlar) {
    if (!renderer) return;
    ilerlet(Math.max(0, Math.min(dt, 0.1)));
    const W = window.innerWidth, H = window.innerHeight;
    renderer.setScissorTest(false); renderer.setClearColor(0x0d1420); renderer.clear();
    renderer.setScissorTest(true);
    alanlar.forEach(a => {
      const k = kulvarlar[a.i]; if (!k || a.w < 2 || a.h < 2) return;
      const cam = k.kamera, asp = a.w / a.h;
      cam.aspect = asp;
      // Görünen alan: en az 9 birim yükseklik, 9.4 birim genişlik (platform 6 + taşma payı)
      const yariH = 9, yariW = asp < 0.45 ? 3.6 : 4.7;   // çok dar sütunda (telefon, dikey) biraz daha yakın
      const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const d = Math.max(yariH / t, yariW / (t * asp));
      const vh = d * t;   // görünen yarı yükseklik
      // platform ekranın altına yakın kalsın (alttaki düğmeler için ~%12 pay), kule büyüdükçe kamera yükselir
      const merkez = Math.max(k.kamY, vh * 0.76 - 1.2);
      cam.position.set(k.x0, merkez + 1, d);
      cam.lookAt(k.x0, merkez, 0);
      cam.updateProjectionMatrix();
      const y = H - a.y - a.h;
      renderer.setViewport(a.x, y, a.w, a.h); renderer.setScissor(a.x, y, a.w, a.h);
      renderer.render(scene, cam);
    });
  }

  return { kur, oyunKur, temizle, guncelle, ciz, boyutla };
})();
