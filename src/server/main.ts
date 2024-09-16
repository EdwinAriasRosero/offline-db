import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import expressWs from 'express-ws';
import syncRoutes from './routes/syncController';


const path = require('path');
const app = express();
const appWs = expressWs(app);

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// app.get('/', (req, res) => {
//     res.sendFile('C:/DV/others/db-sync/client/index.html');
// });

app.use('/db', syncRoutes(appWs));

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
