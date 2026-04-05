'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { Users, Send, Heart, MessageSquare, AlertTriangle, MessageCircle, Share2, ShieldCheck } from 'lucide-react';
import ReportModal from '@/components/shared/ReportModal';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function CommunityPage() {
  const { user, userData } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportTarget, setReportTarget] = useState<{id: string, type: 'post' | 'user'} | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPosts(postsData);
    });

    return () => unsubscribe();
  }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPost.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous Student',
        content: newPost.trim(),
        likes: 0,
        createdAt: serverTimestamp()
      });
      setNewPost('');
      toast.success('Post shared with the community!');
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error('Failed to share post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) {
      toast.error('Please log in to like posts');
      return;
    }
    try {
      await updateDoc(doc(db, 'posts', postId), {
        likes: increment(1)
      });
    } catch (error) {
      console.error("Error liking post:", error);
    }
  };

  const handleShare = (post: any) => {
    if (navigator.share) {
      navigator.share({
        title: `Post by ${post.authorName}`,
        text: post.content,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Community Board</h1>
          <p className="text-gray-500">Connect with other students and vendors.</p>
        </div>
      </div>

      {user ? (
        userData?.isVerified ? (
          <form onSubmit={handlePost} className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 focus-within:border-[#d9ff00] transition-colors">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="What's on your mind? Looking for a study group or specific textbook?"
              className="w-full bg-gray-50 rounded-xl p-4 border-none focus:ring-0 resize-none h-24 text-sm"
              disabled={isSubmitting}
            />
            <div className="flex justify-end mt-4">
              <button
                type="submit"
                disabled={!newPost.trim() || isSubmitting}
                className="bg-[#d9ff00] text-black px-6 py-2.5 rounded-full font-bold hover:bg-[#c4e600] transition-all hover:scale-105 active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:scale-100"
              >
                {isSubmitting ? 'Posting...' : <><Send className="w-4 h-4" /> Post</>}
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-orange-50 text-orange-700 p-8 rounded-[2rem] text-center border border-orange-100">
            <ShieldCheck className="w-10 h-10 mx-auto mb-4 opacity-50" />
            <p className="font-bold text-lg mb-2">Verification Required</p>
            <p className="text-sm opacity-80 mb-6">Only verified students and vendors can participate in the community board to ensure safety and trust.</p>
            <Link href="/profile?tab=verification" className="bg-orange-600 text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-orange-700 transition-colors">
              Get Verified
            </Link>
          </div>
        )
      ) : (
        <div className="bg-blue-50 text-blue-700 p-8 rounded-[2rem] text-center border border-blue-100">
          <MessageCircle className="w-10 h-10 mx-auto mb-4 opacity-50" />
          <p className="font-bold text-lg mb-2">Join the Conversation</p>
          <p className="text-sm opacity-80 mb-6">Log in to participate in the community discussions and connect with others.</p>
          <Link href="/profile" className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-blue-700 transition-colors">
            Log In
          </Link>
        </div>
      )}

      <div className="space-y-6">
        {posts.map(post => (
          <div key={post.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 hover:border-gray-200 transition-colors group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden border border-gray-50">
                  <Users className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{post.authorName}</h3>
                  <p className="text-xs text-gray-500">
                    {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString() : 'Just now'}
                  </p>
                </div>
              </div>
              {user && user.uid !== post.authorId && (
                <button 
                  onClick={() => setReportTarget({ id: post.id, type: 'post' })}
                  className="text-gray-300 hover:text-red-500 transition-colors p-2 opacity-0 group-hover:opacity-100"
                  title="Report Post"
                >
                  <AlertTriangle className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{post.content}</p>
            <div className="flex items-center gap-6 mt-6 pt-4 border-t border-gray-50">
              <button 
                onClick={() => handleLike(post.id)}
                className="flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors text-sm font-semibold group/like"
              >
                <Heart className={`w-4 h-4 group-active/like:scale-125 transition-transform ${post.likes > 0 ? 'fill-red-500 text-red-500' : ''}`} /> {post.likes || 0}
              </button>
              <button className="flex items-center gap-2 text-gray-400 hover:text-blue-500 transition-colors text-sm font-semibold">
                <MessageSquare className="w-4 h-4" /> Reply
              </button>
              <button 
                onClick={() => handleShare(post)}
                className="flex items-center gap-2 text-gray-400 hover:text-black transition-colors text-sm font-semibold ml-auto"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="bg-white rounded-[2rem] p-20 text-center border border-dashed border-gray-200">
            <MessageSquare className="w-16 h-16 text-gray-100 mx-auto mb-6" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No conversations yet</h3>
            <p className="text-gray-500 max-w-xs mx-auto">Be the first to start a conversation in the community board!</p>
          </div>
        )}
      </div>

      <ReportModal 
        isOpen={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetId={reportTarget?.id || ''}
        targetType={reportTarget?.type || 'post'}
      />
    </div>
  );
}
