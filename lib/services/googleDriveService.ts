import type { Brokerage, ClientIdentity, IntakeSession } from "@/lib/domain/types";
import { createSign } from "crypto";
import { isPostgresDriver } from "@/lib/persistence/driver";
import { addAuditLog, setSessionDriveFolder } from "@/lib/persistence/mockDb";
import { addAuditLogInSupabase, setSessionDriveFolderInSupabase } from "@/lib/persistence/supabaseRest";
import { newId } from "@/lib/utils/id";

function buildMockDriveUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

function isStubDriveId(value: string | undefined): boolean {
  return Boolean(value && (value.startsWith("drive_folder_") || value.startsWith("drive_file_")));
}

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

let cachedDriveToken: CachedToken | null = null;

function getDriveIntegrationMode(): "google" | "stub" {
  return process.env.GOOGLE_DRIVE_ENABLED === "true" ? "google" : "stub";
}

function shouldUseStrictGoogleDrive(): boolean {
  return process.env.GOOGLE_DRIVE_STRICT === "true";
}

function slugToEnvSuffix(slug: string): string {
  return slug.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
}

function getDriveParentFolderId(brokerage: Brokerage): string | undefined {
  const perBrokerageEnv = process.env[`DRIVE_PARENT_FOLDER_ID_${slugToEnvSuffix(brokerage.slug)}`];
  return (
    brokerage.driveParentFolderId ||
    perBrokerageEnv ||
    process.env.OMG_DRIVE_PARENT_FOLDER_ID ||
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ||
    undefined
  );
}

function parseServiceAccount(): GoogleServiceAccount {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing");
  }
  const parsed = JSON.parse(raw) as GoogleServiceAccount;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email/private_key");
  }
  return parsed;
}

function base64Url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

async function getGoogleDriveAccessToken(): Promise<string> {
  if (cachedDriveToken && Date.now() < cachedDriveToken.expiresAtMs - 60_000) {
    return cachedDriveToken.accessToken;
  }

  const serviceAccount = parseServiceAccount();
  const tokenUri = serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key).toString("base64url");
  const assertion = `${unsigned}.${signature}`;

  const body = new URLSearchParams();
  body.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  body.set("assertion", assertion);

  const tokenResponse = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`Google token request failed (${tokenResponse.status}): ${text}`);
  }

  const tokenPayload = (await tokenResponse.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedDriveToken = {
    accessToken: tokenPayload.access_token,
    expiresAtMs: Date.now() + tokenPayload.expires_in * 1000,
  };

  return tokenPayload.access_token;
}

async function createDriveFolderReal(input: {
  brokerage: Brokerage;
  client: ClientIdentity;
  session: IntakeSession;
}): Promise<{ folderId: string; folderUrl: string }> {
  const token = await getGoogleDriveAccessToken();
  const parentFolderId = getDriveParentFolderId(input.brokerage);
  const folderName = `${input.client.businessName} - ${input.session.id}`;

  const response = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentFolderId ? [parentFolderId] : undefined,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Drive folder create failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as { id: string };
  return {
    folderId: payload.id,
    folderUrl: buildMockDriveUrl(payload.id),
  };
}

async function createDriveFileReal(input: {
  folderId: string;
  fileName: string;
  mimeType: string;
  revision: number;
  fileBytes?: Uint8Array;
}): Promise<{ driveFileId: string; driveFileUrl: string }> {
  const token = await getGoogleDriveAccessToken();
  const name = `${input.fileName}__rev${input.revision}`;

  const metadata = {
    name,
    mimeType: input.mimeType || "application/octet-stream",
    parents: [input.folderId],
  };

  let response: Response;
  if (input.fileBytes && input.fileBytes.length > 0) {
    const boundary = `beesold-${Date.now()}`;
    const metaPart =
      `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${input.mimeType || "application/octet-stream"}\r\n\r\n`;
    const endPart = `\r\n--${boundary}--`;
    const body = Buffer.concat([
      Buffer.from(metaPart, "utf8"),
      Buffer.from(input.fileBytes),
      Buffer.from(endPart, "utf8"),
    ]);

    response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
  } else {
    response = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Drive file create failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as { id: string };
  return {
    driveFileId: payload.id,
    driveFileUrl: `https://drive.google.com/file/d/${payload.id}/view`,
  };
}

export async function ensureDriveFolder(input: {
  brokerage: Brokerage;
  client: ClientIdentity;
  session: IntakeSession;
}): Promise<{ folderId: string; folderUrl: string }> {
  const requestedMode = getDriveIntegrationMode();

  if (input.session.driveFolderId && input.session.driveFolderUrl) {
    // If Google mode is on but this session still has a stub id from older runs, regenerate it in Drive.
    if (requestedMode === "google" && isStubDriveId(input.session.driveFolderId)) {
      // continue to real/stub creation below
    } else {
      return {
        folderId: input.session.driveFolderId,
        folderUrl: input.session.driveFolderUrl,
      };
    }
  }

  let folderId = newId("drive_folder");
  let folderUrl = buildMockDriveUrl(folderId);
  let integrationMode: "google" | "stub" | "google_fallback_stub" = requestedMode;
  let integrationError: string | null = null;

  if (integrationMode === "google") {
    try {
      const created = await createDriveFolderReal(input);
      folderId = created.folderId;
      folderUrl = created.folderUrl;
    } catch (error) {
      if (shouldUseStrictGoogleDrive()) {
        throw error;
      }
      integrationMode = "google_fallback_stub";
      integrationError = (error as Error).message;
    }
  }

  if (isPostgresDriver()) {
    await setSessionDriveFolderInSupabase(input.session.id, folderId, folderUrl);
    await addAuditLogInSupabase(input.session.id, input.brokerage.id, input.client.id, "SYSTEM", "DRIVE_FOLDER_CREATED", {
      folderId,
      folderUrl,
      parentFolderId: getDriveParentFolderId(input.brokerage) ?? null,
      integrationMode,
      integrationError,
    });
  } else {
    setSessionDriveFolder(input.session.id, folderId, folderUrl);
    addAuditLog(input.session.id, input.brokerage.id, input.client.id, "SYSTEM", "DRIVE_FOLDER_CREATED", {
      folderId,
      folderUrl,
      parentFolderId: getDriveParentFolderId(input.brokerage) ?? null,
      integrationMode,
      integrationError,
    });
  }

  return { folderId, folderUrl };
}

export async function uploadAssetToDrive(input: {
  brokerage: Brokerage;
  client: ClientIdentity;
  session: IntakeSession;
  fileName: string;
  mimeType: string;
  revision: number;
  fileBytes?: Uint8Array;
}): Promise<{ driveFileId: string; driveFileUrl: string }> {
  const { folderId } = await ensureDriveFolder(input);
  let driveFileId = newId("drive_file");
  let driveFileUrl = `https://drive.google.com/file/d/${driveFileId}/view`;
  let integrationMode: "google" | "stub" | "google_fallback_stub" = getDriveIntegrationMode();
  let integrationError: string | null = null;

  if (integrationMode === "google") {
    try {
      const created = await createDriveFileReal({
        folderId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        revision: input.revision,
        fileBytes: input.fileBytes,
      });
      driveFileId = created.driveFileId;
      driveFileUrl = created.driveFileUrl;
    } catch (error) {
      if (shouldUseStrictGoogleDrive()) {
        throw error;
      }
      integrationMode = "google_fallback_stub";
      integrationError = (error as Error).message;
    }
  }

  if (isPostgresDriver()) {
    await addAuditLogInSupabase(input.session.id, input.brokerage.id, input.client.id, "SYSTEM", "DRIVE_FILE_ROUTED", {
      folderId,
      driveFileId,
      driveFileUrl,
      fileName: input.fileName,
      mimeType: input.mimeType,
      revision: input.revision,
      integrationMode,
      integrationError,
    });
  } else {
    addAuditLog(input.session.id, input.brokerage.id, input.client.id, "SYSTEM", "DRIVE_FILE_ROUTED", {
      folderId,
      driveFileId,
      driveFileUrl,
      fileName: input.fileName,
      mimeType: input.mimeType,
      revision: input.revision,
      integrationMode,
      integrationError,
    });
  }

  return { driveFileId, driveFileUrl };
}
