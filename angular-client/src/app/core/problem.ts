import { HttpErrorResponse } from '@angular/common/http';
import type { Problem } from '../api/types';

/** Turns any HTTP error into Problem Details (the API always sends them; the network may not). */
export function toProblem(error: unknown): Problem {
  if (error instanceof HttpErrorResponse) {
    if (error.error && typeof error.error === 'object' && 'title' in error.error) {
      return error.error as Problem;
    }
    if (error.status === 0) {
      return { title: 'Network error', detail: 'The API is not reachable. Is the backend running?', status: 0 };
    }
    return { title: error.statusText || 'Error', status: error.status, detail: error.message };
  }
  return { title: 'Unexpected error', detail: String(error) };
}

/** Last path segment of the problem type, e.g. "insufficient-funds". */
export function problemSlug(problem: Problem): string {
  return problem.type?.split('/').pop() ?? 'about:blank';
}
