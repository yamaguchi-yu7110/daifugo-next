import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Card, SUIT_SYMBOLS, RANK_LABELS } from '@/utils/gameEngine';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const SIZES = {
  sm: { width: 36, height: 52, fontSize: 11, suitSize: 12 },
  md: { width: 52, height: 74, fontSize: 14, suitSize: 16 },
  lg: { width: 68, height: 96, fontSize: 18, suitSize: 20 },
};

export default function PlayingCard({
  card,
  faceDown = false,
  selected = false,
  onPress,
  size = 'md',
  disabled = false,
}: PlayingCardProps) {
  const colors = useColors();
  const dims = SIZES[size];

  const isRed = card && !card.isJoker && (card.suit === 'heart' || card.suit === 'diamond');
  const isJoker = card?.isJoker;

  const cardStyle = [
    styles.card,
    {
      width: dims.width,
      height: dims.height,
      borderRadius: colors.radius * 0.6,
      backgroundColor: faceDown ? colors.secondary : colors.cardWhite,
      borderColor: selected ? colors.gold : (faceDown ? colors.border : '#CCC'),
      borderWidth: selected ? 2.5 : 1,
      transform: selected ? [{ translateY: -10 }] : [],
      shadowColor: selected ? colors.gold : '#000',
      shadowOpacity: selected ? 0.6 : 0.2,
      shadowRadius: selected ? 8 : 3,
      shadowOffset: { width: 0, height: selected ? 4 : 2 },
      elevation: selected ? 8 : 2,
    },
  ];

  const rankColor = isJoker ? '#6B3EC2' : (isRed ? colors.cardRed : colors.cardBlack);
  const rankLabel = card ? RANK_LABELS[card.rank] : '';
  const suitSymbol = card ? SUIT_SYMBOLS[card.suit] : '';

  if (faceDown) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={onPress ? 0.8 : 1}
        disabled={!onPress || disabled}
      >
        <View style={[styles.backPattern, { borderRadius: colors.radius * 0.5 }]}>
          <Text style={[styles.backText, { fontSize: dims.suitSize }]}>♠♥</Text>
          <Text style={[styles.backText, { fontSize: dims.suitSize }]}>♦♣</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (!card) return <View style={[cardStyle, { backgroundColor: 'transparent', borderStyle: 'dashed' }]} />;

  return (
    <TouchableOpacity
      style={cardStyle}
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      disabled={!onPress || disabled}
    >
      {isJoker ? (
        <View style={styles.jokerContainer}>
          <Text style={[styles.jokerStar, { fontSize: dims.fontSize * 1.5, color: '#6B3EC2' }]}>★</Text>
          <Text style={[styles.jokerLabel, { fontSize: dims.fontSize * 0.6, color: '#6B3EC2' }]}>JOKER</Text>
        </View>
      ) : (
        <>
          {/* Top-left corner */}
          <View style={styles.cornerTop}>
            <Text style={[styles.rankText, { fontSize: dims.fontSize, color: rankColor, lineHeight: dims.fontSize * 1.1 }]}>
              {rankLabel}
            </Text>
            <Text style={[styles.suitText, { fontSize: dims.suitSize * 0.75, color: rankColor }]}>
              {suitSymbol}
            </Text>
          </View>
          {/* Center suit */}
          <Text style={[styles.centerSuit, { fontSize: dims.suitSize * 1.3, color: rankColor }]}>
            {suitSymbol}
          </Text>
          {/* Bottom-right corner (rotated) */}
          <View style={[styles.cornerBottom, { transform: [{ rotate: '180deg' }] }]}>
            <Text style={[styles.rankText, { fontSize: dims.fontSize, color: rankColor, lineHeight: dims.fontSize * 1.1 }]}>
              {rankLabel}
            </Text>
            <Text style={[styles.suitText, { fontSize: dims.suitSize * 0.75, color: rankColor }]}>
              {suitSymbol}
            </Text>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FEFEFE',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  cornerTop: {
    position: 'absolute',
    top: 3,
    left: 4,
    alignItems: 'center',
  },
  cornerBottom: {
    position: 'absolute',
    bottom: 3,
    right: 4,
    alignItems: 'center',
  },
  rankText: {
    fontWeight: '700' as const,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-medium',
  },
  suitText: {
    fontWeight: '400' as const,
  },
  centerSuit: {
    fontWeight: '400' as const,
  },
  jokerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  jokerStar: {
    fontWeight: '700' as const,
  },
  jokerLabel: {
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  backPattern: {
    flex: 1,
    width: '100%',
    backgroundColor: '#1A5276',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  backText: {
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '400' as const,
  },
});
