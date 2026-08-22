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

## Dağıtım

Cloudflare Pages ile GitHub'dan otomatik deploy edilir (`main` dalına push yeterli).
