import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export const uploadImage = async (
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    const metadata = {
      contentType: file.type,
    };
    
    // Set initial progress
    if (onProgress) onProgress(10);
    
    // Use uploadBytes for faster, more reliable uploads for small files (< 2MB)
    const snapshot = await uploadBytes(storageRef, file, metadata);
    
    if (onProgress) onProgress(50);
    
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    if (onProgress) onProgress(100);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

export const deleteImage = async (url: string) => {
  try {
    // Extract path from URL
    // Firebase Storage URLs look like: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?alt=media...
    const decodedUrl = decodeURIComponent(url);
    const pathStart = decodedUrl.indexOf('/o/') + 3;
    const pathEnd = decodedUrl.indexOf('?alt=media');
    
    if (pathStart > 2 && pathEnd > pathStart) {
      const path = decodedUrl.substring(pathStart, pathEnd);
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
    }
  } catch (error) {
    console.error('Error deleting image:', error);
  }
};
