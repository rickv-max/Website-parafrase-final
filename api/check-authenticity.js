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

    // 3. Buat prompt yang sangat spesifik untuk AI
    const prompt = `
      Analisis teks ini dan identifikasi kalimat yang berpotensi kurang unik atau terlalu umum.
      Jawaban Anda HARUS dalam format JSON yang valid, tanpa teks atau markdown tambahan.
      JSON harus memiliki dua kunci: "summary" (string) dan "risky_sentences" (array of strings).
      Untuk "summary", berikan analisis singkat dan ramah.
      Untuk "risky_sentences", masukkan kalimat lengkap yang berisiko. Jika tidak ada, kembalikan array kosong [].
      Teks: "${text}"
    `;

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
        // Coba cari JSON di dalam teks, bahkan jika terbungkus markdown
        const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
        if (jsonMatch && jsonMatch[0]) {
            jsonResponse = JSON.parse(jsonMatch[0]);
        } else {
            // Jika tidak ditemukan, coba parsing langsung (jika AI patuh)
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
