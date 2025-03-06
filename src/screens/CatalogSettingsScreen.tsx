import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../styles';
import { stremioService } from '../services/stremioService';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

interface CatalogSetting {
  addonId: string;
  catalogId: string;
  type: string;
  name: string;
  enabled: boolean;
}

interface CatalogSettingsStorage {
  [key: string]: boolean | number;
  _lastUpdate: number;
}

const CATALOG_SETTINGS_KEY = 'catalog_settings';

const CatalogSettingsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<CatalogSetting[]>([]);
  const navigation = useNavigation();

  // Load saved settings and available catalogs
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get installed addons and their catalogs
      const addons = await stremioService.getInstalledAddonsAsync();
      const availableCatalogs: CatalogSetting[] = [];
      
      // Get saved settings
      const savedSettings = await AsyncStorage.getItem(CATALOG_SETTINGS_KEY);
      const savedCatalogs: { [key: string]: boolean } = savedSettings ? JSON.parse(savedSettings) : {};
      
      // Process each addon's catalogs
      addons.forEach(addon => {
        if (addon.catalogs && addon.catalogs.length > 0) {
          // Create a map to store unique catalogs by their type and id
          const uniqueCatalogs = new Map<string, CatalogSetting>();
          
          addon.catalogs.forEach(catalog => {
            const settingKey = `${addon.id}:${catalog.type}:${catalog.id}`;
            const uniqueKey = `${catalog.type}:${catalog.id}`;
            
            // Format catalog name
            let displayName = catalog.name;
            if (addon.id === 'com.linvo.cinemeta') {
              const contentType = catalog.type === 'movie' ? 'Movies' : 'TV Shows';
              // Remove duplicate words and clean up the name
              displayName = catalog.name
                .split(' ')
                .filter((word, index, arr) => arr.indexOf(word) === index) // Remove duplicate words
                .join(' ');
              if (!displayName.includes(contentType)) {
                displayName = `${displayName} ${contentType}`;
              }
            }

            // Only add if we haven't seen this catalog type and id combination before
            if (!uniqueCatalogs.has(uniqueKey)) {
              uniqueCatalogs.set(uniqueKey, {
                addonId: addon.id,
                catalogId: catalog.id,
                type: catalog.type,
                name: `${addon.name} - ${displayName}`,
                enabled: savedCatalogs[settingKey] ?? true // Enable by default
              });
            }
          });
          
          // Add unique catalogs to the available catalogs array
          availableCatalogs.push(...uniqueCatalogs.values());
        }
      });
      
      setSettings(availableCatalogs);
    } catch (error) {
      console.error('Failed to load catalog settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save settings when they change
  const saveSettings = async (newSettings: CatalogSetting[]) => {
    try {
      const settingsObj: CatalogSettingsStorage = {
        _lastUpdate: Date.now()
      };
      newSettings.forEach(setting => {
        const key = `${setting.addonId}:${setting.type}:${setting.catalogId}`;
        settingsObj[key] = setting.enabled;
      });
      await AsyncStorage.setItem(CATALOG_SETTINGS_KEY, JSON.stringify(settingsObj));
    } catch (error) {
      console.error('Failed to save catalog settings:', error);
    }
  };

  // Toggle individual catalog
  const toggleCatalog = (index: number) => {
    const newSettings = [...settings];
    newSettings[index].enabled = !newSettings[index].enabled;
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Group settings by addon
  const groupedSettings: { [key: string]: CatalogSetting[] } = {};
  settings.forEach(setting => {
    if (!groupedSettings[setting.addonId]) {
      groupedSettings[setting.addonId] = [];
    }
    groupedSettings[setting.addonId].push(setting);
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Catalog Settings</Text>
      </View>
      
      <ScrollView style={styles.scrollView}>
        <Text style={styles.description}>
          Choose which catalogs to show on your home screen. Changes will take effect immediately.
        </Text>
        
        {Object.entries(groupedSettings).map(([addonId, addonCatalogs]) => (
          <View key={addonId} style={styles.addonSection}>
            <Text style={styles.addonTitle}>
              {addonCatalogs[0].name.split(' - ')[0]}
            </Text>
            {addonCatalogs.map((setting, index) => (
              <View key={`${setting.addonId}:${setting.type}:${setting.catalogId}`} style={styles.catalogItem}>
                <Text style={styles.catalogName}>
                  {setting.name.split(' - ')[1]}
                </Text>
                <Switch
                  value={setting.enabled}
                  onValueChange={() => toggleCatalog(
                    settings.findIndex(s => 
                      s.addonId === setting.addonId && 
                      s.catalogId === setting.catalogId
                    )
                  )}
                  trackColor={{ false: colors.mediumGray, true: colors.primary }}
                />
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  description: {
    padding: 16,
    fontSize: 14,
    color: colors.mediumGray,
  },
  addonSection: {
    marginBottom: 24,
  },
  addonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  catalogItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  catalogName: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
    marginRight: 16,
  },
});

export default CatalogSettingsScreen; 