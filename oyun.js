// =============================================================
// Kule Savaşları - oyun akışı: giriş, bekleme odası, oyun, sonuç
// Herkes KENDİ kulesini kendi cihazında oynatır ve 10 kez/sn özetini yollar.
// Oda sahibi (ev) botları oynatır, aletleri dağıtır, oyunun bitişine karar verir.
// "Botlarla oyna" internetsiz: her şey bu cihazda.
// =============================================================

(() => {
  const $ = s => document.querySelector(s);
  const ekranlar = ['#giris', '#lobi', '#oyun', '#sonuc'];
  const goster = (...idler) => ekranlar.forEach(s => { $(s).hidden = !idler.includes(s); });
  const BOT_AD = [['Kunduz', '🦫'], ['Ayı', '🐻'], ['Tilki', '🦊'], ['Baykuş', '🦉'], ['Rakun', '🦝']];
  const UZUNLUK = ['Kısa', 'Orta', 'Uzun'];
  const ZORLUK = [['kolay', 'Kolay'], ['orta', 'Orta'], ['zor', 'Zor']];

  const D = {
    ad: '', yerel: false,
    lobi: { mod: 'yaris', uzunluk: 1, zorluk: 'orta', botlar: [] },
    oyun: null,
  };
  try { D.ad = localStorage.getItem('ks.ad') || ''; } catch (e) { }

  const benimId = () => (D.yerel ? 'ben' : Ag.benimId);
  const evMi = () => D.yerel || Ag.evMi;
  const insanlar = () => (D.yerel ? [{ id: 'ben', ad: D.ad }] : Ag.oyuncular);
  const tumOyuncular = () => [...insanlar().map(o => ({ id: o.id, ad: o.ad, ses: o.ses })), ...D.lobi.botlar.map(b => ({ ...b, bot: true }))];

  // ---------- Mesaj yolları ----------
  function eveGonder(m) { if (D.yerel) evIsle(m, 'ben'); else Ag.eveGonder(m); }
  function yay(m) { if (D.yerel) mesajIsle(m); else Ag.yayinla(m); }

  // Ev: misafirlerden gelenler
  function evIsle(m, kimden) {
    if (m.tip === 'durum') {
      if (!D.oyun) return;
      D.oyun.uzak.set(kimden, m.d);
      if (!D.yerel) Ag.herkese({ tip: 'durum', id: kimden, d: m.d });
    } else if (m.tip === 'alet') {
      if (!D.oyun || D.oyun.bitti) return;
      const ad = Fizik.ALETLER[m.ad] ? m.ad : null; if (!ad) return;
      const hedef = Fizik.ALETLER[ad].iyi ? kimden : (m.hedef && D.oyun.oyuncular.some(o => o.id === m.hedef) ? m.hedef : lider(kimden));
      if (!hedef) return;
      yay({ tip: 'alet', ad, kimden, hedef });
    }
  }
  // Herkes: evden gelenler
  function mesajIsle(m) {
    if (m.tip === 'lobi') { D.lobi = m.lobi; lobiCiz(); }
    else if (m.tip === 'basla') oyunBaslat(m);
    else if (m.tip === 'durum') { if (D.oyun && m.id !== benimId()) D.oyun.uzak.set(m.id, m.d); }
    else if (m.tip === 'alet') aletGeldi(m);
    else if (m.tip === 'bitti') oyunBitti(m);
    else if (m.tip === 'lobiyeDon') { oyunKapat(); goster('#lobi'); lobiCiz(); }
    else if (m.tip === 'ayrildi') { if (D.oyun) duyuru(`🚪 ${m.ad} oyundan ayrıldı`); }
  }

  // ---------- Giriş ----------
  $('#adim').value = D.ad;
  const adAl = () => {
    const ad = $('#adim').value.trim().slice(0, 14);
    if (!ad) { $('#girisDurum').textContent = 'Önce adını yaz.'; $('#adim').focus(); return null; }
    D.ad = ad; try { localStorage.setItem('ks.ad', ad); } catch (e) { }
    Ses.ac();
    return ad;
  };
  $('#odaKurBtn').onclick = () => {
    const ad = adAl(); if (!ad) return;
    D.yerel = false; D.lobi.botlar = [];
    $('#girisDurum').textContent = 'Oda açılıyor…';
    Ag.odaAc(ad);
  };
  $('#katilBtn').onclick = () => {
    const ad = adAl(); if (!ad) return;
    const kod = $('#odaKoduGir').value.trim();
    if (kod.length < 5) { $('#girisDurum').textContent = '5 harfli oda kodunu yaz.'; return; }
    D.yerel = false;
    $('#girisDurum').textContent = 'Bağlanılıyor…';
    Ag.katil(kod, ad);
  };
  $('#odaKoduGir').addEventListener('keydown', e => { if (e.key === 'Enter') $('#katilBtn').click(); });
  $('#botlaBtn').onclick = () => {
    const ad = adAl(); if (!ad) return;
    Ag.kapat();
    D.yerel = true;
    D.lobi = { ...D.lobi, botlar: [] };
    botEkle();
    $('#girisDurum').textContent = '';
    goster('#lobi'); lobiCiz();
  };

  Ag.on('oda', ({ ev }) => {
    $('#girisDurum').textContent = '';
    goster('#lobi');
    if (ev) yay({ tip: 'lobi', lobi: D.lobi });
    lobiCiz();
  });
  Ag.on('hata', t => { $('#girisDurum').textContent = t; goster('#giris'); });
  Ag.on('oyuncular', () => { lobiCiz(); });
  Ag.on('katildi', () => { if (Ag.evMi) yay({ tip: 'lobi', lobi: D.lobi }); });
  Ag.on('evMesaj', (m, kimden) => evIsle(m, kimden));
  Ag.on('mesaj', m => mesajIsle(m));
  Ag.on('evKoptu', () => { oyunKapat(); goster('#giris'); $('#girisDurum').textContent = 'Oda sahibiyle bağlantı koptu.'; });
  Ag.on('koptu', o => {
    if (!Ag.evMi) return;
    if (D.oyun && !D.oyun.bitti) { const d = D.oyun.uzak.get(o.id) || {}; D.oyun.uzak.set(o.id, { ...d, el: 1, ne: 'Ayrıldı' }); yay({ tip: 'ayrildi', ad: o.ad }); }
    yay({ tip: 'lobi', lobi: D.lobi });
  });
  Ag.kabulKurali(n => {
    if (D.oyun && !D.oyun.bitti) return 'Oyun sürüyor, bitince tekrar dene.';
    if (n + D.lobi.botlar.length >= 4) return 'Oda dolu (en fazla 4 kişi).';
    return true;
  });

  // ---------- Bekleme odası ----------
  function botEkle() {
    if (tumOyuncular().length >= 4) return;
    const kullanilan = new Set(D.lobi.botlar.map(b => b.ad));
    const [ad, ikon] = BOT_AD.find(([a]) => !kullanilan.has(a)) || BOT_AD[0];
    D.lobi.botlar.push({ id: 'bot-' + Math.random().toString(36).slice(2, 7), ad, ikon });
  }
  function lobiDegisti() { if (D.yerel) lobiCiz(); else yay({ tip: 'lobi', lobi: D.lobi }); }

  function lobiCiz() {
    const ev = evMi();
    $('#odaBilgi').hidden = D.yerel;
    $('#odaKodu').textContent = Ag.kod || '-----';
    $('#lobiSesBtn').hidden = D.yerel;
    $('#lobiAciklama').textContent = D.yerel
      ? 'İnternetsiz oyun: sadece sen ve botlar. Bot ekleyip çıkarabilirsin.'
      : 'Kodu arkadaşlarına söyle, "Katıl" kısmına yazsınlar. Boş yerlere bot ekleyebilirsin (en fazla 4 oyuncu).';
    const liste = $('#oyuncuListe'); liste.innerHTML = '';
    tumOyuncular().forEach(o => {
      const li = document.createElement('li');
      const ben = o.id === benimId();
      li.innerHTML = `<span class="ikon">${o.bot ? o.ikon : '👷'}</span><span class="ad">${esc(o.ad)}${ben ? ' <small>(sen)</small>' : ''}</span>`
        + (o.bot ? '<span class="etiket">BOT</span>' : (o.ses ? '<span class="etiket yesil">🎤</span>' : ''));
      if (o.bot && ev) {
        const b = document.createElement('button'); b.className = 'kucuk'; b.textContent = '✖'; b.title = 'Botu çıkar';
        b.onclick = () => { D.lobi.botlar = D.lobi.botlar.filter(x => x.id !== o.id); lobiDegisti(); };
        li.appendChild(b);
      }
      liste.appendChild(li);
    });
    $('#botEkleBtn').hidden = !ev; $('#botEkleBtn').disabled = tumOyuncular().length >= 4;
    // ayarlar
    const sec = (kap, secenekler, deger, fn) => {
      kap.innerHTML = '';
      secenekler.forEach(([d, yazi]) => {
        const b = document.createElement('button'); b.innerHTML = yazi; b.className = d === deger ? 'secili' : '';
        b.disabled = !ev; b.onclick = () => fn(d); kap.appendChild(b);
      });
    };
    sec($('#modSec'), Object.entries(Fizik.MOD).map(([k, m]) => [k, `${m.ikon} ${m.ad}`]), D.lobi.mod, d => { D.lobi.mod = d; lobiDegisti(); });
    sec($('#uzunlukSec'), UZUNLUK.map((u, i) => [i, u]), D.lobi.uzunluk, d => { D.lobi.uzunluk = d; lobiDegisti(); });
    sec($('#zorlukSec'), ZORLUK, D.lobi.zorluk, d => { D.lobi.zorluk = d; lobiDegisti(); });
    $('#zorlukSatir').hidden = !D.lobi.botlar.length;
    const m = Fizik.MOD[D.lobi.mod], h = m.hedef[D.lobi.uzunluk];
    $('#modAciklama').textContent = `${m.acik} ${D.lobi.mod === 'yaris' ? `(Bitiş: ${h} m)` : D.lobi.mod === 'hayatta' ? `(Hedef: ${h} parça, 3 can)` : `(Lazer: ${h} m, 3 can)`}`;
    $('#baslatBtn').hidden = !ev;
    $('#lobiDurum').textContent = ev ? (tumOyuncular().length < 2 ? 'Tek başına da başlatabilirsin (antrenman).' : '') : 'Oda sahibinin başlatması bekleniyor…';
    sesDugme();
  }
  $('#botEkleBtn').onclick = () => { botEkle(); lobiDegisti(); };
  $('#cikBtn').onclick = () => { Ag.kapat(); D.yerel = false; goster('#giris'); };
  $('#baslatBtn').onclick = () => {
    if (!evMi()) return;
    Ses.ac();
    yay({ tip: 'basla', tohum: Math.floor(Math.random() * 1e9), mod: D.lobi.mod, uzunluk: D.lobi.uzunluk, zorluk: D.lobi.zorluk, oyuncular: tumOyuncular().map(({ id, ad, bot, ikon }) => ({ id, ad, bot: !!bot, ikon })) });
  };

  // Mikrofon
  async function sesTikla() {
    if (Ag.sesAcik) Ag.sesKapat();
    else if (!(await Ag.sesAc())) { duyuru('🎤 Mikrofona izin verilmedi'); }
    sesDugme();
  }
  function sesDugme() {
    [$('#lobiSesBtn'), $('#oyunSesBtn')].forEach(b => { b.classList.toggle('acik', Ag.sesAcik); });
    $('#lobiSesBtn').textContent = Ag.sesAcik ? '🎤 Mikrofon açık' : '🎤 Mikrofonu aç';
    $('#oyunSesBtn').textContent = Ag.sesAcik ? '🎤' : '🔇🎤';
    $('#oyunSesBtn').hidden = D.yerel;
  }
  $('#lobiSesBtn').onclick = sesTikla;
  $('#oyunSesBtn').onclick = sesTikla;
  const efektDugme = () => { $('#efektBtn').textContent = Ses.acikMi() ? '🔊' : '🔈'; $('#efektBtn').classList.toggle('kapali', !Ses.acikMi()); };
  $('#efektBtn').onclick = () => { Ses.ayarla(!Ses.acikMi()); efektDugme(); };
  efektDugme();

  // ---------- Oyun ----------
  function oyunBaslat(m) {
    oyunKapat();
    const ben = benimId();
    const O = D.oyun = {
      mod: m.mod, uzunluk: m.uzunluk, tohum: m.tohum, oyuncular: m.oyuncular,
      hedef: Fizik.MOD[m.mod].hedef[m.uzunluk],
      benIdx: m.oyuncular.findIndex(o => o.id === ben),
      kuleler: new Map(), botlar: new Map(), uzak: new Map(),
      basT: performance.now() + 3200, basladi: false, bitti: false, gondermeT: 0, kontrolT: 0, sonSayac: 4,
    };
    const yeniKule = () => new Fizik.Kule({ tohum: m.tohum, mod: m.mod, uzunluk: m.uzunluk });
    if (O.benIdx >= 0) {
      const k = yeniKule(); k.olay = (t, v) => benimOlay(t, v); O.kuleler.set(ben, k);
    }
    if (evMi()) m.oyuncular.filter(o => o.bot).forEach(o => {
      const k = yeniKule(); O.kuleler.set(o.id, k);
      O.botlar.set(o.id, new Bot.BotOyuncu(k, m.zorluk, ad => botAlet(o.id, ad)));
    });
    Sahne.oyunKur(m.oyuncular.length, m.mod, O.hedef);
    etiketleriKur();
    goster('#oyun');
    $('#aletBtn').hidden = true;
    $('#kontrolIpucu').hidden = matchMedia('(pointer: coarse)').matches;
    sesDugme(); efektDugme();
  }
  function oyunKapat() {
    if (!D.oyun) return;
    D.oyun.bitti = true;
    D.oyun = null;
    Sahne.temizle();
    $('#etiketler').innerHTML = '';
    $('#sonuc').hidden = true;
  }

  // Benim kulemden gelen olaylar → ses + yazı
  function benimOlay(t, v) {
    if (t === 'oynat') Ses.oynat();
    else if (t === 'dondur') Ses.dondur();
    else if (t === 'takildi') Ses.takildi();
    else if (t === 'koy') Ses.koy();
    else if (t === 'carp') Ses.carp(v);
    else if (t === 'dustu') { Ses.dustu(); duyuru(D.oyun?.mod === 'yaris' ? '💥 Parça düştü!' : '💥 Parça düştü! −1 ❤️'); }
    else if (t === 'aletGeldi') { Ses.aletGeldi(); const a = Fizik.ALETLER[v]; duyuru(`${a.ikon} Yeni alet: <b>${a.ad}</b> — ${a.iyi ? 'kendine' : 'rakibe'}`); }
    else if (t === 'elendi') { Ses.kaybet(); duyuru(`❌ ${v}!`); }
    else if (t === 'zafer') { /* ev karar verir */ }
  }

  // Lider: kendisi hariç, oyunda kalan en iyi rakip
  function durumAl(id) {
    const O = D.oyun; if (!O) return null;
    const k = O.kuleler.get(id);
    if (k) return { ust: k.ust, yer: k.yer, can: k.can, el: k.elendi ? 1 : 0, ne: k.neden, z: k.zafer ? 1 : 0, s: k.sayac, al: k.alet };
    return O.uzak.get(id) || null;
  }
  const puan = (d, mod) => (!d ? 0 : mod === 'yaris' ? d.ust : d.yer);
  function lider(haric) {
    const O = D.oyun; if (!O) return null;
    const aday = O.oyuncular.filter(o => o.id !== haric).map(o => ({ o, d: durumAl(o.id) })).filter(x => x.d && !x.d.el && !x.d.z);
    if (!aday.length) return null;
    aday.sort((a, b) => puan(b.d, O.mod) - puan(a.d, O.mod) || Math.random() - 0.5);
    return aday[0].o.id;
  }

  // Botun aleti: ev, bot adına yayınlar
  function botAlet(kimden, ad) {
    const hedef = Fizik.ALETLER[ad].iyi ? kimden : lider(kimden);
    if (hedef) yay({ tip: 'alet', ad, kimden, hedef });
  }
  function aletGeldi(m) {
    const O = D.oyun; if (!O) return;
    const a = Fizik.ALETLER[m.ad];
    const ad = id => (id === benimId() ? 'Sen' : esc(O.oyuncular.find(o => o.id === id)?.ad || '?'));
    const k = O.kuleler.get(m.hedef);
    if (k) k.aletUygula(m.ad);
    if (m.hedef === benimId() || m.kimden === benimId()) {
      ({ zimba: Ses.zimba, kalas: Ses.aletKullan, kucuk: Ses.aletKullan, buz: Ses.buz, ruzgar: () => Ses.ruzgar(4), dev: Ses.dev, hiz: Ses.hiz })[m.ad]?.();
    }
    if (a.iyi) duyuru(`${a.ikon} ${ad(m.kimden)}: <b>${a.ad}</b>`);
    else duyuru(`${a.ikon} ${ad(m.kimden)} → ${m.hedef === benimId() ? '<b>SANA</b>' : ad(m.hedef)}: <b>${a.ad}</b>!`, m.hedef === benimId());
  }
  // Benim aletim
  function benimAletim() {
    const O = D.oyun; if (!O || !O.basladi || O.bitti) return;
    const k = O.kuleler.get(benimId()); if (!k || !k.alet || k.elendi) return;
    const ad = k.alet; k.alet = null;
    Ses.aletKullan();
    eveGonder({ tip: 'alet', ad });
  }
  $('#aletBtn').onclick = benimAletim;

  // Ev: oyun bitti mi?
  function bitisKontrol() {
    const O = D.oyun; if (!O || O.bitti || !O.basladi) return;
    const durumlar = O.oyuncular.map(o => ({ o, d: durumAl(o.id) || { ust: 0, yer: 0, el: 0, z: 0 } }));
    let kazanan = durumlar.find(x => x.d.z)?.o.id || null;
    const kalan = durumlar.filter(x => !x.d.el && !x.d.z);
    let bitti = !!kazanan;
    if (!bitti && O.mod !== 'yaris') {
      const enIyi = arr => arr.slice().sort((a, b) => puan(b.d, O.mod) - puan(a.d, O.mod))[0];
      if (kalan.length === 0) { bitti = true; kazanan = durumlar.length > 1 ? enIyi(durumlar).o.id : null; }
      else if (O.mod === 'hayatta' && durumlar.length > 1 && kalan.length === 1) { bitti = true; kazanan = kalan[0].o.id; }
      else if (O.mod === 'bulmaca' && durumlar.length > 1 && kalan.length === 1) {
        const digerEn = Math.max(...durumlar.filter(x => x !== kalan[0]).map(x => x.d.yer));
        if (kalan[0].d.yer > digerEn) { bitti = true; kazanan = kalan[0].o.id; }
      }
    }
    if (!bitti) return;
    const sira = durumlar.slice().sort((a, b) => (b.o.id === kazanan) - (a.o.id === kazanan) || (a.d.el - b.d.el) || puan(b.d, O.mod) - puan(a.d, O.mod))
      .map(x => ({ id: x.o.id, ad: x.o.ad, bot: x.o.bot, ikon: x.o.ikon, ust: x.d.ust, yer: x.d.yer, el: x.d.el, ne: x.d.ne }));
    yay({ tip: 'bitti', kazanan, sira });
  }

  function oyunBitti(m) {
    const O = D.oyun; if (!O || O.bitti) return;
    O.bitti = true;
    O.kuleler.forEach(k => { k.durdu = true; });
    const ben = benimId();
    if (m.kazanan === ben) Ses.zafer(); else Ses.kaybet();
    const kazAd = m.kazanan ? (m.kazanan === ben ? 'Sen kazandın!' : `${esc(O.oyuncular.find(o => o.id === m.kazanan)?.ad || '?')} kazandı!`) : 'Kimse kazanamadı!';
    duyuru(`🏆 ${kazAd}`);
    setTimeout(() => {
      if (D.oyun !== O) return;
      $('#sonucBaslik').innerHTML = m.kazanan === ben ? '🏆 Kazandın!' : m.kazanan ? '🏗️ Oyun bitti' : '💥 Oyun bitti';
      $('#sonucYazi').innerHTML = kazAd;
      const madalya = ['🥇', '🥈', '🥉', '4.'];
      $('#sonucListe').innerHTML = m.sira.map((s, i) => `<div class="satirS ${s.id === ben ? 'ben' : ''}"><span>${madalya[i]}</span><span class="ad">${s.bot ? s.ikon + ' ' : ''}${esc(s.ad)}</span><span>${O.mod === 'yaris' ? `${(s.ust || 0).toFixed(1)} m` : `${s.yer || 0} parça`}${s.el ? ` · ${esc(s.ne || 'elendi')}` : ''}</span></div>`).join('');
      $('#tekrarBtn').hidden = !evMi(); $('#lobiyeBtn').hidden = !evMi();
      $('#sonucBekle').hidden = evMi();
      $('#sonuc').hidden = false;
    }, 2200);
  }
  $('#tekrarBtn').onclick = () => $('#baslatBtn').onclick();
  $('#lobiyeBtn').onclick = () => yay({ tip: 'lobiyeDon' });
  $('#oyunCikBtn').onclick = () => {
    if (!confirm(D.yerel ? 'Oyundan çıkılsın mı?' : 'Odadan çıkılsın mı?')) return;
    oyunKapat();
    if (D.yerel) { goster('#lobi'); lobiCiz(); }
    else { Ag.kapat(); goster('#giris'); }
  };

  // ---------- Kontroller ----------
  const kule = () => { const O = D.oyun; return O && O.basladi && !O.bitti ? O.kuleler.get(benimId()) : null; };
  window.addEventListener('keydown', e => {
    if (!D.oyun || e.target.tagName === 'INPUT') return;
    const k = kule();
    const t = e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(t)) e.preventDefault();
    if (!k) return;
    if (t === 'ArrowLeft' || t === 'a' || t === 'A') k.oynat(-1);
    else if (t === 'ArrowRight' || t === 'd' || t === 'D') k.oynat(1);
    else if ((t === 'ArrowUp' || t === 'w' || t === 'W' || t === ' ') && !e.repeat) k.dondur();
    else if (t === 'ArrowDown' || t === 's' || t === 'S') k.hizlandir(true);
    else if ((t === 'Shift' || t === 'e' || t === 'E') && !e.repeat) benimAletim();
  });
  window.addEventListener('keyup', e => {
    const k = kule(); if (!k) return;
    if (['ArrowDown', 's', 'S'].includes(e.key)) k.hizlandir(false);
  });
  // Dokunmatik düğmeler: basılı tutunca tekrar eder
  function basiliTut(btn, bas, birak) {
    let zam = null, tekrar = null;
    const dur = () => { clearTimeout(zam); clearInterval(tekrar); zam = tekrar = null; birak?.(); btn.classList.remove('basili'); };
    btn.addEventListener('pointerdown', e => {
      e.preventDefault(); Ses.ac(); btn.classList.add('basili');
      try { btn.setPointerCapture(e.pointerId); } catch (x) { }
      bas(true);
      if (!birak) zam = setTimeout(() => { tekrar = setInterval(() => bas(false), 85); }, 230);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => btn.addEventListener(t, dur));
    btn.addEventListener('contextmenu', e => e.preventDefault());
  }
  basiliTut($('#solBtn'), () => kule()?.oynat(-1));
  basiliTut($('#sagBtn'), () => kule()?.oynat(1));
  basiliTut($('#donBtn'), ilk => { if (ilk) kule()?.dondur(); }, () => {});
  basiliTut($('#inBtn'), () => kule()?.hizlandir(true), () => kule()?.hizlandir(false));

  // ---------- Ekran düzeni ----------
  function yerlesim() {
    const O = D.oyun, W = window.innerWidth, H = window.innerHeight;
    const ben = O.benIdx >= 0 ? O.benIdx : 0;
    const diger = O.oyuncular.map((o, i) => i).filter(i => i !== ben);
    if (!diger.length) return [{ i: ben, x: 0, y: 0, w: W, h: H, ana: true }];
    const alan = [];
    if (W > H * 1.05) {
      const sw = Math.round(Math.min(W * 0.3, (H / diger.length) * 0.95 + 40));
      const sh = Math.floor(H / diger.length);
      alan.push({ i: ben, x: 0, y: 0, w: W - sw, h: H, ana: true });
      diger.forEach((i, k) => alan.push({ i, x: W - sw, y: k * sh, w: sw, h: sh }));
    } else {
      const sh = Math.round(H * 0.25), sw = Math.floor(W / diger.length);
      alan.push({ i: ben, x: 0, y: sh, w: W, h: H - sh, ana: true });
      diger.forEach((i, k) => alan.push({ i, x: k * sw, y: 0, w: sw, h: sh }));
    }
    return alan;
  }
  function etiketleriKur() {
    const kap = $('#etiketler'); kap.innerHTML = '';
    D.oyun.oyuncular.forEach((o, i) => {
      const d = document.createElement('div'); d.className = 'etiketKutu'; d.dataset.i = i;
      d.innerHTML = `<div class="ust"><span class="ad">${o.bot ? o.ikon : '👷'} ${esc(o.ad)}${o.id === benimId() ? ' (sen)' : ''}</span><span class="deger"></span></div><div class="durumYazi"></div>`;
      kap.appendChild(d);
    });
  }
  function hudGuncelle(alanlar) {
    const O = D.oyun;
    alanlar.forEach(a => {
      const el = $(`#etiketler .etiketKutu[data-i="${a.i}"]`); if (!el) return;
      Object.assign(el.style, { left: a.x + 'px', top: a.y + 'px', width: a.w + 'px', height: a.h + 'px' });
      el.classList.toggle('ana', !!a.ana);
      const o = O.oyuncular[a.i], d = durumAl(o.id) || {};
      const kalpler = O.mod === 'yaris' ? '' : ' ' + '❤️'.repeat(Math.max(0, d.can ?? 3)) + '🖤'.repeat(Math.max(0, 3 - (d.can ?? 3)));
      const deger = O.mod === 'yaris' ? `🏗️ ${(d.ust || 0).toFixed(1)} / ${O.hedef} m`
        : O.mod === 'hayatta' ? `🧱 ${d.yer || 0} / ${O.hedef}${kalpler}` : `🧱 ${d.yer || 0}${kalpler}`;
      el.querySelector('.deger').innerHTML = deger;
      let durum = '';
      if (d.z) durum = '🏆 BİTİRDİ!';
      else if (d.el) durum = `❌ ${esc(d.ne || 'Elendi')}`;
      else if (O.mod === 'yaris' && d.s > 0) durum = `🏁 ${Math.max(1, Math.ceil(3 - d.s))}…`;
      else if (O.mod === 'bulmaca' && d.s > 0) durum = '🔴 LAZER!';
      const dy = el.querySelector('.durumYazi');
      dy.innerHTML = durum; dy.className = 'durumYazi' + (durum ? ' var' : '') + (d.el ? ' kirmizi' : '');
      if (a.ana) {
        const al = d.al ? Fizik.ALETLER[d.al] : null;
        const btn = $('#aletBtn');
        btn.hidden = !al || !!d.el || !O.basladi || O.bitti;
        if (al) { btn.innerHTML = `<span class="i">${al.ikon}</span><span class="y">${al.ad}</span><span class="h">${al.iyi ? 'kendine' : 'rakibe'}</span>`; btn.classList.toggle('kotu', !al.iyi); }
      }
    });
    // ana alan: kontroller ve üst çubuk ana alanın içinde
    const ana = alanlar.find(a => a.ana);
    if (ana) {
      const ust = $('#ustCubuk'); Object.assign(ust.style, { left: ana.x + 'px', top: ana.y + 'px', width: ana.w + 'px' });
      const kont = $('#kontroller'); Object.assign(kont.style, { left: ana.x + 'px', width: ana.w + 'px' });
    }
  }

  // ---------- Ana döngü ----------
  let onceki = performance.now();
  function dongu(simdi) {
    requestAnimationFrame(dongu);
    kare(simdi);
  }
  // Bir kare: fizik + ağ + çizim (testte arka plan sekmesinde elle çağrılabilir)
  function kare(simdi) {
    const dt = Math.max(0, Math.min(0.1, (simdi - onceki) / 1000)); onceki = simdi;
    const O = D.oyun;
    if (!O) { Sahne.ciz(dt, []); return; }
    // geri sayım
    if (!O.basladi) {
      const kalan = Math.ceil((O.basT - simdi) / 1000);
      if (kalan < O.sonSayac && kalan >= 0) { O.sonSayac = kalan; if (kalan > 0) { Ses.sayac(false); buyukYazi(String(kalan)); } }
      if (simdi >= O.basT) { O.basladi = true; Ses.sayac(true); buyukYazi('BAŞLA!'); }
    }
    if (O.basladi && !O.bitti) {
      O.kuleler.forEach(k => k.adim(dt));
      O.botlar.forEach(b => b.adim(dt));
      O.gondermeT -= dt;
      if (O.gondermeT <= 0 && !D.yerel) {
        O.gondermeT = 0.1;
        const benK = O.kuleler.get(benimId());
        if (Ag.evMi) {
          O.kuleler.forEach((k, id) => Ag.herkese({ tip: 'durum', id, d: k.ozet() }));
        } else if (benK) Ag.eveGonder({ tip: 'durum', d: benK.ozet() });
      }
      if (evMi()) { O.kontrolT -= dt; if (O.kontrolT <= 0) { O.kontrolT = 0.25; bitisKontrol(); } }
    }
    // çizim
    O.oyuncular.forEach((o, i) => {
      const k = O.kuleler.get(o.id);
      if (k) Sahne.guncelle(i, k.parcaListesi(), { ust: k.ust, rz: k.etki.ruzgar > 0 ? k.etki.ruzYon : 0 }, true);
      else { const u = O.uzak.get(o.id); if (u) Sahne.guncelle(i, Fizik.ozetCoz(u), { ust: u.ust, rz: u.rz }, false); }
    });
    const alan = yerlesim();
    Sahne.ciz(dt, alan);
    hudGuncelle(alan);
  }

  // ---------- Yardımcılar ----------
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  let duyuruZam = null;
  function duyuru(html, kotu) {
    const d = $('#duyuru'); d.innerHTML = html; d.hidden = false; d.classList.toggle('kotu', !!kotu);
    d.classList.remove('gir'); void d.offsetWidth; d.classList.add('gir');
    clearTimeout(duyuruZam); duyuruZam = setTimeout(() => { d.hidden = true; }, 2600);
  }
  function buyukYazi(t) {
    const d = $('#buyukYazi'); d.textContent = t; d.hidden = false;
    d.classList.remove('gir'); void d.offsetWidth; d.classList.add('gir');
    setTimeout(() => { if (d.textContent === t) d.hidden = true; }, 900);
  }

  Sahne.kur($('#sahne'));
  requestAnimationFrame(dongu);
  goster('#giris');
  window.__ks = { D, Sahne, Fizik, kare };
})();
