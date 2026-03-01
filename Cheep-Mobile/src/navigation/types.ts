/**
 * 🧭 Navigation Types
 * Type-safe navigation with TypeScript
 */

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RouteStrategy } from '../types';

// ============================================
// ROOT STACK NAVIGATOR
// ============================================

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Onboarding: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  StackScreenProps<RootStackParamList, T>;

// ============================================
// AUTH STACK NAVIGATOR
// ============================================

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  StackScreenProps<AuthStackParamList, T>;

// ============================================
// TAB NAVIGATOR (Main)
// ============================================

export type TabParamList = {
  Home: { screen?: keyof HomeStackParamList; params?: any } | undefined;
  Lists: { screen?: keyof ListsStackParamList; params?: any } | undefined;
  Deals: undefined;
  Profile: undefined;
};

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

// ============================================
// HOME STACK
// ============================================

export type HomeStackParamList = {
  HomeMain: undefined;
  StoreDetail: { storeId: number };
  ProductDetail: { productId: number };
  CategoryProducts: { categoryId: number; categoryName: string };
  SearchResults: { query: string };
  PriceDifferenceList: undefined;
};

export type HomeStackScreenProps<T extends keyof HomeStackParamList> =
  CompositeScreenProps<
    StackScreenProps<HomeStackParamList, T>,
    TabScreenProps<keyof TabParamList>
  >;

// ============================================
// LISTS STACK
// ============================================

export type ListsStackParamList = {
  ListsMain: { openCreateModal?: boolean } | undefined;
  CreateList: undefined;
  ListDetail: { listId: number };
  CompareResults: { listId: number };
  StrategyDetail: { listId: number; strategy: RouteStrategy };
  TemplateDetail: { templateId: number };
};

export type ListsStackScreenProps<T extends keyof ListsStackParamList> =
  CompositeScreenProps<
    StackScreenProps<ListsStackParamList, T>,
    TabScreenProps<keyof TabParamList>
  >;

// ============================================
// DEALS STACK
// ============================================

export type DealsStackParamList = {
  DealsMain: undefined;
  DealDetail: { dealId: number };
};

export type DealsStackScreenProps<T extends keyof DealsStackParamList> =
  CompositeScreenProps<
    StackScreenProps<DealsStackParamList, T>,
    TabScreenProps<keyof TabParamList>
  >;

// ============================================
// PROFILE STACK
// ============================================

export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  FavoriteStores: undefined;
  Settings: undefined;
  About: undefined;
};

export type ProfileStackScreenProps<T extends keyof ProfileStackParamList> =
  CompositeScreenProps<
    StackScreenProps<ProfileStackParamList, T>,
    TabScreenProps<keyof TabParamList>
  >;

// ============================================
// GLOBAL TYPES
// ============================================

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}

