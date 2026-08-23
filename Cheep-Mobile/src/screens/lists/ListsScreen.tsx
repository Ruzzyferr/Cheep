/**
 * 📋 Lists Screen
 * Shopping lists management
 */

import React, { useState, useCallback } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useLists, useListMutations } from '../../queries';
import { RefreshBar, ErrorState } from '../../components/ui';
import { ListCard } from '../../components/list/ListCard';
import { EmptyState } from '../../components/common/EmptyState';
import { ListSkeleton } from '../../components/ui';
import { CreateListModal } from '../../components/list/CreateListModal';
import { getShouldOpenCreateModalFromFAB, setShouldOpenCreateModalFromFAB } from '../../utils/fabState';
import { colors, typography, spacing, layout } from '../../theme';
import type { ShoppingList } from '../../types';
import type { ListsStackScreenProps } from '../../navigation/types';
import { useBottomSpacing, useTopSpacing } from '../../hooks/useScreenSpacing';

export function ListsScreen({ navigation, route }: ListsStackScreenProps<'ListsMain'>) {
  // headerShown:false — ust guvenli alani ekran kendisi birakmali.
  const topSpacing = useTopSpacing();
  // Tab bar float: alt bosluk 72 + guvenli alan olmadan son ogeler cubugun arkasinda kalir.
  const bottomSpacing = useBottomSpacing();
  const { t } = useTranslation();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Listeler artık cache'ten. Ekrana dönüldüğünde ve herhangi bir ekranda
  // liste değiştiğinde kendiliğinden tazelenir; elle loadLists() zinciri yok.
  const listsQ = useLists();
  const { deleteList } = useListMutations();
  const lists = listsQ.data ?? [];

  // Reload lists when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Check if we should open create modal (from FAB)
      const routeParams = route.params;
      const shouldOpen = routeParams?.openCreateModal || getShouldOpenCreateModalFromFAB();

      let timer: ReturnType<typeof setTimeout> | undefined;
      if (shouldOpen) {
        // Clear the flags
        setShouldOpenCreateModalFromFAB(false);
        navigation.setParams({ openCreateModal: undefined });
        // Open modal after a short delay to ensure lists are loaded
        timer = setTimeout(() => {
          handleCreateList();
        }, 300);
      }

      // Blur/unmount'ta bekleyen timer'ı temizle (sızıntı + stale çağrıyı önler).
      return () => {
        if (timer) clearTimeout(timer);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route.params?.openCreateModal])
  );

  const handleRefresh = () => {
    void listsQ.refetch();
  };

  const handleCreateList = () => {
    setShowCreateModal(true);
  };

  // Oluşturma modalı kendi mutasyonunu çalıştırıyor; burada yalnızca
  // listeyi tazelemek yeterli.
  const handleCreateSuccess = () => {
    void listsQ.refetch();
  };

  const handleDeleteList = async (listId: number) => {
    try {
      await deleteList.mutateAsync(listId);
    } catch {
      Alert.alert(t('common.error'), t('list.delete_error'));
    }
  };

  const renderEmptyState = () => (
    <EmptyState
      icon="playlist-add-check"
      mascot="search"
      title={t('list.empty_title')}
      description={t('list.empty_desc')}
      actionLabel={t('list.create_action')}
      onAction={handleCreateList}
    />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topSpacing }]}>
        <Text style={styles.title}>{t('list.screen_title')}</Text>
        <TouchableOpacity
          style={styles.headerAddButton}
          onPress={handleCreateList}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="add" size={28} color={colors.primary.main} />
        </TouchableOpacity>
      </View>

      <RefreshBar visible={!listsQ.isPending && listsQ.isFetching && !listsQ.isRefetching} />

      {/* Lists */}
      {listsQ.isPending ? (
        <ListSkeleton count={4} />
      ) : listsQ.isError ? (
        <ErrorState onRetry={handleRefresh} />
      ) : (
        <FlatList
          style={styles.list}
          data={lists}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <ListCard
              list={item}
              onPress={() => navigation.navigate('ListDetail', { listId: item.id })}
              onDelete={handleDeleteList}
            />
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomSpacing }]}
          refreshControl={
            <RefreshControl
              refreshing={listsQ.isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.primary.main}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* Create List Modal */}
      <CreateListModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  title: {
    ...typography.styles.h2,
    color: colors.text.primary,
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  headerAddButton: {
    padding: spacing.xs,
  },

  // Kaydırma alanı ekranın kalan yüksekliğine sabitlensin (yoksa uzun listede kırpılır).
  list: {
    flex: 1,
  },

  listContent: {
    padding: layout.screenPadding,
    flexGrow: 1,
  },

});

