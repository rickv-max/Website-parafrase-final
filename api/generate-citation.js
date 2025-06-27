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
                    Anda adalah seorang spesialis daftar pustaka. Dari informasi di link jurnal atau deskripsi berikut, ekstrak data berikut:
                    - Nama Penulis (penulis utama dan lainnya jika ada, urutkan nama belakang di depan)
                    - Tahun Publikasi
                    - Judul Artikel (harus lengkap dan sama persis seperti di link)
                    - Nama Jurnal (harus lengkap dan sama persis seperti di link)
                    - Volume dan Nomor Jurnal (jika ada)
                    - Halaman (jika ada)
                    - Penerbit (jika ada)
                    - Kota (jika ada)
                    - URL lengkap

                    Format daftar pustaka jurnal dalam gaya yang serupa dengan contoh ini:
                    Ibrahim, Anis (2004) "Penyelesaian Sengketa Tanah Kawasan Hutan Negara Di Kabupaten Lumajang". Jurnal Hukum Argumentum. Sekolah Tinggi Ilmu Hukum Jenderal Sudirman, Lumajang, volume 3 nomor 2, Januari-Juni 2004.

                    **Penting:**
                    - Judul Artikel dan Nama Jurnal harus ditulis **Miring** (gunakan tag HTML <i> atau <em>).
                    - Jika ada lebih dari satu penulis, format seperti "Penulis Kedua, Nama Depan & Penulis Ketiga, Nama Depan".
                    - Jangan buat informasi fiktif. Jika tidak ada data, biarkan kosong atau tulis "Tidak Tersedia".
                    - Berikan HANYA format daftar pustaka. Jangan ada teks pengantar atau penutup.

                    Link atau informasi:
                    ---
                    ${link}
                    ---
                `;
            } else if (type === 'skripsi') {
                prompt = `
                    Anda adalah seorang spesialis daftar pustaka. Dari informasi di link skripsi atau deskripsi berikut, ekstrak data berikut:
                    - Nama Penulis (nama belakang di depan, misal Abdul Jalil jadi Jalil, Abdul)
                    - Tahun Publikasi
                    - Judul Skripsi (harus lengkap dan sama persis seperti di link)
                    - Kata "Skripsi"
                    - Institusi Penerbit (misal: Sekolah Tinggi Ilmu Hukum Jenderal Sudirman Lumajang)
                    - URL lengkap

                    Format daftar pustaka skripsi dalam gaya yang serupa dengan contoh ini:
                    Jalil, Abdul (2007) "Implementasi Asas Keterbukaan Dalam pembentukan Peraturan Daerah Di Kabupaten Lumajang" Skripsi. Sekolah Tinggi Ilmu Hukum Jenderal Sudirman Lumajang.

                    **Penting:**
                    - Judul Skripsi harus ditulis **Miring** (gunakan tag HTML <i> atau <em>).
                    - Berikan HANYA format daftar pustaka. Jangan ada teks pengantar atau penutup.

                    Link atau informasi:
                    ---
                    ${link}
                    ---
                `;
            } else if (type === 'makalah') {
                prompt = `
                    Anda adalah seorang spesialis daftar pustaka. Dari informasi di link makalah atau deskripsi berikut, ekstrak data berikut:
                    - Nama Penulis (nama belakang di depan jika memungkinkan, jika tidak biarkan seperti asli)
                    - Tahun Publikasi (tahun acara)
                    - Judul Makalah (harus lengkap dan sama persis seperti di link)
                    - Kata "Makalah"
                    - Nama Acara/Kegiatan (misal: Pendidikan dan Latihan Legal Drafting LAN)
                    - Lokasi Acara (misal: Jakarta)
                    - Tanggal Acara (misal: September 2002)
                    - URL lengkap

                    Format daftar pustaka makalah dalam gaya yang serupa dengan contoh ini:
                    Edward, Ferry (2002) "Teknik Penyusunan Peraturan Perundang-undangan Tingkat Daerah". Makalah. Pendidikan dan Latihan Legal Drafting LAN, Jakarta, September 2002.

                    **Penting:**
                    - Judul Makalah harus ditulis **Miring** (gunakan tag HTML <i> atau <em>).
                    - Berikan HANYA format daftar pustaka. Jangan ada teks pengantar atau penutup.

                    Link atau informasi:
                    ---
                    ${link}
                    ---
                `;
            } else {
                // Default fallback jika tipe tidak dikenal
                prompt = `Buat daftar pustaka dari link atau teks ini: ${link}`;
            }

            const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

            const payload = {
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1, // Pertahankan rendah untuk konsistensi format
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
            // Membersihkan teks dari awalan atau akhiran yang tidak diinginkan
            const cleanedCitation = rawAiText.replace(/^[Ss]itasi:|Daftar Pustaka:|\n|\r/g, '').trim();

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
