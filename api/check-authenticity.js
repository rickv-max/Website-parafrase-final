// check-authenticity.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  // 1. Validasi awal
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Kunci API tidak diatur.' }) };
  }

  try {
    // 2. Ambil dan validasi teks dari frontend
    const { text } = JSON.parse(event.body);
    if (!text) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Teks dibutuhkan.' }) };
    }

    // --- PROMPT BARU UNTUK KEASLIAN/KEUNIKAN ---
    const prompt = `
      Anda adalah seorang peninjau dokumen yang bertugas menganalisis teks untuk keaslian dan keunikan gaya penulisan, terutama setelah teks tersebut mungkin telah diproses (misalnya, diparafrase). Identifikasi bagian atau kalimat dalam teks ini yang masih terdengar generik, kaku, atau sangat mirip dengan gaya AI.

      Berikan analisis Anda dalam format JSON yang valid dan HANYA JSON saja. JSON harus memiliki tiga kunci:
      1. "overall_impression": Sebuah string singkat (maksimal 20 kata) yang memberikan kesan keseluruhan tentang keaslian/keunikannya (contoh: "Teks terdengar cukup manusiawi.", "Ada beberapa bagian yang terasa kaku.").
      2. "problematic_sentences": Sebuah array berisi string. Setiap string adalah kalimat LENGKAP dari teks asli yang paling kuat menunjukkan ciri-ciri kurang asli, generik, atau seperti AI. Jika tidak ada, kembalikan array kosong [].
      3. "authenticity_score": Sebuah angka integer dari 0 (sangat generik/AI-ish) hingga 100 (sangat unik/manusiawi).

      Teks untuk dianalisis:
      ---
      ${text}
      ---
      
      Langsung berikan hanya objek JSON, tanpa penjelasan atau kata pengantar.
    `;
    // --- AKHIR PROMPT BARU ---

    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };

    // 4. Kirim permintaan ke Google AI
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

    // 5. Logika parsing JSON yang SANGAT TANGGUH
    const aiResponseText = data.candidates[0].content.parts[0].text;

    let jsonResponse;
    try {
        const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
        if (jsonMatch && jsonMatch[0]) {
            jsonResponse = JSON.parse(jsonMatch[0]);
        } else {
            jsonResponse = JSON.parse(aiResponseText);
        }
    } catch (parseError) {
        console.error("Gagal mem-parsing JSON dari AI. Respons asli:", aiResponseText);
        throw new Error("AI memberikan respons yang tidak terduga. Coba lagi.");
    }

    // 6. Kirim hasil yang bersih ke frontend
    return {
      statusCode: 200,
      body: JSON.stringify(jsonResponse),
    };

  } catch (error) {
    console.error('Error di dalam Netlify Function:', error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
