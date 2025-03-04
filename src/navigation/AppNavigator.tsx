import React from 'react';
import { NavigationContainer, DefaultTheme as NavigationDefaultTheme, DarkTheme as NavigationDarkTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useColorScheme, Platform } from 'react-native';
import { PaperProvider, MD3DarkTheme, MD3LightTheme, adaptNavigationTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../styles/colors';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

// Screens
import {
  HomeScreen,
  DiscoverScreen,
  LibraryScreen,
  SettingsScreen,
  MetadataScreen,
  PlayerScreen,
  CatalogScreen,
  AddonsScreen,
  SearchScreen
} from '../screens';

// Stack navigator types
export type RootStackParamList = {
  MainTabs: undefined;
  Metadata: { id: string; type: string };
  Player: { id: string; type: string; title?: string; poster?: string; stream?: string };
  Catalog: { id: string; type: string; addonId: string };
  Addons: undefined;
  Search: undefined;
};

// Tab navigator types
export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  Library: undefined;
  Settings: undefined;
};

// Custom fonts that satisfy both theme types
const fonts = {
  regular: {
    fontFamily: 'sans-serif',
    fontWeight: '400' as const,
  },
  medium: {
    fontFamily: 'sans-serif-medium',
    fontWeight: '500' as const,
  },
  bold: {
    fontFamily: 'sans-serif',
    fontWeight: '700' as const,
  },
  heavy: {
    fontFamily: 'sans-serif',
    fontWeight: '900' as const,
  },
  // MD3 specific fonts
  displayLarge: {
    fontFamily: 'sans-serif',
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 64,
    fontSize: 57,
  },
  displayMedium: {
    fontFamily: 'sans-serif',
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 52,
    fontSize: 45,
  },
  displaySmall: {
    fontFamily: 'sans-serif',
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 44,
    fontSize: 36,
  },
  headlineLarge: {
    fontFamily: 'sans-serif',
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 40,
    fontSize: 32,
  },
  headlineMedium: {
    fontFamily: 'sans-serif',
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 36,
    fontSize: 28,
  },
  headlineSmall: {
    fontFamily: 'sans-serif',
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 32,
    fontSize: 24,
  },
  titleLarge: {
    fontFamily: 'sans-serif',
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 28,
    fontSize: 22,
  },
  titleMedium: {
    fontFamily: 'sans-serif-medium',
    fontWeight: '500' as const,
    letterSpacing: 0.15,
    lineHeight: 24,
    fontSize: 16,
  },
  titleSmall: {
    fontFamily: 'sans-serif-medium',
    fontWeight: '500' as const,
    letterSpacing: 0.1,
    lineHeight: 20,
    fontSize: 14,
  },
  labelLarge: {
    fontFamily: 'sans-serif-medium',
    fontWeight: '500' as const,
    letterSpacing: 0.1,
    lineHeight: 20,
    fontSize: 14,
  },
  labelMedium: {
    fontFamily: 'sans-serif-medium',
    fontWeight: '500' as const,
    letterSpacing: 0.5,
    lineHeight: 16,
    fontSize: 12,
  },
  labelSmall: {
    fontFamily: 'sans-serif-medium',
    fontWeight: '500' as const,
    letterSpacing: 0.5,
    lineHeight: 16,
    fontSize: 11,
  },
  bodyLarge: {
    fontFamily: 'sans-serif',
    fontWeight: '400' as const,
    letterSpacing: 0.15,
    lineHeight: 24,
    fontSize: 16,
  },
  bodyMedium: {
    fontFamily: 'sans-serif',
    fontWeight: '400' as const,
    letterSpacing: 0.25,
    lineHeight: 20,
    fontSize: 14,
  },
  bodySmall: {
    fontFamily: 'sans-serif',
    fontWeight: '400' as const,
    letterSpacing: 0.4,
    lineHeight: 16,
    fontSize: 12,
  },
} as const;

// Create navigators
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Create custom paper themes
const CustomLightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
  },
  fonts: MD3LightTheme.fonts,
};

const CustomDarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primary,
  },
  fonts: MD3DarkTheme.fonts,
};

// Create custom navigation theme
const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
});

// Add fonts to navigation themes
const CustomNavigationLightTheme: Theme = {
  ...LightTheme,
  fonts,
};

const CustomNavigationDarkTheme: Theme = {
  ...DarkTheme,
  fonts,
};

// Tab Navigator
const MainTabs = () => {
  const isDarkMode = useColorScheme() === 'dark';
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = '';
          
          switch (route.name) {
            case 'Home':
              iconName = 'home';
              break;
            case 'Discover':
              iconName = 'compass';
              break;
            case 'Library':
              iconName = 'bookmark';
              break;
            case 'Settings':
              iconName = 'account';
              break;
          }
          
          return (
            <MaterialCommunityIcons 
              name={focused ? iconName : `${iconName}-outline`}
              size={24} 
              color={color} 
            />
          );
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: isDarkMode ? '#888888' : '#666666',
        tabBarStyle: {
          backgroundColor: isDarkMode ? colors.darkBackground : colors.white,
          borderTopWidth: 0,
          elevation: 0,
          height: 65,
          paddingBottom: 10,
          paddingTop: 10,
          shadowColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: isDarkMode ? colors.darkBackground : colors.white,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
          height: Platform.OS === 'ios' ? 96 : 80,
        },
        headerTitleStyle: {
          fontSize: 32,
          fontWeight: '900',
          color: colors.primary,
          letterSpacing: 1,
          fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
          textTransform: 'uppercase',
          marginLeft: Platform.OS === 'ios' ? -4 : -8,
        },
        headerTitleContainerStyle: {
          paddingHorizontal: 24,
          alignItems: 'flex-start',
          marginLeft: Platform.OS === 'ios' ? 8 : 0,
        },
        headerShadowVisible: false,
        animation: 'fade',
        presentation: 'card'
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ 
          title: 'HUHU',
          headerShown: true,
          tabBarLabel: 'Home'
        }}
      />
      <Tab.Screen 
        name="Discover" 
        component={DiscoverScreen}
        options={{ 
          title: 'HUHU',
          headerShown: true,
          tabBarLabel: 'Discover'
        }}
      />
      <Tab.Screen 
        name="Library" 
        component={LibraryScreen}
        options={{ 
          title: 'HUHU',
          headerShown: true,
          tabBarLabel: 'Library'
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ 
          title: 'HUHU',
          headerShown: true,
          tabBarLabel: 'Profile'
        }}
      />
    </Tab.Navigator>
  );
};

// Stack Navigator
const AppNavigator = () => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  
  return (
    <PaperProvider theme={isDark ? CustomDarkTheme : CustomLightTheme}>
      <NavigationContainer theme={isDark ? CustomNavigationDarkTheme : CustomNavigationLightTheme}>
        <Stack.Navigator>
          <Stack.Screen 
            name="MainTabs" 
            component={MainTabs} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Metadata" 
            component={MetadataScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Player" 
            component={PlayerScreen} 
            options={{ headerShown: false, fullScreenGestureEnabled: true }}
          />
          <Stack.Screen 
            name="Catalog" 
            component={CatalogScreen} 
            options={({ route }) => ({ 
              title: `${route.params.type} - ${route.params.id}`,
              headerBackTitleVisible: false
            })}
          />
          <Stack.Screen 
            name="Addons" 
            component={AddonsScreen} 
            options={{ title: 'Addons' }}
          />
          <Stack.Screen 
            name="Search" 
            component={SearchScreen} 
            options={{ title: 'Search' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
};

export default AppNavigator; 