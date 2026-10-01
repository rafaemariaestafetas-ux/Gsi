import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChatGroup, GroupMessage, GroupMember, MessageReaction, Profile } from '../types';
import { 
  Users, 
  MessageSquare, 
  Lock, 
  Globe, 
  Plus, 
  Search, 
  Send, 
  Image as ImageIcon, 
  Mic, 
  X, 
  MoreVertical, 
  Smile, 
  Trash2, 
  ArrowLeft,
  Loader2,
  Camera,
  Play,
  Pause
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { AudioPlayer } from './AudioPlayer';

interface GroupChatProps {
  currentUserId: string;
  userName: string;
  userAvatar?: string;
  isDarkMode?: boolean;
  onToggleImmersive?: (isOpen: boolean) => void;
}

export default function GroupChat({ currentUserId, userName, userAvatar, isDarkMode = true, onToggleImmersive }: GroupChatProps) {
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [reactions, setReactions] = useState<Record<string, MessageReaction[]>>({});
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [groupMembers, setGroupMembers] = useState<(GroupMember & { profiles: Profile })[]>([]);
  const [userMemberships, setUserMemberships] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Group creation form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupRules, setNewGroupRules] = useState('1. Respeite os colegas.\n2. Use apenas para fins profissionais.\n3. Evite SPAM.');
  const [newGroupCover, setNewGroupCover] = useState('https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=800');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Chat form
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupCoverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    onToggleImmersive?.(!!selectedGroup);
    if (selectedGroup) {
      fetchMessages();
      fetchGroupMembers();
      const channel = supabase
        .channel(`group-${selectedGroup.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          table: 'group_messages',
          filter: `group_id=eq.${selectedGroup.id}`
        }, (payload) => {
          fetchMessages();
        })
        .on('postgres_changes', {
          event: '*',
          table: 'message_reactions'
        }, () => {
          fetchReactions();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedGroup]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const { data: membershipData, error: memError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', currentUserId);
      
      if (memError) throw memError;
      
      const membershipSet = new Set(membershipData?.map(m => m.group_id) || []);
      setUserMemberships(membershipSet);

      const { data, error } = await supabase
        .from('chat_groups')
        .select('*, group_members(count)');

      if (error) throw error;

      if (data) {
        setGroups(data.map(g => ({
          ...g,
          member_count: g.group_members[0]?.count || 0
        })));
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
      // Fallback: at least show groups even if membership check fails
      const { data } = await supabase.from('chat_groups').select('*, group_members(count)');
      if (data) {
        setGroups(data.map(g => ({
          ...g,
          member_count: g.group_members[0]?.count || 0
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!selectedGroup) return;
    try {
      const { data, error } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', selectedGroup.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      if (data) {
        setMessages(data);
        fetchReactions();
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const fetchGroupMembers = async () => {
    if (!selectedGroup) return;
    try {
      // First get user IDs of members
      const { data: members, error: mError } = await supabase
        .from('group_members')
        .select('user_id, role')
        .eq('group_id', selectedGroup.id);
      
      if (mError) throw mError;
      
      if (members && members.length > 0) {
        const userIds = members.map(m => m.user_id);
        // Then fetch their public profiles
        const { data: profiles, error: pError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role')
          .in('id', userIds);
          
        if (pError) throw pError;
        
        const combined = members.map(m => ({
          ...m,
          profiles: profiles?.find(p => p.id === m.user_id) || { full_name: 'Usuário', role: 'Membro' }
        }));
        setGroupMembers(combined as any);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  const fetchReactions = async () => {
    if (!selectedGroup || messages.length === 0) return;
    const messageIds = messages.map(m => m.id);
    const { data } = await supabase
      .from('message_reactions')
      .select('*')
      .in('message_id', messageIds);
    
    if (data) {
      const reactionMap: Record<string, MessageReaction[]> = {};
      data.forEach(r => {
        if (!reactionMap[r.message_id]) reactionMap[r.message_id] = [];
        reactionMap[r.message_id].push(r);
      });
      setReactions(reactionMap);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newGroupName.trim()) {
      alert('O nome do grupo é obrigatório.');
      return;
    }

    setIsUploading(true);
    
    try {
      let finalCoverUrl = newGroupCover;

      // Se houver um arquivo selecionado, faz o upload para o Storage primeiro
      if (coverFile) {
        const fileExt = coverFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `group-covers/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, coverFile);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
          finalCoverUrl = publicUrl;
        }
      }

      const groupData: any = {
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || 'Sem descrição',
        cover_url: finalCoverUrl,
        is_private: isPrivate,
        created_by: currentUserId
      };

      // Only add rules if it's not empty, to avoid potential schema errors
      if (newGroupRules.trim()) {
        groupData.rules = newGroupRules.trim();
      }

      const { data, error } = await supabase
        .from('chat_groups')
        .insert([groupData])
        .select();
      
      if (error) throw error;

      if (data && data[0]) {
        // Vincula o criador como administrador
        const { error: memberError } = await supabase
          .from('group_members')
          .insert([{
            group_id: data[0].id,
            user_id: currentUserId,
            role: 'admin'
          }]);

        if (memberError) console.error('Erro ao vincular membro:', memberError);

        setNewGroupName('');
        setNewGroupDesc('');
        setCoverFile(null);
        setCoverPreview(null);
        setIsCreatingGroup(false);
        fetchGroups();
        alert('Grupo criado com sucesso!');
      }
      
    } catch (error: any) {
      console.error('Erro ao criar grupo:', error);
      alert(`Erro: ${error.message || 'Não foi possível criar o grupo.'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (type: 'text' | 'image' | 'audio' = 'text', mediaUrl?: string) => {
    if (!selectedGroup) return;
    if (type === 'text' && !newMessage.trim()) return;

    try {
      const messageData = {
        group_id: selectedGroup.id,
        sender_id: currentUserId,
        content: type === 'text' ? newMessage : '',
        type,
        media_url: mediaUrl,
        sender_name: userName
      };

      const { error } = await supabase.from('group_messages').insert([messageData]);
      
      if (error) {
        console.error('Error sending message:', error);
        alert('Erro ao enviar mensagem: ' + error.message);
        return;
      }

      setNewMessage('');
      setAudioBlob(null);
      fetchMessages();
    } catch (err: any) {
      console.error('Send error:', err);
      alert('Erro inesperado ao enviar.');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedGroup) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `group-media/${selectedGroup.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      handleSendMessage('image', publicUrl);
    } else {
      alert('Erro ao carregar imagem.');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Better MIME type detection for mobile compatibility (iOS/Android)
      // iOS prefers audio/mp4 or audio/aac
      // Android prefers audio/webm
      const types = [
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/aac',
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/wav'
      ];
      
      let mimeType = '';
      for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || 'audio/wav' });
        setAudioBlob(blob);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      alert('Permissão de microfone negada ou erro ao iniciar gravação.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const sendAudio = async () => {
    if (!audioBlob || !selectedGroup) return;

    setIsUploading(true);
    try {
      const extension = audioBlob.type.includes('webm') ? 'webm' : audioBlob.type.includes('ogg') ? 'ogg' : 'wav';
      const fileName = `audio_${Date.now()}.${extension}`;
      const filePath = `group-audio/${selectedGroup.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, audioBlob, {
          contentType: audioBlob.type,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      await handleSendMessage('audio', publicUrl);
      setAudioBlob(null);
    } catch (err) {
      console.error('Audio upload error:', err);
      alert('Erro ao enviar áudio. Verifique sua conexão.');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteGroup = async () => {
    if (!selectedGroup || selectedGroup.created_by !== currentUserId) return;
    if (!confirm('Tem certeza que deseja EXCLUIR este grupo permanentemente?')) return;

    try {
      const { error } = await supabase
        .from('chat_groups')
        .delete()
        .eq('id', selectedGroup.id);
      
      if (error) throw error;
      
      setSelectedGroup(null);
      fetchGroups();
      alert('Grupo excluído com sucesso.');
    } catch (err) {
      alert('Erro ao excluir grupo.');
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    const { error } = await supabase.from('message_reactions').insert([{
      message_id: messageId,
      user_id: currentUserId,
      emoji
    }]);
    if (!error) fetchReactions();
  };

  const fetchAllProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) setAllProfiles(data);
  };

  const addMember = async (userId: string) => {
    if (!selectedGroup) return;
    const { error } = await supabase.from('group_members').insert([{
      group_id: selectedGroup.id,
      user_id: userId,
      role: 'member'
    }]);
    
    if (error) {
      if (error.code === '23505') alert('Este usuário já faz parte do grupo.');
      else alert('Erro ao adicionar membro.');
    } else {
      fetchGroups();
      fetchGroupMembers();
      alert('Membro adicionado!');
    }
  };

  const leaveGroup = async () => {
    if (!selectedGroup) return;
    if (selectedGroup.created_by === currentUserId) {
      alert('O administrador não pode sair do grupo. Exclua o grupo se desejar encerrá-lo.');
      return;
    }
    
    if (!confirm('Tem certeza que deseja sair deste grupo?')) return;

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', selectedGroup.id)
        .eq('user_id', currentUserId);
      
      if (error) throw error;

      // System message: X left the group
      await supabase.from('group_messages').insert([{
        group_id: selectedGroup.id,
        sender_id: currentUserId,
        content: `${userName} saiu do grupo.`,
        type: 'text',
        sender_name: 'Sistema'
      }]);

      setSelectedGroup(null);
      fetchGroups();
      alert('Você saiu do grupo.');
    } catch (err) {
      alert('Erro ao sair do grupo.');
    }
  };

  const joinPublicGroup = async (groupId: string) => {
    const { error } = await supabase.from('group_members').insert([{
      group_id: groupId,
      user_id: currentUserId,
      role: 'member'
    }]);
    if (!error) {
      fetchGroups();
      alert('Você entrou no grupo!');
    }
  };

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-[#0a0e17]">
      <AnimatePresence mode="wait">
        {!selectedGroup ? (
          <motion.div 
            key="group-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Grupos da Equipe</h2>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Comunidade GSI Pro</p>
              </div>
              <button 
                onClick={() => setIsCreatingGroup(true)}
                className="w-12 h-12 bg-[#d4af37] text-black rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#d4af37]/20"
              >
                <Plus size={24} />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <input 
                  type="text" 
                  placeholder="Pesquisar grupos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#1c2431]/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-[#d4af37]"
                />
              </div>
            </div>

              {/* Groups Grid */}
            <div className="flex-1 overflow-y-auto px-6 pb-10 grid grid-cols-1 md:grid-cols-2 gap-4">
              {loading ? (
                <div className="col-span-full flex items-center justify-center py-20">
                  <Loader2 className="animate-spin text-[#d4af37]" size={32} />
                </div>
              ) : filteredGroups.map(group => {
                const isMember = userMemberships.has(group.id);
                return (
                  <motion.div
                    key={group.id}
                    whileHover={{ y: -5 }}
                    onClick={() => {
                      if (isMember) setSelectedGroup(group);
                    }}
                    className={`bg-[#1c2431]/60 border border-white/5 rounded-[2rem] overflow-hidden group shadow-xl relative ${isMember ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="h-32 relative overflow-hidden">
                      <img src={group.cover_url} className={`w-full h-full object-cover transition-transform duration-500 ${isMember ? 'group-hover:scale-110' : 'grayscale opacity-30'}`} />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1c2431] to-transparent" />
                      
                      {/* Status Badges */}
                      <div className="absolute top-4 right-4 flex gap-2">
                        <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1">
                          {group.is_private ? <Lock size={10} className="text-amber-500" /> : <Globe size={10} className="text-blue-500" />}
                          <span className="text-[8px] font-black text-white uppercase">{group.is_private ? 'Privado' : 'Público'}</span>
                        </div>
                      </div>

                      {!isMember && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                          {group.is_private ? (
                            <div className="flex flex-col items-center gap-2">
                              <Lock className="text-[#d4af37]" size={24} />
                              <span className="text-[10px] font-black text-white uppercase tracking-widest">Acesso Restrito</span>
                            </div>
                          ) : (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                joinPublicGroup(group.id);
                              }}
                              className="px-6 py-2 bg-[#d4af37] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#d4af37]/20"
                            >
                              Entrar no Grupo
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-6">
                      <h3 className="text-lg font-black text-white uppercase tracking-tight mb-1 flex items-center gap-2">
                        {group.name}
                        {group.created_by === currentUserId && <span className="bg-[#d4af37]/20 text-[#d4af37] text-[7px] font-black px-1.5 py-0.5 rounded uppercase">Dono</span>}
                      </h3>
                      <p className="text-[10px] text-white/40 font-bold uppercase truncate mb-4">{group.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-[#d4af37] uppercase">{group.member_count} Membros</span>
                        </div>
                        {isMember && (
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-[#d4af37] group-hover:text-black transition-all">
                            <MessageSquare size={16} />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          /* Group Chat View - Immersive / Full Screen */
          <motion.div 
            key="chat-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#0c111d] md:relative md:inset-auto md:z-0 md:h-full"
          >
            {/* WhatsApp Background Pattern - Lighter & Clearer */}
            <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: '400px' }} />

            {/* Chat Header - Immersive */}
            <div className="safe-area-top pt-10 pb-4 px-6 bg-[#1c2431]/95 backdrop-blur-xl border-b border-white/5 flex items-center justify-between shadow-2xl relative z-10">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedGroup(null)} 
                  className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full text-white transition-all"
                >
                  <ArrowLeft size={24} />
                </button>
                <div 
                  className="flex items-center gap-3 cursor-pointer active:opacity-60 transition-all"
                  onClick={() => setShowGroupInfo(true)}
                >
                  <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[#d4af37]/30 shadow-lg relative">
                    <img src={selectedGroup.cover_url} className="w-full h-full object-cover" />
                    {selectedGroup.is_private && (
                      <div className="absolute top-0 right-0 p-0.5 bg-[#d4af37] rounded-bl-lg">
                        <Lock size={8} className="text-black" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider truncate max-w-[120px]">{selectedGroup.name}</h3>
                    <p className="text-[8px] font-bold text-[#d4af37] uppercase tracking-[0.2em]">{selectedGroup.member_count} Ativos • Ver Info</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {selectedGroup.created_by === currentUserId && (
                  <button 
                    onClick={deleteGroup}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    title="Excluir Grupo"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
                <button 
                  onClick={() => {
                    fetchAllProfiles();
                    setIsAddingMembers(true);
                  }}
                  className="p-2 bg-[#d4af37]/10 text-[#d4af37] rounded-xl hover:bg-[#d4af37] hover:text-black transition-all"
                  title="Convidar"
                >
                  <Plus size={20} />
                </button>
                <button 
                  onClick={() => setShowRules(true)}
                  className="p-2 bg-white/5 text-white/40 rounded-xl hover:text-[#d4af37] transition-all"
                  title="Regras"
                >
                  <Users size={20} />
                </button>
                {selectedGroup.created_by !== currentUserId && (
                  <button 
                    onClick={leaveGroup}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    title="Sair do Grupo"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* Messages Area - Full Flex */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-10"
            >
              <div className="flex flex-col items-center justify-center py-10 opacity-20 space-y-4">
                <div className="w-16 h-16 rounded-3xl border-2 border-dashed border-[#d4af37] flex items-center justify-center">
                  <MessageSquare size={24} className="text-[#d4af37]" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Início da Conversa</p>
              </div>

              {messages.map((msg, i) => {
                const isMe = msg.sender_id === currentUserId;
                const msgReactions = reactions[msg.id] || [];
                
                // Find member profile for avatar
                const member = groupMembers.find(m => m.user_id === msg.sender_id);
                const senderName = member?.profiles.full_name || msg.sender_name || 'Usuário';
                const senderAvatar = member?.profiles.avatar_url;

                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-6 px-2`}>
                    {msg.sender_name === 'Sistema' ? (
                      <div className="w-full flex justify-center py-2">
                        <span className="bg-black/20 backdrop-blur-md px-4 py-1 rounded-full text-[9px] font-black text-white/40 uppercase tracking-widest border border-white/5">
                          {msg.content}
                        </span>
                      </div>
                    ) : (
                      <>
                        {!isMe && (
                          <div className="w-9 h-9 rounded-xl overflow-hidden mr-2 self-end border border-white/10 shadow-lg flex-shrink-0 mb-1">
                            {senderAvatar ? (
                              <img src={senderAvatar} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-[#1c2431] flex items-center justify-center text-[12px] font-black text-[#d4af37]">
                                {senderName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && (
                            <div className="flex items-center gap-2 mb-1.5 ml-1">
                              <span className="text-[11px] font-black text-[#d4af37] uppercase tracking-wider">{senderName}</span>
                              {msg.sender_id === selectedGroup.created_by && (
                                <span className="bg-[#d4af37] text-black text-[7px] font-black px-1.5 py-0.5 rounded uppercase shadow-sm">ADM</span>
                              )}
                            </div>
                          )}
                          
                          <div className="relative group">
                            {/* Message Content Bubble */}
                            <div className={`
                              px-4 py-3 rounded-2xl shadow-xl relative
                              ${isMe 
                                ? 'bg-[#d4af37] text-black rounded-tr-none' 
                                : 'bg-[#1c2431] text-white rounded-tl-none border border-white/5'
                              }
                            `}>
                              {/* Triangle Tip */}
                              <div className={`
                                absolute top-0 w-3 h-3 
                                ${isMe 
                                  ? 'left-full -ml-1 border-l-[12px] border-l-[#d4af37] border-b-[12px] border-b-transparent' 
                                  : 'right-full -mr-1 border-r-[12px] border-r-[#1c2431] border-b-[12px] border-b-transparent'
                                }
                              `} />

                              {msg.type === 'text' && (
                                <p className="text-[13px] font-medium leading-relaxed break-words">{msg.content}</p>
                              )}
                              
                              {msg.type === 'image' && (
                                <div className="space-y-2">
                                  <img 
                                    src={msg.media_url} 
                                    className="max-w-full rounded-xl cursor-pointer hover:opacity-90 transition-all border border-black/10" 
                                    onClick={() => window.open(msg.media_url)} 
                                  />
                                </div>
                              )}
                              
                              {msg.type === 'audio' && (
                                <AudioPlayer src={msg.media_url || ''} isMe={isMe} />
                              )}

                              <div className={`flex justify-end items-center gap-1 mt-1 opacity-40`}>
                                <span className="text-[8px] font-black uppercase">{format(new Date(msg.created_at), 'HH:mm')}</span>
                                {isMe && <div className="w-2 h-2 rounded-full border border-current opacity-50" />}
                              </div>
                            </div>

                            {/* Reaction Picker Popover */}
                            <div className={`absolute -top-4 ${isMe ? 'right-2' : 'left-2'} opacity-0 group-hover:opacity-100 transition-all flex gap-1 z-20`}>
                              {['👍', '❤️', '😂', '🔥'].map(emoji => (
                                <button 
                                  key={emoji}
                                  onClick={() => addReaction(msg.id, emoji)}
                                  className="w-7 h-7 bg-[#0a0e17] border border-white/10 rounded-full flex items-center justify-center hover:scale-125 transition-all text-xs shadow-2xl"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Reactions Display */}
                          {msgReactions.length > 0 && (
                            <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                              {Array.from(new Set(msgReactions.map(r => r.emoji))).map(emoji => (
                                <div key={emoji} className="bg-white/5 px-2 py-0.5 rounded-full text-[9px] flex items-center gap-1 border border-white/5 backdrop-blur-md">
                                  <span>{emoji}</span>
                                  <span className="font-black text-[#d4af37]">{msgReactions.filter(r => r.emoji === emoji).length}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Input Bar - Immersive */}
            <div className="p-4 bg-[#1c2431]/95 backdrop-blur-xl border-t border-white/5 relative z-10 safe-area-bottom pb-8">
              {audioBlob && (
                <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-3 text-amber-500">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
                      <Mic size={16} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Áudio Gravado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setAudioBlob(null)} className="p-2 text-white/20 hover:text-red-500 transition-colors"><X size={20} /></button>
                    <button onClick={sendAudio} className="px-6 py-2 bg-amber-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 active:scale-95 transition-all">Enviar Áudio</button>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-[#d4af37] transition-all"
                  >
                    <Plus size={24} />
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                </div>
                
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Aa"
                    className="w-full bg-[#0a0e17] border border-white/5 rounded-2xl py-3 px-5 pr-12 text-sm font-medium text-white outline-none focus:ring-1 focus:ring-[#d4af37]/50 shadow-inner transition-all"
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-[#d4af37] transition-colors">
                    <Smile size={22} />
                  </button>
                </div>

                {newMessage.trim() ? (
                  <button 
                    onClick={() => handleSendMessage()}
                    className="w-11 h-11 bg-[#d4af37] text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#d4af37]/20"
                  >
                    <Send size={20} className="ml-0.5" />
                  </button>
                ) : (
                  <button 
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-lg ${isRecording ? 'bg-red-500 animate-pulse scale-125 shadow-red-500/40' : 'bg-white/5 text-white/40 hover:text-[#d4af37]'}`}
                  >
                    <Mic size={22} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Members Modal */}
      <AnimatePresence>
        {isAddingMembers && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm"
            onClick={() => setIsAddingMembers(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-[#1c2431] border border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-2xl max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Convidar Membros</h3>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Adicione pessoas ao grupo</p>
                </div>
                <button onClick={() => setIsAddingMembers(false)} className="p-2 text-white/20 hover:text-white transition-colors"><X size={24} /></button>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                <input 
                  type="text"
                  placeholder="Pesquisar por nome..."
                  value={memberSearchTerm}
                  onChange={(e) => setMemberSearchTerm(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-[#d4af37]"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {allProfiles
                  .filter(p => p.id !== currentUserId && p.full_name.toLowerCase().includes(memberSearchTerm.toLowerCase()))
                  .map(profile => (
                    <div key={profile.id} className="flex items-center justify-between p-3 bg-black/20 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#0a0e17] overflow-hidden border border-white/10">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-white/20">
                            {profile.full_name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-black text-white">{profile.full_name}</p>
                        <p className="text-[8px] font-bold text-[#d4af37] uppercase tracking-widest">{profile.role}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => addMember(profile.id)}
                      className="p-2 bg-[#d4af37] text-black rounded-lg hover:scale-105 active:scale-95 transition-all"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setIsAddingMembers(false)}
                className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all"
              >
                Concluir
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Group Modal */}
      <AnimatePresence>
        {isCreatingGroup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
            onClick={() => setIsCreatingGroup(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-[#1c2431] border border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Criar Novo Grupo</h3>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Defina as bases da sua comunidade</p>
                </div>
                <button onClick={() => setIsCreatingGroup(false)} className="p-2 text-white/20 hover:text-white transition-colors"><X size={24} /></button>
              </div>

              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Nome do Grupo</label>
                  <input 
                    type="text" 
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full bg-[#0a0e17] border-none rounded-2xl p-4 text-sm font-black text-white outline-none focus:ring-1 focus:ring-[#d4af37]"
                    placeholder="Ex: Equipe de Alvenaria"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Descrição</label>
                  <textarea 
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    className="w-full bg-[#0a0e17] border-none rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-[#d4af37] min-h-[80px] resize-none"
                    placeholder="Sobre o que é este grupo?"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Regras do Grupo</label>
                  <textarea 
                    value={newGroupRules}
                    onChange={(e) => setNewGroupRules(e.target.value)}
                    className="w-full bg-[#0a0e17] border-none rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-[#d4af37] min-h-[120px] resize-none"
                    placeholder="Ex: 1. Respeito mútuo..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Imagem de Capa</label>
                  <div 
                    onClick={() => groupCoverInputRef.current?.click()}
                    className="relative h-32 w-full bg-[#0a0e17] rounded-2xl border border-white/5 overflow-hidden group cursor-pointer"
                  >
                    {coverPreview ? (
                      <img src={coverPreview} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <Camera className="text-white/20 group-hover:text-[#d4af37] transition-colors" size={24} />
                        <span className="text-[8px] font-black text-white/20 uppercase">Fazer Upload</span>
                      </div>
                    )}
                    <input 
                      type="file" 
                      ref={groupCoverInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleCoverSelect} 
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#0a0e17] rounded-2xl border border-white/5">
                  <div>
                    <p className="text-[10px] font-black text-white uppercase">Grupo Privado?</p>
                    <p className="text-[8px] text-white/20 font-bold uppercase">Apenas membros convidados</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsPrivate(!isPrivate)}
                    className={`w-12 h-6 rounded-full transition-all relative ${isPrivate ? 'bg-[#d4af37]' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isPrivate ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <button 
                  type="submit"
                  disabled={isUploading}
                  className="w-full bg-[#d4af37] text-black py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-[#d4af37]/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Sincronizando...
                    </>
                  ) : (
                    'Criar Comunidade'
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Group Info Modal */}
      <AnimatePresence>
        {showGroupInfo && selectedGroup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md"
            onClick={() => setShowGroupInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-[#1c2431] border border-white/10 rounded-[2.5rem] p-8 space-y-8 shadow-2xl relative flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Dados do Grupo</h3>
                  <p className="text-[10px] font-black text-[#d4af37] uppercase tracking-widest">{selectedGroup.name}</p>
                </div>
                <button onClick={() => setShowGroupInfo(false)} className="p-3 bg-white/5 rounded-2xl text-white/40 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col items-center py-6 border-b border-white/5">
                <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-2 border-[#d4af37] shadow-xl mb-4">
                  <img src={selectedGroup.cover_url} className="w-full h-full object-cover" />
                </div>
                <h4 className="text-xl font-black text-white uppercase">{selectedGroup.name}</h4>
                <p className="text-xs text-white/40 font-bold mt-1">Grupo {selectedGroup.is_private ? 'Privado' : 'Público'} • {groupMembers.length} Membros</p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                <h5 className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4">Lista de Membros</h5>
                {groupMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-black/20 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#0a0e17] overflow-hidden border border-white/10">
                        {member.profiles.avatar_url ? (
                          <img src={member.profiles.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-[#d4af37]">
                            {member.profiles.full_name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-black text-white flex items-center gap-2">
                          {member.profiles.full_name}
                          {member.user_id === selectedGroup.created_by && <span className="bg-[#d4af37] text-black text-[6px] font-black px-1 rounded uppercase">ADM</span>}
                        </p>
                        <p className="text-[8px] font-bold text-[#d4af37] uppercase tracking-widest">{member.profiles.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setShowGroupInfo(false)}
                className="w-full py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all"
              >
                Voltar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Group Rules & Info Modal */}
      <AnimatePresence>
        {showRules && selectedGroup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md"
            onClick={() => setShowRules(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-[#1c2431] border border-white/10 rounded-[2.5rem] p-10 space-y-8 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 w-full h-32 opacity-20 pointer-events-none">
                <img src={selectedGroup.cover_url} className="w-full h-full object-cover blur-xl" />
              </div>

              <div className="flex justify-between items-start relative z-10">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Regras e Informações</h3>
                  <p className="text-[10px] font-black text-[#d4af37] uppercase tracking-widest">{selectedGroup.name}</p>
                </div>
                <button onClick={() => setShowRules(false)} className="p-3 bg-white/5 rounded-2xl text-white/40 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6 relative z-10">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={14} className="text-[#d4af37]" /> Descrição
                  </h4>
                  <p className="text-xs font-bold text-white/80 leading-relaxed bg-black/20 p-5 rounded-2xl border border-white/5">
                    {selectedGroup.description || 'Sem descrição definida.'}
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <Users size={14} className="text-[#d4af37]" /> Regras da Comunidade
                  </h4>
                  <div className="text-xs font-bold text-white/80 leading-relaxed bg-black/20 p-5 rounded-2xl border border-white/5 whitespace-pre-wrap">
                    {selectedGroup.rules || 'Nenhuma regra específica definida.'}
                  </div>
                </div>

                <div className="pt-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Criado em</span>
                    <span className="text-[10px] font-black text-white uppercase">
                      {selectedGroup.created_at ? format(new Date(selectedGroup.created_at), 'dd/MM/yyyy') : 'Antigo'}
                    </span>
                  </div>

                  <button 
                    onClick={() => setShowRules(false)}
                    className="w-full py-5 bg-[#d4af37] text-black rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-[#d4af37]/20"
                  >
                    Entendi
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
