'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadImage } from '@/lib/storage';
import { useRouter } from 'next/navigation';
import { Package, DollarSign, Image as ImageIcon, AlignLeft, Tag, ShieldCheck, X, UploadCloud, Plus, Trash2, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';

export default function NewProductPage() {
  const { user, role, userData } = useAuth();
  const router = useRouter();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [type, setType] = useState('fixed');
  const [offersDelivery, setOffersDelivery] = useState(false);
  const [hasVariations, setHasVariations] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [variants, setVariants] = useState([{ id: Date.now(), size: '', color: '', quantity: '1' }]);
  const [auctionDuration, setAuctionDuration] = useState('24'); // hours
  const [customAuctionDate, setCustomAuctionDate] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ['Electronics', 'Books', 'Clothing', 'Services', 'Other'];

  if (!user) {
    return (
      <div className="bg-white rounded-[2rem] p-8 shadow-sm min-h-[60vh] flex items-center justify-center text-center">
        <div>
          <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
          <p className="text-gray-500 mb-4">You must be logged in to list a product.</p>
          <button onClick={() => router.push('/profile')} className="bg-black text-white px-6 py-2 rounded-full font-medium">Go to Login</button>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="bg-white rounded-[2rem] p-8 shadow-sm min-h-[60vh] flex items-center justify-center text-center">
        <div>
          <h2 className="text-2xl font-bold mb-2">Profile Incomplete</h2>
          <p className="text-gray-500 mb-4">Please select a role (Student/Vendor) in your profile first.</p>
          <button onClick={() => router.push('/profile')} className="bg-black text-white px-6 py-2 rounded-full font-medium">Complete Profile</button>
        </div>
      </div>
    );
  }

  if (!userData?.isVerified) {
    return (
      <div className="bg-white rounded-[2rem] p-8 shadow-sm min-h-[60vh] flex items-center justify-center text-center">
        <div className="max-w-md">
          <div className="w-20 h-20 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Verification Required</h2>
          <p className="text-gray-500 mb-6">To maintain a safe marketplace, only verified students and vendors can list products for sale. Verification is quick and easy!</p>
          <button onClick={() => router.push('/profile?tab=verification')} className="bg-orange-600 text-white px-8 py-3 rounded-full font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-100">Get Verified Now</button>
        </div>
      </div>
    );
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      
      // Filter out non-images and check size
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

      if (imageFiles.length + validFiles.length > 5) {
        toast.error('You can only upload a maximum of 5 images.');
        return;
      }

      const newFiles = [...imageFiles, ...validFiles].slice(0, 5);
      setImageFiles(newFiles);

      // Create previews
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setImagePreviews(newPreviews);
    }
  };

  const removeImage = (index: number) => {
    const newFiles = [...imageFiles];
    newFiles.splice(index, 1);
    setImageFiles(newFiles);

    const newPreviews = [...imagePreviews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setImagePreviews(newPreviews);

    if (previewImageIndex === index) {
      setPreviewImageIndex(0);
    } else if (previewImageIndex > index) {
      setPreviewImageIndex(previewImageIndex - 1);
    }
  };

  const addVariant = () => {
    setVariants([...variants, { id: Date.now(), size: '', color: '', quantity: '1' }]);
  };

  const updateVariant = (id: number, field: string, value: string) => {
    setVariants(variants.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const removeVariant = (id: number) => {
    if (variants.length > 1) {
      setVariants(variants.filter(v => v.id !== id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (imageFiles.length === 0) {
      setError('Please upload at least one image.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setUploadProgress(0);

    try {
      let auctionEndTime = null;
      if (type === 'auction') {
        if (auctionDuration === 'custom' && customAuctionDate) {
          auctionEndTime = new Date(customAuctionDate).toISOString();
        } else {
          auctionEndTime = new Date(Date.now() + parseInt(auctionDuration) * 60 * 60 * 1000).toISOString();
        }
      }

      const totalQuantity = hasVariations 
        ? variants.reduce((sum, v) => sum + (parseInt(v.quantity) || 0), 0)
        : parseInt(quantity) || 1;

      const finalVariants = hasVariations 
        ? variants.map(v => ({ size: v.size, color: v.color, quantity: parseInt(v.quantity) || 0 }))
        : [];

      // 1. Create product document first to get ID
      const productData = {
        title,
        description,
        price: parseFloat(price),
        sellerId: user.uid,
        sellerIsVerified: true,
        category,
        offersDelivery,
        hasVariations,
        quantity: totalQuantity,
        variants: finalVariants,
        images: [], // Will update after upload
        previewImage: '', // Will update after upload
        status: 'active', // Bypassing Admin Approval since user is already KYC verified
        type,
        createdAt: serverTimestamp(),
        ...(type === 'auction' && auctionEndTime ? { auctionEndTime } : {})
      };

      console.log("Adding document to Firestore...", productData);
      const docRef = await addDoc(collection(db, 'products'), productData);
      console.log("Document added with ID:", docRef.id);

      // 2. Upload images
      console.log("Starting parallel image uploads...");
      const progressArray = new Array(imageFiles.length).fill(0);
      
      const uploadPromises = imageFiles.map(async (file, i) => {
        console.log(`Uploading image ${i + 1}/${imageFiles.length}:`, file.name);
        const extension = file.name.split('.').pop();
        const fileName = `${Date.now()}_${i}.${extension}`;
        const path = `products/${user.uid}/${docRef.id}/${fileName}`;
        
        const url = await uploadImage(file, path, (progress) => {
          progressArray[i] = progress;
          const totalProgress = progressArray.reduce((a, b) => a + b, 0) / imageFiles.length;
          setUploadProgress(totalProgress);
        });
        
        console.log(`Image ${i + 1} uploaded successfully:`, url);
        return url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      console.log("All images uploaded successfully.", uploadedUrls);

      console.log("Updating document with image URLs...", uploadedUrls);
      // 3. Update product document with image URLs
      await updateDoc(doc(db, 'products', docRef.id), {
        images: uploadedUrls,
        previewImage: uploadedUrls[previewImageIndex] || uploadedUrls[0]
      });
      console.log("Document updated successfully.");

      toast.success('Your listing is live on the marketplace!');
      router.push('/dashboard');
    } catch (err: any) {
      console.error("Error adding document: ", err);
      setError(err.message || "Failed to create product");
      toast.error('Failed to publish listing');
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-[2rem] p-8 md:p-12 shadow-sm">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">List a New Item</h1>
        <p className="text-gray-500">Fill out the details below to list your product on UniMart.</p>
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
              placeholder="e.g., Sony WH-1000XM4 Headphones"
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-all"
            />
          </div>
        </div>

        {/* Price, Category & Delivery */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
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
                placeholder="0.00"
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

        {/* Delivery Options */}
        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox"
              checked={offersDelivery}
              onChange={(e) => setOffersDelivery(e.target.checked)}
              className="w-5 h-5 accent-black rounded border-gray-300 text-black focus:ring-black"
            />
            <div className="flex flex-col">
              <span className="font-bold text-gray-900">Offer Campus/Dorm Delivery</span>
              <span className="text-sm text-gray-500 font-normal">Delivery fee will be calculated at checkout based on buyer's location.</span>
            </div>
          </label>
        </div>

        {/* Inventory & Variations */}
        <div className="bg-white border rounded-2xl border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-bold">Inventory & Options</h3>
              <p className="text-sm text-gray-500">Manage stock and product variations.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border">
              <input 
                type="checkbox"
                checked={hasVariations}
                onChange={(e) => setHasVariations(e.target.checked)}
                className="w-4 h-4 accent-black rounded"
              />
              <span className="text-sm font-medium text-gray-900">Has multiple sizes/colors</span>
            </label>
          </div>

          {!hasVariations ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Total Quantity Available</label>
              <div className="relative">
                <Layers className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input 
                  type="number" 
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full md:w-1/2 pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-all"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in">
              <div className="hidden md:grid grid-cols-12 gap-4 text-sm font-bold text-gray-500 px-2">
                <div className="col-span-4">Size (e.g., L, 42)</div>
                <div className="col-span-4">Color</div>
                <div className="col-span-3">Quantity</div>
                <div className="col-span-1 text-center">Action</div>
              </div>
              
              {variants.map((variant, index) => (
                <div key={variant.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-gray-50 md:bg-transparent p-4 md:p-0 rounded-xl border md:border-none border-gray-200">
                  <div className="col-span-1 md:col-span-4">
                    <label className="block md:hidden text-xs font-bold text-gray-500 mb-1">Size</label>
                    <input 
                      type="text" 
                      placeholder="Size"
                      value={variant.size}
                      onChange={(e) => updateVariant(variant.id, 'size', e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-4">
                     <label className="block md:hidden text-xs font-bold text-gray-500 mb-1">Color</label>
                    <input 
                      type="text" 
                      placeholder="Color"
                      value={variant.color}
                      onChange={(e) => updateVariant(variant.id, 'color', e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-3">
                     <label className="block md:hidden text-xs font-bold text-gray-500 mb-1">Quantity</label>
                    <input 
                      type="number" 
                      min="0"
                      value={variant.quantity}
                      onChange={(e) => updateVariant(variant.id, 'quantity', e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end md:justify-center mt-2 md:mt-0">
                    <button 
                      type="button" 
                      onClick={() => removeVariant(variant.id)}
                      disabled={variants.length === 1}
                      className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              
              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-2 text-sm font-bold text-black border border-gray-200 bg-gray-50 hover:bg-gray-100 rounded-lg px-4 py-2 transition-all mt-2"
              >
                <Plus className="w-4 h-4" /> Add Variation
              </button>
            </div>
          )}
        </div>

        {/* Listing Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Listing Type</label>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button
              type="button"
              onClick={() => setType('fixed')}
              className={`py-3 px-4 rounded-xl border-2 font-medium transition-all ${type === 'fixed' ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
            >
              Fixed Price
            </button>
            <button
              type="button"
              onClick={() => setType('auction')}
              className={`py-3 px-4 rounded-xl border-2 font-medium transition-all ${type === 'auction' ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
            >
              Auction
            </button>
          </div>

          {type === 'auction' && (
            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-4 animate-in fade-in slide-in-from-top-2">
              <label className="block text-sm font-medium text-orange-900">Auction Duration</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: '1 Hour', value: '1' },
                  { label: '6 Hours', value: '6' },
                  { label: '12 Hours', value: '12' },
                  { label: '24 Hours', value: '24' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAuctionDuration(opt.value)}
                    className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${auctionDuration === opt.value ? 'border-orange-500 bg-orange-500 text-white' : 'border-orange-200 bg-white text-orange-700 hover:border-orange-300'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="radio"
                  id="custom_duration"
                  name="duration"
                  checked={auctionDuration === 'custom'}
                  onChange={() => setAuctionDuration('custom')}
                  className="text-orange-500 focus:ring-orange-500"
                />
                <label htmlFor="custom_duration" className="text-sm text-orange-900">Custom End Time</label>
              </div>
              {auctionDuration === 'custom' && (
                <input
                  type="datetime-local"
                  value={customAuctionDate}
                  onChange={(e) => setCustomAuctionDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  required={auctionDuration === 'custom'}
                  className="w-full px-4 py-2 bg-white border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              )}
            </div>
          )}
        </div>

        {/* Images */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Product Images (Max 5)</label>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            {imagePreviews.map((preview, index) => (
              <div 
                key={index} 
                className={`relative aspect-square rounded-xl overflow-hidden border-2 group cursor-pointer transition-all ${previewImageIndex === index ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200 hover:border-gray-300'}`}
                onClick={() => setPreviewImageIndex(index)}
              >
                <Image src={preview} alt={`Preview ${index}`} fill unoptimized className="object-cover" referrerPolicy="no-referrer" />
                
                {/* Preview Badge */}
                {previewImageIndex === index && (
                  <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                    Cover
                  </div>
                )}
                
                {/* Set as Cover overlay (visible on hover if not cover) */}
                {previewImageIndex !== index && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">Set as Cover</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
                  }}
                  className="absolute top-2 right-2 bg-white/90 text-red-500 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:text-red-600 shadow-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            
            {imageFiles.length < 5 && (
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
              placeholder="Describe your product..."
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
            {isSubmitting ? 'Publishing...' : 'Publish Listing'}
          </button>
        </div>
      </form>
    </div>
  );
}
