import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/context/GameContext';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { startGame } = useGame();

  const handleCPUMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startGame('cpu', 4);
    router.push('/game');
  };

  const handleOnline = (mode: 'create' | 'join') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/online', params: { mode } });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.felt }]}>
      {/* Background pattern */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.feltPattern, { opacity: 0.05 }]}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Text key={i} style={styles.feltChar}>♠♥♦♣</Text>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 20),
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={[styles.suits, { color: colors.gold }]}>♠ ♥ ♦ ♣</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>大富豪</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>役あり・本格トランプゲーム</Text>
        </View>

        {/* Special rules */}
        <View style={[styles.rulesCard, { backgroundColor: 'rgba(0,0,0,0.35)', borderColor: colors.border }]}>
          <Text style={[styles.rulesTitle, { color: colors.gold }]}>採用ルール</Text>
          <View style={styles.rulesList}>
            {[
              ['🔄', '革命', '4枚以上同じ → 強さが逆転'],
              ['8️⃣', '8切り', '8を出す → 場を流す'],
              ['🔒', '縛り', 'スート・階段の縛り'],
              ['🪜', '階段', '同スート連続3枚以上'],
              ['♠3', 'スペ3返し', 'ジョーカーにスペード3で対抗'],
              ['⚡', '特殊効果', '5/7/9/10/J/Qが効果を発動'],
              ['🚫', '禁止上がり', 'Joker・2・革命中の3・8'],
            ].map(([icon, name, desc]) => (
              <View key={name} style={styles.ruleRow}>
                <Text style={styles.ruleIcon}>{icon}</Text>
                <View>
                  <Text style={[styles.ruleName, { color: colors.foreground }]}>{name}</Text>
                  <Text style={[styles.ruleDesc, { color: colors.mutedForeground }]}>{desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Mode buttons */}
        <View style={styles.modes}>
          {/* CPU mode */}
          <TouchableOpacity
            style={[styles.modeButton, { backgroundColor: colors.gold, shadowColor: colors.gold }]}
            onPress={handleCPUMode}
            activeOpacity={0.85}
          >
            <Text style={[styles.modeIcon, { color: colors.primaryForeground }]}>🤖</Text>
            <Text style={[styles.modeTitle, { color: colors.primaryForeground }]}>CPU対戦</Text>
            <Text style={[styles.modeDesc, { color: 'rgba(0,0,0,0.6)' }]}>1人 vs CPU × 3</Text>
          </TouchableOpacity>

          {/* Online create */}
          <TouchableOpacity
            style={[styles.modeButton, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => handleOnline('create')}
            activeOpacity={0.85}
          >
            <Text style={[styles.modeIcon, { color: colors.foreground }]}>👥</Text>
            <Text style={[styles.modeTitle, { color: colors.foreground }]}>ルーム作成</Text>
            <Text style={[styles.modeDesc, { color: colors.mutedForeground }]}>オンラインで対戦</Text>
          </TouchableOpacity>

          {/* Online join */}
          <TouchableOpacity
            style={[styles.modeButton, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => handleOnline('join')}
            activeOpacity={0.85}
          >
            <Text style={[styles.modeIcon, { color: colors.foreground }]}>🔗</Text>
            <Text style={[styles.modeTitle, { color: colors.foreground }]}>ルーム参加</Text>
            <Text style={[styles.modeDesc, { color: colors.mutedForeground }]}>コードを入力して参加</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          ジョーカー1枚入り・53枚デッキ
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  feltPattern: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
  feltChar: {
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: 4,
    lineHeight: 40,
  },
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 24,
  },
  titleSection: {
    alignItems: 'center',
    gap: 4,
    marginTop: 16,
  },
  suits: {
    fontSize: 22,
    letterSpacing: 10,
    fontWeight: '400' as const,
  },
  title: {
    fontSize: 56,
    fontWeight: '700' as const,
    letterSpacing: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    letterSpacing: 2,
  },
  rulesCard: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  rulesTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: 2,
    textAlign: 'center',
  },
  rulesList: {
    gap: 10,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ruleIcon: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
  },
  ruleName: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  ruleDesc: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
  modes: {
    width: '100%',
    gap: 12,
  },
  modeButton: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modeIcon: {
    fontSize: 32,
  },
  modeTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
  },
  modeDesc: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  playerCountRow: {
    alignItems: 'center',
    gap: 12,
  },
  playerCountLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  countButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  countBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBtnText: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  footer: {
    fontSize: 12,
    fontWeight: '400' as const,
    textAlign: 'center',
    marginTop: 4,
  },
});
