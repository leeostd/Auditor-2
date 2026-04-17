import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logActivity } from '../lib/logger';
import { Receipt, UserProfile, Employee, ReceiptStatus } from '../types';
import { 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  Eye, 
  X, 
  User, 
  UserCheck, 
  Users, 
  AlertTriangle, 
  FileBarChart,
  Trash2,
  FileType,
  CheckCircle2,
  Clock
} from 'lucide-react';
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
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, transactionId: string } | null>(null);

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

  const confirmDelete = async () => {
    if (!deleteConfirm || !profile) return;
    
    try {
      await deleteDoc(doc(db, 'receipts', deleteConfirm.id));
      logActivity(
        profile.uid,
        'DELETE_RECEIPT',
        `Comprovante ${deleteConfirm.transactionId} excluído permanentemente.`
      );
      toast.success('Comprovante excluído com sucesso.');
      setDeleteConfirm(null);
    } catch (error) {
      toast.error('Erro ao excluir comprovante.');
    }
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

    // Stylish Header Background
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // Logo / Title
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('AUDITORIA PIX PRO', 15, 22);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('Relatório Integrado de Inteligência e Auditoria Financeira', 15, 30);
    
    // Header Info
    doc.setTextColor(255, 255, 255);
    doc.text(`Data de Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - 15, 22, { align: 'right' });
    doc.text(`Operador: ${profile?.displayName || 'Sistema'}`, pageWidth - 15, 28, { align: 'right' });

    // Summary Cards (Conceptual)
    const totalAmount = filteredReceipts.reduce((sum, r) => sum + r.amount, 0);
    const validCount = filteredReceipts.filter(r => r.status === 'Valid').length;
    const fraudCount = filteredReceipts.filter(r => r.status === 'Fraud').length;
    
    // Summary Box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(15, 55, pageWidth - 30, 35, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(15, 55, pageWidth - 30, 35, 3, 3, 'D');

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('RESUMO DO PERÍODO', 20, 63);
    
    // Values in summary
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFont('helvetica', 'bold');
    
    doc.text('Total Processado:', 20, 75);
    doc.text(`R$ ${totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 55, 75);
    
    doc.text('Registros:', 110, 75);
    doc.text(`${filteredReceipts.length} itens`, 135, 75);

    doc.text('Status:', 20, 83);
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.text(`${validCount} Válidos`, 35, 83);
    doc.setTextColor(239, 68, 68); // red-500
    doc.text(`${fraudCount} Fraudes`, 65, 83);

    // Table
    const tableData = filteredReceipts.map(r => [
      r.transactionId,
      r.payerName,
      r.employeeName,
      format(new Date(r.date), 'dd/MM/yyyy'),
      `R$ ${r.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      statusLabels[r.status] || r.status
    ]);

    autoTable(doc, {
      startY: 100,
      head: [['ID Transação', 'Cliente (Pagador)', 'Equipe', 'Data Pix', 'Valor', 'Status']],
      body: tableData,
      headStyles: { 
        fillColor: [30, 41, 59], 
        fontSize: 9, 
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: { 
        fontSize: 8, 
        cellPadding: 4,
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { fontStyle: 'bold' },
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'center' }
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 15, right: 15 },
      didParseCell: function(data) {
        if (data.column.index === 5 && data.cell.section === 'body') {
          const status = data.cell.raw;
          if (status === 'Fraude') {
            data.cell.styles.textColor = [220, 38, 38]; // red-600
            data.cell.styles.fontStyle = 'bold';
          } else if (status === 'Válido') {
            data.cell.styles.textColor = [5, 150, 105]; // emerald-600
          }
        }
      }
    });

    // Footer with page numbers
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Página ${i} de ${totalPages} — Auditoria PIX Pro • Documento Confidencial`,
        pageWidth / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    doc.save(`relatorio_auditoria_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
    toast.success('Relatório PDF gerado com sucesso!');
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
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cliente / Origem</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tipo / Info</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data/Upload</th>
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
                        onClick={() => setViewingReceipt(receipt)}
                        className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95 cursor-pointer"
                        title="Ver Comprovante e Análise"
                      >
                        <Eye className="w-5 h-5" />
                      </button>

                      {profile?.role === 'admin' && (
                        <button 
                          onClick={() => setDeleteConfirm({ id: receipt.id!, transactionId: receipt.transactionId })}
                          className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-all active:scale-95 cursor-pointer"
                          title="Excluir Comprovante"
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
        {filteredReceipts.length === 0 && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            Nenhum comprovante encontrado.
          </div>
        )}
      </div>

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

      {/* Full View Modal */}
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
