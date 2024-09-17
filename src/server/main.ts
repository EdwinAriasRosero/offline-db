import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import expressWs from 'express-ws';
import syncRoutes from './routes/syncController';

require('dotenv').config();

const port = process.env.PORT || 3000;
const app = express();
const appWs = expressWs(app);

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/db', syncRoutes(appWs));

app.listen(port, () => { });
