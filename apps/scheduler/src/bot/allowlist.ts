const TELEGRAM_ID_PATTERN = /^-?\d+$/;

/**
 * Parses a comma, space, or newline separated list of Telegram chat/user IDs.
 * Invalid values fail fast so a typo never silently grants or denies access.
 */
export function parseAllowedChatIds(raw: string | undefined | null): Set<string> {
  const allowed = new Set<string>();
  if (!raw) return allowed;

  for (const token of raw.split(/[\s,]+/)) {
    const id = token.trim();
    if (!id) continue;

    if (!TELEGRAM_ID_PATTERN.test(id)) {
      throw new Error(
        `Invalid Telegram chat ID in TELEGRAM_ALLOWED_CHAT_IDS: "${id}". ` +
          "Use numeric chat or user IDs separated by commas.",
      );
    }

    allowed.add(id);
  }

  return allowed;
}

export function isValidTelegramId(value: unknown): boolean {
  if (typeof value === "number") return Number.isInteger(value);
  if (typeof value === "string") return TELEGRAM_ID_PATTERN.test(value.trim());
  return false;
}

export function isAllowedTelegramId(value: unknown, allowed: ReadonlySet<string>): boolean {
  if (!isValidTelegramId(value)) return false;
  return allowed.has(String(value).trim());
}

export type TelegramIdentity = {
  chat?: { id?: number | string };
  from?: { id?: number | string };
};

/**
 * A Telegram update is authorized when either its chat or its sender is on the
 * allowlist. Checking both lets an owner use the bot in a private chat or a
 * family group without allowing unrelated chats.
 */
export function isAuthorizedTelegramContext(
  ctx: TelegramIdentity,
  allowed: ReadonlySet<string>,
): boolean {
  return isAllowedTelegramId(ctx.chat?.id, allowed) || isAllowedTelegramId(ctx.from?.id, allowed);
}

/**
 * Builds the effective allowlist from TELEGRAM_ALLOWED_CHAT_IDS plus the
 * configured owner TELEGRAM_CHAT_ID. Mock placeholders never grant access.
 */
export function buildAllowedChatIds(
  configured: string | undefined,
  ownerChatId: string | undefined,
): Set<string> {
  const allowed = parseAllowedChatIds(configured);
  const owner = ownerChatId?.trim();

  if (!owner || owner === "mock_chat_id") return allowed;

  if (!TELEGRAM_ID_PATTERN.test(owner)) {
    throw new Error(
      `Invalid Telegram chat ID in TELEGRAM_CHAT_ID: "${owner}". ` +
        "Use a numeric chat ID or leave it empty.",
    );
  }

  allowed.add(owner);
  return allowed;
}
