import React from 'react';
import {
  Utensils,
  Car,
  ShoppingBag,
  Receipt,
  Gamepad2,
  HeartPulse,
  GraduationCap,
  MoreHorizontal,
  Wallet,
  Coffee,
  Plane,
  Home,
  Smartphone,
  Gift,
  Film,
  Dumbbell,
  BookOpen,
  DollarSign,
  type LucideIcon,
} from 'lucide-react';

export const ICON_OPTIONS: { name: string; label: string; icon: LucideIcon }[] = [
  { name: 'Utensils', label: 'Makan & Minum', icon: Utensils },
  { name: 'Car', label: 'Transportasi', icon: Car },
  { name: 'ShoppingBag', label: 'Belanja', icon: ShoppingBag },
  { name: 'Receipt', label: 'Tagihan', icon: Receipt },
  { name: 'Gamepad2', label: 'Hiburan', icon: Gamepad2 },
  { name: 'HeartPulse', label: 'Kesehatan', icon: HeartPulse },
  { name: 'GraduationCap', label: 'Pendidikan', icon: GraduationCap },
  { name: 'Wallet', label: 'Gaji / Pemasukan', icon: Wallet },
  { name: 'Coffee', label: 'Kopi & Kafe', icon: Coffee },
  { name: 'Plane', label: 'Liburan & Travel', icon: Plane },
  { name: 'Home', label: 'Rumah & Properti', icon: Home },
  { name: 'Smartphone', label: 'Pulsa & Kuota', icon: Smartphone },
  { name: 'Gift', label: 'Hadiah / Amal', icon: Gift },
  { name: 'Film', label: 'Bioskop / Nonton', icon: Film },
  { name: 'Dumbbell', label: 'Olahraga & Gym', icon: Dumbbell },
  { name: 'BookOpen', label: 'Buku & Kursus', icon: BookOpen },
  { name: 'DollarSign', label: 'Investasi / Bonus', icon: DollarSign },
  { name: 'MoreHorizontal', label: 'Lainnya', icon: MoreHorizontal },
];

export const COLOR_OPTIONS = [
  '#f97316', // Orange
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#ef4444', // Red
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#15803d', // Green
  '#eab308', // Yellow
  '#6366f1', // Indigo
  '#84cc16', // Lime
  '#64748b', // Slate
];

interface CategoryIconProps {
  name: string;
  className?: string;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ name, className = 'w-5 h-5', size = 20 }) => {
  const match = ICON_OPTIONS.find((item) => item.name.toLowerCase() === name.toLowerCase());
  const IconComponent = match ? match.icon : MoreHorizontal;
  return <IconComponent className={className} size={size} />;
};
