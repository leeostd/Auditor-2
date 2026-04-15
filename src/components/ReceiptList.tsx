import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logActivity } from '../lib/logger';
import { Receipt, UserProfile, Employee, ReceiptStatus } from '../types';
import { Search, Filter, Calendar, Download, Eye, X, User, UserCheck, Users, AlertTriangle, FileBarChart } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReceiptListProps {
  profile: UserProfile | null;
}

export function ReceiptList({ profile }: ReceiptListProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'));
    const unsubscribeReceipts = onSnapshot(q, (snapshot) => {
      setReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Receipt)));
    });

    const qEmployees = query(collection(db, 'employees'), orderBy('name', 'asc'));
    const unsubscribeEmployees = onSnapshot(qEmployees, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });

    return () => {
      unsubscribeReceipts();
      unsubscribeEmployees();
    };
  }, []);

  const filteredReceipts = receipts.filter(r => {
    const matchesSearch = 
      r.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.payerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.receiverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesEmployee = employeeFilter === 'all' || r.employeeId === employeeFilter;
    
    return matchesSearch && matchesStatus && matchesEmployee;
  });

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

  const handleExportCSV = () => {
    if (filteredReceipts.length === 0) {
      toast.error('Nenhum dado para exportar.');
      return;
    }

    const headers = ['ID Transação', 'Tipo', 'Data', 'Valor', 'Status', 'Funcionário', 'Auditor', 'Banco', 'Análise Fraude'];
    const rows = filteredReceipts.map(r => [
      r.transactionId,
      r.type,
      format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm'),
      r.amount.toString(),
      r.status,
      r.employeeName,
      r.uploaderName,
      r.bank,
      r.fraudAnalysis || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `auditoria_pix_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exportação concluída!');
  };

  const handleExportPDF = () => {
    if (filteredReceipts.length === 0) {
      toast.error('Nenhum dado para o relatório.');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('Relatório de Auditoria PIX Pro', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
    doc.text(`Filtros aplicados: ${statusFilter === 'all' ? 'Todos' : statusFilter} | ${searchTerm || 'Nenhum'}`, 14, 35);

    // Summary Stats
    const totalAmount = filteredReceipts.reduce((sum, r) => sum + r.amount, 0);
    const fraudCount = filteredReceipts.filter(r => r.status === 'Fraud').length;
    
    doc.setDrawColor(241, 245, 249); // slate-100
    doc.line(14, 42, pageWidth - 14, 42);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`Total de Registros: ${filteredReceipts.length}`, 14, 52);
    doc.text(`Valor Total: R$ ${totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 59);
    doc.setTextColor(220, 38, 38); // red-600
    doc.text(`Alertas de Fraude: ${fraudCount}`, 14, 66);

    // Table
    const tableData = filteredReceipts.map(r => [
      r.transactionId,
      r.type.toUpperCase(),
      format(new Date(r.createdAt), 'dd/MM/yyyy'),
      `R$ ${r.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      r.status,
      r.employeeName,
      r.bank
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['ID Transação', 'Tipo', 'Data', 'Valor', 'Status', 'Funcionário', 'Banco']],
      body: tableData,
      headStyles: { fillColor: [37, 99, 235], fontSize: 9 }, // blue-600
      styles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 250, 252] }, // slate-50
    });

    doc.save(`relatorio_auditoria_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
    toast.success('Relatório PDF gerado!');
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
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Histórico de Auditoria</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Visualize e filtre todos os comprovantes processados.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-all active:scale-95 shadow-sm shadow-blue-200 dark:shadow-none"
          >
            <FileBarChart className="w-3.5 h-3.5" />
            Gerar Relatório PDF
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-blue-500 text-xs dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <select 
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none text-xs dark:text-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos os Status</option>
            <option value="Valid">Válidos</option>
            <option value="Fraud">Fraudes</option>
            <option value="Divergent">Divergentes</option>
            <option value="Incomplete">Incompletos</option>
          </select>
        </div>
        <div className="relative">
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <select 
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none text-xs dark:text-white"
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
          >
            <option value="all">Todos os Funcionários</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="date" 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-xs dark:text-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
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
              {filteredReceipts.map((receipt) => (
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
                      {receipt.fraudAnalysis && (
                        <p className="text-[10px] text-red-500 dark:text-red-400 font-medium italic truncate max-w-[150px]" title={receipt.fraudAnalysis}>
                          IA: {receipt.fraudAnalysis}
                        </p>
                      )}
                      {receipt.location && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]" title={receipt.location}>
                          Loc: {receipt.location}
                        </p>
                      )}
                      {receipt.cnpj && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]" title={receipt.cnpj}>
                          CNPJ: {receipt.cnpj}
                        </p>
                      )}
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
        {filteredReceipts.length === 0 && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            Nenhum comprovante encontrado.
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
