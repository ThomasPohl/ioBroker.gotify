"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_axios = __toESM(require("axios"));
class Gotify extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: "gotify"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    await this.setState("info.connection", false, true);
    if (this.config.token && (!this.supportsFeature || !this.supportsFeature("ADAPTER_AUTO_DECRYPT_NATIVE"))) {
      this.config.token = this.decrypt(this.config.token);
    }
    await this.encryptPrivateKeyIfNeeded();
    if (this.config.url && this.config.token) {
      try {
        await import_axios.default.get(`${this.config.url.replace(/\/+$/, "")}/health`, { timeout: 1e3 });
        await this.setState("info.connection", true, true);
        this.log.info("Gotify adapter configured");
      } catch (error) {
        const errorMessage = this.getSafeErrorMessage(error);
        await this.setState("info.lastError", errorMessage, true);
        this.log.warn(`Could not connect to Gotify server: ${errorMessage}`);
      }
    } else {
      this.log.warn("Gotify adapter not configured");
    }
  }
  async encryptPrivateKeyIfNeeded() {
    var _a;
    const instanceId = `system.adapter.${this.name}.${this.instance}`;
    const instanceObject = await this.getForeignObjectAsync(instanceId);
    const storedToken = (_a = instanceObject == null ? void 0 : instanceObject.native) == null ? void 0 : _a.token;
    if (instanceObject && typeof storedToken === "string" && storedToken.length > 0 && !storedToken.startsWith("$/aes")) {
      instanceObject.native.token = this.encrypt(storedToken);
      await this.extendForeignObjectAsync(instanceId, instanceObject);
      this.log.info("Gotify token is now stored encrypted");
    }
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   *
   * @param callback Callback to be called after shutdown
   */
  onUnload(callback) {
    try {
      callback();
    } catch (e) {
      this.log.error(`Error during unload: ${JSON.stringify(e)}`);
      callback();
    }
  }
  async onMessage(obj) {
    if (typeof obj === "object" && obj.message) {
      if (obj.command === "send") {
        const sent = await this.sendMessage(obj.message);
        if (obj.callback) {
          this.sendTo(obj.from, obj.command, { sent }, obj.callback);
        }
      } else if (obj.command === "sendNotification") {
        await this.processNotification(obj);
      }
    }
  }
  async processNotification(obj) {
    let sent = false;
    try {
      sent = await this.sendMessage(this.formatNotification(obj.message));
    } catch {
      sent = false;
      await this.setState("info.lastError", "Unexpected error", true);
    }
    if (obj.callback) {
      this.sendTo(obj.from, "sendNotification", { sent }, obj.callback);
    }
  }
  formatNotification(notification) {
    const instances = notification.category.instances;
    const readableInstances = Object.entries(instances).map(
      ([instance, entry]) => `${instance.substring("system.adapter.".length)}: ${this.getLatestMessage(entry.messages)}`
    );
    const text = `${notification.category.description}
        ${notification.host}:
        ${readableInstances.join("\n")}
            `;
    return {
      message: text,
      title: notification.category.name,
      priority: this.getPriority(notification.severity),
      contentType: "text/plain"
    };
  }
  getPriority(severity) {
    switch (severity) {
      case "notify":
        return 1;
      case "info":
        return 4;
      case "alert":
        return 10;
      default:
        return 4;
    }
  }
  async sendMessage(message) {
    const token = message.token || this.config.token;
    if (this.config.url && token) {
      try {
        await import_axios.default.post(
          `${this.config.url.replace(/\/+$/, "")}/message`,
          {
            title: message.title,
            message: message.message,
            priority: message.priority,
            extras: {
              "client::display": {
                contentType: message.contentType
              }
            }
          },
          {
            timeout: 1e3,
            headers: { "X-Gotify-Key": token }
          }
        );
        await this.setState("info.connection", true, true);
        await this.setState("info.lastSuccess", Date.now(), true);
        await this.setState("info.lastError", "", true);
        this.log.debug("Successfully sent message to gotify");
        return true;
      } catch (error) {
        const errorMessage = this.getSafeErrorMessage(error);
        await this.setState("info.connection", false, true);
        await this.setState("info.lastError", errorMessage, true);
        this.log.error(`Error while sending message to gotify: ${errorMessage}`);
        return false;
      }
    } else {
      await this.setState("info.connection", false, true);
      await this.setState("info.lastError", "Gotify is not configured", true);
      this.log.error("Cannot send notification while Gotify is not configured");
      return false;
    }
  }
  getSafeErrorMessage(error) {
    if (import_axios.default.isAxiosError(error)) {
      if (error.response) {
        return `HTTP ${error.response.status}`;
      }
      return error.code || "Network error";
    }
    return "Unexpected error";
  }
  getLatestMessage(messages) {
    const latestMessage = messages.sort((a, b) => a.ts < b.ts ? 1 : -1)[0];
    return `${new Date(latestMessage.ts).toLocaleString()} ${latestMessage.message}`;
  }
}
if (require.main !== module) {
  module.exports = (options) => new Gotify(options);
} else {
  (() => new Gotify())();
}
//# sourceMappingURL=main.js.map
