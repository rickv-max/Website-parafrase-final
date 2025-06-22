export default async function handler(request, response) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return response.status(500).json({ error: "Kunci API Google belum diatur di Netlify." });
  }
  if (request.method !== 'POST') {
    return response.status(405).json({ error: "Gunakan metode POST" });
  }
  try {
    const { prompt } = request.body;
    if (!prompt) return response.status(400).json({ error: "Prompt dibutuhkan." });

    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    const apiResponse = await fetch(googleApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await apiResponse.json();
    if (!apiResponse.ok) throw new Error(data.error?.message || "Unknown API error");

    return response.status(200).json(data);
  } catch (error) {
    console.error('Error:', error);
    return response.status(500).json({ error: error.message });
  }
}
