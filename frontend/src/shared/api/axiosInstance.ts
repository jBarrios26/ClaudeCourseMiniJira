import axios from 'axios'
import { useAuthStore } from '@/shared/stores/authStore'
import { useDraftStore } from '@/shared/stores/draftStore'
import { API } from './endpoints'
import type { TicketDraft } from '@/shared/types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // sends httpOnly refresh token cookie
})

// Attach access token from Zustand store to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Refresh token mutex — one renewal at a time, queue parallel 401s
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: string) => void
  reject: (reason: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token!)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
        .catch((err) => Promise.reject(err))
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}${API.auth.refresh}`,
        {},
        { withCredentials: true },
      )

      const { accessToken, user } = data
      useAuthStore.getState().setAuth(user, accessToken)
      processQueue(null, accessToken)

      originalRequest.headers.Authorization = `Bearer ${accessToken}`
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)

      // Persist any active form draft before redirecting
      const activeDraft = (window as Window & { __activeDraft?: TicketDraft }).__activeDraft
      if (activeDraft) {
        useDraftStore.getState().saveDraft(activeDraft)
      }

      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default api
