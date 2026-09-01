import type { Request, Response } from 'express';
export declare const createClientHandler: (req: Request, res: Response) => Promise<void>;
export declare const getClientsHandler: (req: Request, res: Response) => void;
export declare const deleteClientHandler: (req: Request, res: Response) => Promise<any>;
export declare const updateClientHandler: (req: Request, res: Response) => Promise<any>;
export declare const createNoteHandler: (req: Request, res: Response) => void;
export declare const getClientNotesHandler: (req: Request, res: Response) => void;
export declare const createAppointmentHandler: (req: Request, res: Response) => Promise<any>;
export declare const getAppointmentsHandler: (req: Request, res: Response) => void;
export declare const getAppointmentNotesHandler: (req: Request, res: Response) => void;
export declare const getAllAppointmentsHandler: (_req: Request, res: Response) => void;
export declare const getAppointmentByIdHandler: (req: Request, res: Response) => any;
export declare const updateAppointmentHandler: (req: Request, res: Response) => Promise<any>;
export declare const deleteAppointmentHandler: (req: Request, res: Response) => Promise<any>;
export declare const createMeetHandler: (req: Request, res: Response) => Promise<any>;
//# sourceMappingURL=clientController.d.ts.map