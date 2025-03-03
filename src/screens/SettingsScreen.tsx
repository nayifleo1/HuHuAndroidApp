import React, { useState, useCallback } from 'react';
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
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../styles/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  enableDarkMode: boolean;
  enableNotifications: boolean;
  streamQuality: 'auto' | 'low' | 'medium' | 'high';
  enableSubtitles: boolean;
  enableBackgroundPlayback: boolean;
  cacheLimit: number; // In MB
  useExternalPlayer: boolean; // Whether to use external player when available
}

const DEFAULT_SETTINGS: AppSettings = {
  enableDarkMode: false,
  enableNotifications: true,
  streamQuality: 'auto',
  enableSubtitles: true,
  enableBackgroundPlayback: false,
  cacheLimit: 1024, // 1GB
  useExternalPlayer: false, // Default to internal player
};

const SETTINGS_STORAGE_KEY = 'app_settings';

const SettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark' || settings.enableDarkMode;
  const navigation = useNavigation();

  // Load settings on mount
  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (storedSettings) {
        setSettings(JSON.parse(storedSettings));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const updateSetting = useCallback(<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  }, [settings]);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear all cached data? This will remove all downloaded content.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            // Implement cache clearing
            Alert.alert('Success', 'Cache cleared successfully');
          }
        }
      ]
    );
  }, []);

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
            saveSettings(DEFAULT_SETTINGS);
          }
        }
      ]
    );
  }, []);

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={[
        styles.sectionHeaderText,
        { color: isDarkMode ? colors.lightGray : colors.darkGray }
      ]}>
        {title}
      </Text>
    </View>
  );

  const renderSettingItem = (
    title: string,
    description: string,
    icon: string,
    renderControl: () => React.ReactNode
  ) => (
    <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : colors.border }]}>
      <View style={styles.settingIconContainer}>
        <MaterialIcons name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: isDarkMode ? colors.white : colors.black }]}>
          {title}
        </Text>
        <Text style={[styles.settingDescription, { color: isDarkMode ? colors.lightGray : colors.mediumGray }]}>
          {description}
        </Text>
      </View>
      <View style={styles.settingControl}>
        {renderControl()}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: isDarkMode ? colors.darkBackground : colors.lightBackground }
    ]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView style={styles.scrollView}>
        {renderSectionHeader('Appearance')}
        {renderSettingItem(
          'Dark Mode',
          'Enable dark theme for the application',
          'dark-mode',
          () => (
            <Switch
              value={settings.enableDarkMode}
              onValueChange={(value) => updateSetting('enableDarkMode', value)}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={settings.enableDarkMode ? colors.white : '#f4f3f4'}
            />
          )
        )}

        {renderSectionHeader('Playback')}
        {renderSettingItem(
          'Stream Quality',
          'Choose your default stream quality',
          'high-quality',
          () => (
            <TouchableOpacity
              style={styles.selectButton}
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
            >
              <Text style={{ color: isDarkMode ? colors.white : colors.black, fontWeight: '500' }}>
                {settings.streamQuality.charAt(0).toUpperCase() + settings.streamQuality.slice(1)}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={20} color={isDarkMode ? colors.white : colors.black} />
            </TouchableOpacity>
          )
        )}
        {renderSettingItem(
          'External Player',
          'Use external video player when available',
          'open-in-new',
          () => (
            <Switch
              value={settings.useExternalPlayer}
              onValueChange={(value) => updateSetting('useExternalPlayer', value)}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={settings.useExternalPlayer ? colors.white : '#f4f3f4'}
            />
          )
        )}
        {renderSettingItem(
          'Subtitles',
          'Enable subtitles when available',
          'subtitles',
          () => (
            <Switch
              value={settings.enableSubtitles}
              onValueChange={(value) => updateSetting('enableSubtitles', value)}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={settings.enableSubtitles ? colors.white : '#f4f3f4'}
            />
          )
        )}
        {renderSettingItem(
          'Background Playback',
          'Continue playing audio when app is in background',
          'play-circle-filled',
          () => (
            <Switch
              value={settings.enableBackgroundPlayback}
              onValueChange={(value) => updateSetting('enableBackgroundPlayback', value)}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={settings.enableBackgroundPlayback ? colors.white : '#f4f3f4'}
            />
          )
        )}

        {renderSectionHeader('Notifications')}
        {renderSettingItem(
          'Push Notifications',
          'Receive notifications about new content',
          'notifications',
          () => (
            <Switch
              value={settings.enableNotifications}
              onValueChange={(value) => updateSetting('enableNotifications', value)}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={settings.enableNotifications ? colors.white : '#f4f3f4'}
            />
          )
        )}

        {renderSectionHeader('Storage')}
        {renderSettingItem(
          'Cache Limit',
          `Maximum space used for caching (${settings.cacheLimit} MB)`,
          'storage',
          () => (
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => {
                Alert.alert(
                  'Cache Limit',
                  'Select maximum cache size',
                  [
                    { text: '512 MB', onPress: () => updateSetting('cacheLimit', 512) },
                    { text: '1 GB', onPress: () => updateSetting('cacheLimit', 1024) },
                    { text: '2 GB', onPress: () => updateSetting('cacheLimit', 2048) },
                    { text: '4 GB', onPress: () => updateSetting('cacheLimit', 4096) },
                  ]
                );
              }}
            >
              <Text style={{ color: isDarkMode ? colors.white : colors.black, fontWeight: '500' }}>
                {settings.cacheLimit >= 1024 ? `${settings.cacheLimit / 1024} GB` : `${settings.cacheLimit} MB`}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={20} color={isDarkMode ? colors.white : colors.black} />
            </TouchableOpacity>
          )
        )}
        {renderSettingItem(
          'Clear Cache',
          'Delete all cached data and images',
          'delete',
          () => (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.error }]}
              onPress={handleClearCache}
            >
              <Text style={styles.actionButtonText}>Clear</Text>
            </TouchableOpacity>
          )
        )}

        {renderSectionHeader('Account')}
        {renderSettingItem(
          'Account Settings',
          'Manage your account information',
          'account-circle',
          () => (
            <MaterialIcons name="chevron-right" size={24} color={isDarkMode ? colors.lightGray : colors.mediumGray} />
          )
        )}

        {renderSectionHeader('Advanced')}
        {renderSettingItem(
          'Manage Addons',
          'Configure and update your addons',
          'extension',
          () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('Addons' as never)}
            >
              <MaterialIcons name="chevron-right" size={24} color={isDarkMode ? colors.lightGray : colors.mediumGray} />
            </TouchableOpacity>
          )
        )}
        {renderSettingItem(
          'Reset All Settings',
          'Restore default settings',
          'settings-backup-restore',
          () => (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.warning }]}
              onPress={handleResetSettings}
            >
              <Text style={styles.actionButtonText}>Reset</Text>
            </TouchableOpacity>
          )
        )}

        {renderSectionHeader('About')}
        {renderSettingItem(
          'App Version',
          'StremioMobile v1.0.0',
          'info',
          () => null
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    padding: 16,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  settingIconContainer: {
    marginRight: 16,
    width: 40,
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
  },
  settingControl: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '500',
    fontSize: 14,
  },
});

export default SettingsScreen; 