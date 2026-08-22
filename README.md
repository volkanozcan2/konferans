# Konferans Salonu Rezervasyon

Static (HTML/CSS/JS) konferans salonu rezervasyon uygulaması. Kimlik doğrulama ve veri
depolama (rezervasyonlar, denetim kaydı) [Supabase](https://supabase.com) üzerinden.

## Çalıştırma

```bash
python3 -m http.server 5173
```

Sonra `http://localhost:5173` adresini açın.

## Supabase kurulumu

`app.js` içinde `SUPABASE_URL` ve `SUPABASE_ANON_KEY` sabitleri tanımlı (anon/public
key olduğu için repoda tutulması güvenlidir — asıl erişim kontrolü Supabase'deki RLS
politikalarıyla sağlanır).

Yeni bir Supabase projesiyle çalışmak için:

1. `reservations` ve `audit_log` tablolarını ve RLS politikalarını oluşturun.
2. Authentication → Users'tan kullanıcı ekleyin (e-posta olarak `<kullanici_adi>@konferans.local`
   kullanılır — giriş ekranında kullanıcılar sadece kullanıcı adını girer, e-posta hiç
   görünmez). `user_metadata` alanına `{"display_name": "..."}` ekleyin.
3. Yönetici paneline erişecek hesaplara `user_metadata`'da `{"is_admin": true}` ekleyin.

Gerçek şifreler asla bu repoya veya koda girmemeli; sadece Supabase panelinden yönetilir.

### Toplu kullanıcı ekleme

Tek tek Dashboard'dan eklemek yerine, çok sayıda öğretmeni tek seferde eklemek için
`scripts/bulk-create-users.mjs` kullanılabilir:

1. `scripts/users.example.json` dosyasını `scripts/users.local.json` olarak kopyalayıp
   gerçek kullanıcı adı/şifre/isim bilgileriyle doldurun (bu dosya `.gitignore`'da,
   asla commit'lenmez).
2. Supabase panelinde **Settings → API → API Keys**'ten **`service_role` / secret**
   anahtarını alın. Bu anahtar çok yetkilidir (RLS'i bypass eder) — sadece kendi
   makinenizde, ortam değişkeni olarak kullanın, hiçbir zaman koda/repoya
   yazmayın veya paylaşmayın.
3. Script'i çalıştırın:

   ```bash
   SUPABASE_SERVICE_ROLE_KEY=<service_role_anahtarınız> node scripts/bulk-create-users.mjs
   ```

Script her kullanıcı için `<kullanici_adi>@konferans.local` e-postasıyla bir Supabase
Auth hesabı oluşturur ve `display_name`/`is_admin` bilgisini `user_metadata`'ya yazar.

## Dağıtım

Cloudflare Pages ile GitHub'dan otomatik deploy edilir (`main` dalına push yeterli).
