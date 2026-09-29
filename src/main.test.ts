import axios from 'axios';
import { expect } from 'chai';
import proxyquire from 'proxyquire';
import * as sinon from 'sinon';

class MockAdapter {
    public config: { url: string; token: string };
    public name = 'gotify';
    public instance = 0;
    public log = {
        debug: sinon.stub(),
        info: sinon.stub(),
        warn: sinon.stub(),
        error: sinon.stub(),
    };
    public setState = sinon.stub().resolves();
    public getForeignObjectAsync = sinon.stub().resolves(null);
    public extendForeignObjectAsync = sinon.stub().resolves();
    public sendTo = sinon.stub();
    public decrypt = sinon.stub().callsFake((value: string) => value);
    public encrypt = sinon.stub().callsFake((value: string) => `$/aes-${value}`);
    public supportsFeature = sinon.stub().returns(true);
    public on = sinon.stub();

    public constructor(options: { config?: { url: string; token: string } }) {
        this.config = options.config ?? { url: 'https://gotify.example.com', token: 'test-token-123' };
    }
}

const createAdapter: (options?: { config?: { url: string; token: string } }) => any = proxyquire.noCallThru()(
    './main',
    {
        '@iobroker/adapter-core': { Adapter: MockAdapter },
    },
);

describe('Gotify adapter', () => {
    let axiosPostStub: sinon.SinonStub;
    let axiosGetStub: sinon.SinonStub;

    beforeEach(() => {
        axiosPostStub = sinon.stub(axios, 'post').resolves({ data: { id: 1 } });
        axiosGetStub = sinon.stub(axios, 'get').resolves({ data: { health: 'OK' } });
    });

    afterEach(() => {
        axiosPostStub.restore();
        axiosGetStub.restore();
    });

    it('sends the token in the auth header and awaits successful delivery', async () => {
        const adapter = createAdapter();
        const sent = await adapter.sendMessage({ title: 'Test', message: 'Hello', priority: 5 });

        expect(sent).to.equal(true);
        expect(axiosPostStub.firstCall.args[0]).to.equal('https://gotify.example.com/message');
        expect(axiosPostStub.firstCall.args[1]).not.to.have.property('token');
        expect(axiosPostStub.firstCall.args[2]).to.deep.include({
            timeout: 1000,
            headers: { 'X-Gotify-Key': 'test-token-123' },
        });
    });

    it('does not expose a failed request token in logs or the URL', async () => {
        const customToken = 'custom-token-456';
        const adapter = createAdapter();
        axiosPostStub.rejects(new Error('Network Error'));

        const sent = await adapter.sendMessage({ message: 'Hello', token: customToken });

        expect(sent).to.equal(false);
        expect(axiosPostStub.firstCall.args[0]).not.to.include(customToken);
        expect(adapter.log.error.firstCall.args.join(' ')).not.to.include(customToken);
    });

    it('migrates a plaintext token without replacing the runtime token', async () => {
        const adapter = createAdapter({ config: { url: 'https://gotify.example.com', token: 'plain-token' } });
        const instanceObject = { native: { token: 'plain-token' } };
        adapter.getForeignObjectAsync.resolves(instanceObject);

        await adapter.encryptPrivateKeyIfNeeded();

        expect(adapter.config.token).to.equal('plain-token');
        expect(instanceObject.native.token).to.equal('$/aes-plain-token');
        expect(adapter.extendForeignObjectAsync.calledOnce).to.equal(true);
    });

    it('reports send completion in the message callback', async () => {
        const adapter = createAdapter();
        axiosPostStub.rejects(new Error('Network Error'));

        await adapter.onMessage({
            command: 'send',
            message: { title: 'Test', message: 'Hello' },
            from: 'javascript.0',
            callback: 1,
        });

        expect(adapter.sendTo.firstCall.args[2]).to.deep.equal({ sent: false });
    });

    it('checks server availability without logging the configured token', async () => {
        const adapter = createAdapter();

        await adapter.onReady();

        expect(axiosGetStub.firstCall.args[0]).to.equal('https://gotify.example.com/health');
        expect(adapter.setState.calledWith('info.connection', true, true)).to.equal(true);
        expect(JSON.stringify(adapter.log.debug.args)).not.to.include('test-token-123');
    });
});
