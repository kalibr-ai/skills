/**
 * Hybrid Consumer Module
 *
 * Automatically uses P2P or HTTP based on endpoint type
 */

const Consumer = require('./index');
const P2PConsumer = require('./p2p-consumer');

class HybridConsumer {
    constructor(config, solanaClient) {
        this.config = config;
        this.solana = solanaClient;
        this.httpConsumer = new Consumer(config, solanaClient);
        this.p2pConsumer = new P2PConsumer(config, solanaClient);
        this.aggregators = config.aggregators || [];
    }

    /**
     * Check if an endpoint is a P2P multiaddr
     */
    isP2PEndpoint(endpoint) {
        return endpoint && (
            endpoint.startsWith('/ip4/') ||
            endpoint.startsWith('/ip6/') ||
            endpoint.startsWith('/dns/') ||
            endpoint.startsWith('/p2p/')
        );
    }

    /**
     * Search for APIs across all aggregators
     */
    async searchApis(filters = {}) {
        return await this.httpConsumer.searchApis(filters);
    }

    /**
     * Call an API using the appropriate transport (P2P or HTTP)
     *
     * @param {object} api - API object from aggregator search
     * @param {object} inputs - API input parameters
     * @returns {Promise<object>} - Completed job with result
     */
    async callApi(api, inputs) {
        // Determine which endpoint to use
        let endpoint = api.endpoint;
        let transport = 'http';

        // Check if API has multiple endpoints and prefer P2P
        if (api.endpoints && Array.isArray(api.endpoints)) {
            // Find P2P endpoint
            const p2pEndpoint = api.endpoints.find(ep => this.isP2PEndpoint(ep));
            if (p2pEndpoint) {
                endpoint = p2pEndpoint;
                transport = 'p2p';
            } else {
                // Use first HTTP endpoint
                const httpEndpoint = api.endpoints.find(ep => !this.isP2PEndpoint(ep));
                if (httpEndpoint) {
                    endpoint = httpEndpoint;
                }
            }
        } else if (this.isP2PEndpoint(endpoint)) {
            transport = 'p2p';
        }

        console.log(`Using ${transport.toUpperCase()} transport`);
        console.log(`Endpoint: ${endpoint}`);

        // Call using appropriate transport
        if (transport === 'p2p') {
            return await this.p2pConsumer.callApi(
                endpoint,
                api.provider_address,
                api.id,
                api.pricing.amount,
                inputs
            );
        } else {
            return await this.httpConsumer.callApi(
                endpoint,
                api.provider_address,
                api.id,
                inputs
            );
        }
    }

    /**
     * Get job status (works with both P2P and HTTP)
     */
    async getJobStatus(endpoint, jobId) {
        if (this.isP2PEndpoint(endpoint)) {
            return await this.p2pConsumer.getJobResult(endpoint, jobId);
        } else {
            return await this.httpConsumer.getJobStatus(endpoint, jobId);
        }
    }

    /**
     * Download job result
     */
    async downloadJobResult(endpoint, jobId, resultFilename) {
        if (this.isP2PEndpoint(endpoint)) {
            // For P2P, result is already included in the job result
            const result = await this.p2pConsumer.getJobResult(endpoint, jobId);
            return result;
        } else {
            return await this.httpConsumer.downloadJobResult(endpoint, jobId, resultFilename);
        }
    }

    /**
     * Start P2P node if needed
     */
    async start() {
        await this.p2pConsumer.start();
    }

    /**
     * Stop P2P node
     */
    async stop() {
        await this.p2pConsumer.stop();
    }
}

module.exports = HybridConsumer;
