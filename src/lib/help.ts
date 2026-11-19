/**
 * The answer of the command `help`: what the instance answers, written for AI agents (e.g. ioBroker.pi-agent, or the
 * MCP server with `send_to`) and script authors. Keep it in sync with onMessage() in main.ts and the README.
 */

/** The commands onMessage() answers; write = the command has an effect (sends a message) */
export const COMMANDS: { command: string; write: boolean }[] = [
    { command: 'help', write: false },
    { command: 'send', write: true },
    { command: 'sendNotification', write: true },
];

export const HELP = `ioBroker.gotify: sends push notifications to a Gotify server; every client (app, browser) of the
Gotify user who owns the application gets them. An agent can send a message with title and priority; it cannot
receive messages.

Commands (sendTo gotify.0):
- send {message, title?, priority?, contentType?, token?}: sends a push notification. message: the text (required).
  title: default the name of the application in Gotify. priority: 0 to 10, default the default priority of the
  application; in the Android app 0 = no notification, 1-3 = silent, 4-7 = with sound, 8-10 = also vibration.
  contentType: "text/plain" (default) or "text/markdown". token: the token of another Gotify application instead of
  the one of the settings. Answer {sent: true | false}; on false info.lastError holds the reason.
- sendNotification: for the notification-manager, not for agents.

States (gotify.0.*): info.lastError (reason of the last failure, e.g. "HTTP 401" = wrong token, "ECONNREFUSED"),
info.lastSuccess (time of the last sent message), info.connection.

How to talk to the user:
- Without token the message goes to the Gotify application of the settings, usually the user's own. A token of
  another application (possibly of other people) only on the user's explicit request; ask for it if the recipient
  is not clear.
- Use priority 8 or more only for urgent messages.
- Tell the user whether the message was sent; on {sent: false} read info.lastError and say why.`;
