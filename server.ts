import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log("Iniciando Servidor Auditor PIX...");
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API de Extração com Gemini (Lado do Servidor)
  app.post("/api/extract", async (req, res) => {
    console.log("Requisição de extração recebida no servidor.");
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === "" || apiKey === "MY_GEMINI_API_KEY") {
        console.error("ERRO CRÍTICO: GEMINI_API_KEY não configurada no servidor.");
        return res.status(500).json({ 
          error: "A chave da API Gemini não foi encontrada no servidor. Certifique-se de adicioná-la aos Secrets do projeto com o nome exato 'GEMINI_API_KEY'." 
        });
      }

      const { base64Image, mimeType, prompt } = req.body;
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
      let cleanJson = responseText.trim();
      const jsonMatch = cleanJson.match(/```json\n?([\s\S]*?)\n?```/) || cleanJson.match(/```\n?([\s\S]*?)\n?```/);
      if (jsonMatch) cleanJson = jsonMatch[1].trim();

      res.json(JSON.parse(cleanJson));
      console.log("Extração concluída e enviada ao cliente.");
    } catch (error: any) {
      console.error("Erro no processamento Gemini:", error);
      res.status(500).json({ error: `Erro no servidor: ${error.message}` });
    }
  });

  // Roteamento Frontend
  if (process.env.NODE_ENV !== "production") {
    console.log("Modo Desenvolvimento: Ativando Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Modo Produção: Servindo arquivos estáticos de /dist...");
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Auditor PIX rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
