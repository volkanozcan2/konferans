# Konferans Salonu Rezervasyon (Static + Supabase)

Bu proje tamamen istemci tarafında çalışan (HTML/CSS/vanilla JS) haftalık konferans salonu rezervasyon uygulamasıdır.

## Dosyalar

- `index.html`
- `styles.css`
- `app.js`
- `supabase_schema.sql`
- `.env.example`

## 1. Supabase kurulumu

1. Supabase'te yeni proje açın.
2. **SQL Editor** içinde `supabase_schema.sql` dosyasını çalıştırın.
3. **Authentication > Providers** altında e-posta/şifre girişini açın.
4. En az bir kullanıcı oluşturun (Auth Users bölümünden davet veya sign-up ile).
5. **Project Settings > API** kısmından:
   - `Project URL`
   - `anon public key`
   değerlerini alın.

## 2. `app.js` konfigürasyonu

`app.js` içinde aşağıdaki satırları kendi değerlerinizle güncelleyin:

```js
const SUPABASE_URL = window.SUPABASE_URL || "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";
```

İsterseniz `index.html` içinde `app.js` çağrısından önce şunu ekleyebilirsiniz:

```html
<script>
  window.SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
  window.SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
</script>
```

## 3. Lokal çalıştırma

Bu proje static olduğu için herhangi bir basit HTTP server yeterlidir:

```bash
python3 -m http.server 5173
```

Sonra tarayıcıdan:

`http://localhost:5173`

adresini açın.

## 4. Özellikler

- E-posta/şifre ile giriş
- Pazartesi-Cuma haftalık grid
- Ders slotları: 40 dk ders + 10 dk ara
- Öğle arası destekli yapı (12:10-12:50)
- Rezervasyon ekleme/düzenleme/silme
- Aynı tarih + başlangıç saati için çakışmayı DB seviyesinde engelleme
- Yazdırma dostu görünüm
- Mobil uyumlu arayüz

## 5. Firebase fallback

Supabase kullanılamazsa Firebase Auth + Firestore ile aynı veri modelini uygulayabilirsiniz. Bu sürüm Supabase öncelikli hazırlanmıştır.
