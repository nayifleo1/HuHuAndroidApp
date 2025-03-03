import { NavigatorScreenParams } from '@react-navigation/native';

// Define the screens and their parameters
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Metadata: {
    id: string;
    type: string;
  };
  Player: {
    id: string;
    type: string;
    title?: string;
    poster?: string;
    stream?: string;
  };
  Catalog: {
    addonId: string;
    type: string;
    id: string;
    name?: string;
  };
  Addons: undefined;
  Search: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  Library: undefined;
  Settings: undefined;
};

// Declare custom types for the navigation hook
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
} 