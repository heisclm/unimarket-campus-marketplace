'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, limit } from 'firebase/firestore';
import { MessageSquare, Search, Trash2, User, Heart, Share2, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function AdminCommunity() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100)), (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  const handleDeletePost = async () => {
    if (!postToDelete) return;
    try {
      await deleteDoc(doc(db, 'posts', postToDelete));
      toast.success('Post deleted successfully');
      setPostToDelete(null);
    } catch (error) {
      toast.error('Failed to delete post');
      setPostToDelete(null);
    }
  };

  const filteredPosts = posts.filter(p => 
    p.content?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.authorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Community Moderation</h1>
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search posts or authors..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-black outline-none transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredPosts.map(post => (
          <div key={post.id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-50 flex flex-col group">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full overflow-hidden relative">
                  {post.authorPhoto ? (
                    <Image src={post.authorPhoto} alt={post.authorName} fill className="object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-5 h-5 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{post.authorName || 'Anonymous'}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {post.createdAt?.toDate?.().toLocaleString() || 'Just now'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setPostToDelete(post.id)}
                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                title="Delete Post"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-600 mb-6 leading-relaxed flex-1">{post.content}</p>

            {post.image && (
              <div className="relative w-full h-48 bg-gray-50 rounded-2xl mb-6 overflow-hidden border border-gray-100">
                <Image src={post.image} alt="Post content" fill className="object-cover" referrerPolicy="no-referrer" />
              </div>
            )}

            <div className="flex items-center gap-6 pt-6 border-t border-gray-50 text-gray-400">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Heart className="w-4 h-4" /> {post.likes?.length || 0} Likes
              </div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <Share2 className="w-4 h-4" /> {post.shares || 0} Shares
              </div>
              <div className="ml-auto flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-red-400">
                <AlertTriangle className="w-3 h-3" /> Report ID: {post.id.slice(0, 6)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {postToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl">
            <h3 className="text-2xl font-bold mb-4">Delete Post</h3>
            <p className="text-gray-600 mb-8">
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setPostToDelete(null)}
                className="flex-1 bg-gray-100 text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeletePost}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
