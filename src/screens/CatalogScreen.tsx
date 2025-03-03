import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { Meta, stremioService } from '../services/stremioService';
import { colors } from '../styles';
import FastImage from '@d11/react-native-fast-image';

type CatalogScreenProps = {
  route: RouteProp<RootStackParamList, 'Catalog'>;
  navigation: StackNavigationProp<RootStackParamList, 'Catalog'>;
};

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const ITEM_WIDTH = width / NUM_COLUMNS - 20;

const CatalogScreen: React.FC<CatalogScreenProps> = ({ route, navigation }) => {
  const { addonId, type, id, name } = route.params;
  const [items, setItems] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const loadItems = useCallback(async (pageNum: number, shouldRefresh: boolean = false) => {
    try {
      if (shouldRefresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      }

      setError(null);
      
      // Get all addons
      const addons = stremioService.getInstalledAddons();
      
      // Find the specific addon
      const addon = addons.find(a => a.id === addonId);
      
      if (!addon) {
        throw new Error(`Addon ${addonId} not found`);
      }
      
      // Load items from the catalog
      const newItems = await stremioService.getCatalog(addon, type, id, pageNum);
      
      if (newItems.length === 0) {
        setHasMore(false);
      }
      
      if (shouldRefresh || pageNum === 1) {
        setItems(newItems);
      } else {
        setItems(prev => [...prev, ...newItems]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog items');
      console.error('Failed to load catalog:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addonId, type, id]);

  useEffect(() => {
    loadItems(1);
    // Set the header title
    navigation.setOptions({ title: name || `${type} catalog` });
  }, [loadItems, navigation, name, type]);

  const handleRefresh = useCallback(() => {
    setPage(1);
    loadItems(1, true);
  }, [loadItems]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadItems(nextPage);
    }
  }, [loading, hasMore, page, loadItems]);

  const renderItem = useCallback(({ item }: { item: Meta }) => {
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => navigation.navigate('Metadata', { id: item.id, type: item.type })}
      >
        <FastImage
          source={{ uri: item.poster || 'https://via.placeholder.com/300x450/cccccc/666666?text=No+Image' }}
          style={styles.poster}
          resizeMode={FastImage.resizeMode.cover}
        />
        <Text
          style={[
            styles.title,
            { color: isDarkMode ? colors.white : colors.darkGray }
          ]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        {item.releaseInfo && (
          <Text
            style={[
              styles.releaseInfo,
              { color: isDarkMode ? colors.lightGray : colors.mediumGray }
            ]}
          >
            {item.releaseInfo}
          </Text>
        )}
      </TouchableOpacity>
    );
  }, [navigation, isDarkMode]);

  if (loading && items.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ color: isDarkMode ? colors.white : colors.black }}>
          {error}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => loadItems(1)}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: isDarkMode ? colors.darkBackground : colors.lightBackground }
    ]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.id}-${item.type}`}
        numColumns={NUM_COLUMNS}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loading && items.length > 0 ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  list: {
    padding: 10,
  },
  item: {
    width: ITEM_WIDTH,
    margin: 5,
    overflow: 'hidden',
  },
  poster: {
    width: '100%',
    aspectRatio: 2/3,
    borderRadius: 4,
    backgroundColor: colors.lightGray,
  },
  title: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: '500',
  },
  releaseInfo: {
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  retryButton: {
    marginTop: 15,
    padding: 10,
    backgroundColor: colors.primary,
    borderRadius: 5,
  },
  retryText: {
    color: colors.white,
    fontWeight: '500',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CatalogScreen; 