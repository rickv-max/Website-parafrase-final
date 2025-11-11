'use strict';

// Node 18+ punya global fetch; kalau tidak ada, fallback ke node-fetch.
const fetch = globalThis.fetch || require('node-fetch');
const { randomUUID } = require('crypto');

const ALLOWED_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // ganti ke domain spesifik kalau perlu
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function json(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(data)
  };
}

function cleanAiResponse(text) {
  let cleanedText = String(text || '').trim();
  cleanedText = cleanedText.replace(
    /^(Teks (yang )?sudah (di)?parafrase|Berikut adalah hasil parafrase|Hasil parafrase|Berikut teks yang telah diparafrase):?[\s\n]*/i,
    ''
  );
  cleanedText = cleanedText.replace(/^(\d+\.\s*|\*\s*|-\s*|['"`])/, '');
  return cleanedText.trim();
}

async function postToGemini(url, payload, retries = 1) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok && retries > 0 && (res.status === 429 || res.status === 503)) {
    await new Promise(r => setTimeout(r, 600));
    return postToGemini(url, payload, retries - 1);
  }
  return res;
}

function buildDebugBundle({ event, context, modelId, endpoint, statusFromUpstream, upstreamBody }) {
  const requestId = (context && (context.requestId || context.awsRequestId)) || randomUUID();
  const safeHeaders = {};
  try {
    const raw = event.headers || {};
    for (const k of Object.keys(raw)) {
      const key = k.toLowerCase();
      if (key === 'authorization') continue;
      if (['origin','referer','user-agent','content-type'].includes(key)) {
        safeHeaders[key] = raw[k];
      }
    }
  } catch {}
  return {
    request_id: requestId,
    server_time: new Date().toISOString(),
    endpoint,
    model_used: modelId,
    http_method: event.httpMethod,
    path: event.path,
    status_upstream: statusFromUpstream,
    headers_sample: safeHeaders,
    upstream_preview: upstreamBody
  };
}

exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metode tidak diizinkan' });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return json(500, { error: 'Kunci API belum diatur' });

  let body, DEBUG = false;
  try {
    body = JSON.parse(event.body || '{}');
    DEBUG = Boolean(body?.debug);
  } catch {
    return json(400, { error: 'Body tidak valid (JSON)' });
  }

  const { mode, text, model } = body || {};
  if (!mode || !text) return json(400, { error: 'Mode dan teks dibutuhkan' });

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
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: { temperature: 0.1, candidateCount: 1 }
  };

  try {
    const apiResponse = await postToGemini(endpoint, payload, 1);
    const data = await apiResponse.json().catch(() => ({}));

    if (!apiResponse.ok) {
      const upstreamMsg = data?.error?.message || data?.error || 'Request ke Gemini API gagal';
      const safeMsg = String(upstreamMsg).replace(new RegExp(GEMINI_API_KEY, 'g'), '[REDACTED_KEY]');
      const hint =
        apiResponse.status === 401 || apiResponse.status === 403 ? 'Periksa API key & restrictions (IP/referrer) di Google AI Studio.' :
        apiResponse.status === 404 ? 'Cek path endpoint atau MODEL_ID.' :
        apiResponse.status === 405 ? 'Method harus POST ke Function.' :
        apiResponse.status === 429 ? 'Rate limit. Coba ulang sebentar lagi.' :
        apiResponse.status === 400 ? 'Payload tidak valid. Cek struktur JSON.' :
        undefined;

      const debug = DEBUG ? buildDebugBundle({
        event, context, modelId: MODEL_ID, endpoint,
        statusFromUpstream: apiResponse.status, upstreamBody: data
      }) : undefined;

      return json(apiResponse.status, { error: safeMsg, hint, debug });
    }

    const parts = data?.candidates?.[0]?.content?.parts;
    const rawText = Array.isArray(parts) ? parts.map(p => p?.text).filter(Boolean).join('\n').trim() : '';
    if (!rawText) {
      const reason = data?.candidates?.[0]?.finishReason || 'NO_CONTENT';
      const debug = DEBUG ? buildDebugBundle({
        event, context, modelId: MODEL_ID, endpoint,
        statusFromUpstream: apiResponse.status, upstreamBody: data
      }) : undefined;
      return json(502, { error: `Tidak ada keluaran dari model (${reason}).`, debug });
    }

    const cleanedText = cleanAiResponse(rawText);
    return json(200, { model_used: MODEL_ID, paraphrased_text: cleanedText }, {
      'X-Debug-Id': randomUUID(), 'X-Model-Used': MODEL_ID
    });

  } catch (e) {
    const safe = (e && e.message) ? e.message : 'Unknown error';
    console.error('Paraphrase function error:', safe);
    const debug = DEBUG ? buildDebugBundle({
      event, context, modelId: MODEL_ID, endpoint,
      statusFromUpstream: 500, upstreamBody: { error: safe }
    }) : undefined;
    return json(500, { error: 'Terjadi kesalahan di server', debug });
  }
};
