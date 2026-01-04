export type Client = {
  id: number;
  email: string;
  name: string | null;
  birthDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateClientInput = {
  email: string;
  name?: string;
  birthDate?: string;
  password?: string;
};

export type Note = {
  id: number;
  clientId: number;
  title: string | null;
  content: string;
  noteDate: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateNoteInput = {
  clientId: number;
  title?: string;
  content: string;
  noteDate: string;
};
