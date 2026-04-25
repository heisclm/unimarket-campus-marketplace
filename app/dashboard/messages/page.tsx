'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, limit, getDocs, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { confirmOrderReceipt, rejectOrderReceipt, respondToRejection } from '@/lib/escrow';
import { Search, Send, User, ArrowLeft, Clock, ShoppingBag, MessageSquare, AlertTriangle, ShieldCheck, CheckCircle, XCircle, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

interface Chat {
  id: string;
  participants: string[];
  participantDetails: Record<string, { name: string; photoURL: string; role: string }>;
  lastMessage: string;
  lastMessageAt: any;
  orderId?: string;
  productId?: string;
  productTitle?: string;
  unreadCount?: Record<string, number>;
  isCompleted?: boolean;
}

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: any;
  isSystem?: boolean;
}

function MessagesContent() {
  const { user, userData } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  
  // Review System State
  const [hasReviewed, setHasReviewed] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializingRef = useRef(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const initMessage = searchParams.get('initMessage');
    if (initMessage) {
      setNewMessage(initMessage);
    }
  }, [searchParams]);

  // Handle URL Params for new chat initiation
  useEffect(() => {
    if (!user || !userData) return;
    const sellerId = searchParams.get('sellerId');
    const productId = searchParams.get('productId');
    const directChatId = searchParams.get('chatId');

    if (directChatId && !initializingRef.current) {
      // If we directly pass a chatId (e.g. from an order), switch to it immediately
      setActiveChatId(directChatId);
      setTimeout(() => {
        router.replace('/dashboard/messages');
      }, 500);
      return;
    }
    
    if (sellerId && productId && !initializingRef.current) {
      initializingRef.current = true;
      const initializeChat = async () => {
        try {
          // Generate a deterministic Chat ID based on buyer, seller, and product.
          // This makes the operation strictly IDEMPOTENT. Even if React fires this 10 times simultaneously,
          // Firestore will just safely overwrite the same document instead of creating duplicates.
          const deterministicChatId = `${user.uid}_${sellerId}_${productId}`;
          const chatRef = doc(db, 'chats', deterministicChatId);
          
          const chatSnap = await getDoc(chatRef);

          if (chatSnap.exists()) {
            // Chat already exists, just switch to it
            setActiveChatId(deterministicChatId);
          } else {
            // Fetch product and seller info to build chat context
            const productSnap = await getDoc(doc(db, 'products', productId));
            const sellerSnap = await getDoc(doc(db, 'users', sellerId));
            
            if (productSnap.exists() && sellerSnap.exists()) {
              await setDoc(chatRef, {
                participants: [user.uid, sellerId],
                buyerId: user.uid,
                sellerId: sellerId,
                productId: productId,
                productTitle: productSnap.data().title,
                participantDetails: {
                  [user.uid]: { name: userData.displayName || 'Buyer', photoURL: userData.photoURL || '', role: userData.role },
                  [sellerId]: { name: sellerSnap.data().displayName || 'Seller', photoURL: sellerSnap.data().photoURL || '', role: sellerSnap.data().role }
                },
                createdAt: serverTimestamp(),
                lastMessage: 'Chat initiated',
                lastMessageAt: serverTimestamp(),
                unreadCount: {
                  [user.uid]: 0,
                  [sellerId]: 1
                }
              });
              setActiveChatId(deterministicChatId);
              
              // Add initial system message with product card. Using deterministic ID for the message too.
              await setDoc(doc(db, `chats/${deterministicChatId}/messages`, 'system_init_msg'), {
                chatId: deterministicChatId,
                senderId: 'system',
                text: `Product Inquiry: ${productSnap.data().title} - GH₵${productSnap.data().price}\nPlease keep payments inside UniMart for your safety.`,
                isSystem: true,
                productId,
                status: 'sent',
                createdAt: serverTimestamp()
              });
            }
          }
        } finally {
          // Remove params from URL and release lock
          setTimeout(() => {
            router.replace('/dashboard/messages');
            initializingRef.current = false;
          }, 500);
        }
      };
      initializeChat();
    }
  }, [user, userData, searchParams, router]);

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

  // Mark active chat as read
  useEffect(() => {
    if (!activeChatId || !user) return;
    const activeChat = chats.find(c => c.id === activeChatId);
    if (activeChat && activeChat.unreadCount && activeChat.unreadCount[user.uid] > 0) {
      updateDoc(doc(db, 'chats', activeChatId), {
        [`unreadCount.${user.uid}`]: 0
      }).catch(console.error);
    }
  }, [activeChatId, chats, user]);

  // Fetch Order for Active Chat
  useEffect(() => {
    const activeChat = chats.find(c => c.id === activeChatId);
    if (!activeChatId || !activeChat?.orderId) {
      setActiveOrder(null);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'orders', activeChat.orderId), (snapshot) => {
      if (snapshot.exists()) {
        const orderData = { id: snapshot.id, ...(snapshot.data() as any) };
        setActiveOrder(orderData);
        
        // Auto-archive chat if order is completed
        if (orderData.status === 'completed' && !activeChat.isCompleted) {
           updateDoc(doc(db, 'chats', activeChatId), {
             isCompleted: true
           }).catch(console.error);
        }
      } else {
        setActiveOrder(null);
      }
    });

    return () => unsubscribe();
  }, [activeChatId, chats]);

  // Check if User Has Reviewed Completed Order
  useEffect(() => {
    if (!activeOrder || !user) return;
    
    if (activeOrder.status === 'completed' && activeOrder.buyerId === user.uid) {
      const fetchReview = async () => {
        const q = query(
          collection(db, 'reviews'),
          where('orderId', '==', activeOrder.id),
          where('buyerId', '==', user.uid)
        );
        const snap = await getDocs(q);
        setHasReviewed(!snap.empty);
      };
      fetchReview();
    }
  }, [activeOrder, user]);

  const submitReview = async () => {
    if (!activeOrder || !user || !rating) return;
    try {
      setIsSubmittingReview(true);
      await addDoc(collection(db, 'reviews'), {
        buyerId: user.uid,
        sellerId: activeOrder.sellerId,
        orderId: activeOrder.id,
        rating,
        comment: reviewComment,
        createdAt: serverTimestamp()
      });
      setHasReviewed(true);
      toast.success('Review submitted successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

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

      // Update chat last message and increment unread for receiver
      const otherId = activeChat?.participants.find(id => id !== user.uid);
      if (otherId) {
        await updateDoc(doc(db, 'chats', activeChatId), {
          lastMessage: messageText,
          lastMessageAt: serverTimestamp(),
          [`unreadCount.${otherId}`]: increment(1)
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId);
  const otherParticipantId = activeChat?.participants.find(id => id !== user?.uid);
  const otherParticipant = otherParticipantId ? activeChat?.participantDetails?.[otherParticipantId] : null;

  const handleEscrowAction = async (action: () => Promise<any>) => {
    try {
      setIsProcessingAction(true);
      await action();
    } catch (error: any) {
      alert(error.message || 'Failed to process action');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const filteredChats = chats.filter(chat => {
    const otherId = chat.participants.find(id => id !== user?.uid);
    const otherName = otherId ? chat.participantDetails?.[otherId]?.name?.toLowerCase() : '';
    const matchesSearch = otherName?.includes(searchQuery.toLowerCase()) || chat.productTitle?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'completed') {
      return matchesSearch && chat.isCompleted;
    } else {
      return matchesSearch && !chat.isCompleted;
    }
  });

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 py-0 sm:py-8 h-[calc(100vh-80px)] sm:h-[calc(100vh-140px)]">
      <div className="bg-white sm:rounded-3xl sm:shadow-sm border-x sm:border border-gray-100 h-full flex overflow-hidden">
        
        {/* Chat List (Left Pane) */}
        <div className={`w-full md:w-96 flex-shrink-0 border-r border-gray-100 flex flex-col ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col gap-4">
            <h1 className="text-2xl font-black tracking-tight text-gray-900">Messages</h1>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('active')}
                className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${activeTab === 'active' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
              >
                Active
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${activeTab === 'completed' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
              >
                Completed
              </button>
            </div>
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
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span className="text-[10px] text-gray-400">
                                {new Date(chat.lastMessageAt?.toDate()).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {(chat.unreadCount as any)?.[user?.uid || ''] > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                  {(chat.unreadCount as any)[user?.uid || '']}
                                </span>
                              )}
                            </div>
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

              {/* Escrow Action Banner */}
              {activeOrder && (
                <div className="bg-white border-b border-gray-200 p-4 shadow-sm z-10 flex-shrink-0">
                  <div className="flex items-center gap-3 mb-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-500" />
                    <h3 className="font-bold text-gray-900">Escrow Protected Order</h3>
                    <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-600 ml-auto uppercase tracking-wider">
                      {activeOrder.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  
                  {user.uid === activeOrder.buyerId && activeOrder.status === 'escrow_held' && (
                    <div className="flex flex-col sm:flex-row gap-2 mt-3">
                      <button 
                        onClick={() => handleEscrowAction(() => confirmOrderReceipt(activeOrder.id, user.uid))}
                        disabled={isProcessingAction}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-gray-800 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" /> Accept Item
                      </button>
                      <button 
                        onClick={() => handleEscrowAction(() => rejectOrderReceipt(activeOrder.id))}
                        disabled={isProcessingAction}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" /> Reject & Return
                      </button>
                    </div>
                  )}

                  {user.uid === activeOrder.sellerId && activeOrder.status === 'rejected_pending_seller' && (
                    <div className="flex flex-col sm:flex-row gap-2 mt-3">
                      <button 
                        onClick={() => handleEscrowAction(() => respondToRejection(activeOrder.id, 'resend'))}
                        disabled={isProcessingAction}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-gray-800 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" /> Resend Correct Item
                      </button>
                      <button 
                        onClick={() => handleEscrowAction(() => respondToRejection(activeOrder.id, 'cancel'))}
                        disabled={isProcessingAction}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" /> Cancel & Refund Buyer
                      </button>
                    </div>
                  )}

                  {activeOrder.status === 'completed' && (
                   <p className="text-sm text-green-600 font-medium">This transaction has been successfully completed. Funds are released.</p>
                  )}
                  {activeOrder.status === 'cancelled_refunded' && (
                   <p className="text-sm text-red-600 font-medium">This transaction was cancelled. The buyer has been refunded.</p>
                  )}
                  {activeOrder.rejectionCount > 0 && activeOrder.status !== 'cancelled_refunded' && (
                    <p className="text-xs text-orange-500 font-bold mt-2">Rejection Strike: {activeOrder.rejectionCount}/3 (Auto-refund on 3rd rejection)</p>
                  )}
                </div>
              )}

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
                        <div className={`flex ${msg.isSystem ? 'justify-center' : isMe ? 'justify-end' : 'justify-start'}`}>
                          {msg.isSystem ? (
                            <div className="max-w-[85%] bg-blue-50 text-blue-800 border border-blue-100 rounded-2xl p-4 text-center mx-auto my-4 shadow-sm flex flex-col items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-blue-500" />
                              <p className="text-xs font-medium whitespace-pre-wrap">{msg.text}</p>
                            </div>
                          ) : (
                            <div className={`max-w-[75%] sm:max-w-[60%] p-4 ${
                              isMe 
                                ? 'bg-black text-white rounded-[2rem] rounded-br-md' 
                                : 'bg-white border border-gray-100 text-gray-900 rounded-[2rem] rounded-bl-md shadow-sm'
                            }`}>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} className="h-4" />
              </div>

              {/* Input Area / Review Area */}
              <div className="p-4 sm:p-6 bg-white border-t border-gray-100 flex-shrink-0 pb-safe">
                {activeOrder?.status === 'completed' ? (
                  <div className="bg-gray-50 rounded-2xl p-6 text-center shadow-inner border border-gray-100">
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <h4 className="font-bold text-gray-900 mb-1">Order Completed</h4>
                    <p className="text-sm text-gray-500 mb-4">This chat is now read-only.</p>
                    
                    {user.uid === activeOrder.buyerId && (
                      <div className="mt-4 bg-white p-4 rounded-xl border border-gray-200">
                        {hasReviewed ? (
                          <div className="flex items-center justify-center gap-2 text-green-600 font-bold text-sm">
                            <Star className="w-4 h-4 fill-current" />
                            You have reviewed this order.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <h5 className="font-bold text-sm text-gray-900">Leave a Review for {otherParticipant.name}</h5>
                            <div className="flex justify-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  onClick={() => setRating(star)}
                                  className={`p-1 transition-transform hover:scale-110 ${rating >= star ? 'text-yellow-400' : 'text-gray-200'}`}
                                >
                                  <Star className={`w-8 h-8 ${rating >= star ? 'fill-current' : ''}`} />
                                </button>
                              ))}
                            </div>
                            <textarea
                              value={reviewComment}
                              onChange={(e) => setReviewComment(e.target.value)}
                              placeholder="Write a short review... (optional)"
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#d9ff00]"
                              rows={2}
                            />
                            <button
                              onClick={submitReview}
                              disabled={isSubmittingReview || !rating}
                              className="w-full bg-black text-white py-2 rounded-xl text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors"
                            >
                              {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
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
                )}
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

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading messages...</div>}>
      <MessagesContent />
    </Suspense>
  );
}
