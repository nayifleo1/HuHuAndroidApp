import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  useColorScheme,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
  Dimensions,
  Pressable
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../styles/colors';
import { useSettings, DEFAULT_SETTINGS } from '../hooks/useSettings';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInRight,
  withSpring,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface SettingItemProps {
  title: string;
  description: string;
  icon: string;
  renderControl: () => React.ReactNode;
  isLast?: boolean;
  onPress?: () => void;
  isDarkMode: boolean;
}

const SettingItem: React.FC<SettingItemProps> = ({
  title,
  description,
  icon,
  renderControl,
  isLast = false,
  onPress,
  isDarkMode
}) => {
  const pressed = useSharedValue(0);
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      pressed.value,
      [0, 1],
      [
        isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
      ]
    );

    const elevation = interpolate(
      pressed.value,
      [0, 1],
      [1, 4],
      Extrapolate.CLAMP
    );

    if (Platform.OS === 'ios') {
      return {
        backgroundColor,
        transform: [{ scale: scale.value }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: elevation },
        shadowOpacity: 0.15,
        shadowRadius: elevation * 2,
      };
    }
    
    if (Platform.OS === 'android') {
      return {
        backgroundColor,
        transform: [{ scale: scale.value }],
        elevation,
      };
    }

    return {
      backgroundColor,
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    pressed.value = withTiming(1, { duration: 150 });
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    pressed.value = withTiming(0, { duration: 150 });
    scale.value = withSpring(1);
  };

  return (
    <Animated.View 
      entering={SlideInRight.springify()}
      style={[
        styles.settingItem,
        !isLast && styles.settingItemBorder,
        animatedStyle
      ]}
    >
      <Pressable
        style={styles.settingTouchable}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        android_ripple={{ 
          color: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          borderless: true
        }}
      >
        <View style={[
          styles.settingIconContainer,
          { backgroundColor: isDarkMode ? colors.elevation2 : 'rgba(147, 51, 234, 0.08)' }
        ]}>
          <MaterialIcons name={icon} size={24} color={colors.primary} />
        </View>
        <View style={styles.settingContent}>
          <Text style={[styles.settingTitle, { color: isDarkMode ? colors.highEmphasis : colors.textDark }]}>
            {title}
          </Text>
          <Text style={[styles.settingDescription, { color: isDarkMode ? colors.mediumEmphasis : colors.textMutedDark }]}>
            {description}
          </Text>
        </View>
        <View style={styles.settingControl}>
          {renderControl()}
        </View>
      </Pressable>
    </Animated.View>
  );
};

const SettingsScreen: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark' || settings.enableDarkMode;
  const navigation = useNavigation();

  const handleResetSettings = useCallback(() => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            (Object.keys(DEFAULT_SETTINGS) as Array<keyof typeof DEFAULT_SETTINGS>).forEach(key => {
              updateSetting(key, DEFAULT_SETTINGS[key]);
            });
          }
        }
      ]
    );
  }, [updateSetting]);

  const renderSectionHeader = (title: string) => (
    <Animated.View 
      entering={SlideInRight.springify()}
      style={styles.sectionHeader}
    >
      <Text style={[
        styles.sectionHeaderText,
        { color: isDarkMode ? colors.mediumEmphasis : colors.textMutedDark }
      ]}>
        {title}
      </Text>
    </Animated.View>
  );

  const CustomSwitch = ({ value, onValueChange }: { value: boolean, onValueChange: (value: boolean) => void }) => (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: isDarkMode ? colors.elevation2 : colors.surfaceVariant, true: `${colors.primary}80` }}
      thumbColor={value ? colors.primary : (isDarkMode ? colors.white : colors.white)}
      ios_backgroundColor={isDarkMode ? colors.elevation2 : colors.surfaceVariant}
      style={Platform.select({ ios: { transform: [{ scale: 0.8 }] } })}
    />
  );

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: isDarkMode ? colors.darkBackground : colors.lightBackground }
    ]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { 
        borderBottomColor: isDarkMode ? colors.border : 'rgba(0,0,0,0.08)'
      }]}>
        <Text style={[styles.headerTitle, { color: isDarkMode ? colors.highEmphasis : colors.textDark }]}>
          Settings
        </Text>
      </View>
      <Animated.ScrollView 
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(300)}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderSectionHeader('Appearance')}
        <SettingItem
          title="Dark Mode"
          description="Enable dark theme for the application"
          icon="dark-mode"
          isDarkMode={isDarkMode}
          renderControl={() => (
            <CustomSwitch
              value={settings.enableDarkMode}
              onValueChange={(value) => updateSetting('enableDarkMode', value)}
            />
          )}
        />

        {renderSectionHeader('Playback')}
        <SettingItem
          title="Stream Quality"
          description="Choose your default stream quality"
          icon="high-quality"
          isDarkMode={isDarkMode}
          renderControl={() => (
            <View style={[
              styles.selectButton,
              { backgroundColor: isDarkMode ? 'rgba(147, 51, 234, 0.15)' : 'rgba(147, 51, 234, 0.1)' }
            ]}>
              <Text style={[styles.selectButtonText, { color: isDarkMode ? colors.white : colors.black }]}>
                {settings.streamQuality.charAt(0).toUpperCase() + settings.streamQuality.slice(1)}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={20} color={isDarkMode ? colors.white : colors.black} />
            </View>
          )}
          onPress={() => {
            Alert.alert(
              'Stream Quality',
              'Select default stream quality',
              [
                { text: 'Auto', onPress: () => updateSetting('streamQuality', 'auto') },
                { text: 'Low', onPress: () => updateSetting('streamQuality', 'low') },
                { text: 'Medium', onPress: () => updateSetting('streamQuality', 'medium') },
                { text: 'High', onPress: () => updateSetting('streamQuality', 'high') },
              ]
            );
          }}
        />
        <SettingItem
          title="External Player"
          description="Use external video player when available"
          icon="open-in-new"
          isDarkMode={isDarkMode}
          renderControl={() => (
            <CustomSwitch
              value={settings.useExternalPlayer}
              onValueChange={(value) => updateSetting('useExternalPlayer', value)}
            />
          )}
        />
        <SettingItem
          title="Subtitles"
          description="Enable subtitles when available"
          icon="subtitles"
          isDarkMode={isDarkMode}
          renderControl={() => (
            <CustomSwitch
              value={settings.enableSubtitles}
              onValueChange={(value) => updateSetting('enableSubtitles', value)}
            />
          )}
        />

        {renderSectionHeader('Content')}
        <SettingItem
          title="Catalog Settings"
          description="Customize which catalogs appear on your home screen"
          icon="view-list"
          isDarkMode={isDarkMode}
          renderControl={() => (
            <View style={[styles.actionButton, { backgroundColor: colors.primary }]}>
              <Text style={styles.actionButtonText}>Configure</Text>
            </View>
          )}
          onPress={() => navigation.navigate('CatalogSettings')}
        />

        {renderSectionHeader('Advanced')}
        <SettingItem
          title="Manage Addons"
          description="Configure and update your addons"
          icon="extension"
          isDarkMode={isDarkMode}
          renderControl={() => (
            <MaterialIcons 
              name="chevron-right" 
              size={24} 
              color={isDarkMode ? colors.lightGray : colors.mediumGray}
              style={styles.chevronIcon}
            />
          )}
          onPress={() => navigation.navigate('Addons' as never)}
        />
        <SettingItem
          title="Reset All Settings"
          description="Restore default settings"
          icon="settings-backup-restore"
          isDarkMode={isDarkMode}
          renderControl={() => (
            <View style={[styles.actionButton, { backgroundColor: colors.warning }]}>
              <Text style={styles.actionButtonText}>Reset</Text>
            </View>
          )}
          isLast={true}
          onPress={handleResetSettings}
        />

        {renderSectionHeader('About')}
        <SettingItem
          title="App Version"
          description="HuHuMobile v1.0.0"
          icon="info"
          isDarkMode={isDarkMode}
          renderControl={() => null}
          isLast={true}
        />
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  sectionHeader: {
    padding: 16,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  settingItem: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 16,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  settingItemBorder: {
    marginBottom: 8,
  },
  settingTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  settingIconContainer: {
    marginRight: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.15,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.25,
  },
  settingControl: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 50,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectButtonText: {
    fontWeight: '600',
    marginRight: 4,
    fontSize: 14,
    letterSpacing: 0.25,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  chevronIcon: {
    opacity: 0.8,
  },
});

export default SettingsScreen;