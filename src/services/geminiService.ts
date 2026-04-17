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
  
  const prompt = `Analise este documento com foco extremo em detecção de fraudes e extração de dados. 
  Ele pode ser um comprovante de PIX, depósito em lotérica ou cartão de crédito.
  
  IDENTIFICAÇÃO DE FRAUDE VISUAL (FORENSE):
  1. Verifique inconsistências de fontes (tamanhos, pesos ou estilos diferentes no mesmo campo).
  2. Procure por pixelização excessiva ou "borrões" ao redor de números e nomes (sinal de edição/montagem).
  3. Verifique o alinhamento dos textos. Textos levemente desalinhados ou sobrepostos são sinais de fraude.
  4. Analise se as cores do texto são uniformes. Tons de preto/cinza diferentes no mesmo documento indicam alteração.
  
  EXTRAÇÃO DE DADOS:
  1. Tipo: 'pix', 'lottery' ou 'credit_card'.
  2. ID da transação (Código E2E para PIX, Controle para Lotérica, Autorização para Cartão).
  3. Valor total (Número decimal).
  4. Data e hora (ISO YYYY-MM-DDTHH:mm:ssZ).
  5. Nome do pagador/cliente.
  6. Nome do recebedor/estabelecimento.
  7. Banco/Instituição.
  8. Localidade/CNPJ.

  RETORNO DE SEGURANÇA:
  - No campo 'fraudAnalysis', descreva detalhadamente qualquer anomalia visual encontrada.
  - No campo 'isVisualFraud', defina como true se houver sinais claros de edição.`;

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
