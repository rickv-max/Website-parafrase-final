const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
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
      Anda adalah seorang editor ahli. Tugas Anda adalah menganalisis teks berikut dan mengidentifikasi kalimat-kalimat yang berpotensi kurang unik atau terlalu umum. 
      JANGAN memberikan skor persentase. Fokus pada memberikan masukan yang membangun.

      Teks untuk dianalisis:
      ---
      ${text}
      ---

      Berikan jawaban Anda dalam format JSON yang valid dan HANYA JSON saja. JSON harus memiliki dua kunci:
      1. "summary": Sebuah string berisi ringkasan singkat hasil analisis Anda. Mulailah dengan "Analisis selesai!". Berikan pesan yang ramah dan membantu. Jika ada kalimat berisiko, sebutkan jumlahnya. Jika tidak ada, katakan bahwa teksnya sudah terlihat bagus.
      2. "risky_sentences": Sebuah array berisi string. Setiap string adalah kalimat LENGKAP dari teks asli yang Anda anggap berisiko atau terlalu umum. Jika tidak ada, kembalikan array kosong [].

      Langsung berikan hanya objek JSON, tanpa penjelasan atau kata pengantar seperti "Tentu, ini hasilnya:" atau ```json ... ```.
    `;

    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };

    const apiResponse = await fetch(googleApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await apiResponse.json();
    if (!apiResponse.ok) {
        console.error("Error from Google API:", data);
        throw new Error(data.error?.message || 'Gagal berkomunikasi dengan AI.');
    }

    const aiResponseText = data.candidates[0].content.parts[0].text;

    let jsonResponse;
    try {
        // New, more robust parsing logic
        const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("AI tidak mengembalikan format JSON yang valid.");
        }
        jsonResponse = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
        console.error("Gagal mem-parsing JSON dari AI:", aiResponseText);
        throw new Error("AI memberikan respons yang tidak terduga. Coba lagi.");
    }

    return {
      statusCode: 200,
      body: JSON.stringify(jsonResponse),
    };

  } catch (error) {
    console.error('Error di dalam Netlify Function:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
