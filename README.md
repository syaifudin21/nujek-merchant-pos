# Nujek Merchant — Open API v1 (Svelte Sample)

Contoh aplikasi Svelte (Vite) untuk mengakses Open API v1 Nujek Merchant.
Semua 6 endpoint read-only tersedia, dengan signing HMAC-SHA256 di browser
(Web Crypto API).

## Jalankan

```bash
npm install
npm run dev        # buka http://localhost:5173
npm run build      # build produksi -> dist/
```

## Cara pakai

1. Buat API key di aplikasi Nujek Merchant → Pengaturan → Developer
   (owner/manager). Secret hanya ditampilkan sekali saat dibuat.
2. Isi **API Key**, **Secret**, dan **ID Toko** di aplikasi.
3. Pilih base URL (Staging / Produksi).
4. Klik salah satu tombol endpoint — respons JSON tampil di bawah.

**Penting — IP whitelist:** key terikat ke satu toko dan wajib punya
minimal 1 IP whitelist. IP publik komputer kamu harus masuk whitelist,
kalau tidak server menjawab `403 "ip tidak diizinkan"`.

## Autentikasi (HMAC-SHA256)

Secret **tidak pernah dikirim**. Setiap request ditandatangani dan membawa
3 header:

```
X-API-Key: <redacted>
X-Timestamp: 1762580000
X-Signature: <hex HMAC-SHA256>
```

- Kunci HMAC = 32 byte mentah secret (base64url-decode), BUKAN hash-nya.
- String kanonik (pemisah `\n`): `METHOD\nURL\nTIMESTAMP\nHEX(SHA-256(body))`
  - `URL` = path + query persis seperti diterima server
    (mis. `/open/v1/stores/<id>/orders?status=complete`)
  - GET = body kosong → SHA-256("") = `e3b0c44298fc...`
- `X-Timestamp` = Unix detik; selisih dengan jam server maks ±5 menit.
- Implementasi: `src/lib/openapi.js` (`signRequest`, `callOpenApi`).
  Signature-nya terverifikasi identik dengan implementasi referensi Python.

## Endpoint (v1, read-only)

| Endpoint | Scope |
|---|---|
| `GET /open/v1/stores/:storeId` | `read:store` |
| `GET /open/v1/stores/:storeId/menu` | `read:menu` |
| `GET /open/v1/stores/:storeId/orders` (+ `?status=`) | `read:orders` |
| `GET /open/v1/stores/:storeId/orders/:tid` | `read:orders` |
| `GET /open/v1/stores/:storeId/tables` | `read:tables` |
| `GET /open/v1/stores/:storeId/reports/summary` | `read:reports` |

Rate limit per key: 100/menit & 5.000/hari → 429 + header `Retry-After`.

## CORS & proxy dev

Browser hanya boleh mengirim header `X-API-Key`, `X-Timestamp`,
`X-Signature` bila server mengizinkannya di CORS. Ada dua mode:

- **Proxy dev (default, dicentang):** request ke `/api/...` diteruskan Vite
  ke API staging (`vite.config.js`). Tidak kena CORS, hanya saat
  `npm run dev`. Cocok untuk mencoba langsung.
- **Langsung (tanpa centang):** browser memanggil base URL secara langsung.
  Butuh backend yang mengizinkan header X-* di CORS — perbaikan
  `AllowHeaders` di `cmd/api/main.go` (pos-api-go) sudah dibuat tapi
  **belum di-push**; sampai di-push, mode langsung akan diblokir browser.

## Keamanan

Secret disimpan di `localStorage` browser ini saja dan dipakai hanya untuk
menghitung signature — tidak pernah dikirim ke server mana pun. Ini sample
untuk mencoba; **untuk integrasi produksi, lakukan signing di server
sendiri** dan jangan pernah mengekspos secret di aplikasi yang dibagikan
ke publik.
