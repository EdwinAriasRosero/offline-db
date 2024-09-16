import { Router } from 'express';
import { FileSystemSyncDb } from '../core/FileSystemSyncDb';
import { RecordModel } from '../RecordModel';
import expressWs from 'express-ws';
import ISyncDB from '../core/ISyncDB';

const syncRoutes = (appWs: expressWs.Instance) => {
    const router = Router();
    const db: ISyncDB = new FileSystemSyncDb();

    appWs.app.ws('/db/echo', (ws, req) => {
        // Attach the WebSocket to the request object
        //(req as any).ws = ws;

        ws.on('message', async (message: string) => {
            const { type, timespan, dataArray } = JSON.parse(message) as { type: string, timespan: number, dataArray: RecordModel[] };
            const results = await db.sync(type, dataArray, Number(timespan));

            //if (results.hasChanged) {
            appWs.getWss().clients.forEach(client => {
                if (client.readyState === 1) { // Check if the client is not the emitter and is open

                    //client !== (req as any).ws &&
                    client.send(JSON.stringify({ type, data: results.data }));
                }
            });
        });
    });

    return router;
};

export default syncRoutes;
