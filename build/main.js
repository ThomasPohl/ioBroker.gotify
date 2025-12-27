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
  async migrateConfigurationIfNeeded() {
    this.log.info(`Checking adapter configuration for migration needs...${JSON.stringify(this.config)}`);
    if (this.config.token && this.config.tokens && this.config.tokens.length === 0) {
      this.log.info("Old adapter configuration detected, performing migration...");
      const alias = "default";
      this.config.tokens = [{ alias, token: this.config.token }];
      this.config.defaultTokenAlias = alias;
      this.config.token = "";
      this.log.info("Adapter configuration migrated to multi-token structure.");
      const obj = await this.getForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`);
      if (obj && obj.native) {
        let changed = false;
        if (!Array.isArray(obj.native.tokens) || JSON.stringify(obj.native.tokens) !== JSON.stringify(this.config.tokens)) {
          obj.native.tokens = this.config.tokens;
          changed = true;
        }
        if (obj.native.defaultTokenAlias !== this.config.defaultTokenAlias) {
          obj.native.defaultTokenAlias = this.config.defaultTokenAlias;
          changed = true;
        }
        if ("token" in obj.native) {
          delete obj.native.token;
          changed = true;
        }
        if (changed) {
          await this.extendForeignObject(`system.adapter.${this.name}.${this.instance}`, obj);
        }
      }
    }
    this.log.debug(`config url: ${this.config.url}`);
    this.log.debug(`config tokens: ${JSON.stringify(this.config.tokens)}`);
    this.log.debug(`config defaultTokenAlias: ${this.config.defaultTokenAlias}`);
    let tokensDecrypted = false;
    if (this.config.tokens && Array.isArray(this.config.tokens)) {
      for (const t of this.config.tokens) {
        if (!this.supportsFeature || !this.supportsFeature("ADAPTER_AUTO_DECRYPT_NATIVE")) {
          if (t.token && t.token.startsWith("$/aes")) {
            t.token = this.decrypt(t.token);
            tokensDecrypted = true;
          }
        }
      }
    }
    if (tokensDecrypted) {
      let foundDefault = false;
      let defaultAlias = "";
      const defaultIndices = this.config.tokens.map((t, i) => t.isDefault ? i : -1).filter((i) => i !== -1);
      if (defaultIndices.length === 1) {
        foundDefault = true;
        defaultAlias = this.config.tokens[defaultIndices[0]].alias || "";
      } else if (defaultIndices.length > 1) {
        for (let i = 0; i < this.config.tokens.length; i++) {
          this.config.tokens[i].isDefault = i === defaultIndices[0];
        }
        foundDefault = true;
        defaultAlias = this.config.tokens[defaultIndices[0]].alias || "";
      }
      if (!foundDefault || !defaultAlias) {
        this.config.tokens.forEach((t, i) => t.isDefault = i === 0);
        defaultAlias = this.config.tokens[0].alias || "";
      }
      this.config.defaultTokenAlias = defaultAlias;
      const obj = await this.getForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`);
      if (obj && obj.native) {
        let changed = false;
        if (!Array.isArray(obj.native.tokens) || JSON.stringify(obj.native.tokens) !== JSON.stringify(this.config.tokens)) {
          obj.native.tokens = this.config.tokens;
          changed = true;
          this.log.info("Tokens changed during decryption migration.");
        }
        if (obj.native.defaultTokenAlias !== defaultAlias) {
          obj.native.defaultTokenAlias = defaultAlias;
          changed = true;
          this.log.info("defaultTokenAlias changed during decryption migration.");
        }
        if (changed) {
          this.log.info("Saving decrypted tokens back to adapter configuration.");
          this.extendForeignObject(`system.adapter.${this.name}.${this.instance}`, obj);
        }
      }
    }
    await this.encryptTokensIfNeeded();
    if (this.config.url && this.config.tokens && this.config.tokens.length > 0) {
      await this.setState("info.connection", true, true);
      this.log.info("Gotify adapter konfiguriert");
    } else {
      await this.setState("info.connection", false, true);
      this.log.warn("Gotify adapter nicht konfiguriert");
    }
    await this.encryptPrivateKeyIfNeeded();
    this.log.info("Migration check completed.");
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    this.log.info("Gotify adapter starting");
    await this.migrateConfigurationIfNeeded();
    if (this.config.tokens && Array.isArray(this.config.tokens) && this.config.tokens.length > 0) {
      let foundDefault = false;
      let defaultAlias = "";
      const defaultIndices = this.config.tokens.map((t, i) => t.isDefault ? i : -1).filter((i) => i !== -1);
      if (defaultIndices.length === 1) {
        foundDefault = true;
        defaultAlias = this.config.tokens[defaultIndices[0]].alias || "";
      } else if (defaultIndices.length > 1) {
        for (let i = 0; i < this.config.tokens.length; i++) {
          this.config.tokens[i].isDefault = i === defaultIndices[0];
        }
        foundDefault = true;
        defaultAlias = this.config.tokens[defaultIndices[0]].alias || "";
      }
      if (!foundDefault || !defaultAlias) {
        this.config.tokens.forEach((t, i) => t.isDefault = i === 0);
        defaultAlias = this.config.tokens[0].alias || "";
      }
      this.config.defaultTokenAlias = defaultAlias;
      const obj = await this.getForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`);
      if (obj && obj.native) {
        let changed = false;
        if (obj.native.defaultTokenAlias !== defaultAlias) {
          obj.native.defaultTokenAlias = defaultAlias;
          changed = true;
        }
        if (!Array.isArray(obj.native.tokens) || JSON.stringify(obj.native.tokens) !== JSON.stringify(this.config.tokens)) {
          obj.native.tokens = this.config.tokens;
          changed = true;
        }
        if (changed) {
          this.extendForeignObject(`system.adapter.${this.name}.${this.instance}`, obj);
        }
      }
    }
    if (this.config.tokens && Array.isArray(this.config.tokens)) {
      const obj = await this.getForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`);
      if (obj && obj.native && (!Array.isArray(obj.native.tokens) || JSON.stringify(obj.native.tokens) !== JSON.stringify(this.config.tokens))) {
        obj.native.tokens = this.config.tokens;
        this.extendForeignObject(`system.adapter.${this.name}.${this.instance}`, obj);
      }
    }
    this.log.info("Gotify adapter started");
  }
  // Legacy: For migration of old instances, can be removed later
  async encryptPrivateKeyIfNeeded() {
    const obj = await this.getForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`);
    if (obj && obj.native && obj.native.token && !obj.native.token.startsWith("$/aes")) {
      obj.native.token = this.encrypt(obj.native.token);
      this.extendForeignObject(`system.adapter.${this.name}.${this.instance}`, obj);
      this.log.info("token is now stored encrypted");
    }
  }
  /**
   * Encrypts all tokens in the array if they are still unencrypted and saves them persistently.
   */
  async encryptTokensIfNeeded() {
    const obj = await this.getForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`);
    let changed = false;
    if (obj && obj.native && Array.isArray(obj.native.tokens)) {
      for (const t of obj.native.tokens) {
        if (t.token && !t.token.startsWith("$/aes")) {
          t.token = this.encrypt(t.token);
          changed = true;
        }
      }
      if (changed) {
        this.extendForeignObject(`system.adapter.${this.name}.${this.instance}`, obj);
        this.log.info("All tokens are now stored encrypted");
      }
    }
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   *
   * @param callback Callback to be called after shutdown
   */
  onUnload(callback) {
    this.log.info("Gotify adapter shutting down...");
    try {
      callback();
    } catch (e) {
      this.log.error(`Error during unload: ${JSON.stringify(e)}`);
      callback();
    }
  }
  onMessage(obj) {
    this.log.info(`Received message: ${JSON.stringify(obj)}`);
    if (typeof obj === "object" && obj.message) {
      if (obj.command === "send") {
        this.sendMessage(obj.message);
        if (obj.callback) {
          this.sendTo(obj.from, obj.command, "Message received", obj.callback);
        }
      } else if (obj.command === "sendNotification") {
        this.processNotification(obj);
      }
    }
  }
  processNotification(obj) {
    const notificationMessage = this.formatNotification(obj.message);
    try {
      this.sendMessage(notificationMessage);
      if (obj.callback) {
        this.sendTo(obj.from, "sendNotification", { sent: true }, obj.callback);
      }
    } catch {
      if (obj.callback) {
        this.sendTo(obj.from, "sendNotification", { sent: false }, obj.callback);
      }
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
  sendMessage(message, tokenAlias) {
    if (this.config.url && this.config.tokens && this.config.tokens.length > 0) {
      let tokenObj = this.config.tokens.find(
        (t) => t.alias === (tokenAlias || this.config.defaultTokenAlias)
      );
      if (!tokenObj) {
        tokenObj = this.config.tokens[0];
      }
      const token = tokenObj.token;
      import_axios.default.post(`${this.config.url}/message?token=${token}`, {
        title: message.title,
        message: message.message,
        priority: message.priority,
        timeout: 1e3,
        extras: {
          "client::display": {
            contentType: message.contentType
          }
        }
      }).then(() => {
        this.log.debug("Successfully sent message to gotify");
      }).catch((error) => {
        this.log.error(`Error while sending message to gotify:${JSON.stringify(error)}`);
      });
    } else {
      this.log.error(`Cannot send notification while not configured:${JSON.stringify(message)}`);
    }
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
