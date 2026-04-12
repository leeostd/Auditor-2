import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Receiver, UserProfile } from '../types';
import { Plus, Trash2, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReceiverManagementProps {
  profile: UserProfile | null;
}

export function ReceiverManagement({ profile }: ReceiverManagementProps) {
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'receivers'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReceivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Receiver)));
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsAdding(true);
    try {
      await addDoc(collection(db, 'receivers'), {
        name: newName.trim(),
        createdAt: new Date().toISOString(),
        createdBy: profile?.uid
      });
      setNewName('');
      toast.success('Recebedor autorizado adicionado.');
    } catch (error) {
      toast.error('Erro ao adicionar recebedor.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este recebedor?')) return;
    try {
      await deleteDoc(doc(db, 'receivers', id));
      toast.success('Recebedor removido.');
    } catch (error) {
      toast.error('Erro ao remover recebedor.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Recebedores Autorizados</h1>
        <p className="text-xs text-slate-500">Gerencie os nomes que são permitidos nos comprovantes.</p>
      </header>

      <form onSubmit={handleAdd} className="flex gap-3">
        <input 
          type="text" 
          placeholder="Nome do recebedor (ex: Minha Empresa LTDA)"
          className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={isAdding}
        />
        <button 
          type="submit"
          disabled={isAdding}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-100 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Adicionar
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {receivers.map((receiver) => (
          <div key={receiver.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="font-bold text-slate-900 text-sm">{receiver.name}</span>
            </div>
            <button 
              onClick={() => receiver.id && handleDelete(receiver.id)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {receivers.length === 0 && (
          <div className="col-span-full py-10 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            Nenhum recebedor cadastrado.
          </div>
        )}
      </div>
    </div>
  );
}
