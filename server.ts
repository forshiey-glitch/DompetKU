import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const geminiAi = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// Support base64 image uploads up to 20MB
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Helper to clean JSON string from LLM responses
function cleanJsonOutput(text: string): any {
  let cleaned = text.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    cleaned = fenced[1].trim();
  }
  // Extract first JSON object if surrounding prose exists
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

// Ensure image input is ALWAYS a valid Data URL (data:image/...;base64,...)
function ensureImageDataUrl(rawImage: string, mimeType = 'image/jpeg'): string {
  const sanitized = rawImage.trim();
  if (sanitized.startsWith('data:image/')) {
    const commaIdx = sanitized.indexOf(',');
    if (commaIdx !== -1) {
      const prefix = sanitized.slice(0, commaIdx + 1);
      const b64 = sanitized.slice(commaIdx + 1).replace(/\s+/g, '');
      return `${prefix}${b64}`;
    }
    return sanitized;
  }
  const safeMime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
  const cleanB64 = sanitized.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  return `data:${safeMime};base64,${cleanB64}`;
}

/**
 * Endpoint: POST /api/scan-receipt
 * Reads receipt image via z.ai GLM-4.6V-Flash (with Data URL format) or fallback to Gemini
 */
app.post('/api/scan-receipt', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      console.log('[ScanStruk] Request rejected: imageBase64 missing');
      res.status(400).json({ success: false, error: 'Gambar struk tidak ditemukan.' });
      return;
    }

    const formattedDataUrl = ensureImageDataUrl(imageBase64, mimeType);
    console.log('[ScanStruk] Image Data URL prepared:', formattedDataUrl.slice(0, 45) + '...');

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
            'Authorization': `Bearer ${zaiApiKey}`,
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
        res.json({ success: true, provider: 'AI OCR', data: parsed });
        return;
      } catch (err: any) {
        console.log('[ZAI Failed]', err?.message || err);
        if (!geminiApiKey) {
          res.status(502).json({
            success: false,
            error: `Gagal memproses struk: ${err?.message || 'Layanan OCR tidak merespons'}. Silakan coba lagi atau masukkan data secara manual.`,
          });
          return;
        }
      }
    }

    // 2. Fallback: Gemini API if available in environment
    if (geminiAi) {
      try {
        console.log('[ScanStruk] Attempting Gemini fallback...');
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
        res.json({ success: true, provider: 'AI Vision', data: parsed });
        return;
      } catch (err: any) {
        console.log('[ScanStruk Fallback Error]', err?.message || err);
        res.status(500).json({
          success: false,
          error: `Gagal memproses struk: ${err?.message || 'Kesalahan server'}. Silakan masukkan data secara manual.`,
        });
        return;
      }
    }

    console.log('[ScanStruk] No AI API key configured in environment');
    res.status(400).json({
      success: false,
      error: 'Kunci API OCR (ZAI_API_KEY) belum dikonfigurasi. Silakan masukkan transaksi secara manual.',
    });
  } catch (err: any) {
    console.log('[ScanStruk Unexpected Error]', err?.message || err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Terjadi kesalahan sistem saat memproses struk.',
    });
  }
});

/**
 * Endpoint: POST /api/consult
 * Financial consultation via OpenRouter (model: openrouter/free) or fallback to Gemini
 */
app.post('/api/consult', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, history = [], financialSummary } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      console.log('[Consult] Request rejected: empty message');
      res.status(400).json({ success: false, error: 'Pesan pertanyaan tidak boleh kosong.' });
      return;
    }

    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    const summaryText = financialSummary
      ? `\n\n--- RINGKASAN DATA KEUANGAN PENGGUNA SAAT INI ---
- Total Saldo Semua Dompet: Rp ${Number(financialSummary.totalWalletBalance || 0).toLocaleString('id-ID')}
- Total Pemasukan (3 Bulan Terakhir): Rp ${Number(financialSummary.totalIncome3Months || 0).toLocaleString('id-ID')}
- Total Pengeluaran (3 Bulan Terakhir): Rp ${Number(financialSummary.totalExpense3Months || 0).toLocaleString('id-ID')}
- Selisih/Net Simpanan: Rp ${Number(financialSummary.netSavings3Months || 0).toLocaleString('id-ID')}
- Pengeluaran Bulan Ini: Rp ${Number(financialSummary.currentMonthExpense || 0).toLocaleString('id-ID')}
- Pemasukan Bulan Ini: Rp ${Number(financialSummary.currentMonthIncome || 0).toLocaleString('id-ID')}
- Kategori Pengeluaran Terbesar: ${financialSummary.topExpenseCategories?.map((c: any) => `${c.name} (Rp ${Number(c.amount).toLocaleString('id-ID')})`).join(', ') || 'Belum ada data'}
- Status Target Tabungan: ${financialSummary.savingsGoalsStatus?.map((g: any) => `${g.name}: ${g.percentage}% (Rp ${Number(g.savedAmount).toLocaleString('id-ID')} / Rp ${Number(g.targetAmount).toLocaleString('id-ID')})`).join(', ') || 'Tidak ada target aktif'}
- Tagihan Mendatang: ${financialSummary.upcomingBills?.map((b: any) => `${b.name} (Rp ${Number(b.amount).toLocaleString('id-ID')}, tgl ${b.dueDay})`).join(', ') || 'Tidak ada tagihan mendesak'}
------------------------------------------------------`
      : '';

    const systemPrompt = `Anda adalah "Uangku AI", konsultan dan penasihat keuangan pribadi yang ramah, bijak, praktis, dan berorientasi solusi untuk pengguna di Indonesia.
Pedoman Anda:
1. Analisis kondisi keuangan pengguna berdasarkan ringkasan data keuangan yang dilampirkan.
2. Berikan saran yang realistis dengan gaya bahasa Indonesia santun, menyemangati, dan to the point.
3. Gunakan formatting bullet points atau nomor agar mudah dibaca.
4. Gunakan mata uang Rupiah (Rp).
5. Sertakan tips penghematan atau strategi alokasi (seperti 50/30/20 atau dana darurat) yang relevan.
6. Di akhir tanggapan, tambahkan pengingat singkat: "Catatan: Ini adalah simulasi saran AI dan bukan nasihat keuangan profesional berlisensi."`;

    // Ensure valid OpenRouter messages structure (non-empty string content, valid roles)
    const sanitizedHistory = Array.isArray(history)
      ? history
          .slice(-6)
          .filter((h: any) => h && typeof h.content === 'string' && h.content.trim().length > 0)
          .map((h: any) => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.content.trim(),
          }))
      : [];

    const messagesToSend = [
      { role: 'system', content: systemPrompt + summaryText },
      ...sanitizedHistory,
      { role: 'user', content: message.trim() },
    ];

    // 1. Primary: OpenRouter (openrouter/free)
    if (openrouterApiKey && openrouterApiKey !== 'your_openrouter_api_key_here') {
      try {
        console.log(`[OpenRouter] Sending consult request (${messagesToSend.length} messages) to model openrouter/free...`);
        const openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openrouterApiKey}`,
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
            'X-Title': 'Uangku Personal Finance',
          },
          body: JSON.stringify({
            model: 'openrouter/free',
            messages: messagesToSend,
            temperature: 0.7,
          }),
        });

        const rawBody = await openrouterRes.text();
        if (!openrouterRes.ok) {
          console.log(`[OpenRouter Error] Status ${openrouterRes.status}:`, rawBody);
          throw new Error(`OpenRouter status ${openrouterRes.status}: ${rawBody}`);
        }

        const openrouterData = JSON.parse(rawBody);
        const reply = openrouterData?.choices?.[0]?.message?.content;
        if (!reply || typeof reply !== 'string') {
          console.log('[OpenRouter Error] Missing reply content in payload:', rawBody);
          throw new Error('Model OpenRouter tidak mengembalikan jawaban teks.');
        }

        console.log('[OpenRouter] Consult reply generated successfully');
        res.json({ success: true, reply, provider: 'AI Advisor' });
        return;
      } catch (err: any) {
        console.log('[OpenRouter Failed]', err?.message || err);
        if (!geminiApiKey) {
          res.status(502).json({
            success: false,
            error: `Gagal menghubungi layanan AI: ${err?.message || 'OpenRouter tidak merespons'}. Silakan coba beberapa saat lagi.`,
          });
          return;
        }
      }
    }

    // 2. Fallback: Gemini API if available
    if (geminiAi) {
      try {
        console.log('[Consult] Attempting Gemini fallback...');
        const fullPrompt = `${systemPrompt}${summaryText}\n\nRiwayat Percakapan:\n${sanitizedHistory.map((h) => `${h.role}: ${h.content}`).join('\n')}\n\nPertanyaan Pengguna: ${message.trim()}`;

        const response = await geminiAi.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: fullPrompt,
        });

        const reply = response.text || '';
        if (!reply.trim()) {
          throw new Error('Respons AI kosong.');
        }
        console.log('[Consult] Fallback reply generated successfully');
        res.json({ success: true, reply, provider: 'AI Advisor' });
        return;
      } catch (err: any) {
        console.log('[Consult Fallback Error]', err?.message || err);
        res.status(500).json({
          success: false,
          error: `Gagal memproses konsultasi AI: ${err?.message || 'Kesalahan server'}`,
        });
        return;
      }
    }

    console.log('[Consult] No AI API key configured in environment');
    res.status(400).json({
      success: false,
      error: 'Kunci API konsultasi (OPENROUTER_API_KEY) belum dikonfigurasi.',
    });
  } catch (err: any) {
    console.log('[Consult Unexpected Error]', err?.message || err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Terjadi kesalahan sistem pada konsultasi AI.',
    });
  }
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    zaiConfigured: Boolean(process.env.ZAI_API_KEY && process.env.ZAI_API_KEY !== 'your_z_ai_api_key_here'),
    openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here'),
    geminiFallbackConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Setup Vite Dev Middleware or Static Serving
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Uangku] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Uangku] Server startup failed:', err);
  process.exit(1);
});
