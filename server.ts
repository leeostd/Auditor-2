import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Debugging endpoint for environment variables (MASKED)
  app.get("/api/debug-env", (req, res) => {
    const debugData: Record<string, string> = {};
    Object.keys(process.env).forEach(key => {
      if (key.includes('GEMINI') || key.includes('GOOGLE') || key.includes('API')) {
        const val = process.env[key] || "";
        debugData[key] = val.length > 4 ? `${val.substring(0, 4)}...${val.substring(val.length - 4)}` : (val ? "set but short" : "not set");
      }
    });
    res.json(debugData);
  });

  // AI Extraction Proxy
  app.post("/api/extract", async (req, res) => {
    console.log("AI Extraction request received");
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        console.error("GEMINI_API_KEY is missing or is the placeholder value");
        return res.status(500).json({ error: "A chave da API Gemini não está configurada corretamente nos segredos do projeto." });
      }

      const { base64Image, mimeType, prompt } = req.body;
      if (!base64Image || !mimeType) {
        return res.status(400).json({ error: "Imagem e tipo MIME são obrigatórios" });
      }

      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Image.split(',')[1] || base64Image,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['pix', 'lottery', 'credit_card'] },
              transactionId: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              date: { type: Type.STRING },
              payerName: { type: Type.STRING },
              receiverName: { type: Type.STRING },
              bank: { type: Type.STRING },
              location: { type: Type.STRING },
              cnpj: { type: Type.STRING },
              isVisualFraud: { type: Type.BOOLEAN },
              fraudAnalysis: { type: Type.STRING },
            },
            required: ["type", "transactionId", "amount", "date", "payerName", "receiverName", "bank", "isVisualFraud"],
          },
        },
      });

      const responseText = result.text || "";
      console.log("AI response received");
      
      // Clean markdown if present
      let cleanJson = responseText.trim();
      const jsonMatch = cleanJson.match(/```json\n?([\s\S]*?)\n?```/) || cleanJson.match(/```\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        cleanJson = jsonMatch[1].trim();
      }

      try {
        res.json(JSON.parse(cleanJson));
      } catch (e) {
        // Fallback for partial JSON
        const start = cleanJson.indexOf('{');
        const end = cleanJson.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          res.json(JSON.parse(cleanJson.substring(start, end + 1)));
        } else {
          throw e;
        }
      }
    } catch (error: any) {
      console.error("AI Extraction error:", error);
      res.status(500).json({ error: error.message || "Erro interno ao processar com IA." });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
