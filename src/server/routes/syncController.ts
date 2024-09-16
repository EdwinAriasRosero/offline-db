import { Router } from 'express';
import { RecordModel } from '../core/RecordModel';
import expressWs from 'express-ws';
import ISyncDB from '../core/ISyncDB';
import { TelegramSyncDb } from '../core/TelegramSyncDb';
import { replacer, reviver } from '../../shared/jsonUtilities';

const syncRoutes = (appWs: expressWs.Instance) => {
    const router = Router();
    const db: ISyncDB = new TelegramSyncDb();

    appWs.app.ws('/db/echo', (ws, req) => {

        ws.on('message', async (message: string) => {
            const { type, timespan, dataArray } = JSON.parse(message, reviver) as { type: string, timespan: number, dataArray: RecordModel[] };
            const results = await db.sync(type, dataArray, Number(timespan));

            appWs.getWss().clients.forEach(client => {
                if (client.readyState === 1) { // Check if the client is not the emitter and is open
                    client.send(JSON.stringify({ type, data: results }, replacer));
                }
            });
        });
    });

    return router;
};

export default syncRoutes;
