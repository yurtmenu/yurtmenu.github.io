// Yurt Menüsü istatistik paneli. Veri GoatCounter'dan okuma izinli anahtarla çekilir;
// anahtar yalnız bu cihazın tarayıcı hafızasında durur. Panel kendi açılışını saymaz.
import {ARALIKLAR, aralik, grupla, seri, hataMesaji, etiket} from './hesap.js';

const $app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fmt = n => (+n || 0).toLocaleString('tr-TR');
const hafiza = {
  al(k){ try{ return localStorage.getItem('yurtpanel.' + k); }catch(e){ return null; } },
  koy(k, v){ try{ localStorage.setItem('yurtpanel.' + k, v); }catch(e){} },
  sil(k){ try{ localStorage.removeItem('yurtpanel.' + k); }catch(e){} },
};

// Yerelde denerken ?api=yerel ile sahte sunucu kullanılır; yayında her zaman GoatCounter.
const YEREL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const API = YEREL && new URLSearchParams(location.search).get('api') === 'yerel'
  ? location.origin + '/api/v0' : 'https://yurtmenu.goatcounter.com/api/v0';

const S = {
  anahtar: hafiza.al('anahtar') || '',
  secim: ARALIKLAR.some(a => a[0] === hafiza.al('aralik')) ? hafiza.al('aralik') : '7',
  veri: null, hata: '', yukleniyor: false, acik: new Set(), sira: 0,
};

/* ---------- veri ---------- */
const bekle = ms => new Promise(r => setTimeout(r, ms));
let sonIstek = 0;
async function iste(yol, q){
  // GoatCounter saniyede 4 istek kabul ediyor: istekler arasında en az 300 ms
  for(let deneme = 0; deneme < 3; deneme++){
    const fark = Date.now() - sonIstek;
    if(fark < 300) await bekle(300 - fark);
    sonIstek = Date.now();
    let res;
    try{ res = await fetch(`${API}${yol}?${new URLSearchParams(q)}`, {headers: {Authorization: 'Bearer ' + S.anahtar}, cache: 'no-store'}); }
    catch(e){ throw {status: 0}; }
    if(res.status === 429){ await bekle(1200 * (deneme + 1)); continue; }
    if(!res.ok) throw {status: res.status};
    return res.json();
  }
  throw {status: 429};
}

async function hepsiniCek(q){
  const hits = [], gorulen = [];
  for(let sayfa = 0; sayfa < 20; sayfa++){
    const r = await iste('/stats/hits', {...q, limit: 100, ...(gorulen.length ? {exclude_paths: gorulen.join(',')} : {})});
    const yeni = (r.hits || []).filter(h => !gorulen.includes(h.path_id));
    hits.push(...yeni);
    gorulen.push(...yeni.map(h => h.path_id));
    if(!r.more || !yeni.length) break;
  }
  return hits;
}

async function yukle(){
  const sira = ++S.sira;
  const ar = aralik(S.secim);
  S.yukleniyor = true; S.hata = ''; ciz();
  try{
    const q = {start: ar.start, end: ar.end};
    const hits = await hepsiniCek(q);
    let cihaz = [];
    try{ cihaz = (await iste('/stats/systems', {...q, limit: 10})).stats || []; }catch(e){ if(e.status === 401 || e.status === 403) throw e; }
    // GoatCounter sitesinin gösterdiği toplam (açılışlar + uygulama içi hareketler)
    let toplam = null;
    try{ toplam = await iste('/stats/total', q); }catch(e){ if(e.status === 401 || e.status === 403) throw e; }
    if(sira !== S.sira) return;
    S.veri = {ar, hits, cihaz, toplam, zaman: new Date()};
  }catch(e){
    if(sira !== S.sira) return;
    S.hata = hataMesaji(e && e.status, navigator.onLine !== false);
    if(e && (e.status === 401 || e.status === 403)){ S.anahtarHatasi = S.hata; }
  }
  S.yukleniyor = false; ciz();
}

/* ---------- çizim ---------- */
function anahtarEkrani(){
  $app.innerHTML = `<form class="key" id="keyForm" autocomplete="off">
    <h1>Yurt Panel</h1>
    <div class="keyrow">
      <input id="keyIn" type="password" placeholder="API anahtarını gir" aria-label="API anahtarı" spellcheck="false">
      <button class="btn" type="submit">Giriş</button>
    </div>
    ${S.anahtarHatasi ? `<p class="keyerr">${esc(S.anahtarHatasi)}</p>` : ''}
  </form>`;
  const k = document.getElementById('keyIn'); if(k && matchMedia('(pointer: fine)').matches) k.focus();
}

function grafik(v){
  const app = {}, tar = {};
  for(const h of v.hits){
    const yol = String(h.path || '').replace(/^\/+/, '');
    const hedef = yol === 'acilis/uygulama' ? app : yol === 'acilis/tarayici' ? tar : null;
    if(!hedef) continue;
    for(const st of h.stats || []){
      const d = seri([st], v.ar.saatlik);
      hedef[st.day] = (hedef[st.day] || []).map((x, i) => x + (d[i] || 0));
      if(!hedef[st.day].length) hedef[st.day] = d;
    }
  }
  // gün listesi: aralığın her günü (veri olmasa da boş çubuk)
  const gunler = [];
  for(let t = Date.parse(v.ar.start); t < Date.parse(v.ar.end); t += 86400e3){
    gunler.push(new Date(t + 3 * 3600e3).toISOString().slice(0, 10));
  }
  let a = [], b = [], et = [];
  for(const g of gunler){
    const n = v.ar.saatlik ? 24 : 1;
    const da = app[g] || Array(n).fill(0), db = tar[g] || Array(n).fill(0);
    a.push(...da); b.push(...db);
    if(v.ar.saatlik) for(let h = 0; h < 24; h++) et.push(h % 6 === 0 ? String(h).padStart(2, '0') + ':00' : '');
    else et.push(String(+g.slice(8)));
  }
  if(S.secim === 'bugun'){ const son = Math.max(1, Math.round((Date.parse(v.ar.end) - Date.parse(v.ar.start)) / 3600e3)); a = a.slice(0, son); b = b.slice(0, son); et = et.slice(0, son); }
  const N = a.length, max = Math.max(1, ...a.map((x, i) => x + b[i]));
  const dar = innerWidth < 600; // telefonda daha küçük çizim alanı = okunur yazılar
  const W = dar ? 360 : 640, H = dar ? 150 : 170, L = 26, B = 20, T = 8, w = (W - L) / Math.max(N, 1);
  const y = n => T + (H - T - B) * (1 - n / max);
  const cizgi = [...new Set([0, Math.floor(max / 2), max])];
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Açılış grafiği">`;
  for(const c of cizgi){ svg += `<line class="gl" x1="${L}" x2="${W}" y1="${y(c)}" y2="${y(c)}"/><text class="ax" x="${L - 6}" y="${y(c) + 4}" text-anchor="end">${fmt(Math.round(c))}</text>`; }
  const gosterEt = !v.ar.saatlik && N > (dar ? 8 : 16) ? Math.ceil(N / (dar ? 6 : 10)) : 1;
  for(let i = 0; i < N; i++){
    const x = L + i * w + w * .15, bw = Math.max(1, w * .7);
    const ha = (H - T - B) * a[i] / max, hb = (H - T - B) * b[i] / max;
    if(hb) svg += `<rect x="${x}" y="${H - B - hb}" width="${bw}" height="${hb}" rx="2" fill="var(--bar-2)"><title>${esc(et[i] || '')} tarayıcı ${b[i]}</title></rect>`;
    if(ha) svg += `<rect x="${x}" y="${H - B - hb - ha}" width="${bw}" height="${ha}" rx="2" fill="var(--bar)"><title>${esc(et[i] || '')} uygulama ${a[i]}</title></rect>`;
    if(et[i] && i % gosterEt === 0) svg += `<text class="ax" x="${x + bw / 2}" y="${H - 5}" text-anchor="middle">${esc(et[i])}</text>`;
  }
  svg += '</svg>';
  return `<section class="card chart"><h2>Açılışlar <span class="t">${v.ar.saatlik ? 'saat saat' : 'gün gün'}</span></h2>${svg}
    <div class="legend"><span><i style="background:var(--bar)"></i>Ana ekrandaki uygulama</span><span><i style="background:var(--bar-2)"></i>Tarayıcı</span></div></section>`;
}

function kutu(id, baslik, satirlar){
  const top = satirlar.reduce((s, r) => s + r.sayi, 0);
  const max = Math.max(1, ...satirlar.map(r => r.sayi));
  const acik = S.acik.has(id), gor = acik ? satirlar : satirlar.slice(0, 8);
  const govde = satirlar.length
    ? `<ul class="rows">${gor.map(r => `<li><span class="ad">${esc(r.ad)}</span><span class="say">${fmt(r.sayi)}</span><span class="cubuk"><b style="width:${(100 * r.sayi / max).toFixed(1)}%"></b></span></li>`).join('')}</ul>
       ${satirlar.length > 8 ? `<button class="more" data-more="${id}">${acik ? 'Daha az göster' : `Tümünü göster (${satirlar.length})`}</button>` : ''}`
    : `<p class="empty">Bu aralıkta kayıt yok.</p>`;
  return `<section class="card"><h2>${esc(baslik)}${satirlar.length ? `<span class="t">toplam ${fmt(top)}</span>` : ''}</h2>${govde}</section>`;
}

function ciz(){
  // Anahtar reddedildiyse silinir ve anahtar ekranına dönülür (yanlış anahtar kayıtlı kalmasın)
  if(S.anahtarHatasi && S.anahtar){ hafiza.sil('anahtar'); S.anahtar = ''; S.veri = null; S.hata = ''; }
  if(!S.anahtar) return anahtarEkrani();
  const v = S.veri;
  const seg = ARALIKLAR.map(([k, ad]) => `<button data-ar="${k}" aria-pressed="${k === S.secim}">${ad}</button>`).join('');
  let govde = '';
  if(v){
    const {acilis, gruplar} = grupla(v.hits);
    const g = k => (gruplar[k] || []).map(r => ({ad: etiket(k, r.ad), sayi: r.sayi}));
    const oran = acilis.toplam ? Math.round(100 * acilis.uygulama / acilis.toplam) : 0;
    const ayarlar = [...g('tema'), ...g('ayar')].sort((a, b) => b.sayi - a.sayi);
    const diger = [...g('guncelleme'), ...g('diger')].sort((a, b) => b.sayi - a.sayi);
    govde = `<div class="tiles">
        <div class="tile"><div class="n">${fmt(acilis.toplam)}</div><div class="l">Açılış</div></div>
        <div class="tile"><div class="n">${fmt(acilis.uygulama)}</div><div class="l">Ana ekrandan</div></div>
        <div class="tile"><div class="n">${fmt(acilis.tarayici)}</div><div class="l">Tarayıcıdan</div></div>
        <div class="tile"><div class="n">%${oran}</div><div class="l">Ana ekrandan açılma oranı</div></div>
        ${v.toplam ? `<div class="tile genis"><div class="n">${fmt(v.toplam.total)}</div><div class="l">Tüm kayıtlar (açılış + hareketler, GoatCounter'daki toplam)</div></div>` : ''}
      </div>
      ${grafik(v)}
      <div class="grid">
        ${kutu('bolum', 'Bölümler', g('bolum'))}
        ${kutu('arama', 'Aramalar', g('arama'))}
        ${kutu('sonucsuz', 'Sonuç çıkmayan aramalar', g('arama-sonucsuz'))}
        ${kutu('paylas', 'Paylaşımlar', g('paylas'))}
        ${kutu('kurulum', 'Kurulum', g('kurulum'))}
        ${kutu('ayar', 'Ayarlar', ayarlar)}
        ${kutu('alerjen', 'Alerjenler', g('alerjen'))}
        ${kutu('cihaz', 'Cihazlar', (v.cihaz || []).map(c => ({ad: c.name || 'Bilinmiyor', sayi: +c.count || 0})))}
        ${diger.length ? kutu('diger', 'Diğer', diger) : ''}
      </div>`;
  } else if(!S.hata){
    govde = `<p class="empty">Yükleniyor…</p>`;
  }
  const saat = v ? v.zaman.toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'}) : '';
  $app.innerHTML = `<header><div><h1>Yurt Panel</h1><div class="sub">${S.yukleniyor ? 'Güncelleniyor…' : saat ? `Son güncelleme ${saat}` : ''}</div></div>
      <span class="sp"></span><button class="btn" id="yenile" ${S.yukleniyor ? 'disabled' : ''}>Yenile</button></header>
    <nav class="seg" aria-label="Zaman aralığı">${seg}</nav>
    ${S.hata ? `<div class="err">${esc(S.hata)}</div>` : ''}
    <main class="${S.yukleniyor && v ? 'loading' : ''}">${govde}</main>
    <footer><span>Aynı kişinin kısa sürede tekrar açması bir kez sayılır.</span><button class="btn" id="unut">Çıkış</button></footer>`;
}

/* ---------- olaylar ---------- */
document.addEventListener('click', e => {
  const ar = e.target.closest('[data-ar]');
  if(ar){ S.secim = ar.dataset.ar; hafiza.koy('aralik', S.secim); S.acik.clear(); yukle(); return; }
  if(e.target.closest('#yenile')){ yukle(); return; }
  const m = e.target.closest('[data-more]');
  if(m){ const id = m.dataset.more; S.acik.has(id) ? S.acik.delete(id) : S.acik.add(id); ciz(); return; }
  if(e.target.closest('#unut')){
    if(!confirm('Çıkış yapılsın mı? Tekrar girmek için API anahtarı gerekecek.')) return;
    hafiza.sil('anahtar'); S.anahtar = ''; S.veri = null; S.hata = ''; S.anahtarHatasi = ''; ciz();
  }
});
document.addEventListener('submit', e => {
  if(e.target.id !== 'keyForm') return;
  e.preventDefault();
  const k = document.getElementById('keyIn').value.trim();
  if(!k) return;
  S.anahtar = k; S.anahtarHatasi = ''; hafiza.koy('anahtar', k); yukle();
});
// Ekran genişliği değişince (telefon çevrilince) grafik yeniden çizilir
let genislik = innerWidth;
addEventListener('resize', () => { if((genislik < 600) !== (innerWidth < 600) && S.veri) ciz(); genislik = innerWidth; });
// Uygulama arka plandan geri gelince ve 5 dakikada bir tazele
document.addEventListener('visibilitychange', () => { if(!document.hidden && S.anahtar && S.veri && Date.now() - S.veri.zaman > 60e3) yukle(); });
setInterval(() => { if(!document.hidden && S.anahtar && !S.yukleniyor) yukle(); }, 5 * 60e3);

S.anahtar ? yukle() : ciz();
