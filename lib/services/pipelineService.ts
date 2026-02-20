import { isPostgresDriver } from "@/lib/persistence/driver";
import {
  addAuditLog,
  addJobOutput,
  createJob,
  getBrokerageById,
  getClientById,
  getDb,
  getReportBySessionId,
  getSessionById,
  getStepsForSession,
  setJobStatus,
  transitionSession,
  upsertReport,
} from "@/lib/persistence/mockDb";
import {
  addAuditLogInSupabase,
  addJobOutputInSupabase,
  createJobInSupabase,
  getBrokerageByIdFromSupabase,
  getClientByIdFromSupabase,
  listIntakeAssetsForSessionFromSupabase,
  getReportBySessionIdFromSupabase,
  getSessionByIdFromSupabase,
  getStepsForSessionFromSupabase,
  setJobStatusInSupabase,
  transitionSessionInSupabase,
  upsertReportInSupabase,
} from "@/lib/persistence/supabaseRest";

export async function runKlorSynthesis(sessionId: string): Promise<{ jobId: string }> {
  if (isPostgresDriver()) {
    const session = await getSessionByIdFromSupabase(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "FINAL_SUBMITTED") {
      throw new Error("Klor synthesis requires FINAL_SUBMITTED status");
    }

    await transitionSessionInSupabase(sessionId, "KLOR_SYNTHESIS", "Klor synthesis job started", "SYSTEM");

    const job = await createJobInSupabase(sessionId, "KLOR_RUN");
    await setJobStatusInSupabase(job.id, "RUNNING");

    const steps = await getStepsForSessionFromSupabase(sessionId);
    const synthesis = {
      completeness: steps.filter((step) => step.isComplete).length / Math.max(steps.length, 1),
      extractedThemes: ["Financial readiness", "Strategic timing", "Risk controls"],
    };

    await addJobOutputInSupabase(job.id, "KLOR_SYNTHESIS_SUMMARY", synthesis);
    await setJobStatusInSupabase(job.id, "COMPLETED");
    await addAuditLogInSupabase(sessionId, session.brokerageId, session.clientId, "SYSTEM", "KLOR_SYNTHESIS_COMPLETED", synthesis);
    return { jobId: job.id };
  }

  const session = getSessionById(sessionId);
  if (session.status !== "FINAL_SUBMITTED") {
    throw new Error("Klor synthesis requires FINAL_SUBMITTED status");
  }

  transitionSession(sessionId, "KLOR_SYNTHESIS", "Klor synthesis job started", "SYSTEM");

  const job = createJob(sessionId, "KLOR_RUN");
  setJobStatus(job.id, "RUNNING");

  const steps = getStepsForSession(sessionId);
  const synthesis = {
    completeness: steps.filter((step) => step.isComplete).length / Math.max(steps.length, 1),
    extractedThemes: ["Financial readiness", "Strategic timing", "Risk controls"],
  };

  addJobOutput(job.id, "KLOR_SYNTHESIS_SUMMARY", synthesis);
  setJobStatus(job.id, "COMPLETED");

  addAuditLog(sessionId, session.brokerageId, session.clientId, "SYSTEM", "KLOR_SYNTHESIS_COMPLETED", synthesis);
  return { jobId: job.id };
}

export async function runCouncil(sessionId: string): Promise<{ jobId: string }> {
  if (isPostgresDriver()) {
    const session = await getSessionByIdFromSupabase(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "KLOR_SYNTHESIS") {
      throw new Error("Council run requires KLOR_SYNTHESIS status");
    }

    await transitionSessionInSupabase(sessionId, "COUNCIL_RUNNING", "Council analysis and report generation started", "SYSTEM");

    const job = await createJobInSupabase(sessionId, "COUNCIL_RUN");
    await setJobStatusInSupabase(job.id, "RUNNING");

    const report = await upsertReportInSupabase(sessionId, {
      sessionId,
      title: "Strategic Intake Report",
      summary: "Council completed structured synthesis. Listing is ready for operator review.",
      findings: [
        "Intake data quality is sufficient for downstream planning.",
        "Timeline pressure requires staged execution controls.",
        "Risk profile indicates review checkpoints should be retained.",
      ],
      recommendations: [
        "Approve with milestone-based execution gates.",
        "Validate legal and financial attachments before publishing output.",
        "Assign owner for deal execution orchestration.",
      ],
    });

    await addJobOutputInSupabase(job.id, "COUNCIL_REPORT", {
      reportId: report.id,
      summary: report.summary,
    });

    await setJobStatusInSupabase(job.id, "COMPLETED");
    await transitionSessionInSupabase(sessionId, "REPORT_READY", "Report generated and awaiting operator decision", "SYSTEM");
    await addAuditLogInSupabase(sessionId, session.brokerageId, session.clientId, "SYSTEM", "COUNCIL_COMPLETED", {
      reportId: report.id,
    });
    return { jobId: job.id };
  }

  const session = getSessionById(sessionId);
  if (session.status !== "KLOR_SYNTHESIS") {
    throw new Error("Council run requires KLOR_SYNTHESIS status");
  }

  transitionSession(sessionId, "COUNCIL_RUNNING", "Council analysis and report generation started", "SYSTEM");

  const job = createJob(sessionId, "COUNCIL_RUN");
  setJobStatus(job.id, "RUNNING");

  const report = upsertReport(sessionId, {
    sessionId,
    title: "Strategic Intake Report",
    summary: "Council completed structured synthesis. Listing is ready for operator review.",
    findings: [
      "Intake data quality is sufficient for downstream planning.",
      "Timeline pressure requires staged execution controls.",
      "Risk profile indicates review checkpoints should be retained.",
    ],
    recommendations: [
      "Approve with milestone-based execution gates.",
      "Validate legal and financial attachments before publishing output.",
      "Assign owner for deal execution orchestration.",
    ],
  });

  addJobOutput(job.id, "COUNCIL_REPORT", {
    reportId: report.id,
    summary: report.summary,
  });

  setJobStatus(job.id, "COMPLETED");
  transitionSession(sessionId, "REPORT_READY", "Report generated and awaiting operator decision", "SYSTEM");

  addAuditLog(sessionId, session.brokerageId, session.clientId, "SYSTEM", "COUNCIL_COMPLETED", {
    reportId: report.id,
  });
  return { jobId: job.id };
}

export async function runFullPipeline(sessionId: string): Promise<{ reportId: string }> {
  await runKlorSynthesis(sessionId);
  await runCouncil(sessionId);

  if (isPostgresDriver()) {
    const report = await getReportBySessionIdFromSupabase(sessionId);
    if (!report) {
      throw new Error("Report generation failed");
    }
    return { reportId: report.id };
  }

  const report = getReportBySessionId(sessionId);
  if (!report) {
    throw new Error("Report generation failed");
  }

  return { reportId: report.id };
}

export async function getPipelineSessionData(
  sessionId: string,
  options?: { updatedSince?: string },
): Promise<{
  session: {
    id: string;
    status: string;
    currentStep: number;
    totalSteps: number;
    completionPct: number;
    partialSubmittedAt?: string;
    finalSubmittedAt?: string;
    missingItems: string[];
    driveFolderUrl?: string;
    createdAt: string;
    updatedAt: string;
  };
  brokerage: {
    id: string;
    slug: string;
    name: string;
    shortName?: string;
  };
  client: {
    id: string;
    businessName: string;
    contactName: string;
    email: string;
    phone?: string;
    assignedOwner?: string;
    lastActivityAt: string;
  };
  steps: Array<{
    stepKey: string;
    title: string;
    order: number;
    isComplete: boolean;
    updatedAt: string;
    data: Record<string, unknown>;
  }>;
  assets: Array<{
    id: string;
    category: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    revision: number;
    driveFileUrl?: string;
    uploadedAt: string;
  }>;
  delta: {
    updatedSince?: string;
    filtered: boolean;
  };
}> {
  const since = options?.updatedSince ? new Date(options.updatedSince) : null;
  if (options?.updatedSince && (!since || Number.isNaN(since.getTime()))) {
    throw new Error("Invalid updatedSince value. Use ISO-8601 datetime.");
  }

  if (isPostgresDriver()) {
    const session = await getSessionByIdFromSupabase(sessionId);
    if (!session) throw new Error("Session not found");
    const [client, brokerage, steps, assets] = await Promise.all([
      getClientByIdFromSupabase(session.clientId),
      getBrokerageByIdFromSupabase(session.brokerageId),
      getStepsForSessionFromSupabase(session.id),
      listIntakeAssetsForSessionFromSupabase(session.id),
    ]);
    if (!client || !brokerage) throw new Error("Session scope invalid");
    return {
      session: {
        id: session.id,
        status: session.status,
        currentStep: session.currentStep,
        totalSteps: session.totalSteps,
        completionPct: session.completionPct,
        partialSubmittedAt: session.partialSubmittedAt,
        finalSubmittedAt: session.finalSubmittedAt,
        missingItems: session.missingItems,
        driveFolderUrl: session.driveFolderUrl,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      brokerage: {
        id: brokerage.id,
        slug: brokerage.slug,
        name: brokerage.name,
        shortName: brokerage.shortName,
      },
      client: {
        id: client.id,
        businessName: client.businessName,
        contactName: client.contactName,
        email: client.email,
        phone: client.phone,
        assignedOwner: client.assignedOwner,
        lastActivityAt: client.lastActivityAt,
      },
      steps: steps
        .filter((step) => {
          if (!since) return true;
          return new Date(step.updatedAt).getTime() > since.getTime();
        })
        .map((step) => ({
        stepKey: step.stepKey,
        title: step.title,
        order: step.order,
        isComplete: step.isComplete,
        updatedAt: step.updatedAt,
        data: step.data,
      })),
      assets: assets
        .filter((asset) => {
          if (!since) return true;
          return new Date(asset.uploadedAt).getTime() > since.getTime();
        })
        .map((asset) => ({
        id: asset.id,
        category: asset.category,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        revision: asset.revision,
        driveFileUrl: asset.driveFileUrl,
        uploadedAt: asset.uploadedAt,
      })),
      delta: {
        updatedSince: options?.updatedSince,
        filtered: Boolean(since),
      },
    };
  }

  const session = getSessionById(sessionId);
  const client = getClientById(session.clientId);
  const brokerage = getBrokerageById(session.brokerageId);
  const steps = getStepsForSession(session.id);
  const assets = getDb().intake_assets.filter((asset) => asset.sessionId === session.id);

  return {
    session: {
      id: session.id,
      status: session.status,
      currentStep: session.currentStep,
      totalSteps: session.totalSteps,
      completionPct: session.completionPct,
      partialSubmittedAt: session.partialSubmittedAt,
      finalSubmittedAt: session.finalSubmittedAt,
      missingItems: session.missingItems,
      driveFolderUrl: session.driveFolderUrl,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
    brokerage: {
      id: brokerage.id,
      slug: brokerage.slug,
      name: brokerage.name,
      shortName: brokerage.shortName,
    },
    client: {
      id: client.id,
      businessName: client.businessName,
      contactName: client.contactName,
      email: client.email,
      phone: client.phone,
      assignedOwner: client.assignedOwner,
      lastActivityAt: client.lastActivityAt,
    },
    steps: steps
      .filter((step) => {
        if (!since) return true;
        return new Date(step.updatedAt).getTime() > since.getTime();
      })
      .map((step) => ({
      stepKey: step.stepKey,
      title: step.title,
      order: step.order,
      isComplete: step.isComplete,
      updatedAt: step.updatedAt,
      data: step.data,
    })),
    assets: assets
      .filter((asset) => {
        if (!since) return true;
        return new Date(asset.uploadedAt).getTime() > since.getTime();
      })
      .map((asset) => ({
      id: asset.id,
      category: asset.category,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      revision: asset.revision,
      driveFileUrl: asset.driveFileUrl,
      uploadedAt: asset.uploadedAt,
    })),
    delta: {
      updatedSince: options?.updatedSince,
      filtered: Boolean(since),
    },
  };
}
