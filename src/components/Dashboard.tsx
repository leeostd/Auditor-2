import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Receipt, UserProfile } from '../types';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { format, subDays, startOfDay, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'motion/react';

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

  const stats = {
    total: receipts.length,
    valid: receipts.filter(r => r.status === 'Valid').length,
    fraud: receipts.filter(r => r.status === 'Fraud').length,
    totalValue: receipts.filter(r => r.status === 'Valid').reduce((acc, r) => acc + r.amount, 0),
  };

  // Chart Data: Last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), i);
    const dayStr = format(date, 'dd/MM');
    const count = receipts.filter(r => {
      const rDate = new Date(r.createdAt);
      return format(rDate, 'dd/MM') === dayStr;
    }).length;
    return { name: dayStr, count };
  }).reverse();

  // Distribution Data
  const distributionData = [
    { name: 'Válidos', value: stats.valid, color: '#10b981' },
    { name: 'Fraudes', value: stats.fraud, color: '#ef4444' },
    { name: 'Divergentes', value: receipts.filter(r => r.status === 'Divergent').length, color: '#f59e0b' },
    { name: 'Incompletos', value: receipts.filter(r => r.status === 'Incomplete').length, color: '#64748b' },
  ].filter(d => d.value > 0);

  // Employee Performance Data
  const employeePerformance = Object.values(
    receipts.reduce((acc: any, r) => {
      if (r.status !== 'Valid') return acc;
      if (!acc[r.employeeId]) {
        acc[r.employeeId] = { name: r.employeeName, total: 0 };
      }
      acc[r.employeeId].total += r.amount;
      return acc;
    }, {})
  ).sort((a: any, b: any) => b.total - a.total);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Olá, {profile?.displayName.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500">Aqui está o resumo da auditoria de hoje.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Auditado" 
          value={stats.total} 
          icon={TrendingUp} 
          color="blue" 
          trend="+12%" 
        />
        <StatCard 
          title="Alertas de Fraude" 
          value={stats.fraud} 
          icon={AlertTriangle} 
          color="red" 
          trend="-5%" 
          isNegative
        />
        <StatCard 
          title="Válidos" 
          value={stats.valid} 
          icon={CheckCircle2} 
          color="emerald" 
          trend="+8%" 
        />
        <StatCard 
          title="Valor Total (R$)" 
          value={stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} 
          icon={DollarSign} 
          color="indigo" 
          trend="+15%" 
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Volume de Auditoria (7 dias)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Distribuição por Status</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 space-y-3">
            {distributionData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-slate-600">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Employee Performance Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Desempenho por Funcionário (Valor Recebido)</h3>
        <div className="space-y-4">
          {employeePerformance.map((emp: any, index: number) => {
            const maxTotal = (employeePerformance[0] as any).total;
            const percentage = (emp.total / maxTotal) * 100;
            return (
              <div key={emp.name} className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-slate-900">{emp.name}</span>
                  <span className="text-slate-500">R$ {emp.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, delay: index * 0.1 }}
                    className="h-full bg-blue-600 rounded-full"
                  />
                </div>
              </div>
            );
          })}
          {employeePerformance.length === 0 && (
            <div className="text-center py-10 text-slate-500">
              Nenhum dado de recebimento disponível.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, trend, isNegative }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    emerald: "bg-emerald-50 text-emerald-600",
    indigo: "bg-indigo-50 text-indigo-600",
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={cn("p-2 rounded-xl", colors[color])}>
          <Icon className="w-4 h-4" />
        </div>
        <div className={cn(
          "flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full",
          isNegative ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
        )}>
          {isNegative ? <ArrowDownRight className="w-2.5 h-2.5" /> : <ArrowUpRight className="w-2.5 h-2.5" />}
          {trend}
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-1">{title}</p>
      <h4 className="text-xl font-bold text-slate-900">{value}</h4>
    </div>
  );
}
