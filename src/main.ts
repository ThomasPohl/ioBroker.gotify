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

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        await this.setState('info.connection', false, true);
        if (this.config.token && (!this.supportsFeature || !this.supportsFeature('ADAPTER_AUTO_DECRYPT_NATIVE'))) {
            this.config.token = this.decrypt(this.config.token);
        }
        await this.encryptPrivateKeyIfNeeded();
        if (this.config.url && this.config.token) {
            try {
                await axios.get(`${this.config.url.replace(/\/+$/, '')}/health`, { timeout: 1000 });
                await this.setState('info.connection', true, true);
                this.log.info('Gotify adapter configured');
            } catch (error) {
                const errorMessage = this.getSafeErrorMessage(error);
                await this.setState('info.lastError', errorMessage, true);
                this.log.warn(`Could not connect to Gotify server: ${errorMessage}`);
            }
        } else {
            this.log.warn('Gotify adapter not configured');
        }
    }

    private async encryptPrivateKeyIfNeeded(): Promise<void> {
        const instanceId = `system.adapter.${this.name}.${this.instance}`;
        const instanceObject = await this.getForeignObjectAsync(instanceId);
        const storedToken = instanceObject?.native?.token;
        if (
            instanceObject &&
            typeof storedToken === 'string' &&
            storedToken.length > 0 &&
            !storedToken.startsWith('$/aes')
        ) {
            instanceObject.native.token = this.encrypt(storedToken);
            await this.extendForeignObjectAsync(instanceId, instanceObject);
            this.log.info('Gotify token is now stored encrypted');
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

    private async onMessage(obj: ioBroker.Message): Promise<void> {
        if (typeof obj === 'object' && obj.message) {
            if (obj.command === 'send') {
                const sent = await this.sendMessage(obj.message as GotifyMessage);
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, { sent }, obj.callback);
                }
            } else if (obj.command === 'sendNotification') {
                await this.processNotification(obj);
            }
        }
    }

    private async processNotification(obj: ioBroker.Message): Promise<void> {
        let sent = false;
        try {
            sent = await this.sendMessage(this.formatNotification(obj.message));
        } catch {
            sent = false;
            await this.setState('info.lastError', 'Unexpected error', true);
        }
        if (obj.callback) {
            this.sendTo(obj.from, 'sendNotification', { sent }, obj.callback);
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

    private async sendMessage(message: GotifyMessage): Promise<boolean> {
        const token = message.token || this.config.token;
        if (this.config.url && token) {
            try {
                await axios.post(
                    `${this.config.url.replace(/\/+$/, '')}/message`,
                    {
                        title: message.title,
                        message: message.message,
                        priority: message.priority,
                        extras: {
                            'client::display': {
                                contentType: message.contentType,
                            },
                        },
                    },
                    {
                        timeout: 1000,
                        headers: { 'X-Gotify-Key': token },
                    },
                );
                await this.setState('info.connection', true, true);
                await this.setState('info.lastSuccess', Date.now(), true);
                await this.setState('info.lastError', '', true);
                this.log.debug('Successfully sent message to gotify');
                return true;
            } catch (error) {
                const errorMessage = this.getSafeErrorMessage(error);
                await this.setState('info.connection', false, true);
                await this.setState('info.lastError', errorMessage, true);
                this.log.error(`Error while sending message to gotify: ${errorMessage}`);
                return false;
            }
        } else {
            await this.setState('info.connection', false, true);
            await this.setState('info.lastError', 'Gotify is not configured', true);
            this.log.error('Cannot send notification while Gotify is not configured');
            return false;
        }
    }

    private getSafeErrorMessage(error: unknown): string {
        if (axios.isAxiosError(error)) {
            if (error.response) {
                return `HTTP ${error.response.status}`;
            }
            return error.code || 'Network error';
        }
        return 'Unexpected error';
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
