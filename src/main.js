import express from 'express';
import morgan from 'morgan';
import syncRoutes from './routes/syncController.js';

let app = express();
app.use(morgan());
app.use(express.json());

app.use(syncRoutes);

app.listen(3000);

console.log("hello world 2!!");