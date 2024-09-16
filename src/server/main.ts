import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import expressWs from 'express-ws';
import syncRoutes from './routes/syncController';

require('dotenv').config();

const path = require('path');
const port = process.env.PORT || 3000;
const app = express();
const appWs = expressWs(app);

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// app.get('/', (req, res) => {
//     res.sendFile('C:/DV/others/db-sync/client/index.html');
// });

app.get('/', (req, res) => {
    res.send("Hello world!!");
});

app.use('/db', syncRoutes(appWs));

app.listen(port, () => {
    console.log("Server is running on port 3000");
});
