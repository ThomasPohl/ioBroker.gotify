"use strict";
/*
 * Created with @iobroker/create-adapter v1.32.0
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils = __importStar(require("@iobroker/adapter-core"));
const axios_1 = __importDefault(require("axios"));
class Gotify extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: "gotify",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.debug("config url: " + this.config.url);
        this.log.debug("config token: " + this.config.token);
        if (!this.supportsFeature || !this.supportsFeature("ADAPTER_AUTO_DECRYPT_NATIVE")) {
            this.config.token = this.decrypt(this.config.token);
        }
        if (!this.config.url || !this.config.token) {
            this.log.error("Cannot send notification while not configured");
        }
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            callback();
        }
        catch (e) {
            callback();
        }
    }
    onMessage(obj) {
        if (typeof obj === "object" && obj.message) {
            if (obj.command === "send") {
                this.sendMessage(obj.message);
                // Send response in callback if required
                if (obj.callback)
                    this.sendTo(obj.from, obj.command, "Message received", obj.callback);
            }
        }
    }
    sendMessage(message) {
        if (this.config.url && this.config.token) {
            axios_1.default
                .post(this.config.url + "/message?token=" + this.config.token, {
                title: message.title,
                message: message.message,
                priority: message.priority,
                extras: {
                    "client::display": {
                        contentType: message.contentType,
                    },
                },
            })
                .then(() => {
                this.log.debug("Successfully sent message to gotify");
            })
                .catch((error) => {
                this.log.error("Error while sending message to gotify:" + JSON.stringify(error));
            });
        }
        else {
            this.log.error("Cannot send notification while not configured");
        }
    }
}
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new Gotify(options);
}
else {
    // otherwise start the instance directly
    (() => new Gotify())();
}
