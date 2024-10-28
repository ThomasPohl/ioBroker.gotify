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
    this.log.debug("config url: " + this.config.url);
    this.log.debug("config token: " + this.config.token);
    if (!this.supportsFeature || !this.supportsFeature("ADAPTER_AUTO_DECRYPT_NATIVE")) {
      this.config.token = this.decrypt(this.config.token);
    }
    if (this.config.url && this.config.token) {
      this.setState("info.connection", true, true);
      this.log.info("Gotify adapter configured");
    } else {
      this.setState("info.connection", false, true);
      this.log.warn("Gotify adapter not configured");
    }
    this.encryptPrivateKeyIfNeeded();
  }
  encryptPrivateKeyIfNeeded() {
    if (this.config.token && this.config.token.length > 0) {
      this.getForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`).then((data) => {
        if (data && data.native && data.native.token && !data.native.token.startsWith("$/aes")) {
          this.config.token = data.native.privateKey;
          data.native.token = this.encrypt(data.native.token);
          this.extendForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`, data).then(
            () => this.log.info("privateKey is stored now encrypted")
          );
        }
      });
    }
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  onUnload(callback) {
    try {
      callback();
    } catch (e) {
      callback();
    }
  }
  onMessage(obj) {
    if (typeof obj === "object" && obj.message) {
      if (obj.command === "send") {
        this.sendMessage(obj.message);
        if (obj.callback)
          this.sendTo(obj.from, obj.command, "Message received", obj.callback);
      }
    }
  }
  sendMessage(message) {
    if (this.config.url && this.config.token) {
      import_axios.default.post(this.config.url + "/message?token=" + this.config.token, {
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
        this.log.error("Error while sending message to gotify:" + JSON.stringify(error));
      });
    } else {
      this.log.error("Cannot send notification while not configured:" + JSON.stringify(message));
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new Gotify(options);
} else {
  (() => new Gotify())();
}
//# sourceMappingURL=main.js.map
