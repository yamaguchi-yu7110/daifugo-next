import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/context/GameContext';
import * as Haptics from 'expo-haptics';

const ROLE_COLORS: Record<string, string> = {
  '大富豪': '#D4A017',
  '富豪': '#C0C0C0',
  '平民': '#7FB3D3',
  '貧民': '#A9A9A9',
  '大貧民': '#CD5C5C',
};

const ROLE_ICONS: Record<string, string> = {
  '大富豪': '👑',
  '富豪': '🥈',
  '平民': '🙂',
  '貧民': '😔',
  '大貧民': '💀',
};

export default function ResultScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, newGame, resetToMenu } = useGame();
  const { players, finishOrder } = state;

  const rankedPlayers = finishOrder.map((idx, rank) => ({
    player: players[idx],
    rank: rank + 1,
  }));

  const handlePlayAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (state.mode === 'online') {
      resetToMenu();
      router.replace('/');
      return;
    }
    newGame();
    router.replace('/game');
  };

  const handleMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetToMenu();
    router.replace('/');
  };

  const winner = rankedPlayers[0];

  return (
    <View style={[styles.container, { backgroundColor: colors.felt }]}>
      {/* Background decorations */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.bgCircle, { backgroundColor: colors.gold, opacity: 0.05, top: -80, left: -80 }]} />
        <View style={[styles.bgCircle, { backgroundColor: colors.gold, opacity: 0.05, bottom: -100, right: -100, width: 300, height: 300 }]} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 24),
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 24),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>結果発表</Text>

        {/* Winner highlight */}
        {winner && (
          <View style={[styles.winnerCard, { backgroundColor: 'rgba(212,160,23,0.15)', borderColor: colors.gold }]}>
            <Text style={styles.winnerIcon}>👑</Text>
            <Text style={[styles.winnerName, { color: colors.gold }]}>
              {winner.player?.name}
            </Text>
            <Text style={[styles.winnerRole, { color: colors.goldLight }]}>大富豪</Text>
          </View>
        )}

        {/* All rankings */}
        <View style={styles.rankList}>
          {rankedPlayers.map(({ player, rank }) => {
            if (!player) return null;
            const role = player.role ?? '平民';
            const roleColor = ROLE_COLORS[role] ?? colors.foreground;
            const icon = ROLE_ICONS[role] ?? '🙂';
            const isFirst = rank === 1;

            return (
              <View
                key={player.id}
                style={[
                  styles.rankRow,
                  {
                    backgroundColor: isFirst
                      ? 'rgba(212,160,23,0.12)'
                      : 'rgba(0,0,0,0.3)',
                    borderColor: isFirst ? colors.gold : 'rgba(255,255,255,0.08)',
                    borderWidth: isFirst ? 1.5 : 1,
                  },
                ]}
              >
                <Text style={[styles.rankNum, { color: isFirst ? colors.gold : colors.mutedForeground }]}>
                  {rank}位
                </Text>
                <Text style={styles.rankIcon}>{icon}</Text>
                <View style={styles.rankInfo}>
                  <Text style={[styles.rankName, { color: colors.foreground }]}>{player.name}</Text>
                  {player.isCPU && (
                    <Text style={[styles.cpuLabel, { color: colors.mutedForeground }]}>CPU</Text>
                  )}
                </View>
                <View style={[styles.rolePill, { backgroundColor: `${roleColor}25`, borderColor: roleColor }]}>
                  <Text style={[styles.roleText, { color: roleColor }]}>{role}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Rule note */}
        <View style={[styles.exchangeNote, { backgroundColor: 'rgba(0,0,0,0.3)', borderColor: colors.border }]}>
          <Text style={[styles.exchangeTitle, { color: colors.gold }]}>次ゲーム</Text>
          <Text style={[styles.exchangeDesc, { color: colors.mutedForeground }]}>
            カード交換はありません
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.gold }]}
            onPress={handlePlayAgain}
            activeOpacity={0.85}
          >
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
              {state.mode === 'online' ? 'ルームを退出' : 'もう一度プレイ'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: colors.border, borderWidth: 1 }]}
            onPress={handleMenu}
            activeOpacity={0.85}
          >
            <Text style={[styles.btnText, { color: colors.foreground }]}>メニューに戻る</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgCircle: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: 4,
  },
  winnerCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 2,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  winnerIcon: {
    fontSize: 48,
  },
  winnerName: {
    fontSize: 28,
    fontWeight: '700' as const,
  },
  winnerRole: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: 2,
  },
  rankList: {
    width: '100%',
    gap: 8,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  rankNum: {
    fontSize: 14,
    fontWeight: '700' as const,
    width: 28,
    textAlign: 'center',
  },
  rankIcon: {
    fontSize: 24,
  },
  rankInfo: {
    flex: 1,
    gap: 2,
  },
  rankName: {
    fontSize: 17,
    fontWeight: '600' as const,
  },
  cpuLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  exchangeNote: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  exchangeTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  exchangeDesc: {
    fontSize: 13,
    fontWeight: '400' as const,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttons: {
    width: '100%',
    gap: 10,
  },
  btn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
});
