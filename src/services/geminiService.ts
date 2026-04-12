import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ExtractedReceiptData {
  transactionId: string;
  amount: number | null;
  date: string;
  payerName: string;
  receiverName: string;
  bank: string;
}

export async function extractReceiptData(base64Image: string, mimeType: string): Promise<ExtractedReceiptData> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Extraia as informações deste comprovante de PIX. 
  Se algum dado não for encontrado, retorne string vazia ou null para o valor.
  O valor deve ser um número (ex: 150.50).
  A data deve estar no formato ISO (YYYY-MM-DDTHH:mm:ssZ) se possível, ou o que encontrar.`;

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
          transactionId: { type: Type.STRING, description: "ID da transação ou código E2E" },
          amount: { type: Type.NUMBER, description: "Valor total da transação" },
          date: { type: Type.STRING, description: "Data e hora da transação" },
          payerName: { type: Type.STRING, description: "Nome de quem pagou" },
          receiverName: { type: Type.STRING, description: "Nome de quem recebeu" },
          bank: { type: Type.STRING, description: "Instituição bancária" },
        },
        required: ["transactionId", "amount", "date", "payerName", "receiverName", "bank"],
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
