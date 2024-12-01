/*
 * Created with @iobroker/create-adapter v1.32.0
 */

import * as utils from '@iobroker/adapter-core';
import axios from 'axios';

interface GotifyMessage {
    message?: string;
    title?: string;
    priority?: number;
    contentType?: string;
}

class Gotify extends utils.Adapter {
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'gotify',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.debug(`config url: ${this.config.url}`);
        this.log.debug(`config token: ${this.config.token}`);
        if (!this.supportsFeature || !this.supportsFeature('ADAPTER_AUTO_DECRYPT_NATIVE')) {
            this.config.token = this.decrypt(this.config.token);
        }
        if (this.config.url && this.config.token) {
            await this.setState('info.connection', true, true);
            this.log.info('Gotify adapter configured');
        } else {
            await this.setState('info.connection', false, true);
            this.log.warn('Gotify adapter not configured');
        }
        await this.encryptPrivateKeyIfNeeded();
    }

    private async encryptPrivateKeyIfNeeded(): Promise<void> {
        if (this.config.token && this.config.token.length > 0) {
            await this.getForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`).then(data => {
                if (data && data.native && data.native.token && !data.native.token.startsWith('$/aes')) {
                    this.config.token = data.native.privateKey;
                    data.native.token = this.encrypt(data.native.token);
                    this.extendForeignObject(`system.adapter.${this.name}.${this.instance}`, data);
                    this.log.info('privateKey is stored now encrypted');
                }
            });
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback Callback to be called after shutdown
     */
    private onUnload(callback: () => void): void {
        try {
            callback();
        } catch (e) {
            this.log.error(`Error during unload: ${JSON.stringify(e)}`);
            callback();
        }
    }

    private onMessage(obj: ioBroker.Message): void {
        if (typeof obj === 'object' && obj.message) {
            if (obj.command === 'send') {
                this.sendMessage(obj.message as GotifyMessage);
                // Send response in callback if required
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
                }
            } else if (obj.command === 'sendNotification') {
                this.processNotification(obj);
            }
        }
    }

    private processNotification(obj: ioBroker.Message): void {
        const notificationMessage: GotifyMessage = this.formatNotification(obj.message);
        try {
            this.sendMessage(notificationMessage);
            if (obj.callback) {
                this.sendTo(obj.from, 'sendNotification', { sent: true }, obj.callback);
            }
        } catch {
            if (obj.callback) {
                this.sendTo(obj.from, 'sendNotification', { sent: false }, obj.callback);
            }
        }
    }

    private formatNotification(notification: any): GotifyMessage {
        const instances = notification.category.instances as Map<string, any>;
        const readableInstances = Object.entries(instances).map(
            ([instance, entry]) =>
                `${instance.substring('system.adapter.'.length)}: ${this.getLatestMessage(entry.messages)}`,
        );

        const text = `${notification.category.description}
        ${notification.host}:
        ${readableInstances.join('\n')}
            `;

        return {
            message: text,
            title: notification.category.name,
            priority: this.getPriority(notification.severity),
            contentType: 'text/plain',
        };
    }

    private getPriority(severity: string): number {
        switch (severity) {
            case 'notify':
                return 1;
            case 'info':
                return 4;
            case 'alert':
                return 10;
            default:
                return 4;
        }
    }

    private sendMessage(message: GotifyMessage): void {
        if (this.config.url && this.config.token) {
            axios
                .post(`${this.config.url}/message?token=${this.config.token}`, {
                    title: message.title,
                    message: message.message,
                    priority: message.priority,
                    timeout: 1000,
                    extras: {
                        'client::display': {
                            contentType: message.contentType,
                        },
                    },
                })
                .then(() => {
                    this.log.debug('Successfully sent message to gotify');
                })
                .catch(error => {
                    this.log.error(`Error while sending message to gotify:${JSON.stringify(error)}`);
                });
        } else {
            this.log.error(`Cannot send notification while not configured:${JSON.stringify(message)}`);
        }
    }
    private getLatestMessage(messages: any): string {
        const latestMessage = messages.sort((a: any, b: any) => (a.ts < b.ts ? 1 : -1))[0];

        return `${new Date(latestMessage.ts).toLocaleString()} ${latestMessage.message}`;
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Gotify(options);
} else {
    // otherwise start the instance directly
    (() => new Gotify())();
}
