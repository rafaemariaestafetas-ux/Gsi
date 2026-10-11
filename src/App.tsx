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
import FCMPushModal from './components/FCMPushModal';
import AppUpdateModal from './components/AppUpdateModal';
import Onboarding, { ONBOARDING_STORAGE_KEY } from './components/Onboarding';
import IncomingCallScreen from './components/IncomingCallScreen';
import { checkForAppUpdate, ReleaseInfo } from './services/appUpdateService';
import { 
  setupNativePushNotifications,
  setupForegroundMessageListener,
  requestNativeNotificationPermission, 
  initializePushNotifications, 
  configureAndroidNotificationChannel,
  checkNativeNotificationPermission
} from './services/firebaseMessaging';
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
import { PushNotifications } from '@capacitor/push-notifications';
import { SplashScreen } from '@capacitor/splash-screen';
import { triggerLightHaptic, triggerMediumHaptic, triggerSuccessHaptic, triggerWarningHaptic } from './lib/haptics';
import { getCurrentLocation } from './lib/locationService';
import { useToast } from './lib/ToastContext';
import NetworkStatusBar from './components/NetworkStatusBar';
import { initNetworkService, useNetworkStatus, isOnline } from './services/networkService';
import { initOfflineSync, addToQueue, processQueue, getPendingItems } from './services/offlineSyncService';

export default function App() {
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { isOnline: isDeviceOnline } = useNetworkStatus();
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Map<string, any>>(new Map());
  const [isMessengerOpen, setIsMessengerOpen] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isFCMModalOpen, setIsFCMModalOpen] = useState(false);
  const [fcmRegistered, setFcmRegistered] = useState(!!localStorage.getItem('gsi_fcm_token'));
  const [incomingCallSignal, setIncomingCallSignal] = useState<any>(null);
  const [incomingCallBanner, setIncomingCallBanner] = useState<any>(null);
  const [incomingMessageToast, setIncomingMessageToast] = useState<{ senderId: string; senderName: string; senderAvatar?: string; content: string } | null>(null);
  const [unreadMsgCount, setUnreadMsgCount] = useState<number>(0);
  const [updateRelease, setUpdateRelease] = useState<ReleaseInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  // Monitor first open after login for Onboarding
  useEffect(() => {
    if (session && !localStorage.getItem(ONBOARDING_STORAGE_KEY)) {
      setShowOnboarding(true);
    }

    const handleReplayOnboarding = () => {
      setShowOnboarding(true);
    };

    window.addEventListener('gsi:open_onboarding', handleReplayOnboarding);
    return () => {
      window.removeEventListener('gsi:open_onboarding', handleReplayOnboarding);
    };
  }, [session]);

  // Check for app updates on launch from GitHub Releases (apenas Android nativo)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let isMounted = true;
    const runUpdateCheck = async () => {
      try {
        const release = await checkForAppUpdate();
        if (isMounted && release && release.hasUpdate) {
          // Verifica se o utilizador já descartou esta versão (se não for obrigatória)
          const targetVer = release.latestVersion || release.tag_name;
          const dismissedVer = localStorage.getItem('gsi_dismissed_update_version');
          if (!release.isMandatory && dismissedVer === targetVer) {
            return;
          }

          setUpdateRelease(release);
          setIsUpdateModalOpen(true);
        }
      } catch (err) {
        // Silencioso - não bloqueia o resto da aplicação
        console.warn('[App] Update check failed:', err);
      }
    };

    // Pequeno atraso (1.5s) para o app carregar suavemente
    const timer = setTimeout(runUpdateCheck, 1500);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  // Silent notification channel and existing permission check on launch (never prompts user automatically)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let isMounted = true;
    const checkNotificationStatus = async () => {
      try {
        await configureAndroidNotificationChannel();
        const granted = await checkNativeNotificationPermission();
        if (isMounted && granted) {
          setNotificationsEnabled(true);
          setFcmRegistered(true);
          // If already granted, register device silently without any user prompt
          await initializePushNotifications();
        }
      } catch (err) {
        console.warn('[App] Silent notification check note:', err);
      }
    };

    checkNotificationStatus();
    return () => {
      isMounted = false;
    };
  }, []);

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
        } else if (showOnboarding) {
          setShowOnboarding(false);
          localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
        } else if (isUpdateModalOpen) {
          setIsUpdateModalOpen(false);
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
  }, [incomingCallBanner, showOnboarding, isUpdateModalOpen, isMessengerOpen, isFCMModalOpen, activeTab]);

  // Unified Native Push Notifications listener registration (Capacitor Android)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    setupNativePushNotifications({
      userId: session?.user?.id,
      onNotificationReceived: (notification) => {
        console.log('[Native Push] Recebida em primeiro plano:', notification);
        const data = notification.data || {};
        if (data.type === 'call') {
          const signal = {
            type: 'incoming-call',
            senderId: data.senderId || '',
            senderName: data.senderName || notification.title || 'Colega de Obra',
            senderAvatar: data.senderAvatar || '',
            callType: data.callType || 'video',
            roomUrl: data.roomUrl || '',
            roomName: data.roomName || ''
          };
          setIncomingCallSignal(signal);
          setIncomingCallBanner(signal);
          startIncomingCallRingtone();
          if (navigator.vibrate) navigator.vibrate([500, 250, 500, 250, 500]);
        } else if (data.type === 'message' || data.type === 'private_message') {
          playNotificationSound();
          setIncomingMessageToast({
            senderId: data.senderId || '',
            senderName: data.senderName || 'Colega',
            senderAvatar: data.senderAvatar,
            content: data.body || notification.body || 'Nova mensagem'
          });
        }
      },
      onNotificationActionPerformed: (action) => {
        console.log('[Native Push] Notificação clicada:', action);
        const data = action.notification.data || {};
        if (data.type === 'call') {
          const signal = {
            type: 'incoming-call',
            senderId: data.senderId || '',
            senderName: data.senderName || action.notification.title || 'Colega de Obra',
            senderAvatar: data.senderAvatar || '',
            callType: data.callType || 'video',
            roomUrl: data.roomUrl || '',
            roomName: data.roomName || ''
          };
          setIncomingCallSignal(signal);
          setIncomingCallBanner(signal);
          startIncomingCallRingtone();
        } else if (data.type === 'message' || data.type === 'private_message' || data.type === 'group_message') {
          setIsMessengerOpen(true);
        }
      }
    });
  }, [session?.user?.id]);

  // Global calling listener: plays loud ringtone, vibrates phone and displays call modal
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
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(callChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [session, isMessengerOpen, onlineUsers]);

  // Handle URL launch parameters and foreground push toast
  useEffect(() => {
    setupForegroundMessageListener((payload: any) => {
      showInfo(payload?.notification?.body || 'Novo alerta de ponto recebido!', 'ALERTA GSI');
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
      try {
        const coords = await getCurrentLocation({ enableHighAccuracy: false, timeout: 6000 });
        const { latitude, longitude } = coords;
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`);
        const data = await response.json();
        const city = data.address?.city || data.address?.town || data.address?.village || data.address?.suburb || data.address?.county || 'Portugal';
        
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
        console.warn('[App] Localização online não disponível:', err);
      }
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
    if (!Capacitor.isNativePlatform()) return;
    const token = await requestNativeNotificationPermission(session?.user?.id);
    if (token) {
      setNotificationsEnabled(true);
      setFcmRegistered(true);
    }
  };

  const checkMissingEntries = (_currentEntries: TimeEntry[]) => {
    // Web notifications removed. Android native FCM notifications are handled via push channel.
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
    const isOfflineNow = !isOnline();

    const newEntry: TimeEntry = {
      day: today.getDate(),
      month: today.getMonth(),
      year: today.getFullYear(),
      hours: '00:00',
      obra: 'FALTA',
      description: reason.toUpperCase(),
      user_id: session.user.id,
      is_absence: true,
      absence_reason: reason,
      sync_status: isOfflineNow ? 'pending_sync' : 'synced'
    };

    setEntries(prev => {
      const filtered = prev.filter(e => e.day !== today.getDate());
      const updated = [...filtered, newEntry].sort((a, b) => a.day - b.day);
      localStorage.setItem(`entries_${selectedMonth}_${selectedYear}`, JSON.stringify(updated));
      return updated;
    });

    if (isOfflineNow) {
      addToQueue('time_entry', newEntry);
      showInfo('Ponto guardado offline. Vai sincronizar quando houver rede.', 'PONTO OFFLINE');
      return;
    }

    try {
      await supabase
        .from('time_entries')
        .delete()
        .eq('day', today.getDate())
        .eq('month', today.getMonth())
        .eq('year', today.getFullYear())
        .eq('user_id', session.user.id);

      const { error } = await supabase.from('time_entries').insert([{
        day: today.getDate(),
        month: today.getMonth(),
        year: today.getFullYear(),
        hours: '00:00',
        obra: 'FALTA',
        description: reason.toUpperCase(),
        user_id: session.user.id,
        is_absence: true,
        absence_reason: reason
      }]);
      if (error) throw error;
      showSuccess(`Falta do dia ${today.getDate()} justificada com sucesso!`, 'AUSÊNCIA REGISTADA');
      fetchEntries();
    } catch (err) {
      console.warn('[App] Supabase offline fallback for absence:', err);
      newEntry.sync_status = 'pending_sync';
      setEntries(prev => {
        const filtered = prev.filter(e => e.day !== today.getDate());
        const updated = [...filtered, newEntry].sort((a, b) => a.day - b.day);
        localStorage.setItem(`entries_${selectedMonth}_${selectedYear}`, JSON.stringify(updated));
        return updated;
      });
      addToQueue('time_entry', newEntry);
      showInfo('Ponto guardado offline. Vai sincronizar quando houver rede.', 'PONTO OFFLINE');
    }
  };

  useEffect(() => {
    initNetworkService();
    initOfflineSync();

    const handleOfflineSyncFinished = () => {
      fetchEntries();
    };
    window.addEventListener('gsi:offline_sync_completed', handleOfflineSyncFinished);

    const hideSplash = () => {
      if (Capacitor.isNativePlatform()) {
        SplashScreen.hide({ fadeOutDuration: 400 }).catch(() => {});
      }
    };

    let isMounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session) {
        setSession(session);
        fetchProfile(session.user.id);
      }
      setIsInitializing(false);
      hideSplash();
    }).catch(() => {
      if (isMounted) setIsInitializing(false);
      hideSplash();
    });

    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsInitializing(false);
        hideSplash();
      }
    }, 2500);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
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
      setIsInitializing(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
      window.removeEventListener('gsi:offline_sync_completed', handleOfflineSyncFinished);
    };
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
    const isOfflineNow = !isOnline();

    const newEntry: TimeEntry = {
      day,
      month: selectedMonth,
      year: selectedYear,
      hours,
      obra: currentWorkSite.toUpperCase(),
      description: userRole.toUpperCase(),
      user_id: session.user.id,
      sync_status: isOfflineNow ? 'pending_sync' : 'synced'
    };

    setEntries(prev => {
      const filtered = prev.filter(e => e.day !== day);
      const updated = [...filtered, newEntry].sort((a, b) => a.day - b.day);
      localStorage.setItem(`entries_${selectedMonth}_${selectedYear}`, JSON.stringify(updated));
      return updated;
    });

    if (isOfflineNow) {
      addToQueue('time_entry', newEntry);
      setHours('');
      setObra('');
      showInfo('Ponto guardado offline. Vai sincronizar quando houver rede.', 'PONTO OFFLINE');
      return;
    }

    try {
      await supabase
        .from('time_entries')
        .delete()
        .eq('day', day)
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .eq('user_id', session.user.id);

      const { error } = await supabase.from('time_entries').insert([{
        day,
        month: selectedMonth,
        year: selectedYear,
        hours,
        obra: currentWorkSite.toUpperCase(),
        description: userRole.toUpperCase(),
        user_id: session.user.id
      }]);
      if (error) throw error;
      
      setHours('');
      setObra('');
      showSuccess(`Ponto registado para o dia ${day}: ${hours}h na obra ${obra || 'padrão'}!`, 'PONTO REGISTADO');
      fetchEntries();
    } catch (err) {
      console.warn('[App] Supabase offline fallback for add entry:', err);
      newEntry.sync_status = 'pending_sync';
      setEntries(prev => {
        const filtered = prev.filter(e => e.day !== day);
        const updated = [...filtered, newEntry].sort((a, b) => a.day - b.day);
        localStorage.setItem(`entries_${selectedMonth}_${selectedYear}`, JSON.stringify(updated));
        return updated;
      });
      addToQueue('time_entry', newEntry);
      setHours('');
      setObra('');
      showInfo('Ponto guardado offline. Vai sincronizar quando houver rede.', 'PONTO OFFLINE');
    }
  };

  const handleQuickMark = async (quickHours: number) => {
    if (!session) return;
    await triggerSuccessHaptic();
    const today = new Date();
    const currentWorkSite = profile?.current_obra || obra || 'OBRA NÃO DEFINIDA';
    const isOfflineNow = !isOnline();
    
    const newEntry: TimeEntry = {
      day: today.getDate(),
      month: today.getMonth(),
      year: today.getFullYear(),
      hours: `${quickHours.toString().padStart(2, '0')}:00`,
      obra: currentWorkSite.toUpperCase(),
      description: userRole.toUpperCase(),
      user_id: session.user.id,
      sync_status: isOfflineNow ? 'pending_sync' : 'synced'
    };

    setEntries(prev => {
      const filtered = prev.filter(e => e.day !== today.getDate());
      const updated = [...filtered, newEntry].sort((a, b) => a.day - b.day);
      localStorage.setItem(`entries_${selectedMonth}_${selectedYear}`, JSON.stringify(updated));
      return updated;
    });

    if (isOfflineNow) {
      addToQueue('time_entry', newEntry);
      showInfo('Ponto guardado offline. Vai sincronizar quando houver rede.', 'PONTO OFFLINE');
      return;
    }

    try {
      await supabase
        .from('time_entries')
        .delete()
        .eq('day', today.getDate())
        .eq('month', today.getMonth())
        .eq('year', today.getFullYear())
        .eq('user_id', session.user.id);

      const { error } = await supabase.from('time_entries').insert([{
        day: today.getDate(),
        month: today.getMonth(),
        year: today.getFullYear(),
        hours: `${quickHours.toString().padStart(2, '0')}:00`,
        obra: currentWorkSite.toUpperCase(),
        description: userRole.toUpperCase(),
        user_id: session.user.id
      }]);
      if (error) throw error;
      showSuccess(`Ponto de hoje (${quickHours}h) registado com sucesso!`, 'PONTO REGISTADO');
      fetchEntries();
    } catch (err) {
      console.warn('[App] Supabase offline fallback for quick mark:', err);
      newEntry.sync_status = 'pending_sync';
      setEntries(prev => {
        const filtered = prev.filter(e => e.day !== today.getDate());
        const updated = [...filtered, newEntry].sort((a, b) => a.day - b.day);
        localStorage.setItem(`entries_${selectedMonth}_${selectedYear}`, JSON.stringify(updated));
        return updated;
      });
      addToQueue('time_entry', newEntry);
      showInfo('Ponto guardado offline. Vai sincronizar quando houver rede.', 'PONTO OFFLINE');
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

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center p-4 relative overflow-hidden text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.08)_0%,transparent_70%)] pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center space-y-6 relative z-10"
        >
          <AnimatedLogo size={90} />
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black tracking-tighter text-white">GSI<span className="text-[#d4af37] ml-1">PRO</span></h1>
            <p className="text-[10px] font-black text-[#d4af37] uppercase tracking-[0.4em]">A carregar sistema...</p>
          </div>
          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden mt-4">
            <motion.div 
              className="h-full bg-[#d4af37]"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  if (!session) return <Auth />;

  return (
    <div 
      className="min-h-screen bg-[#0a0e17] text-white font-sans selection:bg-[#d4af37]/30 transition-all duration-500 overflow-x-hidden"
      style={{
        paddingBottom: 'calc(5.75rem + env(safe-area-inset-bottom, 0px))'
      }}
    >
      {/* Network Status Offline/Syncing Banner */}
      <NetworkStatusBar />

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
                todayEntry={entries.find(e => 
                  e.day === today.getDate() && 
                  e.month === today.getMonth() && 
                  e.year === today.getFullYear()
                ) || null}
                isOffline={!isDeviceOnline}
                pendingSyncCount={getPendingItems('time_entry').length}
                onSyncNow={() => processQueue()}
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
                onOpenMessenger={() => {
                  setIsMessengerOpen(true);
                }}
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
            onClick={() => {
              triggerLightHaptic();
              setActiveTab('home');
            }}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-[#d4af37] scale-110' : 'text-white/30'}`}
          >
            <Home size={22} className={activeTab === 'home' ? 'fill-[#d4af37]/20' : ''} />
            <span className="text-[7px] font-black uppercase tracking-widest">Home</span>
          </button>
          <button 
            onClick={() => {
              triggerLightHaptic();
              setActiveTab('reels');
            }}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'reels' ? 'text-[#d4af37] scale-110' : 'text-white/30'}`}
          >
            <Film size={22} className={activeTab === 'reels' ? 'fill-[#d4af37]/20' : ''} />
            <span className="text-[7px] font-black uppercase tracking-widest">Reels</span>
          </button>
          <button 
            onClick={() => {
              triggerLightHaptic();
              setActiveTab('ponto');
            }}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'ponto' ? 'text-[#d4af37] scale-110' : 'text-white/30'}`}
          >
            <div className={`p-3 rounded-full border-2 ${activeTab === 'ponto' ? 'border-[#d4af37] bg-[#d4af37]/10' : 'border-white/10 bg-white/5'} -mt-8 transition-all shadow-[0_0_20px_rgba(212,175,55,0.2)]`}>
              <Clock size={24} />
            </div>
            <span className="text-[7px] font-black uppercase tracking-widest mt-1">Ponto</span>
          </button>
          <button 
            onClick={() => {
              triggerLightHaptic();
              setActiveTab('society');
            }}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'society' ? 'text-[#d4af37] scale-110' : 'text-white/30'}`}
          >
            <Users size={22} />
            <span className="text-[7px] font-black uppercase tracking-widest">Equipa</span>
          </button>
          <button 
            onClick={() => {
              triggerLightHaptic();
              setActiveTab('profile');
            }}
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
          <IncomingCallScreen
            callerName={incomingCallBanner.senderName || 'Colega de Obra'}
            callerAvatar={incomingCallBanner.senderAvatar}
            callType={incomingCallBanner.callType === 'video' ? 'video' : 'audio'}
            onAccept={() => {
              triggerSuccessHaptic();
              stopIncomingCallRingtone();
              setIncomingCallSignal({ ...incomingCallBanner, autoAccept: true });
              setIncomingCallBanner(null);
              setIsMessengerOpen(true);
            }}
            onDecline={() => {
              triggerWarningHaptic();
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
          />
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

      {updateRelease && (
        <AppUpdateModal
          isOpen={isUpdateModalOpen}
          release={updateRelease}
          onClose={() => {
            setIsUpdateModalOpen(false);
            if (updateRelease) {
              const targetVer = updateRelease.latestVersion || updateRelease.tag_name;
              localStorage.setItem('gsi_dismissed_update_version', targetVer);
            }
          }}
        />
      )}

      {/* Onboarding Tutorial Modal na primeira abertura */}
      <AnimatePresence>
        {showOnboarding && session && (
          <Onboarding
            onComplete={() => setShowOnboarding(false)}
            userId={session?.user?.id}
            onRequestNotifications={async () => {
              try {
                if (!Capacitor.isNativePlatform()) return true;
                const token = await requestNativeNotificationPermission(session?.user?.id);
                if (token) {
                  setNotificationsEnabled(true);
                  setFcmRegistered(true);
                  return token;
                }
                return false;
              } catch (err) {
                console.warn('[Onboarding Notification] Error:', err);
                return false;
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
