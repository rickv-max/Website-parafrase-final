// api/text-corrector.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Kunci API belum diatur.' }) };
    }

    try {
        const { text } = JSON.parse(event.body);
        if (!text) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Teks dibutuhkan.' }) };
        }

        const prompt = `
            Anda adalah asisten koreksi teks profesional. Tugas Anda adalah:
            1.  **Memperbaiki Typo dan Kesalahan Ejaan:** Identifikasi dan koreksi semua salah ketik, kesalahan ejaan, dan kesalahan tata bahasa dasar.
            2.  **Mengembangkan Singkatan:** Ganti singkatan umum dengan bentuk panjangnya yang lengkap. Contoh: "UU" menjadi "Undang-Undang", "DPR" menjadi "Dewan Perwakilan Rakyat", "SDM" menjadi "Sumber Daya Manusia", "PT" menjadi "Perseroan Terbatas", "dll" menjadi "dan lain-lain", "dsb" menjadi "dan sebagainya". Gunakan konteks untuk memutuskan singkatan mana yang harus dikembangkan.
            3.  **Mempertahankan Makna Asli:** Pastikan makna, konteks, dan gaya asli teks tidak berubah secara substansial, kecuali untuk perbaikan yang diperlukan.
            4.  **Hanya Berikan Teks yang Sudah Diperbaiki:** Jangan tambahkan komentar, penjelasan, atau kalimat pembuka/penutup. Langsung berikan teks hasil koreksi.

            Teks yang perlu dikoreksi:
            ---
            ${text}
            ---
        `;

        const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

        const payload = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2, // Sedikit lebih tinggi dari 0.1 untuk sedikit variasi, tapi tetap fokus pada perbaikan
            },
        };

        const apiResponse = await fetch(googleApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await apiResponse.json();

        if (!apiResponse.ok || !data.candidates || !data.candidates[0].content) {
            console.error("Error atau respons tidak valid dari Google API:", data);
            return { statusCode: apiResponse.status, body: JSON.stringify({ error: data.error?.message || 'Gagal mendapatkan respons valid dari AI.' }) };
        }

        const correctedText = data.candidates[0].content.parts[0].text.trim();

        // Beberapa pembersihan tambahan jika AI menambahkan kutipan atau format yang tidak diinginkan
        const cleanedFinalText = correctedText
            .replace(/^["'](.*)["']$/, '$1') // Hapus tanda kutip di awal/akhir jika ada
            .replace(/^(Teks yang diperbaiki|Berikut adalah teks yang sudah dikoreksi|Hasil koreksi):?\s*\n*/i, ''); // Hapus awalan jika ada

        return {
            statusCode: 200,
            body: JSON.stringify({ corrected_text: cleanedFinalText.trim() }),
        };

    } catch (error) {
        console.error('Error di dalam Netlify Function text-corrector:', error.message);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
