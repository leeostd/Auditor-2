import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { UserCog, Shield, User as UserIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface UserManagementProps {
  profile: UserProfile | null;
}

export function UserManagement({ profile }: UserManagementProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
    });
    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success(`Cargo atualizado para ${newRole}.`);
    } catch (error) {
      toast.error('Erro ao atualizar cargo.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Gestão de Equipe</h1>
        <p className="text-slate-500">Gerencie os níveis de acesso dos usuários do sistema.</p>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {users.map((u) => (
            <div key={u.uid} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4">
                <img src={u.photoURL} className="w-12 h-12 rounded-full border border-slate-100" alt="" />
                <div>
                  <p className="font-bold text-slate-900">{u.displayName}</p>
                  <p className="text-sm text-slate-500">{u.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => handleRoleChange(u.uid, 'admin')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                      u.role === 'admin' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <Shield className="w-4 h-4" />
                    Admin
                  </button>
                  <button
                    onClick={() => handleRoleChange(u.uid, 'employee')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                      u.role === 'employee' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <UserIcon className="w-4 h-4" />
                    Funcionário
                  </button>
                </div>
                
                {u.uid !== profile?.uid && (
                  <button className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
