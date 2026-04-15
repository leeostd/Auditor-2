import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, Timestamp, updateDoc, doc, orderBy, limit } from 'firebase/firestore';
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
  X,
  UserCheck,
  User,
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
    const q = query(collection(db, 'receipts'));
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

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Comprovante / Equipe</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tipo / Info</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data/Hora</th>
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
                            receipt.isVisualFraud ? "border-red-500 ring-red-200" : "border-slate-200 dark:border-slate-700"
                          )}
                          onClick={() => setSelectedImage(receipt.imageUrl || null)}
                        >
                          <img src={receipt.imageUrl} className="w-full h-full object-cover" alt="Thumbnail" />
                          {receipt.isVisualFraud && (
                            <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                              <AlertTriangle className="w-5 h-5 text-red-600 drop-shadow-sm" />
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
                          <span className="truncate">{receipt.employeeName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                          <User className="w-3 h-3" />
                          <span className="truncate">Auditor: {receipt.uploaderName}</span>
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
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{format(new Date(receipt.createdAt), 'dd/MM/yyyy', { locale: ptBR })}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{format(new Date(receipt.createdAt), 'HH:mm', { locale: ptBR })}</p>
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
                    <button 
                      onClick={() => receipt.imageUrl && setSelectedImage(receipt.imageUrl)}
                      className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
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
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 md:p-10"
            onClick={() => setSelectedImage(null)}
          >
            <button 
              className="absolute top-6 right-6 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              <X className="w-8 h-8" />
            </button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={selectedImage} 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              alt="Comprovante Full"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
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
