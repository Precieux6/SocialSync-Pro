// socialsync-pro-frontend/src/components/Comments/CommentsManager.jsx
import React, { useState } from 'react';

export default function CommentsManager({ comments, triggerNotification }) {
  const [commentsPlatformFilter, setCommentsPlatformFilter] = useState('all');

  const filteredComments = commentsPlatformFilter === 'all'
    ? comments
    : comments.filter((c) => c.platform === commentsPlatformFilter);

  const getPlatformBadgeColor = (platform) => {
    switch (platform) {
      case 'instagram': return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'facebook': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'youtube': return 'bg-red-100 text-red-700 border-red-200';
      case 'tiktok': return 'bg-teal-100 text-teal-700 border-teal-200';
      default: return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'instagram': return 'fa-brands fa-instagram text-pink-600';
      case 'facebook': return 'fa-brands fa-facebook text-blue-600';
      case 'youtube': return 'fa-brands fa-youtube text-red-600';
      case 'tiktok': return 'fa-brands fa-tiktok text-teal-600';
      default: return 'fa-regular fa-comments';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-900">Mes commentaires</h2>
          <p className="text-xs text-stone-500 mt-1">Gestion centralisée des réponses filtrables par réseau social.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-[#F4EFE6] p-2 rounded-2xl border border-[#E2D5C3]">
          <button
            onClick={() => setCommentsPlatformFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              commentsPlatformFilter === 'all' ? 'bg-stone-900 text-amber-200 shadow' : 'text-stone-700 hover:bg-[#E8DFC9]'
            }`}
          >
            <i className="fa-regular fa-comments"></i>
            <span>Tous ({comments.length})</span>
          </button>

          <button
            onClick={() => setCommentsPlatformFilter('instagram')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              commentsPlatformFilter === 'instagram' ? 'bg-pink-600 text-white shadow' : 'text-pink-700 hover:bg-pink-100'
            }`}
          >
            <i className="fa-brands fa-instagram"></i>
            <span>Instagram ({comments.filter((c) => c.platform === 'instagram').length})</span>
          </button>

          <button
            onClick={() => setCommentsPlatformFilter('facebook')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              commentsPlatformFilter === 'facebook' ? 'bg-blue-600 text-white shadow' : 'text-blue-700 hover:bg-blue-100'
            }`}
          >
            <i className="fa-brands fa-facebook"></i>
            <span>Facebook ({comments.filter((c) => c.platform === 'facebook').length})</span>
          </button>

          <button
            onClick={() => setCommentsPlatformFilter('youtube')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              commentsPlatformFilter === 'youtube' ? 'bg-red-600 text-white shadow' : 'text-red-700 hover:bg-red-100'
            }`}
          >
            <i className="fa-brands fa-youtube"></i>
            <span>YouTube ({comments.filter((c) => c.platform === 'youtube').length})</span>
          </button>

          <button
            onClick={() => setCommentsPlatformFilter('tiktok')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              commentsPlatformFilter === 'tiktok' ? 'bg-teal-700 text-white shadow' : 'text-teal-700 hover:bg-teal-100'
            }`}
          >
            <i className="fa-brands fa-tiktok"></i>
            <span>TikTok ({comments.filter((c) => c.platform === 'tiktok').length})</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredComments.length === 0 ? (
          <div className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-3xl p-12 text-center text-stone-500 font-medium">
            <i className="fa-regular fa-comment-dots text-3xl text-stone-300 mb-3 block"></i>
            Aucun commentaire à afficher pour ce réseau social.
          </div>
        ) : (
          filteredComments.map((comment) => (
            <div key={comment.id} className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={comment.avatar} alt={comment.author} className="w-9 h-9 rounded-full object-cover" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-stone-900">{comment.author}</h4>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border flex items-center gap-1 ${getPlatformBadgeColor(comment.platform)}`}>
                        <i className={getPlatformIcon(comment.platform)}></i>
                        {comment.platform}
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-500">Post : "{comment.postTitle}" · {comment.date}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-stone-700 italic bg-[#F4EFE6] p-3 rounded-xl border border-[#E2D5C3]">"{comment.text}"</p>

              <div className="space-y-3 bg-[#F4EFE6]/60 p-4 rounded-xl border border-[#E2D5C3]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800">Zone de réponse ({comment.platform.toUpperCase()})</span>
                  <button
                    onClick={() => triggerNotification(`Réponse sur-mesure pour ${comment.platform.toUpperCase()} régénérée pour ${comment.author}`)}
                    className="bg-[#FAF7F2] border border-[#D6AC66] text-stone-800 text-xs font-bold px-3 py-1 rounded-lg hover:bg-white flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles text-gold-600"></i> Adapté à {comment.platform}
                  </button>
                </div>

                <textarea
                  rows={2}
                  defaultValue={comment.aiReply}
                  className="w-full bg-[#FAF7F2] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-800 focus:outline-none"
                />

                <div className="flex justify-end">
                  <button
                    onClick={() => triggerNotification(`Réponse envoyée sur ${comment.platform.toUpperCase()} à ${comment.author} !`)}
                    className="bg-stone-900 text-amber-200 text-xs font-bold px-5 py-2 rounded-xl flex items-center gap-2 shadow hover:bg-stone-800"
                  >
                    <i className="fa-solid fa-paper-plane text-xs"></i> Répondre sur {comment.platform}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
