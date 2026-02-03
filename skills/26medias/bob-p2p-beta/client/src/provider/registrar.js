/**
 * Aggregator Registration Module
 *
 * Handles registration and heartbeat with aggregators
 */

const axios = require('axios');
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const { Keypair } = require('@solana/web3.js');

class AggregatorRegistrar {
    constructor(config, queueManager, p2pServer = null) {
        this.config = config;
        this.queue = queueManager;
        this.p2pServer = p2pServer;
        this.aggregators = config.aggregators || [];

        // Load keypair for signing
        this.keypair = this.loadKeypair(config.wallet.privateKey);

        this.registered = false;
    }

    /**
     * Load keypair from various formats (mnemonic, array, base58)
     */
    loadKeypair(privateKey) {
        if (Array.isArray(privateKey)) {
            return Keypair.fromSecretKey(Uint8Array.from(privateKey));
        }

        if (typeof privateKey === 'string') {
            const trimmed = privateKey.trim();
            const words = trimmed.split(/\s+/);

            // Mnemonic phrase (12 or 24 words)
            if (words.length === 12 || words.length === 24) {
                return this.keypairFromMnemonic(trimmed);
            }

            // Base58 format
            return Keypair.fromSecretKey(bs58.decode(trimmed));
        }

        throw new Error('Invalid private key format');
    }

    /**
     * Create keypair from mnemonic phrase
     */
    keypairFromMnemonic(mnemonic) {
        const bip39 = require('bip39');
        const { derivePath } = require('ed25519-hd-key');

        if (!bip39.validateMnemonic(mnemonic)) {
            throw new Error('Invalid mnemonic phrase');
        }

        const seed = bip39.mnemonicToSeedSync(mnemonic, '');
        const path = "m/44'/501'/0'/0'";
        const derivedSeed = derivePath(path, seed.toString('hex')).key;

        return Keypair.fromSeed(derivedSeed);
    }

    /**
     * Get provider wallet address (from keypair, not config)
     */
    getProviderAddress() {
        return this.keypair.publicKey.toBase58();
    }

    /**
     * Register all APIs with aggregators
     */
    async registerAll() {
        const apis = this.queue.getAllApis();

        if (apis.length === 0) {
            console.log('No APIs to register');
            return;
        }

        console.log(`Registering ${apis.length} API(s) with ${this.aggregators.length} aggregator(s)...`);

        for (const aggregatorUrl of this.aggregators) {
            try {
                await this.registerWithAggregator(aggregatorUrl, apis);
                console.log(`✓ Registered with: ${aggregatorUrl}`);
            } catch (error) {
                console.error(`✗ Failed to register with ${aggregatorUrl}:`, error.message);
            }
        }

        this.registered = true;

        // Start heartbeat
        this.startHeartbeat();
    }

    /**
     * Register with a single aggregator
     */
    async registerWithAggregator(aggregatorUrl, apis) {
        const providerAddress = this.getProviderAddress();

        // Determine endpoint(s) to register
        let endpoints = [];

        // Add P2P multiaddrs if P2P is enabled
        if (this.p2pServer) {
            const multiaddrs = this.p2pServer.getMultiaddrs();
            endpoints.push(...multiaddrs);

            console.log('Registering P2P multiaddrs:');
            multiaddrs.forEach(addr => console.log(`  ${addr}`));
        }

        // Add HTTP endpoint if not disabled (backward compatibility)
        if (!this.config.provider.httpDisabled && this.config.provider.publicEndpoint) {
            endpoints.push(this.config.provider.publicEndpoint);
            console.log('Registering HTTP endpoint:', this.config.provider.publicEndpoint);
        }

        if (endpoints.length === 0) {
            throw new Error('No endpoints to register (neither P2P nor HTTP configured)');
        }

        // For each API, register separately (aggregator expects one API per registration)
        for (const api of apis) {
            const apiPayload = {
                ...api,
                endpoint: endpoints[0], // Primary endpoint
                endpoints: endpoints,   // All available endpoints
                provider_address: providerAddress,
                transport: this.p2pServer ? 'p2p' : 'http' // Indicate transport type
            };

            // Sign payload
            const message = JSON.stringify(apiPayload);
            const messageBytes = Buffer.from(message, 'utf8');
            const signature = nacl.sign.detached(messageBytes, this.keypair.secretKey);
            const signatureBase64 = Buffer.from(signature).toString('base64');

            // Send registration
            await axios.post(
                `${aggregatorUrl}/api/register`,
                apiPayload,
                {
                    headers: {
                        'X-Provider-Address': providerAddress,
                        'X-Signature': signatureBase64,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );
        }
    }

    /**
     * Send heartbeat to aggregators
     */
    async sendHeartbeat() {
        if (!this.registered) {
            return;
        }

        const providerAddress = this.getProviderAddress();
        const apis = this.queue.getAllApis();

        for (const aggregatorUrl of this.aggregators) {
            // Send heartbeat for each API
            for (const api of apis) {
                try {
                    await axios.post(
                        `${aggregatorUrl}/api/${api.id}/heartbeat`,
                        {},
                        {
                            headers: {
                                'X-Provider-Address': providerAddress,
                                'Content-Type': 'application/json'
                            },
                            timeout: 5000
                        }
                    );
                } catch (error) {
                    console.error(`Heartbeat failed for ${api.id} at ${aggregatorUrl}:`, error.message);
                }
            }
        }
    }

    /**
     * Start heartbeat interval
     */
    startHeartbeat() {
        setInterval(() => {
            this.sendHeartbeat().catch(err => {
                console.error('Heartbeat error:', err);
            });
        }, 60000); // Every 60 seconds

        console.log('Heartbeat started (60s interval)');
    }
}

module.exports = AggregatorRegistrar;
