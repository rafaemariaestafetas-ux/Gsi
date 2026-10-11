import React, { ReactNode } from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  className = ''
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-white/5 bg-[#1c2431]/40 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#d4af37] mb-3 shadow-inner">
        <Icon size={26} className="stroke-[2.2]" />
      </div>
      <h4 className="text-sm font-black uppercase tracking-wider text-white mb-1">
        {title}
      </h4>
      <p className="text-xs text-white/50 max-w-xs mb-4 leading-relaxed font-medium">
        {description}
      </p>
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e5c04b] text-black text-xs font-black uppercase tracking-wider shadow-lg shadow-[#d4af37]/20 hover:scale-105 active:scale-[0.97] transition-all"
        >
          {actionText}
        </button>
      )}
    </motion.div>
  );
};

export const SkeletonCard: React.FC<{ rows?: number }> = ({ rows = 3 }) => {
  return (
    <div className="w-full p-4 rounded-3xl border border-white/5 bg-[#1c2431]/40 animate-pulse space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3 w-1/3 bg-white/10 rounded-full" />
          <div className="h-2 w-1/4 bg-white/5 rounded-full" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div 
          key={i} 
          className="h-2.5 bg-white/5 rounded-full" 
          style={{ width: `${85 - i * 15}%` }} 
        />
      ))}
    </div>
  );
};
