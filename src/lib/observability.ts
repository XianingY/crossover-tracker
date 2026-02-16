import * as Sentry from '@sentry/nextjs'

interface ApiErrorContext {
  [key: string]: unknown
}

function hasSentryDsn(): boolean {
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)
}

export function captureApiException(
  route: string,
  error: unknown,
  context: ApiErrorContext = {}
): void {
  if (!hasSentryDsn()) {
    return
  }

  Sentry.withScope(scope => {
    scope.setTag('api.route', route)
    scope.setContext('api', context)

    if (error instanceof Error) {
      Sentry.captureException(error)
      return
    }

    Sentry.captureMessage(
      `${route} threw non-Error exception: ${typeof error === 'string' ? error : 'unknown'}`
    )
  })
}
