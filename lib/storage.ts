// Note: Firebase Storage is replaced by Cloudinary.
// We keep the API signature (file, path/folder) so we don't have to change 
// all the components that are calling 'uploadImage'.

export const uploadImage = async (
  file: File,
  path: string, // Used as Cloudinary folder
  onProgress?: (progress: number) => void
): Promise<string> => {
  try {
    if (onProgress) onProgress(10);

    // 1. Get upload signature from our backend
    // `path` from Firebase was typically like "products/123", we can just use the first part as a folder.
    const folder = path.split('/')[0] || 'uploads';
    const sigResponse = await fetch('/api/upload/signature', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ folder }),
    });

    if (!sigResponse.ok) {
      throw new Error('Failed to fetch Cloudinary signature');
    }

    const sigData = await sigResponse.json();
    
    if (onProgress) onProgress(30);

    // 2. Upload to Cloudinary using FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', sigData.apiKey);
    formData.append('timestamp', sigData.timestamp.toString());
    formData.append('signature', sigData.signature);
    if (sigData.folder) {
      formData.append('folder', sigData.folder);
    }

    // Use XMLHttpRequest if we want exact progress, but default fetch is okay for simplicity
    // For large uploads, consider XHR to use `onProgress` correctly.
    // We'll stick to a simple fetch for now and mock the middle progress.
    
    if (onProgress) onProgress(50);

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      throw new Error('Cloudinary upload failed');
    }

    const uploadData = await uploadResponse.json();

    if (onProgress) onProgress(100);

    // Return the secure URL from Cloudinary
    return uploadData.secure_url;
  } catch (error) {
    console.error('Error uploading image to Cloudinary:', error);
    throw error;
  }
};

export const deleteImage = async (url: string) => {
  try {
    // Cloudinary images normally are deleted securely from backend using Admin API.
    // If you need client-side deletion, you would trigger a server side API endpoint here,
    // passing the public ID of the image (extracted from the URL).
    // For now, we will create a placeholder API call if you set one up later:
    
    /* 
    const publicId = extractPublicIdFromCloudinaryUrl(url);
    await fetch('/api/upload/delete', {
       method: 'POST', body: JSON.stringify({ publicId })
    });
    */
    
    console.log('Skipping client-side delete of Cloudinary url:', url);
  } catch (error) {
    console.error('Error deleting image:', error);
  }
};
