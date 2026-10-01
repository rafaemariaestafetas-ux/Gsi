export interface Profile {
  id: string;
  full_name: string;
  role: 'Ajudante' | 'Oficial' | 'Motorista' | 'Encarregado' | 'Mestre de Obra';
  avatar_url?: string;
  hourly_rate: number;
  current_obra?: string;
  location_city?: string;
  phone?: string;
  is_admin?: boolean;
  notification_hour?: number;
  notification_days?: number[]; // 0 for Sunday, 1-6 for Mon-Sat
  updated_at?: string;
}

export interface Announcement {
  id?: string;
  content: string;
  created_at: string;
  user_id: string;
  author_name: string;
}

export interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

export interface Block {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface ChatGroup {
  id: string;
  name: string;
  description: string;
  rules?: string;
  cover_url: string;
  is_private: boolean;
  created_by: string;
  created_at: string;
  member_count?: number;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'audio';
  media_url?: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface TimeEntry {
  id?: string;
  day: number;
  month: number;
  year: number;
  hours: string;
  obra: string;
  description: string;
  is_absence?: boolean;
  absence_reason?: string;
  created_at?: string;
  user_id: string;
}
