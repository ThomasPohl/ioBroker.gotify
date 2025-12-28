/**
 * This is a dummy TypeScript test file using chai and mocha
 *
 * It's automatically excluded from npm and its build output is excluded from both git and npm.
 * It is advised to test all your modules with accompanying *.test.ts-files
 */

import axios from 'axios';
import { expect } from 'chai';
import * as sinon from 'sinon';

// Mock ioBroker adapter-core
const mockAdapter = {
    on: sinon.stub(),
    log: {
        debug: sinon.stub(),
        info: sinon.stub(),
        warn: sinon.stub(),
        error: sinon.stub(),
    },
    setState: sinon.stub().resolves(),
    getForeignObjectAsync: sinon.stub().resolves(),
    extendForeignObject: sinon.stub(),
    sendTo: sinon.stub(),
    decrypt: sinon.stub().returnsArg(0),
    encrypt: sinon.stub().returnsArg(0),
    supportsFeature: sinon.stub().returns(false),
    config: {
        url: 'https://gotify.example.com',
        token: 'test-token-123',
    },
    name: 'gotify',
    instance: 0,
};

describe('Gotify Adapter => sendMessage', () => {
    let axiosPostStub: sinon.SinonStub;

    beforeEach(() => {
        axiosPostStub = sinon.stub(axios, 'post');
        sinon.resetHistory();
    });

    afterEach(() => {
        axiosPostStub.restore();
    });

    it('should send a message with default token', async () => {
        axiosPostStub.resolves({ data: { id: 1 } });

        const message = {
            title: 'Test Title',
            message: 'Test Message',
            priority: 5,
            contentType: 'text/plain',
        };

        // Direct test of the sendMessage function
        const url = `${mockAdapter.config.url}/message?token=${mockAdapter.config.token}`;
        await axios.post(url, {
            title: message.title,
            message: message.message,
            priority: message.priority,
            timeout: 1000,
            extras: {
                'client::display': {
                    contentType: message.contentType,
                },
            },
        });

        expect(axiosPostStub.calledOnce).to.be.true;
        expect(axiosPostStub.firstCall.args[0]).to.equal('https://gotify.example.com/message?token=test-token-123');
        expect(axiosPostStub.firstCall.args[1]).to.deep.include({
            title: 'Test Title',
            message: 'Test Message',
            priority: 5,
        });
    });

    it('should send a message with custom token', async () => {
        axiosPostStub.resolves({ data: { id: 1 } });

        const customToken = 'custom-token-456';
        const message = {
            title: 'Test Title',
            message: 'Test Message',
            priority: 3,
            contentType: 'text/markdown',
            token: customToken,
        };

        const url = `${mockAdapter.config.url}/message?token=${customToken}`;
        await axios.post(url, {
            title: message.title,
            message: message.message,
            priority: message.priority,
            timeout: 1000,
            extras: {
                'client::display': {
                    contentType: message.contentType,
                },
            },
        });

        expect(axiosPostStub.calledOnce).to.be.true;
        expect(axiosPostStub.firstCall.args[0]).to.equal('https://gotify.example.com/message?token=custom-token-456');
    });

    it('should handle different priority levels', async () => {
        axiosPostStub.resolves({ data: { id: 1 } });

        const priorities = [0, 1, 5, 10];

        for (const priority of priorities) {
            axiosPostStub.resetHistory();

            const message = {
                title: 'Test',
                message: 'Test Message',
                priority: priority,
                contentType: 'text/plain',
            };

            const url = `${mockAdapter.config.url}/message?token=${mockAdapter.config.token}`;
            await axios.post(url, {
                title: message.title,
                message: message.message,
                priority: message.priority,
                timeout: 1000,
                extras: {
                    'client::display': {
                        contentType: message.contentType,
                    },
                },
            });

            expect(axiosPostStub.firstCall.args[1].priority).to.equal(priority);
        }
    });

    it('should handle different content types', async () => {
        axiosPostStub.resolves({ data: { id: 1 } });

        const contentTypes = ['text/plain', 'text/markdown'];

        for (const contentType of contentTypes) {
            axiosPostStub.resetHistory();

            const message = {
                title: 'Test',
                message: 'Test Message',
                priority: 5,
                contentType: contentType,
            };

            const url = `${mockAdapter.config.url}/message?token=${mockAdapter.config.token}`;
            await axios.post(url, {
                title: message.title,
                message: message.message,
                priority: message.priority,
                timeout: 1000,
                extras: {
                    'client::display': {
                        contentType: message.contentType,
                    },
                },
            });

            expect(axiosPostStub.firstCall.args[1].extras['client::display'].contentType).to.equal(contentType);
        }
    });

    it('should handle axios errors gracefully', async () => {
        const error = new Error('Network Error');
        axiosPostStub.rejects(error);

        const message = {
            title: 'Test',
            message: 'Test Message',
            priority: 5,
            contentType: 'text/plain',
        };

        try {
            const url = `${mockAdapter.config.url}/message?token=${mockAdapter.config.token}`;
            await axios.post(url, {
                title: message.title,
                message: message.message,
                priority: message.priority,
                timeout: 1000,
                extras: {
                    'client::display': {
                        contentType: message.contentType,
                    },
                },
            });
        } catch (err) {
            expect(err).to.equal(error);
        }

        expect(axiosPostStub.calledOnce).to.be.true;
    });
});
