// ai-detector.js
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
      Anda adalah seorang ahli analisis gaya penulisan. Teks berikut akan dianalisis untuk menentukan karakteristik gaya penulisan, khususnya dalam hal prediktabilitas, variasi struktur kalimat, dan sentuhan personal.

      Teks untuk dianalisis:
      ---
      ${text}
      ---
      
      Berikan analisis Anda dalam format JSON yang valid dan HANYA JSON saja. JSON harus memiliki empat kunci:
      1. "predictability_score": Sebuah angka integer dari 0 (sangat tidak terduga/manusiawi) hingga 100 (sangat dapat diprediksi/AI).
      2. "uniformity_score": Sebuah angka integer dari 0 (sangat bervariasi/manusiawi) hingga 100 (sangat seragam/AI).
      3. "generality_score": Sebuah angka integer dari 0 (sangat spesifik/personal/manusiawi) hingga 100 (sangat umum/generik/AI).
      4. "analysis_summary": Sebuah string singkat (maksimal 20 kata) yang menyimpulkan hasil analisis berdasarkan skor-skor tersebut.

      Langsung berikan hanya objek JSON, tanpa penjelasan atau kata pengantar.
    `;

    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    // --- PERUBAHAN DI SINI: Menambahkan generationConfig dengan temperature ---
    const payload = { 
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1, // Nilai rendah untuk konsistensi yang lebih tinggi
        // topP: 0.9, // Anda bisa menambahkan ini juga jika ingin kontrol lebih lanjut
        // topK: 40,
      },
    };
    // --- AKHIR PERUBAHAN ---

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
        if (!jsonMatch) {
             console.error("AI tidak mengembalikan format JSON yang valid. Respons asli:", aiResponseText);
             throw new Error("AI memberikan respons yang tidak terduga. Coba lagi.");
        }
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
