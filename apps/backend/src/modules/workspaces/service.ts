import type {
  ListWorkspacesResponse,
  SelectWorkspaceRequest,
  SelectWorkspaceResponse,
} from "@clm/shared-types";
import type { WorkspacesRepository } from "./repository.js";

export interface WorkspacesService {
  listForUser(userId: string): Promise<ListWorkspacesResponse>;
  selectWorkspace(
    userId: string,
    input: SelectWorkspaceRequest,
  ): Promise<SelectWorkspaceResponse>;
}

export interface CreateWorkspacesServiceOptions {
  repository: WorkspacesRepository;
}

export function createWorkspacesService(
  options: CreateWorkspacesServiceOptions,
): WorkspacesService {
  return {
    async listForUser(userId) {
      return {
        workspaces: await options.repository.listForUser(userId),
      };
    },
    async selectWorkspace(userId, input) {
      return options.repository.selectWorkspace(userId, input);
    },
  };
}
