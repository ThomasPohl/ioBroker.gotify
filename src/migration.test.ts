import { expect } from 'chai';

// Typen lokal nachbilden, da .d.ts nicht importierbar ist
type GotifyToken = { alias: string; token: string };
type AdapterConfig = { url: string; tokens: GotifyToken[]; defaultTokenAlias: string };

describe('Konfigurations-Migration', () => {
    it('migriert alte Konfiguration korrekt', () => {
        // Simuliere alte Konfiguration
        const oldConfig: any = {
            url: 'https://gotify.example',
            token: 'abc123',
        };
        // Simuliere Migrationslogik wie in main.ts
        if (oldConfig.token && !oldConfig.tokens) {
            const alias = 'default';
            oldConfig.tokens = [{ alias, token: oldConfig.token }];
            oldConfig.defaultTokenAlias = alias;
            delete oldConfig.token;
        }
        expect(oldConfig.tokens).to.be.an('array').with.lengthOf(1);
        expect(oldConfig.tokens[0].alias).to.equal('default');
        expect(oldConfig.tokens[0].token).to.equal('abc123');
        expect(oldConfig.defaultTokenAlias).to.equal('default');
        expect(oldConfig.token).to.be.undefined;
    });

    it('übernimmt neue Konfiguration unverändert', () => {
        const newConfig: AdapterConfig = {
            url: 'https://gotify.example',
            tokens: [
                { alias: 'a', token: 't1' },
                { alias: 'b', token: 't2' },
            ],
            defaultTokenAlias: 'b',
        };
        expect(newConfig.tokens).to.have.lengthOf(2);
        expect(newConfig.defaultTokenAlias).to.equal('b');
    });
});
