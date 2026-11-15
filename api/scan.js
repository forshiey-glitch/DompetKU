import { GoogleGenAI } from '@google/genai';

function cleanJsonOutput(text) {
  let cleaned = String(text || '').trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    cleaned = fenced[1].trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

function ensureImageDataUrl(rawImage, mimeType = 'image/jpeg') {
  const sanitized = String(rawImage || '').trim();
  if (sanitized.startsWith('data:image/')) {
    const commaIdx = sanitized.indexOf(',');
    if (commaIdx !== -1) {
      const prefix = sanitized.slice(0, commaIdx + 1);
      const b64 = sanitized.slice(commaIdx + 1).replace(/\s+/g, '');
      return `${prefix}${b64}`;
    }
    return sanitized;
  }
  const safeMime = String(mimeType).startsWith('image/') ? mimeType : 'image/jpeg';
  const cleanB64 = sanitized.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  return `data:${safeMime};base64,${cleanB64}`;
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = parseBody(req.body);
    const { imageBase64, mimeType = 'image/jpeg' } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      console.log('[ScanStruk] Request rejected: imageBase64 missing');
      return res.status(400).json({ success: false, error: 'Gambar struk tidak ditemukan.' });
    }

    const formattedDataUrl = ensureImageDataUrl(imageBase64, mimeType);
    const zaiApiKey = process.env.ZAI_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    // 1. Primary: z.ai GLM-4.6V-Flash
    if (zaiApiKey && zaiApiKey !== 'your_z_ai_api_key_here') {
      try {
        console.log('[ZAI] Sending receipt scan request to glm-4.6v-flash...');
        const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${zaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'glm-4.6v-flash',
            messages: [
              {
                role: 'system',
                content:
                  'Anda adalah asisten OCR struk belanja. Analisis gambar struk dan kembalikan HANYA JSON valid tanpa teks tambahan atau markdown backticks.',
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Ekstrak informasi dari struk belanja ini. Format JSON wajib persis seperti ini: {"merchant": "Nama Toko/Restoran", "tanggal": "YYYY-MM-DD", "total": 0, "items": [{"name": "Nama Produk", "qty": 1, "price": 0}]}. Jika ada kolom yang tidak terbaca, gunakan tanggal hari ini atau perkiraan logis, nominal harus berupa angka bulat positif (Rupiah).',
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: formattedDataUrl,
                    },
                  },
                ],
              },
            ],
            temperature: 0.1,
          }),
        });

        const rawText = await response.text();
        if (!response.ok) {
          console.log(`[ZAI Error] Status ${response.status}:`, rawText);
          throw new Error(`ZAI API error (${response.status}): ${rawText}`);
        }

        const data = JSON.parse(rawText);
        const content = data?.choices?.[0]?.message?.content;
        if (!content || typeof content !== 'string') {
          console.log('[ZAI Error] Empty or invalid choices payload:', rawText);
          throw new Error('Respons ZAI tidak berisi hasil pembacaan struk.');
        }

        const parsed = cleanJsonOutput(content);
        console.log('[ZAI] Receipt parsed successfully for merchant:', parsed?.merchant);
        return res.status(200).json({ success: true, provider: 'AI OCR', data: parsed });
      } catch (err) {
        console.log('[ZAI Failed]', err?.message || err);
        if (!geminiApiKey) {
          return res.status(502).json({
            success: false,
            error: `Gagal memproses struk: ${err?.message || 'Layanan OCR tidak merespons'}. Silakan coba lagi atau masukkan data secara manual.`,
          });
        }
      }
    }

    // 2. Fallback: Gemini API if available in environment
    if (geminiApiKey) {
      try {
        console.log('[ScanStruk] Attempting Gemini fallback...');
        const geminiAi = new GoogleGenAI({ apiKey: geminiApiKey });
        const base64Data = formattedDataUrl.replace(/^data:[^;]+;base64,/, '');
        const actualMime = formattedDataUrl.match(/^data:([^;]+);/)?.[1] || mimeType;

        const response = await geminiAi.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: 'Ekstrak informasi dari struk belanja ini. Kembalikan HANYA format JSON valid tanpa backticks markdown: {"merchant": "Nama Toko/Merchant", "tanggal": "YYYY-MM-DD", "total": 0, "items": [{"name": "Nama Barang", "qty": 1, "price": 0}]}. Nominal total dan price harus angka (integer Rupiah). Jika tanggal tidak tertera jelas, gunakan tanggal hari ini.',
                },
                {
                  inlineData: {
                    mimeType: actualMime,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
          },
        });

        const text = response.text || '{}';
        const parsed = cleanJsonOutput(text);
        console.log('[ScanStruk] Fallback parsed successfully');
        return res.status(200).json({ success: true, provider: 'AI Vision', data: parsed });
      } catch (err) {
        console.log('[ScanStruk Fallback Error]', err?.message || err);
        return res.status(500).json({
          success: false,
          error: `Gagal memproses struk: ${err?.message || 'Kesalahan server'}. Silakan masukkan data secara manual.`,
        });
      }
    }

    console.log('[ScanStruk] No AI API key configured in environment');
    return res.status(400).json({
      success: false,
      error: 'Kunci API OCR (ZAI_API_KEY) belum dikonfigurasi. Silakan masukkan transaksi secara manual.',
    });
  } catch (err) {
    console.log('[ScanStruk Unexpected Error]', err?.message || err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Terjadi kesalahan sistem saat memproses struk.',
    });
  }
}
