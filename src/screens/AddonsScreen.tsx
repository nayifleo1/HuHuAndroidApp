import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  Image
} from 'react-native';
import { stremioService, Manifest } from '../services/stremioService';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const AddonsScreen = () => {
  const isDarkMode = useColorScheme() === 'dark';
  const [addons, setAddons] = useState<Manifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [addonUrl, setAddonUrl] = useState('');
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    loadAddons();
  }, []);

  const loadAddons = async () => {
    try {
      setLoading(true);
      const installedAddons = await stremioService.getInstalledAddonsAsync();
      setAddons(installedAddons);
    } catch (error) {
      console.error('Failed to load addons:', error);
      Alert.alert('Error', 'Failed to load addons');
    } finally {
      setLoading(false);
    }
  };

  const handleInstallAddon = async () => {
    if (!addonUrl) {
      Alert.alert('Error', 'Please enter an addon URL');
      return;
    }

    try {
      setInstalling(true);
      await stremioService.installAddon(addonUrl);
      setAddonUrl('');
      loadAddons();
      Alert.alert('Success', 'Addon installed successfully');
    } catch (error) {
      console.error('Failed to install addon:', error);
      Alert.alert('Error', 'Failed to install addon');
    } finally {
      setInstalling(false);
    }
  };

  const handleRemoveAddon = (addon: Manifest) => {
    Alert.alert(
      'Remove Addon',
      `Are you sure you want to remove ${addon.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            stremioService.removeAddon(addon.id);
            loadAddons();
          },
        },
      ]
    );
  };

  const renderAddonItem = ({ item }: { item: Manifest }) => {
    // Get the first catalog type to display
    const catalogType = item.catalogs && item.catalogs.length > 0
      ? item.catalogs[0].type
      : 'unknown';

    return (
      <View style={[
        styles.addonItem,
        { backgroundColor: isDarkMode ? '#1E1E1E' : '#F5F5F5' }
      ]}>
        <View style={styles.addonHeader}>
          <Text style={[
            styles.addonName,
            { color: isDarkMode ? '#FFFFFF' : '#000000' }
          ]}>
            {item.name}
          </Text>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveAddon(item)}
          >
            <MaterialIcons name="delete" size={24} color="#E50914" />
          </TouchableOpacity>
        </View>
        
        <Text style={[
          styles.addonDescription,
          { color: isDarkMode ? '#AAAAAA' : '#666666' }
        ]}>
          {item.description}
        </Text>
        
        <View style={styles.addonDetails}>
          <View style={styles.addonBadge}>
            <Text style={styles.addonBadgeText}>v{item.version}</Text>
          </View>
          
          {catalogType !== 'unknown' && (
            <View style={styles.addonBadge}>
              <Text style={styles.addonBadgeText}>{catalogType}</Text>
            </View>
          )}
          
          {item.types && item.types.map((type, index) => (
            <View key={index} style={styles.addonBadge}>
              <Text style={styles.addonBadgeText}>{type}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: isDarkMode ? '#121212' : '#FFFFFF' }
    ]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#121212' : '#FFFFFF'}
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingContainer}
      >
        <Text style={[
          styles.title,
          { color: isDarkMode ? '#FFFFFF' : '#000000' }
        ]}>
          Addons
        </Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDarkMode ? '#1E1E1E' : '#F5F5F5',
                color: isDarkMode ? '#FFFFFF' : '#000000',
              }
            ]}
            placeholder="Enter addon URL..."
            placeholderTextColor={isDarkMode ? '#888888' : '#AAAAAA'}
            value={addonUrl}
            onChangeText={setAddonUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <TouchableOpacity
            style={[
              styles.installButton,
              { opacity: installing ? 0.7 : 1 }
            ]}
            onPress={handleInstallAddon}
            disabled={installing}
          >
            {installing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.installButtonText}>Install</Text>
            )}
          </TouchableOpacity>
        </View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E50914" />
          </View>
        ) : (
          <FlatList
            data={addons}
            renderItem={renderAddonItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.addonsList}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="extension-off" size={48} color="#888888" />
                <Text style={[
                  styles.emptyText,
                  { color: isDarkMode ? '#AAAAAA' : '#666666' }
                ]}>
                  No addons installed
                </Text>
              </View>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    margin: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  installButton: {
    backgroundColor: '#E50914',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  installButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addonsList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  addonItem: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  addonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addonName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  addonDescription: {
    marginBottom: 12,
  },
  addonDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  addonBadge: {
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 4,
  },
  addonBadgeText: {
    color: '#E50914',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default AddonsScreen; 