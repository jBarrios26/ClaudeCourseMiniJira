import cors from 'cors';
import express from 'express';

import authRouter     from './routes/auth';
import commentsRouter from './routes/comments';
import dashboardRouter from './routes/dashboard';
import labelsRouter   from './routes/labels';
import metricsRouter  from './routes/metrics';
import projectsRouter from './routes/projects';
import ticketsRouter  from './routes/tickets';
import usersRouter    from './routes/users';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

app.use('/auth',      authRouter);
app.use('/users',     usersRouter);
app.use('/projects',  projectsRouter);
app.use('/tickets',   ticketsRouter);
app.use('/tickets',   commentsRouter);
app.use('/labels',    labelsRouter);
app.use('/dashboard', dashboardRouter);
app.use('/metrics',   metricsRouter);

export default app;
