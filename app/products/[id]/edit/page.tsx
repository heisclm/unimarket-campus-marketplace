'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadImage } from '@/lib/storage';
import { useRouter, useParams } from 'next/navigation';
import { Package, Tag, ShieldCheck, X, UploadCloud, AlignLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EditProductPage() {
  const { id } = useParams();
  const { user, role, userData } = useAuth();
  const router = useRouter();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [type, setType] = useState('fixed');
  const [auctionDuration, setAuctionDuration] = useState('24');
  const [customAuctionDate, setCustomAuctionDate] = useState('');
  
  // Existing images from Firestore
  const [existingImages, setExistingImages] = useState<string[]>([]);
  // New image files to upload
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  // Previews for new images
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  
  // Index of the preview image in the COMBINED array (existingImages + newImageFiles)
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(0);
  
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ['Electronics', 'Books', 'Clothing', 'Services', 'Other'];

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id || !user) return;
      
      try {
        const docRef = doc(db, 'products', id as string);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Check ownership
          if (data.sellerId !== user.uid) {
            toast.error('You do not have permission to edit this product.');
            router.push('/dashboard');
            return;
          }
          
          setTitle(data.title || '');
          setDescription(data.description || '');
          setPrice(data.price?.toString() || '');
          setCategory(data.category || 'Electronics');
          setType(data.type || 'fixed');
          
          const images = data.images || [];
          setExistingImages(images);
          
          if (data.previewImage && images.length > 0) {
            const idx = images.indexOf(data.previewImage);
            if (idx !== -1) {
              setPreviewImageIndex(idx);
            }
          }
        } else {
          toast.error('Product not found.');
          router.push('/dashboard');
        }
      } catch (err) {
        console.error('Error fetching product:', err);
        toast.error('Failed to load product details.');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, user, router]);

  if (!user || !role || !userData?.isVerified) {
    return (
      <div className="bg-white rounded-[2rem] p-8 shadow-sm min-h-[60vh] flex items-center justify-center text-center">
        <div>
          <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
          <p className="text-gray-500 mb-4">You must be logged in and verified to edit a product.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-[2rem] p-8 shadow-sm min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full mb-4"></div>
          <p className="text-gray-400">Loading product details...</p>
        </div>
      </div>
    );
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      
      const validFiles = files.filter(file => {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image file.`);
          return false;
        }
        if (file.size > 2 * 1024 * 1024) {
          toast.error(`${file.name} is larger than 2MB.`);
          return false;
        }
        return true;
      });

      const totalImages = existingImages.length + newImageFiles.length + validFiles.length;
      if (totalImages > 5) {
        toast.error('You can only have a maximum of 5 images.');
        return;
      }

      const newFiles = [...newImageFiles, ...validFiles].slice(0, 5 - existingImages.length);
      setNewImageFiles(newFiles);

      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setNewImagePreviews(newPreviews);
    }
  };

  const removeExistingImage = (index: number) => {
    const newExisting = [...existingImages];
    newExisting.splice(index, 1);
    setExistingImages(newExisting);

    if (previewImageIndex === index) {
      setPreviewImageIndex(0);
    } else if (previewImageIndex > index) {
      setPreviewImageIndex(previewImageIndex - 1);
    }
  };

  const removeNewImage = (index: number) => {
    const newFiles = [...newImageFiles];
    newFiles.splice(index, 1);
    setNewImageFiles(newFiles);

    const newPreviews = [...newImagePreviews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setNewImagePreviews(newPreviews);

    const combinedIndex = existingImages.length + index;
    if (previewImageIndex === combinedIndex) {
      setPreviewImageIndex(0);
    } else if (previewImageIndex > combinedIndex) {
      setPreviewImageIndex(previewImageIndex - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (existingImages.length === 0 && newImageFiles.length === 0) {
      setError('Please have at least one image.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setUploadProgress(0);

    try {
      let uploadedUrls: string[] = [];
      
      if (newImageFiles.length > 0) {
        const progressArray = new Array(newImageFiles.length).fill(0);
        
        const uploadPromises = newImageFiles.map(async (file, i) => {
          const extension = file.name.split('.').pop();
          const fileName = `${Date.now()}_${i}.${extension}`;
          const path = `products/${user.uid}/${id}/${fileName}`;
          
          const url = await uploadImage(file, path, (progress) => {
            progressArray[i] = progress;
            const totalProgress = progressArray.reduce((a, b) => a + b, 0) / newImageFiles.length;
            setUploadProgress(totalProgress);
          });
          return url;
        });

        uploadedUrls = await Promise.all(uploadPromises);
      }

      const finalImages = [...existingImages, ...uploadedUrls];
      const finalPreviewImage = finalImages[previewImageIndex] || finalImages[0];

      await updateDoc(doc(db, 'products', id as string), {
        title,
        description,
        price: parseFloat(price),
        category,
        images: finalImages,
        previewImage: finalPreviewImage,
      });

      toast.success('Listing updated successfully!');
      router.push(`/products/${id}`);
    } catch (err: any) {
      console.error("Error updating document: ", err);
      setError(err.message || "Failed to update product");
      toast.error('Failed to update listing');
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const totalImages = existingImages.length + newImageFiles.length;

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-[2rem] p-8 md:p-12 shadow-sm">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Edit Listing</h1>
        <p className="text-gray-500">Update the details of your product.</p>
      </div>

      {error && <div className="w-full p-4 mb-6 text-sm text-red-600 bg-red-50 rounded-xl">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Product Title</label>
          <div className="relative">
            <Package className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-all"
            />
          </div>
        </div>

        {/* Price & Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Price (GH₵)</label>
            <div className="relative">
              <Tag className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="number" 
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <div className="relative">
              <Tag className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-all appearance-none"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Images */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Product Images (Max 5)</label>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            {/* Existing Images */}
            {existingImages.map((url, index) => (
              <div 
                key={`existing-${index}`} 
                className={`relative aspect-square rounded-xl overflow-hidden border-2 group cursor-pointer transition-all ${previewImageIndex === index ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200 hover:border-gray-300'}`}
                onClick={() => setPreviewImageIndex(index)}
              >
                <img src={url} alt={`Existing ${index}`} className="w-full h-full object-cover" />
                
                {previewImageIndex === index && (
                  <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                    Cover
                  </div>
                )}
                
                {previewImageIndex !== index && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">Set as Cover</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeExistingImage(index);
                  }}
                  className="absolute top-2 right-2 bg-white/90 text-red-500 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:text-red-600 shadow-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* New Images */}
            {newImagePreviews.map((preview, index) => {
              const combinedIndex = existingImages.length + index;
              return (
                <div 
                  key={`new-${index}`} 
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 group cursor-pointer transition-all ${previewImageIndex === combinedIndex ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200 hover:border-gray-300'}`}
                  onClick={() => setPreviewImageIndex(combinedIndex)}
                >
                  <img src={preview} alt={`New ${index}`} className="w-full h-full object-cover" />
                  
                  {previewImageIndex === combinedIndex && (
                    <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                      Cover
                    </div>
                  )}
                  
                  {previewImageIndex !== combinedIndex && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">Set as Cover</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNewImage(index);
                    }}
                    className="absolute top-2 right-2 bg-white/90 text-red-500 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:text-red-600 shadow-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            
            {totalImages < 5 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-500 hover:border-black hover:text-black transition-colors bg-gray-50"
              >
                <UploadCloud className="w-8 h-8 mb-2" />
                <span className="text-sm font-medium">Add Image</span>
              </button>
            )}
          </div>
          
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            accept="image/jpeg, image/png, image/webp"
            multiple
            className="hidden"
          />
          <p className="text-xs text-gray-500">Supported formats: JPEG, PNG, WebP. Max size: 2MB per image. Click an image to set it as the cover.</p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <div className="relative">
            <AlignLeft className="w-5 h-5 text-gray-400 absolute left-4 top-4" />
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-all resize-none"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4">
          {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mb-4">
              <div className="flex justify-between text-sm font-medium mb-1">
                <span>Uploading Images...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-black h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            </div>
          )}
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#d9ff00] text-black py-4 rounded-xl font-bold text-lg hover:bg-[#c4e600] transition-colors shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? 'Updating...' : 'Update Listing'}
          </button>
        </div>
      </form>
    </div>
  );
}
