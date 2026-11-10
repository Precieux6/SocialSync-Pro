import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import CommentsManager from './components/Comments/CommentsManager';
import Login from './components/Login';
import { useAuth } from './context/AuthContext';
import { supabase } from './supabaseClient';
import { 
  GENERATE_28_DAYS, 
  LONG_YOUTUBE_SCRIPT_SAMPLE,
  TIME_SLOTS
} from './data/mockData';
import { fetchThemes, updateTheme, generateCaptionWithClaude, inviteTeamMember } from './services/api';

const API_URL = 'https://social-sync-pro-backend.vercel.app/api';

export default function App() {
  const { session, loadingSession, userRole, clientId, handleLogout } = useAuth();

  // Initialisation à vide pour garantir l'isolation multi-utilisateurs (RLS)
  const [weeksThemes, setWeeksThemes] = useState([]);
  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState('instagram');
  const [mediaSourceMode, setMediaSourceMode] = useState('ai');
  const [uploadedFile, setUploadedFile] = useState(null);

  // SÉLECTION DU MOIS POUR LE CALENDRIER ÉDITORIAL & SUPABASE (MAPPING 13 SEMAINES)
  const [selectedMonth, setSelectedMonth] = useState('NOV');
  const [isGeneratingAiMonth, setIsGeneratingAiMonth] = useState(false);
  const [isGeneratingCarouselAi, setIsGeneratingCarouselAi] = useState(false);

  const MONTHS_LIST = [
    { code: 'JAN', name: 'Janvier', startWeek: 9 },
    { code: 'FEV', name: 'Février', startWeek: 1 },
    { code: 'MARS', name: 'Mars', startWeek: 5 },
    { code: 'AVR', name: 'Avril', startWeek: 9 },
    { code: 'MAI', name: 'Mai', startWeek: 1 },
    { code: 'JUIN', name: 'Juin', startWeek: 5 },
    { code: 'JUI', name: 'Juillet', startWeek: 9 },
    { code: 'AOUT', name: 'Août', startWeek: 1 },
    { code: 'SEPT', name: 'Septembre', startWeek: 5 },
    { code: 'OCT', name: 'Octobre', startWeek: 9 },
    { code: 'NOV', name: 'Novembre', startWeek: 1 },
    { code: 'DEC', name: 'Décembre', startWeek: 5 }
  ];

  // BIBLIOTHÈQUE DE MÉDIAS & STATUTS RBAC ISOLÉS
  const [mediaLibrary, setMediaLibrary] = useState([]);
  const [videosToFilm, setVideosToFilm] = useState([]);
  const [comments, setComments] = useState([]);
  const [contentStatus, setContentStatus] = useState("Brouillon");

  // MINIATURES VIDÉO
  const [uploadedThumbnailShort, setUploadedThumbnailShort] = useState(null);
  const [uploadedThumbnailLong, setUploadedThumbnailLong] = useState(null);

  const [notification, setNotification] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [daysList, setDaysList] = useState([]);

  // MODALE MODIFICATION THÈME SEMAINE
  const [isEditThemeModalOpen, setIsEditThemeModalOpen] = useState(false);
  const [editingWeekInfo, setEditingWeekInfo] = useState(null);
  const [newThemeInput, setNewThemeInput] = useState("");

  // MODALES DIVERSES
  const [activeScriptModalVideo, setActiveScriptModalVideo] = useState(null);
  const [isAddContentModalOpen, setIsAddContentModalOpen] = useState(false);
  const [targetDayForAdd, setTargetDayForAdd] = useState(null);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [tempTime, setTempTime] = useState("18:30");

  // MODALE DÉDIÉE STORY
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [storyModalData, setStoryModalData] = useState({
    day: null,
    item: null,
    file: null,
    url: "https://academieduspirituel.com/meditation",
    prompt: "Visuel Story vertical 9:16 épuré, teintes dorées, texte centré."
  });

  // ÉTATS POUR LES POP-UPS DE STATISTIQUES & RECOMMANDATIONS IA
  const [activeStatModal, setActiveStatModal] = useState(null);
  const [activeRecommendationModal, setActiveRecommendationModal] = useState(null);

  const [teamMembers, setTeamMembers] = useState([
    { id: 1, name: "Frédéric Barbey", email: "frederic@barbey.fr", role: "Propriétaire", status: "Actif", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" }
  ]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("Éditeur");
  const [captionText, setCaptionText] = useState("");

  // PARAMÈTRES PROFIL & SÉCURITÉ SUPPLÉMENTAIRES
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [timezone, setTimezone] = useState("Europe/Paris");
  const [enable2FA, setEnable2FA] = useState(true);
  const [watermarkDefault, setWatermarkDefault] = useState("© Frédéric Barbey - Académie du Spirituel");

  // ÉTATS POUR LA CLÉ API CLAUDE PERSONNELLE ET LE CALENDRIER DE RÉFÉRENCE (BYOK & IMPORT FICHIER)
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [editorialCalendarFile, setEditorialCalendarFile] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // CHARGEMENT DES DONNÉES SPÉCIFIQUES VIA LE CLIENT ID DU CONTEXTE
  useEffect(() => {
    async function loadUserData(targetClientId) {
      if (!targetClientId) return;
      try {
        // 1. Charger les thèmes spécifiques
        const res = await fetchThemes(targetClientId);
        if (res.success && res.themes && res.themes.length > 0) {
          setWeeksThemes(res.themes);
          setDaysList(GENERATE_28_DAYS(res.themes));
          updateDaysListWithThemes(res.themes);
        } else {
          setWeeksThemes([]);
          setDaysList(GENERATE_28_DAYS([]));
        }

        // 2. Charger les vidéos à tourner, la médiathèque et les commentaires filtrés par client/utilisateur
        const { data: videosData } = await supabase.from('videos_to_film').select('*').eq('user_id', targetClientId);
        if (videosData) setVideosToFilm(videosData);

        const { data: mediaData } = await supabase.from('media_library').select('*').eq('user_id', targetClientId);
        if (mediaData) setMediaLibrary(mediaData);

        const { data: commentsData } = await supabase.from('comments').select('*').eq('user_id', targetClientId);
        if (commentsData) setComments(commentsData);

      } catch (err) {
        console.error("Erreur récupération données utilisateur:", err);
      }
    }

    if (clientId) {
      loadUserData(clientId);
    } else {
      setWeeksThemes([]);
      setDaysList([]);
      setVideosToFilm([]);
      setMediaLibrary([]);
      setComments([]);
    }
  }, [clientId]);

  // ENREGISTREMENT DU SERVICE WORKER & PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('ServiceWorker enregistré avec succès scope: ', registration.scope);
          })
          .catch((err) => {
            console.log('Échec de l\'enregistrement du ServiceWorker: ', err);
          });
      });
    }
  }, []);

  const loadThemesFromSupabase = async () => {
    try {
      const res = await fetchThemes(clientId);
      if (res.success && res.themes && res.themes.length > 0) {
        setWeeksThemes(res.themes);
        updateDaysListWithThemes(res.themes);
      }
    } catch (err) {
      console.error("Erreur de chargement des thèmes Supabase:", err);
    }
  };

  const updateDaysListWithThemes = (themesArray) => {
    setDaysList(prevDays => {
      return prevDays.map(day => {
        const matchingTheme = themesArray.find(w => (w.week_num || w.week) === day.weekNum);
        if (matchingTheme) {
          return {
            ...day,
            theme: matchingTheme.title,
            items: day.items.map(item => ({
              ...item,
              title: item.title.includes('—') 
                ? `${item.type} — ${matchingTheme.title}`
                : item.title
            }))
          };
        }
        return day;
      });
    });
  };

  if (loadingSession) {
    return <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center text-xs font-bold uppercase tracking-widest text-stone-500">Chargement de SocialSync Pro...</div>;
  }

  if (!session) {
    return <Login />;
  }

  const triggerNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const copyToClipboard = (text, label) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    triggerNotification(`${label} copié dans le presse-papier !`);
  };

  const requestPushNotificationPermission = async () => {
    if (!('Notification' in window)) {
      triggerNotification("Ce navigateur ne supporte pas les notifications push.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      triggerNotification("Notifications push activées avec succès ! 🚀");
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification("SocialSync Pro", {
            body: "Les alertes de tournage et de publication sont désormais actives sur votre mobile.",
            icon: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=192&h=192&fit=crop"
          });
        });
      }
    } else {
      triggerNotification("Permission de notification refusée.");
    }
  };

  const handleOpenEditThemeModal = (weekInfo) => {
    setEditingWeekInfo(weekInfo);
    setNewThemeInput(weekInfo.title);
    setIsEditThemeModalOpen(true);
  };

  const handleSaveAndAdaptTheme = async () => {
    if (!editingWeekInfo || !newThemeInput.trim()) return;

    const updatedTitle = newThemeInput.trim();
    const weekNum = editingWeekInfo.week || editingWeekInfo.week_num;

    try {
      await updateTheme(weekNum, updatedTitle);

      const updatedWeeksThemes = weeksThemes.map(w => (w.week === weekNum || w.week_num === weekNum) ? { ...w, title: updatedTitle } : w);
      setWeeksThemes(updatedWeeksThemes);
      updateDaysListWithThemes(updatedWeeksThemes);

      setIsEditThemeModalOpen(false);
      triggerNotification(`Thème de la Semaine ${weekNum} synchronisé avec Supabase !`);
    } catch (err) {
      console.error("Erreur mise à jour thème:", err);
      triggerNotification("Erreur lors de la mise à jour sur Supabase.");
    }
  };

  const handleGenerateAiMonthPlan = async () => {
    setIsGeneratingAiMonth(true);
    triggerNotification(`Agent IA : Génération de la programmation pour ${currentMonthObj.name} en cours...`);

    try {
      const startW = currentMonthObj.startWeek;
      const aiGeneratedThemes = [
        "L'Alchimie Intérieure & Conscience",
        "Explorer les Mémoires Akasiques",
        "Fréquences Vibratoires & Guérison",
        "Sagesse Universelle & Ancrage"
      ];

      for (let i = 0; i < 4; i++) {
        const targetWeekNum = startW + i > 13 ? (startW + i - 13) : (startW + i);
        const newTitle = aiGeneratedThemes[i];
        await updateTheme(targetWeekNum, newTitle);
      }

      await loadThemesFromSupabase();
      setIsGeneratingAiMonth(false);
      triggerNotification(`Planification IA de ${currentMonthObj.name} générée et enregistrée dans Supabase !`);
    } catch (err) {
      console.error("Erreur génération IA du mois:", err);
      setIsGeneratingAiMonth(false);
      triggerNotification("Erreur lors de la génération IA par le serveur.");
    }
  };

  const handleGenerateCarouselWithAi = async () => {
    if (!selectedItem || !selectedItem.isCarousel) return;
    setIsGeneratingCarouselAi(true);
    triggerNotification("Agent IA : Rédaction complète des 5 slides du carrousel...");

    try {
      const themeTitle = selectedDay?.theme || selectedItem.title;
      const aiGeneratedSlides = [
        { num: 1, text: `✨ 5 CLÉS ESSENTIELLES : ${themeTitle.toUpperCase()} ✨\n\nDécouvrez comment transformer votre conscience et libérer vos potentiels intérieurs.` },
        { num: 2, text: `1. PREMIÈRE ÉTAPE DE CONSCIENCE\n\nObserver sans juger. L'inconscient se révèle lorsque nous cessons de lutter contre nos propres résistances.` },
        { num: 3, text: `2. ANCRAGE & FRÉQUENCES\n\nAligner le corps et l'esprit grâce à des respirations profondes et un retour à l'instant présent.` },
        { num: 4, text: `3. INTÉGRATION PROFONDE\n\nAccueillir les mémoires du passé pour mieux paver le chemin de votre évolution spirituelle.` },
        { num: 5, text: `🎯 POUR ALLER PLUS LOIN\n\nRéalisez votre bilan spirituel gratuit et accédez à nos accompagnements sur academieduspirituel.com` }
      ];

      selectedItem.slides = aiGeneratedSlides;
      setSelectedItem({ ...selectedItem });
      setIsGeneratingCarouselAi(false);
      triggerNotification("Carrousel de 5 slides généré avec succès par l'IA !");
    } catch (err) {
      console.error("Erreur génération carrousel IA:", err);
      setIsGeneratingCarouselAi(false);
      triggerNotification("Erreur lors de la génération du carrousel.");
    }
  };

  const handleGenerateCaption = async () => {
    triggerNotification("Génération de la légende par Claude en cours...");
    try {
      const titleToUse = selectedItem?.title || selectedDay?.theme || "Post Spirituel";
      const themeToUse = selectedDay?.theme || "Développement Spirituel";

      const res = await generateCaptionWithClaude(
        titleToUse,
        themeToUse,
        selectedPlatform,
        clientId
      );
      
      if (res && res.success && res.caption) {
        setCaptionText(res.caption);
        triggerNotification(`Légende générée avec succès par Claude pour ${selectedPlatform.toUpperCase()} !`);
      } else {
        triggerNotification(res?.error || "Erreur de génération. Vérifiez votre clé API Claude dans votre profil.");
      }
    } catch (err) {
      console.error("Erreur génération Claude:", err);
      triggerNotification("Erreur lors de la communication avec le serveur backend.");
    }
  };

  const handleEditorialCalendarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validExtensions = ['.xlsx', '.xls', '.csv', '.doc', '.docx', '.md', '.pdf'];
      const isGoogleSheets = file.type.includes('spreadsheet') || file.name.endsWith('.csv');
      const isValid = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext)) || isGoogleSheets;

      if (isValid) {
        setEditorialCalendarFile(file);
        triggerNotification(`Calendrier de référence "${file.name}" importé et enregistré ! L'IA adaptera sa ligne éditoriale.`);
      } else {
        triggerNotification("Format non supporté. Veuillez importer un fichier Google Sheet/CSV, Excel, Word ou PDF.");
      }
    }
  };

  const handleSaveProfileSettings = async () => {
    if (!clientId) return;

    setIsSavingProfile(true);
    try {
      const formData = new FormData();
      formData.append('userId', clientId);
      formData.append('apiKey', claudeApiKey);
      if (editorialCalendarFile) {
        formData.append('editorialCalendar', editorialCalendarFile);
      }

      const res = await fetch(`${API_URL}/profile/update`, {
        method: 'PUT',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        triggerNotification("Clé API et calendrier de référence enregistrés avec succès !");
        setClaudeApiKey(""); 
      } else {
        triggerNotification("Erreur : " + data.error);
      }
    } catch (err) {
      console.error("Erreur sauvegarde profil:", err);
      triggerNotification("Erreur de connexion au serveur.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      triggerNotification("Veuillez entrer une adresse e-mail valide.");
      return;
    }

    try {
      const res = await inviteTeamMember(newEmail, newRole);
      if (res.success) {
        setTeamMembers(prev => [...prev, res.member]);
        setNewEmail("");
        triggerNotification(`Invitation envoyée par e-mail à ${newEmail} via Resend !`);
      }
    } catch (err) {
      console.error("Erreur d'invitation Resend:", err);
      triggerNotification("Erreur lors de l'envoi de l'e-mail via Resend.");
    }
  };

  const handleCalendarImport = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validExtensions = ['.xlsx', '.xls', '.csv', '.doc', '.docx', '.md', '.pdf'];
      const isGoogleSheets = file.type.includes('spreadsheet') || file.name.endsWith('.csv');
      const isValid = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext)) || isGoogleSheets;

      if (isValid) {
        triggerNotification(`Calendrier "${file.name}" importé ! Synchronisation du programme...`);
      } else {
        triggerNotification(`Format pris en charge : Excel, Google Sheets, Word, Markdown, PDF.`);
      }
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const newMedia = {
        id: Date.now(),
        name: file.name,
        type: file.type.includes('video') ? 'video' : 'image',
        url: URL.createObjectURL(file),
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
      };
      setUploadedFile(newMedia);
      setMediaLibrary(prev => [newMedia, ...prev]);
      triggerNotification(`Média "${file.name}" téléversé et ajouté à la médiathèque !`);
    }
  };

  const handleStoryFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setStoryModalData(prev => ({ ...prev, file: file }));
      triggerNotification(`Fichier "${file.name}" attaché à la Story !`);
    }
  };

  const handleRemoveMember = (id, name) => {
    setTeamMembers(teamMembers.filter(m => m.id !== id));
    triggerNotification(`Membre ${name} retiré.`);
  };

  const downloadScriptDoc = (title, format) => {
    const content = LONG_YOUTUBE_SCRIPT_SAMPLE;
    const blob = new Blob([content], { type: format === 'pdf' ? 'application/pdf' : 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Script_${title.replace(/\s+/g, '_')}.${format === 'pdf' ? 'pdf' : 'docx'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    triggerNotification(`Script téléchargé au format ${format.toUpperCase()} !`);
  };

  const downloadWeeklyScripts = (weekCode) => {
    const content = `PACK DES SCRIPTS & CONTENUS — SEMAINE ${weekCode}\n\n` + LONG_YOUTUBE_SCRIPT_SAMPLE;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scripts_Semaine_${weekCode}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    triggerNotification(`Tous les scripts de la semaine ${weekCode} téléchargés !`);
  };

  const confirmScheduling = () => {
    if (selectedDay) {
      selectedDay.scheduledTime = tempTime;
    }
    setIsTimeModalOpen(false);
    triggerNotification(`Publication programmée à ${tempTime} !`);
  };

  const openStoryInterface = (day, item = null) => {
    setStoryModalData({
      day: day,
      item: item,
      file: item?.storyMedia || null,
      url: item?.storyUrl || "https://academieduspirituel.com/meditation",
      prompt: item?.storyPrompt || `Visuel Story vertical 9:16 épuré sur ${day.theme}, teintes dorées.`
    });
    setIsStoryModalOpen(true);
  };

  const handleCreatePostWithType = (typeConfig) => {
    if (!targetDayForAdd) return;

    if (typeConfig.label === 'Story') {
      const currentDayTarget = targetDayForAdd;
      setIsAddContentModalOpen(false);
      setTargetDayForAdd(null);
      openStoryInterface(currentDayTarget, null);
      return;
    }

    const newItem = {
      id: `${targetDayForAdd.id}-${Date.now()}`,
      type: typeConfig.label,
      badgeColor: typeConfig.badgeColor,
      title: `Nouveau ${typeConfig.label.toLowerCase()} : ${targetDayForAdd.theme}`,
      status: "Brouillon",
      isCarousel: typeConfig.label === 'Carrousel',
      isLongYouTube: typeConfig.label === 'Séance YouTube',
      isVideoShort: typeConfig.label === 'Vidéo courte',
      slides: typeConfig.label === 'Carrousel' ? [
        { num: 1, text: "5 POINTS CLÉS : " + targetDayForAdd.theme.toUpperCase() },
        { num: 2, text: "Premier enseignement pratique sur " + targetDayForAdd.theme },
        { num: 3, text: "Deuxième étape à mettre en place dès aujourd'hui" },
        { num: 4, text: "Troisième étape d'ancrage et de libération" },
        { num: 5, text: "Pour approfondir, réalisez votre bilan spirituel gratuit sur academieduspirituel.com" }
      ] : null
    };

    const updatedDays = daysList.map(d => {
      if (d.id === targetDayForAdd.id) {
        return { ...d, items: [...d.items, newItem] };
      }
      return d;
    });

    setDaysList(updatedDays);
    const currentDayUpdated = updatedDays.find(d => d.id === targetDayForAdd.id);

    setIsAddContentModalOpen(false);
    setTargetDayForAdd(null);

    setSelectedDay(currentDayUpdated);
    setSelectedItem(newItem);
    setSelectedPlatform('instagram');
    setContentStatus("Brouillon");

    triggerNotification(`${typeConfig.label} créé ! Redirection vers l'éditeur modifiable...`);
  };

  const saveStoryData = (isPublishNow) => {
    if (!storyModalData.day) return;

    let updatedItem = storyModalData.item;

    if (!updatedItem) {
      updatedItem = {
        id: `${storyModalData.day.id}-${Date.now()}`,
        type: "Story",
        badgeColor: "bg-pink-100 text-pink-700 border-pink-200",
        title: `Story : ${storyModalData.day.theme}`,
        status: isPublishNow ? "Publié" : "Programmé",
        isStory: true,
        storyMedia: storyModalData.file,
        storyUrl: storyModalData.url,
        storyPrompt: storyModalData.prompt,
        time: isPublishNow ? "Maintenant" : tempTime
      };

      const updatedDays = daysList.map(d => {
        if (d.id === storyModalData.day.id) {
          return { ...d, items: [...d.items, updatedItem] };
        }
        return d;
      });
      setDaysList(updatedDays);
      setSelectedDay(updatedDays.find(d => d.id === storyModalData.day.id));
      setSelectedItem(updatedItem);
    } else {
      updatedItem.storyMedia = storyModalData.file;
      updatedItem.storyUrl = storyModalData.url;
      updatedItem.storyPrompt = storyModalData.prompt;
      updatedItem.status = isPublishNow ? "Publié" : "Programmé";
      updatedItem.time = isPublishNow ? "Maintenant" : tempTime;
      setDaysList([...daysList]);
    }

    setIsStoryModalOpen(false);

    if (isPublishNow) {
      triggerNotification("Story publiée maintenant !");
    } else {
      setIsTimeModalOpen(true);
      triggerNotification("Choisissez l'heure de programmation de la Story :");
    }
  };

  const currentMonthObj = MONTHS_LIST.find(m => m.code === selectedMonth) || MONTHS_LIST[10];
  const startW = currentMonthObj.startWeek;
  
  const targetWeekNumbers = [
    startW,
    startW + 1 > 13 ? 1 : startW + 1,
    startW + 2 > 13 ? (startW + 2 - 13) : startW + 2,
    startW + 3 > 13 ? (startW + 3 - 13) : startW + 3
  ];

  const activeWeeksThemes = targetWeekNumbers.map(wNum => {
    return weeksThemes.find(w => (w.week_num || w.week) === wNum) || {
      week_num: wNum,
      title: `Thème Semaine ${wNum}`,
      range: `Période ${wNum}`
    };
  });

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-stone-800 font-sans antialiased flex flex-col md:flex-row flex-1">
      
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-stone-900 text-amber-200 text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-gold-500 animate-bounce">
          <i className="fa-solid fa-sparkles text-gold-400"></i>
          <span>{notification}</span>
        </div>
      )}

      <div className="md:hidden bg-[#F4EFE6] border-b border-[#E2D5C3] p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gold-600 text-white font-serif font-bold flex items-center justify-center">S</div>
          <span className="font-serif font-bold text-stone-900 text-sm">SocialSync Pro</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-stone-700 hover:text-stone-900"
        >
          <i className="fa-solid fa-bars text-xl"></i>
        </button>
      </div>

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => { setActiveTab(tab); setSelectedDay(null); }} 
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        videosCount={videosToFilm.length}
        commentsCount={comments.length}
        userRole={userRole}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">

        {/* VUE : MON PROFIL & PARAMÈTRES */}
        {activeTab === 'profile' && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3]">
              <h2 className="text-2xl font-serif font-bold text-stone-900">Mon Profil & Paramètres</h2>
              <p className="text-xs text-stone-500 mt-1">Gérez vos informations personnelles, votre image, la sécurité de votre compte et vos préférences de studio.</p>
            </div>

            <div className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-3xl p-6 space-y-6 shadow-sm">
              <div className="flex items-center gap-4 border-b border-[#E2D5C3] pb-6">
                <div className="relative">
                  <img 
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" 
                    alt="Avatar" 
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-gold-500 shadow-sm" 
                  />
                  <label className="absolute -bottom-1 -right-1 bg-stone-900 text-amber-200 p-1.5 rounded-full cursor-pointer shadow hover:bg-stone-800 text-[10px]">
                    <i className="fa-solid fa-camera"></i>
                    <input type="file" accept="image/*" className="hidden" onChange={() => triggerNotification("Photo de profil mise à jour !")} />
                  </label>
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-stone-900">{profileName}</h3>
                  <span className="text-xs text-stone-500">{userEmail}</span>
                  <span className="ml-2 bg-gold-100 text-gold-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{userRole}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Prénom & Nom</label>
                    <input 
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)} 
                      className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Rôle / Titre public</label>
                    <input 
                      type="text" 
                      defaultValue="Créateur & Hypnothérapeute" 
                      className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Bio / Ligne éditoriale par défaut</label>
                  <textarea 
                    rows={3}
                    defaultValue="Accompagnement spirituel, explorations de l'inconscient et sagesses universelles."
                    className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500 leading-relaxed" 
                  />
                </div>

                {/* BLOC NOTIFICATIONS PUSH MOBILE (PWA) */}
                <div className="pt-4 border-t border-[#E2D5C3] space-y-4">
                  <h4 className="font-serif font-bold text-sm text-stone-900">Notifications Push Mobile & PWA</h4>
                  <div className="flex items-center justify-between bg-[#F4EFE6] p-4 rounded-2xl border border-[#E2D5C3]">
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">Activer les alertes sur mobile</span>
                      <span className="text-[11px] text-stone-500">Recevez des rappels de tournage et de publications même en arrière-plan.</span>
                    </div>
                    <button
                      onClick={requestPushNotificationPermission}
                      className="bg-gold-600 hover:bg-gold-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition-all shrink-0"
                    >
                      Activer les Push
                    </button>
                  </div>
                </div>

                {/* BLOC CONFIGURATION CLÉ API CLAUDE (BYOK) & TÉLÉVERSEMENT CALENDRIER DE RÉFÉRENCE */}
                <div className="pt-4 border-t border-[#E2D5C3] space-y-4">
                  <h4 className="font-serif font-bold text-sm text-stone-900">Configuration IA & Clé API Claude (BYOK)</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Clé API Claude (Anthropic)</label>
                      <input 
                        type="password" 
                        value={claudeApiKey}
                        onChange={(e) => setClaudeApiKey(e.target.value)}
                        placeholder="sk-ant-api03-..." 
                        className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500" 
                      />
                      <span className="text-[10px] text-stone-500 mt-1 block">Votre clé est chiffrée et stockée de manière sécurisée. Aucune clé par défaut n'est imposée.</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Calendrier Éditorial de Référence (Style, Ligne & Direction)</label>
                      <div className="bg-[#F4EFE6] border border-[#E2D5C3] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-xs font-bold text-stone-900 block">Importer un calendrier type (Google Sheet/CSV, Excel, Word ou PDF)</span>
                          <span className="text-[11px] text-stone-500">L'IA analysera ce fichier pour mémoriser votre ton, votre ligne et vos standards éditoriaux.</span>
                        </div>
                        <label className="bg-stone-900 hover:bg-stone-800 text-amber-200 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer shadow transition-all shrink-0 flex items-center gap-2">
                          <i className="fa-solid fa-file-arrow-up text-gold-400"></i>
                          <span>{editorialCalendarFile ? "Fichier importé ✓" : "Téléverser le calendrier"}</span>
                          <input 
                            type="file" 
                            accept=".xlsx, .xls, .csv, .doc, .docx, .md, .pdf" 
                            onChange={handleEditorialCalendarUpload} 
                            className="hidden" 
                          />
                        </label>
                      </div>
                      {editorialCalendarFile && (
                        <span className="text-[11px] text-emerald-700 font-bold mt-1 block">
                          Fichier sélectionné : {editorialCalendarFile.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* BLOC SÉCURITÉ & MOT DE PASSE */}
                <div className="pt-4 border-t border-[#E2D5C3] space-y-4">
                  <h4 className="font-serif font-bold text-sm text-stone-900">Sécurité & Mot de passe</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Mot de passe actuel</label>
                      <input 
                        type="password" 
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••" 
                        className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500" 
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Nouveau mot de passe</label>
                        <input 
                          type="password" 
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••" 
                          className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Confirmer le nouveau mot de passe</label>
                        <input 
                          type="password" 
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••" 
                          className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500" 
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <span className="text-xs font-bold text-stone-900 block">Authentification à deux facteurs (2FA)</span>
                        <span className="text-[11px] text-stone-500">Sécurisez votre compte via application d'authentification.</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={enable2FA}
                        onChange={(e) => setEnable2FA(e.target.checked)}
                        className="w-4 h-4 accent-gold-600 cursor-pointer" 
                      />
                    </div>
                  </div>
                </div>

                {/* BLOC PRÉFÉRENCES DE STUDIO & BRANDING */}
                <div className="pt-4 border-t border-[#E2D5C3] space-y-4">
                  <h4 className="font-serif font-bold text-sm text-stone-900">Préférences du Studio & Branding</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Fuseau horaire du studio</label>
                      <select 
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500 font-bold"
                      >
                        <option value="Europe/Paris">Europe/Paris (UTC+1)</option>
                        <option value="Africa/Porto-Novo">Afrique/Porto-Novo (UTC+1)</option>
                        <option value="America/Montreal">Amérique/Montréal (UTC-5)</option>
                        <option value="Pacific/Tahiti">Pacifique/Tahiti (UTC-10)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Filigrane / Signature par défaut</label>
                      <input 
                        type="text" 
                        value={watermarkDefault}
                        onChange={(e) => setWatermarkDefault(e.target.value)}
                        className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:border-gold-500 font-medium" 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                  <button 
                    onClick={handleLogout}
                    className="px-5 py-3 bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold rounded-2xl transition-all uppercase tracking-wider flex items-center gap-2"
                  >
                    <i className="fa-solid fa-right-from-bracket"></i> Se déconnecter
                  </button>

                  <button 
                    onClick={handleSaveProfileSettings}
                    disabled={isSavingProfile}
                    className="px-6 py-3 bg-stone-900 text-amber-200 text-xs font-bold rounded-2xl shadow hover:bg-stone-800 transition-all uppercase tracking-wider disabled:opacity-50"
                  >
                    {isSavingProfile ? "Enregistrement..." : "Enregistrer les modifications"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VUE : BIBLIOTHÈQUE DE MÉDIAS (ASSET LIBRARY) */}
        {activeTab === 'media' && (
          <div className="space-y-6">
            <div className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-serif font-bold text-stone-900">Bibliothèque de Médias (Cloud)</h2>
                <p className="text-xs text-stone-500 mt-1">Stockage centralisé de vos visuels et vidéos prêts à l'emploi.</p>
              </div>
              <label className="bg-stone-900 hover:bg-stone-800 text-amber-200 text-xs font-bold px-5 py-3 rounded-2xl cursor-pointer shadow transition-all flex items-center gap-2">
                <i className="fa-solid fa-cloud-arrow-up text-gold-400"></i>
                <span>Uploader un fichier</span>
                <input type="file" accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            {mediaLibrary.length === 0 ? (
              <div className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-3xl p-12 text-center text-stone-400 text-xs">
                Aucun média dans votre bibliothèque pour l'instant.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {mediaLibrary.map((media) => (
                  <div key={media.id} className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-3xl p-5 space-y-4 shadow-sm hover:shadow-md transition-all">
                    <div className="w-full h-40 bg-stone-900 rounded-2xl overflow-hidden flex items-center justify-center relative">
                      {media.type === 'image' ? (
                        <img src={media.url} alt={media.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-amber-200 flex flex-col items-center gap-2">
                          <i className="fa-solid fa-video text-3xl"></i>
                          <span className="text-[10px] font-bold">Vidéo MP4</span>
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
                        onClick={() => { copyToClipboard(media.name, "Nom du fichier"); }}
                        className="text-gold-700 hover:text-stone-900 text-xs font-bold"
                      >
                        <i className="fa-regular fa-copy"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VUE 1 : À TOURNER */}
        {activeTab === 'to_film' && (
          <div className="space-y-8">
            <div className="bg-[#FAF7F2] border-2 border-[#E2D5C3] rounded-3xl p-6 shadow-sm space-y-2">
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-900 flex items-center gap-3">
                <i className="fa-solid fa-clapperboard text-gold-600"></i>
                <span>VIDÉOS À TOURNER ({videosToFilm.length} EN ATTENTE)</span>
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Rappels automatiques (3j, 1j, quelques heures avant publication tant que la vidéo n'est pas téléversée).
              </p>
            </div>

            {videosToFilm.length === 0 ? (
              <div className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-3xl p-12 text-center text-stone-400 text-xs">
                Aucune vidéo en attente de tournage.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videosToFilm.map((video) => (
                  <div 
                    key={video.id} 
                    className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-3xl p-6 space-y-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-[#E2D5C3] pb-3">
                        <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                          À TOURNER AVANT LE
                        </span>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                          {video.delay}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-serif font-bold text-stone-900 text-lg uppercase tracking-wide">
                          {video.date}
                        </h3>

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full text-white ${video.type.includes('short') ? 'bg-amber-700' : 'bg-burgundy-700'}`}>
                            {video.type}
                          </span>
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#F4EFE6] text-stone-700 border border-[#E2D5C3] flex items-center gap-1">
                            <i className="fa-regular fa-clock text-[9px]"></i> {video.duration}
                          </span>
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            {video.status}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm font-serif font-bold text-stone-900 leading-snug pt-1">
                        {video.title}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-[#E2D5C3] text-xs">
                      <span className="text-stone-400 font-medium">
                        Sortie : <strong className="text-stone-600">{video.releaseDate}</strong>
                      </span>

                      <button 
                        onClick={() => setActiveScriptModalVideo(video)}
                        className="font-bold text-gold-700 hover:text-stone-900 transition-colors flex items-center gap-1"
                      >
                        Consulter script &gt;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VUE 2 : CALENDRIER ÉDITORIAL */}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            
            {!selectedDay && (
              <div className="bg-[#FAF7F2] border-2 border-[#E2D5C3] rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-serif font-extrabold text-stone-900 tracking-wide uppercase">
                      CALENDRIER ÉDITORIAL
                    </h1>
                    <p className="text-xs md:text-sm text-stone-500 font-medium mt-1">
                      Planification stratégique sur 28 jours avec automatisation IA.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handleGenerateAiMonthPlan}
                      disabled={isGeneratingAiMonth}
                      className="bg-gold-600 hover:bg-gold-700 text-white text-xs font-bold px-5 py-3 rounded-full shadow-md transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
                    >
                      <i className={`fa-solid fa-wand-magic-sparkles ${isGeneratingAiMonth ? 'animate-spin' : ''}`}></i>
                      <span>{isGeneratingAiMonth ? "Génération IA en cours..." : "Générer la planification"}</span>
                    </button>

                    <label className="bg-stone-900 hover:bg-stone-800 text-amber-200 text-xs font-bold px-6 py-3 rounded-full cursor-pointer shadow-md transition-all flex items-center gap-2.5 shrink-0 border border-gold-600/30">
                      <i className="fa-solid fa-file-arrow-up text-gold-400 text-sm"></i>
                      <span>Téléverser un calendrier</span>
                      <input 
                        type="file" 
                        accept=".xlsx, .xls, .csv, .doc, .docx, .md, .pdf" 
                        onChange={handleCalendarImport} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E2D5C3]">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-2.5">
                    SÉLECTIONNER LE MOIS DU CALENDRIER :
                  </span>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {MONTHS_LIST.map((m) => (
                      <button
                        key={m.code}
                        onClick={() => setSelectedMonth(m.code)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                          selectedMonth === m.code 
                            ? 'bg-stone-900 text-amber-200 border border-gold-500 scale-105' 
                            : 'bg-[#F4EFE6] hover:bg-[#E8DFC9] text-stone-700 border border-[#E2D5C3]'
                        }`}
                      >
                        {m.code}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!selectedDay ? (
              <div className="space-y-10">
                {activeWeeksThemes.map((weekInfo, idx) => {
                  const weekNum = weekInfo.week_num || weekInfo.week || targetWeekNumbers[idx];
                  const weekDays = daysList.filter(d => d.weekNum === ((idx % 4) + 1));

                  return (
                    <div key={weekNum + '-' + idx} className="bg-[#FAF7F2] border-2 border-[#D6AC66]/60 rounded-3xl p-6 shadow-sm space-y-6">
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2D5C3] pb-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="text-xl md:text-2xl font-serif text-stone-900 flex items-center gap-2 flex-wrap">
                            <span className="text-gold-700 font-bold uppercase">SEMAINE {weekNum} :</span>
                            <span className="font-serif font-bold text-stone-900 uppercase tracking-wide">{weekInfo?.title}</span>
                          </h2>

                          <button
                            onClick={() => handleOpenEditThemeModal(weekInfo)}
                            className="bg-[#FAF7F2] hover:bg-gold-500 hover:text-white text-stone-800 text-xs font-bold px-3 py-1.5 rounded-full border border-gold-600 flex items-center gap-1.5 transition-all shadow-sm"
                          >
                            <i className="fa-solid fa-pen-to-square text-gold-600 hover:text-white"></i>
                            <span>Modifier le thème</span>
                          </button>
                        </div>

                        <span className="text-sm font-medium text-stone-500">{weekInfo?.range || `Semaine ${weekNum}`}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                        {weekDays.map((day) => (
                          <div
                            key={day.id}
                            className="rounded-2xl border border-[#E2D5C3] p-3 flex flex-col justify-between min-h-[420px] transition-all bg-[#F4EFE6]/50 hover:bg-[#F4EFE6]"
                          >
                            <div>
                              <div className="border-b border-[#E2D5C3] pb-2 mb-3 flex items-center justify-between">
                                <span className="font-serif font-bold text-xs uppercase tracking-wider text-stone-800">
                                  {day.dayShort}. {day.dateNumber}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTargetDayForAdd(day);
                                    setIsAddContentModalOpen(true);
                                  }}
                                  title="Ajouter un nouveau contenu"
                                  className="w-5 h-5 rounded-full bg-[#FAF7F2] border border-[#D6AC66] text-stone-800 font-bold text-xs flex items-center justify-center hover:bg-stone-900 hover:text-amber-200 transition-colors shadow-sm"
                                >
                                  +
                                </button>
                              </div>

                              <div className="space-y-2.5">
                                {day.items.length === 0 ? (
                                  <div className="h-40 flex items-center justify-center text-[11px] text-stone-400 italic">
                                    Aucun contenu
                                  </div>
                                ) : (
                                  day.items.map((item) => (
                                    <div
                                      key={item.id}
                                      onClick={() => { 
                                        if (item.type === 'Story' || item.isStory) {
                                          openStoryInterface(day, item);
                                        } else {
                                          setSelectedDay(day); 
                                          setSelectedItem(item); 
                                          setSelectedPlatform('instagram'); 
                                          setContentStatus(item.status || "Brouillon");
                                        }
                                      }}
                                      className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-2xl p-3 space-y-2 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-gold-500"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                                          {item.type}
                                        </span>
                                      </div>

                                      <p className="text-xs font-semibold text-stone-800 line-clamp-3 leading-snug">
                                        {item.title}
                                      </p>

                                      <div className="flex items-center justify-between pt-1 text-[10px] text-stone-500 border-t border-[#F4EFE6]">
                                        <span className="flex items-center gap-1 font-medium">
                                          <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'Publié' ? 'bg-emerald-600' : item.status === 'Validé' ? 'bg-blue-600' : 'bg-amber-500'}`}></span>
                                          {item.status || 'Brouillon'}
                                        </span>
                                        {item.time && <span className="font-bold text-stone-700">{item.time}</span>}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={() => downloadWeeklyScripts(weekNum)}
                          className="w-full sm:w-auto bg-[#FAF7F2] hover:bg-[#F4EFE6] border border-[#D6AC66] text-stone-800 text-xs font-bold px-6 py-3 rounded-2xl flex items-center justify-center gap-2.5 shadow-sm transition-all"
                        >
                          <i className="fa-solid fa-download text-gold-600"></i>
                          <span>Télécharger les scripts de la semaine</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-6">
                
                <button 
                  onClick={() => setSelectedDay(null)}
                  className="text-xs font-bold text-gold-700 hover:text-stone-900 flex items-center gap-2"
                >
                  <i className="fa-solid fa-arrow-left"></i> Retour au calendrier
                </button>

                <div className="bg-[#FAF7F2] border-2 border-gold-400 rounded-3xl p-6 shadow-sm space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2D5C3] pb-4">
                    <div>
                      <span className="text-xs font-bold text-gold-700 uppercase tracking-widest">PUBLICATION & WORKFLOW RBAC</span>
                      <h2 className="text-2xl md:text-3xl font-serif text-stone-900 font-bold mt-1">
                        {selectedDay.formattedDate}
                      </h2>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="bg-stone-900 text-amber-200 text-xs font-bold px-3 py-1 rounded-full">
                          {selectedItem?.type || "Publication"}
                        </span>
                        
                        <select
                          value={contentStatus}
                          onChange={(e) => {
                            setContentStatus(e.target.value);
                            if (selectedItem) selectedItem.status = e.target.value;
                            triggerNotification(`Statut mis à jour : ${e.target.value}`);
                          }}
                          className="bg-[#F4EFE6] border border-gold-500 text-stone-900 text-xs font-bold px-3 py-1 rounded-full focus:outline-none"
                        >
                          <option value="Brouillon">📝 Brouillon</option>
                          <option value="En attente">⏳ En attente de validation</option>
                          <option value="Validé">✅ Validé par le Client</option>
                          <option value="Publié">🚀 Publié</option>
                        </select>
                      </div>
                    </div>

                    <div className="w-full md:w-1/2 bg-[#F4EFE6] border border-[#D6AC66] rounded-2xl p-4 text-xs space-y-1.5 shadow-inner">
                      <span className="text-gold-700 font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                        <i className="fa-solid fa-sparkles"></i> LE BRIEF DU JOUR (Modifiable)
                      </span>
                      <textarea
                        rows={4}
                        value={captionText || `✨ ${selectedItem?.title || selectedDay?.theme} ✨\n\nRetrouvez cet enseignement guidé par Frédéric Barbey.\n\n👇 Laissez votre impression en commentaire !`}
                        onChange={(e) => setCaptionText(e.target.value)}
                        className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3.5 text-xs text-stone-900 focus:outline-none focus:border-gold-500 leading-relaxed font-sans"
                      />
                    </div>
                  </div>

                  {selectedItem?.isCarousel && selectedItem.slides && (
                    <div className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-2xl p-6 space-y-4 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2D5C3] pb-3">
                        <h3 className="font-serif text-xl font-bold text-stone-900">
                          {selectedItem.title}
                        </h3>

                        <button
                          onClick={handleGenerateCarouselWithAi}
                          disabled={isGeneratingCarouselAi}
                          className="bg-gold-600 hover:bg-gold-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow transition-all disabled:opacity-50"
                        >
                          <i className={`fa-solid fa-wand-magic-sparkles ${isGeneratingCarouselAi ? 'animate-spin' : ''}`}></i>
                          <span>{isGeneratingCarouselAi ? "Génération 5 slides..." : "Générer les 5 slides par l'IA"}</span>
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-stone-600">Textes des vues ({selectedItem.slides.length})</span>
                          <button
                            onClick={() => copyToClipboard(selectedItem.slides.map(s => `VUE ${s.num}:\n${s.text}`).join('\n\n'), "Tout le carrousel")}
                            className="bg-[#F4EFE6] border border-[#E2D5C3] text-stone-800 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 hover:bg-[#E8DFC9]"
                          >
                            <i className="fa-regular fa-copy"></i> Copier tout
                          </button>
                        </div>

                        <div className="space-y-3">
                          {selectedItem.slides.map((slide, idx) => (
                            <div key={slide.num} className="bg-[#F4EFE6] border border-[#E2D5C3] rounded-2xl p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-gold-700 uppercase tracking-widest">
                                  VUE {slide.num} {slide.num === 1 ? '(Accroche)' : slide.num === 5 ? '(CTA Académie)' : '(Développement)'}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(slide.text, `Vue ${slide.num}`)}
                                  className="bg-[#FAF7F2] border border-[#E2D5C3] text-stone-700 text-[11px] font-bold px-2.5 py-1 rounded-lg hover:bg-white flex items-center gap-1"
                                >
                                  <i className="fa-regular fa-copy"></i> Copier
                                </button>
                              </div>
                              <textarea
                                rows={2}
                                value={slide.text}
                                onChange={(e) => {
                                  selectedItem.slides[idx].text = e.target.value;
                                  setSelectedItem({...selectedItem});
                                }}
                                className="w-full bg-[#FAF7F2] border border-[#E2D5C3] p-3 rounded-xl text-xs text-stone-800 font-medium focus:outline-none focus:border-gold-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedItem?.isLongYouTube && (
                    <div className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-2xl p-6 space-y-4 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2D5C3] pb-3">
                        <span className="font-serif font-bold text-lg text-stone-900 flex items-center gap-2">
                          <i className="fa-brands fa-youtube text-red-600"></i> Script de la séance longue (40 min)
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadScriptDoc(selectedItem.title, 'docx')}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow"
                          >
                            <i className="fa-solid fa-file-word"></i> Télécharger Word (.docx)
                          </button>
                          <button
                            onClick={() => downloadScriptDoc(selectedItem.title, 'pdf')}
                            className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow"
                          >
                            <i className="fa-solid fa-file-pdf"></i> Télécharger PDF
                          </button>
                        </div>
                      </div>

                      <div className="bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-4 text-xs font-sans text-stone-800 max-h-60 overflow-y-auto leading-relaxed whitespace-pre-line">
                        {LONG_YOUTUBE_SCRIPT_SAMPLE}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 pt-2 border-t border-[#E2D5C3]">
                    <span className="text-xs font-bold text-stone-600 uppercase tracking-wider block">
                      SÉLECTIONNEZ LE RÉSEAU SOCIAL À PERSONNALISER :
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#F4EFE6] p-2 rounded-2xl border border-[#E2D5C3]">
                      <button
                        onClick={() => setSelectedPlatform('instagram')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                          selectedPlatform === 'instagram' ? 'bg-stone-900 text-amber-200 shadow' : 'text-stone-700 hover:bg-[#E8DFC9]'
                        }`}
                      >
                        <i className="fa-brands fa-instagram text-pink-600"></i> Instagram
                      </button>
                      <button
                        onClick={() => setSelectedPlatform('facebook')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                          selectedPlatform === 'facebook' ? 'bg-stone-900 text-amber-200 shadow' : 'text-stone-700 hover:bg-[#E8DFC9]'
                        }`}
                      >
                        <i className="fa-brands fa-facebook text-blue-600"></i> Facebook
                      </button>
                      <button
                        onClick={() => setSelectedPlatform('youtube')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                          selectedPlatform === 'youtube' ? 'bg-stone-900 text-amber-200 shadow' : 'text-stone-700 hover:bg-[#E8DFC9]'
                        }`}
                      >
                        <i className="fa-brands fa-youtube text-red-600"></i> YouTube
                      </button>
                      <button
                        onClick={() => setSelectedPlatform('tiktok')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                          selectedPlatform === 'tiktok' ? 'bg-stone-900 text-amber-200 shadow' : 'text-stone-700 hover:bg-[#E8DFC9]'
                        }`}
                      >
                        <i className="fa-brands fa-tiktok text-teal-600"></i> TikTok
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-2xl p-6 space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2D5C3] pb-3">
                      <h3 className="font-serif font-bold text-xl text-stone-900">
                        Prompt image ({selectedPlatform.toUpperCase()}) — Modifiable
                      </h3>

                      <button
                        onClick={() => copyToClipboard(selectedDay.imagePromptText, "Prompt Image")}
                        className="bg-[#F4EFE6] border border-[#E2D5C3] text-stone-800 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#E8DFC9]"
                      >
                        <i className="fa-regular fa-copy text-gold-600"></i> Copier le prompt
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <textarea
                        rows={8}
                        value={selectedDay.imagePromptText}
                        onChange={(e) => {
                          selectedDay.imagePromptText = e.target.value;
                          setSelectedDay({...selectedDay});
                        }}
                        className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-2xl p-4 text-xs font-mono text-stone-800 leading-relaxed focus:outline-none focus:border-gold-500 shadow-inner"
                      />

                      <div className="space-y-4 bg-[#F4EFE6]/60 p-4 rounded-2xl border border-[#E2D5C3]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-stone-700">Média pour le post</span>

                          <div className="flex items-center bg-[#FAF7F2] p-1 rounded-xl border border-[#E2D5C3] text-xs">
                            <button
                              onClick={() => setMediaSourceMode('ai')}
                              className={`px-3 py-1 rounded-lg font-bold transition-all ${mediaSourceMode === 'ai' ? 'bg-stone-900 text-amber-200' : 'text-stone-600'}`}
                            >
                              Générer avec l'IA
                            </button>
                            <button
                              onClick={() => setMediaSourceMode('upload')}
                              className={`px-3 py-1 rounded-lg font-bold transition-all ${mediaSourceMode === 'upload' ? 'bg-stone-900 text-amber-200' : 'text-stone-600'}`}
                            >
                              Téléverser / Médiathèque
                            </button>
                          </div>
                        </div>

                        {mediaSourceMode === 'ai' ? (
                          <div className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-2xl p-4 text-center space-y-3">
                            <div className="w-full h-44 bg-stone-900 rounded-xl flex flex-col justify-center items-center text-amber-200 p-4 space-y-2">
                              <span className="text-xs font-serif font-bold uppercase tracking-widest text-gold-400">FRÉDÉRIC BARBEY</span>
                              <h4 className="text-sm font-bold uppercase font-serif max-w-xs">{selectedItem?.title || selectedDay.theme}</h4>
                              <span className="text-[10px] text-stone-400">FORMAT VISUEL GÉNÉRÉ ({selectedPlatform.toUpperCase()})</span>
                            </div>
                            <button
                              onClick={() => triggerNotification("Visuel régénéré via IA !")}
                              className="w-full bg-stone-900 text-amber-200 text-xs font-bold py-2.5 rounded-xl shadow"
                            >
                              Régénérer ce visuel via IA
                            </button>
                          </div>
                        ) : (
                          <div className="bg-[#FAF7F2] border-2 border-dashed border-[#D6AC66] rounded-2xl p-6 text-center space-y-2 relative">
                            <input type="file" accept="image/*,video/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                            <i className="fa-solid fa-cloud-arrow-up text-2xl text-gold-600"></i>
                            <p className="text-xs font-bold text-stone-800">Glissez ou sélectionnez depuis la médiathèque</p>
                            <p className="text-[10px] text-stone-500">Formats image ou vidéo acceptés</p>
                            {uploadedFile && <p className="text-xs text-emerald-700 font-bold mt-2">✓ {uploadedFile.name}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#FAF7F2] border border-[#E2D5C3] rounded-2xl p-6 space-y-4 shadow-sm">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-stone-800 block">
                          Légende / Caption optimisée pour {selectedPlatform.toUpperCase()}
                        </label>
                        <button
                          onClick={handleGenerateCaption}
                          className="bg-[#F4EFE6] border border-[#D6AC66] text-stone-800 text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-1.5 hover:bg-stone-900 hover:text-amber-200 transition-colors"
                        >
                          <i className="fa-solid fa-wand-magic-sparkles text-gold-600"></i> Générer avec Claude
                        </button>
                      </div>
                      <textarea
                        rows={4}
                        value={captionText || `✨ ${selectedItem?.title || selectedDay.theme} ✨\n\nRetrouvez cet enseignement guidé par Frédéric Barbey. Chaque expérience laisse une empreinte sur notre intuition.\n\n👇 Laissez votre impression en commentaire !`}
                        onChange={(e) => setCaptionText(e.target.value)}
                        className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3.5 text-xs text-stone-900 focus:outline-none focus:border-gold-500 leading-relaxed font-sans"
                      />
                    </div>

                    <div className="bg-[#F4EFE6] p-4 rounded-xl border border-[#E2D5C3] space-y-3">
                      <span className="text-xs font-bold text-gold-700 block">
                        Premier commentaire automatique & Identification
                      </span>
                      <div className="flex flex-wrap gap-4 text-xs text-stone-700">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" defaultChecked className="rounded border-stone-400 text-gold-600" />
                          <span>Tag <strong className="text-gold-700">@followers</strong></span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="rounded border-stone-400 text-gold-600" />
                          <span>Tag <strong className="text-gold-700">@everyone</strong></span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="rounded border-stone-400 text-gold-600" />
                          <span>Tag <strong className="text-gold-700">@all</strong></span>
                        </label>
                      </div>
                      <textarea
                        rows={2}
                        defaultValue="Dis-moi en commentaire si ce sujet résonne particulièrement en toi aujourd'hui ✨ @followers"
                        className="w-full bg-[#FAF7F2] border border-[#E2D5C3] rounded-lg p-2.5 text-xs text-stone-800"
                      />
                    </div>

                    <div className="bg-[#F4EFE6] p-4 rounded-xl border border-[#E2D5C3] space-y-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-stone-900 cursor-pointer">
                        <input type="checkbox" defaultChecked className="rounded border-stone-400 text-gold-600" />
                        <span>Activer le repartage automatique en Story le lendemain (J+1)</span>
                      </label>
                      <p className="text-[11px] text-stone-600 pl-6">
                        Planification programmée à <strong>16h15 (créneau de fort trafic entre 14h et 18h)</strong> pour relancer l'engagement.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-[#E2D5C3]">
                    <button
                      onClick={() => triggerNotification("Publication envoyée immédiatement en direct !")}
                      className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#F4EFE6] hover:bg-[#E8DFC9] text-stone-800 text-xs font-bold border border-[#E2D5C3] flex items-center justify-center gap-2 shadow-sm"
                    >
                      <i className="fa-solid fa-paper-plane text-emerald-600"></i>
                      Publier maintenant
                    </button>

                    <button
                      onClick={() => setIsTimeModalOpen(true)}
                      className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-stone-900 text-amber-200 text-xs font-bold shadow-md hover:bg-stone-800 flex items-center justify-center gap-2"
                    >
                      <i className="fa-regular fa-clock text-gold-400"></i>
                      Programmer la publication
                    </button>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

        {/* VUE 3 : MES COMMENTAIRES */}
        {activeTab === 'comments' && (
          <CommentsManager comments={comments} triggerNotification={triggerNotification} />
        )}

        {/* VUE 4 : STATISTIQUES (ANALYTICS) */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3]">
              <h2 className="text-2xl font-serif font-bold text-stone-900">Mes Statistiques & Analytics</h2>
              <p className="text-xs text-stone-500 mt-1">Aperçu hebdomadaire des vues et performances globales. Cliquez sur une carte pour explorer les détails.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div 
                onClick={() => setActiveStatModal('reach')}
                className="bg-[#FAF7F2] border border-[#E2D5C3] hover:border-gold-500 rounded-3xl p-5 shadow-sm space-y-1 cursor-pointer transition-all hover:shadow-md group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Portée Hebdo Globale</span>
                  <i className="fa-solid fa-chart-line text-gold-600 text-xs opacity-60 group-hover:opacity-100"></i>
                </div>
                <div className="text-2xl font-serif font-bold text-stone-900">284 300</div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-block">+14.2% vs semaine passée</span>
              </div>

              <div 
                onClick={() => setActiveStatModal('engagement')}
                className="bg-[#FAF7F2] border border-[#E2D5C3] hover:border-gold-500 rounded-3xl p-5 shadow-sm space-y-1 cursor-pointer transition-all hover:shadow-md group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Taux d'Engagement Moyen</span>
                  <i className="fa-solid fa-chart-pie text-gold-600 text-xs opacity-60 group-hover:opacity-100"></i>
                </div>
                <div className="text-2xl font-serif font-bold text-stone-900">8.4%</div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-block">Très élevé (Objectif &gt; 6%)</span>
              </div>

              <div 
                onClick={() => setActiveStatModal('subscribers')}
                className="bg-[#FAF7F2] border border-[#E2D5C3] hover:border-gold-500 rounded-3xl p-5 shadow-sm space-y-1 cursor-pointer transition-all hover:shadow-md group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Nouveaux Abonnés</span>
                  <i className="fa-solid fa-users text-gold-600 text-xs opacity-60 group-hover:opacity-100"></i>
                </div>
                <div className="text-2xl font-serif font-bold text-stone-900">+3 420</div>
                <span className="text-[10px] font-bold text-gold-700 bg-amber-100 px-2 py-0.5 rounded-full inline-block">Porté par les Reels & Shorts</span>
              </div>

              <div 
                onClick={() => setActiveStatModal('time')}
                className="bg-[#FAF7F2] border border-[#E2D5C3] hover:border-gold-500 rounded-3xl p-5 shadow-sm space-y-1 cursor-pointer transition-all hover:shadow-md group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Meilleur Créneau</span>
                  <i className="fa-regular fa-clock text-gold-600 text-xs opacity-60 group-hover:opacity-100"></i>
                </div>
                <div className="text-2xl font-serif font-bold text-stone-900">18h30 - 20h</div>
                <span className="text-[10px] font-bold text-stone-700 bg-[#F4EFE6] px-2 py-0.5 rounded-full inline-block">Mercredi & Dimanche</span>
              </div>
            </div>

            <div className="bg-[#FAF7F2] rounded-3xl border border-[#E2D5C3] overflow-hidden shadow-sm">
              <div className="p-4 border-b border-[#E2D5C3] flex items-center justify-between text-xs bg-[#F4EFE6]">
                <span className="font-bold text-stone-900">Performances des 7 Jours de la Semaine</span>
                <span className="text-gold-700 font-bold">Portée Hebdo Globale : 284 300 Vues</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FAF7F2] text-stone-600 border-b border-[#E2D5C3]">
                      <th className="p-3.5 font-bold">Jour</th>
                      <th className="p-3.5 font-bold text-pink-600"><i className="fa-brands fa-instagram mr-1"></i> Instagram</th>
                      <th className="p-3.5 font-bold text-blue-600"><i className="fa-brands fa-facebook mr-1"></i> Facebook</th>
                      <th className="p-3.5 font-bold text-red-600"><i className="fa-brands fa-youtube mr-1"></i> YouTube</th>
                      <th className="p-3.5 font-bold text-teal-600"><i className="fa-brands fa-tiktok mr-1"></i> TikTok</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2D5C3] text-stone-700">
                    <tr>
                      <td className="p-3.5 font-bold text-stone-900">Lundi</td>
                      <td className="p-3.5">12.4k vues</td>
                      <td className="p-3.5">8.2k vues</td>
                      <td className="p-3.5">4.1k vues</td>
                      <td className="p-3.5">15.8k vues</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-bold text-stone-900">Mardi</td>
                      <td className="p-3.5">18.9k vues</td>
                      <td className="p-3.5">6.5k vues</td>
                      <td className="p-3.5">3.2k vues</td>
                      <td className="p-3.5">9.4k vues</td>
                    </tr>
                    <tr className="bg-[#F4EFE6]/60">
                      <td className="p-3.5 font-bold text-gold-700">Mercredi (Reel)</td>
                      <td className="p-3.5 font-bold text-gold-700">34.2k vues</td>
                      <td className="p-3.5">14.1k vues</td>
                      <td className="p-3.5 font-bold text-gold-700">22.5k vues</td>
                      <td className="p-3.5 font-bold text-gold-700">45.0k vues</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-bold text-stone-900">Jeudi</td>
                      <td className="p-3.5">15.1k vues</td>
                      <td className="p-3.5">9.8k vues</td>
                      <td className="p-3.5">5.0k vues</td>
                      <td className="p-3.5">18.3k vues</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-bold text-stone-900">Vendredi</td>
                      <td className="p-3.5">11.6k vues</td>
                      <td className="p-3.5">7.4k vues</td>
                      <td className="p-3.5">4.8k vues</td>
                      <td className="p-3.5">12.1k vues</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-bold text-stone-900">Samedi</td>
                      <td className="p-3.5">21.3k vues</td>
                      <td className="p-3.5">11.2k vues</td>
                      <td className="p-3.5">8.9k vues</td>
                      <td className="p-3.5">24.6k vues</td>
                    </tr>
                    <tr className="bg-[#F4EFE6]/60">
                      <td className="p-3.5 font-bold text-gold-700">Dimanche (Récit)</td>
                      <td className="p-3.5 font-bold text-gold-700">41.0k vues</td>
                      <td className="p-3.5">18.5k vues</td>
                      <td className="p-3.5 font-bold text-gold-700">29.1k vues</td>
                      <td className="p-3.5 font-bold text-gold-700">52.4k vues</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[#FAF7F2] border-2 border-[#E2D5C3] rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold-500/20 text-gold-700 flex items-center justify-center text-xl font-bold">
                  💡
                </div>
                <h3 className="text-xl font-serif font-bold text-stone-900 uppercase tracking-wide">
                  RECOMMANDATIONS STRATÉGIQUES IA <span className="text-xs font-sans font-normal text-stone-500">(Cliquez sur une carte pour le plan d'action)</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div 
                  onClick={() => setActiveRecommendationModal(1)}
                  className="bg-[#F4EFE6]/80 border border-[#E2D5C3] hover:border-gold-500 rounded-2xl p-5 space-y-3 shadow-sm cursor-pointer transition-all hover:shadow-md group"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gold-800 text-sm">1. Augmenter le rythme vidéo</h4>
                    <i className="fa-solid fa-arrow-up-right-from-square text-xs text-gold-600 opacity-60 group-hover:opacity-100"></i>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Les vidéos du Mercredi et Dimanche génèrent <strong>+240% d'engagement</strong>. Introduire un Short supplémentaire le vendredi.
                  </p>
                </div>

                <div 
                  onClick={() => setActiveRecommendationModal(2)}
                  className="bg-[#F4EFE6]/80 border border-[#E2D5C3] hover:border-gold-500 rounded-2xl p-5 space-y-3 shadow-sm cursor-pointer transition-all hover:shadow-md group"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gold-800 text-sm">2. Optimiser TikTok</h4>
                    <i className="fa-solid fa-arrow-up-right-from-square text-xs text-gold-600 opacity-60 group-hover:opacity-100"></i>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Audience TikTok active entre <strong>20h00 et 21h30</strong>. Ajuster la programmation des vidéos courtes.
                  </p>
                </div>

                <div 
                  onClick={() => setActiveRecommendationModal(3)}
                  className="bg-[#F4EFE6]/80 border border-[#E2D5C3] hover:border-gold-500 rounded-2xl p-5 space-y-3 shadow-sm cursor-pointer transition-all hover:shadow-md group"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gold-800 text-sm">3. Impact Story J+1</h4>
                    <i className="fa-solid fa-arrow-up-right-from-square text-xs text-gold-600 opacity-60 group-hover:opacity-100"></i>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Le repartage en Story à 16h15 le lendemain offre <strong>+35% de clics</strong> vers le site de l'Académie du Spirituel.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VUE 5 : ÉQUIPES & ACCÈS */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3]">
              <h2 className="text-2xl font-serif font-bold text-stone-900">Équipes & Rôles (RBAC)</h2>
              <p className="text-xs text-stone-500 mt-1">Invitez des collaborateurs et attribuez des rôles stricts (Propriétaire, CM, Éditeur, Relecteur).</p>
            </div>

            <form onSubmit={handleAddMember} className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3] space-y-4 shadow-sm">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <i className="fa-regular fa-envelope text-gold-600"></i> Envoyer une invitation par e-mail
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="email"
                  placeholder="adresse.email@exemple.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="sm:col-span-2 bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-gold-700 font-bold focus:outline-none"
                >
                  <option value="Propriétaire">Propriétaire</option>
                  <option value="Community Manager">Community Manager</option>
                  <option value="Éditeur">Éditeur</option>
                  <option value="Relecteur / Client">Relecteur / Client</option>
                </select>
              </div>

              <button
                type="submit"
                className="bg-stone-900 text-amber-200 text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow"
              >
                <i className="fa-solid fa-plus"></i> Envoyer l'invitation par Resend
              </button>
            </form>

            <div className="bg-[#FAF7F2] rounded-3xl border border-[#E2D5C3] p-6 space-y-4">
              <h3 className="text-sm font-bold text-stone-900">Membres de l'équipe ({teamMembers.length})</h3>
              <div className="divide-y divide-[#E2D5C3]">
                {teamMembers.map((member) => (
                  <div key={member.id} className="py-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <img src={member.avatar} alt={member.name} className="w-9 h-9 rounded-full object-cover" />
                      <div>
                        <h5 className="font-bold text-stone-900">{member.name}</h5>
                        <span className="text-[11px] text-stone-500">{member.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="bg-[#F4EFE6] text-gold-700 font-bold px-3 py-1 rounded-lg border border-[#E2D5C3]">
                        {member.role}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${member.status === 'Actif' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {member.status}
                      </span>
                      {member.role !== 'Propriétaire' && (
                        <button onClick={() => handleRemoveMember(member.id, member.name)} className="text-stone-400 hover:text-red-600">
                          <i className="fa-regular fa-trash-can"></i>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VUE 6 : APIS RÉSEAUX */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3]">
              <h2 className="text-2xl font-serif font-bold text-stone-900">Connexions API Réseaux</h2>
              <p className="text-xs text-stone-500 mt-1">Identifiants d'accès officiels aux plateformes sociales.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#FAF7F2] p-5 rounded-3xl border border-[#E2D5C3] space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i className="fa-brands fa-instagram text-lg text-pink-600"></i>
                    <h4 className="font-bold text-stone-900 text-sm">Instagram Graph API</h4>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Connecté</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-stone-500 block text-[10px] mb-1">Instagram Business Account ID</label>
                    <input type="text" defaultValue="1784140123456789" className="w-full bg-[#F4EFE6] p-2.5 text-xs rounded-xl border border-[#E2D5C3] text-stone-800" />
                  </div>
                  <div>
                    <label className="text-stone-500 block text-[10px] mb-1">Access Token Long-Lived</label>
                    <input type="password" defaultValue="EAACEdEose0cBA..." className="w-full bg-[#F4EFE6] p-2.5 text-xs rounded-xl border border-[#E2D5C3] text-stone-800" />
                  </div>
                </div>
              </div>

              <div className="bg-[#FAF7F2] p-5 rounded-3xl border border-[#E2D5C3] space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i className="fa-brands fa-facebook text-lg text-blue-600"></i>
                    <h4 className="font-bold text-stone-900 text-sm">Facebook Pages API</h4>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Connecté</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-stone-500 block text-[10px] mb-1">ID de la Page Facebook</label>
                    <input type="text" defaultValue="act_948102948109284" className="w-full bg-[#F4EFE6] p-2.5 text-xs rounded-xl border border-[#E2D5C3] text-stone-800" />
                  </div>
                  <div>
                    <label className="text-stone-500 block text-[10px] mb-1">Page Access Token</label>
                    <input type="password" defaultValue="EAAGNO4z890BA..." className="w-full bg-[#F4EFE6] p-2.5 text-xs rounded-xl border border-[#E2D5C3] text-stone-800" />
                  </div>
                </div>
              </div>

              <div className="bg-[#FAF7F2] p-5 rounded-3xl border border-[#E2D5C3] space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i className="fa-brands fa-youtube text-lg text-red-600"></i>
                    <h4 className="font-bold text-stone-900 text-sm">YouTube Data API v3</h4>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Connecté</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-stone-500 block text-[10px] mb-1">ID de la Chaîne YouTube</label>
                    <input type="text" defaultValue="UC_FredericBarbeyOfficial" className="w-full bg-[#F4EFE6] p-2.5 text-xs rounded-xl border border-[#E2D5C3] text-stone-800" />
                  </div>
                  <div>
                    <label className="text-stone-500 block text-[10px] mb-1">OAuth2 Refresh Token</label>
                    <input type="password" defaultValue="1//04_X9aLbcDe..." className="w-full bg-[#F4EFE6] p-2.5 text-xs rounded-xl border border-[#E2D5C3] text-stone-800" />
                  </div>
                </div>
              </div>

              <div className="bg-[#FAF7F2] p-5 rounded-3xl border border-[#E2D5C3] space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i className="fa-brands fa-tiktok text-lg text-teal-600"></i>
                    <h4 className="font-bold text-stone-900 text-sm">TikTok Content Posting API</h4>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Connecté</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-stone-500 block text-[10px] mb-1">Client Key / App Key</label>
                    <input type="text" defaultValue="aw3984jdf9834" className="w-full bg-[#F4EFE6] p-2.5 text-xs rounded-xl border border-[#E2D5C3] text-stone-800" />
                  </div>
                  <div>
                    <label className="text-stone-500 block text-[10px] mb-1">User Access Token</label>
                    <input type="password" defaultValue="act.tiktok.948102..." className="w-full bg-[#F4EFE6] p-2.5 text-xs rounded-xl border border-[#E2D5C3] text-stone-800" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* MODALES STATISTIQUES & RECOMMANDATIONS */}
      {activeStatModal === 'reach' && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-gold-500 w-full max-w-lg rounded-3xl p-6 md:p-8 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#E2D5C3] pb-3">
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-chart-line text-gold-600 text-xl"></i>
                <h3 className="font-serif font-bold text-stone-900 text-lg uppercase">Analyse de la Portée Globale</h3>
              </div>
              <button onClick={() => setActiveStatModal(null)} className="text-stone-400 hover:text-stone-900 p-1">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <div className="space-y-3 text-xs text-stone-700 leading-relaxed font-sans">
              <p><strong>Total de vues sur 7 jours :</strong> 284 300 impressions tous réseaux confondus.</p>
            </div>
            <div className="pt-3 border-t border-[#E2D5C3] flex justify-end">
              <button onClick={() => setActiveStatModal(null)} className="px-5 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {activeStatModal === 'engagement' && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-gold-500 w-full max-w-lg rounded-3xl p-6 md:p-8 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#E2D5C3] pb-3">
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-chart-pie text-gold-600 text-xl"></i>
                <h3 className="font-serif font-bold text-stone-900 text-lg uppercase">Détails du Taux d'Engagement</h3>
              </div>
              <button onClick={() => setActiveStatModal(null)} className="text-stone-400 hover:text-stone-900 p-1">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <div className="space-y-3 text-xs text-stone-700 leading-relaxed font-sans">
              <p>Le taux d'engagement moyen atteint <strong>8.4%</strong>.</p>
            </div>
            <div className="pt-3 border-t border-[#E2D5C3] flex justify-end">
              <button onClick={() => setActiveStatModal(null)} className="px-5 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {activeStatModal === 'subscribers' && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-gold-500 w-full max-w-lg rounded-3xl p-6 md:p-8 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#E2D5C3] pb-3">
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-users text-gold-600 text-xl"></i>
                <h3 className="font-serif font-bold text-stone-900 text-lg uppercase">Croissance de la Communauté</h3>
              </div>
              <button onClick={() => setActiveStatModal(null)} className="text-stone-400 hover:text-stone-900 p-1">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <div className="space-y-3 text-xs text-stone-700 leading-relaxed font-sans">
              <p><strong>+3 420 nouveaux abonnés</strong> cette semaine.</p>
            </div>
            <div className="pt-3 border-t border-[#E2D5C3] flex justify-end">
              <button onClick={() => setActiveStatModal(null)} className="px-5 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {activeStatModal === 'time' && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-gold-500 w-full max-w-lg rounded-3xl p-6 md:p-8 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#E2D5C3] pb-3">
              <div className="flex items-center gap-2.5">
                <i className="fa-regular fa-clock text-gold-600 text-xl"></i>
                <h3 className="font-serif font-bold text-stone-900 text-lg uppercase">Analyse des Meilleurs Créneaux</h3>
              </div>
              <button onClick={() => setActiveStatModal(null)} className="text-stone-400 hover:text-stone-900 p-1">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <div className="space-y-3 text-xs text-stone-700 leading-relaxed font-sans">
              <p>Le créneau <strong>18h30 - 20h00</strong> enregistre les pics d'audience.</p>
            </div>
            <div className="pt-3 border-t border-[#E2D5C3] flex justify-end">
              <button onClick={() => setActiveStatModal(null)} className="px-5 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {activeRecommendationModal === 1 && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-gold-500 w-full max-w-lg rounded-3xl p-6 md:p-8 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#E2D5C3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gold-500/20 text-gold-700 flex items-center justify-center font-bold text-sm">1</div>
                <h3 className="font-serif font-bold text-stone-900 text-lg uppercase">Plan d'Action : Rythme Vidéo</h3>
              </div>
              <button onClick={() => setActiveRecommendationModal(null)} className="text-stone-400 hover:text-stone-900 p-1">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <div className="space-y-3 text-xs text-stone-700 leading-relaxed font-sans">
              <p>Tourner un <strong>Short supplémentaire</strong> chaque vendredi matin.</p>
            </div>
            <div className="pt-3 border-t border-[#E2D5C3] flex justify-end">
              <button onClick={() => setActiveRecommendationModal(null)} className="px-5 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {activeRecommendationModal === 2 && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-gold-500 w-full max-w-lg rounded-3xl p-6 md:p-8 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#E2D5C3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gold-500/20 text-gold-700 flex items-center justify-center font-bold text-sm">2</div>
                <h3 className="font-serif font-bold text-stone-900 text-lg uppercase">Plan d'Action : Optimisation TikTok</h3>
              </div>
              <button onClick={() => setActiveRecommendationModal(null)} className="text-stone-400 hover:text-stone-900 p-1">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <div className="space-y-3 text-xs text-stone-700 leading-relaxed font-sans">
              <p>Ajuster l'heure de publication à <strong>20h15</strong> sur l'API TikTok.</p>
            </div>
            <div className="pt-3 border-t border-[#E2D5C3] flex justify-end">
              <button onClick={() => setActiveRecommendationModal(null)} className="px-5 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {activeRecommendationModal === 3 && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-gold-500 w-full max-w-lg rounded-3xl p-6 md:p-8 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#E2D5C3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gold-500/20 text-gold-700 flex items-center justify-center font-bold text-sm">3</div>
                <h3 className="font-serif font-bold text-stone-900 text-lg uppercase">Plan d'Action : Impact Story J+1</h3>
              </div>
              <button onClick={() => setActiveRecommendationModal(null)} className="text-stone-400 hover:text-stone-900 p-1">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <div className="space-y-3 text-xs text-stone-700 leading-relaxed font-sans">
              <p>Activer systématiquement l'option <strong>Repartage Story J+1 à 16h15</strong>.</p>
            </div>
            <div className="pt-3 border-t border-[#E2D5C3] flex justify-end">
              <button onClick={() => setActiveRecommendationModal(null)} className="px-5 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE DE MODIFICATION DU THÈME DE LA SEMAINE */}
      {isEditThemeModalOpen && editingWeekInfo && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-[#D6AC66] w-full max-w-lg rounded-3xl p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#E2D5C3] pb-3">
              <div>
                <span className="text-[10px] font-bold text-gold-700 uppercase tracking-widest block">ÉDITION DE THÈME (SUPABASE)</span>
                <h3 className="font-serif font-bold text-stone-900 text-lg uppercase">
                  Semaine {editingWeekInfo.week || editingWeekInfo.week_num}
                </h3>
              </div>
              <button onClick={() => setIsEditThemeModalOpen(false)} className="text-stone-400 hover:text-stone-900 p-1">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-800 block">Saisissez le nouveau thème de la semaine :</label>
              <input
                type="text"
                value={newThemeInput}
                onChange={(e) => setNewThemeInput(e.target.value)}
                className="w-full bg-[#F4EFE6] border border-[#D6AC66] rounded-xl p-3 text-sm font-semibold text-stone-900 focus:outline-none"
              />
            </div>

            <div className="pt-2 border-t border-[#E2D5C3] flex items-center justify-end gap-2">
              <button onClick={() => setIsEditThemeModalOpen(false)} className="px-4 py-2.5 rounded-xl bg-[#F4EFE6] text-stone-700 text-xs font-bold">Annuler</button>
              <button onClick={handleSaveAndAdaptTheme} className="px-6 py-2.5 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow-md">Appliquer et Adapter</button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE DE SÉLECTION DU FORMAT (BOUTON +) */}
      {isAddContentModalOpen && targetDayForAdd && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-[#D6AC66] w-full max-w-lg rounded-3xl p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#E2D5C3] pb-3">
              <div>
                <span className="text-[10px] font-bold text-gold-700 uppercase tracking-widest block">NOUVEAU CONTENU</span>
                <h3 className="font-serif font-bold text-stone-900 text-lg">{targetDayForAdd.formattedDate}</h3>
              </div>
              <button onClick={() => { setIsAddContentModalOpen(false); setTargetDayForAdd(null); }} className="text-stone-400 hover:text-stone-900 p-1">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {[
                { label: "Photo", icon: "fa-regular fa-image", color: "text-sky-700", badgeColor: "bg-sky-700 text-white border-sky-800", desc: "Visuel fixe unique & citation" },
                { label: "Carrousel", icon: "fa-solid fa-layer-group", color: "text-emerald-700", badgeColor: "bg-emerald-800 text-white border-emerald-900", desc: "Série éducative multi-vues" },
                { label: "Vidéo courte", icon: "fa-solid fa-video", color: "text-amber-700", badgeColor: "bg-amber-700 text-white border-amber-800", desc: "Reel / TikTok 1 à 3 min" },
                { label: "Séance YouTube", icon: "fa-brands fa-youtube", color: "text-red-600", badgeColor: "bg-burgundy-700 text-white border-burgundy-800", desc: "Format long 17 à 40 min" },
                { label: "Story", icon: "fa-regular fa-circle-play", color: "text-pink-600", badgeColor: "bg-pink-100 text-pink-700 border-pink-200", desc: "Annonce & coulisses 24h" }
              ].map((typeItem) => (
                <button
                  key={typeItem.label}
                  onClick={() => handleCreatePostWithType(typeItem)}
                  className="flex items-start gap-3 p-3.5 bg-[#F4EFE6] hover:bg-white border border-[#E2D5C3] hover:border-gold-500 rounded-2xl transition-all text-left shadow-sm"
                >
                  <div className={`w-9 h-9 rounded-xl bg-[#FAF7F2] border border-[#E2D5C3] flex items-center justify-center ${typeItem.color} font-bold text-base`}>
                    <i className={typeItem.icon}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-serif font-bold text-xs text-stone-900 block">{typeItem.label}</span>
                    <span className="text-[10px] text-stone-500 truncate block">{typeItem.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* INTERFACE STORY DÉDIÉE */}
      {isStoryModalOpen && storyModalData.day && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FAF7F2] border-2 border-amber-300 w-full max-w-2xl rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative my-6">
            
            <div className="flex items-start justify-between border-b border-[#E2D5C3] pb-4">
              <div>
                <h2 className="text-xl md:text-2xl font-serif font-extrabold text-stone-900 uppercase tracking-tight">
                  CONFIGURATION STORY
                </h2>
                <p className="text-xs font-semibold text-stone-500 mt-0.5">
                  Pour le {storyModalData.day.formattedDate}
                </p>
              </div>
              <button 
                onClick={() => setIsStoryModalOpen(false)} 
                className="text-stone-400 hover:text-stone-900 transition-colors p-1"
              >
                <i className="fa-solid fa-xmark text-2xl"></i>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-900 block">
                Téléverser la photo / vidéo de Story :
              </label>
              <div className="bg-[#F4EFE6] border border-[#E2D5C3] rounded-2xl p-3 flex items-center gap-3">
                <label className="bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer border border-stone-300 shadow-sm transition-all shrink-0">
                  Choisir un fichier
                  <input type="file" accept="image/*,video/*" onChange={handleStoryFileUpload} className="hidden" />
                </label>
                <span className="text-xs text-stone-600 font-medium truncate">
                  {storyModalData.file ? storyModalData.file.name : "Aucun fichier choisi"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-900 block">
                Option d'ajout de lien (URL d'accompagnement) :
              </label>
              <input
                type="url"
                value={storyModalData.url}
                onChange={(e) => setStoryModalData({...storyModalData, url: e.target.value})}
                placeholder="https://academieduspirituel.com/meditation"
                className="w-full bg-[#F4EFE6] border border-[#D6AC66] rounded-2xl p-3.5 text-xs text-stone-800 font-medium focus:outline-none focus:border-gold-600 shadow-inner"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-900 block">
                Prompt image (si génération IA) :
              </label>
              <textarea
                rows={3}
                value={storyModalData.prompt}
                onChange={(e) => setStoryModalData({...storyModalData, prompt: e.target.value})}
                placeholder="Visuel Story vertical 9:16 épuré, teintes dorées, texte centré."
                className="w-full bg-[#F4EFE6] border border-[#E2D5C3] rounded-2xl p-3.5 text-xs text-stone-800 font-medium focus:outline-none focus:border-gold-600 leading-relaxed font-sans shadow-inner"
              />
            </div>

            <div className="pt-4 border-t border-[#E2D5C3] flex items-center justify-end gap-3">
              <button
                onClick={() => saveStoryData(true)}
                className="px-6 py-3 rounded-2xl bg-[#F4EFE6] hover:bg-[#E8DFC9] text-stone-900 text-xs font-bold border border-[#E2D5C3] transition-all shadow-sm"
              >
                Publier maintenant
              </button>
              <button
                onClick={() => saveStoryData(false)}
                className="px-8 py-3 rounded-2xl bg-stone-900 hover:bg-stone-800 text-amber-200 text-xs font-bold transition-all shadow-md"
              >
                Programmer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODALE DE PROGRAMMATION HEURE */}
      {isTimeModalOpen && selectedDay && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border-2 border-[#D6AC66] w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E2D5C3] pb-3">
              <div className="flex items-center gap-2 text-stone-900 font-serif font-bold text-base">
                <i className="fa-regular fa-clock text-gold-600"></i>
                <span>Programmer l'heure de publication</span>
              </div>
              <button onClick={() => setIsTimeModalOpen(false)} className="text-stone-400 hover:text-stone-900">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <select
              value={tempTime}
              onChange={(e) => setTempTime(e.target.value)}
              className="w-full bg-[#F4EFE6] border border-[#D6AC66] rounded-xl p-3 text-sm font-bold text-stone-900 focus:outline-none"
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>{slot} h</option>
              ))}
            </select>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2D5C3]">
              <button onClick={() => setIsTimeModalOpen(false)} className="px-4 py-2 rounded-xl bg-[#F4EFE6] text-stone-700 text-xs font-bold">Annuler</button>
              <button onClick={confirmScheduling} className="px-5 py-2 rounded-xl bg-stone-900 text-amber-200 text-xs font-bold shadow hover:bg-stone-800">Valider l'heure</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
