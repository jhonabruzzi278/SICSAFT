import { useState } from 'react';
import { MailIcon, KeyRoundIcon, EyeIcon, EyeOffIcon, Loader2Icon, ScanLineIcon, AlertCircleIcon } from 'lucide-react';
import { oidcClient } from '@/lib/oidc/oidc-client';

interface OperatorGateProps {
  onSuccess?: () => void;
}

export function OperatorGate({ onSuccess }: OperatorGateProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Por favor ingresa tu usuario y contraseña.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await oidcClient.loginDirect(username.trim(), password);
      if (onSuccess) {
        onSuccess();
      } else {
        window.location.reload();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100svh-2rem)] w-full flex-col justify-between px-4 py-6 max-w-sm mx-auto">
      {/* Cabecera / Logo */}
      <div className="flex flex-col items-center pt-4 sm:pt-8 text-center">
        <div className="relative mb-3 flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#FF5E1E] to-[#FF4500] p-3 text-white shadow-xl shadow-orange-500/25">
          <div className="flex flex-col items-center justify-center">
            <ScanLineIcon className="size-9 stroke-[2.5]" />
            <span className="mt-0.5 text-[10px] font-black tracking-widest uppercase">SICSAFT</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
          <span>Una App de</span>
          <span className="font-bold text-[#FF5E1E] tracking-tight">SICSAFT</span>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="w-full space-y-4 my-auto py-6">
        {errorMessage && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50/90 dark:border-red-900/50 dark:bg-red-950/40 p-3.5 text-xs text-red-600 dark:text-red-400">
            <AlertCircleIcon className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Input Usuario / Correo */}
        <div className="relative flex items-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-4 py-3.5 shadow-xs transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
          <MailIcon className="size-5 text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Correo electrónico o usuario"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            disabled={loading}
            className="ml-3 w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden"
          />
        </div>

        {/* Input Contraseña */}
        <div className="relative flex items-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-4 py-3.5 shadow-xs transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
          <KeyRoundIcon className="size-5 text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoComplete="current-password"
            disabled={loading}
            className="ml-3 w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden pr-8"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            className="absolute right-3.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-1"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
          >
            {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        </div>

        {/* Link Ayuda */}
        <div className="pt-2 text-center text-xs">
          <span className="text-slate-500 dark:text-slate-400">¿Problemas para iniciar sesión? </span>
          <button
            type="button"
            onClick={() => oidcClient.startLogin()}
            className="font-medium text-blue-600 dark:text-blue-400 hover:underline inline-block mt-1"
          >
            Abrir inicio de sesión alternativo
          </button>
        </div>

        {/* Botón Iniciar Sesión */}
        <button
          type="submit"
          disabled={loading}
          data-testid="operator-login-btn"
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-[#1D68CD] hover:bg-[#1557B0] active:scale-[0.98] py-3.5 px-6 font-semibold text-white shadow-md shadow-blue-500/25 transition-all disabled:opacity-60 disabled:pointer-events-none text-sm"
        >
          {loading ? (
            <>
              <Loader2Icon className="mr-2 size-4 animate-spin" />
              Iniciando sesión...
            </>
          ) : (
            'Iniciar sesión'
          )}
        </button>
      </form>

      {/* Footer */}
      <div className="pt-4 text-center text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed space-y-1.5">
        <p>
          Al iniciar sesión, aceptas las <span className="underline cursor-pointer">Condiciones de uso</span> y la{' '}
          <span className="underline cursor-pointer">Política de privacidad</span> de SICSAFT.
        </p>
        <p className="font-mono text-[10px] text-slate-400/80">Versión 1.0.1</p>
      </div>
    </div>
  );
}
