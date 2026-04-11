'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, limit, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/components/auth/AuthProvider';
import { X, Send, User, Clock, Check, CheckCheck, Loader2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import toast from 'react-hot-toast';

interface ChatModalProps {
  order: any;
  onClose: () => void;
}

export default function ChatModal({ order, onClose }: ChatModalProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatId, setChatId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user || !order) return;

    const findChat = async () => {
      try {
        const q = query(
          collection(db, 'chats'),
          where('orderId', '==', order.id),
          limit(1)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const chatDoc = snapshot.docs[0];
          setChatId(chatDoc.id);
          
          // Fetch other user info
          const otherUserId = order.buyerId === user.uid ? order.sellerId : order.buyerId;
          const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', otherUserId), limit(1)));
          if (!userDoc.empty) {
            setOtherUser(userDoc.docs[0].data());
          }
        } else {
          toast.error('Chat not found for this order');
          onClose();
        }
      } catch (error) {
        console.error("Error finding chat:", error);
        setLoading(false);
      }
    };

    findChat();
  }, [user, order, onClose]);

  // Listen to chat document for typing status
  useEffect(() => {
    if (!chatId || !user) return;
    const unsubscribe = onSnapshot(doc(db, 'chats', chatId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const otherUserId = order.buyerId === user.uid ? order.sellerId : order.buyerId;
        setOtherUserTyping(!!data.typing?.[otherUserId]);
      }
    });
    return () => unsubscribe();
  }, [chatId, user, order]);

  useEffect(() => {
    if (!chatId || !user) return;

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setLoading(false);
      
      // Auto scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      // Mark unread messages from other user as read
      msgs.forEach(async (msg) => {
        if (msg.senderId !== user.uid && !msg.readAt) {
          try {
            await updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), {
              readAt: serverTimestamp(),
              status: 'read'
            });
          } catch (err) {
            console.error("Error marking message as read", err);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [chatId, user]);

  const handleTyping = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!chatId || !user) return;

    if (!isTyping) {
      setIsTyping(true);
      await updateDoc(doc(db, 'chats', chatId), {
        [`typing.${user.uid}`]: true
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(async () => {
      setIsTyping(false);
      await updateDoc(doc(db, 'chats', chatId), {
        [`typing.${user.uid}`]: false
      });
    }, 1500);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || !user) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    
    // Clear typing status immediately
    setIsTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    await updateDoc(doc(db, 'chats', chatId), {
      [`typing.${user.uid}`]: false
    });

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: user.uid,
        text: messageText,
        status: 'sent',
        createdAt: serverTimestamp(),
        readAt: null
      });

      // Update last message in chat doc
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: messageText,
        lastMessageAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error('Failed to send message');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-lg h-[600px] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl overflow-hidden relative">
              {otherUser?.photoURL ? (
                <Image src={otherUser.photoURL} alt={otherUser.displayName} fill className="object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-6 h-6 text-gray-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 leading-tight">{otherUser?.displayName || 'Loading...'}</h3>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                  Order: {order.productTitle}
                </p>
                {otherUserTyping && (
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-0.5 animate-pulse">
                    • Typing...
                  </span>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 hover:text-gray-600 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-sm">
                <MessageSquare className="w-8 h-8 text-gray-200" />
              </div>
              <div>
                <p className="text-gray-900 font-bold">No messages yet</p>
                <p className="text-xs text-gray-500">Start the conversation about your order.</p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.senderId === user?.uid;
              return (
                <div 
                  key={msg.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] space-y-1`}>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium shadow-sm ${
                      isMe 
                        ? 'bg-black text-white rounded-tr-none' 
                        : 'bg-white text-gray-900 rounded-tl-none border border-gray-100'
                    }`}>
                      {msg.text}
                    </div>
                    <div className={`flex items-center gap-1.5 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                        {msg.createdAt?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMe && (
                        msg.readAt ? (
                          <CheckCheck className="w-3 h-3 text-blue-500" />
                        ) : (
                          <Check className="w-3 h-3 text-gray-400" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-gray-100">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input 
              type="text" 
              value={newMessage}
              onChange={handleTyping}
              placeholder="Type your message..."
              className="flex-1 px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="p-3 bg-black text-white rounded-2xl hover:bg-gray-800 transition-all disabled:opacity-50 shadow-lg shadow-black/10"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
