export interface MetricsRow {
  month: string;
  ticketsCreated: number;
  ticketsClosed: number;
  ticketsArchived: number;
  openToDo: number;
  openInProgress: number;
  openInReview: number;
}

// TODO: build CSV string from metrics rows
export function buildMetricsCsv(_rows: MetricsRow[]): string {
  return '';
}
