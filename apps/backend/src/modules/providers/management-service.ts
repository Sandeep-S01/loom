import { conflict, notFound } from "../../lib/http-errors.js";
import type {
  ProviderCredentialDTO,
  ProviderCredentialRecord,
  ProviderDTO,
  ProviderRecord,
} from "./domain.js";
import type {
  ProviderCredentialRepository,
  ProviderLogger,
  ProviderManagementService,
  ProviderRepository,
  SecretReader,
} from "./interfaces.js";

interface CreateProviderManagementServiceOptions {
  providerRepository: ProviderRepository;
  credentialRepository: ProviderCredentialRepository;
  secretReader: SecretReader;
  logger?: ProviderLogger;
}

const noopLogger: ProviderLogger = {
  info() {},
  warn() {},
  error() {},
};

export function createProviderManagementService(
  options: CreateProviderManagementServiceOptions,
): ProviderManagementService {
  const logger = options.logger ?? noopLogger;

  return {
    async listProviders(filters) {
      const [providersPage, credentials] = await Promise.all([
        options.providerRepository.list(filters),
        options.credentialRepository.list({}),
      ]);
      const credentialByProvider = new Map(
        credentials.map((credential) => [credential.providerId, credential]),
      );

      return {
        ...providersPage,
        items: providersPage.items.map((provider) =>
          mapProvider(
            provider,
            selectCurrentCredential(provider, credentialByProvider.get(provider.id) ?? null),
          ),
        ),
      };
    },

    async updateProvider({ providerId, update, actorUserId }) {
      const existing = await options.providerRepository.findById(providerId);
      if (!existing) {
        throw notFound("Provider not found.");
      }

      const updated = await options.providerRepository.update(providerId, update);
      if (!updated) {
        throw notFound("Provider not found.");
      }

      let credential: ProviderCredentialRecord | null = null;
      if (typeof update.defaultSecretRef === "string") {
        credential = await options.credentialRepository.upsertProviderDefault({
          providerId,
          secretRef: update.defaultSecretRef,
        });
      }

      if (!credential) {
        credential = await options.credentialRepository.findPrimaryForProvider(providerId);
      }

      logger.info(
        {
          event: "provider.updated",
          actorUserId,
          providerId,
          changedFields: Object.keys(update),
        },
        "Provider updated",
      );

      return mapProvider(updated, selectCurrentCredential(updated, credential));
    },

    async listCredentials(filters) {
      if (filters.providerId) {
        const provider = await options.providerRepository.findById(filters.providerId);
        if (!provider) {
          throw notFound("Provider not found.");
        }
      }

      const credentials = await options.credentialRepository.list(filters);
      return {
        credentials: credentials.map(mapCredential),
      };
    },

    async checkCredential(input) {
      const credential = await resolveCredential({
        providerId: input.providerId,
        credentialId: input.credentialId,
        providerRepository: options.providerRepository,
        credentialRepository: options.credentialRepository,
      });

      const configured = await options.secretReader.hasSecret(credential.secretRef);
      const checked = await options.credentialRepository.updateCheckResult({
        credentialId: credential.id,
        configured,
        failureCode: configured ? null : "secret_missing",
      });

      if (!checked) {
        throw conflict("Credential changed while checking provider credential.");
      }

      logger.info(
        {
          event: "provider.credential_checked",
          actorUserId: input.actorUserId,
          providerId: checked.providerId,
          credentialId: checked.id,
          status: checked.status,
        },
        "Provider credential checked",
      );

      return mapCredential(checked);
    },
  };
}

async function resolveCredential(input: {
  providerId?: string;
  credentialId?: string;
  providerRepository: ProviderRepository;
  credentialRepository: ProviderCredentialRepository;
}) {
  if (input.credentialId) {
    const credential = await input.credentialRepository.findById(input.credentialId);
    if (!credential) {
      throw notFound("Provider credential not found.");
    }
    return credential;
  }

  const providerId = input.providerId as string;
  const provider = await input.providerRepository.findById(providerId);
  if (!provider) {
    throw notFound("Provider not found.");
  }

  if (!provider.defaultSecretRef) {
    throw notFound("Provider credential not found.");
  }

  const credential = await input.credentialRepository.findForProviderSecret({
    providerId,
    secretRef: provider.defaultSecretRef,
  });
  if (!credential) {
    throw notFound("Provider credential not found.");
  }

  return credential;
}

function mapProvider(
  provider: ProviderRecord,
  credential: ProviderCredentialRecord | null,
): ProviderDTO {
  return {
    id: provider.id,
    name: provider.name,
    baseType: provider.baseType,
    driverKey: provider.driverKey,
    defaultSecretRef: provider.defaultSecretRef,
    metadataJson: provider.metadataJson,
    status: provider.status,
    priorityRank: provider.priorityRank,
    credentialStatus: credential?.status ?? "unchecked",
    createdAt: provider.createdAt.toISOString(),
    updatedAt: provider.updatedAt.toISOString(),
  };
}

function mapCredential(credential: ProviderCredentialRecord): ProviderCredentialDTO {
  return {
    id: credential.id,
    providerId: credential.providerId,
    secretRef: credential.secretRef,
    status: credential.status,
    lastCheckedAt: credential.lastCheckedAt?.toISOString() ?? null,
    lastSuccessAt: credential.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: credential.lastFailureAt?.toISOString() ?? null,
    lastFailureCode: credential.lastFailureCode,
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
  };
}

function selectCurrentCredential(
  provider: ProviderRecord,
  credential: ProviderCredentialRecord | null,
) {
  if (!provider.defaultSecretRef || credential?.secretRef !== provider.defaultSecretRef) {
    return null;
  }
  return credential;
}
