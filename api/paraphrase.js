const fetch = require('node-fetch');

/**
 * Fungsi canggih untuk membersihkan teks dari AI.
 * Menghapus kata pembuka umum dan pola penomoran.
 * @param {string} text - Teks mentah dari AI.
 * @returns {string} - Teks yang sudah bersih.
 */
function cleanAiResponse(text) {
    let cleanedText = text.trim();

    // Daftar frasa pembuka yang umum untuk dihapus
    const openingPhrases = [
        "Tentu, berikut adalah hasil parafrasenya:",
        "Tentu, ini hasil parafrasenya:",
        "Berikut adalah hasil parafrasenya:",
        "Baik, ini hasilnya:",
        "Tentu saja,",
        "Tentu,",
        "Berikut adalah",
        "Baik,",
        "Ini adalah",
        "Berikut"
    ];

    for (const phrase of openingPhrases) {
        if (cleanedText.toLowerCase().startsWith(phrase.toLowerCase())) {
            cleanedText = cleanedText.substring(phrase.length).trim();
            break; // Hentikan setelah menemukan kecocokan pertama
        }
    }

    // Menghapus pola penomoran seperti "Parafrase 1:", "1.", "a)" di awal teks
    // Ini akan menghapus penomoran hanya jika ada di paling depan.
    cleanedText = cleanedText.replace(/^(parafrase\s*\d*\s*[:\.]?\s*)/i, '');
    cleanedText = cleanedText.replace(/^(\d+\.\s*)/, '');
    cleanedText = cleanedText.replace(/^([a-z]\)\s*)/i, '');

    return cleanedText.trim();
}


exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Metode tidak diizinkan, gunakan POST' }),
    };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Kunci API Google belum diatur di Netlify.' }),
    };
  }

  try {
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

    const apiResponse = await fetch(googleApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok || !data.candidates || !data.candidates[0].content) {
      console.error('Error dari Google API:', data);
      return {
        statusCode: apiResponse.status,
        body: JSON.stringify(data),
      };
    }

    let originalAiText = data.candidates[0].content.parts[0].text;

    // **MENGGUNAKAN FUNGSI PEMBERSIH BARU**
    let cleanedText = cleanAiResponse(originalAiText);

    data.candidates[0].content.parts[0].text = cleanedText;

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
