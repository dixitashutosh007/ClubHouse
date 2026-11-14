import { Car, ChefHat, GraduationCap, Home, MessagesSquare, ShoppingBag, ThumbsUp, type LucideIcon } from 'lucide-react';

/**
 * The Club House apps and their Aangan colour identities. One list for
 * navigation, home tiles and module headers. Only apps that really work
 * are 'live'; the others show as Coming soon and never link anywhere.
 *
 * Class strings are spelled out in full so Tailwind generates them.
 */
export type ModuleId = 'home' | 'ride' | 'classes' | 'chef' | 'market' | 'recs' | 'community';

export interface ModuleTheme {
  /** Solid fill: tiles, icon chips, large text */
  fill: string;
  /** Text and icons in the deep shade */
  text: string;
  /** Soft background */
  tint: string;
  /** Filled button: deep background, white text */
  solid: string;
  /** Tonal button: tint background, deep text */
  tonal: string;
  /** Selected state in navigation and chips */
  selected: string;
  /** Border in the module colour */
  border: string;
}

export interface ModuleInfo {
  id: ModuleId;
  name: string;
  /** Short line for tiles */
  tagline: string;
  icon: LucideIcon;
  status: 'live' | 'coming-soon';
  /** Only for live modules */
  href?: string;
  theme: ModuleTheme;
}

export const MODULE_THEMES: Record<ModuleId, ModuleTheme> = {
  home: {
    // Terracotta fill with ink is 4.26:1 (under AA for small text), so tiles use the deep shade
    fill: 'bg-home-deep text-ink-inverse',
    text: 'text-home-deep',
    tint: 'bg-home-tint',
    solid: 'bg-home-deep text-ink-inverse hover:bg-home-deep/90 active:bg-home-deep/80',
    tonal: 'bg-home-tint text-home-deep hover:bg-home-tint/70',
    selected: 'bg-home-tint text-home-deep',
    border: 'border-home-deep',
  },
  ride: {
    fill: 'bg-ride text-ink-inverse',
    text: 'text-ride-deep',
    tint: 'bg-ride-tint',
    solid: 'bg-ride-deep text-ink-inverse hover:bg-ride-deep/90 active:bg-ride-deep/80',
    tonal: 'bg-ride-tint text-ride-deep hover:bg-ride-tint/70',
    selected: 'bg-ride-tint text-ride-deep',
    border: 'border-ride-deep',
  },
  classes: {
    fill: 'bg-classes text-ink-inverse',
    text: 'text-classes-deep',
    tint: 'bg-classes-tint',
    solid: 'bg-classes-deep text-ink-inverse hover:bg-classes-deep/90 active:bg-classes-deep/80',
    tonal: 'bg-classes-tint text-classes-deep hover:bg-classes-tint/70',
    selected: 'bg-classes-tint text-classes-deep',
    border: 'border-classes-deep',
  },
  chef: {
    fill: 'bg-chef text-ink',
    text: 'text-chef-deep',
    tint: 'bg-chef-tint',
    solid: 'bg-chef-deep text-ink-inverse hover:bg-chef-deep/90 active:bg-chef-deep/80',
    tonal: 'bg-chef-tint text-chef-deep hover:bg-chef-tint/70',
    selected: 'bg-chef-tint text-chef-deep',
    border: 'border-chef-deep',
  },
  market: {
    fill: 'bg-market text-ink',
    text: 'text-market-deep',
    tint: 'bg-market-tint',
    solid: 'bg-market-deep text-ink-inverse hover:bg-market-deep/90 active:bg-market-deep/80',
    tonal: 'bg-market-tint text-market-deep hover:bg-market-tint/70',
    selected: 'bg-market-tint text-market-deep',
    border: 'border-market-deep',
  },
  recs: {
    fill: 'bg-recs text-ink',
    text: 'text-recs-deep',
    tint: 'bg-recs-tint',
    solid: 'bg-recs-deep text-ink-inverse hover:bg-recs-deep/90 active:bg-recs-deep/80',
    tonal: 'bg-recs-tint text-recs-deep hover:bg-recs-tint/70',
    selected: 'bg-recs-tint text-recs-deep',
    border: 'border-recs-deep',
  },
  community: {
    fill: 'bg-community-deep text-ink-inverse',
    text: 'text-community-deep',
    tint: 'bg-community-tint',
    solid: 'bg-community-deep text-ink-inverse hover:bg-community-deep/90 active:bg-community-deep/80',
    tonal: 'bg-community-tint text-community-deep hover:bg-community-tint/70',
    selected: 'bg-community-tint text-community-deep',
    border: 'border-community-deep',
  },
};

/** Every app, in the order residents see them */
export const MODULES: ModuleInfo[] = [
  { id: 'ride', name: 'RideShare', tagline: 'Share your commute with neighbours', icon: Car, status: 'live', href: '/rides', theme: MODULE_THEMES.ride },
  { id: 'classes', name: 'Classes', tagline: 'Learn from neighbours who teach', icon: GraduationCap, status: 'live', href: '/lessons', theme: MODULE_THEMES.classes },
  { id: 'chef', name: 'Home Chef', tagline: 'Home-cooked food from neighbours', icon: ChefHat, status: 'coming-soon', theme: MODULE_THEMES.chef },
  { id: 'market', name: 'Marketplace', tagline: 'Buy, sell and lend within the society', icon: ShoppingBag, status: 'coming-soon', theme: MODULE_THEMES.market },
  { id: 'recs', name: 'Recommendations', tagline: 'Services your neighbours trust', icon: ThumbsUp, status: 'coming-soon', theme: MODULE_THEMES.recs },
  { id: 'community', name: 'Community', tagline: 'Groups, clubs and conversations', icon: MessagesSquare, status: 'coming-soon', theme: MODULE_THEMES.community },
];

export const HOME_MODULE = { id: 'home' as const, name: 'Club House', icon: Home, theme: MODULE_THEMES.home };

export function moduleById(id: ModuleId): ModuleInfo | undefined {
  return MODULES.find((m) => m.id === id);
}
