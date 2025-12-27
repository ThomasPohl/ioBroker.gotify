// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface GotifyToken {
            alias: string;
            token: string;
            isDefault?: boolean;
        }
        interface AdapterConfig {
            url: string;
            // deprecated - for migration support
            token: string;
            tokens: GotifyToken[];
            defaultTokenAlias: string;
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export type GotifyToken = ioBroker.GotifyToken;
export type AdapterConfig = ioBroker.AdapterConfig;
export {};
