import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { collection, addDoc, query, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { extractReceiptData } from '../services/geminiService';
import { UserProfile, Receipt, Receiver, ReceiptStatus } from '../types';
import { Upload, FileType, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface ReceiptUploadProps {
  profile: UserProfile | null;
}

export function ReceiptUpload({ profile }: ReceiptUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Receipt | null>(null);
  const [authorizedReceivers, setAuthorizedReceivers] = useState<string[]>([]);

  useEffect(() => {
    const fetchReceivers = async () => {
      const q = query(collection(db, 'receivers'));
      const snapshot = await getDocs(q);
      setAuthorizedReceivers(snapshot.docs.map(doc => doc.data().name.toLowerCase()));
    };
    fetchReceivers();
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setIsProcessing(true);
    setResult(null);

    try {
      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const base64 = await base64Promise;

      // Extract with Gemini
      const extracted = await extractReceiptData(base64, file.type);
      
      // Validation Logic
      let status: ReceiptStatus = 'Valid';
      
      // 1. Check for incomplete data
      if (!extracted.transactionId || extracted.amount === null || isNaN(extracted.amount)) {
        status = 'Incomplete';
      }

      // 2. Check for duplicate (simplified for demo, should query Firestore)
      const duplicateQuery = query(collection(db, 'receipts'), where('transactionId', '==', extracted.transactionId));
      const duplicateSnap = await getDocs(duplicateQuery);
      if (!duplicateSnap.empty) {
        status = 'Fraud';
      }

      // 3. Check for receiver divergence
      if (status === 'Valid' && authorizedReceivers.length > 0) {
        const isAuthorized = authorizedReceivers.some(r => 
          extracted.receiverName.toLowerCase().includes(r) || 
          r.includes(extracted.receiverName.toLowerCase())
        );
        if (!isAuthorized) {
          status = 'Divergent';
        }
      }

      const newReceipt: Receipt = {
        transactionId: extracted.transactionId || 'N/A',
        amount: extracted.amount || 0,
        date: extracted.date || new Date().toISOString(),
        payerName: extracted.payerName || 'Desconhecido',
        receiverName: extracted.receiverName || 'Desconhecido',
        bank: extracted.bank || 'N/A',
        status,
        uploadedBy: profile?.uid || '',
        createdAt: new Date().toISOString(),
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'receipts'), newReceipt);
      
      // Log activity
      await addDoc(collection(db, 'activity_logs'), {
        userId: profile?.uid,
        action: 'RECEIPT_AUDITED',
        details: `Comprovante ${extracted.transactionId} auditado como ${status}`,
        timestamp: new Date().toISOString()
      });

      setResult({ ...newReceipt, id: docRef.id });
      toast.success('Comprovante processado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao processar comprovante.');
    } finally {
      setIsProcessing(false);
    }
  }, [profile, authorizedReceivers]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'application/pdf': [] },
    multiple: false,
    disabled: isProcessing
  } as any);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Auditoria de Comprovante</h1>
        <p className="text-slate-500 mt-2">Faça o upload do comprovante PIX para análise instantânea.</p>
      </header>

      <div 
        {...getRootProps()} 
        className={`
          relative border-3 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-400'}
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            {isProcessing ? <Loader2 className="w-10 h-10 animate-spin" /> : <Upload className="w-10 h-10" />}
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">
              {isProcessing ? 'Processando com IA...' : 'Arraste ou clique para enviar'}
            </p>
            <p className="text-slate-500">Suporta imagens (PNG, JPG) e PDF</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden"
          >
            <div className={`p-6 flex items-center justify-between ${
              result.status === 'Valid' ? 'bg-emerald-50 text-emerald-700' :
              result.status === 'Fraud' ? 'bg-red-50 text-red-700' :
              'bg-amber-50 text-amber-700'
            }`}>
              <div className="flex items-center gap-3">
                {result.status === 'Valid' ? <CheckCircle2 /> : <AlertCircle />}
                <span className="font-bold text-lg">Resultado: {result.status}</span>
              </div>
              <button onClick={() => setResult(null)} className="hover:opacity-70"><X /></button>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <DataRow label="ID Transação" value={result.transactionId} />
                <DataRow label="Valor" value={`R$ ${result.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <DataRow label="Data" value={result.date} />
              </div>
              <div className="space-y-4">
                <DataRow label="Pagador" value={result.payerName} />
                <DataRow label="Recebedor" value={result.receiverName} />
                <DataRow label="Banco" value={result.bank} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DataRow({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-slate-900 font-medium">{value}</p>
    </div>
  );
}
