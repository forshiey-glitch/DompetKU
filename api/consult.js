import { GoogleGenAI } from '@google/genai';

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
    const { message, history = [], financialSummary } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      console.log('[Consult] Request rejected: empty message');
      return res.status(400).json({ success: false, error: 'Pesan pertanyaan tidak boleh kosong.' });
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
- Kategori Pengeluaran Terbesar: ${financialSummary.topExpenseCategories?.map((c) => `${c.name} (Rp ${Number(c.amount).toLocaleString('id-ID')})`).join(', ') || 'Belum ada data'}
- Status Target Tabungan: ${financialSummary.savingsGoalsStatus?.map((g) => `${g.name}: ${g.percentage}% (Rp ${Number(g.savedAmount).toLocaleString('id-ID')} / Rp ${Number(g.targetAmount).toLocaleString('id-ID')})`).join(', ') || 'Tidak ada target aktif'}
- Tagihan Mendatang: ${financialSummary.upcomingBills?.map((b) => `${b.name} (Rp ${Number(b.amount).toLocaleString('id-ID')}, tgl ${b.dueDay})`).join(', ') || 'Tidak ada tagihan mendesak'}
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

    const sanitizedHistory = Array.isArray(history)
      ? history
          .slice(-6)
          .filter((h) => h && typeof h.content === 'string' && h.content.trim().length > 0)
          .map((h) => ({
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
        const originUrl = req.headers?.origin || process.env.APP_URL || 'https://uangku.vercel.app';
        const openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openrouterApiKey}`,
            'HTTP-Referer': originUrl,
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
        return res.status(200).json({ success: true, reply, provider: 'AI Advisor' });
      } catch (err) {
        console.log('[OpenRouter Failed]', err?.message || err);
        if (!geminiApiKey) {
          return res.status(502).json({
            success: false,
            error: `Gagal menghubungi layanan AI: ${err?.message || 'OpenRouter tidak merespons'}. Silakan coba beberapa saat lagi.`,
          });
        }
      }
    }

    // 2. Fallback: Gemini API if available
    if (geminiApiKey) {
      try {
        console.log('[Consult] Attempting Gemini fallback...');
        const geminiAi = new GoogleGenAI({ apiKey: geminiApiKey });
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
        return res.status(200).json({ success: true, reply, provider: 'AI Advisor' });
      } catch (err) {
        console.log('[Consult Fallback Error]', err?.message || err);
        return res.status(500).json({
          success: false,
          error: `Gagal memproses konsultasi AI: ${err?.message || 'Kesalahan server'}`,
        });
      }
    }

    console.log('[Consult] No AI API key configured in environment');
    return res.status(400).json({
      success: false,
      error: 'Kunci API konsultasi (OPENROUTER_API_KEY) belum dikonfigurasi.',
    });
  } catch (err) {
    console.log('[Consult Unexpected Error]', err?.message || err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Terjadi kesalahan sistem pada konsultasi AI.',
    });
  }
}
