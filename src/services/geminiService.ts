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

  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base64Image,
      mimeType,
      prompt,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Falha ao processar o comprovante com IA.");
  }

  return response.json();
}
