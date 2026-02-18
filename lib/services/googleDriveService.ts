import type { Brokerage, ClientIdentity, IntakeSession } from "@/lib/domain/types";
import { addAuditLog, setSessionDriveFolder } from "@/lib/persistence/mockDb";
import { newId } from "@/lib/utils/id";

function buildMockDriveUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export function ensureDriveFolder(input: {
  brokerage: Brokerage;
  client: ClientIdentity;
  session: IntakeSession;
}): { folderId: string; folderUrl: string } {
  if (input.session.driveFolderId && input.session.driveFolderUrl) {
    return {
      folderId: input.session.driveFolderId,
      folderUrl: input.session.driveFolderUrl,
    };
  }

  const folderId = newId("drive_folder");
  const folderUrl = buildMockDriveUrl(folderId);

  setSessionDriveFolder(input.session.id, folderId, folderUrl);

  addAuditLog(input.session.id, input.brokerage.id, input.client.id, "SYSTEM", "DRIVE_FOLDER_CREATED", {
    folderId,
    folderUrl,
    parentFolderId: input.brokerage.driveParentFolderId ?? null,
    integrationMode: process.env.GOOGLE_DRIVE_ENABLED === "true" ? "google" : "stub",
  });

  return { folderId, folderUrl };
}

export function uploadAssetToDrive(input: {
  brokerage: Brokerage;
  client: ClientIdentity;
  session: IntakeSession;
  fileName: string;
  mimeType: string;
  revision: number;
}): { driveFileId: string; driveFileUrl: string } {
  const { folderId } = ensureDriveFolder(input);
  const driveFileId = newId("drive_file");
  const driveFileUrl = `https://drive.google.com/file/d/${driveFileId}/view`;

  addAuditLog(input.session.id, input.brokerage.id, input.client.id, "SYSTEM", "DRIVE_FILE_ROUTED", {
    folderId,
    driveFileId,
    driveFileUrl,
    fileName: input.fileName,
    mimeType: input.mimeType,
    revision: input.revision,
  });

  return { driveFileId, driveFileUrl };
}
