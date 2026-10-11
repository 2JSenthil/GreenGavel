import { after } from "next/server";
import { getBot } from "@/lib/bot";

export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  let bot;
  try {
    bot = getBot();
  } catch {
    return new Response("Photon configuration is incomplete", { status: 503 });
  }
  // The adapter verifies Photon signatures before dispatching messages.
  return bot.webhooks.imessage(request, {
    waitUntil: (task) => after(() => task),
  });
}
