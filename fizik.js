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
  // Tuzak parçaları: sivri üçgen taş ve yuvarlak varil (w/h = kapladığı kutu)
  SEKIL.UCGEN = [{ x: 0, y: 0, w: 2.2, h: 1.6, ucgen: true }];
  SEKIL.VARIL = [{ x: 0, y: 0, w: 1.5, h: 1.5, daire: true }];
  // Gökdelen modunda havada beliren sabit çıkıntılar (tutunup yükselmek için)
  SEKIL.CIKINTI = [{ x: 0, y: 0, w: 1, h: 1 }];
  SEKIL.CIKINTI2 = [{ x: 0, y: 0, w: 2, h: 0.5 }];
  // Üçgenin köşeleri (ağırlık merkezi 0,0): taban 2.2, yükseklik 1.6
  const UCGEN_KOSE = [[-1.1, -1.6 / 3], [1.1, -1.6 / 3], [0, 3.2 / 3]];
  const TIP_KOD = ['I', 'O', 'T', 'L', 'J', 'S', 'Z', 'K1', 'K2', 'KALAS', 'UCGEN', 'VARIL', 'CIKINTI', 'CIKINTI2'];
  const AG_HER = 5, AG_EN_FAZLA = 3, CIKINTI_HER = 6;   // güvenlik ağı: her parçada 1/5 şans (en fazla 3 hak); çıkıntı her 6 parçada
  const platformGen = mod => (mod === 'tekli' ? 4 : PLATFORM);
  const SARMASIK_N = 2, SARMASIK_BEKLE = 0.35;   // kendisi + en yakın 2 parça = 3 parça

  // Aletler: iyiler kendine, kötüler rakibe
  const ALETLER = {
    zimba: { ad: 'Zımba', ikon: '🔩', iyi: true, acik: 'Kulendeki parçalar yerine çakılır, artık devrilmez.' },
    kalas: { ad: 'Kalas', ikon: '🪵', iyi: true, acik: 'Sıradaki parça uzun, düz bir kalas.' },
    kucuk: { ad: 'Küçük Tuğla', ikon: '🧱', iyi: true, acik: 'Sıradaki parça küçük bir tuğla.' },
    buz: { ad: 'Buz', ikon: '🧊', iyi: false, acik: 'Rakibin sıradaki parçası buz gibi kaygan.' },
    ruzgar: { ad: 'Rüzgâr', ikon: '🌬️', iyi: false, acik: 'Rakibin kulesine 3 saniye sert rüzgâr eser.' },
    dev: { ad: 'Dev Kasa', ikon: '📦', iyi: false, acik: 'Rakibin sıradaki parçası tam 2 kat büyük.' },
    hiz: { ad: 'Hızlı Vinç', ikon: '⚡', iyi: false, acik: 'Rakibin sıradaki parçası çok hızlı iner.' },
    sarmasik: { ad: 'Sarmaşık', ikon: '🌿', iyi: true, acik: 'Sıradaki parçan sarmaşıklı: değdiği en yakın 2 parçaya sarılır, 3ü tek parça gibi birbirini tutar.' },
    ucgen: { ad: 'Sivri Taş', ikon: '🔺', iyi: false, acik: 'Rakibin sıradaki parçası sivri bir üçgen taş: üstü düz değil, koyması zor.' },
    varil: { ad: 'Varil', ikon: '🛢️', iyi: false, acik: 'Rakibin sıradaki parçası yuvarlak bir varil: yuvarlanıp kaçar.' },
    sis: { ad: 'Sis', ikon: '🌫️', iyi: false, acik: 'Rakibin ekranı 5 saniye sisle kaplanır.' },
    ters: { ad: 'Ters Kumanda', ikon: '🔄', iyi: false, acik: 'Rakibin sıradaki parçasında sağ-sol tuşları ters çalışır.' },
    balon: { ad: 'Balon', ikon: '🎈', iyi: false, acik: 'Rakibin sıradaki parçası balon gibi hafif: en ufak şeyde savrulur.' },
    miknatis: { ad: 'Mıknatıs', ikon: '🧲', iyi: true, acik: 'Sıradaki parçan değdiği yere yapışır, kaymaz.' },
    yavas: { ad: 'Yavaş Vinç', ikon: '🐢', iyi: true, acik: 'Sıradaki parçan çok yavaş iner, düşünmeye vakit kalır.' },
    tamir: { ad: 'Tamir', ikon: '🛠️', iyi: true, acik: '1 can geri kazanırsın (Yarış modunda gelmez).' },
  };
  const ALET_LISTE = Object.keys(ALETLER);
  const ALET_HER = 4;           // her 4 parçada bir alet

  // Modlara göre hedefler (uzunluk: 0 kısa, 1 orta, 2 uzun)
  const MOD = {
    yaris: { ad: 'Yarış', ikon: '🏁', hedef: [10, 15, 22], acik: 'Kuleyi bitiş çizgisine ilk ulaştıran kazanır.' },
    hayatta: { ad: 'Hayatta Kalma', ikon: '❤️', hedef: [15, 25, 40], acik: 'Hedef sayıda parçayı yerleştiren kazanır. Düşen her parça 1 can götürür.' },
    bulmaca: { ad: 'Lazer Bulmaca', ikon: '🔴', hedef: [5, 7, 9], acik: 'Lazerin altında kalarak en çok parçayı yerleştiren kazanır. Lazere değen ya da canı biten oyundan çıkar.' },
    tekli: { ad: 'Gökdelen', ikon: '🏙️', hedef: [0, 0, 0], tekli: true, acik: 'Tek başına: dar platformda olabildiğince yüksel. Her 6 parçada havada tutunacak sabit çıkıntılar belirir. 3 can.' },
  };

  function tohumlu(t) {
    let s = (t >>> 0) || 1;
    return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }

  class Kule {
    // ayar: { tohum, mod, uzunluk }
    // ayar.aletler: oyunda açık aletler (bekleme odasında seçilir)
    constructor(ayar) {
      this.mod = ayar.mod; this.uzunluk = ayar.uzunluk ?? 1;
      this.hedef = MOD[this.mod].hedef[this.uzunluk];
      this.rnd = tohumlu(ayar.tohum);
      this.torba = [];
      this.dunya = pl.World({ gravity: V(0, -10) });
      const p = this.dunya.createBody({ type: 'static', position: V(0, -0.5) });
      this.P = platformGen(this.mod);
      p.createFixture(pl.Box(this.P / 2, 0.5), { friction: 0.9 });
      this.platform = p;
      this.parcalar = [];
      this.sonId = 0;
      this.aktif = null;
      this.hizli = false;
      this.bekle = 0.8;
      this.yer = 0; this.can = 3; this.elendi = false; this.neden = ''; this.zafer = false; this.durdu = false;
      this.ust = 0; this.sayac = 0;  // yarış: çizgide bekleme / bulmaca: lazerde bekleme
      this.etki = { buz: 0, hiz: 0, kucuk: 0, dev: 0, kalas: 0, ruzgar: 0, ruzYon: 1, ucgen: 0, varil: 0, sarmasik: 0, ters: 0, balon: 0, miknatis: 0, yavas: 0 };
      this.aletListe = (Array.isArray(ayar.aletler) ? ayar.aletler : ALET_LISTE).filter(a => ALETLER[a] && !(a === 'tamir' && this.mod === 'yaris') && !(this.mod === 'tekli' && !ALETLER[a].iyi));
      // Güvenlik ağı: her parçada şansa 1 hak gelebilir; parça düşerse hak harcanır, can gitmez
      this.agAcik = !!ayar.ag && this.mod !== 'yaris'; this.ag = 0;
      this.koyulan = 0; this.enYuksek = 0;
      this.alet = null; this.aletSay = 0;
      this.birikim = 0;
      this.olay = () => {};
      this._birak = null;
      this.dunya.on('begin-contact', c => this._temas(c));
    }

    _torbaDoldur() {
      if (!this.torba.length) {
        const t = NORMAL.slice();
        for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
        this.torba = t;
      }
    }
    _sonraki() { this._torbaDoldur(); return this.torba.shift(); }
    // Sıradaki parça ne olacak? (önizleme için; hiçbir şeyi değiştirmez, küçük tuğla seçimi önceden yapılır)
    siradaki() {
      const e = this.etki;
      let tip;
      if (e.ucgen > 0) tip = 'UCGEN';
      else if (e.varil > 0) tip = 'VARIL';
      else if (e.kalas > 0) tip = 'KALAS';
      else if (e.kucuk > 0) tip = this._kucukTip || (this._kucukTip = Math.random() < 0.5 ? 'K1' : 'K2');
      else { this._torbaDoldur(); tip = this.torba[0]; }
      return { tip, dev: e.dev > 0 && tip !== 'KALAS', buz: e.buz > 0, balon: e.balon > 0, sarmasik: e.sarmasik > 0, miknatis: e.miknatis > 0 };
    }

    _parcaYap() {
      const e = this.etki;
      let tip, olcek = 1, buz = false, hiz = false, sarmasik = false;
      if (e.ucgen > 0) { e.ucgen--; tip = 'UCGEN'; }
      else if (e.varil > 0) { e.varil--; tip = 'VARIL'; }
      else if (e.kalas > 0) { e.kalas--; tip = 'KALAS'; }
      else if (e.kucuk > 0) { e.kucuk--; tip = this._kucukTip || (Math.random() < 0.5 ? 'K1' : 'K2'); this._kucukTip = null; }
      else tip = this._sonraki();
      if (e.dev > 0 && tip !== 'KALAS') { e.dev--; olcek = 2; }   // tam 2 kat: hücreler ızgaraya oturur, yan yana boşluksuz
      if (e.buz > 0) { e.buz--; buz = true; }
      if (e.hiz > 0) { e.hiz--; hiz = true; }
      if (e.sarmasik > 0) { e.sarmasik--; sarmasik = true; }
      let ters = false, balon = false, miknatis = false, yavas = false;
      if (e.ters > 0) { e.ters--; ters = true; }
      if (e.balon > 0) { e.balon--; balon = true; }
      if (e.miknatis > 0) { e.miknatis--; miknatis = true; }
      if (e.yavas > 0) { e.yavas--; yavas = true; }
      const y = Math.max(this.ust, 0) + 9 + (olcek > 1 ? 1.5 : 0);
      const b = this.dunya.createBody({ type: 'dynamic', position: V(0, y), fixedRotation: true, gravityScale: 0, angularDamping: DONME_SONUM, linearDamping: 0.05 });
      const ozellik = { density: balon ? 0.12 : 1, friction: buz ? 0.02 : miknatis ? 2.5 : SURTUNME, restitution: 0 };
      SEKIL[tip].forEach(r => {
        let sekil;
        if (r.ucgen) sekil = pl.Polygon(UCGEN_KOSE.map(([x, y]) => V(x * olcek * 0.97, y * olcek * 0.97)));
        else if (r.daire) sekil = pl.Circle(V(0, 0), (r.w / 2) * olcek * 0.97);
        else sekil = pl.Box(r.w * olcek / 2 * 0.97, r.h * olcek / 2 * 0.97, V(r.x * olcek, r.y * olcek), 0);
        b.createFixture(sekil, { ...ozellik, friction: r.daire && !buz ? 0.6 : ozellik.friction });
      });
      const parca = { id: ++this.sonId, tip, olcek, buz, hiz, sarmasik, ters, balon, miknatis, yavas, b, durum: 'aktif', sayildi: false };
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
      if (p.balon) { b.setGravityScale(0.45); b.setLinearDamping(0.5); }   // balon: hafif, süzülür
      this.aktif = null;
      this.yer++;
      this.bekle = 0.45;
      if (p.sarmasik) { p.sarT = SARMASIK_BEKLE; p.sarDene = 1.5; }   // biraz otursun, sonra sarılsın
      if (p.miknatis) { p.mikT = 0.15; }                               // mıknatıs: değdiği yere hemen yapışır
      this.olay('koy', p);
      this.koyulan++;
      if (this.agAcik && this.ag < AG_EN_FAZLA && Math.random() < 1 / AG_HER) { this.ag++; this.olay('agGeldi', this.ag); }   // şansa: ortalama 5 parçada 1
      if (this.mod === 'tekli' && this.koyulan % CIKINTI_HER === 0) this._cikintiEkle();
      if (++this.aletSay % ALET_HER === 0 && !this.alet) {
        if (!this.aletListe.length) return;
        this.alet = this.aletListe[Math.floor(Math.random() * this.aletListe.length)];
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
          if (!sh.m_vertices) {
            // daire (varil): merkezin hücreye en yakın noktasına uzaklığı yarıçaptan küçük mü?
            const m = ob.getWorldPoint(sh.m_p), dx = m.x - x, dy = m.y - y;
            const lx = dx * cos + dy * sin - cx, ly = -dx * sin + dy * cos - cy;
            const ex = Math.max(Math.abs(lx) - hw, 0), ey = Math.max(Math.abs(ly) - hh, 0);
            if (ex * ex + ey * ey < (sh.m_radius - 0.03) ** 2) { var_ = true; return false; }
            return true;
          }
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
      if (p.ters) dx = -dx;   // ters kumanda
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
      else if (ad === 'kucuk') e.kucuk = 1;
      else if (ad === 'buz') e.buz = 1;
      else if (ad === 'dev') e.dev = 1;
      else if (ad === 'hiz') e.hiz = 1;
      else if (ad === 'ruzgar') { e.ruzgar = 3; e.ruzYon = Math.random() < 0.5 ? -1 : 1; }
      else if (ad === 'sarmasik') e.sarmasik = 1;
      else if (ad === 'ucgen') e.ucgen = 1;
      else if (ad === 'varil') e.varil = 1;
      else if (ad === 'ters') e.ters = 1;
      else if (ad === 'balon') e.balon = 1;
      else if (ad === 'miknatis') e.miknatis = 1;
      else if (ad === 'yavas') e.yavas = 1;
      else if (ad === 'tamir') this.can = Math.min(3, this.can + 1);
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
        let hiz = (this.hizli ? 13 : p.yavas ? 0.9 : 2.1) * (p.hiz ? 2.6 : 1);
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

      // Sarmaşık: yerleşen sarmaşıklı parça, değdiği en yakın 2 parçaya kaynak gibi bağlanır (3ü tek parça olur)
      this.parcalar.forEach(q => {
        if (q.sarT === undefined || q.sarT === null) return;
        q.sarT -= dt; q.sarDene -= dt;
        if (q.sarT > 0) return;
        const komsu = [];
        for (let ce = q.b.getContactList(); ce; ce = ce.next) {
          if (!ce.contact.isTouching()) continue;
          const o = ce.other.getUserData();
          if (o && o !== q && o.durum !== 'aktif' && !komsu.includes(o)) komsu.push(o);
        }
        if (!komsu.length && q.sarDene > 0) return;   // henüz bir şeye oturmadı, biraz daha bekle
        const qp = q.b.getPosition(), uzak = o => { const p = o.b.getPosition(); return Math.hypot(p.x - qp.x, p.y - qp.y); };
        komsu.sort((a, b) => uzak(a) - uzak(b));
        komsu.slice(0, SARMASIK_N).forEach(o => {
          const a = q.b.getPosition(), b = o.b.getPosition();
          this.dunya.createJoint(pl.WeldJoint({}, q.b, o.b, V((a.x + b.x) / 2, (a.y + b.y) / 2)));
          o.sarili = true;
        });
        q.sarili = true; q.sarT = null;
        this.olay('sarildi', Math.min(komsu.length, SARMASIK_N));
      });

      // Mıknatıs: oturduğu parçaya / platforma kaynaklanır (en fazla 2 yere)
      this.parcalar.forEach(q => {
        if (q.mikT === undefined || q.mikT === null) return;
        q.mikT -= dt;
        if (q.mikT > 0) return;
        let n = 0;
        for (let ce = q.b.getContactList(); ce && n < 2; ce = ce.next) {
          if (!ce.contact.isTouching()) continue;
          const o = ce.other, ud = o.getUserData();
          if (ud && ud.durum === 'aktif') continue;
          const a = q.b.getPosition(), b2 = o.getPosition();
          this.dunya.createJoint(pl.WeldJoint({}, q.b, o, V((a.x + b2.x) / 2, (a.y + b2.y) / 2)));
          n++;
        }
        q.mikT = null;
      });

      // Düşenler
      for (const q of this.parcalar.slice()) {
        const y = q.b.getPosition().y;
        if (q === this.aktif && y < -1.5) { this._birakUygula(q); }
        // ağ varsa düşen parça platformun hemen altında yakalanıp yok olur
        if (y < (this.ag > 0 ? -2.5 : DUSME_Y) && q.durum !== 'cikinti') {
          this.dunya.destroyBody(q.b);
          this.parcalar = this.parcalar.filter(z => z !== q);
          if (q.sayildi) this.yer--;
          if (this.ag > 0) { this.ag--; this.olay('agKurtardi', q); continue; }
          if (this.mod !== 'yaris') this.can = Math.max(0, this.can - 1);
          this.olay('dustu', q);
          if (this.can <= 0 && !this.elendi) this._ele('Canın bitti');
        }
      }

      // Kulenin tepesi (durgun parçalara göre)
      let ust = 0;
      this.parcalar.forEach(q => {
        if (q.durum === 'aktif' || q.durum === 'cikinti') return;
        if (q.durum === 'serbest' && q.b.getLinearVelocity().length() > 0.8) return;
        for (let f = q.b.getFixtureList(); f; f = f.getNext()) { const u = f.getAABB(0).upperBound.y; if (u > ust) ust = u; }
      });
      this.ust = ust;
      if (ust > this.enYuksek) this.enYuksek = ust;

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
    // Gökdelen: kulenin yanında (ona değmeden) ya da üstünde havada sabit bir çıkıntı
    _cikintiEkle() {
      const tip = Math.random() < 0.5 ? 'CIKINTI' : 'CIKINTI2';
      const r = SEKIL[tip][0];
      // kulenin şu anki genişliği
      let mn = -this.P / 2, mx = this.P / 2;
      this.parcalar.forEach(q => {
        if (q.durum === 'aktif' || q.durum === 'cikinti') return;
        for (let f = q.b.getFixtureList(); f; f = f.getNext()) { const a = f.getAABB(0); if (a.upperBound.y > this.ust - 4) { mn = Math.min(mn, a.lowerBound.x); mx = Math.max(mx, a.upperBound.x); } }
      });
      const yar = v => Math.round(v * 2) / 2;
      const adaylar = [];
      const y = Math.max(this.ust, 0) + 1 + Math.random() * 2;
      [-1, 1].forEach(yon => {
        const kenar = yon < 0 ? mn : mx;
        const x = yar(kenar + yon * (1 + r.w / 2 + Math.random() * 1.2));
        if (Math.abs(x) + r.w / 2 <= 4.8) adaylar.push({ x, y });
      });
      if (Math.random() < 0.3) adaylar.push({ x: yar((Math.random() - 0.5) * 2), y: Math.max(this.ust, 0) + 3.5 });   // bazen tam ortada, kulenin üstünde
      // bir parçaya değiyorsa olmaz
      const bos = a => {
        let dolu = false;
        const kutu = pl.AABB(V(a.x - r.w / 2 - 0.4, a.y - r.h / 2 - 0.4), V(a.x + r.w / 2 + 0.4, a.y + r.h / 2 + 0.4));
        this.dunya.queryAABB(kutu, () => { dolu = true; return false; });
        return !dolu;
      };
      const uygun = adaylar.filter(bos);
      if (!uygun.length) return;
      const a = uygun[Math.floor(Math.random() * uygun.length)];
      const b = this.dunya.createBody({ type: 'static', position: V(a.x, yar(a.y)) });
      b.createFixture(pl.Box(r.w / 2 * 0.97, r.h / 2 * 0.97), { friction: SURTUNME });
      const parca = { id: ++this.sonId, tip, olcek: 1, b, durum: 'cikinti', sayildi: false };
      b.setUserData(parca);
      this.parcalar.push(parca);
      this.olay('cikinti', parca);
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
            (q.buz ? 1 : 0) | (q.durum === 'sabit' ? 2 : 0) | (q.durum === 'aktif' ? 4 : 0) | (q.sarmasik || q.sarili ? 8 : 0) | (q.miknatis ? 16 : 0) | (q.balon ? 32 : 0)];
        }),
        ust: Math.round(this.ust * 100) / 100, yer: this.yer, can: this.can, el: this.elendi ? 1 : 0, ne: this.neden, z: this.zafer ? 1 : 0,
        s: Math.round(this.sayac * 10) / 10, al: this.alet, rz: this.etki.ruzgar > 0 ? this.etki.ruzYon : 0, ag: this.ag, ey: Math.round(this.enYuksek * 100) / 100,
      };
    }
    // Yerel çizim için aynı biçimde
    parcaListesi() {
      return this.parcalar.map(q => {
        const pos = q.b.getPosition();
        return { id: q.id, tip: q.tip, x: pos.x, y: pos.y, a: q.b.getAngle(), olcek: q.olcek, buz: q.buz, sabit: q.durum === 'sabit', aktif: q.durum === 'aktif', sarmasik: !!(q.sarmasik || q.sarili), miknatis: !!q.miknatis, balon: !!q.balon };
      });
    }
  }

  // Ağdan gelen özeti çizilecek listeye çevir
  function ozetCoz(o) {
    return (o?.p || []).map(([id, t, x, y, a, s, f]) => ({ id, tip: TIP_KOD[t], x: x / 100, y: y / 100, a: a / 1000, olcek: s / 10, buz: !!(f & 1), sabit: !!(f & 2), aktif: !!(f & 4), sarmasik: !!(f & 8), miknatis: !!(f & 16), balon: !!(f & 32) }));
  }

  return { Kule, SEKIL, ALETLER, ALET_LISTE, MOD, PLATFORM, platformGen, UCGEN_KOSE, ozetCoz, tohumlu };
})();
