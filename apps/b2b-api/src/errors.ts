export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const missing = () => new HttpError(404, 'NOT_FOUND', 'Recurso no disponible.');
export const denied = () =>
  new HttpError(403, 'FORBIDDEN', 'No tenés permiso para esta operación.');
export const conflict = () =>
  new HttpError(409, 'REVISION_CONFLICT', 'El contenido cambió. Actualizá antes de guardar.');
