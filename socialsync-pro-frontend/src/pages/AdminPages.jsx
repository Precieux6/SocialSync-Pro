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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([api.team.members(), api.team.invitations()]);
    setMembers(m.members ?? []);
    setInvitations(i.invitations ?? []);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => notify(e.message))
      .finally(() => setLoading(false));
  }, [load, notify]);

  // Une action à la fois : boutons désactivés pendant l'appel, rechargement de la liste ensuite
  const run = async (fn, message) => {
    if (busy) return false;
    setBusy(true);
    try {
      const r = await fn();
      notify(typeof message === 'function' ? message(r) : message);
      await load();
      return true;
    } catch (err) {
      notify(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const invite = async (e) => {
    e.preventDefault();
    const target = email.trim();
    const ok = await run(
      () => api.team.invite(target, role),
      (r) => (r.email?.sent
        ? `Invitation envoyée à ${target}.`
        : `Invitation enregistrée pour ${target}. ${r.email?.reason || ''}`.trim())
    );
    if (ok) setEmail('');
  };

  const changeRole = (userId, newRole) =>
    run(() => api.team.setMemberRole(userId, newRole), 'Rôle mis à jour.');

  const removeMember = (userId, name) => {
    if (!window.confirm(`Retirer ${name} de l'équipe ?`)) return;
    run(() => api.team.removeMember(userId), `${name} a été retiré.`);
  };

  const resend = (id) =>
    run(
      () => api.team.resendInvitation(id),
      (r) => (r.email?.sent ? 'Invitation renvoyée.' : (r.email?.reason || 'Renvoi impossible.'))
    );

  const deleteInvitation = (id, address) => {
    if (!window.confirm(`Supprimer l'invitation envoyée à ${address} ?`)) return;
    run(() => api.team.deleteInvitation(id), 'Invitation supprimée.');
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
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-[#F4EFE6] border border-[#E2D5C3] rounded-xl p-3 text-xs text-gold-700 font-bold focus:outline-none"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="bg-stone-900 text-amber-200 text-xs font-bold px-5 py-2.5 rounded-xl shadow disabled:opacity-50"
        >
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
                <select
                  value={m.role}
                  disabled={busy}
                  onChange={(e) => changeRole(m.user_id, e.target.value)}
                  className="bg-[#F4EFE6] border border-[#E2D5C3] rounded-lg px-3 py-1.5 font-bold text-gold-700 disabled:opacity-50"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button
                  disabled={busy}
                  onClick={() => removeMember(m.user_id, m.name || m.email)}
                  className="text-stone-400 hover:text-red-600 disabled:opacity-50"
                  title="Retirer"
                >
                  <i className="fa-regular fa-trash-can"></i>
                </button>
              </div>
            </div>
          ))}
          {!loading && members.length === 0 && (
            <p className="py-3 text-xs text-stone-400">Aucun membre pour le moment.</p>
          )}
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
                  disabled={busy}
                  onClick={() => resend(i.id)}
                  className="font-bold text-gold-700 hover:text-stone-900 disabled:opacity-50"
                >
                  Renvoyer
                </button>
                <button
                  disabled={busy}
                  onClick={() => deleteInvitation(i.id, i.email)}
                  className="text-stone-400 hover:text-red-600 disabled:opacity-50"
                  title="Supprimer"
                >
                  <i className="fa-regular fa-trash-can"></i>
                </button>
              </div>
            </div>
          ))}
          {!loading && pending.length === 0 && (
            <p className="py-3 text-xs text-stone-400">Aucune invitation en attente.</p>
          )}
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
