import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { collection, addDoc, query, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logActivity } from '../lib/logger';
import { extractReceiptData } from '../services/geminiService';
import { UserProfile, Receipt, ReceiptStatus, Employee } from '../types';
import { Upload, FileType, Loader2, CheckCircle2, AlertCircle, X, User, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface ReceiptUploadProps {
  profile: UserProfile | null;
}

export function ReceiptUpload({ profile }: ReceiptUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Receipt | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Receipt>>({});
  const [authorizedReceivers, setAuthorizedReceivers] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  // Multiple upload states
  const [uploadQueue, setUploadQueue] = useState<{ id: string, file: File, progress: 'pending' | 'processing' | 'done' | 'error', result?: Receipt }[]>([]);
  const [processingIndex, setProcessingIndex] = useState(-1);
  const [currentReviewId, setCurrentReviewId] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceivers = async () => {
      try {
        const q = query(collection(db, 'receivers'));
        const snapshot = await getDocs(q);
        setAuthorizedReceivers(snapshot.docs.map(doc => doc.data().name.toLowerCase()));
      } catch (err) {
        console.error("Error fetching receivers:", err);
      }
    };
    fetchReceivers();

    const unsubscribeEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    }, (error) => {
      console.error("Employee snapshot error:", error);
    });

    return () => unsubscribeEmployees();
  }, []);

  const handleSave = async () => {
    if (!editForm || !profile) return;
    
    setIsProcessing(true);
    try {
      const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
      const finalReceipt: Receipt = {
        ...editForm as Receipt,
        status: 'Valid',
        uploadedBy: profile.uid,
        uploaderName: profile.displayName,
        employeeId: selectedEmployeeId,
        employeeName: selectedEmployee?.name || 'Desconhecido',
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'receipts'), finalReceipt);
      
      logActivity(
        profile.uid,
        'UPLOAD_CONFIRMED',
        `Comprovante ${finalReceipt.transactionId} validado manualmente.`
      );

      const savedReceipt = { ...finalReceipt, id: docRef.id };

      if (currentReviewId) {
        setUploadQueue(prev => prev.map(item => 
          item.id === currentReviewId ? { ...item, result: savedReceipt } : item
        ));
      }

      setResult(savedReceipt);
      setIsEditing(false);
      setCurrentReviewId(null);
      toast.success('Comprovante salvo com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar no banco de dados.');
    } finally {
      setIsProcessing(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    if (!selectedEmployeeId) {
      toast.error('Por favor, selecione o funcionário primeiro.');
      return;
    }
    
    const newItems = acceptedFiles.map(file => ({ 
      id: Math.random().toString(36).substring(7),
      file, 
      progress: 'pending' as const 
    }));
    setUploadQueue(prev => [...prev, ...newItems]);
    setIsProcessing(true);
    setResult(null);
  }, [selectedEmployeeId]);

  useEffect(() => {
    const processNext = async () => {
      const pendingIndex = uploadQueue.findIndex(item => item.progress === 'pending');
      if (pendingIndex === -1) {
        if (uploadQueue.length > 0 && uploadQueue.every(i => i.progress === 'done' || i.progress === 'error')) {
          setIsProcessing(false);
        }
        return;
      }

      setProcessingIndex(pendingIndex);
      setUploadQueue(prev => prev.map((it, idx) => idx === pendingIndex ? { ...it, progress: 'processing' } : it));

      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(uploadQueue[pendingIndex].file);
        });
        const base64 = await base64Promise;

        const extracted = await extractReceiptData(base64, uploadQueue[pendingIndex].file.type);
        const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
        
        // Validation logic
        let status: ReceiptStatus = extracted.isVisualFraud ? 'Fraud' : 'Valid';
        if (status === 'Valid' && (!extracted.amount || !extracted.payerName || !extracted.receiverName)) {
          status = 'Incomplete';
        } else if (status === 'Valid' && authorizedReceivers.length > 0 && !authorizedReceivers.includes(extracted.receiverName.toLowerCase())) {
          status = 'Divergent';
        }

        const receiptData: Receipt = {
          ...extracted,
          status,
          employeeId: selectedEmployeeId,
          employeeName: selectedEmployee?.name || 'Desconhecido',
          uploadedBy: profile?.uid || '',
          uploaderName: profile?.displayName || 'Sistema',
          imageUrl: base64,
          createdAt: new Date().toISOString(),
        };

        if (status === 'Valid' && !extracted.isVisualFraud) {
          const docRef = await addDoc(collection(db, 'receipts'), receiptData);
          await logActivity(profile?.uid || 'system', 'RECEIPT_UPLOAD', `Comprovante R$ ${extracted.amount} processado automaticamente.`);
          setUploadQueue(prev => prev.map((it, idx) => idx === pendingIndex ? { ...it, progress: 'done', result: { ...receiptData, id: docRef.id } as Receipt } : it));
        } else {
          setUploadQueue(prev => prev.map((it, idx) => idx === pendingIndex ? { ...it, progress: 'done', result: receiptData } : it));
        }
      } catch (error) {
        console.error(error);
        setUploadQueue(prev => prev.map((it, idx) => idx === pendingIndex ? { ...it, progress: 'error' } : it));
        toast.error(`Erro ao processar arquivo ${pendingIndex + 1}`);
      }
    };

    if (isProcessing) processNext();
  }, [uploadQueue, isProcessing, selectedEmployeeId, employees, profile, authorizedReceivers]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'application/pdf': [] },
    multiple: true,
    disabled: isProcessing || !selectedEmployeeId
  } as any);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Auditoria de Comprovante</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Envio inteligente com análise forense de fraude.</p>
      </header>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Quem recebeu este pagamento?</label>
        <div className="relative group">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <select 
            className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-transparent rounded-xl focus:ring-2 focus:ring-blue-500 appearance-none font-medium text-slate-900 dark:text-white text-sm cursor-pointer transition-all"
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            disabled={isProcessing}
          >
            <option value="">Selecione um funcionário...</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
        </div>
      </div>

      <div 
        {...getRootProps()} 
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer",
          isDragActive ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400",
          (isProcessing || !selectedEmployeeId) && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
            {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
          </div>
          <div>
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {isProcessing ? `Lendo (${processingIndex + 1}/${uploadQueue.length})...` : 'Arraste ou clique para enviar vários'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Padrão forense de auditoria de imagem</p>
          </div>
        </div>
      </div>

      {uploadQueue.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Fila de Processamento ({uploadQueue.length})</h3>
            <button onClick={() => { setUploadQueue([]); setProcessingIndex(-1); }} className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase">Limpar Tudo</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {uploadQueue.map((item) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "p-3 rounded-xl border bg-white dark:bg-slate-900 flex items-center justify-between",
                  item.progress === 'processing' ? "border-blue-500 ring-1 ring-blue-500/20" : "border-slate-100 dark:border-slate-800"
                )}
              >
                <div className="flex items-center gap-3 truncate">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                    {item.progress === 'processing' ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" /> : item.progress === 'done' ? <img src={item.result?.imageUrl || ''} className="w-full h-full object-cover rounded-lg" alt="" /> : <FileType className="w-5 h-5 text-slate-400" />}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.file.name}</p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {item.progress === 'pending' ? 'Aguardando' : item.progress === 'processing' ? 'Lendo...' : item.progress === 'done' ? (item.result?.id ? 'Salvo' : 'Atenção') : 'Falha'}
                    </p>
                  </div>
                </div>
                {item.progress === 'done' && (
                  <button 
                    onClick={() => { if (item.result) { setEditForm(item.result); setCurrentReviewId(item.id); setIsEditing(true); } }}
                    className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all", item.result?.id ? "bg-emerald-50 text-emerald-600" : "bg-blue-600 text-white shadow-md")}
                  >
                    {item.result?.id ? 'Salvo' : 'Validar'}
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isEditing && editForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden w-full max-w-lg"
            >
              <div className="p-5 bg-blue-600 text-white flex items-center justify-between">
                <span className="font-bold">Validar Comprovante</span>
                <button onClick={() => setIsEditing(false)} className="hover:bg-white/20 p-1 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <img src={editForm.imageUrl} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">R$ {editForm.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{editForm.payerName}</p>
                  </div>
                </div>
                <div className={cn("p-4 rounded-2xl border flex items-start gap-3", editForm.status === 'Fraud' ? "bg-red-50 border-red-100 text-red-800" : "bg-amber-50 border-amber-100 text-amber-800")}>
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1 px-0 py-0">Alerta da IA</p>
                    <p className="text-xs italic leading-relaxed">"{editForm.fraudAnalysis || 'Verificar dados manualmente'}"</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button onClick={() => setIsEditing(false)} className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl">Descartar</button>
                  <button onClick={handleSave} disabled={isProcessing} className="py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2">
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Validar e Salvar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden"
        >
          <div className={cn("p-4 flex items-center justify-between", result.status === 'Valid' ? "bg-emerald-50 text-emerald-700" : result.status === 'Fraud' ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>
            <div className="flex items-center gap-2">
              {result.status === 'Valid' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="font-bold">Resultado: {result.status === 'Valid' ? 'Válido' : result.status === 'Fraud' ? 'Fraude' : 'Atenção'}</span>
            </div>
            <button onClick={() => setResult(null)}><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <DataRow label="ID" value={result.transactionId} />
              <DataRow label="Valor" value={`R$ ${result.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              <DataRow label="Data" value={result.date} />
            </div>
            <div className="space-y-3">
              <DataRow label="Pagador" value={result.payerName} />
              <DataRow label="Banco" value={result.bank} />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function DataRow({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-slate-900 dark:text-white font-medium truncate">{value}</p>
    </div>
  );
}
