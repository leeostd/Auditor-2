import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, UserRole, Employee } from '../types';
import { UserCog, Shield, User as UserIcon, Trash2, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface UserManagementProps {
  profile: UserProfile | null;
}

export function UserManagement({ profile }: UserManagementProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
    });

    const unsubscribeEmployees = onSnapshot(query(collection(db, 'employees')), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });

    return () => {
      unsubscribeUsers();
      unsubscribeEmployees();
    };
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success(`Cargo atualizado para ${newRole}.`);
    } catch (error) {
      toast.error('Erro ao atualizar cargo.');
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployeeName.trim()) return;

    setIsAdding(true);
    try {
      await addDoc(collection(db, 'employees'), {
        name: newEmployeeName.trim(),
        createdAt: new Date().toISOString(),
        createdBy: profile?.uid
      });
      setNewEmployeeName('');
      toast.success('Funcionário adicionado com sucesso!');
    } catch (error) {
      toast.error('Erro ao adicionar funcionário.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este funcionário?')) return;
    try {
      await deleteDoc(doc(db, 'employees', id));
      toast.success('Funcionário removido.');
    } catch (error) {
      toast.error('Erro ao remover funcionário.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Gestão de Equipe</h1>
        <p className="text-xs text-slate-500">Gerencie os usuários do sistema e os funcionários de recebimento.</p>
      </header>

      {/* Employees Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Funcionários de Recebimento</h2>
          </div>
        </div>

        <form onSubmit={handleAddEmployee} className="relative group">
          <input 
            type="text" 
            placeholder="Nome do novo funcionário..."
            className="w-full pl-4 pr-32 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 shadow-sm transition-all text-sm"
            value={newEmployeeName}
            onChange={(e) => setNewEmployeeName(e.target.value)}
          />
          <button 
            type="submit"
            disabled={isAdding}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-200 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </button>
        </form>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {employees.map((emp) => (
              <div key={emp.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">
                    {emp.name.charAt(0)}
                  </div>
                  <span className="font-bold text-slate-900 text-sm">{emp.name}</span>
                </div>
                <button 
                  onClick={() => emp.id && handleDeleteEmployee(emp.id)}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {employees.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">
                Nenhum funcionário cadastrado.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Users Section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Acesso ao Aplicativo</h2>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {users.map((u) => (
              <div key={u.uid} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <img src={u.photoURL} className="w-10 h-10 rounded-full border border-slate-100" alt="" />
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{u.displayName}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
                    <button
                      onClick={() => handleRoleChange(u.uid, 'admin')}
                      className={cn(
                        "flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                        u.role === 'admin' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      Admin
                    </button>
                    <button
                      onClick={() => handleRoleChange(u.uid, 'employee')}
                      className={cn(
                        "flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                        u.role === 'employee' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      <UserIcon className="w-3.5 h-3.5" />
                      Equipe
                    </button>
                  </div>
                  
                  {u.uid !== profile?.uid && (
                    <button className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
