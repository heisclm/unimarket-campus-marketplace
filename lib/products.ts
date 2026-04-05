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
  createdAt: any;
}

export function subscribeToFeaturedProduct(callback: (product: Product | null) => void) {
  const q = query(
    collection(db, 'products'),
    where('status', '==', 'active')
  );

  return onSnapshot(q, (snapshot) => {
    let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    
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
    let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
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
    let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
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
    let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
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
    let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
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
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    callback(products);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'products');
  });
}
