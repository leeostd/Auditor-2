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

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Olá, {profile?.displayName.split(' ')[0]}</h1>
        <p className="text-slate-500">Aqui está o resumo da auditoria de hoje.</p>
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
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Volume de Auditoria (7 dias)</h3>
          <div className="h-80">
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

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Distribuição por Status</h3>
          <div className="h-64">
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
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-2xl", colors[color])}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={cn(
          "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
          isNegative ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
        )}>
          {isNegative ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-1">{title}</p>
      <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
    </div>
  );
}
