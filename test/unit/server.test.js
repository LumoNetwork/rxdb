import assert from 'assert';
import config from './config';
import AsyncTestUtil from 'async-test-util';
import request from 'request-promise-native';
import requestR from 'request';

import RxDB from '../../dist/lib/index';
import * as humansCollection from '../helper/humans-collection';
import * as schemaObjects from '../helper/schema-objects';
import * as schemas from '../helper/schemas';
import * as util from '../../dist/lib/util';

config.parallel('server.test.js', () => {
    if (!config.platform.isNode()) return;

    const NodeWebsqlAdapter = require('pouchdb-adapter-leveldb');

    const ServerPlugin = require('../../plugins/server');
    RxDB.plugin(ServerPlugin);

    let lastPort = 3000;
    const nexPort = () => lastPort++;

    it('should run and sync (ignored)', async function () {
        console.log('ignoring');
    });
    it('should send cors when defined', async function () {
        this.timeout(12 * 1000);
        const port = nexPort();
        const serverCollection = await humansCollection.create(0);
        await serverCollection.database.server({
            path: '/db',
            port,
            cors: true
        });
        const colUrl = 'http://localhost:' + port + '/db/human';


        const corsKey = 'Access-Control-Allow-Origin'.toLowerCase();
        await new Promise((res, rej) => {
            requestR({
                method: 'GET',
                url: colUrl
            }, (error, response) => {
                if (error) rej(error);
                const found = Object.entries(response.headers)
                    .find(([k, v]) => {
                        if (k.toLowerCase() === corsKey && v === '*') return true;
                        else return false;
                    });
                if (!found) {
                    rej(
                        new Error(
                            'cors headers not set: ' +
                            JSON.stringify(response.headers, null, 2)
                        )
                    );
                } else res();
            });
        });

        serverCollection.database.destroy();
    });
    it('should free port when database is destroyed', async () => {
        const port = 5000;
        const col1 = await humansCollection.create(0);
        await col1.database.server({
            port
        });
        await col1.database.destroy();

        const col2 = await humansCollection.create(0);
        await col2.database.server({
            port
        });
        col2.database.destroy();
    });
    it('using node-websql with an absoulte path should work', async () => {
        RxDB.plugin(NodeWebsqlAdapter);
        const dbName = config.rootPath + 'test_tmp/' + util.randomCouchString(10);
        const db1 = await RxDB.create({
            name: dbName,
            adapter: 'leveldb',
            multiInstance: false
        });
        const col1 = await db1.collection({
            name: 'human',
            schema: schemas.human
        });

        await col1.insert(schemaObjects.human());

        await db1.server({
            port: nexPort()
        });

        await col1.insert(schemaObjects.human());

        await AsyncTestUtil.wait(1000);
        db1.destroy();
    });
    it('should work on filesystem-storage (ignored)', async () => {
        console.log('ignoring');
    });
    it('should work for dynamic collection-names', async () => {
        console.log('ignoring');
    });
    it('should throw if collections that created after server()', async () => {
        const port = nexPort();
        const db1 = await RxDB.create({
            name: util.randomCouchString(10),
            adapter: 'memory',
            multiInstance: false
        });
        db1.server({
            port
        });
        await AsyncTestUtil.assertThrows(
            () => db1.collection({
                name: 'human',
                schema: schemas.human
            }),
            'RxError',
            'after'
        );

        db1.destroy();
    });
});
