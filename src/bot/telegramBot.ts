import { Bot, InlineKeyboard, InputFile } from 'grammy';
import { env } from '../config/env.js';
import { loadProfiles, getProfileById } from '../config/profiles.js';
import { PlaywrightBooker } from '../automation/playwrightBooker.js';
import { QantySlot, Profile } from '../types/index.js';
import fs from 'fs';

export class TelegramBotService {
  private bot: Bot | null = null;
  private booker: PlaywrightBooker;
  // Memoria temporal de slots activos para los callbacks de los botones
  private activeSlots: Map<string, QantySlot> = new Map();

  constructor() {
    this.booker = new PlaywrightBooker();

    if (!env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN === 'tu_token_aqui' || env.TELEGRAM_BOT_TOKEN === 'mock_token') {
      console.warn('[TelegramBot] Token no configurado. El bot operará en modo consola / mock.');
      return;
    }

    this.bot = new Bot(env.TELEGRAM_BOT_TOKEN);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    if (!this.bot) return;

    // Comando /start
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        '👋 *¡Hola! Soy el Smart Medicine Scheduler Bot.*\n\n' +
        'Te notificaré de inmediato cuando se detecten citas disponibles en Qanty y te permitiré reservarlas con 1 clic.\n\n' +
        'Usa `/perfiles` para ver las personas configuradas.',
        { parse_mode: 'Markdown' }
      );
    });

    // Comando /perfiles
    this.bot.command('perfiles', async (ctx) => {
      const profiles = loadProfiles();
      if (profiles.length === 0) {
        await ctx.reply('⚠️ No hay perfiles cargados en `profiles.json`.');
        return;
      }

      const list = profiles
        .map((p) => `• *${p.displayName}* (${p.documentType} ${p.documentNumber})`)
        .join('\n');

      await ctx.reply(`📋 *Perfiles disponibles para agendamiento:*\n\n${list}`, {
        parse_mode: 'Markdown',
      });
    });

    // Manejador de callbacks de botones inline: "book:<slotId>:<profileId>"
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

        await ctx.answerCallbackQuery({ text: `Iniciando reserva para ${profile.displayName}...` });
        await ctx.reply(`🚀 *Iniciando Playwright automator para ${profile.displayName}...*\nEspere un momento mientras se completa el formulario.`, {
          parse_mode: 'Markdown',
        });

        // Crear slot de fallback si expiró de la memoria activa
        const effectiveSlot: QantySlot = slot || {
          date: 'Próxima fecha',
          status: 'free',
        };

        // Ejecutar automatización
        const result = await this.booker.bookAppointment(effectiveSlot, profile);

        if (result.success) {
          const successMsg =
            `✅ *¡Reserva completada!*\n\n` +
            `👤 *Persona:* ${profile.displayName}\n` +
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
            `❌ *Error al reservar para ${profile.displayName}*\n\n` +
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
      console.error('[TelegramBot] Error en el bot de Telegram:', err);
    });
  }

  /**
   * Inicia el bot en modo polling
   */
  public async start(): Promise<void> {
    if (!this.bot) {
      console.log('[TelegramBot] Modo offline/mock activo.');
      return;
    }
    console.log('[TelegramBot] Iniciando bot de Telegram...');
    this.bot.start({
      onStart: (info) => {
        console.log(`[TelegramBot] Bot conectado como @${info.username}`);
      },
    });
  }

  /**
   * Envía una alerta con Inline Keyboard con las opciones para cada perfil
   */
  public async sendAvailabilityAlert(slot: QantySlot, profiles: Profile[]): Promise<void> {
    const slotKey = `${slot.date}_${slot.time || 'all'}_${slot.id || Date.now()}`;
    this.activeSlots.set(slotKey, slot);

    const message =
      `🚨 *¡CITA DISPONIBLE ENCONTRADA EN QANTY!*\n\n` +
      `📅 *Fecha:* \`${slot.date}\`\n` +
      `⏰ *Hora:* \`${slot.time || 'Consultar'}\`\n` +
      `🏢 *Sede:* ${slot.branch || 'Sede Principal'}\n` +
      `💊 *Servicio:* ${slot.specialty || 'Dispensación Medicamentos'}\n\n` +
      `👇 *Selecciona la persona para agendar de inmediato:*`;

    const keyboard = new InlineKeyboard();

    profiles.forEach((profile, index) => {
      keyboard.text(`👤 ${profile.displayName}`, `book:${slotKey}:${profile.id}`);
      if (index % 2 === 1) keyboard.row(); // 2 botones por fila
    });

    if (profiles.length % 2 !== 0) keyboard.row();
    keyboard.text('❌ Descartar', `dismiss:${slotKey}`);

    if (this.bot && env.TELEGRAM_CHAT_ID && env.TELEGRAM_CHAT_ID !== 'mock_chat_id') {
      try {
        await this.bot.api.sendMessage(env.TELEGRAM_CHAT_ID, message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
        console.log(`[TelegramBot] Alerta enviada exitosamente al chat ${env.TELEGRAM_CHAT_ID}`);
      } catch (error: any) {
        console.error(`[TelegramBot] Error al enviar alerta a Telegram:`, error.message);
      }
    } else {
      console.log(`[TelegramBot Mock Alert]\n${message}\nBotones: ${profiles.map((p) => p.displayName).join(', ')}`);
    }
  }
}
