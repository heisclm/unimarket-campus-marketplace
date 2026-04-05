'use client';

import Link from 'next/link';
import { ShoppingBag, Github, Twitter, Instagram, Mail, Shield, HelpCircle, FileText } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-100 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand Column */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 bg-[#d9ff00] rounded-xl flex items-center justify-center shadow-sm group-hover:rotate-6 transition-transform">
                <ShoppingBag className="w-6 h-6 text-black" />
              </div>
              <span className="text-xl font-black tracking-tighter text-gray-900">UNIMARKET</span>
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              The premier marketplace for students and campus vendors. Buy, sell, and auction anything with ease and security.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="p-2 bg-gray-50 text-gray-400 hover:text-black hover:bg-[#d9ff00] rounded-lg transition-all">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 bg-gray-50 text-gray-400 hover:text-black hover:bg-[#d9ff00] rounded-lg transition-all">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 bg-gray-50 text-gray-400 hover:text-black hover:bg-[#d9ff00] rounded-lg transition-all">
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Marketplace Column */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-6">Marketplace</h3>
            <ul className="space-y-4">
              <li><Link href="/products" className="text-gray-500 hover:text-black transition-colors text-sm">All Products</Link></li>
              <li><Link href="/products?category=electronics" className="text-gray-500 hover:text-black transition-colors text-sm">Electronics</Link></li>
              <li><Link href="/products?category=textbooks" className="text-gray-500 hover:text-black transition-colors text-sm">Textbooks</Link></li>
              <li><Link href="/products?category=furniture" className="text-gray-500 hover:text-black transition-colors text-sm">Furniture</Link></li>
              <li><Link href="/products?category=clothing" className="text-gray-500 hover:text-black transition-colors text-sm">Clothing</Link></li>
            </ul>
          </div>

          {/* Support Column */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-6">Support</h3>
            <ul className="space-y-4">
              <li><Link href="/help" className="text-gray-500 hover:text-black transition-colors text-sm flex items-center gap-2"><HelpCircle className="w-4 h-4" /> Help Center</Link></li>
              <li><Link href="/safety" className="text-gray-500 hover:text-black transition-colors text-sm flex items-center gap-2"><Shield className="w-4 h-4" /> Safety Tips</Link></li>
              <li><Link href="/tos" className="text-gray-500 hover:text-black transition-colors text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Terms of Service</Link></li>
              <li><Link href="/contact" className="text-gray-500 hover:text-black transition-colors text-sm flex items-center gap-2"><Mail className="w-4 h-4" /> Contact Us</Link></li>
            </ul>
          </div>

          {/* Newsletter Column */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-6">Stay Updated</h3>
            <p className="text-gray-500 text-sm mb-4">Get the latest campus deals and community updates.</p>
            <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#d9ff00] transition-all"
              />
              <button className="w-full bg-black text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition-all">
                Subscribe
              </button>
            </form>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-400 text-xs">
            © {currentYear} UniMarket. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-gray-400 hover:text-gray-600 text-xs transition-colors">Privacy Policy</Link>
            <Link href="/cookies" className="text-gray-400 hover:text-gray-600 text-xs transition-colors">Cookies</Link>
            <Link href="/sitemap" className="text-gray-400 hover:text-gray-600 text-xs transition-colors">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
