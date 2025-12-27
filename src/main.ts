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

    private async migrateConfigurationIfNeeded(): Promise<void> {
        // Migration: If old format (token as string) still exists, migrate
        // let migrated = false;
        this.log.info(`Checking adapter configuration for migration needs...${JSON.stringify(this.config)}`);
        if (this.config.token && this.config.tokens && this.config.tokens.length === 0) {
            this.log.info('Old adapter configuration detected, performing migration...');
            // Perform migration
            const alias = 'default';
            this.config.tokens = [{ alias, token: this.config.token }];
            this.config.defaultTokenAlias = alias;
            this.config.token = '';
            // migrated = true;
            this.log.info('Adapter configuration migrated to multi-token structure.');
            // Optional: Save migration persistently
            const obj = await this.getForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`);
            if (obj && obj.native) {
                let changed = false;
                if (
                    !Array.isArray(obj.native.tokens) ||
                    JSON.stringify(obj.native.tokens) !== JSON.stringify(this.config.tokens)
                ) {
                    obj.native.tokens = this.config.tokens;
                    changed = true;
                }
                if (obj.native.defaultTokenAlias !== this.config.defaultTokenAlias) {
                    obj.native.defaultTokenAlias = this.config.defaultTokenAlias;
                    changed = true;
                }
                if ('token' in obj.native) {
                    delete obj.native.token;
                    changed = true;
                }
                if (changed) {
                    this.extendForeignObject(`system.adapter.${this.name}.${this.instance}`, obj);
                }
            }
        }

        this.log.debug(`config url: ${this.config.url}`);
        this.log.debug(`config tokens: ${JSON.stringify(this.config.tokens)}`);
        this.log.debug(`config defaultTokenAlias: ${this.config.defaultTokenAlias}`);

        // Decrypt tokens if needed (all tokens in the array)
        let tokensDecrypted = false;
        if (this.config.tokens && Array.isArray(this.config.tokens)) {
            for (const t of this.config.tokens) {
                if (!this.supportsFeature || !this.supportsFeature('ADAPTER_AUTO_DECRYPT_NATIVE')) {
                    if (t.token && t.token.startsWith('$/aes')) {
                        t.token = this.decrypt(t.token);
                        tokensDecrypted = true;
                    }
                }
            }
        }
        // After decrypting: Perform default check and write decrypted tokens back
        if (tokensDecrypted) {
            // Default check (only one default, as above)
            let foundDefault = false;
            let defaultAlias = '';
            const defaultIndices = this.config.tokens.map((t, i) => (t.isDefault ? i : -1)).filter(i => i !== -1);
            if (defaultIndices.length === 1) {
                foundDefault = true;
                defaultAlias = this.config.tokens[defaultIndices[0]].alias || '';
            } else if (defaultIndices.length > 1) {
                for (let i = 0; i < this.config.tokens.length; i++) {
                    this.config.tokens[i].isDefault = i === defaultIndices[0];
                }
                foundDefault = true;
                defaultAlias = this.config.tokens[defaultIndices[0]].alias || '';
            }
            if (!foundDefault || !defaultAlias) {
                this.config.tokens.forEach((t, i) => (t.isDefault = i === 0));
                defaultAlias = this.config.tokens[0].alias || '';
            }
            this.config.defaultTokenAlias = defaultAlias;
            // Save back to object (decrypted)
            const obj = await this.getForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`);
            if (obj && obj.native) {
                let changed = false;
                if (
                    !Array.isArray(obj.native.tokens) ||
                    JSON.stringify(obj.native.tokens) !== JSON.stringify(this.config.tokens)
                ) {
                    obj.native.tokens = this.config.tokens;
                    changed = true;
                    this.log.info('Tokens changed during decryption migration.');
                }
                if (obj.native.defaultTokenAlias !== defaultAlias) {
                    obj.native.defaultTokenAlias = defaultAlias;
                    changed = true;
                    this.log.info('defaultTokenAlias changed during decryption migration.');
                }
                if (changed) {
                    this.log.info('Saving decrypted tokens back to adapter configuration.');
                    this.extendForeignObject(`system.adapter.${this.name}.${this.instance}`, obj);
                }
            }
        }
        // Encrypt tokens if they are still stored unencrypted
        await this.encryptTokensIfNeeded();

        if (this.config.url && this.config.tokens && this.config.tokens.length > 0) {
            await this.setState('info.connection', true, true);
            this.log.info('Gotify adapter konfiguriert');
        } else {
            await this.setState('info.connection', false, true);
            this.log.warn('Gotify adapter nicht konfiguriert');
        }
        // Migration for privateKey if needed
        await this.encryptPrivateKeyIfNeeded();
        this.log.info('Migration check completed.');
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        this.log.info('Gotify adapter starting');
        await this.migrateConfigurationIfNeeded();
        // Logic : Only one token may have isDefault=true, set defaultTokenAlias accordingly
        if (this.config.tokens && Array.isArray(this.config.tokens) && this.config.tokens.length > 0) {
            let foundDefault = false;
            let defaultAlias = '';
            // Find all indices with isDefault=true
            const defaultIndices = this.config.tokens.map((t, i) => (t.isDefault ? i : -1)).filter(i => i !== -1);
            if (defaultIndices.length === 1) {
                foundDefault = true;
                defaultAlias = this.config.tokens[defaultIndices[0]].alias || '';
            } else if (defaultIndices.length > 1) {
                // Multiple found, only first remains
                for (let i = 0; i < this.config.tokens.length; i++) {
                    this.config.tokens[i].isDefault = i === defaultIndices[0];
                }
                foundDefault = true;
                defaultAlias = this.config.tokens[defaultIndices[0]].alias || '';
            }
            // If none set or alias empty: first as default
            if (!foundDefault || !defaultAlias) {
                this.config.tokens.forEach((t, i) => (t.isDefault = i === 0));
                defaultAlias = this.config.tokens[0].alias || '';
            }
            this.config.defaultTokenAlias = defaultAlias;
            // Save back to object
            const obj = await this.getForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`);
            if (obj && obj.native) {
                let changed = false;
                if (obj.native.defaultTokenAlias !== defaultAlias) {
                    obj.native.defaultTokenAlias = defaultAlias;
                    changed = true;
                }
                if (
                    !Array.isArray(obj.native.tokens) ||
                    JSON.stringify(obj.native.tokens) !== JSON.stringify(this.config.tokens)
                ) {
                    obj.native.tokens = this.config.tokens;
                    changed = true;
                }
                if (changed) {
                    this.extendForeignObject(`system.adapter.${this.name}.${this.instance}`, obj);
                }
            }
        }
        // Ensure tokens array is always saved in the object (so Admin UI sees it)
        if (this.config.tokens && Array.isArray(this.config.tokens)) {
            const obj = await this.getForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`);
            if (
                obj &&
                obj.native &&
                (!Array.isArray(obj.native.tokens) ||
                    JSON.stringify(obj.native.tokens) !== JSON.stringify(this.config.tokens))
            ) {
                obj.native.tokens = this.config.tokens;
                this.extendForeignObject(`system.adapter.${this.name}.${this.instance}`, obj);
            }
        }
        this.log.info('Gotify adapter started');
    }

    // Legacy: For migration of old instances, can be removed later
    private async encryptPrivateKeyIfNeeded(): Promise<void> {
        // Check if old token field still exists (Legacy)
        const obj = await this.getForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`);
        if (obj && obj.native && obj.native.token && !obj.native.token.startsWith('$/aes')) {
            obj.native.token = this.encrypt(obj.native.token);
            this.extendForeignObject(`system.adapter.${this.name}.${this.instance}`, obj);
            this.log.info('token is now stored encrypted');
        }
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

    private sendMessage(message: GotifyMessage, tokenAlias?: string): void {
        if (this.config.url && this.config.tokens && this.config.tokens.length > 0) {
            // Token auswählen
            let tokenObj = this.config.tokens.find(
                (t: any) => t.alias === (tokenAlias || this.config.defaultTokenAlias),
            );
            if (!tokenObj) {
                tokenObj = this.config.tokens[0];
            }
            const token = tokenObj.token;
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
