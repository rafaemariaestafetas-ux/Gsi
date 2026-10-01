import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Announcement } from '../types';
import { Megaphone, Send, Trash2, Loader2, AlertTriangle, Plus, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AnnouncementBoardProps {
  isAdmin: boolean;
  userId: string;
  userName: string;
}

export default function AnnouncementBoard({ isAdmin, userId, userName }: AnnouncementBoardProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState('Notification' in window && Notification.permission === 'granted');

  useEffect(() => {
    fetchAnnouncements();
    
    // Real-time subscription
    const channel = supabase
      .channel('announcements-changes')
      .on('postgres_changes', { event: 'INSERT', table: 'announcements', schema: 'public' }, (payload) => {
        const newAnn = payload.new as Announcement;
        fetchAnnouncements();
        
        // Push notification
        if ('Notification' in window && Notification.permission === 'granted' && newAnn.user_id !== userId) {
          new Notification('Novo Aviso GSI! 📢', {
            body: `${newAnn.author_name}: ${newAnn.content.substring(0, 100)}${newAnn.content.length > 100 ? '...' : ''}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/5977/5977591.png',
            tag: 'announcement',
            vibrate: [200, 100, 200]
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
  };

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);

    if (data) setAnnouncements(data);
    setLoading(false);
  };

  const postAnnouncement = async () => {
    if (!newContent.trim()) return;
    setIsPosting(true);
    
    const { error } = await supabase.from('announcements').insert([{
      content: newContent,
      user_id: userId,
      author_name: userName
    }]);

    if (!error) {
      setNewContent('');
      setShowEditor(false);
      fetchAnnouncements();
    }
    setIsPosting(false);
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Excluir este aviso?')) return;
    await supabase.from('announcements').delete().eq('id', id);
    fetchAnnouncements();
  };

  if (loading && announcements.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-2">
            <Megaphone size={14} className="text-amber-500 animate-pulse" /> Quadro de Avisos
          </h3>
          {!notificationsEnabled && 'Notification' in window && (
            <button 
              onClick={requestNotificationPermission}
              className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 text-red-500 rounded-md text-[8px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
            >
              <Bell size={10} /> Ativar Alertas
            </button>
          )}
        </div>
        {isAdmin && (
          <button 
            onClick={() => setShowEditor(!showEditor)}
            className="p-2 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500 hover:text-black transition-all"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showEditor && isAdmin && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[#1c2431] border border-amber-500/30 rounded-2xl p-4 space-y-4 shadow-lg shadow-amber-500/5">
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Digite o aviso importante aqui..."
                className="w-full bg-[#0a0e17] border-none rounded-xl p-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-amber-500/50 min-h-[100px] resize-none"
              />
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setShowEditor(false)}
                  className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={postAnnouncement}
                  disabled={isPosting || !newContent.trim()}
                  className="flex items-center gap-2 px-6 py-2 bg-amber-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {isPosting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} 
                  Publicar Aviso
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {announcements.map((ann, idx) => (
          <motion.div
            key={ann.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="relative bg-gradient-to-r from-amber-500/10 to-transparent border-l-4 border-amber-500 rounded-r-2xl p-5 shadow-xl group"
          >
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <p className="text-[8px] font-black text-amber-500/60 uppercase tracking-widest">Aviso Oficial GSI • {format(new Date(ann.created_at), "dd MMM HH:mm", { locale: ptBR })}</p>
                </div>
                <p className="text-xs font-bold text-white/90 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                <div className="pt-1">
                  <span className="text-[9px] font-black text-white/20 uppercase tracking-tighter">Publicado por {ann.author_name}</span>
                </div>
              </div>
              
              {isAdmin && (
                <button 
                  onClick={() => deleteAnnouncement(ann.id!)}
                  className="p-2 text-white/10 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            
            {/* Pulsing effect for the most recent announcement */}
            {idx === 0 && (
              <div className="absolute top-2 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </div>
            )}
          </motion.div>
        ))}

        {announcements.length === 0 && !loading && (
          <div className="py-12 text-center rounded-[2rem] border border-dashed border-white/5 bg-white/[0.02]">
            <AlertTriangle size={24} className="mx-auto text-white/10 mb-2" />
            <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">Nenhum aviso importante no momento</p>
          </div>
        )}
      </div>
    </div>
  );
}
