export type PersistenceDriver = "mock" | "postgres";

function normalizeDriver(value: string | undefined): PersistenceDriver {
  if (!value) return "mock";
  return value.toLowerCase() === "postgres" ? "postgres" : "mock";
}

export function getPersistenceDriver(): PersistenceDriver {
  return normalizeDriver(process.env.PERSISTENCE_DRIVER);
}

export function isPostgresDriver(): boolean {
  return getPersistenceDriver() === "postgres";
}

