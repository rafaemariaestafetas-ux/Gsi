import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { motion } from 'motion/react';
import { LogIn, UserPlus } from 'lucide-react';
import AnimatedLogo from './AnimatedLogo';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data.user && data.session) {
          setSuccess('Conta criada com sucesso! Redirecionando...');
        } else {
          setSuccess('Verifique seu e-mail para ativar sua conta PRO!');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-blue-950/20 rounded-full blur-3xl opacity-50" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#1c2431]/60 backdrop-blur-xl border border-white/5 p-10 rounded-[2.5rem] shadow-2xl shadow-black/50 flex flex-col items-center relative z-10"
      >
        <div className="mb-8">
          <AnimatedLogo size={80} />
        </div>

        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">GSI<span className="text-[#d4af37] ml-1">PRO</span></h1>
          <p className="text-white/40 text-xs font-black uppercase tracking-[0.3em]">Capital Humano Premium</p>
        </div>

        {success ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full space-y-6 text-center"
          >
            <div className="w-20 h-20 bg-[#d4af37]/10 rounded-full flex items-center justify-center mx-auto border border-[#d4af37]/20">
              <div className="w-10 h-10 bg-[#d4af37] rounded-full flex items-center justify-center animate-pulse">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">Quase lá!</h2>
              <p className="text-white/60 text-sm font-medium leading-relaxed">
                {success}
              </p>
            </div>
            <button 
              onClick={() => {
                setSuccess(null);
                setIsSignUp(false);
              }}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all"
            >
              Voltar para o Login
            </button>
          </motion.div>
        ) : (
          <form onSubmit={handleAuth} className="space-y-6 w-full">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">E-mail Corporativo</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0a0e17] border border-white/5 rounded-2xl p-4 text-white font-semibold outline-none focus:ring-2 focus:ring-[#d4af37]/20 focus:border-[#d4af37] transition-all"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Palavra-passe</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0e17] border border-white/5 rounded-2xl p-4 text-white font-semibold outline-none focus:ring-2 focus:ring-[#d4af37]/20 focus:border-[#d4af37] transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <motion.p 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-red-500 text-xs font-bold uppercase text-center"
              >
                {error}
              </motion.p>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#d4af37] hover:bg-[#b8962d] text-black py-5 rounded-2xl font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-[#d4af37]/20 text-xs"
            >
              {loading ? 'A processar...' : isSignUp ? 'Criar Conta PRO' : 'Entrar no Sistema'}
            </button>

            <div className="mt-8 flex flex-col gap-4 text-center w-full">
              <button 
                type="button"
                onClick={() => {
                  setError(null);
                  setIsSignUp(!isSignUp);
                }}
                className="text-white/40 text-xs font-bold uppercase tracking-widest hover:text-[#d4af37] transition-colors"
              >
                {isSignUp ? 'Já possui acesso? Entrar' : 'Novo por aqui? Solicitar Acesso'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
