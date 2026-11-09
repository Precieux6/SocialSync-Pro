import React from 'react';

export default function MediaLibrary({ mediaList, onUpload, onCopy }) {
  return (
    <div className="space-y-6">
      <div className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-900">Médiathèque Cloud</h2>
          <p className="text-xs text-stone-500 mt-1">Gérez l'ensemble de vos ressources visuelles et vidéos.</p>
        </div>
        <label className="bg-stone-900 hover:bg-stone-800 text-amber-200 text-xs font-bold px-5 py-3 rounded-2xl cursor-pointer shadow transition-all flex items-center gap-2">
          <i className="fa-solid fa-cloud-arrow-up text-gold-400"></i>
          <span>Téléverser un fichier</span>
          <input type="file" accept="image/*,video/*" onChange={onUpload} className="hidden" />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {mediaList.map((media) => (
          <div key={media.id} className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-3xl p-5 space-y-4 shadow-sm">
            <div className="w-full h-40 bg-stone-900 rounded-2xl overflow-hidden flex items-center justify-center relative">
              {media.type === 'image' ? (
                <img src={media.url} alt={media.name} className="w-full h-full object-cover" />
              ) : (
                <div className="text-amber-200 flex flex-col items-center gap-2">
                  <i className="fa-solid fa-video text-3xl"></i>
                  <span className="text-[10px] font-bold">Vidéo</span>
                </div>
              )}
              <span className="absolute top-3 right-3 bg-stone-900/80 text-amber-200 text-[10px] px-2.5 py-1 rounded-full font-bold">
                {media.size}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-serif font-bold text-xs text-stone-900 truncate max-w-[180px]">
                {media.name}
              </span>
              <button 
                onClick={() => onCopy(media.name, "Nom du média")}
                className="text-gold-700 hover:text-stone-900 text-xs font-bold"
              >
                <i className="fa-regular fa-copy"></i>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}