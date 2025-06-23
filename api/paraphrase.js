const fetch = require('node-fetch');

/**
 * Fungsi pembersih yang sudah disempurnakan.
 * @param {string} text - Teks mentah dari AI.
 * @returns {string} - Teks yang sudah bersih.
 */
function cleanAiResponse(text) {
    let cleanedText = text.trim();
    // Menghapus baris pembuka yang mungkin dibuat AI meskipun sudah dilarang
    const lines = cleanedText.split('\n');
    if (lines.length > 1 && lines[0].length < 100 && lines[0].includes(':')) {
         cleanedText = lines.slice(1).join('\n').trim();
    }
    // Menghapus sisa-sisa markdown atau penomoran
    cleanedText = cleanedText.replace(/^(```json|```|oke, baik\.|baik, |tentu, )/i, '').trim();
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
    const { prompt: mode, text } = JSON.parse(event.body); // Sekarang kita menerima 'mode' dan 'text'
    if (!mode || !text) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Mode dan teks dibutuhkan' }) };
    }

    // === PROMPT BARU YANG JAUH LEBIH SPESIFIK ===
    const prompts = {
        standard: `Tugas Anda adalah memparafrase teks berikut. Ubah struktur setiap kalimat secara signifikan, ganti pilihan kata (diksi) dengan sinonim yang relevan, namun pastikan SEMUA makna, detail, dan ide asli tetap utuh. JANGAN meringkas atau menghilangkan informasi. Hasilnya harus unik dan sulit dideteksi sebagai plagiarisme. Langsung berikan teks yang sudah jadi tanpa kalimat pembuka.`,
        formal: `Posisikan diri Anda sebagai editor jurnal akademis. Parafrasekan teks berikut ke dalam gaya bahasa yang sangat formal, objektif, dan terstruktur. Gunakan terminologi yang canggih dan struktur kalimat majemuk yang bervariasi. Prioritaskan keakuratan makna dan pertahankan semua detail informasi. Hindari opini atau bahasa kasual. Hasilnya harus terdengar profesional dan siap untuk publikasi ilmiah. Langsung berikan teksnya tanpa basa-basi.`,
        creative: `Imajinasikan Anda seorang novelis. Ubah teks berikut menjadi narasi yang lebih hidup, deskriptif, dan ekspresif. Gunakan metafora, kiasan, dan kosakata yang kaya untuk menggugah imajinasi pembaca. Jangan ragu untuk sedikit mendramatisir, tetapi inti dan makna utama dari teks asli harus tetap terjaga. JANGAN menghilangkan detail penting. Langsung berikan hasilnya tanpa pengantar.`,
        simple: `Jelaskan kembali teks berikut dengan bahasa yang paling sederhana dan mudah dimengerti, seolah-olah Anda berbicara kepada anak sekolah. Pecah kalimat yang panjang menjadi kalimat-kalimat pendek. Ganti semua kata sulit dengan padanan kata yang umum digunakan sehari-hari. Pastikan semua poin utama dari teks asli tetap tersampaikan dengan jelas. Jangan meringkas, hanya sederhanakan bahasanya. Langsung berikan hasilnya.`,
        mahasiswa: `Anda adalah seorang mahasiswa yang sedang menyusun skripsi. Parafrasekan teks berikut dengan gaya bahasa akademis yang baik. Fokus utama Anda adalah mengubah kalimat asli untuk menghindari plagiarisme. Lakukan ini dengan cara: (1) Mengubah struktur kalimat (misalnya dari aktif ke pasif atau sebaliknya), (2) Menggunakan kata-kata transisi akademis (contoh: 'oleh karena itu', 'di sisi lain', 'selanjutnya'), (3) Mengganti kata kunci dengan sinonim yang tepat dalam konteks akademis. Pastikan semua data, fakta, dan detail dari teks asli tetap ada. Langsung berikan hasilnya tanpa analisis atau pembukaan.`
    };

    const instruction = prompts[mode] || prompts['standard'];
    const fullPrompt = `${instruction}\n\nTeks Asli:\n---\n${text}`;

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
