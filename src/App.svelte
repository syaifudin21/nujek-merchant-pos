<script>
  import { callOpenApi, ENDPOINTS } from './lib/openapi.js';

  const STAGING = 'https://staging-merchant-api.nujek.co.id';
  const PROD = 'https://merchant-api.nujek.co.id';

  // Kredensial disimpan di localStorage (sample saja — untuk produksi,
  // signing dilakukan di server, secret jangan sampai ke browser).
  const saved = JSON.parse(localStorage.getItem('nujek-openapi') || '{}');

  let baseUrl = $state(saved.baseUrl || STAGING);
  let apiKey = $state(saved.apiKey || '');
  let secret = $state(saved.secret || '');
  let storeId = $state(saved.storeId || '');
  let useProxy = $state(saved.useProxy !== false);
  let showSecret = $state(false);
  let orderStatus = $state('');
  let orderTid = $state('');

  let loading = $state(false);
  let error = $state('');
  let result = $state(null); // {endpoint, path, fetchUrl, ...res}
  let showSign = $state(false);
  let copied = $state(false);

  function saveSettings() {
    localStorage.setItem(
      'nujek-openapi',
      JSON.stringify({ baseUrl, apiKey, secret, storeId, useProxy }),
    );
  }

  function fetchUrlFor(path) {
    if (useProxy) return '/api' + path;
    return baseUrl.replace(/\/$/, '') + path;
  }

  function missing(field, label) {
    if (!field.trim()) {
      error = `Isi dulu ${label}.`;
      return true;
    }
    return false;
  }

  async function call(ep) {
    error = '';
    result = null;
    showSign = false;
    if (missing(apiKey, 'API Key')) return;
    if (missing(secret, 'Secret')) return;
    if (missing(storeId, 'ID Toko')) return;
    if (ep.needsTid && missing(orderTid, 'ID transaksi (tid)')) return;

    const path = ep.path(storeId.trim(), {
      status: orderStatus,
      tid: orderTid.trim(),
    });
    loading = true;
    try {
      const res = await callOpenApi({
        apiKey: apiKey.trim(),
        secret: secret.trim(),
        path,
        fetchUrl: fetchUrlFor(path),
      });
      result = { endpoint: ep, path, fetchUrl: fetchUrlFor(path), ...res };
      if (res.status >= 400) {
        error =
          res.data?.error ||
          `HTTP ${res.status} ${res.statusText || ''}`.trim();
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function statusClass(s) {
    if (!s) return '';
    if (s >= 200 && s < 300) return 'ok';
    if (s === 429) return 'warn';
    return 'err';
  }

  async function copyJson() {
    if (!result) return;
    await navigator.clipboard.writeText(
      result.data ? JSON.stringify(result.data, null, 2) : result.text,
    );
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }
</script>

<main>
  <header>
    <h1>Nujek Merchant <span>Open API v1</span></h1>
    <p>
      Contoh akses Open API (read-only) dengan Svelte. Setiap request
      ditandatangani HMAC-SHA256 — secret tidak pernah dikirim, hanya
      dipakai menghitung signature di browser.
    </p>
  </header>

  <section class="card">
    <h2>Kredensial</h2>
    <p class="hint">
      Buat key di aplikasi Nujek Merchant → Pengaturan → Developer (owner/manager).
      Secret hanya ditampilkan sekali saat dibuat. Key terikat ke satu toko dan
      wajib punya minimal 1 IP whitelist — <strong>IP publik kamu harus masuk
      whitelist</strong>, kalau tidak server menjawab 403 "ip tidak diizinkan".
    </p>
    <div class="grid">
      <label>
        Base URL
        <select bind:value={baseUrl} onchange={saveSettings}>
          <option value={STAGING}>Staging — {STAGING}</option>
          <option value={PROD}>Produksi — {PROD}</option>
        </select>
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={useProxy} onchange={saveSettings} />
        Pakai proxy dev (/api) — tanpa CORS, hanya saat <code>npm run dev</code>
      </label>
      <label>
        API Key
        <input
          type="text"
          placeholder="nk_live_..."
          bind:value={apiKey}
          oninput={saveSettings}
          autocomplete="off"
        />
      </label>
      <label>
        Secret
        <span class="secret-row">
          <input
            type={showSecret ? 'text' : 'password'}
            placeholder="43 karakter base64url"
            bind:value={secret}
            oninput={saveSettings}
            autocomplete="off"
          />
          <button type="button" class="ghost" onclick={() => (showSecret = !showSecret)}>
            {showSecret ? 'Sembunyikan' : 'Lihat'}
          </button>
        </span>
      </label>
      <label>
        ID Toko (storeId)
        <input
          type="text"
          placeholder="store_..."
          bind:value={storeId}
          oninput={saveSettings}
          autocomplete="off"
        />
      </label>
    </div>
  </section>

  <section class="card">
    <h2>Endpoint</h2>
    <div class="endpoints">
      {#each ENDPOINTS as ep}
        <button
          type="button"
          onclick={() => call(ep)}
          disabled={loading}
          class="ep"
        >
          <strong>{ep.label}</strong>
          <code>{ep.path(':storeId', {})}</code>
          <span class="scope">{ep.scope}</span>
        </button>
      {/each}
    </div>
    <div class="filters">
      <label>
        Filter status pesanan
        <select bind:value={orderStatus}>
          <option value="">Semua</option>
          <option value="pending">pending</option>
          <option value="complete">complete</option>
          <option value="void">void</option>
        </select>
      </label>
      <label>
        ID transaksi (untuk Detail Pesanan)
        <input type="text" placeholder="tid / ID transaksi" bind:value={orderTid} />
      </label>
    </div>
  </section>

  {#if loading}
    <p class="loading">Mengirim request…</p>
  {/if}

  {#if error}
    <div class="error">
      <strong>Gagal:</strong> {error}
    </div>
  {/if}

  {#if result}
    <section class="card">
      <div class="result-head">
        <h2>{result.endpoint.label}</h2>
        <span class="badge {statusClass(result.status)}">
          {result.status} {result.statusText}
        </span>
        <span class="ms">{result.ms} ms</span>
        <button type="button" class="ghost" onclick={copyJson}>
          {copied ? 'Disalin ✓' : 'Salin JSON'}
        </button>
      </div>
      <p class="mono small">{result.fetchUrl}</p>

      <button
        type="button"
        class="ghost"
        onclick={() => (showSign = !showSign)}
      >
        {showSign ? '▾ Sembunyikan detail signature' : '▸ Lihat detail signature (HMAC)'}
      </button>
      {#if showSign}
        <pre class="sign">{`Method:    GET
URL:       ${result.path}
Timestamp: ${result.sign.timestamp}
Body hash: ${result.sign.bodyHash}
Canonical:
${result.sign.canonical}
Signature: ${result.sign.signature}`}</pre>
      {/if}

      <pre class="json">{result.data
        ? JSON.stringify(result.data, null, 2)
        : result.text}</pre>
    </section>
  {/if}

  <footer>
    <p>
      Secret tersimpan di localStorage browser ini saja dan tidak pernah dikirim
      ke server mana pun kecuali sebagai HMAC signature. Untuk integrasi produksi,
      lakukan signing di server sendiri.
    </p>
    <p>
      Rate limit: 100/menit &amp; 5.000/hari per key. Respons 429 berarti limit
      atau brute-force guard aktif — tunggu sesuai header Retry-After.
    </p>
  </footer>
</main>

<style>
  :root {
    --bg: #0b0f0d;
    --card: #131a16;
    --line: #263129;
    --text: #e8efe9;
    --muted: #9db3a4;
    --lime: #c9f158;
    --lime-ink: #1d2b12;
    --red: #ff6b6b;
    --amber: #ffc94d;
  }
  * { box-sizing: border-box; }
  main {
    max-width: 880px;
    margin: 0 auto;
    padding: 32px 16px 64px;
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
  }
  header h1 { margin: 0 0 8px; font-size: 28px; }
  header h1 span { color: var(--lime); font-size: 18px; }
  header p, .hint, footer p { color: var(--muted); line-height: 1.6; }
  .card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 20px;
    margin-top: 20px;
  }
  .card h2 { margin: 0 0 12px; font-size: 18px; }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
  }
  label.check {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }
  input, select {
    background: var(--bg);
    border: 1px solid var(--line);
    color: var(--text);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 14px;
    width: 100%;
  }
  input:focus, select:focus { outline: 2px solid var(--lime); outline-offset: -1px; }
  .secret-row { display: flex; gap: 8px; }
  .secret-row input { flex: 1; }
  button { cursor: pointer; }
  .ghost {
    background: transparent;
    border: 1px solid var(--line);
    color: var(--text);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13px;
    white-space: nowrap;
  }
  .ghost:hover { border-color: var(--lime); }
  .endpoints {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 10px;
  }
  .ep {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    background: var(--bg);
    border: 1px solid var(--line);
    color: var(--text);
    border-radius: 10px;
    padding: 12px;
    text-align: left;
  }
  .ep:hover:not(:disabled) { border-color: var(--lime); }
  .ep:disabled { opacity: 0.5; cursor: wait; }
  .ep code { font-size: 11px; color: var(--muted); word-break: break-all; }
  .scope {
    font-size: 11px;
    background: var(--lime);
    color: var(--lime-ink);
    border-radius: 99px;
    padding: 2px 8px;
    font-weight: 600;
  }
  .filters {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 14px;
  }
  @media (max-width: 640px) { .filters { grid-template-columns: 1fr; } }
  .loading { color: var(--muted); }
  .error {
    margin-top: 20px;
    background: #2a1515;
    border: 1px solid #5a2626;
    color: #ffb4b4;
    border-radius: 10px;
    padding: 14px 16px;
    line-height: 1.5;
  }
  .result-head {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .result-head h2 { margin: 0; flex: 1; }
  .badge {
    border-radius: 99px;
    padding: 4px 12px;
    font-size: 13px;
    font-weight: 700;
  }
  .badge.ok { background: var(--lime); color: var(--lime-ink); }
  .badge.warn { background: var(--amber); color: #3a2c00; }
  .badge.err { background: var(--red); color: #3a0000; }
  .ms { color: var(--muted); font-size: 13px; }
  .mono { font-family: ui-monospace, monospace; word-break: break-all; }
  .small { font-size: 12px; color: var(--muted); }
  pre {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 14px;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .sign { color: var(--muted); }
  footer { margin-top: 32px; font-size: 13px; }
</style>
