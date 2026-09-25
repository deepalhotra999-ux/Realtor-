import "server-only";
import { demoConveniences, getEnv } from "@/lib/env";
import { getDb } from "@/server/db";
import { PostgresSearchProvider } from "@/server/search/postgres";
import { AutoAIProvider, MockAIProvider } from "./ai/mock";
import { OllamaProvider } from "./ai/ollama";
import type { AIProvider } from "./ai/types";
import type { EmailProvider } from "./email/types";
import { OutboxEmailProvider } from "./email/outbox";
import { SmtpEmailProvider } from "./email/smtp";
import { LocalGeocodingProvider } from "./geocoding/local";
import { NominatimGeocodingProvider } from "./geocoding/nominatim";
import type { GeocodingProvider } from "./geocoding/types";
import { XyzTileMapProvider, type MapProvider } from "./map/types";
import { LocalIdentityProvider } from "./identity/local";
import type { IdentityVerificationProvider } from "./identity/types";
import { MockPaymentProvider } from "./payment/mock";
import type { PaymentProvider } from "./payment/types";
import { ResoWebApiProvider } from "./property-data/reso";
import { SeedPropertyDataProvider } from "./property-data/seed";
import type { PropertyDataProvider } from "./property-data/types";
import type { SearchProvider } from "./search/types";
import { OutboxSmsProvider, type SmsProvider } from "./sms/types";
import { LocalStorageProvider } from "./storage/local";
import { S3StorageProvider } from "./storage/s3";
import { NetlifyBlobsStorageProvider } from "./storage/netlify-blobs";
import type { StorageProvider } from "./storage/types";

/**
 * Provider registry — the ONLY place that decides which implementation backs
 * each external capability. Everything else depends on the interfaces. To add
 * a paid/hosted service later, implement the interface and add a branch here.
 */

type Registry = {
  ai?: AutoAIProvider;
  aiFixed?: AIProvider;
  geocoding?: GeocodingProvider;
  map?: MapProvider;
  storage?: StorageProvider;
  email?: EmailProvider;
  sms?: SmsProvider;
  search?: SearchProvider;
  propertyData?: PropertyDataProvider;
  payment?: PaymentProvider;
  identity?: IdentityVerificationProvider;
};

const g = globalThis as unknown as { __dwProviders?: Registry };
const reg: Registry = (g.__dwProviders ??= {});

/** Resolve the AI provider for this request (Ollama if reachable, else mock). */
export async function getAI(): Promise<AIProvider> {
  const env = getEnv();
  if (env.AI_PROVIDER === "mock") return (reg.aiFixed ??= new MockAIProvider());
  const ollama = () =>
    new OllamaProvider({
      baseUrl: env.OLLAMA_BASE_URL,
      model: env.OLLAMA_MODEL,
      embedModel: env.OLLAMA_EMBED_MODEL,
      timeoutMs: env.OLLAMA_TIMEOUT_MS,
    });
  if (env.AI_PROVIDER === "ollama") return (reg.aiFixed ??= ollama());
  reg.ai ??= new AutoAIProvider(ollama(), new MockAIProvider());
  return reg.ai.resolve();
}

export function getMockAI(): AIProvider {
  return new MockAIProvider();
}

export function getGeocoding(): GeocodingProvider {
  if (!reg.geocoding) {
    const env = getEnv();
    reg.geocoding =
      env.GEOCODING_PROVIDER === "nominatim"
        ? new NominatimGeocodingProvider(env.NOMINATIM_URL, env.NOMINATIM_USER_AGENT)
        : new LocalGeocodingProvider();
  }
  return reg.geocoding;
}

export function getMap(): MapProvider {
  const env = getEnv();
  return (reg.map ??= new XyzTileMapProvider(
    env.MAP_TILE_URL,
    env.MAP_TILE_ATTRIBUTION,
    19,
    env.MAP_STYLE_URL || undefined,
  ));
}

export function getStorage(): StorageProvider {
  if (!reg.storage) {
    const env = getEnv();
    reg.storage =
      env.STORAGE_PROVIDER === "netlify-blobs"
        ? new NetlifyBlobsStorageProvider()
        : env.STORAGE_PROVIDER === "s3"
          ? new S3StorageProvider({
              endPoint: env.S3_ENDPOINT,
              port: env.S3_PORT,
              useSSL: env.S3_USE_SSL,
              accessKey: env.S3_ACCESS_KEY,
              secretKey: env.S3_SECRET_KEY,
              bucket: env.S3_BUCKET,
              publicUrl: env.S3_PUBLIC_URL,
            })
          : new LocalStorageProvider(env.STORAGE_LOCAL_DIR);
  }
  return reg.storage;
}

export function getEmail(): EmailProvider {
  if (!reg.email) {
    const env = getEnv();
    reg.email =
      env.EMAIL_PROVIDER === "smtp"
        ? new SmtpEmailProvider({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            user: env.SMTP_USER,
            password: env.SMTP_PASSWORD,
            from: env.EMAIL_FROM,
          })
        : new OutboxEmailProvider();
  }
  return reg.email;
}

export function getSms(): SmsProvider {
  return (reg.sms ??= new OutboxSmsProvider());
}

export function getSearch(): SearchProvider {
  return (reg.search ??= new PostgresSearchProvider(getDb));
}

export function getPropertyData(): PropertyDataProvider {
  if (!reg.propertyData) {
    const env = getEnv();
    reg.propertyData =
      env.PROPERTY_DATA_PROVIDER === "reso"
        ? new ResoWebApiProvider(env.RESO_BASE_URL, env.RESO_ACCESS_TOKEN)
        : new SeedPropertyDataProvider();
  }
  return reg.propertyData;
}

export function getIdentityVerification(): IdentityVerificationProvider {
  // Simulated decisions are a development convenience only.
  return (reg.identity ??= new LocalIdentityProvider(demoConveniences()));
}

export function getPayments(): PaymentProvider {
  const env = getEnv();
  return (reg.payment ??= new MockPaymentProvider(env.AUTH_SECRET, env.APP_URL));
}

/** Snapshot of which provider backs each capability (Admin → System). */
export async function describeProviders() {
  const ai = await getAI();
  return {
    ai: { name: ai.name, model: ai.model, kind: ai.kind },
    geocoding: getGeocoding().name,
    map: getMap().getConfig().provider,
    storage: getStorage().name,
    email: getEmail().name,
    sms: getSms().name,
    search: getSearch().name,
    propertyData: getPropertyData().name,
    payment: getPayments().name,
    identity: getIdentityVerification().name,
  };
}
