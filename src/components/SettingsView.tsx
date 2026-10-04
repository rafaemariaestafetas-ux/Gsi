import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Profile } from '../types';
import { motion } from 'motion/react';
import { Bell, Save, ChevronLeft, Clock, Calendar, LogOut, User, HardHat, Briefcase, Euro, Phone, MapPin, Camera, Loader2, Smartphone, ShieldCheck } from 'lucide-react';
import FCMPushModal from './FCMPushModal';

interface SettingsViewProps {
  userId: string;
  onBack: () => void;
  onUpdate: (updatedProfile: Partial<Profile>) => void;
  isDarkMode?: boolean;
}

export default function SettingsView({ userId, onBack, onUpdate, isDarkMode = true }: SettingsViewProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isFCMModalOpen, setIsFCMModalOpen] = useState(false);
  
  // Profile State
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'Ajudante' | 'Oficial' | 'Motorista' | 'Encarregado' | 'Mestre de Obra'>('Oficial');
  const [hourlyRate, setHourlyRate] = useState('0');
  const [currentObra, setCurrentObra] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [locationCity, setLocationCity] = useState('');
  
  // Settings State
  const [notificationHour, setNotificationHour] = useState(17);
  const [notificationDays, setNotificationDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);

  const daysOfWeek = [
    { id: 0, label: 'Dom' },
    { id: 1, label: 'Seg' },
    { id: 2, label: 'Ter' },
    { id: 3, label: 'Qua' },
    { id: 4, label: 'Qui' },
    { id: 5, label: 'Sex' },
    { id: 6, label: 'Sáb' },
  ];

  useEffect(() => {
    getSettings();
  }, [userId]);

  const getSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setFullName(data.full_name || '');
      setRole(data.role || 'Oficial');
      setHourlyRate(data.hourly_rate?.toString() || '0');
      setCurrentObra(data.current_obra || '');
      setPhone(data.phone || '');
      setAvatarUrl(data.avatar_url || '');
      setLocationCity(data.location_city || '');
      setNotificationHour(data.notification_hour ?? 17);
      setNotificationDays(data.notification_days ?? [1, 2, 3, 4, 5, 6]);
    }
    setLoading(false);
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const updateLocation = () => {
    if (!navigator.geolocation) return;
    setSaving(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`);
        const data = await response.json();
        const city = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.county || 'Portugal';
        setLocationCity(city);
      } catch (err) {
        alert('Erro ao identificar cidade.');
      } finally {
        setSaving(false);
      }
    }, () => {
      alert('Ative o GPS.');
      setSaving(false);
    });
  };

  const toggleDay = (dayId: number) => {
    setNotificationDays(prev => 
      prev.includes(dayId) 
        ? prev.filter(d => d !== dayId) 
        : [...prev, dayId].sort()
    );
  };

  const saveSettings = async () => {
    setSaving(true);
    const updates = {
      id: userId,
      full_name: fullName,
      role,
      hourly_rate: parseFloat(hourlyRate),
      current_obra: currentObra,
      phone,
      avatar_url: avatarUrl,
      location_city: locationCity,
      notification_hour: notificationHour,
      notification_days: notificationDays,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('profiles').upsert(updates);
    
    if (error) {
      alert(error.message);
    } else {
      onUpdate(updates);
      alert('Perfil e configurações atualizados!');
      onBack();
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    if (confirm('Deseja realmente sair da sua conta?')) {
      try {
        await supabase.auth.signOut();
        window.location.href = '/';
      } catch (err) {
        window.location.reload();
      }
    }
  };

  if (loading) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 rounded-full transition-colors hover:bg-white/5 text-white/60 hover:text-white"
          >
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Configurações</h2>
        </div>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all font-bold text-xs uppercase tracking-widest"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>

      <div className="space-y-8 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl transition-colors bg-[#1c2431]/60">
        {/* Profile Editing Section */}
        <div className="space-y-8 border-b border-white/5 pb-8">
          <div className="flex flex-col items-center gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full border-2 border-[#d4af37]/30 overflow-hidden shadow-xl bg-[#0a0e17] group-hover:border-[#d4af37] transition-all relative">
                {avatarUrl ? (
                  <img src={avatarUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><User size={32} className="text-white/10" /></div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="text-[#d4af37] animate-spin" size={24} />
                  </div>
                )}
              </div>
              <label htmlFor="avatar-upload-settings" className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#d4af37] rounded-xl flex items-center justify-center cursor-pointer hover:scale-110 transition-all shadow-lg">
                <Camera size={14} className="text-black" />
                <input type="file" id="avatar-upload-settings" accept="image/*" onChange={uploadAvatar} className="hidden" />
              </label>
            </div>

            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block ml-1">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d4af37]" size={14} />
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-[#0a0e17] border-none rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-[#d4af37]/50" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block ml-1">Cargo</label>
                <div className="relative">
                  <HardHat className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d4af37]" size={14} />
                  <select value={role} onChange={(e) => setRole(e.target.value as any)} className="w-full bg-[#0a0e17] border-none rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-[#d4af37]/50 appearance-none">
                    <option value="Ajudante">Ajudante</option>
                    <option value="Oficial">Oficial</option>
                    <option value="Motorista">Motorista</option>
                    <option value="Encarregado">Encarregado</option>
                    <option value="Mestre de Obra">Mestre de Obra</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block ml-1">Obra Atual</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d4af37]" size={14} />
                  <input type="text" value={currentObra} onChange={(e) => setCurrentObra(e.target.value)} className="w-full bg-[#0a0e17] border-none rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-[#d4af37]/50" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block ml-1">Taxa (€/h)</label>
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d4af37]" size={14} />
                  <input type="number" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="w-full bg-[#0a0e17] border-none rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-[#d4af37]/50" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block ml-1">Telefone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d4af37]" size={14} />
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-[#0a0e17] border-none rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-[#d4af37]/50" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block ml-1">Cidade</label>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d4af37]" size={14} />
                    <input type="text" value={locationCity} onChange={(e) => setLocationCity(e.target.value)} className="w-full bg-[#0a0e17] border-none rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-[#d4af37]/50" />
                  </div>
                  <button type="button" onClick={updateLocation} className="p-3 bg-[#0a0e17] rounded-xl border border-white/5 text-[#d4af37] hover:border-[#d4af37]/30 transition-all"><MapPin size={14} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Firebase Cloud Messaging Push Section */}
        <div className="p-6 bg-gradient-to-br from-[#1c2431] to-[#0f172a] border border-[#d4af37]/30 rounded-3xl space-y-4 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#d4af37]/15 rounded-2xl text-[#d4af37] border border-[#d4af37]/30 shadow-md">
                <Smartphone size={24} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  Notificações Push Firebase (FCM)
                  <span className="text-[7px] bg-[#d4af37] text-black px-1.5 py-0.5 rounded font-mono uppercase font-black">
                    App Fechado
                  </span>
                </h3>
                <p className="text-[10px] text-white/50 mt-0.5 leading-relaxed">
                  Receba alertas na tela do celular mesmo se o app ou navegador estiver totalmente fechado.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsFCMModalOpen(true)}
            className="w-full py-4 bg-[#d4af37] text-black font-black uppercase text-xs tracking-widest rounded-2xl shadow-lg shadow-[#d4af37]/20 hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <Bell size={16} />
            Configurar e Testar Alertas Push
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d4af37]/10 rounded-lg text-[#d4af37]"><Clock size={20} /></div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Horário do Lembrete</h3>
          </div>
          
          <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
            {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
              <button
                key={hour}
                onClick={() => setNotificationHour(hour)}
                className={`
                  py-3 rounded-xl font-black text-xs transition-all border
                  ${notificationHour === hour 
                    ? 'bg-[#d4af37] border-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20' 
                    : 'bg-[#0a0e17] border-white/5 text-white/40 hover:border-white/20'
                  }
                `}
              >
                {hour.toString().padStart(2, '0')}:00
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d4af37]/10 rounded-lg text-[#d4af37]"><Calendar size={20} /></div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Dias da Semana</h3>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {daysOfWeek.map((day) => {
              const isSelected = notificationDays.includes(day.id);
              return (
                <button
                  key={day.id}
                  onClick={() => toggleDay(day.id)}
                  className={`
                    px-6 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all border
                    ${isSelected 
                      ? 'bg-[#d4af37] border-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20' 
                      : 'bg-[#0a0e17] border-white/5 text-white/40 hover:border-white/20'
                    }
                  `}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        <button 
          onClick={saveSettings}
          disabled={saving}
          className="w-full mt-4 bg-[#d4af37] hover:bg-[#b8962d] text-black py-5 rounded-2xl font-black uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-[#d4af37]/20 text-xs"
        >
          <Save size={18} />
          {saving ? 'Salvando...' : 'Salvar Preferências'}
        </button>
      </div>

      <div className="p-6 rounded-2xl border border-white/5 text-center transition-colors bg-[#0a0e17]">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] leading-relaxed text-white/20">
          Os alertas serão enviados apenas se houver pendência no registro de ponto para o dia atual no horário selecionado.
        </p>
      </div>

      <FCMPushModal 
        isOpen={isFCMModalOpen} 
        onClose={() => setIsFCMModalOpen(false)} 
        userId={userId} 
      />
    </div>
  );
}
