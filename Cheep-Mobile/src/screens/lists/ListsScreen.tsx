/**
 * 📋 Lists Screen
 * Shopping lists management
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { listService } from '../../services';
import { ListCard } from '../../components/list/ListCard';
import { EmptyState } from '../../components/common/EmptyState';
import { CreateListModal } from '../../components/list/CreateListModal';
import { getShouldOpenCreateModalFromFAB, setShouldOpenCreateModalFromFAB } from '../../utils/fabState';
import { colors, typography, spacing, layout } from '../../theme';
import type { ShoppingList } from '../../types';
import type { ListsStackScreenProps } from '../../navigation/types';

export function ListsScreen({ navigation, route }: ListsStackScreenProps<'ListsMain'>) {
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'templates'>('active');
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Reload lists when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadLists();
      
      // Check if we should open create modal (from FAB)
      const routeParams = route.params;
      const shouldOpen = routeParams?.openCreateModal || getShouldOpenCreateModalFromFAB();
      
      if (shouldOpen) {
        // Clear the flags
        setShouldOpenCreateModalFromFAB(false);
        navigation.setParams({ openCreateModal: undefined });
        // Open modal after a short delay to ensure lists are loaded
        setTimeout(() => {
          handleCreateList();
        }, 300);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, route.params?.openCreateModal])
  );

  const loadLists = async () => {
    try {
      setLoading(true);
      let data: ShoppingList[];
      
      if (activeTab === 'templates') {
        data = await listService.getTemplates();
      } else {
        data = await listService.getLists(activeTab);
      }
      
      setLists(data);
    } catch (error) {
      console.error('Load lists error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLists();
    setRefreshing(false);
  };

  const handleCreateList = async () => {
    // Aktif liste var mı kontrol et
    const activeLists = lists.filter((l) => l.status === 'active' && !l.is_template);
    if (activeLists.length > 0) {
      Alert.alert(
        'Aktif Liste Mevcut',
        'Hali hazırda aktif listeniz var. Yeni liste oluşturmak isterseniz eski liste otomatik olarak tamamlanacaktır. Devam etmek istiyor musunuz?',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Devam Et',
            onPress: () => setShowCreateModal(true),
          },
        ]
      );
    } else {
      setShowCreateModal(true);
    }
  };

  const handleCreateSuccess = () => {
    loadLists();
  };

  const handleDeleteList = async (listId: number) => {
    try {
      await listService.deleteList(listId);
      await loadLists();
    } catch {
      Alert.alert('Hata', 'Liste silinirken bir hata oluştu');
    }
  };

  const renderEmptyState = () => {
    const emptyStates = {
      active: {
        title: 'Henüz liste yok',
        description: 'İlk alışveriş listeni oluştur',
        actionLabel: 'Liste Oluştur' as const,
      },
      completed: {
        title: 'Tamamlanmış liste yok',
        description: 'Karşılaştırdığınız listeler burada görünecek',
      },
      templates: {
        title: 'Şablon liste yok',
        description: 'Sık kullandığınız listeleri şablon olarak kaydedin',
      },
    };

    const state = emptyStates[activeTab];
    const hasAction = 'actionLabel' in state && state.actionLabel;
    return (
      <EmptyState
        title={state.title}
        description={state.description}
        {...(hasAction && { actionLabel: state.actionLabel, onAction: handleCreateList })}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Listelerim</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text
            style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}
          >
            Aktif
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text
            style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}
          >
            Tamamlanan
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'templates' && styles.activeTab]}
          onPress={() => setActiveTab('templates')}
        >
          <Text
            style={[styles.tabText, activeTab === 'templates' && styles.activeTabText]}
          >
            Şablonlar
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lists */}
      <FlatList
        data={lists}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ListCard
            list={item}
            onPress={() => navigation.navigate('ListDetail', { listId: item.id })}
            onDelete={handleDeleteList}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.main}
          />
        }
        ListEmptyComponent={!loading ? renderEmptyState : null}
      />

      {/* Create List Modal */}
      <CreateListModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
        hasActiveList={lists.some((l) => l.status === 'active' && !l.is_template)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  header: {
    backgroundColor: colors.background.paper,
    padding: layout.screenPadding,
    paddingTop: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  title: {
    ...typography.styles.h2,
    color: colors.text.primary,
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.transparent,
  },

  activeTab: {
    borderBottomColor: colors.primary.main,
  },

  tabText: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    fontWeight: '500',
  },

  activeTabText: {
    color: colors.primary.main,
    fontWeight: '600',
  },

  listContent: {
    padding: layout.screenPadding,
    flexGrow: 1,
  },

});

