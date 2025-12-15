export type Note = {
  id: number;
  clientId: number;
  title: string | null;
  content: string;
  noteDate: string; // date of the note (e.g. '2025-01-01')
  createdAt: string;
  updatedAt: string;
};

export type CreateNoteInput = {
  clientId: number;
  title?: string;
  content: string;
  noteDate: string;
};

export type UpdateNoteInput = {
  title?: string;
  content?: string;
  noteDate?: string;
};


