export interface Checkpoint {
  id: string;
  name: string;
  hint: string;
  image?: string; // base64
  task: string;
  requirePhoto: boolean;
  requireAudio?: boolean;
  requireEvaluation?: boolean;
  qrNumber: number; // 1-30
}

export interface CheckpointResult {
  checkpointId: string;
  photo?: string; // base64
  audio?: string; // base64
  bestPerformer?: string;
}

export interface GameSession {
  id: string;
  gameId: string;
  teamName: string;
  members: string[];
  results: CheckpointResult[];
  timestamp: number;
}

export interface TeamInfo {
  name: string;
  members: string[];
}

export interface GameData {
  id: string;
  checkpoints: Checkpoint[];
  createdAt: number;
}
