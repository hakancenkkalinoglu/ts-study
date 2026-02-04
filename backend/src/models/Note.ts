export type Note = {
  id: number;
  clientId: number;
  appointmentId: number | null;
  title: string | null;
  content: string;
  filePath: string | null;
  noteDate: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateNoteInput = {
  clientId: number;
  appointmentId?: number | null;
  title?: string;
  content: string;
  noteDate: string;
  filePath?: string | null;
};

export type UpdateNoteInput = {
  title?: string;
  content?: string;
  noteDate?: string;
};


