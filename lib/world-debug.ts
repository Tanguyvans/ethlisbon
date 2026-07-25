function debugLogsEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.WORLD_DEBUG_LOGS !== "false"
  );
}

export function worldDebugLog(label: string, value: unknown) {
  if (!debugLogsEnabled()) {
    return;
  }

  const timestamp = new Date().toISOString();

  try {
    console.log(
      `\n[WORLD DEBUG · ${timestamp}] ${label}\n${JSON.stringify(value, null, 2)}\n`,
    );
  } catch {
    console.log(
      `\n[WORLD DEBUG · ${timestamp}] ${label}\n`,
      value,
      "\n",
    );
  }
}
