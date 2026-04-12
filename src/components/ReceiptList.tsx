import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Receipt, UserProfile, Employee } from '../types';
import { Search, Filter, Calendar, Download, Eye, X, User, UserCheck, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

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
    Valid: "bg-emerald-100 text-emerald-700",
    Fraud: "bg-red-100 text-red-700",
    Incomplete: "bg-slate-100 text-slate-700",
    Divergent: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Histórico de Auditoria</h1>
          <p className="text-xs text-slate-500">Visualize e filtre todos os comprovantes processados.</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 hover:bg-slate-50 transition-all">
          <Download className="w-3.5 h-3.5" />
          Exportar CSV
        </button>
      </header>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500 text-xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <select 
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none text-xs"
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
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none text-xs"
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
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Comprovante</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tipo / Info</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data/Hora</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Funcionário / Auditor</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReceipts.map((receipt) => (
                <tr key={receipt.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    {receipt.imageUrl ? (
                      <div 
                        className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setSelectedImage(receipt.imageUrl || null)}
                      >
                        <img src={receipt.imageUrl} className="w-full h-full object-cover" alt="Thumbnail" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                        <Eye className="w-4 h-4" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded w-fit",
                        receipt.type === 'pix' ? "bg-blue-50 text-blue-600" : 
                        receipt.type === 'lottery' ? "bg-purple-50 text-purple-600" :
                        "bg-amber-50 text-amber-600"
                      )}>
                        {receipt.type === 'pix' ? 'PIX' : receipt.type === 'lottery' ? 'Lotérica' : 'Cartão'}
                      </span>
                      <p className="text-xs font-medium text-slate-900 truncate max-w-[150px]" title={receipt.transactionId}>
                        ID: {receipt.transactionId}
                      </p>
                      {receipt.location && (
                        <p className="text-[10px] text-slate-500 truncate max-w-[150px]" title={receipt.location}>
                          Loc: {receipt.location}
                        </p>
                      )}
                      {receipt.cnpj && (
                        <p className="text-[10px] text-slate-500 truncate max-w-[150px]" title={receipt.cnpj}>
                          CNPJ: {receipt.cnpj}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{format(new Date(receipt.createdAt), 'dd/MM/yyyy', { locale: ptBR })}</p>
                    <p className="text-xs text-slate-500">{format(new Date(receipt.createdAt), 'HH:mm', { locale: ptBR })}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-sm text-slate-900 font-medium">
                        <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                        {receipt.employeeName}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <User className="w-3.5 h-3.5" />
                        {receipt.uploaderName}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">
                    R$ {receipt.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold",
                      statusColors[receipt.status]
                    )}>
                      {receipt.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => receipt.imageUrl && setSelectedImage(receipt.imageUrl)}
                      className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
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
          <div className="p-12 text-center text-slate-500">
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
