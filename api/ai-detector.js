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
      Anda adalah seorang ahli linguistik forensik yang sangat terlatih dalam membedakan antara teks yang ditulis oleh manusia dan teks yang dihasilkan oleh model bahasa AI seperti GPT. Analisis teks berikut berdasarkan kriteria canggih:
      1.  **Perplexity:** Apakah pilihan kata cenderung umum dan dapat diprediksi (ciri AI) atau lebih bervariasi dan tidak terduga (ciri manusia)?
      2.  **Burstiness:** Apakah panjang kalimat seragam dan monoton (ciri AI) atau bervariasi antara kalimat panjang dan pendek (ciri manusia)?
      3.  **Spesifisitas & Emosi:** Apakah teks terasa generik dan datar, atau mengandung sentuhan personal, emosi, atau detail spesifik yang khas manusia?

      Teks untuk dianalisis:
      ---
      ${text}
      ---
      
      Berikan jawaban Anda dalam format JSON yang valid dan HANYA JSON saja. JSON harus memiliki tiga kunci:
      1. "likelihood_percentage": Sebuah angka (integer) antara 0 dan 100, yang merepresentasikan perkiraan kemungkinan teks ini ditulis oleh AI. 0 berarti 100% manusia, 100 berarti 100% AI.
      2. "summary": Sebuah string singkat (maksimal 15 kata) yang menyimpulkan hasil analisis. Contoh: "Sangat mungkin ditulis oleh AI.", "Kemungkinan besar ditulis oleh manusia.", atau "Terlihat seperti campuran tulisan AI dan manusia.".
      3. "highlight_sentences": Sebuah array berisi string. Setiap string adalah kalimat LENGKAP dari teks asli yang paling kuat menunjukkan ciri-ciri tulisan AI. Jika tidak ada, kembalikan array kosong [].

      Langsung berikan hanya objek JSON, tanpa penjelasan atau kata pengantar.
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
    const aiResponseText = data.candidates[0].content.parts[0].text;
    let jsonResponse;
    try {
        const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI tidak mengembalikan format JSON yang valid.");
        jsonResponse = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
        console.error("Gagal mem-parsing JSON dari AI. Respons asli:", aiResponseText);
        throw new Error("AI memberikan respons yang tidak terduga. Coba lagi.");
    }
    return {
      statusCode: 200,
      body: JSON.stringify(jsonResponse),
    };
  } catch (error) {
    console.error('Error di dalam Netlify Function:', error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
