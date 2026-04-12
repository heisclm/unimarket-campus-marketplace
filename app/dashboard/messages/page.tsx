'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, Send, User, ArrowLeft, Clock, ShoppingBag, MessageSquare } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';

interface Chat {
  id: string;
  participants: string[];
  participantDetails: Record<string, { name: string; photoURL: string; role: string }>;
  lastMessage: string;
  lastMessageAt: any;
  orderId?: string;
  productId?: string;
  productTitle?: string;
}

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch Chats
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];
      setChats(chatData);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch Messages for Active Chat
  useEffect(() => {
    if (!activeChatId) {
      const timer = setTimeout(() => setMessages([]), 0);
      return () => clearTimeout(timer);
    }

    const q = query(
      collection(db, `chats/${activeChatId}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(messageData);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [activeChatId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChatId || !newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      // Add message
      await addDoc(collection(db, `chats/${activeChatId}/messages`), {
        chatId: activeChatId,
        senderId: user.uid,
        text: messageText,
        status: 'sent',
        createdAt: serverTimestamp()
      });

      // Update chat last message
      await updateDoc(doc(db, 'chats', activeChatId), {
        lastMessage: messageText,
        lastMessageAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId);
  const otherParticipantId = activeChat?.participants.find(id => id !== user?.uid);
  const otherParticipant = otherParticipantId ? activeChat?.participantDetails?.[otherParticipantId] : null;

  const filteredChats = chats.filter(chat => {
    const otherId = chat.participants.find(id => id !== user?.uid);
    const otherName = otherId ? chat.participantDetails?.[otherId]?.name?.toLowerCase() : '';
    return otherName?.includes(searchQuery.toLowerCase()) || chat.productTitle?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 py-0 sm:py-8 h-[calc(100vh-80px)] sm:h-[calc(100vh-140px)]">
      <div className="bg-white sm:rounded-3xl sm:shadow-sm border-x sm:border border-gray-100 h-full flex overflow-hidden">
        
        {/* Chat List (Left Pane) */}
        <div className={`w-full md:w-96 flex-shrink-0 border-r border-gray-100 flex flex-col ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <h1 className="text-2xl font-black tracking-tight text-gray-900 mb-4">Messages</h1>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#d9ff00] focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredChats.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No messages found.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filteredChats.map((chat) => {
                  const otherId = chat.participants.find(id => id !== user.uid);
                  const otherUser = otherId ? chat.participantDetails?.[otherId] : null;
                  const isActive = chat.id === activeChatId;

                  return (
                    <button
                      key={chat.id}
                      onClick={() => setActiveChatId(chat.id)}
                      className={`w-full text-left p-4 sm:p-6 hover:bg-gray-50 transition-colors flex items-start gap-4 ${isActive ? 'bg-gray-50' : ''}`}
                    >
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden relative">
                        {otherUser?.photoURL ? (
                          <Image src={otherUser.photoURL} alt="Profile" fill className="object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100">
                            <User className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <h3 className="font-bold text-gray-900 truncate pr-2">{otherUser?.name || 'Unknown User'}</h3>
                          {chat.lastMessageAt && (
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {new Date(chat.lastMessageAt?.toDate()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        {chat.productTitle && (
                          <p className="text-xs text-[#d9ff00] font-bold uppercase tracking-wider truncate mb-1 flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3" /> {chat.productTitle}
                          </p>
                        )}
                        <p className="text-sm text-gray-500 truncate">{chat.lastMessage || 'No messages yet'}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Active Chat (Right Pane) */}
        <div className={`flex-1 flex flex-col bg-[#f8f9fa] ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
          {activeChatId && otherParticipant ? (
            <>
              {/* Chat Header */}
              <div className="h-20 px-4 sm:px-6 bg-white border-b border-gray-100 flex items-center gap-4 flex-shrink-0">
                <button 
                  onClick={() => setActiveChatId(null)}
                  className="md:hidden w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden relative flex-shrink-0">
                  {otherParticipant.photoURL ? (
                    <Image src={otherParticipant.photoURL} alt="Profile" fill className="object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <User className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-gray-900 truncate">{otherParticipant.name}</h2>
                  <p className="text-xs text-gray-500 capitalize">{otherParticipant.role}</p>
                </div>
                {activeChat?.productId && (
                  <Link href={`/products/${activeChat.productId}`} className="hidden sm:flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-xs font-bold hover:bg-gray-800 transition-colors">
                    View Product
                  </Link>
                )}
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <MessageSquare className="w-8 h-8" />
                    </div>
                    <p>Send a message to start the conversation.</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.senderId === user.uid;
                    const showTime = idx === 0 || (msg.createdAt?.toMillis() - messages[idx-1].createdAt?.toMillis() > 3600000); // Show time if > 1 hour gap

                    return (
                      <div key={msg.id} className="space-y-2">
                        {showTime && msg.createdAt && (
                          <div className="flex justify-center">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-100 px-3 py-1 rounded-full">
                              {new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] sm:max-w-[60%] p-4 ${
                            isMe 
                              ? 'bg-black text-white rounded-[2rem] rounded-br-md' 
                              : 'bg-white border border-gray-100 text-gray-900 rounded-[2rem] rounded-bl-md shadow-sm'
                          }`}>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} className="h-4" />
              </div>

              {/* Input Area */}
              <div className="p-4 sm:p-6 bg-white border-t border-gray-100 flex-shrink-0 pb-safe">
                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-50 border-none rounded-full px-6 py-4 text-sm focus:ring-2 focus:ring-[#d9ff00] focus:bg-white transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="w-12 h-12 bg-[#d9ff00] text-black rounded-full flex items-center justify-center hover:bg-[#c4e600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-sm"
                  >
                    <Send className="w-5 h-5 ml-1" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100">
                <MessageSquare className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Your Messages</h3>
              <p className="text-sm">Select a conversation to start chatting.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
