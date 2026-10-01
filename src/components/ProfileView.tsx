import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Profile, TimeEntry } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { User, LogOut, Save, Phone, Euro, HardHat, Settings, Briefcase, Camera, Upload, Loader2, Calendar as CalendarIcon, MapPin, ChevronRight, Home as HomeIcon, Download, ChevronLeft, X, Clock, Trash2 } from 'lucide-react';
import SettingsView from './SettingsView';
import ReportTemplate from './ReportTemplate';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toJpeg } from 'html-to-image';

export default function ProfileView({ 
  userId, 
  isDarkMode = true,
  onProfileUpdate 
}: { 
  userId: string, 
  isDarkMode?: boolean,
  onProfileUpdate?: (profile: Partial<Profile>) => void 
}) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [exporting, setExporting] = useState(false);
  const [selectedDayEntry, setSelectedDayEntry] = useState<{ day: number, entry?: TimeEntry } | null>(null);
  const [editHours, setEditHours] = useState('8');
  const [editObra, setEditObra] = useState('');
  const [editIsAbsence, setEditIsAbsence] = useState(false);
  const [editAbsenceReason, setEditAbsenceReason] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getProfile();
    getEntries();
  }, [userId, viewDate]);

  const getProfile = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setProfile(data);
      setEditObra(data.current_obra || '');
    }
    setLoading(false);
  };

  const getEntries = async () => {
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('month', viewDate.getMonth())
      .eq('year', viewDate.getFullYear())
      .order('day', { ascending: false });

    if (data) setEntries(data);
  };

  const handleDayClick = (day: number, entry?: TimeEntry) => {
    setSelectedDayEntry({ day, entry });
    setEditHours(entry ? entry.hours : '8');
    setEditObra(entry?.obra || profile?.current_obra || '');
    setEditIsAbsence(entry?.is_absence || false);
    setEditAbsenceReason(entry?.absence_reason || '');
  };

  const saveEntryEdit = async () => {
    if (!selectedDayEntry) return;
    setSavingEdit(true);
    
    const newEntry = {
      user_id: userId,
      day: selectedDayEntry.day,
      month: viewDate.getMonth(),
      year: viewDate.getFullYear(),
      hours: editIsAbsence ? '0' : editHours,
      obra: editIsAbsence ? 'FALTA' : (editObra.toUpperCase() || 'OBRA NÃO DEFINIDA'),
      description: profile?.role?.toUpperCase() || 'OFICIAL',
      is_absence: editIsAbsence,
      absence_reason: editIsAbsence ? editAbsenceReason : ''
    };

    try {
      // Delete existing for that day if any
      await supabase
        .from('time_entries')
        .delete()
        .eq('user_id', userId)
        .eq('day', selectedDayEntry.day)
        .eq('month', viewDate.getMonth())
        .eq('year', viewDate.getFullYear());

      // Insert if not just a deletion (0 hours without absence)
      if (editHours !== '0' || editIsAbsence) {
        await supabase.from('time_entries').insert([newEntry]);
      }
      
      await getEntries();
      setSelectedDayEntry(null);
    } catch (err) {
      alert('Erro ao salvar alteração');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteEntry = async () => {
    if (!selectedDayEntry?.entry) return;
    setSavingEdit(true);
    try {
      await supabase
        .from('time_entries')
        .delete()
        .eq('id', selectedDayEntry.entry.id);
      
      await getEntries();
      setSelectedDayEntry(null);
    } catch (err) {
      alert('Erro ao excluir registro');
    } finally {
      setSavingEdit(false);
    }
  };

  const generateJPG = async () => {
    if (!reportRef.current) return;
    
    try {
      setExporting(true);
      const dataUrl = await toJpeg(reportRef.current, { 
        quality: 0.95,
        backgroundColor: '#ffffff',
        width: 794, // approx 210mm at 96dpi
        height: 1123 // approx 297mm at 96dpi
      });
      
      const link = document.createElement('a');
      link.download = `Folha_Ponto_${format(viewDate, 'MM_yyyy')}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao gerar JPG:', err);
      alert('Erro ao gerar o relatório. Tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Deseja sair da conta?')) {
      try {
        await supabase.auth.signOut();
        // Force reload to clear all states and redirect to login
        window.location.href = '/';
      } catch (err) {
        console.error('Logout failed:', err);
        window.location.reload();
      }
    }
  };

  // Calendar Helpers
  const days = eachDayOfInterval({
    start: startOfMonth(viewDate),
    end: endOfMonth(viewDate)
  });

  const totalHours = entries.reduce((acc, curr) => {
    if (!curr.hours) return acc;
    if (curr.hours.includes(':')) {
      const [h, m] = curr.hours.split(':').map(Number);
      return acc + (isNaN(h) ? 0 : h) + (isNaN(m) ? 0 : m / 60);
    }
    return acc + Number(curr.hours);
  }, 0);
  const totalPayment = totalHours * (profile?.hourly_rate || 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-[#d4af37]" size={32} />
    </div>
  );

  return (
    <div className="pb-20">
      <AnimatePresence mode="wait">
        {!showSettings ? (
          <motion.div
            key="profile-dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-2xl mx-auto space-y-8"
          >
            {/* Header Dashboard */}
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Seu Perfil</h2>
              <button 
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-white/5 text-[#d4af37] hover:bg-[#d4af37] hover:text-black"
              >
                <Settings size={14} /> Configurações
              </button>
            </div>

            {/* Profile Info Card (Clean View) */}
            <div className="bg-[#1c2431]/60 border border-white/5 rounded-[2.5rem] p-10 flex flex-col items-center text-center space-y-6 shadow-2xl relative overflow-hidden">
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-4 border-[#d4af37] p-1 shadow-2xl">
                  <div className="w-full h-full rounded-full overflow-hidden border border-white/10">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#0a0e17] flex items-center justify-center text-white/20 text-4xl font-black">
                        {profile?.full_name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-3xl font-black text-white tracking-tighter uppercase">{profile?.full_name}</h3>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="bg-[#d4af37] text-black text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                    {profile?.role}
                  </span>
                  {profile?.location_city && (
                    <span className="bg-white/5 border border-white/10 text-white/40 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
                      <HomeIcon size={10} className="text-[#d4af37]" /> {profile.location_city}
                    </span>
                  )}
                </div>
              </div>

              <div className="w-full grid grid-cols-2 gap-4 pt-4">
                <div className="bg-[#0a0e17] p-4 rounded-2xl border border-white/5 space-y-1">
                  <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Horas no Mês</p>
                  <p className="text-xl font-black text-[#d4af37] flex items-center justify-center gap-2">
                    <Clock size={16} /> {totalHours.toFixed(1)}h
                  </p>
                </div>
                <div className="bg-[#0a0e17] p-4 rounded-2xl border border-white/5 space-y-1">
                  <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Previsto Receber</p>
                  <p className="text-xl font-black text-white flex items-center justify-center gap-2">
                    <Euro size={16} className="text-[#d4af37]" /> 
                    {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(totalPayment)}
                  </p>
                </div>

                <div className="bg-[#0a0e17] p-4 rounded-2xl border border-white/5 space-y-1">
                  <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Obra Atual</p>
                  <p className="text-xs font-black text-white/60 truncate flex items-center justify-center gap-2">
                    <Briefcase size={12} /> {profile?.current_obra || 'Sem obra'}
                  </p>
                </div>
                <div className="bg-[#0a0e17] p-4 rounded-2xl border border-white/5 space-y-1">
                  <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Contacto</p>
                  <p className="text-xs font-black text-white/60 flex items-center justify-center gap-2">
                    <Phone size={12} className="text-[#d4af37]" /> {profile?.phone || 'Privado'}
                  </p>
                </div>
              </div>
            </div>

            {/* Work Timeline / Calendar View */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h4 className="text-xs font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-2">
                  <CalendarIcon size={14} className="text-[#d4af37]" /> Histórico Mensal
                </h4>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-[#1c2431] rounded-xl border border-white/5 p-1">
                    <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-2 hover:text-[#d4af37] transition-colors text-white/40"><ChevronLeft size={16} /></button>
                    <span className="text-[10px] font-black text-white uppercase px-4 min-w-[120px] text-center">
                      {format(viewDate, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                    <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-2 hover:text-[#d4af37] transition-colors text-white/40"><ChevronRight size={16} /></button>
                  </div>
                  
                  <button 
                    onClick={generateJPG}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-3 bg-[#d4af37] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#d4af37]/20 disabled:opacity-50"
                  >
                    <Download size={14} /> {exporting ? 'Gerando...' : 'JPG'}
                  </button>
                </div>
              </div>

              {/* Grid Calendar Mini */}
              <div className="bg-[#1c2431]/40 border border-white/5 rounded-3xl p-6">
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                    <span key={d} className="text-[8px] font-black text-white/20 uppercase text-center">{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {/* Empty cells for padding */}
                  {Array.from({ length: getDay(startOfMonth(viewDate)) }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  {days.map((day) => {
                    const entry = entries.find(e => e.day === day.getDate());
                    return (
                      <button 
                        key={day.toISOString()}
                        onClick={() => handleDayClick(day.getDate(), entry)}
                        className={`aspect-square rounded-lg flex flex-col items-center justify-center relative border transition-all active:scale-95 ${entry ? (entry.is_absence ? 'bg-red-500/20 border-red-500/50' : 'bg-[#d4af37]/20 border-[#d4af37]/50') : 'bg-[#0a0e17] border-white/5 hover:border-white/20'}`}
                      >
                        <span className={`text-[10px] font-black ${entry ? 'text-white' : 'text-white/20'}`}>{day.getDate()}</span>
                        {entry && (
                          <span className={`text-[6px] font-black mt-0.5 ${entry.is_absence ? 'text-red-500' : 'text-[#d4af37]'}`}>
                            {entry.is_absence ? 'FALTA' : `${entry.hours}h`}
                          </span>
                        )}
                        {isSameDay(day, new Date()) && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border-2 border-[#1c2431] shadow-lg" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Edit Day Modal */}
              <AnimatePresence>
                {selectedDayEntry && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
                    onClick={() => setSelectedDayEntry(null)}
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      className="w-full max-w-sm bg-[#1c2431] border border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <h3 className="text-xl font-black text-white uppercase tracking-tighter">Editar Dia {selectedDayEntry.day}</h3>
                          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{format(viewDate, 'MMMM yyyy', { locale: ptBR })}</p>
                        </div>
                        <button onClick={() => setSelectedDayEntry(null)} className="p-2 text-white/20 hover:text-white transition-colors"><X size={24} /></button>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-4 bg-[#0a0e17] p-4 rounded-2xl border border-white/5">
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Registrar Falta?</p>
                            <p className="text-[8px] font-bold text-white/20 uppercase tracking-tighter">O dia será marcado como ausente</p>
                          </div>
                          <button 
                            onClick={() => setEditIsAbsence(!editIsAbsence)}
                            className={`w-12 h-6 rounded-full transition-all relative ${editIsAbsence ? 'bg-red-500' : 'bg-white/10'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${editIsAbsence ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>

                        {!editIsAbsence ? (
                          <>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Horas Trabalhadas</label>
                              <div className="relative">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#d4af37]" size={16} />
                                <input 
                                  type="text" 
                                  value={editHours} 
                                  onChange={(e) => setEditHours(e.target.value)}
                                  className="w-full bg-[#0a0e17] border-none rounded-2xl p-4 pl-12 text-sm font-black text-white outline-none focus:ring-2 focus:ring-[#d4af37]/20"
                                  placeholder="Ex: 8"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Nome da Obra</label>
                              <div className="relative">
                                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-[#d4af37]" size={16} />
                                <input 
                                  type="text" 
                                  value={editObra} 
                                  onChange={(e) => setEditObra(e.target.value)}
                                  className="w-full bg-[#0a0e17] border-none rounded-2xl p-4 pl-12 text-sm font-black text-white outline-none focus:ring-2 focus:ring-[#d4af37]/20 uppercase"
                                  placeholder="Nome da Obra"
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Motivo da Falta</label>
                            <textarea 
                              value={editAbsenceReason} 
                              onChange={(e) => setEditAbsenceReason(e.target.value)}
                              className="w-full bg-[#0a0e17] border-none rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-red-500/20 min-h-[100px] resize-none"
                              placeholder="Descreva o motivo (Ex: Doença, Assuntos Pessoais...)"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 pt-4">
                        {selectedDayEntry.entry && (
                          <button 
                            onClick={deleteEntry}
                            className="flex-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white py-4 rounded-2xl transition-all flex items-center justify-center"
                            title="Excluir"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                        <button 
                          onClick={saveEntryEdit}
                          disabled={savingEdit}
                          className="flex-[3] bg-[#d4af37] hover:bg-[#b8962d] text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#d4af37]/20"
                        >
                          <Save size={18} /> {savingEdit ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-3">
                {entries.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`group border rounded-2xl p-5 flex items-center justify-between transition-all cursor-pointer ${entry.is_absence ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20' : 'bg-[#1c2431]/40 border-white/5 hover:bg-[#1c2431]/60'}`}
                    onClick={() => handleDayClick(entry.day, entry)}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center ${entry.is_absence ? 'bg-red-500/20 border-red-500/30' : 'bg-[#0a0e17] border-white/5'}`}>
                        <span className="text-sm font-black text-white">{entry.day.toString().padStart(2, '0')}</span>
                        <span className={`text-[7px] font-black uppercase tracking-tighter ${entry.is_absence ? 'text-red-400' : 'text-[#d4af37]'}`}>
                          {format(new Date(entry.year, entry.month, entry.day), 'EEE', { locale: ptBR })}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className={`text-[10px] font-black uppercase tracking-widest ${entry.is_absence ? 'text-red-500' : 'text-white'}`}>
                          {entry.is_absence ? 'FALTA REGISTRADA' : entry.obra}
                        </p>
                        <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest flex items-center gap-1">
                          {entry.is_absence ? (
                            <>Motivo: {entry.absence_reason || 'Não informado'}</>
                          ) : (
                            <><MapPin size={8} /> Local Registrado • {profile?.location_city || 'GPS'}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div className="space-y-0.5">
                        <p className={`text-xl font-black tracking-tighter ${entry.is_absence ? 'text-red-500' : 'text-[#d4af37]'}`}>
                          {entry.is_absence ? '0h' : `${entry.hours}h`}
                        </p>
                        <p className="text-[7px] font-black text-white/20 uppercase tracking-widest">
                          {entry.is_absence ? 'AUSÊNCIA' : 'Carga Diária'}
                        </p>
                      </div>
                      <ChevronRight size={16} className={`text-white/10 transition-colors ${entry.is_absence ? 'group-hover:text-red-500' : 'group-hover:text-[#d4af37]'}`} />
                    </div>
                  </motion.div>
                ))}

                {entries.length === 0 && (
                  <div className="py-20 text-center rounded-[2rem] border border-dashed border-white/5 bg-white/[0.02]">
                    <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.4em]">Sem registros este mês</p>
                  </div>
                )}
              </div>
            </div>

            {/* Logout Button */}
            <button 
              onClick={handleLogout}
              className="w-full py-6 rounded-[2rem] border border-red-500/10 bg-red-500/5 text-red-500/40 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-3"
            >
              <LogOut size={16} /> Sair do Sistema GSI
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="settings-view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <SettingsView 
              userId={userId} 
              isDarkMode={isDarkMode}
              onBack={() => {
                setShowSettings(false);
                getProfile(); // Refresh profile after settings change
              }}
              onUpdate={(updates) => {
                setProfile(prev => prev ? { ...prev, ...updates } : null);
                if (onProfileUpdate) onProfileUpdate(updates);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden Report Template for Exporting */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div ref={reportRef}>
          {profile && (
            <ReportTemplate 
              userName={profile.full_name}
              userRole={profile.role}
              month={viewDate.getMonth()}
              year={viewDate.getFullYear()}
              entries={entries}
              totalHours={totalHours}
              totalPayment={totalPayment}
            />
          )}
        </div>
      </div>
    </div>
  );
}
