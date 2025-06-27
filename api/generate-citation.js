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

        let partsForModel = []; 

        if (file && mimeType) {
            console.log(`Processing file: ${mimeType}, size: ${file.length / 1024 / 1024} MB`); 
            partsForModel.push({
                inlineData: {
                    data: file,
                    mimeType: mimeType
                }
            });
        } 
        
        let corePromptText = "";
        if (text) { 
            console.log(`Processing text input, length: ${text.length} chars`); 
            corePromptText += `Berikut adalah teks dokumen yang perlu dianalisis dan diformat:\n\n---\n${text}\n---\n\n`;
        }

        const baseInstructions = `
            Anda adalah seorang spesialis daftar pustaka yang sangat teliti.
            Tugas Anda adalah membaca KONTEN DOKUMEN ini, MENGIDENTIFIKASI informasi utama dari DOKUMEN INI (penulis, tahun, judul dokumen, nama jurnal/institusi/acara), dan memformatnya menjadi sitasi.
            **HANYA BUAT SATU SITASI UNTUK DOKUMEN INI.**
            **JANGAN MEMBUAT DAFTAR PUSTAKA DARI KONTEN DOKUMEN. HANYA SATU SITASI UNTUK DOKUMEN YANG SAYA BERIKAN INI SAJA.**

            **Sangat penting: Anda harus meniru format yang diberikan dalam CONTOH dengan SANGAT PRESISI. Perhatikan detail seperti pembalikan nama, tanda kutip, pemiringan (gunakan tag HTML <i> atau <em>), spasi, dan tanda baca.**

            **Fokuslah untuk MENGIDENTIFIKASI dan MENGGUNAKAN data yang DITEMUKAN dalam dokumen/teks ini untuk akurasi data. Dokumen/teks ini adalah SUMBER UTAMA.**
            
            **ATURAN MUTLAK:**
            -   HANYA berikan SATU teks sitasi yang sudah diformat. JANGAN berikan komentar, penjelasan, atau teks pengantar/penutup lainnya.
            -   **JANGAN PERNAH menyertakan URL/link dari mana pun di hasil akhir sitasi.**
            -   Jika suatu detail tidak dapat diidentifikasi dari dokumen/teks, biarkan bagian tersebut kosong. Jangan membuat informasi fiktif atau menebak.
        `;

        if (type === 'jurnal') {
            corePromptText += `${baseInstructions}
                **Format sitasi jurnal PERSIS seperti contoh ini:**
                **Jika ada dua penulis atau lebih, gunakan format 'Nama Belakang, Nama Depan <i>et.al.</i>'.** (misal: Ibrahim, Anis <i>et.al.</i>)

                **Contoh Format Jurnal yang Diinginkan:**
                Ibrahim, Anis (2004) "Penyelesaian Sengketa Tanah Kawasan Hutan Negara Di Kabupaten Lumajang". <i>Jurnal Hukum Argumentum</i>. Sekolah Tinggi Ilmu Hukum Jenderal Sudirman, Lumajang, volume 3 nomor 2, Januari-Juni 2004.
                **Contoh dengan banyak penulis:**
                Smith, John <i>et.al.</i> (2020) "Judul Artikel Contoh Penelitian". <i>Nama Jurnal Internasional</i>. Universitas Jakarta, volume 10 nomor 5, Mei-Juni 2020.
            `;
        } else if (type === 'skripsi') {
            corePromptText += `${baseInstructions}
                **Format sitasi skripsi PERSIS seperti contoh ini:**
                Identifikasi judul skripsi, nama penulis skripsi, tahun, dan institusi penerbit.

                **Contoh Format Skripsi yang Diinginkan:**
                Jalil, Abdul (2007) "Implementasi Asas Keterbukaan Dalam pembentukan Peraturan Daerah Di Kabupaten Lumajang" <i>Skripsi</i>. Sekolah Tinggi Ilmu Hukum Jenderal Sudirman Lumajang.
            `;
        } else if (type === 'makalah') {
            corePromptText += `${baseInstructions}
                **Format sitasi makalah PERSIS seperti contoh ini:**

                **Contoh Format Makalah yang Diinginkan:**
                Edward, Ferry (2002) "Teknik Penyusunan Peraturan Perundang-undangan Tingkat Daerah". <i>Makalah</i>. Pendidikan dan Latihan Legal Drafting LAN, Jakarta, September 2002.
            `;
        } else { 
            corePromptText += `${baseInstructions}
                Format daftar pustaka dari informasi yang diberikan.
            `;
        }
        
        partsForModel.push({ text: corePromptText });

        const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const payload = {
            contents: [
                {
                    role: "user", 
                    parts: partsForModel 
                }
            ], 
            generationConfig: {
                temperature: 0.1, 
                // maxOutputTokens: 500, 
            },
            safetySettings: [ 
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ],
        };

        console.log("Sending payload to Gemini API. First 500 chars:", JSON.stringify(payload).substring(0, 500)); 

        const apiResponse = await fetch(googleApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await apiResponse.json();
        console.log("Received response from Gemini API:", JSON.stringify(data).substring(0, 500)); 


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
                .replace(/<\s*i\s*>/g, '<i>').replace(/<\s*\/\s*i\s*>/g, '</i>')
                .replace(/<\s*em\s*>/g, '<em>').replace(/<\s*\/\s*em\s*>/g, '</em>')
                .replace(/<i>\s*<\/i>/g, '') 
                .replace(/<em>\s*<\/em>/g, '');

            citations.push(cleanedCitation);
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
