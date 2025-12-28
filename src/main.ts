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
    token?: string;
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

    private async migrateConfigurationIfNeeded(): Promise<void> {
        this.log.debug(`config url: ${this.config.url}`);
        this.log.debug(`config tokens: ${JSON.stringify(this.config.tokens)}`);

        await this.migrateOldTokenFormat();
    }

    private async migrateOldTokenFormat(): Promise<void> {
        if (this.config.token && this.config.tokens && this.config.tokens.length === 0) {
            this.log.info('Old adapter configuration detected, performing migration...');
            const alias = 'default';
            // Token entschlüsseln falls verschlüsselt, damit es in this.config entschlüsselt vorliegt
            let tokenValue = this.config.token;
            if (tokenValue.startsWith('$/aes')) {
                tokenValue = this.decrypt(tokenValue);
            }
            this.config.tokens = [{ alias, token: tokenValue, isDefault: true }];
            this.config.token = '';
            await this.saveConfigChanges(['tokens'], true);
            this.log.info('Adapter configuration migrated to multi-token structure.');
        }
    }

    private decryptTokensIfNeeded(): void {
        if (!this.config.tokens || !Array.isArray(this.config.tokens)) {
            return;
        }

        for (const t of this.config.tokens) {
            // Tokens in this.config müssen immer entschlüsselt sein
            if (t.token && t.token.startsWith('$/aes')) {
                t.token = this.decrypt(t.token);
            }
        }
    }

    private async saveConfigChanges(fields: string[], deleteOldToken = false): Promise<void> {
        const obj = await this.getForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`);
        if (!obj || !obj.native) {
            return;
        }

        let changed = false;
        for (const field of fields) {
            const currentValue = (this.config as any)[field];
            const savedValue = obj.native[field];

            if (JSON.stringify(currentValue) !== JSON.stringify(savedValue)) {
                obj.native[field] = currentValue;
                changed = true;
            }
        }

        if (deleteOldToken && 'token' in obj.native) {
            delete obj.native.token;
            changed = true;
        }

        if (changed) {
            this.extendForeignObject(`system.adapter.${this.name}.${this.instance}`, obj);
        }
    }

    private async updateConnectionState(): Promise<void> {
        if (this.config.url && this.config.tokens && this.config.tokens.length > 0) {
            await this.setState('info.connection', true, true);
            this.log.info('Gotify adapter konfiguriert');
        } else {
            await this.setState('info.connection', false, true);
            this.log.warn('Gotify adapter nicht konfiguriert');
        }
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        this.log.info('Gotify adapter starting');
        await this.migrateConfigurationIfNeeded();
        await this.updateConnectionState();
        this.log.info('Gotify adapter started');
    }

    /**
     * Encrypts all tokens in the array if they are still unencrypted and saves them persistently.
     */
    private async encryptTokensIfNeeded(): Promise<void> {
        const obj = await this.getForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`);
        let changed = false;
        if (obj && obj.native && Array.isArray(obj.native.tokens)) {
            for (const t of obj.native.tokens) {
                if (t.token && !t.token.startsWith('$/aes')) {
                    t.token = this.encrypt(t.token);
                    changed = true;
                }
            }
            if (changed) {
                this.extendForeignObject(`system.adapter.${this.name}.${this.instance}`, obj);
                this.log.info('All tokens are now stored encrypted');
            }
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback Callback to be called after shutdown
     */
    private onUnload(callback: () => void): void {
        this.log.info('Gotify adapter shutting down...');
        try {
            callback();
        } catch (e) {
            this.log.error(`Error during unload: ${JSON.stringify(e)}`);
            callback();
        }
    }

    private onMessage(obj: ioBroker.Message): void {
        this.log.info(`Received message: ${JSON.stringify(obj)}`);
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
        // Prefer message.token if set, otherwise use default token from config.tokens or config.token
        let token: string | undefined = undefined;
        if (message.token) {
            token = message.token;
        } else if (this.config.tokens && Array.isArray(this.config.tokens) && this.config.tokens.length > 0) {
            const defaultToken = this.config.tokens.find((t: any) => t.isDefault) || this.config.tokens[0];
            token = defaultToken.token;
        } else if (this.config.token) {
            token = this.config.token;
        }
        if (this.config.url && token) {
            axios
                .post(`${this.config.url}/message?token=${token}`, {
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
