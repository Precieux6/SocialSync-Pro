// socialsync-pro-frontend/src/pages/AdminPages.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { SocialAccountsForm } from '../components/setup/SetupForms';

const ROLES = ['Community Manager', 'Éditeur', 'Relecteur / Client'];

export function TeamPage({ notify }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Éditeur');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([api.team.members(), api.team.invitations()]);
    setMembers(m.members);
    setInvitations(i.invitations);
  }, []);

  useEffect(() => {
    load().catch((e) => notify(e.message));
  }, [load, notify]);

  const invite = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.team.invite(email.trim(), role);
      notify(r.email?.sent ? `Invitation envoyée à ${email}.` : `Invitation créée. ${r.email?.reason || ''}`);
      setEmail('');
      await load();
    } catch (err) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (userId, newRole) => {
    try {
      await api.team.setMemberRole(userId, newRole);
      notify('Rôle mis à jour.');
      await load();
    } catch (err) {
      notify(err.message);
    }
  };

  const removeMember = async (userId, name) => {
    if (!window.confirm(`Retirer ${name} de l'équipe ?`)) return;
    try {
      await api.team.removeMember(userId);
      notify(`${name} a été retiré.`);
      await load();
    } catch (err) {
      notify(err.message);
    }
  };

  const pending = invitations.filter((i) => !i.accepted_at);

  return (
    <div className="space-y-6">
      <div className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3]">
        <h2 className="text-2xl font-serif font-bold text-stone-900">Équipes & accès</h2>
        <p className="text-xs text-stone-500 mt-1">Invitez des collaborateurs et attribuez leur rôle. Réservé au propriétaire.</p>
      </div>

      <form onSubmit={invite} className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3] space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-stone-900">Envoyer une invitation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="email"
            required
            placeholder="adresse.email@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="sm:col-span-2 bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-stone-900 focus:outline-none"
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-gold-700 font-bold focus:outline-none">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button type="submit" disabled={busy} className="bg-stone-900 text-amber-200 text-xs font-bold px-5 py-2.5 rounded-xl shadow disabled:opacity-50">
          {busy ? 'Envoi...' : "Envoyer l'invitation"}
        </button>
      </form>

      <div className="bg-[#FAF7F2] rounded-3xl border border-[#E2D5C3] p-6 space-y-4">
        <h3 className="text-sm font-bold text-stone-900">Membres de l'équipe ({members.length})</h3>
        <div className="divide-y divide-[#E2D5C3]">
          {members.map((m) => (
            <div key={m.user_id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <h5 className="font-bold text-stone-900">{m.name || m.email}</h5>
                <span className="text-[11px] text-stone-500">{m.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <select value={m.role} onChange={(e) => changeRole(m.user_id, e.target.value)} className="bg-[#F4EFE6] border border-[#E2D5C3] rounded-lg px-3 py-1.5 font-bold text-gold-700">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button onClick={() => removeMember(m.user_id, m.name || m.email)} className="text-stone-400 hover:text-red-600" title="Retirer">
                  <i className="fa-regular fa-trash-can"></i>
                </button>
              </div>
            </div>
          ))}
          {members.length === 0 && <p className="py-3 text-xs text-stone-400">Aucun membre pour le moment.</p>}
        </div>
      </div>

      <div className="bg-[#FAF7F2] rounded-3xl border border-[#E2D5C3] p-6 space-y-4">
        <h3 className="text-sm font-bold text-stone-900">Invitations en attente ({pending.length})</h3>
        <div className="divide-y divide-[#E2D5C3]">
          {pending.map((i) => (
            <div key={i.id} className="py-3 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-stone-900">{i.email}</span>
                <span className="text-stone-500"> · {i.role}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => api.team.resendInvitation(i.id).then(() => notify('Invitation renvoyée.')).catch((e) => notify(e.message))}
                  className="font-bold text-gold-700 hover:text-stone-900"
                >
                  Renvoyer
                </button>
                <button
                  onClick={() => api.team.deleteInvitation(i.id).then(load).catch((e) => notify(e.message))}
                  className="text-stone-400 hover:text-red-600"
                  title="Supprimer"
                >
                  <i className="fa-regular fa-trash-can"></i>
                </button>
              </div>
            </div>
          ))}
          {pending.length === 0 && <p className="py-3 text-xs text-stone-400">Aucune invitation en attente.</p>}
        </div>
      </div>
    </div>
  );
}

export function ApisPage({ notify }) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-[#FAF7F2] p-6 rounded-3xl border border-[#E2D5C3]">
        <h2 className="text-2xl font-serif font-bold text-stone-900">APIs réseaux</h2>
        <p className="text-xs text-stone-500 mt-1">
          Identifiants d'accès aux plateformes sociales. Ils sont chiffrés côté serveur et ne sont jamais réaffichés.
        </p>
      </div>
      <SocialAccountsForm notify={notify} />
    </div>
  );
}
