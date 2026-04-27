export const API = {
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },
  tickets: {
    list: '/tickets',
    detail: (id: string) => `/tickets/${id}`,
    comments: (id: string) => `/tickets/${id}/comments`,
  },
  users: {
    list: '/users',
    detail: (id: string) => `/users/${id}`,
  },
  dashboard: {
    metrics: '/dashboard/metrics',
    export: '/dashboard/export',
  },
} as const
