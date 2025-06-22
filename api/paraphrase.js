// Impor 'fetch' karena kita akan menggunakannya
const fetch = require('node-fetch');

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
    if (!apiResponse.ok) {
      console.error('Error dari Google API:', data);
      return {
        statusCode: apiResponse.status,
        body: JSON.stringify(data),
      };
    }

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
