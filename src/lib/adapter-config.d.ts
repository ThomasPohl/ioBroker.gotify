// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            url: string;
            token: string;
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
