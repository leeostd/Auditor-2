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
  app.use(express.json({ limit: '20mb' }));

  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenAI({ apiKey: apiKey || "" });

  // API Route for Gemini Extraction
  app.post("/api/extract", async (req, res) => {
    console.log("Recebendo requisição de extração...");
    try {
      if (!apiKey) {
        console.error("Erro: GEMINI_API_KEY não encontrada no ambiente.");
        return res.status(500).json({ error: "Configuração de IA ausente (GEMINI_API_KEY)" });
      }

      const { base64Image, mimeType, prompt } = req.body;
      if (!base64Image || !mimeType) {
        console.error("Erro: Dados incompletos na requisição.");
        return res.status(400).json({ error: "Imagem e tipo MIME são obrigatórios" });
      }

      console.log(`Processando imagem type: ${mimeType}, base64 length: ${base64Image.length}`);

      const model = "gemini-2.0-flash"; // More stable for vision tasks

      const result = await genAI.models.generateContent({
        model,
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

      let rawText = result.text || "";
      console.log("Gemini respondeu. Tamanho da resposta:", rawText.length);
      
      // Clean markdown if present
      const jsonMatch = rawText.match(/```json\n([\s\S]*?)\n```/) || rawText.match(/```([\s\S]*?)```/);
      const cleanJson = jsonMatch ? jsonMatch[1] : rawText;

      res.json(JSON.parse(cleanJson));
    } catch (error: any) {
      console.error("Gemini Error Details:", JSON.stringify(error, null, 2));
      const errorMessage = error.message || "Erro interno ao processar com Gemini";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", aiEnabled: !!apiKey });
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
