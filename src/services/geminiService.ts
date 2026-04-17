import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ExtractedReceiptData {
  type: 'pix' | 'lottery' | 'credit_card';
  transactionId: string;
  amount: number | null;
  date: string;
  payerName: string;
  receiverName: string;
  bank: string;
  location?: string;
  cnpj?: string;
  isVisualFraud: boolean;
  fraudAnalysis?: string;
}

export async function extractReceiptData(base64Image: string, mimeType: string): Promise<ExtractedReceiptData> {
  const model = "gemini-3-flash-preview";
  
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

  const response = await ai.models.generateContent({
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
          isVisualFraud: { type: Type.BOOLEAN, description: "Indica se há sinais visuais de adulteração na imagem" },
          fraudAnalysis: { type: Type.STRING, description: "Descrição detalhada das anomalias encontradas" },
        },
        required: ["type", "transactionId", "amount", "date", "payerName", "receiverName", "bank", "isVisualFraud"],
      },
    },
  });

  try {
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Falha ao processar o comprovante com IA.");
  }
}
