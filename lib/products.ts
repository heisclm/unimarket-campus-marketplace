import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  previewImage?: string;
  status: 'active' | 'sold' | 'ended';
  type: 'fixed' | 'auction';
  isFeatured?: boolean;
  isPopular?: boolean;
  isSponsored?: boolean;
  createdAt: any;
  sponsoredUntil?: any;
  auctionEndTime?: any;
}

export function isActiveProduct(p: Product): boolean {
  if (p.status !== 'active') return false;
  
  if (p.type === 'auction' && p.auctionEndTime) {
    const endMillis = p.auctionEndTime?.toMillis ? p.auctionEndTime.toMillis() : 0;
    if (endMillis > 0 && endMillis <= Date.now()) {
      return false; // Auction has ended
    }
  }
  
  return true;
}

export function sanitizeProduct(p: Product): Product {
  const sanitized = { ...p };
  if (sanitized.isSponsored && sanitized.sponsoredUntil) {
    const sponsoredUntilMillis = sanitized.sponsoredUntil.toMillis ? sanitized.sponsoredUntil.toMillis() : new Date(sanitized.sponsoredUntil).getTime();
    if (sponsoredUntilMillis && sponsoredUntilMillis <= Date.now()) {
      sanitized.isSponsored = false;
    }
  }
  return sanitized;
}

export function subscribeToFeaturedProduct(callback: (product: Product | null) => void) {
  const q = query(
    collection(db, 'products'),
    where('status', '==', 'active')
  );

  return onSnapshot(q, (snapshot) => {
    let products = snapshot.docs.map(doc => sanitizeProduct({ id: doc.id, ...doc.data() } as Product)).filter(isActiveProduct);
    
    // Try to find a featured product
    const featured = products.find(p => p.isFeatured);
    if (featured) {
      callback(featured);
    } else if (products.length > 0) {
      // Fallback to latest active product
      const latest = products.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      })[0];
      callback(latest);
    } else {
      callback(null);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'products');
  });
}

export function subscribeToPopularProducts(callback: (products: Product[]) => void, maxLimit = 6) {
  const q = query(
    collection(db, 'products'),
    where('status', '==', 'active')
  );

  return onSnapshot(q, (snapshot) => {
    let products = snapshot.docs.map(doc => sanitizeProduct({ id: doc.id, ...doc.data() } as Product)).filter(isActiveProduct);
    products = products.filter(p => p.isPopular).slice(0, maxLimit);
    callback(products);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'products');
  });
}

export function subscribeToNewProducts(callback: (products: Product[]) => void, maxLimit = 4) {
  const q = query(
    collection(db, 'products'),
    where('status', '==', 'active')
  );

  return onSnapshot(q, (snapshot) => {
    let products = snapshot.docs.map(doc => sanitizeProduct({ id: doc.id, ...doc.data() } as Product)).filter(isActiveProduct);
    products = products.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    }).slice(0, maxLimit);
    callback(products);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'products');
  });
}

export function subscribeToMoreProducts(callback: (products: Product[]) => void, maxLimit = 3) {
  const q = query(
    collection(db, 'products'),
    where('status', '==', 'active')
  );

  return onSnapshot(q, (snapshot) => {
    let products = snapshot.docs.map(doc => sanitizeProduct({ id: doc.id, ...doc.data() } as Product)).filter(isActiveProduct);
    products = products.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    }).slice(0, maxLimit);
    callback(products);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'products');
  });
}

export function subscribeToActiveAuctions(callback: (products: Product[]) => void, maxLimit = 6) {
  const q = query(
    collection(db, 'products'),
    where('status', '==', 'active')
  );

  return onSnapshot(q, (snapshot) => {
    let products = snapshot.docs.map(doc => sanitizeProduct({ id: doc.id, ...doc.data() } as Product)).filter(isActiveProduct);
    products = products.filter(p => p.type === 'auction')
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      })
      .slice(0, maxLimit);
    callback(products);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'products');
  });
}

export function subscribeToAllActiveProducts(callback: (products: Product[]) => void) {
  const q = query(
    collection(db, 'products'),
    where('status', '==', 'active')
  );

  return onSnapshot(q, (snapshot) => {
    const products = snapshot.docs.map(doc => sanitizeProduct({ id: doc.id, ...doc.data() } as Product)).filter(isActiveProduct);
    callback(products);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'products');
  });
}
