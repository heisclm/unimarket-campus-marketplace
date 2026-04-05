'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, deleteDoc, writeBatch } from 'firebase/firestore';
import { Bell, CheckCircle2, ShoppingBag, MessageSquare, AlertCircle, Trash2, ExternalLink, Clock } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory to avoid index requirement
      docs.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setNotifications(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    
    try {
      await batch.commit();
      toast.success('All marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
      toast.success('Notification deleted');
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'order': return <ShoppingBag className="w-5 h-5 text-blue-500" />;
      case 'bid': return <Clock className="w-5 h-5 text-orange-500" />;
      case 'message': return <MessageSquare className="w-5 h-5 text-green-500" />;
      case 'alert': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl p-6 animate-pulse flex gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 rounded w-1/3"></div>
              <div className="h-3 bg-gray-100 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <button 
          onClick={markAllAsRead}
          className="text-sm font-bold text-gray-400 hover:text-black transition-colors"
        >
          Mark all as read
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-12 shadow-sm text-center border border-gray-50">
          <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8" />
          </div>
          <p className="text-gray-500">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div 
              key={notification.id}
              className={`bg-white rounded-2xl p-4 shadow-sm border transition-all flex gap-4 group ${notification.read ? 'border-gray-50 opacity-75' : 'border-[#d9ff00] bg-[#d9ff00]/5'}`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${notification.read ? 'bg-gray-100' : 'bg-white shadow-sm'}`}>
                {getIcon(notification.type)}
              </div>
              
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`font-bold text-sm ${notification.read ? 'text-gray-700' : 'text-black'}`}>
                    {notification.title}
                  </h3>
                  <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
                    {notification.createdAt?.toDate ? notification.createdAt.toDate().toLocaleDateString() : 'Just now'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{notification.message}</p>
                
                <div className="flex items-center gap-4 mt-3">
                  {notification.link && (
                    <Link 
                      href={notification.link}
                      onClick={() => markAsRead(notification.id)}
                      className="text-xs font-bold text-black flex items-center gap-1 hover:underline"
                    >
                      View Details <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                  {!notification.read && (
                    <button 
                      onClick={() => markAsRead(notification.id)}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Mark as read
                    </button>
                  )}
                  <button 
                    onClick={() => deleteNotification(notification.id)}
                    className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors ml-auto opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
