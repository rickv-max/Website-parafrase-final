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

            if (type === 'jurnal') {
                prompt = `
                    Anda adalah seorang spesialis daftar pustaka yang sangat teliti. Dari informasi di link jurnal atau deskripsi artikel ilmiah berikut, ekstrak data yang diperlukan untuk sitasi.
                    
                    Data yang harus diekstrak:
                    - Nama Penulis (Nama belakang, Nama depan. Contoh: Anis Ibrahim menjadi Ibrahim, Anis. Jika ada lebih dari satu penulis, formatnya "Penulis Kedua, Nama Depan & Penulis Ketiga, Nama Depan").
                    - Tahun Publikasi.
                    - Judul Artikel (harus lengkap dan persis sama seperti di sumber).
                    - Nama Jurnal (harus lengkap dan persis sama seperti di sumber).
                    - Detail Jurnal (Volume, Nomor, Bulan-Tahun publikasi jika ada, contoh: "volume 3 nomor 2, Januari-Juni 2004").
                    - Afiliasi Penerbit/Institusi (jika ada, contoh: "Sekolah Tinggi Ilmu Hukum Jenderal Sudirman, Lumajang").

                    **Penting:**
                    - Format sitasi harus PERSIS seperti contoh ini, tanpa tambahan atau pengurangan:
                    Ibrahim, Anis (2004) "Penyelesaian Sengketa Tanah Kawasan Hutan Negara Di Kabupaten Lumajang". <i>Jurnal Hukum Argumentum</i>. Sekolah Tinggi Ilmu Hukum Jenderal Sudirman, Lumajang, volume 3 nomor 2, Januari-Juni 2004.
                    - **Pastikan judul artikel dan nama jurnal ditulis miring menggunakan tag HTML <i> atau <em>.**
                    - **JANGAN sertakan URL/link di hasil akhir sitasi.**
                    - Jangan buat informasi fiktif. Jika tidak ada data yang jelas, biarkan bagian tersebut kosong (misal: "Volume X Nomor Y, Tanggal Z" jika tidak ada).
                    - Berikan HANYA format daftar pustaka. Jangan ada teks pengantar atau penutup.

                    Link atau informasi untuk dianalisis:
                    ---
                    ${link}
                    ---
                `;
            } else if (type === 'skripsi') {
                prompt = `
                    Anda adalah seorang spesialis daftar pustaka yang sangat teliti. Dari informasi di link skripsi atau deskripsi berikut, ekstrak data yang diperlukan untuk sitasi.

                    Data yang harus diekstrak:
                    - Nama Penulis (Nama belakang, Nama depan. Contoh: Abdul Jalil menjadi Jalil, Abdul).
                    - Tahun Publikasi.
                    - Judul Skripsi (harus lengkap dan persis sama seperti di sumber).
                    - Kata "Skripsi".
                    - Institusi Penerbit (misal: "Sekolah Tinggi Ilmu Hukum Jenderal Sudirman Lumajang").

                    **Penting:**
                    - Format sitasi harus PERSIS seperti contoh ini, tanpa tambahan atau pengurangan:
                    Jalil, Abdul (2007) "Implementasi Asas Keterbukaan Dalam pembentukan Peraturan Daerah Di Kabupaten Lumajang" <i>Skripsi</i>. Sekolah Tinggi Ilmu Hukum Jenderal Sudirman Lumajang.
                    - **Pastikan judul skripsi ditulis miring menggunakan tag HTML <i> atau <em>.**
                    - **JANGAN sertakan URL/link di hasil akhir sitasi.**
                    - Jangan buat informasi fiktif. Jika tidak ada data yang jelas, biarkan kosong.
                    - Berikan HANYA format daftar pustaka. Jangan ada teks pengantar atau penutup.

                    Link atau informasi untuk dianalisis:
                    ---
                    ${link}
                    ---
                `;
            } else if (type === 'makalah') {
                prompt = `
                    Anda adalah seorang spesialis daftar pustaka yang sangat teliti. Dari informasi di link makalah atau deskripsi berikut, ekstrak data yang diperlukan untuk sitasi.

                    Data yang harus diekstrak:
                    - Nama Penulis (Nama belakang, Nama depan jika ada. Contoh: Ferry Edward menjadi Edward, Ferry. Jika tidak ada nama belakang yang jelas, biarkan seperti asli "Edward, Ferry").
                    - Tahun Acara/Publikasi.
                    - Judul Makalah (harus lengkap dan persis sama seperti di sumber).
                    - Kata "Makalah".
                    - Nama Acara/Kegiatan (misal: "Pendidikan dan Latihan Legal Drafting LAN").
                    - Lokasi Acara (misal: "Jakarta").
                    - Tanggal Acara (misal: "September 2002").

                    **Penting:**
                    - Format sitasi harus PERSIS seperti contoh ini, tanpa tambahan atau pengurangan:
                    Edward, Ferry (2002) "Teknik Penyusunan Peraturan Perundang-undangan Tingkat Daerah". <i>Makalah</i>. Pendidikan dan Latihan Legal Drafting LAN, Jakarta, September 2002.
                    - **Pastikan judul makalah ditulis miring menggunakan tag HTML <i> atau <em>.**
                    - **JANGAN sertakan URL/link di hasil akhir sitasi.**
                    - Jangan buat informasi fiktif. Jika tidak ada data yang jelas, biarkan kosong.
                    - Berikan HANYA format daftar pustaka. Jangan ada teks pengantar atau penutup.

                    Link atau informasi untuk dianalisis:
                    ---
                    ${link}
                    ---
                `;
            } else {
                // Fallback default jika tipe tidak dikenal, meskipun seharusnya sudah dicek di frontend
                prompt = `Buat daftar pustaka dari link atau teks ini: ${link}. Format APA style dan jangan sertakan URL/link.`;
            }

            const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
            
            const payload = {
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.05, // Menurunkan temperature lebih jauh untuk *output* yang sangat presisi
                },
            };

            const apiResponse = await fetch(googleApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await apiResponse.json();

            if (!apiResponse.ok || !data.candidates || !data.candidates[0].content) {
                console.error(`Error atau respons tidak valid dari Google API untuk link ${link}:`, data);
                citations.push(`Gagal menghasilkan sitasi untuk link ini: ${link}. Error: ${data.error?.message || 'Respons tidak valid dari AI.'}`);
                continue; // Lanjutkan ke link berikutnya jika ada error
            }

            const rawAiText = data.candidates[0].content.parts[0].text;
            // Membersihkan teks dari awalan atau akhiran yang tidak diinginkan, dan memastikan tidak ada URL
            // Kita juga akan mencoba menghapus URL yang mungkin masih muncul
            let cleanedCitation = rawAiText
                .replace(/^[Ss]itasi:|Daftar Pustaka:|\n|\r/g, '') // Menghapus awalan umum
                .replace(/(https?:\/\/[^\s]+)/g, '') // Menghapus URL apa pun
                .replace(/["'`]/g, '') // Menghapus tanda kutip yang tidak perlu di awal/akhir
                .trim();
            
            // Tambahkan pembersihan untuk memastikan format HTML <i> atau <em> tetap utuh jika AI mengeluarkannya
            // Ini adalah langkah penting agar formatting miring tetap ada
            cleanedCitation = cleanedCitation
                .replace(/<i>(.*?)<\/i>/g, '<i>$1</i>')
                .replace(/<em>(.*?)<\/em>/g, '<em>$1</em>');


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
