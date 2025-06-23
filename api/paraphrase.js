// Impor 'fetch' karena kita akan menggunakannya
const fetch = require('node-fetch');

// Fungsi baru untuk membersihkan kata pembuka
function cleanOpeningWords(text) {
    const commonOpeners = ["Tentu,", "Berikut adalah", "Baik,", "Ini adalah", "Berikut"];
    const words = text.split(' ');
    if (commonOpeners.includes(words[0].replace(/,$/, ''))) {
        return words.slice(1).join(' ').trim();
    }
    return text.trim();
}

// Ini adalah format handler yang benar untuk Netlify
exports.handler = async function(event, context) {
  // Hanya izinkan request dengan metode POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Metode tidak diizinkan, gunakan POST' }),
    };
  }

  // Ambil kunci API rahasia dari Netlify
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Kunci API Google belum diatur di Netlify.' }),
    };
  }

  try {
    // Ambil data dari body request
    const body = JSON.parse(event.body);
    const { prompt } = body;

    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Prompt dibutuhkan.' }),
      };
    }

    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };

    // Kirim permintaan ke Google AI
    const apiResponse = await fetch(googleApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await apiResponse.json();

    // Jika Google mengembalikan error, teruskan errornya
    if (!apiResponse.ok || !data.candidates || !data.candidates[0].content) {
      console.error('Error dari Google API:', data);
      return {
        statusCode: apiResponse.status,
        body: JSON.stringify(data),
      };
    }

    // Ambil teks dari AI
    let originalAiText = data.candidates[0].content.parts[0].text;

    // **BARU:** Bersihkan kata pembuka dari hasil AI
    let cleanedText = cleanOpeningWords(originalAiText);

    // Modifikasi respons untuk mengirim teks yang sudah bersih
    data.candidates[0].content.parts[0].text = cleanedText;

    // Jika berhasil, kirim hasilnya kembali ke frontend
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error('Error di dalam fungsi Netlify:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
