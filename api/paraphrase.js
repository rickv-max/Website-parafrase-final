// paraphrase.js
const fetch = require('node-fetch');

/**
 * Fungsi pembersih final yang lebih canggih.
 * @param {string} text - Teks mentah dari AI.
 * @returns {string} - Teks yang sudah bersih.
 */
function cleanAiResponse(text) {
    let cleanedText = text.trim();
    // Menghapus semua jenis kalimat pembuka yang diikuti oleh titik dua, baris baru, atau frasa umum
    cleanedText = cleanedText.replace(/^(Teks (yang )?sudah (di)?parafrase|Berikut adalah hasil parafrase|Hasil parafrase|Berikut teks yang telah diparafrase):?[\s\n]*/i, '');
    // Menghapus penomoran atau bullet points di awal
    cleanedText = cleanedText.replace(/^(\d+\.\s*|\*\s*|-\s*|\'|\"|\`)/, ''); // Tambahan quotes juga dihapus
    cleanedText = cleanedText.trim();
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
        standard: `Tugas Anda adalah memparafrase teks berikut. Ubah struktur setiap kalimat secara signifikan dan ganti pilihan kata dengan sinonim yang relevan. Pastikan SEMUA makna dan detail informasi dari teks asli tetap utuh. JANGAN meringkas. HANYA berikan teks yang sudah diparafrase, tanpa kalimat pembuka, penjelasan, atau format tambahan.`,
        formal: `Anda adalah editor akademis. Parafrasekan teks berikut ke dalam gaya bahasa yang sangat formal dan objektif. Pertahankan semua detail informasi dengan presisi tinggi. HANYA berikan teks yang sudah diparafrase, tanpa kalimat pembuka, penjelasan, atau format tambahan.`,
        creative: `Anda adalah seorang novelis. Ubah teks berikut menjadi narasi yang lebih hidup dan ekspresif. Pertahankan semua informasi inti, namun sajikan dengan kosakata yang kaya dan struktur kalimat yang menarik. HANYA berikan teks yang sudah diparafrase, tanpa kalimat pembuka, penjelasan, atau format tambahan.`,
        simple: `Jelaskan kembali teks berikut dengan bahasa yang sangat sederhana. Pecah kalimat panjang menjadi kalimat-kalimat pendek dan ganti kata sulit dengan padanan umum, namun jangan sampai ada informasi yang hilang. HANYA berikan teks yang sudah diparafrase, tanpa kalimat pembuka, penjelasan, atau format tambahan.`,
        mahasiswa: `Anda adalah mahasiswa yang sedang menyusun skripsi. Parafrasekan teks berikut dengan gaya bahasa akademis. Fokus utama Anda adalah mengubah kalimat asli untuk menghindari plagiarisme dengan mengubah struktur kalimat dan menggunakan sinonim yang tepat. Pastikan semua data dan detail tetap ada. HANYA berikan teks yang sudah diparafrase, tanpa kalimat pembuka, penjelasan, atau format tambahan.`
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
    const cleanedText = cleanAiResponse(originalAiText); // Menggunakan fungsi pembersih baru
    
    // Karena kita tidak mengembalikan objek data.candidates sepenuhnya,
    // langsung kembalikan teks yang sudah bersih dalam objek sederhana
    return {
      statusCode: 200,
      body: JSON.stringify({ paraphrased_text: cleanedText }),
    };
  } catch (error) {
    console.error('Error di dalam fungsi Netlify:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Terjadi kesalahan di server' }) };
  }
};
