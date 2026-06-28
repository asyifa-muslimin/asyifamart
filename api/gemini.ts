// api/gemini.ts
//
// Vercel Serverless Function — menggantikan route Express /api/gemini yang
// sebelumnya ada di server.ts. Express custom server seperti itu TIDAK
// otomatis berjalan di Vercel (platform serverless, beda model dari hosting
// Node.js biasa seperti Cloud Run/Railway yang menjalankan server.ts terus-
// menerus). Vercel mengenali file di folder /api/ sebagai endpoint otomatis:
// file ini akan diakses sebagai /api/gemini, persis seperti yang dipanggil
// dari AdminPanel.tsx.
//
// Format: Vercel Function "Web Handler" — menerima & mengembalikan objek
// Request/Response standar Web API, tidak butuh tipe @vercel/node tambahan.

import { GoogleGenAI } from '@google/genai';

let aiClient: InstanceType<typeof GoogleGenAI> | null = null;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi. Tambahkan di Vercel Dashboard > Project Settings > Environment Variables.');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'asyifamart-vercel',
        },
      },
    });
  }
  return aiClient;
}

// Model-model yang dicoba berurutan: yang pertama paling diinginkan, fallback
// ke yang berikutnya kalau gagal/sibuk. Daftar ini sama dengan yang sudah ada
// di server.ts sebelumnya.
const MODELS_TO_TRY = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  let body: { prompt?: string; systemInstruction?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body request tidak valid (harus JSON).' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { prompt, systemInstruction } = body;

  let ai: ReturnType<typeof getGeminiClient>;
  try {
    ai = getGeminiClient();
  } catch (err: any) {
    console.error('Gemini initialization error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let lastError: any = null;
  let textResult: string | undefined = undefined;

  for (const model of MODELS_TO_TRY) {
    let attempts = 3;
    let delay = 1000;

    while (attempts > 0) {
      try {
        console.log(`Calling Gemini API using model ${model} (attempts remaining: ${attempts})...`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
          },
        });

        if (response && response.text) {
          textResult = response.text;
          break;
        }
        throw new Error('Empty response from Gemini API');
      } catch (error: any) {
        lastError = error;
        console.error(`Error with model ${model} (attempts remaining: ${attempts}):`, error);

        const errorMsg = String(error.message || '').toLowerCase();
        const errorStatus = String(error.status || '');
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
          console.log(`Waiting ${delay}ms before retrying model ${model}...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 1.5;
        }
      }
    }

    if (textResult !== undefined) break;
  }

  if (textResult !== undefined) {
    return new Response(JSON.stringify({ text: textResult }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const errorDetails = lastError?.message || lastError || 'Gagal menghasilkan konten dari AI';
  console.error('Gemini API Error after all fallbacks:', errorDetails);
  return new Response(JSON.stringify({ error: errorDetails }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
