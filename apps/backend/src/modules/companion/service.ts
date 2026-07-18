import type {
  CompanionStatusResponse,
  PairCompleteRequest,
  PairCompleteResponse,
  PairStartResponse,
} from "@clm/shared-types";
import type { CompanionRepository } from "./repository.js";

export interface CompanionService {
  startPairing(userId: string): Promise<PairStartResponse>;
  completePairing(input: PairCompleteRequest): Promise<PairCompleteResponse>;
  getStatus(userId: string): Promise<CompanionStatusResponse>;
  resolveMachineSession(input: {
    deviceId: string;
    machineSessionToken: string;
  }): Promise<{ userId: string; deviceId: string }>;
}

export interface CreateCompanionServiceOptions {
  repository: CompanionRepository;
}

export function createCompanionService(
  options: CreateCompanionServiceOptions,
): CompanionService {
  return {
    async startPairing(userId: string) {
      return options.repository.createPairingChallenge(userId);
    },
    async completePairing(input: PairCompleteRequest) {
      return options.repository.completePairing(input);
    },
    async getStatus(userId: string) {
      return options.repository.getCompanionStatus(userId);
    },
    async resolveMachineSession(input) {
      return options.repository.resolveMachineSession(input);
    },
  };
}
