import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Carrega variáveis de ambiente do .env se existir
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // --- CONFIGURAÇÃO MANUAL (RESOLUÇÃO DEFINITIVA) ---
  // Se o segredo da plataforma falhar, você pode colar sua chave abaixo:
  const MANUAL_API_KEY = "AIzaSyDdBjosvv26kg_GITnhh6vw-ewN2jXBAIw"; 

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
    const apiKeys = keys.filter(k => k.toLowerCase().includes('gemini') || k.toLowerCase().includes('google'));
    
    let key = MANUAL_API_KEY || 
              process.env.GEMINI_API_KEY || 
              process.env.GEMINI_KEY || 
              process.env.GOOGLE_API_KEY ||
              process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
              process.env.VITE_GEMINI_API_KEY;
    
    let source = MANUAL_API_KEY ? "Manual (Hardcoded)" : "Environment (Secret)";

    if (!key && !MANUAL_API_KEY) {
      for (const [k, v] of Object.entries(process.env)) {
        if (typeof v === 'string' && v.startsWith('AIza') && v.length > 20) {
          key = v;
          source = `Auto-Detected (${k})`;
          break;
        }
      }
    }

    res.json({ 
      status: "Servidor Auditor PIX Online", 
      time: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      detectedKeyNames: apiKeys,
      hasKey: !!key,
      keySource: source,
      keyLength: key ? key.length : 0,
      keyPreview: key && key.length > 3 ? `${key.substring(0, 3)}...` : "Não detectada"
    });
  });

  app.post("/api/extract", async (req, res) => {
    try {
      // Lista de fontes conhecidas
      console.log("[IA] Iniciando detecção de chave...");
      let apiKey = MANUAL_API_KEY || 
                   process.env.GEMINI_API_KEY || 
                   process.env.GEMINI_KEY || 
                   process.env.GOOGLE_API_KEY ||
                   process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
                   process.env.VITE_GEMINI_API_KEY;
      
      // Limpeza de valores comuns de erro/placeholder
      if (apiKey === "undefined" || apiKey === "null" || apiKey === "MY_GEMINI_API_KEY") {
        apiKey = "";
      }

      // Busca exaustiva: se as fontes conhecidas falharem, procura qualquer variável que pareça uma chave válida
      if (!apiKey || apiKey === "") {
        console.log("[IA] Busca exaustiva em process.env...");
        for (const [key, value] of Object.entries(process.env)) {
          if (typeof value === 'string' && value.length > 10) {
            // Log amigável para debug (protegido)
            if (value.startsWith('AIza')) {
              console.log(`[IA] Chave VÁLIDA (AIza...) detectada na variável: ${key}`);
              apiKey = value;
              break;
            } else if (key.includes('GEMINI') || key.includes('GOOGLE')) {
              console.log(`[IA] Variável suspeita encontrada: ${key} (Valor: ${value.substring(0, 3)}...)`);
              // Se tiver um tamanho razoável e estiver em um campo GEMINI, vamos tentar usar
              if (value.length > 20) {
                apiKey = value;
                break;
              }
            }
          }
        }
      }
      
      if (!apiKey || apiKey === "" || apiKey === "MY_GEMINI_API_KEY") {
        const similarKeys = Object.entries(process.env)
          .filter(([k]) => k.toLowerCase().includes('gemini') || k.toLowerCase().includes('google'))
          .map(([k, v]) => `${k} (${v ? 'com valor' : 'VAZIA'})`);
        
        console.error("ERRO: Nenhuma chave API válida encontrada. Chaves similares no sistema:", similarKeys);
        
        return res.status(500).json({ 
          error: "CONFIGURAÇÃO NECESSÁRIA: GEMINI_API_KEY não encontrada ou está vazia.",
          detail: similarKeys.length > 0 
            ? `Detectamos estas variáveis: ${similarKeys.join(', ')}. Por favor, verifique se você colou o valor da chave corretamente nos Segredos.`
            : "Vá em 'Settings' -> 'Secrets' e adicione 'GEMINI_API_KEY' com sua chave do Google AI Studio."
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
    const distPath = path.resolve(__dirname, '..', 'dist');
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
