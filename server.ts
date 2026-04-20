import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // --- CONFIGURAÇÃO MANUAL (RESOLUÇÃO DEFINITIVA) ---
  // Se o segredo da plataforma falhar, você pode colar sua chave abaixo:
  const MANUAL_API_KEY = ""; 

  // Middleware básico
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Log de requisições para diagnóstico
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  // --- ROTAS DE API (DEVEM VIR ANTES DO VITE) ---
  
  app.get("/api/status", (req, res) => {
    const keys = Object.keys(process.env);
    const apiKeys = keys.filter(k => k.toLowerCase().includes('gemini') || k.toLowerCase().includes('key'));
    
    const key = MANUAL_API_KEY || process.env.GEMINI_API_KEY;
    res.json({ 
      status: "Servidor Auditor PIX Online", 
      time: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      detectedKeys: apiKeys,
      hasGeminiKey: !!key,
      keySource: MANUAL_API_KEY ? "Manual (Hardcoded)" : "Environment (Secret)",
      keyLength: key ? key.length : 0,
      keyPreview: key && key.length > 3 ? `${key.substring(0, 3)}...` : "Não detectada"
    });
  });

  app.post("/api/extract", async (req, res) => {
    try {
      // Prioridade: Chave Manual > Segredo GEMINI_API_KEY
      const apiKey = MANUAL_API_KEY || process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === "" || apiKey === "MY_GEMINI_API_KEY") {
        console.error("ERRO: Nenhuma chave API válida encontrada.");
        return res.status(500).json({ 
          error: "GEMINI_API_KEY não detectada. DICA: Se você já adicionou nos Segredos, tente REINICIAR o Servidor. Caso contrário, você pode colar a chave manualmente no arquivo 'server.ts' na linha 14." 
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
              isVisualFraud: { type: Type.BOOLEAN },
              fraudAnalysis: { type: Type.STRING },
            },
            required: ["type", "transactionId", "amount", "date", "payerName", "receiverName", "bank", "isVisualFraud"],
          },
        },
      });

      const responseText = result.text || "{}";
      let cleanJson = responseText.trim();
      const jsonMatch = cleanJson.match(/```json\n?([\s\S]*?)\n?```/) || cleanJson.match(/```\n?([\s\S]*?)\n?```/);
      if (jsonMatch) cleanJson = jsonMatch[1].trim();

      res.json(JSON.parse(cleanJson));
    } catch (error: any) {
      console.error("Erro API Extract:", error);
      res.status(500).json({ error: error.message || "Erro interno no servidor de IA." });
    }
  });

  // --- CONFIGURAÇÃO DO FRONTEND ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      root: process.cwd(),
      server: { 
        middlewareMode: true, 
        host: '0.0.0.0', 
        port: 3000,
        watch: {
          usePolling: true,
          interval: 100
        }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> Servidor Auditor PIX rodando na porta ${PORT}`);
  });
}

startServer();
