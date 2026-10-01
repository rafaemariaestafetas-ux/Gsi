import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Profile, Message, Block } from '../types';
import { X, Send, Search, ArrowLeft, Loader2, MessageSquare, ShieldAlert, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface MessengerProps {
  onClose: () => void;
  currentUserId: string;
  onlineUsers: Map<string, any>;
}

export default function Messenger({ onClose, currentUserId, onlineUsers }: MessengerProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blockedBy, setBlockedBy] = useState<Block[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const isUserBlocked = selectedUser ? blocks.some(b => b.blocked_id === selectedUser.id) : false;
  const amIBlocked = selectedUser ? blockedBy.some(b => b.blocker_id === selectedUser.id) : false;

  // Sound effects
  const playSendSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    audio.volume = 0.2;
    audio.play().catch(() => {});
  };

  const playReceiveSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    audio.volume = 0.2;
    audio.play().catch(() => {});
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([
      fetchProfiles(),
      fetchBlocks()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedUser) {
      fetchMessages();
      const channel = supabase
        .channel(`chat-realtime-${currentUserId}-${selectedUser.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          table: 'messages',
          filter: `receiver_id=eq.${currentUserId}`
        }, (payload) => {
          if (payload.new.sender_id === selectedUser.id) {
            fetchMessages();
            playReceiveSound();
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedUser]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', currentUserId);
    if (data) setProfiles(data);
  };

  const fetchBlocks = async () => {
    const [myBlocks, usersWhoBlockedMe] = await Promise.all([
      supabase.from('blocks').select('*').eq('blocker_id', currentUserId),
      supabase.from('blocks').select('*').eq('blocked_id', currentUserId)
    ]);

    if (myBlocks.data) setBlocks(myBlocks.data);
    if (usersWhoBlockedMe.data) setBlockedBy(usersWhoBlockedMe.data);
  };

  const toggleBlock = async () => {
    if (!selectedUser) return;

    if (isUserBlocked) {
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', selectedUser.id);
      
      if (!error) {
        setBlocks(prev => prev.filter(b => b.blocked_id !== selectedUser.id));
      }
    } else {
      if (!confirm(`Deseja bloquear ${selectedUser.full_name}? Você não receberá mais mensagens deste usuário.`)) return;
      
      const { data, error } = await supabase
        .from('blocks')
        .insert([{
          blocker_id: currentUserId,
          blocked_id: selectedUser.id
        }])
        .select();

      if (!error && data) {
        setBlocks(prev => [...prev, data[0]]);
      }
    }
  };

  const fetchMessages = async () => {
    if (!selectedUser) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true });
    
    if (data) setMessages(data);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || isUserBlocked || amIBlocked) return;
    
    const messageData = {
      content: newMessage,
      sender_id: currentUserId,
      receiver_id: selectedUser.id
    };

    const { error } = await supabase.from('messages').insert([messageData]);
    if (!error) {
      setNewMessage('');
      fetchMessages();
      playSendSound();
    }
  };

  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = p.full_name.toLowerCase().includes(search.toLowerCase());
    // Optionally hide users who blocked you, but usually they are just shown as offline or with limited interaction
    return matchesSearch;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="fixed inset-0 z-[100] bg-[#0a0e17] flex flex-col md:inset-auto md:right-6 md:bottom-24 md:w-[400px] md:h-[600px] md:rounded-[2.5rem] md:border md:border-white/10 md:shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="bg-[#1c2431] p-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          {selectedUser ? (
            <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-white/5 rounded-full text-white/40">
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div className="p-2 bg-[#0084ff]/10 text-[#0084ff] rounded-full">
              <MessageSquare size={20} />
            </div>
          )}
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              {selectedUser ? selectedUser.full_name : 'Messenger GSI'}
            </h3>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              {selectedUser ? (isUserBlocked ? 'Usuário Bloqueado' : selectedUser.role) : 'Conversas Privadas'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedUser && (
            <button 
              onClick={toggleBlock}
              className={`p-2 rounded-full transition-colors ${isUserBlocked ? 'text-red-500 bg-red-500/10' : 'text-white/20 hover:text-red-500 hover:bg-red-500/5'}`}
              title={isUserBlocked ? "Desbloquear" : "Bloquear"}
            >
              {isUserBlocked ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
            </button>
          )}
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40 transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {!selectedUser ? (
          /* User List */
          <div className="flex-1 flex flex-col p-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
              <input 
                type="text" 
                placeholder="Buscar colega..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0a0e17] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-[#0084ff]/50 transition-all"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="animate-spin text-[#0084ff]" size={32} />
                </div>
              ) : filteredProfiles.map(p => {
                const isBlocked = blocks.some(b => b.blocked_id === p.id);
                return (
                  <button 
                    key={p.id}
                    onClick={() => setSelectedUser(p)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all text-left group"
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full border-2 border-white/10 p-0.5 overflow-hidden">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <div className="w-full h-full bg-[#1c2431] flex items-center justify-center text-white/20 font-black">
                            {p.full_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {isBlocked && (
                          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                            <ShieldAlert size={20} className="text-red-500" />
                          </div>
                        )}
                      </div>
                      {!isBlocked && (
                        <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-4 border-[#0a0e17] rounded-full ${onlineUsers.has(p.id) ? 'bg-green-500 animate-pulse' : 'bg-white/10'}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-xs font-black uppercase transition-colors ${isBlocked ? 'text-white/20' : 'text-white group-hover:text-[#0084ff]'}`}>{p.full_name}</h4>
                        {!isBlocked && onlineUsers.has(p.id) && <span className="text-[7px] font-black text-green-500 uppercase tracking-tighter">Online</span>}
                        {isBlocked && <span className="text-[7px] font-black text-red-500/40 uppercase tracking-tighter">Bloqueado</span>}
                      </div>
                      <p className="text-[10px] font-bold text-white/40 uppercase truncate">{p.role} • {p.location_city || 'Portugal'}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Chat Window */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"
            >
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === currentUserId;
                return (
                  <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] space-y-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`px-4 py-3 rounded-2xl text-xs font-bold ${isMe ? 'bg-[#0084ff] text-white rounded-tr-none' : 'bg-[#1c2431] text-white/90 rounded-tl-none'}`}>
                        {msg.content}
                      </div>
                      <span className="text-[8px] font-black text-white/20 uppercase">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center opacity-20">
                  <MessageSquare size={48} className="mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">Comece uma conversa com<br/>{selectedUser.full_name}</p>
                </div>
              )}
            </div>

            {isUserBlocked || amIBlocked ? (
              <div className="p-8 bg-red-500/5 border-t border-red-500/10 text-center space-y-2">
                <ShieldAlert size={24} className="mx-auto text-red-500/40" />
                <p className="text-[9px] font-black text-red-500/40 uppercase tracking-widest">
                  {isUserBlocked ? 'Você bloqueou este usuário' : 'Você não pode enviar mensagens para este usuário'}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-[#1c2431]/50 border-t border-white/5 flex gap-2">
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Aa"
                  className="flex-1 bg-[#0a0e17] border-none rounded-full px-6 py-3 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-[#0084ff]/50"
                />
                <button 
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="w-12 h-12 bg-[#0084ff] text-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
