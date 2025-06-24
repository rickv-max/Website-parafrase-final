// humanize-text.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Kunci API tidak diatur.' }) };
  }
  try {
    const { text } = JSON.parse(event.body);
    if (!text) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Teks dibutuhkan.' }) };
    }
    const prompt = `
      Anda adalah seorang penulis dan editor ahli yang bertugas mengubah teks yang terdengar robotik dan kaku menjadi tulisan yang mengalir alami seperti ditulis oleh manusia. 
      Tugas utama Anda adalah "humanize" teks berikut. Lakukan ini dengan cara:
      1.  **Variasikan Struktur Kalimat:** Ubah kalimat-kalimat yang monoton. Gabungkan kalimat pendek atau pecah kalimat yang terlalu panjang. Gunakan berbagai jenis klausa.
      2.  **Perkaya Pilihan Kata:** Ganti kata-kata yang terlalu formal, teknis, atau generik dengan sinonim yang lebih umum dan natural.
      3.  **Tambahkan "Sentuhan Manusia":** Gunakan kata-kata transisi yang lebih luwes, sisipkan sedikit idiom umum (jika sesuai), dan buat ritme tulisan menjadi lebih nyaman dibaca.
      4.  **PENTING:** Jangan mengubah makna inti, fakta, atau data dari teks asli.

      Teks AI yang akan di-humanize:
      ---
      ${text}
      ---
      
      HANYA berikan teks yang sudah di-humanize. Jangan berikan komentar, penjelasan, atau kata pembuka apa pun.
    `;
    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
    const apiResponse = await fetch(googleApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await apiResponse.json();
    if (!apiResponse.ok || !data.candidates || !data.candidates[0].content) {
        console.error("Error atau respons tidak valid dari Google API:", data);
        throw new Error('Gagal mendapatkan respons valid dari AI.');
    }
    const humanizedText = data.candidates[0].content.parts[0].text.trim();
    // Jika ada tanda kutip di awal atau akhir yang tidak diinginkan, bisa ditambahkan pembersihan di sini
    const cleanedHumanizedText = humanizedText.replace(/^['"]|['"]$/g, ''); // Hapus kutip di awal/akhir
    return {
      statusCode: 200,
      body: JSON.stringify({ humanized_text: cleanedHumanizedText }),
    };
  } catch (error) {
    console.error('Error di dalam Netlify Function:', error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
