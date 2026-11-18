// Panelin saf hesapları (tarayıcıya ve teste ortak). Türkiye saati sabit UTC+3 (yaz saati yok).
const TR = 3 * 3600e3;
const p2 = n => String(n).padStart(2, '0');
// Türkiye saatinde "gün başından itibaren n gün önce" ya da verilen saate göre ISO metni
const iso = d => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:00:00+03:00`;

export const ARALIKLAR = [
  ['bugun', 'Bugün'], ['dun', 'Dün'], ['3', '3 gün'], ['7', '7 gün'], ['30', '30 gün'], ['tumu', 'Tümü'],
];
export const BASLANGIC = '2026-11-01T00:00:00+03:00'; // sayacın kurulduğu ay

export function aralik(secim, simdi = new Date()) {
  const yerel = new Date(simdi.getTime() + TR);            // UTC alanları = Türkiye saati
  const gun = new Date(Date.UTC(yerel.getUTCFullYear(), yerel.getUTCMonth(), yerel.getUTCDate()));
  const gunOnce = n => new Date(gun.getTime() - n * 86400e3);
  const sonraki = new Date(Date.UTC(yerel.getUTCFullYear(), yerel.getUTCMonth(), yerel.getUTCDate(), yerel.getUTCHours() + 1));
  if (secim === 'dun') return {start: iso(gunOnce(1)), end: iso(gun), saatlik: true};
  if (secim === 'bugun') return {start: iso(gun), end: iso(sonraki), saatlik: true};
  if (secim === 'tumu') return {start: BASLANGIC, end: iso(sonraki), saatlik: false};
  const n = Math.max(1, parseInt(secim, 10) || 7);
  return {start: iso(gunOnce(n - 1)), end: iso(sonraki), saatlik: false};
}

const GRUPLAR = ['bolum', 'arama', 'arama-sonucsuz', 'paylas', 'kurulum', 'alerjen', 'tema', 'ayar', 'guncelleme'];

export function grupla(hits) {
  const acilis = {uygulama: 0, tarayici: 0, toplam: 0};
  const say = {};
  for (const h of hits || []) {
    const yol = String(h.path || '').replace(/^\/+/, '');
    const n = +h.count || 0;
    const i = yol.indexOf('/');
    const bas = i < 0 ? yol : yol.slice(0, i), kalan = i < 0 ? '' : yol.slice(i + 1);
    if (bas === 'acilis') {
      if (kalan === 'uygulama' || kalan === 'tarayici') acilis[kalan] += n;
      acilis.toplam += n;
      continue;
    }
    const grup = GRUPLAR.includes(bas) && kalan ? bas : 'diger';
    const ad = grup === 'diger' ? yol : kalan;
    ((say[grup] ||= {})[ad] = (say[grup][ad] || 0) + n);
  }
  const gruplar = {};
  for (const [g, satirlar] of Object.entries(say)) {
    gruplar[g] = Object.entries(satirlar).map(([ad, sayi]) => ({ad, sayi}))
      .sort((a, b) => b.sayi - a.sayi || a.ad.localeCompare(b.ad, 'tr'));
  }
  return {acilis, gruplar};
}

export function seri(stats, saatlik) {
  return saatlik ? (stats || []).flatMap(s => s.hourly || Array(24).fill(0)) : (stats || []).map(s => s.daily || 0);
}

/* ---------- olay adlarının okunur Türkçesi ---------- */
// Menü uygulaması olay adlarını Türkçe karaktersiz gönderir (ör. ayar/yazi/buyuk); burada geri çevrilir.
// Yeni olay eklenince buraya da ekle; bilinmeyenler kabaca okunur hale getirilir.
const ALERJEN = ['Gluten', 'Kabuklu deniz ürünü', 'Yumurta', 'Süt', 'Balık', 'Hardal', 'Yer fıstığı', 'Soya', 'Kereviz',
  'Acı bakla', 'Sert kabuklu yemiş', 'Sülfit', 'Yumuşakça', 'Susam'];
const katla = s => s.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/\s+/g, '-');
const ALERJEN_AD = Object.fromEntries(ALERJEN.map(a => [katla(a), a]));
const OGUN = {kahvalti: 'Kahvaltı', aksam: 'Akşam yemeği'};
const ETIKET = {
  bolum: {gun: 'Gün', ay: 'Ay (takvim)', ara: 'Arama', ayar: 'Ayarlar'},
  paylas: {'gun-dugmesi': 'Günün menüsü (üstteki düğme)', uygulama: 'Uygulama linki'},
  kurulum: {
    'oneri/android': 'Kurulum önerisi gösterildi (Android)', 'oneri/android-menu': 'Kurulum önerisi gösterildi (Android, menüden)',
    'oneri/ios': 'Kurulum önerisi gösterildi (iPhone)', 'oneri/uygulama-ici': 'Kurulum önerisi gösterildi (uygulama içi tarayıcı)',
    yukle: '“Yükle”ye basıldı', kabul: 'Kurulum onaylandı', ret: 'Kurulum reddedildi', sonra: '“Sonra” denildi',
    kuruldu: 'Uygulama kuruldu', ayarlardan: 'Ayarlardan kurulum açıldı', 'tarayicida-ac': '“Tarayıcıda aç”a basıldı',
  },
  tema: {sistem: 'Tema: sistem', acik: 'Tema: açık', koyu: 'Tema: koyu'},
  ayar: {
    'yazi/buyuk': 'Yazı boyutu: büyük', 'yazi/normal': 'Yazı boyutu: normal',
    'kalori/ac': 'Öğün kalorileri: açıldı', 'kalori/kapat': 'Öğün kalorileri: kapatıldı',
    'gecmis-arama/ac': 'Aramada geçmiş günler: açıldı', 'gecmis-arama/kapat': 'Aramada geçmiş günler: kapatıldı',
    'sonraki-ogun/ac': 'Saati geçince sonraki öğün: açıldı', 'sonraki-ogun/kapat': 'Saati geçince sonraki öğün: kapatıldı',
  },
  guncelleme: {
    yenile: 'Yeni sürüm: “Yenile”ye basıldı (eski bildirim)',
    sessiz: 'Yeni sürüme kendiliğinden geçildi', denetle: 'Ayarlardan güncelleme denetlendi', elle: 'Ayarlardan yeni sürüm kuruldu',
  },
  diger: {'hakkinda/github': 'Hakkında: GitHub sayfası açıldı'},
};
const kaba = s => s.replace(/[-/]+/g, ' ').trim();

export function etiket(grup, ad) {
  if (grup.startsWith('arama')) return ad;                 // aranan kelime olduğu gibi
  if (ETIKET[grup] && ETIKET[grup][ad]) return ETIKET[grup][ad];
  if (grup === 'alerjen') {
    const i = ad.lastIndexOf('/'), ne = ad.slice(0, i), eylem = ad.slice(i + 1);
    const isim = ALERJEN_AD[ne] || kaba(ne);
    return eylem === 'kapat' ? `${isim}: gizlendi` : eylem === 'ac' ? `${isim}: gösterildi` : kaba(ad);
  }
  if (grup === 'paylas' && ad.split('+').every(k => OGUN[k])) {
    const o = ad.split('+').map(k => OGUN[k]);
    return o.length > 1 ? o[0] + ' ve ' + o.slice(1).join(' ve ').toLocaleLowerCase('tr-TR') : o[0];
  }
  return kaba(ad);
}

export function hataMesaji(status, cevrimici = true) {
  if (status === 401 || status === 403) return 'Anahtar geçersiz ya da okuma izni yok.';
  if (status === 429) return 'GoatCounter çok sık istek dedi. Biraz sonra Yenile\'ye bas.';
  if (!cevrimici) return 'İnternet bağlantısı yok.';
  // İnternet varken istek hiç cevap almadıysa neredeyse her zaman reklam/takip engelleyicidir
  if (!status) return "GoatCounter'a bağlanılamadı. Büyük ihtimalle reklam engelleyici engelliyor: bu tarayıcıda yurtmenu.github.io için engellemeyi kapat, sonra Yenile'ye bas.";
  return `GoatCounter hata verdi (${status}). Biraz sonra Yenile'ye bas.`;
}
