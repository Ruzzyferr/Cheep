/**
 * ✨ AssistantChatScreen
 * Gemini-powered shopping assistant chat interface
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { assistantService } from '../../services/assistant.service';
import type { ChatMessage } from '../../services/assistant.service';
import { MessageBubble } from '../../components/assistant/MessageBubble';
import { ChatInputBar } from '../../components/assistant/ChatInputBar';
import { ToolActivityChip } from '../../components/assistant/ToolActivityChip';
import { ListActionCard } from '../../components/assistant/ListActionCard';
import { colors, spacing, typography, borderRadius, layout } from '../../theme';
import { shadows } from '../../theme/shadows';
import type { AssistantStackScreenProps } from '../../navigation/types';

// ============================================================
// Types
// ============================================================

interface LocalMessage {
  id: string;
  role: string;       // 'user' | 'model' | 'typing' | 'list_card'
  content: string;
  listCard?: {
    title: string;
    itemCount?: number;
    listId?: number;
  };
}

const LIST_TOOL_NAMES = ['create_list', 'add_items_to_list', 'add_item_to_list'];

const SUGGESTIONS = [
  'Haftalık liste hazırla',
  'Bütçeme göre sepet oluştur',
  'Hızlı kahvaltı tarifi ver',
];

// ============================================================
// Screen
// ============================================================

export function AssistantChatScreen({
  navigation,
}: AssistantStackScreenProps<'AssistantChat'>) {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<LocalMessage>>(null);

  const [threadId, setThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);

  // ─── Init: create thread on mount ───────────────────────────
  useEffect(() => {
    initThread();
  }, []);

  const initThread = async () => {
    try {
      const thread = await assistantService.createThread();
      setThreadId(thread.id);
    } catch (err) {
      console.error('Failed to create thread:', err);
      Alert.alert('Hata', 'Asistan başlatılamadı. Lütfen tekrar deneyin.');
    }
  };

  // ─── New chat ────────────────────────────────────────────────
  const handleNewChat = async () => {
    try {
      const thread = await assistantService.createThread();
      setThreadId(thread.id);
      setMessages([]);
      setInputValue('');
    } catch (err) {
      console.error('Failed to create new thread:', err);
      Alert.alert('Hata', 'Yeni sohbet başlatılamadı.');
    }
  };

  // ─── Send message ────────────────────────────────────────────
  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? inputValue).trim();
    if (!content || !threadId || sending) return;

    const userMsg: LocalMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };

    const typingMsg: LocalMessage = {
      id: 'typing',
      role: 'typing',
      content: '',
    };

    setMessages((prev) => [...prev, userMsg, typingMsg]);
    setInputValue('');
    setSending(true);

    // Scroll to bottom after adding user message
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await assistantService.sendMessage(threadId, content);

      // Build assistant message(s)
      const assistantMsg: LocalMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        content: res.message,
      };

      const newMsgs: LocalMessage[] = [assistantMsg];

      // Check for list tool calls → show ListActionCard
      if (res.toolCalls && Array.isArray(res.toolCalls)) {
        const listCall = res.toolCalls.find(
          (tc: any) => tc?.name && LIST_TOOL_NAMES.includes(tc.name)
        );
        if (listCall) {
          const args = listCall.args ?? listCall.input ?? {};
          const cardMsg: LocalMessage = {
            id: `card-${Date.now()}`,
            role: 'list_card',
            content: '',
            listCard: {
              title: args.name ?? args.list_name ?? 'Yeni Liste',
              itemCount: args.items ? args.items.length : undefined,
              listId: undefined, // resolved after server returns the list id; TODO Task 9/10
            },
          };
          newMsgs.push(cardMsg);
        }
      }

      setMessages((prev) => [
        // remove typing indicator
        ...prev.filter((m) => m.id !== 'typing'),
        ...newMsgs,
      ]);
    } catch (err) {
      console.error('sendMessage error:', err);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== 'typing'),
        {
          id: `err-${Date.now()}`,
          role: 'model',
          content: 'Bir hata oluştu. Lütfen tekrar deneyin.',
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [inputValue, threadId, sending]);

  // ─── Suggestion chip press ───────────────────────────────────
  const handleSuggestion = (text: string) => {
    setInputValue(text);
    handleSend(text);
  };

  // ─── Render item ─────────────────────────────────────────────
  const renderItem = ({ item }: { item: LocalMessage }) => {
    if (item.role === 'typing') {
      return <ToolActivityChip label="yazıyor..." />;
    }
    if (item.role === 'list_card' && item.listCard) {
      return (
        <ListActionCard
          title={item.listCard.title}
          itemCount={item.listCard.itemCount}
          onPress={() => {
            // TODO Task 9/10: navigate to ListDetail when listId is available
          }}
        />
      );
    }
    return <MessageBubble role={item.role} content={item.content} />;
  };

  // ─── Empty state ─────────────────────────────────────────────
  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <MessageBubble
        role="model"
        content="Merhaba! Bugün ne pişirelim? Tarif yaz ya da 'haftalık liste hazırla' de."
      />
      <View style={styles.suggestions}>
        {SUGGESTIONS.map((s) => (
          <TouchableOpacity
            key={s}
            style={styles.suggestionChip}
            onPress={() => handleSuggestion(s)}
            activeOpacity={0.75}
          >
            <Text style={styles.suggestionText}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ─── Header buttons ──────────────────────────────────────────
  useEffect(() => {
    navigation.setOptions({
      title: '✨ Asistan',
      headerRight: () => (
        <View style={styles.headerButtons}>
          {/* 🕘 History — TODO Task 9: open ThreadListSheet */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => {
              // TODO Task 9: open ThreadListSheet bottom sheet
            }}
            accessibilityLabel="Geçmiş sohbetler"
          >
            <MaterialIcons name="history" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          {/* ✎ New chat */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleNewChat}
            accessibilityLabel="Yeni sohbet"
          >
            <MaterialIcons name="edit" size={22} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, handleNewChat]);

  // ─── Render ──────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
        ListEmptyComponent={<EmptyState />}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
      />
      <ChatInputBar
        value={inputValue}
        onChangeText={setInputValue}
        onSend={() => handleSend()}
        sending={sending}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  listContent: {
    paddingTop: spacing.md,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    paddingTop: spacing.xl,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  suggestionChip: {
    backgroundColor: colors.primary['50'],
    borderWidth: 1,
    borderColor: colors.primary['200'],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  suggestionText: {
    ...typography.styles.body2,
    color: colors.primary.dark,
    fontWeight: '500',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
    gap: spacing.xs,
  },
  headerButton: {
    padding: spacing.xs,
  },
});
