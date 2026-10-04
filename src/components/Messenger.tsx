import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Profile, Message, Block, ChatGroup, GroupMember, GroupMessage, ReplyInfo } from '../types';
import { 
  X, 
  Send, 
  Search, 
  ArrowLeft, 
  Loader2, 
  MessageSquare, 
  ShieldAlert, 
  ShieldCheck,
  Users,
  LogOut,
  Info,
  Lock,
  Globe,
  Image as ImageIcon,
  Mic,
  Trash2,
  Check,
  Square,
  Camera,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  MicOff,
  Smile,
  CornerUpLeft,
  MoreVertical,
  Ban,
  Eye,
  EyeOff,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { AudioPlayer } from './AudioPlayer';
import { UniversalAudioRecorder } from '../lib/audioRecorder';
import { triggerBackgroundNotification } from '../services/firebaseMessaging';

interface MessengerProps {
  onClose: () => void;
  currentUserId: string;
  userName?: string;
  userAvatar?: string;
  onlineUsers: Map<string, any>;
  incomingCallSignal?: any;
  onClearIncomingCallSignal?: () => void;
}

export default function Messenger({ 
  onClose, 
  currentUserId, 
  userName = 'Utilizador',
  userAvatar,
  onlineUsers,
  incomingCallSignal,
  onClearIncomingCallSignal
}: MessengerProps) {
  // Navigation tabs: 'direct' (private chats) or 'groups' (team groups)
  const [activeTab, setActiveTab] = useState<'direct' | 'groups'>('groups');

  // Direct chat states
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blockedBy, setBlockedBy] = useState<Block[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [groupUnreadCounts, setGroupUnreadCounts] = useState<Record<string, number>>({});

  // Group chat states
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [groupTypingUsers, setGroupTypingUsers] = useState<Record<string, { userName: string; timestamp: number }>>({});
  const typingTimeoutRef = useRef<any>(null);
  const activeChannelRef = useRef<any>(null);
  const activeGroupChannelRef = useRef<any>(null);
  const selectedUserRef = useRef<Profile | null>(null);
  const selectedGroupRef = useRef<ChatGroup | null>(null);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);
  
  // WebRTC Calling state variables
  const [callState, setCallState] = useState<'idle' | 'outgoing' | 'incoming' | 'connected'>('idle');
  const [callType, setCallType] = useState<'video' | 'audio'>('video');
  const [callUser, setCallUser] = useState<Profile | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [isCallCameraOff, setIsCallCameraOff] = useState(false);

  // Audio elements for call sounds
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const dialtoneRef = useRef<HTMLAudioElement | null>(null);

  // Refs for WebRTC connections and video elements
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const callRoomChannelRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const iceCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const callStartTimeRef = useRef<number | null>(null);
  const outgoingTimeoutRef = useRef<any>(null);

  // Synchronize remote video and audio streams whenever remoteStream changes or call connects
  useEffect(() => {
    if (remoteStream) {
      console.log('[WebRTC] Syncing remoteStream tracks:', remoteStream.getTracks().map(t => `${t.kind}:${t.enabled}`));
      remoteStream.getTracks().forEach(track => {
        track.enabled = true;
      });

      if (remoteVideoRef.current) {
        if (remoteVideoRef.current.srcObject !== remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        remoteVideoRef.current.play().catch(e => console.warn('[WebRTC] remoteVideo play error:', e));
      }

      if (remoteAudioRef.current) {
        if (remoteAudioRef.current.srcObject !== remoteStream) {
          remoteAudioRef.current.srcObject = remoteStream;
        }
        remoteAudioRef.current.play().catch(e => console.warn('[WebRTC] remoteAudio play error:', e));
      }
    }
  }, [remoteStream, callState]);

  // Synchronize local preview stream
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, callState]);

  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupMembers, setGroupMembers] = useState<(GroupMember & { profile?: Profile })[]>([]);
  const [userMemberships, setUserMemberships] = useState<Set<string>>(new Set());
  const [showGroupModal, setShowGroupModal] = useState(false);

  // Common inputs & UI
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  // Reply & Reaction states (WhatsApp style)
  const [replyingTo, setReplyingTo] = useState<ReplyInfo | null>(null);
  const [reactionMenuMessageId, setReactionMenuMessageId] = useState<string | null>(null);
  const QUICK_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  // WhatsApp-style Message Actions: Delete & Clear Chat
  const [messageToDelete, setMessageToDelete] = useState<Message | GroupMessage | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isClearChatModalOpen, setIsClearChatModalOpen] = useState(false);
  const [showChatOptionsMenu, setShowChatOptionsMenu] = useState(false);

  // WhatsApp-style View-Once Media Composer & Viewer
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [isViewOnceSelected, setIsViewOnceSelected] = useState(false);
  const [imageCaption, setImageCaption] = useState('');
  const [isImagePreviewModalOpen, setIsImagePreviewModalOpen] = useState(false);
  const [imageTargetIsGroup, setImageTargetIsGroup] = useState(false);
  const [activeViewOnceImage, setActiveViewOnceImage] = useState<Message | GroupMessage | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const groupScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const privateFileInputRef = useRef<HTMLInputElement>(null);
  const privateCameraInputRef = useRef<HTMLInputElement>(null);
  const universalRecorderRef = useRef<UniversalAudioRecorder | null>(null);
  const timerRef = useRef<any>(null);
  const longPressTimerRef = useRef<any>(null);
  const isStartingRef = useRef(false);

  const formatRecordingTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const cleanupActiveStream = useCallback(() => {
    if (universalRecorderRef.current) {
      try {
        universalRecorderRef.current.cancel();
      } catch (err) {}
      universalRecorderRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupActiveStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cleanupActiveStream]);

  const showMicError = (msg: string) => {
    setMicError(msg);
    setTimeout(() => {
      setMicError(null);
    }, 6000);
  };

  const isUserBlocked = selectedUser ? blocks.some(b => b.blocked_id === selectedUser.id) : false;
  const amIBlocked = selectedUser ? blockedBy.some(b => b.blocker_id === selectedUser.id) : false;

  const parseMessage = (msg: any): any => {
    if (!msg) return msg;
    let content = msg.content || '';
    let reply_to = msg.reply_to;
    let reactions = msg.reactions;
    let is_view_once = msg.is_view_once || false;
    let view_once_opened = msg.view_once_opened || false;
    let opened_by: string[] = msg.opened_by || [];
    let is_deleted = msg.is_deleted || false;
    let deleted_for: string[] = msg.deleted_for || [];

    // 1. Parse metadata embedded in content
    if (typeof content === 'string' && content.includes('\n__GSI_META__')) {
      const parts = content.split('\n__GSI_META__');
      content = parts[0];
      try {
        const parsed = JSON.parse(parts[1]);
        if (parsed.reply_to && !reply_to) reply_to = parsed.reply_to;
        if (parsed.reactions) {
          if (!reactions || Object.keys(reactions).length === 0) {
            reactions = parsed.reactions;
          } else {
            const merged = { ...reactions };
            Object.entries(parsed.reactions).forEach(([emoji, uids]: [string, any]) => {
              if (Array.isArray(uids)) {
                merged[emoji] = Array.from(new Set([...(merged[emoji] || []), ...uids]));
              }
            });
            reactions = merged;
          }
        }
        if (parsed.is_view_once !== undefined) is_view_once = parsed.is_view_once;
        if (parsed.view_once_opened !== undefined) view_once_opened = parsed.view_once_opened;
        if (Array.isArray(parsed.opened_by)) opened_by = parsed.opened_by;
        if (parsed.is_deleted !== undefined) is_deleted = parsed.is_deleted;
        if (Array.isArray(parsed.deleted_for)) deleted_for = parsed.deleted_for;
      } catch {}
    }

    // 2. Check if content itself says it was deleted
    if (content === '🚫 Esta mensagem foi apagada' || content === 'Esta mensagem foi apagada') {
      is_deleted = true;
    }

    // 3. LocalStorage Fallback & Merge
    if (!reply_to && msg.id) {
      try {
        const storedReply = localStorage.getItem(`gsi_reply_${msg.id}`);
        if (storedReply) reply_to = JSON.parse(storedReply);
      } catch {}
    }
    if (msg.id) {
      try {
        const storedReactionsStr = localStorage.getItem(`gsi_reactions_${msg.id}`);
        if (storedReactionsStr) {
          const storedReactions = JSON.parse(storedReactionsStr);
          if (!reactions || Object.keys(reactions).length === 0) {
            reactions = storedReactions;
          } else {
            const merged = { ...reactions };
            Object.entries(storedReactions).forEach(([emoji, uids]: [string, any]) => {
              if (Array.isArray(uids)) {
                merged[emoji] = Array.from(new Set([...(merged[emoji] || []), ...uids]));
              }
            });
            reactions = merged;
          }
        }
        if (localStorage.getItem(`gsi_view_once_opened_${msg.id}`) === 'true') {
          view_once_opened = true;
          if (!opened_by.includes(currentUserId)) {
            opened_by = [...opened_by, currentUserId];
          }
        }
        if (localStorage.getItem(`gsi_deleted_msg_${msg.id}`) === 'true') {
          if (!deleted_for.includes(currentUserId)) {
            deleted_for = [...deleted_for, currentUserId];
          }
        }
      } catch {}
    }

    return {
      ...msg,
      content,
      reply_to,
      reactions,
      is_view_once,
      view_once_opened,
      opened_by,
      is_deleted,
      deleted_for
    };
  };

  const encodeMessageContent = (
    rawContent: string, 
    replyTo?: ReplyInfo, 
    reactions?: Record<string, string[]>,
    metaExt?: {
      is_view_once?: boolean;
      view_once_opened?: boolean;
      opened_by?: string[];
      is_deleted?: boolean;
      deleted_for?: string[];
    }
  ): string => {
    let text = rawContent || '';
    if (text.includes('\n__GSI_META__')) {
      text = text.split('\n__GSI_META__')[0];
    }
    const meta: any = { ...metaExt };
    if (replyTo) meta.reply_to = replyTo;
    if (reactions && Object.keys(reactions).length > 0) meta.reactions = reactions;
    if (Object.keys(meta).length > 0) {
      text += `\n__GSI_META__${JSON.stringify(meta)}`;
    }
    return text;
  };

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
      fetchBlocks(),
      fetchGroups()
    ]);
    await Promise.all([
      fetchUnreadCounts(),
      fetchGroupUnreadCounts()
    ]);
    setLoading(false);
  };

  // Direct chat messages & typing listener
  useEffect(() => {
    if (selectedUser) {
      setIsPartnerTyping(false);
      fetchMessages(selectedUser.id);
      markMessagesAsRead(selectedUser.id);

      const symmetricChatId = [currentUserId, selectedUser.id].sort().join('_');
      const channel = supabase.channel(`chat-room-${symmetricChatId}`);
      
      channel
        .on('broadcast', { event: 'new_message' }, (resp) => {
          if (resp?.payload) {
            const newMsg = resp.payload;
            if (newMsg.sender_id === selectedUser.id) {
              setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id || (m.created_at === newMsg.created_at && m.sender_id === newMsg.sender_id && m.content === newMsg.content))) return prev;
                return [...prev, newMsg];
              });
              markMessagesAsRead(selectedUser.id);
              playReceiveSound();
              setIsPartnerTyping(false);
            }
          }
        })
        .on('broadcast', { event: 'message_reaction' }, (resp) => {
          if (resp?.payload?.messageId) {
            const { messageId, reactions } = resp.payload;
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
          }
        })
        .on('broadcast', { event: 'message_deleted' }, (resp) => {
          if (resp?.payload?.messageId) {
            const { messageId } = resp.payload;
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: true, content: '🚫 Esta mensagem foi apagada', media_url: undefined } : m));
          }
        })
        .on('broadcast', { event: 'view_once_opened' }, (resp) => {
          if (resp?.payload?.messageId) {
            const { messageId, openedBy } = resp.payload;
            setMessages(prev => prev.map(m => m.id === messageId ? { 
              ...m, 
              view_once_opened: true, 
              opened_by: Array.from(new Set([...(m.opened_by || []), openedBy])) 
            } : m));
          }
        })
        .on('broadcast', { event: 'typing' }, (resp) => {
          if (resp?.payload && resp.payload.senderId === selectedUser.id) {
            setIsPartnerTyping(!!resp.payload.isTyping);
          }
        })
        .on('postgres_changes' as any, { 
          event: '*', 
          table: 'messages'
        }, (payload: any) => {
          if (payload?.new && (payload.new.sender_id === selectedUser.id || payload.new.receiver_id === selectedUser.id)) {
            fetchMessages(selectedUser.id);
            if (payload.new.sender_id === selectedUser.id) {
              markMessagesAsRead(selectedUser.id);
              playReceiveSound();
            }
          } else if (payload?.eventType === 'DELETE' || payload?.eventType === 'UPDATE') {
            fetchMessages(selectedUser.id);
          }
        })
        .subscribe();

      activeChannelRef.current = channel;

      // 1.5-second ultra-responsive live sync
      const interval = setInterval(() => {
        fetchMessages(selectedUser.id);
      }, 1500);

      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
        activeChannelRef.current = null;
        setIsPartnerTyping(false);
      };
    }
  }, [selectedUser?.id, currentUserId]);

  // Group chat messages & members listener
  useEffect(() => {
    if (selectedGroup) {
      setGroupTypingUsers({});
      fetchGroupMessages(selectedGroup.id);
      fetchGroupMembers(selectedGroup.id);
      markGroupAsRead(selectedGroup.id);

      const channel = supabase.channel(`messenger-group-${selectedGroup.id}`);
      
      channel
        .on('broadcast', { event: 'new_message' }, (resp) => {
          if (resp?.payload) {
            const newMsg = resp.payload;
            if (newMsg.sender_id !== currentUserId) {
              setGroupMessages(prev => {
                if (prev.some(m => m.id === newMsg.id || (m.created_at === newMsg.created_at && m.sender_id === newMsg.sender_id && m.content === newMsg.content))) return prev;
                return [...prev, newMsg];
              });
              markGroupAsRead(selectedGroup.id);
              playReceiveSound();
            }
          }
        })
        .on('broadcast', { event: 'message_reaction' }, (resp) => {
          if (resp?.payload?.messageId) {
            const { messageId, reactions } = resp.payload;
            setGroupMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
          }
        })
        .on('broadcast', { event: 'message_deleted' }, (resp) => {
          if (resp?.payload?.messageId) {
            const { messageId } = resp.payload;
            setGroupMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: true, content: '🚫 Esta mensagem foi apagada', media_url: undefined } : m));
          }
        })
        .on('broadcast', { event: 'view_once_opened' }, (resp) => {
          if (resp?.payload?.messageId) {
            const { messageId, openedBy } = resp.payload;
            setGroupMessages(prev => prev.map(m => m.id === messageId ? { 
              ...m, 
              view_once_opened: true, 
              opened_by: Array.from(new Set([...(m.opened_by || []), openedBy])) 
            } : m));
          }
        })
        .on('broadcast', { event: 'typing' }, (resp) => {
          if (resp?.payload && resp.payload.senderId !== currentUserId) {
            setGroupTypingUsers(prev => {
              const next = { ...prev };
              if (resp.payload.isTyping) {
                next[resp.payload.senderId] = { userName: resp.payload.senderName || 'Colega', timestamp: Date.now() };
              } else {
                delete next[resp.payload.senderId];
              }
              return next;
            });
          }
        })
        .on('postgres_changes' as any, {
          event: '*',
          table: 'group_messages'
        }, (payload: any) => {
          if (payload?.new && payload.new.group_id === selectedGroup.id) {
            fetchGroupMessages(selectedGroup.id);
            if (payload.new.sender_id !== currentUserId) {
              markGroupAsRead(selectedGroup.id);
              playReceiveSound();
            }
          } else if (payload?.eventType === 'DELETE' || payload?.eventType === 'UPDATE') {
            fetchGroupMessages(selectedGroup.id);
          }
        })
        .subscribe();

      activeGroupChannelRef.current = channel;

      // 1.5-second ultra-responsive live sync
      const interval = setInterval(() => {
        fetchGroupMessages(selectedGroup.id);
      }, 1500);

      // Clean expired group typing indicators
      const typingCleaner = setInterval(() => {
        setGroupTypingUsers(prev => {
          const now = Date.now();
          let changed = false;
          const next: Record<string, { userName: string; timestamp: number }> = {};
          Object.entries(prev).forEach(([uid, data]) => {
            const typingData = data as { userName: string; timestamp: number };
            if (now - typingData.timestamp < 3500) {
              next[uid] = typingData;
            } else {
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      }, 1500);

      return () => {
        clearInterval(interval);
        clearInterval(typingCleaner);
        supabase.removeChannel(channel);
        activeGroupChannelRef.current = null;
        setGroupTypingUsers({});
      };
    }
  }, [selectedGroup?.id, currentUserId]);

  // Global messages listener for unread badges on unopened chats/groups
  useEffect(() => {
    const directChannel = supabase
      .channel('global-direct-messages')
      .on('postgres_changes' as any, {
        event: 'INSERT',
        table: 'messages',
        filter: `receiver_id=eq.${currentUserId}`
      }, (payload: any) => {
        if (!selectedUser || selectedUser.id !== payload.new.sender_id) {
          fetchUnreadCounts();
          playReceiveSound();
        }
      })
      .subscribe();

    const groupChannel = supabase
      .channel('global-group-messages')
      .on('postgres_changes' as any, {
        event: 'INSERT',
        table: 'group_messages'
      }, (payload: any) => {
        if (selectedGroup && selectedGroup.id === payload.new.group_id) {
          markGroupAsRead(selectedGroup.id);
        } else {
          fetchGroupUnreadCounts();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(directChannel);
      supabase.removeChannel(groupChannel);
    };
  }, [selectedUser, selectedGroup, groups]);

  const getCallRoom = (partnerId: string) => {
    if (callRoomChannelRef.current) return callRoomChannelRef.current;
    const roomId = [currentUserId, partnerId].sort().join('_');
    const ch = supabase.channel(`call_room_${roomId}`);
    callRoomChannelRef.current = ch;

    ch.on('broadcast', { event: 'signal' }, async ({ payload }) => {
      if (!payload || payload.senderId === currentUserId) return;
      handleWebRTCSignal(payload);
    });

    ch.subscribe();
    return ch;
  };

  const sendSignal = async (recipientId: string, signalData: any) => {
    const payload = { ...signalData, senderId: currentUserId };

    // For initial calling notifications (ringing/busy/declined), broadcast to recipient's personal signal channel
    if (signalData.type === 'incoming-call' || signalData.type === 'call-declined' || signalData.type === 'call-busy') {
      const personalChannel = supabase.channel(`call-signals-${recipientId}`);
      personalChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          personalChannel.send({ type: 'broadcast', event: 'signal', payload });
          setTimeout(() => supabase.removeChannel(personalChannel), 2500);
        }
      });
    }

    // Always send over the shared room channel
    const room = getCallRoom(recipientId);
    if (room.state === 'joined') {
      room.send({ type: 'broadcast', event: 'signal', payload });
    } else {
      room.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          room.send({ type: 'broadcast', event: 'signal', payload });
        }
      });
    }
  };

  const handleWebRTCSignal = async (payload: any) => {
    console.log('[RTC Room Signal] Received:', payload.type);
    const { type, senderId, senderName, senderAvatar, callType: cType, sdp, candidate } = payload;

    switch (type) {
      case 'call-accepted':
        if (callState === 'outgoing') {
          stopDialtone();
          setCallState('connected');
          await startCallerPeerConnection(senderId, callType);
        }
        break;

      case 'call-declined':
      case 'call-busy':
        if (callState === 'outgoing' || callState === 'incoming') {
          stopDialtone();
          stopRingtone();
          setCallState('idle');
          setCallUser(null);
          alert(type === 'call-busy' ? 'O destinatário está ocupado.' : 'Chamada recusada.');
        }
        break;

      case 'call-ended':
        handleHangUpLocal(false);
        break;

      case 'sdp-offer':
        if (callState === 'incoming' || callState === 'connected') {
          setCallState('connected');
          stopRingtone();
          await handleIncomingOffer(sdp, senderId, cType || callType);
        }
        break;

      case 'sdp-answer':
        if (peerConnectionRef.current) {
          try {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
            // Drain any queued ICE candidates
            while (iceCandidatesQueueRef.current.length > 0) {
              const cand = iceCandidatesQueueRef.current.shift();
              if (cand) {
                try {
                  await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {
                  console.warn('[WebRTC] Drained candidate note:', e);
                }
              }
            }
          } catch (e) {
            console.warn('[WebRTC] sdp-answer error:', e);
          }
        }
        break;

      case 'ice-candidate':
        if (candidate) {
          const pc = peerConnectionRef.current;
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn('[WebRTC] addIceCandidate error:', e);
            }
          } else {
            iceCandidatesQueueRef.current.push(candidate);
          }
        }
        break;
    }
  };

  // Handle global incoming call signal passed down from App.tsx
  useEffect(() => {
    if (incomingCallSignal) {
      console.log('[Messenger] Handling global incoming call signal:', incomingCallSignal);
      const { senderId, senderName, senderAvatar, callType: cType } = incomingCallSignal;
      
      // If we are already in an active call with someone else
      if (callState === 'connected' || (callState === 'outgoing' && callUser?.id !== senderId)) {
        sendSignal(senderId, { type: 'call-busy' });
        if (onClearIncomingCallSignal) onClearIncomingCallSignal();
        return;
      }

      // If already ringing from the same caller, just consume the signal
      if (callState === 'incoming' && callUser?.id === senderId) {
        if (onClearIncomingCallSignal) onClearIncomingCallSignal();
        return;
      }

      const callerProfile: Profile = {
        id: senderId,
        full_name: senderName,
        avatar_url: senderAvatar || '',
        role: 'Oficial',
        current_obra: '',
        hourly_rate: 0
      };
      setCallUser(callerProfile);
      setCallType(cType || 'video');
      setCallState('incoming');
      playRingtone();

      if (onClearIncomingCallSignal) onClearIncomingCallSignal();
    }
  }, [incomingCallSignal]);

  // WebRTC Signaling Listener for incoming calls on personal channel
  useEffect(() => {
    const listenChannel = supabase.channel(`call-signals-${currentUserId}`);
    
    listenChannel
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        console.log('[Personal Call Signaling] Received signal:', payload);
        const { type, senderId, senderName, senderAvatar, callType: cType } = payload;
        
        switch (type) {
          case 'incoming-call':
            if (callState === 'connected' || (callState === 'outgoing' && callUser?.id !== senderId)) {
              sendSignal(senderId, { type: 'call-busy' });
              return;
            }
            if (callState === 'incoming' && callUser?.id === senderId) {
              return;
            }

            const callerProfile: Profile = {
              id: senderId,
              full_name: senderName,
              avatar_url: senderAvatar || '',
              role: 'Oficial',
              current_obra: '',
              hourly_rate: 0
            };
            setCallUser(callerProfile);
            setCallType(cType || 'video');
            setCallState('incoming');
            playRingtone();
            break;

          default:
            // Forward any other signal to WebRTC signal processor
            handleWebRTCSignal(payload);
            break;
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(listenChannel);
    };
  }, [callState, callType, currentUserId]);

  const formatCallDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} seg`;
    const mins = Math.floor(seconds / 60);
    const remSec = seconds % 60;
    return remSec > 0 ? `${mins}m ${remSec}s` : `${mins} min`;
  };

  const formatLastSeen = (profile: Profile): string => {
    if (onlineUsers.has(profile.id)) {
      return 'online';
    }
    const dateStr = profile.last_seen || profile.updated_at;
    if (!dateStr) return 'offline';

    try {
      const lastDate = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - lastDate.getTime();
      
      // If within 2 minutes consider online
      if (diffMs < 2 * 60 * 1000) {
        return 'online';
      }

      const isToday = lastDate.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = lastDate.toDateString() === yesterday.toDateString();

      const timeStr = format(lastDate, 'HH:mm');
      if (isToday) {
        return `visto por último hoje às ${timeStr}`;
      } else if (isYesterday) {
        return `visto por último ontem às ${timeStr}`;
      } else {
        return `visto por último ${format(lastDate, 'dd/MM')} às ${timeStr}`;
      }
    } catch {
      return 'offline';
    }
  };

  const recordCallMessage = async (
    targetUserId: string, 
    status: 'missed' | 'declined' | 'completed', 
    type: 'video' | 'audio', 
    duration?: number
  ) => {
    const contentText = status === 'missed'
      ? `Chamada de ${type === 'video' ? 'vídeo' : 'voz'} perdida`
      : status === 'declined'
      ? `Chamada de ${type === 'video' ? 'vídeo' : 'voz'} recusada`
      : `Chamada de ${type === 'video' ? 'vídeo' : 'voz'} (${formatCallDuration(duration || 0)})`;

    const messageData: any = {
      content: contentText,
      sender_id: currentUserId,
      receiver_id: targetUserId,
      type: 'call_log',
      media_url: null,
      created_at: new Date().toISOString()
    };

    // Optimistic local add
    if (selectedUserRef.current?.id === targetUserId) {
      setMessages(prev => [...prev, messageData]);
    }

    // Broadcast to active channel
    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'new_message',
        payload: messageData
      });
    }

    try {
      const { data } = await supabase.from('messages').insert([messageData]).select();
      if (data && data[0]) {
        setMessages(prev => prev.map(m => m === messageData ? data[0] : m));
      }
    } catch (err) {
      console.warn('[Messenger] Call log insert note:', err);
    }
  };

  const playRingtone = () => {
    if (ringtoneRef.current) ringtoneRef.current.pause();
    ringtoneRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3');
    ringtoneRef.current.loop = true;
    ringtoneRef.current.volume = 0.5;
    ringtoneRef.current.play().catch(() => {});
  };

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current = null;
    }
  };

  const playDialtone = () => {
    if (dialtoneRef.current) dialtoneRef.current.pause();
    dialtoneRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1356/1356-preview.mp3');
    dialtoneRef.current.loop = true;
    dialtoneRef.current.volume = 0.3;
    dialtoneRef.current.play().catch(() => {});
  };

  const stopDialtone = () => {
    if (dialtoneRef.current) {
      dialtoneRef.current.pause();
      dialtoneRef.current = null;
    }
  };

  const startCall = async (type: 'video' | 'audio') => {
    if (!selectedUser) return;
    setCallUser(selectedUser);
    setCallType(type);
    setCallState('outgoing');
    callStartTimeRef.current = null;
    playDialtone();

    // Connect call room immediately
    getCallRoom(selectedUser.id);

    // Auto-timeout after 45s of ringing if no answer
    if (outgoingTimeoutRef.current) clearTimeout(outgoingTimeoutRef.current);
    outgoingTimeoutRef.current = setTimeout(() => {
      if (callState === 'outgoing') {
        recordCallMessage(selectedUser.id, 'missed', type);
        handleHangUpLocal(true);
      }
    }, 45000);

    await sendSignal(selectedUser.id, {
      type: 'incoming-call',
      senderId: currentUserId,
      senderName: userName,
      senderAvatar: userAvatar,
      callType: type
    });

    triggerBackgroundNotification({
      senderId: currentUserId,
      senderName: userName,
      recipientId: selectedUser.id,
      title: `Chamada de ${type === 'video' ? 'vídeo' : 'voz'} 📞`,
      body: `${userName} está a ligar para si no GSI Pro...`,
      type: 'call',
      data: { 
        url: '/?incomingCall=true', 
        callType: type,
        senderId: currentUserId,
        senderName: userName,
        senderAvatar: userAvatar || ''
      }
    });
  };

  const acceptCall = async () => {
    if (!callUser) return;
    stopRingtone();
    setCallState('connected');
    callStartTimeRef.current = Date.now();

    // Explicitly unlock audio playback on mobile browsers
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.play().catch(() => {});
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = false;
      remoteVideoRef.current.play().catch(() => {});
    }

    // Connect call room channel
    getCallRoom(callUser.id);
    await sendSignal(callUser.id, { type: 'call-accepted' });
  };

  const declineCall = async () => {
    if (!callUser) return;
    stopRingtone();
    const partnerId = callUser.id;
    const cType = callType;
    await sendSignal(partnerId, { type: 'call-declined' });
    setCallState('idle');
    setCallUser(null);
    await recordCallMessage(partnerId, 'declined', cType);
  };

  const getRtcConfig = (): RTCConfiguration => ({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp',
          'turns:openrelay.metered.ca:443?transport=tcp'
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle'
  });

  const startCallerPeerConnection = async (otherUserId: string, type: 'video' | 'audio') => {
    try {
      // Unlock audio output
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.play().catch(() => {});
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.play().catch(() => {});
      }

      const constraints: MediaStreamConstraints = {
        video: type === 'video' ? { 
          width: { ideal: 640, max: 1280 }, 
          height: { ideal: 480, max: 720 }, 
          facingMode: 'user', 
          frameRate: { ideal: 24, max: 30 } 
        } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getAudioTracks().forEach(t => { t.enabled = true; });
      stream.getVideoTracks().forEach(t => { t.enabled = true; });
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection(getRtcConfig());
      peerConnectionRef.current = pc;
      iceCandidatesQueueRef.current = [];

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(otherUserId, {
            type: 'ice-candidate',
            candidate: event.candidate.toJSON()
          });
        }
      };

      pc.ontrack = (event) => {
        console.log('[WebRTC Caller] ontrack received:', event.track.kind, event.track.id);
        event.track.enabled = true;
        const incomingStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
        setRemoteStream(incomingStream);

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = incomingStream;
          remoteVideoRef.current.muted = false;
          remoteVideoRef.current.play().catch(e => console.warn('[WebRTC] remoteVideo play error:', e));
        }

        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = incomingStream;
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.play().catch(e => console.warn('[WebRTC] remoteAudio play error:', e));
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC Caller] ICE Connection State:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
          pc.restartIce();
        }
      };

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: type === 'video'
      });
      await pc.setLocalDescription(offer);
      await sendSignal(otherUserId, {
        type: 'sdp-offer',
        sdp: offer,
        callType: type
      });
    } catch (err) {
      console.error('[WebRTC] Error starting media/connection:', err);
      alert('Erro ao aceder à câmara ou microfone.');
      handleHangUpLocal(true);
    }
  };

  const handleIncomingOffer = async (sdp: any, otherUserId: string, type: 'video' | 'audio') => {
    try {
      // Unlock audio output
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.play().catch(() => {});
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.play().catch(() => {});
      }

      const constraints: MediaStreamConstraints = {
        video: type === 'video' ? { 
          width: { ideal: 640, max: 1280 }, 
          height: { ideal: 480, max: 720 }, 
          facingMode: 'user', 
          frameRate: { ideal: 24, max: 30 } 
        } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getAudioTracks().forEach(t => { t.enabled = true; });
      stream.getVideoTracks().forEach(t => { t.enabled = true; });
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection(getRtcConfig());
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(otherUserId, {
            type: 'ice-candidate',
            candidate: event.candidate.toJSON()
          });
        }
      };

      pc.ontrack = (event) => {
        console.log('[WebRTC Callee] ontrack received:', event.track.kind, event.track.id);
        event.track.enabled = true;
        const incomingStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
        setRemoteStream(incomingStream);

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = incomingStream;
          remoteVideoRef.current.muted = false;
          remoteVideoRef.current.play().catch(e => console.warn('[WebRTC] Callee remoteVideo error:', e));
        }

        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = incomingStream;
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.play().catch(e => console.warn('[WebRTC] Callee remoteAudio error:', e));
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC Callee] ICE Connection State:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
          pc.restartIce();
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Drain any queued ICE candidates
      while (iceCandidatesQueueRef.current.length > 0) {
        const cand = iceCandidatesQueueRef.current.shift();
        if (cand) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (err) {
            console.warn('[WebRTC Callee] Error applying queued candidate:', err);
          }
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      await sendSignal(otherUserId, {
        type: 'sdp-answer',
        sdp: answer
      });
    } catch (err) {
      console.error('[WebRTC] Error handling offer:', err);
      alert('Erro de ligação de vídeo/áudio.');
      handleHangUpLocal(true);
    }
  };

  const toggleCallMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsCallMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCallCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCallCameraOff(!videoTrack.enabled);
      }
    }
  };

  const handleHangUpLocal = async (notifyPartner: boolean = true) => {
    stopRingtone();
    stopDialtone();

    if (outgoingTimeoutRef.current) {
      clearTimeout(outgoingTimeoutRef.current);
      outgoingTimeoutRef.current = null;
    }

    const partner = callUser;
    const previousState = callState;
    const cType = callType;
    const startTime = callStartTimeRef.current;

    if (notifyPartner && partner) {
      await sendSignal(partner.id, { type: 'call-ended' });
    }

    if (localStream) {
      localStream.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      setLocalStream(null);
    }
    setRemoteStream(null);

    if (peerConnectionRef.current) {
      try { peerConnectionRef.current.close(); } catch {}
      peerConnectionRef.current = null;
    }
    if (callRoomChannelRef.current) {
      try { supabase.removeChannel(callRoomChannelRef.current); } catch {}
      callRoomChannelRef.current = null;
    }
    iceCandidatesQueueRef.current = [];
    callStartTimeRef.current = null;

    setCallState('idle');
    setCallUser(null);
    setIsCallMuted(false);
    setIsCallCameraOff(false);

    // Record call log to conversation
    if (partner) {
      if (previousState === 'outgoing') {
        await recordCallMessage(partner.id, 'missed', cType);
      } else if (previousState === 'connected' && startTime) {
        const durationSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        await recordCallMessage(partner.id, 'completed', cType, durationSec);
      }
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (groupScrollRef.current) {
      groupScrollRef.current.scrollTop = groupScrollRef.current.scrollHeight;
    }
  }, [groupMessages]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', currentUserId);
    if (data) setProfiles(data);
  };

  const fetchBlocks = async () => {
    try {
      const [myBlocks, usersWhoBlockedMe] = await Promise.all([
        supabase.from('blocks').select('*').eq('blocker_id', currentUserId),
        supabase.from('blocks').select('*').eq('blocked_id', currentUserId)
      ]);

      if (myBlocks.data) setBlocks(myBlocks.data);
      if (usersWhoBlockedMe.data) setBlockedBy(usersWhoBlockedMe.data);
    } catch (err) {
      console.warn('[Messenger] Note: Blocks table might not exist yet in Supabase database:', err);
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id')
        .eq('receiver_id', currentUserId)
        .eq('is_read', false);
      
      if (!error && data) {
        const counts: Record<string, number> = {};
        data.forEach(msg => {
          counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
        });
        setUnreadCounts(counts);
      }
    } catch (err) {
      console.warn('[Messenger] Error fetching private unread counts:', err);
    }
  };

  const fetchGroupUnreadCounts = async (loadedGroups?: ChatGroup[]) => {
    try {
      const targetGroups = loadedGroups || groups;
      if (!targetGroups || targetGroups.length === 0) return;
      
      const counts: Record<string, number> = {};
      await Promise.all(targetGroups.map(async (group) => {
        const lastReadStr = localStorage.getItem(`gsi_last_read_time_${group.id}`);
        const lastReadTime = lastReadStr || new Date(0).toISOString();
        
        const { count, error } = await supabase
          .from('group_messages')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .gt('created_at', lastReadTime)
          .neq('sender_id', currentUserId);
        
        if (!error && count !== null) {
          counts[group.id] = count;
        }
      }));
      setGroupUnreadCounts(counts);
    } catch (err) {
      console.warn('[Messenger] Error fetching group unread counts:', err);
    }
  };

  const markMessagesAsRead = async (senderId: string) => {
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', senderId)
        .eq('receiver_id', currentUserId)
        .eq('is_read', false);
      
      setUnreadCounts(prev => ({ ...prev, [senderId]: 0 }));
    } catch (err) {
      console.warn('[Messenger] Error marking messages as read:', err);
    }
  };

  const markGroupAsRead = (groupId: string) => {
    localStorage.setItem(`gsi_last_read_time_${groupId}`, new Date().toISOString());
    setGroupUnreadCounts(prev => ({ ...prev, [groupId]: 0 }));
  };

  const fetchGroups = async () => {
    try {
      const { data: memData } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', currentUserId);

      const memSet = new Set(memData?.map(m => m.group_id) || []);
      setUserMemberships(memSet);

      const { data: groupData, error } = await supabase
        .from('chat_groups')
        .select('*, group_members(count)');

      if (!error && groupData) {
        const userJoinedGroups = groupData.filter(g => memSet.has(g.id));
        const mapped = userJoinedGroups.map(g => ({
          ...g,
          member_count: g.group_members?.[0]?.count || 0
        }));
        setGroups(mapped);
        fetchGroupUnreadCounts(mapped);
      }
    } catch (err) {
      console.error('Error fetching groups in Messenger:', err);
    }
  };

  const fetchGroupMembers = async (groupId: string) => {
    try {
      const { data: members, error: mError } = await supabase
        .from('group_members')
        .select('id, group_id, user_id, role, joined_at')
        .eq('group_id', groupId);

      if (mError) throw mError;

      if (members && members.length > 0) {
        const userIds = members.map(m => m.user_id);
        const { data: profs } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);

        const combined = members.map(m => ({
          ...m,
          profile: profs?.find(p => p.id === m.user_id) || {
            id: m.user_id,
            full_name: 'Colega',
            role: 'Oficial' as const,
            hourly_rate: 0
          }
        }));

        setGroupMembers(combined);
      } else {
        setGroupMembers([]);
      }
    } catch (err) {
      console.error('Error fetching group members in Messenger:', err);
    }
  };

  const fetchMessages = async (targetUserId?: string) => {
    const otherId = targetUserId || selectedUserRef.current?.id;
    if (!otherId) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.warn('[Messenger] Messages table query error:', error);
        return;
      }
      if (data) {
        const clearedKey = `gsi_cleared_chat_${currentUserId}_${otherId}`;
        const clearedTime = typeof window !== 'undefined' ? localStorage.getItem(clearedKey) : null;

        const parsed = data.map(parseMessage).filter((msg: any) => {
          if (msg.deleted_for && Array.isArray(msg.deleted_for) && msg.deleted_for.includes(currentUserId)) {
            return false;
          }
          if (typeof window !== 'undefined' && localStorage.getItem(`gsi_deleted_msg_${msg.id}`) === 'true') {
            return false;
          }
          if (clearedTime && new Date(msg.created_at) <= new Date(clearedTime)) {
            return false;
          }
          return true;
        });

        setMessages(prev => {
          if (JSON.stringify(prev) === JSON.stringify(parsed)) {
            return prev;
          }
          return parsed;
        });
      }
    } catch (err) {
      console.warn('[Messenger] Note: Messages table error:', err);
    }
  };

  const fetchGroupMessages = async (targetGroupId?: string) => {
    const gid = targetGroupId || selectedGroupRef.current?.id;
    if (!gid) return;
    try {
      const { data, error } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', gid)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const clearedKey = `gsi_cleared_group_${currentUserId}_${gid}`;
        const clearedTime = typeof window !== 'undefined' ? localStorage.getItem(clearedKey) : null;

        const parsed = data.map(parseMessage).filter((msg: any) => {
          if (msg.deleted_for && Array.isArray(msg.deleted_for) && msg.deleted_for.includes(currentUserId)) {
            return false;
          }
          if (typeof window !== 'undefined' && localStorage.getItem(`gsi_deleted_msg_${msg.id}`) === 'true') {
            return false;
          }
          if (clearedTime && new Date(msg.created_at) <= new Date(clearedTime)) {
            return false;
          }
          return true;
        });

        setGroupMessages(prev => {
          if (JSON.stringify(prev) === JSON.stringify(parsed)) {
            return prev;
          }
          return parsed;
        });
      }
    } catch (err) {
      console.error('Error fetching group messages in Messenger:', err);
    }
  };

  const handleTypingChange = (text: string) => {
    setNewMessage(text);
    if (selectedUserRef.current && activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { senderId: currentUserId, isTyping: true }
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        activeChannelRef.current?.send({
          type: 'broadcast',
          event: 'typing',
          payload: { senderId: currentUserId, isTyping: false }
        });
      }, 2500);
    } else if (selectedGroupRef.current && activeGroupChannelRef.current) {
      activeGroupChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { senderId: currentUserId, senderName: userName, isTyping: true }
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        activeGroupChannelRef.current?.send({
          type: 'broadcast',
          event: 'typing',
          payload: { senderId: currentUserId, senderName: userName, isTyping: false }
        });
      }, 2500);
    }
  };

  const handleSelectReply = (msg: Message | GroupMessage, senderName: string) => {
    setReplyingTo({
      id: msg.id,
      content: msg.content || (msg.type === 'audio' ? '🎵 Mensagem de áudio' : msg.type === 'image' ? '📷 Foto' : ''),
      sender_name: senderName,
      sender_id: msg.sender_id,
      type: msg.type || 'text',
      media_url: msg.media_url
    });
    setReactionMenuMessageId(null);
  };

  const handleReaction = async (messageId: string, emoji: string, isGroup: boolean) => {
    setReactionMenuMessageId(null);

    if (isGroup) {
      const targetMsg = groupMessages.find(m => m.id === messageId);
      if (!targetMsg) return;

      const currentReactions: Record<string, string[]> = { ...(targetMsg.reactions || {}) };
      const hadThisEmoji = (currentReactions[emoji] || []).includes(currentUserId);

      // Remove current user from all emojis on this message
      Object.keys(currentReactions).forEach(key => {
        currentReactions[key] = (currentReactions[key] || []).filter(uid => uid !== currentUserId);
        if (currentReactions[key].length === 0) {
          delete currentReactions[key];
        }
      });

      // If user did not have this emoji yet, add it
      if (!hadThisEmoji) {
        currentReactions[emoji] = [...(currentReactions[emoji] || []), currentUserId];
      }

      try {
        localStorage.setItem(`gsi_reactions_${messageId}`, JSON.stringify(currentReactions));
      } catch {}

      setGroupMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: currentReactions } : m));

      if (activeGroupChannelRef.current) {
        activeGroupChannelRef.current.send({
          type: 'broadcast',
          event: 'message_reaction',
          payload: { messageId, reactions: currentReactions }
        });
      }

      try {
        const cleanContent = targetMsg.content || '';
        const encodedContent = encodeMessageContent(cleanContent, targetMsg.reply_to, currentReactions);
        const { error } = await supabase.from('group_messages').update({ content: encodedContent, reactions: currentReactions }).eq('id', messageId);
        if (error) {
          await supabase.from('group_messages').update({ content: encodedContent }).eq('id', messageId);
        }
      } catch (err) {
        console.warn('Error saving group reaction:', err);
      }
    } else {
      const targetMsg = messages.find(m => m.id === messageId);
      if (!targetMsg) return;

      const currentReactions: Record<string, string[]> = { ...(targetMsg.reactions || {}) };
      const hadThisEmoji = (currentReactions[emoji] || []).includes(currentUserId);

      // Remove current user from all emojis on this message
      Object.keys(currentReactions).forEach(key => {
        currentReactions[key] = (currentReactions[key] || []).filter(uid => uid !== currentUserId);
        if (currentReactions[key].length === 0) {
          delete currentReactions[key];
        }
      });

      // If user did not have this emoji yet, add it
      if (!hadThisEmoji) {
        currentReactions[emoji] = [...(currentReactions[emoji] || []), currentUserId];
      }

      try {
        localStorage.setItem(`gsi_reactions_${messageId}`, JSON.stringify(currentReactions));
      } catch {}

      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: currentReactions } : m));

      if (activeChannelRef.current) {
        activeChannelRef.current.send({
          type: 'broadcast',
          event: 'message_reaction',
          payload: { messageId, reactions: currentReactions }
        });
      }

      try {
        const cleanContent = targetMsg.content || '';
        const encodedContent = encodeMessageContent(cleanContent, targetMsg.reply_to, currentReactions);
        const { error } = await supabase.from('messages').update({ content: encodedContent, reactions: currentReactions }).eq('id', messageId);
        if (error) {
          await supabase.from('messages').update({ content: encodedContent }).eq('id', messageId);
        }
      } catch (err) {
        console.warn('Error saving direct reaction:', err);
      }
    }
  };

  const sendMessage = async (
    type: 'text' | 'image' | 'audio' = 'text', 
    mediaUrl?: string, 
    customCaption?: string,
    metaOptions?: { is_view_once?: boolean }
  ) => {
    if (!selectedUser || isUserBlocked || amIBlocked) return;
    if (type === 'text' && !newMessage.trim()) return;
    
    const isViewOnce = !!metaOptions?.is_view_once;
    const rawText = type === 'text' ? newMessage : (customCaption || '');
    const dbContent = encodeMessageContent(rawText, replyingTo || undefined, undefined, {
      is_view_once: isViewOnce,
      view_once_opened: false,
      opened_by: []
    });

    const messageData: any = {
      content: dbContent,
      sender_id: currentUserId,
      receiver_id: selectedUser.id,
      media_url: mediaUrl || null,
      type,
      reply_to: replyingTo || undefined,
      is_view_once: isViewOnce,
      view_once_opened: false,
      opened_by: [],
      created_at: new Date().toISOString()
    };

    const parsedOptimistic = parseMessage(messageData);

    // Optimistically add to messages
    setMessages(prev => [...prev, parsedOptimistic]);

    const contentPreview = type === 'text' ? newMessage : (type === 'audio' ? '🎵 Mensagem de áudio' : isViewOnce ? '📷 Foto de visualização única (1)' : '📷 Imagem');

    // Broadcast immediately over active WebSockets channel for instant 0ms arrival
    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'new_message',
        payload: messageData
      });
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { senderId: currentUserId, isTyping: false }
      });
    }

    const savedReplyTo = replyingTo;
    setNewMessage('');
    setReplyingTo(null);
    setAudioBlob(null);
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
    playSendSound();

    let { data: insertedData, error } = await supabase.from('messages').insert([messageData]).select();
    
    // Self-healing fallback if database schema lacks reply_to or reactions column
    if (error && (error.message?.includes('reply_to') || error.message?.includes('reactions') || error.message?.includes('is_view_once') || error.code === 'PGRST204')) {
      const { reply_to, reactions, is_view_once: _v, view_once_opened: _vo, opened_by: _ob, is_deleted: _del, deleted_for: _df, ...cleanPayload } = messageData;
      const retry = await supabase.from('messages').insert([cleanPayload]).select();
      insertedData = retry.data;
      error = retry.error;
    }

    if (!error && insertedData?.[0]) {
      if (savedReplyTo && insertedData[0].id) {
        try {
          localStorage.setItem(`gsi_reply_${insertedData[0].id}`, JSON.stringify(savedReplyTo));
        } catch {}
      }
      setMessages(prev => prev.map(m => m === parsedOptimistic ? parseMessage({ ...insertedData[0], reply_to: savedReplyTo, is_view_once: isViewOnce }) : m));

      triggerBackgroundNotification({
        senderId: currentUserId,
        senderName: userName,
        recipientId: selectedUser.id,
        title: `Nova mensagem de ${userName} 💬`,
        body: contentPreview,
        type: 'private_message',
        data: { url: '/messages' }
      });
    } else if (error) {
      console.error('[Messenger] Erro ao enviar mensagem privada:', error);
      fetchMessages(selectedUser.id);
    }
  };

  const sendGroupMessage = async (
    type: 'text' | 'image' | 'audio' = 'text', 
    mediaUrl?: string, 
    customCaption?: string,
    metaOptions?: { is_view_once?: boolean }
  ) => {
    if (!selectedGroup) return;
    if (type === 'text' && !newMessage.trim()) return;

    try {
      const isViewOnce = !!metaOptions?.is_view_once;
      const contentPreview = type === 'text' ? newMessage : (type === 'audio' ? '🎵 Mensagem de áudio' : isViewOnce ? '📷 Foto de visualização única (1)' : '📷 Imagem');
      const rawText = type === 'text' ? newMessage : (customCaption || '');
      const dbContent = encodeMessageContent(rawText, replyingTo || undefined, undefined, {
        is_view_once: isViewOnce,
        view_once_opened: false,
        opened_by: []
      });

      const messageData: any = {
        group_id: selectedGroup.id,
        sender_id: currentUserId,
        content: dbContent,
        type,
        media_url: mediaUrl,
        sender_name: userName,
        reply_to: replyingTo || undefined,
        is_view_once: isViewOnce,
        view_once_opened: false,
        opened_by: [],
        created_at: new Date().toISOString()
      };

      const parsedOptimistic = parseMessage(messageData);

      // Optimistically add to group messages
      setGroupMessages(prev => [...prev, parsedOptimistic]);

      // Broadcast immediately to active group channel
      if (activeGroupChannelRef.current) {
        activeGroupChannelRef.current.send({
          type: 'broadcast',
          event: 'new_message',
          payload: messageData
        });
        activeGroupChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { senderId: currentUserId, senderName: userName, isTyping: false }
        });
      }

      const savedReplyTo = replyingTo;
      setNewMessage('');
      setReplyingTo(null);
      setAudioBlob(null);
      playSendSound();

      let { data: insertedGroupData, error } = await supabase.from('group_messages').insert([messageData]).select();

      // Self-healing fallback if database schema lacks reply_to or reactions column
      if (error && (error.message?.includes('reply_to') || error.message?.includes('reactions') || error.message?.includes('is_view_once') || error.code === 'PGRST204')) {
        const { reply_to, reactions, is_view_once: _v, view_once_opened: _vo, opened_by: _ob, is_deleted: _del, deleted_for: _df, ...cleanPayload } = messageData as any;
        const retry = await supabase.from('group_messages').insert([cleanPayload]).select();
        insertedGroupData = retry.data;
        error = retry.error;
      }

      if (!error) {
        if (insertedGroupData && insertedGroupData[0]) {
          if (savedReplyTo && insertedGroupData[0].id) {
            try {
              localStorage.setItem(`gsi_reply_${insertedGroupData[0].id}`, JSON.stringify(savedReplyTo));
            } catch {}
          }
          const parsedSaved = parseMessage({ ...insertedGroupData[0], reply_to: savedReplyTo || undefined, is_view_once: isViewOnce });
          setGroupMessages(prev => prev.map(m => m === parsedOptimistic ? parsedSaved : m));
        }
        triggerBackgroundNotification({
          senderId: currentUserId,
          senderName: userName,
          recipientId: `group_${selectedGroup.id}`,
          title: `Grupo: ${selectedGroup.name} 👥`,
          body: `${userName}: ${contentPreview}`,
          type: 'group_message',
          data: { url: '/messages', groupId: selectedGroup.id }
        });
      }
    } catch (err) {
      console.error('Error sending group message in Messenger:', err);
      fetchGroupMessages(selectedGroup.id);
    }
  };

  // WhatsApp-Style Message Delete Handlers (Delete for everyone / Delete for me)
  const promptDeleteMessage = (msg: Message | GroupMessage) => {
    setMessageToDelete(msg);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteForEveryone = async (msg: Message | GroupMessage) => {
    setIsDeleteModalOpen(false);
    setMessageToDelete(null);

    const isGroup = !!(msg as GroupMessage).group_id;
    const deletedText = '🚫 Esta mensagem foi apagada';
    const encodedContent = encodeMessageContent(deletedText, undefined, undefined, { is_deleted: true });

    // 1. Optimistic update in UI
    if (isGroup) {
      setGroupMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_deleted: true, content: deletedText, media_url: undefined } : m));
    } else {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_deleted: true, content: deletedText, media_url: undefined } : m));
    }

    // 2. Broadcast realtime event
    const channel = isGroup ? activeGroupChannelRef.current : activeChannelRef.current;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'message_deleted',
        payload: { messageId: msg.id }
      });
    }

    // 3. Update Supabase
    try {
      const table = isGroup ? 'group_messages' : 'messages';
      await supabase.from(table).update({
        content: encodedContent,
        media_url: null
      }).eq('id', msg.id);
    } catch (err) {
      console.error('Error deleting message for everyone:', err);
    }
  };

  const confirmDeleteForMe = async (msg: Message | GroupMessage) => {
    setIsDeleteModalOpen(false);
    setMessageToDelete(null);

    const isGroup = !!(msg as GroupMessage).group_id;

    // 1. Save in localStorage
    try {
      localStorage.setItem(`gsi_deleted_msg_${msg.id}`, 'true');
    } catch {}

    // 2. Remove optimistically from UI
    if (isGroup) {
      setGroupMessages(prev => prev.filter(m => m.id !== msg.id));
    } else {
      setMessages(prev => prev.filter(m => m.id !== msg.id));
    }

    // 3. Update remote DB metadata if possible
    try {
      const table = isGroup ? 'group_messages' : 'messages';
      const currentDeletedFor = msg.deleted_for || [];
      const updatedDeletedFor = Array.from(new Set([...currentDeletedFor, currentUserId]));
      const encoded = encodeMessageContent(msg.content, msg.reply_to, msg.reactions, {
        is_view_once: msg.is_view_once,
        view_once_opened: msg.view_once_opened,
        opened_by: msg.opened_by,
        is_deleted: msg.is_deleted,
        deleted_for: updatedDeletedFor
      });
      await supabase.from(table).update({ content: encoded }).eq('id', msg.id);
    } catch (err) {
      console.warn('Note: error updating deleted_for in remote DB:', err);
    }
  };

  // WhatsApp-Style Clear Chat Handler (Limpar conversa)
  const handleClearChat = async () => {
    setIsClearChatModalOpen(false);
    setShowChatOptionsMenu(false);

    const nowIso = new Date().toISOString();
    if (selectedUser) {
      try {
        localStorage.setItem(`gsi_cleared_chat_${currentUserId}_${selectedUser.id}`, nowIso);
      } catch {}
      setMessages([]);
    } else if (selectedGroup) {
      try {
        localStorage.setItem(`gsi_cleared_group_${currentUserId}_${selectedGroup.id}`, nowIso);
      } catch {}
      setGroupMessages([]);
    }
  };

  // WhatsApp-Style View-Once Open Handler
  const handleOpenViewOnce = (msg: Message | GroupMessage) => {
    setActiveViewOnceImage(msg);

    const isGroup = !!(msg as GroupMessage).group_id;
    try {
      localStorage.setItem(`gsi_view_once_opened_${msg.id}`, 'true');
    } catch {}

    // Optimistic UI update
    if (isGroup) {
      setGroupMessages(prev => prev.map(m => m.id === msg.id ? { 
        ...m, 
        view_once_opened: true, 
        opened_by: Array.from(new Set([...(m.opened_by || []), currentUserId])) 
      } : m));
    } else {
      setMessages(prev => prev.map(m => m.id === msg.id ? { 
        ...m, 
        view_once_opened: true, 
        opened_by: Array.from(new Set([...(m.opened_by || []), currentUserId])) 
      } : m));
    }

    // Broadcast to sender
    const channel = isGroup ? activeGroupChannelRef.current : activeChannelRef.current;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'view_once_opened',
        payload: { messageId: msg.id, openedBy: currentUserId }
      });
    }

    // Update in Supabase
    try {
      const table = isGroup ? 'group_messages' : 'messages';
      const updatedOpenedBy = Array.from(new Set([...(msg.opened_by || []), currentUserId]));
      const encoded = encodeMessageContent(msg.content, msg.reply_to, msg.reactions, {
        is_view_once: true,
        view_once_opened: true,
        opened_by: updatedOpenedBy,
        is_deleted: msg.is_deleted,
        deleted_for: msg.deleted_for
      });
      supabase.from(table).update({ content: encoded }).eq('id', msg.id);
    } catch (err) {
      console.warn('Note: error updating view_once_opened in DB:', err);
    }
  };

  // WhatsApp-Style Image Selection & Preview Composer Handlers
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>, isGroup: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImagePreview(reader.result as string);
      setSelectedImageFile(file);
      setImageTargetIsGroup(isGroup);
      setIsViewOnceSelected(false);
      setImageCaption('');
      setIsImagePreviewModalOpen(true);
    };
    reader.readAsDataURL(file);

    e.target.value = '';
  };

  const handleSendPreviewImage = async () => {
    if (!selectedImageFile) return;

    setIsUploading(true);
    try {
      const fileExt = selectedImageFile.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = imageTargetIsGroup 
        ? `group-images/${selectedGroup?.id}/${fileName}`
        : `private-media/${currentUserId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, selectedImageFile);

      if (uploadError) {
        alert('Erro ao carregar imagem: ' + (uploadError.message || 'Erro'));
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      if (imageTargetIsGroup) {
        await sendGroupMessage('image', publicUrl, imageCaption, { is_view_once: isViewOnceSelected });
      } else {
        await sendMessage('image', publicUrl, imageCaption, { is_view_once: isViewOnceSelected });
      }

      setIsImagePreviewModalOpen(false);
      setSelectedImagePreview(null);
      setSelectedImageFile(null);
      setImageCaption('');
      setIsViewOnceSelected(false);
    } catch (err: any) {
      console.error('Error sending preview image:', err);
      alert('Erro ao enviar imagem: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleImageSelect(e, true);
  };

  const handlePrivateImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleImageSelect(e, false);
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup) return;

    if (selectedGroup.created_by === currentUserId) {
      alert('Como Administrador e criador deste grupo, você não pode sair sem transferir a posse ou excluir o grupo.');
      return;
    }

    if (!confirm(`Tem certeza de que deseja sair do grupo "${selectedGroup.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', selectedGroup.id)
        .eq('user_id', currentUserId);

      if (error) throw error;

      // Broadcast system notice
      await supabase.from('group_messages').insert([{
        group_id: selectedGroup.id,
        sender_id: currentUserId,
        content: `${userName} saiu do grupo.`,
        type: 'text',
        sender_name: 'Sistema'
      }]);

      setShowGroupModal(false);
      setSelectedGroup(null);
      await fetchGroups();
      alert('Você saiu do grupo com sucesso.');
    } catch (err: any) {
      console.error('Error leaving group:', err);
      alert('Erro ao sair do grupo: ' + (err.message || 'Tente novamente.'));
    }
  };

  const startRecording = async () => {
    if (isStartingRef.current || isRecording) return;
    isStartingRef.current = true;

    try {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewUrl(null);
      }
      setAudioBlob(null);

      const recorder = new UniversalAudioRecorder();
      universalRecorderRef.current = recorder;
      await recorder.start();

      setIsRecording(true);
      setRecordingTime(0);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      universalRecorderRef.current?.cancel();
      universalRecorderRef.current = null;
      setIsRecording(false);
      isStartingRef.current = false;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('Permission denied')) {
        showMicError('Permissão de microfone negada. Autorize o microfone no navegador.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        showMicError('Nenhum microfone encontrado no seu dispositivo.');
      } else {
        showMicError('Não foi possível gravar áudio. Verifique as permissões do microfone no navegador.');
      }
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    isStartingRef.current = false;

    const recorder = universalRecorderRef.current;
    if (!recorder) return;

    try {
      const result = await recorder.stop();
      universalRecorderRef.current = null;
      if (result && result.blob && result.blob.size > 50) {
        setAudioBlob(result.blob);
        setAudioPreviewUrl(result.url);
        setRecordingTime(result.duration || recordingTime);
      } else {
        showMicError('Áudio muito curto. Grave por pelo menos 1 segundo.');
      }
    } catch (err: any) {
      console.warn('[Messenger] Erro ao parar gravação de áudio:', err);
      universalRecorderRef.current = null;
      showMicError('Falha ao processar gravação de áudio.');
    }
  };

  const cancelRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (universalRecorderRef.current) {
      universalRecorderRef.current.cancel();
      universalRecorderRef.current = null;
    }
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
    setAudioBlob(null);
    setIsRecording(false);
    isStartingRef.current = false;
    setRecordingTime(0);
  };

  const sendAudio = async () => {
    if (!audioBlob || audioBlob.size === 0) {
      showMicError('Nenhum áudio gravado para enviar.');
      return;
    }
    if (!selectedGroup && !selectedUser) return;

    setIsUploading(true);
    try {
      const rawMime = (audioBlob.type || 'audio/mp4').split(';')[0].trim();
      let cleanType = rawMime || 'audio/mp4';
      let ext = 'mp4';

      if (cleanType.includes('webm')) {
        ext = 'webm';
        cleanType = 'audio/webm';
      } else if (cleanType.includes('mp4')) {
        ext = 'mp4';
        cleanType = 'audio/mp4';
      } else if (cleanType.includes('aac')) {
        ext = 'aac';
        cleanType = 'audio/aac';
      } else if (cleanType.includes('ogg')) {
        ext = 'ogg';
        cleanType = 'audio/ogg';
      } else if (cleanType.includes('wav')) {
        ext = 'wav';
        cleanType = 'audio/wav';
      }

      const fileName = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const folder = selectedGroup ? `group-audio/${selectedGroup.id}` : `chat-audio/${currentUserId}`;
      const filePath = `${folder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, audioBlob, {
          contentType: cleanType,
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.warn('Supabase storage upload note:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (!publicUrl) {
        throw new Error('Falha ao obter URL pública do áudio.');
      }

      if (selectedGroup) {
        await sendGroupMessage('audio', publicUrl);
      } else if (selectedUser) {
        await sendMessage('audio', publicUrl);
      }

      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewUrl(null);
      }
      setAudioBlob(null);
      setRecordingTime(0);
    } catch (err: any) {
      console.warn('Audio upload note in Messenger:', err);
      showMicError(`Erro ao enviar áudio: ${err.message || 'Verifique sua conexão'}`);
    } finally {
      setIsUploading(false);
    }
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
      if (!confirm(`Deseja bloquear ${selectedUser.full_name}?`)) return;
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

  const filteredProfiles = profiles.filter(p => 
    p.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase()) || 
    (g.description && g.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="fixed inset-0 z-[100] bg-[#0a0e17] flex flex-col md:inset-auto md:right-6 md:bottom-20 md:w-[440px] md:h-[660px] md:rounded-[2.5rem] md:border md:border-white/10 md:shadow-2xl overflow-hidden"
    >
      {/* Top Header of Messenger */}
      <div className="bg-[#1c2431] px-5 py-4 flex items-center justify-between border-b border-white/5 relative z-20">
        <div className="flex items-center gap-3 min-w-0">
          {selectedGroup ? (
            <button 
              onClick={() => {
                setSelectedGroup(null);
                setShowGroupModal(false);
              }} 
              className="p-2 hover:bg-white/5 rounded-full text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          ) : selectedUser ? (
            <button 
              onClick={() => setSelectedUser(null)} 
              className="p-2 hover:bg-white/5 rounded-full text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/20 flex items-center justify-center text-[#d4af37]">
              <MessageSquare size={20} />
            </div>
          )}

          {/* Group Header Title & Clickable Info Trigger */}
          {selectedGroup ? (
            <div 
              onClick={() => setShowGroupModal(true)}
              className="cursor-pointer group flex items-center gap-2.5 min-w-0"
              title="Clique para ver participantes do grupo"
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#d4af37]/40 shadow relative flex-shrink-0">
                <img src={selectedGroup.cover_url} className="w-full h-full object-cover" alt={selectedGroup.name} />
                {selectedGroup.is_private && (
                  <div className="absolute top-0 right-0 p-0.5 bg-[#d4af37] rounded-bl">
                    <Lock size={8} className="text-black" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-black text-white uppercase tracking-wider truncate group-hover:text-[#d4af37] transition-colors">
                  {selectedGroup.name}
                </h3>
                {Object.values(groupTypingUsers).length > 0 ? (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-[#00a884] lowercase tracking-wide animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] inline-block animate-ping" />
                    <span className="truncate">{(Object.values(groupTypingUsers) as { userName: string; timestamp: number }[]).map(u => u.userName).join(', ')} está a digitar...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#d4af37] uppercase tracking-wider">
                    <Users size={11} />
                    <span>{groupMembers.length} Participantes • Ver Lista</span>
                  </div>
                )}
              </div>
            </div>
          ) : selectedUser ? (
            <div className="min-w-0">
              <h3 className="text-xs font-black text-white uppercase tracking-wider truncate">
                {selectedUser.full_name}
              </h3>
              {isPartnerTyping ? (
                <p className="text-[10px] font-bold text-[#00a884] lowercase tracking-wide flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] inline-block animate-ping" />
                  <span>digitando...</span>
                </p>
              ) : isUserBlocked ? (
                <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest truncate">
                  Contacto Bloqueado
                </p>
              ) : onlineUsers.has(selectedUser.id) ? (
                <p className="text-[10px] font-bold text-[#00a884] lowercase tracking-wide flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] inline-block" />
                  <span>online</span>
                </p>
              ) : (
                <p className="text-[9px] font-medium text-white/50 tracking-tight truncate lowercase">
                  {formatLastSeen(selectedUser)}
                </p>
              )}
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Messenger GSI
              </h3>
              <p className="text-[9px] font-bold text-[#d4af37] uppercase tracking-widest">
                Comunicação em Obra
              </p>
            </div>
          )}
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-1 relative">
          {selectedGroup && (
            <button 
              onClick={() => setShowGroupModal(true)}
              className="p-2.5 bg-white/5 hover:bg-[#d4af37]/10 text-white/60 hover:text-[#d4af37] rounded-xl transition-all"
              title="Ver Participantes do Grupo"
            >
              <Info size={18} />
            </button>
          )}

          {selectedUser && !isUserBlocked && !amIBlocked && (
            <>
              <button 
                onClick={() => startCall('audio')}
                className="p-2.5 hover:bg-white/5 text-[#d4af37] hover:text-[#0084ff] rounded-xl transition-all"
                title="Chamada de Voz"
              >
                <Phone size={18} />
              </button>
              <button 
                onClick={() => startCall('video')}
                className="p-2.5 hover:bg-white/5 text-[#d4af37] hover:text-[#0084ff] rounded-xl transition-all"
                title="Chamada de Vídeo"
              >
                <Video size={18} />
              </button>
            </>
          )}

          {/* WhatsApp Options Menu (Limpar Conversa / Bloquear) */}
          {(selectedUser || selectedGroup) && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowChatOptionsMenu(prev => !prev)}
                className="p-2.5 hover:bg-white/5 text-white/60 hover:text-white rounded-xl transition-all"
                title="Mais opções da conversa"
              >
                <MoreVertical size={18} />
              </button>

              {showChatOptionsMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-[#233138] border border-white/10 rounded-2xl shadow-2xl py-1.5 z-50 animate-fadeIn text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChatOptionsMenu(false);
                      setIsClearChatModalOpen(true);
                    }}
                    className="w-full px-4 py-2.5 text-left text-slate-200 hover:text-red-400 hover:bg-white/5 flex items-center gap-2.5 transition-colors font-semibold"
                  >
                    <Trash2 size={15} className="text-red-400" />
                    <span>Limpar conversa</span>
                  </button>

                  {selectedUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowChatOptionsMenu(false);
                        toggleBlock();
                      }}
                      className="w-full px-4 py-2.5 text-left text-slate-200 hover:text-red-400 hover:bg-white/5 flex items-center gap-2.5 transition-colors border-t border-white/5 font-semibold"
                    >
                      <Ban size={15} className={isUserBlocked ? 'text-green-400' : 'text-red-400'} />
                      <span>{isUserBlocked ? 'Desbloquear contato' : 'Bloquear contato'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <button 
            onClick={onClose} 
            className="p-2.5 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Tab Switcher (Only when not in an active conversation) */}
      {!selectedUser && !selectedGroup && (
        <div className="px-5 pt-3 pb-1 bg-[#1c2431]/60 flex gap-2 border-b border-white/5">
          <button 
            onClick={() => setActiveTab('groups')}
            className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              activeTab === 'groups'
                ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users size={14} />
            Grupos ({groups.length})
          </button>
          <button 
            onClick={() => setActiveTab('direct')}
            className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              activeTab === 'direct'
                ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare size={14} />
            Privadas ({profiles.length})
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {/* GROUP INFO MODAL AT TOP OF MESSENGER */}
        <AnimatePresence>
          {showGroupModal && selectedGroup && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col overflow-hidden"
            >
              <motion.div
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -40, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-[#1c2431] border-b border-white/10 shadow-2xl p-6 flex flex-col max-h-full overflow-hidden"
              >
                {/* Modal Top Bar */}
                <div className="flex items-center justify-between pb-4 border-b border-white/5">
                  <div className="flex items-center gap-2 text-white">
                    <Users size={18} className="text-[#d4af37]" />
                    <h3 className="text-xs font-black uppercase tracking-wider">Participantes do Grupo</h3>
                  </div>
                  <button 
                    onClick={() => setShowGroupModal(false)}
                    className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Group Details Hero */}
                <div className="py-4 flex items-center gap-4 border-b border-white/5">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#d4af37] shadow-xl flex-shrink-0">
                    <img src={selectedGroup.cover_url} className="w-full h-full object-cover" alt={selectedGroup.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-black text-white uppercase tracking-tight truncate">
                      {selectedGroup.name}
                    </h4>
                    <p className="text-[10px] text-white/40 line-clamp-1 mt-0.5">
                      {selectedGroup.description || 'Sem descrição.'}
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/30">
                      <Users size={12} className="text-[#d4af37]" />
                      <span className="text-[9px] font-black text-[#d4af37] uppercase tracking-wider">
                        {groupMembers.length} {groupMembers.length === 1 ? 'Participante' : 'Participantes no Total'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Participants List */}
                <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1 custom-scrollbar min-h-[140px] max-h-[260px]">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/30 px-1 mb-1">
                    Membros da Equipe
                  </p>
                  {groupMembers.map((m) => {
                    const prof = m.profile;
                    const isAdm = m.user_id === selectedGroup.created_by || m.role === 'admin';
                    const isMe = m.user_id === currentUserId;
                    const isOnline = onlineUsers.has(m.user_id);

                    return (
                      <div 
                        key={m.id || m.user_id}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-black/25 border border-white/5 hover:border-white/10 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative flex-shrink-0">
                            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10 bg-[#0a0e17]">
                              {prof?.avatar_url ? (
                                <img src={prof.avatar_url} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center font-black text-xs text-[#d4af37]">
                                  {(prof?.full_name || 'U').charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            {isOnline && (
                              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#1c2431]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-black text-white truncate">
                                {prof?.full_name}
                              </p>
                              {isMe && (
                                <span className="text-[7px] font-black text-white/40 uppercase bg-white/5 px-1 py-0.5 rounded">
                                  Você
                                </span>
                              )}
                              {isAdm && (
                                <span className="text-[7px] font-black bg-[#d4af37] text-black px-1.5 py-0.5 rounded uppercase font-mono">
                                  ADM
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider">
                              {prof?.role || 'Membro'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Modal Footer Actions: Leave Group Functionality */}
                <div className="pt-4 border-t border-white/5 space-y-2">
                  {selectedGroup.created_by !== currentUserId ? (
                    <button 
                      onClick={handleLeaveGroup}
                      className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 active:scale-98 shadow-lg shadow-red-500/10"
                    >
                      <LogOut size={16} />
                      Sair do Grupo
                    </button>
                  ) : (
                    <div className="p-3 bg-[#d4af37]/10 rounded-2xl border border-[#d4af37]/20 text-center">
                      <p className="text-[9px] font-black text-[#d4af37] uppercase tracking-wider">
                        Você é o Administrador deste grupo
                      </p>
                    </div>
                  )}

                  <button 
                    onClick={() => setShowGroupModal(false)}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. GROUPS VIEW (GROUP CONVERSATION) */}
        {selectedGroup ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#efeae2]">
            {/* WhatsApp Custom Light Pattern Background */}
            <div 
              className="absolute inset-0 opacity-40 pointer-events-none" 
              style={{ 
                backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', 
                backgroundSize: '360px',
                backgroundRepeat: 'repeat'
              }} 
            />

            {/* Group Message Stream */}
            <div 
              ref={groupScrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative z-10"
            >
              <div className="flex flex-col items-center justify-center py-4 opacity-60">
                <div className="px-3.5 py-1 rounded-full bg-white/80 border border-slate-200 shadow-sm flex items-center gap-1.5 text-slate-600 text-[9px] font-bold uppercase tracking-wider">
                  <Lock size={11} className="text-[#075e54]" />
                  <span>Mensagens do Grupo</span>
                </div>
              </div>

              {groupMessages.map((msg, i) => {
                const isMe = msg.sender_id === currentUserId;
                const member = groupMembers.find(m => m.user_id === msg.sender_id);
                const senderName = isMe ? (userName || 'Você') : (member?.profile?.full_name || msg.sender_name || 'Colega');
                const senderAvatar = isMe ? userAvatar : member?.profile?.avatar_url;

                if (msg.sender_name === 'Sistema') {
                  return (
                    <div key={msg.id || i} className="w-full flex justify-center py-1">
                      <span className="bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-bold text-slate-600 uppercase tracking-widest border border-slate-200 shadow-sm">
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-4 px-1`}>
                    <div className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar beside message balloon */}
                      <div className="w-7 h-7 rounded-full overflow-hidden shadow-sm flex-shrink-0 mb-1 border border-white bg-slate-300">
                        {senderAvatar ? (
                          <img src={senderAvatar} className="w-full h-full object-cover" alt={senderName} />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center text-[10px] font-black ${isMe ? 'bg-[#d4af37] text-black' : 'bg-slate-700 text-[#d4af37]'}`}>
                            {senderName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Balloon with Sender Name */}
                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} min-w-0`}>
                        {/* Sender Name above message balloon */}
                        <div className={`flex items-center gap-1.5 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className={`text-[10px] font-black tracking-wide ${isMe ? 'text-[#075e54]' : 'text-[#128c7e]'}`}>
                            {isMe ? 'Você' : senderName}
                          </span>
                          {msg.sender_id === selectedGroup.created_by && (
                            <span className="bg-[#d4af37] text-black text-[6px] font-black px-1 rounded uppercase font-mono shadow-sm">
                              ADM
                            </span>
                          )}
                        </div>

                        <motion.div 
                          drag="x"
                          dragConstraints={{ left: 0, right: 60 }}
                          dragElastic={0.2}
                          dragSnapToOrigin
                          onDragEnd={(_, info) => {
                            if (info.offset.x > 30) {
                              handleSelectReply(msg, senderName);
                            }
                          }}
                          onTouchStart={() => {
                            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                            longPressTimerRef.current = setTimeout(() => {
                              setReactionMenuMessageId(msg.id);
                              if (navigator.vibrate) navigator.vibrate(40);
                            }, 400);
                          }}
                          onTouchMove={() => {
                            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                          }}
                          onTouchEnd={() => {
                            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setReactionMenuMessageId(msg.id);
                          }}
                          className={`
                            px-3.5 py-2 rounded-2xl shadow-sm relative text-xs cursor-pointer select-none group
                            ${isMe 
                              ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-none border border-[#c2f0b9]' 
                              : 'bg-white text-[#111b21] rounded-tl-none border border-slate-200/80'
                            }
                          `}
                        >
                          {/* Triangle Tip */}
                          <div className={`
                            absolute top-0 w-2.5 h-2.5 
                            ${isMe 
                              ? 'left-full -ml-1 border-l-[8px] border-l-[#d9fdd3] border-b-[8px] border-b-transparent' 
                              : 'right-full -mr-1 border-r-[8px] border-r-white border-b-[8px] border-b-transparent'
                            }
                          `} />

                          {/* WhatsApp Floating Reactions Menu with Delete Action */}
                          {reactionMenuMessageId === msg.id && (
                            <div className={`
                              absolute -top-10 ${isMe ? 'right-0' : 'left-0'} z-30
                              bg-white/95 backdrop-blur-md rounded-full px-2.5 py-1 shadow-xl border border-slate-200/90 flex items-center gap-1.5 animate-fadeIn
                            `}>
                              {QUICK_REACTION_EMOJIS.map(emoji => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReaction(msg.id, emoji, true);
                                  }}
                                  className="text-base hover:scale-130 active:scale-95 transition-transform p-0.5"
                                >
                                  {emoji}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReactionMenuMessageId(null);
                                  promptDeleteMessage(msg);
                                }}
                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-full transition-colors ml-1"
                                title="Apagar mensagem"
                              >
                                <Trash2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReactionMenuMessageId(null);
                                }}
                                className="text-slate-400 hover:text-slate-600 ml-0.5 p-0.5"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}

                          {/* WhatsApp Quoted Reply Box */}
                          {msg.reply_to && !msg.is_deleted && (
                            <div className={`
                              mb-1.5 p-2 rounded-lg border-l-4 text-left text-[11px] select-none
                              ${isMe 
                                ? 'bg-[#c3ebb8] border-[#075e54] text-slate-800' 
                                : 'bg-slate-100 border-[#00a884] text-slate-800'
                              }
                            `}>
                              <p className="font-bold text-[10px] text-[#075e54] truncate">
                                {msg.reply_to.sender_name || 'Mensagem'}
                              </p>
                              <p className="text-slate-600 truncate text-[10.5px]">
                                {msg.reply_to.type === 'audio' ? '🎵 Mensagem de áudio' : msg.reply_to.type === 'image' ? '📷 Foto' : msg.reply_to.content}
                              </p>
                            </div>
                          )}

                          {/* Deleted Message State */}
                          {msg.is_deleted ? (
                            <div className="flex items-center gap-1.5 py-1 text-slate-500 italic text-[11px] select-none">
                              <Ban size={13} className="text-slate-400 opacity-70 flex-shrink-0" />
                              <span>Esta mensagem foi apagada</span>
                            </div>
                          ) : msg.is_view_once ? (
                            /* WhatsApp View-Once Media Bubble */
                            (() => {
                              const hasOpened = msg.view_once_opened || (msg.opened_by && msg.opened_by.includes(currentUserId)) || (typeof window !== 'undefined' && localStorage.getItem(`gsi_view_once_opened_${msg.id}`) === 'true');
                              if (isMe) {
                                return (
                                  <div className="flex items-center gap-2.5 py-1 px-1">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                                      hasOpened ? 'border border-slate-400 text-slate-500' : 'border-2 border-[#00a884] text-[#00a884]'
                                    }`}>
                                      {hasOpened ? '✓' : '1'}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-slate-800 font-bold text-xs flex items-center gap-1">
                                        Foto
                                        <span className="text-[8.5px] px-1.5 py-0.5 rounded-full bg-[#00a884]/20 text-[#00a884] font-black uppercase">
                                          {hasOpened ? 'Aberta' : 'Visualização única'}
                                        </span>
                                      </span>
                                      {msg.content && <p className="text-[11px] text-slate-600 mt-0.5">{msg.content}</p>}
                                    </div>
                                  </div>
                                );
                              }

                              if (hasOpened) {
                                return (
                                  <div className="flex items-center gap-2.5 py-1 px-1 opacity-70">
                                    <div className="w-7 h-7 rounded-full border border-slate-400 flex items-center justify-center text-xs font-bold text-slate-500">
                                      ✓
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-slate-700 font-bold text-xs flex items-center gap-1">
                                        Foto aberta
                                      </span>
                                      <span className="text-[9px] text-slate-400">Esta mídia já expirou</span>
                                      {msg.content && <p className="text-[11px] text-slate-500 mt-0.5">{msg.content}</p>}
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <button
                                  type="button"
                                  onClick={() => handleOpenViewOnce(msg)}
                                  className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-black/5 active:bg-black/10 rounded-xl transition-all w-full text-left"
                                >
                                  <div className="w-7 h-7 rounded-full border-2 border-[#00a884] bg-[#00a884]/10 flex items-center justify-center text-xs font-black text-[#00a884] animate-pulse flex-shrink-0">
                                    1
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-slate-900 font-bold text-xs flex items-center gap-1.5">
                                      Foto
                                      <span className="text-[8.5px] px-1.5 py-0.5 rounded-full bg-[#00a884] text-white font-black uppercase">
                                        Toque para abrir
                                      </span>
                                    </span>
                                    <span className="text-[10px] text-[#00a884] font-medium">Visualização única</span>
                                    {msg.content && <p className="text-[11px] text-slate-700 mt-0.5 truncate">{msg.content}</p>}
                                  </div>
                                </button>
                              );
                            })()
                          ) : msg.type === 'text' ? (
                            <p className="leading-relaxed break-words text-[12px]">{msg.content}</p>
                          ) : msg.type === 'image' ? (
                            <img 
                              src={msg.media_url} 
                              className="max-w-full rounded-xl cursor-pointer hover:opacity-90 transition-all border border-black/10" 
                              onClick={() => window.open(msg.media_url)} 
                              alt=""
                            />
                          ) : (msg.type === 'audio' || (msg.media_url && (msg.media_url.includes('/group-audio/') || msg.media_url.endsWith('.webm') || msg.media_url.endsWith('.mp4') || msg.media_url.endsWith('.m4a') || msg.media_url.endsWith('.aac') || msg.media_url.endsWith('.ogg') || msg.media_url.endsWith('.wav')))) ? (
                            <AudioPlayer src={msg.media_url || msg.content || ''} isMe={isMe} />
                          ) : (
                            <p className="leading-relaxed break-words text-[12px]">{msg.content}</p>
                          )}

                          <div className="flex justify-end items-center gap-1 mt-1 opacity-60 text-[#667781]">
                            <span className="text-[8px] font-semibold">
                              {format(new Date(msg.created_at), 'HH:mm')}
                            </span>
                            {isMe && (
                              <span className="text-[8px] text-[#53bdeb] font-bold">✓✓</span>
                            )}
                            {!msg.is_deleted && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  promptDeleteMessage(msg);
                                }}
                                className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-opacity ml-1 rounded"
                                title="Apagar frase ou mensagem"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>

                          {/* WhatsApp Reaction Pill Badge */}
                          {msg.reactions && Object.entries(msg.reactions).some(([_, uids]) => Array.isArray(uids) && (uids as string[]).length > 0) && (
                            <div className={`
                              absolute -bottom-2.5 ${isMe ? 'right-2' : 'left-2'} 
                              flex items-center gap-1 bg-white border border-slate-200/90 rounded-full px-2 py-0.5 shadow-sm text-[11px] z-10
                            `}>
                              {Object.entries(msg.reactions).map(([emoji, uids]) => {
                                const userList = (uids as string[]) || [];
                                if (!Array.isArray(userList) || userList.length === 0) return null;
                                const userReacted = userList.includes(currentUserId);
                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleReaction(msg.id, emoji, true)}
                                    className={`
                                      flex items-center gap-0.5 px-1 rounded-full transition-all
                                      ${userReacted ? 'bg-[#d9fdd3] text-[#075e54] font-bold scale-105' : 'hover:bg-slate-100'}
                                    `}
                                  >
                                    <span>{emoji}</span>
                                    {userList.length > 1 && <span className="text-[9px] font-bold text-slate-600">{userList.length}</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </motion.div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {groupMessages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center opacity-40">
                  <Users size={36} className="mb-2 text-[#075e54]" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-700">Início das mensagens do grupo</p>
                </div>
              )}

              {/* Group Typing Indicator Bubble */}
              {Object.values(groupTypingUsers).length > 0 && (
                <div className="flex justify-start mb-3 px-1 animate-fadeIn">
                  <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-2xl rounded-tl-none border border-slate-200/80 shadow-sm text-slate-800">
                    <span className="text-[10px] font-bold text-[#128c7e]">
                      {(Object.values(groupTypingUsers) as { userName: string; timestamp: number }[]).map(u => u.userName).join(', ')}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce"></span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Active Recording State Banner */}
            {isRecording && (
              <div className="p-2.5 bg-red-500/10 border-t border-red-500/20 flex items-center justify-between relative z-20 animate-pulse">
                <div className="flex items-center gap-2 text-red-500 text-xs font-black uppercase tracking-wider">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span>Gravando Áudio... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="p-1 text-slate-400 hover:text-red-500 text-[10px] font-black uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-3 py-1 bg-red-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm hover:bg-red-600 transition-colors"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            )}

            {/* Audio Ready Preview Banner */}
            {audioBlob && !isRecording && (
              <div className="p-3 bg-amber-500/10 border-t border-amber-500/20 flex flex-col gap-2 relative z-20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-600 text-[10px] font-black uppercase tracking-wider">
                    <Mic size={15} />
                    <span>Áudio Gravado ({recordingTime > 0 ? `${recordingTime}s` : 'Pronto'})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={cancelRecording} 
                      disabled={isUploading}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      title="Descartar áudio"
                    >
                      <X size={16} />
                    </button>
                    <button 
                      onClick={sendAudio}
                      disabled={isUploading}
                      className="px-3.5 py-1.5 bg-[#00a884] hover:bg-[#008f6f] text-white font-black text-[9px] uppercase tracking-wider rounded-xl shadow active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Send size={12} />
                          <span>Enviar Áudio</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {audioPreviewUrl && (
                  <div className="bg-white/90 rounded-2xl p-1 border border-slate-200/80 shadow-sm">
                    <AudioPlayer src={audioPreviewUrl} isMe={true} recordedDuration={recordingTime} />
                  </div>
                )}
              </div>
            )}

            {/* Mic Error Banner */}
            {micError && (
              <div className="p-3 bg-red-500/10 border-t border-red-500/20 flex items-center justify-between text-red-600 text-xs font-semibold relative z-20">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className="flex-shrink-0" />
                  <span>{micError}</span>
                </div>
                <button onClick={() => setMicError(null)} className="p-1 hover:text-red-800">
                  <X size={15} />
                </button>
              </div>
            )}

            {/* WhatsApp Replying Preview Bar in Group Chat */}
            {replyingTo && !isRecording && (
              <div className="px-4 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shadow-sm relative z-20 animate-fadeIn">
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-2.5 border-l-4 border-[#00a884]">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-[#00a884] truncate uppercase tracking-wider">
                      Respondendo a {replyingTo.sender_name || 'Mensagem'}
                    </p>
                    <p className="text-xs text-slate-600 truncate font-normal">
                      {replyingTo.type === 'audio' ? '🎵 Mensagem de áudio' : replyingTo.type === 'image' ? '📷 Foto' : replyingTo.content}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full transition-colors flex-shrink-0"
                  title="Cancelar resposta"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Input Bar or Active Recording Toolbar */}
            {isRecording ? (
              <div className="p-3 bg-red-50 border-t border-red-200 flex items-center justify-between gap-3 relative z-20 animate-fadeIn">
                <div className="flex items-center gap-2.5 text-red-600 font-bold text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping inline-block" />
                  <span className="tracking-wide">Gravando: {formatRecordingTime(recordingTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={cancelRecording}
                    className="px-3 py-1.5 text-slate-600 hover:text-red-600 bg-white rounded-xl border border-slate-200 text-xs font-semibold shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <Trash2 size={13} />
                    <span>Cancelar</span>
                  </button>
                  <button 
                    type="button"
                    onClick={stopRecording}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <Square size={12} fill="currentColor" />
                    <span>Concluir</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#f0f2f5] border-t border-slate-200 flex items-center gap-2 relative z-20">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-[#075e54] transition-colors rounded-full bg-white border border-slate-200 shadow-sm flex-shrink-0"
                >
                  <ImageIcon size={16} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                />

                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => handleTypingChange(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendGroupMessage('text')}
                  placeholder="Mensagem"
                  className="flex-1 bg-white border border-slate-200 rounded-full px-4 py-2.5 text-xs font-normal text-slate-900 outline-none focus:ring-1 focus:ring-[#00a884] shadow-sm transition-all placeholder:text-slate-400"
                />

                {newMessage.trim() ? (
                  <button 
                    onClick={() => sendGroupMessage('text')}
                    className="w-9 h-9 bg-[#00a884] text-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-sm flex-shrink-0"
                  >
                    <Send size={15} className="ml-0.5" />
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={startRecording}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0 bg-[#00a884] text-white hover:bg-[#008f6f] active:scale-95 shadow-sm"
                    title="Toque para gravar áudio"
                  >
                    <Mic size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
        ) : selectedUser ? (
          /* 2. DIRECT PRIVATE CHAT */
          <div className="flex-1 flex flex-col overflow-hidden bg-[#efeae2]">
            {/* WhatsApp Custom Light Pattern Background */}
            <div 
              className="absolute inset-0 opacity-40 pointer-events-none" 
              style={{ 
                backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', 
                backgroundSize: '360px',
                backgroundRepeat: 'repeat'
              }} 
            />

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative z-10"
            >
              <div className="flex flex-col items-center justify-center py-3 opacity-60">
                <div className="px-3.5 py-1 rounded-full bg-white/80 border border-slate-200 shadow-sm flex items-center gap-1.5 text-slate-600 text-[9px] font-bold uppercase tracking-wider">
                  <Lock size={11} className="text-[#075e54]" />
                  <span>Conversa Privada Segura</span>
                </div>
              </div>

              {messages.map((msg, i) => {
                const isMe = msg.sender_id === currentUserId;
                const senderName = isMe ? (userName || 'Você') : selectedUser.full_name;
                const senderAvatar = isMe ? userAvatar : selectedUser.avatar_url;

                return (
                  <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-4 px-1`}>
                    <div className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar beside message balloon */}
                      <div className="w-7 h-7 rounded-full overflow-hidden shadow-sm flex-shrink-0 mb-1 border border-white bg-slate-300">
                        {senderAvatar ? (
                          <img src={senderAvatar} className="w-full h-full object-cover" alt={senderName} />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center text-[10px] font-black ${isMe ? 'bg-[#d4af37] text-black' : 'bg-slate-700 text-[#d4af37]'}`}>
                            {senderName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Balloon with Sender Name */}
                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} min-w-0`}>
                        {/* Sender Name above message balloon */}
                        <div className={`flex items-center gap-1.5 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className={`text-[10px] font-black tracking-wide ${isMe ? 'text-[#075e54]' : 'text-[#128c7e]'}`}>
                            {isMe ? 'Você' : senderName}
                          </span>
                        </div>

                        <motion.div 
                          drag="x"
                          dragConstraints={{ left: 0, right: 60 }}
                          dragElastic={0.2}
                          dragSnapToOrigin
                          onDragEnd={(_, info) => {
                            if (info.offset.x > 30) {
                              handleSelectReply(msg, senderName);
                            }
                          }}
                          onTouchStart={() => {
                            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                            longPressTimerRef.current = setTimeout(() => {
                              setReactionMenuMessageId(msg.id);
                              if (navigator.vibrate) navigator.vibrate(40);
                            }, 400);
                          }}
                          onTouchMove={() => {
                            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                          }}
                          onTouchEnd={() => {
                            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setReactionMenuMessageId(msg.id);
                          }}
                          className={`
                            px-3.5 py-2 rounded-2xl shadow-sm relative text-xs cursor-pointer select-none group
                            ${isMe 
                              ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-none border border-[#c2f0b9]' 
                              : 'bg-white text-[#111b21] rounded-tl-none border border-slate-200/80'
                            }
                          `}
                        >
                          {/* Triangle Tip */}
                          <div className={`
                            absolute top-0 w-2.5 h-2.5 
                            ${isMe 
                              ? 'left-full -ml-1 border-l-[8px] border-l-[#d9fdd3] border-b-[8px] border-b-transparent' 
                              : 'right-full -mr-1 border-r-[8px] border-r-white border-b-[8px] border-b-transparent'
                            }
                          `} />

                          {/* WhatsApp Floating Reactions Menu */}
                          {reactionMenuMessageId === msg.id && (
                            <div className={`
                              absolute -top-10 ${isMe ? 'right-0' : 'left-0'} z-30
                              bg-white/95 backdrop-blur-md rounded-full px-2.5 py-1 shadow-xl border border-slate-200/90 flex items-center gap-1.5 animate-fadeIn
                            `}>
                              {QUICK_REACTION_EMOJIS.map(emoji => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReaction(msg.id, emoji, false);
                                  }}
                                  className="text-base hover:scale-130 active:scale-95 transition-transform p-0.5"
                                >
                                  {emoji}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReactionMenuMessageId(null);
                                  promptDeleteMessage(msg);
                                }}
                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-full transition-colors ml-1"
                                title="Apagar mensagem"
                              >
                                <Trash2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReactionMenuMessageId(null);
                                }}
                                className="text-slate-400 hover:text-slate-600 ml-0.5 p-0.5"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}

                          {/* WhatsApp Quoted Reply Box */}
                          {msg.reply_to && !msg.is_deleted && (
                            <div className={`
                              mb-1.5 p-2 rounded-lg border-l-4 text-left text-[11px] select-none
                              ${isMe 
                                ? 'bg-[#c3ebb8] border-[#075e54] text-slate-800' 
                                : 'bg-slate-100 border-[#00a884] text-slate-800'
                              }
                            `}>
                              <p className="font-bold text-[10px] text-[#075e54] truncate">
                                {msg.reply_to.sender_name || 'Mensagem'}
                              </p>
                              <p className="text-slate-600 truncate text-[10.5px]">
                                {msg.reply_to.type === 'audio' ? '🎵 Mensagem de áudio' : msg.reply_to.type === 'image' ? '📷 Foto' : msg.reply_to.content}
                              </p>
                            </div>
                          )}

                          {/* Deleted Message State */}
                          {msg.is_deleted ? (
                            <div className="flex items-center gap-1.5 py-1 text-slate-500 italic text-[11px] select-none">
                              <Ban size={13} className="text-slate-400 opacity-70 flex-shrink-0" />
                              <span>Esta mensagem foi apagada</span>
                            </div>
                          ) : msg.is_view_once ? (
                            /* WhatsApp View-Once Media Bubble */
                            (() => {
                              const hasOpened = msg.view_once_opened || (msg.opened_by && msg.opened_by.includes(currentUserId)) || (typeof window !== 'undefined' && localStorage.getItem(`gsi_view_once_opened_${msg.id}`) === 'true');
                              if (isMe) {
                                return (
                                  <div className="flex items-center gap-2.5 py-1 px-1">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                                      hasOpened ? 'border border-slate-400 text-slate-500' : 'border-2 border-[#00a884] text-[#00a884]'
                                    }`}>
                                      {hasOpened ? '✓' : '1'}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-slate-800 font-bold text-xs flex items-center gap-1">
                                        Foto
                                        <span className="text-[8.5px] px-1.5 py-0.5 rounded-full bg-[#00a884]/20 text-[#00a884] font-black uppercase">
                                          {hasOpened ? 'Aberta' : 'Visualização única'}
                                        </span>
                                      </span>
                                      {msg.content && <p className="text-[11px] text-slate-600 mt-0.5">{msg.content}</p>}
                                    </div>
                                  </div>
                                );
                              }

                              if (hasOpened) {
                                return (
                                  <div className="flex items-center gap-2.5 py-1 px-1 opacity-70">
                                    <div className="w-7 h-7 rounded-full border border-slate-400 flex items-center justify-center text-xs font-bold text-slate-500">
                                      ✓
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-slate-700 font-bold text-xs flex items-center gap-1">
                                        Foto aberta
                                      </span>
                                      <span className="text-[9px] text-slate-400">Esta mídia já expirou</span>
                                      {msg.content && <p className="text-[11px] text-slate-500 mt-0.5">{msg.content}</p>}
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <button
                                  type="button"
                                  onClick={() => handleOpenViewOnce(msg)}
                                  className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-black/5 active:bg-black/10 rounded-xl transition-all w-full text-left"
                                >
                                  <div className="w-7 h-7 rounded-full border-2 border-[#00a884] bg-[#00a884]/10 flex items-center justify-center text-xs font-black text-[#00a884] animate-pulse flex-shrink-0">
                                    1
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-slate-900 font-bold text-xs flex items-center gap-1.5">
                                      Foto
                                      <span className="text-[8.5px] px-1.5 py-0.5 rounded-full bg-[#00a884] text-white font-black uppercase">
                                        Toque para abrir
                                      </span>
                                    </span>
                                    <span className="text-[10px] text-[#00a884] font-medium">Visualização única</span>
                                    {msg.content && <p className="text-[11px] text-slate-700 mt-0.5 truncate">{msg.content}</p>}
                                  </div>
                                </button>
                              );
                            })()
                          ) : msg.type === 'call_log' || (typeof msg.content === 'string' && msg.content.startsWith('Chamada de ')) ? (
                            <div className="flex items-center justify-between gap-3 p-1 min-w-[210px]">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                                  msg.content.includes('perdida') || msg.content.includes('recusada')
                                    ? 'bg-red-500/15 text-red-500'
                                    : 'bg-[#00a884]/15 text-[#00a884]'
                                }`}>
                                  {msg.content.includes('vídeo') ? (
                                    <Video size={15} className={msg.content.includes('perdida') || msg.content.includes('recusada') ? 'text-red-500' : 'text-[#00a884]'} />
                                  ) : (
                                    <Phone size={15} className={msg.content.includes('perdida') || msg.content.includes('recusada') ? 'text-red-500' : 'text-[#00a884]'} />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h5 className={`font-bold text-[11px] leading-tight ${
                                    msg.content.includes('perdida') || msg.content.includes('recusada') ? 'text-red-600' : 'text-slate-800'
                                  }`}>
                                    {msg.content}
                                  </h5>
                                  <span className="text-[8.5px] text-slate-500 font-medium">
                                    {isMe ? 'Chamada efetuada' : 'Chamada recebida'}
                                  </span>
                                </div>
                              </div>

                              {!isMe && (
                                <button 
                                  type="button"
                                  onClick={() => startCall(msg.content.includes('vídeo') ? 'video' : 'audio')}
                                  className="px-2.5 py-1 rounded-lg bg-[#00a884] hover:bg-[#008f6f] text-white text-[9px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 flex items-center gap-1 flex-shrink-0"
                                  title="Retornar chamada"
                                >
                                  <Phone size={10} />
                                  <span>Ligar</span>
                                </button>
                              )}
                            </div>
                          ) : msg.type === 'audio' || (msg.media_url && (msg.media_url.endsWith('.webm') || msg.media_url.endsWith('.mp4') || msg.media_url.endsWith('.m4a') || msg.media_url.endsWith('.aac') || msg.media_url.endsWith('.ogg') || msg.media_url.endsWith('.wav'))) || (typeof msg.content === 'string' && msg.content.startsWith('http') && (msg.content.includes('/chat-audio/') || msg.content.includes('/group-audio/') || msg.content.endsWith('.webm') || msg.content.endsWith('.mp4') || msg.content.endsWith('.m4a') || msg.content.endsWith('.aac') || msg.content.endsWith('.ogg') || msg.content.endsWith('.wav'))) ? (
                            <AudioPlayer src={msg.media_url || msg.content} isMe={isMe} />
                          ) : msg.type === 'image' || (msg.media_url && (msg.media_url.includes('/group-images/') || msg.media_url.includes('/chat-images/'))) ? (
                            <img 
                              src={msg.media_url || msg.content} 
                              className="max-w-full rounded-xl cursor-pointer hover:opacity-90 transition-all border border-black/10" 
                              onClick={() => window.open(msg.media_url || msg.content)} 
                              alt=""
                            />
                          ) : (
                            <p className="leading-relaxed break-words text-[12px]">{msg.content}</p>
                          )}

                          <div className="flex justify-end items-center gap-1 mt-1 opacity-60 text-[#667781]">
                            <span className="text-[8px] font-semibold">
                              {format(new Date(msg.created_at), 'HH:mm')}
                            </span>
                            {isMe && (
                              <span className="text-[8px] text-[#53bdeb] font-bold">✓✓</span>
                            )}
                            {!msg.is_deleted && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  promptDeleteMessage(msg);
                                }}
                                className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-opacity ml-1 rounded"
                                title="Apagar frase ou mensagem"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>

                          {/* WhatsApp Reaction Pill Badge */}
                          {msg.reactions && Object.entries(msg.reactions).some(([_, uids]) => Array.isArray(uids) && (uids as string[]).length > 0) && (
                            <div className={`
                              absolute -bottom-2.5 ${isMe ? 'right-2' : 'left-2'} 
                              flex items-center gap-1 bg-white border border-slate-200/90 rounded-full px-2 py-0.5 shadow-sm text-[11px] z-10
                            `}>
                              {Object.entries(msg.reactions).map(([emoji, uids]) => {
                                const userList = (uids as string[]) || [];
                                if (!Array.isArray(userList) || userList.length === 0) return null;
                                const userReacted = userList.includes(currentUserId);
                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleReaction(msg.id, emoji, false)}
                                    className={`
                                      flex items-center gap-0.5 px-1 rounded-full transition-all
                                      ${userReacted ? 'bg-[#d9fdd3] text-[#075e54] font-bold scale-105' : 'hover:bg-slate-100'}
                                    `}
                                  >
                                    <span>{emoji}</span>
                                    {userList.length > 1 && <span className="text-[9px] font-bold text-slate-600">{userList.length}</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </motion.div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center opacity-40">
                  <MessageSquare size={38} className="mb-2 text-[#0084ff]" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-700">
                    Comece uma conversa com<br/>{selectedUser.full_name}
                  </p>
                </div>
              )}

              {/* Direct Partner Typing Indicator Bubble */}
              {isPartnerTyping && (
                <div className="flex justify-start mb-3 px-1 animate-fadeIn">
                  <div className="flex items-end gap-2">
                    <div className="w-7 h-7 rounded-full overflow-hidden shadow-sm flex-shrink-0 mb-1 border border-white bg-slate-300">
                      {selectedUser.avatar_url ? (
                        <img src={selectedUser.avatar_url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-black bg-slate-700 text-[#d4af37]">
                          {selectedUser.full_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="bg-white px-3.5 py-2.5 rounded-2xl rounded-tl-none border border-slate-200/80 shadow-sm flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce"></span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isUserBlocked || amIBlocked ? (
              <div className="p-4 bg-red-500/10 border-t border-red-500/20 text-center space-y-1 relative z-20">
                <ShieldAlert size={20} className="mx-auto text-red-500" />
                <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">
                  {isUserBlocked ? 'Você bloqueou este colega' : 'Você não pode enviar mensagens a este colega'}
                </p>
              </div>
            ) : (
              <>
                {/* Active Recording State Banner in Direct Chat */}
                {isRecording && (
                  <div className="p-2.5 bg-red-500/10 border-t border-red-500/20 flex items-center justify-between relative z-20 animate-pulse">
                    <div className="flex items-center gap-2 text-red-500 text-xs font-black uppercase tracking-wider">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                      <span>Gravando Áudio... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={cancelRecording}
                        className="p-1 text-slate-400 hover:text-red-500 text-[10px] font-black uppercase tracking-wider"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm hover:bg-red-600 transition-colors"
                      >
                        Concluir
                      </button>
                    </div>
                  </div>
                )}

                {/* Audio Ready Preview Banner in Direct Chat */}
                {audioBlob && !isRecording && (
                  <div className="p-3 bg-amber-500/10 border-t border-amber-500/20 flex flex-col gap-2 relative z-20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-600 text-[10px] font-black uppercase tracking-wider">
                        <Mic size={15} />
                        <span>Áudio Gravado ({recordingTime > 0 ? `${recordingTime}s` : 'Pronto'})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={cancelRecording} 
                          disabled={isUploading}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                          title="Descartar áudio"
                        >
                          <X size={16} />
                        </button>
                        <button 
                          onClick={sendAudio}
                          disabled={isUploading}
                          className="px-3.5 py-1.5 bg-[#0084ff] hover:bg-[#0070d6] text-white font-black text-[9px] uppercase tracking-wider rounded-xl shadow active:scale-95 transition-all flex items-center gap-1.5"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              <span>Enviando...</span>
                            </>
                          ) : (
                            <>
                              <Send size={12} />
                              <span>Enviar Áudio</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {audioPreviewUrl && (
                      <div className="bg-white/90 rounded-2xl p-1 border border-slate-200/80 shadow-sm">
                        <AudioPlayer src={audioPreviewUrl} isMe={true} recordedDuration={recordingTime} />
                      </div>
                    )}
                  </div>
                )}

                {/* Mic Error Banner in Direct Chat */}
                {micError && (
                  <div className="p-3 bg-red-500/10 border-t border-red-500/20 flex items-center justify-between text-red-600 text-xs font-semibold relative z-20">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={16} className="flex-shrink-0" />
                      <span>{micError}</span>
                    </div>
                    <button onClick={() => setMicError(null)} className="p-1 hover:text-red-800">
                      <X size={15} />
                    </button>
                  </div>
                )}

                {/* WhatsApp Replying Preview Bar in Direct Chat */}
                {replyingTo && !isRecording && (
                  <div className="px-4 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shadow-sm relative z-20 animate-fadeIn">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-2.5 border-l-4 border-[#0084ff]">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black text-[#0084ff] truncate uppercase tracking-wider">
                          Respondendo a {replyingTo.sender_name || 'Mensagem'}
                        </p>
                        <p className="text-xs text-slate-600 truncate font-normal">
                          {replyingTo.type === 'audio' ? '🎵 Mensagem de áudio' : replyingTo.type === 'image' ? '📷 Foto' : replyingTo.content}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full transition-colors flex-shrink-0"
                      title="Cancelar resposta"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}

                {/* Input Bar or Active Recording Toolbar in Direct Chat */}
                {isRecording ? (
                  <div className="p-3 bg-red-50 border-t border-red-200 flex items-center justify-between gap-3 relative z-20 animate-fadeIn">
                    <div className="flex items-center gap-2.5 text-red-600 font-bold text-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping inline-block" />
                      <span className="tracking-wide">Gravando: {formatRecordingTime(recordingTime)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={cancelRecording}
                        className="px-3 py-1.5 text-slate-600 hover:text-red-600 bg-white rounded-xl border border-slate-200 text-xs font-semibold shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                      >
                        <Trash2 size={13} />
                        <span>Cancelar</span>
                      </button>
                      <button 
                        type="button"
                        onClick={stopRecording}
                        className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
                      >
                        <Square size={12} fill="currentColor" />
                        <span>Concluir</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-[#f0f2f5] border-t border-slate-200 flex items-center gap-2 relative z-20">
                    <button 
                      onClick={() => privateFileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-[#0084ff] transition-colors rounded-full bg-white border border-slate-200 shadow-sm flex-shrink-0"
                      title="Enviar imagem"
                    >
                      <ImageIcon size={16} />
                    </button>
                    <input 
                      type="file" 
                      ref={privateFileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handlePrivateImageUpload} 
                    />

                    <button 
                      onClick={() => privateCameraInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-[#0084ff] transition-colors rounded-full bg-white border border-slate-200 shadow-sm flex-shrink-0"
                      title="Tirar foto"
                    >
                      <Camera size={16} />
                    </button>
                    <input 
                      type="file" 
                      ref={privateCameraInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      capture="environment"
                      onChange={handlePrivateImageUpload} 
                    />

                    <input 
                      type="text" 
                      value={newMessage}
                      onChange={(e) => handleTypingChange(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Mensagem"
                      className="flex-1 bg-white border border-slate-200 rounded-full px-4 py-2.5 text-xs font-normal text-slate-900 outline-none focus:ring-1 focus:ring-[#0084ff] shadow-sm transition-all placeholder:text-slate-400"
                    />
                    {newMessage.trim() ? (
                      <button 
                        onClick={() => sendMessage('text')}
                        className="w-9 h-9 bg-[#0084ff] text-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-40 flex-shrink-0 shadow-sm"
                      >
                        <Send size={15} />
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={startRecording}
                        className="w-9 h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0 bg-[#0084ff] text-white hover:bg-[#0070d6] active:scale-95 shadow-sm"
                        title="Toque para gravar áudio"
                      >
                        <Mic size={16} />
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* 3. LIST OF GROUPS OR PROFILES */
          <div className="flex-1 flex flex-col p-4 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <input 
                type="text" 
                placeholder={activeTab === 'groups' ? "Pesquisar grupo da equipe..." : "Pesquisar colega de obra..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0a0e17] border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-white outline-none focus:border-[#d4af37]/50 transition-all"
              />
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="animate-spin text-[#d4af37]" size={32} />
                </div>
              ) : activeTab === 'groups' ? (
                /* GROUPS LIST */
                filteredGroups.length === 0 ? (
                  <div className="py-16 text-center opacity-30">
                    <Users size={36} className="mx-auto mb-2 text-[#d4af37]" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Nenhum grupo encontrado</p>
                  </div>
                ) : (
                  filteredGroups.map(group => {
                    const isMember = userMemberships.has(group.id);
                    return (
                      <button 
                        key={group.id}
                        onClick={() => setSelectedGroup(group)}
                        className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/5 border border-white/5 transition-all text-left group"
                      >
                        <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10 shadow relative flex-shrink-0">
                          <img src={group.cover_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                          {group.is_private && (
                            <div className="absolute top-0 right-0 p-0.5 bg-[#d4af37] rounded-bl">
                              <Lock size={7} className="text-black" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <h4 className="text-xs font-black uppercase text-white group-hover:text-[#d4af37] transition-colors truncate">
                              {group.name}
                            </h4>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {group.created_by === currentUserId && (
                                <span className="text-[7px] font-black bg-[#d4af37]/20 text-[#d4af37] px-1.5 py-0.5 rounded uppercase">
                                  Dono
                                </span>
                              )}
                              {groupUnreadCounts[group.id] > 0 && (
                                <span className="text-[9px] font-black bg-red-500 text-white min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-sm animate-pulse">
                                  {groupUnreadCounts[group.id]}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-[10px] text-white/40 truncate">
                            {group.description || 'Sem descrição.'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[8px] font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-1">
                              <Users size={10} />
                              {group.member_count} Participantes
                            </span>
                            {isMember && (
                              <span className="text-[8px] font-bold text-white/30 uppercase flex items-center gap-1">
                                <Check size={10} className="text-green-500" /> Membro
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )
              ) : (
                /* PROFILES LIST */
                filteredProfiles.length === 0 ? (
                  <div className="py-16 text-center opacity-30">
                    <MessageSquare size={36} className="mx-auto mb-2 text-[#0084ff]" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Nenhum colega encontrado</p>
                  </div>
                ) : (
                  filteredProfiles.map(p => {
                    const isBlocked = blocks.some(b => b.blocked_id === p.id);
                    return (
                      <button 
                        key={p.id}
                        onClick={() => setSelectedUser(p)}
                        className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/5 border border-white/5 transition-all text-left group"
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-11 h-11 rounded-full border border-white/10 p-0.5 overflow-hidden bg-[#1c2431]">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} className="w-full h-full object-cover rounded-full" alt="" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/40 font-black text-xs">
                                {p.full_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          {!isBlocked && (
                            <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-[#0a0e17] rounded-full ${onlineUsers.has(p.id) ? 'bg-green-500' : 'bg-white/10'}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className={`text-xs font-black uppercase transition-colors truncate ${isBlocked ? 'text-white/20' : 'text-white group-hover:text-[#0084ff]'}`}>
                              {p.full_name}
                            </h4>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {unreadCounts[p.id] > 0 && (
                                <span className="text-[9px] font-black bg-red-500 text-white min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-sm animate-pulse">
                                  {unreadCounts[p.id]}
                                </span>
                              )}
                              {!isBlocked && onlineUsers.has(p.id) && (
                                <span className="text-[7px] font-black text-green-500 uppercase tracking-tighter">Online</span>
                              )}
                            </div>
                          </div>
                          <p className="text-[10px] font-bold text-white/40 uppercase truncate">
                            {p.role} {p.current_obra ? `• ${p.current_obra}` : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          CALLING SUITE OVERLAYS (WebRTC)
          ========================================================================= */}
      {callState !== 'idle' && callUser && (
        <div className="absolute inset-0 bg-[#0a0e17]/95 backdrop-blur-md z-[999] flex flex-col items-center justify-between p-8 text-white">
          
          {/* 1. OUTGOING CALL VIEW */}
          {callState === 'outgoing' && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-fadeIn">
              <div className="relative">
                <div className="w-28 h-28 rounded-full border-4 border-[#d4af37]/40 p-1 animate-pulse">
                  {callUser.avatar_url ? (
                    <img src={callUser.avatar_url} className="w-full h-full object-cover rounded-full" alt="" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-3xl font-black text-[#d4af37]">
                      {callUser.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-xl font-black uppercase tracking-wider">{callUser.full_name}</h2>
                <p className="text-xs text-[#d4af37] font-bold uppercase tracking-widest mt-1 animate-pulse">
                  A ligar por {callType === 'video' ? 'vídeo' : 'voz'}...
                </p>
              </div>
            </div>
          )}

          {/* 2. INCOMING CALL VIEW */}
          {callState === 'incoming' && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-fadeIn">
              <div className="relative">
                <div className="w-28 h-28 rounded-full border-4 border-[#00a884]/40 p-1 animate-pulse">
                  {callUser.avatar_url ? (
                    <img src={callUser.avatar_url} className="w-full h-full object-cover rounded-full" alt="" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-3xl font-black text-[#00a884]">
                      {callUser.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-xl font-black uppercase tracking-wider">{callUser.full_name}</h2>
                <p className="text-xs text-[#00a884] font-bold uppercase tracking-widest mt-1 animate-pulse">
                  A receber chamada de {callType === 'video' ? 'vídeo' : 'voz'}...
                </p>
              </div>
            </div>
          )}

          {/* 3. CONNECTED CALL VIEW */}
          {callState === 'connected' && (
            <div className="flex-1 w-full h-full relative flex flex-col items-center justify-center animate-fadeIn">
              {/* Dedicated audio element ensuring continuous audio output on mobile devices without WebKit pausing */}
              <audio 
                ref={remoteAudioRef} 
                autoPlay 
                playsInline 
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px' }} 
              />

              {/* Remote media element for video rendering */}
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className={callType === 'video' ? "w-full h-full object-cover rounded-3xl" : "hidden"}
              />

              {callType === 'video' ? (
                /* Picture-in-picture local preview for video calls */
                !isCallCameraOff && (
                  <div className="absolute top-4 right-4 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/25 shadow-lg bg-slate-900 z-50">
                    <video 
                      ref={localVideoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  </div>
                )
              ) : (
                /* Voice call layout */
                <div className="flex flex-col items-center justify-center space-y-6">
                  {/* Keep local stream active and assigned */}
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px' }} 
                  />

                  <div className="relative">
                    <div className="w-32 h-32 rounded-full border-4 border-[#0084ff]/30 p-1 animate-pulse">
                      {callUser.avatar_url ? (
                        <img src={callUser.avatar_url} className="w-full h-full object-cover rounded-full" alt="" />
                      ) : (
                        <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-4xl font-black text-[#0084ff]">
                          {callUser.full_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-black uppercase tracking-wider">{callUser.full_name}</h2>
                    <p className="text-xs text-green-400 font-bold uppercase tracking-widest mt-1 flex items-center justify-center gap-1.5 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-ping" />
                      Chamada de Voz Ativa
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. FLOATING CONTROL PANEL */}
          <div className="w-full flex items-center justify-center gap-6 py-4">
            {callState === 'incoming' ? (
              /* Accept / Decline triggers for incoming */
              <div className="flex items-center gap-8">
                <button 
                  onClick={declineCall}
                  className="w-14 h-14 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all text-white"
                  title="Recusar"
                >
                  <PhoneOff size={24} />
                </button>
                <button 
                  onClick={acceptCall}
                  className="w-14 h-14 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all text-white animate-bounce"
                  title="Aceitar"
                >
                  <Phone size={24} />
                </button>
              </div>
            ) : (
              /* Active controls for connected / outgoing */
              <div className="flex items-center gap-5">
                {callState === 'connected' && (
                  <button 
                    onClick={toggleCallMute}
                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow transition-all active:scale-95 ${isCallMuted ? 'bg-red-500/20 border border-red-500 text-red-500' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                    title={isCallMuted ? 'Ativar microfone' : 'Mudar microfone'}
                  >
                    {isCallMuted ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                )}

                {callState === 'connected' && callType === 'video' && (
                  <button 
                    onClick={toggleCallCamera}
                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow transition-all active:scale-95 ${isCallCameraOff ? 'bg-red-500/20 border border-red-500 text-red-500' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                    title={isCallCameraOff ? 'Ligar câmara' : 'Desligar câmara'}
                  >
                    {isCallCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                  </button>
                )}

                <button 
                  onClick={() => handleHangUpLocal(true)}
                  className="w-14 h-14 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all text-white"
                  title="Desligar"
                >
                  <PhoneOff size={24} />
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 5. WHATSAPP-STYLE DELETE MESSAGE MODAL */}
      {isDeleteModalOpen && messageToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#233138] border border-white/10 rounded-3xl p-5 max-w-sm w-full shadow-2xl text-white space-y-4">
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Trash2 size={18} className="text-red-400" />
                <span>Apagar mensagem?</span>
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {messageToDelete.sender_id === currentUserId
                  ? 'Você pode apagar esta frase/mensagem apenas para você ou para todos na conversa.'
                  : 'Deseja apagar esta mensagem apenas do seu dispositivo?'}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {messageToDelete.sender_id === currentUserId && (
                <button
                  type="button"
                  onClick={() => confirmDeleteForEveryone(messageToDelete)}
                  className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 active:scale-98"
                >
                  <Users size={15} />
                  <span>Apagar para todos</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => confirmDeleteForMe(messageToDelete)}
                className="w-full py-3 px-4 bg-white/10 hover:bg-white/15 active:bg-white/20 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-98"
              >
                <Trash2 size={15} className="text-red-400" />
                <span>Apagar para mim</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setMessageToDelete(null);
                }}
                className="w-full py-2.5 px-4 text-slate-400 hover:text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. WHATSAPP-STYLE CLEAR CHAT MODAL (LIMPAR CONVERSA) */}
      {isClearChatModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#233138] border border-white/10 rounded-3xl p-5 max-w-sm w-full shadow-2xl text-white space-y-4">
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Trash2 size={18} className="text-red-400" />
                <span>Limpar conversa?</span>
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tem certeza de que deseja apagar todas as mensagens desta conversa? As mensagens serão removidas apenas do seu dispositivo.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleClearChat}
                className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 active:scale-98"
              >
                <Trash2 size={15} />
                <span>Limpar conversa</span>
              </button>

              <button
                type="button"
                onClick={() => setIsClearChatModalOpen(false)}
                className="w-full py-2.5 px-4 text-slate-400 hover:text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. WHATSAPP-STYLE IMAGE PREVIEW COMPOSER WITH VIEW-ONCE (1) BUTTON */}
      {isImagePreviewModalOpen && selectedImagePreview && (
        <div className="fixed inset-0 z-[120] flex flex-col bg-[#0b141a] text-white animate-fadeIn select-none">
          {/* Top Bar */}
          <div className="p-4 flex items-center justify-between bg-black/40 border-b border-white/10 z-10">
            <button
              type="button"
              onClick={() => {
                setIsImagePreviewModalOpen(false);
                setSelectedImagePreview(null);
                setSelectedImageFile(null);
                setImageCaption('');
                setIsViewOnceSelected(false);
              }}
              className="p-2 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors flex items-center gap-1.5"
            >
              <X size={20} />
              <span className="text-xs font-bold">Cancelar</span>
            </button>

            <div className="flex items-center gap-2">
              {isViewOnceSelected ? (
                <span className="px-3 py-1 rounded-full bg-[#00a884]/20 border border-[#00a884]/40 text-[#00a884] text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 animate-fadeIn">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-ping inline-block" />
                  Visualização única ativada
                </span>
              ) : (
                <span className="text-[11px] text-white/50 font-medium">Enviar foto</span>
              )}
            </div>

            <div className="w-16" />
          </div>

          {/* Center Image */}
          <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-black/70">
            <img
              src={selectedImagePreview}
              alt="Prévia"
              className="max-h-[62vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
            />
          </div>

          {/* Bottom Bar: Caption + View Once (1) Toggle + Send */}
          <div className="p-4 bg-[#111b21] border-t border-white/10 flex flex-col gap-3">
            {isViewOnceSelected && (
              <div className="text-center text-[11px] text-[#00a884] font-medium animate-fadeIn">
                Mensagem com foto de visualização única. O destinatário só poderá visualizá-la uma única vez.
              </div>
            )}

            <div className="flex items-center gap-2.5 max-w-2xl mx-auto w-full">
              {/* Caption Input */}
              <input
                type="text"
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendPreviewImage()}
                placeholder="Adicione uma legenda..."
                className="flex-1 bg-[#202c33] border border-white/10 rounded-full px-4 py-3 text-xs text-white placeholder-slate-400 outline-none focus:border-[#00a884] transition-all"
              />

              {/* WhatsApp View Once (1) Button */}
              <button
                type="button"
                onClick={() => {
                  setIsViewOnceSelected(prev => !prev);
                  if (navigator.vibrate) navigator.vibrate(35);
                }}
                className={`
                  w-11 h-11 rounded-full flex items-center justify-center transition-all flex-shrink-0 relative
                  ${isViewOnceSelected 
                    ? 'bg-[#00a884] text-white border-2 border-emerald-300 shadow-[0_0_15px_rgba(0,168,132,0.6)] scale-105' 
                    : 'bg-[#202c33] text-white/60 border border-white/20 hover:text-white hover:border-white/40'
                  }
                `}
                title={isViewOnceSelected ? "Visualização única ativa (Toque para desativar)" : "Ativar foto de visualização única"}
              >
                <span className="text-sm font-black font-mono">1</span>
              </button>

              {/* Send Button */}
              <button
                type="button"
                onClick={handleSendPreviewImage}
                disabled={isUploading}
                className="w-11 h-11 rounded-full bg-[#00a884] hover:bg-[#008f6f] active:scale-95 text-white flex items-center justify-center transition-all flex-shrink-0 shadow-lg disabled:opacity-50"
                title="Enviar"
              >
                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. WHATSAPP-STYLE FULL-SCREEN VIEW-ONCE PHOTO VIEWER */}
      {activeViewOnceImage && (
        <div className="fixed inset-0 z-[130] flex flex-col bg-black/95 backdrop-blur-md text-white animate-fadeIn select-none">
          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-white/10 bg-black/40">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[#00a884] bg-[#00a884]/20 flex items-center justify-center text-xs font-black text-[#00a884]">
                1
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Foto de visualização única</span>
                </h4>
                <p className="text-[10px] text-slate-400">
                  Esta foto sumirá permanentemente ao sair
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveViewOnceImage(null)}
              className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="Fechar visualização"
            >
              <X size={22} />
            </button>
          </div>

          {/* Photo Display */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
            <img
              src={activeViewOnceImage.media_url || activeViewOnceImage.content}
              alt="Foto de visualização única"
              className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl"
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>

          {/* Bottom Security Notice */}
          <div className="p-4 bg-black/60 border-t border-white/10 text-center">
            <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
              <Lock size={12} className="text-[#00a884]" />
              <span>Foto protegida com visualização única. Ela não pode ser salva ou aberta novamente.</span>
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
