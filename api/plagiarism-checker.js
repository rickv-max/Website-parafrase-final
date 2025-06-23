const fetch = require('node-fetch');

// Fungsi untuk memecah teks menjadi kalimat-kalimat
function getSentences(text) {
    return text.match(/[^.!?]+[.!?]+/g) || [];
}

// Fungsi untuk melakukan pencarian di Google (ini adalah placeholder, karena kita tidak bisa langsung memanggilnya)
// Di dunia nyata, ini akan digantikan dengan API pencarian sungguhan.
// Untuk sekarang, kita akan mensimulasikannya.
async function searchGoogle(sentence) {
    // Simulasi: Anggap saja kita menemukan sumber jika kalimatnya mengandung kata "perlindungan konsumen"
    if (sentence.toLowerCase().includes("perlindungan konsumen")) {
        return {
            found: true,
            url: "https://www.hukumonline.com/klinik/a/tips-hukum-bagi-konsumen-yang-dirugikan-lt5f9a7b8c6d3f2"
        };
    }
    return { found: false, url: null };
}

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { text } = JSON.parse(event.body);
        if (!text) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Teks dibutuhkan.' }) };
        }

        const sentences = getSentences(text);
        if (sentences.length === 0) {
            return { statusCode: 200, body: JSON.stringify({ plagiarism_score: 0, summary: "Teks terlalu singkat untuk diperiksa.", sources_found: 0, plagiarized_sources: [] }) };
        }

        let plagiarizedCount = 0;
        const plagiarizedSources = [];
        const sentencesToCheck = sentences.slice(0, 7); // Batasi pengecekan ke 7 kalimat pertama untuk efisiensi

        for (const sentence of sentencesToCheck) {
            // Kita akan menggunakan prompt ke AI untuk mensimulasikan pencarian
             const searchResult = await searchGoogle(sentence.trim()); // Simulasi Pencarian
             if (searchResult.found) {
                 plagiarizedCount++;
                 plagiarizedSources.push({
                     sentence: sentence.trim(),
                     source: searchResult.url
                 });
             }
        }
        
        const plagiarismScore = Math.round((plagiarizedCount / sentencesToCheck.length) * 100);
        
        let summary = "";
        if (plagiarismScore > 50) {
            summary = "Terdeteksi potensi plagiarisme yang signifikan.";
        } else if (plagiarismScore > 10) {
            summary = "Ada beberapa kalimat yang cocok dengan sumber online.";
        } else {
            summary = "Selamat! Tulisan Anda sebagian besar unik.";
        }
        
        const response = {
            plagiarism_score: plagiarismScore,
            summary: summary,
            sources_found: plagiarizedSources.length,
            plagiarized_sources: plagiarizedSources
        };

        return {
            statusCode: 200,
            body: JSON.stringify(response)
        };

    } catch (error) {
        console.error('Error di Plagiarism Checker:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Terjadi kesalahan internal saat memeriksa plagiarisme.' }) };
    }
};
