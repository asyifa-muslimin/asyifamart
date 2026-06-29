// api/gemini.ts
//
// Vercel Serverless Function — menggantikan route Express /api/gemini yang
// sebelumnya ada di server.ts. Express custom server seperti itu TIDAK
// otomatis berjalan di Vercel (platform serverless).
//
// CATATAN PERBAIKAN: versi sebelumnya pakai format "Web Handler"
// (Request/Response Web API standar) dan terbukti hang 5 menit tanpa
// outgoing request sama sekali (dikonfirmasi lewat Vercel Function Logs).
// Diganti ke format Node.js klasik (VercelRequest/VercelResponse dari
// @vercel/node) yang jauh lebih battle-tested dan sudah dipakai puluhan
// ribu project Vercel selama bertahun-tahun.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

let aiClient: InstanceType<typeof GoogleGenAI> | null = null;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi. Tambahkan di Vercel Dashboard > Project Settings > Environment Variables.');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Model-model yang dicoba berurutan: yang pertama paling diinginkan, fallback
// ke yang berikutnya kalau gagal/sibuk.
const MODELS_TO_TRY = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[api/gemini] Handler invoked, method:', req.method);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, systemInstruction } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "Field 'prompt' wajib diisi di body request." });
  }

  let ai: ReturnType<typeof getGeminiClient>;
  try {
    ai = getGeminiClient();
    console.log('[api/gemini] Gemini client initialized successfully.');
  } catch (err: any) {
    console.error('[api/gemini] Gemini initialization error:', err.message);
    return res.status(500).json({ error: err.message });
  }

  let lastError: any = null;
  let textResult: string | undefined = undefined;

  for (const model of MODELS_TO_TRY) {
    let attempts = 2;
    let delay = 800;

    while (attempts > 0) {
      try {
        console.log(`[api/gemini] Calling model ${model} (attempts left: ${attempts})...`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: systemInstruction ? { systemInstruction } : undefined,
        });

        console.log(`[api/gemini] Got response from ${model}.`);

        if (response && response.text) {
          textResult = response.text;
          break;
        }
        throw new Error('Empty response from Gemini API');
      } catch (error: any) {
        lastError = error;
        console.error(`[api/gemini] Error with model ${model} (attempts left: ${attempts}):`, error?.message || error);

        const errorMsg = String(error?.message || '').toLowerCase();
        const errorStatus = String(error?.status || '');
        const isTransient =
          errorStatus === 'UNAVAILABLE' ||
          errorMsg.includes('503') ||
          errorMsg.includes('high demand') ||
          errorMsg.includes('rate limit') ||
          errorMsg.includes('429') ||
          errorMsg.includes('unavailable');

        if (!isTransient) break;

        attempts--;
        if (attempts > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 1.5;
        }
      }
    }

    if (textResult !== undefined) break;
  }

  if (textResult !== undefined) {
    return res.status(200).json({ text: textResult });
  }

  const errorDetails = lastError?.message || String(lastError) || 'Gagal menghasilkan konten dari AI';
  console.error('[api/gemini] All models failed:', errorDetails);
  return res.status(500).json({ error: errorDetails });
}
