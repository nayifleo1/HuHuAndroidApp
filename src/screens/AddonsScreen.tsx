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
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image
} from 'react-native';
import { stremioService, Manifest } from '../services/stremioService';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../styles';

const AddonsScreen = () => {
  const [addons, setAddons] = useState<Manifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [installing, setInstalling] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addonUrl, setAddonUrl] = useState('');

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
      setShowAddModal(false);
      loadAddons();
      Alert.alert('Success', 'Addon installed successfully');
    } catch (error) {
      console.error('Failed to install addon:', error);
      Alert.alert('Error', 'Failed to install addon');
    } finally {
      setInstalling(false);
    }
  };

  const handleConfigureAddon = (addon: Manifest) => {
    // TODO: Implement addon configuration
    Alert.alert('Configure', `Configure ${addon.name}`);
  };

  const handleRemoveAddon = (addon: Manifest) => {
    Alert.alert(
      'Uninstall',
      `Are you sure you want to uninstall ${addon.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Uninstall',
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
    const types = item.types || [];
    const description = item.description || '';
    // @ts-ignore - some addons might have logo property even though it's not in the type
    const logo = item.logo || null;

    return (
      <View style={styles.addonItem}>
        <View style={styles.addonContent}>
          <View style={styles.addonIconContainer}>
            {logo ? (
              <Image 
                source={{ uri: logo }} 
                style={styles.addonIcon} 
                resizeMode="contain"
              />
            ) : (
              <View style={styles.placeholderIcon}>
                <MaterialIcons name="extension" size={32} color={colors.mediumGray} />
              </View>
            )}
          </View>
          
          <View style={styles.addonInfo}>
            <Text style={styles.addonName}>{item.name}</Text>
            <Text style={styles.addonType}>
              {types.join(', ')}
            </Text>
            <Text style={styles.addonDescription} numberOfLines={2}>
              {description}
            </Text>
          </View>
        </View>

        <View style={styles.addonActions}>
          <TouchableOpacity
            style={styles.configButton}
            onPress={() => handleConfigureAddon(item)}
          >
            <MaterialIcons name="settings" size={24} color={colors.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.uninstallButton}
            onPress={() => handleRemoveAddon(item)}
          >
            <Text style={styles.uninstallText}>Uninstall</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.darkBackground} />
      
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={24} color={colors.mediumGray} />
        <TextInput
          style={styles.searchInput}
          placeholder="You can search anything..."
          placeholderTextColor={colors.mediumGray}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={addons}
          renderItem={renderAddonItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.addonsList}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="extension-off" size={48} color={colors.mediumGray} />
              <Text style={styles.emptyText}>No addons installed</Text>
            </View>
          )}
        />
      )}

      {/* Add Addon FAB */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
      >
        <MaterialIcons name="add" size={24} color={colors.text} />
      </TouchableOpacity>

      {/* Add Addon Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Addon</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter addon URL..."
              placeholderTextColor={colors.mediumGray}
              value={addonUrl}
              onChangeText={setAddonUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleInstallAddon}
                disabled={installing}
              >
                {installing ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                    Install
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBackground,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.elevation1,
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: colors.text,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addonsList: {
    padding: 16,
  },
  addonItem: {
    backgroundColor: colors.elevation1,
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
  },
  addonContent: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  addonIconContainer: {
    width: 48,
    height: 48,
    marginRight: 16,
  },
  addonIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  placeholderIcon: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.elevation2,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addonInfo: {
    flex: 1,
  },
  addonName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  addonType: {
    color: colors.mediumGray,
    fontSize: 14,
    marginBottom: 4,
  },
  addonDescription: {
    color: colors.textMuted,
    fontSize: 14,
  },
  addonActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.elevation2,
    paddingTop: 16,
  },
  configButton: {
    padding: 8,
  },
  uninstallButton: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.elevation2,
  },
  uninstallText: {
    color: colors.text,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.mediumGray,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.transparentDark,
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.elevation1,
    borderRadius: 12,
    padding: 24,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: colors.elevation2,
    borderRadius: 8,
    padding: 12,
    color: colors.text,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 8,
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonText: {
    color: colors.mediumGray,
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalButtonTextPrimary: {
    color: colors.text,
  },
});

export default AddonsScreen; 