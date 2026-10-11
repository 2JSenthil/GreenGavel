import { Chat } from "chat";
import { createiMessageAdapter } from "@photon-ai/chat-adapter-imessage";
import { createMemoryState } from "@chat-adapter/state-memory";
import { askBackend } from "./photon-answer";

let bot: Chat<{ imessage: ReturnType<typeof createiMessageAdapter> }> | undefined;

export function getBot() {
  if (bot) return bot;
  const projectId = process.env.IMESSAGE_PROJECT_ID;
  const projectSecret = process.env.IMESSAGE_PROJECT_SECRET;
  const webhookSecret = process.env.IMESSAGE_WEBHOOK_SECRET;
  if (!projectId || !projectSecret || !webhookSecret || !process.env.BACKEND_URL) {
    throw new Error("Photon configuration is incomplete");
  }
  bot = new Chat({
    userName: "Green Gavel",
    adapters: {
      imessage: createiMessageAdapter({ local: false, projectId, projectSecret, webhookSecret }),
    },
    state: createMemoryState(),
  });
  bot.onDirectMessage(async (thread, message) => {
    const question = message.text.trim();
    if (!question || message.author.isMe) return;
    let reply: string;
    try {
      reply = await askBackend(question);
    } catch {
      // Do not log message content, provider URLs, or credentials.
      console.error("Photon backend answer failed");
      reply = "Unable to generate an answer. Please try again in a moment.";
    }
    await thread.post(reply);
  });
  return bot;
}
