import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Card, Suit, SUIT_SYMBOLS } from '@/utils/gameEngine';
import PlayingCard from './PlayingCard';

interface FieldAreaProps {
  fieldCards: Card[] | null;
  revolution: boolean;
  suitShibari: Suit | null;
  stairShibari: boolean;
  message: string;
}

export default function FieldArea({ fieldCards, revolution, suitShibari, stairShibari, message }: FieldAreaProps) {
  const colors = useColors();

  const hasEffects = revolution || suitShibari || stairShibari;

  return (
    <View style={styles.container}>
      {/* Effects row */}
      {hasEffects && (
        <View style={styles.effectsRow}>
          {revolution && (
            <View style={[styles.effectBadge, { backgroundColor: colors.revolution }]}>
              <Text style={styles.effectText}>🔄 革命中</Text>
            </View>
          )}
          {suitShibari && (
            <View style={[styles.effectBadge, { backgroundColor: colors.shibari }]}>
              <Text style={styles.effectText}>{SUIT_SYMBOLS[suitShibari]} スート縛り</Text>
            </View>
          )}
          {stairShibari && (
            <View style={[styles.effectBadge, { backgroundColor: colors.shibari }]}>
              <Text style={styles.effectText}>🔢 階段縛り</Text>
            </View>
          )}
        </View>
      )}

      {/* Message */}
      {message ? (
        <View style={[styles.messageBubble, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <Text style={[styles.messageText, { color: colors.goldLight }]}>{message}</Text>
        </View>
      ) : null}

      {/* Field cards */}
      <View style={styles.fieldCards}>
        {!fieldCards || fieldCards.length === 0 ? (
          <View style={[styles.emptyField, { borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>場に何もありません</Text>
          </View>
        ) : (
          <View style={styles.cardsRow}>
            {fieldCards.map((card, i) => (
              <View key={card.id} style={[styles.fieldCard, { marginLeft: i > 0 ? -8 : 0 }]}>
                <PlayingCard card={card} size="lg" />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 8,
  },
  effectsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  effectBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  effectText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700' as const,
    fontFamily: undefined,
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    maxWidth: 280,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  fieldCards: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  emptyField: {
    width: 160,
    height: 90,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  cardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldCard: {
    zIndex: 1,
  },
});
