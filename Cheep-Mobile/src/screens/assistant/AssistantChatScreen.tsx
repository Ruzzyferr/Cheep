/**
 * ✨ AssistantChatScreen
 * LLM destekli alışveriş asistanı sohbet ekranı
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
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import { assistantService } from '../../services/assistant.service';
import type { ToolCall } from '../../services/assistant.service';
import { MessageBubble } from '../../components/assistant/MessageBubble';
import { ChatInputBar } from '../../components/assistant/ChatInputBar';
import { ToolActivityChip } from '../../components/assistant/ToolActivityChip';
import { ListActionCard } from '../../components/assistant/ListActionCard';
import { useQueryClient } from '@tanstack/react-query';
import { ThreadListSheet } from '../../components/assistant/ThreadListSheet';
import { CheepMascot } from '../../components/brand/CheepMascot';
import { Float } from '../../components/anim';
import { colors, spacing, typography, borderRadius } from '../../theme';
import type { AssistantStackScreenProps } from '../../navigation/types';
import i18n from '../../i18n';
import { usePremium } from '../../context/PremiumContext';
import { useBottomSpacing } from '../../hooks/useScreenSpacing';

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

const LIST_TOOL_NAMES = ['create_list', 'add_items_to_list'];

/**
 * Bir liste aracı çağrısından gerçek liste id'sini çöz:
 * - create_list → oluşturulan liste sonucu içinde `id` döner
 * - add_items_to_list → liste id'si `args.listId` olarak gelir
 */
function resolveListId(call: ToolCall): number | undefined {
  const fromResult = (call.result as { id?: number } | undefined)?.id;
  if (typeof fromResult === 'number') return fromResult;
  const fromArgs = call.args?.listId;
  if (typeof fromArgs === 'number') return fromArgs;
  return undefined;
}

const SUGGESTIONS = [
  i18n.t('assistant.chip_weekly'),
  i18n.t('assistant.chip_budget'),
  i18n.t('assistant.chip_recipe'),
];

// ─── EmptyState Component ───────────────────────────────────
interface EmptyStateProps {
  onSuggestion: (text: string) => void;
}

const EmptyState = ({ onSuggestion }: EmptyStateProps) => (
  <View style={styles.emptyContainer}>
    <View style={styles.assistantIntro}>
      <Float amplitude={5}>
        <CheepMascot size={84} expression="happy" />
      </Float>
      <Text style={styles.assistantTitle}>{i18n.t('assistant.im_cheep')}</Text>
      <Text style={styles.assistantSub}>{i18n.t('assistant.title')}</Text>
    </View>
    <MessageBubble
      role="model"
      content={i18n.t('assistant.greeting')}
    />
    <View style={styles.suggestions}>
      {SUGGESTIONS.map((s) => (
        <TouchableOpacity
          key={s}
          style={styles.suggestionChip}
          onPress={() => onSuggestion(s)}
          activeOpacity={0.75}
        >
          <Text style={styles.suggestionText}>{s}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

// ============================================================
// Screen
// ============================================================

export function AssistantChatScreen({
  navigation,
}: AssistantStackScreenProps<'AssistantChat'>) {
  const qc = useQueryClient();
  const flatListRef = useRef<FlatList<LocalMessage>>(null);

  const [threadId, setThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  // Tavan ve pencere backend'den gelir: ucretsizde 5/gun, premiumda 300/ay.
  // Sabit '/5' yazmak premium kullaniciya '258/5' gibi anlamsiz bir rozet gosteriyordu.
  const [limit, setLimit] = useState<number>(5);
  const [limitWindow, setLimitWindow] = useState<'day' | 'month'>('day');
  const [limitReached, setLimitReached] = useState(false);

  const { isPremium, available: purchasesAvailable } = usePremium();
  // 80 = girdi cubugunun yuksekligi. Sekme disi ekran, tab bar payi eklenmez.
  const bottomSpacing = useBottomSpacing(80);

  // Satın alma tamamlanınca banner kendiliğinden kalkmalı: kullanıcı paywall'dan
  // döndüğünde hâlâ "limitin doldu" görmesi, parasını ödediği şeyin çalışmadığı
  // izlenimi verir.
  useEffect(() => {
    if (isPremium) setLimitReached(false);
  }, [isPremium]);

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
      Alert.alert('Hata', i18n.t('assistant.start_error'));
    }
  };

  // ─── New chat ────────────────────────────────────────────────
  const handleNewChat = useCallback(async () => {
    try {
      const thread = await assistantService.createThread();
      setThreadId(thread.id);
      setMessages([]);
      setInputValue('');
    } catch (err) {
      console.error('Failed to create new thread:', err);
      Alert.alert('Hata', i18n.t('assistant.new_chat_error'));
    }
  }, []);

  // ─── Load thread from history ────────────────────────────────
  const loadThread = useCallback(async (id: number) => {
    try {
      const thread = await assistantService.getThread(id);
      setThreadId(thread.id);
      // Map ChatMessage[] → LocalMessage[]; skip tool/system messages
      const mapped: LocalMessage[] = (thread.messages ?? [])
        .filter((m) => m.role === 'user' || m.role === 'model')
        .map((m) => ({
          id: `hist-${m.id}`,
          role: m.role,
          content: m.content,
        }));
      setMessages(mapped);
      setInputValue('');
    } catch (err) {
      console.error('loadThread error:', err);
      Alert.alert('Hata', i18n.t('assistant.load_error'));
    }
  }, []);

  // ─── Send message ────────────────────────────────────────────
  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? inputValue).trim();
    if (!content || !threadId || sending || limitReached) return;

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

      // Kalan hak + tavan + pencere
      if (typeof res.remaining === 'number') {
        setRemaining(res.remaining);
        if (res.remaining <= 0) setLimitReached(true);
      }
      if (typeof res.limit === 'number') setLimit(res.limit);
      if (res.window) setLimitWindow(res.window);

      const newMsgs: LocalMessage[] = [assistantMsg];

      // Check for list tool calls → show ListActionCard
      if (res.toolCalls && Array.isArray(res.toolCalls)) {
        const listCall = res.toolCalls.find(
          (tc) => tc?.name && LIST_TOOL_NAMES.includes(tc.name)
        );
        if (listCall) {
          // Asistan listeyi DEĞİŞTİRDİ. Sohbet ekranının kendi durumu yeterli
          // değil: kullanıcı "haftalık listeme süt ekle" deyip anasayfaya
          // dönünce eski sayıyı görüyordu. Diğer ekranlarla aradaki tek bağ
          // bu geçersizleştirme.
          void qc.invalidateQueries({ queryKey: ['lists'] });
          const args = listCall.args ?? {};
          const items = args.items;
          const cardMsg: LocalMessage = {
            id: `card-${Date.now()}`,
            role: 'list_card',
            content: '',
            listCard: {
              title:
                (typeof args.name === 'string' && args.name) ||
                (typeof args.list_name === 'string' && args.list_name) ||
                i18n.t('assistant.new_list_fallback'),
              itemCount: Array.isArray(items) ? items.length : undefined,
              // Gerçek liste id'sini araç çağrısından çöz (backend sonuç/args).
              listId: resolveListId(listCall),
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
    } catch (err: any) {
      console.error('sendMessage error:', err);
      if (err?.dailyLimit) {
        // Daily limit hit — show banner, not an error bubble
        setLimitReached(true);
        setRemaining(0);
        setMessages((prev) => prev.filter((m) => m.id !== 'typing'));
      } else {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== 'typing'),
          {
            id: `err-${Date.now()}`,
            role: 'model',
            content: i18n.t('auth.generic_error'),
          },
        ]);
      }
    } finally {
      setSending(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [inputValue, threadId, sending, limitReached]);

  // ─── Suggestion chip press ───────────────────────────────────
  const handleSuggestion = useCallback((text: string) => {
    handleSend(text);
  }, [handleSend]);

  // ─── Render item ─────────────────────────────────────────────
  const renderItem = ({ item }: { item: LocalMessage }) => {
    if (item.role === 'typing') {
      return <ToolActivityChip label={i18n.t('assistant.typing')} />;
    }
    if (item.role === 'list_card' && item.listCard) {
      const cardListId = item.listCard.listId;
      return (
        <ListActionCard
          title={item.listCard.title}
          itemCount={item.listCard.itemCount}
          disabled={cardListId === undefined}
          onPress={() => {
            if (cardListId === undefined) return;
            // Asistan ekranı tab'ların üstündeki bir root-stack route'u olduğundan,
            // hedef listeye Main → Lists → ListDetail olarak iç içe gideriz.
            navigation.dispatch(
              CommonActions.navigate({
                name: 'Main',
                params: {
                  screen: 'Lists',
                  params: {
                    screen: 'ListDetail',
                    params: { listId: cardListId },
                  },
                },
              })
            );
          }}
        />
      );
    }
    return <MessageBubble role={item.role} content={item.content} />;
  };

  // ─── Header buttons ──────────────────────────────────────────
  useEffect(() => {
    navigation.setOptions({
      title: `✨ ${i18n.t('assistant.header_title')}`,
      headerRight: () => (
        <View style={styles.headerButtons}>
          {/* remaining/5 indicator */}
          {remaining !== null && (
            <Text style={styles.remainingBadge}>{remaining}/{limit}</Text>
          )}
          {/* 🕘 History — opens ThreadListSheet */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setHistoryVisible(true)}
            accessibilityLabel={i18n.t('assistant.history')}
          >
            <MaterialIcons name="history" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          {/* ✎ New chat */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleNewChat}
            accessibilityLabel={i18n.t('assistant.new_chat')}
          >
            <MaterialIcons name="edit" size={22} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, handleNewChat, remaining, limit]);

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
          { paddingBottom: bottomSpacing },
        ]}
        ListEmptyComponent={<EmptyState onSuggestion={handleSuggestion} />}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
      />
      {limitReached && (
        <View style={styles.limitBanner}>
          <Text style={styles.limitBannerText}>
            {isPremium
              ? i18n.t(limitWindow === 'day' ? 'assistant.limit_premium_day' : 'assistant.limit_premium_month', { limit })
              : i18n.t('assistant.limit_free', { limit })}{' '}
          </Text>
          {/* Premium kullaniciya paywall gosterilmez: zaten odedi, yapabilecegi
              bir sey yok. Satin alma hic mumkun degilse de gosterilmez —
              olmayan bir cikis yolu sunmak kullaniciyi bosuna ugrastirir. */}
          {!isPremium && purchasesAvailable && (
            <Pressable
              onPress={() => navigation.navigate('Paywall' as never)}
              accessibilityRole="button"
            >
              <Text style={styles.limitBannerLink}>{i18n.t('assistant.go_premium')}</Text>
            </Pressable>
          )}
        </View>
      )}
      <ChatInputBar
        value={inputValue}
        onChangeText={setInputValue}
        onSend={() => handleSend()}
        sending={sending}
        disabled={limitReached}
      />

      <ThreadListSheet
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
        onSelectThread={loadThread}
        onNewChat={handleNewChat}
        activeThreadId={threadId}
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
  assistantIntro: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  assistantTitle: {
    ...typography.styles.h3,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  assistantSub: {
    ...typography.styles.body2,
    color: colors.text.secondary,
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
  remainingBadge: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    fontWeight: '600',
    paddingHorizontal: spacing.xs,
  },
  limitBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: colors.primary['50'],
    borderTopWidth: 1,
    borderTopColor: colors.primary['200'],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  limitBannerText: {
    ...typography.styles.body2,
    color: colors.text.secondary,
  },
  limitBannerLink: {
    ...typography.styles.body2,
    color: colors.primary.dark,
    fontWeight: '600',
  },
});
