'use strict';

// Pakai fetch bawaan Node 18+. Kalau masih Node 16/17, fallback ke node-fetch.
const fetch = globalThis.fetch || require('node-fetch');

const ALLOWED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash'
];

/**
 * Pembersih hasil AI (versi kamu, sedikit dirapikan).
 */
function cleanAiResponse(text) {
  let cleanedText = String(text || '').trim();
  cleanedText = cleanedText.replace(
    /^(Teks (yang )?sudah (di)?parafrase|Berikut adalah hasil parafrase|Hasil parafrase|Berikut teks yang telah diparafrase):?[\s\n]*/i,
    ''
  );
  cleanedText = cleanedText.replace(/^(\d+\.\s*|\*\s*|-\s*|['"`])/, '');
  return cleanedText.trim();
}

/**
 * Simple retry untuk 429/503.
 */
async function postToGemini(url, payload, retries = 1) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok && retries > 0 && (res.status === 429 || res.status === 503)) {
    // backoff sederhana
    await new Promise(r => setTimeout(r, 600));
    return postToGemini(url, payload, retries - 1);
  }
  return res;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Metode tidak diizinkan' }) };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Kunci API belum diatur' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body tidak valid (JSON)' }) };
  }

  const { mode, text, model } = body || {};
  if (!mode || !text) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Mode dan teks dibutuhkan' }) };
  }

  // PROMPTS
  const prompts = {
    standard: `Tugas Anda adalah memparafrase teks berikut. Ubah struktur setiap kalimat secara signifikan dan ganti pilihan kata dengan sinonim yang relevan. Pastikan SEMUA makna dan detail informasi dari teks asli tetap utuh. JANGAN meringkas. HANYA berikan teks yang sudah diparafrase, tanpa kalimat pembuka, penjelasan, atau format tambahan.`,
    formal: `Anda adalah editor akademis. Parafrasekan teks berikut ke dalam gaya bahasa yang sangat formal dan objektif. Pertahankan semua detail informasi dengan presisi tinggi. HANYA berikan teks yang sudah diparafrase, tanpa kalimat pembuka, penjelasan, atau format tambahan.`,
    creative: `Anda adalah seorang novelis. Ubah teks berikut menjadi narasi yang lebih hidup dan ekspresif. Pertahankan semua informasi inti, namun sajikan dengan kosakata yang kaya dan struktur kalimat yang menarik. HANYA berikan teks yang sudah diparafrase, tanpa kalimat pembuka, penjelasan, atau format tambahan.`,
    simple: `Jelaskan kembali teks berikut dengan bahasa yang sangat sederhana. Pecah kalimat panjang menjadi kalimat-kalimat pendek dan ganti kata sulit dengan padanan umum, namun jangan sampai ada informasi yang hilang. HANYA berikan hasilnya.`,
    mahasiswa: `Anda adalah mahasiswa yang sedang menyusun skripsi. Parafrasekan teks berikut dengan gaya bahasa akademis. Fokus utama Anda adalah mengubah kalimat asli untuk menghindari plagiarisme dengan mengubah struktur kalimat dan menggunakan sinonim yang tepat. Pastikan semua data dan detail tetap ada. HANYA berikan hasilnya tanpa analisis.`
  };

  const instruction = prompts[mode] || prompts.standard;
  const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const requestedModel = (model || DEFAULT_MODEL).trim();
  const MODEL_ID = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : DEFAULT_MODEL;

  const fullPrompt = `${instruction}\n\nTeks Asli untuk diparafrase:\n---\n${text}`;

  const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: {
      temperature: 0.1,
      candidateCount: 1
      // maxOutputTokens: 2048, // opsional
    }
    // safetySettings: [...] // opsional
  };

  try {
    const apiResponse = await postToGemini(googleApiUrl, payload, 1);
    const data = await apiResponse.json().catch(() => ({}));

    if (!apiResponse.ok) {
      const rawMsg = data?.error?.message || data?.error || 'Request ke Gemini API gagal';
      // Sanitasi agar key tidak pernah tampil jika API memantul balik pesan
      const safeMsg = String(rawMsg).replace(new RegExp(GEMINI_API_KEY, 'g'), '[REDACTED_KEY]');
      return { statusCode: apiResponse.status, body: JSON.stringify({ error: safeMsg }) };
    }

    const parts = data?.candidates?.[0]?.content?.parts;
    const rawText =
      Array.isArray(parts)
        ? parts.map(p => p?.text).filter(Boolean).join('\n').trim()
        : '';

    if (!rawText) {
      // Bisa karena safety filter / kosong
      const reason = data?.candidates?.[0]?.finishReason || 'NO_CONTENT';
      return { statusCode: 502, body: JSON.stringify({ error: `Tidak ada keluaran dari model (${reason}).` }) };
    }

    const cleanedText = cleanAiResponse(rawText);

    return {
      statusCode: 200,
      body: JSON.stringify({
        model_used: MODEL_ID,
        paraphrased_text: cleanedText
      })
    };
  } catch (e) {
    // Jangan bocorkan key/log sensitif
    const msg = (e && e.message) ? e.message.replace(new RegExp(GEMINI_API_KEY, 'g'), '[REDACTED_KEY]') : 'Unknown error';
    console.error('Paraphrase function error:', msg);
    return { statusCode: 500, body: JSON.stringify({ error: 'Terjadi kesalahan di server' }) };
  }
};
