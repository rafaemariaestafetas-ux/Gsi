import { CHAT_WALLPAPERS } from './chatWallpapers';

export type ChatThemeId = 'classic' | 'dark-premium' | 'industrial' | 'night-soft';

export interface ChatTheme {
  id: ChatThemeId;
  name: string;
  description: string;
  badge: string;
  previewColor: string;
  // Background styling
  containerBg: string;
  patternOpacity: number;
  patternUrl: string;
  // Bubbles
  bubbleMyBg: string;
  bubbleMyText: string;
  bubbleMyBorder: string;
  bubbleMyTipColor: string;
  bubbleOtherBg: string;
  bubbleOtherText: string;
  bubbleOtherBorder: string;
  bubbleOtherTipColor: string;
  // Input bar
  inputBarBg: string;
  inputBarBorder: string;
  inputBoxBg: string;
  inputBoxBorder: string;
  inputText: string;
  inputPlaceholder: string;
  // Send button
  sendBtnBg: string;
  sendBtnText: string;
  // Header accent
  headerAccent: string;
  // Timestamp & metadata text
  metaTextMy: string;
  metaTextOther: string;
}

export const CHAT_THEMES: Record<ChatThemeId, ChatTheme> = {
  // 1. Clássico (padrão): fundo claro WhatsApp, bolhas verdes/brancas
  classic: {
    id: 'classic',
    name: 'Clássico',
    description: 'Estilo WhatsApp claro com bolhas verdes e brancas',
    badge: 'PADRÃO',
    previewColor: '#00a884',
    containerBg: 'bg-[#efeae2]',
    patternOpacity: 0.4,
    patternUrl: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png',
    bubbleMyBg: 'bg-[#d9fdd3]',
    bubbleMyText: 'text-[#111b21]',
    bubbleMyBorder: 'border-[#c2f0b9]',
    bubbleMyTipColor: '#d9fdd3',
    bubbleOtherBg: 'bg-white',
    bubbleOtherText: 'text-[#111b21]',
    bubbleOtherBorder: 'border-slate-200/80',
    bubbleOtherTipColor: '#ffffff',
    inputBarBg: 'bg-[#f0f2f5]',
    inputBarBorder: 'border-slate-200',
    inputBoxBg: 'bg-white',
    inputBoxBorder: 'border-slate-200',
    inputText: 'text-slate-900',
    inputPlaceholder: 'placeholder:text-slate-400',
    sendBtnBg: 'bg-[#00a884] hover:bg-[#008f6f]',
    sendBtnText: 'text-white',
    headerAccent: '#00a884',
    metaTextMy: 'text-slate-500',
    metaTextOther: 'text-slate-400',
  },

  // 2. Dark Premium: fundo #0a0e17 / #1c2431, bolhas com dourado #d4af37
  'dark-premium': {
    id: 'dark-premium',
    name: 'Dark Premium',
    description: 'Preto nobre com detalhes e bolhas em dourado GSI',
    badge: 'LUXO',
    previewColor: '#d4af37',
    containerBg: 'bg-[#0a0e17]',
    patternOpacity: 0.15,
    patternUrl: CHAT_WALLPAPERS['dark-premium'],
    bubbleMyBg: 'bg-gradient-to-r from-[#d4af37] to-[#e5c04b]',
    bubbleMyText: 'text-black font-semibold',
    bubbleMyBorder: 'border-[#f5df7a]/50',
    bubbleMyTipColor: '#d4af37',
    bubbleOtherBg: 'bg-[#1c2431]',
    bubbleOtherText: 'text-white',
    bubbleOtherBorder: 'border-white/10',
    bubbleOtherTipColor: '#1c2431',
    inputBarBg: 'bg-[#0e1420]',
    inputBarBorder: 'border-white/10',
    inputBoxBg: 'bg-[#1c2431]',
    inputBoxBorder: 'border-white/15 focus-within:border-[#d4af37]/60',
    inputText: 'text-white',
    inputPlaceholder: 'placeholder:text-white/40',
    sendBtnBg: 'bg-[#d4af37] hover:bg-[#f3cf65]',
    sendBtnText: 'text-black font-black',
    headerAccent: '#d4af37',
    metaTextMy: 'text-black/60',
    metaTextOther: 'text-white/40',
  },

  // 3. Industrial: tons cinza escuro com acentos dourados
  industrial: {
    id: 'industrial',
    name: 'Industrial',
    description: 'Cinza chumbo robusto inspirado em ambiente de obra',
    badge: 'OBRA',
    previewColor: '#64748b',
    containerBg: 'bg-[#181c24]',
    patternOpacity: 0.18,
    patternUrl: CHAT_WALLPAPERS.industrial,
    bubbleMyBg: 'bg-[#334155]',
    bubbleMyText: 'text-amber-100',
    bubbleMyBorder: 'border-amber-400/30',
    bubbleMyTipColor: '#334155',
    bubbleOtherBg: 'bg-[#1e293b]',
    bubbleOtherText: 'text-slate-100',
    bubbleOtherBorder: 'border-slate-700',
    bubbleOtherTipColor: '#1e293b',
    inputBarBg: 'bg-[#13171f]',
    inputBarBorder: 'border-slate-800',
    inputBoxBg: 'bg-[#1e293b]',
    inputBoxBorder: 'border-slate-700 focus-within:border-amber-500/50',
    inputText: 'text-slate-100',
    inputPlaceholder: 'placeholder:text-slate-400',
    sendBtnBg: 'bg-amber-500 hover:bg-amber-400',
    sendBtnText: 'text-black font-black',
    headerAccent: '#f59e0b',
    metaTextMy: 'text-amber-200/70',
    metaTextOther: 'text-slate-400',
  },

  // 4. Noite Suave: dark azulado, contraste mais suave
  'night-soft': {
    id: 'night-soft',
    name: 'Noite Suave',
    description: 'Azul escuro calmo de alto conforto visual noturno',
    badge: 'RELAX',
    previewColor: '#38bdf8',
    containerBg: 'bg-[#0b1329]',
    patternOpacity: 0.16,
    patternUrl: CHAT_WALLPAPERS['night-soft'],
    bubbleMyBg: 'bg-[#1e3a8a]',
    bubbleMyText: 'text-cyan-50',
    bubbleMyBorder: 'border-cyan-400/30',
    bubbleMyTipColor: '#1e3a8a',
    bubbleOtherBg: 'bg-[#132247]',
    bubbleOtherText: 'text-slate-100',
    bubbleOtherBorder: 'border-blue-900/40',
    bubbleOtherTipColor: '#132247',
    inputBarBg: 'bg-[#080d1c]',
    inputBarBorder: 'border-blue-950',
    inputBoxBg: 'bg-[#132247]',
    inputBoxBorder: 'border-blue-900 focus-within:border-cyan-400/60',
    inputText: 'text-cyan-50',
    inputPlaceholder: 'placeholder:text-blue-300/40',
    sendBtnBg: 'bg-cyan-500 hover:bg-cyan-400',
    sendBtnText: 'text-black font-black',
    headerAccent: '#38bdf8',
    metaTextMy: 'text-cyan-200/70',
    metaTextOther: 'text-blue-300/60',
  }
};

export const getStoredChatTheme = (): ChatThemeId => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('gsi_chat_theme') as ChatThemeId;
    if (saved && CHAT_THEMES[saved]) {
      return saved;
    }
  }
  return 'classic'; // Padrão WhatsApp claro
};

export const setStoredChatTheme = (themeId: ChatThemeId) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('gsi_chat_theme', themeId);
  }
};
