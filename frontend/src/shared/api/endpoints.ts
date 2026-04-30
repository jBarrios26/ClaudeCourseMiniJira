export const API = {
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },
  tickets: {
    list: '/tickets',
    detail: (id: string) => `/tickets/${id}`,
    archive: (id: string) => `/tickets/${id}/archive`,
    restore: (id: string) => `/tickets/${id}/restore`,
    comments: (id: string) => `/tickets/${id}/comments`,
  },
  users: {
    list: '/users',
    detail: (id: string) => `/users/${id}`,
  },
  projects: {
    list: '/projects',
    detail: (id: number) => `/projects/${id}`,
  },
  dashboard: {
    metrics: '/dashboard/metrics',
    export: '/dashboard/export',
  },
} as const
