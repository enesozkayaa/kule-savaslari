// =============================================================
// Kule Savaşları - bot oyuncu
// Her yeni parçada bütün dönüş + konumları dener, kuleyi aşağıdan "ışınla" yoklar,
// en düz ve sağlam yeri seçer. Zorluk: tepki hızı + seçimdeki hata payı.
// =============================================================

const Bot = (() => {
  const pl = planck;
  const ZORLUK = {
    kolay: { aralik: 0.32, gurultu: 2.2, hizli: 0.25, ilk: 0.7, dene: 2 },
    orta: { aralik: 0.18, gurultu: 0.7, hizli: 0.6, ilk: 0.45, dene: 5 },
    zor: { aralik: 0.1, gurultu: 0.12, hizli: 0.85, ilk: 0.25, dene: 9 },
  };

  // Dar çukur: yanında en az 1 birim yüksek duvar olan, 2 birimden dar alçak şeritler (oraya parça sığmaz)
  function darCukur(h) {
    const n = h.length, C = 0.25; let ceza = 0, i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && Math.abs(h[j + 1] - h[i]) < 0.3) j++;
      const sol = i > 0 ? h[i - 1] - h[i] : 0, sag = j < n - 1 ? h[j + 1] - h[i] : 0;
      const duvar = Math.max(sol, sag), gen = (j - i + 1) * C;
      if (duvar >= 0.9 && gen < 2) ceza += Math.min(duvar, 3) * (2 - gen);
      i = j + 1;
    }
    return ceza;
  }

  class BotOyuncu {
    constructor(kule, zorluk, aletKullan) {
      this.k = kule; this.z = ZORLUK[zorluk] || ZORLUK.orta;
      this.aletKullan = aletKullan;     // (ad) => void   (oyun.js hedefi seçer)
      this.plan = null; this.t = 0; this.aletT = 0;
    }

    // x noktasında kulenin üst yüzeyi (yoksa null)
    _yuzey(x, haric) {
      let en = null;
      this.k.dunya.rayCast(pl.Vec2(x, 60), pl.Vec2(x, -3), (fx, nokta, normal, oran) => {
        if (fx.getBody() === haric) return -1;
        const ud = fx.getBody().getUserData();
        if (ud && ud.durum === 'serbest' && fx.getBody().getLinearVelocity().length() > 2) return -1;   // hâlâ düşen parça
        en = nokta.y; return oran;
      });
      return en;
    }

    _planla(p) {
      const sekil = Fizik.SEKIL[p.tip], s = p.olcek, k = this.k;
      const mod = k.mod;
      // yüzey ölçümleri bu plan boyunca önbellekte
      const onb = new Map();
      const yuzey = x => { const a = x.toFixed(3); if (!onb.has(a)) onb.set(a, this._yuzey(x, p.b)); return onb.get(a); };
      // platform üstündeki sütunlar (yüzey düzlüğü için)
      const SUT = []; for (let x = -Fizik.PLATFORM / 2 + 0.125; x < Fizik.PLATFORM / 2; x += 0.25) SUT.push(x);
      const taban = SUT.map(x => yuzey(x) ?? 0);
      const adaylar = [];
      for (let r = 0; r < 4; r++) {
        if (r >= 2 && (p.tip === 'O' || p.tip === 'K1')) break;
        if (r >= 1 && p.tip === 'KALAS' && r !== 2) continue;
        // döndürülmüş dikdörtgenler
        const rect = sekil.map(q => {
          let x = q.x * s, y = q.y * s, w = q.w * s, h = q.h * s;
          for (let i = 0; i < r; i++) { [x, y] = [-y, x]; [w, h] = [h, w]; }
          return { x, y, w, h };
        });
        for (let px = -4.5; px <= 4.5; px += 0.5) {
          // her dikdörtgenin altını birkaç noktadan yokla
          const ornek = [];
          rect.forEach(q => {
            // kenarlara yakın + her çeyrek birimde bir yokla (parçalar çeyrek kayık durabilir)
            const n = Math.ceil(q.w / 0.25) + 1;
            for (let i = 0; i < n; i++) {
              const x = px + q.x - q.w / 2 + 0.04 + ((q.w - 0.08) * i) / (n - 1);
              ornek.push({ x, alt: q.y - q.h / 2, yuz: yuzey(x) });
            }
          });
          const destek = ornek.filter(o => o.yuz !== null);
          if (!destek.length) continue;
          const y0 = Math.max(...destek.map(o => o.yuz - o.alt));
          const tepe = y0 + Math.max(...rect.map(q => q.y + q.h / 2));
          let bosluk = 0; const temas = [];
          destek.forEach(o => { const g = y0 + o.alt - o.yuz; bosluk += Math.min(g, 3); if (g < 0.08) temas.push(o.x); });
          const havada = ornek.length - destek.length;
          // ağırlık merkezi destek noktalarının arasında mı?
          let devril = 0;
          if (temas.length) {
            const mn = Math.min(...temas), mx = Math.max(...temas), pay = Math.min(0.3, (mx - mn) / 2);
            if (px < mn + pay) devril = mn + pay - px; else if (px > mx - pay) devril = px - mx + pay;
            if (mx - mn < 0.6) devril += 0.5;   // tek noktaya oturmak tehlikeli
          } else devril = 3;
          const sinir = Fizik.PLATFORM / 2 - 0.05;
          const kenar = ornek.filter(o => Math.abs(o.x) > sinir).length;
          const temasOran = temas.length / ornek.length;
          // yerleştirince yüzey: tümsek, ortalama ve en yüksek
          const yeni = SUT.map((x, i) => {
            let h = taban[i];
            rect.forEach(q => { if (Math.abs(x - (px + q.x)) < q.w / 2) h = Math.max(h, y0 + q.y + q.h / 2); });
            return h;
          });
          let tumsek = 0; for (let i = 1; i < yeni.length; i++) tumsek += Math.abs(yeni[i] - yeni[i - 1]) / 2;
          const ort = yeni.reduce((a, b) => a + b, 0) / yeni.length, enYuk = Math.max(...yeni);
          const cukur = darCukur(yeni);
          let puan = bosluk * 0.5 + havada * 1.2 + kenar * 1.0 + devril * 12 + (1 - temasOran) * 2 + tumsek * 0.45 + cukur * 1.5 + Math.abs(px) * 0.08;
          if (mod === 'yaris') puan += enYuk * 0.2 + ort * 0.2; else puan += ort * 0.9 + enYuk * 0.35;
          if (mod === 'bulmaca' && tepe > k.hedef - 0.2) puan += 40;
          puan += Math.random() * this.z.gurultu;
          adaylar.push({ puan, r, x: px, y: y0 });
        }
      }
      // En iyi birkaç adayı sonra kafasında dener (kule sallanıyor mu?)
      adaylar.sort((a, b) => a.puan - b.puan);
      return adaylar.slice(0, this.z.dene);
    }

    // Küçük bir kopya dünyada parçayı oraya bırakıp 0.8 sn izler; en çok ne kadar kımıldadı?
    _dene(p, a) {
      const V = pl.Vec2, w = pl.World({ gravity: V(0, -10) }), izle = [];
      for (let b = this.k.dunya.getBodyList(); b; b = b.getNext()) {
        if (b === p.b) continue;
        // aşağıda kalan parçalar bu kısa sürede pek kımıldamaz: sabit say (hesap hafiflesin)
        const dinamik = b.isDynamic() && b.getPosition().y > a.y - 7;
        const nb = w.createBody({ type: dinamik ? 'dynamic' : 'static', position: b.getPosition().clone(), angle: b.getAngle(), angularDamping: 0.8, linearDamping: 0.05 });
        for (let f = b.getFixtureList(); f; f = f.getNext()) nb.createFixture(f.getShape(), { density: f.getDensity(), friction: f.getFriction() });
        if (dinamik) { nb.setLinearVelocity(b.getLinearVelocity().clone()); nb.setAngularVelocity(b.getAngularVelocity()); izle.push({ b: nb, x: b.getPosition().x, y: b.getPosition().y, a: b.getAngle() }); }
      }
      const yeni = w.createBody({ type: 'dynamic', position: V(a.x, a.y + 0.03), angle: a.r * Math.PI / 2, angularDamping: 0.8, linearDamping: 0.05 });
      for (let f = p.b.getFixtureList(); f; f = f.getNext()) yeni.createFixture(f.getShape(), { density: f.getDensity(), friction: f.getFriction() });
      yeni.setLinearVelocity(V(0, -2));
      izle.push({ b: yeni, x: a.x, y: a.y, a: a.r * Math.PI / 2, yeni: true });
      for (let i = 0; i < 40; i++) w.step(1 / 50, 8, 5);
      let en = 0;
      izle.forEach(o => {
        const pos = o.b.getPosition();
        let da = o.b.getAngle() - o.a; da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
        const d = Math.hypot(pos.x - o.x, (pos.y - o.y) * (o.yeni ? 0.3 : 1)) + da * 1.2;
        if (d > en) en = d;
      });
      return en;
    }

    adim(dt) {
      const k = this.k;
      if (k.durdu || k.elendi || k.zafer) return;
      // Alet: iyiyse kendine, kötüyse rakibe
      if (k.alet) {
        this.aletT += dt;
        if (this.aletT > 1.5 + Math.random() * 3) { const a = k.alet; k.alet = null; this.aletT = 0; this.aletKullan(a); }
      }
      const p = k.aktif;
      if (!p) { this.plan = null; return; }
      // Düşünme: önce adaylar (1 kare), sonra her karede birkaç deneme (oyunu takmasın)
      if (!this.plan || this.plan.p !== p) {
        this.plan = { p, hazir: false, adaylar: this._planla(p), i: 0, kalanDon: 0, x: p.b.getPosition().x };
        this.t = this.z.ilk;
        return;
      }
      const plan = this.plan;
      if (!plan.hazir) {
        const son = performance.now() + 5;
        while (plan.i < plan.adaylar.length && performance.now() < son) {
          const a = plan.adaylar[plan.i++];
          const h = this._dene(p, a); if (h > 0.06) a.puan += 6 + h * 25;
        }
        if (plan.i >= plan.adaylar.length) {
          const en = plan.adaylar.slice().sort((a, b) => a.puan - b.puan)[0] || { r: 0, x: 0 };
          plan.hazir = true; plan.kalanDon = en.r; plan.x = en.x;
        }
        this.t -= dt;
        return;
      }
      this.t -= dt;
      if (this.t > 0) return;
      this.t = this.z.aralik * (0.7 + Math.random() * 0.6);
      if (plan.kalanDon > 0) { if (k.dondur()) plan.kalanDon--; else plan.kalanDon = 0; return; }
      const x = p.b.getPosition().x;
      if (Math.abs(x - plan.x) > 0.25) { if (!k.oynat(plan.x > x ? 1 : -1)) plan.x = x; return; }
      if (!k.hizli && Math.random() < this.z.hizli) k.hizlandir(true);
    }
  }

  return { BotOyuncu, ZORLUK };
})();
