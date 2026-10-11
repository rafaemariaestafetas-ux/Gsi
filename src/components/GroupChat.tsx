import React from 'react';
import Messenger from './Messenger';

export interface GroupChatProps {
  currentUserId: string;
  userName: string;
  userAvatar?: string;
  isDarkMode?: boolean;
  onToggleImmersive?: (isOpen: boolean) => void;
  onlineUsers?: Map<string, any>;
  onClose?: () => void;
}

/**
 * Unified GroupChat component.
 * Delegates entirely to the shared, full-featured Messenger engine.
 */
export default function GroupChat({
  currentUserId,
  userName,
  userAvatar,
  onlineUsers = new Map(),
  onClose = () => {}
}: GroupChatProps) {
  return (
    <Messenger 
      isOpen={true}
      embedded={true}
      initialTab="groups"
      currentUserId={currentUserId}
      userName={userName}
      userAvatar={userAvatar}
      onlineUsers={onlineUsers}
      onClose={onClose}
    />
  );
}
