#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SUPABASE_URL = "https://msggolytyegvgbffldfb.supabase.co";
const EMAIL_DOMAIN = "konferans.local";

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  console.error("Hata: SUPABASE_SERVICE_ROLE_KEY ortam değişkeni ayarlı değil.");
  console.error("Örnek kullanım:");
  console.error("  SUPABASE_SERVICE_ROLE_KEY=... node scripts/bulk-create-users.mjs");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const usersFile = process.argv[2] || join(__dirname, "users.local.json");

let users;
try {
  users = JSON.parse(readFileSync(usersFile, "utf8"));
} catch (err) {
  console.error(`Kullanıcı listesi okunamadı (${usersFile}): ${err.message}`);
  console.error("scripts/users.example.json dosyasını scripts/users.local.json olarak kopyalayıp doldurun.");
  process.exit(1);
}

if (!Array.isArray(users) || users.length === 0) {
  console.error("Kullanıcı listesi boş veya geçersiz (bir JSON dizisi olmalı).");
  process.exit(1);
}

let created = 0;
let failed = 0;

for (const user of users) {
  const { username, password, display_name, is_admin } = user;

  if (!username || !password || !display_name) {
    console.error(`Atlandı: eksik alan (username/password/display_name) — ${JSON.stringify(user)}`);
    failed += 1;
    continue;
  }

  if (password.length < 6) {
    console.error(`Atlandı: şifre en az 6 karakter olmalı — ${username}`);
    failed += 1;
    continue;
  }

  const email = `${username.toLowerCase().replace(/\s+/g, "")}@${EMAIL_DOMAIN}`;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name,
        is_admin: Boolean(is_admin)
      }
    })
  });

  if (response.ok) {
    console.log(`✓ Oluşturuldu: ${username} (${email})`);
    created += 1;
  } else {
    const body = await response.json().catch(() => ({}));
    console.error(`✗ Başarısız: ${username} — ${body.msg || body.error_description || response.statusText}`);
    failed += 1;
  }
}

console.log(`\nTamamlandı: ${created} oluşturuldu, ${failed} başarısız/atlandı.`);
