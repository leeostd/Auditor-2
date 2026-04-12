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
}

export async function extractReceiptData(base64Image: string, mimeType: string): Promise<ExtractedReceiptData> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Analise este documento. Ele pode ser um comprovante de PIX, um comprovante de depósito bancário feito em lotérica ou um comprovante de pagamento via cartão de crédito.
  
  Identifique o tipo do documento: 'pix', 'lottery' ou 'credit_card'.
  
  Extraia as seguintes informações:
  1. ID da transação (para PIX é o código E2E, para lotérica é o número de controle, para cartão é o código de autorização/NSU).
  2. Valor total (como número, ex: 150.50).
  3. Data e hora (tente formatar como ISO YYYY-MM-DDTHH:mm:ssZ).
  4. Nome do pagador/depositante/cliente.
  5. Nome do recebedor/favorecido/estabelecimento.
  6. Banco/Instituição/Adquirente (ex: Cielo, Rede, Stone).
  7. Localidade/Cidade/Unidade Lotérica (principalmente para depósitos em lotérica).
  8. CNPJ do estabelecimento (principalmente para comprovantes de cartão de crédito).
  
  Se algum dado não for encontrado, retorne string vazia ou null para o valor numérico.
  Verifique sinais de alteração ou edição na imagem que possam indicar fraude.`;

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
          type: { type: Type.STRING, enum: ['pix', 'lottery', 'credit_card'], description: "Tipo do comprovante" },
          transactionId: { type: Type.STRING, description: "ID da transação, código de controle ou autorização" },
          amount: { type: Type.NUMBER, description: "Valor total" },
          date: { type: Type.STRING, description: "Data e hora" },
          payerName: { type: Type.STRING, description: "Nome de quem pagou/depositou" },
          receiverName: { type: Type.STRING, description: "Nome de quem recebeu" },
          bank: { type: Type.STRING, description: "Instituição bancária ou adquirente" },
          location: { type: Type.STRING, description: "Localidade ou unidade lotérica" },
          cnpj: { type: Type.STRING, description: "CNPJ do estabelecimento" },
        },
        required: ["type", "transactionId", "amount", "date", "payerName", "receiverName", "bank"],
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
