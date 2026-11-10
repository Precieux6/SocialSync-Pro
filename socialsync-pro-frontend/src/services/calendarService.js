export async function fetchEditorialCalendar() {
  try {
    const token = localStorage.getItem('supabase_token');
    const response = await fetch('/api/calendar/current', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    if (!result.success) return null;
    return result.data;
  } catch (err) {
    console.error("Erreur de récupération du calendrier :", err);
    return null;
  }
}
