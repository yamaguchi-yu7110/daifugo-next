import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/context/GameContext';
import { useOnline } from '@/context/OnlineContext';
import PlayingCard from '@/components/PlayingCard';
import FieldArea from '@/components/FieldArea';
import { PlayerBadge } from '@/components/GameInfoBar';
import * as Haptics from 'expo-haptics';
import { getPlayType, isValidPlay, RANK_LABELS } from '@/utils/gameEngine';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function GameScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    state, toggleCard, clearSelection, playCards, pass, cpuTakeTurn,
    resolvePendingCards, resolveQBombe, skipPending,
    resetToMenu,
  } = useGame();
  const cpuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    players, currentPlayerIndex, fieldCards, revolution, jBack, suitShibari, stairShibari,
    message, selectedCardIds, phase, mode, finishOrder,
    pendingEffect,
  } = state;
  const { room } = useOnline();
  const [pendingCardIds, setPendingCardIds] = useState<string[]>([]);
  const [pendingRanks, setPendingRanks] = useState<number[]>([]);

  const humanPlayerIdx = mode === 'cpu' ? 0 : state.localPlayerIndex;
  const humanPlayer = players[humanPlayerIdx];
  const currentPlayer = players[currentPlayerIndex];
  const isMyTurn = currentPlayerIndex === humanPlayerIdx && phase === 'playing';

  // Auto-play for CPU turns
  useEffect(() => {
    if (mode !== 'cpu' || phase !== 'playing' || !currentPlayer?.isCPU) return;

    cpuTimerRef.current = setTimeout(() => {
      cpuTakeTurn();
    }, 900);

    return () => {
      if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current);
    };
  }, [state, cpuTakeTurn]);

  useEffect(() => {
    setPendingCardIds([]);
    setPendingRanks([]);
  }, [pendingEffect?.type, pendingEffect?.count]);

  // Navigate to result when game ends
  useEffect(() => {
    if (phase === 'gameEnd') {
      setTimeout(() => router.replace('/result'), 1200);
    }
  }, [phase]);

  // Validation for selected cards
  const selectedCards = humanPlayer?.hand.filter(c => selectedCardIds.has(c.id)) ?? [];
  const canPlay = selectedCards.length > 0 &&
    getPlayType(selectedCards) !== 'invalid' &&
    isValidPlay(selectedCards, fieldCards, revolution !== jBack, suitShibari, stairShibari);

  const canPass = !!fieldCards && fieldCards.length > 0;

  const handleToggleCard = (cardId: string) => {
    if (!isMyTurn) return;
    Haptics.selectionAsync();
    toggleCard(cardId);
  };

  const handlePlay = () => {
    if (!canPlay) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playCards();
  };

  const handlePass = () => {
    if (!isMyTurn) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pass();
  };

  const handleExit = () => {
    resetToMenu();
    router.replace('/');
  };

  const togglePendingCard = (cardId: string) => {
    setPendingCardIds(current => current.includes(cardId)
      ? current.filter(id => id !== cardId)
      : pendingEffect && current.length < pendingEffect.count
        ? [...current, cardId]
        : current
    );
  };

  const togglePendingRank = (rank: number) => {
    setPendingRanks(current => current.includes(rank)
      ? current.filter(value => value !== rank)
      : pendingEffect && current.length < pendingEffect.count
        ? [...current, rank]
        : current
    );
  };

  // Layout for CPU mode: Player at top, sides, and bottom
  // Players: 0=human(bottom), 1=CPU(left), 2=CPU(top), 3=CPU(right)
  const topPlayer = mode === 'cpu' ? players[2] : null;
  const leftPlayer = mode === 'cpu' ? players[1] : null;
  const rightPlayer = mode === 'cpu' ? players[3] : null;

  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomInset = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  // ---- CARD EFFECT SELECTION ----
  // CPU effects are resolved automatically by the reducer; this panel is for human turns.
  const pendingBelongsToMe = !!pendingEffect && pendingEffect.sourcePlayerIndex === humanPlayerIdx;
  if (pendingEffect && pendingBelongsToMe && !currentPlayer?.isCPU) {
    const pendingCards = humanPlayer?.hand ?? [];
    const isQBomber = pendingEffect.type === 'qBomber';
    const rankChoices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 0];
    const ready = isQBomber
      ? pendingRanks.length === pendingEffect.count
      : pendingCardIds.length === pendingEffect.count;
    return (
      <View style={[styles.container, { backgroundColor: colors.felt, paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={styles.effectPanel}>
          <Text style={[styles.effectPanelTitle, { color: colors.gold }]}>
            {pendingEffect.type === 'seven' ? '7渡し' : pendingEffect.type === 'ten' ? '10捨て' : 'Qボンバー'}
          </Text>
          <Text style={[styles.effectPanelDescription, { color: colors.foreground }]}>
            {pendingEffect.type === 'seven'
              ? `${players[pendingEffect.targetPlayerIndex]?.name}へ${pendingEffect.count}枚渡します`
              : pendingEffect.type === 'ten'
                ? `${pendingEffect.count}枚選んで捨ててください`
                : `捨てるランクを${pendingEffect.count}種類選んでください`}
          </Text>
          {isQBomber ? (
            <View style={styles.rankChoiceGrid}>
              {rankChoices.map(rank => (
                <TouchableOpacity
                  key={rank}
                  onPress={() => togglePendingRank(rank)}
                  style={[
                    styles.rankChoice,
                    { borderColor: pendingRanks.includes(rank) ? colors.gold : colors.border,
                      backgroundColor: pendingRanks.includes(rank) ? 'rgba(212,160,23,0.3)' : 'rgba(0,0,0,0.25)' },
                  ]}
                >
                  <Text style={{ color: colors.foreground, fontWeight: '700' as const }}>
                    {rank === 0 ? 'JK' : RANK_LABELS[rank]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.effectHandScroll}
              contentContainerStyle={styles.effectHandContent}
            >
              {pendingCards.map(card => (
                <View key={card.id} style={styles.effectHandCard}>
                  <PlayingCard
                    card={card}
                    size="md"
                    selected={pendingCardIds.includes(card.id)}
                    onPress={() => togglePendingCard(card.id)}
                  />
                </View>
              ))}
            </ScrollView>
          )}
          <Text style={[styles.effectCount, { color: colors.mutedForeground }]}>
            {isQBomber ? pendingRanks.length : pendingCardIds.length} / {pendingEffect.count}
          </Text>
          <View style={styles.effectActions}>
            {(pendingEffect.type === 'seven' || pendingEffect.type === 'ten') && (
              <TouchableOpacity
                style={[styles.effectSkipButton, { borderColor: colors.border }]}
                onPress={skipPending}
              >
                <Text style={{ color: colors.mutedForeground, fontWeight: '700' as const }}>スキップ</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.effectConfirmButton, { backgroundColor: ready ? colors.gold : colors.disabled }]}
              disabled={!ready}
              onPress={() => isQBomber ? resolveQBombe(pendingRanks) : resolvePendingCards(pendingCardIds)}
            >
              <Text style={{ color: ready ? colors.primaryForeground : colors.mutedForeground, fontWeight: '700' as const }}>
                決定
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (mode === 'online') {
    return (
      <View style={[styles.container, { backgroundColor: colors.felt, paddingTop: topInset }]}>
        <View style={styles.onlineHeader}>
          <View>
            <Text style={[styles.onlineTitle, { color: colors.gold }]}>オンライン対戦</Text>
            <Text style={[styles.onlineRoomCode, { color: colors.mutedForeground }]}>
              ルーム {room?.code ?? '------'}
            </Text>
          </View>
           <TouchableOpacity style={styles.menuBtn} onPress={handleExit}>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>退場</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.onlinePlayers}>
          {players.map((player, index) => (
            <View
              key={player.id}
              style={[
                styles.onlinePlayer,
                {
                  borderColor: index === currentPlayerIndex ? colors.gold : colors.border,
                  backgroundColor: index === state.localPlayerIndex
                    ? 'rgba(212,160,23,0.14)'
                    : 'rgba(0,0,0,0.28)',
                },
              ]}
            >
              <Text style={[styles.onlinePlayerName, { color: colors.foreground }]} numberOfLines={1}>
                {player.name}{index === state.localPlayerIndex ? '（あなた）' : ''}
              </Text>
              <Text style={[styles.onlinePlayerCount, { color: colors.mutedForeground }]}>
                {player.hand.length}枚{index === currentPlayerIndex ? ' • ターン' : ''}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.onlineField}>
          <FieldArea
            fieldCards={fieldCards}
            revolution={revolution !== jBack}
            suitShibari={suitShibari}
            stairShibari={stairShibari}
            message={message || (!isMyTurn ? `${currentPlayer?.name ?? '相手'}のターンです` : '')}
          />
        </View>

        <View style={[styles.onlineHandArea, { paddingBottom: bottomInset + 8 }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.handScroll}
          >
            {(humanPlayer?.hand ?? []).map((card, i) => (
              <View key={card.id} style={[styles.handCard, { marginLeft: i === 0 ? 0 : -16 }]}>
                <PlayingCard
                  card={card}
                  selected={selectedCardIds.has(card.id)}
                  onPress={() => handleToggleCard(card.id)}
                  size="lg"
                  disabled={!isMyTurn}
                />
              </View>
            ))}
          </ScrollView>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, {
                backgroundColor: (isMyTurn && canPass) ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                borderColor: (isMyTurn && canPass) ? colors.foreground : colors.disabled,
                opacity: (isMyTurn && canPass) ? 1 : 0.4,
              }]}
              onPress={handlePass}
              disabled={!isMyTurn || !canPass}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionBtnText, { color: colors.foreground }]}>パス</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, {
                backgroundColor: (isMyTurn && canPlay) ? colors.gold : colors.disabled,
                flex: 2,
                opacity: (isMyTurn && canPlay) ? 1 : 0.4,
              }]}
              onPress={handlePlay}
              disabled={!isMyTurn || !canPlay}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, { color: (isMyTurn && canPlay) ? colors.primaryForeground : colors.mutedForeground }]}>
                {selectedCards.length > 0 ? `${selectedCards.length}枚出す` : '出す'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ---- CPU MODE GAME SCREEN ----
  return (
    <View style={[styles.container, { backgroundColor: colors.felt }]}>
      {/* Top area: CPU2 (top center) */}
      <View style={[styles.topArea, { paddingTop: topInset + 4 }]}>
         <TouchableOpacity style={styles.menuBtnTop} onPress={handleExit}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>退場</Text>
        </TouchableOpacity>

        {/* CPU2 (top center) */}
        {topPlayer && (
          <View style={styles.cpuTopSection}>
            <PlayerBadge
              player={topPlayer}
              isActive={currentPlayerIndex === 2}
              cardCount={topPlayer.hand.length}
              position="top"
            />
            <View style={styles.cpuTopCards}>
              {Array.from({ length: Math.min(topPlayer.hand.length, 8) }).map((_, i) => (
                <View key={i} style={{ marginLeft: i === 0 ? 0 : -12 }}>
                  <PlayingCard faceDown size="sm" />
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Middle row: CPU1 left, Field, CPU3 right */}
      <View style={styles.middleRow}>
        {/* CPU1 left */}
        {leftPlayer && (
          <View style={styles.cpuSideSection}>
            <PlayerBadge
              player={leftPlayer}
              isActive={currentPlayerIndex === 1}
              cardCount={leftPlayer.hand.length}
              position="left"
            />
            <View style={styles.cpuSideCards}>
              {Array.from({ length: Math.min(leftPlayer.hand.length, 5) }).map((_, i) => (
                <View key={i} style={{ marginTop: i === 0 ? 0 : -18 }}>
                  <PlayingCard faceDown size="sm" />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Field area */}
        <View style={styles.fieldArea}>
          <FieldArea
            fieldCards={fieldCards}
            revolution={revolution !== jBack}
            suitShibari={suitShibari}
            stairShibari={stairShibari}
            message={message}
          />
        </View>

        {/* CPU3 right */}
        {rightPlayer && (
          <View style={styles.cpuSideSection}>
            <PlayerBadge
              player={rightPlayer}
              isActive={currentPlayerIndex === 3}
              cardCount={rightPlayer.hand.length}
              position="right"
            />
            <View style={styles.cpuSideCards}>
              {Array.from({ length: Math.min(rightPlayer.hand.length, 5) }).map((_, i) => (
                <View key={i} style={{ marginTop: i === 0 ? 0 : -18 }}>
                  <PlayingCard faceDown size="sm" />
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Human player area */}
      <View style={[styles.humanArea, { paddingBottom: bottomInset + 4 }]}>
        {/* Player info + turn indicator */}
        <View style={styles.humanHeader}>
          <PlayerBadge
            player={players[0]}
            isActive={isMyTurn}
            cardCount={players[0]?.hand.length ?? 0}
            position="bottom"
          />
          {!isMyTurn && currentPlayer?.isCPU && (
            <View style={[styles.thinkingPill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
              <Text style={[styles.thinkingText, { color: colors.mutedForeground }]}>考え中...</Text>
            </View>
          )}
        </View>

        {/* Hand */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.handScroll}
        >
          {(players[0]?.hand ?? []).map((card, i) => (
            <View key={card.id} style={[styles.handCard, { marginLeft: i === 0 ? 0 : -18 }]}>
              <PlayingCard
                card={card}
                selected={selectedCardIds.has(card.id)}
                onPress={() => handleToggleCard(card.id)}
                size="md"
                disabled={!isMyTurn}
              />
            </View>
          ))}
        </ScrollView>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {selectedCardIds.size > 0 && (
            <TouchableOpacity
              style={[styles.clearBtn, { borderColor: colors.border }]}
              onPress={() => clearSelection()}
              activeOpacity={0.7}
            >
              <Text style={[styles.clearBtnText, { color: colors.mutedForeground }]}>選択解除</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, {
              backgroundColor: (isMyTurn && canPass) ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
              borderColor: (isMyTurn && canPass) ? colors.foreground : colors.disabled,
              opacity: (isMyTurn && canPass) ? 1 : 0.4,
            }]}
            onPress={handlePass}
            disabled={!isMyTurn || !canPass}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionBtnText, { color: colors.foreground }]}>パス</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, {
              backgroundColor: (isMyTurn && canPlay) ? colors.gold : colors.disabled,
              flex: 2,
              opacity: (isMyTurn && canPlay) ? 1 : 0.4,
            }]}
            onPress={handlePlay}
            disabled={!isMyTurn || !canPlay}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionBtnText, { color: (isMyTurn && canPlay) ? colors.primaryForeground : colors.mutedForeground }]}>
              {selectedCards.length > 0 ? `${selectedCards.length}枚出す` : '出す'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topArea: {
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 6,
    zIndex: 10,
  },
  menuBtnTop: {
    position: 'absolute',
    right: 16,
    top: 10,
    padding: 6,
  },
  menuBtn: {
    position: 'absolute',
    right: 16,
    top: 10,
    padding: 6,
  },
  cpuTopSection: {
    alignItems: 'center',
    gap: 4,
  },
  cpuTopCards: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  middleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 4,
  },
  cpuSideSection: {
    alignItems: 'center',
    gap: 4,
    width: 80,
  },
  cpuSideCards: {
    alignItems: 'center',
  },
  fieldArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  humanArea: {
    paddingHorizontal: 8,
    gap: 6,
  },
  humanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  thinkingPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  thinkingText: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  handScroll: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    alignItems: 'center',
  },
  handCard: {
    zIndex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  clearBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  onlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  onlineTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  onlineRoomCode: {
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 1,
  },
  onlinePlayers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
  },
  onlinePlayer: {
    flex: 1,
    minWidth: '46%',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  onlinePlayerName: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  onlinePlayerCount: {
    fontSize: 11,
    marginTop: 2,
  },
  onlineField: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  onlineHandArea: {
    gap: 8,
    paddingHorizontal: 4,
  },
  effectPanel: {
    flex: 1,
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 14,
  },
  effectPanelTitle: {
    fontSize: 30,
    fontWeight: '800' as const,
  },
  effectPanelDescription: {
    fontSize: 16,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  effectHandScroll: {
    width: '100%',
  },
  effectHandContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
  },
  effectHandCard: {
    marginHorizontal: 0,
  },
  rankChoiceGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  rankChoice: {
    width: 52,
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  effectCount: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  effectActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  effectSkipButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  effectConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
});
