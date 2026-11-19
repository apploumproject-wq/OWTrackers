import React, { useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { AppUser } from '../../core/types';
import { storageService } from '../../services/storageService';
import { isValidEmail } from '../../utils/crypto';
import { BrandLogo } from '../ui/DataPrimitives';

interface InitialAdminSetupScreenProps {
  onInitialized: (user: AppUser) => void;
}

export function InitialAdminSetupScreen({ onInitialized }: InitialAdminSetupScreenProps) {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    if (cleanUsername.length < 2 || /\s/.test(cleanUsername)) {
      setError('Veuillez saisir un identifiant de connexion valide (2 caractères minimum, sans espace).');
      return;
    }
    if (fullName.trim().length < 2) {
      setError('Veuillez saisir votre nom et prénom.');
      return;
    }
    if (email.trim() && !isValidEmail(email)) {
      setError('Veuillez saisir une adresse e-mail professionnelle valide.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await storageService.initializePrimaryAdmin({
        username: cleanUsername,
        fullName,
        email,
        password,
      });
      if (result.error || !result.user) {
        setError(result.error ?? 'Impossible de créer le compte administrateur.');
        return;
      }
      onInitialized(result.user);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#17151C] flex flex-col justify-between">
      <header className="bg-white dark:bg-[#292631] border-b border-slate-200 dark:border-[#393342] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-6">
          <BrandLogo />
          <span className="text-xs text-slate-500 dark:text-[#C8C2D0]">
            Gestion du temps, productivité & qualité
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-lg bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#7624A8] dark:text-[#D896FF]">
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Initialisation unique de la plateforme</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Création du premier administrateur
            </h1>
            <p className="text-xs text-slate-600 dark:text-[#C8C2D0] leading-relaxed">
              Aucun compte n’est configuré sur cet espace. Créez le compte administrateur principal
              pour activer OWTrackers et gérer ensuite vos managers, superviseurs et collaborateurs.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg px-4 py-3 flex items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-500 dark:text-[#C8C2D0]">Rôle attribué : </span>
              <span className="font-semibold text-[#7624A8] dark:text-[#D896FF]">
                Administrateur principal
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-[#C8C2D0]">
              Sans matricule employé
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="init-username"
                className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
              >
                Identifiant de connexion <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <input
                id="init-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex. admin"
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/50 border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
              />
            </div>
            <div>
              <label
                htmlFor="init-fullname"
                className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
              >
                Nom et prénom <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <input
                id="init-fullname"
                type="text"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex. Marie Martin"
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/50 border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
              />
            </div>

            <div>
              <label
                htmlFor="init-email"
                className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
              >
                Adresse e-mail (facultative)
              </label>
              <input
                id="init-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@entreprise.com (optionnel)"
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/50 border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
              />
            </div>

            <div>
              <label
                htmlFor="init-password"
                className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
              >
                Mot de passe (8 caractères minimum){' '}
                <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="init-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 dark:text-[#C8C2D0] hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="init-confirm"
                className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
              >
                Confirmation du mot de passe{' '}
                <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="init-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 dark:text-[#C8C2D0] hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  aria-label={showConfirm ? 'Masquer' : 'Afficher'}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg px-3.5 py-2.5">
                {error}
              </div>
            )}

            <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-[#C8C2D0] bg-slate-50 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg px-3.5 py-2.5">
              <Lock className="w-3.5 h-3.5 text-[#7624A8] dark:text-[#D896FF] shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Après validation, cet écran d’initialisation sera définitivement désactivé. En production, la création et le hachage sont sécurisés côté serveur avec PostgreSQL.
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#A83CE2] hover:bg-[#7624A8] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{submitting ? 'Initialisation...' : 'Créer le compte administrateur'}</span>
            </button>
          </form>
        </div>
      </main>

      <footer className="bg-white dark:bg-[#292631] border-t border-slate-200 dark:border-[#393342] px-6 py-4 text-center text-xs text-slate-500 dark:text-[#C8C2D0]">
        © 2026 AppLoumProject — apploumproject@gmail.com
      </footer>
    </div>
  );
}
