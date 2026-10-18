import type { ProductIssue } from '@klisteniapp/b2b-contracts/product-v2';
export class HttpError extends Error {
  status: number;
  code: string;
  issues?: ProductIssue[];
  constructor(status: number, code: string, message: string, issues?: ProductIssue[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export const missing = () => new HttpError(404, 'NOT_FOUND', 'Recurso no disponible.');
export const denied = () =>
  new HttpError(403, 'FORBIDDEN', 'No tenés permiso para esta operación.');
export const conflict = () =>
  new HttpError(409, 'REVISION_CONFLICT', 'El contenido cambió. Actualizá antes de guardar.');
