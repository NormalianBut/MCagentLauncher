import type { MetadataProvider, ResourceResolver } from "../../shared-types/src/resolverContract.ts";
import type { ResourceProviderId } from "../../shared-types/src/resource.ts";
import { MetadataResourceResolver } from "./metadataResourceResolver.ts";
import {
  ModrinthMetadataProvider,
  type ModrinthMetadataProviderOptions,
} from "./providers/modrinthMetadataProvider.ts";

export class MetadataProviderRegistry {
  readonly #providers = new Map<ResourceProviderId, MetadataProvider>();

  register(provider: MetadataProvider): void {
    const providerId = provider.capability.provider;
    if (this.#providers.has(providerId)) {
      throw new Error(`Metadata provider is already registered: ${providerId}`);
    }
    this.#providers.set(providerId, provider);
  }

  get(providerId: ResourceProviderId): MetadataProvider | null {
    return this.#providers.get(providerId) ?? null;
  }

  list(): readonly MetadataProvider[] {
    return [...this.#providers.values()];
  }
}

export function createDefaultMetadataProviderRegistry(
  options: { modrinth?: ModrinthMetadataProviderOptions } = {},
): MetadataProviderRegistry {
  const registry = new MetadataProviderRegistry();
  registry.register(new ModrinthMetadataProvider(options.modrinth));
  return registry;
}

export function createDefaultResourceResolver(
  options: { modrinth?: ModrinthMetadataProviderOptions } = {},
): ResourceResolver {
  return new MetadataResourceResolver(createDefaultMetadataProviderRegistry(options));
}
