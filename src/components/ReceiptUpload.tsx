import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { collection, addDoc, query, getDocs, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logActivity } from '../lib/logger';
import { extractReceiptData } from '../services/geminiService';
import { UserProfile, Receipt, Receiver, ReceiptStatus, Employee } from '../types';
import { Upload, FileType, Loader2, CheckCircle2, AlertCircle, X, User } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const statusLabels: Record<string, string> = {
  Valid: "Válido",
  Fraud: "Fraude",
  Incomplete: "Incompleto",
  Divergent: "Divergente",
};

interface ReceiptUploadProps {
  profile: UserProfile | null;
}

export function ReceiptUpload({ profile }: ReceiptUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Receipt | null>(null);
  const [authorizedReceivers, setAuthorizedReceivers] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  useEffect(() => {
    const fetchReceivers = async () => {
      const q = query(collection(db, 'receivers'));
      const snapshot = await getDocs(q);
      setAuthorizedReceivers(snapshot.docs.map(doc => doc.data().name.toLowerCase()));
    };
    fetchReceivers();

    const unsubscribeEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });

    return () => unsubscribeEmployees();
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    if (!selectedEmployeeId) {
      toast.error('Por favor, selecione o funcionário que recebeu o PIX primeiro.');
      return;
    }
    
    const file = acceptedFiles[0];
    setIsProcessing(true);
    setResult(null);

    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

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
      // For PIX, transactionId is required. For Lottery, it might be a control number.
      if (!extracted.amount || isNaN(extracted.amount) || !extracted.date || !extracted.receiverName) {
        status = 'Incomplete';
      }

      // 2. Check for visual fraud (Gemini Forensics)
      if (extracted.isVisualFraud) {
        status = 'Fraud';
      }

      // 3. Check for duplicate
      const receiptsRef = collection(db, 'receipts');
      let duplicateQuery;

      if (extracted.type === 'pix' && extracted.transactionId && extracted.transactionId !== 'N/A') {
        duplicateQuery = query(receiptsRef, where('transactionId', '==', extracted.transactionId));
      }

      if (duplicateQuery && status === 'Valid') {
        const duplicateSnap = await getDocs(duplicateQuery);
        if (!duplicateSnap.empty) {
          status = 'Fraud';
        }
      }

      // 4. Check for receiver divergence
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
        type: extracted.type,
        transactionId: extracted.transactionId || 'N/A',
        amount: extracted.amount || 0,
        date: extracted.date || new Date().toISOString(),
        payerName: extracted.payerName || 'Desconhecido',
        receiverName: extracted.receiverName || 'Desconhecido',
        bank: extracted.bank || 'N/A',
        location: extracted.location || '',
        cnpj: extracted.cnpj || '',
        status,
        isVisualFraud: extracted.isVisualFraud,
        fraudAnalysis: extracted.fraudAnalysis,
        uploadedBy: profile?.uid || '',
        uploaderName: profile?.displayName || 'Desconhecido',
        employeeId: selectedEmployeeId,
        employeeName: selectedEmployee?.name || 'Desconhecido',
        createdAt: new Date().toISOString(),
        imageUrl: base64,
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'receipts'), newReceipt);
      
      // Log activity
      logActivity(
        profile?.uid || 'unknown',
        'UPLOAD',
        `Comprovante ${extracted.transactionId} auditado como ${statusLabels[status] || status}. Recebido por: ${selectedEmployee?.name}`
      );

      setResult({ ...newReceipt, id: docRef.id });
      toast.success('Comprovante processado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao processar comprovante.');
    } finally {
      setIsProcessing(false);
    }
  }, [profile, authorizedReceivers, selectedEmployeeId, employees]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'application/pdf': [] },
    multiple: false,
    disabled: isProcessing || !selectedEmployeeId
  } as any);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Auditoria de Comprovante</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Selecione o funcionário e envie o comprovante.</p>
      </header>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Quem recebeu este pagamento?</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select 
            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 appearance-none font-medium text-slate-900 dark:text-white text-sm"
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            disabled={isProcessing}
          >
            <option value="">Selecione um funcionário...</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>
        {!selectedEmployeeId && (
          <p className="text-amber-600 dark:text-amber-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Você precisa selecionar um funcionário antes de fazer o upload.
          </p>
        )}
      </div>

      <div 
        {...getRootProps()} 
        className={`
          relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer
          ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-500'}
          ${(isProcessing || !selectedEmployeeId) ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
            {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
          </div>
          <div>
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {isProcessing ? 'Processando com IA...' : 'Arraste ou clique para enviar'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Suporta imagens (PNG, JPG) e PDF</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden"
          >
            <div className={`p-4 flex items-center justify-between ${
              result.status === 'Valid' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' :
              result.status === 'Fraud' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' :
              'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
            }`}>
              <div className="flex items-center gap-2">
                {result.status === 'Valid' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <span className="font-bold text-base">
                  Resultado: {
                    result.status === 'Valid' ? 'Válido' :
                    result.status === 'Fraud' ? 'Fraude' :
                    result.status === 'Divergent' ? 'Divergente' :
                    'Incompleto'
                  }
                </span>
              </div>
              <button onClick={() => setResult(null)} className="hover:opacity-70"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <DataRow 
                  label="Tipo" 
                  value={
                    result.type === 'pix' ? 'PIX' : 
                    result.type === 'lottery' ? 'Depósito Lotérica' : 
                    'Cartão de Crédito'
                  } 
                />
                <DataRow label="ID / Controle" value={result.transactionId} />
                <DataRow label="Valor" value={`R$ ${result.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <DataRow label="Data" value={result.date} />
              </div>
              <div className="space-y-4">
                <DataRow label="Pagador" value={result.payerName} />
                <DataRow label="Recebedor" value={result.receiverName} />
                <DataRow label="Banco / Adquirente" value={result.bank} />
                {result.location && <DataRow label="Localidade" value={result.location} />}
                {result.cnpj && <DataRow label="CNPJ" value={result.cnpj} />}
              </div>
              {result.fraudAnalysis && (
                <div className="col-span-full mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30">
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-1 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" />
                    Análise de Fraude (IA)
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-300 italic">"{result.fraudAnalysis}"</p>
                </div>
              )}
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
      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-slate-900 dark:text-white font-medium">{value}</p>
    </div>
  );
}
