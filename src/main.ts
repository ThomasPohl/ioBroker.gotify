/*
 * Created with @iobroker/create-adapter v1.32.0
 */

import * as utils from "@iobroker/adapter-core";
import axios from "axios";

interface GotifyMessage {
    message?: string;
    title?: string;
    priority?: number;
}

class Gotify extends utils.Adapter {
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
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
    private async onReady(): Promise<void> {
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
    private onUnload(callback: () => void): void {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
            callback();
        }
    }

    private onMessage(obj: ioBroker.Message): void {
        if (typeof obj === "object" && obj.message) {
            if (obj.command === "send") {
                this.sendMessage(obj.message as GotifyMessage);
                // Send response in callback if required
                if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
            }
        }
    }

    private sendMessage(message: GotifyMessage) {
        if (this.config.url && this.config.token) {
            axios
                .post(this.config.url + "/message?token=" + this.config.token, message)
                .then(() => {
                    this.log.debug("Successfully sent message to gotify");
                })
                .catch((error) => {
                    this.log.error("Error while sending message to gotify:" + JSON.stringify(error));
                });
        } else {
            this.log.error("Cannot send notification while not configured");
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Gotify(options);
} else {
    // otherwise start the instance directly
    (() => new Gotify())();
}
