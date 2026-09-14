import { Bot, InlineKeyboard, InputFile } from 'grammy';
import { env } from '../config/env.js';
import { loadProfiles, getProfileById } from '../config/profiles.js';
import { PlaywrightBooker } from '../automation/playwrightBooker.js';
import { QantySlot, Profile } from '../types/index.js';
import fs from 'fs';

export class TelegramBotService {
  private bot: Bot | null = null;
  private booker: PlaywrightBooker;
  // Temporary storage of active slots for button callbacks
  private activeSlots: Map<string, QantySlot> = new Map();
  // Set of actively subscribed chat IDs (e.g. from /start interaction)
  private subscribedChatIds: Set<string | number> = new Set();

  constructor() {
    this.booker = new PlaywrightBooker();

    if (!env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN === 'your_token_here' || env.TELEGRAM_BOT_TOKEN === 'mock_token') {
      console.warn('[TelegramBot] Token not configured. The bot will operate in console/mock mode.');
      return;
    }

    this.bot = new Bot(env.TELEGRAM_BOT_TOKEN);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    if (!this.bot) return;

    // Command /start
    this.bot.command('start', async (ctx) => {
      this.subscribedChatIds.add(ctx.chat.id);
      console.log(`[TelegramBot] /start received from chat ID: ${ctx.chat.id}. Added to active recipients.`);
      await ctx.reply(
        '👋 *¡Hola! Soy el bot de Smart Medicine Scheduler (SMSBot).*\n\n' +
        `✅ *¡Conexión activada con éxito!* Tu ID de chat es: \`${ctx.chat.id}\`\n\n` +
        '📍 *Sedes Monitoreadas:*\n' +
        '• *Sede 6035:* Nueva EPS CR 46 #47 66 Local 6035 (Av. Oriental)\n' +
        '• *Sede 118:* Promedan CR 49 #44 99 Local 118\n\n' +
        '⚡ *Comandos Disponibles:*\n' +
        '• `/check` — Consultar disponibilidad en vivo en este momento\n' +
        '• `/test` — Enviar una alerta de prueba con botones interactivos\n' +
        '• `/profiles` — Ver personas configuradas para agendamiento\n\n' +
        'Estoy monitoreando la plataforma Medic Colombia en segundo plano. Te enviaré una alerta inmediata aquí con botones de 1-clic apenas se libere un turno.',
        { parse_mode: 'Markdown' }
      );

      // Immediately send a test alert so the user can verify buttons
      const profiles = loadProfiles();
      const localNow = new Date();
      const tomorrow = new Date(localNow.getFullYear(), localNow.getMonth(), localNow.getDate() + 1);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      const tomorrowStr = `${yyyy}-${mm}-${dd}`;

      await this.sendAvailabilityAlert(
        {
          id: `test_6035_${tomorrowStr}_0800`,
          date: tomorrowStr,
          time: '08:00:00',
          status: 'free',
          branch: 'MEDELLIN – ANTIOQUIA – NUEVA EPS CR 46 #47 66 LOCAL 6035',
          specialty: 'Agendamiento (Dispensación de Medicamentos)',
        },
        profiles
      );
    });

    // Command /test: dispatch immediate interactive alert
    this.bot.command('test', async (ctx) => {
      this.subscribedChatIds.add(ctx.chat.id);
      const profiles = loadProfiles();
      const localNow = new Date();
      const tomorrow = new Date(localNow.getFullYear(), localNow.getMonth(), localNow.getDate() + 1);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      const tomorrowStr = `${yyyy}-${mm}-${dd}`;

      await ctx.reply('🧪 *Generando alerta de prueba con botones interactivos...*', { parse_mode: 'Markdown' });
      await this.sendAvailabilityAlert(
        {
          id: `test_6035_${tomorrowStr}_0830`,
          date: tomorrowStr,
          time: '08:30:00',
          status: 'free',
          branch: 'MEDELLIN – ANTIOQUIA – NUEVA EPS CR 46 #47 66 LOCAL 6035',
          specialty: 'Agendamiento (Dispensación de Medicamentos)',
        },
        profiles
      );
    });

    // Command /check: query live Qanty availability for both branches
    this.bot.command('check', async (ctx) => {
      this.subscribedChatIds.add(ctx.chat.id);
      await ctx.reply(
        '🔍 *Consultando disponibilidad en vivo en Medic Colombia para las Sedes 6035 y 118...*\nPor favor espera unos segundos mientras verificamos.',
        { parse_mode: 'Markdown' }
      );

      try {
        const { QantyClient } = await import('../poller/qantyClient.js');
        const { RulesEngine } = await import('../poller/rulesEngine.js');
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
              { parse_mode: 'Markdown' }
            );
            await this.sendAvailabilityAlert(earliestSlot, profiles);
          }
        }

        if (totalFound === 0) {
          await ctx.reply(
            'ℹ️ *Consulta Finalizada*\n\n' +
            'No se detectaron turnos disponibles en este momento que cumplan las reglas de negocio.\n' +
            '¡El monitor sigue activo en segundo plano y te alertará automáticamente apenas se libere un turno!',
            { parse_mode: 'Markdown' }
          );
        }
      } catch (err: any) {
        await ctx.reply(`⚠️ *Error al consultar la disponibilidad:* ${err.message}`, { parse_mode: 'Markdown' });
      }
    });

    // Command /profiles (with PII masking G-SEC-02)
    this.bot.command('profiles', async (ctx) => {
      const profiles = loadProfiles();
      if (profiles.length === 0) {
        await ctx.reply('⚠️ No se encontraron perfiles cargados en `profiles.json`.');
        return;
      }

      const list = profiles
        .map((p) => `• *${p.displayName}* (${p.documentType} \`${p.documentNumber.slice(-4).padStart(p.documentNumber.length, '*')}\`)`)
        .join('\n');

      await ctx.reply(`📋 *Personas configuradas para agendamiento:*\n\n${list}`, {
        parse_mode: 'Markdown',
      });
    });

    // Callback query handler for inline buttons: "book:<slotId>:<profileId>"
    this.bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;

      if (data.startsWith('dismiss:')) {
        await ctx.answerCallbackQuery({ text: 'Alerta descartada.' });
        await ctx.editMessageText('❌ *Alerta descartada por el usuario.*', { parse_mode: 'Markdown' });
        return;
      }

      if (data.startsWith('book:')) {
        const parts = data.split(':');
        const slotKey = parts[1];
        const profileId = parts[2];

        const slot = this.activeSlots.get(slotKey);
        const profile = getProfileById(profileId);

        if (!profile) {
          await ctx.answerCallbackQuery({ text: 'Error: Perfil no encontrado.' });
          return;
        }

        await ctx.answerCallbackQuery({ text: `Iniciando agendamiento para ${profile.displayName}...` });
        await ctx.reply(
          `🚀 *Iniciando agendamiento automático para ${profile.displayName}...*\nPor favor espera mientras el sistema diligencia el formulario en Medic Colombia.`,
          { parse_mode: 'Markdown' }
        );

        // Fallback slot if active memory expired
        const effectiveSlot: QantySlot = slot || {
          date: 'Próxima fecha disponible',
          status: 'free',
        };

        // Execute browser booking
        const result = await this.booker.bookAppointment(effectiveSlot, profile);

        if (result.success) {
          const successMsg =
            `✅ *¡Cita Agendada Exitosamente!*\n\n` +
            `👤 *Paciente:* ${profile.displayName}\n` +
            `📅 *Fecha:* ${result.slotDate} ${result.slotTime || ''}\n` +
            `💬 *Resultado:* ${result.message}`;

          if (result.screenshotPath && fs.existsSync(result.screenshotPath)) {
            await ctx.replyWithPhoto(new InputFile(result.screenshotPath), {
              caption: successMsg,
              parse_mode: 'Markdown',
            });
          } else {
            await ctx.reply(successMsg, { parse_mode: 'Markdown' });
          }
        } else {
          const errorMsg =
            `❌ *No se pudo agendar la cita para ${profile.displayName}*\n\n` +
            `⚠️ Motivo: ${result.message}`;

          if (result.screenshotPath && fs.existsSync(result.screenshotPath)) {
            await ctx.replyWithPhoto(new InputFile(result.screenshotPath), {
              caption: errorMsg,
              parse_mode: 'Markdown',
            });
          } else {
            await ctx.reply(errorMsg, { parse_mode: 'Markdown' });
          }
        }
      }
    });

    this.bot.catch((err) => {
      console.error('[TelegramBot] Telegram bot error:', err);
    });
  }

  /**
   * Starts the bot in long polling mode
   */
  public async start(): Promise<void> {
    if (!this.bot) {
      console.log('[TelegramBot] Offline/mock mode active.');
      return;
    }
    console.log('[TelegramBot] Starting Telegram bot...');
    this.bot.start({
      onStart: (info) => {
        console.log(`[TelegramBot] Bot connected as @${info.username}`);
      },
    });
  }

  /**
   * Dispatches an alert with an Inline Keyboard for each profile
   */
  public async sendAvailabilityAlert(slot: QantySlot, profiles: Profile[]): Promise<void> {
    const slotKey = `${slot.date}_${slot.time || 'all'}_${slot.id || Date.now()}`;
    this.activeSlots.set(slotKey, slot);

    const message =
      `🚨 *¡TURNO DISPONIBLE DE MEDICAMENTOS DETECTADO!*\n\n` +
      `📅 *Fecha:* \`${slot.date}\`\n` +
      `⏰ *Hora:* \`${slot.time || 'Consultar portal'}\`\n` +
      `🏢 *Sede:* ${slot.branch || 'Sede Principal'}\n` +
      `💊 *Servicio:* ${slot.specialty || 'Dispensación Nueva EPS'}\n\n` +
      `👇 *Selecciona la persona a quien agendar con 1-clic:*`;

    const keyboard = new InlineKeyboard();

    profiles.forEach((profile, index) => {
      keyboard.text(`👤 ${profile.displayName}`, `book:${slotKey}:${profile.id}`);
      if (index % 2 === 1) keyboard.row(); // 2 buttons per row
    });

    if (profiles.length % 2 !== 0) keyboard.row();
    keyboard.text('❌ Descartar', `dismiss:${slotKey}`);

    const recipients: (string | number)[] = [];
    if (env.TELEGRAM_CHAT_ID && env.TELEGRAM_CHAT_ID !== 'mock_chat_id' && env.TELEGRAM_CHAT_ID.trim() !== '') {
      recipients.push(env.TELEGRAM_CHAT_ID);
    }
    for (const chatId of this.subscribedChatIds) {
      if (!recipients.includes(chatId)) {
        recipients.push(chatId);
      }
    }

    if (this.bot && recipients.length > 0) {
      for (const chatId of recipients) {
        try {
          await this.bot.api.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
          });
          console.log(`[TelegramBot] Alert sent successfully to chat ${chatId}`);
        } catch (error: any) {
          console.error(`[TelegramBot] Failed to send alert to chat ${chatId}:`, error.message);
        }
      }
    } else {
      console.log(`[TelegramBot Mock Alert]\n${message}\nButtons: ${profiles.map((p) => p.displayName).join(', ')}`);
    }
  }
}
