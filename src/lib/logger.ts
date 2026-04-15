import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ActivityLog } from '../types';

export async function logActivity(userId: string, action: string, details: string) {
  try {
    const log: ActivityLog = {
      userId,
      action,
      details,
      timestamp: new Date().toISOString(),
    };
    await addDoc(collection(db, 'activity_logs'), log);
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}
