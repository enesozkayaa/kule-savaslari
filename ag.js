// =============================================================
// Kule Savaşları - online oda (PeerJS) ve sesli sohbet
// Odayı açan "ev"dir: botları o oynatır, oyunun bitişine o karar verir. Diğerleri evle konuşur.
// Ses: mikrofonu açık herkes birbirine doğrudan bağlanır (herkes herkesi duyar).
// =============================================================

const Ag = (() => {
  const ODA_ONEKI = 'kulesavaslari-oda-';
  const KOD_HARF = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
  const NABIZ = 2000, ZAMAN_ASIMI = 15000;
  const ag = { peer: null, mod: null, kod: null, benimId: null, oyuncular: [], baglantilar: new Map(), ev: null, sonEv: 0 };
  const dinleyiciler = {};
  const on = (tip, fn) => { (dinleyiciler[tip] ??= []).push(fn); };
  const tetikle = (tip, ...a) => (dinleyiciler[tip] || []).forEach(f => f(...a));
  let nabizSayac = null;
  let kabulEt = () => true;     // ev: yeni oyuncu kabul edilsin mi → true ya da ret nedeni

  const peerVar = () => typeof Peer !== 'undefined';
  const yeniKod = () => Array.from({ length: 5 }, () => KOD_HARF[Math.floor(Math.random() * KOD_HARF.length)]).join('');

  // ---------- Ev ----------
  function odaAc(ad) {
    if (!peerVar()) return tetikle('hata', 'Bağlantı kütüphanesi yüklenemedi. İnterneti kontrol et.');
    kapat();
    const kod = yeniKod();
    const peer = new Peer(ODA_ONEKI + kod);
    ag.peer = peer;
    peer.on('open', id => {
      ag.mod = 'ev'; ag.kod = kod; ag.benimId = id;
      ag.oyuncular = [{ id, ad, ses: false }];
      nabizBaslat();
      tetikle('oda', { kod, ev: true });
      lobiYay();
    });
    peer.on('connection', bag => {
      const m0 = { bag, son: Date.now(), id: bag.peer };
      bag.on('data', m => { m0.son = Date.now(); if (m?.tip !== 'nabiz') evMesaji(m0, m); });
      const kapandi = () => oyuncuKoptu(bag.peer, bag);
      bag.on('close', kapandi); bag.on('error', kapandi);
      ag.baglantilar.set(bag.peer, m0);
    });
    peer.on('call', gelenArama);
    peer.on('error', e => {
      if (e.type === 'unavailable-id') return odaAc(ad);
      if (ag.mod !== 'ev') tetikle('hata', `Oda açılamadı (${e.type}).`);
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* kapanmış */ } });
  }

  function evMesaji(m0, m) {
    const id = m0.id;
    if (m.tip === 'katil') {
      if (ag.oyuncular.some(o => o.id === id)) return;
      const neden = kabulEt(ag.oyuncular.length);
      if (neden !== true) return reddet(m0.bag, neden);
      ag.oyuncular.push({ id, ad: String(m.ad || 'Oyuncu').slice(0, 14), ses: false });
      gonderId(id, { tip: 'kabul', id });
      lobiYay();
      tetikle('katildi', id);
      return;
    }
    if (!ag.oyuncular.some(o => o.id === id)) return;
    if (m.tip === 'ses') { const o = ag.oyuncular.find(x => x.id === id); o.ses = !!m.acik; lobiYay(); return; }
    tetikle('evMesaj', m, id);
  }
  function reddet(bag, neden) { try { bag.send({ tip: 'red', neden }); } catch (e) { /* */ } setTimeout(() => { try { bag.close(); } catch (e) { /* */ } }, 400); }
  function oyuncuKoptu(id, bag) {
    const m0 = ag.baglantilar.get(id);
    if (m0 && m0.bag !== bag) return;
    ag.baglantilar.delete(id);
    const o = ag.oyuncular.find(x => x.id === id);
    if (!o) return;
    ag.oyuncular = ag.oyuncular.filter(x => x.id !== id);
    lobiYay();
    tetikle('koptu', o);
  }
  // Oyuncu listesini herkese duyur (sıra = zincir sırası)
  function lobiYay(ek = {}) {
    if (ag.mod !== 'ev') return;
    const m = { tip: 'oyuncular', oyuncular: ag.oyuncular, ...ek };
    herkese(m);
    oyuncularGeldi(ag.oyuncular);
  }
  function herkese(m) { ag.baglantilar.forEach((m0, id) => { if (ag.oyuncular.some(o => o.id === id)) gonderId(id, m); }); }
  function gonderId(id, m) { const m0 = ag.baglantilar.get(id); if (m0?.bag.open) { try { m0.bag.send(m); } catch (e) { /* */ } } }

  // ---------- Misafir ----------
  function katil(kod, ad) {
    if (!peerVar()) return tetikle('hata', 'Bağlantı kütüphanesi yüklenemedi. İnterneti kontrol et.');
    kapat();
    kod = kod.trim().toUpperCase();
    const peer = new Peer();
    ag.peer = peer;
    peer.on('call', gelenArama);
    const zaman = setTimeout(() => { if (ag.peer === peer && ag.mod !== 'misafir') tetikle('hata', '20 saniyedir bağlanılamadı. Kodu ve interneti kontrol et; oda sahibinin oyunu açık olsun.'); }, 20000);
    peer.on('open', id => {
      ag.benimId = id;
      const bag = peer.connect(ODA_ONEKI + kod, { reliable: true });
      bag.on('open', () => { ag.ev = bag; ag.kod = kod; ag.sonEv = Date.now(); bag.send({ tip: 'katil', ad }); });
      bag.on('data', m => {
        ag.sonEv = Date.now();
        if (m?.tip === 'nabiz') return;
        if (m.tip === 'kabul') { clearTimeout(zaman); ag.mod = 'misafir'; nabizBaslat(); tetikle('oda', { kod, ev: false }); return; }
        if (m.tip === 'red') { clearTimeout(zaman); tetikle('hata', m.neden); kapat(); return; }
        if (m.tip === 'oyuncular') { oyuncularGeldi(m.oyuncular); }
        tetikle('mesaj', m);
      });
      const koptu = () => { if (ag.ev === bag && ag.mod === 'misafir') { tetikle('evKoptu'); kapat(); } };
      bag.on('close', koptu); bag.on('error', koptu);
    });
    peer.on('error', e => {
      if (ag.peer !== peer || ag.mod === 'misafir') return;
      clearTimeout(zaman);
      tetikle('hata', e.type === 'peer-unavailable' ? 'Bu kodla açık bir oda yok. Kodu kontrol et.' : `Bağlanılamadı (${e.type}).`);
    });
  }

  function nabizBaslat() {
    clearInterval(nabizSayac);
    nabizSayac = setInterval(() => {
      if (ag.mod === 'ev') {
        ag.baglantilar.forEach((m0, id) => {
          gonderId(id, { tip: 'nabiz' });
          if (Date.now() - m0.son > ZAMAN_ASIMI) { try { m0.bag.close(); } catch (e) { /* */ } oyuncuKoptu(id, m0.bag); }
        });
      } else if (ag.mod === 'misafir' && ag.ev) {
        try { ag.ev.send({ tip: 'nabiz' }); } catch (e) { /* */ }
        if (Date.now() - ag.sonEv > ZAMAN_ASIMI) { tetikle('evKoptu'); kapat(); }
      }
    }, NABIZ);
  }

  // Eve mesaj (ev kendisiyse doğrudan işlenir)
  function eveGonder(m) {
    if (ag.mod === 'ev') tetikle('evMesaj', m, ag.benimId);
    else if (ag.ev?.open) { try { ag.ev.send(m); } catch (e) { /* */ } }
  }
  // Evden herkese (kendisi dahil)
  function yayinla(m) {
    if (ag.mod !== 'ev') return;
    herkese(m);
    tetikle('mesaj', m);
  }

  function kapat() {
    clearInterval(nabizSayac);
    sesKapat(true);
    try { ag.peer?.destroy(); } catch (e) { /* */ }
    Object.assign(ag, { peer: null, mod: null, kod: null, benimId: null, oyuncular: [], ev: null });
    ag.baglantilar = new Map();
  }

  // ---------- Sesli sohbet ----------
  const ses = { akis: null, aramalar: new Map() };   // id → { call, audio }
  let duyulacaklar = () => new Set(ag.oyuncular.map(o => o.id));   // herkes herkesi duyar

  function oyuncularGeldi(liste) {
    ag.oyuncular = liste;
    tetikle('oyuncular', liste);
    sesGuncelle();
  }
  // Kimlerle ses bağlantısı olmalı? İkimizin de mikrofonu açık ve birbirimizi duymamız gerekiyorsa.
  function sesGuncelle() {
    const benAcik = !!ses.akis && ag.oyuncular.some(o => o.id === ag.benimId);
    const hedef = benAcik ? duyulacaklar() : new Set();
    const acikOlan = new Set(ag.oyuncular.filter(o => o.ses).map(o => o.id));
    ses.aramalar.forEach((a, id) => { if (!hedef.has(id) || !acikOlan.has(id)) aramaKapat(id); });
    if (!benAcik) return;
    hedef.forEach(id => {
      if (id === ag.benimId || !acikOlan.has(id) || ses.aramalar.has(id)) return;
      if (ag.benimId < id) aramaBagla(ag.peer.call(id, ses.akis));   // küçük kimlikli arar
    });
  }
  function gelenArama(call) {
    if (!ses.akis || !duyulacaklar().has(call.peer)) { try { call.close(); } catch (e) { /* */ } return; }
    call.answer(ses.akis);
    aramaBagla(call);
  }
  function aramaBagla(call) {
    if (!call) return;
    aramaKapat(call.peer);
    const audio = new Audio(); audio.autoplay = true; audio.setAttribute('playsinline', '');
    ses.aramalar.set(call.peer, { call, audio });
    call.on('stream', akis => { audio.srcObject = akis; audio.play().catch(() => {}); });
    const bitti = () => { if (ses.aramalar.get(call.peer)?.call === call) aramaKapat(call.peer); };
    call.on('close', bitti); call.on('error', bitti);
  }
  function aramaKapat(id) {
    const a = ses.aramalar.get(id);
    if (!a) return;
    ses.aramalar.delete(id);
    a.audio.srcObject = null;
    try { a.call.close(); } catch (e) { /* */ }
  }
  async function sesAc() {
    if (ses.akis) return true;
    try {
      ses.akis = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) { return false; }
    sesBildir(true);
    return true;
  }
  function sesKapat(sessiz) {
    if (ses.akis) ses.akis.getTracks().forEach(t => t.stop());
    ses.akis = null;
    ses.aramalar.forEach((a, id) => aramaKapat(id));
    if (!sessiz) sesBildir(false);
  }
  function sesBildir(acik) {
    if (ag.mod === 'ev') { const o = ag.oyuncular.find(x => x.id === ag.benimId); if (o) o.ses = acik; lobiYay(); }
    else if (ag.ev?.open) { try { ag.ev.send({ tip: 'ses', acik }); } catch (e) { /* */ } }
    sesGuncelle();
  }

  return {
    on, odaAc, katil, kapat, eveGonder, yayinla, lobiYay, gonderId, herkese, sesAc, sesKapat, sesGuncelle,
    duyulacaklariBelirle(fn) { duyulacaklar = fn; },
    kabulKurali(fn) { kabulEt = fn; },
    siraDegistir(liste) { if (ag.mod !== 'ev') return; ag.oyuncular = liste.map(id => ag.oyuncular.find(o => o.id === id)).filter(Boolean); lobiYay(); },
    get evMi() { return ag.mod === 'ev'; },
    get bagli() { return !!ag.mod; },
    get benimId() { return ag.benimId; },
    get kod() { return ag.kod; },
    get oyuncular() { return ag.oyuncular; },
    get sesAcik() { return !!ses.akis; },
    get sesBagli() { return [...ses.aramalar.keys()]; },
  };
})();
