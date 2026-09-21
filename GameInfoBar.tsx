import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Player, Role } from '@/context/GameContext';

const ROLE_COLORS: Record<Role, string> = {
  '大富豪': '#D4A017',
  '富豪': '#C0C0C0',
  '平民': '#7FB3D3',
  '貧民': '#A9A9A9',
  '大貧民': '#CD5C5C',
};

interface PlayerBadgeProps {
  player: Player;
  isActive: boolean;
  cardCount: number;
  position: 'top' | 'left' | 'right' | 'bottom';
}

export function PlayerBadge({ player, isActive, cardCount, position }: PlayerBadgeProps) {
  const colors = useColors();
  const isFinished = player.finishOrder !== null;

  return (
    <View style={[
      styles.badge,
      {
        backgroundColor: isActive ? colors.gold : 'rgba(0,0,0,0.45)',
        borderColor: isActive ? colors.goldLight : 'rgba(255,255,255,0.1)',
        borderWidth: isActive ? 2 : 1,
      },
    ]}>
      {isFinished && player.role ? (
        <Text style={[styles.roleBadge, { color: ROLE_COLORS[player.role] }]}>
          {player.role}
        </Text>
      ) : null}
      <Text style={[
        styles.badgeName,
        { color: isActive ? colors.primaryForeground : colors.foreground },
      ]} numberOfLines={1}>
        {player.name}
      </Text>
      {!isFinished && (
        <Text style={[styles.cardCount, { color: isActive ? colors.primaryForeground : colors.mutedForeground }]}>
          {cardCount}枚
        </Text>
      )}
      {isFinished && (
        <Text style={[styles.finishText, { color: ROLE_COLORS[player.role ?? '平民'] }]}>
          {player.finishOrder}位
        </Text>
      )}
    </View>
  );
}

interface GameInfoBarProps {
  currentPlayer: Player;
  isMyTurn: boolean;
}

export default function GameInfoBar({ currentPlayer, isMyTurn }: GameInfoBarProps) {
  const colors = useColors();

  return (
    <View style={[styles.bar, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
      <Text style={[styles.turnText, { color: colors.foreground }]}>
        {isMyTurn ? '🟢 あなたのターン' : `${currentPlayer.name}のターン`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 20,
  },
  turnText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 70,
    gap: 2,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  cardCount: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  finishText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  roleBadge: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
});
