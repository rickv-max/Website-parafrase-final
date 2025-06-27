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
                    Anda adalah seorang spesialis daftar pustaka yang sangat teliti. Tugas Anda adalah mengekstrak semua detail yang diperlukan dari URL jurnal berikut dan memformatnya menjadi sitasi.

                    **Pastikan untuk mengikuti format ini PERSIS seperti contoh yang diberikan, termasuk penggunaan tanda baca, spasi, dan kapitalisasi. Gunakan tag HTML <i> atau <em> untuk memiringkan teks yang diperlukan.**

                    **Informasi yang harus diekstrak dan format penulisan:**
                    1.  **Nama Penulis:** Nama belakang, Nama depan (contoh: Anis Ibrahim menjadi Ibrahim, Anis). Jika ada lebih dari satu penulis, gunakan format: "Penulis Kedua, Nama Depan & Penulis Ketiga, Nama Depan".
                    2.  **Tahun Publikasi:** Dalam kurung ().
                    3.  **Judul Artikel:** Dalam tanda kutip ganda "", diikuti titik.
                    4.  **Nama Jurnal:** Ditulis miring (gunakan <i> atau <em>), diikuti titik.
                    5.  **Institusi Penerbit/Afiliasi:** Nama institusi/penerbit (jika relevan), diikuti koma.
                    6.  **Lokasi:** Kota penerbitan (jika relevan), diikuti koma.
                    7.  **Detail Jurnal:** Volume, Nomor (jika ada), Bulan-Tahun publikasi (jika ada). Contoh: "volume 3 nomor 2, Januari-Juni 2004". Diakhiri titik.

                    **Contoh Format Jurnal yang Diinginkan:**
                    Ibrahim, Anis (2004) "Penyelesaian Sengketa Tanah Kawasan Hutan Negara Di Kabupaten Lumajang". <i>Jurnal Hukum Argumentum</i>. Sekolah Tinggi Ilmu Hukum Jenderal Sudirman, Lumajang, volume 3 nomor 2, Januari-Juni 2004.

                    **ATURAN MUTLAK:**
                    -   **JANGAN PERNAH menyertakan URL/link dari mana pun di hasil akhir sitasi.**
                    -   HANYA berikan teks sitasi yang sudah diformat. JANGAN berikan komentar, penjelasan, atau teks pengantar/penutup lainnya.
                    -   Jika suatu detail tidak dapat ditemukan di URL, tinggalkan kosong atau tulis "Tidak Tersedia" untuk bagian tersebut (namun usahakan selalu mengekstrak semua yang mungkin).

                    URL Jurnal untuk dianalisis:
                    ---
                    ${link}
                    ---
                `;
            } else if (type === 'skripsi') {
                prompt = `
                    Anda adalah seorang spesialis daftar pustaka yang sangat teliti. Tugas Anda adalah mengekstrak semua detail yang diperlukan dari URL skripsi berikut dan memformatnya menjadi sitasi.

                    **Pastikan untuk mengikuti format ini PERSIS seperti contoh yang diberikan, termasuk penggunaan tanda baca, spasi, dan kapitalisasi. Gunakan tag HTML <i> atau <em> untuk memiringkan teks yang diperlukan.**

                    **Informasi yang harus diekstrak dan format penulisan:**
                    1.  **Nama Penulis:** Nama belakang, Nama depan (contoh: Abdul Jalil menjadi Jalil, Abdul).
                    2.  **Tahun Publikasi:** Dalam kurung ().
                    3.  **Judul Skripsi:** Dalam tanda kutip ganda "", diikuti kata "Skripsi.", diikuti titik.
                    4.  **Institusi Penerbit:** Nama institusi penerbit (misal: "Sekolah Tinggi Ilmu Hukum Jenderal Sudirman Lumajang"). Diakhiri titik.

                    **Contoh Format Skripsi yang Diinginkan:**
                    Jalil, Abdul (2007) "Implementasi Asas Keterbukaan Dalam pembentukan Peraturan Daerah Di Kabupaten Lumajang" <i>Skripsi</i>. Sekolah Tinggi Ilmu Hukum Jenderal Sudirman Lumajang.

                    **ATURAN MUTLAK:**
                    -   **JANGAN PERNAH menyertakan URL/link dari mana pun di hasil akhir sitasi.**
                    -   HANYA berikan teks sitasi yang sudah diformat. JANGAN berikan komentar, penjelasan, atau teks pengantar/penutup lainnya.
                    -   Jika suatu detail tidak dapat ditemukan di URL, tinggalkan kosong atau tulis "Tidak Tersedia" untuk bagian tersebut.

                    URL Skripsi untuk dianalisis:
                    ---
                    ${link}
                    ---
                `;
            } else if (type === 'makalah') {
                prompt = `
                    Anda adalah seorang spesialis daftar pustaka yang sangat teliti. Tugas Anda adalah mengekstrak semua detail yang diperlukan dari URL makalah berikut dan memformatnya menjadi sitasi.

                    **Pastikan untuk mengikuti format ini PERSIS seperti contoh yang diberikan, termasuk penggunaan tanda baca, spasi, dan kapitalisasi. Gunakan tag HTML <i> atau <em> untuk memiringkan teks yang diperlukan.**

                    **Informasi yang harus diekstrak dan format penulisan:**
                    1.  **Nama Penulis:** Nama belakang, Nama depan (jika bisa dibalik, contoh: Edward, Ferry). Jika tidak ada nama belakang yang jelas atau hanya satu nama, biarkan seperti "Edward, Ferry".
                    2.  **Tahun Publikasi:** Dalam kurung ().
                    3.  **Judul Makalah:** Dalam tanda kutip ganda "", diikuti kata "Makalah.", diikuti titik.
                    4.  **Nama Acara/Kegiatan:** Nama acara/kegiatan (misal: "Pendidikan dan Latihan Legal Drafting LAN"), diikuti koma.
                    5.  **Lokasi Acara:** Kota lokasi acara (misal: "Jakarta"), diikuti koma.
                    6.  **Tanggal Acara:** Bulan dan Tahun acara (misal: "September 2002"). Diakhiri titik.

                    **Contoh Format Makalah yang Diinginkan:**
                    Edward, Ferry (2002) "Teknik Penyusunan Peraturan Perundang-undangan Tingkat Daerah". <i>Makalah</i>. Pendidikan dan Latihan Legal Drafting LAN, Jakarta, September 2002.

                    **ATURAN MUTLAK:**
                    -   **JANGAN PERNAH menyertakan URL/link dari mana pun di hasil akhir sitasi.**
                    -   HANYA berikan teks sitasi yang sudah diformat. JANGAN berikan komentar, penjelasan, atau teks pengantar/penutup lainnya.
                    -   Jika suatu detail tidak dapat ditemukan di URL, tinggalkan kosong atau tulis "Tidak Tersedia" untuk bagian tersebut.

                    URL Makalah untuk dianalisis:
                    ---
                    ${link}
                    ---
                `;
            } else {
                prompt = `Buat daftar pustaka dari link atau teks ini: ${link}. Format daftar pustaka dan jangan sertakan URL/link di hasil akhir.`;
            }

            const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
            
            const payload = {
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.05, // Pertahankan rendah untuk konsistensi format dan akurasi ekstraksi
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
                citations.push(`Gagal menghasilkan sitasi untuk link ini: ${link}. Pastikan link valid dan dapat diakses publik. Error: ${data.error?.message || 'Respons tidak valid dari AI.'}`);
                continue; 
            }

            const rawAiText = data.candidates[0].content.parts[0].text;
            
            // Pembersihan agresif untuk memastikan tidak ada URL dan format sesuai
            let cleanedCitation = rawAiText
                .replace(/^[Ss]itasi:|Daftar Pustaka:|\n|\r/g, '') // Menghapus awalan umum
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
