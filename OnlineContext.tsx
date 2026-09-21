import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface OnlinePlayer {
  playerId: string;
  slot: number;
  name: string;
  connected: boolean;
}

export type OnlineStatus = "idle" | "connecting" | "connected" | "error";

export type OnlineAction =
  | { type: "play_cards"; cardIds: string[] }
  | { type: "pass" }
  | { type: "resolve_pending_cards"; cardIds: string[] }
  | { type: "resolve_q_bomber"; ranks: number[] }
  | { type: "skip_pending" };

export interface IncomingOnlineAction {
  nonce: number;
  playerId: string;
  playerIndex: number;
  action: OnlineAction;
}

interface RoomState {
  code: string;
  status: "lobby" | "playing";
  hostPlayerId: string;
  maxPlayers: number;
  players: OnlinePlayer[];
}

interface OnlineContextValue {
  status: OnlineStatus;
  room: RoomState | null;
  playerId: string | null;
  playerSlot: number | null;
  isHost: boolean;
  error: string;
  incomingAction: IncomingOnlineAction | null;
  gameSnapshot: unknown;
  connectToRoom: (mode: "create" | "join", name: string, code?: string) => void;
  startOnlineGame: () => void;
  sendAction: (action: OnlineAction) => void;
  sendGameSnapshot: (targetPlayerId: string, snapshot: unknown) => void;
  leaveRoom: () => void;
}

const OnlineContext = createContext<OnlineContextValue | null>(null);

function getWebSocketUrl() {
  const configuredDomain = process.env.EXPO_PUBLIC_DOMAIN;
  const domain = configuredDomain || (
    typeof window !== "undefined" ? window.location.host : ""
  );
  const normalizedDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `wss://${normalizedDomain}/api/ws`;
}

function parseRoomState(value: unknown): RoomState | null {
  if (!value || typeof value !== "object") return null;
  const room = (value as { room?: unknown }).room;
  if (!room || typeof room !== "object") return null;
  const raw = room as {
    code?: unknown;
    status?: unknown;
    hostPlayerId?: unknown;
    maxPlayers?: unknown;
    players?: unknown;
  };
  if (
    typeof raw.code !== "string" ||
    (raw.status !== "lobby" && raw.status !== "playing") ||
    typeof raw.hostPlayerId !== "string" ||
    !Array.isArray(raw.players)
  ) {
    return null;
  }
  const players = raw.players.flatMap((player) => {
    if (!player || typeof player !== "object") return [];
    const item = player as Record<string, unknown>;
    if (
      typeof item.playerId !== "string" ||
      typeof item.slot !== "number" ||
      typeof item.name !== "string"
    ) {
      return [];
    }
    return [{
      playerId: item.playerId,
      slot: item.slot,
      name: item.name,
      connected: item.connected !== false,
    }];
  });
  return {
    code: raw.code,
    status: raw.status,
    hostPlayerId: raw.hostPlayerId,
    maxPlayers: typeof raw.maxPlayers === "number" ? raw.maxPlayers : 4,
    players,
  };
}

export function OnlineProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nonceRef = useRef(0);
  const [status, setStatus] = useState<OnlineStatus>("idle");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState("");
  const [incomingAction, setIncomingAction] = useState<IncomingOnlineAction | null>(null);
  const [gameSnapshot, setGameSnapshot] = useState<unknown>(null);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const closeSocket = useCallback(() => {
    clearHeartbeat();
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close();
    }
  }, [clearHeartbeat]);

  const leaveRoom = useCallback(() => {
    closeSocket();
    setStatus("idle");
    setRoom(null);
    setPlayerId(null);
    setIsHost(false);
    setIncomingAction(null);
    setGameSnapshot(null);
  }, [closeSocket]);

  const connectToRoom = useCallback((mode: "create" | "join", name: string, code?: string) => {
    closeSocket();
    setStatus("connecting");
    setError("");
    setRoom(null);
    setPlayerId(null);
    setIsHost(false);
    setIncomingAction(null);
    setGameSnapshot(null);

    let socket: WebSocket;
    try {
      socket = new WebSocket(getWebSocketUrl());
    } catch {
      setStatus("error");
      setError("通信を開始できませんでした");
      return;
    }
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus("connected");
      socket.send(JSON.stringify({
        type: mode === "create" ? "create_room" : "join_room",
        name: name.trim() || "プレイヤー",
        ...(mode === "join" ? { code: code?.trim().toUpperCase() } : {}),
      }));
    };
    socket.onmessage = (event) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(String(event.data)) as Record<string, unknown>;
      } catch {
        return;
      }

      if (message.type === "ping") {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
        return;
      }
      if (message.type === "pong") return;

      if (message.type === "room_joined") {
        setPlayerId(typeof message.playerId === "string" ? message.playerId : null);
        setIsHost(message.isHost === true);
        return;
      }
      if (message.type === "room_state") {
        const nextRoom = parseRoomState(message);
        if (nextRoom) setRoom(nextRoom);
        if (typeof message.playerId === "string") setPlayerId(message.playerId);
        return;
      }
      if (message.type === "room_error") {
        setStatus("error");
        setError(typeof message.message === "string" ? message.message : "ルーム通信でエラーが発生しました");
        return;
      }
      if (message.type === "player_action") {
        const action = message.action as OnlineAction;
        if (
          typeof message.playerId === "string" &&
          typeof message.playerIndex === "number" &&
          action &&
          typeof action.type === "string"
        ) {
          setIncomingAction({
            nonce: nonceRef.current++,
            playerId: message.playerId,
            playerIndex: message.playerIndex,
            action,
          });
        }
        return;
      }
      if (message.type === "game_state") {
        setGameSnapshot(message.snapshot);
      }
    };
    socket.onerror = () => {
      setStatus("error");
      setError("サーバーに接続できませんでした");
    };
    socket.onclose = () => {
      clearHeartbeat();
      if (socketRef.current === socket) {
        socketRef.current = null;
        setStatus("error");
        setError("サーバーとの接続が切れました");
      }
    };

    heartbeatRef.current = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
      }
    }, 20_000);
  }, [clearHeartbeat, closeSocket]);

  const startOnlineGame = useCallback(() => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "start_game" }));
    }
  }, []);

  const sendAction = useCallback((action: OnlineAction) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "player_action", action }));
    }
  }, []);

  const sendGameSnapshot = useCallback((targetPlayerId: string, snapshot: unknown) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "game_state",
        targetPlayerId,
        snapshot,
      }));
    }
  }, []);

  useEffect(() => () => {
    closeSocket();
  }, [closeSocket]);

  const playerSlot = room?.players.find((player) => player.playerId === playerId)?.slot ?? null;
  const value = useMemo<OnlineContextValue>(() => ({
    status,
    room,
    playerId,
    playerSlot,
    isHost,
    error,
    incomingAction,
    gameSnapshot,
    connectToRoom,
    startOnlineGame,
    sendAction,
    sendGameSnapshot,
    leaveRoom,
  }), [
    status,
    room,
    playerId,
    playerSlot,
    isHost,
    error,
    incomingAction,
    gameSnapshot,
    connectToRoom,
    startOnlineGame,
    sendAction,
    sendGameSnapshot,
    leaveRoom,
  ]);

  return <OnlineContext.Provider value={value}>{children}</OnlineContext.Provider>;
}

export function useOnline() {
  const context = useContext(OnlineContext);
  if (!context) throw new Error("useOnline must be used within OnlineProvider");
  return context;
}