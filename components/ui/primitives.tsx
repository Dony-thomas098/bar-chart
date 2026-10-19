'use client';

import React from 'react';
import { Search, X } from 'lucide-react';

/* ─── Background Blobs (Decorative, Non-Interfering, Soft Glass Warm Mesh Canvas) ─── */
export function BackgroundBlobs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 select-none">
      {/* Warm Orange / Coral Blob top left */}
      <div 
        className="absolute -top-24 -left-24 w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-gradient-to-br from-orange-400/35 to-rose-400/25 blur-3xl opacity-60 dark:opacity-20 animate-pulse duration-1000"
        style={{ animationDuration: '8s' }}
      />
      {/* Peach / Soft Pink Blob center right */}
      <div 
        className="absolute top-1/4 -right-20 w-72 h-72 sm:w-88 sm:h-88 rounded-full bg-gradient-to-bl from-amber-300/30 via-orange-300/25 to-pink-300/20 blur-3xl opacity-50 dark:opacity-15"
      />
      {/* Soft Indigo / Blue Accent Blob bottom center */}
      <div 
        className="absolute bottom-20 left-1/3 w-80 h-80 rounded-full bg-gradient-to-tr from-sky-400/20 via-indigo-400/15 to-rose-300/15 blur-3xl opacity-40 dark:opacity-15"
      />
    </div>
  );
}

/* ─── Frosted Glass Card ─── */
interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  selected?: boolean;
  interactive?: boolean;
}

export function GlassCard({ children, className = '', selected = false, interactive = false, ...props }: GlassCardProps) {
  const hasOverflow = className.includes('overflow-');
  return (
    <div
      className={`glass-card p-5 relative ${hasOverflow ? '' : 'overflow-hidden'} ${
        interactive ? 'hover:shadow-glass hover:-translate-y-0.5 transition-all duration-200 cursor-pointer' : ''
      } ${
        selected ? 'ring-2 ring-orange-500 shadow-glow' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/* ─── Pill Button (Primary Dark, Gradient Orange, Glass, Danger) ─── */
interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary-dark' | 'gradient-orange' | 'glass' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function PillButton({
  variant = 'primary-dark',
  size = 'md',
  icon,
  children,
  className = '',
  ...props
}: PillButtonProps) {
  const sizeClasses = {
    sm: 'px-3.5 py-1.5 text-xs gap-1.5 min-h-[34px]',
    md: 'px-5 py-2.5 text-sm gap-2 min-h-[42px]',
    lg: 'px-7 py-3.5 text-base gap-2.5 min-h-[48px]',
  }[size];

  const variantClasses = {
    'primary-dark': 'btn-dark-pill',
    'gradient-orange': 'btn-gradient-orange',
    'glass': 'btn-glass-pill',
    'ghost': 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 rounded-full font-semibold',
    'danger': 'bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white rounded-full font-bold shadow-sm',
  }[variant];

  return (
    <button
      className={`inline-flex items-center justify-center font-bold tracking-tight rounded-full select-none cursor-pointer ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

/* ─── Circular Neumorphic / Glass Icon Button ─── */
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'glass' | 'neumorphic' | 'dark';
}

export function IconButton({
  children,
  icon,
  active = false,
  size = 'md',
  variant = 'neumorphic',
  className = '',
  ...props
}: IconButtonProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-[40px] h-[40px] text-sm',
    lg: 'w-12 h-12 text-base',
  }[size];

  const variantClass = variant === 'dark' 
    ? 'bg-btn-dark text-white shadow-btn-dark hover:brightness-110' 
    : 'icon-button-neumorphic';

  return (
    <button
      className={`shrink-0 flex items-center justify-center transition-all ${sizeClasses} ${variantClass} ${
        active ? 'ring-2 ring-orange-500 bg-orange-500/10 text-orange-600' : ''
      } ${className}`}
      {...props}
    >
      {icon || children}
    </button>
  );
}

/* ─── Tab / Filter Pill Chip ─── */
interface ChipProps {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  count?: number;
}

export function Chip({ label, icon, active = false, onClick, count }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 select-none whitespace-nowrap shrink-0 cursor-pointer ${
        active
          ? 'bg-gradient-to-r from-orange-500 to-rose-400 text-white shadow-glow ring-1 ring-white/30 scale-[1.02]'
          : 'glass-pill text-text-secondary hover:text-text-primary hover:bg-white/80 dark:hover:bg-white/10'
      }`}
    >
      {icon && <span className={active ? 'text-white' : 'text-text-secondary'}>{icon}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            active ? 'bg-white/25 text-white' : 'bg-black/5 dark:bg-white/10 text-text-muted'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ─── Section / Category Tag Pill ─── */
interface TagPillProps {
  label: string;
  color?: 'purple' | 'amber' | 'coral' | 'blue' | 'emerald' | 'orange' | 'slate';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function TagPill({ label, color = 'orange', className = '', onClick }: TagPillProps) {
  const colorMap = {
    purple: 'bg-purple-500/12 text-purple-700 dark:text-purple-300 border-purple-500/20',
    amber: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/20',
    coral: 'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/20',
    blue: 'bg-blue-500/12 text-blue-700 dark:text-blue-300 border-blue-500/20',
    emerald: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    orange: 'bg-orange-500/12 text-orange-700 dark:text-orange-300 border-orange-500/20',
    slate: 'bg-slate-500/12 text-slate-700 dark:text-slate-300 border-slate-500/20',
  };

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-tight border select-none ${colorMap[color]} ${
        onClick ? 'cursor-pointer hover:opacity-80' : ''
      } ${className}`}
    >
      {label}
    </span>
  );
}

/* ─── Hero Mesh Gradient Container ─── */
interface HeroGradientProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  children?: React.ReactNode;
}

export function HeroGradient({ title, subtitle, onBack, children }: HeroGradientProps) {
  return (
    <div className="relative w-full overflow-hidden hero-mesh-gradient pt-6 pb-16 px-4 sm:px-6 shadow-md">
      {/* Top row with circular back button and title */}
      <div className="flex items-center justify-between max-w-4xl mx-auto mb-4">
        {onBack ? (
          <button
            onClick={onBack}
            className="hidden lg:flex w-10 h-10 rounded-full bg-white/30 hover:bg-white/40 active:scale-95 backdrop-blur-md border border-white/40 text-white items-center justify-center transition-all shadow-sm"
            aria-label="Go Back"
          >
            <span className="text-xl leading-none">←</span>
          </button>
        ) : (
          <div className="hidden lg:block w-10" />
        )}

        {title && (
          <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight drop-shadow-sm text-center truncate max-w-xs sm:max-w-md flex-1">
            {title}
          </h1>
        )}

        <div className="hidden lg:block w-10" />
      </div>

      {subtitle && (
        <p className="text-xs text-white/80 text-center font-medium max-w-sm mx-auto -mt-2 mb-4">
          {subtitle}
        </p>
      )}

      {children && <div className="max-w-4xl mx-auto">{children}</div>}
    </div>
  );
}

/* ─── Glass Pill Search Field ─── */
interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  placeholder?: string;
}

export function SearchField({
  value,
  onChange,
  onClear,
  placeholder = 'Search charts...',
  className = '',
  ...props
}: SearchFieldProps) {
  return (
    <div className={`relative flex-1 ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondary">
        <Search size={16} />
      </div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full pl-10 pr-9 py-2.5 rounded-full glass-pill text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all shadow-sm"
        {...props}
      />
      {value && onClear && (
        <button
          onClick={onClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-primary transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* ─── Bottom Sheet Modal ─── */
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div className="relative w-full max-w-md bg-white/60 dark:bg-[#18181c]/60 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] z-10 animate-in slide-in-from-bottom duration-250">
        {/* Grab Handle */}
        <div className="w-12 h-1.5 bg-black/15 dark:bg-white/20 rounded-full mx-auto mb-4" />

        {title && (
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
            <h3 className="text-base font-bold text-text-primary tracking-tight">{title}</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
