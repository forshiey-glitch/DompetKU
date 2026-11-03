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
  // Remove markdown code fences if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned);
}

/**
 * Endpoint: POST /api/scan-receipt
 * Reads receipt image via z.ai GLM-4.6V-Flash (or fallback to Gemini if ZAI_API_KEY is not configured)
 */
app.post('/api/scan-receipt', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      res.status(400).json({ success: false, error: 'Gambar struk tidak ditemukan.' });
      return;
    }

    const formattedDataUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:${mimeType};base64,${imageBase64}`;

    const zaiApiKey = process.env.ZAI_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    // 1. Primary: z.ai GLM-4.6V-Flash
    if (zaiApiKey && zaiApiKey !== 'your_z_ai_api_key_here') {
      try {
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
                content: 'Anda adalah asisten OCR struk belanja. Analisis gambar struk dan kembalikan HANYA format JSON valid tanpa tanda kutip markdown backticks.',
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

        if (!response.ok) {
          const errText = await response.text();
          console.error('z.ai API error:', errText);
          throw new Error(`z.ai API error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '{}';
        const parsed = cleanJsonOutput(content);
        res.json({ success: true, provider: 'z.ai GLM-4.6V-Flash', data: parsed });
        return;
      } catch (err: any) {
        console.warn('z.ai call failed, trying fallback if available:', err.message);
        if (!geminiApiKey) {
          res.status(502).json({
            success: false,
            error: `Gagal memproses struk dengan z.ai: ${err.message}. Silakan periksa ZAI_API_KEY atau masukkan data secara manual.`,
          });
          return;
        }
      }
    }

    // 2. Intelligent Fallback: Gemini API if available in environment
    if (geminiAi) {
      try {
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
        res.json({ success: true, provider: 'AI Vision Fallback', data: parsed });
        return;
      } catch (err: any) {
        console.error('Gemini fallback error:', err);
        res.status(500).json({
          success: false,
          error: `Gagal memproses struk: ${err.message}. Silakan masukkan data secara manual.`,
        });
        return;
      }
    }

    // No API keys configured
    res.status(400).json({
      success: false,
      error: 'ZAI_API_KEY belum dikonfigurasi di file .env. Silakan atur ZAI_API_KEY atau masukkan data transaksi secara manual.',
    });
  } catch (err: any) {
    console.error('Unexpected scan error:', err);
    res.status(500).json({ success: false, error: err.message || 'Terjadi kesalahan sistem saat memproses struk.' });
  }
});

/**
 * Endpoint: POST /api/consult
 * Financial consultation via OpenRouter free model (or fallback to Gemini)
 */
app.post('/api/consult', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, history = [], financialSummary } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ success: false, error: 'Pesan pertanyaan tidak boleh kosong.' });
      return;
    }

    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    const summaryText = financialSummary
      ? `\n\n--- RINGKASAN DATA KEUANGAN PENGGUNA SAAT INI ---
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

    const systemPrompt = `Anda adalah "DompetKu AI", konsultan dan penasihat keuangan pribadi yang ramah, bijak, praktis, dan berorientasi solusi untuk pengguna di Indonesia.
Pedoman Anda:
1. Analisis kondisi keuangan pengguna berdasarkan ringkasan data keuangan yang dilampirkan.
2. Berikan saran yang realistis dengan gaya bahasa Indonesia santun, menyemangati, dan to the point.
3. Gunakan formatting bullet points atau nomor agar mudah dibaca.
4. Gunakan mata uang Rupiah (Rp).
5. Sertakan tips penghematan atau strategi alokasi (seperti 50/30/20 atau dana darurat) yang relevan.
6. Selalu ingat bahwa di akhir tanggapan, tambahkan pengingat singkat: "Catatan: Ini adalah simulasi saran AI dan bukan nasihat keuangan profesional berlisensi."`;

    // 1. Primary: OpenRouter
    if (openrouterApiKey && openrouterApiKey !== 'your_openrouter_api_key_here') {
      try {
        const messagesToSend = [
          { role: 'system', content: systemPrompt + summaryText },
          ...history.slice(-6).map((h: any) => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.content,
          })),
          { role: 'user', content: message },
        ];

        const openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openrouterApiKey}`,
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
            'X-Title': 'DompetKu Personal Finance',
          },
          body: JSON.stringify({
            model: 'openrouter/free',
            messages: messagesToSend,
            temperature: 0.7,
          }),
        });

        if (!openrouterRes.ok) {
          const errBody = await openrouterRes.text();
          console.error('OpenRouter error:', errBody);
          throw new Error(`OpenRouter returned status ${openrouterRes.status}: ${errBody}`);
        }

        const openrouterData = await openrouterRes.json();
        const reply = openrouterData.choices?.[0]?.message?.content;
        if (reply) {
          res.json({ success: true, reply, provider: 'OpenRouter (Free)' });
          return;
        }
      } catch (err: any) {
        console.warn('OpenRouter call failed, attempting fallback if available:', err.message);
        if (!geminiApiKey) {
          res.status(502).json({
            success: false,
            error: `Gagal menghubungi OpenRouter: ${err.message}. Periksa OPENROUTER_API_KEY Anda.`,
          });
          return;
        }
      }
    }

    // 2. Fallback: Gemini API if available
    if (geminiAi) {
      try {
        const fullPrompt = `${systemPrompt}${summaryText}\n\nRiwayat Percakapan:\n${history.map((h: any) => `${h.role}: ${h.content}`).join('\n')}\n\nPertanyaan Pengguna: ${message}`;

        const response = await geminiAi.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: fullPrompt,
        });

        const reply = response.text || '';
        res.json({ success: true, reply, provider: 'AI Advisor Fallback' });
        return;
      } catch (err: any) {
        console.error('Gemini consult error:', err);
        res.status(500).json({
          success: false,
          error: `Gagal memproses konsultasi AI: ${err.message}`,
        });
        return;
      }
    }

    // No API keys configured
    res.status(400).json({
      success: false,
      error: 'OPENROUTER_API_KEY belum dikonfigurasi di file .env. Silakan atur OPENROUTER_API_KEY untuk menggunakan fitur konsultasi AI.',
    });
  } catch (err: any) {
    console.error('Consultation error:', err);
    res.status(500).json({ success: false, error: err.message || 'Terjadi kesalahan sistem pada konsultasi AI.' });
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
    console.log(`[DompetKu] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[DompetKu] Server startup failed:', err);
  process.exit(1);
});
