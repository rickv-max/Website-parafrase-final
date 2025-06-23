const fetch = require('node-fetch');

function cleanAiResponse(text) {
    let cleanedText = text.trim();
    const openingPhrases = [
        "Tentu, berikut hasil parafrasenya:",
        "Berikut adalah hasil parafrasenya:",
        "Tentu, ini hasil parafrasenya:",
        "Oke, baik. Sebagai mahasiswa yang sedang mengerjakan tugas, saya akan menganalisis teks ini",
        "beberapa pilihan parafrase dari teks asli, dengan tingkatan yang berbeda dalam mengubah struktur kalimat dan penggunaan sinonim",
        "Berikut adalah beberapa pemikiran awal saya:"
    ];
    for (const phrase of openingPhrases) {
        if (cleanedText.toLowerCase().startsWith(phrase.toLowerCase())) {
            cleanedText = cleanedText.substring(phrase.length).trim();
            break;
        }
    }
    cleanedText = cleanedText.replace(/^(```json|```|oke, baik\.|baik, |tentu, |pilihan \d:|\d\.\s*)/i, '').replace(/:\s*$/, "").trim();
    return cleanedText;
}

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Metode tidak diizinkan' }) };
  }
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Kunci API belum diatur' }) };
  }
  try {
    const { mode, text } = JSON.parse(event.body);
    if (!mode || !text) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Mode dan teks dibutuhkan' }) };
    }
    const prompts = {
        standard: `Tugas Anda adalah memparafrase teks berikut. Ubah struktur setiap kalimat secara signifikan dan ganti pilihan kata dengan sinonim yang relevan. Pastikan SEMUA makna dan detail informasi dari teks asli tetap utuh. JANGAN meringkas. Langsung berikan teks yang sudah jadi tanpa kalimat pembuka atau analisis.`,
        formal: `Anda adalah editor akademis. Parafrasekan teks berikut ke dalam gaya bahasa yang sangat formal dan objektif. Pertahankan semua detail informasi dengan presisi tinggi. Langsung berikan teksnya tanpa basa-basi.`,
        creative: `Anda adalah seorang novelis. Ubah teks berikut menjadi narasi yang lebih hidup dan ekspresif. Pertahankan semua informasi inti, namun sajikan dengan kosakata yang kaya dan struktur kalimat yang menarik. Langsung berikan hasilnya tanpa pengantar.`,
        simple: `Jelaskan kembali teks berikut dengan bahasa yang sangat sederhana. Pecah kalimat panjang menjadi kalimat-kalimat pendek dan ganti kata sulit dengan padanan umum, namun jangan sampai ada informasi yang hilang. Langsung berikan hasilnya.`,
        mahasiswa: `Anda adalah mahasiswa yang sedang menyusun skripsi. Parafrasekan teks berikut dengan gaya bahasa akademis. Fokus utama Anda adalah mengubah kalimat asli untuk menghindari plagiarisme dengan mengubah struktur kalimat dan menggunakan sinonim yang tepat. Pastikan semua data dan detail tetap ada. Langsung berikan hasilnya tanpa analisis.`
    };
    const instruction = prompts[mode] || prompts['standard'];
    const fullPrompt = `${instruction}\n\nTeks Asli untuk diparafrase:\n---\n${text}`;
    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = { contents: [{ role: 'user', parts: [{ text: fullPrompt }] }] };
    const apiResponse = await fetch(googleApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await apiResponse.json();
    if (!apiResponse.ok || !data.candidates || !data.candidates[0].content) {
      console.error('Error dari Google API:', data);
      return { statusCode: apiResponse.status, body: JSON.stringify(data) };
    }
    const originalAiText = data.candidates[0].content.parts[0].text;
    const cleanedText = cleanAiResponse(originalAiText);
    data.candidates[0].content.parts[0].text = cleanedText;
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Error di dalam fungsi Netlify:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Terjadi kesalahan di server' }) };
  }
};
