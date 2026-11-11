import React, { useState } from 'react';

export const ImagePicker: React.FC = () => {
  const [images, setImages] = useState<File[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [usageType, setUsageType] = useState<'content' | 'ai-prototype'>('content');

  const handleImageChange = (file: File) => {
    setSelectedImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateImage = async () => {
    if (!selectedImage) return;
    // Placeholder for AI image generation - would integrate with AI models
    // For now, we'll simulate the generation
    const response = await fetch('/api/ai-image/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usageType,
        prompt: 'Generate an image based on the selected image'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      setPreviewUrl(data.generatedImageUrl);
      setSelectedImage(null);
    }
  };

  const handleClose = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
  };

  return (
    <div className="image-picker">
      <h3>เลือกรูปภาพ</h3>
      
      {images.length > 0 ? (
        <div className="image-grid">
          {images.map((img, index) => (
            <div key={index} className="image-card">
              <img src={previewUrl && selectedImage === img ? previewUrl : URL.createObjectURL(img)} alt="Preview" />
              <div className="card-actions">
                <button 
                  onClick={() => handleImageChange(img)}
                  className="btn-primary"
                >
                  เลือกรูป
                </button>
                <button 
                  onClick={() => setUsageType('content')}
                  className={`btn-${usageType}`}
                >
                  ใช้เป็นเนื้อหา
                </button>
                <button 
                  onClick={() => setUsageType('ai-prototype')}
                  className={`btn-${usageType}`}
                >
                  ใช้เป็น AI Prototyping
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-images">ยังไม่มีรูปภาพเลือก</p>
      )}

      <div className="image-actions">
        <button 
          onClick={handleGenerateImage}
          disabled={!selectedImage}
          className="btn-primary"
        >
          สร้างรูป AI
        </button>
        <button 
          onClick={handleClose}
          className="btn-secondary"
        >
          ปิด
        </button>
      </div>
    </div>
  );
};