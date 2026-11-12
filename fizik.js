// =============================================================
// Kule Savaşları - bir oyuncunun kulesi (fizik + kurallar)
// Her oyuncunun ayrı bir 2B fizik dünyası var (planck.js). 3B çizim sahne.js'de.
// Parçalar vinçten iner; bir şeye değince bırakılır ve gerçek fiziğe geçer.
// =============================================================

const Fizik = (() => {
  const pl = planck;
  const V = (x, y) => pl.Vec2(x, y);
  const PLATFORM = 6;           // platform genişliği
  const DUSME_Y = -7;           // bunun altına düşen parça kaybolur
  const ADIM = 1 / 60;
  const SURTUNME = 1.0, DONME_SONUM = 0.8;
  const KILIT = 0.5, KILIT_EN_FAZLA = 2.5;   // yere değince kaydırma payı (sn) ve en uzun toplam süre

  // Parça şekilleri: hücreler (1x1) → gövde merkezine göre dikdörtgenler
  const HUCRE = {
    I: [[0, 0], [1, 0], [2, 0], [3, 0]],
    O: [[0, 0], [1, 0], [0, 1], [1, 1]],
    T: [[0, 0], [1, 0], [2, 0], [1, 1]],
    L: [[0, 0], [1, 0], [2, 0], [2, 1]],
    J: [[0, 0], [1, 0], [2, 0], [0, 1]],
    S: [[0, 0], [1, 0], [1, 1], [2, 1]],
    Z: [[1, 0], [2, 0], [0, 1], [1, 1]],
    K1: [[0, 0]],
    K2: [[0, 0], [1, 0]],
  };
  const NORMAL = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'];
  const SEKIL = {};
  Object.entries(HUCRE).forEach(([ad, h]) => {
    // Dönme noktası: ağırlık merkezine en yakın yarım-birim nokta. Böylece her hücre yarım birimlik
    // ızgaraya oturur ve parçalar (özellikle L/J) yan yana boşluksuz dizilir.
    const yarim = v => Math.round(v * 2) / 2;
    const mx = yarim(h.reduce((s, c) => s + c[0], 0) / h.length), my = yarim(h.reduce((s, c) => s + c[1], 0) / h.length);
    SEKIL[ad] = h.map(([x, y]) => ({ x: x - mx, y: y - my, w: 1, h: 1 }));
  });
  SEKIL.KALAS = [{ x: 0, y: 0, w: 5, h: 0.5 }];
  const TIP_KOD = ['I', 'O', 'T', 'L', 'J', 'S', 'Z', 'K1', 'K2', 'KALAS'];

  // Aletler: iyiler kendine, kötüler rakibe
  const ALETLER = {
    zimba: { ad: 'Zımba', ikon: '🔩', iyi: true, acik: 'Kulendeki parçalar yerine çakılır, artık devrilmez.' },
    kalas: { ad: 'Kalas', ikon: '🪵', iyi: true, acik: 'Sıradaki parça uzun, düz bir kalas.' },
    kucuk: { ad: 'Küçük Tuğla', ikon: '🧱', iyi: true, acik: 'Sıradaki 3 parça küçük.' },
    buz: { ad: 'Buz', ikon: '🧊', iyi: false, acik: 'Rakibin sıradaki 3 parçası buz gibi kaygan.' },
    ruzgar: { ad: 'Rüzgâr', ikon: '🌬️', iyi: false, acik: 'Rakibin kulesine 4 saniye sert rüzgâr eser.' },
    dev: { ad: 'Dev Kasa', ikon: '📦', iyi: false, acik: 'Rakibin sıradaki parçası kocaman.' },
    hiz: { ad: 'Hızlı Vinç', ikon: '⚡', iyi: false, acik: 'Rakibin sıradaki 3 parçası çok hızlı iner.' },
  };
  const ALET_LISTE = Object.keys(ALETLER);
  const ALET_HER = 4;           // her 4 parçada bir alet

  // Modlara göre hedefler (uzunluk: 0 kısa, 1 orta, 2 uzun)
  const MOD = {
    yaris: { ad: 'Yarış', ikon: '🏁', hedef: [10, 15, 22], acik: 'Kuleyi bitiş çizgisine ilk ulaştıran kazanır.' },
    hayatta: { ad: 'Hayatta Kalma', ikon: '❤️', hedef: [15, 25, 40], acik: 'Hedef sayıda parçayı yerleştiren kazanır. Düşen her parça 1 can götürür.' },
    bulmaca: { ad: 'Lazer Bulmaca', ikon: '🔴', hedef: [5, 7, 9], acik: 'Lazerin altında kalarak en çok parçayı yerleştiren kazanır. Lazere değen ya da canı biten oyundan çıkar.' },
  };

  function tohumlu(t) {
    let s = (t >>> 0) || 1;
    return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }

  class Kule {
    // ayar: { tohum, mod, uzunluk }
    constructor(ayar) {
      this.mod = ayar.mod; this.uzunluk = ayar.uzunluk ?? 1;
      this.hedef = MOD[this.mod].hedef[this.uzunluk];
      this.rnd = tohumlu(ayar.tohum);
      this.torba = [];
      this.dunya = pl.World({ gravity: V(0, -10) });
      const p = this.dunya.createBody({ type: 'static', position: V(0, -0.5) });
      p.createFixture(pl.Box(PLATFORM / 2, 0.5), { friction: 0.9 });
      this.platform = p;
      this.parcalar = [];
      this.sonId = 0;
      this.aktif = null;
      this.hizli = false;
      this.bekle = 0.8;
      this.yer = 0; this.can = 3; this.elendi = false; this.neden = ''; this.zafer = false; this.durdu = false;
      this.ust = 0; this.sayac = 0;  // yarış: çizgide bekleme / bulmaca: lazerde bekleme
      this.etki = { buz: 0, hiz: 0, kucuk: 0, dev: 0, kalas: 0, ruzgar: 0, ruzYon: 1 };
      this.alet = null; this.aletSay = 0;
      this.birikim = 0;
      this.olay = () => {};
      this._birak = null;
      this.dunya.on('begin-contact', c => this._temas(c));
    }

    _sonraki() {
      if (!this.torba.length) {
        const t = NORMAL.slice();
        for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
        this.torba = t;
      }
      return this.torba.shift();
    }

    _parcaYap() {
      const e = this.etki;
      let tip, olcek = 1, buz = false, hiz = false;
      if (e.kalas > 0) { e.kalas--; tip = 'KALAS'; }
      else if (e.kucuk > 0) { e.kucuk--; tip = Math.random() < 0.5 ? 'K1' : 'K2'; }
      else tip = this._sonraki();
      if (e.dev > 0 && tip !== 'KALAS') { e.dev--; olcek = 1.7; }
      if (e.buz > 0) { e.buz--; buz = true; }
      if (e.hiz > 0) { e.hiz--; hiz = true; }
      const y = Math.max(this.ust, 0) + 9 + (olcek > 1 ? 1.5 : 0);
      const b = this.dunya.createBody({ type: 'dynamic', position: V(0, y), fixedRotation: true, gravityScale: 0, angularDamping: DONME_SONUM, linearDamping: 0.05 });
      SEKIL[tip].forEach(r => b.createFixture(pl.Box(r.w * olcek / 2 * 0.97, r.h * olcek / 2 * 0.97, V(r.x * olcek, r.y * olcek), 0),
        { density: 1, friction: buz ? 0.02 : SURTUNME, restitution: 0 }));
      const parca = { id: ++this.sonId, tip, olcek, buz, hiz, b, durum: 'aktif', sayildi: false };
      b.setUserData(parca);
      this.parcalar.push(parca);
      this.aktif = parca;
      this.hizli = false;
      this.kilitT = 0; this.kilitTop = 0; this.degiyor = false;
      this.olay('yeni', parca);
    }

    _temas(c) {
      const a = c.getFixtureA().getBody(), b = c.getFixtureB().getBody();
      const akt = this.aktif?.b;
      if (akt && (a === akt || b === akt)) return;   // aktif parça: adımdan sonra alttan değiyor mu bakılır
      // çarpma sesi için
      const pa = a.getUserData(), pb = b.getUserData();
      if (pa || pb) {
        const v = Math.max(a.getLinearVelocity().length(), b.getLinearVelocity().length());
        if (v > 1.2) this.olay('carp', v);
      }
    }

    // Aktif parçayı bırak: artık serbest fizik
    _birakUygula(p) {
      if (this.aktif !== p) return;
      const b = p.b;
      b.setGravityScale(1);
      b.setFixedRotation(false);
      const v = b.getLinearVelocity();
      b.setLinearVelocity(V(0, Math.max(v.y, -4)));
      p.durum = 'serbest'; p.sayildi = true;
      this.aktif = null;
      this.yer++;
      this.bekle = 0.45;
      this.olay('koy', p);
      if (++this.aletSay % ALET_HER === 0 && !this.alet) {
        this.alet = ALET_LISTE[Math.floor(Math.random() * ALET_LISTE.length)];
        this.olay('aletGeldi', this.alet);
      }
    }

    // Aktif parça bir şeye ALTINDAN mı değiyor? (yandan sürtünmek bırakmaz)
    _alttanDegiyor(govde) {
      for (let ce = govde.getContactList(); ce; ce = ce.next) {
        const c = ce.contact;
        if (!c.isTouching()) continue;
        const wm = c.getWorldManifold(null);
        if (!wm || !c.getManifold().pointCount) continue;
        // normal A'dan B'ye; aktif A ise aşağı (-y), B ise yukarı (+y) bakmalı
        const ny = c.getFixtureA().getBody() === govde ? -wm.normal.y : wm.normal.y;
        if (ny > 0.35) return true;
      }
      return false;
    }

    // ---- Oyuncu kontrolleri ----
    // Parçanın yeni konumu başka bir parçanın içine giriyor mu?
    _cakisir(x, y, a) {
      const p = this.aktif; if (!p) return true;
      const cos = Math.cos(a), sin = Math.sin(a), s = p.olcek;
      const dw = (lx, ly) => V(x + lx * cos - ly * sin, y + lx * sin + ly * cos);
      for (const r of SEKIL[p.tip]) {
        const cx = r.x * s, cy = r.y * s, hw = r.w * s / 2 - 0.04, hh = r.h * s / 2 - 0.04;
        const noktalar = [];
        for (const fx of [-1, 0, 1]) for (const fy of [-1, 0, 1]) noktalar.push(dw(cx + fx * hw, cy + fy * hh));
        const xs = noktalar.map(n => n.x), ys = noktalar.map(n => n.y);
        const kutu = pl.AABB(V(Math.min(...xs) - 0.05, Math.min(...ys) - 0.05), V(Math.max(...xs) + 0.05, Math.max(...ys) + 0.05));
        let var_ = false;
        this.dunya.queryAABB(kutu, fx => {
          if (fx.getBody() === p.b) return true;
          if (noktalar.some(n => fx.testPoint(n))) { var_ = true; return false; }
          // öbür parçanın köşeleri bu hücrenin içinde mi?
          const sh = fx.getShape(), ob = fx.getBody();
          for (const vv of sh.m_vertices) {
            const w = ob.getWorldPoint(vv);
            const dx = w.x - x, dy = w.y - y;
            const lx = dx * cos + dy * sin - cx, ly = -dx * sin + dy * cos - cy;
            if (Math.abs(lx) < hw && Math.abs(ly) < hh) { var_ = true; return false; }
          }
          return true;
        });
        if (var_) return true;
      }
      return false;
    }
    oynat(dx) {
      const p = this.aktif; if (!p || this.durdu) return false;
      const pos = p.b.getPosition(), a = p.b.getAngle();
      const nx = pos.x + dx * 0.5;
      if (Math.abs(nx) > 9 || this._cakisir(nx, pos.y, a)) { this.olay('takildi'); return false; }
      p.b.setTransform(V(nx, pos.y), a);
      if (this.degiyor) this.kilitT = 0;   // yerdeyken kaydırınca süre baştan
      this.olay('oynat');
      return true;
    }
    dondur() {
      const p = this.aktif; if (!p || this.durdu) return false;
      const pos = p.b.getPosition(), a = p.b.getAngle() + Math.PI / 2;
      if (this._cakisir(pos.x, pos.y, a)) {
        // yana kaydırarak dene
        for (const dx of [0.5, -0.5, 1, -1]) if (!this._cakisir(pos.x + dx, pos.y, a)) { p.b.setTransform(V(pos.x + dx, pos.y), a); this.olay('dondur'); return true; }
        this.olay('takildi'); return false;
      }
      p.b.setTransform(pos, a);
      if (this.degiyor) this.kilitT = 0;
      this.olay('dondur');
      return true;
    }
    hizlandir(acik) { this.hizli = !!acik; }

    // ---- Aletler ----
    aletUygula(ad) {
      const e = this.etki;
      if (ad === 'zimba') {
        this.parcalar.forEach(p => {
          if (p.durum === 'serbest' && p.b.getLinearVelocity().length() < 1 && Math.abs(p.b.getAngularVelocity()) < 1) { p.b.setStatic(); p.durum = 'sabit'; }
        });
      } else if (ad === 'kalas') e.kalas = 1;
      else if (ad === 'kucuk') e.kucuk = 3;
      else if (ad === 'buz') e.buz = 3;
      else if (ad === 'dev') e.dev = 1;
      else if (ad === 'hiz') e.hiz = 3;
      else if (ad === 'ruzgar') { e.ruzgar = 4; e.ruzYon = Math.random() < 0.5 ? -1 : 1; }
      this.olay('etki', ad);
    }

    // ---- Zaman ----
    adim(dt) {
      if (this.durdu) return;
      this.birikim = Math.min(this.birikim + dt, 0.1);
      while (this.birikim >= ADIM) { this.birikim -= ADIM; this._adim(ADIM); }
    }
    _adim(dt) {
      const p = this.aktif;
      if (p) {
        let hiz = (this.hizli ? 13 : 2.1) * (p.hiz ? 2.6 : 1);
        if (this.degiyor) hiz = 0.3;   // yere değmiş, kaydırılıyor: alttakini ezmesin
        // Yumuşak iniş: altında bir şey varsa son anda yavaşla (kuleyi sarsmasın)
        if (hiz > 2.1) {
          const pos = p.b.getPosition(), a = p.b.getAngle();
          if (this._cakisir(pos.x, pos.y - hiz * dt * 4, a)) hiz = 2.1;
        }
        p.b.setLinearVelocity(V(0, -hiz));
        p.b.setAngularVelocity(0);
      }
      if (this.etki.ruzgar > 0) {
        this.etki.ruzgar -= dt;
        this.parcalar.forEach(q => { if (q.durum === 'serbest') { q.b.applyForceToCenter(V(this.etki.ruzYon * q.b.getMass() * 3.2, 0), true); } });
      }
      this.dunya.step(dt, 10, 8);
      // Yere değen parça hemen bırakılmaz: KILIT süresince sağa-sola kaydırılabilir (altlara sokmak için).
      // Hızlı indirme basılıysa hemen bırakılır.
      if (this.aktif) {
        this.degiyor = this._alttanDegiyor(this.aktif.b);
        if (this.degiyor) {
          this.kilitT += dt; this.kilitTop += dt;
          if (this.hizli || this.kilitT >= KILIT || this.kilitTop >= KILIT_EN_FAZLA) { this.degiyor = false; this._birakUygula(this.aktif); }
        } else this.kilitT = 0;
      }

      // Düşenler
      for (const q of this.parcalar.slice()) {
        const y = q.b.getPosition().y;
        if (q === this.aktif && y < -1.5) { this._birakUygula(q); }
        if (y < DUSME_Y) {
          this.dunya.destroyBody(q.b);
          this.parcalar = this.parcalar.filter(z => z !== q);
          if (q.sayildi) this.yer--;
          if (this.mod !== 'yaris') this.can = Math.max(0, this.can - 1);
          this.olay('dustu', q);
          if (this.can <= 0 && !this.elendi) this._ele('Canın bitti');
        }
      }

      // Kulenin tepesi (durgun parçalara göre)
      let ust = 0;
      this.parcalar.forEach(q => {
        if (q.durum === 'aktif') return;
        if (q.durum === 'serbest' && q.b.getLinearVelocity().length() > 0.8) return;
        for (let f = q.b.getFixtureList(); f; f = f.getNext()) { const u = f.getAABB(0).upperBound.y; if (u > ust) ust = u; }
      });
      this.ust = ust;

      // Mod kuralları
      if (this.mod === 'yaris') {
        if (ust >= this.hedef) { this.sayac += dt; if (this.sayac >= 3 && !this.zafer) { this.zafer = true; this.olay('zafer'); } }
        else this.sayac = 0;
      } else if (this.mod === 'hayatta') {
        if (this.yer >= this.hedef && !this.aktif) {
          const sakin = this.parcalar.every(q => q.durum !== 'serbest' || q.b.getLinearVelocity().length() < 0.5);
          this.sayac = sakin ? this.sayac + dt : 0;
          if (this.sayac >= 1 && !this.zafer) { this.zafer = true; this.olay('zafer'); }
        }
      } else if (this.mod === 'bulmaca') {
        if (ust > this.hedef) { this.sayac += dt; if (this.sayac >= 1.2 && !this.elendi) this._ele('Lazere değdi'); }
        else this.sayac = 0;
      }

      // Yeni parça
      const bitti = this.zafer || this.elendi || (this.mod === 'hayatta' && this.yer >= this.hedef);
      if (!this.aktif && !bitti) {
        this.bekle -= dt;
        if (this.bekle <= 0) this._parcaYap();
      }
    }
    _ele(neden) {
      this.elendi = true; this.neden = neden;
      if (this.aktif) { this.aktif.b.setGravityScale(1); this.aktif.b.setFixedRotation(false); this.aktif.durum = 'serbest'; this.aktif = null; }
      this.olay('elendi', neden);
    }

    // Puan (sıralama için)
    puan() {
      if (this.mod === 'yaris') return this.ust;
      return this.yer;
    }

    // Ağdan gönderilecek kısa özet
    ozet() {
      return {
        p: this.parcalar.map(q => {
          const pos = q.b.getPosition();
          return [q.id, TIP_KOD.indexOf(q.tip), Math.round(pos.x * 100), Math.round(pos.y * 100), Math.round(q.b.getAngle() * 1000), Math.round(q.olcek * 10),
            (q.buz ? 1 : 0) | (q.durum === 'sabit' ? 2 : 0) | (q.durum === 'aktif' ? 4 : 0)];
        }),
        ust: Math.round(this.ust * 100) / 100, yer: this.yer, can: this.can, el: this.elendi ? 1 : 0, ne: this.neden, z: this.zafer ? 1 : 0,
        s: Math.round(this.sayac * 10) / 10, al: this.alet, rz: this.etki.ruzgar > 0 ? this.etki.ruzYon : 0,
      };
    }
    // Yerel çizim için aynı biçimde
    parcaListesi() {
      return this.parcalar.map(q => {
        const pos = q.b.getPosition();
        return { id: q.id, tip: q.tip, x: pos.x, y: pos.y, a: q.b.getAngle(), olcek: q.olcek, buz: q.buz, sabit: q.durum === 'sabit', aktif: q.durum === 'aktif' };
      });
    }
  }

  // Ağdan gelen özeti çizilecek listeye çevir
  function ozetCoz(o) {
    return (o?.p || []).map(([id, t, x, y, a, s, f]) => ({ id, tip: TIP_KOD[t], x: x / 100, y: y / 100, a: a / 1000, olcek: s / 10, buz: !!(f & 1), sabit: !!(f & 2), aktif: !!(f & 4) }));
  }

  return { Kule, SEKIL, ALETLER, ALET_LISTE, MOD, PLATFORM, ozetCoz, tohumlu };
})();
