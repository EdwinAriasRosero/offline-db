import { Router } from 'express';
import { FileSystemSyncDb } from '../core/FileSystemSyncDb';
import { RecordModel } from '../RecordModel';
import expressWs from 'express-ws';
import ISyncDB from '../core/ISyncDB';
import { TelegramSyncDb } from '../core/TelegramSyncDb';

const syncRoutes = (appWs: expressWs.Instance) => {
    const router = Router();
    const db: ISyncDB = new TelegramSyncDb();

    router.get("/", (req, res) => {
        res.send("db");
    })

    appWs.app.ws('/db/echo', (ws, req) => {

        ws.on('message', async (message: string) => {
            const { type, timespan, dataArray } = JSON.parse(message) as { type: string, timespan: number, dataArray: RecordModel[] };
            const results = await db.sync(type, dataArray, Number(timespan));

            appWs.getWss().clients.forEach(client => {
                if (client.readyState === 1) { // Check if the client is not the emitter and is open
                    client.send(JSON.stringify({ type, data: results }));
                }
            });
        });
    });

    return router;
};

export default syncRoutes;
