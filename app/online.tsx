import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  StyleSheet,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import { useGame } from "@/context/GameContext";
import { useOnline } from "@/context/OnlineContext";
import * as Haptics from "expo-haptics";

export default function OnlineRoomScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = params.mode === "join" ? "join" : "create";
  const { state, startGame } = useGame();
  const {
    status,
    room,
    playerSlot,
    isHost,
    error,
    connectToRoom,
    startOnlineGame,
    leaveRoom,
  } = useOnline();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const title = mode === "create" ? "ルームを作成" : "ルームに参加";
  const canSubmit = mode === "create"
    ? name.trim().length > 0
    : name.trim().length > 0 && code.trim().length === 6;
  const playerNames = useMemo(() => room?.players.map((player) => player.name) ?? [], [room?.players]);

  useEffect(() => {
    if (
      room?.status === "playing" &&
      playerSlot !== null &&
      !isHost &&
      state.mode !== "online"
    ) {
      startGame("online", room.players.length, playerNames, playerSlot);
      router.replace("/game");
    }
  }, [isHost, playerNames, playerSlot, room, startGame, state.mode]);

  const handleConnect = () => {
    if (!canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitted(true);
    connectToRoom(mode, name, code);
  };

  const handleStart = () => {
    if (!room || !isHost || room.players.length < 2 || playerSlot === null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startGame("online", room.players.length, playerNames, playerSlot);
    startOnlineGame();
    router.replace("/game");
  };

  const handleLeave = () => {
    leaveRoom();
    router.replace("/");
  };

  if (!room) {
    return (
      <View style={[styles.container, { backgroundColor: colors.felt }]}>
        <KeyboardAwareScrollViewCompat
          contentContainerStyle={[
            styles.formContent,
            {
              paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24),
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24),
            },
          ]}
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {mode === "create" ? "最大4人で遊べるルームを作成します" : "ホストから共有された6桁コードを入力してください"}
          </Text>

          <View style={styles.formCard}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>プレイヤー名</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="名前を入力"
              placeholderTextColor={colors.mutedForeground}
              maxLength={20}
              autoCapitalize="none"
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
            />

            {mode === "join" && (
              <>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>ルームコード</Text>
                <TextInput
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6))}
                  placeholder="例：AB12CD"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="characters"
                  maxLength={6}
                  style={[styles.input, styles.codeInput, { color: colors.foreground, borderColor: colors.border }]}
                />
              </>
            )}

            {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: canSubmit ? colors.gold : colors.disabled }]}
              onPress={handleConnect}
              disabled={!canSubmit || status === "connecting"}
              activeOpacity={0.85}
            >
              {status === "connecting" ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                  {mode === "create" ? "ルームを作成" : "ルームに参加"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {submitted && status === "error" ? (
            <TouchableOpacity onPress={() => setSubmitted(false)} activeOpacity={0.7}>
              <Text style={[styles.backLink, { color: colors.mutedForeground }]}>入力画面に戻る</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => router.replace("/")} activeOpacity={0.7}>
            <Text style={[styles.backLink, { color: colors.mutedForeground }]}>メニューに戻る</Text>
          </TouchableOpacity>
        </KeyboardAwareScrollViewCompat>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.felt }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.roomContent,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24),
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24),
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>待機ルーム</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>参加者が揃ったらホストが開始します</Text>

        <View style={[styles.codeCard, { borderColor: colors.gold, backgroundColor: "rgba(0,0,0,0.28)" }]}>
          <Text style={[styles.codeLabel, { color: colors.mutedForeground }]}>ルームコード</Text>
          <Text style={[styles.roomCode, { color: colors.gold }]}>{room.code}</Text>
          <Text style={[styles.codeHint, { color: colors.mutedForeground }]}>このコードを対戦相手に共有してください</Text>
        </View>

        <View style={styles.playersCard}>
          <View style={styles.playersTitleRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>参加者</Text>
            <Text style={[styles.playerCount, { color: colors.mutedForeground }]}>
              {room.players.length} / {room.maxPlayers}人
            </Text>
          </View>
          {room.players.map((player) => (
            <View key={player.playerId} style={[styles.playerRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.playerDot, { backgroundColor: player.connected ? colors.gold : colors.disabled }]} />
              <Text style={[styles.playerName, { color: colors.foreground }]}>
                {player.name}{player.playerId === room.hostPlayerId ? "（ホスト）" : ""}
              </Text>
              {player.playerId === room.hostPlayerId ? (
                <Text style={[styles.hostLabel, { color: colors.gold }]}>HOST</Text>
              ) : null}
            </View>
          ))}
        </View>

        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

        {isHost ? (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: room.players.length >= 2 ? colors.gold : colors.disabled }]}
            onPress={handleStart}
            disabled={room.players.length < 2}
            activeOpacity={0.85}
          >
            <Text style={[styles.buttonText, { color: room.players.length >= 2 ? colors.primaryForeground : colors.mutedForeground }]}>
              {room.players.length >= 2 ? "ゲーム開始" : "2人以上で開始できます"}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.waitingCard, { borderColor: colors.border }]}>
            <ActivityIndicator color={colors.gold} />
            <Text style={[styles.waitingText, { color: colors.mutedForeground }]}>ホストの開始を待っています</Text>
          </View>
        )}

        <TouchableOpacity onPress={handleLeave} activeOpacity={0.7}>
          <Text style={[styles.backLink, { color: colors.mutedForeground }]}>ルームを退出</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  formContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  roomContent: { flexGrow: 1, alignItems: "center", paddingHorizontal: 24, gap: 16 },
  title: { fontSize: 32, fontWeight: "700" as const, letterSpacing: 3, textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  formCard: { width: "100%", maxWidth: 380, borderRadius: 18, padding: 18, gap: 10, backgroundColor: "rgba(0,0,0,0.3)" },
  label: { fontSize: 12, fontWeight: "600" as const, marginTop: 4 },
  input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, backgroundColor: "rgba(255,255,255,0.06)" },
  codeInput: { fontSize: 22, letterSpacing: 5, textAlign: "center" },
  error: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  primaryButton: { width: "100%", borderRadius: 14, minHeight: 54, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  buttonText: { fontSize: 17, fontWeight: "700" as const, textAlign: "center" },
  backLink: { fontSize: 14, textAlign: "center", padding: 8 },
  codeCard: { width: "100%", borderWidth: 1.5, borderRadius: 18, padding: 20, alignItems: "center", gap: 6 },
  codeLabel: { fontSize: 12, letterSpacing: 2 },
  roomCode: { fontSize: 38, fontWeight: "800" as const, letterSpacing: 8, marginLeft: 8 },
  codeHint: { fontSize: 12, textAlign: "center" },
  playersCard: { width: "100%", borderRadius: 16, padding: 16, backgroundColor: "rgba(0,0,0,0.3)" },
  playersTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  sectionTitle: { fontSize: 17, fontWeight: "700" as const },
  playerCount: { fontSize: 13 },
  playerRow: { minHeight: 48, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, gap: 10 },
  playerDot: { width: 9, height: 9, borderRadius: 5 },
  playerName: { flex: 1, fontSize: 15, fontWeight: "600" as const },
  hostLabel: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1 },
  waitingCard: { width: "100%", minHeight: 60, borderWidth: 1, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  waitingText: { fontSize: 14 },
});