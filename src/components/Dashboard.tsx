import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, Timestamp, updateDoc, deleteDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logActivity } from '../lib/logger';
import { Receipt, UserProfile, ReceiptStatus } from '../types';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Trash2,
  X,
  FileType,
  UserCheck,
  User,
  Users,
  Clock
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format, subDays, startOfDay, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface DashboardProps {
  profile: UserProfile | null;
}

export function Dashboard({ profile }: DashboardProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Receipt));
      setReceipts(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const today = startOfDay(new Date());
  const yesterday = startOfDay(subDays(new Date(), 1));

  const stats = {
    total: receipts.length,
    valid: receipts.filter(r => r.status === 'Valid').length,
    fraud: receipts.filter(r => r.status === 'Fraud').length,
    totalValue: receipts.filter(r => r.status === 'Valid').reduce((acc, r) => acc + r.amount, 0),
  };

  const getTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '0%';
    const diff = ((current - previous) / previous) * 100;
    return `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`;
  };

  const todayReceipts = receipts.filter(r => isAfter(new Date(r.createdAt), today));
  const yesterdayReceipts = receipts.filter(r => {
    const d = new Date(r.createdAt);
    return isAfter(d, yesterday) && !isAfter(d, today);
  });

  const todayStats = {
    total: todayReceipts.length,
    fraud: todayReceipts.filter(r => r.status === 'Fraud').length,
    valid: todayReceipts.filter(r => r.status === 'Valid').length,
    value: todayReceipts.filter(r => r.status === 'Valid').reduce((acc, r) => acc + r.amount, 0),
  };

  const yesterdayStats = {
    total: yesterdayReceipts.length,
    fraud: yesterdayReceipts.filter(r => r.status === 'Fraud').length,
    valid: yesterdayReceipts.filter(r => r.status === 'Valid').length,
    value: yesterdayReceipts.filter(r => r.status === 'Valid').reduce((acc, r) => acc + r.amount, 0),
  };

  const trends = {
    total: getTrend(todayStats.total, yesterdayStats.total),
    fraud: getTrend(todayStats.fraud, yesterdayStats.fraud),
    valid: getTrend(todayStats.valid, yesterdayStats.valid),
    value: getTrend(todayStats.value, yesterdayStats.value),
  };

  const statusColors: any = {
    Valid: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    Fraud: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    Incomplete: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400",
    Divergent: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  };

  const statusLabels: any = {
    Valid: "Válido",
    Fraud: "Fraude",
    Incomplete: "Incompleto",
    Divergent: "Divergente",
  };

  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, transactionId: string } | null>(null);

  const confirmDelete = async () => {
    if (!deleteConfirm || !profile) return;
    
    try {
      await deleteDoc(doc(db, 'receipts', deleteConfirm.id));
      logActivity(
        profile.uid,
        'RECEIPT_DELETE',
        `Comprovante ${deleteConfirm.transactionId} excluído pelo administrador.`
      );
      toast.success('Comprovante removido com sucesso.');
      setDeleteConfirm(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir comprovante.');
    }
  };

  const handleDeleteReceipt = (id: string, transactionId: string) => {
    if (!id || profile?.role !== 'admin') return;
    setDeleteConfirm({ id, transactionId });
  };

  const handleStatusChange = async (receiptId: string, newStatus: ReceiptStatus, oldStatus: string, transactionId: string) => {
    if (profile?.role !== 'admin') {
      toast.error('Apenas administradores podem alterar o status.');
      return;
    }

    try {
      await updateDoc(doc(db, 'receipts', receiptId), { status: newStatus });
      logActivity(
        profile.uid,
        'STATUS_CHANGE',
        `Status do comprovante ${transactionId} alterado de ${statusLabels[oldStatus] || oldStatus} para ${statusLabels[newStatus]}.`
      );
      toast.success('Status atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar status.');
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Olá, {profile?.displayName.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Aqui está o resumo da auditoria de hoje.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          title="Total Auditado" 
          value={stats.total} 
          icon={TrendingUp} 
          color="blue" 
          trend={trends.total} 
        />
        <StatCard 
          title="Alertas de Fraude" 
          value={stats.fraud} 
          icon={AlertTriangle} 
          color="red" 
          trend={trends.fraud} 
          isNegative={trends.fraud.startsWith('+')}
        />
        <StatCard 
          title="Válidos" 
          value={stats.valid} 
          icon={CheckCircle2} 
          color="emerald" 
          trend={trends.valid} 
        />
        <StatCard 
          title="Valor Total (R$)" 
          value={stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} 
          icon={DollarSign} 
          color="indigo" 
          trend={trends.value} 
        />
      </div>

      {/* Recent Activity Table (Replacing Charts) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Atividades Recentes</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">Últimos comprovantes processados</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cliente / Origem</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tipo / Info</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data/Upload</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Valor</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {receipts.slice(0, 10).map((receipt) => (
                <tr key={receipt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {receipt.imageUrl ? (
                        <div 
                          className={cn(
                            "w-12 h-12 rounded-lg overflow-hidden border cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all flex-shrink-0 relative",
                            receipt.isVisualFraud && receipt.status !== 'Valid' ? "border-red-500 ring-red-200" : 
                            receipt.isVisualFraud && receipt.status === 'Valid' ? "border-emerald-500" :
                            "border-slate-200 dark:border-slate-700"
                          )}
                          onClick={() => setViewingReceipt(receipt)}
                        >
                          <img src={receipt.imageUrl} className="w-full h-full object-cover" alt="Thumbnail" />
                          {receipt.isVisualFraud && (
                            <div className={cn(
                              "absolute inset-0 flex items-center justify-center",
                              receipt.status === 'Valid' ? "bg-emerald-500/20" : "bg-red-500/20"
                            )}>
                              {receipt.status === 'Valid' ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 drop-shadow-sm" />
                              ) : (
                                <AlertTriangle className="w-5 h-5 text-red-600 drop-shadow-sm" />
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                          <Eye className="w-4 h-4" />
                        </div>
                      )}
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                          <UserCheck className="w-3 h-3 text-blue-500" />
                          <span className="truncate">{receipt.payerName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span className="truncate">Equipe: {receipt.employeeName}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded w-fit",
                        receipt.type === 'pix' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : 
                        receipt.type === 'lottery' ? "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" :
                        "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                      )}>
                        {receipt.type === 'pix' ? 'PIX' : receipt.type === 'lottery' ? 'Lotérica' : 'Cartão'}
                      </span>
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-300 truncate max-w-[150px]" title={receipt.transactionId}>
                        ID: {receipt.transactionId}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const receiptDate = new Date(receipt.date);
                      const isValid = !isNaN(receiptDate.getTime());
                      return (
                        <div className="flex flex-col">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {isValid ? format(receiptDate, 'dd/MM/yyyy', { locale: ptBR }) : receipt.date}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            Upload: {format(new Date(receipt.createdAt), 'HH:mm')}
                          </p>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">
                    R$ {receipt.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4">
                    {profile?.role === 'admin' ? (
                      <select
                        value={receipt.status}
                        onChange={(e) => handleStatusChange(receipt.id!, e.target.value as ReceiptStatus, receipt.status, receipt.transactionId)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold border-none cursor-pointer focus:ring-2 focus:ring-blue-500 dark:bg-slate-800",
                          statusColors[receipt.status]
                        )}
                      >
                        <option value="Valid">Válido</option>
                        <option value="Fraud">Fraude</option>
                        <option value="Divergent">Divergente</option>
                        <option value="Incomplete">Incompleto</option>
                      </select>
                    ) : (
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold",
                        statusColors[receipt.status]
                      )}>
                        {statusLabels[receipt.status] || receipt.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 relative z-10">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingReceipt(receipt);
                        }}
                        className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95 cursor-pointer"
                        title="Ver Comprovante e Análise"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      
                      {profile?.role === 'admin' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            receipt.id && handleDeleteReceipt(receipt.id, receipt.transactionId);
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all active:scale-95 cursor-pointer"
                          title="Excluir Registro"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {receipts.length === 0 && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            Nenhuma atividade recente encontrada.
          </div>
        )}
      </div>

      {/* Image Modal */}
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4"
            >
              <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Excluir Comprovante?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  Deseja realmente excluir o registro <span className="font-bold text-slate-700 dark:text-slate-200">#{deleteConfirm.transactionId}</span>?
                </p>
                <p className="text-xs text-red-500 dark:text-red-400 mt-1 font-medium">Esta ação não pode ser desfeita.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-200 dark:shadow-none"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingReceipt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 md:p-10"
            onClick={() => setViewingReceipt(null)}
          >
            <button 
              className="absolute top-6 right-6 p-2 text-white hover:bg-white/10 rounded-full transition-colors z-[110]"
              onClick={() => setViewingReceipt(null)}
            >
              <X className="w-8 h-8" />
            </button>
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden w-full max-w-6xl max-h-[90vh] flex flex-col md:flex-row shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image Section */}
              <div className="flex-1 bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-6 min-h-[300px] border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
                {viewingReceipt.imageUrl ? (
                  <img 
                    src={viewingReceipt.imageUrl} 
                    className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg"
                    alt="Comprovante"
                  />
                ) : (
                  <div className="text-slate-400 flex flex-col items-center gap-2">
                    <FileType className="w-12 h-12" />
                    <p>Sem imagem disponível</p>
                  </div>
                )}
              </div>

              {/* Data Section */}
              <div className="w-full md:w-[400px] flex flex-col bg-white dark:bg-slate-900 overflow-y-auto">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      statusColors[viewingReceipt.status]
                    )}>
                      {statusLabels[viewingReceipt.status] || viewingReceipt.status}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {viewingReceipt.type === 'pix' ? 'PIX' : viewingReceipt.type === 'lottery' ? 'Lotérica' : 'Cartão'}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Detalhes da Auditoria</h2>
                  <p className="text-xs text-slate-500 font-medium">Extraído por Gemini 3 Flash</p>
                </div>

                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <ViewData label="Valor" value={`R$ ${viewingReceipt.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} highlight />
                    <ViewData 
                      label="Data do Comprovante" 
                      value={(() => {
                        const d = new Date(viewingReceipt.date);
                        return !isNaN(d.getTime()) ? format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : viewingReceipt.date;
                      })()} 
                    />
                    <ViewData label="ID Transação" value={viewingReceipt.transactionId} />
                    <ViewData label="Banco" value={viewingReceipt.bank} />
                  </div>

                  <div className="space-y-4">
                    <ViewData label="Pagador" value={viewingReceipt.payerName} />
                    <ViewData label="Recebedor" value={viewingReceipt.receiverName} />
                  </div>

                  {viewingReceipt.fraudAnalysis && (
                    <div className={cn(
                      "p-4 rounded-2xl border transition-colors",
                      viewingReceipt.status === 'Valid' ? "bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20" :
                      viewingReceipt.status === 'Fraud' ? "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20" :
                      "bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20"
                    )}>
                      <p className={cn(
                        "text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1",
                        viewingReceipt.status === 'Valid' ? "text-blue-600 dark:text-blue-400" :
                        viewingReceipt.status === 'Fraud' ? "text-red-600 dark:text-red-400" :
                        "text-amber-600 dark:text-amber-400"
                      )}>
                        {viewingReceipt.status === 'Valid' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        Análise de Auditoria
                      </p>
                      <p className={cn(
                        "text-xs leading-relaxed italic",
                        viewingReceipt.status === 'Valid' ? "text-blue-800 dark:text-blue-300" :
                        viewingReceipt.status === 'Fraud' ? "text-red-800 dark:text-red-300" :
                        "text-amber-800 dark:text-amber-300"
                      )}>
                        "{viewingReceipt.fraudAnalysis}"
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Histórico de Upload</p>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
                        {viewingReceipt.uploaderName?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{viewingReceipt.uploaderName}</p>
                        <p className="text-[10px] text-slate-500">
                          {new Date(viewingReceipt.createdAt).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ViewData({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">{label}</p>
      <p className={cn(
        "text-sm font-medium",
        highlight ? "text-blue-600 dark:text-blue-400 font-bold" : "text-slate-900 dark:text-white"
      )}>{value}</p>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, trend, isNegative }: any) {
  const colors: any = {
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    red: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
    indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className={cn("p-2 rounded-xl", colors[color])}>
          <Icon className="w-4 h-4" />
        </div>
        <div className={cn(
          "flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full",
          isNegative ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
        )}>
          {isNegative ? <ArrowDownRight className="w-2.5 h-2.5" /> : <ArrowUpRight className="w-2.5 h-2.5" />}
          {trend}
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{title}</p>
      <h4 className="text-xl font-bold text-slate-900 dark:text-white">{value}</h4>
    </div>
  );
}
