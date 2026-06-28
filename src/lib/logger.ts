const tag = (scope: string) => `[openPics:${scope}]`

export function log(scope: string, msg: string, data?: unknown) {
  if (data !== undefined) {
    console.log(tag(scope), msg, data)
  } else {
    console.log(tag(scope), msg)
  }
}

export function err(scope: string, msg: string, error?: unknown) {
  const detail =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error
  console.error(tag(scope), '✗', msg, detail ?? '')
}
