import React from 'react';
import { NavigationContainer, DefaultTheme as NavigationDefaultTheme, DarkTheme as NavigationDarkTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useColorScheme, Platform, Animated, StatusBar, TouchableOpacity, View, Text } from 'react-native';
import { PaperProvider, MD3DarkTheme, MD3LightTheme, adaptNavigationTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../styles/colors';

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
  SearchScreen,
  ShowRatingsScreen,
  CatalogSettingsScreen,
  StreamsScreen
} from '../screens';

// Stack navigator types
export type RootStackParamList = {
  MainTabs: undefined;
  Metadata: { id: string; type: string };
  Streams: { id: string; type: string; episodeId?: string };
  Player: { id: string; type: string; title?: string; poster?: string; stream?: string };
  Catalog: { id: string; type: string; addonId: string };
  Addons: undefined;
  Search: undefined;
  ShowRatings: { showId: number };
  CatalogSettings: undefined;
};

// Tab navigator types
export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  Library: undefined;
  Addons: undefined;
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
  
  const renderTabBar = (props: BottomTabBarProps) => {
    return (
      <View style={{ 
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0,
        height: 75,
      }}>
        <LinearGradient
          colors={[
            'rgba(0, 0, 0, 0)',
            'rgba(0, 0, 0, 0.65)',
            'rgba(0, 0, 0, 0.85)',
            'rgba(0, 0, 0, 0.98)',
          ]}
          locations={[0, 0.2, 0.4, 0.8]}
          style={{
            position: 'absolute',
            height: '100%',
            width: '100%',
          }}
        />
        <View
          style={{
            height: '100%',
            paddingBottom: 10,
            paddingTop: 12,
          }}
        >
          <View style={{ flexDirection: 'row', paddingTop: 4 }}>
            {props.state.routes.map((route, index) => {
              const { options } = props.descriptors[route.key];
              const label =
                options.tabBarLabel !== undefined
                  ? options.tabBarLabel
                  : options.title !== undefined
                  ? options.title
                  : route.name;

              const isFocused = props.state.index === index;

              const onPress = () => {
                const event = props.navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  props.navigation.navigate(route.name);
                }
              };

              return (
                <TouchableOpacity
                  key={route.key}
                  activeOpacity={1}
                  onPress={onPress}
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'transparent',
                  }}
                >
                  {options.tabBarIcon?.({
                    focused: isFocused,
                    color: isFocused ? colors.primary : '#FFFFFF',
                    size: 24,
                  })}
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      marginTop: 4,
                      color: isFocused ? colors.primary : '#FFFFFF',
                      opacity: isFocused ? 1 : 0.7,
                    }}
                  >
                    {typeof label === 'string' ? label : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    );
  };
  
  return (
    <Tab.Navigator
      tabBar={renderTabBar}
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
            case 'Addons':
              iconName = 'puzzle';
              break;
            case 'Settings':
              iconName = 'cog';
              break;
          }
          
          return (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons 
                name={focused ? iconName : `${iconName}-outline`}
                size={24} 
                color={color} 
              />
            </View>
          );
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#FFFFFF',
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 75,
          paddingBottom: 10,
          paddingTop: 12,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 0,
        },
        tabBarButton: (props) => {
          const { style, onPress, children } = props;
          return (
            <TouchableOpacity
              onPress={onPress}
              activeOpacity={1}
              style={[
                style,
                { 
                  backgroundColor: 'transparent',
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center'
                }
              ]}
            >
              {children}
            </TouchableOpacity>
          );
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
        name="Addons" 
        component={AddonsScreen}
        options={{ 
          title: 'HUHU',
          headerShown: true,
          tabBarLabel: 'Addons'
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ 
          title: 'HUHU',
          headerShown: true,
          tabBarLabel: 'Settings'
        }}
      />
    </Tab.Navigator>
  );
};

// Stack Navigator
const AppNavigator = () => {
  const isDarkMode = useColorScheme() === 'dark';
  
  return (
    <NavigationContainer theme={isDarkMode ? CustomNavigationDarkTheme : CustomNavigationLightTheme}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      />
      <PaperProvider theme={isDarkMode ? CustomDarkTheme : CustomLightTheme}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
          }}
        >
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Metadata" component={MetadataScreen} />
          <Stack.Screen name="Streams" component={StreamsScreen} />
          <Stack.Screen name="Player" component={PlayerScreen} />
          <Stack.Screen name="Catalog" component={CatalogScreen} />
          <Stack.Screen name="Addons" component={AddonsScreen} />
          <Stack.Screen name="Search" component={SearchScreen} />
          <Stack.Screen name="CatalogSettings" component={CatalogSettingsScreen} />
          <Stack.Screen 
            name="ShowRatings" 
            component={ShowRatingsScreen}
            options={{
              animation: 'fade',
              animationDuration: 200,
              presentation: 'card',
              gestureEnabled: true,
              gestureDirection: 'horizontal',
              headerShown: false,
              contentStyle: {
                backgroundColor: colors.darkBackground,
              },
            }}
          />
        </Stack.Navigator>
      </PaperProvider>
    </NavigationContainer>
  );
};

export default AppNavigator; 