import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi di panel Settings > Secrets.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Proxy route for Gemini AI Generation (e.g. copywriting, category icons)
app.post("/api/gemini", async (req, res) => {
  const { prompt, systemInstruction } = req.body;
  
  let ai: GoogleGenAI;
  try {
    ai = getGeminiClient();
  } catch (err: any) {
    console.error("Gemini initialization error:", err.message);
    return res.status(500).json({ error: err.message });
  }
  
  const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
  let lastError: any = null;
  let textResult: string | undefined = undefined;

  for (const model of modelsToTry) {
    let attempts = 3;
    let delay = 1000;
    
    while (attempts > 0) {
      try {
        console.log(`Calling Gemini API using model ${model} (attempts remaining: ${attempts})...`);
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            systemInstruction: systemInstruction,
          }
        });
        
        if (response && response.text) {
          textResult = response.text;
          break; // successfully generated, break the while loop
        }
        throw new Error("Empty response from Gemini API");
      } catch (error: any) {
        lastError = error;
        console.error(`Error with model ${model} (attempts remaining: ${attempts}):`, error);
        
        // Check if error is transient (503 high demand, 429 rate limit, etc.)
        const errorMsg = String(error.message || "").toLowerCase();
        const errorStatus = String(error.status || "");
        const isTransient = 
          errorStatus === 'UNAVAILABLE' || 
          errorMsg.includes('503') || 
          errorMsg.includes('high demand') ||
          errorMsg.includes('rate limit') ||
          errorMsg.includes('429') ||
          errorMsg.includes('unavailable');
          
        if (!isTransient) {
          // If it's a non-transient error (e.g., bad request, bad key), don't waste time retrying this model
          break;
        }
        
        attempts--;
        if (attempts > 0) {
          console.log(`Waiting ${delay}ms before retrying model ${model}...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 1.5; // exponential backoff
        }
      }
    }
    
    if (textResult !== undefined) {
      break; // successfully generated, break the models loop
    }
  }

  if (textResult !== undefined) {
    res.json({ text: textResult });
  } else {
    const errorDetails = lastError?.message || lastError || "Gagal menghasilkan konten dari AI";
    console.error("Gemini API Error after all fallbacks:", errorDetails);
    res.status(500).json({ error: errorDetails });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
