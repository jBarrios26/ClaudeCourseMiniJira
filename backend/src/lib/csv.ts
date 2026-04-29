export interface MetricsRow {
  month:            string;
  ticketsCreated:   number;
  ticketsClosed:    number;
  ticketsArchived:  number;
  openToDo:         number;
  openInProgress:   number;
  openInReview:     number;
}

export function buildMetricsCsv(rows: MetricsRow[]): string {
  const header = 'Month,Tickets Created,Tickets Closed (Done),Tickets Archived,Open To Do,Open In Progress,Open In Review';
  const lines = rows.map(r =>
    [
      r.month,
      r.ticketsCreated,
      r.ticketsClosed,
      r.ticketsArchived,
      r.openToDo,
      r.openInProgress,
      r.openInReview,
    ].join(','),
  );
  return [header, ...lines].join('\n');
}
