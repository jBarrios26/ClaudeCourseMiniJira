import 'dotenv/config';
import cors from 'cors';
import express from 'express';

import authRouter from './routes/auth';
import commentsRouter from './routes/comments';
import dashboardRouter from './routes/dashboard';
import labelsRouter from './routes/labels';
import metricsRouter from './routes/metrics';
import ticketsRouter from './routes/tickets';
import usersRouter from './routes/users';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

app.use('/auth',      authRouter);
app.use('/users',     usersRouter);
app.use('/tickets',   ticketsRouter);
app.use('/tickets',   commentsRouter);   // /:id/comments nested under /tickets
app.use('/labels',    labelsRouter);
app.use('/dashboard', dashboardRouter);
app.use('/metrics',   metricsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
