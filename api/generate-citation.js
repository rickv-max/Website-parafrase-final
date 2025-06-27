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

    let citations = []; 

    try {
        const { file, mimeType, text, type } = JSON.parse(event.body); 
        if (!type || (!file && !text)) {
            citations.push("Error: Tipe dokumen dan file/teks dokumen dibutuhkan.");
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ citations: citations, error: 'Tipe dokumen dan file/teks dokumen dibutuhkan.' })
            };
        }

        let modelContents = []; // Renamed to avoid confusion with the 'contents' property in payload

        if (file && mimeType) {
            // Correct structure for inlineData (file input)
            modelContents.push({
                parts: [
                    {
                        inlineData: {
                            data: file,
                            mimeType: mimeType
                        }
                    }
                ]
            });
        } else if (text) {
            // Correct structure for text input
            modelContents.push({
                parts: [
                    {
                        text: text // For plain text input from textarea
                    }
                ]
            });
        }
        
        let promptText = "";

        const baseInstructions = `
            Anda adalah seorang spesialis daftar pustaka yang sangat teliti dan akurat dalam pemformatan.
            Tugas Anda adalah membaca informasi dokumen yang saya berikan (baik dari file yang diunggah atau teks yang ditempel), mengidentifikasi elemen-elemen kunci (penulis, tahun, judul, publikasi, dll.), dan memformatnya menjadi sitasi standar seperti pada umumnya (mirip APA Style, tapi mengikuti contoh yang diberikan).

            **Fokuslah untuk MENGIDENTIFIKASI dan MENGGUNAKAN data yang DITEMUKAN dalam dokumen/teks ini untuk akurasi data. Dokumen/teks ini adalah SUMBER UTAMA.**
            
            **Sertakan tag HTML <i> atau <em> untuk memiringkan teks yang diperlukan.**

            **ATURAN MUTLAK:**
            -   HANYA berikan teks sitasi yang sudah diformat. JANGAN berikan komentar, penjelasan, atau teks pengantar/penutup lainnya.
            -   **JANGAN PERNAH menyertakan URL/link dari mana pun di hasil akhir sitasi.**
            -   Jika suatu detail tidak dapat diidentifikasi dari dokumen/teks, biarkan bagian tersebut kosong (contoh: jika tidak ada volume jurnal, jangan menulis "volume", cukup lewati). Jangan membuat informasi fiktif atau menebak.
        `;

        if (type === 'jurnal') {
            promptText = `${baseInstructions}
                Format sitasi jurnal PERSIS seperti contoh ini, termasuk penggunaan tanda baca, spasi, dan kapitalisasi.
                Perhatikan pembalikan nama penulis dan pemiringan judul jurnal.

                **Contoh Format Jurnal yang Diinginkan (Gaya Umum/APA-like):**
                Ibrahim, A. (2004). Penyelesaian Sengketa Tanah Kawasan Hutan Negara Di Kabupaten Lumajang. <i>Jurnal Hukum Argumentum</i>, 3(2), Januari-Juni 2004. Sekolah Tinggi Ilmu Hukum Jenderal Sudirman, Lumajang.
            `;
        } else if (type === 'skripsi') {
            promptText = `${baseInstructions}
                Format sitasi skripsi PERSIS seperti contoh ini, termasuk penggunaan tanda baca, spasi, dan kapitalisasi.
                Perhatikan pembalikan nama penulis dan pemiringan jenis dokumen.

                **Contoh Format Skripsi yang Diinginkan (Gaya Umum/APA-like):**
                Jalil, A. (2007). Implementasi Asas Keterbukaan Dalam pembentukan Peraturan Daerah Di Kabupaten Lumajang. <i>Skripsi</i>. Sekolah Tinggi Ilmu Hukum Jenderal Sudirman Lumajang.
            `;
        } else if (type === 'makalah') {
            promptText = `${baseInstructions}
                Format sitasi makalah PERSIS seperti contoh ini, termasuk penggunaan tanda baca, spasi, dan kapitalisasi.
                Perhatikan pembalikan nama penulis dan pemiringan jenis dokumen.

                **Contoh Format Makalah yang Diinginkan (Gaya Umum/APA-like):**
                Edward, F. (2002, September). Teknik Penyusunan Peraturan Perundang-undangan Tingkat Daerah. <i>Makalah</i>. Pendidikan dan Latihan Legal Drafting LAN, Jakarta.
            `;
        } else { 
            promptText = `${baseInstructions}
                Format daftar pustaka dari informasi yang diberikan dalam gaya umum.
            `;
        }
        
        // Add the prompt text as the last part, also wrapped in 'parts'
        modelContents.push({ parts: [{ text: promptText }] });

        const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const payload = {
            contents: modelContents, // Use the correctly structured modelContents
            generationConfig: {
                temperature: 0.1, 
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
            citations.push(`Gagal menghasilkan sitasi. Konten mungkin melanggar kebijakan keamanan AI. Detail: ${data.promptFeedback.blockReason}.`);
        } else if (!apiResponse.ok || !data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts[0]) {
            console.error(`Error atau respons tidak valid dari Google API. Respons error:`, JSON.stringify(data, null, 2));
            citations.push(`Gagal menghasilkan sitasi. Pastikan dokumen valid (PDF/TXT) dan tidak terlalu besar/kompleks. (Error: ${data.error?.message || 'Respons tidak valid dari AI.'})`);
        } else {
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

            // For file input, we expect a single, possibly multi-line, citation output.
            // For text input, AI might return multiple citations separated by newlines.
            if (text) { // This condition is true if original input was from textarea
                 citations = cleanedCitation.split('\n').filter(c => c.trim().length > 0);
            } else { // This condition is true if original input was from file upload
                citations.push(cleanedCitation);
            }
        }

    } catch (error) {
        console.error('Error di dalam Netlify Function generate-citation (catch block):', error.message);
        citations.push(`Terjadi kesalahan tak terduga di server: ${error.message}`);
    }

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ citations: citations }),
    };
};
