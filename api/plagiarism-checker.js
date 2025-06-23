```javascript
const fetch = require('node-fetch');

// Fungsi untuk memecah teks menjadi kalimat-kalimat
function getSentences(text) {
    return text.match(/[^.!?]+[.!?]+/g) || [];
}

// Simulasi pencarian menggunakan AI. Ini akan meminta AI untuk berperan sebagai mesin pencari.
async function simulateSearchWithAI(sentence, apiKey) {
    const prompt = `
      Anda adalah sebuah mesin pencari. Saya akan memberikan sebuah kalimat. Jika kalimat ini terlihat sangat umum atau mungkin ada di sebuah artikel online, berikan satu contoh URL sumber yang paling relevan. Jika kalimatnya terlihat sangat unik dan spesifik, jawab dengan "TIDAK_DITEMUKAN".
      JANGAN berikan penjelasan. Hanya berikan URL atau kata "TIDAK_DITEMUKAN".
      
      Kalimat: "${sentence}"
    `;
    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const payload = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
    const response = await fetch(googleApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text.trim();

    if (resultText && resultText !== "TIDAK_DITEMUKAN" && resultText.startsWith('http')) {
        return { found: true, url: resultText };
    }
    return { found: false, url: null };
}

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
        const sentences = getSentences(text);
        if (sentences.length === 0) {
            return { statusCode: 200, body: JSON.stringify({ plagiarism_score: 0, summary: "Teks terlalu singkat.", sources_found: 0, plagiarized_sources: [] }) };
        }

        let plagiarizedCount = 0;
        const plagiarizedSources = [];
        const sentencesToCheck = sentences.slice(0, 5); // Batasi pengecekan ke 5 kalimat pertama

        for (const sentence of sentencesToCheck) {
             const searchResult = await simulateSearchWithAI(sentence.trim(), GEMINI_API_KEY);
             if (searchResult.found) {
                 plagiarizedCount++;
                 plagiarizedSources.push({ sentence: sentence.trim(), source: searchResult.url });
             }
        }
        
        const plagiarismScore = Math.round((plagiarizedCount / sentencesToCheck.length) * 100);
        let summary;
        if (plagiarismScore > 50) summary = "Terdeteksi potensi plagiarisme signifikan.";
        else if (plagiarismScore > 10) summary = "Ditemukan beberapa kalimat yang cocok.";
        else summary = "Selamat! Tulisan Anda sebagian besar unik.";
        
        const response = {
            plagiarism_score: plagiarismScore,
            summary: summary,
            sources_found: plagiarizedSources.length,
            plagiarized_sources: plagiarizedSources
        };
        return { statusCode: 200, body: JSON.stringify(response) };

    } catch (error) {
        console.error('Error di Plagiarism Checker:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Terjadi kesalahan saat memeriksa plagiarisme.' }) };
    }
};
```
