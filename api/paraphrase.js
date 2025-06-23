const fetch = require('node-fetch');

/**
 * Fungsi pembersih super canggih. Ia akan mencoba mencari paragraf utama
 * dan mengabaikan semua jenis kalimat pembuka atau analisis dari AI.
 * @param {string} text - Teks mentah dari AI.
 * @returns {string} - Teks yang sudah bersih.
 */
function cleanAiResponse(text) {
    let cleanedText = text.trim();

    // Cari paragraf pertama yang sesungguhnya.
    // Terkadang AI memberikan analisis atau beberapa pilihan. Kita coba ambil yang paling relevan.
    const paragraphs = cleanedText.split('\n').filter(p => p.trim() !== '');

    if (paragraphs.length > 1) {
        // Jika AI memberikan beberapa pilihan dengan format "Pilihan 1: ...", "1. ...", dll
        // kita coba cari baris yang tidak terdengar seperti judul pilihan.
        const potentialStarts = ["Pilihan", "Parafrase", "Versi", "Berikut adalah"];
        let bestParagraph = paragraphs[0]; // Ambil paragraf pertama sebagai default

        for (const p of paragraphs) {
            const isIntro = potentialStarts.some(start => p.trim().toLowerCase().startsWith(start.toLowerCase()));
            const hasColon = p.includes(':');

            // Jika paragraf tidak terlihat seperti kalimat pengantar, kita anggap itu hasilnya
            if (!isIntro && !hasColon) {
                bestParagraph = p;
                break;
            }
        }
        // Jika semua paragraf terlihat seperti pengantar, ambil yang terakhir
        if (bestParagraph === paragraphs[0]) {
             const lastParagraph = paragraphs[paragraphs.length - 1];
             const isLastAlsoIntro = potentialStarts.some(start => lastParagraph.trim().toLowerCase().startsWith(start.toLowerCase()));
             if (!isLastAlsoIntro) {
                bestParagraph = lastParagraph;
             }
        }
        cleanedText = bestParagraph;
    }

    // Membersihkan sisa-sisa penomoran atau kata pembuka di awal.
    cleanedText = cleanedText.replace(/^(oke, baik\.|oke, baik|baik,|tentu,|berikut adalah|pilihan \d:|\d\.\s*)/i, '').trim();

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
    const { prompt } = JSON.parse(event.body);
    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Prompt dibutuhkan' }) };
    }

    // PROMPT BARU YANG LEBIH TEGAS
    const enhancedPrompt = `${prompt}\n\n---INSTURKSI PENTING---\nLangsung berikan HANYA hasil parafrasenya dalam satu paragraf tunggal. JANGAN berikan analisis, penjelasan, pilihan ganda, atau kalimat pembuka seperti "Tentu, ini hasilnya:". Hanya berikan teks yang sudah jadi.`;

    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = { contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }] };

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

    // Menggunakan fungsi pembersih baru yang lebih canggih
    const cleanedText = cleanAiResponse(originalAiText);

    data.candidates[0].content.parts[0].text = cleanedText;

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error('Error di dalam fungsi Netlify:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Terjadi kesalahan di server' }) };
  }
};
