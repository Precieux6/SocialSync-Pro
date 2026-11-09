export const INITIAL_WEEKS_THEMES = [
  { week: 1, code: "S45", title: "Protection", range: "2 au 8 novembre 2026" },
  { week: 2, code: "S46", title: "Les Vies Antérieures", range: "9 au 15 novembre 2026" },
  { week: 3, code: "S47", title: "La Guidance et les Oracles", range: "16 au 22 novembre 2026" },
  { week: 4, code: "S48", title: "Le Sommeil et les Rêves", range: "23 au 29 novembre 2026" }
];

export const TIME_SLOTS = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    const hh = h < 10 ? `0${h}` : `${h}`;
    const mm = m === 0 ? '00' : `${m}`;
    TIME_SLOTS.push(`${hh}:${mm}`);
  }
}

export const LONG_YOUTUBE_SCRIPT_SAMPLE = `SCRIPT DE MÉDITATION GUIDÉE — L'ŒUF DE LUMIÈRE (17 à 40 minutes)

Tu connais ces journées où tu rentres vidé, comme si chaque personne croisée avait emporté un peu de toi. Aujourd'hui, dans cette méditation guidée, on pose ton œuf de lumière en profondeur, et on ancre un réflexe qui le remet en place en deux secondes, partout. Et avant de commencer : pour savoir où tu en es dans ta pratique, fais ton bilan spirituel gratuit. En sept minutes, tu reçois ta carte sur treize pratiques, ton portrait écrit et trois pistes de progression. Rendez-vous sur academieduspirituel.com, le lien est dans la description.

Je suis Frédéric Barbey. Depuis quinze ans, je pratique et je forme des praticiens, des milliers aujourd'hui, et la protection énergétique est l'une des premières choses que je leur transmets.

[01:30] EXPLICATIF HISTORIQUE & PHYSIQUE QUANTIQUE
Autour de ton corps, il existe un champ subtil que les traditions appelent l'aura. Au début du vingtième siècle, le théosophe Charles Leadbeater la décrivait déjà comme une forme lumineuse en ovale, plus large que le corps. En 1895, Albert de Rochas décrivait l'extériorisation de la sensibilité... Et en 1987, Barbara Ann Brennan, ancienne physicienne de la NASA, a publié "Le pouvoir bénéfique des mains". Elle y décrit ce champ en plusieurs couches emboîtées dont la forme est celle d'un œuf.

[05:00] LA MEMBRANE CELLULAIRE & LA RÈGLE D'OR
Pense à la membrane d'une cellule. Elle laisse entrer ce qui nourrit la cellule et laisse dehors ce qui la dérègle. C'est une frontière vivante, souple, intelligente. Ton œuf de lumière fonctionne exactement de cette façon. On se protège pour garder quelque chose intact : ta paix, ta clarté, ta joie. Quand tu la poses depuis l'amour, elle devient une enveloppe calme et rayonnante.

[10:00] INSTALLATION DE L'AXE TERRE-CIEL ET DÉPLOIEMENT DE L'ŒUF
... (Suite du script complet pour l'enregistrement audio & vidéo) ...
`;

export const INITIAL_VIDEOS_TO_FILM = [
  {
    id: "v1",
    date: "MARDI 3 NOVEMBRE",
    delay: "Demain",
    type: "Vidéo short",
    duration: "2 min 30",
    status: "Script prêt",
    title: "L'œuf de lumière : se protéger sans peur",
    releaseDate: "Mercredi 4 novembre",
    storyboard: [
      { scene: "Scène 1", time: "00:00 - 00:15", desc: "Plan serré de Frédéric souriant, ambiance chaleureuse avec bougie en arrière-plan.", hook: "Accroche : Connaissez-vous le pouvoir de l'œuf de lumière ?" },
      { scene: "Scène 2", time: "00:15 - 01:00", desc: "Incrustation graphique 3D de l'œuf de lumière autour du corps.", hook: "Explication de la protection énergétique et de la membrane cellulaire." },
      { scene: "Scène 3", time: "01:00 - 02:30", desc: "Plan moyen, guidage pas à pas, respiration lente.", hook: "Visualisation guidée : inspirez la lumière dorée, expirez les tensions." }
    ]
  },
  {
    id: "v2",
    date: "MERCREDI 4 NOVEMBRE",
    delay: "Dans 2 jours",
    type: "Vidéo long format",
    duration: "40 min",
    status: "Script prêt",
    title: "Se protéger : l'œuf de lumière (Séance complète)",
    releaseDate: "Vendredi 6 novembre",
    storyboard: [
      { scene: "Scène 1", time: "00:00 - 00:15", desc: "Plan serré de Frédéric souriant, ambiance chaleureuse avec bougie en arrière-plan.", hook: "Accroche : Connaissez-vous le pouvoir de l'œuf de lumière ?" },
      { scene: "Scène 2", time: "00:15 - 01:00", desc: "Incrustation graphique 3D de l'œuf de lumière autour du corps.", hook: "Explication de la protection énergétique et de la membrane cellulaire." },
      { scene: "Scène 3", time: "01:00 - 02:30", desc: "Plan moyen, guidage pas à pas, respiration lente.", hook: "Visualisation guidée : inspirez la lumière dorée, expirez les tensions." }
    ]
  },
  {
    id: "v3",
    date: "SAMEDI 7 NOVEMBRE",
    delay: "Dans 5 jours",
    type: "Vidéo short",
    duration: "2 min 30",
    status: "Script prêt",
    title: "Appeler l'archange Michel avant une journée chargée",
    releaseDate: "Dimanche 8 novembre",
    storyboard: [
      { scene: "Scène 1", time: "00:00 - 00:30", desc: "Plan face caméra, Frédéric tenant un oracle.", hook: "Invoquer l'énergie de protection de l'Archange Michel." },
      { scene: "Scène 2", time: "00:30 - 01:45", desc: "Prière/Déclaration guidée avec musique douce.", hook: "Visualisation d'un manteau de lumière bleu cobalt." },
      { scene: "Scène 3", time: "01:45 - 02:30", desc: "Ancrage final et appel à l'action.", hook: "Déposez vos intentions en commentaire." }
    ]
  },
  {
    id: "v4",
    date: "MARDI 10 NOVEMBRE",
    delay: "Dans 8 jours",
    type: "Vidéo short",
    duration: "2 min 30",
    status: "Script prêt",
    title: "Les 4 façons dont un défunt se manifeste",
    releaseDate: "Mercredi 11 novembre",
    storyboard: [
      { scene: "Scène 1", time: "00:00 - 00:20", desc: "Plan face caméra, ambiance très feutrée.", hook: "Avez-vous déjà ressenti une présence familière ?" },
      { scene: "Scène 2", time: "00:20 - 01:50", desc: "Listage dynamique des 4 signes principaux.", hook: "Odeurs, rêves lucides, objets déplacés, synchronicités." },
      { scene: "Scène 3", time: "01:50 - 02:30", desc: "Message de réconfort.", hook: "Comment accueillir ces signes en toute sérénité." }
    ]
  },
  {
    id: "v5",
    date: "MERCREDI 11 NOVEMBRE",
    delay: "Dans 9 jours",
    type: "Vidéo long format",
    duration: "40 min",
    status: "Script prêt",
    title: "L'entre-deux-vies : exploration sous hypnose",
    releaseDate: "Vendredi 13 novembre",
    storyboard: [
      { scene: "Scène 1", time: "00:00 - 05:00", desc: "Introduction explicative sur l'hypnose spirituelle.", hook: "Qu'y a-t-il entre deux incarnations ?" },
      { scene: "Scène 2", time: "05:00 - 30:00", desc: "Induction hypnotique profonde.", hook: "Guidage progressif vers le monde spirituel." },
      { scene: "Scène 3", time: "30:00 - 40:00", desc: "Retour à l'état d'éveil et intégration.", hook: "Ancrage des enseignements et souvenirs." }
    ]
  }
];

export const INITIAL_COMMENTS = [
  { id: 1, author: "Marie L.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100", platform: "instagram", postTitle: "5 protections venues des traditions", text: "Merci pour cette belle méditation de l'œuf de lumière !", date: "Il y a 20 min", aiReply: "Bonjour Marie ✨ Merci du fond du cœur. Prends bien soin de ton œuf de lumière !" },
  { id: 2, author: "Thomas B.", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100", platform: "facebook", postTitle: "Se protéger : l'œuf de lumière", text: "Est-ce normal de sentir des frissons pendant l'ancrage ?", date: "Il y a 1h", aiReply: "Bonjour Thomas ! Oui, les frissons sont un signe très classique de réajustement énergétique." },
  { id: 3, author: "Sophie G.", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100", platform: "youtube", postTitle: "L'œuf de lumière : se protéger sans...", text: "Merci Frédéric pour cette clarté comme toujours.", date: "Il y a 3h", aiReply: "Merci du fond du cœur Sophie pour ta fidélité et tes mots touchants 🙏" },
  { id: 4, author: "Lucas M.", avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100", platform: "tiktok", postTitle: "L'œuf de lumière en 2 min", text: "Incroyable la sensation au niveau des épaules !", date: "Il y a 4h", aiReply: "Super Lucas ! C'est le signe que la tension se libère ✨" },
  { id: 5, author: "Claire D.", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100", platform: "instagram", postTitle: "Pourquoi certains souvenirs...", text: "Est-ce qu'on peut faire cet exercice le soir avant de dormir ?", date: "Il y a 5h", aiReply: "Absolument Claire ! C'est même idéal pour nettoyer les énergies accumulées dans la journée 🌙" }
];

export const GENERATE_28_DAYS = (weeksThemes = INITIAL_WEEKS_THEMES) => {
  const days = [];
  const dayNames = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
  const fullDayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  let dayCounter = 2;

  for (let week = 1; week <= 4; week++) {
    const weekInfo = weeksThemes[week - 1];
    const currentTheme = weekInfo.title;

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const dayShort = dayNames[dayIdx];
      const dayFull = fullDayNames[dayIdx];
      const dateStr = `${dayFull} ${dayCounter} novembre 2026`;
      const fullDateNum = `${dayCounter < 10 ? '0' + dayCounter : dayCounter}/11/2026`;
      
      const id = `w${week}-d${dayIdx + 1}`;
      let cardItems = [];

      if (dayIdx === 0) {
        cardItems = [
          { id: `${id}-1`, type: "Photo", badgeColor: "bg-sky-700 text-white border-sky-800", title: `Réflexion profonde sur : ${currentTheme}`, status: "À faire" }
        ];
      } else if (dayIdx === 1) {
        cardItems = [
          { 
            id: `${id}-1`, 
            type: "Story", 
            badgeColor: "bg-pink-100 text-pink-700 border-pink-200", 
            title: `Annonce : les Mardis autour de ${currentTheme}`, 
            status: "À faire", 
            isStory: true,
            storyMedia: null,
            storyUrl: "https://academieduspirituel.com/meditation",
            storyPrompt: `Visuel Story vertical 9:16 épuré sur ${currentTheme}, teintes dorées, texte centré.`
          },
          { 
            id: `${id}-2`, 
            type: "Carrousel", 
            badgeColor: "bg-emerald-800 text-white border-emerald-900", 
            title: `Cinq clés fondamentales : ${currentTheme}`, 
            status: "Publié", 
            isCarousel: true,
            slides: [
              { num: 1, text: `5 CLÉS SUR : ${currentTheme.toUpperCase()}` },
              { num: 2, text: `Première pratique essentielle liée à ${currentTheme}...` },
              { num: 3, text: `L'explication fondamentale donnée par les traditions concernant ${currentTheme}...` },
              { num: 4, text: `Comment intégrer ${currentTheme} dans votre quotidien...` },
              { num: 5, text: `L'erreur classique à éviter sur ${currentTheme}...` },
              { num: 6, text: `Exercice pratique d'ancrage en 3 minutes.` },
              { num: 7, text: `Pour approfondir votre profil spirituel, visitez academieduspirituel.com` }
            ]
          },
          { id: `${id}-3`, type: "Live", badgeColor: "bg-purple-900 text-white border-purple-950", title: `Live direct & tirages : ${currentTheme}`, status: "Prêt", time: "20 h 30" }
        ];
      } else if (dayIdx === 2) {
        cardItems = [
          { id: `${id}-1`, type: "Vidéo courte", badgeColor: "bg-amber-700 text-white border-amber-800", title: `${currentTheme} : l'essentiel en 2 min`, status: "Script prêt", isVideoShort: true }
        ];
      } else if (dayIdx === 3) {
        cardItems = [
          { id: `${id}-1`, type: "Question", badgeColor: "bg-teal-700 text-white border-teal-800", title: `Quelle est votre expérience avec ${currentTheme} ?`, status: "À faire" }
        ];
      } else if (dayIdx === 4) {
        cardItems = [
          { id: `${id}-1`, type: "Séance YouTube", badgeColor: "bg-burgundy-700 text-white border-burgundy-800", title: `Grand parcours guidé : ${currentTheme}`, status: "Script prêt", isLongYouTube: true },
          { 
            id: `${id}-2`, 
            type: "Story", 
            badgeColor: "bg-pink-100 text-pink-700 border-pink-200", 
            title: `Annonce sortie YouTube : ${currentTheme}`, 
            status: "À faire",
            isStory: true,
            storyMedia: null,
            storyUrl: "https://academieduspirituel.com/meditation",
            storyPrompt: `Visuel Story vertical 9:16 épuré, teintes dorées pour la sortie YouTube.`
          },
          {
            id: `${id}-3`,
            type: "Photo",
            badgeColor: "bg-sky-700 text-white border-sky-800",
            title: `Synthèse visuelle de fin de semaine : ${currentTheme}`,
            status: "À faire"
          }
        ];
      } else if (dayIdx === 5) {
        cardItems = [
          { id: `${id}-1`, type: "Photo", badgeColor: "bg-sky-700 text-white border-sky-800", title: `Inspiration du week-end : ${currentTheme}`, status: "À faire" }
        ];
      } else if (dayIdx === 6) {
        cardItems = [
          { id: `${id}-1`, type: "Vidéo courte", badgeColor: "bg-amber-700 text-white border-amber-800", title: `Invocation & Clôture : ${currentTheme}`, status: "Script prêt", isVideoShort: true }
        ];
      }

      days.push({
        id,
        weekNum: week,
        weekCode: weekInfo.code,
        weekRange: weekInfo.range,
        dayShort,
        dayFull,
        dateNumber: dayCounter,
        formattedDate: dateStr,
        fullDateNum,
        theme: currentTheme,
        items: cardItems,
        dayBrief: dayIdx === 4 ? 
          `Aujourd'hui, c'est la grande séance guidée sur YouTube consacrée à "${currentTheme}". Complétée par la Story d'annonce et le post visuel de synthèse.` :
          dayIdx === 1 ?
          `Journée multi-formats axée sur "${currentTheme}" : Carrousel pédagogique 7 vues, annonce Story et préparation du Live du soir.` :
          `Publication axée sur l'engagement et la résonance autour du thème "${currentTheme}".`,
        imagePromptText: `Crée un visuel captivant au format carré 1:1 évoquant de manière symbolique et épurée le thème spirituel : "${currentTheme}".
Teintes dorées, atmosphère sereine et lumineuse.`
      });

      dayCounter++;
      if (dayCounter > 30) dayCounter = 1;
    }
  }

  return days;
};
