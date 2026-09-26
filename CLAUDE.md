# Proje hafızası

Bu projenin hafızası Obsidian vault'unda:
`C:\Users\CenkKalinolgu\Documents\Vault\Projelerim\Spring Boot Projelerim\ts-study\`

Genel Spring Boot bilgisi: `C:\Users\CenkKalinolgu\Documents\Vault\Teknoloji Notlarim\Spring Boot\`

## Oturum başında
1. `Durum.md` dosyasını oku (kaldığımız yer, sıradaki işler).
2. İş mimariyle ilgiliyse `Mimari.md`, "neden böyle?" sorusuysa `Kararlar.md`, hata ayıklıyorsan `Hatalar.md` oku.
3. Projeyi baştan tarama; vault'taki notlar yeterliyse oradan çalış. Notta olmayan veya eski görünen bir şey varsa koda bak ve notu düzelt.

## Oturum sonunda (ben "vault'u güncelle" dediğimde)
- `Durum.md`: ne yapıldı, sıradaki işler.
- `Kararlar.md`: alınan kararlar ve nedenleri.
- `Hatalar.md`: yaşanan hata, kök neden, çözüm (en üste ekle).
- Ders genelse `Teknoloji Notlarim/Spring Boot/Spring Boot Tuzaklar.md` dosyasına da ekle.
- Notlar Türkçe. Gizli değer (şifre, token, anahtar) hiçbir nota yazma.

## Claude test hesapları (geliştirme veritabanı)
Backend'i denemek için Claude'a ayrılmış kalıcı hesaplar var. Her seferinde yeniden oluşturma, bunları kullan.
- Hesaplar: `claude-sahip@test.local` (klinik sahibi), `claude-psikolog1@test.local`, `claude-psikolog2@test.local`. Klinik: "Claude Test Kliniği", her psikologda 2 danışan.
- **Şifre repoda yok.** Kullanıcı ortam değişkeni `CLAUDE_TEST_PASSWORD` içinde. Değerini hiçbir yere yazma, ekrana da basma. Betikler onu kendisi okur.
- Betikler `backend/scripts/`: `setup-test-accounts.ps1` (hesap, klinik, danışan kurar, tekrar çalıştırmak güvenli), `test-risk.ps1` (risk uçları, kalıcı kontrol listesi), `test-email-case.ps1` (e-posta büyük/küçük harf ve Türkçe `I` tuzağı), `remove-test-accounts.ps1` (hesapları ve kliniği siler), `TestLib.ps1` (ortak yardımcılar).
- Çalıştırma: backend `localhost:3000`'de açık olmalı, sonra `powershell -NoProfile -ExecutionPolicy Bypass -File backend\scripts\<betik>.ps1`. Yeni özellik eklenince ilgili `test-*.ps1` betiğini de yaz.
- Uyarı: JVM varsayılan locale'i `tr_TR`. Büyük/küçük harf çevirirken `toLowerCase(Locale.ROOT)` kullan, yoksa `I` → `ı` olur.
- Kaldırmak için: `remove-test-accounts.ps1` çalıştır, `CLAUDE_TEST_PASSWORD` değişkenini sil, bu bölümü ve `backend/scripts/` içindeki dosyaları kaldır.

## Proje kısa bilgi
- `backend/`: Spring Boot 4.1.1, Java 21, JdbcTemplate (JPA yok), PostgreSQL, JWT.
- `frontend/`: React 19 + TypeScript + Vite.
