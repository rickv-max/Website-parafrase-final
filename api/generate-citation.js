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
        const { links, type } = JSON.parse(event.body);
        if (!links || !type) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Link dan tipe dokumen dibutuhkan.' }) };
        }

        const linkArray = links.split('\n').map(link => link.trim()).filter(link => link.length > 0);
        if (linkArray.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Link tidak ditemukan.' }) };
        }

        let citations = [];

        for (const link of linkArray) {
            let prompt = "";

            // Base prompt instructions for all types
            const baseInstructions = `
                Anda adalah seorang spesialis daftar pustaka yang sangat teliti.
                Tugas utama Anda adalah **ekstraksi informasi secara akurat dari URL yang diberikan** dan kemudian memformatnya menjadi sitasi.
                **AKURASI data (penulis, judul, tahun, detail publikasi) dari URL adalah PRIORITAS TERTINGGI.**
                Jangan buat informasi fiktif. Jika data TIDAK dapat ditemukan di URL, tulis "Tidak Tersedia" untuk bagian tersebut.

                **Sertakan tag HTML <i> atau <em> untuk memiringkan teks yang diperlukan.**
                **ATURAN MUTLAK: JANGAN PERNAH menyertakan URL/link dari mana pun di hasil akhir sitasi.**
                Berikan HANYA teks sitasi yang sudah diformat. JANGAN berikan komentar, penjelasan, atau teks pengantar/penutup lainnya.
            `;

            if (type === 'jurnal') {
                prompt = `${baseInstructions}
                    Format sitasi jurnal PERSIS seperti contoh ini, termasuk penggunaan tanda baca, spasi, dan kapitalisasi:

                    **Contoh Format Jurnal yang Diinginkan:**
                    Ibrahim, Anis (2004) "Penyelesaian Sengketa Tanah Kawasan Hutan Negara Di Kabupaten Lumajang". <i>Jurnal Hukum Argumentum</i>. Sekolah Tinggi Ilmu Hukum Jenderal Sudirman, Lumajang, volume 3 nomor 2, Januari-Juni 2004.

                    URL Jurnal untuk dianalisis:
                    ---
                    ${link}
                    ---
                `;
            } else if (type === 'skripsi') {
                prompt = `${baseInstructions}
                    Format sitasi skripsi PERSIS seperti contoh ini, termasuk penggunaan tanda baca, spasi, dan kapitalisasi:

                    **Contoh Format Skripsi yang Diinginkan:**
                    Jalil, Abdul (2007) "Implementasi Asas Keterbukaan Dalam pembentukan Peraturan Daerah Di Kabupaten Lumajang" <i>Skripsi</i>. Sekolah Tinggi Ilmu Hukum Jenderal Sudirman Lumajang.

                    URL Skripsi untuk dianalisis:
                    ---
                    ${link}
                    ---
                `;
            } else if (type === 'makalah') {
                prompt = `${baseInstructions}
                    Format sitasi makalah PERSIS seperti contoh ini, termasuk penggunaan tanda baca, spasi, dan kapitalisasi:

                    **Contoh Format Makalah yang Diinginkan:**
                    Edward, Ferry (2002) "Teknik Penyusunan Peraturan Perundang-undangan Tingkat Daerah". <i>Makalah</i>. Pendidikan dan Latihan Legal Drafting LAN, Jakarta, September 2002.

                    URL Makalah untuk dianalisis:
                    ---
                    ${link}
                    ---
                `;
            } else {
                prompt = `${baseInstructions}
                    Format daftar pustaka dari link ini. Jangan sertakan URL/link di hasil akhir sitasi.

                    Link atau informasi untuk dianalisis:
                    ---
                    ${link}
                    ---
                `;
            }

            const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
            
            const payload = {
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1, // Kembali ke 0.1, kadang 0.05 terlalu kaku untuk ekstraksi kompleks
                },
                safetySettings: [ // Tambahkan safety settings untuk menghindari blokir respons
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_NONE"
                    },
                ],
            };

            const apiResponse = await fetch(googleApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await apiResponse.json();

            // Handle potential safety concerns or empty responses
            if (data.promptFeedback && data.promptFeedback.blockReason) {
                console.error("Prompt diblokir oleh Safety Settings:", data.promptFeedback.blockReason);
                citations.push(`Gagal menghasilkan sitasi untuk link ini: ${link}. Konten mungkin melanggar kebijakan keamanan AI.`);
                continue;
            }
            if (!apiResponse.ok || !data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts[0]) {
                console.error(`Error atau respons tidak valid dari Google API untuk link ${link}:`, JSON.stringify(data, null, 2));
                citations.push(`Gagal menghasilkan sitasi untuk link ini: ${link}. Pastikan link valid dan dapat diakses publik. (Error: ${data.error?.message || 'Respons tidak valid dari AI.'})`);
                continue; 
            }

            const rawAiText = data.candidates[0].content.parts[0].text;
            
            // Pembersihan agresif untuk memastikan tidak ada URL dan format sesuai
            let cleanedCitation = rawAiText
                .replace(/^[Ss]itasi:|Daftar Pustaka:|[\n\r]+/g, '') // Menghapus awalan umum dan baris baru berlebihan
                .replace(/(https?:\/\/[^\s]+)/g, '') // Menghapus URL apa pun yang mungkin tersisa
                .replace(/["'`]/g, '') // Menghapus tanda kutip yang tidak perlu di awal/akhir
                .trim();
            
            // Pastikan tag HTML <i> atau <em> tetap utuh dan benar
            cleanedCitation = cleanedCitation
                .replace(/<\/?i>/g, '<i>') // Mengganti </i> menjadi <i> jika ada
                .replace(/<\/?em>/g, '<em>') // Mengganti </em> menjadi <em> jika ada
                .replace(/<i>\s*<\/i>/g, '') // Menghapus tag <i> kosong
                .replace(/<em>\s*<\/em>/g, ''); // Menghapus tag <em> kosong

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
