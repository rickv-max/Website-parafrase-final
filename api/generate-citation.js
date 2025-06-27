// api/generate-citation.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Kunci API GEMINI_API_KEY belum diatur.' }) };
    }

    try {
        const { links, type } = JSON.parse(event.body); // 'links' contains raw text input (document info + optional link)
        if (!links || !type) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Informasi dokumen dan tipe dibutuhkan.' }) };
        }

        // Split input by double newline to handle multiple entries
        const rawEntries = links.split('\n\n').map(entry => entry.trim()).filter(entry => entry.length > 0);
        if (rawEntries.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Informasi dokumen tidak ditemukan.' }) };
        }

        let citations = [];

        for (const entry of rawEntries) { // Iterate through each raw text entry
            let prompt = "";

            // Base prompt instructions for all types
            const baseInstructions = `
                Anda adalah seorang spesialis daftar pustaka yang sangat teliti dan akurat dalam pemformatan.
                Tugas Anda adalah membaca informasi dokumen mentah yang saya berikan (yang mungkin termasuk URL), mengidentifikasi elemen-elemen kunci (penulis, tahun, judul, publikasi, dll.), dan memformatnya menjadi sitasi standar seperti pada umumnya (mirip APA Style, tapi mengikuti contoh yang diberikan).

                **Fokuslah untuk MENGIDENTIFIKASI dan MENGGUNAKAN data yang DIBERIKAN dalam teks mentah ini untuk akurasi data. Data ini adalah SUMBER UTAMA.**
                
                **Sertakan tag HTML <i> atau <em> untuk memiringkan teks yang diperlukan.**

                **ATURAN MUTLAK:**
                -   HANYA berikan teks sitasi yang sudah diformat. JANGAN berikan komentar, penjelasan, atau teks pengantar/penutup lainnya.
                -   **JANGAN PERNAH menyertakan URL/link dari mana pun di hasil akhir sitasi.**
                -   Jika suatu detail tidak dapat diidentifikasi dari teks input, biarkan bagian tersebut kosong (contoh: jika tidak ada volume jurnal, jangan menulis "volume", cukup lewati). Jangan membuat informasi fiktif.
            `;

            if (type === 'jurnal') {
                prompt = `${baseInstructions}
                    Format sitasi jurnal PERSIS seperti contoh ini, termasuk penggunaan tanda baca, spasi, dan kapitalisasi.
                    Perhatikan pembalikan nama penulis dan pemiringan judul jurnal.

                    **Contoh Format Jurnal yang Diinginkan (Gaya Umum/APA-like):**
                    Ibrahim, A. (2004). Penyelesaian Sengketa Tanah Kawasan Hutan Negara Di Kabupaten Lumajang. <i>Jurnal Hukum Argumentum</i>, 3(2), Januari-Juni 2004. Sekolah Tinggi Ilmu Hukum Jenderal Sudirman, Lumajang.

                    Informasi Jurnal untuk diproses:
                    ---
                    ${entry}
                    ---
                `;
            } else if (type === 'skripsi') {
                prompt = `${baseInstructions}
                    Format sitasi skripsi PERSIS seperti contoh ini, termasuk penggunaan tanda baca, spasi, dan kapitalisasi.
                    Perhatikan pembalikan nama penulis dan pemiringan jenis dokumen.

                    **Contoh Format Skripsi yang Diinginkan (Gaya Umum/APA-like):**
                    Jalil, A. (2007). Implementasi Asas Keterbukaan Dalam pembentukan Peraturan Daerah Di Kabupaten Lumajang. <i>Skripsi</i>. Sekolah Tinggi Ilmu Hukum Jenderal Sudirman Lumajang.

                    Informasi Skripsi untuk diproses:
                    ---
                    ${entry}
                    ---
                `;
            } else if (type === 'makalah') {
                prompt = `${baseInstructions}
                    Format sitasi makalah PERSIS seperti contoh ini, termasuk penggunaan tanda baca, spasi, dan kapitalisasi.
                    Perhatikan pembalikan nama penulis dan pemiringan jenis dokumen.

                    **Contoh Format Makalah yang Diinginkan (Gaya Umum/APA-like):**
                    Edward, F. (2002, September). Teknik Penyusunan Peraturan Perundang-undangan Tingkat Daerah. <i>Makalah</i>. Pendidikan dan Latihan Legal Drafting LAN, Jakarta.

                    Informasi Makalah untuk diproses:
                    ---
                    ${entry}
                    ---
                `;
            } else { // Fallback, should not be reached if type is always sent
                prompt = `${baseInstructions}
                    Format daftar pustaka dari informasi yang diberikan dalam gaya umum.

                    Informasi untuk diproses:
                    ---
                    ${entry}
                    ---
                `;
            }

            const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
            
            const payload = {
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1, // Tetap 0.1 untuk keseimbangan antara kreativitas dan konsistensi
                },
                safetySettings: [ 
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                ],
            };

            const apiResponse = await fetch(googleApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await apiResponse.json();

            if (data.promptFeedback && data.promptFeedback.blockReason) {
                console.error("Prompt diblokir oleh Safety Settings:", data.promptFeedback.blockReason);
                citations.push(`Gagal menghasilkan sitasi. Konten mungkin melanggar kebijakan keamanan AI.`);
                continue;
            }
            if (!apiResponse.ok || !data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts[0]) {
                console.error(`Error atau respons tidak valid dari Google API untuk entri: ${entry.substring(0, 100)}...`, JSON.stringify(data, null, 2));
                citations.push(`Gagal menghasilkan sitasi untuk entri ini. Pastikan informasinya lengkap dan jelas. (Error: ${data.error?.message || 'Respons tidak valid dari AI.'})`);
                continue; 
            }

            const rawAiText = data.candidates[0].content.parts[0].text;
            
            let cleanedCitation = rawAiText
                .replace(/^[Ss]itasi:|Daftar Pustaka:|[\n\r]+/g, '') 
                .replace(/(https?:\/\/[^\s]+)/g, '') 
                .replace(/["'`]/g, '') 
                .trim();
            
            cleanedCitation = cleanedCitation
                .replace(/<\/?i>/g, '<i>') 
                .replace(/<\/?em>/g, '<em>') 
                .replace(/<i>\s*<\/i>/g, '') 
                .replace(/<em>\s*<\/em>/g, '');

            citations.push(cleanedCitation);
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ citations: citations }),
        };

    } catch (error) {
        console.error('Error di dalam Netlify Function generate-citation:', error.message);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
