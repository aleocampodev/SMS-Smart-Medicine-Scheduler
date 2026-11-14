import { Bot, InlineKeyboard, InputFile } from "grammy";
import { resolveSelectedBranches, transitionMonitorStatus } from "@SMS/poller";
import { env } from "../config/env.js";
import { loadProfiles, getProfileById } from "../config/profiles.js";
import { PlaywrightBooker } from "../automation/playwrightBooker.js";
import {
  InMemoryMonitorStateAdapter,
  type BookingPort,
  type MonitorStatePort,
  type NotificationPort,
} from "../ports.js";
import { BookingResult, QantySlot, Profile } from "../types/index.js";
import {
  buildAllowedChatIds,
  isAllowedTelegramId,
  isAuthorizedTelegramContext,
} from "./allowlist.js";
import fs from "fs";

export interface TelegramBotDependencies {
  statePort?: MonitorStatePort;
  booker?: BookingPort;
  onActivate?: () => Promise<void>;
}

export class TelegramBotService implements NotificationPort {
  private bot: Bot | null = null;
  private booker: BookingPort;
  private statePort: MonitorStatePort;
  private onActivate?: () => Promise<void>;
  // Temporary storage of active slots for button callbacks
  private activeSlots: Map<string, QantySlot> = new Map();
  // Set of actively subscribed chat IDs (e.g. from /start interaction)
  private subscribedChatIds: Set<string | number> = new Set();
  // Explicit access list: TELEGRAM_ALLOWED_CHAT_IDS plus TELEGRAM_CHAT_ID
  private allowedChatIds: Set<string> = new Set();

  constructor(deps: TelegramBotDependencies = {}) {
    this.booker = deps.booker || new PlaywrightBooker();
    this.statePort = deps.statePort || new InMemoryMonitorStateAdapter();
    this.onActivate = deps.onActivate;
    this.allowedChatIds = buildAllowedChatIds(env.TELEGRAM_ALLOWED_CHAT_IDS, env.TELEGRAM_CHAT_ID);

    if (this.allowedChatIds.size === 0) {
      console.warn(
        "[TelegramBot] No allowed Telegram IDs configured. All commands and alerts will be rejected. " +
          "Set TELEGRAM_CHAT_ID or TELEGRAM_ALLOWED_CHAT_IDS.",
      );
    }

    if (
      !env.TELEGRAM_BOT_TOKEN ||
      env.TELEGRAM_BOT_TOKEN === "your_token_here" ||
      env.TELEGRAM_BOT_TOKEN === "mock_token"
    ) {
      console.warn(
        "[TelegramBot] Token not configured. The bot will operate in console/mock mode.",
      );
      return;
    }

    this.bot = new Bot(env.TELEGRAM_BOT_TOKEN);
    this.setupHandlers();
    console.log(
      `[TelegramBot] Allowlist loaded with ${this.allowedChatIds.size} authorized ID(s).`,
    );
  }

  private setupHandlers(): void {
    if (!this.bot) return;

    // Access control: this runs before every command and callback query.
    this.bot.use(async (ctx, next) => {
      const allowed = isAuthorizedTelegramContext(ctx, this.allowedChatIds);

      if (allowed) {
        await next();
        return;
      }

      if (ctx.callbackQuery) {
        await ctx
          .answerCallbackQuery({
            text: "⛔ No autorizado.",
            show_alert: true,
          })
          .catch(() => {});
        return;
      }

      if (ctx.chat) {
        if (ctx.message?.text?.startsWith("/start")) {
          const chatId = ctx.chat.id ?? ctx.from?.id ?? "desconocido";
          await ctx.reply(
            `⛔ No autorizado.\n\nTu chat ID es \`${chatId}\`.\n` +
              "Pídele al administrador que lo agregue a TELEGRAM_ALLOWED_CHAT_IDS.",
            { parse_mode: "Markdown" },
          );
        } else {
          await ctx.reply("⛔ No autorizado.");
        }
      }
    });

    // Command /start
    this.bot.command("start", async (ctx) => {
      this.subscribedChatIds.add(ctx.chat.id);
      console.log(
        `[TelegramBot] /start received from chat ID: ${ctx.chat.id}. Added to active recipients.`,
      );
      await ctx.reply(
        "👋 *¡Hola! Soy el bot de Smart Medicine Scheduler (SMSBot).*\n\n" +
          `✅ *¡Conexión activada con éxito!* Tu ID de chat es: \`${ctx.chat.id}\`\n\n` +
          "📍 *Sedes Monitoreadas:*\n" +
          "• *Sede PISO3:* Nueva EPS Promedan CR 46 #47 66 Piso 3 (Av. Oriental)\n" +
          "• *Sede 118:* Promedan CR 49 #44 99 Local 118\n\n" +
          "⚡ *Comandos Disponibles:*\n" +
          "• `/buscar` — Activar búsqueda automática en Qanty\n" +
          "• `/pausar` — Pausar búsqueda (cuando ya reclamaste)\n" +
          "• `/check` — Consultar disponibilidad en vivo en este momento\n" +
          "• `/test` — Enviar una alerta de prueba con botones interactivos\n" +
          "• `/profiles` — Ver personas configuradas para agendamiento",
        { parse_mode: "Markdown" },
      );

      await this.sendClaimCheckPrompt();
    });

    // Command /buscar: manually activate polling
    this.bot.command("buscar", async (ctx) => {
      this.subscribedChatIds.add(ctx.chat.id);
      const current = await this.statePort.getStatus();
      const next = transitionMonitorStatus(current, "RESUME");
      await this.statePort.setStatus(next);
      await ctx.reply(
        "🔍 *Monitoreo activado.* Empezaré a consultar Qanty para las sedes PISO3 y 118.",
        { parse_mode: "Markdown" },
      );
      if (this.onActivate) {
        await this.onActivate();
      }
    });

    // Command /pausar: manually pause polling
    this.bot.command("pausar", async (ctx) => {
      const current = await this.statePort.getStatus();
      const next = transitionMonitorStatus(current, "PAUSE");
      await this.statePort.setStatus(next);
      await ctx.reply(
        "⏸️ *Monitoreo pausado.* No haré ninguna consulta en la web hasta que uses `/buscar`.",
        { parse_mode: "Markdown" },
      );
    });

    // Command /test: dispatch immediate interactive alert
    this.bot.command("test", async (ctx) => {
      this.subscribedChatIds.add(ctx.chat.id);
      const profiles = loadProfiles();
      const localNow = new Date();
      const tomorrow = new Date(
        localNow.getFullYear(),
        localNow.getMonth(),
        localNow.getDate() + 1,
      );
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
      const dd = String(tomorrow.getDate()).padStart(2, "0");
      const tomorrowStr = `${yyyy}-${mm}-${dd}`;

      await ctx.reply("🧪 *Generando alerta de prueba con botones interactivos...*", {
        parse_mode: "Markdown",
      });
      await this.sendAvailabilityAlert(
        {
          id: `test_6035_${tomorrowStr}_0830`,
          date: tomorrowStr,
          time: "08:30:00",
          status: "free",
          branch: "MEDELLIN – ANTIOQUIA – NUEVA EPS CR 46 #47 66 LOCAL 6035",
          specialty: "Agendamiento (Dispensación de Medicamentos)",
        },
        profiles,
      );
    });

    // Command /check: query live Qanty availability for both branches
    this.bot.command("check", async (ctx) => {
      this.subscribedChatIds.add(ctx.chat.id);
      await ctx.reply(
        "🔍 *Consultando disponibilidad en vivo en Medic Colombia para las Sedes 6035 y 118...*\nPor favor espera unos segundos mientras verificamos.",
        { parse_mode: "Markdown" },
      );

      try {
        const { QantyClient } = await import("../poller/qantyClient.js");
        const { RulesEngine } = await import("../poller/rulesEngine.js");
        const client = new QantyClient();
        const rules = new RulesEngine();
        const profiles = loadProfiles();

        let totalFound = 0;
        for (const branchId of env.TARGET_BRANCH_IDS) {
          const slots = await client.fetchDaySchedule({ branchId });
          const evaluation = rules.evaluate(slots, { branchId });

          if (evaluation.hasAvailability && evaluation.matchingSlots.length > 0) {
            totalFound += evaluation.matchingSlots.length;
            const earliestSlot = evaluation.matchingSlots[0];
            await ctx.reply(
              `✅ *¡Disponibilidad en Sede ${branchId}!* Se encontraron *${evaluation.matchingSlots.length}* turnos libres para mañana.\nMostrando la franja más próxima a continuación:`,
              { parse_mode: "Markdown" },
            );
            await this.sendAvailabilityAlert(earliestSlot, profiles);
          }
        }

        if (totalFound === 0) {
          await ctx.reply(
            "ℹ️ *Consulta Finalizada*\n\n" +
              "No se detectaron turnos disponibles en este momento que cumplan las reglas de negocio.\n" +
              "¡El monitor sigue activo en segundo plano y te alertará automáticamente apenas se libere un turno!",
            { parse_mode: "Markdown" },
          );
        }
      } catch (err: any) {
        await ctx.reply(`⚠️ *Error al consultar la disponibilidad:* ${err.message}`, {
          parse_mode: "Markdown",
        });
      }
    });

    // Command /profiles (with PII masking G-SEC-02)
    this.bot.command("profiles", async (ctx) => {
      const profiles = loadProfiles();
      if (profiles.length === 0) {
        await ctx.reply("⚠️ No se encontraron perfiles cargados en `profiles.json`.");
        return;
      }

      const list = profiles
        .map(
          (p) =>
            `• *${p.displayName}* (${p.documentType} \`${p.documentNumber.slice(-4).padStart(p.documentNumber.length, "*")}\`)`,
        )
        .join("\n");

      await ctx.reply(`📋 *Personas configuradas para agendamiento:*\n\n${list}`, {
        parse_mode: "Markdown",
      });
    });

    // Callback query handler for inline buttons: "book:<slotId>:<profileId>"
    this.bot.on("callback_query:data", async (ctx) => {
      const data = ctx.callbackQuery.data;

      if (data === "claim:yes") {
        const current = await this.statePort.getStatus();
        await this.statePort.setStatus(transitionMonitorStatus(current, "CLAIM_YES"));
        await ctx.answerCallbackQuery({ text: "Perfecto, monitoreo pausado." });
        await ctx.editMessageText(
          "✅ *Entendido, ya reclamaste tus medicamentos.*\n\nNo buscaré nada en la web. Si volvés a necesitar cita, enviá `/buscar`.",
          { parse_mode: "Markdown" },
        );
        return;
      }

      if (data === "claim:no") {
        const current = await this.statePort.getStatus();
        await this.statePort.setStatus(transitionMonitorStatus(current, "CLAIM_NO"));
        await ctx.answerCallbackQuery({ text: "Selecciona la sede..." });

        const branchKeyboard = new InlineKeyboard()
          .text("🏢 Promedan Piso 3", "branch:PISO3")
          .row()
          .text("🏢 Promedan Piso 6", "branch:PISO6")
          .row()
          .text("🔀 Ambas (PISO3 + PISO6)", "branch:ALL");

        await ctx.editMessageText(
          "📍 *Paso 2: ¿En cuál sede querés que busque y agende automáticamente?*\n\nTodavía no inicié la búsqueda web; apenas elijas una sede empiezo.",
          {
            parse_mode: "Markdown",
            reply_markup: branchKeyboard,
          },
        );
        return;
      }

      if (data.startsWith("branch:")) {
        const choice = data.replace("branch:", "");
        const selectedBranches = resolveSelectedBranches(choice, env.TARGET_BRANCH_IDS);
        await this.statePort.setSelectedBranches(selectedBranches);

        const current = await this.statePort.getStatus();
        await this.statePort.setStatus(transitionMonitorStatus(current, "BRANCH_SELECTED"));

        const label =
          choice === "ALL"
            ? "Promedan Piso 3 y Piso 6"
            : choice === "PISO3"
              ? "Promedan Piso 3"
              : choice === "PISO6"
                ? "Promedan Piso 6"
                : `Sede ${choice}`;

        await ctx.answerCallbackQuery({ text: `Buscando en ${label}...` });
        await ctx.editMessageText(
          `🔍 *Perfecto, empiezo a buscar citas en:* \`${label}\`.\n\nTe avisaré apenas aparezca un turno disponible.`,
          { parse_mode: "Markdown" },
        );
        if (this.onActivate) {
          await this.onActivate();
        }
        return;
      }

      if (data.startsWith("dismiss:")) {
        await ctx.answerCallbackQuery({ text: "Alerta descartada." });
        await ctx.editMessageText("❌ *Alerta descartada por el usuario.*", {
          parse_mode: "Markdown",
        });
        return;
      }

      if (data.startsWith("book:")) {
        const parts = data.split(":");
        const slotKey = parts[1];
        const profileId = parts[2];

        const slot = this.activeSlots.get(slotKey);
        const profile = getProfileById(profileId);

        if (!profile) {
          await ctx.answerCallbackQuery({ text: "Error: Perfil no encontrado." });
          return;
        }

        await ctx.answerCallbackQuery({
          text: `Iniciando agendamiento para ${profile.displayName}...`,
        });
        await ctx.reply(
          `🚀 *Iniciando agendamiento automático para ${profile.displayName}...*\nPor favor espera mientras el sistema diligencia el formulario en Medic Colombia.`,
          { parse_mode: "Markdown" },
        );

        // Fallback slot if active memory expired
        const effectiveSlot: QantySlot = slot || {
          date: "Próxima fecha disponible",
          status: "free",
        };

        // Execute browser booking
        const result = await this.booker.bookAppointment(effectiveSlot, profile);

        if (result.success) {
          const successMsg =
            `✅ *¡Cita Agendada Exitosamente!*\n\n` +
            `👤 *Paciente:* ${profile.displayName}\n` +
            `📅 *Fecha:* ${result.slotDate} ${result.slotTime || ""}\n` +
            `💬 *Resultado:* ${result.message}`;

          if (result.screenshotPath && fs.existsSync(result.screenshotPath)) {
            await ctx.replyWithPhoto(new InputFile(result.screenshotPath), {
              caption: successMsg,
              parse_mode: "Markdown",
            });
          } else {
            await ctx.reply(successMsg, { parse_mode: "Markdown" });
          }
        } else {
          const errorMsg =
            `❌ *No se pudo agendar la cita para ${profile.displayName}*\n\n` +
            `⚠️ Motivo: ${result.message}`;

          if (result.screenshotPath && fs.existsSync(result.screenshotPath)) {
            await ctx.replyWithPhoto(new InputFile(result.screenshotPath), {
              caption: errorMsg,
              parse_mode: "Markdown",
            });
          } else {
            await ctx.reply(errorMsg, { parse_mode: "Markdown" });
          }
        }
      }
    });

    this.bot.catch((err) => {
      console.error("[TelegramBot] Telegram bot error:", err);
    });
  }

  /**
   * Starts the bot in long polling mode
   */
  public async start(): Promise<void> {
    if (!this.bot) {
      console.log("[TelegramBot] Offline/mock mode active.");
      return;
    }
    console.log("[TelegramBot] Starting Telegram bot...");
    this.bot
      .start({
        onStart: (info) => {
          console.log(`[TelegramBot] Bot connected as @${info.username}`);
        },
      })
      .catch((error) => {
        console.error("[TelegramBot] Failed to start long polling:", error);
      });
  }

  public async notifyBookingOutcome(result: BookingResult, profile: Profile): Promise<void> {
    const caption = result.success
      ? `✅ *¡Cita Agendada Automáticamente!*\n\n` +
        `👤 *Paciente:* ${profile.displayName}\n` +
        `📅 *Fecha:* ${result.slotDate} ${result.slotTime || ""}\n` +
        `💬 *Resultado:* ${result.message}`
      : `❌ *Auto-agendamiento detenido para ${profile.displayName}*\n\n` +
        `⚠️ Motivo: ${result.message}`;

    const recipients = this.getAuthorizedRecipients();
    if (!this.bot || recipients.length === 0) {
      console.log(`[TelegramBot Mock Booking Outcome]\n${caption}`);
      return;
    }

    for (const chatId of recipients) {
      try {
        if (result.screenshotPath && fs.existsSync(result.screenshotPath)) {
          await this.bot.api.sendPhoto(chatId, new InputFile(result.screenshotPath), {
            caption,
            parse_mode: "Markdown",
          });
        } else {
          await this.bot.api.sendMessage(chatId, caption, { parse_mode: "Markdown" });
        }
      } catch (error: any) {
        console.error(
          `[TelegramBot] Failed to send booking outcome to chat ${chatId}:`,
          error.message,
        );
      }
    }
  }

  /**
   * Sends the pre-search medication-claim confirmation prompt.
   * Web polling remains idle until the user explicitly confirms they still need an appointment.
   */
  public async sendClaimCheckPrompt(): Promise<void> {
    const message =
      "💊 *Antes de buscar en la web:*\n\n" +
      "¿Ya reclamaste tus medicamentos?\n\n" +
      "• Si respondés *Sí*, no haré ninguna búsqueda.\n" +
      "• Si respondés *No*, iniciaré el monitoreo automático en Qanty (PISO3 y 118).";

    const keyboard = new InlineKeyboard()
      .text("✅ Sí, ya los reclamé", "claim:yes")
      .row()
      .text("🔍 No, aún los necesito (buscar)", "claim:no");

    const recipients = this.getAuthorizedRecipients();
    if (this.bot && recipients.length > 0) {
      for (const chatId of recipients) {
        try {
          await this.bot.api.sendMessage(chatId, message, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          });
        } catch (error: any) {
          console.error(
            `[TelegramBot] Failed to send claim-check prompt to chat ${chatId}:`,
            error.message,
          );
        }
      }
    } else {
      console.log(`[TelegramBot Mock Claim-Check Prompt]\n${message}`);
    }
  }

  private getAuthorizedRecipients(): (string | number)[] {
    const recipients: (string | number)[] = [];
    const addRecipient = (chatId: string | number | undefined) => {
      if (chatId === undefined) return;
      if (!isAllowedTelegramId(chatId, this.allowedChatIds)) return;
      if (!recipients.includes(chatId)) recipients.push(chatId);
    };

    addRecipient(env.TELEGRAM_CHAT_ID);
    for (const chatId of this.subscribedChatIds) addRecipient(chatId);
    return recipients;
  }

  /**
   * Dispatches an alert with an Inline Keyboard for each profile
   */
  public async sendAvailabilityAlert(
    slot: QantySlot,
    profiles: Profile[],
    totalBranchSlots: number = 1,
  ): Promise<void> {
    const slotKey = `${slot.date}_${slot.time || "all"}_${slot.id || Date.now()}`;
    this.activeSlots.set(slotKey, slot);

    const digestLine =
      totalBranchSlots > 1
        ? `📊 *Turnos libres detectados en esta sede:* \`${totalBranchSlots}\` (mostrando el más próximo)\n`
        : "";

    const message =
      `🚨 *¡TURNO DISPONIBLE DE MEDICAMENTOS DETECTADO!*\n\n` +
      digestLine +
      `📅 *Fecha:* \`${slot.date}\`\n` +
      `⏰ *Hora:* \`${slot.time || "Consultar portal"}\`\n` +
      `🏢 *Sede:* ${slot.branch || "Sede Principal"}\n` +
      `💊 *Servicio:* ${slot.specialty || "Dispensación Nueva EPS"}\n\n` +
      `👇 *Selecciona la persona a quien agendar con 1-clic:*`;

    const keyboard = new InlineKeyboard();

    profiles.forEach((profile, index) => {
      keyboard.text(`👤 ${profile.displayName}`, `book:${slotKey}:${profile.id}`);
      if (index % 2 === 1) keyboard.row(); // 2 buttons per row
    });

    if (profiles.length % 2 !== 0) keyboard.row();
    keyboard.text("❌ Descartar", `dismiss:${slotKey}`);

    const recipients = this.getAuthorizedRecipients();

    if (this.bot && recipients.length > 0) {
      for (const chatId of recipients) {
        try {
          await this.bot.api.sendMessage(chatId, message, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          });
          console.log(`[TelegramBot] Alert sent successfully to chat ${chatId}`);
        } catch (error: any) {
          console.error(`[TelegramBot] Failed to send alert to chat ${chatId}:`, error.message);
        }
      }
    } else {
      if (this.bot) {
        console.warn(
          "[TelegramBot] No allowed recipients available. Alert was not sent to Telegram.",
        );
      }
      console.log(
        `[TelegramBot Mock Alert]\n${message}\nButtons: ${profiles.map((p) => p.displayName).join(", ")}`,
      );
    }
  }
}
