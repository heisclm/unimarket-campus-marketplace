import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f4f4f0] p-4">
      <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
        {/* Header Mock */}
        <div className="h-40 bg-white rounded-[2rem] shadow-sm"></div>
        
        {/* Grid Mock */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="aspect-[4/5] bg-white rounded-[2rem] shadow-sm"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
