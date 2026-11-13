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
  const MAC_PUAN = [3, 5, 10, 15], TUR_PUAN = [3, 2, 1, 0];

  const D = {
    ad: '', yerel: false,
    lobi: { mod: 'yaris', uzunluk: 1, zorluk: 'orta', macPuan: 5, ag: false, aletler: Fizik.ALET_LISTE.slice(), botlar: [] },
    tekli: false,       // Gökdelen (tek kişilik) oyunu mu?
    mac: null,          // ev: { hedef, puan: {id: toplam}, tur, bitti }
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
    else if (m.tip === 'lobiyeDon') { D.mac = null; clearTimeout(D.sonrakiZam); oyunKapat(); goster('#lobi'); lobiCiz(); }
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
    D.tekli = false;
    D.yerel = false; D.lobi.botlar = [];
    $('#girisDurum').textContent = 'Oda açılıyor…';
    Ag.odaAc(ad);
  };
  $('#katilBtn').onclick = () => {
    const ad = adAl(); if (!ad) return;
    D.tekli = false;
    const kod = $('#odaKoduGir').value.trim();
    if (kod.length < 5) { $('#girisDurum').textContent = '5 harfli oda kodunu yaz.'; return; }
    D.yerel = false;
    $('#girisDurum').textContent = 'Bağlanılıyor…';
    Ag.katil(kod, ad);
  };
  $('#odaKoduGir').addEventListener('keydown', e => { if (e.key === 'Enter') $('#katilBtn').click(); });
  // Tek başına: Gökdelen modu, botsuz, internetsiz
  function tekliBaslat() {
    Ag.kapat();
    D.yerel = true; D.tekli = true; D.mac = null;
    clearTimeout(D.sonrakiZam);
    mesajIsle({ tip: 'basla', tohum: Math.floor(Math.random() * 1e9), mod: 'tekli', uzunluk: 1, zorluk: 'orta', aletler: Fizik.ALET_LISTE, ag: true, oyuncular: [{ id: 'ben', ad: D.ad, bot: false }] });
  }
  $('#tekliBtn').onclick = () => { const ad = adAl(); if (!ad) return; $('#girisDurum').textContent = ''; tekliBaslat(); };
  $('#botlaBtn').onclick = () => {
    D.tekli = false;
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
    sec($('#modSec'), Object.entries(Fizik.MOD).filter(([, m]) => !m.tekli).map(([k, m]) => [k, `${m.ikon} ${m.ad}`]), D.lobi.mod, d => { D.lobi.mod = d; lobiDegisti(); });
    sec($('#agSec'), [[false, 'Kapalı'], [true, 'Açık']], !!D.lobi.ag, d => { D.lobi.ag = d; lobiDegisti(); });
    $('#agSatir').hidden = D.lobi.mod === 'yaris';
    sec($('#uzunlukSec'), UZUNLUK.map((u, i) => [i, u]), D.lobi.uzunluk, d => { D.lobi.uzunluk = d; lobiDegisti(); });
    sec($('#zorlukSec'), ZORLUK, D.lobi.zorluk, d => { D.lobi.zorluk = d; lobiDegisti(); });
    $('#zorlukSatir').hidden = !D.lobi.botlar.length;
    sec($('#macSec'), MAC_PUAN.map(p => [p, `${p} puan`]), D.lobi.macPuan ?? 5, d => { D.lobi.macPuan = d; lobiDegisti(); });
    aletSecCiz(ev);
    const m = Fizik.MOD[D.lobi.mod], h = m.hedef[D.lobi.uzunluk];
    $('#modAciklama').textContent = `${m.acik} ${D.lobi.mod === 'yaris' ? `(Bitiş: ${h} m)` : D.lobi.mod === 'hayatta' ? `(Hedef: ${h} parça, 3 can)` : `(Lazer: ${h} m, 3 can)`}`;
    $('#baslatBtn').hidden = !ev;
    $('#lobiDurum').textContent = ev ? (tumOyuncular().length < 2 ? 'Tek başına da başlatabilirsin (antrenman).' : '') : 'Oda sahibinin başlatması bekleniyor…';
    sesDugme();
  }
  $('#botEkleBtn').onclick = () => { botEkle(); lobiDegisti(); };
  // Alet seçimi: her alet açık/kapalı (oda sahibi seçer)
  function aletSecCiz(ev) {
    const acik = new Set(D.lobi.aletler || Fizik.ALET_LISTE);
    const kap = $('#aletSec'); kap.innerHTML = '';
    Fizik.ALET_LISTE.forEach(a => {
      const al = Fizik.ALETLER[a];
      const b = document.createElement('button');
      b.className = 'aletCip ' + (al.iyi ? 'iyi' : 'kotu') + (acik.has(a) ? ' secili' : '');
      b.innerHTML = `<span>${al.ikon}</span><b>${al.ad}</b><small>${al.acik}</small>`;
      b.disabled = !ev;
      b.onclick = () => { if (acik.has(a)) acik.delete(a); else acik.add(a); D.lobi.aletler = Fizik.ALET_LISTE.filter(x => acik.has(x)); lobiDegisti(); };
      kap.appendChild(b);
    });
    $('#aletSayi').textContent = `${acik.size} / ${Fizik.ALET_LISTE.length}`;
    $('#aletHepsi').hidden = $('#aletHicbiri').hidden = !ev;
  }
  $('#aletHepsi').onclick = () => { D.lobi.aletler = Fizik.ALET_LISTE.slice(); lobiDegisti(); };
  $('#aletHicbiri').onclick = () => { D.lobi.aletler = []; lobiDegisti(); };
  $('#cikBtn').onclick = () => { Ag.kapat(); D.yerel = false; goster('#giris'); };
  // Yeni maç: puanlar sıfırlanır, ilk tur başlar
  $('#baslatBtn').onclick = () => {
    if (!evMi()) return;
    Ses.ac();
    D.mac = { hedef: D.lobi.macPuan ?? 5, puan: {}, tur: 0, bitti: false };
    turBaslat();
  };
  function turBaslat() {
    if (!evMi() || !D.mac) return;
    clearTimeout(D.sonrakiZam);
    D.mac.tur++;
    yay({ tip: 'basla', tohum: Math.floor(Math.random() * 1e9), mod: D.lobi.mod, uzunluk: D.lobi.uzunluk, zorluk: D.lobi.zorluk, aletler: D.lobi.aletler, ag: !!D.lobi.ag,
      mac: { hedef: D.mac.hedef, puan: D.mac.puan, tur: D.mac.tur },
      oyuncular: tumOyuncular().map(({ id, ad, bot, ikon }) => ({ id, ad, bot: !!bot, ikon })) });
  }

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
      mod: m.mod, uzunluk: m.uzunluk, tohum: m.tohum, oyuncular: m.oyuncular, mac: m.mac || { puan: {} },
      hedef: Fizik.MOD[m.mod].hedef[m.uzunluk],
      benIdx: m.oyuncular.findIndex(o => o.id === ben),
      kuleler: new Map(), botlar: new Map(), uzak: new Map(),
      basT: performance.now() + 3200, basladi: false, bitti: false, gondermeT: 0, kontrolT: 0, sonSayac: 4,
    };
    const yeniKule = () => new Fizik.Kule({ tohum: m.tohum, mod: m.mod, uzunluk: m.uzunluk, aletler: m.aletler, ag: m.ag });
    if (O.benIdx >= 0) {
      const k = yeniKule(); k.olay = (t, v) => benimOlay(t, v); O.kuleler.set(ben, k);
    }
    if (evMi()) m.oyuncular.filter(o => o.bot).forEach(o => {
      const k = yeniKule(); O.kuleler.set(o.id, k);
      O.botlar.set(o.id, new Bot.BotOyuncu(k, m.zorluk, ad => botAlet(o.id, ad)));
    });
    Sahne.oyunKur(m.oyuncular.length, m.mod, O.hedef);
    etiketleriKur();
    // üstte: hangi moddayız
    let rekor = 0; try { rekor = +localStorage.getItem('ks.rekor') || 0; } catch (e) { }
    const md = Fizik.MOD[m.mod], hedefYazi = m.mod === 'yaris' ? `bitiş ${O.hedef} m` : m.mod === 'hayatta' ? `${O.hedef} parça · 3 can` : m.mod === 'tekli' ? `3 can · rekor ${rekor.toFixed(1)} m` : `lazer ${O.hedef} m · 3 can`;
    $('#modYazi').innerHTML = `${md.ikon} <b>${md.ad}</b> · ${hedefYazi}${m.mac ? ` · ${m.mac.tur}. tur · maç ${m.mac.hedef} puan` : ''}`;
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
    $('#sis').hidden = true;
    $('#sonrakiKutu').hidden = true; sonrakiAnahtar = '';
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
    else if (t === 'agGeldi') { Ses.aletGeldi(); duyuru(`🥅 Güvenlik ağı hakkı kazandın (${v})`); }
    else if (t === 'agKurtardi') { Ses.ag(); duyuru('🥅 Ağ yakaladı, can gitmedi!'); }
    else if (t === 'cikinti') { Ses.bildirim(); }
    else if (t === 'sarildi') { Ses.sarmasik(); duyuru(`🌿 Sarmaşık ${v} yere sarıldı!`); }
    else if (t === 'zafer') { /* ev karar verir */ }
  }

  // Lider: kendisi hariç, oyunda kalan en iyi rakip
  function durumAl(id) {
    const O = D.oyun; if (!O) return null;
    const k = O.kuleler.get(id);
    if (k) return { ust: k.ust, yer: k.yer, can: k.can, el: k.elendi ? 1 : 0, ne: k.neden, z: k.zafer ? 1 : 0, s: k.sayac, al: k.alet, ag: k.ag, ey: k.enYuksek };
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
      ({ zimba: Ses.zimba, kalas: Ses.aletKullan, kucuk: Ses.aletKullan, buz: Ses.buz, ruzgar: () => Ses.ruzgar(3), dev: Ses.dev, hiz: Ses.hiz,
        sarmasik: Ses.aletKullan, ucgen: Ses.dev, varil: Ses.dev, sis: () => Ses.ruzgar(2), ters: Ses.hiz, balon: Ses.balon,
        miknatis: Ses.zimba, yavas: Ses.aletKullan, tamir: Ses.aletGeldi })[m.ad]?.();
      if (m.ad === 'sis' && m.hedef === benimId()) sisGetir(5);
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
  // dokunur dokunmaz çalışsın (parmağı kaldırmayı beklemeden)
  $('#aletBtn').addEventListener('pointerdown', e => { e.preventDefault(); Ses.ac(); benimAletim(); });

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
    if (O.mod === 'tekli') { yay({ tip: 'bitti', kazanan: null, sira, tekli: true }); return; }
    // Tur puanı: 1. 3, 2. 2, 3. 1, 4. 0 → maç toplamına eklenir
    const mac = D.mac || (D.mac = { hedef: 5, puan: {}, tur: 1, bitti: false });
    sira.forEach((s, i) => { s.kazanc = TUR_PUAN[i] || 0; mac.puan[s.id] = (mac.puan[s.id] || 0) + s.kazanc; s.toplam = mac.puan[s.id]; });
    const enCok = Math.max(...sira.map(s => s.toplam));
    const onde = sira.filter(s => s.toplam === enCok);
    mac.bitti = enCok >= mac.hedef && onde.length === 1;   // eşitlikte bir tur daha
    yay({ tip: 'bitti', kazanan, sira, mac: { hedef: mac.hedef, puan: mac.puan, tur: mac.tur, bitti: mac.bitti, sampiyon: mac.bitti ? onde[0].id : null } });
  }

  function oyunBitti(m) {
    const O = D.oyun; if (!O || O.bitti) return;
    O.bitti = true;
    O.kuleler.forEach(k => { k.durdu = true; });
    const ben = benimId();
    if (m.tekli) { tekliSonuc(O); return; }
    const mac = m.mac || {};
    O.mac = { ...(O.mac || {}), puan: mac.puan || {} };
    const adBul = id => (id === ben ? 'Sen' : esc(O.oyuncular.find(o => o.id === id)?.ad || '?'));
    if ((mac.bitti ? mac.sampiyon : m.kazanan) === ben) Ses.zafer(); else Ses.kaybet();
    const kazAd = m.kazanan ? (m.kazanan === ben ? 'Bu turu sen kazandın!' : `Bu turu ${adBul(m.kazanan)} kazandı!`) : 'Bu turu kimse kazanamadı!';
    duyuru(`🏆 ${kazAd}`);
    setTimeout(() => {
      if (D.oyun !== O) return;
      $('#sonucBaslik').innerHTML = mac.bitti ? (mac.sampiyon === ben ? '🏆 Maçı kazandın!' : `🏆 ${adBul(mac.sampiyon)} maçı kazandı!`) : `🏗️ ${mac.tur || 1}. tur bitti`;
      $('#sonucYazi').innerHTML = `${kazAd}<br><small>Maç: <b>${mac.hedef || '?'} puana</b> ilk ulaşan kazanır · 1. 3 puan, 2. 2 puan, 3. 1 puan</small>`;
      const madalya = ['🥇', '🥈', '🥉', '4.'];
      $('#sonucListe').innerHTML = m.sira.map((s, i) => `<div class="satirS ${s.id === ben ? 'ben' : ''}"><span>${madalya[i]}</span><span class="ad">${s.bot ? s.ikon + ' ' : ''}${esc(s.ad)}<small>${O.mod === 'yaris' ? `${(s.ust || 0).toFixed(1)} m` : `${s.yer || 0} parça`}${s.el ? ` · ${esc(s.ne || 'elendi')}` : ''}</small></span><span class="kazanc">+${s.kazanc ?? 0}</span><span class="toplam">⭐ ${s.toplam ?? 0}</span></div>`).join('');
      $('#tekrarBtn').hidden = !evMi(); $('#lobiyeBtn').hidden = !evMi();
      $('#tekrarBtn').textContent = mac.bitti ? '🔁 Yeni maç' : '▶ Sonraki tur';
      // maç sürüyorsa sonraki tur kendiliğinden başlar
      clearTimeout(D.sonrakiZam);
      if (!mac.bitti) {
        let kalan = 10;
        const yaz = () => { $('#sonucBekle').hidden = false; $('#sonucBekle').textContent = `Sonraki tur ${kalan} saniye içinde başlıyor…`; };
        yaz();
        const say = () => { if (D.oyun !== O) return; kalan--; if (kalan <= 0) { if (evMi()) turBaslat(); return; } yaz(); D.sonrakiZam = setTimeout(say, 1000); };
        D.sonrakiZam = setTimeout(say, 1000);
      } else { $('#sonucBekle').hidden = evMi(); $('#sonucBekle').textContent = 'Oda sahibi yeni maçı başlatacak…'; }
      $('#sonuc').hidden = false;
    }, 2200);
  }
  // Gökdelen rekorları: en çok dizili parça (asıl rekor) ve en yüksek nokta
  function rekorOku() {
    let parca = 0, boy = 0;
    try { parca = +localStorage.getItem('ks.rekorParca') || 0; boy = +localStorage.getItem('ks.rekor') || 0; } catch (e) { }
    return { parca, boy };
  }
  // Gökdelen sonucu: kaç parça dizdin, ne kadar yükseldin, rekor
  function tekliSonuc(O) {
    const k = O.kuleler.get('ben'); const ey = k ? k.enYuksek : 0, parca = k ? k.koyulan : 0, dizili = O.enCokYer || 0;
    const r = rekorOku();
    const yeniRekor = dizili > r.parca || (dizili === r.parca && ey > r.boy);
    try { localStorage.setItem('ks.rekorParca', String(Math.max(dizili, r.parca))); localStorage.setItem('ks.rekor', Math.max(ey, r.boy).toFixed(2)); } catch (e) { }
    if (yeniRekor) Ses.zafer(); else Ses.kaybet();
    duyuru(yeniRekor ? '🏆 Yeni rekor!' : '🏙️ Gökdelen bitti');
    setTimeout(() => {
      if (D.oyun !== O) return;
      $('#sonucBaslik').innerHTML = yeniRekor ? '🏆 Yeni rekor!' : '🏙️ Gökdelen bitti';
      $('#sonucYazi').innerHTML = `Canların bitti. Kulende aynı anda en fazla <b>${dizili} parça</b> dizili durdu.`;
      $('#sonucListe').innerHTML = `<div class="satirS ben"><span>🧱</span><span class="ad">En çok dizili parça</span><span class="toplam">${dizili}</span></div>
        <div class="satirS"><span>🏙️</span><span class="ad">En yüksek nokta</span><span class="toplam">${ey.toFixed(1)} m</span></div>
        <div class="satirS"><span>🏗️</span><span class="ad">Toplam koyduğun parça</span><span class="toplam">${parca}</span></div>
        <div class="satirS"><span>🏆</span><span class="ad">Rekorun</span><span class="toplam">${Math.max(dizili, r.parca)} parça / ${Math.max(ey, r.boy).toFixed(1)} m</span></div>`;
      $('#tekrarBtn').hidden = false; $('#lobiyeBtn').hidden = false;
      $('#tekrarBtn').textContent = '🔁 Tekrar dene'; $('#lobiyeBtn').textContent = '↩ Ana menü';
      $('#sonucBekle').hidden = true;
      $('#sonuc').hidden = false;
    }, 2200);
  }
  $('#tekrarBtn').onclick = () => { if (D.tekli) return tekliBaslat(); if (D.mac && !D.mac.bitti) turBaslat(); else $('#baslatBtn').onclick(); };
  $('#lobiyeBtn').onclick = () => { if (D.tekli) { D.tekli = false; D.yerel = false; oyunKapat(); goster('#giris'); return; } yay({ tip: 'lobiyeDon' }); };
  $('#oyunCikBtn').onclick = () => {
    if (!confirm(D.yerel ? 'Oyundan çıkılsın mı?' : 'Odadan çıkılsın mı?')) return;
    oyunKapat();
    if (D.tekli) { D.tekli = false; D.yerel = false; goster('#giris'); }
    else if (D.yerel) { goster('#lobi'); lobiCiz(); }
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
    if (t === 'ArrowLeft' || t === 'a' || t === 'A') { if (!e.repeat) yonBasla(-1); }
    else if (t === 'ArrowRight' || t === 'd' || t === 'D') { if (!e.repeat) yonBasla(1); }
    else if ((t === 'ArrowUp' || t === 'w' || t === 'W' || t === ' ') && !e.repeat) k.dondur();
    else if (t === 'ArrowDown' || t === 's' || t === 'S') k.hizlandir(true);
    else if ((t === 'Shift' || t === 'e' || t === 'E') && !e.repeat) benimAletim();
  });
  // Basılı tutunca: kısa bekleme, sonra hızlı tekrar (duvara/parçaya kadar kayar)
  const BEKLE = 150, TEKRAR = 40, yonZam = {};
  function yonBasla(yon) {
    if (yonZam[yon]) return;
    kule()?.oynat(yon);
    yonZam[yon] = { z: setTimeout(() => { yonZam[yon].i = setInterval(() => kule()?.oynat(yon), TEKRAR); }, BEKLE) };
  }
  function yonBirak(yon) { const y = yonZam[yon]; if (!y) return; clearTimeout(y.z); clearInterval(y.i); delete yonZam[yon]; }
  window.addEventListener('blur', () => { yonBirak(-1); yonBirak(1); });
  window.addEventListener('keyup', e => {
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) yonBirak(-1);
    if (['ArrowRight', 'd', 'D'].includes(e.key)) yonBirak(1);
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
      if (!birak) zam = setTimeout(() => { tekrar = setInterval(() => bas(false), TEKRAR); }, BEKLE);
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
    // Ekran oyuncu sayısı kadar eşit parçaya bölünür, herkes yan yana (benimki çerçeveli)
    const ben = O.benIdx >= 0 ? O.benIdx : 0, n = O.oyuncular.length;
    return O.oyuncular.map((o, i) => {
      const x = Math.round((i * W) / n), x2 = Math.round(((i + 1) * W) / n);
      return { i, x, y: 0, w: x2 - x, h: H, ana: i === ben };
    });
  }
  function etiketleriKur() {
    const kap = $('#etiketler'); kap.innerHTML = '';
    D.oyun.oyuncular.forEach((o, i) => {
      const d = document.createElement('div'); d.className = 'etiketKutu'; d.dataset.i = i;
      const p = D.oyun.mac?.puan?.[o.id] || 0;
      d.innerHTML = `<div class="ust"><span class="ad">${o.bot ? o.ikon : '👷'} ${esc(o.ad)}${o.id === benimId() ? ' (sen)' : ''} <span class="yildiz">⭐${p}</span></span><span class="deger"></span></div><div class="durumYazi"></div>`;
      kap.appendChild(d);
    });
  }
  function hudGuncelle(alanlar) {
    const O = D.oyun;
    alanlar.forEach(a => {
      const el = $(`#etiketler .etiketKutu[data-i="${a.i}"]`); if (!el) return;
      Object.assign(el.style, { left: a.x + 'px', top: a.y + 'px', width: a.w + 'px', height: a.h + 'px' });
      el.classList.toggle('ana', !!a.ana);
      el.classList.toggle('dar', a.w < 170);
      const o = O.oyuncular[a.i], d = durumAl(o.id) || {};
      const kalpler = O.mod === 'yaris' ? '' : ' ' + '❤️'.repeat(Math.max(0, d.can ?? 3)) + '🖤'.repeat(Math.max(0, 3 - (d.can ?? 3)));
      const agYazi = d.ag > 0 ? ` 🥅${d.ag}` : '';
      const deger = O.mod === 'yaris' ? `🏗️ ${(d.ust || 0).toFixed(1)} / ${O.hedef} m`
        : O.mod === 'hayatta' ? `🧱 ${d.yer || 0} / ${O.hedef}${kalpler}${agYazi}`
        : O.mod === 'tekli' ? `🏙️ ${(d.ust || 0).toFixed(1)} m${kalpler}${agYazi}` : `🧱 ${d.yer || 0}${kalpler}${agYazi}`;
      // benim üstümdeki etkiler (kaç parça kaldı)
      let etk = '';
      if (a.ana) {
        const k = O.kuleler.get(o.id);
        if (k) {
          const e = k.etki, akt = k.aktif || {};
          const say = (ikon, n) => (n > 0 ? `${ikon}${n > 1 ? n : ''} ` : '');
          etk = say('🔄', e.ters + (akt.ters ? 1 : 0)) + say('🧊', e.buz + (akt.buz ? 1 : 0)) + say('⚡', e.hiz + (akt.hiz ? 1 : 0)) + say('🐢', e.yavas + (akt.yavas ? 1 : 0))
            + say('🧲', e.miknatis + (akt.miknatis ? 1 : 0)) + say('🎈', e.balon + (akt.balon ? 1 : 0)) + say('🌬️', e.ruzgar > 0 ? 1 : 0);
        }
      }
      el.querySelector('.deger').innerHTML = deger + (etk ? `<br><span class="etkiler">${etk.trim()}</span>` : '');
      if (a.ana) sonrakiGoster(a, O.kuleler.get(o.id), d);
      // Gökdelen: üstte canlı rekor denemesi tablosu
      if (a.ana && O.mod === 'tekli') {
        O.enCokYer = Math.max(O.enCokYer || 0, d.yer || 0);
        const r = rekorOku();
        $('#modYazi').innerHTML = `🏙️ <b>Gökdelen</b> · 🧱 <b>${d.yer || 0}</b> parça dizili · ${(d.ust || 0).toFixed(1)} m · 🏆 Rekor: <b>${r.parca}</b> parça / ${r.boy.toFixed(1)} m`;
      }
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
        btn.style.left = (a.x + 8) + 'px';   // benim kulvarımın sol alt köşesinde
        // içeriği SADECE alet değişince yaz (her karede yazınca dokunuşlar kayboluyordu)
        if (al && btn.dataset.alet !== d.al) { btn.dataset.alet = d.al; btn.innerHTML = `<span class="i">${al.ikon}</span><span class="y">${al.ad}</span><span class="h">${al.iyi ? 'kendine' : 'rakibe'}</span>`; btn.classList.toggle('kotu', !al.iyi); }
        if (!al) btn.dataset.alet = '';
      }
    });
    // ana alan: kontroller ve üst çubuk ana alanın içinde
    const ana = alanlar.find(a => a.ana);
    if (ana) {
      const kont = $('#kontroller'); Object.assign(kont.style, { left: '0px', width: '100%' });
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
      if (k) Sahne.guncelle(i, k.parcaListesi(), { ust: k.ust, rz: k.etki.ruzgar > 0 ? k.etki.ruzYon : 0, ag: k.ag }, true);
      else { const u = O.uzak.get(o.id); if (u) Sahne.guncelle(i, Fizik.ozetCoz(u), { ust: u.ust, rz: u.rz, ag: u.ag }, false); }
    });
    const alan = yerlesim();
    Sahne.ciz(dt, alan);
    hudGuncelle(alan);
  }

  // Sıradaki parça önizlemesi (benim kulvarımın sağ üstünde)
  const RENK = { I: '#f2b705', O: '#b07a3e', T: '#c8452f', L: '#e0842a', J: '#4f78c4', S: '#4a9e48', Z: '#a8489c', K1: '#9a9a96', K2: '#9a9a96', KALAS: '#c99a5a', UCGEN: '#7d7f86', VARIL: '#d63a2a' };
  let sonrakiAnahtar = '';
  function sonrakiGoster(a, k, d) {
    const kutu = $('#sonrakiKutu');
    if (!k || d.el || d.z || !D.oyun.basladi || D.oyun.bitti) { kutu.hidden = true; return; }
    kutu.hidden = false;
    kutu.style.left = (a.x + a.w - 78) + 'px';
    const s = k.siradaki(), anahtar = JSON.stringify(s);
    if (anahtar === sonrakiAnahtar) return;
    sonrakiAnahtar = anahtar;
    const c = $('#sonraki'), g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    const sek = Fizik.SEKIL[s.tip];
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    sek.forEach(r => { x0 = Math.min(x0, r.x - r.w / 2); x1 = Math.max(x1, r.x + r.w / 2); y0 = Math.min(y0, r.y - r.h / 2); y1 = Math.max(y1, r.y + r.h / 2); });
    const olc = Math.min((c.width - 16) / (x1 - x0), (c.height - 16) / (y1 - y0), 26);
    const cx = c.width / 2 - ((x0 + x1) / 2) * olc, cy = c.height / 2 + ((y0 + y1) / 2) * olc;
    const renk = s.buz ? '#a8e4fb' : RENK[s.tip] || '#ccc';
    g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.fillStyle = renk;
    sek.forEach(r => {
      if (r.ucgen) { g.beginPath(); Fizik.UCGEN_KOSE.forEach(([px, py], i) => g[i ? 'lineTo' : 'moveTo'](cx + px * olc, cy - py * olc)); g.closePath(); g.fill(); g.stroke(); }
      else if (r.daire) { g.beginPath(); g.arc(cx, cy, (r.w / 2) * olc, 0, 7); g.fill(); g.stroke(); }
      else { const px = cx + (r.x - r.w / 2) * olc, py = cy - (r.y + r.h / 2) * olc; g.fillRect(px + 1, py + 1, r.w * olc - 2, r.h * olc - 2); g.strokeRect(px + 1, py + 1, r.w * olc - 2, r.h * olc - 2); }
    });
    $('#sonrakiEtki').textContent = (s.dev ? '📦' : '') + (s.balon ? '🎈' : '') + (s.sarmasik ? '🌿' : '') + (s.miknatis ? '🧲' : '') + (s.buz ? '🧊' : '');
  }

  // Sis: benim kulvarımın üstüne 5 sn sis perdesi
  let sisZam = null;
  function sisGetir(sn) {
    const O = D.oyun; if (!O) return;
    const s = $('#sis'), a = yerlesim().find(x => x.ana); if (!a) return;
    Object.assign(s.style, { left: a.x + 'px', top: a.y + 'px', width: a.w + 'px', height: a.h + 'px' });
    s.hidden = false; s.classList.remove('kalk'); void s.offsetWidth; s.classList.add('gel');
    clearTimeout(sisZam);
    sisZam = setTimeout(() => { s.classList.remove('gel'); s.classList.add('kalk'); setTimeout(() => { s.hidden = true; }, 800); }, sn * 1000);
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
