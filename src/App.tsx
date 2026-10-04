import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import { TimeEntry, Profile } from './types';
import { exportToPDF, exportToJPG } from './lib/pdfUtils';
import ReportTemplate from './components/ReportTemplate';
import Auth from './components/Auth';
import Society from './components/Society';
import ProfileView from './components/ProfileView';
import WeeklyChart from './components/WeeklyChart';
import AnimatedLogo from './components/AnimatedLogo';
import ClockMarking from './components/ClockMarking';
import AnnouncementBoard from './components/AnnouncementBoard';
import SocialFeed from './components/SocialFeed';
import ReelsView from './components/ReelsView';
import Messenger from './components/Messenger';
import { PWAInstallButton } from './components/PWAInstallButton';
import FCMPushModal from './components/FCMPushModal';
import { registerFCMServiceWorker, setupForegroundMessageListener, requestFCMToken } from './services/firebaseMessaging';
import { playNotificationSound, startIncomingCallRingtone, stopIncomingCallRingtone } from './lib/sounds';
import { getGamificationStats } from './lib/gamification';
import { 
  Plus, 
  Download, 
  Trash2, 
  Calendar as CalendarIcon, 
  Clock, 
  HardHat, 
  FileText, 
  User, 
  Users, 
  Settings, 
  Briefcase, 
  Home, 
  Sun, 
  Moon, 
  Zap, 
  Bell, 
  Film, 
  TrendingUp, 
  MessageCircle, 
  Heart, 
  Phone,
  PhoneCall,
  PhoneOff,
  MessageSquare,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapApp } from '@capacitor/app';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'ponto' | 'society' | 'alerts' | 'profile'>('home');
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || 'Oficial');
  const [hourlyRate, setHourlyRate] = useState(localStorage.getItem('hourlyRate') || '0');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [day, setDay] = useState(new Date().getDate());
  const [hours, setHours] = useState('');
  const [obra, setObra] = useState(localStorage.getItem('currentObra') || '');
  const [showToast, setShowToast] = useState(false);
  const [quickHours, setQuickHours] = useState(8);
  const [isDarkMode, setIsDarkMode] = useState(true); // Forced dark mode for premium look
  const [notificationsEnabled, setNotificationsEnabled] = useState('Notification' in window && Notification.permission === 'granted');
  const [onlineUsers, setOnlineUsers] = useState<Map<string, any>>(new Map());
  const [isMessengerOpen, setIsMessengerOpen] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isFCMModalOpen, setIsFCMModalOpen] = useState(false);
  const [fcmRegistered, setFcmRegistered] = useState(!!localStorage.getItem('gsi_fcm_token'));
  const [incomingCallSignal, setIncomingCallSignal] = useState<any>(null);
  const [incomingCallBanner, setIncomingCallBanner] = useState<any>(null);
  const [incomingMessageToast, setIncomingMessageToast] = useState<{ senderId: string; senderName: string; senderAvatar?: string; content: string } | null>(null);
  const [unreadMsgCount, setUnreadMsgCount] = useState<number>(0);

  // Auto-register device for Web Push / FCM notifications upon login
  useEffect(() => {
    if (session?.user?.id) {
      requestFCMToken(session.user.id).then(token => {
        if (token) setFcmRegistered(true);
      });
    }
  }, [session?.user?.id]);

  // Native Android Capacitor Lifecycle (Back button & Status Bar)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#00000000' }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});

      let removeListener: (() => void) | undefined;
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (incomingCallBanner) {
          stopIncomingCallRingtone();
          setIncomingCallBanner(null);
        } else if (isMessengerOpen) {
          setIsMessengerOpen(false);
        } else if (isFCMModalOpen) {
          setIsFCMModalOpen(false);
        } else if (activeTab !== 'home') {
          setActiveTab('home');
        } else if (canGoBack) {
          window.history.back();
        } else {
          CapApp.exitApp();
        }
      }).then(handle => {
        removeListener = () => handle.remove();
      }).catch(() => {});

      return () => {
        if (removeListener) removeListener();
      };
    }
  }, [incomingCallBanner, isMessengerOpen, isFCMModalOpen, activeTab]);

  // Global WebRTC calling listener: plays loud ringtone, vibrates phone and displays call modal
  useEffect(() => {
    if (!session?.user?.id) return;

    const callChannel = supabase.channel(`call-signals-${session.user.id}`);
    
    callChannel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        if (payload?.type === 'incoming-call') {
          console.log('[App Call Listener] Received global call signal:', payload);
          setIncomingCallSignal(payload);
          setIncomingCallBanner(payload);
          startIncomingCallRingtone();
          if (navigator.vibrate) navigator.vibrate([500, 250, 500, 250, 500]);

          // Trigger native notification if browser is in background
          if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
            new Notification(`📞 Chamada de ${payload.senderName || 'Colega de Obra'}`, {
              body: `Chamada de ${payload.callType === 'video' ? 'vídeo' : 'voz'} no GSI Pro...`,
              icon: payload.senderAvatar || '/icons/icon-192.png',
              tag: 'incoming-call',
              requireInteraction: true
            });
          }
        } else if (payload?.type === 'call-declined' || payload?.type === 'hangup' || payload?.type === 'call-ended') {
          stopIncomingCallRingtone();
          setIncomingCallBanner(null);
        }
      })
      .subscribe();

    // Global listener for incoming direct messages when Messenger modal is closed
    const msgChannel = supabase.channel(`global-messages-${session.user.id}`);
    msgChannel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${session.user.id}`
      }, (payload) => {
        const msg = payload.new as any;
        console.log('[App Message Listener] Incoming message:', msg);
        if (!isMessengerOpen) {
          playNotificationSound();
          setUnreadMsgCount(prev => prev + 1);

          const sProfile = onlineUsers.get(msg.sender_id);
          const sName = sProfile?.full_name || 'Colega de Obra';
          const sAvatar = sProfile?.avatar_url;

          setIncomingMessageToast({
            senderId: msg.sender_id,
            senderName: sName,
            senderAvatar: sAvatar,
            content: msg.type === 'audio' ? '🎵 Mensagem de áudio' : (msg.type === 'image' ? '📷 Foto' : (msg.content || 'Nova mensagem'))
          });

          if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
            new Notification(`💬 ${sName}`, {
              body: msg.content || 'Nova mensagem recebida',
              icon: sAvatar || '/icons/icon-192.png',
              tag: `msg-${msg.sender_id}`
            });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(callChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [session, isMessengerOpen, onlineUsers]);

  // Handle URL launch parameters and Service Worker messages
  useEffect(() => {
    registerFCMServiceWorker();

    setupForegroundMessageListener((payload) => {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    });

    if (typeof window !== 'undefined') {
      // Check if launched from a push notification click with query params
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('incomingCall') === 'true') {
        const callerSignal = {
          type: 'incoming-call',
          senderId: urlParams.get('callerId') || '',
          senderName: urlParams.get('callerName') || 'Colega',
          senderAvatar: urlParams.get('callerAvatar') || '',
          callType: urlParams.get('callType') || 'video'
        };
        setIncomingCallSignal(callerSignal);
        setIncomingCallBanner(callerSignal);
        startIncomingCallRingtone();
        window.history.replaceState({}, '', '/');
      } else if (urlParams.get('openMessenger') === 'true') {
        setIsMessengerOpen(true);
        window.history.replaceState({}, '', '/');
      }

      // Listen for messages from the service worker
      if ('serviceWorker' in navigator) {
        const handler = (event: MessageEvent) => {
          if (event.data?.type === 'NAVIGATE_TO_PONTO') {
            setActiveTab('ponto');
          } else if (event.data?.type === 'INCOMING_CALL_NOTIFICATION') {
            const payload = event.data.payload;
            setIncomingCallSignal(payload);
            setIncomingCallBanner(payload);
            startIncomingCallRingtone();
          } else if (event.data?.type === 'OPEN_MESSENGER_CHAT') {
            setIsMessengerOpen(true);
          }
        };
        navigator.serviceWorker.addEventListener('message', handler);
        return () => {
          navigator.serviceWorker.removeEventListener('message', handler);
        };
      }
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: session.user.id,
        },
      },
    });

    const updateUserLocation = async () => {
      if (!navigator.geolocation) return;

      // First check if we already have permission or need to ask
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permissionStatus.state === 'denied') {
          console.warn('Localização bloqueada pelo usuário.');
          return;
        }
      } catch (e) {
        // Permissions API not supported in some mobile browsers, continue anyway
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`);
            const data = await response.json();
            const city = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.county || 'Portugal';
            
            // Update profile
            await supabase.from('profiles').update({ location_city: city }).eq('id', session.user.id);
            
            // Update presence on the active channel
            if (channel && (channel.state === 'joined' || channel.state === 'joining')) {
              await channel.track({
                online_at: new Date().toISOString(),
                city: city
              });
            }
            
            // Sync local state
            setProfile(prev => prev ? { ...prev, location_city: city } : null);
          } catch (err) {
            console.error('Erro ao converter coordenadas:', err);
          }
        },
        (error) => {
          // Log specific error codes for debugging
          const errorMap: Record<number, string> = {
            1: 'Permissão negada pelo usuário.',
            2: 'Posição indisponível.',
            3: 'Tempo de busca esgotado.'
          };
          console.warn(`GPS Warning (${error.code}): ${errorMap[error.code] || 'Erro desconhecido'}`);
        },
        { 
          enableHighAccuracy: false, // Set to false for faster response on mobile
          timeout: 5000, 
          maximumAge: 60000 
        }
      );
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const usersMap = new Map();
        Object.entries(newState).forEach(([key, value]: [string, any]) => {
          usersMap.set(key, value[0]);
        });
        setOnlineUsers(usersMap);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
          });
          updateUserLocation();
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [session]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Seu navegador não suporta notificações.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      new Notification('GSI PRO', {
        body: 'Notificações ativadas! Lembraremos você de registrar seu ponto.',
        icon: 'https://cdn-icons-png.flaticon.com/512/5977/5977591.png'
      });
    }
  };

  const checkMissingEntries = (currentEntries: TimeEntry[]) => {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !profile) return;

    const now = new Date();
    const currentDay = now.getDate();
    const currentHour = now.getHours();
    const currentDayOfWeek = now.getDay();

    // Sundays don't need point marking
    if (currentDayOfWeek === 0) return;

    // Users can mark point any time until midnight.
    // Notify at 10h, 14h and 19h if not marked yet
    const notificationHours = [10, 14, 19];

    if (notificationHours.includes(currentHour)) {
      const hasTodayEntry = currentEntries.some(e => 
        e.day === currentDay && 
        e.month === now.getMonth() && 
        e.year === now.getFullYear()
      );

      if (!hasTodayEntry) {
        new Notification('Lembrete de Ponto!', {
          body: `Você ainda não marcou seu ponto hoje. Não se esqueça de registrar sua jornada!`,
          icon: 'https://cdn-icons-png.flaticon.com/512/5977/5977591.png',
          tag: `ponto-pendente-${currentHour}`,
          requireInteraction: true
        });
      }
    }
  };

  useEffect(() => {
    if (session && entries.length > 0) {
      const interval = setInterval(() => checkMissingEntries(entries), 1000 * 60 * 60); // Check every hour
      checkMissingEntries(entries); // Check once on load
      return () => clearInterval(interval);
    }
  }, [session, entries]);

  const handleAbsence = async (reason: string) => {
    if (!session) return;
    const today = new Date();
    const newEntry: TimeEntry = {
      day: today.getDate(),
      month: today.getMonth(),
      year: today.getFullYear(),
      hours: '00:00',
      obra: 'FALTA',
      description: reason.toUpperCase(),
      user_id: session.user.id
    };

    setEntries(prev => {
      const filtered = prev.filter(e => e.day !== today.getDate());
      const updated = [...filtered, newEntry].sort((a, b) => a.day - b.day);
      localStorage.setItem(`entries_${selectedMonth}_${selectedYear}`, JSON.stringify(updated));
      return updated;
    });

    try {
      await supabase
        .from('time_entries')
        .delete()
        .eq('day', today.getDate())
        .eq('month', today.getMonth())
        .eq('year', today.getFullYear())
        .eq('user_id', session.user.id);

      await supabase.from('time_entries').insert([newEntry]);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      fetchEntries();
    } catch (err) {
      console.warn('Erro ao marcar falta');
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        fetchProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        fetchProfile(session.user.id);
      } else {
        setSession(null);
        setProfile(null);
        setEntries([]);
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        localStorage.removeItem('currentObra');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data);
      setUserName(data.full_name);
      setUserRole(data.role);
      setHourlyRate(data.hourly_rate.toString());
      if (data.current_obra) setObra(data.current_obra);
    }
  };

  const today = new Date();
  const isCurrentMonth = today.getMonth() === selectedMonth && today.getFullYear() === selectedYear;

  const fillAllDays = async () => {
    if (!session) return;
    if (!hours || !obra) {
      alert('Por favor, defina as horas e a obra padrão para preencher o mês.');
      return;
    }

    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const newEntries: TimeEntry[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(selectedYear, selectedMonth, d);
      const isSunday = date.getDay() === 0;

      newEntries.push({
        day: d,
        month: selectedMonth,
        year: selectedYear,
        hours: isSunday ? '0' : hours,
        obra: isSunday ? 'FOLGA' : obra.toUpperCase(),
        description: userRole.toUpperCase(),
        user_id: session.user.id
      });
    }

    setEntries(newEntries);
    localStorage.setItem(`entries_${selectedMonth}_${selectedYear}`, JSON.stringify(newEntries));

    try {
      await supabase
        .from('time_entries')
        .delete()
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .eq('user_id', session.user.id);
        
      await supabase.from('time_entries').insert(newEntries);
      fetchEntries();
    } catch (err) {
      console.warn('Sincronização falhou');
    }
  };

  const clearMonth = async () => {
    if (!session) return;
    if (!confirm('Tem certeza que deseja apagar TODOS os registros deste mês?')) return;
    
    setEntries([]);
    localStorage.setItem(`entries_${selectedMonth}_${selectedYear}`, '[]');
    
    try {
      await supabase
        .from('time_entries')
        .delete()
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .eq('user_id', session.user.id);
    } catch (err) {
      console.warn('Erro ao limpar no Supabase.');
    }
  };

  useEffect(() => {
    if (session) {
      fetchEntries();
    }
  }, [selectedMonth, selectedYear, session]);

  const fetchEntries = async () => {
    if (!session) return;
    setLoading(true);
    const localData = JSON.parse(localStorage.getItem(`entries_${selectedMonth}_${selectedYear}`) || '[]');
    setEntries(localData);

    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .eq('user_id', session.user.id)
        .order('day', { ascending: true });

      if (!error && data) {
        setEntries(data);
        localStorage.setItem(`entries_${selectedMonth}_${selectedYear}`, JSON.stringify(data));
      }
    } catch (err) {
      console.warn('Supabase offline.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    const currentWorkSite = profile?.current_obra || obra || 'OBRA NÃO DEFINIDA';

    const newEntry: TimeEntry = {
      day,
      month: selectedMonth,
      year: selectedYear,
      hours,
      obra: currentWorkSite.toUpperCase(),
      description: userRole.toUpperCase(),
      user_id: session.user.id
    };

    setEntries(prev => {
      const filtered = prev.filter(e => e.day !== day);
      const updated = [...filtered, newEntry].sort((a, b) => a.day - b.day);
      localStorage.setItem(`entries_${selectedMonth}_${selectedYear}`, JSON.stringify(updated));
      return updated;
    });

    try {
      await supabase
        .from('time_entries')
        .delete()
        .eq('day', day)
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .eq('user_id', session.user.id);

      await supabase.from('time_entries').insert([newEntry]);
      
      setHours('');
      setObra('');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      fetchEntries();
    } catch (err) {
      console.warn('Erro de sincronia');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const handleQuickMark = async (quickHours: number) => {
    if (!session) return;
    const today = new Date();
    const currentWorkSite = profile?.current_obra || obra || 'OBRA NÃO DEFINIDA';
    
    const newEntry: TimeEntry = {
      day: today.getDate(),
      month: today.getMonth(),
      year: today.getFullYear(),
      hours: `${quickHours.toString().padStart(2, '0')}:00`,
      obra: currentWorkSite.toUpperCase(),
      description: userRole.toUpperCase(),
      user_id: session.user.id
    };

    setEntries(prev => {
      const filtered = prev.filter(e => e.day !== today.getDate());
      const updated = [...filtered, newEntry].sort((a, b) => a.day - b.day);
      localStorage.setItem(`entries_${selectedMonth}_${selectedYear}`, JSON.stringify(updated));
      return updated;
    });

    try {
      await supabase
        .from('time_entries')
        .delete()
        .eq('day', today.getDate())
        .eq('month', today.getMonth())
        .eq('year', today.getFullYear())
        .eq('user_id', session.user.id);

      await supabase.from('time_entries').insert([newEntry]);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      fetchEntries();
    } catch (err) {
      console.warn('Erro de sincronia');
    }
  };

  const handleDeleteEntry = async (id?: string, localIndex?: number) => {
    const updatedEntries = entries.filter((_, i) => i !== localIndex);
    setEntries(updatedEntries);
    localStorage.setItem(`entries_${selectedMonth}_${selectedYear}`, JSON.stringify(updatedEntries));

    if (id) {
      try {
        await supabase.from('time_entries').delete().eq('id', id);
      } catch (err) {
        console.warn('Erro ao deletar');
      }
    }
  };

  const handleExport = (format: 'pdf' | 'jpg') => {
    const baseName = `Relatorio_Ponto_${userName.replace(/\s+/g, '_')}_${selectedMonth + 1}_${selectedYear}`;
    if (format === 'pdf') {
      exportToPDF('report-template', `${baseName}.pdf`);
    } else {
      exportToJPG('report-template', `${baseName}.jpg`);
    }
  };

  const totalHours = entries.reduce((acc, curr) => {
    if (!curr.hours) return acc;
    const [h, m] = curr.hours.split(':').map(Number);
    return acc + (isNaN(h) ? 0 : h) + (isNaN(m) ? 0 : m / 60);
  }, 0);

  const totalPayment = totalHours * parseFloat(hourlyRate || '0');

  const stats = getGamificationStats(entries.length, profile?.role || 'Oficial');

  const hasMarkedToday = entries.some(e => 
    e.day === new Date().getDate() && 
    e.month === new Date().getMonth() && 
    e.year === new Date().getFullYear()
  );

  if (!session) return <Auth />;

  return (
    <div 
      className="min-h-screen bg-[#0a0e17] text-white font-sans selection:bg-[#d4af37]/30 transition-all duration-500 overflow-x-hidden"
      style={{
        paddingBottom: 'calc(5.75rem + env(safe-area-inset-bottom, 0px))'
      }}
    >
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-950/20 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      {!isImmersive && (
        <header 
          className="flex justify-between items-start px-6 pb-4 sticky top-0 z-[60] bg-[#0a0e17]/90 backdrop-blur-md transition-all"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.85rem)'
          }}
        >
          <div className="space-y-0.5">
            <h1 className="text-2xl font-black tracking-tighter text-white">
              {activeTab === 'ponto' ? 'Marcar Ponto' : 'Ponto Social'}
              {activeTab === 'ponto' && <span className="bg-[#d4af37] text-black text-[8px] font-black px-1.5 py-0.5 rounded uppercase ml-2 align-middle">NEW</span>}
            </h1>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              {format(today, "EEEE, dd 'de' MMMM", { locale: ptBR })} - {format(today, "HH:mm")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PWAInstallButton />
            <button 
              onClick={() => setIsFCMModalOpen(true)}
              className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-white/5 hover:bg-[#d4af37]/15 transition-all relative group"
              title="Alertas de Ponto Push (Firebase FCM)"
            >
              <Bell size={18} className="text-[#d4af37] group-hover:scale-110 transition-transform" />
              {fcmRegistered && (
                <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full border border-[#0a0e17]" />
              )}
            </button>
            <button 
              onClick={() => {
                setIsMessengerOpen(true);
                setUnreadMsgCount(0);
              }}
              className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-white/5 hover:bg-white/10 transition-all relative"
              title="Chat & Mensagens"
            >
              <Zap size={18} className="text-[#d4af37] fill-[#d4af37]/20" />
              {unreadMsgCount > 0 ? (
                <div className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 bg-red-500 text-white font-black text-[10px] rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-red-500/40 border border-[#0a0e17]">
                  {unreadMsgCount}
                </div>
              ) : (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#0084ff] border-2 border-[#0a0e17] rounded-full animate-pulse" />
              )}
            </button>
          </div>
        </header>
      )}

      <main className={`${isImmersive ? 'px-0 pt-0 pb-0' : 'px-6'} space-y-8 relative z-10`}>
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* User Profile Card */}
              <div className="bg-[#1c2431]/60 border border-white/5 rounded-[2.5rem] p-8 flex flex-col items-center text-center space-y-4 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#d4af37]/40 to-transparent" />
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-[3px] border-[#d4af37] p-1 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                    <div className="w-full h-full rounded-full overflow-hidden border border-white/10">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#0a0e17] flex items-center justify-center text-white/20 text-3xl font-black">
                          {userName ? userName.charAt(0).toUpperCase() : '?'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#d4af37] border-4 border-[#1c2431] rounded-full flex items-center justify-center">
                    <TrendingUp size={10} className="text-black" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <h2 className="text-2xl font-black text-white tracking-tighter uppercase">{userName || 'Usuário'}</h2>
                    <span className="bg-[#d4af37] text-black text-[8px] font-black px-1.5 py-0.5 rounded uppercase">NV {stats.level}</span>
                  </div>
                  <div className="bg-[#d4af37]/10 border border-[#d4af37]/20 rounded-full px-4 py-1 inline-block">
                    <p className="text-[#d4af37] text-[10px] font-black uppercase tracking-widest">{stats.rankName}</p>
                  </div>
                </div>

                {/* Performance Stats */}
                <div className="w-full pt-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-end px-1">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">XP Progress</p>
                      <p className="text-[9px] font-black text-[#d4af37]">{stats.xp} / {(stats.level + 1) * 1000} XP</p>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.progress}%` }}
                        className="h-full bg-gradient-to-r from-[#d4af37] to-amber-200"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/5 pt-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full border-[3px] border-[#d4af37] border-r-transparent animate-[spin_4s_linear_infinite] flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-[#1c2431] flex items-center justify-center text-[8px] font-black text-[#d4af37]">{Math.floor(stats.progress)}%</div>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-white">Carreira Profissional</p>
                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Patente: {stats.rankName} | Total XP: {stats.xp}</p>
                      </div>
                    </div>
                    <TrendingUp size={24} className="text-[#d4af37] opacity-40" />
                  </div>
                </div>
              </div>

              {/* Announcements Section */}
              <AnnouncementBoard 
                isAdmin={profile?.is_admin || false} 
                userId={session.user.id}
                userName={userName}
              />

              {/* Social Feed Section */}
              <SocialFeed 
                currentUserId={session.user.id}
                userName={userName}
                userRole={userRole}
                userAvatar={profile?.avatar_url}
                isAdmin={profile?.is_admin || false}
              />
            </motion.div>
          )}

          {activeTab === 'reels' && (
            <motion.div
              key="reels"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
            >
              <ReelsView 
                currentUserId={session.user.id} 
                userName={userName} 
                userAvatar={profile?.avatar_url}
                isAdmin={profile?.is_admin || false}
              />
            </motion.div>
          )}

          {activeTab === 'ponto' && (
            <motion.div
              key="ponto"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <ClockMarking 
                onMark={handleQuickMark} 
                onAbsence={handleAbsence}
                isDarkMode={true} 
                hasMarkedToday={hasMarkedToday}
              />
            </motion.div>
          )}

          {activeTab === 'society' && (
            <motion.div
              key="society-full"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Society 
                isDarkMode={true} 
                onlineUsers={onlineUsers} 
                currentUserId={session.user.id}
                userName={userName}
                userAvatar={profile?.avatar_url}
                onToggleImmersive={(open) => setIsImmersive(open)}
              />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ProfileView 
                userId={session.user.id} 
                onProfileUpdate={(updated) => {
                  setProfile(prev => prev ? { ...prev, ...updated } : null);
                  if (updated.full_name) setUserName(updated.full_name);
                  if (updated.role) setUserRole(updated.role);
                  if (updated.hourly_rate !== undefined) setHourlyRate(updated.hourly_rate.toString());
                  if (updated.current_obra !== undefined) setObra(updated.current_obra);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Navigation */}
      {!isImmersive && (
        <nav 
          className="fixed bottom-0 left-0 right-0 border-t border-white/5 flex items-center justify-around px-4 z-[60] bg-[#0a0e17]/95 backdrop-blur-xl transition-all"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            height: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))'
          }}
        >
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-[#d4af37] scale-110' : 'text-white/30'}`}
          >
            <Home size={22} className={activeTab === 'home' ? 'fill-[#d4af37]/20' : ''} />
            <span className="text-[7px] font-black uppercase tracking-widest">Home</span>
          </button>
          <button 
            onClick={() => setActiveTab('reels')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'reels' ? 'text-[#d4af37] scale-110' : 'text-white/30'}`}
          >
            <Film size={22} className={activeTab === 'reels' ? 'fill-[#d4af37]/20' : ''} />
            <span className="text-[7px] font-black uppercase tracking-widest">Reels</span>
          </button>
          <button 
            onClick={() => setActiveTab('ponto')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'ponto' ? 'text-[#d4af37] scale-110' : 'text-white/30'}`}
          >
            <div className={`p-3 rounded-full border-2 ${activeTab === 'ponto' ? 'border-[#d4af37] bg-[#d4af37]/10' : 'border-white/10 bg-white/5'} -mt-8 transition-all shadow-[0_0_20px_rgba(212,175,55,0.2)]`}>
              <Clock size={24} />
            </div>
            <span className="text-[7px] font-black uppercase tracking-widest mt-1">Ponto</span>
          </button>
          <button 
            onClick={() => setActiveTab('society')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'society' ? 'text-[#d4af37] scale-110' : 'text-white/30'}`}
          >
            <Users size={22} />
            <span className="text-[7px] font-black uppercase tracking-widest">Equipa</span>
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'profile' ? 'text-[#d4af37] scale-110' : 'text-white/30'}`}
          >
            <User size={22} />
            <span className="text-[7px] font-black uppercase tracking-widest">Perfil</span>
          </button>
        </nav>
      )}

      {/* Hidden Report Template for PDF */}
      <div className="fixed left-[-9999px] top-[-9999px]">
        <ReportTemplate 
          userName={userName}
          userRole={userRole}
          month={selectedMonth}
          year={selectedYear}
          entries={entries}
          totalHours={totalHours}
          totalPayment={totalPayment}
        />
      </div>

      <footer className={`hidden md:flex px-12 py-10 border-t justify-between items-center text-[10px] font-black uppercase tracking-[0.3em] transition-colors ${isDarkMode ? 'bg-[#0f172a] border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
        <div>PROYECTOS GSI, S.L — GSI PRO SYSTEMS</div>
        <div>SISTEMA DE GESTÃO DE CAPITAL HUMANO © {selectedYear}</div>
      </footer>

      <AnimatePresence>
        {isMessengerOpen && session && (
          <Messenger 
            currentUserId={session.user.id} 
            userName={userName}
            userAvatar={profile?.avatar_url}
            onClose={() => setIsMessengerOpen(false)} 
            onlineUsers={onlineUsers}
            incomingCallSignal={incomingCallSignal}
            onClearIncomingCallSignal={() => setIncomingCallSignal(null)}
          />
        )}
      </AnimatePresence>

      {/* Incoming Call Overlay Modal */}
      <AnimatePresence>
        {incomingCallBanner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
          >
            <div className="w-full max-w-sm bg-[#1c2431] border border-white/10 rounded-[3rem] p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-[#d4af37] to-emerald-500 animate-pulse" />

              <div className="relative mx-auto w-28 h-28">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                <div className="w-28 h-28 rounded-full border-4 border-emerald-400 overflow-hidden bg-black/60 shadow-xl relative z-10 flex items-center justify-center">
                  {incomingCallBanner.senderAvatar ? (
                    <img src={incomingCallBanner.senderAvatar} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-black text-white">
                      {(incomingCallBanner.senderName || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-white tracking-wide">
                  {incomingCallBanner.senderName || 'Colega de Obra'}
                </h3>
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center justify-center gap-1.5 animate-pulse">
                  <PhoneCall size={14} />
                  Chamada de {incomingCallBanner.callType === 'video' ? 'Vídeo' : 'Voz'} a receber...
                </p>
              </div>

              {/* Action Buttons: Atender / Recusar */}
              <div className="flex items-center justify-center gap-6 pt-2">
                {/* Recusar (Decline) */}
                <button
                  onClick={() => {
                    stopIncomingCallRingtone();
                    if (incomingCallBanner?.senderId) {
                      const ch = supabase.channel(`call-signals-${incomingCallBanner.senderId}`);
                      ch.subscribe((st) => {
                        if (st === 'SUBSCRIBED') {
                          ch.send({ type: 'broadcast', event: 'signal', payload: { type: 'call-declined', senderId: session?.user?.id } });
                          setTimeout(() => supabase.removeChannel(ch), 500);
                        }
                      });
                    }
                    setIncomingCallBanner(null);
                    setIncomingCallSignal(null);
                  }}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/40 hover:scale-105 active:scale-95 transition-all"
                  title="Recusar"
                >
                  <PhoneOff size={28} />
                </button>

                {/* Atender (Answer) */}
                <button
                  onClick={() => {
                    stopIncomingCallRingtone();
                    setIncomingCallBanner(null);
                    setIsMessengerOpen(true);
                  }}
                  className="w-20 h-20 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-xl shadow-emerald-500/50 hover:scale-105 active:scale-95 transition-all animate-bounce"
                  title="Atender"
                >
                  <Phone size={34} className="fill-black" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incoming Message Toast Banner */}
      <AnimatePresence>
        {incomingMessageToast && (
          <motion.div
            initial={{ opacity: 0, y: -60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -60 }}
            onClick={() => {
              setIsMessengerOpen(true);
              setIncomingMessageToast(null);
              setUnreadMsgCount(0);
            }}
            className="fixed left-1/2 -translate-x-1/2 z-[150] w-[92%] max-w-md bg-[#1c2431]/95 border border-[#d4af37]/40 shadow-2xl shadow-black/80 rounded-2xl p-3.5 flex items-center gap-3 backdrop-blur-xl cursor-pointer hover:border-[#d4af37] transition-all"
            style={{
              top: 'calc(env(safe-area-inset-top, 0px) + 0.85rem)'
            }}
          >
            <div className="w-10 h-10 rounded-full overflow-hidden border border-[#d4af37] bg-black/50 flex items-center justify-center flex-shrink-0">
              {incomingMessageToast.senderAvatar ? (
                <img src={incomingMessageToast.senderAvatar} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-xs font-black">
                  {incomingMessageToast.senderName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white truncate">{incomingMessageToast.senderName}</span>
                <span className="text-[9px] font-bold text-[#d4af37] uppercase">Agora</span>
              </div>
              <p className="text-xs text-white/80 truncate mt-0.5">{incomingMessageToast.content}</p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIncomingMessageToast(null);
              }}
              className="p-1.5 text-white/40 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <FCMPushModal 
        isOpen={isFCMModalOpen}
        onClose={() => {
          setIsFCMModalOpen(false);
          setFcmRegistered(!!localStorage.getItem('gsi_fcm_token'));
        }}
        userId={session?.user?.id || ''}
      />

      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 md:bottom-12 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-blue-600/20 z-[100]"
          >
            REGISTO CONFIRMADO
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
