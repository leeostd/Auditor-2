import { GoogleGenAI, Type } from "@google/genai";

export async function checkAiConfiguration() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, message: "GEMINI_API_KEY não encontrada no ambiente." };
  if (key === "MY_GEMINI_API_KEY") return { ok: false, message: "A chave ainda é o valor padrão (MY_GEMINI_API_KEY). Configure nos segredos." };
  
  const masked = key.length > 8 ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : "***";
  return { ok: true, message: `Chave detectada: ${masked} (Total: ${key.length} caracteres)` };
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ExtractedReceiptData {
  type: 'pix' | 'lottery' | 'credit_card';
  transactionId: string;
  amount: number;
  date: string;
  payerName: string;
  receiverName: string;
  bank: string;
  location?: string;
  cnpj?: string;
  isVisualFraud: boolean;
  fraudAnalysis: string;
}

export async function extractReceiptData(base64Image: string, mimeType: string): Promise<ExtractedReceiptData> {
  // Current date in Brazil (America/Sao_Paulo) for reference
  const now = new Date();
  const brDate = new Intl.DateTimeFormat('pt-BR', { 
    dateStyle: 'full', 
    timeStyle: 'long', 
    timeZone: 'America/Sao_Paulo' 
  }).format(now);

  const prompt = `Analise este documento com foco em PERÍCIA FORENSE e extração de dados. 
  
  DIRETRIZES DE FRAUDE (PRIORIDADE MÁXIMA):
  1. FOCO EM ADULTERAÇÃO: Procure sinais de montagem, como fontes diferentes no mesmo campo, desalinhamento, pixelização suspeita ao redor de valores/nomes ou fundos que não batem com a textura do papel/tela.
  2. DUPLICAÇÃO: Verifique se o ID da transação parece genérico ou gerado.
  3. TOLERÂNCIA: Ignore variações irrelevantes como letras minúsculas em IDs (ex: e2e... vs E2E...) ou sequências de números que não são datas. 
  4. RELATIVIDADE TEMPORAL: Use a referência abaixo. Se for anterior ou igual a hoje, é histórico válido.
  
  REFERÊNCIA TEMPORAL:
  - Data/Hora de hoje (Brasília): ${brDate}
  
  EXTRAÇÃO DE DADOS:
  1. Tipo: 'pix', 'lottery' ou 'credit_card'.
  2. ID da transação (Código E2E para PIX, Controle para Lotérica, Autorização para Cartão).
  3. Valor total (Número decimal).
  4. Data e hora (ISO YYYY-MM-DDTHH:mm:ssZ). SE A DATA NÃO TIVER ANO, ASSUMA O ANO DA REFERÊNCIA TEMPORAL.
  5. Nome do pagador/cliente.
  6. Nome do recebedor/estabelecimento.
  7. Banco/Instituição.
  8. Localidade/CNPJ.
  
  RETORNO:
  - 'isVisualFraud': true APENAS se houver sinais claros de EDIÇÃO DE IMAGEM (montagem). 
  - 'fraudAnalysis': Explicação breve do motivo. Se for válido, use "Comprovante íntegro".`;

  try {
    const response = await ai.models.generateContent({
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

    const rawText = response.text || "";
    // Clean markdown if present
    const jsonMatch = rawText.match(/```json\n?([\s\S]*?)\n?```/) || rawText.match(/```\n?([\s\S]*?)\n?```/);
    const cleanJson = (jsonMatch ? jsonMatch[1].trim() : rawText.trim());
    
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("Gemini service error:", error);
    
    if (error.message?.includes("API key not valid")) {
      throw new Error("Chave de API inválida. Verifique os segredos do projeto.");
    }
    if (error.message?.includes("User location is not supported")) {
      throw new Error("O Google Gemini não está disponível na sua região atual (VPN pode ajudar).");
    }
    if (error.status === "RESOURCE_EXHAUSTED" || error.message?.includes("quota")) {
      throw new Error("Limite de uso da IA atingido. Tente novamente em alguns minutos.");
    }

    throw new Error(`Erro na IA: ${error.message || "Falha desconhecida na conexão com Google Gemini"}`);
  }
}
