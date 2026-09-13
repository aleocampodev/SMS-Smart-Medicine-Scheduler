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
      await ctx.reply(
        '👋 *Hello! I am the Smart Medicine Scheduler Bot.*\n\n' +
        'I will notify you immediately when available medicine dispensing appointments are detected in Qanty, allowing 1-click booking.\n\n' +
        'Use `/profiles` to view all configured individuals.',
        { parse_mode: 'Markdown' }
      );
    });

    // Command /profiles (with PII masking G-SEC-02)
    this.bot.command('profiles', async (ctx) => {
      const profiles = loadProfiles();
      if (profiles.length === 0) {
        await ctx.reply('⚠️ No profiles loaded in `profiles.json`.');
        return;
      }

      const list = profiles
        .map((p) => `• *${p.displayName}* (${p.documentType} \`${p.documentNumber.slice(-4).padStart(p.documentNumber.length, '*')}\`)`)
        .join('\n');

      await ctx.reply(`📋 *Available profiles for scheduling:*\n\n${list}`, {
        parse_mode: 'Markdown',
      });
    });

    // Callback query handler for inline buttons: "book:<slotId>:<profileId>"
    this.bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;

      if (data.startsWith('dismiss:')) {
        await ctx.answerCallbackQuery({ text: 'Alert dismissed.' });
        await ctx.editMessageText('❌ *Alert dismissed by user.*', { parse_mode: 'Markdown' });
        return;
      }

      if (data.startsWith('book:')) {
        const parts = data.split(':');
        const slotKey = parts[1];
        const profileId = parts[2];

        const slot = this.activeSlots.get(slotKey);
        const profile = getProfileById(profileId);

        if (!profile) {
          await ctx.answerCallbackQuery({ text: 'Error: Profile not found.' });
          return;
        }

        await ctx.answerCallbackQuery({ text: `Starting booking for ${profile.displayName}...` });
        await ctx.reply(`🚀 *Launching Playwright automator for ${profile.displayName}...*\nPlease wait while the form is filled.`, {
          parse_mode: 'Markdown',
        });

        // Fallback slot if active memory expired
        const effectiveSlot: QantySlot = slot || {
          date: 'Next available date',
          status: 'free',
        };

        // Execute browser booking
        const result = await this.booker.bookAppointment(effectiveSlot, profile);

        if (result.success) {
          const successMsg =
            `✅ *Appointment Booking Completed!*\n\n` +
            `👤 *Person:* ${profile.displayName}\n` +
            `📅 *Date:* ${result.slotDate} ${result.slotTime || ''}\n` +
            `💬 *Result:* ${result.message}`;

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
            `❌ *Booking failed for ${profile.displayName}*\n\n` +
            `⚠️ Reason: ${result.message}`;

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
      `🚨 *AVAILABLE MEDICINE PICKUP SLOT DETECTED!*\n\n` +
      `📅 *Date:* \`${slot.date}\`\n` +
      `⏰ *Time:* \`${slot.time || 'Check portal'}\`\n` +
      `🏢 *Branch:* ${slot.branch || 'Main Branch'}\n` +
      `💊 *Service:* ${slot.specialty || 'Medicine Dispensing'}\n\n` +
      `👇 *Select profile to book immediately:*`;

    const keyboard = new InlineKeyboard();

    profiles.forEach((profile, index) => {
      keyboard.text(`👤 ${profile.displayName}`, `book:${slotKey}:${profile.id}`);
      if (index % 2 === 1) keyboard.row(); // 2 buttons per row
    });

    if (profiles.length % 2 !== 0) keyboard.row();
    keyboard.text('❌ Dismiss', `dismiss:${slotKey}`);

    if (this.bot && env.TELEGRAM_CHAT_ID && env.TELEGRAM_CHAT_ID !== 'mock_chat_id') {
      try {
        await this.bot.api.sendMessage(env.TELEGRAM_CHAT_ID, message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
        console.log(`[TelegramBot] Alert sent successfully to chat ${env.TELEGRAM_CHAT_ID}`);
      } catch (error: any) {
        console.error(`[TelegramBot] Failed to send alert to Telegram:`, error.message);
      }
    } else {
      console.log(`[TelegramBot Mock Alert]\n${message}\nButtons: ${profiles.map((p) => p.displayName).join(', ')}`);
    }
  }
}
