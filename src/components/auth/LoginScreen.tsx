import React, { useState } from 'react';
import { Eye, EyeOff, HelpCircle, LogIn, X } from 'lucide-react';
import { AppUser } from '../../core/types';
import { storageService } from '../../services/storageService';
import { BrandLogo } from '../ui/DataPrimitives';

interface LoginScreenProps {
  onLogin: (user: AppUser) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await storageService.authenticateUser(identifier, password);
      if (result.error || !result.user) {
        setError(result.error ?? 'Échec de la connexion.');
        return;
      }
      onLogin(result.user);
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
        <div className="w-full max-w-md bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Connexion à OWTrackers
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#C8C2D0]">
              Saisissez votre identifiant (matricule) ou votre adresse e-mail professionnelle.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
              >
                Identifiant ou adresse e-mail
              </label>
              <input
                id="login-identifier"
                type="text"
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="OW-0001 ou nom@entreprise.com"
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/50 border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0]"
                >
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-xs font-medium text-[#7624A8] dark:text-[#D896FF] hover:underline cursor-pointer"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
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

            {error && (
              <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg px-3.5 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#A83CE2] hover:bg-[#7624A8] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{submitting ? 'Vérification...' : 'Se connecter'}</span>
            </button>
          </form>
        </div>
      </main>

      <footer className="bg-white dark:bg-[#292631] border-t border-slate-200 dark:border-[#393342] px-6 py-4 text-center text-xs text-slate-500 dark:text-[#C8C2D0]">
        © 2026 AppLoumProject — apploumproject@gmail.com
      </footer>

      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
            onClick={() => setForgotOpen(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <HelpCircle className="w-4 h-4 text-[#A83CE2]" aria-hidden="true" />
                <span>Réinitialisation du mot de passe</span>
              </div>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 dark:text-[#C8C2D0] hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-[#C8C2D0] leading-relaxed">
              Pour des raisons de sécurité, aucun mot de passe n’est stocké en clair et aucune
              réinitialisation automatique sans serveur n’est possible en mode test local.
            </p>
            <p className="text-xs text-slate-600 dark:text-[#C8C2D0] leading-relaxed">
              Veuillez contacter un <strong className="text-slate-900 dark:text-white">Administrateur</strong> ou un{' '}
              <strong className="text-slate-900 dark:text-white">Manager</strong> autorisé pour définir un nouveau mot de passe temporaire depuis le module Utilisateurs. En production, ce lien déclenchera l’envoi d’un jeton sécurisé par e-mail via le backend PostgreSQL.
            </p>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="px-4 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
